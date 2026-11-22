import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import type { Logger } from 'pino';
import { pinoHttp } from 'pino-http';
import type { Config } from './config/env';
import type { EventBus } from './lib/events';
import { createImageProcessor } from './lib/images/image-processor';
import type { PrismaClient } from './lib/prisma';
import type { StorageProvider } from './lib/storage';
import { createAuthMiddlewares } from './middlewares/authenticate';
import { createErrorHandler } from './middlewares/error-handler';
import { notFound } from './middlewares/not-found';
import { createRateLimiter } from './middlewares/rate-limit';
import { createRequireSpaceRole } from './middlewares/require-space-role';
import { requestId } from './middlewares/request-id';
import { createImageUpload } from './middlewares/upload';
import { createAiQueue, type AiQueue } from './modules/ai/ai-queue';
import type { AiProvider } from './modules/ai/ai-provider';
import { createAiRunner } from './modules/ai/ai-runner';
import { createAiRunsRepository } from './modules/ai/ai-runs.repository';
import { createPromptLoader } from './modules/ai/prompt-loader';
import { createAskSpaceTask } from './modules/ai/tasks/ask-space';
import { createComposeDocumentTask } from './modules/ai/tasks/compose-document';
import { createSnapAnalysisTask } from './modules/ai/tasks/snap-analysis';
import { createStudyMaterialTasks } from './modules/ai/tasks/study-material';
import { createAskRepository } from './modules/ask/ask.repository';
import { createAskRouter } from './modules/ask/ask.routes';
import { createAskService } from './modules/ask/ask.service';
import { createAuthRepository } from './modules/auth/auth.repository';
import { createAuthRouter } from './modules/auth/auth.routes';
import { createTokenService } from './modules/auth/auth.tokens';
import { createDocumentsRepository } from './modules/documents/documents.repository';
import {
  createDocumentsRouter,
  createSpaceDocumentsRouter,
} from './modules/documents/documents.routes';
import { createDocumentsService } from './modules/documents/documents.service';
import { createFollowsRouter } from './modules/follows/follows.routes';
import { createHealthRouter } from './modules/health/health.routes';
import { createSettingsRepository } from './modules/settings/settings.repository';
import { createSettingsService } from './modules/settings/settings.service';
import { createSnapInsightsRepository } from './modules/snap-insights/snap-insights.repository';
import {
  createSnapInsightsRouter,
  createSpaceAnalysisRouter,
} from './modules/snap-insights/snap-insights.routes';
import { createSnapInsightsService } from './modules/snap-insights/snap-insights.service';
import { createSnapSelection } from './modules/snap-insights/snap-selection';
import { createSnapPermissions } from './modules/snaps/snap-permissions';
import { createSnapsRepository } from './modules/snaps/snaps.repository';
import { createSnapsRouter, createSpaceSnapsRouter } from './modules/snaps/snaps.routes';
import { createSnapsService } from './modules/snaps/snaps.service';
import { createSpaceInvitesRouter } from './modules/space-invites/space-invites.routes';
import { createSpaceMembersRouter } from './modules/space-members/space-members.routes';
import { createSpaceContentPermissions } from './modules/spaces/space-content-permissions';
import { createSpacesRepository } from './modules/spaces/spaces.repository';
import { createSpacesRouter } from './modules/spaces/spaces.routes';
import { createStudyRepository } from './modules/study/study.repository';
import { createQuizzesRouter, createSpaceStudyRouter } from './modules/study/study.routes';
import { createStudyService } from './modules/study/study.service';
import { createAvatarUrlResolver } from './modules/users/avatars';
import { createAdminUsersRouter, createUsersRouter } from './modules/users/users.routes';

export interface AppDependencies {
  config: Config;
  logger: Logger;
  prisma: PrismaClient;
  /** Where photos are stored (STORAGE_DRIVER). */
  storage: StorageProvider;
  /** In-process events, such as snap.created. */
  events: EventBus;
  /** The AI provider (AI_PROVIDER). */
  aiProvider: AiProvider;
}

export interface Application {
  app: Express;
  /** Background AI work. It starts paused: server.ts starts it once the API listens. */
  aiQueue: AiQueue;
}

