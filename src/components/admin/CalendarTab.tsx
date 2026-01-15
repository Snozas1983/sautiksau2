import { useState } from 'react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { useAdminBookings, useUpdateBookingStatus, useAddToBlacklist, useRescheduleBooking, Booking } from '@/hooks/useBookings';
import { useScheduleExceptions, useDeleteException } from '@/hooks/useScheduleExceptions';
import { AdminMonthCalendar } from './AdminMonthCalendar';
import { BookingDetailDialog } from './BookingDetailDialog';
import { RescheduleDialog } from './RescheduleDialog';
import { BlacklistConfirmDialog } from './BlacklistConfirmDialog';
import { ExceptionDialog } from './ExceptionDialog';
import { BookingFilters } from './BookingFilters';
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

interface CalendarTabProps {
  adminPassword: string;
}

export function CalendarTab({ adminPassword }: CalendarTabProps) {
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [rescheduleBooking, setRescheduleBooking] = useState<Booking | null>(null);
  const [cancelBooking, setCancelBooking] = useState<Booking | null>(null);
  const [blacklistBooking, setBlacklistBooking] = useState<Booking | null>(null);
  const [exceptionDate, setExceptionDate] = useState<Date | null>(null);
  
  // Get bookings for current month and adjacent months
  const now = new Date();
  const dateFrom = format(startOfMonth(now), 'yyyy-MM-dd');
  const dateTo = format(endOfMonth(now), 'yyyy-MM-dd');
  
  const { data: bookings, isLoading } = useAdminBookings(adminPassword, {
    status: statusFilter,
    dateFrom,
    dateTo,
  });
  
  const { data: exceptions, refetch: refetchExceptions } = useScheduleExceptions(adminPassword);
  const deleteException = useDeleteException();
  
  const updateStatus = useUpdateBookingStatus();
  const addToBlacklist = useAddToBlacklist();
  const reschedule = useRescheduleBooking();
  
  const handleBookingClick = (booking: Booking) => {
    setSelectedBooking(booking);
  };
  
  const handleDayClick = (date: Date) => {
    setExceptionDate(date);
  };
  
  const handleDeleteException = async (exceptionId: string) => {
    try {
      await deleteException.mutateAsync({ exceptionId, adminPassword });
      toast.success('Išimtis ištrinta');
    } catch {
      toast.error('Klaida trinant išimtį');
    }
  };
  
  const handleStatusChange = async (booking: Booking, newStatus: string) => {
    try {
      await updateStatus.mutateAsync({
        bookingId: booking.id,
        status: newStatus,
        adminPassword,
      });
      
      toast.success('Statusas atnaujintas');
      setSelectedBooking(null);
      
      // If marked as no_show, ask about blacklist
      if (newStatus === 'no_show') {
        setBlacklistBooking(booking);
      }
    } catch {
      toast.error('Klaida atnaujinant statusą');
    }
  };
  
  const handleRescheduleClick = (booking: Booking) => {
    setSelectedBooking(null);
    setRescheduleBooking(booking);
  };
  
  const handleRescheduleConfirm = async (bookingId: string, date: string, startTime: string, endTime: string) => {
    try {
      await reschedule.mutateAsync({
        bookingId,
        date,
        startTime,
        endTime,
        adminPassword,
      });
      
      toast.success('Vizitas perkeltas');
      setRescheduleBooking(null);
    } catch {
      toast.error('Klaida perkeliant vizitą');
    }
  };
  
  const handleCancelClick = (booking: Booking) => {
    setSelectedBooking(null);
    setCancelBooking(booking);
  };
  
  const handleCancelConfirm = async () => {
    if (!cancelBooking) return;
    
    try {
      await updateStatus.mutateAsync({
        bookingId: cancelBooking.id,
        status: 'cancelled',
        adminPassword,
      });
      
      toast.success('Vizitas atšauktas');
      setCancelBooking(null);
    } catch {
      toast.error('Klaida atšaukiant vizitą');
    }
  };
  
  const handleBlacklistConfirm = async (reason: string) => {
    if (!blacklistBooking) return;
    
    try {
      await addToBlacklist.mutateAsync({
        phone: blacklistBooking.customerPhone,
        name: blacklistBooking.customerName,
        reason,
        adminPassword,
      });
      
      toast.success('Klientas įtrauktas į juodą sąrašą');
      setBlacklistBooking(null);
    } catch {
      toast.error('Klaida įtraukiant į juodą sąrašą');
    }
  };
  
  return (
    <div className="p-4 space-y-4">
      <BookingFilters
        filter="month"
        statusFilter={statusFilter}
        onFilterChange={() => {}}
        onStatusFilterChange={setStatusFilter}
        hideTimeFilter
      />
      
      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">
          Kraunama...
        </div>
      ) : (
        <AdminMonthCalendar
          bookings={bookings || []}
          exceptions={exceptions || []}
          onBookingClick={handleBookingClick}
          onDayClick={handleDayClick}
          onDeleteException={handleDeleteException}
        />
      )}
      
      {/* Booking detail dialog */}
      <BookingDetailDialog
        booking={selectedBooking}
        open={!!selectedBooking}
        onClose={() => setSelectedBooking(null)}
        onStatusChange={handleStatusChange}
        onReschedule={handleRescheduleClick}
        onCancel={handleCancelClick}
      />
      
      {/* Reschedule dialog */}
      <RescheduleDialog
        booking={rescheduleBooking}
        open={!!rescheduleBooking}
        onClose={() => setRescheduleBooking(null)}
        onConfirm={handleRescheduleConfirm}
        isLoading={reschedule.isPending}
      />
      
      {/* Cancel confirmation dialog */}
      <AlertDialog open={!!cancelBooking} onOpenChange={() => setCancelBooking(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Atšaukti vizitą?</AlertDialogTitle>
            <AlertDialogDescription>
              Ar tikrai norite atšaukti {cancelBooking?.customerName} vizitą {cancelBooking?.date} {cancelBooking?.startTime}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Ne</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancelConfirm}>
              Taip, atšaukti
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Blacklist dialog */}
      <BlacklistConfirmDialog
        open={!!blacklistBooking}
        onClose={() => setBlacklistBooking(null)}
        onConfirm={handleBlacklistConfirm}
        customerName={blacklistBooking?.customerName}
      />
      
      {/* Exception dialog */}
      <ExceptionDialog
        open={!!exceptionDate}
        onClose={() => setExceptionDate(null)}
        selectedDate={exceptionDate}
        adminPassword={adminPassword}
        onExceptionCreated={refetchExceptions}
      />
    </div>
  );
}
