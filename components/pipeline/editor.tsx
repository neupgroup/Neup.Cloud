'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  Background,
  Controls,
  MarkerType,
  PanOnScrollMode,
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
  Check,
  CircleSlash,
  Loader2,
  Play,
  RefreshCcw,
  Save,
  Square,
  TerminalSquare,
  Workflow,
} from 'lucide-react';

import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';
import { savePipelineFlowAction } from '@/app/pipeline/actions';
import {
  executeAiAgentNodeAction,
  getAiAgentValidationError,
} from '@/components/pipeline/node/intelligence.aiagent';
import {
  buildSharedNodeReferenceValue,
  createNodeReferenceId,
  getNodeType,
  getNodeTypeLabel,
  getSharedNodeInspectorInfo,
  PendingBranchAnchor,
  PipelineNodeCard,
  type PipelineNodeKind,
  type PipelineNodeKeyValueEntry,
  type PipelineNodeStatus,
  type PipelineNodeModule,
  type PipelineNodeRecord,
  type PipelineSharedNodeData,
  createKeyValueEntry,
  normalizePipelineKeyValueEntries,
  rebuildReferenceIdFromLabel,
} from '@/components/pipeline/node/interface';
import { PipelineSidebar } from '@/components/pipeline/pipeline-sidebar';
import {
  pipelineNodeCategories,
  pipelineNodeModuleMap,
} from '@/components/pipeline/node/registry';
import {
  createPipelineIntelligenceContext,
  type PipelineIntelligenceModel,
  type PipelineIntelligencePrompt,
  type PipelineIntelligenceToken,
} from '@/components/pipeline/node/intelligence.shared';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { PipelineContextMenu } from '@/components/pipeline/pipeline-context-menu';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

type HttpBodyType = 'none' | 'json' | 'form' | 'raw';

type HttpResponseType = 'json' | 'text' | 'html';

type PipelineNodeData = PipelineSharedNodeData & {
  httpMethod?: HttpMethod;
  httpUrl?: string;
  httpQueryParams?: PipelineNodeKeyValueEntry[];
  httpHeaders?: PipelineNodeKeyValueEntry[];
  httpCookies?: PipelineNodeKeyValueEntry[];
  httpBodyType?: HttpBodyType;
  httpBody?: string;
  httpTimeoutMs?: number | null;
  httpResponseType?: HttpResponseType;
  httpLastResponseStatus?: number | null;
  httpLastResponseHeaders?: PipelineNodeKeyValueEntry[];
  httpLastResponseBody?: string;
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
};

type PipelineFlowNode = Node<PipelineNodeData>;

type PendingConnectionDraft = {
  parentId: string;
  placeholderId: string;
  position: { x: number; y: number };
};

type PendingCanvasNodeDraft = {
  position: { x: number; y: number };
};

type PipelineContextMenuState =
  | {
      x: number;
      y: number;
      target: 'pane';
      flowPosition: { x: number; y: number };
    }
  | {
      x: number;
      y: number;
      target: 'node';
      nodeId: string;
    };

type PipelineEditorProps = {
  intelligenceModels: PipelineIntelligenceModel[];
  intelligencePrompts: PipelineIntelligencePrompt[];
  intelligenceTokens: PipelineIntelligenceToken[];
  initialPipeline?: {
    id: string;
    title: string;
    description: string | null;
    flowJson: unknown;
  } | null;
};

