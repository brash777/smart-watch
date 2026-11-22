import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createPromptLoader } from './prompt-loader';

let directory: string;

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'snapia-prompts-'));
});
afterEach(() => rm(directory, { recursive: true, force: true }));

async function loaderWith(files: Record<string, string>) {
  for (const [name, text] of Object.entries(files)) {
    await writeFile(join(directory, name), text);
  }
  return createPromptLoader(pathToFileURL(`${directory}/`));
}

describe('createPromptLoader', () => {
  it('uses the highest version of a prompt', async () => {
    const prompts = await loaderWith({
      'greeting.v1.md': 'one',
      'greeting.v2.md': 'two',
      'greeting.v10.md': 'ten',
      'greeting.formal.v11.md': 'another prompt',
    });

    expect(await prompts.load('greeting')).toMatchObject({
      name: 'greeting',
      version: 'greeting.v10',
      text: 'ten',
    });
  });

  it('fills every placeholder in one pass', async () => {
    const prompts = await loaderWith({
      'greeting.v1.md': 'Hola {{user_name}}, {{note}}. Adiós {{user_name}}.\n',
    });

    const rendered = await prompts.render('greeting', {
      user_name: 'Ana',
      note: 'escribe {{user_name}}',
      unused: 'ignored',
    });

    expect(rendered).toEqual({
      name: 'greeting',
      version: 'greeting.v1',
      text: 'Hola Ana, escribe {{user_name}}. Adiós Ana.',
    });
  });

  it('fails when a placeholder has no value, so no prompt goes out with blanks', async () => {
    const prompts = await loaderWith({ 'greeting.v1.md': 'Hola {{user_name}} {{day}}' });

    await expect(prompts.render('greeting', { user_name: 'Ana' })).rejects.toThrow(
      'Prompt greeting.v1 has no value for: day',
    );
  });

  it('fails for unknown prompts and invalid names', async () => {
    const prompts = await loaderWith({ 'greeting.v1.md': 'hola' });

    await expect(prompts.load('farewell')).rejects.toThrow(
      'There is no prompt file for "farewell"',
    );
    await expect(prompts.load('../secrets')).rejects.toThrow('Invalid prompt name');
  });
});

describe('the prompt files of the AI module', () => {
  const prompts = createPromptLoader();
  const snapAnalysis = [
    'author_note',
    'output_language',
    'snap_tags',
    'space_metadata',
    'taken_at',
    'tool_name',
  ];
  const compose = [
    'instructions',
    'output_language',
    'snap_count',
    'snaps',
    'space_metadata',
    'tool_name',
  ];
  const promptFiles: [name: string, placeholders: string[]][] = [
    ['snap-analysis.study', snapAnalysis],
    ['snap-analysis.work', snapAnalysis],
    ['snap-analysis.content', [...snapAnalysis, 'caption_tone']],
    ['compose.study-notes', compose],
    ['compose.study-summary', compose],
    ['compose.assignment-guide', compose],
    ['compose.work-daily-report', compose],
    ['compose.work-progress-report', [...compose, 'period']],
    ['compose.content-post', [...compose, 'caption_tone', 'default_hashtags']],
    ['compose.content-carousel', [...compose, 'caption_tone', 'default_hashtags']],
    ['retry-invalid-output', ['issues', 'tool_name']],
    ['retry-missing-tool-call', ['tool_name']],
  ];

  it.each(promptFiles)('%s is at version 1 with its placeholders', async (name, placeholders) => {
    const template = await prompts.load(name);

    expect(template.version).toBe(`${name}.v1`);
    expect([...template.placeholders].sort()).toEqual([...placeholders].sort());
  });
});
