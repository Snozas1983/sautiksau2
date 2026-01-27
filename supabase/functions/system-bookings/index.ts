import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Service {
  id: string;
  name: string;
  duration: number;
  preparation_time: number | null;
}

interface Settings {
  workStart: string;
  workEnd: string;
  breakBetween: number;
  bookingDaysAhead: number;
}

// Helper to format time
function formatTime(hours: number, minutes: number): string {
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

// Parse time string to minutes
function parseTimeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

// Get available slots for a date
async function getAvailableSlots(
  supabase: SupabaseClient,
  date: string,
  services: Service[],
  settings: Settings
): Promise<{ service: Service; startTime: string; endTime: string }[]> {
  // Get existing bookings for this date
  const { data: existingBookings } = await supabase
    .from('bookings')
    .select('start_time, end_time')
    .eq('date', date)
    .in('status', ['pending', 'confirmed']);

  // Get exceptions for this date
  const dayOfWeek = new Date(date).getDay();
  const { data: exceptions } = await supabase
    .from('schedule_exceptions')
    .select('*')
    .or(`date.eq.${date},and(is_recurring.eq.true,day_of_week.eq.${dayOfWeek})`);

  const bookedSlots = ((existingBookings || []) as { start_time: string; end_time: string }[]).map(b => ({
    start: parseTimeToMinutes(b.start_time),
    end: parseTimeToMinutes(b.end_time)
  }));

  const blockedSlots = ((exceptions || []) as { exception_type: string; start_time: string; end_time: string }[])
    .filter(e => e.exception_type === 'blocked')
    .map(e => ({
      start: parseTimeToMinutes(e.start_time),
      end: parseTimeToMinutes(e.end_time)
    }));

  const allBlockedSlots = [...bookedSlots, ...blockedSlots];

  const availableSlots: { service: Service; startTime: string; endTime: string }[] = [];

  // Generate possible slots
  const workStartMinutes = parseTimeToMinutes(settings.workStart);
  const workEndMinutes = parseTimeToMinutes(settings.workEnd);

  for (const service of services) {
    const totalDuration = service.duration + (service.preparation_time || 0);
    
    for (let startMinutes = workStartMinutes; startMinutes + totalDuration <= workEndMinutes; startMinutes += 15) {
      const endMinutes = startMinutes + totalDuration;
      
      // Check if slot overlaps with any blocked/booked slot
      const isBlocked = allBlockedSlots.some(blocked => 
        (startMinutes < blocked.end && endMinutes > blocked.start)
      );
      
      if (!isBlocked) {
        availableSlots.push({
          service,
          startTime: formatTime(Math.floor(startMinutes / 60), startMinutes % 60),
          endTime: formatTime(Math.floor(endMinutes / 60), endMinutes % 60)
        });
      }
    }
  }

  return availableSlots;
}

// Sync a booking to Google Calendar
async function syncToGoogleCalendar(bookingId: string, action: 'create' | 'update' | 'delete'): Promise<void> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  
  if (!supabaseUrl || !serviceRoleKey) return;
  
  try {
    await fetch(`${supabaseUrl}/functions/v1/sync-google-calendar`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceRoleKey}`
      },
      body: JSON.stringify({ bookingId, action })
    });
  } catch (err) {
    console.error('Google sync error:', err);
  }
}

// Create a system booking
async function createSystemBooking(
  supabase: SupabaseClient,
  date: string,
  slot: { service: Service; startTime: string; endTime: string },
  actionDay: number
): Promise<string | null> {
  const { data, error } = await supabase.from('bookings').insert({
    date,
    start_time: slot.startTime,
    end_time: slot.endTime,
    service_id: slot.service.id,
    customer_name: 'SISTEMA',
    customer_phone: 'SYSTEM-INTERNAL',
    status: 'confirmed',
    is_system_booking: true,
    system_action_day: actionDay
  }).select('id').single();
  
  if (error || !data) return null;
  
  // Sync to Google Calendar
  await syncToGoogleCalendar(data.id, 'create');
  
  return data.id;
}

// Cancel a random system booking for a date
async function cancelRandomSystemBooking(
  supabase: SupabaseClient,
  date: string
): Promise<boolean> {
  const { data: systemBookings } = await supabase
    .from('bookings')
    .select('id')
    .eq('date', date)
    .eq('is_system_booking', true)
    .in('status', ['pending', 'confirmed']);

  const bookings = (systemBookings || []) as { id: string }[];
  if (bookings.length === 0) return false;

  const randomIndex = Math.floor(Math.random() * bookings.length);
  const bookingToCancel = bookings[randomIndex];

  await supabase
    .from('bookings')
    .update({ status: 'cancelled' })
    .eq('id', bookingToCancel.id);

  // Sync deletion to Google Calendar
  await syncToGoogleCalendar(bookingToCancel.id, 'delete');

  return true;
}

// Reschedule a system booking to a different time on the same date
async function rescheduleRandomSystemBooking(
  supabase: SupabaseClient,
  date: string,
  services: Service[],
  settings: Settings
): Promise<boolean> {
  const { data: systemBookings } = await supabase
    .from('bookings')
    .select('id, service_id')
    .eq('date', date)
    .eq('is_system_booking', true)
    .in('status', ['pending', 'confirmed']);

  const bookings = (systemBookings || []) as { id: string; service_id: string }[];
  if (bookings.length === 0) return false;

  const randomIndex = Math.floor(Math.random() * bookings.length);
  const bookingToReschedule = bookings[randomIndex];

  // Get available slots
  const availableSlots = await getAvailableSlots(supabase, date, services, settings);
  
  if (availableSlots.length === 0) return false;

  const newSlotIndex = Math.floor(Math.random() * availableSlots.length);
  const newSlot = availableSlots[newSlotIndex];

  await supabase
    .from('bookings')
    .update({
      start_time: newSlot.startTime,
      end_time: newSlot.endTime,
      service_id: newSlot.service.id
    })
    .eq('id', bookingToReschedule.id);

  // Sync update to Google Calendar
  await syncToGoogleCalendar(bookingToReschedule.id, 'update');

  return true;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get settings
    const { data: settingsData } = await supabase
      .from('settings')
      .select('key, value');

    const settings: Settings = {
      workStart: '09:00',
      workEnd: '18:00',
      breakBetween: 15,
      bookingDaysAhead: 30
    };

    for (const row of (settingsData || []) as { key: string; value: string }[]) {
      if (row.key === 'workStart') settings.workStart = row.value;
      if (row.key === 'workEnd') settings.workEnd = row.value;
      if (row.key === 'breakBetween') settings.breakBetween = parseInt(row.value);
      if (row.key === 'bookingDaysAhead') settings.bookingDaysAhead = parseInt(row.value);
    }

    // Get active services
    const { data: servicesData } = await supabase
      .from('services')
      .select('id, name, duration, preparation_time')
      .eq('is_active', true);

    const services = (servicesData || []) as Service[];

    if (services.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No active services found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const today = new Date();
    const actions: string[] = [];

    // Process each target day (1, 2, 3, 4 days ahead)
    for (const daysAhead of [4, 3, 2, 1]) {
      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() + daysAhead);
      const dateStr = targetDate.toISOString().split('T')[0];

      // Get existing system bookings for this date to check what's already done
      const { data: existingSystemBookings } = await supabase
        .from('bookings')
        .select('system_action_day')
        .eq('date', dateStr)
        .eq('is_system_booking', true)
        .in('status', ['pending', 'confirmed']);

      const actionDays = ((existingSystemBookings || []) as { system_action_day: number | null }[]).map(b => b.system_action_day);

      if (daysAhead === 4 && !actionDays.includes(4)) {
        // Day 4: Create 1 random booking
        const availableSlots = await getAvailableSlots(supabase, dateStr, services, settings);
        if (availableSlots.length > 0) {
          const randomIndex = Math.floor(Math.random() * availableSlots.length);
          await createSystemBooking(supabase, dateStr, availableSlots[randomIndex], 4);
          actions.push(`Created 1 booking for ${dateStr} (day 4)`);
        }
      }

      if (daysAhead === 3) {
        // Day 3: Create 2 more bookings
        const createdDay3 = actionDays.filter(d => d === 3).length;
        const toCreate = Math.max(0, 2 - createdDay3);
        
        for (let i = 0; i < toCreate; i++) {
          const availableSlots = await getAvailableSlots(supabase, dateStr, services, settings);
          if (availableSlots.length > 0) {
            const randomIndex = Math.floor(Math.random() * availableSlots.length);
            await createSystemBooking(supabase, dateStr, availableSlots[randomIndex], 3);
            actions.push(`Created booking for ${dateStr} (day 3)`);
          }
        }
      }

      if (daysAhead === 2) {
        // Day 2: Cancel OR reschedule 1 booking (50/50 chance)
        const shouldCancel = Math.random() < 0.5;
        
        if (shouldCancel) {
          const cancelled = await cancelRandomSystemBooking(supabase, dateStr);
          if (cancelled) {
            actions.push(`Cancelled 1 booking for ${dateStr} (day 2)`);
          }
        } else {
          const rescheduled = await rescheduleRandomSystemBooking(supabase, dateStr, services, settings);
          if (rescheduled) {
            actions.push(`Rescheduled 1 booking for ${dateStr} (day 2)`);
          }
        }
      }

      if (daysAhead === 1 && !actionDays.includes(1)) {
        // Day 1: Create 1 more booking
        const availableSlots = await getAvailableSlots(supabase, dateStr, services, settings);
        if (availableSlots.length > 0) {
          const randomIndex = Math.floor(Math.random() * availableSlots.length);
          await createSystemBooking(supabase, dateStr, availableSlots[randomIndex], 1);
          actions.push(`Created 1 booking for ${dateStr} (day 1)`);
        }
      }
    }

    // Trigger Google Calendar import for bidirectional sync
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      
      if (supabaseUrl && serviceRoleKey) {
        const syncResponse = await fetch(
          `${supabaseUrl}/functions/v1/import-google-calendar`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${serviceRoleKey}`
            }
          }
        );
        
        if (syncResponse.ok) {
          const syncResult = await syncResponse.json();
          actions.push(`Google Calendar sync: +${syncResult.created || 0} imported, -${syncResult.deleted || 0} removed`);
        }
      }
    } catch (syncErr) {
      console.error('Google Calendar sync error:', syncErr);
      // Don't fail the whole function if sync fails
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        actions,
        message: actions.length > 0 ? 'System bookings processed' : 'No actions needed'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    const error = err as Error;
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
