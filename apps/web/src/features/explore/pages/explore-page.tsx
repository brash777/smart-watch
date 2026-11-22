import { useTranslation } from 'react-i18next';
import { PageHeader } from '../../../components/page-header';

export function ExplorePage() {
  const { t } = useTranslation();
  return <PageHeader title={t('explore.title')}>{t('explore.intro')}</PageHeader>;
}
