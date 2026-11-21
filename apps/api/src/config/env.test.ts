import { describe, expect, it } from 'vitest';
import { readEnvExample } from '../../test/test-config';
import { EnvValidationError, parseEnv } from './env';

const example = readEnvExample();

/** Runs parseEnv expecting a failure and returns the problems by variable name. */
function problemsOf(source: Record<string, string | undefined>): Map<string, string> {
  try {
    parseEnv(source);
  } catch (error) {
    if (error instanceof EnvValidationError) {
      return new Map(error.problems.map(({ variable, problem }) => [variable, problem]));
    }
    throw error;
  }
  throw new Error('Expected parseEnv to fail');
}

describe('parseEnv', () => {
  it('accepts every value in .env.example, with the mock AI provider by default', () => {
    const config = parseEnv(example);

    expect(config.app.name).toBe(example.APP_NAME);
    expect(config.ai.provider).toBe('mock');
    expect(config.ai.anthropicApiKey).toBeUndefined();
  });

  it('names a missing variable', () => {
    const problems = problemsOf({ ...example, DATABASE_URL: undefined });

    expect(problems.get('DATABASE_URL')).toBe('missing');
  });

  it('treats an empty value as missing', () => {
    expect(problemsOf({ ...example, APP_NAME: '  ' }).get('APP_NAME')).toBe('missing');
  });

  it('reports every invalid variable at once', () => {
    const problems = problemsOf({
      ...example,
      API_PORT: 'not-a-port',
      LOG_LEVEL: 'loud',
      DATABASE_URL: 'mysql://localhost/snapia',
    });

    expect([...problems.keys()].sort()).toEqual(['API_PORT', 'DATABASE_URL', 'LOG_LEVEL']);
    expect(problems.get('DATABASE_URL')).toBe('expected a postgresql:// connection URL');
  });

  it('puts every problem in the error message', () => {
    expect(() => parseEnv({ ...example, DATABASE_URL: undefined, API_PORT: '0' })).toThrow(
      /DATABASE_URL: missing[\s\S]*API_PORT|API_PORT[\s\S]*DATABASE_URL: missing/,
    );
  });

  it('requires ANTHROPIC_API_KEY only when AI_PROVIDER=anthropic', () => {
    const problems = problemsOf({ ...example, AI_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: '' });
    expect(problems.get('ANTHROPIC_API_KEY')).toBe('required when AI_PROVIDER=anthropic');

    const config = parseEnv({
      ...example,
      AI_PROVIDER: 'anthropic',
      ANTHROPIC_API_KEY: 'test-key',
    });
    expect(config.ai.anthropicApiKey).toBe('test-key');
  });

  it('reports ANTHROPIC_API_KEY together with other problems', () => {
    const problems = problemsOf({ ...example, AI_PROVIDER: 'anthropic', DATABASE_URL: undefined });

    expect(problems.has('ANTHROPIC_API_KEY')).toBe(true);
    expect(problems.has('DATABASE_URL')).toBe(true);
  });

  it('parses lists, durations, booleans and sizes', () => {
    const config = parseEnv({
      ...example,
      CORS_ORIGINS: 'http://localhost:5173, https://app.example.com/ ,',
      UPLOAD_ALLOWED_MIME: 'image/jpeg, image/png',
      JWT_ACCESS_TTL: '15m',
      JWT_REFRESH_TTL: '30d',
      S3_FORCE_PATH_STYLE: 'false',
      UPLOAD_MAX_MB: '2',
    });

    expect(config.http.corsOrigins).toEqual(['http://localhost:5173', 'https://app.example.com']);
    expect(config.upload.allowedMimeTypes).toEqual(['image/jpeg', 'image/png']);
    expect(config.auth.accessTokenTtlSeconds).toBe(15 * 60);
    expect(config.auth.refreshTokenTtlSeconds).toBe(30 * 24 * 60 * 60);
    expect(config.storage.s3.forcePathStyle).toBe(false);
    expect(config.upload.maxFileSizeBytes).toBe(2 * 1024 * 1024);
  });

  it('rejects values that contradict each other', () => {
    const problems = problemsOf({
      ...example,
      PAGINATION_DEFAULT_LIMIT: '100',
      PAGINATION_MAX_LIMIT: '10',
      JWT_REFRESH_SECRET: example.JWT_ACCESS_SECRET,
    });

    expect(problems.get('PAGINATION_DEFAULT_LIMIT')).toBe(
      'must not be greater than PAGINATION_MAX_LIMIT',
    );
    expect(problems.get('JWT_REFRESH_SECRET')).toBe('must be different from JWT_ACCESS_SECRET');
  });
});
