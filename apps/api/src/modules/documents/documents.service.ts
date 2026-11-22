import {
  documentTypesByMode,
  type ComposeDocumentBody,
  type Document,
  type DocumentExportFormat,
  type DocumentSummary,
  type DocumentType,
  type UpdateDocumentBody,
} from '@snapia/shared';
import { AppError } from '../../lib/app-error';
import { mapPage, toPage, type Page } from '../../lib/pagination';
import type { SpaceAccess } from '../../middlewares/require-space-role';
import type { ComposeDocumentTask } from '../ai/tasks/compose-document';
import type { SettingsService } from '../settings/settings.service';
import type { SnapSelection } from '../snap-insights/snap-selection';
import type { SpaceContentPermissions } from '../spaces/space-content-permissions';
import type { AvatarUrlResolver } from '../users/avatars';
import { withAssignmentNotice } from './assignment-notice';
import { exportDocument, type ExportedDocument } from './document-export';
import { toDocument, toDocumentSummary } from './documents.mappers';
import type { DocumentListQuery, DocumentsRepository } from './documents.repository';

export interface DocumentsServiceDependencies {
  repository: DocumentsRepository;
  snapSelection: SnapSelection;
  composer: ComposeDocumentTask;
  permissions: SpaceContentPermissions;
  settings: SettingsService;
  avatarUrl: AvatarUrlResolver;
  /** APP_NAME, in the footer of exported PDFs. */
  appName: string;
}

export function createDocumentsService({
  repository,
  snapSelection,
  composer,
  permissions,
  settings,
  avatarUrl,
  appName,
}: DocumentsServiceDependencies) {
  /** The Document and the caller's role in its Space, checked like requireSpaceRole('VIEWER'). */
  async function findForUser(documentId: string, userId: string | undefined) {
    const document = await repository.findById(documentId);
    if (document === null) throw new AppError('DOCUMENT_NOT_FOUND', 'Document not found', 404);
    return { document, memberRole: await permissions.memberRoleIn(document.spaceId, userId) };
  }

  return {
    /**
     * Compose (EDITOR or OWNER): the AI drafts a Document of a type of the Space mode from
     * analyzed snaps. The draft and its sources ([Snap N] is the N-th snap, the first taken
     * first) are stored together.
     */
    async compose(
      access: SpaceAccess,
      authorId: string,
      body: ComposeDocumentBody,
    ): Promise<Document> {
      const space = await repository.findSpace(access.spaceId);
      if (space === null) throw new AppError('SPACE_NOT_FOUND', 'Space not found', 404);
      const allowedTypes: readonly DocumentType[] = documentTypesByMode[space.mode];
      if (!allowedTypes.includes(body.type)) {
        throw new AppError(
          'DOCUMENT_TYPE_NOT_ALLOWED',
          `A ${space.mode} Space composes ${allowedTypes.join(', ')}`,
          400,
          { mode: space.mode, allowedTypes },
        );
      }
      if (body.type === 'ASSIGNMENT_GUIDE' && body.instructions === undefined) {
        throw new AppError(
          'INSTRUCTIONS_REQUIRED',
          'An ASSIGNMENT_GUIDE needs the assignment statement in instructions',
          400,
        );
      }

      const snaps = await snapSelection.select(space.id, body.snapIds);
      const draft = await composer.compose({
        type: body.type,
        space,
        snaps,
        instructions: body.instructions ?? null,
        userId: authorId,
      });
      const contentMarkdown =
        body.type === 'ASSIGNMENT_GUIDE'
          ? withAssignmentNotice(
              draft.contentMarkdown,
              await settings.getSetting('assignment_guide_notice'),
            )
          : draft.contentMarkdown;

      const document = await repository.create({
        spaceId: space.id,
        authorId,
        type: body.type,
        title: draft.title,
        instructions: body.instructions ?? null,
        contentMarkdown,
        promptVersion: draft.promptVersion,
        aiRunId: draft.aiRunId,
        sourceSnapIds: snaps.map(({ id }) => id),
      });
      return toDocument(document, avatarUrl);
    },

    async list(access: SpaceAccess, query: DocumentListQuery): Promise<Page<DocumentSummary>> {
      const rows = await repository.listInSpace(access.spaceId, query);
      return mapPage(
        toPage(rows, query.limit, ({ id }) => id),
        (document) => toDocumentSummary(document, avatarUrl),
      );
    },

    async get(documentId: string, userId: string | undefined): Promise<Document> {
      const { document } = await findForUser(documentId, userId);
      return toDocument(document, avatarUrl);
    },

    /** The author (while EDITOR or OWNER) or an OWNER edits the Markdown; each edit is a new version. */
    async update(documentId: string, userId: string, body: UpdateDocumentBody): Promise<Document> {
      const { document, memberRole } = await findForUser(documentId, userId);
      permissions.assertCanModify(document.authorId, userId, memberRole);
      return toDocument(await repository.update(document.id, body), avatarUrl);
    },

    /** The Document as a Markdown or PDF file, for anyone who can see it. */
    async export(
      documentId: string,
      userId: string | undefined,
      format: DocumentExportFormat,
    ): Promise<ExportedDocument> {
      const { document } = await findForUser(documentId, userId);
      return exportDocument(document, {
        format,
        assignmentNotice:
          document.type === 'ASSIGNMENT_GUIDE'
            ? await settings.getSetting('assignment_guide_notice')
            : '',
        appName,
      });
    },

    async remove(documentId: string, userId: string): Promise<void> {
      const { document, memberRole } = await findForUser(documentId, userId);
      permissions.assertCanModify(document.authorId, userId, memberRole);
      await repository.delete(document.id);
    },
  };
}

export type DocumentsService = ReturnType<typeof createDocumentsService>;
