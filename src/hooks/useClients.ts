import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { airtableApi } from '@/lib/airtable';

export interface Client {
  id: string;
  phone: string;
  email: string | null;
  name: string | null;
  isBlacklisted: boolean;
  blacklistReason: string | null;
  noShowCount: number;
  createdAt: string;
  updatedAt: string;
  bookingsCount?: number;
}

export function useClients(adminPassword: string, filters?: { blacklistOnly?: boolean; search?: string }) {
  return useQuery({
    queryKey: ['admin-clients', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.blacklistOnly) {
        params.append('blacklistOnly', 'true');
      }
      if (filters?.search) {
        params.append('search', filters.search);
      }
      const queryString = params.toString();
      const path = `/admin/clients${queryString ? `?${queryString}` : ''}`;
      
      const data = await airtableApi(path, {}, adminPassword);
      return data.clients as Client[];
    },
    enabled: !!adminPassword,
  });
}

export function useUpdateClient(adminPassword: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ clientId, updates }: { 
      clientId: string; 
      updates: { isBlacklisted?: boolean; blacklistReason?: string } 
    }) => {
      await airtableApi(`/admin/clients/${clientId}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      }, adminPassword);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-clients'] });
      queryClient.invalidateQueries({ queryKey: ['admin-bookings'] });
    },
  });
}

export function useAddToBlacklistByPhone(adminPassword: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ phone, name, reason }: { phone: string; name?: string; reason?: string }) => {
      await airtableApi('/admin/clients/blacklist', {
        method: 'POST',
        body: JSON.stringify({ phone, name, reason }),
      }, adminPassword);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-clients'] });
      queryClient.invalidateQueries({ queryKey: ['admin-bookings'] });
    },
  });
}