/** Builds the Express application without listening, so tests can use it directly. */
export function createApp({
  config,
  logger,
  prisma,
  storage,
  events,
  aiProvider,
}: AppDependencies): Application {
  const app = express();
  app.disable('x-powered-by');

  app.use(requestId);
  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => req.id,
      customLogLevel: (_req, res, error) => {
        if (error !== undefined || res.statusCode >= 500) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
      },
    }),
  );
  app.use(helmet());
  app.use(cors({ origin: config.http.corsOrigins, credentials: true }));
  app.use(createRateLimiter({ windowMs: config.rateLimit.windowMs, limit: config.rateLimit.max }));
  app.use(express.json({ limit: config.http.jsonBodyLimit }));
  app.use(cookieParser());

  const tokens = createTokenService(config.auth);
  const authRepository = createAuthRepository(prisma);
  const { authenticate, optionalAuth } = createAuthMiddlewares({
    verifyAccessToken: (token) => tokens.verifyAccessToken(token),
    findUser: (id) => authRepository.findSessionUser(id),
  });
  const settings = createSettingsService(createSettingsRepository(prisma));
  const spacesRepository = createSpacesRepository(prisma);
  const requireSpaceRole = createRequireSpaceRole((spaceId, userId) =>
    spacesRepository.findAccess(spaceId, userId),
  );
  const images = createImageProcessor({
    maxSidePx: config.upload.imageMaxSidePx,
    thumbnailSidePx: config.upload.thumbnailSidePx,
    allowedMimeTypes: config.upload.allowedMimeTypes,
  });
  const upload = createImageUpload({
    maxFileSizeBytes: config.upload.maxFileSizeBytes,
    maxFiles: config.upload.maxFiles,
    allowedMimeTypes: config.upload.allowedMimeTypes,
  });
  // Every user in a response carries a signed URL of their profile photo.
  const avatarUrl = createAvatarUrlResolver(storage);
  const usersDependencies = { config, prisma, logger, storage, images, avatarUrl, authenticate };

  // Every AI call goes through one runner (validation, one retry, an AiRun per call).
  const prompts = createPromptLoader();
  const aiRunner = createAiRunner({
    provider: aiProvider,
    runs: createAiRunsRepository(prisma),
    settings,
    prompts,
    logger,
  });
  const aiTaskDependencies = { runner: aiRunner, prompts, settings, config: config.ai };

  // Every new snap is analyzed in the background; the upload never waits for the AI.
  const snapInsightsRepository = createSnapInsightsRepository(prisma);
  const aiQueue = createAiQueue({
    concurrency: config.ai.queueConcurrency,
    store: snapInsightsRepository,
    snapAnalysis: createSnapAnalysisTask({ ...aiTaskDependencies, storage }),
    logger,
  });
  events.on('snap.created', ({ snapId }) => {
    aiQueue.enqueueSnapAnalysis(snapId);
  });

  const snapsRepository = createSnapsRepository(prisma);
  const snapInsightsRouterDependencies = {
    service: createSnapInsightsService({
      repository: snapInsightsRepository,
      permissions: createSnapPermissions({ snaps: snapsRepository, spaces: spacesRepository }),
      settings,
      queue: aiQueue,
    }),
    authenticate,
    optionalAuth,
    requireSpaceRole,
  };
  // Compose, study tools and Ask read the insights of analyzed snaps.
  const snapSelection = createSnapSelection({ repository: snapInsightsRepository, settings });
  const contentPermissions = createSpaceContentPermissions(spacesRepository);
  const documentsRouterDependencies = {
    config,
    service: createDocumentsService({
      repository: createDocumentsRepository(prisma),
      snapSelection,
      composer: createComposeDocumentTask(aiTaskDependencies),
      permissions: contentPermissions,
      settings,
      avatarUrl,
      appName: config.app.name,
    }),
    authenticate,
    optionalAuth,
    requireSpaceRole,
  };
  const studyRouterDependencies = {
    service: createStudyService({
      repository: createStudyRepository(prisma),
      snapSelection,
      tasks: createStudyMaterialTasks(aiTaskDependencies),
      permissions: contentPermissions,
    }),
    authenticate,
    requireSpaceRole,
  };
  const askService = createAskService({
    repository: createAskRepository(prisma),
    snapInsights: snapInsightsRepository,
    task: createAskSpaceTask(aiTaskDependencies),
    settings,
  });
  const snapsRouterDependencies = {
    config,
    service: createSnapsService({
      repository: snapsRepository,
      spaces: spacesRepository,
      storage,
      images,
      settings,
      events,
      logger,
      avatarUrl,
    }),
    upload,
    authenticate,
    optionalAuth,
    requireSpaceRole,
  };

  const api = express.Router();
  api.use('/health', createHealthRouter(config));
  api.use('/auth', createAuthRouter({ config, prisma, tokens, authenticate, avatarUrl }));
  api.use('/users', createUsersRouter({ ...usersDependencies, optionalAuth, upload }));
  api.use('/users', createFollowsRouter({ config, prisma, authenticate, avatarUrl }));
  api.use('/admin/users', createAdminUsersRouter(usersDependencies));
  api.use(
    '/spaces',
    createSpacesRouter({
      config,
      repository: spacesRepository,
      settings,
      authenticate,
      optionalAuth,
      requireSpaceRole,
      avatarUrl,
    }),
  );
  api.use(
    '/spaces',
    createSpaceMembersRouter({
      config,
      prisma,
      authenticate,
      optionalAuth,
      requireSpaceRole,
      avatarUrl,
    }),
  );
  api.use(
    '/spaces',
    createSpaceInvitesRouter({
      config,
      prisma,
      spaces: spacesRepository,
      settings,
      authenticate,
      requireSpaceRole,
      avatarUrl,
    }),
  );
  api.use('/spaces', createSpaceSnapsRouter(snapsRouterDependencies));
  api.use('/spaces', createSpaceAnalysisRouter(snapInsightsRouterDependencies));
  api.use('/snaps', createSnapsRouter(snapsRouterDependencies));
  api.use('/snaps', createSnapInsightsRouter(snapInsightsRouterDependencies));
  api.use('/spaces', createSpaceDocumentsRouter(documentsRouterDependencies));
  api.use('/documents', createDocumentsRouter(documentsRouterDependencies));
  api.use('/spaces', createSpaceStudyRouter(studyRouterDependencies));
  api.use('/quizzes', createQuizzesRouter(studyRouterDependencies));
  api.use('/spaces', createAskRouter({ service: askService, authenticate, requireSpaceRole }));
  app.use('/api', api);

  app.use(notFound);
  app.use(createErrorHandler({ isProduction: config.isProduction }));

  return { app, aiQueue };
}
