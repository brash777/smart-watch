import type { RequestHandler } from 'express';
import multer from 'multer';
import { AppError } from '../lib/app-error';

export interface ImageUploadOptions {
  /** UPLOAD_MAX_MB, in bytes. */
  maxFileSizeBytes: number;
  /** UPLOAD_MAX_FILES. */
  maxFiles: number;
  /** UPLOAD_ALLOWED_MIME. The image processor also checks the real content later. */
  allowedMimeTypes: readonly string[];
}

function toAppError(error: multer.MulterError, { maxFileSizeBytes, maxFiles }: ImageUploadOptions) {
  switch (error.code) {
    case 'LIMIT_FILE_SIZE':
      return new AppError(
        'FILE_TOO_LARGE',
        `Each file can have at most ${String(maxFileSizeBytes)} bytes`,
        413,
      );
    case 'LIMIT_FILE_COUNT':
    case 'LIMIT_UNEXPECTED_FILE':
      return new AppError(
        'TOO_MANY_FILES',
        `Send at most ${String(maxFiles)} files in the expected field`,
        400,
      );
    default:
      return new AppError('INVALID_UPLOAD', error.message, 400);
  }
}

/**
 * Multipart image uploads kept in memory (they are processed before being stored).
 * Size, number of files and declared type are checked here; errors use the API error shape.
 */
export function createImageUpload(options: ImageUploadOptions) {
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: options.maxFileSizeBytes, files: options.maxFiles },
    fileFilter: (_req, file, accept) => {
      if (options.allowedMimeTypes.includes(file.mimetype)) {
        accept(null, true);
      } else {
        accept(
          new AppError(
            'UNSUPPORTED_MEDIA_TYPE',
            `Files of type ${file.mimetype} are not accepted`,
            415,
          ),
        );
      }
    },
  });

  function withApiErrors(handler: RequestHandler): RequestHandler {
    return (req, res, next) => {
      handler(req, res, (error?: unknown) => {
        next(error instanceof multer.MulterError ? toAppError(error, options) : error);
      });
    };
  }

  return {
    /** Up to UPLOAD_MAX_FILES files in one field. */
    files: (field: string) => withApiErrors(upload.array(field, options.maxFiles)),
    /** Exactly one file in one field. */
    file: (field: string) => withApiErrors(upload.single(field)),
  };
}

export type ImageUpload = ReturnType<typeof createImageUpload>;
