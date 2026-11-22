import type { SnapInsightDataByMode, SpaceMode } from '@snapia/shared';
import { removeContactDetails } from '../../lib/personal-data';

/*
 * How AI tasks show snaps and people's text to the model, without personal data: emails and
 * phone numbers are removed, authors are neutral labels (Member 1, Member 2…) and nothing goes
 * over AI_CONTEXT_MAX_CHARS. Snaps are numbered: the model cites the N-th one as [Snap N].
 */

export type SnapInsightData = SnapInsightDataByMode[SpaceMode];

/** A DONE snap with its SnapInsight, as AI tasks read it. */
export interface AnalyzedSnap {
  id: string;
  authorId: string;
  takenAt: Date;
  note: string | null;
  tags: string[];
  insight: SnapInsightData;
}

/** What a prompt says when a value is empty. */
export const NONE = '(none)';

/** Marks a text that was cut to fit the context. */
const CUT_MARK = ' […]';

/** The tags that delimit people's text in the prompts; people's text must not close them. */
const PROMPT_DELIMITERS = /<\/?(?:author_note|instructions|question|history|snaps)>/gi;

/** A [Snap N] citation. */
const SNAP_CITATION = /\[Snap (\d+)\]/g;

/**
 * Space metadata that helps the AI. Fields that name people (professor, client) are never sent.
 */
const SPACE_CONTEXT_FIELDS = {
  STUDY: ['subject', 'semester'],
  WORK: ['project', 'siteLabel'],
  CONTENT: ['niche'],
} as const satisfies Record<SpaceMode, readonly string[]>;

function cut(text: string, maxChars: number): string {
  return text.length <= maxChars ? text : `${text.slice(0, maxChars - CUT_MARK.length)}${CUT_MARK}`;
}

/** Text written by people, ready for a prompt: no contact details, no delimiters, at most maxChars. */
export function textForAi(text: string, maxChars: number): string {
  return cut(removeContactDetails(text).replace(PROMPT_DELIMITERS, '').trim(), maxChars);
}

/** The useful Space metadata as an indented list for the prompts. */
export function describeSpaceMetadata(
  mode: SpaceMode,
  metadata: unknown,
  maxChars: number,
): string {
  const fields: Record<string, unknown> =
    typeof metadata === 'object' && metadata !== null ? { ...metadata } : {};
  const lines = SPACE_CONTEXT_FIELDS[mode].flatMap((field) => {
    const value = fields[field];
    return typeof value === 'string' && value.trim() !== ''
      ? [`  - ${field}: ${textForAi(value, maxChars)}`]
      : [];
  });
  return lines.length > 0 ? lines.join('\n') : `  - ${NONE}`;
}

/** Member 1, Member 2… in the order the authors first appear. */
function authorLabels(snaps: readonly AnalyzedSnap[]): Map<string, string> {
  const labels = new Map<string, string>();
  for (const { authorId } of snaps) {
    if (!labels.has(authorId)) labels.set(authorId, `Member ${String(labels.size + 1)}`);
  }
  return labels;
}

function snapBlock(snap: AnalyzedSnap, number: number, author: string, maxChars: number): string {
  const lines = [
    `### [Snap ${String(number)}]`,
    `- Taken: ${snap.takenAt.toISOString()}`,
    `- Author: ${author}`,
    `- Tags: ${snap.tags.length > 0 ? snap.tags.join(', ') : NONE}`,
    `- Note: ${snap.note ?? NONE}`,
    `- Insight: ${JSON.stringify(snap.insight)}`,
  ];
  return textForAi(lines.join('\n'), maxChars);
}

/**
 * Every snap in the given order, numbered from 1. Each one gets an equal share of maxChars, so
 * none is left out.
 */
export function formatSnapContext(snaps: readonly AnalyzedSnap[], maxChars: number): string {
  const labels = authorLabels(snaps);
  const share = Math.floor(maxChars / Math.max(snaps.length, 1));
  return snaps
    .map((snap, index) => snapBlock(snap, index + 1, labels.get(snap.authorId) ?? NONE, share))
    .join('\n\n');
}

/**
 * The first snaps that fit whole in maxChars, in the given order (the most relevant first),
 * numbered from 1.
 */
export function fitSnapContext(
  snaps: readonly AnalyzedSnap[],
  maxChars: number,
): { snaps: AnalyzedSnap[]; text: string } {
  const labels = authorLabels(snaps);
  const chosen: AnalyzedSnap[] = [];
  const blocks: string[] = [];
  let used = 0;
  for (const snap of snaps) {
    const block = snapBlock(snap, chosen.length + 1, labels.get(snap.authorId) ?? NONE, maxChars);
    const separator = blocks.length > 0 ? 2 : 0;
    if (used + separator + block.length > maxChars) break;
    chosen.push(snap);
    blocks.push(block);
    used += separator + block.length;
  }
  return { snaps: chosen, text: blocks.join('\n\n') };
}

/** The snap numbers a text cites as [Snap N], without repeats, in order of appearance. */
export function citedSnapNumbers(text: string): number[] {
  return [...new Set(Array.from(text.matchAll(SNAP_CITATION), ([, number]) => Number(number)))];
}

/** A problem for every [Snap N] that is not one of the snaps sent (1 to count). */
export function invalidCitations(text: string, count: number): string[] {
  return citedSnapNumbers(text)
    .filter((number) => number < 1 || number > count)
    .map(
      (number) =>
        `[Snap ${String(number)}] does not exist: cite only [Snap 1] to [Snap ${String(count)}]`,
    );
}
