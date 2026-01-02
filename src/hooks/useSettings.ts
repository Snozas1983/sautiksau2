import { useQuery } from '@tanstack/react-query';
import { airtableApi } from '@/lib/airtable';

export interface Settings {
  workStart: string;
  workEnd: string;
  breakBetween: number;
  bookingDaysAhead: number;
  depositAmount: number;
  cancelHoursBefore: number;
}

export function useSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: async (): Promise<Settings> => {
      const data = await airtableApi('/settings');
      return data.settings;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
