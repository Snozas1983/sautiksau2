import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

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

const API_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/airtable-proxy`;

export function useAdminServices(adminPassword: string) {
  const queryClient = useQueryClient();

  const servicesQuery = useQuery({
    queryKey: ['admin-services', adminPassword],
    queryFn: async () => {
      const response = await fetch(`${API_URL}/admin/services`, {
        headers: {
          'x-admin-password': adminPassword,
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch services');
      }
      
      const data = await response.json();
      return data.services as AdminService[];
    },
    enabled: !!adminPassword,
  });

  const createMutation = useMutation({
    mutationFn: async (service: ServiceFormData) => {
      const response = await fetch(`${API_URL}/admin/services`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-password': adminPassword,
        },
        body: JSON.stringify(service),
      });
      
      if (!response.ok) {
        throw new Error('Failed to create service');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-services'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...service }: ServiceFormData & { id: string }) => {
      const response = await fetch(`${API_URL}/admin/services/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-password': adminPassword,
        },
        body: JSON.stringify(service),
      });
      
      if (!response.ok) {
        throw new Error('Failed to update service');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-services'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`${API_URL}/admin/services/${id}`, {
        method: 'DELETE',
        headers: {
          'x-admin-password': adminPassword,
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete service');
      }
      
      return response.json();
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
