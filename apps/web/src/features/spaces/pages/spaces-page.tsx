import { useTranslation } from 'react-i18next';
import { PageHeader } from '../../../components/page-header';

export function SpacesPage() {
  const { t } = useTranslation();
  return <PageHeader title={t('spaces.title')}>{t('spaces.intro')}</PageHeader>;
}
