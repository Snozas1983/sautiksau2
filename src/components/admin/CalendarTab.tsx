import { useState } from 'react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { useAdminBookings, useUpdateBookingStatus, useAddToBlacklist, useRescheduleBooking, Booking } from '@/hooks/useBookings';
import { useScheduleExceptions, useDeleteException, ScheduleException } from '@/hooks/useScheduleExceptions';
import { AdminMonthCalendar } from './AdminMonthCalendar';
import { BookingDetailDialog } from './BookingDetailDialog';
import { RescheduleDialog } from './RescheduleDialog';
import { BlacklistConfirmDialog } from './BlacklistConfirmDialog';
import { CancelBookingDialog } from './CancelBookingDialog';
import { ExceptionDialog } from './ExceptionDialog';
import { BookingFilters } from './BookingFilters';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

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
  const [selectedExceptionData, setSelectedExceptionData] = useState<{
    exception: ScheduleException | null;
    date: Date | null;
  }>({ exception: null, date: null });
  
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
    setSelectedExceptionData({ exception: null, date });
  };
  
  const handleExceptionClick = (exception: ScheduleException, date: Date) => {
    setSelectedExceptionData({ exception, date });
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
      
      // If marked as no_show, automatically add to blacklist
      if (newStatus === 'no_show') {
        try {
          await addToBlacklist.mutateAsync({
            phone: booking.customerPhone,
            name: booking.customerName,
            reason: 'Neatvyko į vizitą',
            adminPassword,
          });
          toast.success('Klientas automatiškai įtrauktas į juodąjį sąrašą');
        } catch {
          toast.error('Klaida įtraukiant į juodąjį sąrašą');
        }
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
  
  const [isCancelling, setIsCancelling] = useState(false);
  
  const handleCancelConfirm = async (sendNotifications: { sms: boolean; email: boolean }) => {
    if (!cancelBooking) return;
    
    setIsCancelling(true);
    try {
      // 1. Update booking status to cancelled
      await updateStatus.mutateAsync({
        bookingId: cancelBooking.id,
        status: 'cancelled',
        adminPassword,
      });
      
      // 2. Send notifications if requested
      if (sendNotifications.sms || sendNotifications.email) {
        try {
          await supabase.functions.invoke('send-notifications', {
            body: {
              type: 'cancellation',
              bookingId: cancelBooking.id,
              serviceName: cancelBooking.serviceName || '',
              date: cancelBooking.date,
              startTime: cancelBooking.startTime,
              endTime: cancelBooking.endTime,
              customerName: cancelBooking.customerName,
              customerPhone: cancelBooking.customerPhone,
              customerEmail: cancelBooking.customerEmail,
              sendSms: sendNotifications.sms,
              sendEmail: sendNotifications.email,
            },
          });
          toast.success('Vizitas atšauktas, pranešimas išsiųstas');
        } catch (notifError) {
          console.error('Notification error:', notifError);
          toast.success('Vizitas atšauktas, bet pranešimo išsiųsti nepavyko');
        }
      } else {
        toast.success('Vizitas atšauktas');
      }
      
      setCancelBooking(null);
    } catch {
      toast.error('Klaida atšaukiant vizitą');
    } finally {
      setIsCancelling(false);
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
          onExceptionClick={handleExceptionClick}
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
      <CancelBookingDialog
        booking={cancelBooking}
        open={!!cancelBooking}
        onClose={() => setCancelBooking(null)}
        onConfirm={handleCancelConfirm}
        isLoading={isCancelling}
      />
      
      {/* Blacklist dialog */}
      <BlacklistConfirmDialog
        open={!!blacklistBooking}
        onClose={() => setBlacklistBooking(null)}
        onConfirm={handleBlacklistConfirm}
        customerName={blacklistBooking?.customerName}
      />
      
      {/* Exception dialog */}
      <ExceptionDialog
        open={!!selectedExceptionData.date}
        onClose={() => setSelectedExceptionData({ exception: null, date: null })}
        selectedDate={selectedExceptionData.date}
        adminPassword={adminPassword}
        onExceptionCreated={refetchExceptions}
        existingException={selectedExceptionData.exception}
      />
    </div>
  );
}
