import PDFDocument from 'pdfkit';

/*
 * A small Markdown to PDF renderer for Document exports: headings, paragraphs, bullet and
 * numbered lists, quotes, code blocks, tables (as text rows) and **bold**. Formulas stay as
 * LaTeX text. Every page gets a footer with the given text and the page number.
 */

/** Layout of the exported pages (points; 72 points are one inch). */
const STYLE = {
  margin: 56,
  titleSize: 22,
  headingSizes: [18, 15, 13, 12, 11, 11],
  bodySize: 11,
  codeSize: 9.5,
  footerSize: 8,
  listIndent: 16,
  quoteIndent: 14,
  paragraphGap: 6,
  footerGap: 20,
  textColor: '#1f2328',
  mutedColor: '#57606a',
} as const;

const FONTS = {
  regular: 'Helvetica',
  bold: 'Helvetica-Bold',
  italic: 'Helvetica-Oblique',
  code: 'Courier',
};

type Block =
  | { kind: 'heading'; level: number; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'listItem'; marker: string; depth: number; text: string }
  | { kind: 'quote'; text: string }
  | { kind: 'code'; text: string }
  | { kind: 'rule' };

const HEADING = /^(#{1,6})\s+(.*)$/;
const BULLET = /^(\s*)[-*+]\s+(.*)$/;
const NUMBERED = /^(\s*)(\d+[.)])\s+(.*)$/;
const QUOTE = /^>\s?(.*)$/;
const FENCE = /^```/;
const TABLE_SEPARATOR = /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?$/;
const RULE = /^(-{3,}|\*{3,}|_{3,})$/;

/** Markdown blocks, line by line. */
function parseBlocks(markdown: string): Block[] {
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let code: string[] | null = null;

  const flushParagraph = () => {
    if (paragraph.length > 0) blocks.push({ kind: 'paragraph', text: paragraph.join(' ') });
    paragraph = [];
  };

  for (const rawLine of markdown.split(/\r?\n/)) {
    if (code !== null) {
      if (FENCE.test(rawLine.trim())) {
        blocks.push({ kind: 'code', text: code.join('\n') });
        code = null;
      } else {
        code.push(rawLine);
      }
      continue;
    }
    const line = rawLine.trim();
    const heading = HEADING.exec(line);
    const bullet = BULLET.exec(rawLine);
    const numbered = NUMBERED.exec(rawLine);
    const quote = QUOTE.exec(line);

    if (FENCE.test(line)) {
      flushParagraph();
      code = [];
    } else if (line === '') {
      flushParagraph();
    } else if (heading) {
      flushParagraph();
      blocks.push({ kind: 'heading', level: heading[1]?.length ?? 1, text: heading[2] ?? '' });
    } else if (RULE.test(line)) {
      flushParagraph();
      blocks.push({ kind: 'rule' });
    } else if (bullet) {
      flushParagraph();
      const depth = Math.floor((bullet[1]?.length ?? 0) / 2);
      blocks.push({ kind: 'listItem', marker: '•', depth, text: bullet[2] ?? '' });
    } else if (numbered) {
      flushParagraph();
      const depth = Math.floor((numbered[1]?.length ?? 0) / 2);
      blocks.push({ kind: 'listItem', marker: numbered[2] ?? '', depth, text: numbered[3] ?? '' });
    } else if (quote) {
      flushParagraph();
      blocks.push({ kind: 'quote', text: quote[1] ?? '' });
    } else if (line.startsWith('|')) {
      flushParagraph();
      if (!TABLE_SEPARATOR.test(line)) {
        const cells = line
          .replace(/^\||\|$/g, '')
          .split('|')
          .map((cell) => cell.trim());
        blocks.push({ kind: 'paragraph', text: cells.join('   |   ') });
      }
    } else {
      paragraph.push(line);
    }
  }
  flushParagraph();
  if (code !== null) blocks.push({ kind: 'code', text: code.join('\n') });
  return blocks;
}

/** Text with **bold** parts; links become "text (url)" and inline code loses its backticks. */
function inlineSegments(text: string): { text: string; bold: boolean }[] {
  const plain = text
    .replace(/!?\[([^\]]*)\]\(([^)]+)\)/g, '$1 ($2)')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1$2')
    .replace(/(^|\W)_([^_\s][^_]*)_(?=\W|$)/g, '$1$2');
  return plain
    .split(/(\*\*[^*]+\*\*)/g)
    .filter((part) => part !== '')
    .map((part) =>
      part.startsWith('**') && part.endsWith('**') && part.length > 4
        ? { text: part.slice(2, -2), bold: true }
        : { text: part, bold: false },
    );
}

function writeInline(
  doc: PDFKit.PDFDocument,
  text: string,
  options: { regular: string; size: number; indent?: number; width?: number },
): void {
  const segments = inlineSegments(text);
  segments.forEach((segment, index) => {
    doc
      .font(segment.bold ? FONTS.bold : options.regular)
      .fontSize(options.size)
      .text(segment.text, {
        continued: index < segments.length - 1,
        ...(options.indent === undefined ? {} : { indent: options.indent }),
        ...(options.width === undefined ? {} : { width: options.width }),
      });
  });
  if (segments.length === 0) doc.text('');
}

function renderBlock(doc: PDFKit.PDFDocument, block: Block, contentWidth: number): void {
  const left = doc.page.margins.left;
  doc.fillColor(STYLE.textColor);
  switch (block.kind) {
    case 'heading':
      doc.moveDown(0.6);
      writeInline(doc, block.text, {
        regular: FONTS.bold,
        size: STYLE.headingSizes[block.level - 1] ?? STYLE.bodySize,
      });
      doc.moveDown(0.3);
      break;
    case 'paragraph':
      writeInline(doc, block.text, { regular: FONTS.regular, size: STYLE.bodySize });
      doc.moveDown(STYLE.paragraphGap / STYLE.bodySize);
      break;
    case 'listItem': {
      const indent = STYLE.listIndent * (block.depth + 1);
      doc.x = left + indent;
      writeInline(doc, `${block.marker} ${block.text}`, {
        regular: FONTS.regular,
        size: STYLE.bodySize,
        width: contentWidth - indent,
      });
      doc.x = left;
      break;
    }
    case 'quote':
      doc.x = left + STYLE.quoteIndent;
      doc.fillColor(STYLE.mutedColor);
      writeInline(doc, block.text, {
        regular: FONTS.italic,
        size: STYLE.bodySize,
        width: contentWidth - STYLE.quoteIndent,
      });
      doc.x = left;
      doc.moveDown(STYLE.paragraphGap / STYLE.bodySize);
      break;
    case 'code':
      doc.font(FONTS.code).fontSize(STYLE.codeSize).text(block.text);
      doc.moveDown(STYLE.paragraphGap / STYLE.bodySize);
      break;
    case 'rule':
      doc.moveDown(0.5);
      break;
  }
}

export interface MarkdownPdfOptions {
  title: string;
  /** Written at the bottom of every page, before the page number. */
  footer: string;
}

/** Renders Markdown as an A4 PDF. */
export function renderMarkdownPdf(
  markdown: string,
  { title, footer }: MarkdownPdfOptions,
): Promise<Buffer> {
  const doc = new PDFDocument({
    size: 'A4',
    margin: STYLE.margin,
    bufferPages: true,
    info: { Title: title, Creator: footer, Producer: footer },
  });
  const chunks: Buffer[] = [];
  const finished = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => {
      resolve(Buffer.concat(chunks));
    });
    doc.on('error', reject);
  });

  const contentWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  doc.fillColor(STYLE.textColor).font(FONTS.bold).fontSize(STYLE.titleSize).text(title);
  doc.moveDown(0.8);
  for (const block of parseBlocks(markdown)) renderBlock(doc, block, contentWidth);

  const pages = doc.bufferedPageRange();
  for (let index = pages.start; index < pages.start + pages.count; index += 1) {
    doc.switchToPage(index);
    const { bottom } = doc.page.margins;
    // Writing inside the bottom margin would open a new page; the margin is lifted meanwhile.
    doc.page.margins.bottom = 0;
    doc
      .font(FONTS.regular)
      .fontSize(STYLE.footerSize)
      .fillColor(STYLE.mutedColor)
      .text(
        `${footer} · ${String(index + 1)}/${String(pages.count)}`,
        doc.page.margins.left,
        doc.page.height - bottom + STYLE.footerGap,
        { width: contentWidth, align: 'center', lineBreak: false },
      );
    doc.page.margins.bottom = bottom;
  }
  doc.end();
  return finished;
}
