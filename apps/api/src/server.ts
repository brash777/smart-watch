import { createApp } from './app';
import { EnvValidationError, type Config } from './config/env';
import { loadConfig } from './config/load-config';
import { createLogger } from './lib/logger';

/** Loads and validates the configuration; on any problem, explains it and stops. */
function readConfig(): Config {
  try {
    return loadConfig();
  } catch (error) {
    if (error instanceof EnvValidationError) {
      process.stderr.write(
        `\n${error.message}\n\nThe API did not start. Fix these variables in the root .env file (see .env.example).\n\n`,
      );
      process.exit(1);
    }
    throw error;
  }
}

const config = readConfig();
const logger = createLogger(config);
const app = createApp({ config, logger });

const server = app.listen(config.http.port);

server.on('listening', () => {
  logger.info(`${config.app.name} API listening on ${config.http.apiBaseUrl}`);
});

server.on('error', (error) => {
  logger.fatal({ err: error }, 'The API could not start');
  process.exitCode = 1;
});

function shutdown(signal: NodeJS.Signals): void {
  logger.info({ signal }, 'Shutting down');
  server.close((error) => {
    process.exitCode = error ? 1 : 0;
  });
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
