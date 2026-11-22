import { describe, expect, it, vi } from 'vitest';
import { createTestConfig } from '../../test/test-config';
import { EventBus } from './events';
import { createLogger } from './logger';

function createBus() {
  const logger = createLogger(createTestConfig());
  const logError = vi.spyOn(logger, 'error');
  return { bus: new EventBus(logger), logError };
}

describe('EventBus', () => {
  it('calls every subscriber with the payload until it unsubscribes', () => {
    const { bus } = createBus();
    const received: string[] = [];
    const unsubscribe = bus.on('snap.created', ({ snapId }) => {
      received.push(snapId);
    });

    bus.emit('snap.created', { snapId: 'first' });
    unsubscribe();
    bus.emit('snap.created', { snapId: 'second' });

    expect(received).toEqual(['first']);
  });

  it('logs failing handlers, sync or async, without breaking the emitter or other handlers', async () => {
    const { bus, logError } = createBus();
    const received: string[] = [];
    bus.on('snap.created', () => {
      throw new Error('sync failure');
    });
    bus.on('snap.created', () => Promise.reject(new Error('async failure')));
    bus.on('snap.created', ({ snapId }) => {
      received.push(snapId);
    });

    expect(() => {
      bus.emit('snap.created', { snapId: 'abc' });
    }).not.toThrow();
    await vi.waitFor(() => {
      expect(logError).toHaveBeenCalledTimes(2);
    });
    expect(received).toEqual(['abc']);
  });
});
