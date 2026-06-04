import { redirect } from 'next/navigation';

export default async function IntelligencePromptsDetailRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = await params;
  redirect(`/intelligence/access/${resolvedParams.id}`);
}
