'use client';

import { Github } from 'lucide-react';

import { PipelineProviderConnectionCallout } from '@/components/pipeline/node/provider-connection-callout';
import {
  definePipelineNodeModule,
  type PipelineNodeInspectorArgs,
  type PipelineNodeRecord,
} from '@/components/pipeline/node/interface';
import { Input } from '#/components/ui/input';
import { Textarea } from '#/components/ui/textarea';

type GithubNodeData = PipelineNodeRecord & {
  githubConnectionLabel?: string;
  githubOwner?: string;
  githubRepository?: string;
  githubEvent?: 'pull_request' | 'issues' | 'push';
  githubOperation?: string;
  githubInstruction?: string;
};

function GithubNodeOptions({ node, updateNode }: PipelineNodeInspectorArgs<GithubNodeData>) {
  return (
    <section className="space-y-5 px-1">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold text-slate-950">Node options</h3>
        <p className="text-sm leading-6 text-slate-500">
          This sample node anchors GitHub setup and gives the canvas a repo-aware placeholder.
        </p>
      </div>

      <PipelineProviderConnectionCallout provider="github" href="/pipeline/node/github/index" />

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Connection label</label>
          <Input
            value={node.data.githubConnectionLabel ?? ''}
            onChange={(event) => updateNode({ githubConnectionLabel: event.target.value })}
            placeholder="Product engineering GitHub"
            className="rounded-2xl border-slate-200 bg-slate-50"
          />
        </div>

        <div className="space-y-2">
          <label className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Event</label>
          <select
            value={node.data.githubEvent ?? 'pull_request'}
            onChange={(event) => updateNode({ githubEvent: event.target.value as GithubNodeData['githubEvent'] })}
            className="flex h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-950 outline-none"
          >
            <option value="pull_request">Pull request</option>
            <option value="issues">Issue</option>
            <option value="push">Push</option>
          </select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Owner</label>
          <Input
            value={node.data.githubOwner ?? ''}
            onChange={(event) => updateNode({ githubOwner: event.target.value })}
            placeholder="neupgroup"
            className="rounded-2xl border-slate-200 bg-slate-50"
          />
        </div>

        <div className="space-y-2">
          <label className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Repository</label>
          <Input
            value={node.data.githubRepository ?? ''}
            onChange={(event) => updateNode({ githubRepository: event.target.value })}
            placeholder="neup.cloud"
            className="rounded-2xl border-slate-200 bg-slate-50"
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Operation</label>
          <Input
            value={node.data.githubOperation ?? ''}
            onChange={(event) => updateNode({ githubOperation: event.target.value })}
            placeholder="summarize_pr"
            className="rounded-2xl border-slate-200 bg-slate-50"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Instruction</label>
        <Textarea
          value={node.data.githubInstruction ?? ''}
          onChange={(event) => updateNode({ githubInstruction: event.target.value })}
          placeholder="Summarize the pull request and post a digest to Slack."
          className="min-h-[120px] rounded-2xl border-slate-200 bg-slate-50 font-mono text-sm"
        />
      </div>
    </section>
  );
}

function GithubNodeResponse({ node }: PipelineNodeInspectorArgs<GithubNodeData>) {
  const payload = JSON.stringify(
    {
      provider: 'github',
      connection: node.data.githubConnectionLabel ?? '',
      owner: node.data.githubOwner ?? '',
      repository: node.data.githubRepository ?? '',
      event: node.data.githubEvent ?? 'pull_request',
      operation: node.data.githubOperation ?? '',
      instruction: node.data.githubInstruction ?? '',
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

export const githubNodeModule = definePipelineNodeModule<GithubNodeData>({
  definition: {
    kind: 'github',
    type: 'integration',
    label: 'GitHub',
    subtitle: 'Sample integration',
    category: 'Integration',
    description: 'Sample GitHub provider node that centralizes repo setup in the editor.',
    summary: 'Use it as the starting point for repo-aware workflows before deeper GitHub automation lands.',
    icon: Github,
  },
  getInitialData: () => ({
    githubConnectionLabel: 'Product engineering GitHub',
    githubOwner: '',
    githubRepository: '',
    githubEvent: 'pull_request',
    githubOperation: 'summarize_pr',
    githubInstruction: '',
  }),
  getReferenceFields: () => ['connection', 'owner', 'repository', 'event', 'operation', 'instruction', 'request'],
  buildReferenceValue: (node) => ({
    connection: node.data.githubConnectionLabel ?? '',
    owner: node.data.githubOwner ?? '',
    repository: node.data.githubRepository ?? '',
    event: node.data.githubEvent ?? 'pull_request',
    operation: node.data.githubOperation ?? '',
    instruction: node.data.githubInstruction ?? '',
    request: {
      provider: 'github',
      owner: node.data.githubOwner ?? '',
      repository: node.data.githubRepository ?? '',
      event: node.data.githubEvent ?? 'pull_request',
      operation: node.data.githubOperation ?? '',
      instruction: node.data.githubInstruction ?? '',
    },
  }),
  renderOptions: (args) => <GithubNodeOptions {...args} />,
  renderResponse: (args) => <GithubNodeResponse {...args} />,
});
