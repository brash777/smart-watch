import type { DocumentStatus, DocumentType } from '@snapia/shared';
import { pageArgs } from '../../lib/pagination';
import type { PrismaClient } from '../../lib/prisma';
import { userSummarySelect } from '../users/users.repository';

const documentSummarySelect = {
  id: true,
  spaceId: true,
  authorId: true,
  type: true,
  title: true,
  status: true,
  version: true,
  createdAt: true,
  updatedAt: true,
  author: { select: userSummarySelect },
} as const;

const documentSelect = {
  ...documentSummarySelect,
  instructions: true,
  contentMarkdown: true,
  promptVersion: true,
  sources: { select: { snapId: true, order: true }, orderBy: { order: 'asc' } },
} as const;

export interface NewDocument {
  spaceId: string;
  authorId: string;
  type: DocumentType;
  title: string;
  instructions: string | null;
  contentMarkdown: string;
  promptVersion: string;
  aiRunId: string;
  /** The snaps the text cites: the N-th one is [Snap N]. */
  sourceSnapIds: readonly string[];
}

export interface DocumentChanges {
  title?: string | undefined;
  contentMarkdown?: string | undefined;
  status?: DocumentStatus | undefined;
}

export interface DocumentListQuery {
  type?: DocumentType | undefined;
  cursor?: string | undefined;
  limit: number;
}

export function createDocumentsRepository(prisma: PrismaClient) {
  return {
    /** What Compose needs to know about the Space. */
    findSpace(spaceId: string) {
      return prisma.space.findUnique({
        where: { id: spaceId },
        select: { id: true, mode: true, metadata: true },
      });
    },

    /** The Document and its sources, in one write. */
    create({ sourceSnapIds, ...document }: NewDocument) {
      return prisma.document.create({
        data: {
          ...document,
          sources: { create: sourceSnapIds.map((snapId, index) => ({ snapId, order: index + 1 })) },
        },
        select: documentSelect,
      });
    },

    /** Documents of a Space, newest first. */
    listInSpace(spaceId: string, { type, ...page }: DocumentListQuery) {
      return prisma.document.findMany({
        where: { spaceId, ...(type === undefined ? {} : { type }) },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: documentSummarySelect,
        ...pageArgs(page),
      });
    },

    findById(id: string) {
      return prisma.document.findUnique({ where: { id }, select: documentSelect });
    },

    /** Saves the changes as a new version. */
    update(id: string, changes: DocumentChanges) {
      return prisma.document.update({
        where: { id },
        data: { ...changes, version: { increment: 1 } },
        select: documentSelect,
      });
    },

    async delete(id: string): Promise<void> {
      await prisma.document.delete({ where: { id } });
    },
  };
}

export type DocumentsRepository = ReturnType<typeof createDocumentsRepository>;
export type DocumentRecord = NonNullable<Awaited<ReturnType<DocumentsRepository['findById']>>>;
export type DocumentSummaryRecord = Awaited<ReturnType<DocumentsRepository['listInSpace']>>[number];
