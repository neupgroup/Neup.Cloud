export type ApplicationServerSyncStatus = 'matched' | 'missing_on_server';

export type ApplicationServerSyncSource = 'pm2' | 'supervisor';

export type ApplicationServerSyncInfo = {
  status: ApplicationServerSyncStatus;
  matchedProcessName?: string;
  matchedProcessState?: string;
  matchedProcessSource?: ApplicationServerSyncSource;
};

export interface ApplicationInformation extends Record<string, any> {
  locationType?: 'folder' | 'executable';
  repoInfo?: {
    isPrivate?: boolean;
    provider?: 'github';
    authMode?: 'linked_account';
  };
  supervisorServiceName?: string;
  serverSync?: ApplicationServerSyncInfo;
  commandsList?: Array<{
    name: string;
    description?: string;
    value: string;
  }>;
  entryFile?: string;
  errorfile?: string;
  networkInfo?: {
    required?: boolean;
    preferredPort?: number[];
  };
}

export interface Application {
  id: string;
  name: string;
  appIcon?: string;
  location: string;
  language: string;
  repository?: string;
  networkAccess?: string[];
  commands?: Record<string, string>;
  information?: ApplicationInformation;
  owner: string;
  createdAt?: string;
  updatedAt?: string;
  environments?: Record<string, string>;
  files?: Record<string, string>;
  commandDefinitions?: any[] | Record<string, any>;
}

export type CreateApplicationData = Omit<Application, 'id' | 'createdAt' | 'updatedAt' | 'commandDefinitions'>;
export type UpdateApplicationData = Partial<Omit<Application, 'id' | 'createdAt' | 'updatedAt' | 'commandDefinitions'>>;
