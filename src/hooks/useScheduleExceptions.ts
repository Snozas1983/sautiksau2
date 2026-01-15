import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface ScheduleException {
  id: string;
  date: string | null;
  day_of_week: number | null;
  start_time: string;
  end_time: string;
  exception_type: 'block' | 'allow';
  is_recurring: boolean;
  description: string | null;
  created_at: string;
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

export function useScheduleExceptions(adminPassword: string) {
  return useQuery({
    queryKey: ['schedule-exceptions', adminPassword],
    queryFn: async (): Promise<ScheduleException[]> => {
      const response = await fetch(
        `${supabaseUrl}/functions/v1/airtable-proxy/admin/exceptions`,
        {
          headers: {
            'x-admin-password': adminPassword,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch exceptions');
      }

      const data = await response.json();
      return data.exceptions || [];
    },
    enabled: !!adminPassword,
  });
}

export function useDeleteException() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      exceptionId,
      adminPassword,
    }: {
      exceptionId: string;
      adminPassword: string;
    }) => {
      const response = await fetch(
        `${supabaseUrl}/functions/v1/airtable-proxy/admin/exceptions/${exceptionId}`,
        {
          method: 'DELETE',
          headers: {
            'x-admin-password': adminPassword,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to delete exception');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule-exceptions'] });
    },
  });
}
