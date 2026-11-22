import { snapInsightDataSchemas, type SnapInsightDataByMode, type SpaceMode } from '@snapia/shared';
import type { z } from 'zod';
import type { Config } from '../../../config/env';
import { removeContactDetails } from '../../../lib/personal-data';
import type { StorageProvider } from '../../../lib/storage';
import type { SettingsService } from '../../settings/settings.service';
import { prepareImageForAi } from '../ai-images';
import type { AiRunner } from '../ai-runner';
import type { PromptLoader } from '../prompt-loader';

/*
 * The quick analysis of one snap (task SNAP_ANALYSIS): the photo plus a prompt for the mode of
 * its Space (prompts/snap-analysis.<mode>.v<N>.md). The answer becomes the snap's SnapInsight.
 */

/** What the analysis reads about a snap. */
export interface SnapForAnalysis {
  id: string;
  spaceId: string;
  authorId: string;
  storageKey: string;
  note: string | null;
  tags: string[];
  takenAt: Date;
  space: { mode: SpaceMode; metadata: unknown };
}

export type SnapInsightData = SnapInsightDataByMode[SpaceMode];

/** The result, ready to be stored as the snap's SnapInsight. */
export interface SnapAnalysis {
  mode: SpaceMode;
  data: SnapInsightData;
  aiRunId: string;
  promptVersion: string;
}

/** The tool the model answers with. It stays the same between calls. */
export const SAVE_SNAP_INSIGHT_TOOL = {
  name: 'save_snap_insight',
  description: 'Saves the analysis of the snap. Call it once, with every field filled in.',
};

/**
 * Space metadata that helps to read a snap. Fields that name people (professor, client) are
 * never sent to the AI.
 */
const SPACE_CONTEXT_FIELDS = {
  STUDY: ['subject', 'semester'],
  WORK: ['project', 'siteLabel'],
  CONTENT: ['niche'],
} as const satisfies Record<SpaceMode, readonly string[]>;

/** What the prompt says when a value is empty. */
const NONE = '(none)';

/** Tags that would close the delimited note early. */
const NOTE_DELIMITERS = /<\/?author_note>/gi;

export interface SnapAnalysisTaskDependencies {
  runner: AiRunner;
  prompts: PromptLoader;
  settings: SettingsService;
  storage: StorageProvider;
  config: Config['ai'];
}

export function createSnapAnalysisTask({
  runner,
  prompts,
  settings,
  storage,
  config,
}: SnapAnalysisTaskDependencies) {
  /** Text written by people: no emails or phone numbers, and at most AI_CONTEXT_MAX_CHARS. */
  function peopleText(text: string): string {
    return removeContactDetails(text)
      .replace(NOTE_DELIMITERS, '')
      .slice(0, config.contextMaxChars)
      .trim();
  }

  function spaceContext(mode: SpaceMode, metadata: unknown): string {
    const fields: Record<string, unknown> =
      typeof metadata === 'object' && metadata !== null ? { ...metadata } : {};
    const lines = SPACE_CONTEXT_FIELDS[mode].flatMap((field) => {
      const value = fields[field];
      return typeof value === 'string' && value.trim() !== ''
        ? [`  - ${field}: ${peopleText(value)}`]
        : [];
    });
    return lines.length > 0 ? lines.join('\n') : `  - ${NONE}`;
  }

  return {
    /** Analyzes a snap. userId is who the AiRun is for; it is never sent to the AI. */
    async analyze(snap: SnapForAnalysis, userId: string): Promise<SnapAnalysis> {
      const { mode, metadata } = snap.space;
      const note = snap.note === null ? '' : peopleText(snap.note);
      const tags = peopleText(snap.tags.join(', '));
      const values: Record<string, string> = {
        tool_name: SAVE_SNAP_INSIGHT_TOOL.name,
        output_language: await settings.getSetting('ai_output_language'),
        space_metadata: spaceContext(mode, metadata),
        taken_at: snap.takenAt.toISOString(),
        snap_tags: tags === '' ? NONE : tags,
        author_note: note === '' ? NONE : note,
        ...(mode === 'CONTENT'
          ? { caption_tone: await settings.getSetting('content_caption_tone') }
          : {}),
      };
      const prompt = await prompts.render(`snap-analysis.${mode.toLowerCase()}`, values);
      const image = await prepareImageForAi(await storage.getBuffer(snap.storageKey), config.image);
      const schema: z.ZodType<SnapInsightData> = snapInsightDataSchemas[mode];

      const result = await runner.run({
        task: 'SNAP_ANALYSIS',
        prompt,
        images: [image],
        tool: { ...SAVE_SNAP_INSIGHT_TOOL, schema },
        effort: config.snapAnalysis.effort,
        speed: config.snapAnalysis.speed,
        userId,
        spaceId: snap.spaceId,
        input: {
          snapId: snap.id,
          mode,
          image: { mediaType: image.mediaType, width: image.width, height: image.height },
          effort: config.snapAnalysis.effort,
          speed: config.snapAnalysis.speed,
          values,
        },
      });
      return {
        mode,
        data: result.output,
        aiRunId: result.aiRunId,
        promptVersion: result.promptVersion,
      };
    },
  };
}

export type SnapAnalysisTask = ReturnType<typeof createSnapAnalysisTask>;
