import { findBestSupervisorProcessForApplication } from './_utils';
export {
  getLanguageDisplay,
  getProcessCardStatus,
  getStatusDotClass,
} from './status-card';
export type {
  ApplicationCardStatus,
  ApplicationStatusTone,
  ServerProcess,
  SupervisorProcess,
} from './status-card';
import type { ServerProcess } from './status-card';

export function findApplicationProcess(applicationId: string, processes: ServerProcess[], expectedServiceName?: string) {
  return findBestSupervisorProcessForApplication(applicationId, processes, expectedServiceName);
}
