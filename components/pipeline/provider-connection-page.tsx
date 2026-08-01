'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  Check,
  ChevronRight,
  Chrome,
  Github,
  Linkedin,
  MessageCircle,
  RefreshCw,
  Trash2,
  Webhook,
} from 'lucide-react';

import {
  clearStoredProviderConnection,
  saveStoredProviderConnection,
  useProviderConnection,
  type PipelineProviderKey,
} from '@/components/pipeline/provider-connections';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';

type ProviderFieldDefinition = {
  id: string;
  label: string;
  placeholder: string;
  helper: string;
  type?: 'text' | 'password' | 'url';
  required?: boolean;
};

type ProviderConfig = {
  title: string;
  eyebrow: string;
  description: string;
  storageNote: string;
  icon: typeof MessageCircle;
  accent: string;
  fields: ProviderFieldDefinition[];
  supportedNodes: string[];
  samplePayload: string;
  steps: string[];
  webhook: {
    title: string;
    endpointPath: string;
    subscriptionEvents: string[];
    verificationField: string;
  } | null;
};

const providerConfigs: Record<PipelineProviderKey, ProviderConfig> = {
  whatsapp: {
    title: 'WhatsApp Cloud API',
    eyebrow: 'Pipeline Node Setup',
    description:
      'Configure the business phone, access token, and webhook values that power the WhatsApp receive, send, and react nodes.',
    storageNote:
      'This build stores the connection draft in browser storage so the editor and setup page can share state immediately.',
    icon: MessageCircle,
    accent: 'from-emerald-500 to-teal-500',
    fields: [
      {
        id: 'connectionName',
        label: 'Connection name',
        placeholder: 'Primary WhatsApp workspace',
        helper: 'Readable label shown inside the pipeline editor.',
        required: true,
      },
      {
        id: 'accessToken',
        label: 'Access token',
        placeholder: 'EAAG...',
        helper: 'Meta Cloud API permanent or system user token.',
        type: 'password',
        required: true,
      },
      {
        id: 'phoneNumberId',
        label: 'Phone number ID',
        placeholder: '123456789012345',
        helper: 'The WhatsApp phone number ID used for messaging.',
        required: true,
      },
      {
        id: 'businessAccountId',
        label: 'Business account ID',
        placeholder: '1029384756',
        helper: 'Useful for shared account identification and debugging.',
        required: true,
      },
      {
        id: 'verifyToken',
        label: 'Webhook verify token',
        placeholder: 'neup-whatsapp-verify-token',
        helper: 'Used when Meta verifies your callback URL.',
        required: true,
      },
      {
        id: 'appSecret',
        label: 'App secret',
        placeholder: 'Meta app secret',
        helper: 'Optional now, but useful when you later validate signatures.',
        type: 'password',
      },
      {
        id: 'webhookUrl',
        label: 'Webhook URL',
        placeholder: 'https://your-domain.com/api/pipeline/webhooks/whatsapp',
        helper: 'Paste the public callback URL you will register in Meta.',
        type: 'url',
        required: true,
      },
    ],
    supportedNodes: [
      'Trigger: Receive Message',
      'Action: Send Message',
      'Action: React Message',
    ],
    samplePayload: JSON.stringify(
      {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: '1029384756',
            changes: [
              {
                field: 'messages',
                value: {
                  messaging_product: 'whatsapp',
                  metadata: {
                    display_phone_number: '+1 202 555 0101',
                    phone_number_id: '123456789012345',
                  },
                  contacts: [
                    {
                      profile: { name: 'Aarav Sharma' },
                      wa_id: '9779800000000',
                    },
                  ],
                  messages: [
                    {
                      from: '9779800000000',
                      id: 'wamid.HBgMOTc3OTgwMDAwMDAwFQIAERgS',
                      timestamp: '1711469305',
                      type: 'text',
                      text: { body: 'Need pricing for your premium plan.' },
                    },
                  ],
                },
              },
            ],
          },
        ],
      },
      null,
      2
    ),
    steps: [
      'Create or open a Meta app with WhatsApp enabled.',
      'Copy the phone number ID, business account ID, and permanent access token.',
      'Register the webhook URL and use the same verify token saved here.',
      'Return to the editor and choose the WhatsApp nodes you want in the flow.',
    ],
    webhook: {
      title: 'Webhook subscription',
      endpointPath: '/api/pipeline/webhooks/whatsapp',
      subscriptionEvents: ['messages', 'message_template_status_update', 'message_reactions'],
      verificationField: 'verifyToken',
    },
  },
  google: {
    title: 'Google Workspace',
    eyebrow: 'Pipeline Node Setup',
    description:
      'Save a reusable Google connection for sample calendar, sheet, and workspace-oriented pipeline nodes.',
    storageNote:
      'The setup is intentionally lightweight here so the editor can reference a saved Google connection before a full OAuth flow exists.',
    icon: Chrome,
    accent: 'from-sky-500 to-cyan-500',
    fields: [
      {
        id: 'connectionName',
        label: 'Connection name',
        placeholder: 'Ops Google workspace',
        helper: 'Displayed inside the Google sample node.',
        required: true,
      },
      {
        id: 'workspaceEmail',
        label: 'Workspace email',
        placeholder: 'ops@company.com',
        helper: 'Helpful for identifying which Google account this node should use.',
        required: true,
      },
      {
        id: 'clientId',
        label: 'OAuth client ID',
        placeholder: 'google-client-id.apps.googleusercontent.com',
        helper: 'Used later when you wire a proper OAuth exchange.',
        required: true,
      },
      {
        id: 'clientSecret',
        label: 'OAuth client secret',
        placeholder: 'google-client-secret',
        helper: 'Saved locally in this browser for now.',
        type: 'password',
        required: true,
      },
      {
        id: 'refreshToken',
        label: 'Refresh token',
        placeholder: '1//0g...',
        helper: 'Optional for now, but useful for service testing.',
        type: 'password',
      },
    ],
    supportedNodes: ['Integration: Google sample node'],
    samplePayload: JSON.stringify(
      {
        provider: 'google',
        product: 'calendar',
        operation: 'create_event',
        calendarId: 'primary',
        summary: 'Customer follow-up',
      },
      null,
      2
    ),
    steps: [
      'Create a Google Cloud OAuth client or gather an existing service connection.',
      'Save the client credentials and workspace label on this page.',
      'Use the Google sample node to point at the correct product and operation.',
      'Replace the sample node with a dedicated Google integration later if needed.',
    ],
    webhook: null,
  },
  github: {
    title: 'GitHub',
    eyebrow: 'Pipeline Node Setup',
    description:
      'Prepare a GitHub connection for repository-driven pipeline experiments, including repo metadata and webhook-related settings.',
    storageNote:
      'This page stores a repo-scoped draft connection locally so the sample GitHub node can immediately reference it.',
    icon: Github,
    accent: 'from-slate-700 to-slate-900',
    fields: [
      {
        id: 'connectionName',
        label: 'Connection name',
        placeholder: 'Product engineering GitHub',
        helper: 'Friendly label shown in the node inspector.',
        required: true,
      },
      {
        id: 'personalAccessToken',
        label: 'Personal access token',
        placeholder: 'ghp_...',
        helper: 'Use a repo-scoped token for the workflows you plan to automate.',
        type: 'password',
        required: true,
      },
      {
        id: 'owner',
        label: 'Default owner',
        placeholder: 'neupgroup',
        helper: 'Organization or user namespace.',
        required: true,
      },
      {
        id: 'repository',
        label: 'Default repository',
        placeholder: 'neup.cloud',
        helper: 'Repo used by the sample node as a starting point.',
        required: true,
      },
      {
        id: 'webhookSecret',
        label: 'Webhook secret',
        placeholder: 'github-webhook-secret',
        helper: 'Optional until you add a real inbound GitHub webhook route.',
        type: 'password',
      },
    ],
    supportedNodes: ['Integration: GitHub sample node'],
    samplePayload: JSON.stringify(
      {
        action: 'opened',
        repository: {
          full_name: 'neupgroup/neup.cloud',
        },
        pull_request: {
          number: 48,
          title: 'Add WhatsApp pipeline nodes',
        },
      },
      null,
      2
    ),
    steps: [
      'Generate a personal access token or service token with the scopes you need.',
      'Save the default owner and repository that your flows usually target.',
      'Use the GitHub sample node to choose whether the step reads repo activity or triggers an action.',
      'Expand to a dedicated webhook endpoint later if you want inbound GitHub triggers.',
    ],
    webhook: {
      title: 'Optional webhook planning',
      endpointPath: '/api/pipeline/webhooks/github',
      subscriptionEvents: ['push', 'pull_request', 'issues'],
      verificationField: 'webhookSecret',
    },
  },
  linkedin: {
    title: 'LinkedIn',
    eyebrow: 'Pipeline Node Setup',
    description:
      'Save the LinkedIn credentials and account identity needed for posting or organization-level workflow experiments.',
    storageNote:
      'This page mirrors the rest of the sample connection centers and keeps its values in browser storage for now.',
    icon: Linkedin,
    accent: 'from-blue-600 to-sky-500',
    fields: [
      {
        id: 'connectionName',
        label: 'Connection name',
        placeholder: 'Brand LinkedIn account',
        helper: 'Shown in the LinkedIn node options.',
        required: true,
      },
      {
        id: 'accessToken',
        label: 'Access token',
        placeholder: 'linkedin-access-token',
        helper: 'User or organization token with the posting scopes you need.',
        type: 'password',
        required: true,
      },
      {
        id: 'accountType',
        label: 'Default account type',
        placeholder: 'organization',
        helper: 'Use "person" or "organization".',
        required: true,
      },
      {
        id: 'profileId',
        label: 'Profile or organization ID',
        placeholder: 'urn:li:organization:123456',
        helper: 'Saved as the default posting identity.',
        required: true,
      },
      {
        id: 'redirectUrl',
        label: 'OAuth redirect URL',
        placeholder: 'https://your-domain.com/api/pipeline/oauth/linkedin',
        helper: 'Useful reference when you wire a real OAuth callback.',
        type: 'url',
      },
    ],
    supportedNodes: ['Integration: LinkedIn sample node'],
    samplePayload: JSON.stringify(
      {
        author: 'urn:li:organization:123456',
        lifecycleState: 'PUBLISHED',
        specificContent: {
          'com.linkedin.ugc.ShareContent': {
            shareCommentary: {
              text: 'Launching our new WhatsApp automation pipeline today.',
            },
            shareMediaCategory: 'NONE',
          },
        },
        visibility: {
          'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
        },
      },
      null,
      2
    ),
    steps: [
      'Create or reuse a LinkedIn app with the required posting permissions.',
      'Save the access token and profile or organization identity here.',
      'Use the LinkedIn sample node to draft the audience and text for a post.',
      'Swap in a dedicated publishing action later if you need API execution from the canvas.',
    ],
    webhook: null,
  },
};

