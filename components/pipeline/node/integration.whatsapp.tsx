'use client';

import { Badge } from '#/components/ui/badge';
import { Input } from '#/components/ui/input';
import { Textarea } from '#/components/ui/textarea';
import { Switch } from '#/components/ui/switch';
import {
  definePipelineNodeModule,
  type PipelineNodeInspectorArgs,
  type PipelineNodeRecord,
} from '@/components/pipeline/node/interface';
import { PipelineProviderConnectionCallout } from '@/components/pipeline/node/provider-connection-callout';
import { MessageCircle, Send, SmilePlus } from 'lucide-react';

type WhatsAppEventType = 'text' | 'interactive' | 'media' | 'status' | 'any';
type WhatsAppMessageType = 'text' | 'template';

type WhatsAppNodeData = PipelineNodeRecord & {
  whatsappConnectionLabel?: string;
  whatsappPhoneNumberId?: string;
  whatsappBusinessAccountId?: string;
  whatsappWebhookPath?: string;
  whatsappEventType?: WhatsAppEventType;
  whatsappAllowedSenders?: string;
  whatsappAutoMarkRead?: boolean;
  whatsappRecipientPhone?: string;
  whatsappMessageType?: WhatsAppMessageType;
  whatsappMessageBody?: string;
  whatsappTemplateName?: string;
  whatsappTemplateLanguage?: string;
  whatsappReplyToMessageId?: string;
  whatsappTargetMessageId?: string;
  whatsappReactionEmoji?: string;
  whatsappLastPayload?: string;
};

const WHATSAPP_SETUP_ROUTE = '/pipeline/node/whatsapp/index';

const receivePayload = JSON.stringify(
  {
    from: '9779800000000',
    messageId: 'wamid.HBgMOTc3OTgwMDAwMDAwFQIAERgS',
    type: 'text',
    text: 'Need pricing for your premium plan.',
    contactName: 'Aarav Sharma',
    phoneNumberId: '123456789012345',
    businessAccountId: '1029384756',
  },
  null,
  2
);

function buildSendPayload(data: WhatsAppNodeData) {
  return JSON.stringify(
    {
      messaging_product: 'whatsapp',
      to: data.whatsappRecipientPhone || '{{whatsapptrigger_1234.from}}',
      type: data.whatsappMessageType ?? 'text',
      ...(data.whatsappMessageType === 'template'
        ? {
            template: {
              name: data.whatsappTemplateName || 'order_update',
              language: {
                code: data.whatsappTemplateLanguage || 'en_US',
              },
            },
          }
        : {
            text: {
              preview_url: false,
              body: data.whatsappMessageBody || 'Hello from Neup.Cloud pipeline.',
            },
          }),
      ...(data.whatsappReplyToMessageId
        ? {
            context: {
              message_id: data.whatsappReplyToMessageId,
            },
          }
        : {}),
    },
    null,
    2
  );
}

function buildReactionPayload(data: WhatsAppNodeData) {
  return JSON.stringify(
    {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: data.whatsappRecipientPhone || '{{whatsapptrigger_1234.from}}',
      type: 'reaction',
      reaction: {
        message_id: data.whatsappTargetMessageId || '{{whatsapptrigger_1234.messageId}}',
        emoji: data.whatsappReactionEmoji || '👍',
      },
    },
    null,
    2
  );
}

