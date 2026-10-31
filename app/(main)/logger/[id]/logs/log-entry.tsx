'use client';

import { useRef, useState } from 'react';
import { useId } from 'react';

// Displays a three-line log preview and reveals the full payload on request.
export function LoggerLogEntry({ data, title, loggedOn }: { data: unknown; title: string; loggedOn: string }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const previewId = useId();
  const contentRef = useRef<HTMLPreElement>(null);
  const formattedData = JSON.stringify(data, null, 2);
  const previewHeight = 'calc(3 * 1.5em + 1.5rem)';

  return (
    <article className="grid w-full min-w-0 max-w-full gap-2">
      <button
        type="button"
        className="flex min-w-0 w-full items-center gap-2 text-left text-sm"
        aria-expanded={isExpanded}
        aria-controls={previewId}
        aria-label={isExpanded ? 'Collapse log' : 'Expand log'}
        onClick={() => setIsExpanded((expanded) => !expanded)}
      >
        <span className="shrink-0 font-semibold">{title}</span>
        <time className="min-w-0 flex-1 text-muted-foreground">{loggedOn}</time>
        <span aria-hidden="true" className="shrink-0 text-muted-foreground">
          <span className={`inline-block text-xl leading-none transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}>›</span>
        </span>
      </button>
      <div
        id={previewId}
        className="overflow-hidden rounded bg-muted/30 p-3 transition-[height] duration-300 ease-in-out"
        style={{ height: isExpanded ? contentRef.current?.scrollHeight : previewHeight }}
      >
      <pre
        ref={contentRef}
        style={{
          display: 'block',
          width: '100%',
          maxWidth: '100%',
          minWidth: 0,
          margin: 0,
          whiteSpace: 'pre-wrap',
          overflowWrap: 'anywhere',
          wordBreak: 'break-all',
          font: 'inherit',
        }}
        className="font-mono text-xs leading-[1.5em]"
        aria-live="polite"
      >
        {formattedData}
      </pre>
      </div>
    </article>
  );
}
