import { useState } from 'react';
import { format } from 'date-fns';
import { lt } from 'date-fns/locale';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { toast } from 'sonner';

interface ExceptionDialogProps {
  open: boolean;
  onClose: () => void;
  selectedDate: Date | null;
  adminPassword: string;
  onExceptionCreated: () => void;
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
}: ExceptionDialogProps) {
  const [isFullDay, setIsFullDay] = useState(true);
  const [intervals, setIntervals] = useState<TimeInterval[]>([
    { id: '1', startTime: '09:00', endTime: '18:00' },
  ]);
  const [isRecurring, setIsRecurring] = useState(false);
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

  if (!selectedDate) return null;

  const dayOfWeek = selectedDate.getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const exceptionType = isWeekend ? 'allow' : 'block';

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
    setIsSubmitting(true);
    try {
      for (const interval of intervals) {
        const payload: Record<string, any> = {
          start_time: interval.startTime,
          end_time: interval.endTime,
          exception_type: exceptionType,
          is_recurring: isRecurring,
          description: description || null,
        };

        if (isRecurring) {
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
      onExceptionCreated();
      handleClose();
    } catch (err) {
      console.error('Error creating exception:', err);
      toast.error('Klaida kuriant išimtį');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setIsFullDay(true);
    setIntervals([{ id: '1', startTime: '09:00', endTime: '18:00' }]);
    setIsRecurring(false);
    setDescription('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isWeekend ? 'Leisti registraciją' : 'Blokuoti laiką'}
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
              {intervals.map((interval, index) => (
                <div key={interval.id} className="flex items-center gap-2">
                  <Input
                    type="time"
                    value={interval.startTime}
                    onChange={(e) =>
                      handleIntervalChange(interval.id, 'startTime', e.target.value)
                    }
                    className="flex-1"
                  />
                  <span className="text-muted-foreground">-</span>
                  <Input
                    type="time"
                    value={interval.endTime}
                    onChange={(e) =>
                      handleIntervalChange(interval.id, 'endTime', e.target.value)
                    }
                    className="flex-1"
                  />
                  {intervals.length > 1 && (
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
              <Button
                variant="outline"
                size="sm"
                onClick={handleAddInterval}
                className="w-full"
              >
                <Plus className="mr-2 h-4 w-4" />
                Pridėti intervalą
              </Button>
            </div>
          )}

          {/* Recurring toggle */}
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
            {isSubmitting ? 'Saugoma...' : 'Sukurti'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
