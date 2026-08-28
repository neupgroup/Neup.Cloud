/*
::neup.documentation::app-not-found-page
::title Application Not Found Page

::public

Renders the application-level 404 screen for unknown routes.

::public end

::end
*/

import Link from 'next/link';
import { ArrowLeft, FileQuestion, Home } from 'lucide-react';
import { Button } from '@/component/ui/button';

export default function NotFound() {
  return (
    <main className="flex min-h-[70vh] items-center justify-center px-4 py-16">
      <section className="w-full max-w-xl text-center">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-md border bg-muted/40 text-muted-foreground">
          <FileQuestion className="h-7 w-7" />
        </div>

        <p className="mb-3 text-sm font-semibold uppercase text-muted-foreground">
          404
        </p>
        <h1 className="mb-3 text-3xl font-semibold tracking-tight text-foreground">
          Page not found
        </h1>
        <p className="mx-auto mb-8 max-w-md text-sm leading-6 text-muted-foreground">
          The page you are looking for does not exist or may have been moved.
        </p>

        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild>
            <Link href="/home">
              <Home className="h-4 w-4" />
              Go home
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/server/list">
              <ArrowLeft className="h-4 w-4" />
              View servers
            </Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
