import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    // Get the frontend URL for redirects
    const frontendUrl = Deno.env.get('FRONTEND_URL') || 'https://sau-tik-sau-zen.lovable.app';

    if (error) {
      console.error('OAuth error:', error);
      return Response.redirect(`${frontendUrl}/admin-dashboard?google_error=${encodeURIComponent(error)}`);
    }

    if (!code) {
      return Response.redirect(`${frontendUrl}/admin-dashboard?google_error=no_code`);
    }

    // Verify state (admin password)
    let adminPassword: string;
    try {
      adminPassword = atob(state || '');
    } catch {
      return Response.redirect(`${frontendUrl}/admin-dashboard?google_error=invalid_state`);
    }

    const storedPassword = Deno.env.get('ADMIN_PASSWORD');
    if (!storedPassword || adminPassword !== storedPassword) {
      return Response.redirect(`${frontendUrl}/admin-dashboard?google_error=unauthorized`);
    }

    const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
    const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');

    if (!clientId || !clientSecret) {
      return Response.redirect(`${frontendUrl}/admin-dashboard?google_error=not_configured`);
    }

    const redirectUri = `${Deno.env.get('SUPABASE_URL')}/functions/v1/google-calendar-callback`;

    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      })
    });

    const tokens = await tokenResponse.json();

    if (tokens.error) {
      console.error('Token exchange error:', tokens);
      return Response.redirect(`${frontendUrl}/admin-dashboard?google_error=${encodeURIComponent(tokens.error)}`);
    }

    // Get the primary calendar
    const calendarResponse = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
      headers: { 'Authorization': `Bearer ${tokens.access_token}` }
    });

    const calendars = await calendarResponse.json();
    let calendarId = 'primary';

    // Try to find SAUTIKSAU calendar or use primary
    if (calendars.items) {
      const sauTikSauCalendar = calendars.items.find((cal: { summary?: string }) => 
        cal.summary?.toLowerCase().includes('sautiksau')
      );
      if (sauTikSauCalendar) {
        calendarId = sauTikSauCalendar.id;
      }
    }

    // Calculate expiration time
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    // Save tokens to database
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Delete existing tokens and insert new ones
    await supabase.from('google_calendar_tokens').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    
    const { error: insertError } = await supabase.from('google_calendar_tokens').insert({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: expiresAt.toISOString(),
      calendar_id: calendarId
    });

    if (insertError) {
      console.error('Insert error:', insertError);
      return Response.redirect(`${frontendUrl}/admin-dashboard?google_error=save_failed`);
    }

    return Response.redirect(`${frontendUrl}/admin-dashboard?google_success=true`);
  } catch (error) {
    console.error('Callback error:', error);
    const frontendUrl = Deno.env.get('FRONTEND_URL') || 'https://sau-tik-sau-zen.lovable.app';
    return Response.redirect(`${frontendUrl}/admin-dashboard?google_error=unknown`);
  }
});
