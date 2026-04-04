export type CommandVariable = {
    name: string;
    title: string;
    description?: string;
    hint?: string;
};

export type SavedCommand = {
    id: string;
    name: string;
    command: string;
    description?: string;
    nextCommands?: string[];
    variables?: CommandVariable[];
};

export type CommandFormData = {
    name: string;
    command: string;
    description: string;
    nextCommands: string;
    variables: Record<string, Omit<CommandVariable, 'name'>>;
};

export const VARIABLE_REGEX = /\{\{\[\[([a-zA-Z0-9_]+)\]\]\}\}/g;
