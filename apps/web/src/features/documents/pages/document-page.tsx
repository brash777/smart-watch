import type { Document, DocumentExportFormat, Space } from '@snapia/shared';
import { Download } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import { paths } from '../../../app/paths';
import { BackLink } from '../../../components/back-link';
import { Button } from '../../../components/button';
import { FormAlert } from '../../../components/form-alert';
import { Markdown } from '../../../components/markdown';
import { Notice } from '../../../components/notice';
import { Skeleton } from '../../../components/skeleton';
import { ErrorState } from '../../../components/state-message';
import { TextField } from '../../../components/text-field';
import { errorKey } from '../../../i18n/error-key';
import { apiDownload } from '../../../lib/http';
import { saveFile } from '../../../lib/save-file';
import { useAppConfig } from '../../app-config/hooks/use-app-config';
import { useCurrentUserId } from '../../auth/hooks/use-auth';
import { useSpace } from '../../spaces/hooks/use-spaces';
import { useDocument, useUpdateDocument } from '../hooks/use-document';

const FORMATS: readonly DocumentExportFormat[] = ['pdf', 'md'];

export function DocumentPage() {
  const { t } = useTranslation();
  const { documentId = '' } = useParams();
  const document = useDocument(documentId);
  const space = useSpace(document.data?.spaceId ?? '');

  if (document.isPending || (document.isSuccess && space.isPending)) {
    return <Skeleton className="h-96 rounded-card" />;
  }
  if (document.isError || space.isError) {
    return <ErrorState message={t(errorKey(document.error ?? space.error))} />;
  }
  if (space.data === undefined) return null;
  return <DocumentEditor key={document.data.id} document={document.data} space={space.data} />;
}

function DocumentEditor({ document, space }: { document: Document; space: Space }) {
  const { t } = useTranslation();
  const config = useAppConfig();
  const userId = useCurrentUserId();
  const update = useUpdateDocument(document.id);
  const [title, setTitle] = useState(document.title);
  const [markdown, setMarkdown] = useState(document.contentMarkdown);
  const [preview, setPreview] = useState(false);
  const [download, setDownload] = useState<{ error: unknown } | null>(null);
  const canEdit =
    space.myRole === 'OWNER' || (space.myRole === 'EDITOR' && document.author.id === userId);
  const changed = title !== document.title || markdown !== document.contentMarkdown;

  async function exportAs(format: DocumentExportFormat) {
    try {
      const { blob, fileName } = await apiDownload(
        `/documents/${document.id}/export?format=${format}`,
      );
      saveFile(blob, fileName ?? `${document.title}.${format}`);
      setDownload(null);
    } catch (error) {
      setDownload({ error });
    }
  }

  return (
    <>
      <div className="flex flex-col gap-1">
        <BackLink to={paths.spaceDocuments(space.id)}>{space.name}</BackLink>
        <p className="flex flex-wrap gap-x-3 text-sm text-muted">
          <span>{t(`documents.types.${document.type}`)}</span>
          <span>{t(`documents.status.${document.status}`)}</span>
          <span>{t('documents.version', { version: document.version })}</span>
        </p>
      </div>
      {document.type === 'ASSIGNMENT_GUIDE' && config.data !== undefined ? (
        <p role="note" className="rounded-control border-2 border-ink p-3 font-semibold">
          {config.data.compose.assignmentGuideNotice}
        </p>
      ) : null}

      {canEdit ? (
        <TextField
          label={t('documents.titleLabel')}
          value={title}
          onChange={(event) => {
            setTitle(event.target.value);
          }}
        />
      ) : (
        <h1 className="font-display text-3xl font-bold tracking-tight">{document.title}</h1>
      )}

      {canEdit ? (
        <div role="group" aria-label={t('documents.viewLabel')} className="flex gap-2">
          <Button
            variant={preview ? 'secondary' : 'primary'}
            fullWidth={false}
            aria-pressed={!preview}
            onClick={() => {
              setPreview(false);
            }}
          >
            {t('documents.edit')}
          </Button>
          <Button
            variant={preview ? 'primary' : 'secondary'}
            fullWidth={false}
            aria-pressed={preview}
            onClick={() => {
              setPreview(true);
            }}
          >
            {t('documents.preview')}
          </Button>
        </div>
      ) : null}

      {canEdit && !preview ? (
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">{t('documents.contentLabel')}</span>
          <textarea
            value={markdown}
            rows={18}
            spellCheck
            onChange={(event) => {
              setMarkdown(event.target.value);
            }}
            className="w-full rounded-control border border-field-border bg-surface p-3 font-body text-base"
          />
        </label>
      ) : (
        <article className="rounded-card border border-line bg-surface p-4">
          <Markdown>{markdown}</Markdown>
        </article>
      )}

      {document.sources.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-muted">{t('documents.sources')}</h2>
          <ul className="flex flex-wrap gap-2">
            {document.sources.map((source) => (
              <li key={source.snapId}>
                <Link
                  to={paths.snap(space.id, source.snapId)}
                  className="flex min-h-11 items-center rounded-full border border-line px-3 text-sm"
                >
                  {t('documents.source', { number: source.order })}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {update.isError ? <FormAlert>{t(errorKey(update.error))}</FormAlert> : null}
      {update.isSuccess && !changed ? <Notice>{t('documents.saved')}</Notice> : null}
      {canEdit ? (
        <div className="flex flex-col gap-2">
          <Button
            disabled={!changed || update.isPending || title.trim() === '' || markdown.trim() === ''}
            onClick={() => {
              update.mutate({ title, contentMarkdown: markdown });
            }}
          >
            {update.isPending ? t('documents.saving') : t('documents.save')}
          </Button>
          <Button
            variant="secondary"
            disabled={update.isPending}
            onClick={() => {
              update.mutate({ status: document.status === 'FINAL' ? 'DRAFT' : 'FINAL' });
            }}
          >
            {document.status === 'FINAL' ? t('documents.markDraft') : t('documents.markFinal')}
          </Button>
        </div>
      ) : null}

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-muted">{t('documents.download')}</h2>
        <div className="flex gap-2">
          {FORMATS.map((format) => (
            <Button
              key={format}
              variant="secondary"
              onClick={() => {
                void exportAs(format);
              }}
            >
              <Download aria-hidden className="size-5" />
              {t(`documents.formats.${format}`)}
            </Button>
          ))}
        </div>
        {download === null ? null : <FormAlert>{t(errorKey(download.error))}</FormAlert>}
      </section>
    </>
  );
}
