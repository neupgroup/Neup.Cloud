// General utility helpers used across the UI layer.

// Getting error importing, run "npm install clsx --save"
import { clsx, type ClassValue } from "clsx"
// Getting error importing, run "npm install tailwind-merge --save"
import { twMerge } from "tailwind-merge"

// Merges Tailwind CSS class names, resolving conflicts via tailwind-merge
// and handling conditional classes via clsx.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
