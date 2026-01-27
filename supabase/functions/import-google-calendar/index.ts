import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-password',
};

interface CalendarToken {
  access_token: string;
  refresh_token: string;
  expires_at: string;
  calendar_id: string;
  id: string;
}

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

// Refresh access token if expired
async function getValidAccessToken(
  supabase: SupabaseClient,
  token: CalendarToken
): Promise<string | null> {
  const expiresAt = new Date(token.expires_at);
  const now = new Date();

  if (expiresAt.getTime() - now.getTime() > 5 * 60 * 1000) {
    return token.access_token;
  }

  const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');

  if (!clientId || !clientSecret) {
    console.error('Google credentials not configured');
    return null;
  }

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: token.refresh_token,
      grant_type: 'refresh_token'
    })
  });

  const data = await response.json();

  if (data.error) {
    console.error('Token refresh error:', data);
    return null;
  }

  const newExpiresAt = new Date(Date.now() + data.expires_in * 1000);
  await supabase
    .from('google_calendar_tokens')
    .update({
      access_token: data.access_token,
      expires_at: newExpiresAt.toISOString()
    })
    .eq('id', token.id);

  return data.access_token;
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
  
  // First get the existing event
  const getResponse = await fetch(url, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  
  if (!getResponse.ok) return false;
  
  const existingEvent = await getResponse.json();
  
  // Update with new values
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
  // Skip cancelled events
  if (event.status === 'cancelled') return null;

  // Handle dateTime events (specific time)
  if (event.start?.dateTime && event.end?.dateTime) {
    const start = new Date(event.start.dateTime);
    const end = new Date(event.end.dateTime);
    
    return {
      date: start.toISOString().split('T')[0],
      startTime: start.toTimeString().substring(0, 5),
      endTime: end.toTimeString().substring(0, 5)
    };
  }

  // Handle all-day events - skip them as they don't have specific times
  if (event.start?.date) {
    return null;
  }

  return null;
}

// Get a dummy service ID for imported events
async function getDummyServiceId(supabase: SupabaseClient): Promise<string> {
  // Get the first active service
  const { data: services } = await supabase
    .from('services')
    .select('id')
    .eq('is_active', true)
    .limit(1);

  if (services && services.length > 0) {
    return services[0].id;
  }

  // Fallback: get any service
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

    // Validate either admin password or service role key
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

    // Get calendar token
    const { data: tokens } = await supabase
      .from('google_calendar_tokens')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (!tokens) {
      return new Response(
        JSON.stringify({ error: 'Google Calendar not connected' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tokenData = tokens as CalendarToken;
    const accessToken = await getValidAccessToken(supabase, tokenData);

    if (!accessToken) {
      return new Response(
        JSON.stringify({ error: 'Failed to get valid access token' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Define time range: today to 60 days ahead
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const timeMin = now.toISOString();
    
    const maxDate = new Date(now);
    maxDate.setDate(maxDate.getDate() + 60);
    const timeMax = maxDate.toISOString();

    console.log(`Fetching Google Calendar events from ${timeMin} to ${timeMax}`);

    // Fetch events from Google Calendar
    const calendarId = tokenData.calendar_id || 'primary';
    const googleEvents = await fetchGoogleCalendarEvents(accessToken, calendarId, timeMin, timeMax);
    
    console.log(`Found ${googleEvents.length} events in Google Calendar`);

    // Filter out events created by Lovable (those will have specific naming)
    // Events NOT created by Lovable = external events to import
    const externalEvents = googleEvents.filter(event => {
      // Skip events that are already synced from Lovable
      const summary = event.summary || '';
      // If it starts with STS - it's our event, skip
      if (summary.startsWith('STS ')) return false;
      // Legacy: If it starts with [SISTEMA] it's from old Lovable system bookings
      if (summary.startsWith('[SISTEMA]')) return false;
      // Legacy: If it looks like a customer booking "Name - Service", skip it
      if (summary.includes(' - ') && !summary.includes('@')) return false;
      
      return true;
    });

    console.log(`${externalEvents.length} external events to process`);

    // Get existing bookings that were imported from Google Calendar
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

    // Get a dummy service ID for imported events
    const dummyServiceId = await getDummyServiceId(supabase);

    const stats = {
      created: 0,
      updated: 0,
      deleted: 0,
      skipped: 0
    };

    // Process each external event
    const googleEventIds = new Set<string>();
    
    for (const event of externalEvents) {
      const parsed = parseGoogleEvent(event);
      if (!parsed) {
        stats.skipped++;
        continue;
      }

      googleEventIds.add(event.id);

      if (existingEventIds.has(event.id)) {
        // Update existing booking
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
        // Create new booking from Google event
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

    // Delete bookings that no longer exist in Google Calendar
    for (const [eventId, bookingId] of existingBookingsMap) {
      if (!googleEventIds.has(eventId)) {
        await supabase
          .from('bookings')
          .delete()
          .eq('id', bookingId);
        stats.deleted++;
      }
    }

    // Fix old events that don't have STS prefix
    const eventsNeedingUpdate = googleEvents.filter(event => {
      const summary = event.summary || '';
      // If starts with [SISTEMA] - old format, needs update
      if (summary.startsWith('[SISTEMA]')) return true;
      // If looks like our format "Name - Service" but no STS prefix
      if (summary.includes(' - ') && !summary.includes('@') && !summary.startsWith('STS ')) return true;
      return false;
    });

    let stsFixed = 0;
    for (const event of eventsNeedingUpdate) {
      const oldSummary = event.summary || '';
      let newSummary = oldSummary;
      
      if (oldSummary.startsWith('[SISTEMA]')) {
        newSummary = 'STS Užimta';
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

    // Update last sync timestamp in settings
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
