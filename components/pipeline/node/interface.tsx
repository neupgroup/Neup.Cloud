'use client';

import { type ReactNode } from 'react';
import { Plus, Trash2, type LucideIcon } from 'lucide-react';
import { Handle, Position } from 'reactflow';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { type PipelineIntelligenceContext } from '@/components/pipeline/node/intelligence.shared';
import { cn } from '@/lib/utils';

export type PipelineNodeKind =
  | 'manualStart'
  | 'webhookTrigger'
  | 'scheduleTrigger'
  | 'http'
  | 'browser'
  | 'aiAgent'
  | 'transform'
  | 'condition'
  | 'delay'
  | 'googleCalendar'
  | 'database'
  | 'end';

export type PipelineNodeStatus = 'idle' | 'running' | 'success' | 'error';

export type PipelineNodeType =
  | 'triggers'
  | 'actions'
  | 'logic'
  | 'integration'
  | 'intelligence';

export type PipelineNodeKeyValueEntry = {
  id: string;
  key: string;
  value: string;
};

export type PipelineSharedNodeData = {
  referenceId: string;
  label: string;
  kind: PipelineNodeKind;
  nodeType: PipelineNodeType;
  category: string;
  description: string;
  summary: string;
  subtitle: string;
  status: PipelineNodeStatus;
  activity: string;
  pending?: boolean;
};

export type PipelineNodeDefinition<TData extends object = object> = {
  kind: PipelineNodeKind;
  type: PipelineNodeType;
  label: string;
  subtitle: string;
  category: string;
  description: string;
  summary: string;
  icon: LucideIcon;
  defaultData?: Partial<TData>;
};

export type PipelineNodeRecord = PipelineSharedNodeData & Record<string, unknown>;

export type PipelineNodeShape<TData extends PipelineNodeRecord = PipelineNodeRecord> = {
  id: string;
  data: TData;
};

export type PipelineNodeInspectorArgs<TData extends PipelineNodeRecord = PipelineNodeRecord> = {
  node: PipelineNodeShape<TData>;
  updateNode: (patch: Partial<TData>) => void;
  updateNodeLabel: (label: string) => void;
  clearWarning: () => void;
  executeNode: () => Promise<void>;
  normalizeKeyValueEntries: (entries?: PipelineNodeKeyValueEntry[]) => PipelineNodeKeyValueEntry[];
  addCollectionEntry: (field: string) => void;
  updateCollectionEntry: (field: string, entryId: string, patch: Partial<PipelineNodeKeyValueEntry>) => void;
  removeCollectionEntry: (field: string, entryId: string) => void;
  intelligence: PipelineIntelligenceContext;
};

export type PipelineNodeModule<TData extends PipelineNodeRecord = PipelineNodeRecord> = {
  definition: PipelineNodeDefinition<TData>;
  getInitialData?: () => Partial<TData>;
  getReferenceFields?: () => string[];
  buildReferenceValue?: (node: PipelineNodeShape<TData>) => Record<string, unknown>;
  renderOptions?: (args: PipelineNodeInspectorArgs<TData>) => ReactNode;
  renderResponse?: (args: PipelineNodeInspectorArgs<TData>) => ReactNode;
};

export function definePipelineNode<TData extends object = object>(
  definition: PipelineNodeDefinition<TData>
): PipelineNodeDefinition<TData> {
  return definition;
}

export function definePipelineNodeModule<TData extends PipelineNodeRecord = PipelineNodeRecord>(
  module: PipelineNodeModule<TData>
): PipelineNodeModule<TData> {
  return module;
}

export const PIPELINE_SHARED_NODE_INFO = {
  identifier: {
    label: 'Identifier',
    description: 'Stable reference used by other nodes and preserved across title refreshes.',
  },
  title: {
    label: 'Title',
    description: 'Primary heading shown for the selected node in the sidebar.',
  },
  type: {
    label: 'Node type',
    description: 'Shared step family such as HTTP Request, AI Agent, or Manual Trigger.',
  },
  name: {
    label: 'Name',
    description: 'Editable node name shown on the canvas and used to build the readable part of the identifier.',
  },
  description: {
    label: 'Description',
    description: 'Short explanation of what this node is responsible for in the workflow.',
  },
} as const;

