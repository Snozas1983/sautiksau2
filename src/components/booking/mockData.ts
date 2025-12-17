import { Service, DayAvailability, TimeSlot } from './types';
import { format, addDays, isSunday, startOfDay } from 'date-fns';

export const services: Service[] = [
  {
    id: 'kobido',
    name: 'Imperatoriškasis Kobido veido masažas',
    duration: 70,
    price: 60,
  },
  {
    id: 'chiro-iq',
    name: 'CHIRO IQ kūno atpalaiduojantis/stangrinantis/anticeliulitinis masažas',
    duration: 90,
    price: 80,
  },
];

// Generate time slots for a given service duration
const generateTimeSlots = (serviceDuration: number, slotsCount: number): TimeSlot[] => {
  const possibleStartTimes = ['09:00', '10:30', '12:00', '14:00', '15:30', '17:00'];
  const shuffled = [...possibleStartTimes].sort(() => Math.random() - 0.5);
  const selectedTimes = shuffled.slice(0, slotsCount);
  
  return selectedTimes.map((startTime, index) => {
    const [hours, minutes] = startTime.split(':').map(Number);
    const endMinutes = hours * 60 + minutes + serviceDuration;
    const endHours = Math.floor(endMinutes / 60);
    const endMins = endMinutes % 60;
    const endTime = `${endHours.toString().padStart(2, '0')}:${endMins.toString().padStart(2, '0')}`;
    
    return {
      id: `slot-${index}-${startTime}`,
      startTime,
      endTime,
    };
  }).sort((a, b) => a.startTime.localeCompare(b.startTime));
};

// Generate mock availability for the next 60 days
export const generateMockAvailability = (serviceDuration: number): DayAvailability[] => {
  const availability: DayAvailability[] = [];
  const today = startOfDay(new Date());
  
  for (let i = 1; i <= 60; i++) {
    const date = addDays(today, i);
    
    // Skip Sundays
    if (isSunday(date)) {
      availability.push({
        date: format(date, 'yyyy-MM-dd'),
        slots: [],
      });
      continue;
    }
    
    // Random availability: 70% chance of having slots
    const hasSlots = Math.random() > 0.3;
    const slotsCount = hasSlots ? Math.floor(Math.random() * 3) + 1 : 0;
    
    availability.push({
      date: format(date, 'yyyy-MM-dd'),
      slots: generateTimeSlots(serviceDuration, slotsCount),
    });
  }
  
  return availability;
};
