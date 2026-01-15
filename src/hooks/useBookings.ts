import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { airtableApi } from '@/lib/airtable';
import { calculateEndTime } from '@/lib/slotGenerator';

export interface Booking {
  id: string;
  serviceId: string;
  serviceName?: string;
  date: string;
  startTime: string;
  endTime: string;
  status: 'confirmed' | 'completed' | 'no_show' | 'cancelled';
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  promoCode?: string;
  createdAt?: string;
  isBlacklisted?: boolean;
}

export interface CreateBookingData {
  serviceId: string;
  serviceDuration: number;
  date: string;
  startTime: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  promoCode?: string;
}

// Check if phone is blacklisted
export function useCheckBlacklist() {
  return useMutation({
    mutationFn: async (phone: string) => {
      const data = await airtableApi(`/clients/check?phone=${encodeURIComponent(phone)}`);
      return data;
    },
  });
}

// Create new booking
export function useCreateBooking() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: CreateBookingData) => {
      const endTime = calculateEndTime(data.startTime, data.serviceDuration);
      
      const result = await airtableApi('/bookings', {
        method: 'POST',
        body: JSON.stringify({
          serviceId: data.serviceId,
          date: data.date,
          startTime: data.startTime,
          endTime,
          customerName: data.customerName,
          customerPhone: data.customerPhone,
          customerEmail: data.customerEmail,
          promoCode: data.promoCode,
        }),
      });
      
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['availability'] });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
    },
  });
}

// Admin: Get bookings with filters
export function useAdminBookings(
  adminPassword: string | null,
  filters?: { status?: string; dateFrom?: string; dateTo?: string }
) {
  return useQuery({
    queryKey: ['admin-bookings', filters],
    queryFn: async (): Promise<Booking[]> => {
      if (!adminPassword) return [];
      
      const params = new URLSearchParams();
      if (filters?.status && filters.status !== 'all') {
        params.set('status', filters.status);
      }
      if (filters?.dateFrom) {
        params.set('dateFrom', filters.dateFrom);
      }
      if (filters?.dateTo) {
        params.set('dateTo', filters.dateTo);
      }
      
      const query = params.toString() ? `?${params.toString()}` : '';
      const data = await airtableApi(`/admin/bookings${query}`, {}, adminPassword);
      return data.bookings;
    },
    enabled: !!adminPassword,
  });
}

// Admin: Update booking status
export function useUpdateBookingStatus() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      bookingId, 
      status, 
      adminPassword 
    }: { 
      bookingId: string; 
      status: string; 
      adminPassword: string;
    }) => {
      await airtableApi(`/admin/bookings/${bookingId}`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      }, adminPassword);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-bookings'] });
    },
  });
}

// Admin: Add to blacklist
export function useAddToBlacklist() {
  return useMutation({
    mutationFn: async ({ 
      phone, 
      name,
      reason, 
      adminPassword 
    }: { 
      phone: string;
      name?: string;
      reason?: string; 
      adminPassword: string;
    }) => {
      await airtableApi('/admin/clients/blacklist', {
        method: 'POST',
        body: JSON.stringify({ phone, name, reason }),
      }, adminPassword);
    },
  });
}

// Admin: Reschedule booking
export function useRescheduleBooking() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      bookingId, 
      date,
      startTime,
      endTime,
      adminPassword 
    }: { 
      bookingId: string;
      date: string;
      startTime: string;
      endTime: string;
      adminPassword: string;
    }) => {
      await airtableApi(`/admin/bookings/${bookingId}`, {
        method: 'PUT',
        body: JSON.stringify({ date, startTime, endTime }),
      }, adminPassword);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['availability'] });
    },
  });
}
