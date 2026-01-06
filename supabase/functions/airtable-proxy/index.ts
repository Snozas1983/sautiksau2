import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const AIRTABLE_API_TOKEN = Deno.env.get('AIRTABLE_API_TOKEN');
const AIRTABLE_BASE_ID = 'app0sAtFcDVOIJgIJ';
const AIRTABLE_API_URL = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}`;

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

// Helper to make Airtable requests
async function airtableRequest(endpoint: string, options: RequestInit = {}) {
  const response = await fetch(`${AIRTABLE_API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${AIRTABLE_API_TOKEN}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  
  if (!response.ok) {
    const error = await response.text();
    console.error('Airtable error:', { endpoint, status: response.status, error });
    throw new Error(`Airtable error ${response.status}: ${error}`);
  }
  
  return response.json();
}

// Get settings from key-value Settings table
async function getSettings() {
  const data = await airtableRequest('/Settings');
  const settings: Record<string, string> = {};
  
  for (const record of data.records) {
    const key = record.fields['Key'] || record.fields['Name'];
    const value = record.fields['Value'];
    if (key && value !== undefined) {
      settings[key] = value;
    }
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
      // Fetch from Supabase instead of Airtable (synced data)
      const { data, error } = await supabaseAdmin
        .from('services')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
      
      if (error) {
        console.error('Error fetching services from Supabase:', error);
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
      const workStart = settings['M-F Start'] || '09:00';
      const workEnd = settings['M-F Finish'] || '18:00';
      const breakBetween = parseInt(settings['break_between'] || '15');
      
      // 2. Calculate date range
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const maxDate = new Date(today);
      maxDate.setDate(maxDate.getDate() + daysAhead);
      
      // 3. Get all bookings in this date range from Airtable
      const startDateStr = today.toISOString().split('T')[0];
      const endDateStr = maxDate.toISOString().split('T')[0];
      
      const bookingsData = await airtableRequest(
        `/Bookings?filterByFormula=AND({Date}>='${startDateStr}',{Date}<='${endDateStr}',OR({Status}='pending',{Status}='confirmed'))`
      );
      
      // Group bookings by date
      const bookingsByDate = new Map<string, Array<{ startTime: string; endTime: string }>>();
      for (const record of bookingsData.records) {
        const date = record.fields['Date'];
        const startTime = record.fields['Start Time'];
        const endTime = record.fields['End Time'];
        
        if (date && startTime && endTime) {
          if (!bookingsByDate.has(date)) {
            bookingsByDate.set(date, []);
          }
          bookingsByDate.get(date)!.push({ startTime, endTime });
        }
      }
      
      // 4. Generate slots for each day
      const availability: Array<{ date: string; slots: Array<{ id: string; startTime: string; endTime: string }> }> = [];
      
      // Helper functions
      function timeToMinutes(time: string): number {
        const [hours, minutes] = time.split(':').map(Number);
        return hours * 60 + minutes;
      }
      
      function minutesToTime(minutes: number): string {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
      }
      
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
      
      // Return only public settings (not admin_password)
      const publicSettings = {
        workStart: settings['M-F Start'] || '09:00',
        workEnd: settings['M-F Finish'] || '18:00',
        breakBetween: parseInt(settings['break_between'] || '15'),
        bookingDaysAhead: parseInt(settings['booking_days_ahead'] || '60'),
        depositAmount: parseFloat(settings['deposit_amount'] || '10'),
        cancelHoursBefore: parseInt(settings['cancel_hours_before'] || settings['Canselation time'] || '24'),
      };
      
      return new Response(JSON.stringify({ settings: publicSettings }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // GET /bookings?date=YYYY-MM-DD - Get bookings for a date
    if (path === '/bookings' && req.method === 'GET') {
      const date = url.searchParams.get('date');
      
      let filter = '';
      if (date) {
        filter = `?filterByFormula=AND({Date}='${date}',OR({Status}='pending',{Status}='confirmed'))`;
      }
      
      const data = await airtableRequest(`/Bookings${filter}`);
      const bookings = data.records.map((record: any) => ({
        id: record.id,
        serviceId: record.fields['Service']?.[0],
        date: record.fields['Date'],
        startTime: record.fields['Start Time'],
        endTime: record.fields['End Time'],
        status: record.fields['Status'],
        customerName: record.fields['Customer Name'],
        customerPhone: record.fields['Customer Phone'],
        customerEmail: record.fields['Customer Email'],
        promoCode: record.fields['Promo Code'],
        createdAt: record.fields['Created At'],
      }));
      
      return new Response(JSON.stringify({ bookings }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // POST /bookings - Create new booking
    if (path === '/bookings' && req.method === 'POST') {
      const body = await req.json();
      
      const data = await airtableRequest('/Bookings', {
        method: 'POST',
        body: JSON.stringify({
          records: [{
            fields: {
              'Service': [body.serviceId],
              'Date': body.date,
              'Start Time': body.startTime,
              'End Time': body.endTime,
              'Customer Name': body.customerName,
              'Customer Phone': body.customerPhone,
              'Customer Email': body.customerEmail,
              'Status': 'pending',
              'Promo Code': body.promoCode || '',
            }
          }]
        }),
      });
      
      return new Response(JSON.stringify({ success: true, booking: data.records[0] }), {
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
      
      const data = await airtableRequest(`/Clients?filterByFormula={Phone}='${phone}'`);
      
      if (data.records.length > 0) {
        const client = data.records[0];
        const isBlacklisted = client.fields['Is Blacklisted'] === true;
        
        return new Response(JSON.stringify({ 
          found: true,
          isBlacklisted,
          noShowCount: client.fields['No Show Count'] || 0,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      return new Response(JSON.stringify({ found: false, isBlacklisted: false }), {
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
      
      let filters: string[] = [];
      
      if (status && status !== 'all') {
        filters.push(`{Status}='${status}'`);
      }
      if (dateFrom) {
        filters.push(`{Date}>='${dateFrom}'`);
      }
      if (dateTo) {
        filters.push(`{Date}<='${dateTo}'`);
      }
      
      let filterFormula = '';
      if (filters.length > 0) {
        filterFormula = `?filterByFormula=${encodeURIComponent(filters.length > 1 ? `AND(${filters.join(',')})` : filters[0])}&sort[0][field]=Date&sort[0][direction]=desc`;
      } else {
        filterFormula = '?sort[0][field]=Date&sort[0][direction]=desc';
      }
      
      const data = await airtableRequest(`/Bookings${filterFormula}`);
      const bookings = data.records.map((record: any) => ({
        id: record.id,
        serviceId: record.fields['Service']?.[0],
        serviceName: record.fields['Service Name']?.[0] || 'Paslauga',
        date: record.fields['Date'],
        startTime: record.fields['Start Time'],
        endTime: record.fields['End Time'],
        status: record.fields['Status'] || 'pending',
        customerName: record.fields['Customer Name'],
        customerPhone: record.fields['Customer Phone'],
        customerEmail: record.fields['Customer Email'],
        promoCode: record.fields['Promo Code'],
        createdAt: record.fields['Created At'],
      }));
      
      return new Response(JSON.stringify({ bookings }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // PUT /admin/bookings/:id - Update booking status
    if (path.startsWith('/admin/bookings/') && req.method === 'PUT') {
      const bookingId = path.split('/').pop();
      const body = await req.json();
      
      await airtableRequest(`/Bookings/${bookingId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          fields: {
            'Status': body.status,
          }
        }),
      });
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // GET /admin/settings - Get all settings (including password for editing)
    if (path === '/admin/settings' && req.method === 'GET') {
      const settings = await getSettings();
      
      return new Response(JSON.stringify({ settings }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // PUT /admin/settings - Update settings
    if (path === '/admin/settings' && req.method === 'PUT') {
      const body = await req.json();
      
      // Get existing records to update
      const existingData = await airtableRequest('/Settings');
      const updates: any[] = [];
      
      for (const [key, value] of Object.entries(body)) {
        const existingRecord = existingData.records.find((r: any) => 
          (r.fields['Key'] || r.fields['Name']) === key
        );
        
        if (existingRecord) {
          updates.push({
            id: existingRecord.id,
            fields: { 'Value': value }
          });
        } else {
          // Create new setting if doesn't exist
          await airtableRequest('/Settings', {
            method: 'POST',
            body: JSON.stringify({
              records: [{
                fields: {
                  'Name': key,
                  'Value': String(value),
                }
              }]
            }),
          });
        }
      }
      
      if (updates.length > 0) {
        await airtableRequest('/Settings', {
          method: 'PATCH',
          body: JSON.stringify({ records: updates }),
        });
      }
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // PUT /admin/clients/:id - Update client (blacklist)
    if (path.startsWith('/admin/clients/') && req.method === 'PUT') {
      const clientId = path.split('/').pop();
      const body = await req.json();
      
      const fields: any = {};
      if (body.isBlacklisted !== undefined) {
        fields['Is Blacklisted'] = body.isBlacklisted;
      }
      if (body.blacklistReason) {
        fields['Blacklist Reason'] = body.blacklistReason;
      }
      if (body.noShowCount !== undefined) {
        fields['No Show Count'] = body.noShowCount;
      }
      
      await airtableRequest(`/Clients/${clientId}`, {
        method: 'PATCH',
        body: JSON.stringify({ fields }),
      });
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // POST /admin/clients/blacklist - Add phone to blacklist (find or create client)
    if (path === '/admin/clients/blacklist' && req.method === 'POST') {
      const body = await req.json();
      
      // Try to find existing client
      const existingData = await airtableRequest(`/Clients?filterByFormula={Phone}='${body.phone}'`);
      
      if (existingData.records.length > 0) {
        // Update existing client
        const client = existingData.records[0];
        await airtableRequest(`/Clients/${client.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            fields: {
              'Is Blacklisted': true,
              'Blacklist Reason': body.reason || 'No show',
              'No Show Count': (client.fields['No Show Count'] || 0) + 1,
            }
          }),
        });
      } else {
        // Create new client
        await airtableRequest('/Clients', {
          method: 'POST',
          body: JSON.stringify({
            records: [{
              fields: {
                'Phone': body.phone,
                'Name': body.name || 'Unknown',
                'Is Blacklisted': true,
                'Blacklist Reason': body.reason || 'No show',
                'No Show Count': 1,
              }
            }]
          }),
        });
      }
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // GET /admin/services - Get all services from Airtable (including inactive)
    if (path === '/admin/services' && req.method === 'GET') {
      console.log('Fetching all services from Airtable...');
      const data = await airtableRequest('/Services?sort[0][field]=Sort order&sort[0][direction]=asc');
      
      const services = data.records.map((record: any) => ({
        id: record.id,
        name: record.fields['Service name'] || '',
        duration: record.fields['Duration (minutes)'] || 0,
        preparationTime: record.fields['Preparation (minutes)'] || 0,
        bookingTime: record.fields['Booking time (minutes)'] || 0,
        price: record.fields['Regular price (EUR)'] || 0,
        isActive: record.fields['Active?'] ?? true,
        description: record.fields['Description'] || '',
        sortOrder: record.fields['Sort order'] || 1,
      }));
      
      return new Response(JSON.stringify({ services }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // POST /admin/services - Create new service in Airtable
    if (path === '/admin/services' && req.method === 'POST') {
      const body = await req.json();
      console.log('Creating new service:', body);
      
      const data = await airtableRequest('/Services', {
        method: 'POST',
        body: JSON.stringify({
          records: [{
            fields: {
              'Service name': body.name,
              'Duration (minutes)': body.duration,
              'Preparation (minutes)': body.preparationTime,
              // 'Booking time (minutes)' is a formula field - don't write to it
              'Regular price (EUR)': body.price,
              'Active?': body.isActive,
              'Description': body.description,
              'Sort order': body.sortOrder,
            }
          }]
        }),
      });
      
      return new Response(JSON.stringify({ success: true, service: data.records[0] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // PUT /admin/services/:id - Update service in Airtable
    if (path.match(/^\/admin\/services\/[^/]+$/) && req.method === 'PUT') {
      const serviceId = path.split('/').pop();
      const body = await req.json();
      console.log('Updating service:', serviceId, body);
      
      const fields: any = {};
      if (body.name !== undefined) fields['Service name'] = body.name;
      if (body.duration !== undefined) fields['Duration (minutes)'] = body.duration;
      if (body.preparationTime !== undefined) fields['Preparation (minutes)'] = body.preparationTime;
      // 'Booking time (minutes)' is a formula field - don't write to it
      if (body.price !== undefined) fields['Regular price (EUR)'] = body.price;
      if (body.isActive !== undefined) fields['Active?'] = body.isActive;
      if (body.description !== undefined) fields['Description'] = body.description;
      if (body.sortOrder !== undefined) fields['Sort order'] = body.sortOrder;
      
      await airtableRequest(`/Services/${serviceId}`, {
        method: 'PATCH',
        body: JSON.stringify({ fields }),
      });
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // DELETE /admin/services/:id - Delete service from Airtable
    if (path.match(/^\/admin\/services\/[^/]+$/) && req.method === 'DELETE') {
      const serviceId = path.split('/').pop();
      console.log('Deleting service:', serviceId);
      
      await airtableRequest(`/Services/${serviceId}`, {
        method: 'DELETE',
      });
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // POST /admin/sync-services - Sync services from Airtable to Supabase
    if (path === '/admin/sync-services' && req.method === 'POST') {
      console.log('Starting services sync from Airtable to Supabase...');
      
      // 1. Fetch all services from Airtable
      const airtableData = await airtableRequest('/Services');
      console.log(`Found ${airtableData.records.length} services in Airtable`);
      
      // 2. Create Supabase client with service role
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      
      let synced = 0;
      let errors: string[] = [];
      
      // 3. Upsert each service
      for (const record of airtableData.records) {
        const serviceName = record.fields['Service name'];
        const duration = record.fields['Duration (minutes)'];
        const price = record.fields['Regular price (EUR)'];
        const isActive = record.fields['Active?'] ?? true;
        const sortOrder = record.fields['Sort order'] ?? 999;
        
        if (!serviceName || !duration || price === undefined) {
          console.log(`Skipping record ${record.id} - missing required fields`);
          continue;
        }
        
        // Check if service with this airtable_id exists
        const { data: existingService } = await supabase
          .from('services')
          .select('id')
          .eq('airtable_id', record.id)
          .single();
        
        if (existingService) {
          // Update existing
          const { error } = await supabase
            .from('services')
            .update({
              name: serviceName,
              duration: duration,
              price: price,
              is_active: isActive,
              sort_order: sortOrder,
            })
            .eq('airtable_id', record.id);
          
          if (error) {
            console.error(`Error updating service ${record.id}:`, error);
            errors.push(`Update ${serviceName}: ${error.message}`);
          } else {
            synced++;
          }
        } else {
          // Insert new
          const { error } = await supabase
            .from('services')
            .insert({
              airtable_id: record.id,
              name: serviceName,
              duration: duration,
              price: price,
              is_active: isActive,
              sort_order: sortOrder,
            });
          
          if (error) {
            console.error(`Error inserting service ${record.id}:`, error);
            errors.push(`Insert ${serviceName}: ${error.message}`);
          } else {
            synced++;
          }
        }
      }
      
      console.log(`Sync complete: ${synced} services synced, ${errors.length} errors`);
      
      return new Response(JSON.stringify({ 
        success: errors.length === 0,
        synced,
        total: airtableData.records.length,
        errors: errors.length > 0 ? errors : undefined,
      }), {
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
