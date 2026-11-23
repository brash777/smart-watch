import type {
  ContentSpaceMetadata,
  SpaceMode,
  StudySpaceMetadata,
  WorkSpaceMetadata,
} from '@snapia/shared';
import { BookOpen, HardHat, Palette, type LucideIcon } from 'lucide-react';

/*
 * The one place where a Space mode gets its look: components read from here and never switch
 * on the mode to pick a color or an icon. The color tokens live in src/styles/tokens.css.
 */

/** The metadata fields of every mode (docs/PRODUCT.md, "Space modes"). */
export type SpaceMetadataField =
  keyof StudySpaceMetadata | keyof WorkSpaceMetadata | keyof ContentSpaceMetadata;

export interface ModeStyle {
  icon: LucideIcon;
  labelKey: `modes.${SpaceMode}.label`;
  descriptionKey: `modes.${SpaceMode}.description`;
  /** Utility classes of the mode color (written out in full so Tailwind generates them). */
  textClass: string;
  bgClass: string;
  borderClass: string;
  /** For SVG fills and strokes. */
  cssColor: string;
  /** The metadata a Space of this mode can have, in the order the forms show it. */
  metadataFields: readonly SpaceMetadataField[];
}

export const modes: Record<SpaceMode, ModeStyle> = {
  STUDY: {
    icon: BookOpen,
    labelKey: 'modes.STUDY.label',
    descriptionKey: 'modes.STUDY.description',
    textClass: 'text-mode-study',
    bgClass: 'bg-mode-study',
    borderClass: 'border-mode-study',
    cssColor: 'var(--mode-study)',
    metadataFields: ['subject', 'professor', 'semester'] satisfies (keyof StudySpaceMetadata)[],
  },
  WORK: {
    icon: HardHat,
    labelKey: 'modes.WORK.label',
    descriptionKey: 'modes.WORK.description',
    textClass: 'text-mode-work',
    bgClass: 'bg-mode-work',
    borderClass: 'border-mode-work',
    cssColor: 'var(--mode-work)',
    metadataFields: ['project', 'client', 'siteLabel'] satisfies (keyof WorkSpaceMetadata)[],
  },
  CONTENT: {
    icon: Palette,
    labelKey: 'modes.CONTENT.label',
    descriptionKey: 'modes.CONTENT.description',
    textClass: 'text-mode-content',
    bgClass: 'bg-mode-content',
    borderClass: 'border-mode-content',
    cssColor: 'var(--mode-content)',
    metadataFields: ['niche'] satisfies (keyof ContentSpaceMetadata)[],
  },
};

/** The modes in the order the app shows them. */
export const modeOrder: readonly SpaceMode[] = ['STUDY', 'WORK', 'CONTENT'];
