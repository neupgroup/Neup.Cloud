import type { CommandSetCommand } from '@/services/command-sets/types';

export function serializeCommandSetCommands(commands: CommandSetCommand[]) {
  return commands.map((step, index) => {
    const lines = [`# Step ${index + 1}: ${step.title}`];

    if (step.description.trim()) {
      lines.push(...step.description.split('\n').map((line) => `# ${line}`));
    }

    if (step.isSkippable) {
      lines.push('# Optional step');
    }

    if (step.isRepeatable) {
      lines.push('# Repeatable step');
    }

    lines.push(step.command.trim());
    return lines.join('\n');
  }).join('\n\n');
}