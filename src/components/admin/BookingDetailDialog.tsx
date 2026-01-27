import { format, parseISO } from 'date-fns';
import { lt } from 'date-fns/locale';
import { Calendar, Clock, User, Phone, Mail, Scissors, AlertTriangle, Bot } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';
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
  { value: 'pending', label: 'Laukia patvirtinimo' },
  { value: 'confirmed', label: 'Patvirtinta' },
  { value: 'no_show', label: 'Neatvyko' },
  { value: 'cancelled', label: 'Atšaukta' },
];

const STATUS_COLORS: Record<string, string> = {
  pending: 'text-yellow-600',
  confirmed: 'text-green-600',
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
  const isCancellable = booking.status !== 'cancelled' && booking.status !== 'no_show';
  const isPending = booking.status === 'pending';
  const isSystem = booking.isSystemBooking;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Vizito detalės</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* System booking info */}
          {isSystem && (
            <div className="flex items-start gap-2 p-3 bg-slate-100 border border-slate-300 rounded-lg">
              <Bot className="h-5 w-5 text-slate-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-slate-800">Sisteminė rezervacija</p>
                <p className="text-slate-600">Ši rezervacija buvo sukurta automatiškai sistemos, kad kalendorius atrodytų užimtesnis.</p>
              </div>
            </div>
          )}

          {/* Pending approval warning */}
          {isPending && !isSystem && (
            <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-yellow-800">Reikalingas patvirtinimas</p>
                <p className="text-yellow-700">Šis klientas yra juodajame sąraše. Patvirtinkite arba atmeskite rezervaciją.</p>
              </div>
            </div>
          )}

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

          {/* Customer info - only show for non-system bookings */}
          {!isSystem && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{booking.customerName}</span>
                {booking.isBlacklisted && (
                  <Badge variant="destructive" className="text-xs">Juodas sąrašas</Badge>
                )}
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
          )}

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
            {isPending ? (
              <>
                <Button
                  variant="default"
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  onClick={() => onStatusChange(booking, 'confirmed')}
                >
                  Patvirtinti
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={() => onCancel(booking)}
                >
                  Atmesti
                </Button>
              </>
            ) : (
              <>
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
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}