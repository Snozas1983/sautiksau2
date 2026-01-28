import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getServiceAccountAccessToken, getCalendarId } from '../_shared/google-jwt.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-password',
};

interface FullSyncStats {
  pushedToGoogle: number;
  updatedInGoogle: number;
  pulledFromGoogle: number;
  updatedFromGoogle: number;
  deletedFromGoogle: number;
  errors: string[];
}

// Push a single booking to Google Calendar
async function pushBookingToGoogle(
  accessToken: string,
  calendarId: string,
  booking: {
    id: string;
    date: string;
    start_time: string;
    end_time: string;
    customer_name: string;
    customer_phone: string;
    customer_email: string | null;
    is_system_booking: boolean;
    service_name?: string;
    google_calendar_event_id?: string | null;
  }
): Promise<{ eventId: string | null; action: 'created' | 'updated' | 'error' }> {
  const baseUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;

  // Handle both HH:mm and HH:mm:ss formats from database
  const formatTime = (time: string) => {
    const parts = time.split(':');
    return parts.length === 2 ? `${time}:00` : time;
  };
  
  const startDateTime = `${booking.date}T${formatTime(booking.start_time)}`;
  const endDateTime = `${booking.date}T${formatTime(booking.end_time)}`;

  const isSystem = booking.is_system_booking;
  
  const event = {
    summary: isSystem 
      ? 'STS Užimta' 
      : `STS ${booking.customer_name} - ${booking.service_name || 'Paslauga'}`,
    description: isSystem 
      ? 'Sisteminė rezervacija' 
      : `Tel: ${booking.customer_phone}${booking.customer_email ? `\nEl. paštas: ${booking.customer_email}` : ''}`,
    start: {
      dateTime: startDateTime,
      timeZone: 'Europe/Vilnius'
    },
    end: {
      dateTime: endDateTime,
      timeZone: 'Europe/Vilnius'
    },
    colorId: isSystem ? '8' : '9' // 8 = graphite/gray, 9 = blue
  };

  try {
    let response: Response;
    let action: 'created' | 'updated' = 'created';
    
    if (booking.google_calendar_event_id) {
      // Update existing event
      response = await fetch(`${baseUrl}/${booking.google_calendar_event_id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(event)
      });
      action = 'updated';
    } else {
      // Create new event
      response = await fetch(baseUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(event)
      });
    }

    const result = await response.json();
    
    if (result.error) {
      console.error('Calendar API error for booking', booking.id, ':', JSON.stringify(result.error));
      return { eventId: null, action: 'error' };
    }

    return { eventId: result.id, action };
  } catch (err) {
    console.error('Error pushing booking', booking.id, ':', err);
    return { eventId: null, action: 'error' };
  }
}

// Parse Google Calendar event to booking format
function parseGoogleEvent(event: {
  id: string;
  summary?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
}): { date: string; startTime: string; endTime: string } | null {
  const startStr = event.start?.dateTime || event.start?.date;
  const endStr = event.end?.dateTime || event.end?.date;
  
  if (!startStr || !endStr) return null;
  
  // Use Europe/Vilnius timezone for parsing
  const vilniusFormatter = new Intl.DateTimeFormat('lt-LT', {
    timeZone: 'Europe/Vilnius',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  
  const startDate = new Date(startStr);
  const endDate = new Date(endStr);
  
  const startParts = vilniusFormatter.formatToParts(startDate);
  const endParts = vilniusFormatter.formatToParts(endDate);
  
  const getPart = (parts: Intl.DateTimeFormatPart[], type: string) => 
    parts.find(p => p.type === type)?.value || '00';
  
  const date = `${getPart(startParts, 'year')}-${getPart(startParts, 'month')}-${getPart(startParts, 'day')}`;
  const startTime = `${getPart(startParts, 'hour')}:${getPart(startParts, 'minute')}`;
  const endTime = `${getPart(endParts, 'hour')}:${getPart(endParts, 'minute')}`;
  
  return { date, startTime, endTime };
}

// Pull events from Google Calendar (import external events)
async function pullFromGoogle(
  supabase: any,
  accessToken: string,
  calendarId: string,
  startDate: string,
  endDate: string
): Promise<{ created: number; updated: number; deleted: number }> {
  const stats = { created: 0, updated: 0, deleted: 0 };
  
  const timeMin = new Date(startDate).toISOString();
  const timeMax = new Date(endDate).toISOString();
  
  console.log(`Fetching Google Calendar events from ${timeMin} to ${timeMax}`);
  
  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?` +
    `timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&maxResults=500`,
    {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    }
  );
  
  const data = await response.json();
  
  if (data.error) {
    console.error('Error fetching Google Calendar events:', data.error);
    return stats;
  }
  
  const googleEvents = data.items || [];
  console.log(`Found ${googleEvents.length} events in Google Calendar`);
  
  // Filter to only external events (not STS-prefixed)
  const externalEvents = googleEvents.filter((e: { summary?: string }) => 
    e.summary && !e.summary.startsWith('STS ')
  );
  
  console.log(`${externalEvents.length} external events to process`);
  
  // Get default service for external bookings
  const { data: defaultService } = await supabase
    .from('services')
    .select('id')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .limit(1)
    .single();
  
  if (!defaultService) {
    console.error('No active service found for external bookings');
    return stats;
  }
  
  // Get existing Google-sourced bookings
  const { data: existingBookings } = await supabase
    .from('bookings')
    .select('id, google_calendar_event_id, date, start_time, end_time')
    .eq('google_calendar_source', true)
    .gte('date', startDate.split('T')[0])
    .lte('date', endDate.split('T')[0]);
  
  interface ExistingBooking {
    id: string;
    google_calendar_event_id: string;
    date: string;
    start_time: string;
    end_time: string;
  }
  
  const existingByEventId = new Map<string, ExistingBooking>(
    (existingBookings || []).map((b: ExistingBooking) => [b.google_calendar_event_id, b])
  );
  
  const processedEventIds = new Set<string>();
  
  for (const event of externalEvents) {
    const parsed = parseGoogleEvent(event);
    if (!parsed) continue;
    
    processedEventIds.add(event.id);
    
    const existing = existingByEventId.get(event.id);
    
    if (existing) {
      // Update if changed
      const needsUpdate = 
        existing.date !== parsed.date ||
        existing.start_time !== parsed.startTime ||
        existing.end_time !== parsed.endTime;
      
      if (needsUpdate) {
        await supabase
          .from('bookings')
          .update({
            date: parsed.date,
            start_time: parsed.startTime,
            end_time: parsed.endTime
          })
          .eq('id', existing.id);
        stats.updated++;
      }
    } else {
      // Create new booking from Google event
      const eventName = event.summary || 'Google Calendar';
      const { error } = await supabase
        .from('bookings')
        .insert({
          customer_name: `Google: ${eventName}`,
          customer_phone: '---',
          service_id: defaultService.id,
          date: parsed.date,
          start_time: parsed.startTime,
          end_time: parsed.endTime,
          status: 'confirmed',
          is_system_booking: true,
          google_calendar_source: true,
          google_calendar_event_id: event.id
        });
      
      if (!error) {
        stats.created++;
      }
    }
  }
  
  // Delete bookings for events no longer in Google
  for (const [eventId, booking] of existingByEventId) {
    if (!processedEventIds.has(eventId)) {
      await supabase
        .from('bookings')
        .delete()
        .eq('id', booking.id);
      stats.deleted++;
    }
  }
  
  return stats;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate admin password
    const adminPassword = req.headers.get('x-admin-password');
    const storedPassword = Deno.env.get('ADMIN_PASSWORD');
    
    if (!storedPassword || adminPassword !== storedPassword) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { startDate, endDate } = body;
    
    // Default date range: today to 60 days ahead
    const now = new Date();
    const defaultStart = startDate || now.toISOString().split('T')[0];
    const defaultEnd = endDate || new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    console.log(`Full sync: ${defaultStart} to ${defaultEnd}`);

    const supabase: any = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get access token via Service Account JWT
    const accessToken = await getServiceAccountAccessToken();
    
    if (!accessToken) {
      return new Response(
        JSON.stringify({ error: 'Google Calendar not configured (Service Account)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get calendar ID from settings
    const calendarId = await getCalendarId(supabase);

    const stats: FullSyncStats = {
      pushedToGoogle: 0,
      updatedInGoogle: 0,
      pulledFromGoogle: 0,
      updatedFromGoogle: 0,
      deletedFromGoogle: 0,
      errors: []
    };

    // ========== PHASE 1: PUSH to Google ==========
    console.log('Phase 1: Pushing bookings to Google Calendar...');
    
    // Get all confirmed bookings in date range that need to be synced
    const { data: bookingsToSync } = await supabase
      .from('bookings')
      .select(`
        id, date, start_time, end_time, customer_name, customer_phone, customer_email,
        is_system_booking, google_calendar_event_id, google_calendar_source,
        services:service_id (name)
      `)
      .eq('status', 'confirmed')
      .eq('google_calendar_source', false) // Only push our bookings, not imported ones
      .gte('date', defaultStart)
      .lte('date', defaultEnd);

    console.log(`Found ${bookingsToSync?.length || 0} bookings to check for push`);

    for (const booking of bookingsToSync || []) {
      // Get service name - handle both single object and array cases
      const services = booking.services;
      const serviceName = Array.isArray(services) 
        ? services[0]?.name 
        : services?.name;
      
      const bookingWithService = {
        id: booking.id,
        date: booking.date,
        start_time: booking.start_time,
        end_time: booking.end_time,
        customer_name: booking.customer_name,
        customer_phone: booking.customer_phone,
        customer_email: booking.customer_email,
        is_system_booking: booking.is_system_booking,
        google_calendar_event_id: booking.google_calendar_event_id,
        service_name: serviceName
      };

      const result = await pushBookingToGoogle(accessToken, calendarId, bookingWithService);
      
      if (result.action === 'created') {
        stats.pushedToGoogle++;
        // Save the event ID
        if (result.eventId) {
          await supabase
            .from('bookings')
            .update({ google_calendar_event_id: result.eventId })
            .eq('id', booking.id);
        }
      } else if (result.action === 'updated') {
        stats.updatedInGoogle++;
      } else {
        stats.errors.push(`Failed to push booking ${booking.id}`);
      }
    }

    console.log(`Phase 1 complete: ${stats.pushedToGoogle} created, ${stats.updatedInGoogle} updated`);

    // ========== PHASE 2: PULL from Google ==========
    console.log('Phase 2: Pulling events from Google Calendar...');
    
    const pullStats = await pullFromGoogle(
      supabase,
      accessToken,
      calendarId,
      defaultStart,
      defaultEnd
    );
    
    stats.pulledFromGoogle = pullStats.created;
    stats.updatedFromGoogle = pullStats.updated;
    stats.deletedFromGoogle = pullStats.deleted;

    console.log(`Phase 2 complete: ${pullStats.created} created, ${pullStats.updated} updated, ${pullStats.deleted} deleted`);

    // Update last sync time
    const { data: existingSetting } = await supabase
      .from('settings')
      .select('id')
      .eq('key', 'google_calendar_last_sync')
      .single();

    if (existingSetting) {
      await supabase
        .from('settings')
        .update({ value: new Date().toISOString() })
        .eq('key', 'google_calendar_last_sync');
    } else {
      await supabase
        .from('settings')
        .insert({ key: 'google_calendar_last_sync', value: new Date().toISOString() });
    }

    return new Response(
      JSON.stringify({
        success: true,
        ...stats
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    const error = err as Error;
    console.error('Full sync error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
