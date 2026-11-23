import { hashtagListSchema, type PostVisibility } from '@snapia/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { z } from 'zod';
import { paths } from '../../../app/paths';
import { Button } from '../../../components/button';
import { FormAlert } from '../../../components/form-alert';
import { PageHeader } from '../../../components/page-header';
import { TextField } from '../../../components/text-field';
import { TextareaField } from '../../../components/textarea-field';
import { errorKey } from '../../../i18n/error-key';
import { createPost, getPostDraft, socialKeys } from '../api';

const stateSchema = z.object({ snapIds: z.array(z.string()).min(1) });
const VISIBILITIES: readonly PostVisibility[] = ['PUBLIC', 'FOLLOWERS'];

/** A Post from your snaps: the AI suggests the caption and the hashtags, you decide. */
export function CreatePostPage() {
  const snapIds = stateSchema.safeParse(useLocation().state).data?.snapIds;
  if (snapIds === undefined) return <Navigate to={paths.spaces} replace />;
  return <PostForm snapIds={snapIds} />;
}

function PostForm({ snapIds }: { snapIds: string[] }) {
  const { t } = useTranslation();
  const draft = useQuery({
    queryKey: socialKeys.draft(snapIds),
    queryFn: ({ signal }) => getPostDraft(snapIds, signal),
    staleTime: Infinity,
  });

  return (
    <>
      <PageHeader title={t('posts.new.title')}>
        {t('posts.new.selected', { count: snapIds.length })}
      </PageHeader>
      {draft.isPending ? (
        <p role="status" className="text-muted">
          {t('posts.new.drafting')}
        </p>
      ) : (
        <>
          {draft.isError ? <FormAlert>{t(errorKey(draft.error))}</FormAlert> : null}
          <PostFields
            snapIds={snapIds}
            initialCaption={draft.data?.caption ?? ''}
            initialHashtags={(draft.data?.hashtags ?? []).map((tag) => `#${tag}`).join(' ')}
          />
        </>
      )}
    </>
  );
}

function PostFields({
  snapIds,
  initialCaption,
  initialHashtags,
}: {
  snapIds: string[];
  initialCaption: string;
  initialHashtags: string;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [caption, setCaption] = useState(initialCaption);
  const [hashtags, setHashtags] = useState(initialHashtags);
  const [visibility, setVisibility] = useState<PostVisibility>('PUBLIC');
  const publish = useMutation({
    mutationFn: createPost,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: socialKeys.feed });
      void navigate(paths.home);
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    const tags = hashtagListSchema.safeParse(hashtags.split(/[\s,]+/).filter((tag) => tag !== ''));
    publish.mutate({
      snapIds,
      caption: caption.trim(),
      hashtags: tags.success ? tags.data : [],
      visibility,
    });
  }

  return (
    <>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <TextareaField
          label={t('posts.new.caption')}
          rows={5}
          value={caption}
          onChange={(event) => {
            setCaption(event.target.value);
          }}
        />
        <TextField
          label={t('posts.new.hashtags')}
          value={hashtags}
          autoCapitalize="none"
          onChange={(event) => {
            setHashtags(event.target.value);
          }}
        />
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium">{t('posts.new.visibility')}</legend>
          {VISIBILITIES.map((option) => (
            <label key={option} className="flex min-h-11 items-center gap-3">
              <input
                type="radio"
                name="visibility"
                checked={visibility === option}
                onChange={() => {
                  setVisibility(option);
                }}
                className="size-4 accent-ink"
              />
              {t(`posts.visibility.${option}`)}
            </label>
          ))}
        </fieldset>
        {publish.isError ? <FormAlert>{t(errorKey(publish.error))}</FormAlert> : null}
        <Button type="submit" disabled={publish.isPending}>
          {publish.isPending ? t('posts.new.publishing') : t('posts.new.publish')}
        </Button>
      </form>
    </>
  );
}