const STORAGE_KEY = 'neup-cloud-pipeline-editor-v2';
const nodeCategories = pipelineNodeCategories.map((category) => ({
  ...category,
  templates: Array.from(pipelineNodeModuleMap.values())
    .map((module) => module.definition)
    .filter((definition) => definition.type === category.id),
}));

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
  const baseValue = buildSharedNodeReferenceValue(node.data, node.id);
  const module = pipelineNodeModuleMap.get(node.data.kind) as PipelineNodeModule<PipelineNodeRecord> | undefined;

  return {
    ...baseValue,
    ...(module?.buildReferenceValue?.(node as unknown as { id: string; data: PipelineNodeRecord }) ?? {}),
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
  const fields = [
    'id',
    'nodeId',
    'title',
    'subtitle',
    'description',
    'summary',
    'category',
    'kind',
    'type',
    'nodeType',
    'nodeName',
    'kindLabel',
    'status',
    'activity',
  ];
  const module = pipelineNodeModuleMap.get(node.data.kind);

  return [...fields, ...(module?.getReferenceFields?.() ?? [])];
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
        ...((pipelineNodeModuleMap.get(node.data.kind)?.getInitialData?.() as Partial<PipelineNodeData> | undefined) ?? {}),
        ...node.data,
        nodeType: node.data.nodeType ?? getNodeType(node.data.kind),
        ...(node.data.kind === 'http'
          ? {
              httpQueryParams: normalizePipelineKeyValueEntries(node.data.httpQueryParams),
              httpHeaders: normalizePipelineKeyValueEntries(node.data.httpHeaders),
              httpCookies: normalizePipelineKeyValueEntries(node.data.httpCookies),
              httpLastResponseHeaders: normalizePipelineKeyValueEntries(node.data.httpLastResponseHeaders),
            }
          : {}),
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
      nodeType: 'triggers',
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
      nodeType: 'actions',
      category: 'Actions',
      description: 'Pull lead metadata from the upstream CRM endpoint.',
      summary: 'The flow enriches the raw trigger payload before scoring it.',
      subtitle: 'External API',
      status: 'idle',
      activity: 'Ready to request remote data.',
      httpMethod: 'GET',
      httpUrl: 'https://api.example.com/leads',
      httpQueryParams: [],
      httpHeaders: [createKeyValueEntry('Accept', 'application/json')],
      httpCookies: [],
      httpBodyType: 'none',
      httpBody: '',
      httpTimeoutMs: 30000,
      httpResponseType: 'json',
      httpLastResponseStatus: null,
      httpLastResponseHeaders: [],
      httpLastResponseBody: '',
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
      nodeType: 'intelligence',
      category: 'Intelligence',
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
      nodeType: 'integration',
      category: 'Integration',
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

function parseStoredFlow(flowJson: unknown): { nodes: PipelineFlowNode[]; edges: Edge[] } | null {
  if (!flowJson || typeof flowJson !== 'object') {
    return null;
  }

  const candidate = flowJson as {
    nodes?: PipelineFlowNode[];
    edges?: Edge[];
  };

  if (!Array.isArray(candidate.nodes) || !Array.isArray(candidate.edges) || candidate.nodes.length === 0) {
    return null;
  }

  return {
    nodes: ensureReferenceIds(candidate.nodes),
    edges: candidate.edges,
  };
}

function derivePipelineTitle(
  nodes: PipelineFlowNode[],
  existingTitle: string | null | undefined
): string {
  const trimmedTitle = existingTitle?.trim();

  if (trimmedTitle) {
    return trimmedTitle;
  }

  const preferredNode =
    nodes.find((node) => !node.data.pending && node.data.kind !== 'manualStart') ??
    nodes.find((node) => !node.data.pending) ??
    null;

  return preferredNode?.data.label?.trim()
    ? `${preferredNode.data.label.trim()} Pipeline`
    : 'Untitled Pipeline';
}

function derivePipelineDescription(
  nodes: PipelineFlowNode[],
  existingDescription: string | null | undefined
): string | null {
  const trimmedDescription = existingDescription?.trim();

  if (trimmedDescription) {
    return trimmedDescription;
  }

  const describedNode = nodes.find((node) => !node.data.pending && node.data.description?.trim()) ?? null;

  return describedNode?.data.description?.trim() || null;
}

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

function createNode(
  kind: PipelineNodeKind,
  position: { x: number; y: number },
  overrides?: Partial<PipelineNodeData>
): PipelineFlowNode {
  const module = pipelineNodeModuleMap.get(kind);
  const template = module?.definition;
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
      nodeType: template?.type ?? getNodeType(kind),
      category: template?.category ?? 'Custom',
      description: template?.description ?? 'Configure this step.',
      summary: template?.summary ?? 'Workflow node.',
      subtitle: template?.subtitle ?? 'Automation step',
      status: 'idle',
      activity: `Ready to run ${template?.label?.toLowerCase() ?? 'node'}.`,
      ...((module?.getInitialData?.() as Partial<PipelineNodeData> | undefined) ?? {}),
      ...restOverrides,
      ...(kind === 'http'
        ? {
            httpQueryParams: normalizePipelineKeyValueEntries(restOverrides.httpQueryParams),
            httpHeaders: normalizePipelineKeyValueEntries(restOverrides.httpHeaders),
            httpCookies: normalizePipelineKeyValueEntries(restOverrides.httpCookies),
            httpLastResponseHeaders: normalizePipelineKeyValueEntries(restOverrides.httpLastResponseHeaders),
          }
        : {}),
    },
  };
}

