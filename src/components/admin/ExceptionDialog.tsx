import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { lt } from 'date-fns/locale';
import { Plus, Trash2, CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { TimeInput } from '@/components/ui/time-input';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { ScheduleException } from '@/hooks/useScheduleExceptions';

interface ExceptionDialogProps {
  open: boolean;
  onClose: () => void;
  selectedDate: Date | null;
  adminPassword: string;
  onExceptionCreated: () => void;
  existingException?: ScheduleException | null;
}

interface TimeInterval {
  id: string;
  startTime: string;
  endTime: string;
}

export function ExceptionDialog({
  open,
  onClose,
  selectedDate,
  adminPassword,
  onExceptionCreated,
  existingException,
}: ExceptionDialogProps) {
  const [isFullDay, setIsFullDay] = useState(true);
  const [intervals, setIntervals] = useState<TimeInterval[]>([
    { id: '1', startTime: '09:00', endTime: '18:00' },
  ]);
  const [isRecurring, setIsRecurring] = useState(false);
  const [isDateRange, setIsDateRange] = useState(false);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

  // When opening with an existing exception, populate the form
  useEffect(() => {
    if (existingException) {
      // Check if it's full day (00:00-23:59 or similar)
      const startTime = existingException.start_time?.substring(0, 5) || '00:00';
      const endTime = existingException.end_time?.substring(0, 5) || '23:59';
      
      const isFullDayException = 
        (startTime === '00:00' && (endTime === '23:59' || endTime === '23:45')) ||
        (startTime === '09:00' && endTime === '18:00' && existingException.exception_type === 'block');
      
      setIsFullDay(isFullDayException);
      setIntervals([{ id: '1', startTime, endTime }]);
      setIsRecurring(existingException.is_recurring);
      setIsDateRange(!!existingException.end_date);
      setEndDate(existingException.end_date ? new Date(existingException.end_date) : undefined);
      setDescription(existingException.description || '');
    } else {
      // Reset to defaults for new exception
      setIsFullDay(true);
      setIntervals([{ id: '1', startTime: '09:00', endTime: '18:00' }]);
      setIsRecurring(false);
      setIsDateRange(false);
      setEndDate(undefined);
      setDescription('');
    }
  }, [existingException, open]);

  if (!selectedDate) return null;

  const dayOfWeek = selectedDate.getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const exceptionType = existingException?.exception_type || (isWeekend ? 'allow' : 'block');

  const dayNames = ['Sekmadienį', 'Pirmadienį', 'Antradienį', 'Trečiadienį', 'Ketvirtadienį', 'Penktadienį', 'Šeštadienį'];

  const handleAddInterval = () => {
    setIntervals([
      ...intervals,
      { id: Date.now().toString(), startTime: '09:00', endTime: '12:00' },
    ]);
  };

  const handleRemoveInterval = (id: string) => {
    if (intervals.length > 1) {
      setIntervals(intervals.filter((i) => i.id !== id));
    }
  };

  const handleIntervalChange = (id: string, field: 'startTime' | 'endTime', value: string) => {
    setIntervals(intervals.map((i) => (i.id === id ? { ...i, [field]: value } : i)));
  };

  const handleSubmit = async () => {
    // Validation for date range
    if (isDateRange && !endDate) {
      toast.error('Pasirinkite pabaigos datą');
      return;
    }
    if (isDateRange && endDate && endDate < selectedDate) {
      toast.error('Pabaigos data negali būti ankstesnė už pradžios datą');
      return;
    }

    setIsSubmitting(true);
    try {
      const isEditing = !!existingException;
      
      if (isEditing) {
        // Update existing exception
        const payload = {
          start_time: isFullDay ? '00:00' : intervals[0].startTime,
          end_time: isFullDay ? '23:59' : intervals[0].endTime,
          exception_type: exceptionType,
          is_recurring: isDateRange ? false : isRecurring,
          description: description || null,
          date: isRecurring && !isDateRange ? null : format(selectedDate, 'yyyy-MM-dd'),
          end_date: isDateRange && endDate ? format(endDate, 'yyyy-MM-dd') : null,
          day_of_week: isRecurring && !isDateRange ? dayOfWeek : null,
        };

        const response = await fetch(
          `${supabaseUrl}/functions/v1/airtable-proxy/admin/exceptions/${existingException.id}`,
          {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'x-admin-password': adminPassword,
            },
            body: JSON.stringify(payload),
          }
        );

        if (!response.ok) {
          throw new Error('Failed to update exception');
        }
        
        toast.success('Išimtis atnaujinta');
      } else {
        // Create new exception(s)
        for (const interval of intervals) {
          const payload: Record<string, any> = {
            start_time: isFullDay ? '00:00' : interval.startTime,
            end_time: isFullDay ? '23:59' : interval.endTime,
            exception_type: exceptionType,
            is_recurring: isDateRange ? false : isRecurring,
            description: description || null,
          };

          if (isDateRange) {
            payload.date = format(selectedDate, 'yyyy-MM-dd');
            payload.end_date = endDate ? format(endDate, 'yyyy-MM-dd') : null;
            payload.day_of_week = null;
          } else if (isRecurring) {
            payload.day_of_week = dayOfWeek;
          } else {
            payload.date = format(selectedDate, 'yyyy-MM-dd');
          }

          const response = await fetch(
            `${supabaseUrl}/functions/v1/airtable-proxy/admin/exceptions`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-admin-password': adminPassword,
              },
              body: JSON.stringify(payload),
            }
          );

          if (!response.ok) {
            throw new Error('Failed to create exception');
          }
        }
        
        toast.success('Išimtis sukurta');
      }
      
      onExceptionCreated();
      handleClose();
    } catch (err) {
      console.error('Error saving exception:', err);
      toast.error(existingException ? 'Klaida atnaujinant išimtį' : 'Klaida kuriant išimtį');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setIsFullDay(true);
    setIntervals([{ id: '1', startTime: '09:00', endTime: '18:00' }]);
    setIsRecurring(false);
    setIsDateRange(false);
    setEndDate(undefined);
    setDescription('');
    onClose();
  };

  const isEditing = !!existingException;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing 
              ? 'Redaguoti išimtį' 
              : (isWeekend ? 'Leisti registraciją' : 'Blokuoti laiką')}
          </DialogTitle>
          <DialogDescription>
            {format(selectedDate, "EEEE, MMMM d 'd.'", { locale: lt })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Full day toggle (only for blocking) */}
          {!isWeekend && (
            <div className="flex items-center justify-between">
              <Label htmlFor="full-day">Visa diena</Label>
              <Switch
                id="full-day"
                checked={isFullDay}
                onCheckedChange={setIsFullDay}
              />
            </div>
          )}

          {/* Time intervals */}
          {(!isFullDay || isWeekend) && (
            <div className="space-y-3">
              <Label>Laiko intervalai</Label>
              {intervals.map((interval) => (
                <div key={interval.id} className="flex items-center gap-2">
                  <TimeInput
                    value={interval.startTime}
                    onChange={(value) =>
                      handleIntervalChange(interval.id, 'startTime', value)
                    }
                  />
                  <span className="text-muted-foreground">-</span>
                  <TimeInput
                    value={interval.endTime}
                    onChange={(value) =>
                      handleIntervalChange(interval.id, 'endTime', value)
                    }
                  />
                  {intervals.length > 1 && !isEditing && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveInterval(interval.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              ))}
              {!isEditing && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAddInterval}
                  className="w-full"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Pridėti intervalą
                </Button>
              )}
            </div>
          )}

          {/* Date range option - only for blocking, not weekends */}
          {!isWeekend && (
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="date-range"
                  checked={isDateRange}
                  onCheckedChange={(checked) => {
                    setIsDateRange(checked === true);
                    if (checked) {
                      setIsRecurring(false);
                    }
                  }}
                />
                <div className="grid gap-1.5 leading-none">
                  <Label htmlFor="date-range" className="cursor-pointer">
                    Kelios dienos (atostogos)
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Blokuoti visas dienas nuo šios datos iki pabaigos datos
                  </p>
                </div>
              </div>
              
              {isDateRange && (
                <div className="space-y-2 pl-7">
                  <Label>Iki datos</Label>
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
                        {endDate 
                          ? format(endDate, 'yyyy-MM-dd') 
                          : 'Pasirinkite pabaigos datą'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={endDate}
                        onSelect={setEndDate}
                        disabled={(date) => date < selectedDate}
                        initialFocus
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              )}
            </div>
          )}

          {/* Recurring toggle - hidden when date range is selected */}
          {!isDateRange && (
            <div className="flex items-start gap-3 pt-2">
              <Checkbox
                id="recurring"
                checked={isRecurring}
                onCheckedChange={(checked) => setIsRecurring(checked === true)}
              />
              <div className="grid gap-1.5 leading-none">
                <Label htmlFor="recurring" className="cursor-pointer">
                  Kartoti kiekvieną savaitę
                </Label>
                <p className="text-sm text-muted-foreground">
                  Ši išimtis bus taikoma kiekvieną {dayNames[dayOfWeek].toLowerCase()}
                </p>
              </div>
            </div>
          )}

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Aprašymas (neprivaloma)</Label>
            <Input
              id="description"
              placeholder="Pvz.: Atostogos, Pietų pertrauka..."
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
            {isSubmitting ? 'Saugoma...' : (isEditing ? 'Išsaugoti' : 'Sukurti')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
