import { handleDownloadPost } from '@/services/server/downloadRoute';
import { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  return handleDownloadPost(request);
}
