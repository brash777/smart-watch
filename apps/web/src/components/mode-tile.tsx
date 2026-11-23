import type { SpaceMode } from '@snapia/shared';
import { modes } from '../config/modes';

const sizes = { md: 'size-11 rounded-control', lg: 'size-14 rounded-card' } as const;
const iconSizes = { md: 'size-5', lg: 'size-7' } as const;

/** The icon of a Space mode on its color: how the app tells the three modes apart. */
export function ModeTile({ mode, size = 'md' }: { mode: SpaceMode; size?: keyof typeof sizes }) {
  const { icon: Icon, bgClass } = modes[mode];
  return (
    <span aria-hidden className={`grid shrink-0 place-items-center ${sizes[size]} ${bgClass}`}>
      <Icon className={`${iconSizes[size]} text-on-ink`} strokeWidth={2} />
    </span>
  );
}
