// Server type for use in components
export type Server = {
  id: string;
  name: string;
  username: string;
  type: string;
  provider: string;
  ram?: string;
  storage?: string;
  publicIp: string;
  privateIp: string;
  moreDetails?: string | null;
};