function parsePayload(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function SectionTitle({ title, description }: { title: string; description: string }) {
  return (
    <div className="space-y-1">
      <h3 className="text-lg font-semibold text-slate-950">{title}</h3>
      <p className="text-sm leading-6 text-slate-500">{description}</p>
    </div>
  );
}

function PayloadPreview({ title, payload, badgeLabel }: { title: string; payload: string; badgeLabel: string }) {
  return (
    <section className="space-y-4 px-1">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-slate-950">{title}</h3>
        <Badge className="rounded-full border border-slate-200 bg-white text-slate-700 hover:bg-white">
          {badgeLabel}
        </Badge>
      </div>
      <div className="rounded-[1.4rem] border border-slate-200 bg-slate-950 p-4">
        <pre className="overflow-x-auto whitespace-pre-wrap text-xs leading-6 text-slate-200">{payload}</pre>
      </div>
    </section>
  );
}

function WhatsAppTriggerOptions({ node, updateNode }: PipelineNodeInspectorArgs<WhatsAppNodeData>) {
  return (
    <section className="space-y-5 px-1">
      <SectionTitle
        title="Node options"
        description="Receive inbound WhatsApp messages, normalize the payload, and start the automation."
      />

      <PipelineProviderConnectionCallout provider="whatsapp" href={WHATSAPP_SETUP_ROUTE} />

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Connection label
          </label>
          <Input
            value={node.data.whatsappConnectionLabel ?? ''}
            onChange={(event) => updateNode({ whatsappConnectionLabel: event.target.value })}
            placeholder="Primary WhatsApp workspace"
            className="rounded-2xl border-slate-200 bg-slate-50"
          />
        </div>

        <div className="space-y-2">
          <label className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Phone number ID
          </label>
          <Input
            value={node.data.whatsappPhoneNumberId ?? ''}
            onChange={(event) => updateNode({ whatsappPhoneNumberId: event.target.value })}
            placeholder="123456789012345"
            className="rounded-2xl border-slate-200 bg-slate-50"
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Webhook path
          </label>
          <Input
            value={node.data.whatsappWebhookPath ?? ''}
            onChange={(event) => updateNode({ whatsappWebhookPath: event.target.value })}
            placeholder="/api/pipeline/webhooks/whatsapp"
            className="rounded-2xl border-slate-200 bg-slate-50"
          />
        </div>

        <div className="space-y-2">
          <label className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Event type
          </label>
          <select
            value={node.data.whatsappEventType ?? 'text'}
            onChange={(event) => updateNode({ whatsappEventType: event.target.value as WhatsAppEventType })}
            className="flex h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-950 outline-none"
          >
            <option value="text">Text message</option>
            <option value="interactive">Interactive reply</option>
            <option value="media">Media message</option>
            <option value="status">Delivery status</option>
            <option value="any">Any event</option>
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Allowed senders
        </label>
        <Textarea
          value={node.data.whatsappAllowedSenders ?? ''}
          onChange={(event) => updateNode({ whatsappAllowedSenders: event.target.value })}
          placeholder="+9779800000000, +12025550101"
          className="min-h-[96px] rounded-2xl border-slate-200 bg-slate-50 font-mono text-sm"
        />
        <p className="text-sm leading-6 text-slate-500">
          Optional comma-separated allow list. Leave empty to accept any inbound sender.
        </p>
      </div>

      <div className="flex items-center justify-between gap-4 rounded-[1.3rem] border border-slate-200 bg-slate-50 px-4 py-3">
        <div>
          <p className="text-sm font-medium text-slate-900">Auto mark incoming messages as read</p>
          <p className="text-sm leading-6 text-slate-500">Useful when the pipeline should acknowledge the message immediately.</p>
        </div>
        <Switch
          checked={node.data.whatsappAutoMarkRead ?? true}
          onCheckedChange={(checked) => updateNode({ whatsappAutoMarkRead: checked })}
        />
      </div>
    </section>
  );
}

function WhatsAppTriggerResponse({ node }: PipelineNodeInspectorArgs<WhatsAppNodeData>) {
  const payload = node.data.whatsappLastPayload?.trim() || receivePayload;

  return <PayloadPreview title="Trigger payload" payload={payload} badgeLabel="Inbound event" />;
}

function WhatsAppSendOptions({ node, updateNode }: PipelineNodeInspectorArgs<WhatsAppNodeData>) {
  const messageType = node.data.whatsappMessageType ?? 'text';

  return (
    <section className="space-y-5 px-1">
      <SectionTitle
        title="Node options"
        description="Send a WhatsApp message after the pipeline decides who to contact and what to say."
      />

      <PipelineProviderConnectionCallout provider="whatsapp" href={WHATSAPP_SETUP_ROUTE} />

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Connection label
          </label>
          <Input
            value={node.data.whatsappConnectionLabel ?? ''}
            onChange={(event) => updateNode({ whatsappConnectionLabel: event.target.value })}
            placeholder="Primary WhatsApp workspace"
            className="rounded-2xl border-slate-200 bg-slate-50"
          />
        </div>

        <div className="space-y-2">
          <label className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Recipient
          </label>
          <Input
            value={node.data.whatsappRecipientPhone ?? ''}
            onChange={(event) => updateNode({ whatsappRecipientPhone: event.target.value })}
            placeholder="{{whatsapptrigger_1234.from}}"
            className="rounded-2xl border-slate-200 bg-slate-50"
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Message type
          </label>
          <select
            value={messageType}
            onChange={(event) => updateNode({ whatsappMessageType: event.target.value as WhatsAppMessageType })}
            className="flex h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-950 outline-none"
          >
            <option value="text">Text</option>
            <option value="template">Template</option>
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Reply to message ID
          </label>
          <Input
            value={node.data.whatsappReplyToMessageId ?? ''}
            onChange={(event) => updateNode({ whatsappReplyToMessageId: event.target.value })}
            placeholder="{{whatsapptrigger_1234.messageId}}"
            className="rounded-2xl border-slate-200 bg-slate-50"
          />
        </div>
      </div>

      {messageType === 'template' ? (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Template name
            </label>
            <Input
              value={node.data.whatsappTemplateName ?? ''}
              onChange={(event) => updateNode({ whatsappTemplateName: event.target.value })}
              placeholder="order_update"
              className="rounded-2xl border-slate-200 bg-slate-50"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Template language
            </label>
            <Input
              value={node.data.whatsappTemplateLanguage ?? ''}
              onChange={(event) => updateNode({ whatsappTemplateLanguage: event.target.value })}
              placeholder="en_US"
              className="rounded-2xl border-slate-200 bg-slate-50"
            />
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <label className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Message body
          </label>
          <Textarea
            value={node.data.whatsappMessageBody ?? ''}
            onChange={(event) => updateNode({ whatsappMessageBody: event.target.value })}
            placeholder="Hi {{scorewithai_1203.summary}}, we can help with that."
            className="min-h-[130px] rounded-2xl border-slate-200 bg-slate-50 font-mono text-sm"
          />
        </div>
      )}
    </section>
  );
}

function WhatsAppSendResponse({ node }: PipelineNodeInspectorArgs<WhatsAppNodeData>) {
  return <PayloadPreview title="Outgoing payload" payload={buildSendPayload(node.data)} badgeLabel="Send message" />;
}

function WhatsAppReactOptions({ node, updateNode }: PipelineNodeInspectorArgs<WhatsAppNodeData>) {
  return (
    <section className="space-y-5 px-1">
      <SectionTitle
        title="Node options"
        description="React to an existing WhatsApp message using the Cloud API reaction payload."
      />

      <PipelineProviderConnectionCallout provider="whatsapp" href={WHATSAPP_SETUP_ROUTE} />

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Connection label
          </label>
          <Input
            value={node.data.whatsappConnectionLabel ?? ''}
            onChange={(event) => updateNode({ whatsappConnectionLabel: event.target.value })}
            placeholder="Primary WhatsApp workspace"
            className="rounded-2xl border-slate-200 bg-slate-50"
          />
        </div>

        <div className="space-y-2">
          <label className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Recipient
          </label>
          <Input
            value={node.data.whatsappRecipientPhone ?? ''}
            onChange={(event) => updateNode({ whatsappRecipientPhone: event.target.value })}
            placeholder="{{whatsapptrigger_1234.from}}"
            className="rounded-2xl border-slate-200 bg-slate-50"
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Message ID to react to
          </label>
          <Input
            value={node.data.whatsappTargetMessageId ?? ''}
            onChange={(event) => updateNode({ whatsappTargetMessageId: event.target.value })}
            placeholder="{{whatsapptrigger_1234.messageId}}"
            className="rounded-2xl border-slate-200 bg-slate-50"
          />
        </div>

        <div className="space-y-2">
          <label className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Reaction emoji
          </label>
          <Input
            value={node.data.whatsappReactionEmoji ?? ''}
            onChange={(event) => updateNode({ whatsappReactionEmoji: event.target.value })}
            placeholder="👍"
            className="rounded-2xl border-slate-200 bg-slate-50"
          />
        </div>
      </div>
    </section>
  );
}

function WhatsAppReactResponse({ node }: PipelineNodeInspectorArgs<WhatsAppNodeData>) {
  return <PayloadPreview title="Reaction payload" payload={buildReactionPayload(node.data)} badgeLabel="React message" />;
}

export const whatsappTriggerNodeModule = definePipelineNodeModule<WhatsAppNodeData>({
  definition: {
    kind: 'whatsappTrigger',
    type: 'triggers',
    label: 'WhatsApp Trigger',
    subtitle: 'Receive message',
    category: 'Triggers',
    description: 'Start the flow when a WhatsApp message arrives through the Cloud API webhook.',
    summary: 'Useful for support bots, sales qualification, and customer-response automations.',
    icon: MessageCircle,
  },
  getInitialData: () => ({
    whatsappConnectionLabel: 'Primary WhatsApp workspace',
    whatsappPhoneNumberId: '',
    whatsappBusinessAccountId: '',
    whatsappWebhookPath: '/api/pipeline/webhooks/whatsapp',
    whatsappEventType: 'text',
    whatsappAllowedSenders: '',
    whatsappAutoMarkRead: true,
    whatsappLastPayload: receivePayload,
  }),
  getReferenceFields: () => [
    'connection',
    'phoneNumberId',
    'businessAccountId',
    'webhookPath',
    'eventType',
    'allowedSenders',
    'autoMarkRead',
    'payload',
    'from',
    'messageId',
    'messageText',
  ],
  buildReferenceValue: (node) => {
    const parsedPayload = parsePayload(node.data.whatsappLastPayload?.trim() || receivePayload) as Record<string, unknown>;

    return {
      connection: node.data.whatsappConnectionLabel ?? '',
      phoneNumberId: node.data.whatsappPhoneNumberId ?? '',
      businessAccountId: node.data.whatsappBusinessAccountId ?? '',
      webhookPath: node.data.whatsappWebhookPath ?? '',
      eventType: node.data.whatsappEventType ?? 'text',
      allowedSenders: (node.data.whatsappAllowedSenders ?? '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean),
      autoMarkRead: node.data.whatsappAutoMarkRead ?? true,
      payload: parsedPayload,
      from: typeof parsedPayload.from === 'string' ? parsedPayload.from : '',
      messageId: typeof parsedPayload.messageId === 'string' ? parsedPayload.messageId : '',
      messageText: typeof parsedPayload.messageText === 'string' ? parsedPayload.messageText : '',
    };
  },
  renderOptions: (args) => <WhatsAppTriggerOptions {...args} />,
  renderResponse: (args) => <WhatsAppTriggerResponse {...args} />,
});

export const whatsappSendNodeModule = definePipelineNodeModule<WhatsAppNodeData>({
  definition: {
    kind: 'whatsappSend',
    type: 'actions',
    label: 'WhatsApp Send',
    subtitle: 'Send message',
    category: 'Actions',
    description: 'Send a text or template message through the connected WhatsApp business number.',
    summary: 'Ideal for confirmations, follow-ups, reminders, and AI-assisted replies.',
    icon: Send,
  },
  getInitialData: () => ({
    whatsappConnectionLabel: 'Primary WhatsApp workspace',
    whatsappRecipientPhone: '',
    whatsappMessageType: 'text',
    whatsappMessageBody: 'Hello from Neup.Cloud pipeline.',
    whatsappTemplateName: '',
    whatsappTemplateLanguage: 'en_US',
    whatsappReplyToMessageId: '',
  }),
  getReferenceFields: () => [
    'connection',
    'recipient',
    'messageType',
    'messageBody',
    'templateName',
    'templateLanguage',
    'replyToMessageId',
    'request',
  ],
  buildReferenceValue: (node) => ({
    connection: node.data.whatsappConnectionLabel ?? '',
    recipient: node.data.whatsappRecipientPhone ?? '',
    messageType: node.data.whatsappMessageType ?? 'text',
    messageBody: node.data.whatsappMessageBody ?? '',
    templateName: node.data.whatsappTemplateName ?? '',
    templateLanguage: node.data.whatsappTemplateLanguage ?? '',
    replyToMessageId: node.data.whatsappReplyToMessageId ?? '',
    request: parsePayload(buildSendPayload(node.data)),
  }),
  renderOptions: (args) => <WhatsAppSendOptions {...args} />,
  renderResponse: (args) => <WhatsAppSendResponse {...args} />,
});

export const whatsappReactNodeModule = definePipelineNodeModule<WhatsAppNodeData>({
  definition: {
    kind: 'whatsappReact',
    type: 'actions',
    label: 'WhatsApp React',
    subtitle: 'React message',
    category: 'Actions',
    description: 'Send a reaction emoji to a previously received WhatsApp message.',
    summary: 'Helpful for lightweight acknowledgements and chat-native confirmation flows.',
    icon: SmilePlus,
  },
  getInitialData: () => ({
    whatsappConnectionLabel: 'Primary WhatsApp workspace',
    whatsappRecipientPhone: '',
    whatsappTargetMessageId: '',
    whatsappReactionEmoji: '👍',
  }),
  getReferenceFields: () => [
    'connection',
    'recipient',
    'messageId',
    'reactionEmoji',
    'request',
  ],
  buildReferenceValue: (node) => ({
    connection: node.data.whatsappConnectionLabel ?? '',
    recipient: node.data.whatsappRecipientPhone ?? '',
    messageId: node.data.whatsappTargetMessageId ?? '',
    reactionEmoji: node.data.whatsappReactionEmoji ?? '👍',
    request: parsePayload(buildReactionPayload(node.data)),
  }),
  renderOptions: (args) => <WhatsAppReactOptions {...args} />,
  renderResponse: (args) => <WhatsAppReactResponse {...args} />,
});
