'use client';

import { Input } from '@neup/components/ui/input';
import { Label } from '@neup/components/ui/label';
import { ProjectKeyRotationForm } from './project-key-rotation-form';

// Shows the stable project ID and current ingest key as disabled fields.
export function ProjectCredentialsFields({ projectId, ingestKey }: { projectId: string; ingestKey: string }) {
  return (
    <div className="grid w-full min-w-0 gap-4">
      <div className="grid min-w-0 gap-2">
        <Label htmlFor="project-id">Project ID</Label>
        <Input id="project-id" value={projectId} disabled className="font-mono disabled:opacity-100" />
      </div>
      <div className="grid min-w-0 gap-2">
        <Label htmlFor="project-ingest-key">Ingest key</Label>
        <div className="relative min-w-0">
          <Input id="project-ingest-key" value={ingestKey} disabled className="pr-12 font-mono disabled:opacity-100" />
          <ProjectKeyRotationForm projectId={projectId} />
        </div>
      </div>
    </div>
  );
}
