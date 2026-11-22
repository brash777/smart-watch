import { Link } from 'react-router';
import { paths } from '../app/paths';
import { env } from '../config/env';
import { BrandMark } from './brand-mark';

export function TopBar() {
  return (
    <header className="sticky top-0 z-10 flex h-14 items-center bg-canvas px-4">
      <Link
        to={paths.home}
        className="flex min-h-11 items-center gap-2 font-display text-2xl font-extrabold tracking-tight"
      >
        <BrandMark className="size-7" />
        {env.appName}
      </Link>
    </header>
  );
}
