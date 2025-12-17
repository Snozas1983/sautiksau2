import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  isBefore,
  startOfDay,
  isSunday,
} from 'date-fns';
import { lt } from 'date-fns/locale';
import { DayAvailability } from './types';
import { cn } from '@/lib/utils';

interface BookingCalendarProps {
  availability: DayAvailability[];
  selectedDate: Date | null;
  onSelectDate: (date: Date) => void;
  onBack: () => void;
}

const WEEKDAYS = ['Pr', 'An', 'Tr', 'Kt', 'Pn', 'Št', 'Sk'];

export const BookingCalendar = ({
  availability,
  selectedDate,
  onSelectDate,
  onBack,
}: BookingCalendarProps) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const today = startOfDay(new Date());

  const availabilityMap = useMemo(() => {
    const map = new Map<string, number>();
    availability.forEach((day) => {
      map.set(day.date, day.slots.length);
    });
    return map;
  }, [availability]);

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

    const days: Date[] = [];
    let day = startDate;
    while (day <= endDate) {
      days.push(day);
      day = addDays(day, 1);
    }
    return days;
  }, [currentMonth]);

  const canGoPrev = !isBefore(startOfMonth(currentMonth), startOfMonth(today));

  const getSlotCount = (date: Date): number => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return availabilityMap.get(dateStr) || 0;
  };

  const isDateClickable = (date: Date): boolean => {
    if (isBefore(date, today)) return false;
    if (isSunday(date)) return false;
    return getSlotCount(date) > 0;
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

      <div className="bg-booking-surface rounded-sm p-6">
        {/* Month Navigation */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => canGoPrev && setCurrentMonth(subMonths(currentMonth, 1))}
            disabled={!canGoPrev}
            className={cn(
              'p-2 rounded-sm transition-colors',
              canGoPrev
                ? 'hover:bg-booking-border text-booking-foreground'
                : 'text-booking-muted/30 cursor-not-allowed'
            )}
            aria-label="Ankstesnis mėnuo"
          >
            <ChevronLeft size={20} />
          </button>
          <h4 className="text-lg font-light text-booking-foreground capitalize">
            {format(currentMonth, 'LLLL yyyy', { locale: lt })}
          </h4>
          <button
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            className="p-2 rounded-sm hover:bg-booking-border text-booking-foreground transition-colors"
            aria-label="Kitas mėnuo"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        {/* Weekday Headers */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {WEEKDAYS.map((day, index) => (
            <div
              key={day}
              className={cn(
                'text-center text-sm py-2 font-light',
                index === 6 ? 'text-booking-muted/50' : 'text-booking-muted'
              )}
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map((date, index) => {
            const isCurrentMonth = isSameMonth(date, currentMonth);
            const isToday = isSameDay(date, today);
            const isSelected = selectedDate && isSameDay(date, selectedDate);
            const isPast = isBefore(date, today);
            const isSundayDay = isSunday(date);
            const slotCount = getSlotCount(date);
            const isClickable = isDateClickable(date);

            return (
              <button
                key={index}
                onClick={() => isClickable && onSelectDate(date)}
                disabled={!isClickable}
                className={cn(
                  'aspect-square flex flex-col items-center justify-center rounded-sm transition-all duration-200 relative',
                  'min-h-[44px]',
                  !isCurrentMonth && 'opacity-30',
                  isPast && 'opacity-30 cursor-not-allowed',
                  isSundayDay && !isPast && 'opacity-40 cursor-not-allowed',
                  isClickable && 'hover:bg-booking-available/10 cursor-pointer',
                  isSelected && 'bg-booking-available/20',
                  isToday && 'ring-1 ring-booking-available/50',
                  !isClickable && !isPast && !isSundayDay && isCurrentMonth && 'text-booking-muted/60'
                )}
              >
                <span
                  className={cn(
                    'text-sm font-light',
                    isSelected ? 'text-booking-available' : 'text-booking-foreground'
                  )}
                >
                  {format(date, 'd')}
                </span>
                {slotCount > 0 && isCurrentMonth && !isPast && !isSundayDay && (
                  <span className="absolute bottom-1 w-1.5 h-1.5 rounded-full bg-booking-available" />
                )}
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="mt-6 pt-4 border-t border-booking-border flex items-center justify-center gap-6 text-xs text-booking-muted">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-booking-available" />
            <span>Yra laisvų laikų</span>
          </div>
        </div>
      </div>
    </div>
  );
};
