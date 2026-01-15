import { format, parseISO } from 'date-fns';
import { lt } from 'date-fns/locale';
import { Calendar, Clock, User, Phone, Mail, Scissors } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Booking } from '@/hooks/useBookings';

interface BookingDetailDialogProps {
  booking: Booking | null;
  open: boolean;
  onClose: () => void;
  onStatusChange: (booking: Booking, status: string) => void;
  onReschedule: (booking: Booking) => void;
  onCancel: (booking: Booking) => void;
}

const STATUS_OPTIONS = [
  { value: 'confirmed', label: 'Patvirtinta' },
  { value: 'completed', label: 'Įvykdyta' },
  { value: 'no_show', label: 'Neatvyko' },
  { value: 'cancelled', label: 'Atšaukta' },
];

const STATUS_COLORS: Record<string, string> = {
  confirmed: 'text-green-600',
  completed: 'text-blue-600',
  cancelled: 'text-red-600',
  no_show: 'text-gray-600',
};

export function BookingDetailDialog({
  booking,
  open,
  onClose,
  onStatusChange,
  onReschedule,
  onCancel,
}: BookingDetailDialogProps) {
  if (!booking) return null;

  const formattedDate = format(parseISO(booking.date), 'EEEE, MMMM d', { locale: lt });
  const isCancellable = booking.status !== 'cancelled' && booking.status !== 'completed';

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Vizito detalės</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Date and time */}
          <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
            <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div>
              <div className="font-medium capitalize">{formattedDate}</div>
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                {booking.startTime} - {booking.endTime}
              </div>
            </div>
          </div>

          {/* Customer info */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{booking.customerName}</span>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <a href={`tel:${booking.customerPhone}`} className="text-primary hover:underline">
                {booking.customerPhone}
              </a>
            </div>
            {booking.customerEmail && (
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <a href={`mailto:${booking.customerEmail}`} className="text-primary hover:underline">
                  {booking.customerEmail}
                </a>
              </div>
            )}
          </div>

          {/* Service */}
          <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
            <Scissors className="h-5 w-5 text-muted-foreground" />
            <span className="font-medium">{booking.serviceName}</span>
          </div>

          {/* Status */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Statusas</label>
            <Select
              value={booking.status}
              onValueChange={(value) => onStatusChange(booking, value)}
            >
              <SelectTrigger className={STATUS_COLORS[booking.status]}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => onReschedule(booking)}
              disabled={!isCancellable}
            >
              Perkelti
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={() => onCancel(booking)}
              disabled={!isCancellable}
            >
              Atšaukti
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
