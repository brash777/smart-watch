import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';

/*
 * Markdown written by the AI or by the person (insights and Documents). Raw HTML is never
 * rendered. Formulas stay as LaTeX text, like in the PDF export.
 */

const components: Components = {
  h1: ({ children }) => <h3 className="font-display text-xl font-bold">{children}</h3>,
  h2: ({ children }) => <h4 className="font-display text-lg font-bold">{children}</h4>,
  h3: ({ children }) => <h5 className="font-semibold">{children}</h5>,
  ul: ({ children }) => <ul className="ml-5 list-disc space-y-1">{children}</ul>,
  ol: ({ children }) => <ol className="ml-5 list-decimal space-y-1">{children}</ol>,
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-line pl-3 text-muted">{children}</blockquote>
  ),
  pre: ({ children }) => (
    <pre className="overflow-x-auto rounded-control bg-line/50 p-3 text-sm">{children}</pre>
  ),
  code: ({ children }) => (
    <code className="rounded-control bg-line/50 px-1 text-sm">{children}</code>
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="border border-line px-2 py-1 text-left">{children}</th>,
  td: ({ children }) => <td className="border border-line px-2 py-1">{children}</td>,
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="underline">
      {children}
    </a>
  ),
};

export function Markdown({ children }: { children: string }) {
  return (
    <div className="flex flex-col gap-3 leading-relaxed break-words">
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
