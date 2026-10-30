'use client';

import { useState } from 'react';
import { Button } from '@neup/components/ui/button';

// Displays a three-line log preview and reveals the full payload on request.
export function LoggerLogEntry({ data }: { data: unknown }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const formattedData = JSON.stringify(data, null, 2);

  return (
    <div className="grid w-full min-w-0 max-w-full gap-2 overflow-hidden rounded bg-muted/30 p-3">
      <pre
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
        className={`font-mono text-xs ${isExpanded ? '' : 'line-clamp-3'}`}
        aria-live="polite"
      >
        {formattedData}
      </pre>
      <Button
        htmlType="button"
        variant="plain"
        size="sm"
        className="w-fit px-0 text-xs"
        aria-expanded={isExpanded}
        onClick={() => setIsExpanded((expanded) => !expanded)}
      >
        {isExpanded ? 'Show less' : 'Show full log'}
      </Button>
    </div>
  );
}
