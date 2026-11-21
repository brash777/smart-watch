import { pino, type Logger } from 'pino';
import type { Config } from '../config/env';

/** Header values that must never reach the logs. */
const REDACTED_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
];

export function createLogger(config: Config): Logger {
  return pino({
    name: config.app.name,
    level: config.log.level,
    redact: { paths: REDACTED_PATHS, censor: '[redacted]' },
    // Human-readable logs while developing; JSON lines everywhere else.
    ...(config.env === 'development'
      ? {
          transport: { target: 'pino-pretty', options: { colorize: true, ignore: 'pid,hostname' } },
        }
      : {}),
  });
}
