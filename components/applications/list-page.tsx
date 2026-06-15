import { ApplicationSection } from '@/components/specifics/application/section';

export function ApplicationsPage({ selectedServerId }: { selectedServerId?: string | null }) {
  return (
    <ApplicationSection
      showAddButton
      source="all"
      statusFilter="all"
      title="Applications"
      description="Manage and monitor your deployed applications."
      selectedServerId={selectedServerId}
    />
  );
}
