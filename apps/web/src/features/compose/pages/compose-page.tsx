import { documentTypesByMode, type DocumentType } from '@snapia/shared';
import { Sparkles } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useLocation, useNavigate, useParams } from 'react-router';
import { z } from 'zod';
import { paths } from '../../../app/paths';
import { BackLink } from '../../../components/back-link';
import { Button } from '../../../components/button';
import { FormAlert } from '../../../components/form-alert';
import { PageHeader } from '../../../components/page-header';
import { Skeleton } from '../../../components/skeleton';
import { ErrorState } from '../../../components/state-message';
import { TextareaField } from '../../../components/textarea-field';
import { errorKey } from '../../../i18n/error-key';
import { useComposeDocument } from '../../documents/hooks/use-document';
import { useSpace } from '../../spaces/hooks/use-spaces';

const stateSchema = z.object({ snapIds: z.array(z.string()).min(1) });

/** Compose: the selected snaps become a Document of a type of the Space mode. */
export function ComposePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { spaceId = '' } = useParams();
  const snapIds = stateSchema.safeParse(useLocation().state).data?.snapIds;
  const space = useSpace(spaceId);
  const compose = useComposeDocument(spaceId);
  const [type, setType] = useState<DocumentType | null>(null);
  const [instructions, setInstructions] = useState('');
  const [missing, setMissing] = useState<'type' | 'instructions' | null>(null);

  if (snapIds === undefined) return <Navigate to={paths.space(spaceId)} replace />;
  if (space.isPending) return <Skeleton className="h-64 rounded-card" />;
  if (space.isError) return <ErrorState message={t(errorKey(space.error))} />;
  const types: readonly DocumentType[] = documentTypesByMode[space.data.mode];

  function submit(event: FormEvent) {
    event.preventDefault();
    if (type === null) {
      setMissing('type');
      return;
    }
    if (type === 'ASSIGNMENT_GUIDE' && instructions.trim() === '') {
      setMissing('instructions');
      return;
    }
    setMissing(null);
    const text = instructions.trim();
    compose.mutate(
      { type, snapIds: snapIds ?? [], ...(text === '' ? {} : { instructions: text }) },
      {
        onSuccess: (document) => {
          void navigate(paths.document(document.id), { replace: true });
        },
      },
    );
  }

  return (
    <>
      <div className="flex flex-col gap-1">
        <BackLink to={paths.space(spaceId)}>{space.data.name}</BackLink>
        <PageHeader title={t('compose.title')}>
          {t('compose.selected', { count: snapIds.length })}
        </PageHeader>
      </div>
      <form noValidate onSubmit={submit} className="flex flex-col gap-6">
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 font-semibold">{t('compose.typeLegend')}</legend>
          {types.map((option) => (
            <label
              key={option}
              className="flex cursor-pointer flex-col rounded-card border border-line bg-surface p-3 has-checked:border-ink has-checked:ring-1 has-checked:ring-ink"
            >
              <input
                type="radio"
                name="type"
                value={option}
                checked={type === option}
                onChange={() => {
                  setType(option);
                  setMissing(null);
                }}
                className="sr-only"
              />
              <span className="font-semibold">{t(`documents.types.${option}`)}</span>
              <span className="text-sm text-muted">{t(`compose.typeHints.${option}`)}</span>
            </label>
          ))}
          {missing === 'type' ? (
            <p className="text-sm text-danger">{t('compose.typeError')}</p>
          ) : null}
        </fieldset>
        <TextareaField
          label={
            type === 'ASSIGNMENT_GUIDE' ? t('compose.assignmentLabel') : t('compose.instructions')
          }
          hint={type === 'ASSIGNMENT_GUIDE' ? undefined : t('common.optional')}
          rows={4}
          value={instructions}
          error={missing === 'instructions' ? t('compose.assignmentError') : undefined}
          onChange={(event) => {
            setInstructions(event.target.value);
          }}
        />
        {compose.isError ? <FormAlert>{t(errorKey(compose.error))}</FormAlert> : null}
        {compose.isPending ? (
          <p role="status" className="text-sm text-muted">
            {t('compose.writing')}
          </p>
        ) : null}
        <Button type="submit" disabled={compose.isPending}>
          <Sparkles aria-hidden className="size-5" />
          {compose.isPending ? t('compose.generating') : t('compose.generate')}
        </Button>
      </form>
    </>
  );
}
