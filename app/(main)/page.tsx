/*
::neup.documentation::root-home-redirect-page
::title Root Home Redirect Page

::public

Redirects `/` to `/home` so the application has a single canonical home
dashboard route.

::public end

::end
*/

import { redirect } from 'next/navigation';

export default function RootPage() {
  redirect('/home');
}
