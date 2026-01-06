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
  isAfter,
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
  maxDate?: Date;
}

const WEEKDAYS = ['Pr', 'An', 'Tr', 'Kt', 'Pn', 'Št', 'Sk'];

export const BookingCalendar = ({
  availability,
  selectedDate,
  onSelectDate,
  onBack,
  maxDate,
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
  const canGoNext = !maxDate || !isAfter(startOfMonth(addMonths(currentMonth, 1)), startOfMonth(maxDate));

  const getSlotCount = (date: Date): number => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return availabilityMap.get(dateStr) || 0;
  };

  const isDateClickable = (date: Date): boolean => {
    if (isBefore(date, today)) return false;
    if (isSunday(date)) return false;
    if (maxDate && isAfter(date, maxDate)) return false;
    return getSlotCount(date) > 0;
  };
  
  const isDateBeyondMax = (date: Date): boolean => {
    return maxDate ? isAfter(date, maxDate) : false;
  };

  const todayHasSlots = getSlotCount(today) > 0;

  return (
    <div className="space-y-4">
      <button
        onClick={onBack}
        className="text-sm text-booking-muted hover:text-booking-foreground transition-colors flex items-center gap-1"
      >
        <ChevronLeft size={16} />
        Grįžti atgal
      </button>

      <div className="bg-booking-surface rounded-sm p-3">
        {/* Month Navigation */}
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => canGoPrev && setCurrentMonth(subMonths(currentMonth, 1))}
            disabled={!canGoPrev}
            className={cn(
              'p-1 rounded-sm transition-colors',
              canGoPrev
                ? 'hover:bg-booking-border text-booking-foreground'
                : 'text-booking-muted/30 cursor-not-allowed'
            )}
            aria-label="Ankstesnis mėnuo"
          >
            <ChevronLeft size={16} />
          </button>
          <h4 className="text-sm font-light text-booking-foreground capitalize">
            {format(currentMonth, 'LLLL yyyy', { locale: lt })}
          </h4>
          <button
            onClick={() => canGoNext && setCurrentMonth(addMonths(currentMonth, 1))}
            disabled={!canGoNext}
            className={cn(
              'p-1 rounded-sm transition-colors',
              canGoNext
                ? 'hover:bg-booking-border text-booking-foreground'
                : 'text-booking-muted/30 cursor-not-allowed'
            )}
            aria-label="Kitas mėnuo"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Weekday Headers */}
        <div className="grid grid-cols-7 gap-0.5 mb-1">
          {WEEKDAYS.map((day, index) => (
            <div
              key={day}
              className={cn(
                'text-center text-xs py-1 font-light',
                index === 6 ? 'text-booking-muted/50' : 'text-booking-muted'
              )}
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-0.5">
          {calendarDays.map((date, index) => {
            const isCurrentMonth = isSameMonth(date, currentMonth);
            const isToday = isSameDay(date, today);
            const isSelected = selectedDate && isSameDay(date, selectedDate);
            const isPast = isBefore(date, today);
            const isSundayDay = isSunday(date);
            const isBeyondMax = isDateBeyondMax(date);
            const slotCount = getSlotCount(date);
            const isClickable = isDateClickable(date);
            const hasAvailableSlots = slotCount > 0;

            // Today should be greyed out if no slots available
            const isTodayNoSlots = isToday && !todayHasSlots;

            return (
              <button
                key={index}
                onClick={() => isClickable && onSelectDate(date)}
                disabled={!isClickable}
                className={cn(
                  'aspect-square flex items-center justify-center rounded-sm transition-all duration-200',
                  'min-h-[28px] text-xs',
                  !isCurrentMonth && 'opacity-30',
                  (isPast || isTodayNoSlots || isBeyondMax) && 'opacity-30 cursor-not-allowed',
                  isSundayDay && !isPast && !isBeyondMax && 'opacity-40 cursor-not-allowed',
                  isClickable && 'hover:bg-booking-available/10 cursor-pointer',
                  isSelected && 'bg-booking-available/20 ring-1 ring-booking-available',
                  !isClickable && !isPast && !isSundayDay && !isBeyondMax && isCurrentMonth && !isTodayNoSlots && 'text-booking-muted/60'
                )}
              >
                <span
                  className={cn(
                    hasAvailableSlots && isCurrentMonth && !isPast && !isSundayDay && !isBeyondMax
                      ? 'font-bold text-booking-foreground'
                      : 'font-light text-booking-muted'
                  )}
                >
                  {format(date, 'd')}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
