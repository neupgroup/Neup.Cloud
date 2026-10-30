'use client';

import { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { Button } from '@neup/components/ui/button';
import { Input } from '@neup/components/ui/input';
import { Label } from '@neup/components/ui/label';
import { createLoggerProjectAction } from '@/services/logger/logger-service';

// Creates a random ingest credential in the browser before project submission.
function generateIngestKey() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return `nlk_${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

// Renders the logger project configuration form.
export default function NewProjectForm() {
  const [ingestKey] = useState(() => generateIngestKey());

  return (
    <form action={createLoggerProjectAction} className="grid gap-5">
      <div className="grid gap-2">
        <Label htmlFor="name">Project name</Label>
        <Input id="name" name="name" placeholder="My application" required />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="ingestKey">Ingest key</Label>
        <Input id="ingestKey" name="ingestKey" value={ingestKey} readOnly required />
        <p className="text-sm text-muted-foreground">Generated automatically. Keep this secret.</p>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="allowedErrorDomains">Allowed error domains</Label>
        <Input id="allowedErrorDomains" name="allowedErrorDomains" placeholder="example.com, app.example.com" />
        <p className="text-sm text-muted-foreground">Comma-separated hostnames. Subdomains are included.</p>
      </div>
      <div className="flex flex-col gap-3 rounded-md border p-4">
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="allowLocalhostErrors" /> Allow errors from localhost</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="allowWithoutOrigin" /> Allow errors without an Origin header</label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2"><Label htmlFor="errorsPerMinute">Errors per 1 minute</Label><Input id="errorsPerMinute" name="errorsPerMinute" type="number" min="1" defaultValue="60" required /></div>
        <div className="grid gap-2"><Label htmlFor="errorsPerTenMinutes">Errors per 10 minutes</Label><Input id="errorsPerTenMinutes" name="errorsPerTenMinutes" type="number" min="1" defaultValue="300" required /></div>
      </div>
      <div className="flex gap-3">
        <a href="/logger" className="inline-flex h-10 items-center rounded-md border px-4 text-sm font-medium">Cancel</a>
        <Button htmlType="submit"><KeyRound className="mr-2 h-4 w-4" />Create project</Button>
      </div>
    </form>
  );
}
