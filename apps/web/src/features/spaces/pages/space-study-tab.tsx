import type { FlashcardDeck, Quiz } from '@snapia/shared';
import { useMutation } from '@tanstack/react-query';
import { Layers, ListChecks } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate } from 'react-router';
import { paths } from '../../../app/paths';
import { Button } from '../../../components/button';
import { FormAlert } from '../../../components/form-alert';
import { Skeleton } from '../../../components/skeleton';
import { errorKey } from '../../../i18n/error-key';
import { useAppConfig } from '../../app-config/hooks/use-app-config';
import { useSpaceSnaps } from '../../snaps/hooks/use-snaps';
import { generateFlashcards, generateQuiz } from '../../study/api';
import { FlashcardDeckView } from '../../study/components/flashcard-deck';
import { QuizView } from '../../study/components/quiz-view';
import { useSpaceOutlet } from '../hooks/use-space-outlet';
import { canUploadSnaps } from '../space-permissions';

type Material = { kind: 'flashcards'; deck: FlashcardDeck } | { kind: 'quiz'; quiz: Quiz };

/** Flashcards and quizzes made from the latest analyzed snaps of a STUDY Space. */
export function SpaceStudyTab() {
  const { t } = useTranslation();
  const space = useSpaceOutlet();
  const config = useAppConfig();
  const snaps = useSpaceSnaps(space.id);
  const [material, setMaterial] = useState<Material | null>(null);
  const generate = useMutation({
    mutationFn: async ({ kind, snapIds }: { kind: Material['kind']; snapIds: string[] }) =>
      kind === 'flashcards'
        ? { kind, deck: await generateFlashcards(space.id, snapIds) }
        : { kind, quiz: await generateQuiz(space.id, snapIds) },
    onSuccess: setMaterial,
  });

  if (space.mode !== 'STUDY') return <Navigate to={paths.space(space.id)} replace />;
  if (snaps.isPending || config.isPending) return <Skeleton className="h-32 rounded-card" />;

  const analyzed = (snaps.data?.pages.flatMap((page) => page.items) ?? [])
    .filter((snap) => snap.analysisStatus === 'DONE')
    .slice(0, config.data?.compose.maxSnaps);
  const snapIds = analyzed.map((snap) => snap.id);
  const canGenerate = canUploadSnaps(space) && snapIds.length > 0;

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="study-title" className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="study-title" className="font-display text-xl font-bold tracking-tight">
            {t('spaces.study.title')}
          </h2>
          <p className="text-muted">
            {snapIds.length === 0
              ? t('study.noSnaps')
              : t('study.using', { count: snapIds.length })}
          </p>
        </div>
        {canUploadSnaps(space) ? null : (
          <p className="text-sm text-muted">{t('study.viewerOnly')}</p>
        )}
        <div className="flex gap-2">
          <Button
            variant="secondary"
            disabled={!canGenerate || generate.isPending}
            onClick={() => {
              generate.mutate({ kind: 'flashcards', snapIds });
            }}
          >
            <Layers aria-hidden className="size-5" />
            {t('spaces.study.flashcards.title')}
          </Button>
          <Button
            variant="secondary"
            disabled={!canGenerate || generate.isPending}
            onClick={() => {
              generate.mutate({ kind: 'quiz', snapIds });
            }}
          >
            <ListChecks aria-hidden className="size-5" />
            {t('spaces.study.quiz.title')}
          </Button>
        </div>
        {generate.isPending ? (
          <p role="status" className="text-sm text-muted">
            {t('study.generating')}
          </p>
        ) : null}
        {generate.isError ? <FormAlert>{t(errorKey(generate.error))}</FormAlert> : null}
      </section>
      {material?.kind === 'flashcards' ? (
        <FlashcardDeckView key={material.deck.id} deck={material.deck} />
      ) : null}
      {material?.kind === 'quiz' ? <QuizView key={material.quiz.id} quiz={material.quiz} /> : null}
    </div>
  );
}
