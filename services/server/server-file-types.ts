export type FileOrFolder = {
  name: string;
  type: 'file' | 'directory' | 'symlink';
  size: number;
  lastModified: string;
  permissions: string;
  linkTarget?: string;
};

export type FileSearchResult = {
  path: string;
  name: string;
  directory: string;
  size: number | null;
  modifiedAtEpochMs: number | null;
};
