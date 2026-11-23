import { Layers, ListChecks, MessageCircleQuestion, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Navigate } from 'react-router';
import { paths } from '../../../app/paths';
import { modes } from '../../../config/modes';
import { useSpaceOutlet } from '../hooks/use-space-outlet';

type StudyTool = 'flashcards' | 'quiz' | 'ask';

const tools: { key: StudyTool; icon: LucideIcon }[] = [
  { key: 'flashcards', icon: Layers },
  { key: 'quiz', icon: ListChecks },
  { key: 'ask', icon: MessageCircleQuestion },
];

/** The study tools of a STUDY Space. Other modes have none, so they go back to the snaps. */
export function SpaceStudyTab() {
  const { t } = useTranslation();
  const space = useSpaceOutlet();
  if (space.mode !== 'STUDY') return <Navigate to={paths.space(space.id)} replace />;

  return (
    <section aria-labelledby="study-title" className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 id="study-title" className="font-display text-xl font-bold tracking-tight">
          {t('spaces.study.title')}
        </h2>
        <p className="text-muted">{t('spaces.study.intro')}</p>
      </div>
      <ul className="flex flex-col divide-y divide-line border-y border-line">
        {tools.map(({ key, icon: Icon }) => (
          <li key={key} className="flex items-start gap-3 py-4">
            <Icon aria-hidden className={`mt-0.5 size-6 shrink-0 ${modes[space.mode].textClass}`} />
            <div className="flex flex-col gap-0.5">
              <p className="font-semibold">{t(`spaces.study.${key}.title`)}</p>
              <p className="text-sm text-muted">{t(`spaces.study.${key}.text`)}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
