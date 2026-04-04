'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import {
  createWebService,
  deleteWebService,
  getAllWebServices,
  getLatestWebService,
  getWebServiceById,
  getWebServicesByServerId,
  getWebServicesByType,
  updateWebService,
} from '@/services/webservices/data';
import {
  getNginxConfigurationsForServer,
  getServerPublicIp as getServerPublicIpLogic,
  getWebOrServerNginxConfigById,
} from '@/services/webservices/logic';

export type WebServiceType = 'nginx' | 'apache' | 'caddy';

export interface WebServiceConfig {
  id?: string;
  name?: string;
  type: WebServiceType;
  created_on: any;
  updated_on?: any;
  created_by: string;
  value: any;
  serverId?: string;
  serverName?: string;
  isDraft?: boolean;
  isSynced?: boolean;
}

export async function saveWebServiceConfig(
  type: WebServiceType,
  value: any,
  createdBy: string,
  serverId?: string,
  serverName?: string,
  name?: string
): Promise<{ success: boolean; id?: string; message?: string }> {
  try {
    const config = await createWebService({
      type,
      value,
      createdBy,
      serverId,
      serverName,
      name,
    });

    revalidatePath('/server/webservices');
    revalidatePath('/server/webservices/nginx');

    return {
      success: true,
      id: config.id,
      message: 'Configuration saved successfully',
    };
  } catch (error: any) {
    console.error('Error saving web service config:', error);
    return {
      success: false,
      message: error.message || 'Failed to save configuration',
    };
  }
}

export async function updateWebServiceConfig(
  id: string,
  value: any,
  name?: string
): Promise<{ success: boolean; message?: string }> {
  try {
    await updateWebService(id, { value, name });

    revalidatePath('/server/webservices');
    revalidatePath('/server/webservices/nginx');

    return {
      success: true,
      message: 'Configuration updated successfully',
    };
  } catch (error: any) {
    console.error('Error updating web service config:', error);
    return {
      success: false,
      message: error.message || 'Failed to update configuration',
    };
  }
}

export async function deleteWebServiceConfig(id: string): Promise<{ success: boolean; message?: string }> {
  try {
    await deleteWebService(id);

    revalidatePath('/server/webservices');
    revalidatePath('/server/webservices/nginx');

    return {
      success: true,
      message: 'Configuration deleted successfully',
    };
  } catch (error: any) {
    console.error('Error deleting web service config:', error);
    return {
      success: false,
      message: error.message || 'Failed to delete configuration',
    };
  }
}

export async function getWebServiceConfig(id: string): Promise<WebServiceConfig | null> {
  try {
    return await getWebServiceById(id);
  } catch (error) {
    console.error('Error getting web service config:', error);
    return null;
  }
}

export async function getAllWebServiceConfigs(): Promise<WebServiceConfig[]> {
  try {
    return await getAllWebServices();
  } catch (error) {
    console.error('Error getting web service configs:', error);
    return [];
  }
}

export async function getWebServiceConfigsByType(type: WebServiceType): Promise<WebServiceConfig[]> {
  try {
    return await getWebServicesByType(type);
  } catch (error) {
    console.error('Error getting web service configs by type:', error);
    return [];
  }
}

export async function getWebServiceConfigsByServer(serverId: string): Promise<WebServiceConfig[]> {
  try {
    return await getWebServicesByServerId(serverId);
  } catch (error) {
    console.error('Error getting web service configs by server:', error);
    return [];
  }
}

export async function getLatestWebServiceConfig(
  type: WebServiceType,
  serverId?: string
): Promise<WebServiceConfig | null> {
  try {
    return await getLatestWebService(type, serverId);
  } catch (error) {
    console.error('Error getting latest web service config:', error);
    return null;
  }
}

export async function getNginxConfigurations(): Promise<WebServiceConfig[]> {
  try {
    const cookieStore = await cookies();
    const serverId = cookieStore.get('selected_server')?.value;
    return await getNginxConfigurationsForServer(serverId);
  } catch (error) {
    console.error('Error getting combined nginx configs:', error);
    return [];
  }
}

export async function getWebOrServerNginxConfig(id: string): Promise<WebServiceConfig | null> {
  try {
    const cookieStore = await cookies();
    const serverId = cookieStore.get('selected_server')?.value;
    return await getWebOrServerNginxConfigById(id, serverId);
  } catch (error) {
    console.error('Error fetching nginx config:', error);
    return null;
  }
}

export async function getServerPublicIp(serverId: string) {
  return getServerPublicIpLogic(serverId);
}
