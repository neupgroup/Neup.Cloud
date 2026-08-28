'use client';

import { Linkedin } from 'lucide-react';

import { PipelineProviderConnectionCallout } from '@/components/pipeline/node/provider-connection-callout';
import {
  definePipelineNodeModule,
  type PipelineNodeInspectorArgs,
  type PipelineNodeRecord,
} from '@/components/pipeline/node/interface';
import { Input } from '#/components/ui/input';
import { Textarea } from '#/components/ui/textarea';

type LinkedinNodeData = PipelineNodeRecord & {
  linkedinConnectionLabel?: string;
  linkedinAccountType?: 'person' | 'organization';
  linkedinProfileId?: string;
  linkedinAudience?: 'public' | 'connections';
  linkedinPostText?: string;
};

function LinkedinNodeOptions({ node, updateNode }: PipelineNodeInspectorArgs<LinkedinNodeData>) {
  return (
    <section className="space-y-5 px-1">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold text-slate-950">Node options</h3>
        <p className="text-sm leading-6 text-slate-500">
          This sample LinkedIn node keeps the connection flow consistent with the rest of the pipeline providers.
        </p>
      </div>

      <PipelineProviderConnectionCallout provider="linkedin" href="/pipeline/node/linkedin/index" />

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Connection label</label>
          <Input
            value={node.data.linkedinConnectionLabel ?? ''}
            onChange={(event) => updateNode({ linkedinConnectionLabel: event.target.value })}
            placeholder="Brand LinkedIn account"
            className="rounded-2xl border-slate-200 bg-slate-50"
          />
        </div>

        <div className="space-y-2">
          <label className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Account type</label>
          <select
            value={node.data.linkedinAccountType ?? 'organization'}
            onChange={(event) => updateNode({ linkedinAccountType: event.target.value as LinkedinNodeData['linkedinAccountType'] })}
            className="flex h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-950 outline-none"
          >
            <option value="organization">Organization</option>
            <option value="person">Person</option>
          </select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Profile ID</label>
          <Input
            value={node.data.linkedinProfileId ?? ''}
            onChange={(event) => updateNode({ linkedinProfileId: event.target.value })}
            placeholder="urn:li:organization:123456"
            className="rounded-2xl border-slate-200 bg-slate-50"
          />
        </div>

        <div className="space-y-2">
          <label className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Audience</label>
          <select
            value={node.data.linkedinAudience ?? 'public'}
            onChange={(event) => updateNode({ linkedinAudience: event.target.value as LinkedinNodeData['linkedinAudience'] })}
            className="flex h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-950 outline-none"
          >
            <option value="public">Public</option>
            <option value="connections">Connections</option>
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Post text</label>
        <Textarea
          value={node.data.linkedinPostText ?? ''}
          onChange={(event) => updateNode({ linkedinPostText: event.target.value })}
          placeholder="Launching our new WhatsApp automation pipeline today."
          className="min-h-[120px] rounded-2xl border-slate-200 bg-slate-50 font-mono text-sm"
        />
      </div>
    </section>
  );
}

function LinkedinNodeResponse({ node }: PipelineNodeInspectorArgs<LinkedinNodeData>) {
  const payload = JSON.stringify(
    {
      provider: 'linkedin',
      connection: node.data.linkedinConnectionLabel ?? '',
      accountType: node.data.linkedinAccountType ?? 'organization',
      profileId: node.data.linkedinProfileId ?? '',
      audience: node.data.linkedinAudience ?? 'public',
      postText: node.data.linkedinPostText ?? '',
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

export const linkedinNodeModule = definePipelineNodeModule<LinkedinNodeData>({
  definition: {
    kind: 'linkedin',
    type: 'integration',
    label: 'LinkedIn',
    subtitle: 'Sample integration',
    category: 'Integration',
    description: 'Sample LinkedIn provider node for organization or personal publishing flows.',
    summary: 'Use it to model social distribution steps while keeping connection setup close by.',
    icon: Linkedin,
  },
  getInitialData: () => ({
    linkedinConnectionLabel: 'Brand LinkedIn account',
    linkedinAccountType: 'organization',
    linkedinProfileId: '',
    linkedinAudience: 'public',
    linkedinPostText: '',
  }),
  getReferenceFields: () => ['connection', 'accountType', 'profileId', 'audience', 'postText', 'request'],
  buildReferenceValue: (node) => ({
    connection: node.data.linkedinConnectionLabel ?? '',
    accountType: node.data.linkedinAccountType ?? 'organization',
    profileId: node.data.linkedinProfileId ?? '',
    audience: node.data.linkedinAudience ?? 'public',
    postText: node.data.linkedinPostText ?? '',
    request: {
      provider: 'linkedin',
      accountType: node.data.linkedinAccountType ?? 'organization',
      profileId: node.data.linkedinProfileId ?? '',
      audience: node.data.linkedinAudience ?? 'public',
      postText: node.data.linkedinPostText ?? '',
    },
  }),
  renderOptions: (args) => <LinkedinNodeOptions {...args} />,
  renderResponse: (args) => <LinkedinNodeResponse {...args} />,
});
