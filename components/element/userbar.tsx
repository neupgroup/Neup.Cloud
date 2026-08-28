import type { HTMLAttributes } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/component/ui/avatar';

export interface UserbarProps extends HTMLAttributes<HTMLDivElement> {
  displayName: string;
  displayImage?: string | null;
  neupid: string;
}

function getInitials(displayName: string, neupid: string): string {
  const source = displayName.trim() || neupid.trim() || 'U';
  return source.charAt(0).toUpperCase();
}

const avatarColors = [
  '#2563eb',
  '#7c3aed',
  '#c026d3',
  '#db2777',
  '#e11d48',
  '#ea580c',
  '#ca8a04',
  '#16a34a',
  '#0d9488',
  '#0891b2',
];

function getAvatarColor(displayName: string, neupid: string): string {
  const source = displayName.trim() || neupid.trim() || 'U';
  let hash = 0;

  for (let index = 0; index < source.length; index += 1) {
    hash = (hash * 31 + source.charCodeAt(index)) | 0;
  }

  return avatarColors[(hash >>> 0) % avatarColors.length];
}

function normalizeDisplayImage(displayImage?: string | null): string | undefined {
  const image = displayImage?.trim();
  if (!image) return undefined;

  if (/^(https?:|data:|blob:|\/\/)/i.test(image) || image.startsWith('/')) {
    return image;
  }

  return `/${image}`;
}

export function Userbar({
  displayName,
  displayImage,
  neupid,
  className,
  ...props
}: UserbarProps) {
  const name = displayName.trim() || 'User';
  const avatarColor = getAvatarColor(displayName, neupid);
  const imageSrc = normalizeDisplayImage(displayImage);

  return (
    <div
      className={`group flex w-fit items-center gap-2.5 rounded-full border border-transparent py-1 pl-4 pr-1 transition-all duration-200 ease-out hover:border-foreground/5 hover:bg-muted/90 hover:shadow-sm ${className ?? ''}`}
      {...props}
    >
      <div className="hidden min-w-0 text-right sm:block">
        <p className="max-w-40 truncate text-sm font-medium leading-none transition-colors group-hover:text-foreground">
          {name}
        </p>
        <p className="mt-1 max-w-40 truncate text-[13px] leading-none text-muted-foreground">
          {neupid ? `@${neupid}` : null}
        </p>
      </div>
      <Avatar className="h-8 w-8 transition-shadow duration-200 group-hover:ring-1 group-hover:ring-foreground/10">
        {imageSrc ? (
          <AvatarImage className="visible" src={imageSrc} alt={name} />
        ) : (
          <AvatarFallback style={{ backgroundColor: avatarColor, color: '#fff' }}>
            {getInitials(displayName, neupid)}
          </AvatarFallback>
        )}
      </Avatar>
    </div>
  );
}
