import { useState } from 'react';
import { Booking } from '@/hooks/useBookings';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, Mail, MessageSquare } from 'lucide-react';

interface CancelBookingDialogProps {
  booking: Booking | null;
  open: boolean;
  onClose: () => void;
  onConfirm: (sendNotifications: { sms: boolean; email: boolean }) => Promise<void>;
  isLoading?: boolean;
}

export function CancelBookingDialog({
  booking,
  open,
  onClose,
  onConfirm,
  isLoading,
}: CancelBookingDialogProps) {
  const [sendNotification, setSendNotification] = useState(true);
  const [sendSms, setSendSms] = useState(true);
  const [sendEmail, setSendEmail] = useState(true);

  const hasEmail = !!booking?.customerEmail;

  const handleConfirm = async () => {
    await onConfirm({
      sms: sendNotification && sendSms,
      email: sendNotification && sendEmail && hasEmail,
    });
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen && !isLoading) {
      onClose();
      // Reset state when closing
      setSendNotification(true);
      setSendSms(true);
      setSendEmail(true);
    }
  };

  if (!booking) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Atšaukti vizitą?</DialogTitle>
          <DialogDescription>
            Ar tikrai norite atšaukti <strong>{booking.customerName}</strong> vizitą{' '}
            <strong>{booking.date}</strong> <strong>{booking.startTime}</strong>?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="send-notification"
              checked={sendNotification}
              onCheckedChange={(checked) => setSendNotification(checked === true)}
            />
            <Label htmlFor="send-notification" className="font-medium">
              Siųsti pranešimą klientui
            </Label>
          </div>

          {sendNotification && (
            <div className="ml-6 space-y-3 border-l-2 border-muted pl-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="send-sms"
                  checked={sendSms}
                  onCheckedChange={(checked) => setSendSms(checked === true)}
                />
                <Label htmlFor="send-sms" className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  SMS ({booking.customerPhone})
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="send-email"
                  checked={sendEmail && hasEmail}
                  onCheckedChange={(checked) => setSendEmail(checked === true)}
                  disabled={!hasEmail}
                />
                <Label 
                  htmlFor="send-email" 
                  className={`flex items-center gap-2 ${!hasEmail ? 'text-muted-foreground' : ''}`}
                >
                  <Mail className="h-4 w-4" />
                  {hasEmail ? `El. paštas (${booking.customerEmail})` : 'El. paštas (nenurodytas)'}
                </Label>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Atšaukti
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Atšaukiama...
              </>
            ) : (
              'Taip, atšaukti vizitą'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
