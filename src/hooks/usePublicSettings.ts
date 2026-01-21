import { useQuery } from '@tanstack/react-query';
import { airtableApi } from '@/lib/airtable';

export interface PublicSettings {
  workStart: string;
  workEnd: string;
  breakBetween: number;
  bookingDaysAhead: number;
  depositAmount: number;
  cancelHoursBefore: number;
  // Contact information
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  contactFacebook: string;
  contactInstagram: string;
}

export function usePublicSettings() {
  return useQuery({
    queryKey: ['public-settings'],
    queryFn: async () => {
      const data = await airtableApi('/settings', {});
      return data.settings as PublicSettings;
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
}
