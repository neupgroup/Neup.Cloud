export interface CommandDefinition {
    title: string;
    description: string;
    icon: string;
    status: 'published' | 'unpublished';
    type: 'normal' | 'destructive' | 'success';
    command: {
        preCommand?: string;
        mainCommand: string;
        postCommand?: string;
    };
}

export interface CommandContext {
    applicationId?: string;
    appName: string;
    appLocation: string;
    preferredPorts?: number[];
    entryFile?: string;
    locationType?: 'folder' | 'executable';
    supervisorServiceName?: string;
}
