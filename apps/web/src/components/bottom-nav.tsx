import { CircleUser, Compass, House, LayoutGrid, Plus, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router';
import { paths } from '../app/paths';
import { BrandMark } from './brand-mark';

interface NavItem {
  to: string;
  labelKey: 'nav.home' | 'nav.spaces' | 'nav.explore' | 'nav.profile';
  icon: LucideIcon;
}

const before: readonly NavItem[] = [
  { to: paths.home, labelKey: 'nav.home', icon: House },
  { to: paths.spaces, labelKey: 'nav.spaces', icon: LayoutGrid },
];
const after: readonly NavItem[] = [
  { to: paths.explore, labelKey: 'nav.explore', icon: Compass },
  { to: paths.profile, labelKey: 'nav.profile', icon: CircleUser },
];

function Tab({ to, labelKey, icon: Icon }: NavItem) {
  const { t } = useTranslation();
  return (
    <li className="flex justify-center">
      <NavLink
        to={to}
        end={to === paths.home}
        aria-label={t(labelKey)}
        className={({ isActive }) =>
          `flex min-h-11 min-w-11 items-center justify-center ${isActive ? 'text-ink' : 'text-muted'}`
        }
      >
        {({ isActive }) => (
          <Icon aria-hidden className="size-6" strokeWidth={isActive ? 2.5 : 1.75} />
        )}
      </NavLink>
    </li>
  );
}

/**
 * The bottom tab bar: icons only, like Instagram, each with its name for screen readers. The
 * capture button in the middle wears the brand ring.
 */
export function BottomNav() {
  const { t } = useTranslation();
  return (
    <nav
      aria-label={t('nav.label')}
      className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-surface pb-safe"
    >
      <ul className="mx-auto grid h-nav max-w-lg grid-cols-5 items-center">
        {before.map((item) => (
          <Tab key={item.to} {...item} />
        ))}
        <li className="flex justify-center">
          <NavLink
            to={paths.capture}
            aria-label={t('nav.capture')}
            className="flex min-h-11 min-w-11 items-center justify-center text-ink"
          >
            <BrandMark className="size-12">
              <Plus aria-hidden className="size-6" strokeWidth={2.5} />
            </BrandMark>
          </NavLink>
        </li>
        {after.map((item) => (
          <Tab key={item.to} {...item} />
        ))}
      </ul>
    </nav>
  );
}
