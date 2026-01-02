import { useQuery } from '@tanstack/react-query';
import { airtableApi } from '@/lib/airtable';

export interface Service {
  id: string;
  name: string;
  duration: number;
  price: number;
  isActive: boolean;
}

export function useServices() {
  return useQuery({
    queryKey: ['services'],
    queryFn: async (): Promise<Service[]> => {
      const data = await airtableApi('/services');
      return data.services;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
