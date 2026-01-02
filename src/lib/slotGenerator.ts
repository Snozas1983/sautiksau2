export interface TimeSlot {
  time: string;
  available: boolean;
}

export interface Booking {
  startTime: string;
  endTime: string;
}

export interface Settings {
  workStart: string;
  workEnd: string;
  breakBetween: number;
}

// Parse time string "HH:mm" to minutes since midnight
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

// Convert minutes since midnight to "HH:mm" format
function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

// Check if a slot overlaps with any booking
function isSlotOccupied(
  slotStart: number, 
  slotEnd: number, 
  bookings: Booking[]
): boolean {
  for (const booking of bookings) {
    const bookingStart = timeToMinutes(booking.startTime);
    const bookingEnd = timeToMinutes(booking.endTime);
    
    // Check for overlap
    if (slotStart < bookingEnd && slotEnd > bookingStart) {
      return true;
    }
  }
  return false;
}

export function generateAvailableSlots(
  settings: Settings,
  serviceDuration: number,
  bookings: Booking[]
): TimeSlot[] {
  const slots: TimeSlot[] = [];
  
  const workStartMinutes = timeToMinutes(settings.workStart);
  const workEndMinutes = timeToMinutes(settings.workEnd);
  const slotDuration = serviceDuration + settings.breakBetween;
  
  // Generate all possible slots
  for (let start = workStartMinutes; start + serviceDuration <= workEndMinutes; start += 30) {
    const end = start + serviceDuration;
    const time = minutesToTime(start);
    
    // Check if slot is occupied (including break time after)
    const isOccupied = isSlotOccupied(start, end + settings.breakBetween, bookings);
    
    slots.push({
      time,
      available: !isOccupied,
    });
  }
  
  return slots;
}

// Calculate end time based on start time and duration
export function calculateEndTime(startTime: string, durationMinutes: number): string {
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = startMinutes + durationMinutes;
  return minutesToTime(endMinutes);
}
