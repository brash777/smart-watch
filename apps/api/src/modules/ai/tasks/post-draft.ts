import { postDraftSchema, type PostDraft } from '@snapia/shared';
import type { Config } from '../../../config/env';
import type { SettingsService } from '../../settings/settings.service';
import type { AiRunner } from '../ai-runner';
import type { PromptLoader } from '../prompt-loader';
import { formatSnapContext, NONE, type AnalyzedSnap } from '../snap-context';

/*
 * A suggested caption and hashtags for a Post (task POST_DRAFT): a short call with the insights
 * of the snaps. Snaps of CONTENT Spaces already have caption and hashtag suggestions, so the
 * posts service only calls this task for snaps of other modes.
 */

export const SAVE_POST_DRAFT_TOOL = {
  name: 'save_post_draft',
  description: 'Saves the caption and the hashtags of the post. Call it once.',
};

export interface PostDraftRequest {
  /** Analyzed snaps, in the order of the post. */
  snaps: readonly AnalyzedSnap[];
  /** Who asked, and the Space when all the snaps share one: stored in the AiRun only. */
  userId: string;
  spaceId: string | null;
}

export function createPostDraftTask({
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
  return {
    async draft({ snaps, userId, spaceId }: PostDraftRequest): Promise<PostDraft> {
      const defaultHashtags = await settings.getSetting('default_hashtags');
      const prompt = await prompts.render('post-draft', {
        tool_name: SAVE_POST_DRAFT_TOOL.name,
        output_language: await settings.getSetting('ai_output_language'),
        caption_tone: await settings.getSetting('content_caption_tone'),
        default_hashtags:
          defaultHashtags.length > 0 ? defaultHashtags.map((tag) => `#${tag}`).join(' ') : NONE,
        snap_count: String(snaps.length),
        snaps: formatSnapContext(snaps, config.contextMaxChars),
      });
      const result = await runner.run({
        task: 'POST_DRAFT',
        prompt,
        images: [],
        tool: { ...SAVE_POST_DRAFT_TOOL, schema: postDraftSchema },
        effort: config.effort,
        speed: 'standard',
        userId,
        spaceId,
        input: { snapIds: snaps.map(({ id }) => id) },
      });
      // The hashtags every post includes are there even if the model forgot them.
      return {
        caption: result.output.caption,
        hashtags: [...new Set([...defaultHashtags, ...result.output.hashtags])],
      };
    },
  };
}

export type PostDraftTask = ReturnType<typeof createPostDraftTask>;
