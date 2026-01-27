import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CalendarToken {
  access_token: string;
  refresh_token: string;
  expires_at: string;
  calendar_id: string;
  id: string;
}

// Refresh access token if expired
async function getValidAccessToken(
  supabase: SupabaseClient,
  token: CalendarToken
): Promise<string | null> {
  const expiresAt = new Date(token.expires_at);
  const now = new Date();

  // If token is still valid (with 5 min buffer), return it
  if (expiresAt.getTime() - now.getTime() > 5 * 60 * 1000) {
    return token.access_token;
  }

  // Refresh the token
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

  // Update token in database
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

// Create or update calendar event
async function syncEventToCalendar(
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
  },
  action: 'create' | 'update' | 'delete'
): Promise<string | null> {
  const baseUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;

  if (action === 'delete') {
    if (!booking.google_calendar_event_id) return null;
    
    await fetch(`${baseUrl}/${booking.google_calendar_event_id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    return null;
  }

  // Prepare event data
  const startDateTime = `${booking.date}T${booking.start_time}:00`;
  const endDateTime = `${booking.date}T${booking.end_time}:00`;

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

  let response: Response;
  
  if (action === 'update' && booking.google_calendar_event_id) {
    response = await fetch(`${baseUrl}/${booking.google_calendar_event_id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(event)
    });
  } else {
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
    console.error('Calendar API error:', result);
    return null;
  }

  return result.id;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { bookingId, action, adminPassword } = await req.json();

    // Validate admin password if provided
    if (adminPassword) {
      const storedPassword = Deno.env.get('ADMIN_PASSWORD');
      if (!storedPassword || adminPassword !== storedPassword) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
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
        JSON.stringify({ message: 'Google Calendar not connected' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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

    // Get booking details
    const { data: bookingData } = await supabase
      .from('bookings')
      .select(`
        *,
        services:service_id (name)
      `)
      .eq('id', bookingId)
      .single();

    if (!bookingData) {
      return new Response(
        JSON.stringify({ error: 'Booking not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const booking = bookingData as {
      id: string;
      date: string;
      start_time: string;
      end_time: string;
      customer_name: string;
      customer_phone: string;
      customer_email: string | null;
      is_system_booking: boolean;
      google_calendar_event_id: string | null;
      services: { name: string } | null;
    };

    const bookingWithService = {
      ...booking,
      service_name: booking.services?.name
    };

    const eventId = await syncEventToCalendar(
      accessToken,
      tokenData.calendar_id,
      bookingWithService,
      action
    );

    // Update booking with event ID if created
    if (action !== 'delete' && eventId) {
      await supabase
        .from('bookings')
        .update({ google_calendar_event_id: eventId })
        .eq('id', bookingId);
    } else if (action === 'delete') {
      await supabase
        .from('bookings')
        .update({ google_calendar_event_id: null })
        .eq('id', bookingId);
    }

    return new Response(
      JSON.stringify({ success: true, eventId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    const error = err as Error;
    console.error('Sync error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
