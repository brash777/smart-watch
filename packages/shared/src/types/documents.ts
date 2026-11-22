import type { z } from 'zod';
import type {
  composeDocumentBodySchema,
  documentDraftSchema,
  documentExportFormatSchema,
  documentSchema,
  documentSummarySchema,
  updateDocumentBodySchema,
} from '../schemas/documents';

export type ComposeDocumentBody = z.infer<typeof composeDocumentBodySchema>;
export type DocumentDraft = z.infer<typeof documentDraftSchema>;
export type UpdateDocumentBody = z.infer<typeof updateDocumentBodySchema>;
export type DocumentSummary = z.infer<typeof documentSummarySchema>;
export type Document = z.infer<typeof documentSchema>;
export type DocumentExportFormat = z.infer<typeof documentExportFormatSchema>;
