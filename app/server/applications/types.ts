/**
 * Application Schema
 * 
 * Represents an application deployed in the infrastructure
 */
export type ApplicationServerSyncStatus = 'matched' | 'missing_on_server';

export type ApplicationServerSyncInfo = {
    status: ApplicationServerSyncStatus;
    matchedProcessName?: string;
    matchedProcessState?: string;
    matchedProcessSource?: 'pm2' | 'supervisor';
};

export interface ApplicationInformation extends Record<string, any> {
    repoInfo?: {
        isPrivate?: boolean;
        accessKey?: string;
        username?: string;
    };
    supervisorServiceName?: string;
    serverSync?: ApplicationServerSyncInfo;
}

export interface Application {
    /** Unique identifier */
    id: string;

    /** Name of the application */
    name: string;

    /** Uploaded application icon (data URL or image URL) */
    appIcon?: string;

    /** Location of the app in the server (file path) */
    location: string;

    /** Programming language or framework used */
    language: string;

    /** Repository URL (GitHub or other) - Optional */
    repository?: string;

    /** Network access ports - Array of port strings (e.g., ["8080", "3000:80"]) */
    networkAccess?: string[];

    /** Commands for managing the application - Key-value pairs */
    commands?: Record<string, string>;

    /** Additional information stored as JSON */
    information?: ApplicationInformation;

    /** Owner user ID */
    owner: string;

    /** Creation timestamp */
    createdAt?: string;

    /** Last update timestamp */
    updatedAt?: string;

    /** Environment variables for the application */
    environments?: Record<string, string>;


    /** Custom file overrides (path -> content) */
    files?: Record<string, string>;
}

/**
 * Application creation data (without auto-generated fields)
 */
export type CreateApplicationData = Omit<Application, 'id' | 'createdAt' | 'updatedAt'>;

/**
 * Application update data (all fields optional except id)
 */
export type UpdateApplicationData = Partial<Omit<Application, 'id' | 'createdAt' | 'updatedAt'>>;
