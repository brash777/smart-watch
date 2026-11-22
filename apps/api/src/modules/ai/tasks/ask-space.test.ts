import { describe, expect, it } from 'vitest';
import type { AnalyzedSnap } from '../snap-context';
import { rankByWordsInCommon } from './ask-space';

function snap(id: string, note: string, day: number): AnalyzedSnap {
  return {
    id,
    authorId: 'author',
    takenAt: new Date(Date.UTC(2024, 4, day)),
    note,
    tags: [],
    insight: {
      summary: 'Apuntes de la clase de cálculo',
      suggestedTags: [],
      contentType: 'WHITEBOARD',
      extractedText: '',
      topics: [],
      keyConcepts: [],
      warnings: [],
    },
  };
}

describe('rankByWordsInCommon', () => {
  const snaps = [
    snap('integrals', 'Integrales por partes y sustitución', 1),
    snap('chain', 'La regla de la cadena para funciones compuestas', 2),
    snap('limits', 'Límites laterales y continuidad', 3),
  ];

  it('puts first the snaps that share more words with the question, ignoring accents and case', () => {
    const ranked = rankByWordsInCommon(
      '¿Cómo se usa la REGLA de la cadena en funciones compuestas?',
      snaps,
    );

    expect(ranked.map(({ id }) => id)[0]).toBe('chain');
  });

  it('weighs little the words that every snap has', () => {
    // "cálculo" and "clase" are in every insight; "límites" only in one snap.
    const ranked = rankByWordsInCommon('clase de cálculo: límites', snaps);

    expect(ranked[0]?.id).toBe('limits');
  });

  it('keeps every snap, the newest first when nothing matches', () => {
    expect(rankByWordsInCommon('fotosíntesis', snaps).map(({ id }) => id)).toEqual([
      'limits',
      'chain',
      'integrals',
    ]);
  });
});
