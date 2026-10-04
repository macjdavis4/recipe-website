import Markdown, { type Components } from "react-markdown";

const components: Components = {
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className="text-primary underline underline-offset-4"
    >
      {children}
    </a>
  ),
  p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="mb-3 list-disc pl-5 last:mb-0">{children}</ul>,
  ol: ({ children }) => <ol className="mb-3 list-decimal pl-5 last:mb-0">{children}</ol>,
  li: ({ children }) => <li className="mb-1">{children}</li>,
  h1: ({ children }) => <p className="mb-2 font-semibold">{children}</p>,
  h2: ({ children }) => <p className="mb-2 font-semibold">{children}</p>,
  h3: ({ children }) => <p className="mb-2 font-semibold">{children}</p>,
  code: ({ children }) => <code className="rounded bg-muted px-1 py-0.5 text-sm">{children}</code>,
  pre: ({ children }) => (
    <pre className="mb-3 overflow-x-auto rounded bg-muted p-3 text-sm">{children}</pre>
  ),
};

/**
 * Renders untrusted AI text (CLAUDE.md rule 6). Raw HTML is skipped, images
 * are dropped, and react-markdown's URL sanitizer removes javascript: links.
 * Headings are flattened so AI text cannot add to the page outline.
 */
export function AiMarkdown({ children }: { children: string }) {
  return (
    <Markdown skipHtml disallowedElements={["img"]} unwrapDisallowed components={components}>
      {children}
    </Markdown>
  );
}
