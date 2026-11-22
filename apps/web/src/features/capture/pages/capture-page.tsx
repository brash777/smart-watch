import { useTranslation } from 'react-i18next';
import { PageHeader } from '../../../components/page-header';

export function CapturePage() {
  const { t } = useTranslation();
  return <PageHeader title={t('capture.title')}>{t('capture.intro')}</PageHeader>;
}
