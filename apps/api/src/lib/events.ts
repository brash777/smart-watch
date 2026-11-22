import type { Logger } from 'pino';

/** Events of the API and their payloads. */
export interface AppEvents {
  /** A snap was uploaded and stored. The AI analysis subscribes to it. */
  'snap.created': { snapId: string };
}

export type EventHandler<Payload> = (payload: Payload) => void | Promise<void>;

type HandlerMap<Events> = { [Name in keyof Events]?: Set<EventHandler<Events[Name]>> };

/**
 * A small, typed, in-process event bus. emit() calls every handler right away and returns
 * without waiting for async handlers; a failing handler is logged and never breaks the emitter.
 */
export class EventBus<Events extends object = AppEvents> {
  readonly #handlers: HandlerMap<Events> = {};
  readonly #logger: Logger;

  constructor(logger: Logger) {
    this.#logger = logger;
  }

  /** Subscribes to an event. Returns a function that unsubscribes. */
  on<Name extends keyof Events>(event: Name, handler: EventHandler<Events[Name]>): () => void {
    const handlers = this.#handlers[event] ?? new Set<EventHandler<Events[Name]>>();
    handlers.add(handler);
    this.#handlers[event] = handlers;
    return () => {
      handlers.delete(handler);
    };
  }

  emit<Name extends keyof Events>(event: Name, payload: Events[Name]): void {
    for (const handler of this.#handlers[event] ?? []) {
      try {
        const result = handler(payload);
        if (result instanceof Promise) {
          result.catch((error: unknown) => {
            this.#logger.error({ err: error, event }, 'Event handler failed');
          });
        }
      } catch (error) {
        this.#logger.error({ err: error, event }, 'Event handler failed');
      }
    }
  }
}
