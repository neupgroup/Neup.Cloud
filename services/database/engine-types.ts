// Database Settings
export interface DatabaseSettings {
    remoteAccess: boolean;
    allowAllHosts: boolean;
    allowedIps: string;
    sslRequired: boolean;
}

// Engine Status
export type EngineStatus = {
    status: 'installed' | 'cancelled';
    version: string;
    installed_on: string;
};

export type DatabaseInstallation = {
    installed: boolean;
    details: Record<string, EngineStatus>;
};

// Database Instance
export type DatabaseInstance = {
    name: string;
    engine: 'mariadb' | 'postgres';
    size?: string;
    created_at?: string;
};

export type DatabaseDetails = {
    name: string;
    engine: 'mariadb' | 'postgres';
    size: string;
    tablesCount: number;
    userCount: number;
    status: 'healthy' | 'warning' | 'error';
};

// Database Users
export type DatabaseUser = {
    username: string;
    host?: string;
    permissions?: 'full' | 'read' | 'custom';
};

// Database Tables
export type DatabaseTable = {
    name: string;
    rows: number;
    size: string;
    created?: string;
};

// Operation Results
export type QueryResult = {
    success: boolean;
    data?: any[];
    message?: string;
    rowCount?: number;
    executionTime?: number;
};

export type BackupResult = {
    success: boolean;
    content?: string;
    filename?: string;
    message: string;
};

export type StoredBackupResult = OperationResult & {
    path?: string;
    filename?: string;
};

export type DatabaseBackupFile = {
    filename: string;
    path: string;
    mode: 'full' | 'schema';
    sizeBytes: number;
    modifiedAt: string;
};

export type DatabaseBackupSummary = {
    full?: DatabaseBackupFile;
    schema?: DatabaseBackupFile;
};

export type OperationResult = {
    success: boolean;
    message: string;
};
