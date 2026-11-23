import type { ComposeDocumentBody, UpdateDocumentBody } from '@snapia/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { composeDocument, documentKeys, getDocument, updateDocument } from '../api';

export function useDocument(documentId: string) {
  return useQuery({
    queryKey: documentKeys.detail(documentId),
    queryFn: ({ signal }) => getDocument(documentId, signal),
  });
}

export function useComposeDocument(spaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: ComposeDocumentBody) => composeDocument(spaceId, body),
    onSuccess: (document) => {
      queryClient.setQueryData(documentKeys.detail(document.id), document);
      void queryClient.invalidateQueries({ queryKey: documentKeys.list(spaceId) });
    },
  });
}

export function useUpdateDocument(documentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateDocumentBody) => updateDocument(documentId, body),
    onSuccess: (document) => {
      queryClient.setQueryData(documentKeys.detail(document.id), document);
      void queryClient.invalidateQueries({ queryKey: documentKeys.list(document.spaceId) });
    },
  });
}
