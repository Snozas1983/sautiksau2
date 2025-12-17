export interface Service {
  id: string;
  name: string;
  duration: number; // in minutes
  price: number;
}

export interface TimeSlot {
  id: string;
  startTime: string; // "HH:mm"
  endTime: string; // "HH:mm"
}

export interface DayAvailability {
  date: string; // "YYYY-MM-DD"
  slots: TimeSlot[];
}

export interface CustomerFormData {
  fullName: string;
  phone: string;
  email: string;
  promoCode: string;
}

export type BookingStep = 'service' | 'calendar' | 'time' | 'form';

export interface BookingState {
  step: BookingStep;
  selectedService: Service | null;
  selectedDate: Date | null;
  selectedTimeSlot: TimeSlot | null;
  formData: CustomerFormData;
}
