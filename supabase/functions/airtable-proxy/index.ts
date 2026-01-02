import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const AIRTABLE_API_TOKEN = Deno.env.get('AIRTABLE_API_TOKEN');
const AIRTABLE_BASE_ID = 'app0sAtFcDVOIJgIJ';
const AIRTABLE_API_URL = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}`;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-password',
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
    console.error('Airtable error:', error);
    throw new Error(`Airtable error: ${response.status}`);
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

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname.replace('/airtable-proxy', '');
    
    console.log(`Request: ${req.method} ${path}`);

    // PUBLIC ENDPOINTS

    // GET /services - Get active services
    if (path === '/services' && req.method === 'GET') {
      const data = await airtableRequest('/Services?filterByFormula={Active?}=TRUE()');
      const services = data.records.map((record: any) => ({
        id: record.id,
        name: record.fields['Service name'],
        duration: record.fields['Duration (minutes)'],
        price: record.fields['Regular price (EUR)'],
        isActive: record.fields['Active?'],
      }));
      
      return new Response(JSON.stringify({ services }), {
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

    const adminPassword = req.headers.get('x-admin-password');

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
                  'Key': key,
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
