import { readdir, readFile } from 'node:fs/promises';
import { PROMPTS_DIRECTORY } from './ai-files';

/*
 * Prompts are versioned Markdown files: prompts/<name>.v<N>.md, where <name> is kebab-case
 * parts separated by dots (snap-analysis.study). Changing a prompt means adding the next
 * version; the loader always uses the highest one, and every AI result stores the version
 * that produced it (the file name without .md, e.g. snap-analysis.study.v1).
 */

/** {{snake_case}} placeholders, filled when the prompt is rendered. */
const PLACEHOLDER = /\{\{([a-z][a-z0-9_]*)\}\}/g;
const PROMPT_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\.[a-z0-9]+(?:-[a-z0-9]+)*)*$/;
const MARKDOWN_EXTENSION = '.md';

export interface PromptTemplate {
  name: string;
  /** File name without .md, e.g. snap-analysis.study.v1. */
  version: string;
  text: string;
  /** Every placeholder of the text, without repeats. */
  placeholders: string[];
}

export interface RenderedPrompt {
  name: string;
  version: string;
  text: string;
}

export type PromptValues = Readonly<Record<string, string>>;

export interface PromptLoader {
  /** The highest version of a prompt. */
  load(name: string): Promise<PromptTemplate>;
  /** The highest version of a prompt with its placeholders filled. Fails if one has no value. */
  render(name: string, values: PromptValues): Promise<RenderedPrompt>;
}

async function readLatestVersion(directory: URL, name: string): Promise<PromptTemplate> {
  if (!PROMPT_NAME.test(name)) throw new Error(`Invalid prompt name "${name}"`);
  const fileName = new RegExp(`^${name.replaceAll('.', '\\.')}\\.v(\\d+)\\.md$`);
  let latest: { number: number; file: string } | undefined;
  for (const file of await readdir(directory)) {
    const versionNumber = fileName.exec(file)?.[1];
    if (versionNumber === undefined) continue;
    const number = Number(versionNumber);
    if (latest === undefined || number > latest.number) latest = { number, file };
  }
  if (latest === undefined) throw new Error(`There is no prompt file for "${name}"`);

  const text = await readFile(new URL(latest.file, directory), 'utf8');
  return {
    name,
    version: latest.file.slice(0, -MARKDOWN_EXTENSION.length),
    text,
    placeholders: [...new Set(Array.from(text.matchAll(PLACEHOLDER), ([, key]) => key ?? ''))],
  };
}

/** Reads the prompts of a folder (by default the prompts/ folder of this module), once each. */
export function createPromptLoader(directory: URL = PROMPTS_DIRECTORY): PromptLoader {
  const cache = new Map<string, Promise<PromptTemplate>>();

  function load(name: string): Promise<PromptTemplate> {
    let template = cache.get(name);
    if (template === undefined) {
      template = readLatestVersion(directory, name);
      // A failed read is not cached, so a fixed file is picked up on the next call.
      template.catch(() => cache.delete(name));
      cache.set(name, template);
    }
    return template;
  }

  return {
    load,

    async render(name, values) {
      const template = await load(name);
      const missing = template.placeholders.filter((key) => values[key] === undefined);
      if (missing.length > 0) {
        throw new Error(`Prompt ${template.version} has no value for: ${missing.join(', ')}`);
      }
      // One pass: a value that contains {{…}} is never filled in turn.
      const text = template.text.replace(PLACEHOLDER, (_match, key: string) => values[key] ?? '');
      return { name, version: template.version, text: text.trimEnd() };
    },
  };
}
