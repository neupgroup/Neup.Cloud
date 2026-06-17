'use server';

import { revalidatePath } from 'next/cache';

import { executeCommand } from '@/services/saved-commands/saved-commands-service';

import { getApplication } from './crud';

export async function deployConfiguration(applicationId: string, selectedServerId: string | null | undefined) {
  const app = await getApplication(applicationId);
  if (!app) throw new Error('Application not found');

  const serverId = selectedServerId?.trim() || null;
  if (!serverId) throw new Error('No server selected. Please select a server first.');

  const location = app.location;
  if (!location) throw new Error('Application location not defined');

  let envContent = '';
  if (app.environments) {
    envContent = Object.entries(app.environments)
      .map(([key, value]) => {
        const hasSingle = value.includes("'");
        const hasDouble = value.includes('"');
        if (hasSingle && hasDouble) throw new Error(`Environment variable ${key} contains both single and double quotes, which is not allowed.`);
        if (hasSingle) return `${key}="${value}"`;
        if (hasDouble) return `${key}='${value}'`;
        return `${key}="${value}"`;
      })
      .join('\n');
  }

  const envCommand = `cat <<'EOF' > "${location}/.env"
${envContent}
EOF
`;

  await executeCommand(serverId, envCommand, `Deploying .env for ${app.name}`, envCommand, `application:${applicationId}`);

  if (app.files && Object.keys(app.files).length > 0) {
    let fileOpsScript = 'echo "Starting Custom File Deployment..."\\n';

    for (const [filePath, content] of Object.entries(app.files)) {
      const delimiter = `EOF_${Math.random().toString(36).substring(7).toUpperCase()}`;
      const targetPath = `${location}/${filePath}`;

      fileOpsScript += `
mkdir -p "$(dirname "${targetPath}")"
cat <<'${delimiter}' > "${targetPath}"
${content}
${delimiter}
echo "Deployed ${filePath}"
`;
    }

    await executeCommand(
      serverId,
      fileOpsScript,
      `Deploying ${Object.keys(app.files).length} custom files for ${app.name}`,
      fileOpsScript,
      `application:${applicationId}`
    );
  }

  revalidatePath(`/server/applications/${applicationId}`);
  return { success: true };
}
