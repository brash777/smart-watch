import { snapInsightDataSchemas, type SpaceMode } from '@snapia/shared';
import type { z } from 'zod';
import type { Config } from '../../../config/env';
import type { StorageProvider } from '../../../lib/storage';
import type { SettingsService } from '../../settings/settings.service';
import { prepareImageForAi } from '../ai-images';
import type { AiRunner } from '../ai-runner';
import type { PromptLoader } from '../prompt-loader';
import { describeSpaceMetadata, NONE, textForAi, type SnapInsightData } from '../snap-context';

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

export type { SnapInsightData } from '../snap-context';

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
    return textForAi(text, config.contextMaxChars);
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
        space_metadata: describeSpaceMetadata(mode, metadata, config.contextMaxChars),
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
