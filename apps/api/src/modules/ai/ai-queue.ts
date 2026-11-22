import PQueue from 'p-queue';
import type { Logger } from 'pino';
import type { SnapAnalysis, SnapAnalysisTask, SnapForAnalysis } from './tasks/snap-analysis';

/*
 * Background AI work. Capture never waits for the AI: an upload stores PENDING snaps and
 * emits snap.created, and this queue analyzes them AI_QUEUE_CONCURRENCY at a time:
 * PENDING → PROCESSING → DONE (with its SnapInsight) or FAILED.
 *
 * The queue lives in the API process. When the process stops, queued snaps stay PENDING and
 * snaps being analyzed stay PROCESSING; start() puts both back in the queue.
 */

/** How the queue reads and updates snaps (the snap-insights repository provides it). */
export interface SnapAnalysisStore {
  /** PENDING → PROCESSING. False when the snap is gone or is not PENDING any more. */
  claim(snapId: string): Promise<boolean>;
  findForAnalysis(snapId: string): Promise<SnapForAnalysis | null>;
  /** Stores the SnapInsight and marks the snap DONE. */
  saveInsight(snapId: string, analysis: SnapAnalysis): Promise<void>;
  /** PROCESSING → FAILED. */
  markFailed(snapId: string): Promise<void>;
  /** PROCESSING → PENDING for every snap, and how many there were. */
  resetInterrupted(): Promise<number>;
  /** PENDING snaps, the oldest first. */
  listPendingIds(): Promise<string[]>;
}

export interface AiQueue {
  /**
   * Queues the analysis of a snap. requestedById is who the AiRun is for: the author by default,
   * or whoever asked for a new analysis.
   */
  enqueueSnapAnalysis(snapId: string, requestedById?: string): void;
  /** Queues the PENDING snaps and the interrupted ones again, then starts working. */
  start(): Promise<void>;
  /** Stops taking work. Queued snaps stay PENDING until the next start(). */
  stop(): void;
  /** Resolves once nothing is queued or running. */
  onIdle(): Promise<void>;
}

export interface AiQueueDependencies {
  concurrency: number;
  store: SnapAnalysisStore;
  snapAnalysis: SnapAnalysisTask;
  logger: Logger;
}

export function createAiQueue({
  concurrency,
  store,
  snapAnalysis,
  logger,
}: AiQueueDependencies): AiQueue {
  // Paused until start(): the server starts it once it listens, tests when they need it.
  const queue = new PQueue({ concurrency, autoStart: false });
  /** Snaps waiting in the queue, so a snap is never queued twice. */
  const waiting = new Set<string>();

  async function analyzeSnap(snapId: string, requestedById: string | undefined): Promise<void> {
    // Taking the snap first makes a second job for the same snap a no-op.
    if (!(await store.claim(snapId))) return;
    try {
      const snap = await store.findForAnalysis(snapId);
      if (snap === null) return;
      const analysis = await snapAnalysis.analyze(snap, requestedById ?? snap.authorId);
      await store.saveInsight(snapId, analysis);
      logger.info({ snapId, aiRunId: analysis.aiRunId }, 'Snap analyzed');
    } catch (error) {
      logger.warn({ err: error, snapId }, 'Snap analysis failed');
      await store.markFailed(snapId);
    }
  }

  function enqueueSnapAnalysis(snapId: string, requestedById?: string): void {
    if (waiting.has(snapId)) return;
    waiting.add(snapId);
    queue
      .add(() => {
        waiting.delete(snapId);
        return analyzeSnap(snapId, requestedById);
      })
      .catch((error: unknown) => {
        logger.error({ err: error, snapId }, 'Could not record the analysis status of a snap');
      });
  }

  return {
    enqueueSnapAnalysis,

    async start() {
      const interrupted = await store.resetInterrupted();
      const pending = await store.listPendingIds();
      for (const snapId of pending) enqueueSnapAnalysis(snapId);
      queue.start();
      logger.info({ queued: pending.length, interrupted }, 'Snap analysis queue started');
    },

    stop() {
      queue.pause();
      queue.clear();
      waiting.clear();
    },

    onIdle: () => queue.onIdle(),
  };
}
