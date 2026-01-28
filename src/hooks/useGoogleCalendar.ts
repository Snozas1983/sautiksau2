import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface GoogleCalendarStatus {
  connected: boolean;
  calendarId: string | null;
  expiresAt: string | null;
  lastSync: string | null;
  authType: 'service_account' | null;
}

interface ImportStats {
  created: number;
  updated: number;
  deleted: number;
  skipped: number;
  totalGoogleEvents: number;
  externalEvents: number;
}

interface FullSyncStats {
  success: boolean;
  pushedToGoogle: number;
  updatedInGoogle: number;
  pulledFromGoogle: number;
  updatedFromGoogle: number;
  deletedFromGoogle: number;
  errors: string[];
}

export function useGoogleCalendar(adminPassword: string) {
  const queryClient = useQueryClient();

  // Check connection status
  const { data: status, isLoading } = useQuery({
    queryKey: ['google-calendar-status', adminPassword],
    queryFn: async (): Promise<GoogleCalendarStatus> => {
      const { data, error } = await supabase.functions.invoke('airtable-proxy', {
        body: { action: 'google-calendar-status' },
        headers: { 'x-admin-password': adminPassword }
      });

      if (error) throw error;
      return data;
    },
    enabled: !!adminPassword,
  });

  // Import from Google Calendar (legacy - one-way import)
  const importMutation = useMutation({
    mutationFn: async (): Promise<ImportStats> => {
      const { data, error } = await supabase.functions.invoke('import-google-calendar', {
        headers: { 'x-admin-password': adminPassword }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['google-calendar-status'] });
      queryClient.invalidateQueries({ queryKey: ['admin-bookings'] });
      
      const totalChanges = data.created + data.updated + data.deleted;
      if (totalChanges > 0) {
        toast.success(`Sinchronizuota: +${data.created} nauji, ↻${data.updated} atnaujinti, -${data.deleted} ištrinti`);
      } else {
        toast.success('Kalendoriai sinchronizuoti, pakeitimų nėra');
      }
    },
    onError: (error: Error) => {
      console.error('Import error:', error);
      toast.error('Klaida importuojant iš Google Calendar');
    }
  });

  // Full two-way sync with date range
  const fullSyncMutation = useMutation({
    mutationFn: async (params: { startDate: string; endDate: string }): Promise<FullSyncStats> => {
      const { data, error } = await supabase.functions.invoke('full-sync-google-calendar', {
        headers: { 'x-admin-password': adminPassword },
        body: { startDate: params.startDate, endDate: params.endDate }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['google-calendar-status'] });
      queryClient.invalidateQueries({ queryKey: ['admin-bookings'] });
      
      const pushed = data.pushedToGoogle + data.updatedInGoogle;
      const pulled = data.pulledFromGoogle + data.updatedFromGoogle + data.deletedFromGoogle;
      
      toast.success(
        `Sinchronizuota: ${pushed > 0 ? `+${data.pushedToGoogle} į Google, ↻${data.updatedInGoogle} atnaujinti` : ''}${pushed > 0 && pulled > 0 ? ' | ' : ''}${pulled > 0 ? `+${data.pulledFromGoogle} iš Google, ↻${data.updatedFromGoogle} atnaujinti, -${data.deletedFromGoogle} ištrinti` : ''}${pushed === 0 && pulled === 0 ? 'Pakeitimų nėra' : ''}`
      );
    },
    onError: (error: Error) => {
      console.error('Full sync error:', error);
      toast.error('Klaida sinchronizuojant su Google Calendar');
    }
  });

  // Sync a single booking
  const syncBooking = useCallback(async (bookingId: string, action: 'create' | 'update' | 'delete') => {
    try {
      const { data, error } = await supabase.functions.invoke('sync-google-calendar', {
        body: { bookingId, action, adminPassword }
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Sync error:', error);
      // Don't show error to user - calendar sync is optional
      return null;
    }
  }, [adminPassword]);

  return {
    status,
    isLoading,
    syncBooking,
    importFromGoogle: importMutation.mutate,
    isImporting: importMutation.isPending,
    fullSync: fullSyncMutation.mutate,
    isFullSyncing: fullSyncMutation.isPending
  };
}