export function createReferenceBase(label: string): string {
  const normalized = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  return normalized || 'node';
}

export function createNodeReferenceId(label: string, used = new Set<string>()): string {
  const base = createReferenceBase(label);
  let candidate = `${base}_${Math.floor(1000 + Math.random() * 9000)}`;

  while (used.has(candidate)) {
    candidate = `${base}_${Math.floor(1000 + Math.random() * 9000)}`;
  }

  used.add(candidate);
  return candidate;
}

export function extractReferenceSuffix(referenceId: string): string {
  const match = referenceId.match(/_(\d+)$/);
  return match?.[1] ?? `${Math.floor(1000 + Math.random() * 9000)}`;
}

export function rebuildReferenceIdFromLabel(referenceId: string, label: string): string {
  return `${createReferenceBase(label)}_${extractReferenceSuffix(referenceId)}`;
}

export function getNodeTypeLabel(kind: PipelineNodeKind) {
  switch (kind) {
    case 'manualStart':
      return 'Manual Trigger';
    case 'webhookTrigger':
      return 'Webhook Trigger';
    case 'scheduleTrigger':
      return 'Schedule Trigger';
    case 'http':
      return 'HTTP Request';
    case 'browser':
      return 'Browser';
    case 'aiAgent':
      return 'AI Agent';
    case 'transform':
      return 'Transform';
    case 'condition':
      return 'Condition';
    case 'delay':
      return 'Delay';
    case 'googleCalendar':
      return 'Google Calendar';
    case 'database':
      return 'Database';
    case 'end':
      return 'End';
    default:
      return 'Node';
  }
}

export function getNodeType(kind: PipelineNodeKind): PipelineNodeType {
  switch (kind) {
    case 'manualStart':
    case 'webhookTrigger':
    case 'scheduleTrigger':
      return 'triggers';
    case 'http':
    case 'browser':
    case 'database':
      return 'actions';
    case 'transform':
    case 'condition':
    case 'delay':
    case 'end':
      return 'logic';
    case 'googleCalendar':
      return 'integration';
    case 'aiAgent':
      return 'intelligence';
    default:
      return 'actions';
  }
}

export function buildSharedNodeReferenceValue(data: PipelineSharedNodeData, nodeId: string) {
  return {
    id: data.referenceId,
    nodeId,
    title: data.label,
    subtitle: data.subtitle,
    description: data.description,
    summary: data.summary,
    category: data.category,
    kind: data.kind,
    type: data.nodeType,
    nodeType: data.nodeType,
    nodeName: data.label,
    kindLabel: getNodeTypeLabel(data.kind),
    status: data.status,
    activity: data.activity,
  };
}

export function getSharedNodeInspectorInfo(data: PipelineSharedNodeData) {
  return {
    identifier: data.referenceId,
    title: data.label,
    type: data.nodeType,
    kindLabel: getNodeTypeLabel(data.kind),
    name: data.label,
    description: data.description,
  };
}

export function createKeyValueEntry(key = '', value = ''): PipelineNodeKeyValueEntry {
  return {
    id: Math.random().toString(36).slice(2, 10),
    key,
    value,
  };
}

export function normalizePipelineKeyValueEntries(
  entries?: PipelineNodeKeyValueEntry[]
): PipelineNodeKeyValueEntry[] {
  return (entries ?? []).map((entry) => ({
    id: entry.id || Math.random().toString(36).slice(2, 10),
    key: entry.key ?? '',
    value: entry.value ?? '',
  }));
}

type KeyValueListEditorProps = {
  title: string;
  description: string;
  entries: PipelineNodeKeyValueEntry[];
  addLabel: string;
  keyPlaceholder: string;
  valuePlaceholder: string;
  onAdd: () => void;
  onChange: (entryId: string, patch: Partial<PipelineNodeKeyValueEntry>) => void;
  onRemove: (entryId: string) => void;
};

