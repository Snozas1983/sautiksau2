import { format, getDay } from 'date-fns';
import { lt } from 'date-fns/locale';
import { ArrowLeft, Plus, X, Phone, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Booking } from '@/hooks/useBookings';
import { ScheduleException } from '@/hooks/useScheduleExceptions';
import { cn } from '@/lib/utils';

interface AdminDayViewProps {
  date: Date;
  bookings: Booking[];
  exceptions: ScheduleException[];
  onBack: () => void;
  onBookingClick: (booking: Booking) => void;
  onAddException: () => void;
  onExceptionClick: (exception: ScheduleException) => void;
  onDeleteException: (exceptionId: string) => void;
}

const STATUS_COLORS: Record<string, string> = {
  confirmed: 'bg-green-500/20 text-green-700 border-green-500/40',
  completed: 'bg-blue-500/20 text-blue-700 border-blue-500/40',
  cancelled: 'bg-red-500/20 text-red-700 border-red-500/40',
  no_show: 'bg-gray-500/20 text-gray-700 border-gray-500/40',
  blacklisted: 'bg-black/80 text-white border-black',
};

const STATUS_LABELS: Record<string, string> = {
  confirmed: 'Patvirtintas',
  completed: 'Įvykęs',
  cancelled: 'Atšauktas',
  no_show: 'Neatvyko',
};

export function AdminDayView({
  date,
  bookings,
  exceptions,
  onBack,
  onBookingClick,
  onAddException,
  onExceptionClick,
  onDeleteException,
}: AdminDayViewProps) {
  const sortedBookings = [...bookings].sort((a, b) => a.startTime.localeCompare(b.startTime));
  const dayOfWeek = getDay(date);
  const dateStr = format(date, 'yyyy-MM-dd');
  
  // Filter exceptions relevant to this date
  const dayExceptions = exceptions.filter((ex) => {
    if (ex.is_recurring && ex.day_of_week === dayOfWeek) {
      return true;
    }
    if (!ex.is_recurring && ex.date === dateStr) {
      return true;
    }
    return false;
  });

  return (
    <div className="bg-card rounded-lg border">
      {/* Header */}
      <div className="flex items-center gap-4 p-4 border-b">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h2 className="text-lg font-semibold">
            {format(date, 'yyyy MMMM d', { locale: lt })} d.
          </h2>
          <p className="text-sm text-muted-foreground capitalize">
            {format(date, 'EEEE', { locale: lt })}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onAddException}>
          <Plus className="h-4 w-4 mr-1" />
          Išimtis
        </Button>
      </div>

      {/* Exceptions */}
      {dayExceptions.length > 0 && (
        <div className="p-4 border-b bg-muted/30">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Išimtys</h3>
          <div className="space-y-2">
            {dayExceptions.map((exception) => (
              <div
                key={exception.id}
                onClick={() => onExceptionClick(exception)}
                className={cn(
                  'flex items-center justify-between p-3 rounded-lg cursor-pointer hover:opacity-80',
                  exception.exception_type === 'block'
                    ? 'bg-red-500/20 text-red-700 border border-red-500/40'
                    : 'bg-green-500/20 text-green-700 border border-green-500/40'
                )}
              >
                <div>
                  <span className="font-medium">
                    {exception.exception_type === 'block' ? 'Nesiregistruoti' : 'Registruotis'}
                  </span>
                  <span className="ml-2 text-sm opacity-70">
                    {exception.start_time.substring(0, 5)} - {exception.end_time.substring(0, 5)}
                  </span>
                  {exception.description && (
                    <p className="text-sm opacity-70 mt-1">{exception.description}</p>
                  )}
                  {exception.is_recurring && (
                    <span className="text-xs opacity-60 ml-2">(pasikartojanti)</span>
                  )}
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteException(exception.id);
                  }}
                  className="p-1 hover:bg-white/20 rounded"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bookings list */}
      <div className="p-4">
        {sortedBookings.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Clock className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>Šią dieną vizitų nėra</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sortedBookings.map((booking) => (
              <button
                key={booking.id}
                onClick={() => onBookingClick(booking)}
                className={cn(
                  'w-full text-left p-4 rounded-lg border transition-all hover:shadow-md',
                  booking.isBlacklisted 
                    ? STATUS_COLORS.blacklisted 
                    : (STATUS_COLORS[booking.status] || STATUS_COLORS.confirmed)
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="text-lg font-bold">
                        {booking.startTime} - {booking.endTime}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-white/30">
                        {STATUS_LABELS[booking.status] || booking.status}
                      </span>
                    </div>
                    <p className="text-base font-medium">{booking.customerName}</p>
                    <p className="text-sm opacity-80">{booking.serviceName}</p>
                    <div className="flex items-center gap-1 mt-2 text-sm opacity-70">
                      <Phone className="h-3 w-3" />
                      <span>{booking.customerPhone}</span>
                    </div>
                  </div>
                </div>
                {booking.isBlacklisted && (
                  <div className="mt-2 text-xs font-semibold text-red-200">
                    ⚠️ Juodajame sąraše
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
