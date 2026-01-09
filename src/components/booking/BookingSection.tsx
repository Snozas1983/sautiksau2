import { useState } from 'react';
import { format } from 'date-fns';
import { TimeSlot, BookingStep, CustomerFormData } from './types';
import { useServices, Service } from '@/hooks/useServices';
import { useCalendarAvailability } from '@/hooks/useCalendarAvailability';

import { BookingCalendar } from './BookingCalendar';
import { TreatwellButton } from './TreatwellButton';
import { TimeSlotSelector } from './TimeSlotSelector';
import { BookingForm } from './BookingForm';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export const BookingSection = () => {
  const { data: services = [], isLoading, error } = useServices();
  const [step, setStep] = useState<BookingStep>('service');
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<TimeSlot | null>(null);

  // Get real availability based on selected service
  const { data: availabilityData, isLoading: isLoadingAvailability } = useCalendarAvailability(
    selectedService?.duration || null
  );
  
  const availability = availabilityData?.availability || [];
  const maxDate = availabilityData?.maxDate ? new Date(availabilityData.maxDate) : undefined;

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

  if (isLoading) {
    return <div className="text-center py-12 text-booking-muted">Kraunama...</div>;
  }

  if (error) {
    return <div className="text-center py-12 text-destructive">Klaida kraunant paslaugas</div>;
  }

  const activeServices = services.filter(s => s.isActive);

  return (
    <div className="space-y-12">
      {/* Services List - Always visible */}
      {activeServices.map((service, index) => {
        const isSelected = selectedService?.id === service.id;
        const showCalendarHere = isSelected && step !== 'service';
        
        return (
          <div key={service.id} className={cn(
            index < activeServices.length - 1 && 'border-b border-booking-border pb-12'
          )}>
            {/* Service Row */}
            <button
              onClick={() => {
                if (step === 'service') {
                  handleSelectService(service);
                } else if (isSelected) {
                  // Already selected, clicking again goes back to service selection
                  handleBackToService();
                } else {
                  // Switch to different service
                  handleSelectService(service);
                }
              }}
              className={cn(
                'w-full text-left transition-all duration-200',
                'hover:opacity-70 focus:outline-none',
                isSelected && step !== 'service' && 'mb-6'
              )}
            >
              <div className="flex flex-col md:flex-row md:justify-between md:items-baseline gap-3">
                <h3 className="text-2xl font-light text-booking-foreground flex-1 md:max-w-[50%]">
                  {service.name}
                </h3>
                <div className="flex items-baseline gap-6 shrink-0">
                  <span className="text-booking-muted font-light w-[80px] text-right whitespace-nowrap">
                    {service.duration} min
                  </span>
                  <span className="text-2xl font-light text-booking-foreground w-[80px] text-right whitespace-nowrap">
                    {service.price} €
                  </span>
                </div>
              </div>
            </button>

            {/* Calendar, Time, Form - Expands below selected service */}
            {showCalendarHere && (
              <div className="mt-6 animate-fade-in">
                {/* Calendar */}
                {step === 'calendar' && (
                  isLoadingAvailability ? (
                    <div className="text-center py-8 text-booking-muted">Kraunama prieinamumas...</div>
                  ) : (
                    <div className="space-y-6">
                      <BookingCalendar
                        availability={availability}
                        selectedDate={selectedDate}
                        onSelectDate={handleSelectDate}
                        onBack={handleBackToService}
                        maxDate={maxDate}
                      />
                      
                      {/* Treatwell mygtukas */}
                      <div className="pt-4 border-t border-booking-border">
                        <p className="text-sm text-booking-muted mb-3">Arba registruokitės per:</p>
                        <TreatwellButton />
                      </div>
                    </div>
                  )
                )}

                {/* Time Slots */}
                {step === 'time' && selectedDate && (
                  <TimeSlotSelector
                    date={selectedDate}
                    slots={getAvailableSlotsForDate(selectedDate)}
                    selectedSlot={selectedTimeSlot}
                    onSelectSlot={handleSelectTimeSlot}
                    onBack={handleBackToCalendar}
                  />
                )}

                {/* Booking Form */}
                {step === 'form' && selectedDate && selectedTimeSlot && (
                  <BookingForm
                    service={selectedService}
                    date={selectedDate}
                    timeSlot={selectedTimeSlot}
                    onBack={handleBackToTime}
                    onSubmit={handleSubmitBooking}
                  />
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
