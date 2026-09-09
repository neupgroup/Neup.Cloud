import { NextRequest, NextResponse } from 'next/server';
import { isLoggerSlugAvailable } from '@/services/logger/data';

export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get('slug')?.trim().toLowerCase() ?? '';
  if (!slug) return NextResponse.json({ available: false });
  return NextResponse.json({ available: await isLoggerSlugAvailable(slug) }, { headers: { 'Cache-Control': 'no-store' } });
}
