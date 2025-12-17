import { ChevronLeft } from 'lucide-react';
import { format } from 'date-fns';
import { lt } from 'date-fns/locale';
import { TimeSlot } from './types';
import { cn } from '@/lib/utils';

interface TimeSlotSelectorProps {
  date: Date;
  slots: TimeSlot[];
  selectedSlot: TimeSlot | null;
  onSelectSlot: (slot: TimeSlot) => void;
  onBack: () => void;
}

export const TimeSlotSelector = ({
  date,
  slots,
  selectedSlot,
  onSelectSlot,
  onBack,
}: TimeSlotSelectorProps) => {
  const formattedDate = format(date, "EEEE, MMMM d 'd.'", { locale: lt });

  return (
    <div className="space-y-6">
      <button
        onClick={onBack}
        className="text-sm text-booking-muted hover:text-booking-foreground transition-colors flex items-center gap-1"
      >
        <ChevronLeft size={16} />
        Grįžti į kalendorių
      </button>

      <div className="bg-booking-surface rounded-sm p-6">
        <h4 className="text-lg font-light text-booking-foreground mb-2 capitalize">
          {formattedDate}
        </h4>

        {slots.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-booking-muted font-light">
              Ši diena neturi laisvų laikų
            </p>
          </div>
        ) : (
          <div className="space-y-3 mt-6">
            {slots.map((slot) => (
              <button
                key={slot.id}
                onClick={() => onSelectSlot(slot)}
                className={cn(
                  'w-full p-4 rounded-sm border transition-all duration-200',
                  'hover:border-booking-available hover:bg-booking-available/5',
                  'focus:outline-none focus:ring-2 focus:ring-booking-available/30',
                  'min-h-[52px]',
                  selectedSlot?.id === slot.id
                    ? 'border-booking-available bg-booking-available/10 text-booking-available'
                    : 'border-booking-border text-booking-foreground'
                )}
              >
                <span className="text-lg font-light">
                  {slot.startTime} – {slot.endTime}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
