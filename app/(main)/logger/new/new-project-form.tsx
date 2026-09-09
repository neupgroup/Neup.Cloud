'use client';

import { useEffect, useMemo, useState } from 'react';
import { KeyRound } from 'lucide-react';
import { Button } from '#/components/ui/button';
import { Input } from '#/components/ui/input';
import { Label } from '#/components/ui/label';
import { createLoggerProjectAction } from '@/services/logger/logger-service';

function toSlug(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function generateIngestKey() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return `nlk_${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

function randomSlugSuffix() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function slugAvailabilityUrl(slug: string) {
  const loggerPath = window.location.pathname.indexOf('/logger/');
  const basePath = loggerPath >= 0 ? window.location.pathname.slice(0, loggerPath) : '';
  return `${basePath}/api/logger/slug-availability?slug=${encodeURIComponent(slug)}`;
}

export default function NewProjectForm() {
  const [name, setName] = useState('');
  const [ingestKey, setIngestKey] = useState(() => generateIngestKey());
  const [slugAvailability, setSlugAvailability] = useState<'checking' | 'available' | 'unavailable' | 'idle'>('idle');
  const generatedSlug = useMemo(() => toSlug(name), [name]);
  const [slug, setSlug] = useState('');

  useEffect(() => {
    const nextSlug = generatedSlug;
    setSlug(nextSlug);
    if (!nextSlug) { setSlugAvailability('idle'); return; }
    setSlugAvailability('checking');
    const timeout = window.setTimeout(async () => {
      try {
        const response = await fetch(slugAvailabilityUrl(nextSlug));
        const result = await response.json() as { available?: boolean };
        if (result.available) {
          setSlugAvailability('available');
        } else {
          const fallbackSlug = `${nextSlug}-${randomSlugSuffix()}`;
          setSlug(fallbackSlug);
          setSlugAvailability('checking');
          const fallbackResponse = await fetch(slugAvailabilityUrl(fallbackSlug));
          const fallbackResult = await fallbackResponse.json() as { available?: boolean };
          setSlugAvailability(fallbackResult.available ? 'available' : 'unavailable');
        }
      } catch { setSlugAvailability('idle'); }
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [generatedSlug]);

  return <form action={createLoggerProjectAction} className="grid gap-5" onSubmit={(event) => { if (slugAvailability !== 'available') event.preventDefault(); }}>
    <div className="grid gap-2"><Label htmlFor="name">Project name</Label><Input id="name" name="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="My application" required /></div>
    <div className="grid gap-2"><Label htmlFor="slug">Project slug</Label><Input id="slug" name="slug" value={slug} placeholder="my-application" readOnly required aria-invalid={slugAvailability === 'unavailable'} /><p className={slugAvailability === 'available' ? 'text-sm text-green-600' : slugAvailability === 'unavailable' ? 'text-sm text-destructive' : 'text-sm text-muted-foreground'}>{slugAvailability === 'checking' ? 'Checking availability…' : slugAvailability === 'available' ? 'The slug is available.' : slugAvailability === 'unavailable' ? 'Unable to find an available slug.' : 'Enter a project name to generate a slug.'}</p></div>
    <div className="grid gap-2"><Label htmlFor="ingestKey">Ingest key</Label><Input id="ingestKey" name="ingestKey" value={ingestKey} readOnly required /><p className="text-sm text-muted-foreground">Generated automatically. Keep this secret.</p></div>
    <div className="grid gap-2"><Label htmlFor="allowedErrorDomains">Allowed error domains</Label><Input id="allowedErrorDomains" name="allowedErrorDomains" placeholder="example.com, app.example.com" /><p className="text-sm text-muted-foreground">Comma-separated hostnames. Subdomains are included.</p></div>
    <div className="flex flex-col gap-3 rounded-md border p-4"><label className="flex items-center gap-2 text-sm"><input type="checkbox" name="allowLocalhostErrors" /> Allow errors from localhost</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" name="allowWithoutOrigin" /> Allow errors without an Origin header</label></div>
    <div className="grid gap-4 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor="errorsPerMinute">Errors per 1 minute</Label><Input id="errorsPerMinute" name="errorsPerMinute" type="number" min="1" defaultValue="60" required /></div><div className="grid gap-2"><Label htmlFor="errorsPerTenMinutes">Errors per 10 minutes</Label><Input id="errorsPerTenMinutes" name="errorsPerTenMinutes" type="number" min="1" defaultValue="300" required /></div></div>
    <div className="flex gap-3"><a href="/logger" className="inline-flex h-10 items-center rounded-md border px-4 text-sm font-medium">Cancel</a><Button htmlType="submit"><KeyRound className="mr-2 h-4 w-4" />Create project</Button></div>
  </form>;
}
