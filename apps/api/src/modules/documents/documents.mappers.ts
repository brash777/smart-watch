import type { Document, DocumentSummary } from '@snapia/shared';
import type { AvatarUrlResolver } from '../users/avatars';
import { toUserSummary } from '../users/users.mappers';
import type { DocumentRecord, DocumentSummaryRecord } from './documents.repository';

export async function toDocumentSummary(
  document: DocumentSummaryRecord,
  avatarUrl: AvatarUrlResolver,
): Promise<DocumentSummary> {
  return {
    id: document.id,
    spaceId: document.spaceId,
    author: await toUserSummary(document.author, avatarUrl),
    type: document.type,
    title: document.title,
    status: document.status,
    version: document.version,
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
  };
}

export async function toDocument(
  document: DocumentRecord,
  avatarUrl: AvatarUrlResolver,
): Promise<Document> {
  return {
    ...(await toDocumentSummary(document, avatarUrl)),
    instructions: document.instructions,
    contentMarkdown: document.contentMarkdown,
    promptVersion: document.promptVersion,
    sources: document.sources,
  };
}
