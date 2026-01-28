import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getServiceAccountAccessToken, getCalendarId } from '../_shared/google-jwt.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-password',
};

interface GoogleEvent {
  id: string;
  summary?: string;
  description?: string;
  start: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  status: string;
}

// Fetch events from Google Calendar
async function fetchGoogleCalendarEvents(
  accessToken: string,
  calendarId: string,
  timeMin: string,
  timeMax: string
): Promise<GoogleEvent[]> {
  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '500'
  });

  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`;
  
  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });

  const data = await response.json();

  if (data.error) {
    console.error('Google Calendar API error:', data.error);
    throw new Error(data.error.message);
  }

  return data.items || [];
}

// Update a Google Calendar event
async function updateGoogleCalendarEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
  updates: { summary?: string }
): Promise<boolean> {
  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`;
  
  const getResponse = await fetch(url, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  
  if (!getResponse.ok) return false;
  
  const existingEvent = await getResponse.json();
  
  const updatedEvent = {
    ...existingEvent,
    ...updates
  };
  
  const updateResponse = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(updatedEvent)
  });
  
  return updateResponse.ok;
}

// Parse Google event to get date and time
function parseGoogleEvent(event: GoogleEvent): { date: string; startTime: string; endTime: string } | null {
  if (event.status === 'cancelled') return null;

  if (event.start?.dateTime && event.end?.dateTime) {
    const start = new Date(event.start.dateTime);
    const end = new Date(event.end.dateTime);
    
    return {
      date: start.toISOString().split('T')[0],
      startTime: start.toTimeString().substring(0, 5),
      endTime: end.toTimeString().substring(0, 5)
    };
  }

  if (event.start?.date) {
    return null;
  }

  return null;
}

// Get a dummy service ID for imported events
async function getDummyServiceId(supabase: SupabaseClient): Promise<string> {
  const { data: services } = await supabase
    .from('services')
    .select('id')
    .eq('is_active', true)
    .limit(1);

  if (services && services.length > 0) {
    return services[0].id;
  }

  const { data: anyService } = await supabase
    .from('services')
    .select('id')
    .limit(1);

  if (anyService && anyService.length > 0) {
    return anyService[0].id;
  }

  throw new Error('No services found in database');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const adminPassword = req.headers.get('x-admin-password');
    const authHeader = req.headers.get('authorization');
    const storedPassword = Deno.env.get('ADMIN_PASSWORD');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    const isAdminAuth = adminPassword && adminPassword === storedPassword;
    const isServiceRoleAuth = authHeader && authHeader === `Bearer ${serviceRoleKey}`;

    if (!isAdminAuth && !isServiceRoleAuth) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
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

    // Define time range: today to 60 days ahead
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const timeMin = now.toISOString();
    
    const maxDate = new Date(now);
    maxDate.setDate(maxDate.getDate() + 60);
    const timeMax = maxDate.toISOString();

    console.log(`Fetching Google Calendar events from ${timeMin} to ${timeMax}`);

    const googleEvents = await fetchGoogleCalendarEvents(accessToken, calendarId, timeMin, timeMax);
    
    console.log(`Found ${googleEvents.length} events in Google Calendar`);

    // Filter to only external events (not already synced from our system)
    const externalEvents = googleEvents.filter(event => {
      const summary = event.summary || '';
      // Skip our own synced events
      if (summary.startsWith('STS ')) return false;
      // Skip legacy system events
      if (summary.startsWith('[SISTEMA]')) return false;
      return true;
    });

    console.log(`${externalEvents.length} external events to process`);

    const { data: existingImported } = await supabase
      .from('bookings')
      .select('id, google_calendar_event_id')
      .eq('google_calendar_source', true)
      .gte('date', now.toISOString().split('T')[0]);

    const existingEventIds = new Set(
      (existingImported || [])
        .filter(b => b.google_calendar_event_id)
        .map(b => b.google_calendar_event_id)
    );

    const existingBookingsMap = new Map(
      (existingImported || [])
        .filter(b => b.google_calendar_event_id)
        .map(b => [b.google_calendar_event_id, b.id])
    );

    const dummyServiceId = await getDummyServiceId(supabase);

    const stats = {
      created: 0,
      updated: 0,
      deleted: 0,
      skipped: 0
    };

    const googleEventIds = new Set<string>();
    
    for (const event of externalEvents) {
      const parsed = parseGoogleEvent(event);
      if (!parsed) {
        stats.skipped++;
        continue;
      }

      googleEventIds.add(event.id);

      if (existingEventIds.has(event.id)) {
        const bookingId = existingBookingsMap.get(event.id);
        if (bookingId) {
          await supabase
            .from('bookings')
            .update({
              date: parsed.date,
              start_time: parsed.startTime,
              end_time: parsed.endTime
            })
            .eq('id', bookingId);
          stats.updated++;
        }
      } else {
        const { error: insertError } = await supabase
          .from('bookings')
          .insert({
            service_id: dummyServiceId,
            date: parsed.date,
            start_time: parsed.startTime,
            end_time: parsed.endTime,
            customer_name: event.summary || 'Google Calendar',
            customer_phone: 'google-import',
            status: 'confirmed',
            is_system_booking: true,
            google_calendar_source: true,
            google_calendar_event_id: event.id
          });

        if (insertError) {
          console.error('Error creating imported booking:', insertError);
        } else {
          stats.created++;
        }
      }
    }

    for (const [eventId, bookingId] of existingBookingsMap) {
      if (!googleEventIds.has(eventId)) {
        await supabase
          .from('bookings')
          .delete()
          .eq('id', bookingId);
        stats.deleted++;
      }
    }

    // Find all events that need STS prefix added
    const eventsNeedingUpdate = googleEvents.filter(event => {
      const summary = event.summary || '';
      // Skip already prefixed events
      if (summary.startsWith('STS ')) return false;
      // Update legacy [SISTEMA] events
      if (summary.startsWith('[SISTEMA]')) return true;
      // Add STS prefix to any other event
      return true;
    });

    let stsFixed = 0;
    for (const event of eventsNeedingUpdate) {
      const oldSummary = event.summary || '';
      let newSummary = oldSummary;
      
      if (oldSummary.startsWith('[SISTEMA]')) {
        newSummary = 'STS SISTEMA';
      } else {
        newSummary = `STS ${oldSummary}`;
      }
      
      const updated = await updateGoogleCalendarEvent(accessToken, calendarId, event.id, { summary: newSummary });
      if (updated) {
        stsFixed++;
        console.log(`Fixed event: "${oldSummary}" -> "${newSummary}"`);
      }
    }
    
    if (stsFixed > 0) {
      console.log(`Fixed ${stsFixed} events with STS prefix`);
    }

    await supabase
      .from('settings')
      .upsert(
        { 
          key: 'google_calendar_last_sync', 
          value: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        { onConflict: 'key' }
      );

    console.log('Import completed:', stats);

    return new Response(
      JSON.stringify({ 
        success: true, 
        ...stats,
        stsFixed,
        totalGoogleEvents: googleEvents.length,
        externalEvents: externalEvents.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    const error = err as Error;
    console.error('Import error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
