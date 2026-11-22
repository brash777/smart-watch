import { z } from 'zod';

type JsonSchema = Record<string, unknown>;

/**
 * Keywords that strict tool use does not accept. They are dropped from the schema the model
 * sees; Zod still enforces them when the runner validates the answer.
 */
const UNSUPPORTED_KEYWORDS = new Set([
  '$schema',
  'minLength',
  'maxLength',
  'pattern',
  'minimum',
  'maximum',
  'exclusiveMinimum',
  'exclusiveMaximum',
  'multipleOf',
  'minItems',
  'maxItems',
  'uniqueItems',
  'minProperties',
  'maxProperties',
]);

/** Keywords whose value is one schema, a list of schemas or a map of name → schema. */
const SCHEMA_KEYWORDS = new Set([
  'items',
  'not',
  'contains',
  'propertyNames',
  'if',
  'then',
  'else',
]);
const SCHEMA_LIST_KEYWORDS = new Set(['anyOf', 'allOf', 'prefixItems']);
const SCHEMA_MAP_KEYWORDS = new Set(['properties', '$defs', 'definitions', 'patternProperties']);

function isJsonObject(value: unknown): value is JsonSchema {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function strictSchema(node: unknown): unknown {
  if (!isJsonObject(node)) return node;
  const result: JsonSchema = {};
  for (const [keyword, value] of Object.entries(node)) {
    if (UNSUPPORTED_KEYWORDS.has(keyword)) continue;
    if (SCHEMA_KEYWORDS.has(keyword)) {
      result[keyword] = strictSchema(value);
    } else if (SCHEMA_LIST_KEYWORDS.has(keyword) || keyword === 'oneOf') {
      // oneOf is not supported: anyOf accepts the same answers here, and Zod checks the rest.
      const target = keyword === 'oneOf' ? 'anyOf' : keyword;
      result[target] = Array.isArray(value) ? value.map(strictSchema) : value;
    } else if (SCHEMA_MAP_KEYWORDS.has(keyword) && isJsonObject(value)) {
      result[keyword] = Object.fromEntries(
        Object.entries(value).map(([name, schema]) => [name, strictSchema(schema)]),
      );
    } else {
      // Literal values (type, enum, const, required, description…) are kept as they are.
      result[keyword] = value;
    }
  }
  if (result.type === 'object') {
    result.additionalProperties = false;
    result.required ??= [];
  }
  return result;
}

const cache = new WeakMap<z.ZodType, JsonSchema>();

/**
 * The JSON Schema of a Zod output schema, ready for a tool with strict: true: every object has
 * additionalProperties: false and a required list, and unsupported keywords are left out.
 * The schema describes the input side, so transforms (lowercasing, removing repeats…) run
 * after the model answers.
 */
export function toStrictJsonSchema(schema: z.ZodType): JsonSchema {
  const cached = cache.get(schema);
  if (cached !== undefined) return cached;
  const converted = strictSchema(z.toJSONSchema(schema, { io: 'input' }));
  if (!isJsonObject(converted) || converted.type !== 'object') {
    throw new Error('A tool input schema must describe an object');
  }
  cache.set(schema, converted);
  return converted;
}
