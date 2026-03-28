'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  Background,
  Controls,
  Handle,
  MarkerType,
  PanOnScrollMode,
  Position,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
  type NodeTypes,
  useReactFlow,
} from 'reactflow';
import 'reactflow/dist/style.css';
import {
  ArrowLeft,
  Bot,
  Calendar,
  Check,
  CircleSlash,
  Clock3,
  Copy,
  GitBranch,
  Globe,
  LayoutGrid,
  Loader2,
  Play,
  Plus,
  RefreshCcw,
  Save,
  Search,
  ShieldCheck,
  Sparkles,
  Square,
  SquareTerminal,
  TerminalSquare,
  Timer,
  Trash2,
  TriangleAlert,
  Webhook,
  Workflow,
  Zap,
  type LucideIcon,
} from 'lucide-react';

import {
  executePipelineAiAgentAction,
  type PipelineAiAgentExecutionInput,
} from '@/app/pipeline/actions';
import { Logo } from '@/components/logo';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

type PipelineNodeKind =
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

type PipelineNodeStatus = 'idle' | 'running' | 'success' | 'error';

type PipelineNodeData = {
  referenceId: string;
  label: string;
  kind: PipelineNodeKind;
  category: string;
  description: string;
  summary: string;
  subtitle: string;
  status: PipelineNodeStatus;
  activity: string;
  intelligencePromptMode?: 'existing' | 'new';
  intelligencePromptId?: string;
  intelligencePrimaryModelId?: number | null;
  intelligenceFallbackModelId?: number | null;
  intelligencePrimaryAccessKey?: number | null;
  intelligenceFallbackAccessKey?: number | null;
  intelligenceMaxTokens?: number | null;
  intelligenceMasterPrompt?: string;
  intelligencePrompt?: string;
  intelligenceContext?: string;
  intelligenceLastResponse?: string;
  intelligenceLastModel?: string;
  intelligenceLastRenderedPrompt?: string;
  intelligenceWarning?: string;
  pending?: boolean;
};

type PipelineFlowNode = Node<PipelineNodeData>;

type PendingConnectionDraft = {
  parentId: string;
  placeholderId: string;
  position: { x: number; y: number };
};

type NodeTemplate = {
  kind: PipelineNodeKind;
  label: string;
  subtitle: string;
  category: string;
  description: string;
  summary: string;
  icon: LucideIcon;
};

type NodeCategory = {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  templates: NodeTemplate[];
};

type IntelligenceModelOption = {
  id: number;
  title: string;
  provider: string;
  model: string;
};

type IntelligencePromptOption = {
  id: number;
  promptId: string;
  primaryModelId: number | null;
  fallbackModelId: number | null;
  primaryAccessKey: number | null;
  fallbackAccessKey: number | null;
  maxTokens: number | null;
  defPrompt: string | null;
};

type IntelligenceTokenOption = {
  id: number;
  name: string;
};

type PipelineEditorProps = {
  intelligenceModels: IntelligenceModelOption[];
  intelligencePrompts: IntelligencePromptOption[];
  intelligenceTokens: IntelligenceTokenOption[];
};

const STORAGE_KEY = 'neup-cloud-pipeline-editor-v2';

const nodeCategories: NodeCategory[] = [
  {
    id: 'triggers',
    label: 'Triggers',
    description: 'Start a flow manually, on schedule, or from incoming events.',
    icon: Play,
    templates: [
      {
        kind: 'manualStart',
        label: 'Manual Start',
        subtitle: 'Run from dashboard',
        category: 'Triggers',
        description: 'Launch the pipeline on demand from the editor or a control surface.',
        summary: 'Good for draft flows and operator-driven actions.',
        icon: Play,
      },
      {
        kind: 'webhookTrigger',
        label: 'Webhook',
        subtitle: 'HTTP event',
        category: 'Triggers',
        description: 'Receive data from external services over an incoming HTTP request.',
        summary: 'Useful for lead capture, Git events, and custom automations.',
        icon: Webhook,
      },
      {
        kind: 'scheduleTrigger',
        label: 'Schedule',
        subtitle: 'Time-based',
        category: 'Triggers',
        description: 'Run this workflow on a recurring schedule.',
        summary: 'Great for daily digests, sync jobs, and periodic checks.',
        icon: Clock3,
      },
    ],
  },
  {
    id: 'actions',
    label: 'Actions',
    description: 'Execute API calls, browser work, AI tasks, and storage steps.',
    icon: Zap,
    templates: [
      {
        kind: 'http',
        label: 'HTTP Request',
        subtitle: 'External API',
        category: 'Actions',
        description: 'Call a service, webhook, or private API endpoint.',
        summary: 'Use it to fetch data, post payloads, or trigger downstream systems.',
        icon: Globe,
      },
      {
        kind: 'browser',
        label: 'Browser',
        subtitle: 'Visual automation',
        category: 'Actions',
        description: 'Automate a browser task such as loading a page or submitting a form.',
        summary: 'Helpful for scraping, QA flows, and portal interactions.',
        icon: LayoutGrid,
      },
      {
        kind: 'aiAgent',
        label: 'AI Agent',
        subtitle: 'Reasoning step',
        category: 'Actions',
        description: 'Run a prompt-driven task for summarization, routing, or generation.',
        summary: 'Use AI for scoring, drafting, and language-heavy decision points.',
        icon: Bot,
      },
      {
        kind: 'database',
        label: 'Database',
        subtitle: 'Read and write',
        category: 'Actions',
        description: 'Store outputs or hydrate the flow with context from a database.',
        summary: 'Useful for stateful workflows and audit-friendly persistence.',
        icon: SquareTerminal,
      },
    ],
  },
  {
    id: 'logic',
    label: 'Logic',
    description: 'Control how data moves and when the flow branches.',
    icon: GitBranch,
    templates: [
      {
        kind: 'transform',
        label: 'Transform',
        subtitle: 'Shape payload',
        category: 'Logic',
        description: 'Normalize, map, or enrich incoming data before the next step.',
        summary: 'Keep downstream nodes small by reshaping data early.',
        icon: Sparkles,
      },
      {
        kind: 'condition',
        label: 'Condition',
        subtitle: 'If / else',
        category: 'Logic',
        description: 'Branch based on filters or rule checks.',
        summary: 'Send data to different paths depending on its contents.',
        icon: GitBranch,
      },
      {
        kind: 'delay',
        label: 'Delay',
        subtitle: 'Wait state',
        category: 'Logic',
        description: 'Pause the execution before continuing.',
        summary: 'Useful for rate limits, follow-up windows, or retries.',
        icon: Timer,
      },
    ],
  },
  {
    id: 'integrations',
    label: 'Integrations',
    description: 'Connect the flow to concrete tools and endpoints.',
    icon: Calendar,
    templates: [
      {
        kind: 'googleCalendar',
        label: 'Google Calendar',
        subtitle: 'Event automation',
        category: 'Integrations',
        description: 'Create, update, or inspect events from the workflow.',
        summary: 'Coordinate scheduling directly from the automation canvas.',
        icon: Calendar,
      },
      {
        kind: 'end',
        label: 'End',
        subtitle: 'Stop flow',
        category: 'Output',
        description: 'Mark the clean finish of the pipeline.',
        summary: 'Use it to make flow endings explicit and readable.',
        icon: ShieldCheck,
      },
    ],
  },
];

const templateMap = new Map(
  nodeCategories.flatMap((category) => category.templates.map((template) => [template.kind, template] as const))
);

function createReferenceBase(label: string): string {
  const normalized = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  return normalized || 'node';
}

function createNodeReferenceId(label: string, used = new Set<string>()): string {
  const base = createReferenceBase(label);
  let candidate = `${base}_${Math.floor(1000 + Math.random() * 9000)}`;

  while (used.has(candidate)) {
    candidate = `${base}_${Math.floor(1000 + Math.random() * 9000)}`;
  }

  used.add(candidate);
  return candidate;
}

function extractReferenceSuffix(referenceId: string): string {
  const match = referenceId.match(/_(\d+)$/);
  return match?.[1] ?? `${Math.floor(1000 + Math.random() * 9000)}`;
}

function rebuildReferenceIdFromLabel(referenceId: string, label: string): string {
  return `${createReferenceBase(label)}_${extractReferenceSuffix(referenceId)}`;
}

