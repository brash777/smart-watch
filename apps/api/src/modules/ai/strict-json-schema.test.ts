import { contentSnapInsightSchema, snapInsightDataSchemas } from '@snapia/shared';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { toStrictJsonSchema } from './strict-json-schema';

/** Every object node of a JSON Schema, found by walking the whole tree. */
function objectNodes(node: unknown): Record<string, unknown>[] {
  if (Array.isArray(node)) return node.flatMap(objectNodes);
  if (typeof node !== 'object' || node === null) return [];
  const record = node as Record<string, unknown>;
  const children = Object.values(record).flatMap(objectNodes);
  return record.type === 'object' ? [record, ...children] : children;
}

describe('toStrictJsonSchema', () => {
  it('closes every object and lists its required fields', () => {
    const schema = toStrictJsonSchema(
      z.object({
        name: z.string(),
        items: z.array(z.object({ term: z.string(), level: z.enum(['LOW', 'HIGH']) })),
      }),
    );

    expect(schema).toEqual({
      type: 'object',
      properties: {
        name: { type: 'string' },
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              term: { type: 'string' },
              level: { type: 'string', enum: ['LOW', 'HIGH'] },
            },
            required: ['term', 'level'],
            additionalProperties: false,
          },
        },
      },
      required: ['name', 'items'],
      additionalProperties: false,
    });
  });

  it('leaves out the keywords strict tool use does not support', () => {
    const schema = toStrictJsonSchema(
      z.object({
        text: z.string().trim().min(1).max(10).regex(/^a/),
        score: z.number().int().min(0).max(100).multipleOf(5),
        list: z.array(z.string()).min(1).max(3),
      }),
    );

    expect(JSON.stringify(schema)).not.toMatch(
      /\$schema|minLength|maxLength|pattern|minimum|maximum|multipleOf|minItems|maxItems/,
    );
    expect(schema.properties).toEqual({
      text: { type: 'string' },
      score: { type: 'integer' },
      list: { type: 'array', items: { type: 'string' } },
    });
  });

  it('keeps fields whose names look like JSON Schema keywords', () => {
    const schema = toStrictJsonSchema(z.object({ pattern: z.string(), minimum: z.number() }));

    expect(schema.properties).toEqual({ pattern: { type: 'string' }, minimum: { type: 'number' } });
    expect(schema.required).toEqual(['pattern', 'minimum']);
  });

  it('describes the input the model writes, before transforms run', () => {
    const schema = toStrictJsonSchema(contentSnapInsightSchema);

    expect(schema.properties).toMatchObject({
      hashtags: { type: 'array', items: { type: 'string' } },
      qualityScore: { type: 'integer' },
    });
  });

  it('produces a strict schema for the SnapInsight of every mode', () => {
    for (const outputSchema of Object.values(snapInsightDataSchemas)) {
      const nodes = objectNodes(toStrictJsonSchema(outputSchema));

      expect(nodes.length).toBeGreaterThan(0);
      for (const node of nodes) {
        expect(node.additionalProperties).toBe(false);
        expect(node.required).toEqual(Object.keys(node.properties as object));
      }
    }
  });

  it('only accepts schemas of objects', () => {
    expect(() => toStrictJsonSchema(z.string())).toThrow(/object/);
  });
});
