import { describe, expect, it } from 'vitest';
import { exportDocument, exportFileName } from './document-export';

const options = {
  assignmentNotice: 'Escribe el trabajo con tus palabras.',
  appName: 'Snapia Test',
};
const notes = {
  title: 'Apuntes: Cálculo II',
  type: 'STUDY_NOTES' as const,
  contentMarkdown: '## Derivadas\n\n- **Regla de la cadena** [Snap 1]',
};

describe('document export', () => {
  it('names the file after the title, in ASCII', () => {
    expect(exportFileName('Apuntes: Cálculo II (2026-1)', 'pdf')).toBe(
      'apuntes-calculo-ii-2026-1.pdf',
    );
    expect(exportFileName('¿¡!?', 'md')).toBe('document.md');
  });

  it('exports Markdown with the title on top', async () => {
    const file = await exportDocument(notes, { ...options, format: 'md' });

    expect(file).toMatchObject({
      fileName: 'apuntes-calculo-ii.md',
      contentType: 'text/markdown; charset=utf-8',
    });
    expect(file.body.toString('utf8')).toBe(
      '# Apuntes: Cálculo II\n\n## Derivadas\n\n- **Regla de la cadena** [Snap 1]\n',
    );
  });

  it('always opens an ASSIGNMENT_GUIDE with the notice, once', async () => {
    const guide = { ...notes, type: 'ASSIGNMENT_GUIDE' as const };

    const withoutNotice = await exportDocument(guide, { ...options, format: 'md' });
    const withNotice = await exportDocument(
      { ...guide, contentMarkdown: `> ${options.assignmentNotice}\n\n## Esquema` },
      { ...options, format: 'md' },
    );

    expect(withoutNotice.body.toString('utf8')).toContain(
      `# Apuntes: Cálculo II\n\n> ${options.assignmentNotice}\n\n## Derivadas`,
    );
    expect(withNotice.body.toString('utf8').split(options.assignmentNotice)).toHaveLength(2);
  });

  it('exports a PDF that is not empty, with the app name as its creator', async () => {
    const long = Array.from(
      { length: 120 },
      (_, index) => `- Punto ${String(index)} con **negrita** y $x^2$`,
    ).join('\n');

    const file = await exportDocument(
      {
        ...notes,
        contentMarkdown: `${notes.contentMarkdown}\n\n> Cita\n\n\`\`\`\ncódigo\n\`\`\`\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n${long}`,
      },
      { ...options, format: 'pdf' },
    );

    expect(file).toMatchObject({
      fileName: 'apuntes-calculo-ii.pdf',
      contentType: 'application/pdf',
    });
    expect(file.body.subarray(0, 5).toString()).toBe('%PDF-');
    expect(file.body.toString('latin1').trimEnd().endsWith('%%EOF')).toBe(true);
    expect(file.body.length).toBeGreaterThan(2000);
    expect(file.body.includes('(Snapia Test)')).toBe(true);
    // Long content takes several pages (each one gets the footer).
    expect(file.body.toString('latin1').match(/\/Type \/Page\b/g)?.length).toBeGreaterThan(1);
  });
});
