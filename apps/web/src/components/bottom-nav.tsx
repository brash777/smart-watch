import { CircleUser, Compass, House, LayoutGrid, Plus, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router';
import { paths } from '../app/paths';

interface NavItem {
  to: string;
  labelKey: 'nav.home' | 'nav.spaces' | 'nav.capture' | 'nav.explore' | 'nav.profile';
  icon: LucideIcon;
}

const items: readonly NavItem[] = [
  { to: paths.home, labelKey: 'nav.home', icon: House },
  { to: paths.spaces, labelKey: 'nav.spaces', icon: LayoutGrid },
  { to: paths.capture, labelKey: 'nav.capture', icon: Plus },
  { to: paths.explore, labelKey: 'nav.explore', icon: Compass },
  { to: paths.profile, labelKey: 'nav.profile', icon: CircleUser },
];

/** The bottom tab bar: icons only, like Instagram, each with its name for screen readers. */
export function BottomNav() {
  const { t } = useTranslation();
  return (
    <nav aria-label={t('nav.label')} className="fixed inset-x-0 bottom-0 z-10 pb-safe">
      <ul className="mx-auto grid h-nav max-w-lg grid-cols-5 items-center">
        {items.map(({ to, labelKey, icon: Icon }) => (
          <li key={to} className="flex justify-center">
            <NavLink
              to={to}
              end={to === paths.home}
              aria-label={t(labelKey)}
              className="flex min-h-11 min-w-11 items-center justify-center"
            >
              {({ isActive }) => (
                <Icon aria-hidden className="size-6" strokeWidth={isActive ? 2.5 : 1.75} />
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
