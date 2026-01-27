import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface GoogleCalendarStatus {
  connected: boolean;
  calendarId: string | null;
  expiresAt: string | null;
  lastSync: string | null;
}

interface ImportStats {
  created: number;
  updated: number;
  deleted: number;
  skipped: number;
  totalGoogleEvents: number;
  externalEvents: number;
}

export function useGoogleCalendar(adminPassword: string) {
  const queryClient = useQueryClient();
  const [isConnecting, setIsConnecting] = useState(false);

  // Check connection status
  const { data: status, isLoading } = useQuery({
    queryKey: ['google-calendar-status', adminPassword],
    queryFn: async (): Promise<GoogleCalendarStatus> => {
      // We need to check via edge function since RLS blocks direct access
      const { data, error } = await supabase.functions.invoke('airtable-proxy', {
        body: { action: 'google-calendar-status' },
        headers: { 'x-admin-password': adminPassword }
      });

      if (error) throw error;
      return data;
    },
    enabled: !!adminPassword,
  });

  // Connect to Google Calendar
  const connect = useCallback(async () => {
    setIsConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke('google-calendar-auth', {
        body: { adminPassword }
      });

      if (error) throw error;

      if (data.authUrl) {
        // Redirect to Google OAuth
        window.location.href = data.authUrl;
      } else if (data.error) {
        toast.error(data.error);
      }
    } catch (error) {
      console.error('Connect error:', error);
      toast.error('Nepavyko prisijungti prie Google Calendar');
    } finally {
      setIsConnecting(false);
    }
  }, [adminPassword]);

  // Disconnect from Google Calendar
  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke('airtable-proxy', {
        body: { action: 'google-calendar-disconnect' },
        headers: { 'x-admin-password': adminPassword }
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['google-calendar-status'] });
      toast.success('Google Calendar atsijungtas');
    },
    onError: () => {
      toast.error('Klaida atsijungiant');
    }
  });

  // Import from Google Calendar
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
    isConnecting,
    connect,
    disconnect: disconnectMutation.mutate,
    isDisconnecting: disconnectMutation.isPending,
    syncBooking,
    importFromGoogle: importMutation.mutate,
    isImporting: importMutation.isPending
  };
}
