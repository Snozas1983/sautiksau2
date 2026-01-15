import { useState, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';
import { lt } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Booking } from '@/hooks/useBookings';
import { ScheduleException } from '@/hooks/useScheduleExceptions';
import { cn } from '@/lib/utils';

interface AdminMonthCalendarProps {
  bookings: Booking[];
  exceptions?: ScheduleException[];
  onBookingClick: (booking: Booking) => void;
  onDayClick?: (date: Date) => void;
  onDeleteException?: (exceptionId: string) => void;
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-500/20 text-yellow-700 border-yellow-500/40',
  confirmed: 'bg-green-500/20 text-green-700 border-green-500/40',
  completed: 'bg-blue-500/20 text-blue-700 border-blue-500/40',
  cancelled: 'bg-red-500/20 text-red-700 border-red-500/40',
  no_show: 'bg-gray-500/20 text-gray-700 border-gray-500/40',
};

export function AdminMonthCalendar({ 
  bookings, 
  exceptions = [],
  onBookingClick, 
  onDayClick,
  onDeleteException,
}: AdminMonthCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const startDate = startOfWeek(monthStart, { locale: lt });
    const endDate = endOfWeek(monthEnd, { locale: lt });

    const days: Date[] = [];
    let day = startDate;
    while (day <= endDate) {
      days.push(day);
      day = addDays(day, 1);
    }
    return days;
  }, [currentMonth]);

  const bookingsByDate = useMemo(() => {
    const map = new Map<string, Booking[]>();
    for (const booking of bookings) {
      const dateKey = booking.date;
      if (!map.has(dateKey)) {
        map.set(dateKey, []);
      }
      map.get(dateKey)!.push(booking);
    }
    // Sort bookings within each day by start time
    for (const [, dayBookings] of map) {
      dayBookings.sort((a, b) => a.startTime.localeCompare(b.startTime));
    }
    return map;
  }, [bookings]);

  // Group exceptions by date or day of week
  const getExceptionsForDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const dayOfWeek = date.getDay();
    
    return exceptions.filter((ex) => {
      if (ex.is_recurring && ex.day_of_week === dayOfWeek) {
        return true;
      }
      if (!ex.is_recurring && ex.date === dateStr) {
        return true;
      }
      return false;
    });
  };

  const weekDays = ['Pr', 'An', 'Tr', 'Kt', 'Pn', 'Št', 'Sk'];

  const handleDayClick = (e: React.MouseEvent, date: Date) => {
    // Only trigger if clicking on empty space, not on a booking
    if ((e.target as HTMLElement).closest('button[data-booking]')) {
      return;
    }
    onDayClick?.(date);
  };

  return (
    <div className="bg-card rounded-lg border">
      {/* Header with navigation */}
      <div className="flex items-center justify-between p-4 border-b">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h2 className="text-lg font-semibold capitalize">
          {format(currentMonth, 'LLLL yyyy', { locale: lt })}
        </h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7">
        {/* Week day headers */}
        {weekDays.map((day) => (
          <div
            key={day}
            className="p-2 text-center text-sm font-medium text-muted-foreground border-b"
          >
            {day}
          </div>
        ))}

        {/* Calendar days */}
        {calendarDays.map((day, index) => {
          const dateKey = format(day, 'yyyy-MM-dd');
          const dayBookings = bookingsByDate.get(dateKey) || [];
          const dayExceptions = getExceptionsForDate(day);
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const isToday = isSameDay(day, new Date());
          const maxVisible = 2;
          const visibleBookings = dayBookings.slice(0, maxVisible);
          const hiddenCount = dayBookings.length - maxVisible;

          return (
            <div
              key={index}
              onClick={(e) => handleDayClick(e, day)}
              className={cn(
                'min-h-[100px] border-b border-r p-1 transition-colors cursor-pointer hover:bg-muted/20',
                !isCurrentMonth && 'bg-muted/30',
                index % 7 === 0 && 'border-l'
              )}
            >
              {/* Day number */}
              <div
                className={cn(
                  'flex h-6 w-6 items-center justify-center rounded-full text-sm mb-1',
                  isToday && 'bg-primary text-primary-foreground font-bold',
                  !isCurrentMonth && 'text-muted-foreground'
                )}
              >
                {format(day, 'd')}
              </div>

              {/* Exceptions */}
              {dayExceptions.map((exception) => (
                <div
                  key={exception.id}
                  className={cn(
                    'w-full px-1 py-0.5 rounded text-[10px] mb-1 flex items-center justify-between group',
                    exception.exception_type === 'block'
                      ? 'bg-red-500/20 text-red-700 border border-red-500/40'
                      : 'bg-green-500/20 text-green-700 border border-green-500/40'
                  )}
                >
                  <span className="truncate">
                    {exception.exception_type === 'block' ? 'NESIREGISTRUOTI' : 'REGISTRUOTIS'}
                    {exception.start_time && (
                      <span className="ml-1 opacity-70">
                        {exception.start_time.substring(0, 5)}-{exception.end_time.substring(0, 5)}
                      </span>
                    )}
                  </span>
                  {onDeleteException && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteException(exception.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              ))}

              {/* Bookings */}
              <div className="space-y-1">
                {visibleBookings.map((booking) => (
                  <button
                    key={booking.id}
                    data-booking
                    onClick={() => onBookingClick(booking)}
                    className={cn(
                      'w-full text-left px-1.5 py-0.5 rounded text-xs border truncate transition-all hover:opacity-80',
                      STATUS_COLORS[booking.status] || STATUS_COLORS.pending
                    )}
                  >
                    <span className="font-medium">{booking.startTime}</span>
                    <span className="ml-1 opacity-80">{booking.customerName.split(' ')[0]}</span>
                  </button>
                ))}
                {hiddenCount > 0 && (
                  <div className="text-xs text-muted-foreground px-1.5">
                    +{hiddenCount} daugiau
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
