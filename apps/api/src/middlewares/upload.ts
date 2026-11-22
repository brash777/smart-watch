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

/** What one route accepts: the multipart field and how many files it takes. */
interface FileField {
  name: string;
  maxCount: number;
}

function toAppError(error: multer.MulterError, maxFileSizeBytes: number, field: FileField) {
  switch (error.code) {
    case 'LIMIT_FILE_SIZE':
      return new AppError(
        'FILE_TOO_LARGE',
        `Each file can have at most ${String(maxFileSizeBytes)} bytes`,
        413,
      );
    case 'LIMIT_FILE_COUNT':
    case 'LIMIT_UNEXPECTED_FILE':
      // Too many files, or files in another field.
      return new AppError(
        'TOO_MANY_FILES',
        `Send at most ${String(field.maxCount)} file(s), in the "${field.name}" field`,
        400,
        { field: field.name, maxFiles: field.maxCount },
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

  function withApiErrors(handler: RequestHandler, field: FileField): RequestHandler {
    return (req, res, next) => {
      handler(req, res, (error?: unknown) => {
        next(
          error instanceof multer.MulterError
            ? toAppError(error, options.maxFileSizeBytes, field)
            : error,
        );
      });
    };
  }

  return {
    /** Up to UPLOAD_MAX_FILES files in one field (req.files). */
    files: (name: string) =>
      withApiErrors(upload.array(name, options.maxFiles), { name, maxCount: options.maxFiles }),
    /** At most one file in one field (req.file). */
    file: (name: string) => withApiErrors(upload.single(name), { name, maxCount: 1 }),
  };
}

export type ImageUpload = ReturnType<typeof createImageUpload>;
