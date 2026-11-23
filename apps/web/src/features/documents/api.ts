import {
  documentSchema,
  documentSummarySchema,
  type ComposeDocumentBody,
  type Document,
  type DocumentSummary,
  type UpdateDocumentBody,
} from '@snapia/shared';
import { apiRequest, apiSend } from '../../lib/http';
import { apiPage, type Page } from '../../lib/pagination';

export const documentKeys = {
  all: ['documents'] as const,
  list: (spaceId: string) => [...documentKeys.all, 'list', spaceId] as const,
  detail: (documentId: string) => [...documentKeys.all, 'detail', documentId] as const,
};

export function listSpaceDocuments(
  spaceId: string,
  cursor: string | null,
  signal?: AbortSignal,
): Promise<Page<DocumentSummary>> {
  return apiPage(`/spaces/${spaceId}/documents`, documentSummarySchema, { cursor, signal });
}

export async function getDocument(documentId: string, signal?: AbortSignal): Promise<Document> {
  return (await apiRequest(`/documents/${documentId}`, documentSchema, { signal })).data;
}

export async function composeDocument(
  spaceId: string,
  body: ComposeDocumentBody,
): Promise<Document> {
  return (
    await apiRequest(`/spaces/${spaceId}/documents`, documentSchema, { method: 'POST', body })
  ).data;
}

export async function updateDocument(
  documentId: string,
  body: UpdateDocumentBody,
): Promise<Document> {
  return (await apiRequest(`/documents/${documentId}`, documentSchema, { method: 'PATCH', body }))
    .data;
}

export function deleteDocument(documentId: string): Promise<void> {
  return apiSend(`/documents/${documentId}`, { method: 'DELETE' });
}
