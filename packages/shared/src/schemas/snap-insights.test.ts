import { describe, expect, it } from 'vitest';
import {
  contentSnapInsightSchema,
  hashtagSchema,
  snapInsightDataSchemas,
  studySnapInsightSchema,
  workSnapInsightSchema,
} from './snap-insights';

const study = {
  summary: 'Derivadas de funciones compuestas.',
  suggestedTags: ['Cálculo', 'derivadas', 'cálculo'],
  contentType: 'WHITEBOARD',
  extractedText: "# Regla de la cadena\n\n$(f \\circ g)' = f'(g) \\cdot g'$",
  topics: ['Regla de la cadena'],
  keyConcepts: [{ term: 'Regla de la cadena', definition: 'Deriva funciones compuestas.' }],
  warnings: [],
};

const content = {
  summary: 'Pastel de chocolate sobre una mesa de madera.',
  suggestedTags: ['repostería'],
  description: 'Un pastel de chocolate con frutos rojos, iluminado de lado.',
  qualityScore: 82,
  qualityTips: ['Limpia el fondo.'],
  suggestedCaption: 'Recién salido del horno.',
  hashtags: ['#Repostería', 'chocolate', 'repostería'],
  altText: 'Pastel de chocolate con frutos rojos encima.',
};

describe('snap insight schemas', () => {
  it('has one schema per Space mode', () => {
    expect(Object.keys(snapInsightDataSchemas).sort()).toEqual(['CONTENT', 'STUDY', 'WORK']);
  });

  it('normalizes the suggested tags like snap tags', () => {
    expect(studySnapInsightSchema.parse(study).suggestedTags).toEqual(['cálculo', 'derivadas']);
  });

  it('accepts a STUDY snap without readable text, but never an empty summary', () => {
    expect(studySnapInsightSchema.safeParse({ ...study, extractedText: '' }).success).toBe(true);
    expect(studySnapInsightSchema.safeParse({ ...study, summary: '  ' }).success).toBe(false);
    expect(studySnapInsightSchema.safeParse({ ...study, contentType: 'PHOTO' }).success).toBe(
      false,
    );
  });

  it('checks the severity of WORK issues', () => {
    const work = {
      summary: 'Tablero eléctrico instalado.',
      suggestedTags: [],
      activity: 'Instalación del tablero eléctrico.',
      objectsDetected: ['tablero', 'cableado'],
      progressNote: 'Terminado, falta rotular los circuitos.',
      issues: [{ description: 'Cable sin canaleta.', severity: 'MEDIUM' }],
      safetyObservations: [],
    };

    expect(workSnapInsightSchema.safeParse(work).success).toBe(true);
    expect(
      workSnapInsightSchema.safeParse({
        ...work,
        issues: [{ description: 'Cable sin canaleta.', severity: 'URGENT' }],
      }).success,
    ).toBe(false);
  });

  it('keeps qualityScore a whole number from 0 to 100', () => {
    for (const qualityScore of [0, 100]) {
      expect(contentSnapInsightSchema.safeParse({ ...content, qualityScore }).success).toBe(true);
    }
    for (const qualityScore of [-1, 101, 82.5]) {
      expect(contentSnapInsightSchema.safeParse({ ...content, qualityScore }).success).toBe(false);
    }
  });

  it('stores hashtags lowercase, without # and without repeats', () => {
    expect(contentSnapInsightSchema.parse(content).hashtags).toEqual(['repostería', 'chocolate']);
    expect(hashtagSchema.safeParse('pan casero').success).toBe(false);
    expect(hashtagSchema.safeParse('#').success).toBe(false);
  });
});
