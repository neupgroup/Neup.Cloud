import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Activity,
  ArrowRight,
  Bot,
  Calendar,
  Chrome,
  Github,
  GitBranch,
  Linkedin,
  MessageCircle,
  Play,
  ShieldCheck,
  Sparkles,
  Webhook,
  Workflow,
} from 'lucide-react';

import { Logo } from '@/components/logo';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata: Metadata = {
  title: 'Pipeline | Neup.Cloud',
  description: 'Bridge-inspired pipeline builder for Neup.Cloud.',
};

const templateCards = [
  {
    title: 'Lead Intake Router',
    description: 'Webhook capture, AI qualification, and calendar follow-up in one visual flow.',
    icon: Webhook,
    badge: 'Popular',
  },
  {
    title: 'Ops Digest',
    description: 'Collect infra events, summarize them, and route the report to the right team.',
    icon: Bot,
    badge: 'Automation',
  },
  {
    title: 'Meeting Orchestrator',
    description: 'Listen for requests, branch by intent, and create calendar events automatically.',
    icon: Calendar,
    badge: 'Integration',
  },
];

const featureCards = [
  {
    title: 'Bridge-like workflow language',
    description: 'Triggers, actions, logic blocks, and integrations are grouped the same way as the Neup.Bridge editor.',
    icon: Workflow,
  },
  {
    title: 'Current app visual system',
    description: 'The surface uses the Neup.Cloud slate-and-card theme instead of importing the Bridge orange palette directly.',
    icon: Sparkles,
  },
  {
    title: 'Focused plain workspace',
    description: 'Only the editor opens as a full-bleed plain route, while the landing page stays in the main app layout.',
    icon: ShieldCheck,
  },
];

const previewNodes = [
  { label: 'WhatsApp Trigger', tone: 'bg-emerald-500/15 text-emerald-700 border-emerald-200' },
  { label: 'WhatsApp Send', tone: 'bg-sky-500/15 text-sky-700 border-sky-200' },
  { label: 'AI Agent', tone: 'bg-indigo-500/15 text-indigo-700 border-indigo-200' },
  { label: 'Google', tone: 'bg-cyan-500/15 text-cyan-700 border-cyan-200' },
];

const connectionCards = [
  {
    title: 'WhatsApp',
    description: 'Connect Cloud API details and use receive, send, and react nodes in the editor.',
    href: '/pipeline/node/whatsapp/index',
    icon: MessageCircle,
  },
  {
    title: 'Google',
    description: 'Open the sample Google connection center for workspace-oriented nodes.',
    href: '/pipeline/node/google/index',
    icon: Chrome,
  },
  {
    title: 'GitHub',
    description: 'Save repo defaults and token details for sample GitHub pipeline nodes.',
    href: '/pipeline/node/github/index',
    icon: Github,
  },
  {
    title: 'LinkedIn',
    description: 'Prepare posting identity and token details for the sample LinkedIn node.',
    href: '/pipeline/node/linkedin/index',
    icon: Linkedin,
  },
];

