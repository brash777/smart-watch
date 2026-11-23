import type { Space } from '@snapia/shared';
import { useOutletContext } from 'react-router';

/** The Space of the detail page, for the tabs it renders. */
export function useSpaceOutlet(): Space {
  return useOutletContext<Space>();
}
