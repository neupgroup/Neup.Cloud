import { findBestSupervisorProcessForApplication } from '@/services/applications/service-name';

export type ServerProcess = {
  name: string;
  state: string;
  description?: string;
  pid?: number | null;
  uptime?: string | null;
  source: 'supervisor';
  isPermanent?: boolean;
};

export type SupervisorProcess = ServerProcess;

export type ApplicationStatusTone = 'green' | 'red' | 'orange' | 'gray';

export type ApplicationCardStatus = {
  tone: ApplicationStatusTone;
  label: string;
  detail?: string;
  process?: SupervisorProcess;
};

function getStatusTone(state: string): ApplicationStatusTone {
  const normalizedState = state.toUpperCase();

  if (normalizedState === 'RUNNING') return 'green';
  if (normalizedState === 'STOPPED' || normalizedState === 'EXITED') return 'red';
  if (normalizedState === 'FATAL' || normalizedState === 'BACKOFF' || normalizedState === 'ERRORED') return 'orange';
  return 'gray';
}

function getStatusLabel(tone: ApplicationStatusTone) {
  switch (tone) {
    case 'green':
      return 'running';
    case 'red':
      return 'stopped';
    case 'orange':
      return 'crashed';
    default:
      return 'not running';
  }
}

export function findApplicationProcess(applicationId: string, processes: ServerProcess[], expectedServiceName?: string) {
  return findBestSupervisorProcessForApplication(applicationId, processes, expectedServiceName);
}

export function getProcessCardStatus(process?: ServerProcess | null): ApplicationCardStatus {
  if (!process) {
    return {
      tone: 'gray',
      label: 'not running',
    };
  }

  const tone = getStatusTone(process.state);

  return {
    tone,
    label: getStatusLabel(tone),
    process,
  };
}

export function getStatusDotClass(tone: ApplicationStatusTone) {
  switch (tone) {
    case 'green':
      return 'bg-green-500';
    case 'red':
      return 'bg-red-500';
    case 'orange':
      return 'bg-orange-500';
    default:
      return 'bg-slate-400';
  }
}

export function getLanguageDisplay(language: string) {
  return {
    next: 'Next.js',
    node: 'Node.js',
    python: 'Python',
    go: 'Go',
    custom: 'Custom',
  }[language] || language;
}