export default function PipelinePage() {
  return (
    <div className="min-h-screen bg-white text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-[1480px] flex-col px-6 py-6 md:px-8 lg:px-10">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-[2rem] border border-white/70 bg-white/85 px-5 py-4 shadow-[0_24px_80px_rgba(15,23,42,0.12)] backdrop-blur-xl">
          <div className="flex items-center gap-4">
            <Logo />
            <div className="hidden h-10 w-px bg-border md:block" />
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">Pipeline Studio</p>
              <h1 className="text-lg font-semibold tracking-tight">Automation workspace</h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" className="rounded-full border-slate-200 bg-white/90">
              <Link href="/">Dashboard</Link>
            </Button>
            <Button asChild className="rounded-full px-5">
              <Link href="/pipeline/editor">
                Open editor
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </header>

        <div className="grid flex-1 gap-6 py-6 lg:grid-cols-[1.15fr_0.85fr]">
          <section className="rounded-[2.25rem] border border-white/70 bg-white/88 p-8 shadow-[0_32px_120px_rgba(15,23,42,0.08)] backdrop-blur-xl md:p-10">
            <div className="space-y-6">
              <Badge variant="outline" className="rounded-full px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.28em]">
                Bridge Inspired
              </Badge>

              <div className="space-y-4">
                <h2 className="max-w-4xl text-4xl font-semibold tracking-tight text-slate-950 md:text-5xl md:leading-[1.05]">
                  Build workflows in a full-screen pipeline studio that feels close to n8n and Neup.Bridge.
                </h2>
                <p className="max-w-3xl text-base leading-7 text-slate-600 md:text-lg">
                  The pipeline area now lives inside the main Neup.Cloud app, while the editor itself opens in a dedicated full-screen workspace for focused automation building.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button asChild size="lg" className="rounded-full px-6">
                  <Link href="/pipeline/editor">
                    Launch canvas
                    <Play className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="rounded-full border-slate-200 bg-white">
                  <Link href="/">Return home</Link>
                </Button>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                {featureCards.map((item) => {
                  const Icon = item.icon;

                  return (
                    <Card key={item.title} className="rounded-[1.75rem] border-slate-200/80 bg-slate-50/70 shadow-none">
                      <CardContent className="space-y-4 p-5">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-lg shadow-slate-900/10">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="space-y-2">
                          <h3 className="font-semibold text-slate-950">{item.title}</h3>
                          <p className="text-sm leading-6 text-slate-600">{item.description}</p>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          </section>

          <section className="overflow-hidden rounded-[2.25rem] border border-slate-200/80 bg-slate-950 p-6 text-white shadow-[0_32px_120px_rgba(15,23,42,0.18)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">Studio Preview</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight">Canvas-first workflow editing</h2>
              </div>
              <Activity className="h-5 w-5 text-slate-500" />
            </div>

            <div className="mt-6 rounded-[1.75rem] border border-white/10 bg-white/5 p-5">
              <div className="rounded-[1.5rem] border border-white/10 bg-slate-900/80 p-5">
                <div className="mb-5 flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Lead qualification flow</p>
                    <p className="text-xs text-slate-400">Previewing the editor layout and workflow direction</p>
                  </div>
                  <Badge className="rounded-full border-white/10 bg-white/10 text-white hover:bg-white/10">Draft</Badge>
                </div>

                <div className="grid gap-4">
                  {previewNodes.map((node, index) => (
                    <div key={node.label} className="grid grid-cols-[1fr_32px] items-center gap-2">
                      <div className={`rounded-[1.35rem] border px-4 py-4 ${node.tone}`}>
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-medium">{node.label}</span>
                          <GitBranch className="h-4 w-4 opacity-60" />
                        </div>
                      </div>
                      {index < previewNodes.length - 1 ? (
                        <div className="flex h-full items-center justify-center">
                          <ArrowRight className="h-4 w-4 text-slate-500" />
                        </div>
                      ) : (
                        <div />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <div className="rounded-[1.5rem] border border-white/10 bg-white/5 px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Node Groups</p>
                  <p className="mt-2 text-2xl font-semibold">4</p>
                </div>
                <div className="rounded-[1.5rem] border border-white/10 bg-white/5 px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Example Steps</p>
                  <p className="mt-2 text-2xl font-semibold">12</p>
                </div>
                <div className="rounded-[1.5rem] border border-white/10 bg-white/5 px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Editor Route</p>
                  <p className="mt-2 text-lg font-semibold">/pipeline/editor</p>
                </div>
              </div>
            </div>
          </section>
        </div>

        <section className="grid gap-4 pb-4 md:grid-cols-3">
          {templateCards.map((template) => {
            const Icon = template.icon;

            return (
              <Card key={template.title} className="rounded-[1.85rem] border border-slate-200/80 bg-white/90 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
                <CardHeader className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white">
                      <Icon className="h-5 w-5" />
                    </div>
                    <Badge variant="secondary" className="rounded-full bg-slate-100 text-slate-700">
                      {template.badge}
                    </Badge>
                  </div>
                  <div>
                    <CardTitle className="text-xl text-slate-950">{template.title}</CardTitle>
                    <CardDescription className="mt-2 text-sm leading-6 text-slate-600">
                      {template.description}
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent>
                  <Button asChild variant="outline" className="w-full rounded-full border-slate-200 bg-white">
                    <Link href="/pipeline/editor">Use inside editor</Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </section>

        <section className="pb-6">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">Connection Hubs</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Open provider setup pages directly</h2>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {connectionCards.map((connection) => {
              const Icon = connection.icon;

              return (
                <Card key={connection.title} className="rounded-[1.85rem] border border-slate-200/80 bg-white/90 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
                  <CardHeader className="space-y-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-xl text-slate-950">{connection.title}</CardTitle>
                      <CardDescription className="mt-2 text-sm leading-6 text-slate-600">
                        {connection.description}
                      </CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Button asChild variant="outline" className="w-full rounded-full border-slate-200 bg-white">
                      <Link href={connection.href}>Open setup page</Link>
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
