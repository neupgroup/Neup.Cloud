'use client';

import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { KeyValueListEditor, definePipelineNodeModule, type PipelineNodeInspectorArgs, type PipelineNodeKeyValueEntry, type PipelineNodeRecord } from '@/components/pipeline/node/interface';
import { Textarea } from '@/components/ui/textarea';
import { Globe } from 'lucide-react';

type HttpNodeData = PipelineNodeRecord & {
  httpMethod?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  httpUrl?: string;
  httpQueryParams?: PipelineNodeKeyValueEntry[];
  httpHeaders?: PipelineNodeKeyValueEntry[];
  httpCookies?: PipelineNodeKeyValueEntry[];
  httpBodyType?: 'none' | 'json' | 'form' | 'raw';
  httpBody?: string;
  httpTimeoutMs?: number | null;
  httpResponseType?: 'json' | 'text' | 'html';
  httpLastResponseStatus?: number | null;
  httpLastResponseHeaders?: PipelineNodeKeyValueEntry[];
  httpLastResponseBody?: string;
};

const HTTP_METHOD_OPTIONS: HttpNodeData['httpMethod'][] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

const HTTP_BODY_TYPE_OPTIONS: Array<{ value: NonNullable<HttpNodeData['httpBodyType']>; label: string }> = [
  { value: 'none', label: 'No body' },
  { value: 'json', label: 'JSON' },
  { value: 'form', label: 'Form data' },
  { value: 'raw', label: 'Raw text' },
];

const HTTP_RESPONSE_TYPE_OPTIONS: Array<{ value: NonNullable<HttpNodeData['httpResponseType']>; label: string }> = [
  { value: 'json', label: 'JSON' },
  { value: 'text', label: 'Plain text' },
  { value: 'html', label: 'HTML' },
];

function coerceStructuredValue(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return '';
  }

  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return value;
    }
  }

  return value;
}

function buildKeyValueObject(entries: PipelineNodeKeyValueEntry[] = []) {
  return Object.fromEntries(entries.filter((entry) => entry.key.trim()).map((entry) => [entry.key, entry.value]));
}

function buildKeyValueCollection(entries: PipelineNodeKeyValueEntry[] = []) {
  return entries.filter((entry) => entry.key.trim() || entry.value.trim()).map((entry) => ({
    key: entry.key,
    value: entry.value,
  }));
}

function buildHttpBodyValue(node: HttpNodeData): unknown {
  if ((node.httpBodyType ?? 'none') === 'json') {
    return coerceStructuredValue(node.httpBody ?? '');
  }

  return node.httpBody ?? '';
}

