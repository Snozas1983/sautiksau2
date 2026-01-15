import { format, parseISO } from 'date-fns';
import { lt } from 'date-fns/locale';
import { Phone, Clock, User } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Booking } from '@/hooks/useBookings';

interface BookingCardProps {
  booking: Booking;
  onStatusChange: (booking: Booking, status: string) => void;
}

const statusLabels: Record<string, string> = {
  confirmed: 'Patvirtinta',
  completed: 'Atlikta',
  no_show: 'Neatvyko',
  cancelled: 'Atšaukta',
};

const statusColors: Record<string, string> = {
  confirmed: 'bg-blue-500/20 text-blue-700',
  completed: 'bg-green-500/20 text-green-700',
  no_show: 'bg-red-500/20 text-red-700',
  cancelled: 'bg-muted text-muted-foreground',
};

export function BookingCard({ booking, onStatusChange }: BookingCardProps) {
  const formattedDate = format(parseISO(booking.date), 'MMMM d, EEEE', { locale: lt });
  
  return (
    <Card className="border-border">
      <CardContent className="p-4 space-y-3">
        {/* Date and time */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground capitalize">
              {formattedDate}
            </p>
            <div className="flex items-center gap-1 text-muted-foreground">
              <Clock className="w-3 h-3" />
              <span className="text-sm">{booking.startTime} - {booking.endTime}</span>
            </div>
          </div>
          <Badge className={statusColors[booking.status]}>
            {statusLabels[booking.status]}
          </Badge>
        </div>
        
        {/* Customer info */}
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-foreground">
            <User className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">{booking.customerName}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Phone className="w-4 h-4" />
            <a href={`tel:${booking.customerPhone}`} className="text-sm underline">
              {booking.customerPhone}
            </a>
          </div>
        </div>
        
        {/* Service name if available */}
        {booking.serviceName && (
          <p className="text-sm text-muted-foreground">
            {booking.serviceName}
          </p>
        )}
        
        {/* Status changer */}
        <Select 
          value={booking.status} 
          onValueChange={(status) => onStatusChange(booking, status)}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="confirmed">Patvirtinta</SelectItem>
            <SelectItem value="completed">Atlikta</SelectItem>
            <SelectItem value="no_show">Neatvyko</SelectItem>
            <SelectItem value="cancelled">Atšaukta</SelectItem>
          </SelectContent>
        </Select>
      </CardContent>
    </Card>
  );
}
