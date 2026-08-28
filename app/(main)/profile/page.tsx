'use client';

/*
::neup.documentation::profile-page
::title Profile Page

::public

Renders the signed-in account profile and account preferences at `/profile`.

::public end

::end
*/

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  CircleUser,
  KeyRound,
  Pencil,
  UserRound,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '#/components/ui/avatar';

type ProfileState = {
  displayName: string;
  displayImage: string;
  neupid: string;
};

const emptyProfile: ProfileState = { displayName: '', displayImage: '', neupid: '' };

function readCookie(name: string) {
  if (typeof document === 'undefined') return '';
  const value = document.cookie.split('; ').find((part) => part.startsWith(`${name}=`));
  return value ? decodeURIComponent(value.slice(name.length + 1)).trim() : '';
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'ME';
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<ProfileState>(emptyProfile);

  useEffect(() => {
    setProfile({
      displayName: readCookie('neup_profile_display_name'),
      displayImage: readCookie('neup_profile_display_image'),
      neupid: readCookie('neup_profile_neupid'),
    });
  }, []);

  const displayName = profile.displayName || 'My Account';
  const neupId = profile.neupid ? (profile.neupid.startsWith('@') ? profile.neupid : `@${profile.neupid}`) : 'Your Neup ID';
  const accountInitials = useMemo(() => initials(displayName), [displayName]);

  return (
    <div className="grid gap-8">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">My Profile</h1>
        <p className="text-muted-foreground">Information for the account currently signed in to this workspace.</p>
      </div>

      <div>
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <Link
              href="https://neupgroup.com/account/profile/display"
              aria-label="Update profile display image"
              className="group relative block h-24 w-24 rounded-xl sm:h-28 sm:w-28"
            >
              <Avatar className="h-full w-full rounded-xl border-4 border-muted shadow-sm transition-opacity group-hover:opacity-70">
                <AvatarImage src={profile.displayImage || undefined} alt={displayName} />
                <AvatarFallback className="bg-muted text-2xl text-foreground">{accountInitials || <CircleUser />}</AvatarFallback>
              </Avatar>
              <span className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl bg-black/35 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                <Pencil className="h-5 w-5 text-white transition-transform duration-200 group-hover:scale-110 group-hover:-rotate-12" />
              </span>
            </Link>
          <div className="space-y-1">
            <h2 className="text-xl font-bold sm:text-2xl">{displayName}</h2>
            <p className="text-muted-foreground">{neupId}</p>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
        <Link
          href="https://neupgroup.com/account/home"
          className="group flex items-center gap-3 p-4 transition-colors hover:bg-muted/40"
        >
          <span className="flex h-10 w-12 shrink-0 items-center justify-center rounded-md bg-primary/10 text-muted-foreground">
            <UserRound className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">Update your profile</span>
            <span className="mt-1 block text-xs text-muted-foreground">Open your Neup account settings to update your profile details.</span>
          </span>
          <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" />
        </Link>
        <div className="border-t" />
        <Link
          href="https://neupgroup.com/account/security/password"
          className="group flex items-center gap-3 p-4 transition-colors hover:bg-muted/40"
        >
          <span className="flex h-10 w-12 shrink-0 items-center justify-center rounded-md bg-primary/10 text-muted-foreground">
            <KeyRound className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">Change your password</span>
            <span className="mt-1 block text-xs text-muted-foreground">Open your Neup account settings to update your password.</span>
          </span>
          <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" />
        </Link>
      </div>
    </div>
  );
}
