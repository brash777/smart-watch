import {
  documentDraftSchema,
  type DocumentDraft,
  type DocumentType,
  type SpaceMode,
} from '@snapia/shared';
import type { Config } from '../../../config/env';
import type { SettingsService } from '../../settings/settings.service';
import type { AiRunner } from '../ai-runner';
import type { PromptLoader } from '../prompt-loader';
import {
  describeSpaceMetadata,
  formatSnapContext,
  invalidCitations,
  NONE,
  textForAi,
  type AnalyzedSnap,
} from '../snap-context';

/*
 * Compose (task COMPOSE_DOCUMENT): a Document drafted from the insights of the selected snaps,
 * with one prompt per Document type (prompts/compose.<type>.v<N>.md). The snaps go numbered
 * by the date they were taken and the text cites them as [Snap N].
 */

export const SAVE_DOCUMENT_TOOL = {
  name: 'save_document',
  description: 'Saves the document. Call it once, with its title and its Markdown content.',
};

export interface ComposeRequest {
  type: DocumentType;
  space: { id: string; mode: SpaceMode; metadata: unknown };
  /** Analyzed snaps, the first taken first. */
  snaps: readonly AnalyzedSnap[];
  instructions: string | null;
  /** Who asked: stored in the AiRun, never sent to the AI. */
  userId: string;
}

export interface ComposedDocument extends DocumentDraft {
  aiRunId: string;
  promptVersion: string;
}

export interface ComposeDocumentTaskDependencies {
  runner: AiRunner;
  prompts: PromptLoader;
  settings: SettingsService;
  config: Config['ai'];
}

/** compose.study-notes, compose.work-daily-report… */
export function composePromptName(type: DocumentType): string {
  return `compose.${type.toLowerCase().replaceAll('_', '-')}`;
}

/** The draft schema, plus: the text only cites the snaps that were sent. */
function draftCiting(snapCount: number) {
  return documentDraftSchema.superRefine((draft, ctx) => {
    for (const message of invalidCitations(draft.contentMarkdown, snapCount)) {
      ctx.addIssue({ code: 'custom', path: ['contentMarkdown'], message });
    }
  });
}

function day(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function createComposeDocumentTask({
  runner,
  prompts,
  settings,
  config,
}: ComposeDocumentTaskDependencies) {
  /** Placeholders that only some Document types use. */
  async function typeValues(
    type: DocumentType,
    snaps: readonly AnalyzedSnap[],
  ): Promise<Record<string, string>> {
    if (type === 'CONTENT_POST' || type === 'CONTENT_CAROUSEL') {
      const hashtags = await settings.getSetting('default_hashtags');
      return {
        caption_tone: await settings.getSetting('content_caption_tone'),
        default_hashtags: hashtags.length > 0 ? hashtags.map((tag) => `#${tag}`).join(' ') : NONE,
      };
    }
    if (type === 'WORK_PROGRESS_REPORT') {
      const first = snaps.at(0)?.takenAt;
      const last = snaps.at(-1)?.takenAt;
      return { period: first && last ? `${day(first)} to ${day(last)}` : NONE };
    }
    return {};
  }

  return {
    async compose({
      type,
      space,
      snaps,
      instructions,
      userId,
    }: ComposeRequest): Promise<ComposedDocument> {
      const values: Record<string, string> = {
        tool_name: SAVE_DOCUMENT_TOOL.name,
        output_language: await settings.getSetting('ai_output_language'),
        space_metadata: describeSpaceMetadata(space.mode, space.metadata, config.contextMaxChars),
        instructions:
          instructions === null ? NONE : textForAi(instructions, config.contextMaxChars),
        snap_count: String(snaps.length),
        snaps: formatSnapContext(snaps, config.contextMaxChars),
        ...(await typeValues(type, snaps)),
      };
      const prompt = await prompts.render(composePromptName(type), values);
      const { snaps: _snapsText, ...storedValues } = values;

      const result = await runner.run({
        task: 'COMPOSE_DOCUMENT',
        prompt,
        images: [],
        tool: { ...SAVE_DOCUMENT_TOOL, schema: draftCiting(snaps.length) },
        effort: config.effort,
        speed: 'standard',
        userId,
        spaceId: space.id,
        // The snaps are stored by id: their content is already in the database.
        input: { type, snapIds: snaps.map(({ id }) => id), values: storedValues },
      });
      return { ...result.output, aiRunId: result.aiRunId, promptVersion: result.promptVersion };
    },
  };
}

export type ComposeDocumentTask = ReturnType<typeof createComposeDocumentTask>;
