import { useTranslation } from 'react-i18next';
import { PageHeader } from '../../../components/page-header';
import { modeOrder, modes } from '../../../config/modes';

export function SpacesPage() {
  const { t } = useTranslation();
  return (
    <>
      <PageHeader title={t('spaces.title')}>{t('spaces.intro')}</PageHeader>
      <section aria-labelledby="modes-title" className="flex flex-col gap-3">
        <h2 id="modes-title" className="font-semibold">
          {t('spaces.modesTitle')}
        </h2>
        <ul className="flex flex-col divide-y divide-line border-y border-line">
          {modeOrder.map((mode) => {
            const { icon: Icon, labelKey, descriptionKey, textClass } = modes[mode];
            return (
              <li key={mode} className="flex items-start gap-3 py-4">
                <Icon aria-hidden className={`mt-0.5 size-6 shrink-0 ${textClass}`} />
                <div className="flex flex-col gap-0.5">
                  <p className="font-semibold">{t(labelKey)}</p>
                  <p className="text-sm text-muted">{t(descriptionKey)}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}