function replaceReferenceInString(value: string, oldReferenceId: string, newReferenceId: string): string {
  if (!value.includes('{{') || oldReferenceId === newReferenceId) {
    return value;
  }

  return value.replace(/{{\s*([^{}]+?)\s*}}/g, (match, expression) => {
    const parts = String(expression)
      .split('.')
      .map((segment) => segment.trim())
      .filter(Boolean);

    if (parts[0] !== oldReferenceId) {
      return match;
    }

    return `{{${[newReferenceId, ...parts.slice(1)].join('.')}}}`;
  });
}

function replaceReferenceUsages<T>(value: T, oldReferenceId: string, newReferenceId: string): T {
  if (typeof value === 'string') {
    return replaceReferenceInString(value, oldReferenceId, newReferenceId) as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => replaceReferenceUsages(item, oldReferenceId, newReferenceId)) as T;
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entryValue]) => [
        key,
        replaceReferenceUsages(entryValue, oldReferenceId, newReferenceId),
      ])
    ) as T;
  }

  return value;
}

function replaceReferenceUsagesInNodeData(
  data: PipelineNodeData,
  oldReferenceId: string,
  newReferenceId: string
): PipelineNodeData {
  const { referenceId, ...rest } = data;

  return {
    referenceId,
    ...replaceReferenceUsages(rest, oldReferenceId, newReferenceId),
  };
}

function coerceStructuredValue(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return '';
  }

  if (
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']'))
  ) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return value;
    }
  }

  return value;
}

function buildNodeReferenceValue(node: PipelineFlowNode) {
  return {
    id: node.data.referenceId,
    nodeId: node.id,
    title: node.data.label,
    subtitle: node.data.subtitle,
    description: node.data.description,
    summary: node.data.summary,
    category: node.data.category,
    kind: node.data.kind,
    type: getNodeTypeLabel(node.data.kind),
    status: node.data.status,
    activity: node.data.activity,
    promptMode: node.data.intelligencePromptMode ?? '',
    promptId: node.data.intelligencePromptId ?? '',
    query: node.data.intelligencePrompt ?? '',
    masterPrompt: node.data.intelligenceMasterPrompt ?? '',
    context: coerceStructuredValue(node.data.intelligenceContext ?? ''),
    response: coerceStructuredValue(node.data.intelligenceLastResponse ?? ''),
    renderedPrompt: node.data.intelligenceLastRenderedPrompt ?? '',
    usedModel: node.data.intelligenceLastModel ?? '',
    primaryModelId: node.data.intelligencePrimaryModelId ?? null,
    fallbackModelId: node.data.intelligenceFallbackModelId ?? null,
    primaryAccessKey: node.data.intelligencePrimaryAccessKey ?? null,
    fallbackAccessKey: node.data.intelligenceFallbackAccessKey ?? null,
    maxTokens: node.data.intelligenceMaxTokens ?? null,
    warning: node.data.intelligenceWarning ?? '',
  };
}

function getValueAtPath(source: unknown, path: string[]): unknown {
  let current = source;

  for (const segment of path) {
    if (current === null || current === undefined) {
      return undefined;
    }

    if (Array.isArray(current) && /^\d+$/.test(segment)) {
      current = current[Number(segment)];
      continue;
    }

    if (typeof current === 'object' && segment in (current as Record<string, unknown>)) {
      current = (current as Record<string, unknown>)[segment];
      continue;
    }

    return undefined;
  }

  return current;
}

function formatTemplateValue(value: unknown, pretty = false): string {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return JSON.stringify(value, null, pretty ? 2 : 0);
}

function resolveNodeTemplate(value: string, nodes: PipelineFlowNode[]): string {
  if (!value.includes('{{')) {
    return value;
  }

  const nodeMap = new Map(nodes.filter((node) => !node.data.pending).map((node) => [node.data.referenceId, node]));
  const fullMatch = value.trim().match(/^{{\s*([^{}]+?)\s*}}$/);

  if (fullMatch) {
    const [referenceKey, ...path] = fullMatch[1].split('.').map((segment) => segment.trim()).filter(Boolean);
    const node = nodeMap.get(referenceKey);

    if (!node) {
      return value;
    }

    const resolved = path.length === 0 ? buildNodeReferenceValue(node) : getValueAtPath(buildNodeReferenceValue(node), path);
    return formatTemplateValue(resolved, true);
  }

  return value.replace(/{{\s*([^{}]+?)\s*}}/g, (match, expression) => {
    const [referenceKey, ...path] = String(expression)
      .split('.')
      .map((segment) => segment.trim())
      .filter(Boolean);
    const node = nodeMap.get(referenceKey);

    if (!node) {
      return match;
    }

    const resolved = path.length === 0 ? buildNodeReferenceValue(node) : getValueAtPath(buildNodeReferenceValue(node), path);
    return formatTemplateValue(resolved);
  });
}

function getReferenceFieldIds(node: PipelineFlowNode): string[] {
  const fields = ['id', 'nodeId', 'title', 'subtitle', 'description', 'summary', 'category', 'kind', 'type', 'status', 'activity'];

  if (node.data.kind === 'aiAgent') {
    fields.push(
      'promptMode',
      'promptId',
      'query',
      'masterPrompt',
      'context',
      'response',
      'renderedPrompt',
      'usedModel',
      'primaryModelId',
      'fallbackModelId',
      'primaryAccessKey',
      'fallbackAccessKey',
      'maxTokens',
      'warning'
    );
  }

  return fields;
}

function ensureReferenceIds(nodes: PipelineFlowNode[]): PipelineFlowNode[] {
  const used = new Set<string>();

  return nodes.map((node) => {
    const existing = node.data.referenceId?.trim();
    const referenceId = existing && !used.has(existing) ? existing : createNodeReferenceId(node.data.label, used);

    if (existing && !used.has(existing)) {
      used.add(existing);
    }

    return {
      ...node,
      data: {
        ...node.data,
        referenceId,
      },
    };
  });
}

const initialNodes: PipelineFlowNode[] = [
  {
    id: 'manual-start',
    type: 'pipelineNode',
    position: { x: 100, y: 180 },
    data: {
      referenceId: 'manualstart_1201',
      label: 'Manual Start',
      kind: 'manualStart',
      category: 'Triggers',
      description: 'Kick off the workflow from Neup.Cloud.',
      summary: 'A great entry point while the pipeline is still evolving.',
      subtitle: 'Run from dashboard',
      status: 'idle',
      activity: 'Waiting for operator input.',
    },
  },
  {
    id: 'http-fetch',
    type: 'pipelineNode',
    position: { x: 430, y: 180 },
    data: {
      referenceId: 'fetchlead_1202',
      label: 'Fetch Lead',
      kind: 'http',
      category: 'Actions',
      description: 'Pull lead metadata from the upstream CRM endpoint.',
      summary: 'The flow enriches the raw trigger payload before scoring it.',
      subtitle: 'External API',
      status: 'idle',
      activity: 'Ready to request remote data.',
    },
  },
  {
    id: 'score-ai',
    type: 'pipelineNode',
    position: { x: 760, y: 180 },
    data: {
      referenceId: 'scorewithai_1203',
      label: 'Score with AI',
      kind: 'aiAgent',
      category: 'Actions',
      description: 'Classify urgency, estimate fit, and draft a response outline.',
      summary: 'AI turns raw lead info into something the team can act on quickly.',
      subtitle: 'Reasoning step',
      status: 'idle',
      activity: 'Prepared to analyze incoming context.',
      intelligencePromptMode: 'existing',
      intelligencePromptId: '',
      intelligencePrimaryModelId: null,
      intelligenceFallbackModelId: null,
      intelligencePrimaryAccessKey: null,
      intelligenceFallbackAccessKey: null,
      intelligenceMaxTokens: 500,
      intelligenceMasterPrompt: 'Score the lead, explain the reasoning, and return a concise structured summary.',
      intelligencePrompt: 'Review this lead and decide whether we should schedule a follow-up.',
      intelligenceContext: '{\n  "lead": {\n    "name": "Acme Corp",\n    "intent": "High",\n    "budget": "Enterprise"\n  }\n}',
      intelligenceLastResponse: '',
      intelligenceLastModel: '',
      intelligenceLastRenderedPrompt: '',
    },
  },
  {
    id: 'calendar-follow-up',
    type: 'pipelineNode',
    position: { x: 1090, y: 180 },
    data: {
      referenceId: 'schedulefollowup_1204',
      label: 'Schedule Follow-up',
      kind: 'googleCalendar',
      category: 'Integrations',
      description: 'Create a follow-up slot for qualified leads.',
      summary: 'Calendar placement happens only after the flow has enough confidence.',
      subtitle: 'Event automation',
      status: 'idle',
      activity: 'Awaiting a qualified lead result.',
    },
  },
];

