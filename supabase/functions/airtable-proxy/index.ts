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
        .eq('status', 'confirmed');
      
      if (bookingsError) {
        console.error('Error fetching bookings:', bookingsError);
        throw bookingsError;
      }
      
      // 4. Get schedule exceptions
      const { data: exceptionsData, error: exceptionsError } = await supabaseAdmin
        .from('schedule_exceptions')
        .select('*');
      
      if (exceptionsError) {
        console.error('Error fetching exceptions:', exceptionsError);
        throw exceptionsError;
      }
      
      // Group exceptions by date and day of week
      const blockExceptionsByDate = new Map<string, Array<{ startTime: string; endTime: string }>>();
      const blockExceptionsByDayOfWeek = new Map<number, Array<{ startTime: string; endTime: string }>>();
      const allowExceptionsByDate = new Map<string, Array<{ startTime: string; endTime: string }>>();
      const allowExceptionsByDayOfWeek = new Map<number, Array<{ startTime: string; endTime: string }>>();
      // Date range exceptions (blocking multiple days with single entry)
      const dateRangeExceptions: Array<{ startDate: string; endDate: string; startTime: string; endTime: string }> = [];
      
      for (const ex of exceptionsData || []) {
        const startTime = ex.start_time?.substring(0, 5);
        const endTime = ex.end_time?.substring(0, 5);
        const interval = { startTime, endTime };
        
        if (ex.exception_type === 'block') {
          // Check if this is a date range exception
          if (ex.date && ex.end_date) {
            dateRangeExceptions.push({
              startDate: ex.date,
              endDate: ex.end_date,
              startTime,
              endTime
            });
          } else if (ex.is_recurring && ex.day_of_week !== null) {
            if (!blockExceptionsByDayOfWeek.has(ex.day_of_week)) {
              blockExceptionsByDayOfWeek.set(ex.day_of_week, []);
            }
            blockExceptionsByDayOfWeek.get(ex.day_of_week)!.push(interval);
          } else if (ex.date) {
            if (!blockExceptionsByDate.has(ex.date)) {
              blockExceptionsByDate.set(ex.date, []);
            }
            blockExceptionsByDate.get(ex.date)!.push(interval);
          }
        } else if (ex.exception_type === 'allow') {
          if (ex.is_recurring && ex.day_of_week !== null) {
            if (!allowExceptionsByDayOfWeek.has(ex.day_of_week)) {
              allowExceptionsByDayOfWeek.set(ex.day_of_week, []);
            }
            allowExceptionsByDayOfWeek.get(ex.day_of_week)!.push(interval);
          } else if (ex.date) {
            if (!allowExceptionsByDate.has(ex.date)) {
              allowExceptionsByDate.set(ex.date, []);
            }
            allowExceptionsByDate.get(ex.date)!.push(interval);
          }
        }
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
      
      // 5. Generate slots for each day
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
      
      function isSlotBlockedByException(
        dateStr: string,
        dayOfWeek: number,
        slotStart: number,
        slotEnd: number
      ): boolean {
        // Check date range exceptions first (e.g., vacation blocks)
        for (const range of dateRangeExceptions) {
          if (dateStr >= range.startDate && dateStr <= range.endDate) {
            const blockStart = timeToMinutes(range.startTime);
            const blockEnd = timeToMinutes(range.endTime);
            // Check if slot overlaps with blocked interval
            if (slotStart < blockEnd && slotEnd > blockStart) {
              return true;
            }
          }
        }
        
        // Check specific date blocks
        const dateBlocks = blockExceptionsByDate.get(dateStr) || [];
        for (const block of dateBlocks) {
          const blockStart = timeToMinutes(block.startTime);
          const blockEnd = timeToMinutes(block.endTime);
          // Check if slot overlaps with blocked interval
          if (slotStart < blockEnd && slotEnd > blockStart) {
            return true;
          }
        }
        
        // Check recurring day-of-week blocks
        const dayBlocks = blockExceptionsByDayOfWeek.get(dayOfWeek) || [];
        for (const block of dayBlocks) {
          const blockStart = timeToMinutes(block.startTime);
          const blockEnd = timeToMinutes(block.endTime);
          if (slotStart < blockEnd && slotEnd > blockStart) {
            return true;
          }
        }
        
        return false;
      }
      
      function isSlotAllowedOnWeekend(
        dateStr: string,
        dayOfWeek: number,
        slotStart: number,
        slotEnd: number
      ): boolean {
        // Check specific date allows
        const dateAllows = allowExceptionsByDate.get(dateStr) || [];
        for (const allow of dateAllows) {
          const allowStart = timeToMinutes(allow.startTime);
          const allowEnd = timeToMinutes(allow.endTime);
          // Slot must be fully within allowed interval
          if (slotStart >= allowStart && slotEnd <= allowEnd) {
            return true;
          }
        }
        
        // Check recurring day-of-week allows
        const dayAllows = allowExceptionsByDayOfWeek.get(dayOfWeek) || [];
        for (const allow of dayAllows) {
          const allowStart = timeToMinutes(allow.startTime);
          const allowEnd = timeToMinutes(allow.endTime);
          if (slotStart >= allowStart && slotEnd <= allowEnd) {
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
        
        // Saturday: only allow if there's an allow exception
        const isSaturday = dayOfWeek === 6;
        
        // Generate slots every 30 minutes
        for (let start = workStartMinutes; start + serviceDuration <= workEndMinutes; start += 30) {
          const end = start + serviceDuration;
          
          // For Saturday, check if slot is explicitly allowed
          if (isSaturday) {
            if (!isSlotAllowedOnWeekend(dateStr, dayOfWeek, start, end)) {
              continue; // Skip this slot - not allowed on Saturday
            }
          }
          
          // Check if slot is blocked by exception
          if (isSlotBlockedByException(dateStr, dayOfWeek, start, end)) {
            continue; // Skip blocked slot
          }
          
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
        // Contact information
        contactName: settings['contact_name'] || '',
        contactPhone: settings['contact_phone'] || '+37062082478',
        contactEmail: settings['contact_email'] || 'info@sautiksau.lt',
        contactFacebook: settings['contact_facebook'] || 'https://www.facebook.com/sautiksau',
        contactInstagram: settings['contact_instagram'] || 'https://www.instagram.com/sautiksaumasazas/',
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
        .eq('status', 'confirmed');
      
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
      
      // Check if client is blacklisted (by phone OR email)
      let isBlacklisted = false;
      let blacklistReason = '';
      
      // Check by phone
      if (body.customerPhone) {
        const { data: clientByPhone } = await supabaseAdmin
          .from('clients')
          .select('is_blacklisted, blacklist_reason')
          .eq('phone', body.customerPhone)
          .maybeSingle();
        
        if (clientByPhone?.is_blacklisted) {
          isBlacklisted = true;
          blacklistReason = clientByPhone.blacklist_reason || 'Neatvyko';
          console.log('BLACKLISTED CLIENT (by phone):', body.customerPhone);
        }
      }
      
      // Check by email (if not already blacklisted)
      if (!isBlacklisted && body.customerEmail) {
        const { data: clientByEmail } = await supabaseAdmin
          .from('clients')
          .select('is_blacklisted, blacklist_reason')
          .eq('email', body.customerEmail)
          .maybeSingle();
        
        if (clientByEmail?.is_blacklisted) {
          isBlacklisted = true;
          blacklistReason = clientByEmail.blacklist_reason || 'Neatvyko';
          console.log('BLACKLISTED CLIENT (by email):', body.customerEmail);
        }
      }
      
      // Get service details
      const { data: service, error: serviceError } = await supabaseAdmin
        .from('services')
        .select('id, name, duration, price')
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
      
      // Upsert client record with phone AND email
      if (body.customerPhone) {
        const { data: existingClient } = await supabaseAdmin
          .from('clients')
          .select('id, email')
          .eq('phone', body.customerPhone)
          .maybeSingle();
        
        if (existingClient) {
          // Update existing client with email if provided
          await supabaseAdmin
            .from('clients')
            .update({ 
              name: body.customerName,
              email: body.customerEmail || existingClient.email,
            })
            .eq('id', existingClient.id);
        } else {
          // Create new client
          await supabaseAdmin
            .from('clients')
            .insert({
              phone: body.customerPhone,
              email: body.customerEmail || null,
              name: body.customerName,
            });
        }
      }
      
      // Insert booking into Supabase - PENDING if blacklisted, CONFIRMED otherwise
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
          status: isBlacklisted ? 'pending' : 'confirmed',
        })
        .select()
        .single();
      
      if (insertError) {
        console.error('Error creating booking:', insertError);
        throw insertError;
      }
      
      console.log('Booking created:', newBooking.id, 'status:', newBooking.status);

      // Send notifications based on blacklist status
      if (isBlacklisted) {
        // Send PENDING APPROVAL notification (instead of normal booking notification)
        fetch(`${SUPABASE_URL}/functions/v1/send-notifications`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            type: 'pending_approval',
            bookingId: newBooking.id,
            manageToken: newBooking.manage_token,
            serviceName: service.name,
            date: body.date,
            startTime: body.startTime,
            endTime: endTime,
            customerName: body.customerName,
            customerPhone: body.customerPhone,
            customerEmail: body.customerEmail,
            blacklistReason: blacklistReason,
          }),
        })
          .then(res => console.log('pending_approval notification status:', res.status))
          .catch(err => console.error('Failed to send pending_approval notification:', err));
      } else {
        // Send normal booking notification
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
        
        // Sync to Google Calendar (only for confirmed bookings)
        fetch(`${SUPABASE_URL}/functions/v1/sync-google-calendar`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            bookingId: newBooking.id,
            action: 'create'
          }),
        })
          .then(res => console.log('Google Calendar sync status:', res.status))
          .catch(err => console.error('Google Calendar sync error:', err));
      }
      
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

    // PUT /booking/:token - Update booking by token (cancel or reschedule)
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
      
      if (body.action === 'reschedule') {
        const updateData: Record<string, any> = {};
        if (body.date) updateData.date = body.date;
        if (body.startTime) updateData.start_time = body.startTime;
        if (body.endTime) updateData.end_time = body.endTime;
        
        const { error } = await supabaseAdmin
          .from('bookings')
          .update(updateData)
          .eq('manage_token', token);
        
        if (error) {
          console.error('Reschedule error:', error);
          throw error;
        }
        
        console.log('Booking rescheduled:', token, updateData);
        
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
      
      // Get all unique phone numbers to check blacklist status
      const phones = [...new Set((data || []).map((r: any) => r.customer_phone))];
      const { data: clientsData } = await supabaseAdmin
        .from('clients')
        .select('phone, is_blacklisted')
        .in('phone', phones);
      
      const blacklistedPhones = new Set(
        (clientsData || [])
          .filter((c: any) => c.is_blacklisted)
          .map((c: any) => c.phone)
      );
      
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
        isBlacklisted: blacklistedPhones.has(record.customer_phone),
        isSystemBooking: record.is_system_booking || false,
        systemActionDay: record.system_action_day,
      }));
      
      return new Response(JSON.stringify({ bookings }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // PUT /admin/bookings/:id - Update booking (status and/or reschedule)
    if (path.startsWith('/admin/bookings/') && req.method === 'PUT') {
      const bookingId = path.split('/').pop();
      const body = await req.json();
      
      // Get current booking data for comparison
      const { data: currentBooking } = await supabaseAdmin
        .from('bookings')
        .select('status, date, start_time, end_time, google_calendar_event_id, google_calendar_source')
        .eq('id', bookingId)
        .single();
      
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
      
      // Sync with Google Calendar (only if not imported from Google)
      if (currentBooking && !currentBooking.google_calendar_source) {
        const statusChanged = body.status && body.status !== currentBooking.status;
        const dateChanged = body.date && body.date !== currentBooking.date;
        const timeChanged = body.startTime && body.startTime !== currentBooking.start_time?.substring(0, 5);
        
        if (statusChanged && body.status === 'cancelled') {
          // Delete from Google Calendar when cancelled
          fetch(`${SUPABASE_URL}/functions/v1/sync-google-calendar`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            },
            body: JSON.stringify({
              bookingId: bookingId,
              action: 'delete'
            }),
          })
            .then(res => console.log('Google Calendar delete status:', res.status))
            .catch(err => console.error('Google Calendar delete error:', err));
        } else if (dateChanged || timeChanged) {
          // Update Google Calendar event when rescheduled
          fetch(`${SUPABASE_URL}/functions/v1/sync-google-calendar`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            },
            body: JSON.stringify({
              bookingId: bookingId,
              action: 'update'
            }),
          })
            .then(res => console.log('Google Calendar update status:', res.status))
            .catch(err => console.error('Google Calendar update error:', err));
        }
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

    // GET /admin/clients - Get all clients with filters
    if (path === '/admin/clients' && req.method === 'GET') {
      const blacklistOnly = url.searchParams.get('blacklistOnly') === 'true';
      const search = url.searchParams.get('search');
      
      let query = supabaseAdmin.from('clients').select('*');
      
      if (blacklistOnly) {
        query = query.eq('is_blacklisted', true);
      }
      
      if (search) {
        query = query.or(`phone.ilike.%${search}%,name.ilike.%${search}%,email.ilike.%${search}%`);
      }
      
      const { data, error } = await query.order('updated_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching clients:', error);
        throw error;
      }
      
      // Get booking counts for each client
      const phones = (data || []).map((c: any) => c.phone);
      const { data: bookingsData } = await supabaseAdmin
        .from('bookings')
        .select('customer_phone')
        .in('customer_phone', phones);
      
      const bookingCounts = new Map<string, number>();
      for (const b of bookingsData || []) {
        const count = bookingCounts.get(b.customer_phone) || 0;
        bookingCounts.set(b.customer_phone, count + 1);
      }
      
      const clients = (data || []).map((record: any) => ({
        id: record.id,
        phone: record.phone,
        email: record.email,
        name: record.name,
        isBlacklisted: record.is_blacklisted,
        blacklistReason: record.blacklist_reason,
        noShowCount: record.no_show_count,
        createdAt: record.created_at,
        updatedAt: record.updated_at,
        bookingsCount: bookingCounts.get(record.phone) || 0,
      }));
      
      return new Response(JSON.stringify({ clients }), {
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

    // PUT /admin/exceptions/:id - Update exception
    if (path.match(/^\/admin\/exceptions\/[^/]+$/) && req.method === 'PUT') {
      const exceptionId = path.split('/').pop();
      const body = await req.json();
      
      const { error } = await supabaseAdmin
        .from('schedule_exceptions')
        .update({
          start_time: body.start_time,
          end_time: body.end_time,
          exception_type: body.exception_type,
          is_recurring: body.is_recurring,
          description: body.description,
          date: body.date,
          end_date: body.end_date,
          day_of_week: body.day_of_week,
        })
        .eq('id', exceptionId);
      
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

    // Google Calendar status check
    if (req.method === 'POST') {
      const body = await req.json().catch(() => ({}));
      
      if (body.action === 'google-calendar-status') {
        // Check if Service Account is configured
        const serviceAccountEmail = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_EMAIL');
        const serviceAccountKey = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY');
        
        // Get last sync timestamp and calendar ID from settings
        const settings = await getSettings();
        const lastSync = settings['google_calendar_last_sync'] || null;
        const calendarId = settings['google_calendar_id'] || 'primary';
        
        if (serviceAccountEmail && serviceAccountKey) {
          // Service Account is configured - always connected
          return new Response(JSON.stringify({
            connected: true,
            calendarId: calendarId,
            expiresAt: null, // Service Account tokens don't expire
            lastSync,
            authType: 'service_account'
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        } else {
          // Service Account not configured
          return new Response(JSON.stringify({
            connected: false,
            calendarId: null,
            expiresAt: null,
            lastSync: null,
            authType: null
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }
      
      // Note: google-calendar-disconnect is no longer needed with Service Account
      // but keeping for backwards compatibility (clears old OAuth tokens)
      if (body.action === 'google-calendar-disconnect') {
        await supabaseAdmin
          .from('google_calendar_tokens')
          .delete()
          .neq('id', '00000000-0000-0000-0000-000000000000');
        
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
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
