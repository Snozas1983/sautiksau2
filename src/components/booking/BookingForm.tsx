import { useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { Service, TimeSlot, CustomerFormData } from './types';
import { BookingSummary } from './BookingSummary';
import { cn } from '@/lib/utils';

interface BookingFormProps {
  service: Service;
  date: Date;
  timeSlot: TimeSlot;
  onBack: () => void;
  onSubmit: (formData: CustomerFormData) => void;
}

export const BookingForm = ({
  service,
  date,
  timeSlot,
  onBack,
  onSubmit,
}: BookingFormProps) => {
  const [formData, setFormData] = useState<CustomerFormData>({
    fullName: '',
    phone: '',
    email: '',
    promoCode: '',
  });
  const [errors, setErrors] = useState<Partial<CustomerFormData>>({});

  const validateForm = (): boolean => {
    const newErrors: Partial<CustomerFormData> = {};
    
    if (!formData.fullName.trim()) {
      newErrors.fullName = 'Prašome įvesti vardą ir pavardę';
    }
    
    if (!formData.phone.trim()) {
      newErrors.phone = 'Prašome įvesti telefono numerį';
    } else if (!/^[\d\s+()-]{6,}$/.test(formData.phone)) {
      newErrors.phone = 'Neteisingas telefono formatas';
    }
    
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Neteisingas el. pašto formatas';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      onSubmit(formData);
    }
  };

  const handleChange = (field: keyof CustomerFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  return (
    <div className="space-y-6">
      <button
        onClick={onBack}
        className="text-sm text-booking-muted hover:text-booking-foreground transition-colors flex items-center gap-1"
      >
        <ChevronLeft size={16} />
        Grįžti atgal
      </button>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label
              htmlFor="fullName"
              className="block text-sm text-booking-muted"
            >
              Vardas ir pavardė *
            </label>
            <input
              type="text"
              id="fullName"
              value={formData.fullName}
              onChange={(e) => handleChange('fullName', e.target.value)}
              className={cn(
                'w-full px-4 py-3 rounded-sm bg-booking-surface border transition-colors',
                'text-booking-foreground placeholder:text-booking-muted/50',
                'focus:outline-none focus:ring-2 focus:ring-booking-available/30',
                errors.fullName
                  ? 'border-red-500/50'
                  : 'border-booking-border focus:border-booking-available/50'
              )}
              placeholder="Jonas Jonaitis"
            />
            {errors.fullName && (
              <p className="text-sm text-red-400">{errors.fullName}</p>
            )}
          </div>

          <div className="space-y-2">
            <label htmlFor="phone" className="block text-sm text-booking-muted">
              Telefonas *
            </label>
            <input
              type="tel"
              id="phone"
              value={formData.phone}
              onChange={(e) => handleChange('phone', e.target.value)}
              className={cn(
                'w-full px-4 py-3 rounded-sm bg-booking-surface border transition-colors',
                'text-booking-foreground placeholder:text-booking-muted/50',
                'focus:outline-none focus:ring-2 focus:ring-booking-available/30',
                errors.phone
                  ? 'border-red-500/50'
                  : 'border-booking-border focus:border-booking-available/50'
              )}
              placeholder="+370 600 00000"
            />
            {errors.phone && (
              <p className="text-sm text-red-400">{errors.phone}</p>
            )}
          </div>

          <div className="space-y-2">
            <label htmlFor="email" className="block text-sm text-booking-muted">
              El. paštas{' '}
              <span className="text-booking-muted/50">(neprivaloma)</span>
            </label>
            <input
              type="email"
              id="email"
              value={formData.email}
              onChange={(e) => handleChange('email', e.target.value)}
              className={cn(
                'w-full px-4 py-3 rounded-sm bg-booking-surface border transition-colors',
                'text-booking-foreground placeholder:text-booking-muted/50',
                'focus:outline-none focus:ring-2 focus:ring-booking-available/30',
                errors.email
                  ? 'border-red-500/50'
                  : 'border-booking-border focus:border-booking-available/50'
              )}
              placeholder="jonas@example.com"
            />
            {errors.email && (
              <p className="text-sm text-red-400">{errors.email}</p>
            )}
          </div>

          <div className="space-y-2">
            <label
              htmlFor="promoCode"
              className="block text-sm text-booking-muted"
            >
              Nuolaidos kodas{' '}
              <span className="text-booking-muted/50">(neprivaloma)</span>
            </label>
            <input
              type="text"
              id="promoCode"
              value={formData.promoCode}
              onChange={(e) => handleChange('promoCode', e.target.value)}
              className={cn(
                'w-full px-4 py-3 rounded-sm bg-booking-surface border transition-colors',
                'text-booking-foreground placeholder:text-booking-muted/50',
                'focus:outline-none focus:ring-2 focus:ring-booking-available/30',
                'border-booking-border focus:border-booking-available/50'
              )}
              placeholder="NUOLAIDA10"
            />
            <p className="text-xs text-booking-muted/60">
              Jei turite nuolaidos kodą, įveskite jį čia
            </p>
          </div>

          <button
            type="submit"
            className={cn(
              'w-full py-4 mt-6 rounded-sm transition-all duration-300',
              'bg-booking-available text-booking-bg font-light text-lg',
              'hover:bg-booking-available/90',
              'focus:outline-none focus:ring-2 focus:ring-booking-available/50 focus:ring-offset-2 focus:ring-offset-booking-bg',
              'min-h-[56px]'
            )}
          >
            Patvirtinti rezervaciją
          </button>
        </form>

        {/* Summary */}
        <div className="order-first md:order-last">
          <BookingSummary
            service={service}
            date={date}
            timeSlot={timeSlot}
            promoCode={formData.promoCode}
          />
        </div>
      </div>
    </div>
  );
};
