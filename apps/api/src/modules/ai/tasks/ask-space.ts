import { askAnswerDraftSchema, type AskMessageRole, type SpaceMode } from '@snapia/shared';
import type { Config } from '../../../config/env';
import type { SettingsService } from '../../settings/settings.service';
import type { AiRunner } from '../ai-runner';
import type { PromptLoader } from '../prompt-loader';
import {
  citedSnapNumbers,
  describeSpaceMetadata,
  fitSnapContext,
  invalidCitations,
  NONE,
  textForAi,
  type AnalyzedSnap,
} from '../snap-context';

/*
 * "Ask your Space" (task ASK_SPACE). There is no vector search: the snaps are ranked by the
 * words their insight, note and tags have in common with the question (a word that few snaps
 * have counts more), and the best ones go to the AI while they fit in AI_CONTEXT_MAX_CHARS.
 * The answer only uses the snaps, cites them as [Snap N] and says when they do not have it.
 */

export const SAVE_ANSWER_TOOL = {
  name: 'save_answer',
  description: 'Saves the answer to the question. Call it once.',
};

const SNAP_CITATIONS = /\s*\[Snap \d+\]/g;

export interface AskRequest {
  space: { id: string; mode: SpaceMode; metadata: unknown };
  question: string;
  /** The previous messages of the conversation, the oldest first. */
  history: readonly { role: AskMessageRole; content: string }[];
  /** Every analyzed snap of the Space. */
  snaps: readonly AnalyzedSnap[];
  /** Who asked: stored in the AiRun, never sent to the AI. */
  userId: string;
}

export interface AskAnswer {
  answer: string;
  found: boolean;
  /** The snaps the answer cites. */
  citedSnapIds: string[];
  aiRunId: string;
  promptVersion: string;
}

/** Lowercase words without accents, so "Cálculo" and "calculo" match. */
function wordsOf(text: string): Set<string> {
  const plain = text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
  return new Set(plain.match(/[\p{L}\p{N}]+/gu) ?? []);
}

/**
 * The snaps ordered by the words they share with the question, the most related first. Each
 * shared word counts log(1 + snaps / snaps that have it), so words that every snap has (de, la,
 * que…) weigh little. Ties keep the newest first.
 */
export function rankByWordsInCommon(
  question: string,
  snaps: readonly AnalyzedSnap[],
): AnalyzedSnap[] {
  const questionWords = [...wordsOf(question)];
  const snapWords = snaps.map((snap) =>
    wordsOf([JSON.stringify(snap.insight), snap.note ?? '', ...snap.tags].join(' ')),
  );
  const weight = new Map(
    questionWords.map((word) => {
      const having = snapWords.filter((words) => words.has(word)).length;
      return [word, having === 0 ? 0 : Math.log(1 + snaps.length / having)];
    }),
  );
  return snaps
    .map((snap, index) => ({
      snap,
      score: questionWords.reduce(
        (sum, word) => sum + (snapWords[index]?.has(word) === true ? (weight.get(word) ?? 0) : 0),
        0,
      ),
    }))
    .sort((a, b) => b.score - a.score || b.snap.takenAt.getTime() - a.snap.takenAt.getTime())
    .map(({ snap }) => snap);
}

export function createAskSpaceTask({
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
  /** Earlier answers lose their citations: they refer to another numbering of the snaps. */
  function historyText(history: AskRequest['history']): string {
    if (history.length === 0) return NONE;
    return history
      .map(({ role, content }) => {
        const text = role === 'ASSISTANT' ? content.replace(SNAP_CITATIONS, '') : content;
        return `- ${role === 'USER' ? 'Question' : 'Answer'}: ${textForAi(text, config.contextMaxChars)}`;
      })
      .join('\n');
  }

  return {
    async ask({ space, question, history, snaps, userId }: AskRequest): Promise<AskAnswer> {
      const context = fitSnapContext(rankByWordsInCommon(question, snaps), config.contextMaxChars);
      const sent = context.snaps;
      const values: Record<string, string> = {
        tool_name: SAVE_ANSWER_TOOL.name,
        output_language: await settings.getSetting('ai_output_language'),
        space_metadata: describeSpaceMetadata(space.mode, space.metadata, config.contextMaxChars),
        history: historyText(history),
        snap_count: String(sent.length),
        snaps: context.text === '' ? NONE : context.text,
        question: textForAi(question, config.contextMaxChars),
      };
      const prompt = await prompts.render('ask-space', values);
      const schema = askAnswerDraftSchema.superRefine((draft, ctx) => {
        for (const message of invalidCitations(draft.answer, sent.length)) {
          ctx.addIssue({ code: 'custom', path: ['answer'], message });
        }
      });

      const result = await runner.run({
        task: 'ASK_SPACE',
        prompt,
        images: [],
        tool: { ...SAVE_ANSWER_TOOL, schema },
        effort: config.effort,
        speed: 'standard',
        userId,
        spaceId: space.id,
        input: { question: values.question, snapIds: sent.map(({ id }) => id) },
      });
      const citedSnapIds = citedSnapNumbers(result.output.answer).flatMap((number) => {
        const snap = sent[number - 1];
        return snap === undefined ? [] : [snap.id];
      });
      return {
        answer: result.output.answer,
        found: result.output.found,
        citedSnapIds,
        aiRunId: result.aiRunId,
        promptVersion: result.promptVersion,
      };
    },
  };
}

export type AskSpaceTask = ReturnType<typeof createAskSpaceTask>;
