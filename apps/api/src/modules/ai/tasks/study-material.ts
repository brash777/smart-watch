import {
  flashcardDeckDraftSchema,
  quizDraftSchema,
  type FlashcardDeckDraft,
  type QuizDraft,
  type SpaceMode,
} from '@snapia/shared';
import type { z } from 'zod';
import type { Config } from '../../../config/env';
import type { SettingsService } from '../../settings/settings.service';
import type { AiRunner } from '../ai-runner';
import type { PromptLoader } from '../prompt-loader';
import { describeSpaceMetadata, formatSnapContext, type AnalyzedSnap } from '../snap-context';

/*
 * Study tools (tasks STUDY_FLASHCARDS and STUDY_QUIZ): a FlashcardDeck or a Quiz from the
 * insights of the selected snaps. Each card and question says which snap it comes from.
 */

export const SAVE_FLASHCARDS_TOOL = {
  name: 'save_flashcards',
  description: 'Saves the flashcard deck. Call it once, with its title and its cards.',
};

export const SAVE_QUIZ_TOOL = {
  name: 'save_quiz',
  description: 'Saves the quiz. Call it once, with its title and its questions.',
};

export interface StudyMaterialRequest {
  space: { id: string; mode: SpaceMode; metadata: unknown };
  /** Analyzed snaps, the first taken first. */
  snaps: readonly AnalyzedSnap[];
  /** Who asked: stored in the AiRun, never sent to the AI. */
  userId: string;
}

export type Generated<T> = T & { aiRunId: string; promptVersion: string };

/** The draft schema, plus: every sourceSnap is one of the snaps sent. */
function citingSnaps<T extends z.ZodType>(
  schema: T,
  items: (draft: z.output<T>) => { sourceSnap: number }[],
  listName: string,
  snapCount: number,
) {
  return schema.superRefine((draft, ctx) => {
    items(draft).forEach(({ sourceSnap }, index) => {
      if (sourceSnap > snapCount) {
        ctx.addIssue({
          code: 'custom',
          path: [listName, index, 'sourceSnap'],
          message: `must be a snap number from 1 to ${String(snapCount)}`,
        });
      }
    });
  });
}

export function createStudyMaterialTasks({
  runner,
  prompts,
  settings,
  config,
}: {
  runner: AiRunner;
  prompts: PromptLoader;
  settings: SettingsService;
  config: Config['ai'];
}) {
  async function values(
    { space, snaps }: StudyMaterialRequest,
    toolName: string,
    count: number,
  ): Promise<Record<string, string>> {
    return {
      tool_name: toolName,
      output_language: await settings.getSetting('ai_output_language'),
      space_metadata: describeSpaceMetadata(space.mode, space.metadata, config.contextMaxChars),
      count: String(count),
      snap_count: String(snaps.length),
      snaps: formatSnapContext(snaps, config.contextMaxChars),
    };
  }

  function input(request: StudyMaterialRequest, count: number) {
    return { snapIds: request.snaps.map(({ id }) => id), count };
  }

  return {
    /** A deck of flashcards_default_count cards (fewer when the snaps have little content). */
    async generateFlashcards(
      request: StudyMaterialRequest,
    ): Promise<Generated<FlashcardDeckDraft>> {
      const count = await settings.getSetting('flashcards_default_count');
      const prompt = await prompts.render(
        'generate-flashcards',
        await values(request, SAVE_FLASHCARDS_TOOL.name, count),
      );
      const schema = citingSnaps(
        flashcardDeckDraftSchema,
        (deck) => deck.cards,
        'cards',
        request.snaps.length,
      );
      const result = await runner.run({
        task: 'STUDY_FLASHCARDS',
        prompt,
        images: [],
        tool: { ...SAVE_FLASHCARDS_TOOL, schema },
        effort: config.effort,
        speed: 'standard',
        userId: request.userId,
        spaceId: request.space.id,
        input: input(request, count),
      });
      return { ...result.output, aiRunId: result.aiRunId, promptVersion: result.promptVersion };
    },

    /** A quiz of quiz_default_questions questions (fewer when the snaps have little content). */
    async generateQuiz(request: StudyMaterialRequest): Promise<Generated<QuizDraft>> {
      const count = await settings.getSetting('quiz_default_questions');
      const prompt = await prompts.render(
        'generate-quiz',
        await values(request, SAVE_QUIZ_TOOL.name, count),
      );
      const schema = citingSnaps(
        quizDraftSchema,
        (quiz) => quiz.questions,
        'questions',
        request.snaps.length,
      );
      const result = await runner.run({
        task: 'STUDY_QUIZ',
        prompt,
        images: [],
        tool: { ...SAVE_QUIZ_TOOL, schema },
        effort: config.effort,
        speed: 'standard',
        userId: request.userId,
        spaceId: request.space.id,
        input: input(request, count),
      });
      return { ...result.output, aiRunId: result.aiRunId, promptVersion: result.promptVersion };
    },
  };
}

export type StudyMaterialTasks = ReturnType<typeof createStudyMaterialTasks>;