function PipelineCanvasNode({ data, selected }: NodeProps<PipelineNodeData>) {
  const template = pipelineNodeModuleMap.get(data.kind)?.definition;
  const Icon = template?.icon ?? Workflow;
  const status = getStatusAppearance(data.status);
  const typeLabel = getNodeTypeLabel(data.kind);

  return (
    <PipelineNodeCard
      selected={selected}
      title={data.label}
      subtitle={data.subtitle}
      typeLabel={typeLabel}
      icon={Icon}
      toneClassName={getNodeTone(data.kind).header}
      frameClassName={status.frame}
      statusClassName={status.pill}
    />
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

function PipelineEditorCanvas({
  intelligenceModels,
  intelligencePrompts,
  intelligenceTokens,
  initialPipeline,
}: PipelineEditorProps) {
  const router = useRouter();
  const { screenToFlowPosition } = useReactFlow<PipelineNodeData>();
  const initialFlow = useMemo(
    () => parseStoredFlow(initialPipeline?.flowJson) ?? { nodes: initialNodes, edges: initialEdges },
    [initialPipeline]
  );
  const [nodes, setNodes, onNodesChange] = useNodesState<PipelineNodeData>(initialFlow.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialFlow.edges);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialFlow.nodes.find((node) => !node.data.pending)?.id ?? null
  );
  const [activeCategory, setActiveCategory] = useState(nodeCategories[0].id);
  const [search, setSearch] = useState('');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [persistedPipeline, setPersistedPipeline] = useState<{
    id: string;
    title: string;
    description: string | null;
  } | null>(
    initialPipeline
      ? {
          id: initialPipeline.id,
          title: initialPipeline.title,
          description: initialPipeline.description,
        }
      : null
  );
  const [isRunning, setIsRunning] = useState(false);
  const [pendingParentId, setPendingParentId] = useState<string | null>(null);
  const [pendingConnection, setPendingConnection] = useState<PendingConnectionDraft | null>(null);
  const [pendingCanvasNode, setPendingCanvasNode] = useState<PendingCanvasNodeDraft | null>(null);
  const [referenceSaveNotice, setReferenceSaveNotice] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<PipelineContextMenuState | null>(null);
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
    if (initialPipeline) {
      setPersistedPipeline({
        id: initialPipeline.id,
        title: initialPipeline.title,
        description: initialPipeline.description,
      });
    }
  }, [initialPipeline]);

  useEffect(() => {
    if (initialPipeline) {
      setConsoleLines((current) => [...current, `Loaded "${initialPipeline.title}" from the database.`]);
      return;
    }

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
  }, [initialPipeline, setEdges, setNodes]);

  useEffect(() => {
    if (!contextMenu) {
      return;
    }

    const handlePointerDown = () => {
      setContextMenu(null);
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setContextMenu(null);
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleEscape);

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [contextMenu]);

  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedId && !node.data.pending) ?? null,
    [nodes, selectedId]
  );
  const intelligence = useMemo(
    () =>
      createPipelineIntelligenceContext({
        models: intelligenceModels,
        prompts: intelligencePrompts,
        tokens: intelligenceTokens,
      }),
    [intelligenceModels, intelligencePrompts, intelligenceTokens]
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

  const selectedNodeModule = useMemo(
    () => (selectedNode ? pipelineNodeModuleMap.get(selectedNode.data.kind) ?? null : null),
    [selectedNode]
  );
  const selectedNodeInspectorInfo = useMemo(
    () => (selectedNode ? getSharedNodeInspectorInfo(selectedNode.data) : null),
    [selectedNode]
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

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const openCanvasNodeLibrary = useCallback(
    (position: { x: number; y: number }) => {
      clearPendingConnection();
      setPendingCanvasNode({ position });
      setPendingParentId(null);
      setSelectedId(null);
      setActiveCategory('actions');
      setSearch('');
      appendConsole('Choose a node from the sidebar to place it on the canvas.');
    },
    [appendConsole, clearPendingConnection]
  );

  const openChildNodeLibrary = useCallback(
    (nodeId: string) => {
      clearPendingConnection();
      setPendingCanvasNode(null);
      setPendingParentId(nodeId);
      setSelectedId(nodeId);
      setActiveCategory('actions');
      setSearch('');
      const nodeLabel = nodes.find((node) => node.id === nodeId)?.data.label ?? 'selected node';
      appendConsole(`Choose a node to place after ${nodeLabel}.`);
    },
    [appendConsole, clearPendingConnection, nodes]
  );

  useEffect(() => {
    const handleAddChild = (event: Event) => {
      const detail = (event as CustomEvent<{ nodeId: string }>).detail;
      openChildNodeLibrary(detail.nodeId);
    };

    window.addEventListener('pipeline:add-child', handleAddChild);
    return () => window.removeEventListener('pipeline:add-child', handleAddChild);
  }, [openChildNodeLibrary]);

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
            nodeType: 'logic',
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

  const handleSave = useCallback(async () => {
    const cleanNodes = nodes.filter((node) => !node.data.pending);
    const cleanEdges = edges.filter(
      (edge) => !edge.source.startsWith('pending-anchor-') && !edge.target.startsWith('pending-anchor-')
    );

    setSaveState('saving');
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        nodes: cleanNodes,
        edges: cleanEdges,
      })
    );

    const title = derivePipelineTitle(
      cleanNodes,
      persistedPipeline?.title ?? initialPipeline?.title ?? null
    );
    const description = derivePipelineDescription(
      cleanNodes,
      persistedPipeline?.description ?? initialPipeline?.description ?? null
    );

    try {
      const savedPipeline = await savePipelineFlowAction({
        pipelineId: persistedPipeline?.id ?? initialPipeline?.id ?? null,
        title,
        description,
        flowJson: {
          nodes: cleanNodes,
          edges: cleanEdges,
        },
      });

      setPersistedPipeline(savedPipeline);
      appendConsole(`Saved "${savedPipeline.title}" to the database.`);
      setReferenceSaveNotice(null);
      setSaveState('saved');

      if ((persistedPipeline?.id ?? initialPipeline?.id ?? null) !== savedPipeline.id) {
        router.replace(`/pipeline/editor?id=${savedPipeline.id}`);
      }

      window.setTimeout(() => setSaveState('idle'), 1400);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save the pipeline.';
      appendConsole(`Pipeline save failed: ${message}`);
      setSaveState('idle');
    }
  }, [appendConsole, edges, initialPipeline?.description, initialPipeline?.id, initialPipeline?.title, nodes, persistedPipeline, router]);

  const handleReset = useCallback(() => {
    setNodes(initialFlow.nodes);
    setEdges(initialFlow.edges);
    setSelectedId(initialFlow.nodes.find((node) => !node.data.pending)?.id ?? null);
    setPendingParentId(null);
    setPendingConnection(null);
    setPendingCanvasNode(null);
    setContextMenu(null);
    setReferenceSaveNotice(null);
    window.localStorage.removeItem(STORAGE_KEY);
    appendConsole(initialPipeline ? 'Reset the editor back to the loaded pipeline.' : 'Reset the editor back to the starter flow.');
  }, [appendConsole, initialFlow.edges, initialFlow.nodes, initialPipeline, setEdges, setNodes]);

  const handleAddNode = useCallback(
    (kind: PipelineNodeKind) => {
      const parentId = pendingConnection?.parentId ?? pendingParentId ?? selectedId;
      const parentNode = parentId ? nodes.find((node) => node.id === parentId) ?? null : null;
      const nextPosition = pendingConnection
        ? pendingConnection.position
        : pendingCanvasNode
          ? pendingCanvasNode.position
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
      setPendingCanvasNode(null);
      setContextMenu(null);
    },
    [appendConsole, edges, nodes, pendingCanvasNode, pendingConnection, pendingParentId, selectedId, setEdges, setNodes]
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
    setPendingCanvasNode(null);
    setSelectedId(null);
    setContextMenu(null);
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

  const addSelectedCollectionEntry = useCallback(
    (field: string) => {
      if (!selectedId) {
        return;
      }

      setNodes((currentNodes) =>
        currentNodes.map((node) => {
          if (node.id !== selectedId) {
            return node;
          }

          const currentEntries = normalizePipelineKeyValueEntries(
            (node.data as Record<string, unknown>)[field] as PipelineNodeKeyValueEntry[] | undefined
          );

          return {
            ...node,
            data: {
              ...node.data,
              [field]: [...currentEntries, createKeyValueEntry()],
            },
          };
        })
      );
    },
    [selectedId, setNodes]
  );

  const updateSelectedCollectionEntry = useCallback(
    (field: string, entryId: string, patch: Partial<PipelineNodeKeyValueEntry>) => {
      if (!selectedId) {
        return;
      }

      setNodes((currentNodes) =>
        currentNodes.map((node) => {
          if (node.id !== selectedId) {
            return node;
          }

          const nextEntries = normalizePipelineKeyValueEntries(
            (node.data as Record<string, unknown>)[field] as PipelineNodeKeyValueEntry[] | undefined
          ).map((entry) =>
            entry.id === entryId ? { ...entry, ...patch } : entry
          );

          return {
            ...node,
            data: {
              ...node.data,
              [field]: nextEntries,
            },
          };
        })
      );
    },
    [selectedId, setNodes]
  );

  const removeSelectedCollectionEntry = useCallback(
    (field: string, entryId: string) => {
      if (!selectedId) {
        return;
      }

      setNodes((currentNodes) =>
        currentNodes.map((node) => {
          if (node.id !== selectedId) {
            return node;
          }

          const nextEntries = normalizePipelineKeyValueEntries(
            (node.data as Record<string, unknown>)[field] as PipelineNodeKeyValueEntry[] | undefined
          ).filter((entry) => entry.id !== entryId);

          return {
            ...node,
            data: {
              ...node.data,
              [field]: nextEntries,
            },
          };
        })
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

      const validationError = getAiAgentValidationError(
        node.data as PipelineNodeRecord,
        intelligence
      );

      if (validationError) {
        setNodeWarning(node.id, validationError);
        appendConsole(`AI Agent "${node.data.label}" needs configuration: ${validationError}`);
        return false;
      }

      const actionInput = {
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
        const result = await executeAiAgentNodeAction(actionInput);
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
    [appendConsole, intelligence, nodes, setNodeWarning, setNodes]
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

  const isLibraryMode = Boolean(pendingParentId || pendingConnection || pendingCanvasNode);
  const shouldShowSidebar = Boolean(selectedNode || isLibraryMode);
  const selectedNodeInspectorArgs = useMemo(
    () =>
      selectedNode
        ? {
            node: selectedNode as unknown as { id: string; data: PipelineNodeRecord },
            updateNode: (patch: Partial<PipelineNodeRecord>) => {
              updateSelectedNode(patch as Partial<PipelineNodeData>);
            },
            updateNodeLabel: (label: string) => {
              updateSelectedNodeLabel(label);
            },
            clearWarning: () => {
              clearNodeWarning(selectedNode.id);
            },
            executeNode: async () => {
              if (selectedNode.data.kind === 'aiAgent') {
                await executeAiAgentNode(selectedNode);
              }
            },
            normalizeKeyValueEntries: normalizePipelineKeyValueEntries,
            addCollectionEntry: addSelectedCollectionEntry,
            updateCollectionEntry: updateSelectedCollectionEntry,
            removeCollectionEntry: removeSelectedCollectionEntry,
            intelligence,
          }
        : null,
    [
      addSelectedCollectionEntry,
      clearNodeWarning,
      executeAiAgentNode,
      intelligence,
      removeSelectedCollectionEntry,
      selectedNode,
      updateSelectedCollectionEntry,
      updateSelectedNode,
      updateSelectedNodeLabel,
    ]
  );

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
                closeContextMenu();
                clearPendingConnection();
                setPendingCanvasNode(null);
                setSelectedId(node.id);
                setPendingParentId(null);
              }}
              onNodeContextMenu={(event, node) => {
                event.preventDefault();
                event.stopPropagation();
                setSelectedId(node.id);
                setContextMenu({
                  x: event.clientX,
                  y: event.clientY,
                  target: 'node',
                  nodeId: node.id,
                });
              }}
              onPaneClick={() => {
                if (ignoreNextPaneClickRef.current) {
                  return;
                }

                closeContextMenu();
                clearPendingConnection();
                setPendingCanvasNode(null);
                setSelectedId(null);
                setPendingParentId(null);
              }}
              onPaneContextMenu={(event) => {
                event.preventDefault();
                const pointerPosition = { x: event.clientX, y: event.clientY };
                clearPendingConnection();
                setPendingCanvasNode(null);
                setPendingParentId(null);
                setSelectedId(null);
                setContextMenu({
                  x: event.clientX,
                  y: event.clientY,
                  target: 'pane',
                  flowPosition: screenToFlowPosition(pointerPosition),
                });
              }}
              className="pipeline-editor-flow bg-transparent"
              proOptions={{ hideAttribution: true }}
            >
              <Background gap={22} size={1.1} color="hsl(var(--border))" />
              <Controls className="!rounded-2xl !border !border-white/70 !bg-white/95 !shadow-xl" position="bottom-right" />
            </ReactFlow>
          </main>

          {shouldShowSidebar ? (
            <PipelineSidebar
              isLibraryMode={isLibraryMode}
              search={search}
              onSearchChange={setSearch}
              activeCategory={activeCategory}
              onActiveCategoryChange={setActiveCategory}
              nodeCategories={nodeCategories}
              filteredTemplatesByCategory={filteredTemplatesByCategory}
              matchingTemplateCount={matchingTemplateCount}
              libraryMode={pendingParentId || pendingConnection ? 'child' : 'canvas'}
              parentNodeLabel={
                pendingParentId || pendingConnection
                  ? nodes.find((node) => node.id === (pendingConnection?.parentId ?? pendingParentId))?.data.label ??
                    'selected node'
                  : null
              }
              onAddNode={handleAddNode}
              selectedNode={selectedNode ? ({ id: selectedNode.id, data: selectedNode.data } as const) : null}
              selectedNodeInspectorInfo={selectedNodeInspectorInfo}
              referenceSaveNotice={referenceSaveNotice}
              selectedNodeModule={selectedNodeModule}
              selectedNodeInspectorArgs={selectedNodeInspectorArgs}
              onUpdateBasicsName={(value) => {
                if (!selectedNode) {
                  return;
                }

                clearNodeWarning(selectedNode.id);
                updateSelectedNodeLabel(value);
              }}
              onUpdateBasicsDescription={(value) => {
                if (!selectedNode) {
                  return;
                }

                clearNodeWarning(selectedNode.id);
                updateSelectedNode({ description: value });
              }}
              onAddChild={() => {
                if (!selectedNode) {
                  return;
                }

                setPendingParentId(selectedNode.id);
                appendConsole(`Choose a node to place after ${selectedNode.data.label}.`);
              }}
              onDuplicate={handleDuplicate}
              onDelete={handleDelete}
              getNodeTone={getNodeTone}
            />
          ) : null}
        </div>

        {contextMenu ? (
          <PipelineContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            items={
              contextMenu.target === 'node'
                ? [
                    {
                      id: 'add-child-node',
                      label: 'Add child node',
                      icon: 'branch',
                      onSelect: () => {
                        openChildNodeLibrary(contextMenu.nodeId);
                        closeContextMenu();
                      },
                    },
                  ]
                : [
                    {
                      id: 'add-node',
                      label: 'Add a node',
                      icon: 'add',
                      onSelect: () => {
                        openCanvasNodeLibrary(contextMenu.flowPosition);
                        closeContextMenu();
                      },
                    },
                  ]
            }
          />
        ) : null}

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