const initialEdges: Edge[] = [
  createEdge('manual-start', 'http-fetch'),
  createEdge('http-fetch', 'score-ai'),
  createEdge('score-ai', 'calendar-follow-up'),
];

function createEdge(source: string, target: string): Edge {
  return {
    id: `edge-${source}-${target}`,
    source,
    target,
    animated: false,
    markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18 },
    style: { stroke: 'hsl(var(--foreground) / 0.26)', strokeWidth: 2 },
  };
}

function getNodeTone(kind: PipelineNodeKind) {
  switch (kind) {
    case 'manualStart':
    case 'webhookTrigger':
    case 'scheduleTrigger':
      return {
        header: 'from-emerald-500 to-teal-500',
        soft: 'bg-emerald-500/10 text-emerald-700 border-emerald-200',
      };
    case 'http':
    case 'browser':
    case 'database':
      return {
        header: 'from-sky-500 to-blue-600',
        soft: 'bg-sky-500/10 text-sky-700 border-sky-200',
      };
    case 'aiAgent':
      return {
        header: 'from-indigo-500 to-violet-600',
        soft: 'bg-indigo-500/10 text-indigo-700 border-indigo-200',
      };
    case 'transform':
    case 'condition':
    case 'delay':
      return {
        header: 'from-amber-500 to-orange-500',
        soft: 'bg-amber-500/10 text-amber-700 border-amber-200',
      };
    case 'googleCalendar':
      return {
        header: 'from-cyan-500 to-sky-600',
        soft: 'bg-cyan-500/10 text-cyan-700 border-cyan-200',
      };
    case 'end':
      return {
        header: 'from-slate-500 to-slate-700',
        soft: 'bg-slate-500/10 text-slate-700 border-slate-200',
      };
    default:
      return {
        header: 'from-primary to-primary/80',
        soft: 'bg-primary/10 text-primary border-primary/20',
      };
  }
}

function getStatusAppearance(status: PipelineNodeStatus) {
  switch (status) {
    case 'running':
      return {
        frame: 'border-blue-300 shadow-[0_18px_44px_rgba(59,130,246,0.14)] ring-1 ring-blue-100',
        box: 'border-blue-500 bg-blue-500 text-white shadow-[0_10px_24px_rgba(59,130,246,0.28)]',
        pill: 'border-blue-200 bg-blue-50 text-blue-700',
        dot: 'bg-blue-500',
        label: 'Running',
        Icon: Loader2,
      };
    case 'success':
      return {
        frame: 'border-emerald-300 shadow-[0_18px_44px_rgba(16,185,129,0.14)] ring-1 ring-emerald-100',
        box: 'border-emerald-500 bg-emerald-500 text-white shadow-[0_10px_24px_rgba(16,185,129,0.28)]',
        pill: 'border-emerald-200 bg-emerald-50 text-emerald-700',
        dot: 'bg-emerald-500',
        label: 'Success',
        Icon: Check,
      };
    case 'error':
      return {
        frame: 'border-rose-300 shadow-[0_18px_44px_rgba(244,63,94,0.14)] ring-1 ring-rose-100',
        box: 'border-rose-500 bg-rose-500 text-white shadow-[0_10px_24px_rgba(244,63,94,0.26)]',
        pill: 'border-rose-200 bg-rose-50 text-rose-700',
        dot: 'bg-rose-500',
        label: 'Issue',
        Icon: CircleSlash,
      };
    default:
      return {
        frame: 'border-slate-200 shadow-[0_14px_36px_rgba(15,23,42,0.08)]',
        box: 'border-slate-300 bg-slate-100 text-slate-500',
        pill: 'border-slate-200 bg-slate-50 text-slate-600',
        dot: 'bg-slate-400',
        label: 'Ready',
        Icon: Square,
      };
  }
}

