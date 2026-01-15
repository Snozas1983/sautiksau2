import { cn } from '@/lib/utils';

interface TimeInputProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
}

export function TimeInput({ value, onChange, className, disabled }: TimeInputProps) {
  const [hours, minutes] = value ? value.split(':') : ['09', '00'];

  const handleHoursChange = (newHours: string) => {
    onChange(`${newHours}:${minutes}`);
  };

  const handleMinutesChange = (newMinutes: string) => {
    onChange(`${hours}:${newMinutes}`);
  };

  const hourOptions = Array.from({ length: 24 }, (_, i) => 
    i.toString().padStart(2, '0')
  );

  const minuteOptions = ['00', '15', '30', '45'];

  return (
    <div className={cn('flex items-center gap-1', className)}>
      <select
        value={hours}
        onChange={(e) => handleHoursChange(e.target.value)}
        disabled={disabled}
        className="flex h-10 w-16 rounded-md border border-input bg-background px-2 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {hourOptions.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>
      <span className="text-muted-foreground">:</span>
      <select
        value={minutes}
        onChange={(e) => handleMinutesChange(e.target.value)}
        disabled={disabled}
        className="flex h-10 w-16 rounded-md border border-input bg-background px-2 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {minuteOptions.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
    </div>
  );
}
