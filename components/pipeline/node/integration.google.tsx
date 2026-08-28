'use client';

import { Chrome } from 'lucide-react';

import { PipelineProviderConnectionCallout } from '@/components/pipeline/node/provider-connection-callout';
import {
  definePipelineNodeModule,
  type PipelineNodeInspectorArgs,
  type PipelineNodeRecord,
} from '@/components/pipeline/node/interface';
import { Input } from '@/component/ui/input';
import { Textarea } from '@/component/ui/textarea';

type GoogleNodeData = PipelineNodeRecord & {
  googleConnectionLabel?: string;
  googleProduct?: 'calendar' | 'sheets' | 'gmail' | 'drive';
  googleOperation?: string;
  googleResourceId?: string;
  googleInstruction?: string;
};

function GoogleNodeOptions({ node, updateNode }: PipelineNodeInspectorArgs<GoogleNodeData>) {
  return (
    <section className="space-y-5 px-1">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold text-slate-950">Node options</h3>
        <p className="text-sm leading-6 text-slate-500">
          This is a sample Google integration node that points to the shared Google setup page.
        </p>
      </div>

      <PipelineProviderConnectionCallout provider="google" href="/pipeline/node/google/index" />

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Connection label</label>
          <Input
            value={node.data.googleConnectionLabel ?? ''}
            onChange={(event) => updateNode({ googleConnectionLabel: event.target.value })}
            placeholder="Ops Google workspace"
            className="rounded-2xl border-slate-200 bg-slate-50"
          />
        </div>

        <div className="space-y-2">
          <label className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Product</label>
          <select
            value={node.data.googleProduct ?? 'calendar'}
            onChange={(event) => updateNode({ googleProduct: event.target.value as GoogleNodeData['googleProduct'] })}
            className="flex h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-950 outline-none"
          >
            <option value="calendar">Calendar</option>
            <option value="sheets">Sheets</option>
            <option value="gmail">Gmail</option>
            <option value="drive">Drive</option>
          </select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Operation</label>
          <Input
            value={node.data.googleOperation ?? ''}
            onChange={(event) => updateNode({ googleOperation: event.target.value })}
            placeholder="create_event"
            className="rounded-2xl border-slate-200 bg-slate-50"
          />
        </div>

        <div className="space-y-2">
          <label className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Resource ID</label>
          <Input
            value={node.data.googleResourceId ?? ''}
            onChange={(event) => updateNode({ googleResourceId: event.target.value })}
            placeholder="primary"
            className="rounded-2xl border-slate-200 bg-slate-50"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Instruction</label>
        <Textarea
          value={node.data.googleInstruction ?? ''}
          onChange={(event) => updateNode({ googleInstruction: event.target.value })}
          placeholder="Create a follow-up event for qualified leads."
          className="min-h-[120px] rounded-2xl border-slate-200 bg-slate-50 font-mono text-sm"
        />
      </div>
    </section>
  );
}

function GoogleNodeResponse({ node }: PipelineNodeInspectorArgs<GoogleNodeData>) {
  const payload = JSON.stringify(
    {
      provider: 'google',
      connection: node.data.googleConnectionLabel ?? '',
      product: node.data.googleProduct ?? 'calendar',
      operation: node.data.googleOperation ?? '',
      resourceId: node.data.googleResourceId ?? '',
      instruction: node.data.googleInstruction ?? '',
    },
    null,
    2
  );

  return (
    <section className="space-y-4 px-1">
      <h3 className="text-lg font-semibold text-slate-950">Request preview</h3>
      <div className="rounded-[1.4rem] border border-slate-200 bg-slate-950 p-4">
        <pre className="overflow-x-auto whitespace-pre-wrap text-xs leading-6 text-slate-200">{payload}</pre>
      </div>
    </section>
  );
}

export const googleNodeModule = definePipelineNodeModule<GoogleNodeData>({
  definition: {
    kind: 'google',
    type: 'integration',
    label: 'Google',
    subtitle: 'Sample integration',
    category: 'Integration',
    description: 'Sample Google provider node that links to the shared Google connection page.',
    summary: 'Use it as a placeholder for calendar, sheets, drive, or Gmail automations.',
    icon: Chrome,
  },
  getInitialData: () => ({
    googleConnectionLabel: 'Ops Google workspace',
    googleProduct: 'calendar',
    googleOperation: 'create_event',
    googleResourceId: 'primary',
    googleInstruction: '',
  }),
  getReferenceFields: () => ['connection', 'product', 'operation', 'resourceId', 'instruction', 'request'],
  buildReferenceValue: (node) => ({
    connection: node.data.googleConnectionLabel ?? '',
    product: node.data.googleProduct ?? 'calendar',
    operation: node.data.googleOperation ?? '',
    resourceId: node.data.googleResourceId ?? '',
    instruction: node.data.googleInstruction ?? '',
    request: {
      provider: 'google',
      product: node.data.googleProduct ?? 'calendar',
      operation: node.data.googleOperation ?? '',
      resourceId: node.data.googleResourceId ?? '',
      instruction: node.data.googleInstruction ?? '',
    },
  }),
  renderOptions: (args) => <GoogleNodeOptions {...args} />,
  renderResponse: (args) => <GoogleNodeResponse {...args} />,
});
