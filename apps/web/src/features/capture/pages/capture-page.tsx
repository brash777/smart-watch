import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Camera, ImagePlus, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { paths } from '../../../app/paths';
import { Button } from '../../../components/button';
import { buttonClassName } from '../../../components/button-styles';
import { FormAlert } from '../../../components/form-alert';
import { ModeTile } from '../../../components/mode-tile';
import { PageHeader } from '../../../components/page-header';
import { Skeleton } from '../../../components/skeleton';
import { ErrorState } from '../../../components/state-message';
import { TextareaField } from '../../../components/textarea-field';
import { env } from '../../../config/env';
import { errorKey } from '../../../i18n/error-key';
import { formatPercent } from '../../../lib/format';
import { useAppConfig } from '../../app-config/hooks/use-app-config';
import { snapKeys, uploadSnaps } from '../../snaps/api';
import { spaceKeys } from '../../spaces/api';
import { useMySpaces } from '../../spaces/hooks/use-spaces';
import { canUploadSnaps } from '../../spaces/space-permissions';
import { compressPhoto } from '../lib/compress-photo';

interface Photo {
  file: File;
  previewUrl: string;
}

type Progress =
  | { step: 'idle' }
  | { step: 'preparing'; current: number; total: number }
  | { step: 'uploading'; fraction: number };

