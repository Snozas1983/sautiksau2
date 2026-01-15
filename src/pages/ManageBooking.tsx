import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format, parseISO, addHours, isBefore } from 'date-fns';
import { lt } from 'date-fns/locale';
import { Calendar, Clock, ArrowLeft, CalendarX, CalendarClock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface BookingDetails {
  id: string;
  serviceName: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  customerName: string;
  cancelHoursBefore: number;
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Laukiama patvirtinimo',
  confirmed: 'Patvirtinta',
  completed: 'Įvykdyta',
  cancelled: 'Atšaukta',
  no_show: 'Neatvyko',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-500/20 text-yellow-700',
  confirmed: 'bg-green-500/20 text-green-700',
  completed: 'bg-blue-500/20 text-blue-700',
  cancelled: 'bg-red-500/20 text-red-700',
  no_show: 'bg-gray-500/20 text-gray-700',
};

const ManageBooking = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [booking, setBooking] = useState<BookingDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

  useEffect(() => {
    const fetchBooking = async () => {
      if (!token) {
        setError('Netinkama nuoroda');
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch(
          `${supabaseUrl}/functions/v1/airtable-proxy/booking/${token}`
        );
        
        if (!response.ok) {
          if (response.status === 404) {
            setError('Rezervacija nerasta');
          } else {
            setError('Klaida gaunant rezervaciją');
          }
          setIsLoading(false);
          return;
        }

        const data = await response.json();
        setBooking(data.booking);
      } catch (err) {
        console.error('Error fetching booking:', err);
        setError('Klaida gaunant rezervaciją');
      } finally {
        setIsLoading(false);
      }
    };

    fetchBooking();
  }, [token, supabaseUrl]);

  const canModify = () => {
    if (!booking) return false;
    if (booking.status === 'cancelled' || booking.status === 'completed' || booking.status === 'no_show') {
      return false;
    }
    
    // Check if within cancellation window
    const bookingDateTime = parseISO(`${booking.date}T${booking.startTime}`);
    const deadline = addHours(new Date(), booking.cancelHoursBefore);
    
    return isBefore(deadline, bookingDateTime);
  };

  const handleCancel = async () => {
    if (!token) return;
    
    setIsCancelling(true);
    try {
      const response = await fetch(
        `${supabaseUrl}/functions/v1/airtable-proxy/booking/${token}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'cancel' }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to cancel');
      }

      toast.success('Vizitas atšauktas');
      setBooking(prev => prev ? { ...prev, status: 'cancelled' } : null);
      setShowCancelDialog(false);
    } catch (err) {
      console.error('Error cancelling:', err);
      toast.error('Klaida atšaukiant vizitą');
    } finally {
      setIsCancelling(false);
    }
  };

  const formatDateLt = (dateStr: string) => {
    const date = parseISO(dateStr);
    return format(date, "EEEE, MMMM d 'd.'", { locale: lt });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Kraunama...</p>
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-destructive">
              {error || 'Rezervacija nerasta'}
            </CardTitle>
            <CardDescription>
              Ši nuoroda nebegalioja arba rezervacija buvo pašalinta.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button onClick={() => navigate('/')} variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Grįžti į pradžią
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const modifiable = canModify();
  const hoursRemaining = booking.cancelHoursBefore;

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-md mx-auto">
        <Button
          variant="ghost"
          onClick={() => navigate('/')}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Grįžti
        </Button>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle>Jūsų rezervacija</CardTitle>
                <CardDescription className="mt-1">
                  {booking.customerName}
                </CardDescription>
              </div>
              <Badge className={STATUS_COLORS[booking.status]}>
                {STATUS_LABELS[booking.status]}
              </Badge>
            </div>
          </CardHeader>
          
          <CardContent className="space-y-6">
            {/* Service info */}
            <div>
              <h3 className="font-semibold text-lg">{booking.serviceName}</h3>
            </div>
            
            {/* Date and time */}
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-muted-foreground">
                <Calendar className="h-5 w-5" />
                <span className="capitalize">{formatDateLt(booking.date)}</span>
              </div>
              <div className="flex items-center gap-3 text-muted-foreground">
                <Clock className="h-5 w-5" />
                <span>{booking.startTime} - {booking.endTime}</span>
              </div>
            </div>

            {/* Actions */}
            {modifiable ? (
              <div className="pt-4 space-y-3">
                <p className="text-sm text-muted-foreground">
                  Galite atšaukti vizitą likus ne mažiau kaip {hoursRemaining} val.
                </p>
                <div className="flex flex-col gap-2">
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => toast.info('Perkėlimo funkcija bus pridėta netrukus')}
                  >
                    <CalendarClock className="mr-2 h-4 w-4" />
                    Perkelti vizitą
                  </Button>
                  <Button
                    variant="destructive"
                    className="w-full"
                    onClick={() => setShowCancelDialog(true)}
                  >
                    <CalendarX className="mr-2 h-4 w-4" />
                    Atšaukti vizitą
                  </Button>
                </div>
              </div>
            ) : (
              <div className="pt-4">
                {booking.status === 'cancelled' ? (
                  <p className="text-sm text-muted-foreground text-center">
                    Šis vizitas jau atšauktas.
                  </p>
                ) : booking.status === 'completed' || booking.status === 'no_show' ? (
                  <p className="text-sm text-muted-foreground text-center">
                    Šis vizitas jau įvyko.
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground text-center">
                    Vizito atšaukti nebegalima - per mažai laiko iki vizito.
                    Susisiekite tiesiogiai: info@sautiksau.lt
                  </p>
                )}
              </div>
            )}

            {/* Contact info */}
            <div className="pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                Klausimai? Susisiekite:{' '}
                <a href="mailto:info@sautiksau.lt" className="text-primary hover:underline">
                  info@sautiksau.lt
                </a>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cancel confirmation dialog */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Atšaukti vizitą?</AlertDialogTitle>
            <AlertDialogDescription>
              Ar tikrai norite atšaukti vizitą {formatDateLt(booking.date)} {booking.startTime}?
              Šis veiksmas negrįžtamas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCancelling}>Ne, palikti</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleCancel}
              disabled={isCancelling}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isCancelling ? 'Atšaukiama...' : 'Taip, atšaukti'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ManageBooking;
