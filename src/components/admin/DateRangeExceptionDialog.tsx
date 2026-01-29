import { useState } from 'react';
import { format } from 'date-fns';
import { lt } from 'date-fns/locale';
import { CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { TimeInput } from '@/components/ui/time-input';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { ScheduleException } from '@/hooks/useScheduleExceptions';

interface DateRangeExceptionDialogProps {
  open: boolean;
  onClose: () => void;
  adminPassword: string;
  onExceptionCreated: () => void;
  existingException?: ScheduleException | null;
}

export function DateRangeExceptionDialog({
  open,
  onClose,
  adminPassword,
  onExceptionCreated,
  existingException,
}: DateRangeExceptionDialogProps) {
  const [startDate, setStartDate] = useState<Date | undefined>(
    existingException?.date ? new Date(existingException.date) : new Date()
  );
  const [endDate, setEndDate] = useState<Date | undefined>(
    existingException?.end_date ? new Date(existingException.end_date) : new Date()
  );
  const [isFullDay, setIsFullDay] = useState(true);
  const [startTime, setStartTime] = useState(
    existingException?.start_time?.substring(0, 5) || '09:00'
  );
  const [endTime, setEndTime] = useState(
    existingException?.end_time?.substring(0, 5) || '18:00'
  );
  const [description, setDescription] = useState(existingException?.description || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

  const handleSubmit = async () => {
    if (!startDate || !endDate) {
      toast.error('Pasirinkite pradžios ir pabaigos datas');
      return;
    }

    if (endDate < startDate) {
      toast.error('Pabaigos data negali būti ankstesnė už pradžios datą');
      return;
    }

    setIsSubmitting(true);
    try {
      const isEditing = !!existingException;

      const payload = {
        date: format(startDate, 'yyyy-MM-dd'),
        end_date: format(endDate, 'yyyy-MM-dd'),
        start_time: isFullDay ? '00:00' : startTime,
        end_time: isFullDay ? '23:59' : endTime,
        exception_type: 'block',
        is_recurring: false,
        description: description || null,
        day_of_week: null,
      };

      const url = isEditing
        ? `${supabaseUrl}/functions/v1/airtable-proxy/admin/exceptions/${existingException.id}`
        : `${supabaseUrl}/functions/v1/airtable-proxy/admin/exceptions`;

      const response = await fetch(url, {
        method: isEditing ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-password': adminPassword,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error('Failed to save exception');
      }

      toast.success(isEditing ? 'Išimtis atnaujinta' : 'Išimtis sukurta');
      onExceptionCreated();
      handleClose();
    } catch (err) {
      console.error('Error saving exception:', err);
      toast.error('Klaida saugant išimtį');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setStartDate(new Date());
    setEndDate(new Date());
    setIsFullDay(true);
    setStartTime('09:00');
    setEndTime('18:00');
    setDescription('');
    onClose();
  };

  const isEditing = !!existingException;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Redaguoti kalendoriaus išjungimą' : 'Kalendoriaus išjungimas'}
          </DialogTitle>
          <DialogDescription>
            Blokuoti registraciją tam tikram laikotarpiui (pvz., atostogos, remontas)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Start Date */}
          <div className="space-y-2">
            <Label>Pradžios data</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !startDate && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {startDate ? format(startDate, 'yyyy-MM-dd', { locale: lt }) : 'Pasirinkite datą'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={setStartDate}
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* End Date */}
          <div className="space-y-2">
            <Label>Pabaigos data</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !endDate && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {endDate ? format(endDate, 'yyyy-MM-dd', { locale: lt }) : 'Pasirinkite datą'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={endDate}
                  onSelect={setEndDate}
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Full Day Toggle */}
          <div className="flex items-center justify-between">
            <Label htmlFor="full-day">Visa diena</Label>
            <Switch id="full-day" checked={isFullDay} onCheckedChange={setIsFullDay} />
          </div>

          {/* Time Interval (only if not full day) */}
          {!isFullDay && (
            <div className="space-y-2">
              <Label>Laiko intervalas</Label>
              <div className="flex items-center gap-2">
                <TimeInput value={startTime} onChange={setStartTime} />
                <span className="text-muted-foreground">—</span>
                <TimeInput value={endTime} onChange={setEndTime} />
              </div>
            </div>
          )}

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Aprašymas (neprivaloma)</Label>
            <Input
              id="description"
              placeholder="Pvz.: Atostogos, Remontas..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Atšaukti
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Saugoma...' : isEditing ? 'Išsaugoti' : 'Sukurti'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
