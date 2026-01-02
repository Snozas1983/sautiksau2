import { useQuery } from '@tanstack/react-query';
import { airtableApi } from '@/lib/airtable';
import { generateAvailableSlots, TimeSlot } from '@/lib/slotGenerator';
import { useSettings } from './useSettings';

interface Booking {
  startTime: string;
  endTime: string;
}

export function useAvailability(date: string | null, serviceDuration: number) {
  const { data: settings } = useSettings();
  
  return useQuery({
    queryKey: ['availability', date, serviceDuration],
    queryFn: async (): Promise<TimeSlot[]> => {
      if (!date || !settings) return [];
      
      // Get bookings for this date
      const data = await airtableApi(`/bookings?date=${date}`);
      const bookings: Booking[] = data.bookings.map((b: any) => ({
        startTime: b.startTime,
        endTime: b.endTime,
      }));
      
      // Generate available slots
      return generateAvailableSlots(
        {
          workStart: settings.workStart,
          workEnd: settings.workEnd,
          breakBetween: settings.breakBetween,
        },
        serviceDuration,
        bookings
      );
    },
    enabled: !!date && !!settings && serviceDuration > 0,
    staleTime: 60 * 1000, // 1 minute
  });
}
