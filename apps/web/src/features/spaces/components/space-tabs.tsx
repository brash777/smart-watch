import type { Space } from '@snapia/shared';
import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router';
import { paths } from '../../../app/paths';
import { canUploadSnaps } from '../space-permissions';

type TabKey = 'snaps' | 'documents' | 'study' | 'ask' | 'members';

/** The sections of a Space. Study tools only exist in STUDY Spaces. */
export function SpaceTabs({ space }: { space: Space }) {
  const { t } = useTranslation();
  const tabs: { key: TabKey; to: string }[] = [
    { key: 'snaps', to: paths.space(space.id) },
    { key: 'documents', to: paths.spaceDocuments(space.id) },
    ...(space.mode === 'STUDY' ? [{ key: 'study' as const, to: paths.spaceStudy(space.id) }] : []),
    // Ask is for the members who can use the AI (EDITOR and OWNER).
    ...(canUploadSnaps(space) ? [{ key: 'ask' as const, to: paths.spaceAsk(space.id) }] : []),
    { key: 'members', to: paths.spaceMembers(space.id) },
  ];

  return (
    <nav aria-label={t('spaces.detail.tabsLabel')} className="-mx-4 border-b border-line">
      <ul className="flex overflow-x-auto px-2">
        {tabs.map(({ key, to }) => (
          <li key={key}>
            <NavLink
              to={to}
              end
              replace
              className={({ isActive }) =>
                `flex min-h-12 items-center border-b-2 px-3 text-sm font-semibold ${
                  isActive ? 'border-ink text-ink' : 'border-transparent text-muted hover:text-ink'
                }`
              }
            >
              {t(`spaces.detail.tabs.${key}`)}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
