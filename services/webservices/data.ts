import type { WebServiceConfig, WebServiceType } from '@/services/webservices/service';

const WEB_SERVICE_DB_REMOVED_ERROR =
  'Web service database persistence has been removed. Manage nginx configurations directly on Linux files.';

export async function createWebService(data: {
  type: WebServiceType;
  name?: string;
  createdBy: string;
  value: any;
  serverId?: string;
  serverName?: string;
}) {
  throw new Error(WEB_SERVICE_DB_REMOVED_ERROR);
}

export async function updateWebService(id: string, data: { value: any; name?: string }) {
  throw new Error(WEB_SERVICE_DB_REMOVED_ERROR);
}

export async function deleteWebService(id: string) {
  throw new Error(WEB_SERVICE_DB_REMOVED_ERROR);
}

export async function getWebServiceById(id: string) {
  return null;
}

export async function getAllWebServices() {
  return [] as WebServiceConfig[];
}

export async function getWebServicesByType(type: WebServiceType) {
  return [] as WebServiceConfig[];
}

export async function getWebServicesByServerId(serverId: string) {
  return [] as WebServiceConfig[];
}

export async function getLatestWebService(type: WebServiceType, serverId?: string) {
  return null;
}
