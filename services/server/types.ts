// Server type for use in components
export type Server = {
  id: string;
  name: string;
  username: string;
  type: string;
  provider: string;
  publicIp: string;
  privateIp: string;
  publicKey?: string | null;
  moreDetails?: string | null;
};
