import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { airtableApi } from '@/lib/airtable';

export interface AdminService {
  id: string;
  name: string;
  duration: number;
  preparationTime: number;
  bookingTime: number;
  price: number;
  isActive: boolean;
  description: string;
  sortOrder: number;
}

export interface ServiceFormData {
  name: string;
  duration: number;
  preparationTime: number;
  // bookingTime is a formula field in Airtable (Duration + Preparation) - read-only
  price: number;
  isActive: boolean;
  description: string;
  sortOrder: number;
}

export function useAdminServices(adminPassword: string) {
  const queryClient = useQueryClient();

  const servicesQuery = useQuery({
    queryKey: ['admin-services', adminPassword],
    queryFn: async () => {
      const data = await airtableApi('/admin/services', {}, adminPassword);
      return data.services as AdminService[];
    },
    enabled: !!adminPassword,
  });

  const createMutation = useMutation({
    mutationFn: async (service: ServiceFormData) => {
      return airtableApi(
        '/admin/services',
        {
          method: 'POST',
          body: JSON.stringify(service),
        },
        adminPassword
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-services'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...service }: ServiceFormData & { id: string }) => {
      return airtableApi(
        `/admin/services/${id}`,
        {
          method: 'PUT',
          body: JSON.stringify(service),
        },
        adminPassword
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-services'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return airtableApi(
        `/admin/services/${id}`,
        {
          method: 'DELETE',
        },
        adminPassword
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-services'] });
    },
  });

  return {
    services: servicesQuery.data ?? [],
    isLoading: servicesQuery.isLoading,
    error: servicesQuery.error,
    createService: createMutation.mutateAsync,
    updateService: updateMutation.mutateAsync,
    deleteService: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    refetch: servicesQuery.refetch,
  };
}

