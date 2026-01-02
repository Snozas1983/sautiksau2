import { useState } from 'react';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { lt } from 'date-fns/locale';
import { useAdminBookings, useUpdateBookingStatus, useAddToBlacklist, Booking } from '@/hooks/useBookings';
import { BookingCard } from './BookingCard';
import { BookingFilters, FilterType } from './BookingFilters';
import { BlacklistConfirmDialog } from './BlacklistConfirmDialog';
import { toast } from 'sonner';

interface CalendarTabProps {
  adminPassword: string;
}

export function CalendarTab({ adminPassword }: CalendarTabProps) {
  const [filter, setFilter] = useState<FilterType>('today');
  const [statusFilter, setStatusFilter] = useState('all');
  const [blacklistBooking, setBlacklistBooking] = useState<Booking | null>(null);
  
  // Calculate date range based on filter
  const getDateRange = () => {
    const now = new Date();
    
    switch (filter) {
      case 'today':
        return {
          dateFrom: format(startOfDay(now), 'yyyy-MM-dd'),
          dateTo: format(endOfDay(now), 'yyyy-MM-dd'),
        };
      case 'week':
        return {
          dateFrom: format(startOfWeek(now, { locale: lt }), 'yyyy-MM-dd'),
          dateTo: format(endOfWeek(now, { locale: lt }), 'yyyy-MM-dd'),
        };
      case 'month':
        return {
          dateFrom: format(startOfMonth(now), 'yyyy-MM-dd'),
          dateTo: format(endOfMonth(now), 'yyyy-MM-dd'),
        };
      default:
        return {};
    }
  };
  
  const dateRange = getDateRange();
  
  const { data: bookings, isLoading, refetch } = useAdminBookings(adminPassword, {
    status: statusFilter,
    ...dateRange,
  });
  
  const updateStatus = useUpdateBookingStatus();
  const addToBlacklist = useAddToBlacklist();
  
  const handleStatusChange = async (booking: Booking, newStatus: string) => {
    try {
      await updateStatus.mutateAsync({
        bookingId: booking.id,
        status: newStatus,
        adminPassword,
      });
      
      toast.success('Statusas atnaujintas');
      
      // If marked as no_show, ask about blacklist
      if (newStatus === 'no_show') {
        setBlacklistBooking(booking);
      }
    } catch {
      toast.error('Klaida atnaujinant statusą');
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
        filter={filter}
        statusFilter={statusFilter}
        onFilterChange={setFilter}
        onStatusFilterChange={setStatusFilter}
      />
      
      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">
          Kraunama...
        </div>
      ) : bookings && bookings.length > 0 ? (
        <div className="space-y-3">
          {bookings.map((booking) => (
            <BookingCard
              key={booking.id}
              booking={booking}
              onStatusChange={handleStatusChange}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          Nėra rezervacijų
        </div>
      )}
      
      <BlacklistConfirmDialog
        open={!!blacklistBooking}
        onClose={() => setBlacklistBooking(null)}
        onConfirm={handleBlacklistConfirm}
        customerName={blacklistBooking?.customerName}
      />
    </div>
  );
}
