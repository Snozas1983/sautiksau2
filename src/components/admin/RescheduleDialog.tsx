import { useState, useEffect, useMemo } from 'react';
import { format, parseISO, addDays } from 'date-fns';
import { lt } from 'date-fns/locale';
import { Calendar } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Booking } from '@/hooks/useBookings';
import { useCalendarAvailability } from '@/hooks/useCalendarAvailability';
import { cn } from '@/lib/utils';

interface RescheduleDialogProps {
  booking: Booking | null;
  open: boolean;
  onClose: () => void;
  onConfirm: (bookingId: string, date: string, startTime: string, endTime: string) => void;
  isLoading?: boolean;
}

export function RescheduleDialog({
  booking,
  open,
  onClose,
  onConfirm,
  isLoading,
}: RescheduleDialogProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [selectedTime, setSelectedTime] = useState<string>('');

  // Calculate duration from booking times
  const serviceDuration = useMemo(() => {
    if (!booking) return 60;
    const [startH, startM] = booking.startTime.split(':').map(Number);
    const [endH, endM] = booking.endTime.split(':').map(Number);
    return (endH * 60 + endM) - (startH * 60 + startM);
  }, [booking]);

  const { data: availabilityData } = useCalendarAvailability(serviceDuration);

  // Reset state when dialog opens
  useEffect(() => {
    if (open && booking) {
      setSelectedDate(parseISO(booking.date));
      setSelectedTime(booking.startTime);
    }
  }, [open, booking]);

  const availableSlots = useMemo(() => {
    if (!selectedDate || !availabilityData?.availability) return [];
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const dayAvailability = availabilityData.availability.find((d) => d.date === dateStr);
    return dayAvailability?.slots || [];
  }, [selectedDate, availabilityData]);

  const handleConfirm = () => {
    if (!booking || !selectedDate || !selectedTime) return;

    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    
    // Calculate end time
    const [h, m] = selectedTime.split(':').map(Number);
    const endMinutes = h * 60 + m + serviceDuration;
    const endTime = `${Math.floor(endMinutes / 60).toString().padStart(2, '0')}:${(endMinutes % 60).toString().padStart(2, '0')}`;

    onConfirm(booking.id, dateStr, selectedTime, endTime);
  };

  if (!booking) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Perkelti vizitą</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Current booking info */}
          <div className="p-3 bg-muted/50 rounded-lg text-sm">
            <div className="font-medium">{booking.customerName}</div>
            <div className="text-muted-foreground">
              Dabartinis laikas: {format(parseISO(booking.date), 'yyyy-MM-dd', { locale: lt })} {booking.startTime}
            </div>
          </div>

          {/* Date picker */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Nauja data</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !selectedDate && 'text-muted-foreground'
                  )}
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  {selectedDate ? (
                    format(selectedDate, 'PPP', { locale: lt })
                  ) : (
                    'Pasirinkite datą'
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => {
                    setSelectedDate(date);
                    setSelectedTime('');
                  }}
                  disabled={(date) => date < addDays(new Date(), 0)}
                  initialFocus
                  locale={lt}
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Time picker */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Naujas laikas</label>
            <Select value={selectedTime} onValueChange={setSelectedTime}>
              <SelectTrigger>
                <SelectValue placeholder="Pasirinkite laiką" />
              </SelectTrigger>
              <SelectContent>
                {availableSlots.length > 0 ? (
                  availableSlots.map((slot) => (
                    <SelectItem key={slot.id} value={slot.startTime}>
                      {slot.startTime} - {slot.endTime}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="none" disabled>
                    Nėra laisvų laikų
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Atšaukti
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedDate || !selectedTime || isLoading}
          >
            {isLoading ? 'Perkeliama...' : 'Perkelti'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
