import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { Service, TimeSlot, BookingStep, CustomerFormData, DayAvailability } from './types';
import { services, generateMockAvailability } from './mockData';
import { ServiceSelector } from './ServiceSelector';
import { BookingCalendar } from './BookingCalendar';
import { TimeSlotSelector } from './TimeSlotSelector';
import { BookingForm } from './BookingForm';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export const BookingSection = () => {
  const [step, setStep] = useState<BookingStep>('service');
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<TimeSlot | null>(null);

  // Generate availability based on selected service
  const availability = useMemo(() => {
    if (!selectedService) return [];
    return generateMockAvailability(selectedService.duration);
  }, [selectedService]);

  const getAvailableSlotsForDate = (date: Date): TimeSlot[] => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const dayAvailability = availability.find((d) => d.date === dateStr);
    return dayAvailability?.slots || [];
  };

  const handleSelectService = (service: Service) => {
    setSelectedService(service);
    setSelectedDate(null);
    setSelectedTimeSlot(null);
    setStep('calendar');
  };

  const handleSelectDate = (date: Date) => {
    setSelectedDate(date);
    setSelectedTimeSlot(null);
    setStep('time');
  };

  const handleSelectTimeSlot = (slot: TimeSlot) => {
    setSelectedTimeSlot(slot);
    setStep('form');
  };

  const handleBackToService = () => {
    setStep('service');
    setSelectedService(null);
    setSelectedDate(null);
    setSelectedTimeSlot(null);
  };

  const handleBackToCalendar = () => {
    setStep('calendar');
    setSelectedTimeSlot(null);
  };

  const handleBackToTime = () => {
    setStep('time');
  };

  const handleSubmitBooking = (formData: CustomerFormData) => {
    // For now, just show success toast
    // This will be connected to Airtable later
    console.log('Booking submitted:', {
      service: selectedService,
      date: selectedDate,
      timeSlot: selectedTimeSlot,
      customer: formData,
    });
    
    toast.success('Rezervacija sėkmingai pateikta!', {
      description: 'Su jumis susisieksime patvirtinti laiką.',
    });
    
    // Reset state
    setStep('service');
    setSelectedService(null);
    setSelectedDate(null);
    setSelectedTimeSlot(null);
  };

  return (
    <div className="max-w-3xl mx-auto">
      <h2 className="text-3xl md:text-4xl font-light text-center mb-16 tracking-wide text-booking-foreground">
        Rezervacija
      </h2>

      <div className="relative">
        {/* Step 1: Service Selection */}
        <div
          className={cn(
            'transition-all duration-300',
            step === 'service'
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 absolute inset-0 pointer-events-none -translate-y-4'
          )}
        >
          <ServiceSelector
            services={services}
            selectedService={selectedService}
            onSelectService={handleSelectService}
          />
        </div>

        {/* Step 2: Calendar */}
        <div
          className={cn(
            'transition-all duration-300',
            step === 'calendar'
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 absolute inset-0 pointer-events-none -translate-y-4'
          )}
        >
          {selectedService && (
            <BookingCalendar
              availability={availability}
              selectedDate={selectedDate}
              onSelectDate={handleSelectDate}
              onBack={handleBackToService}
            />
          )}
        </div>

        {/* Step 3: Time Slots */}
        <div
          className={cn(
            'transition-all duration-300',
            step === 'time'
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 absolute inset-0 pointer-events-none -translate-y-4'
          )}
        >
          {selectedService && selectedDate && (
            <TimeSlotSelector
              date={selectedDate}
              slots={getAvailableSlotsForDate(selectedDate)}
              selectedSlot={selectedTimeSlot}
              onSelectSlot={handleSelectTimeSlot}
              onBack={handleBackToCalendar}
            />
          )}
        </div>

        {/* Step 4: Booking Form */}
        <div
          className={cn(
            'transition-all duration-300',
            step === 'form'
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 absolute inset-0 pointer-events-none -translate-y-4'
          )}
        >
          {selectedService && selectedDate && selectedTimeSlot && (
            <BookingForm
              service={selectedService}
              date={selectedDate}
              timeSlot={selectedTimeSlot}
              onBack={handleBackToTime}
              onSubmit={handleSubmitBooking}
            />
          )}
        </div>
      </div>
    </div>
  );
};
