export type EventStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'CLOSED';

export interface EventItem {
  id: string;
  name: string;
  slug?: string;
  startsAt: string;
  endsAt: string;
  status: EventStatus;
  organizationId: string;
  organization?: { id: string; name: string };
  sourceId?: string;
  location?: string;
  stats?: {
    totalTickets: number;
    totalScanned: number;
    validScans: number;
    rejectedScans: number;
  };
}
