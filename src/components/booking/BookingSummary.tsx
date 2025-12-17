import { format } from 'date-fns';
import { lt } from 'date-fns/locale';
import { Service, TimeSlot } from './types';

interface BookingSummaryProps {
  service: Service;
  date: Date;
  timeSlot: TimeSlot;
  promoCode?: string;
}

export const BookingSummary = ({
  service,
  date,
  timeSlot,
  promoCode,
}: BookingSummaryProps) => {
  const formattedDate = format(date, "yyyy MMMM d 'd.', EEEE", { locale: lt });
  
  // Placeholder for promo logic - will be calculated from Airtable later
  const discount = promoCode ? 0 : 0;
  const finalPrice = service.price - discount;
  const deposit = 0; // Placeholder

  return (
    <div className="bg-booking-surface rounded-sm p-6 space-y-4">
      <h4 className="text-sm font-light text-booking-muted uppercase tracking-wider">
        Rezervacijos informacija
      </h4>
      
      <div className="space-y-3">
        <div className="flex justify-between items-start">
          <span className="text-booking-muted text-sm">Paslauga</span>
          <span className="text-booking-foreground font-light text-right max-w-[60%]">
            {service.name}
          </span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-booking-muted text-sm">Data</span>
          <span className="text-booking-foreground font-light capitalize">
            {formattedDate}
          </span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-booking-muted text-sm">Laikas</span>
          <span className="text-booking-foreground font-light">
            {timeSlot.startTime} – {timeSlot.endTime}
          </span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-booking-muted text-sm">Trukmė</span>
          <span className="text-booking-foreground font-light">
            {service.duration} min
          </span>
        </div>
        
        <div className="h-px bg-booking-border my-2" />
        
        <div className="flex justify-between">
          <span className="text-booking-muted text-sm">Kaina</span>
          <span className="text-booking-foreground font-light">
            {service.price} €
          </span>
        </div>
        
        {discount > 0 && (
          <div className="flex justify-between">
            <span className="text-booking-muted text-sm">Nuolaida</span>
            <span className="text-booking-available font-light">
              -{discount} €
            </span>
          </div>
        )}
        
        <div className="flex justify-between text-lg">
          <span className="text-booking-foreground">Galutinė kaina</span>
          <span className="text-booking-foreground font-light">
            {finalPrice} €
          </span>
        </div>
        
        {deposit > 0 && (
          <div className="flex justify-between text-sm pt-2 border-t border-booking-border">
            <span className="text-booking-muted">Depozitas</span>
            <span className="text-booking-foreground font-light">
              {deposit} €
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
