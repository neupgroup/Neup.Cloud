export type CommandSetCommand = {
  id: string;
  title: string;
  command: string;
  description: string;
  order: number;
  isSkippable: boolean;
  isRepeatable: boolean;
};

export type CommandSet = {
  id: string;
  userId: string;
  name: string;
  description?: string;
  commands: CommandSetCommand[];
  createdAt: string;
};