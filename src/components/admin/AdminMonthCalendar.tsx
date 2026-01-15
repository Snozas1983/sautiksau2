import { useState, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';
import { lt } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Booking } from '@/hooks/useBookings';
import { cn } from '@/lib/utils';

interface AdminMonthCalendarProps {
  bookings: Booking[];
  onBookingClick: (booking: Booking) => void;
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-500/20 text-yellow-700 border-yellow-500/40',
  confirmed: 'bg-green-500/20 text-green-700 border-green-500/40',
  completed: 'bg-blue-500/20 text-blue-700 border-blue-500/40',
  cancelled: 'bg-red-500/20 text-red-700 border-red-500/40',
  no_show: 'bg-gray-500/20 text-gray-700 border-gray-500/40',
};

export function AdminMonthCalendar({ bookings, onBookingClick }: AdminMonthCalendarProps) {
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

  const weekDays = ['Pr', 'An', 'Tr', 'Kt', 'Pn', 'Št', 'Sk'];

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
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const isToday = isSameDay(day, new Date());
          const maxVisible = 3;
          const visibleBookings = dayBookings.slice(0, maxVisible);
          const hiddenCount = dayBookings.length - maxVisible;

          return (
            <div
              key={index}
              className={cn(
                'min-h-[100px] border-b border-r p-1 transition-colors',
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

              {/* Bookings */}
              <div className="space-y-1">
                {visibleBookings.map((booking) => (
                  <button
                    key={booking.id}
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
