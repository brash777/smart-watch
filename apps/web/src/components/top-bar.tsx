import { Link } from 'react-router';
import { paths } from '../app/paths';
import { env } from '../config/env';

export function TopBar() {
  return (
    <header className="sticky top-0 z-10 flex h-14 items-center px-4">
      <Link to={paths.home} className="flex min-h-11 items-center text-xl font-bold">
        {env.appName}
      </Link>
    </header>
  );
}