function maskValue(value: string) {
  if (!value) {
    return 'Not set';
  }

  if (value.length <= 8) {
    return '••••••••';
  }

  return `${value.slice(0, 4)}••••${value.slice(-4)}`;
}

function buildExampleValues(config: ProviderConfig) {
  return Object.fromEntries(
    config.fields.map((field) => [
      field.id,
      field.id === 'connectionName'
        ? config.title
        : field.id.toLowerCase().includes('url')
          ? `https://example.neup.cloud${config.webhook?.endpointPath ?? '/callback'}`
          : field.id.toLowerCase().includes('email')
            ? 'hello@example.com'
            : field.id.toLowerCase().includes('token')
              ? `sample-${field.id}`
              : `sample-${field.id}`,
    ])
  );
}

function buildBlankValues(config: ProviderConfig) {
  return Object.fromEntries(config.fields.map((field) => [field.id, '']));
}

export function PipelineProviderConnectionPage({ provider }: { provider: PipelineProviderKey }) {
  const config = providerConfigs[provider];
  const { connection, isLoaded } = useProviderConnection(provider);
  const [values, setValues] = useState<Record<string, string>>(() => buildBlankValues(config));
  const [saveState, setSaveState] = useState<'idle' | 'saved'>('idle');

  const missingRequiredLabels = useMemo(
    () =>
      config.fields
        .filter((field) => field.required && !(values[field.id] ?? '').trim())
        .map((field) => field.label),
    [config.fields, values]
  );

  const connectionStatus = connection?.status ?? 'draft';
  const isConnected = connectionStatus === 'connected';
  const Icon = config.icon;

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    if (connection) {
      setValues({
        ...buildBlankValues(config),
        ...connection.values,
      });
      return;
    }

    setValues(buildBlankValues(config));
  }, [config, connection, isLoaded]);

  const handleChange = (fieldId: string, nextValue: string) => {
    setValues((current) => ({
      ...current,
      [fieldId]: nextValue,
    }));
    setSaveState('idle');
  };

  const handleUseSavedDraft = () => {
    if (!connection) {
      return;
    }

    setValues({
      ...buildBlankValues(config),
      ...connection.values,
    });
    setSaveState('idle');
  };

  const handleLoadExample = () => {
    setValues(buildExampleValues(config));
    setSaveState('idle');
  };

  const handleSave = () => {
    const trimmedValues = Object.fromEntries(
      Object.entries(values).map(([key, value]) => [key, value.trim()])
    );

    saveStoredProviderConnection({
      provider,
      connectionName: trimmedValues.connectionName || config.title,
      status: missingRequiredLabels.length === 0 ? 'connected' : 'draft',
      values: trimmedValues,
      updatedAt: new Date().toISOString(),
    });
    setSaveState('saved');
  };

  const handleClear = () => {
    clearStoredProviderConnection(provider);
    setValues(buildBlankValues(config));
    setSaveState('idle');
  };

  return (
    <div className="min-h-screen bg-white text-foreground">
      <div className="mx-auto max-w-[1380px] px-6 py-8 md:px-8">
        <div className="mb-6 flex flex-wrap items-center gap-2 text-sm text-slate-500">
          <Link href="/pipeline" className="transition-colors hover:text-slate-900">
            Pipeline
          </Link>
          <ChevronRight className="h-4 w-4" />
          <span>Node Setup</span>
          <ChevronRight className="h-4 w-4" />
          <span className="text-slate-900">{config.title}</span>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <section className="rounded-[2rem] border border-white/80 bg-white/90 p-8 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur-xl">
            <div className="space-y-6">
              <div className="space-y-4">
                <Badge variant="outline" className="rounded-full px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.24em]">
                  {config.eyebrow}
                </Badge>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-3">
                    <div className={`flex h-14 w-14 items-center justify-center rounded-[1.35rem] bg-gradient-to-br text-white ${config.accent}`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <div>
                      <h1 className="text-4xl font-semibold tracking-tight text-slate-950">{config.title}</h1>
                      <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">{config.description}</p>
                    </div>
                  </div>

                  <div className="min-w-[220px] rounded-[1.4rem] border border-slate-200 bg-slate-50 px-4 py-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Status</p>
                    <div className="mt-2 flex items-center gap-2">
                      <Badge
                        className={
                          isConnected
                            ? 'rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50'
                            : connection
                              ? 'rounded-full border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-50'
                              : 'rounded-full border border-slate-200 bg-white text-slate-700 hover:bg-white'
                        }
                      >
                        {isConnected ? 'Connected' : connection ? 'Draft' : 'Not configured'}
                      </Badge>
                      {saveState === 'saved' ? (
                        <span className="inline-flex items-center gap-1 text-sm text-emerald-700">
                          <Check className="h-4 w-4" />
                          Saved
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-3 text-sm leading-6 text-slate-600">
                      {connection?.connectionName
                        ? `Current connection: ${connection.connectionName}`
                        : 'Save this form once and the editor will start surfacing it immediately.'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <Card className="rounded-[1.5rem] border-slate-200/80 bg-slate-50/80 shadow-none">
                  <CardContent className="p-5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Supported nodes</p>
                    <p className="mt-3 text-3xl font-semibold text-slate-950">{config.supportedNodes.length}</p>
                  </CardContent>
                </Card>
                <Card className="rounded-[1.5rem] border-slate-200/80 bg-slate-50/80 shadow-none">
                  <CardContent className="p-5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Setup mode</p>
                    <p className="mt-3 text-lg font-semibold text-slate-950">Browser draft</p>
                  </CardContent>
                </Card>
                <Card className="rounded-[1.5rem] border-slate-200/80 bg-slate-50/80 shadow-none">
                  <CardContent className="p-5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Canvas route</p>
                    <p className="mt-3 text-lg font-semibold text-slate-950">/pipeline/editor</p>
                  </CardContent>
                </Card>
              </div>

              <Tabs defaultValue="credentials" className="space-y-4">
                <TabsList className="h-auto rounded-2xl bg-slate-100 p-1">
                  <TabsTrigger value="credentials" className="rounded-xl px-4 py-2">Credentials</TabsTrigger>
                  {config.webhook ? (
                    <TabsTrigger value="webhook" className="rounded-xl px-4 py-2">Webhook</TabsTrigger>
                  ) : null}
                  <TabsTrigger value="nodes" className="rounded-xl px-4 py-2">Nodes</TabsTrigger>
                  <TabsTrigger value="payload" className="rounded-xl px-4 py-2">Payload</TabsTrigger>
                </TabsList>

                <TabsContent value="credentials" className="space-y-5">
                  <Card className="rounded-[1.6rem] border-slate-200/80 shadow-none">
                    <CardHeader>
                      <CardTitle className="text-xl text-slate-950">Connection details</CardTitle>
                      <CardDescription className="text-sm leading-6 text-slate-600">
                        {config.storageNote}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-5">
                      <div className="grid gap-4 md:grid-cols-2">
                        {config.fields.map((field) => (
                          <div key={field.id} className="space-y-2">
                            <label className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                              {field.label}
                            </label>
                            <Input
                              type={field.type ?? 'text'}
                              value={values[field.id] ?? ''}
                              onChange={(event) => handleChange(field.id, event.target.value)}
                              placeholder={field.placeholder}
                              className="rounded-2xl border-slate-200 bg-slate-50"
                            />
                            <p className="text-sm leading-6 text-slate-500">{field.helper}</p>
                          </div>
                        ))}
                      </div>

                      {missingRequiredLabels.length > 0 ? (
                        <div className="rounded-[1.25rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                          Required before this connection counts as connected: {missingRequiredLabels.join(', ')}.
                        </div>
                      ) : (
                        <div className="rounded-[1.25rem] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                          All required fields are filled. Saving now will mark this provider as connected.
                        </div>
                      )}

                      <div className="flex flex-wrap gap-3">
                        <Button onClick={handleSave} className="rounded-2xl">
                          Save connection
                        </Button>
                        {connection ? (
                          <Button
                            type="button"
                            variant="outline"
                            className="rounded-2xl border-slate-200 bg-white"
                            onClick={handleUseSavedDraft}
                          >
                            <RefreshCw className="mr-2 h-4 w-4" />
                            Use saved values
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          variant="outline"
                          className="rounded-2xl border-slate-200 bg-white"
                          onClick={handleLoadExample}
                        >
                          Load example
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="rounded-2xl border-rose-200 bg-white text-rose-700 hover:bg-rose-50 hover:text-rose-700"
                          onClick={handleClear}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Clear
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {config.webhook ? (
                  <TabsContent value="webhook" className="space-y-5">
                    <Card className="rounded-[1.6rem] border-slate-200/80 shadow-none">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-xl text-slate-950">
                          <Webhook className="h-5 w-5" />
                          {config.webhook.title}
                        </CardTitle>
                        <CardDescription className="text-sm leading-6 text-slate-600">
                          Use this as the planning surface for your inbound verification and event subscriptions.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-5">
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="rounded-[1.3rem] border border-slate-200 bg-slate-50 p-4">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Suggested endpoint</p>
                            <p className="mt-2 font-mono text-sm text-slate-700">{config.webhook.endpointPath}</p>
                          </div>
                          <div className="rounded-[1.3rem] border border-slate-200 bg-slate-50 p-4">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Verification field</p>
                            <p className="mt-2 text-sm text-slate-700">{config.webhook.verificationField}</p>
                          </div>
                        </div>

                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Subscribed events</p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {config.webhook.subscriptionEvents.map((eventName) => (
                              <Badge key={eventName} variant="outline" className="rounded-full border-slate-200 bg-white text-slate-700">
                                {eventName}
                              </Badge>
                            ))}
                          </div>
                        </div>

                        <Textarea
                          value={values.webhookUrl ?? ''}
                          onChange={(event) => handleChange('webhookUrl', event.target.value)}
                          placeholder="Public webhook URL"
                          className="min-h-[110px] rounded-2xl border-slate-200 bg-slate-50 font-mono text-sm"
                        />
                      </CardContent>
                    </Card>
                  </TabsContent>
                ) : null}

                <TabsContent value="nodes" className="space-y-5">
                  <Card className="rounded-[1.6rem] border-slate-200/80 shadow-none">
                    <CardHeader>
                      <CardTitle className="text-xl text-slate-950">Supported nodes</CardTitle>
                      <CardDescription className="text-sm leading-6 text-slate-600">
                        Save the connection here, then use these nodes from the pipeline editor.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-5">
                      <div className="grid gap-3 md:grid-cols-2">
                        {config.supportedNodes.map((nodeName) => (
                          <div key={nodeName} className="rounded-[1.2rem] border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-medium text-slate-700">
                            {nodeName}
                          </div>
                        ))}
                      </div>
                      <Separator />
                      <div className="space-y-3">
                        {config.steps.map((step) => (
                          <p key={step} className="text-sm leading-6 text-slate-600">
                            {step}
                          </p>
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-3">
                        <Button asChild className="rounded-2xl">
                          <Link href="/pipeline/editor">Open pipeline editor</Link>
                        </Button>
                        <Button asChild variant="outline" className="rounded-2xl border-slate-200 bg-white">
                          <Link href="/pipeline">Back to pipeline</Link>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="payload" className="space-y-5">
                  <Card className="rounded-[1.6rem] border-slate-200/80 shadow-none">
                    <CardHeader>
                      <CardTitle className="text-xl text-slate-950">Sample payload</CardTitle>
                      <CardDescription className="text-sm leading-6 text-slate-600">
                        Use this as the shape reference when you map fields into downstream nodes.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="rounded-[1.35rem] border border-slate-200 bg-slate-950 p-4">
                        <pre className="overflow-x-auto whitespace-pre-wrap text-xs leading-6 text-slate-200">
                          {config.samplePayload}
                        </pre>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          </section>

          <section className="space-y-5">
            <Card className="rounded-[1.8rem] border border-slate-200/80 bg-white/90 shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
              <CardHeader>
                <CardTitle className="text-xl text-slate-950">Saved snapshot</CardTitle>
                <CardDescription className="text-sm leading-6 text-slate-600">
                  Quick view of the values currently stored in this browser.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {connection ? (
                  config.fields.map((field) => (
                    <div key={field.id} className="flex items-start justify-between gap-3 rounded-[1.15rem] border border-slate-200 bg-slate-50 px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-slate-900">{field.label}</p>
                        <p className="mt-1 text-xs text-slate-500">{field.helper}</p>
                      </div>
                      <p className="max-w-[220px] break-all text-right font-mono text-xs text-slate-700">
                        {field.type === 'password'
                          ? maskValue(connection.values[field.id] ?? '')
                          : connection.values[field.id] || 'Not set'}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="rounded-[1.2rem] border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                    No saved connection yet. Fill the form and save it to make the nodes look connected.
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-[1.8rem] border border-slate-200/80 bg-slate-950 text-white shadow-[0_24px_80px_rgba(15,23,42,0.16)]">
              <CardHeader>
                <CardTitle className="text-xl text-white">Connection notes</CardTitle>
                <CardDescription className="text-sm leading-6 text-slate-300">
                  What this setup page is doing right now.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm leading-6 text-slate-300">
                <p>
                  The editor can now route you from a provider node into this setup page and back again with the same saved browser draft.
                </p>
                <p>
                  For WhatsApp specifically, the node set is fully modeled in the editor: receive message, send message, and react message.
                </p>
                <p>
                  The other providers are scaffolded as sample integration nodes so the navigation and connection pattern stays consistent across services.
                </p>
              </CardContent>
            </Card>

            <Card className="rounded-[1.8rem] border border-slate-200/80 bg-white/90 shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl text-slate-950">
                  <Calendar className="h-5 w-5" />
                  Next step
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Button asChild className="rounded-2xl">
                  <Link href="/pipeline/editor">Use this connection in the canvas</Link>
                </Button>
              </CardContent>
            </Card>
          </section>
        </div>
      </div>
    </div>
  );
}
