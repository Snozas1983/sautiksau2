import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Initialize Supabase admin client
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-password, x-admin-password-b64',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

// Get settings from Supabase
async function getSettings(): Promise<Record<string, string>> {
  const { data, error } = await supabaseAdmin
    .from('settings')
    .select('key, value');
  
  if (error) {
    console.error('Error fetching settings:', error);
    throw error;
  }
  
  const settings: Record<string, string> = {};
  for (const row of data || []) {
    settings[row.key] = row.value;
  }
  
  return settings;
}

// Verify admin password using Supabase Secret
function verifyAdminPassword(password: string): boolean {
  const adminPassword = Deno.env.get('ADMIN_PASSWORD');
  return password === adminPassword;
}

function decodeBase64Utf8(value: string): string {
  const bin = atob(value);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

// Helper functions for time calculations
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname.replace('/airtable-proxy', '');
    
    console.log(`Request: ${req.method} ${path}`);

    // PUBLIC ENDPOINTS

    // GET /services - Get active services
    if (path === '/services' && req.method === 'GET') {
      const { data, error } = await supabaseAdmin
        .from('services')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
      
      if (error) {
        console.error('Error fetching services:', error);
        throw error;
      }
      
      const services = data.map((record: any) => ({
        id: record.id,
        name: record.name,
        duration: record.duration,
        price: record.price,
        isActive: record.is_active,
      }));
      
      return new Response(JSON.stringify({ services }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // GET /availability/calendar - Get calendar availability for a date range
    if (path === '/availability/calendar' && req.method === 'GET') {
      const serviceDuration = parseInt(url.searchParams.get('serviceDuration') || '60');
      const daysAhead = parseInt(url.searchParams.get('daysAhead') || '30');
      
      console.log(`Generating calendar availability: duration=${serviceDuration}, daysAhead=${daysAhead}`);
      
      // 1. Get settings for work hours
      const settings = await getSettings();
      const workStart = settings['work_start'] || '09:00';
      const workEnd = settings['work_end'] || '18:00';
      const breakBetween = parseInt(settings['break_between'] || '0');
      
      // 2. Calculate date range
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const maxDate = new Date(today);
      maxDate.setDate(maxDate.getDate() + daysAhead);
      
      // 3. Get all bookings in this date range from Supabase
      const startDateStr = today.toISOString().split('T')[0];
      const endDateStr = maxDate.toISOString().split('T')[0];
      
      const { data: bookingsData, error: bookingsError } = await supabaseAdmin
        .from('bookings')
        .select('date, start_time, end_time')
        .gte('date', startDateStr)
        .lte('date', endDateStr)
        .in('status', ['pending', 'confirmed']);
      
      if (bookingsError) {
        console.error('Error fetching bookings:', bookingsError);
        throw bookingsError;
      }
      
      // Group bookings by date
      const bookingsByDate = new Map<string, Array<{ startTime: string; endTime: string }>>();
      for (const booking of bookingsData || []) {
        const date = booking.date;
        const startTime = booking.start_time?.substring(0, 5); // "HH:MM:SS" -> "HH:MM"
        const endTime = booking.end_time?.substring(0, 5);
        
        if (date && startTime && endTime) {
          if (!bookingsByDate.has(date)) {
            bookingsByDate.set(date, []);
          }
          bookingsByDate.get(date)!.push({ startTime, endTime });
        }
      }
      
      // 4. Generate slots for each day
      const availability: Array<{ date: string; slots: Array<{ id: string; startTime: string; endTime: string }> }> = [];
      
      function isSlotOccupied(
        slotStart: number, 
        slotEnd: number, 
        bookings: Array<{ startTime: string; endTime: string }>
      ): boolean {
        for (const booking of bookings) {
          const bookingStart = timeToMinutes(booking.startTime);
          const bookingEnd = timeToMinutes(booking.endTime);
          
          // Check for overlap (including break time)
          if (slotStart < bookingEnd + breakBetween && slotEnd > bookingStart) {
            return true;
          }
        }
        return false;
      }
      
      const workStartMinutes = timeToMinutes(workStart);
      const workEndMinutes = timeToMinutes(workEnd);
      
      for (let i = 1; i <= daysAhead; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() + i);
        const dateStr = date.toISOString().split('T')[0];
        const dayOfWeek = date.getDay(); // 0 = Sunday
        
        // Skip Sundays
        if (dayOfWeek === 0) {
          availability.push({ date: dateStr, slots: [] });
          continue;
        }
        
        const dayBookings = bookingsByDate.get(dateStr) || [];
        const slots: Array<{ id: string; startTime: string; endTime: string }> = [];
        
        // Generate slots every 30 minutes
        for (let start = workStartMinutes; start + serviceDuration <= workEndMinutes; start += 30) {
          const end = start + serviceDuration;
          
          // Check if slot is available (not occupied by existing bookings)
          if (!isSlotOccupied(start, end, dayBookings)) {
            const startTime = minutesToTime(start);
            const endTime = minutesToTime(end);
            slots.push({
              id: `${dateStr}-${startTime}`,
              startTime,
              endTime,
            });
          }
        }
        
        availability.push({ date: dateStr, slots });
      }
      
      console.log(`Generated availability for ${availability.length} days`);
      
      return new Response(JSON.stringify({ 
        availability,
        maxDate: endDateStr,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // GET /settings - Get public settings
    if (path === '/settings' && req.method === 'GET') {
      const settings = await getSettings();
      
      const publicSettings = {
        workStart: settings['work_start'] || '09:00',
        workEnd: settings['work_end'] || '18:00',
        breakBetween: parseInt(settings['break_between'] || '0'),
        bookingDaysAhead: parseInt(settings['booking_days_ahead'] || '60'),
        depositAmount: parseFloat(settings['deposit_amount'] || '10'),
        cancelHoursBefore: parseInt(settings['cancel_hours_before'] || '24'),
      };
      
      return new Response(JSON.stringify({ settings: publicSettings }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // GET /bookings?date=YYYY-MM-DD - Get bookings for a date
    if (path === '/bookings' && req.method === 'GET') {
      const date = url.searchParams.get('date');
      
      let query = supabaseAdmin
        .from('bookings')
        .select('*, services(name)')
        .in('status', ['pending', 'confirmed']);
      
      if (date) {
        query = query.eq('date', date);
      }
      
      const { data, error } = await query;
      
      if (error) {
        console.error('Error fetching bookings:', error);
        throw error;
      }
      
      const bookings = (data || []).map((record: any) => ({
        id: record.id,
        serviceId: record.service_id,
        serviceName: record.services?.name || 'Paslauga',
        date: record.date,
        startTime: record.start_time?.substring(0, 5),
        endTime: record.end_time?.substring(0, 5),
        status: record.status,
        customerName: record.customer_name,
        customerPhone: record.customer_phone,
        customerEmail: record.customer_email,
        promoCode: record.promo_code,
        createdAt: record.created_at,
      }));
      
      return new Response(JSON.stringify({ bookings }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // POST /bookings - Create new booking
    if (path === '/bookings' && req.method === 'POST') {
      const body = await req.json();
      
      console.log('POST /bookings received:', { 
        serviceId: body.serviceId,
        date: body.date,
        startTime: body.startTime,
        customerName: body.customerName,
      });
      
      // Get service details
      const { data: service, error: serviceError } = await supabaseAdmin
        .from('services')
        .select('id, name, duration')
        .eq('id', body.serviceId)
        .single();
      
      if (serviceError || !service) {
        console.error('Service lookup failed:', serviceError);
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Invalid serviceId - service not found' 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      // Calculate end time
      const startMinutes = timeToMinutes(body.startTime);
      const endMinutes = startMinutes + service.duration;
      const endTime = minutesToTime(endMinutes);
      
      // Insert booking into Supabase
      const { data: newBooking, error: insertError } = await supabaseAdmin
        .from('bookings')
        .insert({
          service_id: body.serviceId,
          date: body.date,
          start_time: body.startTime,
          end_time: endTime,
          customer_name: body.customerName,
          customer_phone: body.customerPhone,
          customer_email: body.customerEmail || null,
          promo_code: body.promoCode || null,
          status: 'pending',
        })
        .select()
        .single();
      
      if (insertError) {
        console.error('Error creating booking:', insertError);
        throw insertError;
      }
      
      console.log('Booking created:', newBooking.id);

      // Send notifications asynchronously with manage_token
      fetch(`${SUPABASE_URL}/functions/v1/send-notifications`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          bookingId: newBooking.id,
          manageToken: newBooking.manage_token,
          serviceName: service.name,
          date: body.date,
          startTime: body.startTime,
          endTime: endTime,
          customerName: body.customerName,
          customerPhone: body.customerPhone,
          customerEmail: body.customerEmail,
        }),
      })
        .then(res => console.log('send-notifications response status:', res.status))
        .catch(err => console.error('Failed to send notifications:', err));
      
      return new Response(JSON.stringify({ success: true, booking: newBooking }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // GET /clients/check?phone=XXX - Check if phone is blacklisted
    if (path === '/clients/check' && req.method === 'GET') {
      const phone = url.searchParams.get('phone');
      
      if (!phone) {
        return new Response(JSON.stringify({ error: 'Phone required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      const { data, error } = await supabaseAdmin
        .from('clients')
        .select('is_blacklisted, no_show_count')
        .eq('phone', phone)
        .single();
      
      if (error && error.code !== 'PGRST116') { // PGRST116 = not found
        console.error('Error checking client:', error);
        throw error;
      }
      
      if (data) {
        return new Response(JSON.stringify({ 
          found: true,
          isBlacklisted: data.is_blacklisted,
          noShowCount: data.no_show_count,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      return new Response(JSON.stringify({ found: false, isBlacklisted: false }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // GET /booking/:token - Get booking by manage token (public)
    if (path.match(/^\/booking\/[^/]+$/) && req.method === 'GET') {
      const token = path.split('/').pop();
      
      const { data, error } = await supabaseAdmin
        .from('bookings')
        .select('*, services(name)')
        .eq('manage_token', token)
        .single();
      
      if (error || !data) {
        return new Response(JSON.stringify({ error: 'Booking not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      // Get cancel hours setting
      const settings = await getSettings();
      const cancelHoursBefore = parseInt(settings['cancel_hours_before'] || '24');
      
      return new Response(JSON.stringify({
        booking: {
          id: data.id,
          serviceName: data.services?.name || 'Paslauga',
          date: data.date,
          startTime: data.start_time?.substring(0, 5),
          endTime: data.end_time?.substring(0, 5),
          status: data.status,
          customerName: data.customer_name,
          cancelHoursBefore,
        },
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // PUT /booking/:token - Update booking by token (cancel)
    if (path.match(/^\/booking\/[^/]+$/) && req.method === 'PUT') {
      const token = path.split('/').pop();
      const body = await req.json();
      
      if (body.action === 'cancel') {
        const { error } = await supabaseAdmin
          .from('bookings')
          .update({ status: 'cancelled' })
          .eq('manage_token', token);
        
        if (error) {
          throw error;
        }
        
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      return new Response(JSON.stringify({ error: 'Invalid action' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ADMIN ENDPOINTS (require password)

    const adminPasswordRaw = req.headers.get('x-admin-password');
    const adminPasswordB64 = req.headers.get('x-admin-password-b64');
    const adminPassword = adminPasswordB64 ? decodeBase64Utf8(adminPasswordB64) : adminPasswordRaw;

    // POST /admin/login - Verify admin password
    if (path === '/admin/login' && req.method === 'POST') {
      const body = await req.json();
      const isValid = verifyAdminPassword(body.password);

      return new Response(JSON.stringify({ success: isValid }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check admin auth for other admin endpoints
    if (path.startsWith('/admin/') && path !== '/admin/login') {
      if (!adminPassword || !verifyAdminPassword(adminPassword)) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // GET /admin/bookings - Get all bookings with filters
    if (path === '/admin/bookings' && req.method === 'GET') {
      const status = url.searchParams.get('status');
      const dateFrom = url.searchParams.get('dateFrom');
      const dateTo = url.searchParams.get('dateTo');
      
      let query = supabaseAdmin
        .from('bookings')
        .select('*, services(name)')
        .order('date', { ascending: false })
        .order('start_time', { ascending: false });
      
      if (status && status !== 'all') {
        query = query.eq('status', status);
      }
      if (dateFrom) {
        query = query.gte('date', dateFrom);
      }
      if (dateTo) {
        query = query.lte('date', dateTo);
      }
      
      const { data, error } = await query;
      
      if (error) {
        console.error('Error fetching admin bookings:', error);
        throw error;
      }
      
      const bookings = (data || []).map((record: any) => ({
        id: record.id,
        serviceId: record.service_id,
        serviceName: record.services?.name || 'Paslauga',
        date: record.date,
        startTime: record.start_time?.substring(0, 5),
        endTime: record.end_time?.substring(0, 5),
        status: record.status,
        customerName: record.customer_name,
        customerPhone: record.customer_phone,
        customerEmail: record.customer_email,
        promoCode: record.promo_code,
        createdAt: record.created_at,
      }));
      
      return new Response(JSON.stringify({ bookings }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // PUT /admin/bookings/:id - Update booking (status and/or reschedule)
    if (path.startsWith('/admin/bookings/') && req.method === 'PUT') {
      const bookingId = path.split('/').pop();
      const body = await req.json();
      
      // Build update object
      const updateData: Record<string, any> = {};
      
      if (body.status) {
        updateData.status = body.status;
      }
      if (body.date) {
        updateData.date = body.date;
      }
      if (body.startTime) {
        updateData.start_time = body.startTime;
      }
      if (body.endTime) {
        updateData.end_time = body.endTime;
      }
      
      const { error } = await supabaseAdmin
        .from('bookings')
        .update(updateData)
        .eq('id', bookingId);
      
      if (error) {
        console.error('Error updating booking:', error);
        throw error;
      }
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // GET /admin/settings - Get all settings
    if (path === '/admin/settings' && req.method === 'GET') {
      const settings = await getSettings();
      
      return new Response(JSON.stringify({ settings }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // PUT /admin/settings - Update settings
    if (path === '/admin/settings' && req.method === 'PUT') {
      const body = await req.json();
      
      for (const [key, value] of Object.entries(body)) {
        const { error } = await supabaseAdmin
          .from('settings')
          .upsert(
            { key, value: String(value), updated_at: new Date().toISOString() },
            { onConflict: 'key' }
          );
        
        if (error) {
          console.error(`Error updating setting ${key}:`, error);
          throw error;
        }
      }
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // PUT /admin/clients/:id - Update client (blacklist)
    if (path.startsWith('/admin/clients/') && !path.includes('blacklist') && req.method === 'PUT') {
      const clientId = path.split('/').pop();
      const body = await req.json();
      
      const updates: any = { updated_at: new Date().toISOString() };
      if (body.isBlacklisted !== undefined) {
        updates.is_blacklisted = body.isBlacklisted;
      }
      if (body.blacklistReason) {
        updates.blacklist_reason = body.blacklistReason;
      }
      if (body.noShowCount !== undefined) {
        updates.no_show_count = body.noShowCount;
      }
      
      const { error } = await supabaseAdmin
        .from('clients')
        .update(updates)
        .eq('id', clientId);
      
      if (error) {
        console.error('Error updating client:', error);
        throw error;
      }
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // POST /admin/clients/blacklist - Add phone to blacklist
    if (path === '/admin/clients/blacklist' && req.method === 'POST') {
      const body = await req.json();
      
      // Try to find existing client
      const { data: existingClient } = await supabaseAdmin
        .from('clients')
        .select('id, no_show_count')
        .eq('phone', body.phone)
        .single();
      
      if (existingClient) {
        // Update existing client
        const { error } = await supabaseAdmin
          .from('clients')
          .update({
            is_blacklisted: true,
            blacklist_reason: body.reason || 'No show',
            no_show_count: (existingClient.no_show_count || 0) + 1,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingClient.id);
        
        if (error) {
          console.error('Error blacklisting client:', error);
          throw error;
        }
      } else {
        // Create new client
        const { error } = await supabaseAdmin
          .from('clients')
          .insert({
            phone: body.phone,
            name: body.name || null,
            is_blacklisted: true,
            blacklist_reason: body.reason || 'No show',
            no_show_count: 1,
          });
        
        if (error) {
          console.error('Error creating blacklisted client:', error);
          throw error;
        }
      }
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // GET /admin/services - Get all services (including inactive)
    if (path === '/admin/services' && req.method === 'GET') {
      console.log('Fetching all services from Supabase...');
      
      const { data, error } = await supabaseAdmin
        .from('services')
        .select('*')
        .order('sort_order', { ascending: true });
      
      if (error) {
        console.error('Error fetching admin services:', error);
        throw error;
      }
      
      const services = (data || []).map((record: any) => ({
        id: record.id,
        name: record.name,
        duration: record.duration,
        preparationTime: record.preparation_time || 0,
        bookingTime: record.duration + (record.preparation_time || 0),
        price: record.price,
        isActive: record.is_active,
        description: record.description || '',
        sortOrder: record.sort_order || 999,
      }));
      
      return new Response(JSON.stringify({ services }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // POST /admin/services - Create new service
    if (path === '/admin/services' && req.method === 'POST') {
      const body = await req.json();
      console.log('Creating new service:', body);
      
      const { data, error } = await supabaseAdmin
        .from('services')
        .insert({
          name: body.name,
          duration: body.duration,
          preparation_time: body.preparationTime || 0,
          price: body.price,
          is_active: body.isActive ?? true,
          description: body.description || '',
          sort_order: body.sortOrder || 999,
        })
        .select()
        .single();
      
      if (error) {
        console.error('Error creating service:', error);
        throw error;
      }
      
      return new Response(JSON.stringify({ success: true, service: data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // PUT /admin/services/:id - Update service
    if (path.match(/^\/admin\/services\/[^/]+$/) && req.method === 'PUT') {
      const serviceId = path.split('/').pop();
      const body = await req.json();
      console.log('Updating service:', serviceId, body);
      
      const updates: any = {};
      if (body.name !== undefined) updates.name = body.name;
      if (body.duration !== undefined) updates.duration = body.duration;
      if (body.preparationTime !== undefined) updates.preparation_time = body.preparationTime;
      if (body.price !== undefined) updates.price = body.price;
      if (body.isActive !== undefined) updates.is_active = body.isActive;
      if (body.description !== undefined) updates.description = body.description;
      if (body.sortOrder !== undefined) updates.sort_order = body.sortOrder;
      
      const { error } = await supabaseAdmin
        .from('services')
        .update(updates)
        .eq('id', serviceId);
      
      if (error) {
        console.error('Error updating service:', error);
        throw error;
      }
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // DELETE /admin/services/:id - Delete service
    if (path.match(/^\/admin\/services\/[^/]+$/) && req.method === 'DELETE') {
      const serviceId = path.split('/').pop();
      console.log('Deleting service:', serviceId);
      
      const { error } = await supabaseAdmin
        .from('services')
        .delete()
        .eq('id', serviceId);
      
      if (error) {
        console.error('Error deleting service:', error);
        throw error;
      }
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // GET /admin/templates - Get all notification templates
    if (path === '/admin/templates' && req.method === 'GET') {
      const { data, error } = await supabaseAdmin
        .from('notification_templates')
        .select('*')
        .order('type');
      
      if (error) throw error;
      
      return new Response(JSON.stringify({ templates: data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // PUT /admin/templates/:id - Update template
    if (path.match(/^\/admin\/templates\/[^/]+$/) && req.method === 'PUT') {
      const templateId = path.split('/').pop();
      const body = await req.json();
      
      const { error } = await supabaseAdmin
        .from('notification_templates')
        .update({
          subject: body.subject,
          body: body.body,
          is_active: body.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq('id', templateId);
      
      if (error) throw error;
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // GET /admin/exceptions - Get all schedule exceptions
    if (path === '/admin/exceptions' && req.method === 'GET') {
      const { data, error } = await supabaseAdmin
        .from('schedule_exceptions')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      return new Response(JSON.stringify({ exceptions: data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // POST /admin/exceptions - Create exception
    if (path === '/admin/exceptions' && req.method === 'POST') {
      const body = await req.json();
      
      const { error } = await supabaseAdmin
        .from('schedule_exceptions')
        .insert(body);
      
      if (error) throw error;
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // DELETE /admin/exceptions/:id - Delete exception
    if (path.match(/^\/admin\/exceptions\/[^/]+$/) && req.method === 'DELETE') {
      const exceptionId = path.split('/').pop();
      
      const { error } = await supabaseAdmin
        .from('schedule_exceptions')
        .delete()
        .eq('id', exceptionId);
      
      if (error) throw error;
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 404 for unknown endpoints
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
