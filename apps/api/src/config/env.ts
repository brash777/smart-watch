import { z } from 'zod';

const SECONDS_PER_UNIT = { s: 1, m: 60, h: 3_600, d: 86_400 } as const;
const BYTES_PER_MEGABYTE = 1024 * 1024;

const nonEmptyString = z.string().min(1);
const positiveInt = z.coerce.number().int().positive();
const nonNegativeInt = z.coerce.number().int().nonnegative();
const port = z.coerce.number().int().min(1).max(65_535);
const httpUrl = z.url({ protocol: /^https?$/, error: 'expected an http(s) URL' });
const booleanFlag = z
  .enum(['true', 'false'], { error: 'expected true or false' })
  .transform((value) => value === 'true');

/** Splits "a, b,,c" into ["a", "b", "c"]. */
function splitList(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

/** Comma-separated origins, normalized to scheme://host:port (no path, no trailing slash). */
const originList = z
  .string()
  .transform(splitList)
  .pipe(
    z.array(httpUrl.transform((url) => new URL(url).origin)).min(1, 'needs at least one origin'),
  );

/** Comma-separated MIME types such as image/jpeg,image/png. */
const mimeTypeList = z
  .string()
  .transform(splitList)
  .pipe(
    z
      .array(z.string().regex(/^[\w.+-]+\/[\w.+-]+$/, 'expected MIME types such as image/jpeg'))
      .min(1, 'needs at least one MIME type'),
  );

/** "15m", "30d": a whole number followed by s, m, h or d, converted to seconds. */
const durationInSeconds = z
  .string()
  .regex(/^\d+[smhd]$/, 'use a whole number followed by s, m, h or d (e.g. 15m, 30d)')
  .transform((value) => {
    const unit = value.slice(-1) as keyof typeof SECONDS_PER_UNIT;
    return Number(value.slice(0, -1)) * SECONDS_PER_UNIT[unit];
  });

/** How much reasoning the model may spend on an answer (Claude's output_config.effort). */
const aiEffort = z.enum(['low', 'medium', 'high', 'xhigh', 'max']);

/** HS256 needs a key of at least 256 bits: this is a cryptographic floor, not a tunable. */
const jwtSecret = z.string().min(32, 'must be at least 32 characters long');

const envShape = {
  // General
  NODE_ENV: z.enum(['development', 'test', 'production']),
  APP_NAME: nonEmptyString,
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']),

  // HTTP server
  API_PORT: port,
  API_BASE_URL: httpUrl,
  WEB_BASE_URL: httpUrl,
  CORS_ORIGINS: originList,
  JSON_BODY_LIMIT: z.string().regex(/^\d+(b|kb|mb)$/i, 'use a size such as 100kb or 1mb'),

  // Database
  DATABASE_URL: z.url({
    protocol: /^postgres(ql)?$/,
    error: 'expected a postgresql:// connection URL',
  }),

  // Authentication
  JWT_ACCESS_SECRET: jwtSecret,
  JWT_REFRESH_SECRET: jwtSecret,
  JWT_ACCESS_TTL: durationInSeconds,
  JWT_REFRESH_TTL: durationInSeconds,
  // 4 and 31 are the limits of the bcrypt algorithm itself.
  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(31),

  // File storage
  STORAGE_DRIVER: z.enum(['s3', 'local']),
  LOCAL_STORAGE_DIR: nonEmptyString,
  S3_ENDPOINT: httpUrl,
  S3_REGION: nonEmptyString,
  S3_BUCKET: z
    .string()
    .regex(/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/, 'expected a valid S3 bucket name'),
  S3_ACCESS_KEY: nonEmptyString,
  S3_SECRET_KEY: nonEmptyString,
  S3_FORCE_PATH_STYLE: booleanFlag,
  SIGNED_URL_TTL_SECONDS: positiveInt,

  // Uploads and images
  UPLOAD_MAX_MB: z.coerce.number().positive(),
  UPLOAD_MAX_FILES: positiveInt,
  UPLOAD_ALLOWED_MIME: mimeTypeList,
  IMAGE_MAX_SIDE_PX: positiveInt,
  THUMBNAIL_SIDE_PX: positiveInt,

  // AI
  AI_PROVIDER: z.enum(['anthropic', 'mock']),
  // Required only when AI_PROVIDER=anthropic (checked in parseEnv).
  ANTHROPIC_API_KEY: nonEmptyString.optional(),
  AI_MODEL: nonEmptyString,
  AI_MAX_TOKENS: positiveInt,
  AI_EFFORT: aiEffort,
  AI_TIMEOUT_MS: positiveInt,
  AI_MAX_RETRIES: nonNegativeInt,
  AI_IMAGE_MAX_SIDE_PX: positiveInt,
  AI_IMAGE_FORMAT: z.enum(['jpeg', 'webp']),
  // 1 and 100 are the limits of the JPEG and WebP quality scale itself.
  AI_IMAGE_QUALITY: z.coerce.number().int().min(1).max(100),
  AI_QUEUE_CONCURRENCY: positiveInt,
  AI_CONTEXT_MAX_CHARS: positiveInt,

  // Rate limiting
  RATE_LIMIT_WINDOW_MS: positiveInt,
  RATE_LIMIT_MAX: positiveInt,
  AUTH_RATE_LIMIT_MAX: positiveInt,

  // Pagination
  PAGINATION_DEFAULT_LIMIT: positiveInt,
  PAGINATION_MAX_LIMIT: positiveInt,

  // Seed
  SEED_ADMIN_NAME: nonEmptyString,
  SEED_ADMIN_USERNAME: nonEmptyString,
  SEED_ADMIN_EMAIL: z.email({ error: 'expected an email address' }),
  SEED_ADMIN_PASSWORD: nonEmptyString,
  SEED_DEMO_DATA: booleanFlag,
};

const ENV_KEYS = Object.keys(envShape) as (keyof typeof envShape)[];

/** Rules that involve several variables (they run once every variable is valid on its own). */
const envSchema = z.object(envShape).superRefine((env, ctx) => {
  if (env.PAGINATION_DEFAULT_LIMIT > env.PAGINATION_MAX_LIMIT) {
    ctx.addIssue({
      code: 'custom',
      path: ['PAGINATION_DEFAULT_LIMIT'],
      message: 'must not be greater than PAGINATION_MAX_LIMIT',
    });
  }
  if (env.THUMBNAIL_SIDE_PX > env.IMAGE_MAX_SIDE_PX) {
    ctx.addIssue({
      code: 'custom',
      path: ['THUMBNAIL_SIDE_PX'],
      message: 'must not be greater than IMAGE_MAX_SIDE_PX',
    });
  }
  if (env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET) {
    ctx.addIssue({
      code: 'custom',
      path: ['JWT_REFRESH_SECRET'],
      message: 'must be different from JWT_ACCESS_SECRET',
    });
  }
});

export type Env = z.infer<typeof envSchema>;

/** Typed, grouped configuration used by the rest of the API. */
function toConfig(env: Env) {
  return {
    env: env.NODE_ENV,
    isProduction: env.NODE_ENV === 'production',
    app: { name: env.APP_NAME },
    log: { level: env.LOG_LEVEL },
    http: {
      port: env.API_PORT,
      apiBaseUrl: env.API_BASE_URL,
      webBaseUrl: env.WEB_BASE_URL,
      corsOrigins: env.CORS_ORIGINS,
      jsonBodyLimit: env.JSON_BODY_LIMIT,
    },
    database: { url: env.DATABASE_URL },
    auth: {
      jwtAccessSecret: env.JWT_ACCESS_SECRET,
      jwtRefreshSecret: env.JWT_REFRESH_SECRET,
      accessTokenTtlSeconds: env.JWT_ACCESS_TTL,
      refreshTokenTtlSeconds: env.JWT_REFRESH_TTL,
      bcryptRounds: env.BCRYPT_ROUNDS,
    },
    storage: {
      driver: env.STORAGE_DRIVER,
      localDir: env.LOCAL_STORAGE_DIR,
      signedUrlTtlSeconds: env.SIGNED_URL_TTL_SECONDS,
      s3: {
        endpoint: env.S3_ENDPOINT,
        region: env.S3_REGION,
        bucket: env.S3_BUCKET,
        accessKey: env.S3_ACCESS_KEY,
        secretKey: env.S3_SECRET_KEY,
        forcePathStyle: env.S3_FORCE_PATH_STYLE,
      },
    },
    upload: {
      maxFileSizeBytes: Math.floor(env.UPLOAD_MAX_MB * BYTES_PER_MEGABYTE),
      maxFiles: env.UPLOAD_MAX_FILES,
      allowedMimeTypes: env.UPLOAD_ALLOWED_MIME,
      imageMaxSidePx: env.IMAGE_MAX_SIDE_PX,
      thumbnailSidePx: env.THUMBNAIL_SIDE_PX,
    },
    ai: {
      provider: env.AI_PROVIDER,
      anthropicApiKey: env.ANTHROPIC_API_KEY,
      model: env.AI_MODEL,
      maxTokens: env.AI_MAX_TOKENS,
      effort: env.AI_EFFORT,
      timeoutMs: env.AI_TIMEOUT_MS,
      maxRetries: env.AI_MAX_RETRIES,
      /** How photos are resized and encoded before they are sent to the AI. */
      image: {
        maxSidePx: env.AI_IMAGE_MAX_SIDE_PX,
        format: env.AI_IMAGE_FORMAT,
        quality: env.AI_IMAGE_QUALITY,
      },
      queueConcurrency: env.AI_QUEUE_CONCURRENCY,
      contextMaxChars: env.AI_CONTEXT_MAX_CHARS,
    },
    rateLimit: {
      windowMs: env.RATE_LIMIT_WINDOW_MS,
      max: env.RATE_LIMIT_MAX,
      authMax: env.AUTH_RATE_LIMIT_MAX,
    },
    pagination: {
      defaultLimit: env.PAGINATION_DEFAULT_LIMIT,
      maxLimit: env.PAGINATION_MAX_LIMIT,
    },
    seed: {
      admin: {
        name: env.SEED_ADMIN_NAME,
        username: env.SEED_ADMIN_USERNAME,
        email: env.SEED_ADMIN_EMAIL,
        password: env.SEED_ADMIN_PASSWORD,
      },
      demoData: env.SEED_DEMO_DATA,
    },
  };
}

export type Config = ReturnType<typeof toConfig>;

export interface EnvProblem {
  variable: string;
  problem: string;
}

/** Thrown when the environment is invalid; its message lists every problem by variable. */
export class EnvValidationError extends Error {
  readonly problems: readonly EnvProblem[];

  constructor(problems: readonly EnvProblem[]) {
    super(
      [
        'Invalid environment configuration:',
        ...problems.map(({ variable, problem }) => `  - ${variable}: ${problem}`),
      ].join('\n'),
    );
    this.name = 'EnvValidationError';
    this.problems = problems;
  }
}

/**
 * Validates the environment and returns the typed configuration.
 * Empty values count as missing. Throws EnvValidationError listing every problem.
 */
export function parseEnv(rawSource: Readonly<Record<string, string | undefined>>): Config {
  const source: Record<string, string | undefined> = {};
  for (const key of ENV_KEYS) {
    const value = rawSource[key]?.trim();
    source[key] = value === '' ? undefined : value;
  }

  const problems = new Map<string, string>();
  const result = envSchema.safeParse(source);
  if (!result.success) {
    for (const issue of result.error.issues) {
      const variable = String(issue.path[0] ?? 'environment');
      if (!problems.has(variable)) {
        problems.set(variable, source[variable] === undefined ? 'missing' : issue.message);
      }
    }
  }
  // Checked on the raw values so it is reported together with every other problem.
  if (source.AI_PROVIDER === 'anthropic' && source.ANTHROPIC_API_KEY === undefined) {
    problems.set('ANTHROPIC_API_KEY', 'required when AI_PROVIDER=anthropic');
  }

  if (!result.success || problems.size > 0) {
    throw new EnvValidationError(
      [...problems].map(([variable, problem]) => ({ variable, problem })),
    );
  }
  return toConfig(result.data);
}
