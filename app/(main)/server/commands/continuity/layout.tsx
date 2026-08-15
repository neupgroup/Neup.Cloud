import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Continuity Terminal, Neup.Cloud',
};

export default function ContinuityLayout({ children }: { children: React.ReactNode }) {
  return children;
}
