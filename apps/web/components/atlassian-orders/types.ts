export interface AtlassianOrder {
  id: string;
  orderNumber: string;
  emailSubject: string;
  emailFrom: string;
  emailDate: string;
  status: string;
  duplicateOfOrderId?: string;
  duplicateOfOrder?: AtlassianOrderBasic | AtlassianOrder;
  firstName: string;
  lastName: string;
  printName: string;
  pdfPath: string;
  sftpUrl?: string;
  fullName: string;
  personalEmail: string;
  workEmail: string;
  phoneNumber: string;
  address1: string;
  address2: string;
  address3: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  countryCategory: string;
  startDate: string;
  manager: string;
  department: string;
  location: string;
  paceJobNumber: string;
  createdAt: string;
  processedAt: string;
}

export interface AtlassianOrderBasic {
  id: string;
  orderNumber: string;
  fullName: string;
  createdAt: string;
}

export interface AtlassianOrderFull extends AtlassianOrder {
  duplicateOfOrder?: AtlassianOrder;
}

export interface OrderCounts {
  all: number;
  readyToSend: number;
  sentToPace: number;
  duplicates: number;
  archived: number;
  philippines: number;
  australia: number;
  india: number;
  usa: number;
  international: number;
  missing: number;
  // Sent to PACE by country
  sentPhilippines: number;
  sentAustralia: number;
  sentIndia: number;
  sentUsa: number;
  sentInternational: number;
}

export type ViewType = 'ready' | 'sent' | 'duplicates' | 'archive';

export type CountryCategory = 'Philippines' | 'Australia' | 'India' | 'United States of America' | 'International US';

export const COUNTRY_CATEGORIES: { key: string; label: string; value: CountryCategory | 'all' | 'missing' }[] = [
  { key: 'philippines', label: 'Philippines', value: 'Philippines' },
  { key: 'australia', label: 'Australia', value: 'Australia' },
  { key: 'india', label: 'India', value: 'India' },
  { key: 'usa', label: 'USA', value: 'United States of America' },
  { key: 'international', label: 'International', value: 'International US' },
];

export const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  processing: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
  missing_address: 'bg-orange-100 text-orange-800',
  potential_duplicate: 'bg-purple-100 text-purple-800',
  sent_to_pace: 'bg-emerald-100 text-emerald-800',
  archived: 'bg-gray-100 text-gray-600',
};

export const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  processing: 'Processing',
  completed: 'Ready',
  failed: 'Failed',
  missing_address: 'Missing Address',
  potential_duplicate: 'Duplicate',
  sent_to_pace: 'Sent to PACE',
  archived: 'Archived',
};

export function getStatusBadgeColor(status: string): string {
  return STATUS_COLORS[status] || 'bg-gray-100 text-gray-800';
}

export function getStatusDisplayText(status: string): string {
  return STATUS_LABELS[status] || status;
}

export function formatDate(dateString: string): string {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