function getNodeTypeLabel(kind: PipelineNodeKind) {
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

function createNode(
  kind: PipelineNodeKind,
  position: { x: number; y: number },
  overrides?: Partial<PipelineNodeData>
): PipelineFlowNode {
  const template = templateMap.get(kind);
  const id = `${kind}-${Math.random().toString(36).slice(2, 8)}`;
  const { referenceId: _referenceId, ...restOverrides } = overrides ?? {};

  return {
    id,
    type: 'pipelineNode',
    position,
    data: {
      referenceId: createNodeReferenceId(restOverrides.label ?? template?.label ?? 'Node'),
      label: template?.label ?? 'Node',
      kind,
      category: template?.category ?? 'Custom',
      description: template?.description ?? 'Configure this step.',
      summary: template?.summary ?? 'Workflow node.',
      subtitle: template?.subtitle ?? 'Automation step',
      status: 'idle',
      activity: `Ready to run ${template?.label?.toLowerCase() ?? 'node'}.`,
      ...(kind === 'aiAgent'
        ? {
            intelligencePromptMode: 'existing' as const,
            intelligencePromptId: '',
            intelligencePrimaryModelId: null,
            intelligenceFallbackModelId: null,
            intelligencePrimaryAccessKey: null,
            intelligenceFallbackAccessKey: null,
            intelligenceMaxTokens: 500,
            intelligenceMasterPrompt: '',
            intelligencePrompt: '',
            intelligenceContext: '',
            intelligenceLastResponse: '',
            intelligenceLastModel: '',
            intelligenceLastRenderedPrompt: '',
            intelligenceWarning: '',
          }
        : {}),
      ...restOverrides,
    },
  };
}

function PipelineCanvasNode({ id, data, selected }: NodeProps<PipelineNodeData>) {
  const template = templateMap.get(data.kind);
  const Icon = template?.icon ?? Workflow;
  const status = getStatusAppearance(data.status);
  const typeLabel = getNodeTypeLabel(data.kind);
  const StatusIcon = status.Icon;

  return (
    <div
      className={cn(
        'group relative w-[256px] rounded-[1.35rem] bg-white shadow-[0_16px_36px_rgba(15,23,42,0.08)] transition-all duration-200',
        selected
          ? 'shadow-[0_18px_40px_rgba(15,23,42,0.12)] ring-2 ring-slate-200/70'
          : status.frame
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
        <div className={cn('h-1.5 w-full bg-gradient-to-r', getNodeTone(data.kind).header)} />

        <div className="bg-white">
          <div className="flex items-start gap-3 px-3.5 py-3">
            <div
              className={cn(
                'flex h-11 w-11 shrink-0 items-center justify-center rounded-[0.95rem] bg-gradient-to-br text-white shadow-[0_10px_22px_rgba(15,23,42,0.12)]',
                getNodeTone(data.kind).header,
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
                {data.label}
              </h3>
              <p className="pt-0.5 text-sm text-slate-500">{data.subtitle}</p>
            </div>
          </div>

          <div className="border-t border-slate-100 bg-slate-50/70 px-3.5 py-2.5">
            <div
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-medium text-slate-600',
                status.pill
              )}
            >
              <span className={cn('h-2 w-2 rounded-full', status.dot)} />
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

function PendingBranchAnchor() {
  return (
    <div className="h-4 w-4 rounded-full border-2 border-dashed border-slate-300 bg-white shadow-[0_0_0_6px_rgba(255,255,255,0.92)]" />
  );
}

const nodeTypes: NodeTypes = {
  pipelineNode: PipelineCanvasNode,
  pendingAnchor: PendingBranchAnchor,
};

function getPointerPosition(event: MouseEvent | TouchEvent) {
  if ('touches' in event && event.touches.length > 0) {
    return { x: event.touches[0].clientX, y: event.touches[0].clientY };
  }

  if ('changedTouches' in event && event.changedTouches.length > 0) {
    return { x: event.changedTouches[0].clientX, y: event.changedTouches[0].clientY };
  }

  if ('clientX' in event) {
    return { x: event.clientX, y: event.clientY };
  }

  return { x: 0, y: 0 };
}

function buildModelLabel(model: IntelligenceModelOption): string {
  return `${model.title} (${model.provider}:${model.model})`;
}

function PipelineEditorCanvas({
  intelligenceModels,
  intelligencePrompts,
  intelligenceTokens,
}: PipelineEditorProps) {
  const { screenToFlowPosition } = useReactFlow<PipelineNodeData>();
  const [nodes, setNodes, onNodesChange] = useNodesState<PipelineNodeData>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedId, setSelectedId] = useState<string | null>('http-fetch');
  const [activeCategory, setActiveCategory] = useState(nodeCategories[0].id);
  const [search, setSearch] = useState('');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [isRunning, setIsRunning] = useState(false);
  const [pendingParentId, setPendingParentId] = useState<string | null>(null);
  const [pendingConnection, setPendingConnection] = useState<PendingConnectionDraft | null>(null);
  const [referenceSaveNotice, setReferenceSaveNotice] = useState<string | null>(null);
  const [showDebugger, setShowDebugger] = useState(true);
  const [consoleLines, setConsoleLines] = useState<string[]>([
    'Editor ready. Build on the canvas or add a child from any node.',
  ]);
  const connectStartRef = useRef<{ nodeId: string | null; handleType: 'source' | 'target' | null }>({
    nodeId: null,
    handleType: null,
  });
  const didConnectRef = useRef(false);
  const ignoreNextPaneClickRef = useRef(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return;
    }

    try {
      const parsed = JSON.parse(stored) as { nodes?: PipelineFlowNode[]; edges?: Edge[] };
      if (Array.isArray(parsed.nodes) && parsed.nodes.length > 0) {
        const hydratedNodes = ensureReferenceIds(parsed.nodes);
        setNodes(hydratedNodes);
        setSelectedId(hydratedNodes[0]?.id ?? null);
      }
      if (Array.isArray(parsed.edges)) {
        setEdges(parsed.edges);
      }
      setConsoleLines((current) => [...current, 'Recovered the last saved local draft.']);
    } catch (error) {
      console.error('Failed to restore pipeline editor state', error);
    }
  }, [setEdges, setNodes]);

  useEffect(() => {
    const handleAddChild = (event: Event) => {
      const detail = (event as CustomEvent<{ nodeId: string }>).detail;
      setPendingParentId(detail.nodeId);
      setSelectedId(detail.nodeId);
      setConsoleLines((current) => [...current, 'Select a node from the library to attach a child step.']);
    };

    window.addEventListener('pipeline:add-child', handleAddChild);
    return () => window.removeEventListener('pipeline:add-child', handleAddChild);
  }, []);

  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedId && !node.data.pending) ?? null,
    [nodes, selectedId]
  );
  const promptOptionMap = useMemo(
    () => new Map(intelligencePrompts.map((prompt) => [prompt.promptId, prompt])),
    [intelligencePrompts]
  );
  const modelOptionMap = useMemo(
    () => new Map(intelligenceModels.map((model) => [model.id, model])),
    [intelligenceModels]
  );
  const tokenOptionMap = useMemo(
    () => new Map(intelligenceTokens.map((token) => [token.id, token])),
    [intelligenceTokens]
  );

  const filteredTemplatesByCategory = useMemo(() => {
    const normalized = search.trim().toLowerCase();

    return new Map(
      nodeCategories.map((category) => [
        category.id,
        !normalized
          ? category.templates
          : category.templates.filter((template) =>
              [template.label, template.subtitle, template.description].some((value) =>
                value.toLowerCase().includes(normalized)
              )
            ),
      ])
    );
  }, [search]);

  const matchingTemplateCount = useMemo(
    () => Array.from(filteredTemplatesByCategory.values()).reduce((count, templates) => count + templates.length, 0),
    [filteredTemplatesByCategory]
  );

  const flowNodes = useMemo(() => {
    return [...nodes]
      .filter((node) => !node.data.pending)
      .sort((left, right) => {
      if (left.position.x === right.position.x) {
        return left.position.y - right.position.y;
      }
      return left.position.x - right.position.x;
      });
  }, [nodes]);

  const selectedPromptOption = useMemo(
    () =>
      selectedNode?.data.kind === 'aiAgent' && selectedNode.data.intelligencePromptId
        ? promptOptionMap.get(selectedNode.data.intelligencePromptId) ?? null
        : null,
    [promptOptionMap, selectedNode]
  );

  const appendConsole = useCallback((line: string) => {
    const time = new Date().toLocaleTimeString();
    setConsoleLines((current) => [...current, `${time} | ${line}`]);
  }, []);

  const setNodeWarning = useCallback(
    (nodeId: string, warning: string, activity?: string) => {
      setNodes((currentNodes) =>
        currentNodes.map((node) =>
          node.id === nodeId
            ? {
                ...node,
                data: {
                  ...node.data,
                  status: 'error',
                  activity: activity ?? warning,
                  intelligenceWarning: warning,
                },
              }
            : node
        )
      );
    },
    [setNodes]
  );

  const clearNodeWarning = useCallback(
    (nodeId: string) => {
      setNodes((currentNodes) =>
        currentNodes.map((node) =>
          node.id === nodeId
            ? {
                ...node,
                data: {
                  ...node.data,
                  intelligenceWarning: '',
                },
              }
            : node
        )
      );
    },
    [setNodes]
  );

  const getAiAgentValidationError = useCallback(
    (node: PipelineFlowNode): string | null => {
      if (node.data.kind !== 'aiAgent') {
        return null;
      }

      if (intelligenceModels.length === 0 || intelligenceTokens.length === 0) {
        return 'Configure at least one model and one access token for the AI Agent.';
      }

      const hasConfiguredPrimary =
        node.data.intelligencePrimaryModelId !== null &&
        node.data.intelligencePrimaryModelId !== undefined &&
        node.data.intelligencePrimaryAccessKey !== null &&
        node.data.intelligencePrimaryAccessKey !== undefined;
      const hasConfiguredFallback =
        node.data.intelligenceFallbackModelId !== null &&
        node.data.intelligenceFallbackModelId !== undefined &&
        node.data.intelligenceFallbackAccessKey !== null &&
        node.data.intelligenceFallbackAccessKey !== undefined;

      if (!hasConfiguredPrimary && !hasConfiguredFallback) {
        return 'Configure at least one model and one access token for the AI Agent.';
      }

      const hasPromptContent = [
        node.data.intelligencePrompt,
        node.data.intelligenceMasterPrompt,
        node.data.intelligenceContext,
      ].some((value) => Boolean(value?.trim()));

      if (!hasPromptContent) {
        return 'Provide a prompt, a master prompt, or some context for the AI Agent.';
      }

      return null;
    },
    [intelligenceModels.length, intelligenceTokens.length]
  );

  const clearPendingConnection = useCallback(
    (logLine?: string) => {
      if (!pendingConnection) {
        return;
      }

      setNodes((currentNodes) => currentNodes.filter((node) => node.id !== pendingConnection.placeholderId));
      setEdges((currentEdges) =>
        currentEdges.filter(
          (edge) => edge.source !== pendingConnection.placeholderId && edge.target !== pendingConnection.placeholderId
        )
      );
      setPendingConnection(null);
      setPendingParentId(null);

      if (logLine) {
        appendConsole(logLine);
      }
    },
    [appendConsole, pendingConnection, setEdges, setNodes]
  );

  const startPendingConnection = useCallback(
    (parentId: string, position: { x: number; y: number }) => {
      const placeholderId = `pending-anchor-${Math.random().toString(36).slice(2, 8)}`;

      setNodes((currentNodes) => [
        ...currentNodes.filter((node) => !node.data.pending),
        {
          id: placeholderId,
          type: 'pendingAnchor',
          position: { x: position.x - 8, y: position.y - 8 },
          draggable: false,
          selectable: false,
          connectable: false,
          deletable: false,
          data: {
            referenceId: placeholderId,
            label: '',
            kind: 'end',
            category: '',
            description: '',
            summary: '',
            subtitle: '',
            status: 'idle',
            activity: '',
            pending: true,
          },
        },
      ]);
      setEdges((currentEdges) => [
        ...currentEdges.filter((edge) => !edge.target.startsWith('pending-anchor-')),
        createEdge(parentId, placeholderId),
      ]);
      setPendingConnection({ parentId, placeholderId, position });
      setPendingParentId(parentId);
      setSelectedId(null);
      setActiveCategory('actions');
      setSearch('');
      appendConsole('Choose the next node from the sidebar to complete this branch.');

      ignoreNextPaneClickRef.current = true;
      window.requestAnimationFrame(() => {
        ignoreNextPaneClickRef.current = false;
      });
    },
    [appendConsole, setEdges, setNodes]
  );

  const handleConnect = useCallback(
    (connection: Connection) => {
      const sourceId = connection.source ?? undefined;
      const targetId = connection.target ?? undefined;

      if (!sourceId || !targetId) {
        return;
      }

      didConnectRef.current = true;
      clearPendingConnection();
      setEdges((currentEdges) => addEdge(createEdge(sourceId, targetId), currentEdges));
      appendConsole('Created a connection between two nodes.');
    },
    [appendConsole, clearPendingConnection, setEdges]
  );

  const handleSave = useCallback(() => {
    setSaveState('saving');
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        nodes: nodes.filter((node) => !node.data.pending),
        edges: edges.filter(
          (edge) => !edge.source.startsWith('pending-anchor-') && !edge.target.startsWith('pending-anchor-')
        ),
      })
    );
    appendConsole('Saved the local pipeline draft.');
    setReferenceSaveNotice(null);

    window.setTimeout(() => {
      setSaveState('saved');
      window.setTimeout(() => setSaveState('idle'), 1400);
    }, 260);
  }, [appendConsole, edges, nodes]);

  const handleReset = useCallback(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
    setSelectedId('http-fetch');
    setPendingParentId(null);
    setPendingConnection(null);
    setReferenceSaveNotice(null);
    window.localStorage.removeItem(STORAGE_KEY);
    appendConsole('Reset the editor back to the starter flow.');
  }, [appendConsole, setEdges, setNodes]);

  const handleAddNode = useCallback(
    (kind: PipelineNodeKind) => {
      const parentId = pendingConnection?.parentId ?? pendingParentId ?? selectedId;
      const parentNode = parentId ? nodes.find((node) => node.id === parentId) ?? null : null;
      const nextPosition = pendingConnection
        ? pendingConnection.position
        : parentNode
          ? {
              x: parentNode.position.x + 320,
              y: parentNode.position.y + (edges.filter((edge) => edge.source === parentNode.id).length * 140 - 40),
            }
          : {
              x: 140 + nodes.length * 60,
              y: 180 + ((nodes.length % 3) * 130),
            };

      const newNode = createNode(kind, nextPosition);
      setNodes((currentNodes) => [
        ...currentNodes.filter((node) => node.id !== pendingConnection?.placeholderId),
        newNode,
      ]);

      if (parentNode) {
        setEdges((currentEdges) => [
          ...currentEdges.filter(
            (edge) =>
              edge.source !== pendingConnection?.placeholderId && edge.target !== pendingConnection?.placeholderId
          ),
          createEdge(parentNode.id, newNode.id),
        ]);
        appendConsole(`Added ${newNode.data.label} after ${parentNode.data.label}.`);
      } else {
        appendConsole(`Added ${newNode.data.label} to the canvas.`);
      }

      setSelectedId(newNode.id);
      setPendingParentId(null);
      setPendingConnection(null);
    },
    [appendConsole, edges, nodes, pendingConnection, pendingParentId, selectedId, setEdges, setNodes]
  );

  const handleDuplicate = useCallback(() => {
    if (!selectedNode) {
      return;
    }

    const duplicate = createNode(
      selectedNode.data.kind,
      {
        x: selectedNode.position.x + 30,
        y: selectedNode.position.y + 150,
      },
      {
        ...selectedNode.data,
        label: `${selectedNode.data.label} Copy`,
        status: 'idle',
        activity: 'Duplicated from existing step.',
      }
    );

    setNodes((currentNodes) => [...currentNodes, duplicate]);
    setSelectedId(duplicate.id);
    appendConsole(`Duplicated ${selectedNode.data.label}.`);
  }, [appendConsole, selectedNode, setNodes]);

  const handleDelete = useCallback(() => {
    if (!selectedId) {
      return;
    }

    setNodes((currentNodes) => currentNodes.filter((node) => node.id !== selectedId));
    setEdges((currentEdges) => currentEdges.filter((edge) => edge.source !== selectedId && edge.target !== selectedId));
    if (pendingConnection?.parentId === selectedId) {
      clearPendingConnection();
    }
    setPendingParentId((current) => (current === selectedId ? null : current));
    setSelectedId(null);
    appendConsole('Removed the selected node from the flow.');
  }, [appendConsole, clearPendingConnection, pendingConnection?.parentId, selectedId, setEdges, setNodes]);

  const updateSelectedNode = useCallback(
    (patch: Partial<PipelineNodeData>) => {
      if (!selectedId) {
        return;
      }

      setNodes((currentNodes) =>
        currentNodes.map((node) =>
          node.id === selectedId
            ? { ...node, data: { ...node.data, ...patch } }
            : node
        )
      );
    },
    [selectedId, setNodes]
  );

  const updateSelectedNodeLabel = useCallback(
    (label: string) => {
      if (!selectedId) {
        return;
      }

      let renamedReferenceId: string | null = null;

      setNodes((currentNodes) => {
        const currentNode = currentNodes.find((node) => node.id === selectedId) ?? null;

        if (!currentNode) {
          return currentNodes;
        }

        const previousReferenceId = currentNode.data.referenceId;
        const nextReferenceId = rebuildReferenceIdFromLabel(previousReferenceId, label);
        renamedReferenceId = nextReferenceId;

        const renamedNodes = currentNodes.map((node) =>
          node.id === selectedId
            ? {
                ...node,
                data: {
                  ...node.data,
                  label,
                  referenceId: nextReferenceId,
                },
              }
            : node
        );

        if (previousReferenceId === nextReferenceId) {
          return renamedNodes;
        }

        return renamedNodes.map((node) =>
          node.id === selectedId || node.data.pending
            ? node
            : {
                ...node,
                data: replaceReferenceUsagesInNodeData(node.data, previousReferenceId, nextReferenceId),
              }
        );
      });

      setReferenceSaveNotice(
        renamedReferenceId
          ? `Save to persist the updated node title and refreshed references (${renamedReferenceId}).`
          : 'Save to persist the updated node title and refreshed references.'
      );
    },
    [selectedId, setNodes]
  );

  const executeAiAgentNode = useCallback(
    async (node: PipelineFlowNode) => {
      if (node.data.kind !== 'aiAgent') {
        return false;
      }

      const validationError = getAiAgentValidationError(node);

      if (validationError) {
        setNodeWarning(node.id, validationError);
        appendConsole(`AI Agent "${node.data.label}" needs configuration: ${validationError}`);
        return false;
      }

      const actionInput: PipelineAiAgentExecutionInput = {
        promptMode: node.data.intelligencePromptMode ?? 'new',
        promptId: node.data.intelligencePromptId?.trim() || null,
        primaryModelId: node.data.intelligencePrimaryModelId ?? null,
        fallbackModelId: node.data.intelligenceFallbackModelId ?? null,
        primaryAccessKey: node.data.intelligencePrimaryAccessKey ?? null,
        fallbackAccessKey: node.data.intelligenceFallbackAccessKey ?? null,
        maxTokens: node.data.intelligenceMaxTokens ?? null,
        masterPrompt: resolveNodeTemplate(node.data.intelligenceMasterPrompt?.trim() || '', nodes).trim() || null,
        prompt: resolveNodeTemplate(node.data.intelligencePrompt?.trim() || '', nodes).trim(),
        context: resolveNodeTemplate(node.data.intelligenceContext?.trim() || '', nodes).trim() || null,
      };

      setNodes((currentNodes) =>
        currentNodes.map((currentNode) =>
          currentNode.id === node.id
            ? {
                ...currentNode,
                data: {
                  ...currentNode.data,
                  status: 'running',
                  activity: 'Generating intelligence response...',
                  intelligenceWarning: '',
                },
              }
            : currentNode
        )
      );

      appendConsole(`AI Agent "${node.data.label}" is preparing a prompt record.`);

      try {
        const result = await executePipelineAiAgentAction(actionInput);
        const compactResponse =
          result.responseText.length > 220
            ? `${result.responseText.slice(0, 220).trim()}...`
            : result.responseText;

        setNodes((currentNodes) =>
          currentNodes.map((currentNode) =>
            currentNode.id === node.id
              ? {
                  ...currentNode,
                  data: {
                    ...currentNode.data,
                    status: 'success',
                    activity: `Response generated via ${result.usedModel}.`,
                    intelligencePromptId: result.promptId,
                    intelligenceLastResponse: result.responseText,
                    intelligenceLastModel: result.usedModel,
                    intelligenceLastRenderedPrompt: result.renderedPrompt,
                    intelligenceWarning: '',
                    summary: compactResponse || currentNode.data.summary,
                  },
                }
              : currentNode
          )
        );

        appendConsole(
          `${result.createdPrompt ? 'Created' : 'Updated'} prompt ${result.promptId} and generated a response with ${result.usedModel}.`
        );

        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to generate AI response';
        setNodeWarning(node.id, message);

        appendConsole(`AI Agent "${node.data.label}" failed: ${message}`);
        return false;
      }
    },
    [appendConsole, getAiAgentValidationError, nodes, setNodeWarning, setNodes]
  );

  const handleRun = useCallback(async () => {
    if (isRunning || flowNodes.length === 0) {
      return;
    }

    setIsRunning(true);
    setShowDebugger(true);
    appendConsole(`Starting a ${flowNodes.length}-step simulation run.`);
    setNodes((currentNodes) =>
      currentNodes.map((node) => ({ ...node, data: { ...node.data, status: 'idle' } }))
    );

    try {
      for (const node of flowNodes) {
        if (node.data.kind === 'aiAgent') {
          const aiSucceeded = await executeAiAgentNode(node);
          if (!aiSucceeded) {
            appendConsole(`Stopped the run after ${node.data.label} reported a pipeline warning.`);
            break;
          }
          continue;
        }

        setNodes((currentNodes) =>
          currentNodes.map((currentNode) =>
            currentNode.id === node.id
              ? {
                  ...currentNode,
                  data: {
                    ...currentNode.data,
                    status: 'running',
                    activity: 'Executing now...',
                  },
                }
              : currentNode
          )
        );
        appendConsole(`Running ${node.data.label}.`);

        await new Promise((resolve) => window.setTimeout(resolve, 420));

        setNodes((currentNodes) =>
          currentNodes.map((currentNode) =>
            currentNode.id === node.id
              ? {
                  ...currentNode,
                  data: {
                    ...currentNode.data,
                    status: 'success',
                    activity: 'Completed successfully.',
                  },
                }
              : currentNode
          )
        );
        appendConsole(`Completed ${node.data.label}.`);
      }

      appendConsole('Pipeline simulation finished.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Pipeline run failed.';
      appendConsole(message);
    } finally {
      setIsRunning(false);
    }
  }, [appendConsole, executeAiAgentNode, flowNodes, isRunning, setNodes]);

  const isLibraryMode = Boolean(pendingParentId || pendingConnection);
  const shouldShowSidebar = Boolean(selectedNode || isLibraryMode);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(15,23,42,0.08),transparent_26%),linear-gradient(180deg,#f8fafc_0%,#eef2f5_100%)] text-foreground">
      <div className="flex min-h-screen flex-col">
        <header className="border-b border-white/70 bg-white/85 px-4 py-4 shadow-[0_18px_60px_rgba(15,23,42,0.06)] backdrop-blur-xl md:px-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-4">
              <Logo />
              <div className="hidden h-10 w-px bg-border md:block" />
              <Button asChild variant="outline" className="rounded-full border-slate-200 bg-white">
                <Link href="/pipeline">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Pipeline home
                </Link>
              </Button>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Plain Workspace</p>
                <h1 className="text-lg font-semibold tracking-tight text-slate-950">Pipeline Editor</h1>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" className="rounded-full border-slate-200 bg-white" onClick={() => setShowDebugger((current) => !current)}>
                <TerminalSquare className="mr-2 h-4 w-4" />
                {showDebugger ? 'Hide logs' : 'Show logs'}
              </Button>
              <Button variant="outline" className="rounded-full border-slate-200 bg-white" onClick={handleReset}>
                <RefreshCcw className="mr-2 h-4 w-4" />
                Reset
              </Button>
              <Button variant="outline" className="rounded-full border-slate-200 bg-white" onClick={handleSave}>
                <Save className="mr-2 h-4 w-4" />
                {saveState === 'saving' ? 'Saving...' : saveState === 'saved' ? 'Saved' : 'Save'}
              </Button>
              <Button className="rounded-full" onClick={handleRun} disabled={isRunning}>
                <Play className="mr-2 h-4 w-4" />
                {isRunning ? 'Running...' : 'Run flow'}
              </Button>
            </div>
          </div>
        </header>

        <div className={cn('grid flex-1 gap-0', shouldShowSidebar && 'xl:grid-cols-[minmax(0,1fr)_380px]')}>
          <main className="relative h-[calc(100vh-81px)] overflow-hidden">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(15,23,42,0.08),transparent_36%)]" />

            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              fitView
              minZoom={0.3}
              maxZoom={1.5}
              zoomOnScroll={false}
              zoomOnPinch
              panOnScroll
              panOnScrollMode={PanOnScrollMode.Free}
              defaultEdgeOptions={{
                animated: false,
                markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18 },
                style: { stroke: 'hsl(var(--foreground) / 0.26)', strokeWidth: 2 },
              }}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={handleConnect}
              onConnectStart={(_, params) => {
                didConnectRef.current = false;
                connectStartRef.current = {
                  nodeId: params.nodeId,
                  handleType: params.handleType,
                };
              }}
              onConnectEnd={(event) => {
                const { nodeId, handleType } = connectStartRef.current;

                if (!nodeId || handleType !== 'source' || didConnectRef.current) {
                  connectStartRef.current = { nodeId: null, handleType: null };
                  return;
                }

                const pointerPosition = getPointerPosition(event);
                startPendingConnection(nodeId, screenToFlowPosition(pointerPosition));
                connectStartRef.current = { nodeId: null, handleType: null };
              }}
              onNodeClick={(_, node) => {
                clearPendingConnection();
                setSelectedId(node.id);
                setPendingParentId(null);
              }}
              onPaneClick={() => {
                if (ignoreNextPaneClickRef.current) {
                  return;
                }

                clearPendingConnection();
                setSelectedId(null);
                setPendingParentId(null);
              }}
              className="pipeline-editor-flow bg-transparent"
              proOptions={{ hideAttribution: true }}
            >
              <Background gap={22} size={1.1} color="hsl(var(--border))" />
              <Controls className="!rounded-2xl !border !border-white/70 !bg-white/95 !shadow-xl" position="bottom-right" />
            </ReactFlow>
          </main>

          {shouldShowSidebar ? (
          <aside className="border-l border-white/60 bg-white/60">
            <ScrollArea className="h-[calc(100vh-81px)]">
              <div className="space-y-5 p-5">
                {isLibraryMode ? (
                  <>
                    <div className="space-y-3 rounded-[1.7rem] border border-white/80 bg-white/90 p-4 shadow-sm">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Node Library</p>
                        <h2 className="mt-1 text-lg font-semibold text-slate-950">Add the next step</h2>
                        <p className="mt-1 text-sm leading-6 text-slate-600">
                          Choose a category first, then pick a node from the second level.
                        </p>
                      </div>

                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <Input
                          value={search}
                          onChange={(event) => setSearch(event.target.value)}
                          placeholder="Search nodes"
                          className="rounded-2xl border-slate-200 bg-slate-50 pl-9"
                        />
                      </div>

                      <div className="rounded-[1.4rem] border border-primary/15 bg-primary/5 px-4 py-3 text-sm text-slate-700">
                        Adding a child after{' '}
                        <span className="font-semibold">
                          {nodes.find((node) => node.id === (pendingConnection?.parentId ?? pendingParentId))?.data.label ?? 'selected node'}
                        </span>
                        .
                      </div>
                    </div>

                    <div className="space-y-2">
                      {nodeCategories.map((category) => {
                        const Icon = category.icon;
                        const isActive = activeCategory === category.id;
                        const templates = filteredTemplatesByCategory.get(category.id) ?? [];

                        return (
                          <div key={category.id} className="rounded-[1.5rem] border border-white/80 bg-white/90 shadow-sm">
                            <button
                              type="button"
                              onClick={() => setActiveCategory(category.id)}
                              className={cn(
                                'flex w-full items-start gap-3 rounded-[1.5rem] px-4 py-3 text-left transition-all',
                                isActive ? 'bg-slate-900 text-white' : 'hover:bg-slate-50'
                              )}
                            >
                              <div
                                className={cn(
                                  'mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl',
                                  isActive ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-700'
                                )}
                              >
                                <Icon className="h-5 w-5" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className={cn('font-semibold', isActive ? 'text-white' : 'text-slate-950')}>
                                  {category.label}
                                </div>
                                <p className={cn('mt-1 text-sm leading-6', isActive ? 'text-slate-300' : 'text-slate-600')}>
                                  {category.description}
                                </p>
                              </div>
                            </button>

                            {isActive ? (
                              <div className="space-y-2 border-t border-slate-100 px-3 py-3">
                                {templates.length > 0 ? (
                                  templates.map((template) => {
                                    const TemplateIcon = template.icon;
                                    const tone = getNodeTone(template.kind);

                                    return (
                                      <button
                                        key={template.kind}
                                        type="button"
                                        onClick={() => handleAddNode(template.kind)}
                                        className="w-full rounded-[1.15rem] border border-slate-200 bg-slate-50 px-3 py-3 text-left transition-all hover:border-slate-300 hover:bg-white"
                                      >
                                        <div className="flex items-start gap-3">
                                          <div className={cn('flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-r text-white', tone.header)}>
                                            <TemplateIcon className="h-4 w-4" />
                                          </div>
                                          <div className="min-w-0 flex-1">
                                            <p className="font-medium text-slate-950">{template.label}</p>
                                            <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                                              {template.subtitle}
                                            </p>
                                          </div>
                                        </div>
                                      </button>
                                    );
                                  })
                                ) : (
                                  <div className="rounded-[1.15rem] border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">
                                    No matching nodes in this category.
                                  </div>
                                )}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>

                    {matchingTemplateCount === 0 ? (
                      <Card className="rounded-[1.5rem] border border-dashed border-slate-300 bg-white/70 shadow-none">
                        <CardContent className="p-6 text-sm text-slate-500">
                          Nothing matched that search. Try another term.
                        </CardContent>
                      </Card>
                    ) : null}
                  </>
                ) : selectedNode ? (
                  <>
                    <div className="space-y-1 px-1">
                      <h2 className="text-xl font-semibold text-slate-950">{selectedNode.data.label}</h2>
                      <p className="font-mono text-sm text-slate-500">{selectedNode.data.referenceId}</p>
                    </div>

                    {referenceSaveNotice ? (
                      <Alert className="rounded-[1.25rem] border border-amber-200 bg-amber-50 text-amber-900 [&>svg]:text-amber-700">
                        <TriangleAlert className="h-4 w-4" />
                        <AlertTitle>Save changes</AlertTitle>
                        <AlertDescription>{referenceSaveNotice}</AlertDescription>
                      </Alert>
                    ) : null}

                    {selectedNode.data.kind === 'aiAgent' ? (
                      <section className="space-y-4 px-1">
                        <h3 className="text-lg font-semibold text-slate-950">Node options</h3>
                          <div className="grid grid-cols-2 gap-2">
                            <Button
                              variant={selectedNode.data.intelligencePromptMode === 'existing' ? 'default' : 'outline'}
                              className="rounded-2xl"
                              onClick={() => updateSelectedNode({ intelligencePromptMode: 'existing' })}
                            >
                              Existing prompt
                            </Button>
                            <Button
                              variant={selectedNode.data.intelligencePromptMode === 'new' ? 'default' : 'outline'}
                              className="rounded-2xl"
                              onClick={() => updateSelectedNode({ intelligencePromptMode: 'new' })}
                            >
                              New prompt
                            </Button>
                          </div>

                          {selectedNode.data.intelligencePromptMode === 'existing' ? (
                            <div className="space-y-2">
                              <label className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                                Prompt ID
                              </label>
                              <select
                                value={selectedNode.data.intelligencePromptId ?? ''}
                                onChange={(event) => {
                                  clearNodeWarning(selectedNode.id);
                                  const prompt = promptOptionMap.get(event.target.value);

                                  updateSelectedNode({
                                    intelligencePromptId: event.target.value,
                                    intelligencePrimaryModelId: prompt?.primaryModelId ?? null,
                                    intelligenceFallbackModelId: prompt?.fallbackModelId ?? null,
                                    intelligencePrimaryAccessKey: prompt?.primaryAccessKey ?? null,
                                    intelligenceFallbackAccessKey: prompt?.fallbackAccessKey ?? null,
                                    intelligenceMaxTokens: prompt?.maxTokens ?? null,
                                    intelligenceMasterPrompt: prompt?.defPrompt ?? '',
                                  });
                                }}
                                className="flex h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-950 outline-none"
                              >
                                <option value="">Select a saved prompt</option>
                                {intelligencePrompts.map((prompt) => (
                                  <option key={prompt.id} value={prompt.promptId}>
                                    {prompt.promptId}
                                  </option>
                                ))}
                              </select>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <label className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                                Prompt ID
                              </label>
                              <Input
                                value={selectedNode.data.intelligencePromptId ?? ''}
                                onChange={(event) => {
                                  clearNodeWarning(selectedNode.id);
                                  updateSelectedNode({ intelligencePromptId: event.target.value });
                                }}
                                placeholder="Leave blank to auto-generate"
                                className="rounded-2xl border-slate-200 bg-slate-50"
                              />
                            </div>
                          )}

                          {selectedNode.data.intelligencePromptMode === 'existing' && selectedPromptOption ? (
                            <div className="space-y-3 rounded-[1.25rem] border border-slate-200 bg-slate-50/80 p-4">
                              <div className="space-y-1">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Primary model</p>
                                <p className="text-sm text-slate-900">
                                  {selectedNode.data.intelligencePrimaryModelId
                                    ? buildModelLabel(modelOptionMap.get(selectedNode.data.intelligencePrimaryModelId) ?? {
                                        id: selectedNode.data.intelligencePrimaryModelId,
                                        title: 'Unknown model',
                                        provider: 'unknown',
                                        model: 'unknown',
                                      })
                                    : 'Not configured'}
                                </p>
                              </div>

                              <div className="space-y-1">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Fallback model</p>
                                <p className="text-sm text-slate-900">
                                  {selectedNode.data.intelligenceFallbackModelId
                                    ? buildModelLabel(modelOptionMap.get(selectedNode.data.intelligenceFallbackModelId) ?? {
                                        id: selectedNode.data.intelligenceFallbackModelId,
                                        title: 'Unknown model',
                                        provider: 'unknown',
                                        model: 'unknown',
                                      })
                                    : 'None'}
                                </p>
                              </div>

                              <div className="space-y-1">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Primary token</p>
                                <p className="text-sm text-slate-900">
                                  {selectedNode.data.intelligencePrimaryAccessKey
                                    ? tokenOptionMap.get(selectedNode.data.intelligencePrimaryAccessKey)?.name ?? 'Unknown token'
                                    : 'Not configured'}
                                </p>
                              </div>

                              <div className="space-y-1">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Fallback token</p>
                                <p className="text-sm text-slate-900">
                                  {selectedNode.data.intelligenceFallbackAccessKey
                                    ? tokenOptionMap.get(selectedNode.data.intelligenceFallbackAccessKey)?.name ?? 'Unknown token'
                                    : 'None'}
                                </p>
                              </div>

                              <div className="space-y-1">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Max tokens</p>
                                <p className="text-sm text-slate-900">{selectedNode.data.intelligenceMaxTokens ?? 'Default'}</p>
                              </div>

                              <div className="space-y-1">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Master prompt</p>
                                <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
                                  {selectedNode.data.intelligenceMasterPrompt?.trim() || 'No master prompt set for this saved prompt.'}
                                </p>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="space-y-2">
                                <label className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                                  Primary model
                                </label>
                                <select
                                  value={selectedNode.data.intelligencePrimaryModelId ? String(selectedNode.data.intelligencePrimaryModelId) : ''}
                                  onChange={(event) => {
                                    clearNodeWarning(selectedNode.id);
                                    updateSelectedNode({
                                      intelligencePrimaryModelId: event.target.value ? Number(event.target.value) : null,
                                    });
                                  }}
                                  className="flex h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-950 outline-none"
                                >
                                  <option value="">Select primary model</option>
                                  {intelligenceModels.map((model) => (
                                    <option key={model.id} value={String(model.id)}>
                                      {buildModelLabel(model)}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div className="space-y-2">
                                <label className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                                  Fallback model
                                </label>
                                <select
                                  value={selectedNode.data.intelligenceFallbackModelId ? String(selectedNode.data.intelligenceFallbackModelId) : ''}
                                  onChange={(event) => {
                                    clearNodeWarning(selectedNode.id);
                                    updateSelectedNode({
                                      intelligenceFallbackModelId: event.target.value ? Number(event.target.value) : null,
                                    });
                                  }}
                                  className="flex h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-950 outline-none"
                                >
                                  <option value="">No fallback model</option>
                                  {intelligenceModels.map((model) => (
                                    <option key={model.id} value={String(model.id)}>
                                      {buildModelLabel(model)}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div className="space-y-2">
                                <label className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                                  Primary token
                                </label>
                                <select
                                  value={selectedNode.data.intelligencePrimaryAccessKey ? String(selectedNode.data.intelligencePrimaryAccessKey) : ''}
                                  onChange={(event) => {
                                    clearNodeWarning(selectedNode.id);
                                    updateSelectedNode({
                                      intelligencePrimaryAccessKey: event.target.value ? Number(event.target.value) : null,
                                    });
                                  }}
                                  className="flex h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-950 outline-none"
                                >
                                  <option value="">Select primary token</option>
                                  {intelligenceTokens.map((token) => (
                                    <option key={token.id} value={String(token.id)}>
                                      {token.name}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div className="space-y-2">
                                <label className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                                  Fallback token
                                </label>
                                <select
                                  value={selectedNode.data.intelligenceFallbackAccessKey ? String(selectedNode.data.intelligenceFallbackAccessKey) : ''}
                                  onChange={(event) => {
                                    clearNodeWarning(selectedNode.id);
                                    updateSelectedNode({
                                      intelligenceFallbackAccessKey: event.target.value ? Number(event.target.value) : null,
                                    });
                                  }}
                                  className="flex h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-950 outline-none"
                                >
                                  <option value="">No fallback token</option>
                                  {intelligenceTokens.map((token) => (
                                    <option key={token.id} value={String(token.id)}>
                                      {token.name}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div className="space-y-2">
                                <label className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                                  Max tokens
                                </label>
                                <Input
                                  type="number"
                                  min={1}
                                  value={selectedNode.data.intelligenceMaxTokens ?? ''}
                                  onChange={(event) => {
                                    clearNodeWarning(selectedNode.id);
                                    updateSelectedNode({
                                      intelligenceMaxTokens: event.target.value ? Number(event.target.value) : null,
                                    });
                                  }}
                                  className="rounded-2xl border-slate-200 bg-slate-50"
                                />
                              </div>

                              <div className="space-y-2">
                                <label className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                                  Master prompt
                                </label>
                                <Textarea
                                  value={selectedNode.data.intelligenceMasterPrompt ?? ''}
                                  onChange={(event) => {
                                    clearNodeWarning(selectedNode.id);
                                    updateSelectedNode({ intelligenceMasterPrompt: event.target.value });
                                  }}
                                  className="min-h-[110px] rounded-2xl border-slate-200 bg-slate-50"
                                />
                              </div>
                            </>
                          )}

                          <div className="space-y-2">
                            <label className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                              Prompt
                            </label>
                            <Textarea
                              value={selectedNode.data.intelligencePrompt ?? ''}
                              onChange={(event) => {
                                clearNodeWarning(selectedNode.id);
                                updateSelectedNode({ intelligencePrompt: event.target.value });
                              }}
                              className="min-h-[100px] rounded-2xl border-slate-200 bg-slate-50"
                            />
                          </div>

                          <div className="space-y-2">
                            <label className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                              Context
                            </label>
                            <Textarea
                              value={selectedNode.data.intelligenceContext ?? ''}
                              onChange={(event) => {
                                clearNodeWarning(selectedNode.id);
                                updateSelectedNode({ intelligenceContext: event.target.value });
                              }}
                              className="min-h-[110px] rounded-2xl border-slate-200 bg-slate-50"
                            />
                          </div>

                          <Button
                            className="w-full rounded-2xl"
                            onClick={async () => {
                              try {
                                await executeAiAgentNode(selectedNode);
                              } catch {
                                // Node state and debugger logs already capture the failure.
                              }
                            }}
                          >
                            <Bot className="mr-2 h-4 w-4" />
                            Generate response
                          </Button>

                          {selectedNode.data.intelligenceWarning ? (
                            <Alert variant="destructive" className="rounded-[1.25rem] border border-rose-200 bg-rose-50 text-rose-700 [&>svg]:text-rose-600">
                              <TriangleAlert className="h-4 w-4" />
                              <AlertTitle>Pipeline warning</AlertTitle>
                              <AlertDescription>{selectedNode.data.intelligenceWarning}</AlertDescription>
                            </Alert>
                          ) : null}
                      </section>
                    ) : null}

                    {selectedNode.data.kind === 'aiAgent' && selectedNode.data.intelligenceLastResponse ? (
                      <section className="space-y-4 px-1">
                        <h3 className="text-lg font-semibold text-slate-950">Response</h3>
                        <div className="space-y-3 rounded-[1.4rem] border border-slate-200 bg-slate-50/80 p-4">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-medium text-slate-900">AI response</p>
                            {selectedNode.data.intelligenceLastModel ? (
                              <Badge className="rounded-full border border-slate-200 bg-white text-slate-700 hover:bg-white">
                                {selectedNode.data.intelligenceLastModel}
                              </Badge>
                            ) : null}
                          </div>
                          <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
                            {selectedNode.data.intelligenceLastResponse}
                          </p>
                          {selectedNode.data.intelligenceLastRenderedPrompt ? (
                            <div className="rounded-2xl border border-slate-200 bg-white p-3">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                                Rendered prompt
                              </p>
                              <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-slate-600">
                                {selectedNode.data.intelligenceLastRenderedPrompt}
                              </p>
                            </div>
                          ) : null}
                        </div>
                      </section>
                    ) : null}

                    <section className="space-y-4 px-1">
                        <h3 className="text-lg font-semibold text-slate-950">Node basics</h3>
                        <div className="space-y-2">
                          <label className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                            Label
                          </label>
                          <Input
                            value={selectedNode.data.label}
                            onChange={(event) => {
                              clearNodeWarning(selectedNode.id);
                              updateSelectedNodeLabel(event.target.value);
                            }}
                            className="rounded-2xl border-slate-200 bg-slate-50"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                            Description
                          </label>
                          <Textarea
                            value={selectedNode.data.description}
                            onChange={(event) => {
                              clearNodeWarning(selectedNode.id);
                              updateSelectedNode({ description: event.target.value });
                            }}
                            className="min-h-[110px] rounded-2xl border-slate-200 bg-slate-50"
                          />
                        </div>
                    </section>

                    <section className="space-y-3 px-1">
                      <h3 className="text-lg font-semibold text-slate-950">Quick actions</h3>
                      <div className="grid gap-2">
                        <Button variant="outline" className="justify-start rounded-2xl border-slate-200 bg-slate-50" onClick={handleDuplicate}>
                          <Copy className="mr-2 h-4 w-4" />
                          Duplicate node
                        </Button>
                        <Button
                          variant="outline"
                          className="justify-start rounded-2xl border-slate-200 bg-slate-50"
                          onClick={() => {
                            setPendingParentId(selectedNode.id);
                            appendConsole(`Choose a node to place after ${selectedNode.data.label}.`);
                          }}
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Add child node
                        </Button>
                        <Button variant="destructive" className="justify-start rounded-2xl" onClick={handleDelete}>
                          <Trash2 className="mr-2 h-4 w-4" />
                          Remove node
                        </Button>
                      </div>
                    </section>
                  </>
                ) : null}
              </div>
            </ScrollArea>
          </aside>
          ) : null}
        </div>

        {showDebugger ? (
          <div className="border-t border-white/70 bg-white/88 shadow-[0_-20px_60px_rgba(15,23,42,0.06)] backdrop-blur-xl">
            <div className="flex items-center justify-between gap-4 px-5 py-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Debugger</p>
                <h2 className="text-sm font-semibold text-slate-950">Run console</h2>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" className="rounded-full border-slate-200 bg-white" onClick={() => setConsoleLines([])}>
                  Clear logs
                </Button>
                <Button variant="outline" className="rounded-full border-slate-200 bg-white" onClick={() => setShowDebugger(false)}>
                  Hide
                </Button>
              </div>
            </div>

            <ScrollArea className="h-52 border-t border-slate-100">
              <div className="space-y-2 px-5 py-4 font-mono text-[12px]">
                {consoleLines.length === 0 ? (
                  <div className="flex h-40 items-center justify-center rounded-[1.4rem] border border-dashed border-slate-200 bg-slate-50 text-slate-400">
                    No debugger output yet.
                  </div>
                ) : (
                  consoleLines.map((line, index) => (
                    <div key={`${line}-${index}`} className="rounded-xl bg-slate-50 px-3 py-2 text-slate-700">
                      {line}
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        ) : null}
      </div>

      <style jsx global>{`
        .pipeline-editor-flow .react-flow__node {
          background: transparent;
          border: 0;
        }

        .pipeline-editor-flow .react-flow__node.selected,
        .pipeline-editor-flow .react-flow__node:focus,
        .pipeline-editor-flow .react-flow__node:focus-visible {
          box-shadow: none;
          outline: none;
        }

        .pipeline-editor-flow .react-flow__edge-path {
          stroke-linecap: round;
        }

        .pipeline-editor-flow .react-flow__handle {
          box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.9);
        }

        .pipeline-editor-flow .react-flow__controls-button {
          border-bottom-color: rgba(148, 163, 184, 0.18);
          background: rgba(255, 255, 255, 0.96);
          color: rgb(15, 23, 42);
        }
      `}</style>
    </div>
  );
}

export default function PipelineEditor(props: PipelineEditorProps) {
  return (
    <ReactFlowProvider>
      <PipelineEditorCanvas {...props} />
    </ReactFlowProvider>
  );
}
