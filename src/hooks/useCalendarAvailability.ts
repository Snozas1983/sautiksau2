import { useQuery } from '@tanstack/react-query';
import { airtableApi } from '@/lib/airtable';
import { useSettings } from './useSettings';
import { DayAvailability, TimeSlot } from '@/components/booking/types';

interface CalendarAvailabilityResponse {
  availability: DayAvailability[];
  maxDate: string;
}

export function useCalendarAvailability(serviceDuration: number | null) {
  const { data: settings } = useSettings();

  return useQuery({
    queryKey: ['calendar-availability', serviceDuration, settings?.bookingDaysAhead],
    queryFn: async (): Promise<CalendarAvailabilityResponse> => {
      const daysAhead = settings?.bookingDaysAhead || 30;
      
      const data = await airtableApi(
        `/availability/calendar?serviceDuration=${serviceDuration}&daysAhead=${daysAhead}`
      );
      
      return data;
    },
    enabled: !!settings && serviceDuration !== null && serviceDuration > 0,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}
