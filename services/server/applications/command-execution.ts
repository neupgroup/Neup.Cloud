'use server';

import { executeCommand } from '@/services/saved-commands/saved-commands-service';

import { getApplication } from './crud';
import { getSelectedServerId } from './session';
import { upsertApplicationServerStatus } from './server-map';

function sanitizeStageName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'custom_command';
}

export async function executeApplicationCommand(
  applicationId: string,
  command: string,
  commandName?: string,
  displayCommand?: string
) {
  const app = await getApplication(applicationId);
  if (!app) throw new Error('Application not found');

  const serverId = await getSelectedServerId();
  if (!serverId) {
    throw new Error('No server selected. Please select a server first.');
  }

  const normalizedCommandName = (commandName || '').toLowerCase();
  if (
    normalizedCommandName.includes('start') ||
    normalizedCommandName.includes('restart') ||
    normalizedCommandName.includes('dev')
  ) {
    await upsertApplicationServerStatus(applicationId, serverId, 'started');
  } else if (normalizedCommandName.includes('stop')) {
    await upsertApplicationServerStatus(applicationId, serverId, 'stopped');
  }

  const formattedCommandName = commandName
    ? `${app.name} ${commandName}`
    : `${app.name} Custom Command`;

  const stageName = sanitizeStageName(commandName || 'custom_command');
  const statusFilePath = `${app.location}/.status`;
  const timestamp = new Date().toISOString();

  const updateStatusCommand = `
# Update or create .status file
STATUS_FILE="${statusFilePath}"
STAGE_NAME="${stageName}"
TIMESTAMP="${timestamp}"

mkdir -p "$(dirname "$STATUS_FILE")"

if [ -f "$STATUS_FILE" ]; then
    EXISTING_STATUS=$(cat "$STATUS_FILE")
else
    EXISTING_STATUS="[]"
fi

NEW_ENTRY="{\\"stage_name\\":\\"$STAGE_NAME\\",\\"status\\":\\"ongoing\\",\\"started_on\\":\\"$TIMESTAMP\\"}"

if command -v jq &> /dev/null; then
    echo "$EXISTING_STATUS" | jq \\
        --arg stage "$STAGE_NAME" \\
        --arg status "ongoing" \\
        --arg time "$TIMESTAMP" \\
        'map(if .stage_name == $stage then .status = $status | .started_on = $time else . end) |
         if any(.stage_name == $stage) then . else . + [{"stage_name": $stage, "status": $status, "started_on": $time}] end' \\
        > "$STATUS_FILE"
else
    echo "$EXISTING_STATUS" | sed 's/]$//' | sed 's/^\\\\[//' > /tmp/status_temp
    if [ -s /tmp/status_temp ]; then
        echo "[$NEW_ENTRY," >> "$STATUS_FILE.new"
        cat /tmp/status_temp >> "$STATUS_FILE.new"
        echo "]" >> "$STATUS_FILE.new"
    else
        echo "[$NEW_ENTRY]" > "$STATUS_FILE.new"
    fi
    mv "$STATUS_FILE.new" "$STATUS_FILE"
    rm -f /tmp/status_temp
fi

echo "-->>-->>${stageName}.starts<<--<<--"
echo "-->>-->>main.starts<<--<<--"
${command}
COMMAND_EXIT_CODE=$?
echo "-->>-->>main.ends<<--<<--"
echo "-->>-->>${stageName}.ends<<--<<--"

if [ $COMMAND_EXIT_CODE -eq 0 ]; then
    if command -v jq &> /dev/null; then
        TEMP_FILE=$(mktemp)
        cat "$STATUS_FILE" | jq \\
            --arg stage "$STAGE_NAME" \\
            'map(if .stage_name == $stage then .status = "completed" else . end)' \\
            > "$TEMP_FILE"
        mv "$TEMP_FILE" "$STATUS_FILE"
    fi
fi

exit $COMMAND_EXIT_CODE
`;

  // Fire-and-forget: kick off the SSH execution without awaiting it so the
  // log record (created with status "pending") is immediately visible in the
  // command history poll. The background promise handles its own error logging.
  void executeCommand(serverId, updateStatusCommand, formattedCommandName, displayCommand || command, `application:${applicationId}`);
}
