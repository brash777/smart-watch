import type { AskExchange } from '@snapia/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Send } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { paths } from '../../../app/paths';
import { Button } from '../../../components/button';
import { FormAlert } from '../../../components/form-alert';
import { Markdown } from '../../../components/markdown';
import { errorKey } from '../../../i18n/error-key';
import { useSpaceSnaps } from '../../snaps/hooks/use-snaps';
import { askSpace } from '../../study/api';
import { useSpaceOutlet } from '../hooks/use-space-outlet';

/** The conversation of this visit; the API keeps it too, for the context of the next answers. */
const askKey = (spaceId: string) => ['ask', spaceId] as const;

/** "Ask your Space": answers that only use the snaps and cite them. */
export function SpaceAskTab() {
  const { t } = useTranslation();
  const space = useSpaceOutlet();
  const queryClient = useQueryClient();
  const snaps = useSpaceSnaps(space.id);
  const [question, setQuestion] = useState('');
  const history = useQuery<AskExchange[]>({
    queryKey: askKey(space.id),
    queryFn: () => [],
    staleTime: Infinity,
  });
  const ask = useMutation({
    mutationFn: (text: string) => askSpace(space.id, text),
    onSuccess: (exchange) => {
      queryClient.setQueryData<AskExchange[]>(askKey(space.id), (previous = []) => [
        ...previous,
        exchange,
      ]);
      setQuestion('');
    },
  });
  const thumbnails = new Map(
    (snaps.data?.pages.flatMap((page) => page.items) ?? []).map((snap) => [snap.id, snap]),
  );

  function submit(event: FormEvent) {
    event.preventDefault();
    if (question.trim() !== '') ask.mutate(question.trim());
  }

  return (
    <section aria-labelledby="ask-title" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id="ask-title" className="font-display text-xl font-bold tracking-tight">
          {t('ask.title')}
        </h2>
        <p className="text-muted">{t('ask.intro')}</p>
      </div>
      <ol aria-live="polite" className="flex flex-col gap-4">
        {(history.data ?? []).map((exchange) => (
          <li key={exchange.answer.id} className="flex flex-col gap-2">
            <p className="ml-12 self-end rounded-card bg-ink px-4 py-2 text-on-ink">
              {exchange.question.content}
            </p>
            <div className="mr-6 flex flex-col gap-2 rounded-card border border-line bg-surface p-4">
              <Markdown>{exchange.answer.content}</Markdown>
              {exchange.found ? null : <p className="text-sm text-muted">{t('ask.notFound')}</p>}
              {exchange.answer.citedSnapIds.length > 0 ? (
                <ul aria-label={t('ask.sources')} className="flex flex-wrap gap-2">
                  {exchange.answer.citedSnapIds.map((snapId, index) => {
                    const snap = thumbnails.get(snapId);
                    return (
                      <li key={snapId}>
                        <Link
                          to={paths.snap(space.id, snapId)}
                          className="flex min-h-11 items-center gap-2 rounded-full border border-line pr-3 text-sm"
                        >
                          {snap === undefined ? null : (
                            <img
                              src={snap.thumbnailUrl}
                              alt=""
                              className="size-9 rounded-full object-cover"
                            />
                          )}
                          <span className={snap === undefined ? 'pl-3' : ''}>
                            {t('ask.source', { number: index + 1 })}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
      {ask.isPending ? (
        <p role="status" className="text-sm text-muted">
          {t('ask.thinking')}
        </p>
      ) : null}
      {ask.isError ? <FormAlert>{t(errorKey(ask.error))}</FormAlert> : null}
      <form onSubmit={submit} className="flex items-end gap-2">
        <label className="flex flex-1 flex-col gap-1.5">
          <span className="sr-only">{t('ask.label')}</span>
          <textarea
            rows={2}
            value={question}
            placeholder={t('ask.placeholder')}
            onChange={(event) => {
              setQuestion(event.target.value);
            }}
            className="w-full rounded-control border border-field-border bg-surface px-3 py-2.5 text-base"
          />
        </label>
        <Button
          type="submit"
          fullWidth={false}
          aria-label={t('ask.send')}
          disabled={ask.isPending || question.trim() === ''}
        >
          <Send aria-hidden className="size-5" />
        </Button>
      </form>
    </section>
  );
}