/** Take or pick photos, choose a Space, add a note and upload them with a progress bar. */
export function CapturePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const config = useAppConfig();
  const spaces = useMySpaces();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [spaceId, setSpaceId] = useState(searchParams.get('space') ?? '');
  const [note, setNote] = useState('');
  const [tooMany, setTooMany] = useState(false);
  const [missingSpace, setMissingSpace] = useState(false);
  const [progress, setProgress] = useState<Progress>({ step: 'idle' });

  // The picker lists every Space where you can upload, so it reads every page.
  useEffect(() => {
    if (spaces.hasNextPage && !spaces.isFetchingNextPage) void spaces.fetchNextPage();
  }, [spaces]);

  useEffect(
    () => () => {
      for (const photo of photos) URL.revokeObjectURL(photo.previewUrl);
    },
    // Only on unmount: removed photos are revoked when they are removed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const upload = useMutation({
    mutationFn: async () => {
      if (config.data === undefined) throw new Error('The app config is not loaded');
      const { imageMaxSidePx, allowedMimeTypes } = config.data.uploads;
      const files: Blob[] = [];
      for (const [index, photo] of photos.entries()) {
        setProgress({ step: 'preparing', current: index + 1, total: photos.length });
        files.push(
          await compressPhoto(photo.file, {
            maxSidePx: imageMaxSidePx,
            quality: env.uploadImageQuality,
            allowedTypes: allowedMimeTypes,
          }),
        );
      }
      setProgress({ step: 'uploading', fraction: 0 });
      return uploadSnaps(spaceId, files, note, {
        onProgress: (sent, total) => {
          setProgress({ step: 'uploading', fraction: sent / total });
        },
      });
    },
    onSettled: () => {
      setProgress({ step: 'idle' });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: snapKeys.list(spaceId) });
      void queryClient.invalidateQueries({ queryKey: snapKeys.analysisStatus(spaceId) });
      void queryClient.invalidateQueries({ queryKey: spaceKeys.all });
    },
  });

  if (config.isPending || spaces.isPending) {
    return <Skeleton className="h-48 rounded-card" />;
  }
  if (config.isError || spaces.isError) {
    return (
      <ErrorState
        message={t('capture.loadError')}
        onRetry={() => {
          void config.refetch();
          void spaces.refetch();
        }}
      />
    );
  }

  const maxFiles = config.data.uploads.maxFiles;
  const writable = spaces.data.pages.flatMap((page) => page.items).filter(canUploadSnaps);
  const busy = upload.isPending;

  function addFiles(list: FileList | null) {
    const files = [...(list ?? [])];
    const room = maxFiles - photos.length;
    setTooMany(files.length > room);
    setPhotos([
      ...photos,
      ...files.slice(0, Math.max(room, 0)).map((file) => ({
        file,
        previewUrl: URL.createObjectURL(file),
      })),
    ]);
  }

  function removePhoto(index: number) {
    const photo = photos[index];
    if (photo !== undefined) URL.revokeObjectURL(photo.previewUrl);
    setPhotos(photos.filter((_, position) => position !== index));
    setTooMany(false);
  }

  function submit() {
    if (spaceId === '' || !writable.some((space) => space.id === spaceId)) {
      setMissingSpace(true);
      return;
    }
    upload.mutate(undefined, {
      onSuccess: (snaps) => {
        void navigate(paths.space(spaceId), { state: { uploaded: snaps.length } });
      },
    });
  }

  const pickerClass = buttonClassName({ variant: 'secondary' });

  return (
    <>
      <PageHeader title={t('capture.title')} />

      <div className="flex flex-col gap-3">
        <label className={`${buttonClassName()} min-h-14 cursor-pointer`}>
          <Camera aria-hidden className="size-5" />
          {t('capture.takePhoto')}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            disabled={busy}
            className="sr-only"
            onChange={(event) => {
              addFiles(event.target.files);
              event.target.value = '';
            }}
          />
        </label>
        <label className={`${pickerClass} cursor-pointer`}>
          <ImagePlus aria-hidden className="size-5" />
          {t('capture.pickPhotos')}
          <input
            type="file"
            accept="image/*"
            multiple
            disabled={busy}
            className="sr-only"
            onChange={(event) => {
              addFiles(event.target.files);
              event.target.value = '';
            }}
          />
        </label>
        {tooMany ? <FormAlert>{t('capture.tooMany', { max: maxFiles })}</FormAlert> : null}
      </div>

      {photos.length === 0 ? (
        <p className="text-muted">{t('capture.empty')}</p>
      ) : (
        <ul aria-label={t('capture.photosLabel')} className="grid grid-cols-3 gap-1">
          {photos.map((photo, index) => (
            <li key={photo.previewUrl} className="relative aspect-square overflow-hidden">
              <img src={photo.previewUrl} alt="" className="size-full object-cover" />
              <button
                type="button"
                disabled={busy}
                aria-label={t('capture.remove', { number: index + 1 })}
                onClick={() => {
                  removePhoto(index);
                }}
                className="absolute top-1 right-1 grid size-9 place-items-center rounded-full bg-stage/60 text-on-stage"
              >
                <X aria-hidden className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 font-semibold">{t('capture.spaceLegend')}</legend>
        {writable.length === 0 ? (
          <p className="text-muted">
            {t('capture.noSpaces')}{' '}
            <Link to={paths.newSpace} className="font-semibold text-ink underline">
              {t('capture.createSpace')}
            </Link>
          </p>
        ) : (
          writable.map((space) => (
            <label
              key={space.id}
              className="flex cursor-pointer items-center gap-3 rounded-control border border-line bg-surface p-2 has-checked:border-ink has-checked:ring-1 has-checked:ring-ink"
            >
              <input
                type="radio"
                name="space"
                value={space.id}
                checked={spaceId === space.id}
                disabled={busy}
                onChange={() => {
                  setSpaceId(space.id);
                  setMissingSpace(false);
                }}
                className="sr-only"
              />
              <ModeTile mode={space.mode} />
              <span className="truncate font-semibold">{space.name}</span>
            </label>
          ))
        )}
        {missingSpace ? <p className="text-sm text-danger">{t('capture.spaceError')}</p> : null}
      </fieldset>

      <TextareaField
        label={t('capture.note')}
        hint={t('common.optional')}
        rows={2}
        value={note}
        disabled={busy}
        onChange={(event) => {
          setNote(event.target.value);
        }}
      />

      {upload.isError ? <FormAlert>{t(errorKey(upload.error))}</FormAlert> : null}
      {progress.step === 'idle' ? null : <UploadProgress progress={progress} />}
      <Button disabled={busy || photos.length === 0} onClick={submit}>
        {t('capture.submit', { count: photos.length })}
      </Button>
    </>
  );
}

function UploadProgress({ progress }: { progress: Exclude<Progress, { step: 'idle' }> }) {
  const { t } = useTranslation();
  const fraction = progress.step === 'uploading' ? progress.fraction : 0;
  const label =
    progress.step === 'preparing'
      ? t('capture.preparing', { current: progress.current, total: progress.total })
      : t('capture.uploading', { percent: formatPercent(progress.fraction) });
  return (
    <div className="flex flex-col gap-1.5">
      <p aria-live="polite" className="text-sm text-muted">
        {label}
      </p>
      <div
        role="progressbar"
        aria-label={t('capture.progressLabel')}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(fraction * 100)}
        className="h-2 overflow-hidden rounded-full bg-line"
      >
        <div
          className="h-full bg-ink transition-all"
          style={{ width: `${String(fraction * 100)}%` }}
        />
      </div>
    </div>
  );
}
