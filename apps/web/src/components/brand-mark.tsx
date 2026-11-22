import type { SpaceMode } from '@snapia/shared';
import type { ReactNode } from 'react';
import { modeOrder, modes } from '../config/modes';

/*
 * The brand mark: a lens ring split in the three colors of the Space modes. It is the app's one
 * bold element: the logo, and the frame of the capture button.
 */

const CENTER = 24;
const RADIUS = 19;
/** Each mode draws one arc of the ring, with a gap before the next one. */
const ARC_SPAN = 96;
const ARC_STEP = 120;
const FIRST_ARC_START = -18;

function pointAt(angle: number): string {
  const radians = (angle * Math.PI) / 180;
  const x = CENTER + RADIUS * Math.cos(radians);
  const y = CENTER + RADIUS * Math.sin(radians);
  return `${x.toFixed(2)} ${y.toFixed(2)}`;
}

const arcs: { mode: SpaceMode; d: string }[] = modeOrder.map((mode, index) => {
  const start = FIRST_ARC_START + index * ARC_STEP;
  return { mode, d: `M${pointAt(start)} A${RADIUS} ${RADIUS} 0 0 1 ${pointAt(start + ARC_SPAN)}` };
});

/** The ring at the size of className; children go in its center. Decorative for screen readers. */
export function BrandMark({
  className = '',
  children,
}: {
  className?: string;
  children?: ReactNode;
}) {
  return (
    <span className={`relative inline-grid shrink-0 place-items-center ${className}`}>
      <svg
        viewBox="0 0 48 48"
        aria-hidden
        className="absolute inset-0 size-full"
        fill="none"
        strokeWidth={5}
        strokeLinecap="round"
      >
        {arcs.map(({ mode, d }) => (
          <path key={mode} d={d} stroke={modes[mode].cssColor} />
        ))}
      </svg>
      {children}
    </span>
  );
}