function HttpNodeOptions({ node, updateNode, normalizeKeyValueEntries, addCollectionEntry, updateCollectionEntry, removeCollectionEntry }: PipelineNodeInspectorArgs<HttpNodeData>) {
  return (
    <section className="space-y-5 px-1">
      <h3 className="text-lg font-semibold text-slate-950">Node options</h3>

      <div className="space-y-2">
        <label className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Request URL
        </label>
        <Input
          value={node.data.httpUrl ?? ''}
          onChange={(event) => updateNode({ httpUrl: event.target.value })}
          placeholder="https://api.example.com/resource"
          className="rounded-2xl border-slate-200 bg-slate-50"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Request type
          </label>
          <select
            value={node.data.httpMethod ?? 'GET'}
            onChange={(event) => updateNode({ httpMethod: event.target.value as HttpNodeData['httpMethod'] })}
            className="flex h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-950 outline-none"
          >
            {HTTP_METHOD_OPTIONS.map((method) => (
              <option key={method} value={method}>
                {method}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Response type
          </label>
          <select
            value={node.data.httpResponseType ?? 'json'}
            onChange={(event) => updateNode({ httpResponseType: event.target.value as HttpNodeData['httpResponseType'] })}
            className="flex h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-950 outline-none"
          >
            {HTTP_RESPONSE_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <KeyValueListEditor
        title="Query params"
        description=""
        entries={normalizeKeyValueEntries(node.data.httpQueryParams)}
        addLabel="Add param"
        keyPlaceholder="Param name"
        valuePlaceholder="Value"
        onAdd={() => addCollectionEntry('httpQueryParams')}
        onChange={(entryId, patch) => updateCollectionEntry('httpQueryParams', entryId, patch)}
        onRemove={(entryId) => removeCollectionEntry('httpQueryParams', entryId)}
      />

      <KeyValueListEditor
        title="Headers"
        description=""
        entries={normalizeKeyValueEntries(node.data.httpHeaders)}
        addLabel="Add header"
        keyPlaceholder="Header name"
        valuePlaceholder="Header value"
        onAdd={() => addCollectionEntry('httpHeaders')}
        onChange={(entryId, patch) => updateCollectionEntry('httpHeaders', entryId, patch)}
        onRemove={(entryId) => removeCollectionEntry('httpHeaders', entryId)}
      />

      <KeyValueListEditor
        title="Cookies"
        description=""
        entries={normalizeKeyValueEntries(node.data.httpCookies)}
        addLabel="Add cookie"
        keyPlaceholder="Cookie name"
        valuePlaceholder="Cookie value"
        onAdd={() => addCollectionEntry('httpCookies')}
        onChange={(entryId, patch) => updateCollectionEntry('httpCookies', entryId, patch)}
        onRemove={(entryId) => removeCollectionEntry('httpCookies', entryId)}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Body type
          </label>
          <select
            value={node.data.httpBodyType ?? 'none'}
            onChange={(event) => updateNode({ httpBodyType: event.target.value as HttpNodeData['httpBodyType'] })}
            className="flex h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-950 outline-none"
          >
            {HTTP_BODY_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Timeout
          </label>
          <Input
            type="number"
            min={0}
            value={node.data.httpTimeoutMs ?? ''}
            onChange={(event) => updateNode({ httpTimeoutMs: event.target.value ? Number(event.target.value) : null })}
            placeholder="30000"
            className="rounded-2xl border-slate-200 bg-slate-50"
          />
        </div>
      </div>

      {node.data.httpBodyType !== 'none' ? (
        <div className="space-y-2">
          <label className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Request body
          </label>
          <Textarea
            value={node.data.httpBody ?? ''}
            onChange={(event) => updateNode({ httpBody: event.target.value })}
            placeholder={
              node.data.httpBodyType === 'json'
                ? '{\n  "leadId": "{{manualstart_1201.id}}"\n}'
                : node.data.httpBodyType === 'form'
                  ? 'name=Acme&status=qualified'
                  : 'Raw request payload'
            }
            className="min-h-[130px] rounded-2xl border-slate-200 bg-slate-50 font-mono text-sm"
          />
        </div>
      ) : null}
    </section>
  );
}

function HttpNodeResponse({ node, normalizeKeyValueEntries }: PipelineNodeInspectorArgs<HttpNodeData>) {
  if (!node.data.httpLastResponseStatus && !node.data.httpLastResponseBody?.trim()) {
    return null;
  }

  return (
    <section className="space-y-4 px-1">
      <h3 className="text-lg font-semibold text-slate-950">Response</h3>
      <div className="space-y-3 rounded-[1.4rem] border border-slate-200 bg-slate-50/80 p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-slate-900">HTTP response</p>
          {node.data.httpLastResponseStatus ? (
            <Badge className="rounded-full border border-slate-200 bg-white text-slate-700 hover:bg-white">
              Status {node.data.httpLastResponseStatus}
            </Badge>
          ) : null}
        </div>

        {normalizeKeyValueEntries(node.data.httpLastResponseHeaders).length > 0 ? (
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Response headers
            </p>
            <div className="space-y-1 text-sm text-slate-700">
              {normalizeKeyValueEntries(node.data.httpLastResponseHeaders).map((entry) => (
                <p key={entry.id}>
                  <span className="font-medium text-slate-900">{entry.key}</span>: {entry.value}
                </p>
              ))}
            </div>
          </div>
        ) : null}

        {node.data.httpLastResponseBody?.trim() ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Response body
            </p>
            <p className="mt-2 whitespace-pre-wrap font-mono text-xs leading-5 text-slate-600">
              {node.data.httpLastResponseBody}
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}

export const httpRequestNodeModule = definePipelineNodeModule<HttpNodeData>({
  definition: {
    kind: 'http',
    type: 'actions',
    label: 'HTTP Request',
    subtitle: 'External API',
    category: 'Actions',
    description: 'Call a service, webhook, or private API endpoint.',
    summary: 'Use it to fetch data, post payloads, or trigger downstream systems.',
    icon: Globe,
  },
  getInitialData: () => ({
    httpMethod: 'GET',
    httpUrl: '',
    httpQueryParams: [],
    httpHeaders: [],
    httpCookies: [],
    httpBodyType: 'none',
    httpBody: '',
    httpTimeoutMs: 30000,
    httpResponseType: 'json',
    httpLastResponseStatus: null,
    httpLastResponseHeaders: [],
    httpLastResponseBody: '',
  }),
  getReferenceFields: () => [
    'method',
    'url',
    'queryParams',
    'headers',
    'cookies',
    'bodyType',
    'body',
    'timeoutMs',
    'responseType',
    'request',
    'response',
    'responseStatus',
    'responseHeaders',
    'responseBody',
  ],
  buildReferenceValue: (node) => ({
    method: node.data.httpMethod ?? 'GET',
    url: node.data.httpUrl ?? '',
    queryParams: buildKeyValueCollection(node.data.httpQueryParams),
    headers: buildKeyValueCollection(node.data.httpHeaders),
    cookies: buildKeyValueCollection(node.data.httpCookies),
    bodyType: node.data.httpBodyType ?? 'none',
    body: buildHttpBodyValue(node.data),
    timeoutMs: node.data.httpTimeoutMs ?? null,
    responseType: node.data.httpResponseType ?? 'json',
    request: {
      method: node.data.httpMethod ?? 'GET',
      url: node.data.httpUrl ?? '',
      queryParams: buildKeyValueObject(node.data.httpQueryParams),
      headers: buildKeyValueObject(node.data.httpHeaders),
      cookies: buildKeyValueObject(node.data.httpCookies),
      bodyType: node.data.httpBodyType ?? 'none',
      body: buildHttpBodyValue(node.data),
      timeoutMs: node.data.httpTimeoutMs ?? null,
      responseType: node.data.httpResponseType ?? 'json',
    },
    response: {
      status: node.data.httpLastResponseStatus ?? null,
      headers: buildKeyValueObject(node.data.httpLastResponseHeaders),
      body: coerceStructuredValue(node.data.httpLastResponseBody ?? ''),
    },
    responseStatus: node.data.httpLastResponseStatus ?? null,
    responseHeaders: buildKeyValueCollection(node.data.httpLastResponseHeaders),
    responseBody: coerceStructuredValue(node.data.httpLastResponseBody ?? ''),
  }),
  renderOptions: (args) => <HttpNodeOptions {...args} />,
  renderResponse: (args) => <HttpNodeResponse {...args} />,
});
