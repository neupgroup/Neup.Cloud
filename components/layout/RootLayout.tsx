import { Toaster } from '@/components/ui/toast';

/**
 * ::neup.documentation::root-layout
 *
 * Base layout shared by every route. It provides a full-page surface and the
 * application-wide toast viewport.
 *
 * ::end
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen w-full bg-white text-foreground">
      {children}
      <Toaster />
    </div>
  );
}