export function KeyValueListEditor({
  title,
  description,
  entries,
  addLabel,
  keyPlaceholder,
  valuePlaceholder,
  onAdd,
  onChange,
  onRemove,
}: KeyValueListEditorProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h4 className="text-sm font-medium text-slate-950">{title}</h4>
          {description ? <p className="text-sm leading-6 text-slate-500">{description}</p> : null}
        </div>
        <Button type="button" variant="outline" className="rounded-2xl border-slate-200 bg-slate-50" onClick={onAdd}>
          <Plus className="mr-2 h-4 w-4" />
          {addLabel}
        </Button>
      </div>

      {entries.length === 0 ? (
        <p className="text-sm text-slate-500">Nothing added yet.</p>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => (
            <div key={entry.id} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_44px] gap-2">
              <Input
                value={entry.key}
                onChange={(event) => onChange(entry.id, { key: event.target.value })}
                placeholder={keyPlaceholder}
                className="rounded-2xl border-slate-200 bg-slate-50"
              />
              <Input
                value={entry.value}
                onChange={(event) => onChange(entry.id, { value: event.target.value })}
                placeholder={valuePlaceholder}
                className="rounded-2xl border-slate-200 bg-slate-50"
              />
              <Button
                type="button"
                variant="outline"
                className="rounded-2xl border-slate-200 bg-slate-50 px-0"
                onClick={() => onRemove(entry.id)}
                aria-label={`Remove ${title.toLowerCase()} entry`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

type PipelineNodeCardProps = {
  selected: boolean;
  title: string;
  subtitle: string;
  typeLabel: string;
  icon: LucideIcon;
  toneClassName: string;
  frameClassName: string;
  statusClassName: string;
};

export function PipelineNodeCard({
  selected,
  title,
  subtitle,
  typeLabel,
  icon: Icon,
  toneClassName,
  frameClassName,
  statusClassName,
}: PipelineNodeCardProps) {
  return (
    <div
      className={cn(
        'group relative w-[256px] rounded-[1.35rem] bg-white shadow-[0_16px_36px_rgba(15,23,42,0.08)] transition-all duration-200',
        selected
          ? 'shadow-[0_18px_40px_rgba(15,23,42,0.12)] ring-2 ring-slate-200/70'
          : frameClassName
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!left-[-7px] !h-3.5 !w-3.5 !border-[3px] !border-white !bg-slate-900"
      />

      <div
        className={cn(
          'overflow-hidden rounded-[1.15rem] border border-slate-300 bg-white',
          selected && 'border-slate-400'
        )}
      >
        <div className={cn('h-1.5 w-full bg-gradient-to-r', toneClassName)} />

        <div className="bg-white">
          <div className="flex items-start gap-3 px-3.5 py-3">
            <div
              className={cn(
                'flex h-11 w-11 shrink-0 items-center justify-center rounded-[0.95rem] bg-gradient-to-br text-white shadow-[0_10px_22px_rgba(15,23,42,0.12)]',
                toneClassName,
                selected && 'shadow-[0_14px_26px_rgba(15,23,42,0.16)]'
              )}
            >
              <Icon className="h-[18px] w-[18px]" />
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                {typeLabel}
              </p>
              <h3 className="truncate pt-0.5 text-[15px] font-semibold tracking-[-0.02em] text-slate-950">
                {title}
              </h3>
              <p className="pt-0.5 text-sm text-slate-500">{subtitle}</p>
            </div>
          </div>

          <div className="border-t border-slate-100 bg-slate-50/70 px-3.5 py-2.5">
            <div
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-medium text-slate-600',
                statusClassName
              )}
            >
              <span className="h-2 w-2 rounded-full bg-current opacity-70" />
              Live
            </div>
          </div>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!right-[-7px] !h-3.5 !w-3.5 !border-[3px] !border-white !bg-slate-900"
      />
    </div>
  );
}

export function PendingBranchAnchor() {
  return (
    <div className="h-4 w-4 rounded-full border-2 border-dashed border-slate-300 bg-white shadow-[0_0_0_6px_rgba(255,255,255,0.92)]" />
  );
}
