import type { DocumentExportFormat, DocumentType } from '@snapia/shared';
import { renderMarkdownPdf } from '../../lib/markdown-pdf';
import { withAssignmentNotice } from './assignment-notice';

/** Well below the 255 bytes that file systems allow in a file name. */
const FILE_NAME_MAX_CHARS = 100;
const FALLBACK_FILE_NAME = 'document';

export interface ExportedDocument {
  fileName: string;
  contentType: string;
  body: Buffer;
}

export interface ExportOptions {
  format: DocumentExportFormat;
  /** assignment_guide_notice: every exported ASSIGNMENT_GUIDE opens with it. */
  assignmentNotice: string;
  /** APP_NAME, in the footer of every PDF page. */
  appName: string;
}

/** An ASCII file name made from the title: "Apuntes: Cálculo II" becomes "apuntes-calculo-ii". */
export function exportFileName(title: string, extension: string): string {
  const slug = title
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, FILE_NAME_MAX_CHARS)
    .replace(/^-+|-+$/g, '');
  return `${slug === '' ? FALLBACK_FILE_NAME : slug}.${extension}`;
}

/** A Document as a Markdown or PDF file, with its title on top. */
export async function exportDocument(
  document: { title: string; type: DocumentType; contentMarkdown: string },
  { format, assignmentNotice, appName }: ExportOptions,
): Promise<ExportedDocument> {
  const content =
    document.type === 'ASSIGNMENT_GUIDE'
      ? withAssignmentNotice(document.contentMarkdown, assignmentNotice)
      : document.contentMarkdown;
  if (format === 'md') {
    return {
      fileName: exportFileName(document.title, 'md'),
      contentType: 'text/markdown; charset=utf-8',
      body: Buffer.from(`# ${document.title}\n\n${content}\n`, 'utf8'),
    };
  }
  return {
    fileName: exportFileName(document.title, 'pdf'),
    contentType: 'application/pdf',
    body: await renderMarkdownPdf(content, { title: document.title, footer: appName }),
  };
}
