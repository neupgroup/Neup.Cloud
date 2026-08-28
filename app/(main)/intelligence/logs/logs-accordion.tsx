'use client';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '#/components/ui/accordion';
import { Card, CardContent } from '#/components/ui/card';
import { cn } from '#/core/utils';

interface LogViewModel {
  id: number;
  accountId: string;
  accessId: string;
  model: string | null;
  currency: string | null;
  cost: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  query: string;
  guider: string;
  context: string;
  response: string;
}

export default function LogsAccordion({ logs }: { logs: LogViewModel[] }) {
  const renderHintBox = (hint: string, value: string) => (
    <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-3 text-sm whitespace-pre-wrap text-muted-foreground">
      <span className="mr-2 text-xs uppercase tracking-wide text-muted-foreground/70">{hint}</span>
      {value}
    </div>
  );

  return (
    <Accordion type="single" collapsible className="w-full space-y-4">
      {logs.map((log) => (
        <AccordionItem key={log.id} value={String(log.id)} className="border-0">
          <Card className="overflow-hidden border border-border/70 bg-card py-2 transition-colors duration-200 hover:border-primary/30">
            <AccordionTrigger className="px-5 py-4 hover:no-underline">
              <div className="grid w-full gap-4 text-left">
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                  <span><span className="font-medium text-foreground">account_id:</span> {log.accountId}</span>
                  <span><span className="font-medium text-foreground">access_id:</span> {log.accessId}</span>
                  {log.model && <span><span className="font-medium text-foreground">model:</span> {log.model}</span>}
                  {log.currency && log.cost !== null && (
                    <span><span className="font-medium text-foreground">cost:</span> {log.cost.toFixed(8)} {log.currency}</span>
                  )}
                  {log.inputTokens !== null && <span><span className="font-medium text-foreground">input token:</span> {log.inputTokens}</span>}
                  {log.outputTokens !== null && <span><span className="font-medium text-foreground">output token:</span> {log.outputTokens}</span>}
                </div>
                <div className="grid gap-2">
                  {log.query ? (
                    renderHintBox('query', log.query)
                  ) : (
                    <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-3 text-sm text-muted-foreground">
                      No query stored
                    </div>
                  )}
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="border-t border-border/70 px-5 pb-5 pt-4">
              <CardContent className="grid gap-4 p-0 md:grid-cols-2">
                {log.guider && (
                  <div className="space-y-2">
                    {renderHintBox('guider', log.guider)}
                  </div>
                )}
                {log.context && (
                  <div className="space-y-2">
                    {renderHintBox('context', log.context)}
                  </div>
                )}
                {log.response && (
                  <div className={cn('space-y-2', (log.guider || log.context) && 'md:col-span-2')}>
                    {renderHintBox('response', log.response)}
                  </div>
                )}
              </CardContent>
            </AccordionContent>
          </Card>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
