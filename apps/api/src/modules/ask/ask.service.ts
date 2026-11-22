import type { AskBody, AskExchange, AskMessage } from '@snapia/shared';
import { AppError } from '../../lib/app-error';
import type { SpaceAccess } from '../../middlewares/require-space-role';
import type { AskSpaceTask } from '../ai/tasks/ask-space';
import type { SettingsService } from '../settings/settings.service';
import type { SnapInsightsRepository } from '../snap-insights/snap-insights.repository';
import { toAnalyzedSnap } from '../snap-insights/snap-selection';
import type { AskMessageRecord, AskRepository } from './ask.repository';

export interface AskServiceDependencies {
  repository: AskRepository;
  snapInsights: SnapInsightsRepository;
  task: AskSpaceTask;
  settings: SettingsService;
}

function toAskMessage(message: AskMessageRecord): AskMessage {
  return { ...message, createdAt: message.createdAt.toISOString() };
}

export function createAskService({
  repository,
  snapInsights,
  task,
  settings,
}: AskServiceDependencies) {
  return {
    /**
     * Answers a question with the analyzed snaps of the Space (EDITOR or OWNER). Each user has
     * their own conversation per Space; the last ask_history_max_messages go with the question.
     */
    async ask(access: SpaceAccess, userId: string, { question }: AskBody): Promise<AskExchange> {
      const space = await repository.findSpace(access.spaceId);
      if (space === null) throw new AppError('SPACE_NOT_FOUND', 'Space not found', 404);
      const snaps = (await snapInsights.listAnalyzedSnaps(space.id)).map(toAnalyzedSnap);
      if (snaps.length === 0) {
        throw new AppError(
          'NO_ANALYZED_SNAPS',
          'This Space has no analyzed snaps to answer from',
          409,
        );
      }
      const history = await repository.recentMessages(
        space.id,
        userId,
        await settings.getSetting('ask_history_max_messages'),
      );

      const answer = await task.ask({ space, question, history, snaps, userId });
      const [questionMessage, answerMessage] = await repository.saveExchange(
        space.id,
        userId,
        question,
        {
          content: answer.answer,
          citedSnapIds: answer.citedSnapIds,
          aiRunId: answer.aiRunId,
          promptVersion: answer.promptVersion,
        },
      );
      return {
        question: toAskMessage(questionMessage),
        answer: toAskMessage(answerMessage),
        found: answer.found,
      };
    },
  };
}

export type AskService = ReturnType<typeof createAskService>;
