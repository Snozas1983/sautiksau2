
# Planas: Datų intervalo pasirinkimas kalendoriaus dialoge

## Problema
Šiuo metu yra du atskiri dialogai:
1. `ExceptionDialog` - atsidarantis paspaudus ant dienos kalendoriuje (tik vienai dienai)
2. `DateRangeExceptionDialog` - atskiras dialogas Nustatymuose (kelių dienų intervalui)

Vartotojas nori, kad **paspaudus ant dienos kalendoriuje** būtų galimybė pažymėti varnelę ir nurodyti datų intervalą (nuo pasirinktos dienos iki kitos datos), kad vienu įrašu užblokuoti visas dienas atostogų periodui.

## Sprendimas
Modifikuoti `ExceptionDialog.tsx` pridedant:
1. Naują varnelę "Kelios dienos" (checkbox)
2. Kai pažymėta - rodyti datos pasirinkimo lauką "Iki"
3. Saugant - naudoti `end_date` lauką vienu įrašu užblokuoti intervalą

## UI pokytis ExceptionDialog

**Esamas dialogas:**
```text
+------------------------------------------+
| Blokuoti laiką                            |
| Ketvirtadienis, sausio 30 d.             |
|                                           |
| Visa diena: [ĮJUNGTA]                     |
|                                           |
| [ ] Kartoti kiekvieną savaitę             |
|                                           |
| Aprašymas: [________________]             |
|                                           |
| [Atšaukti]              [Sukurti]         |
+------------------------------------------+
```

**Naujas dialogas su intervalo galimybe:**
```text
+------------------------------------------+
| Blokuoti laiką                            |
| Ketvirtadienis, sausio 30 d.             |
|                                           |
| Visa diena: [ĮJUNGTA]                     |
|                                           |
| [x] Kelios dienos (atostogos)             |  <- NAUJAS
|     Iki: [📅 2026-02-14]                  |  <- NAUJAS (kai pažymėta)
|                                           |
| [ ] Kartoti kiekvieną savaitę             |
|                                           |
| Aprašymas: [Atostogos_________]           |
|                                           |
| [Atšaukti]              [Sukurti]         |
+------------------------------------------+
```

**Pastabos:**
- Kai "Kelios dienos" pažymėta, "Kartoti kiekvieną savaitę" automatiškai išjungiama ir paslepiama
- Pradžios data = paspaustos dienos data
- Pabaigos data pasirenkama su Calendar picker

## Failų pakeitimai

| Failas | Pakeitimai |
|--------|------------|
| `src/components/admin/ExceptionDialog.tsx` | Pridėti "Kelios dienos" checkbox, datos picker "Iki", atnaujinti submit logiką naudoti `end_date` |

## Kodo pakeitimai ExceptionDialog.tsx

### 1. Nauji state kintamieji
```typescript
const [isDateRange, setIsDateRange] = useState(false);
const [endDate, setEndDate] = useState<Date | undefined>(undefined);
```

### 2. Nauji imports
```typescript
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
```

### 3. UI pridėjimas - "Kelios dienos" checkbox
Po "Visa diena" toggle, prieš "Kartoti kiekvieną savaitę":
```tsx
{/* Date range option - only for blocking, not recurring */}
{!isWeekend && !isRecurring && (
  <div className="space-y-3">
    <div className="flex items-start gap-3">
      <Checkbox
        id="date-range"
        checked={isDateRange}
        onCheckedChange={(checked) => {
          setIsDateRange(checked === true);
          if (checked) {
            setIsRecurring(false); // Disable recurring when date range is selected
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
```

### 4. Submit logikos atnaujinimas
Pakeisti payload, kai isDateRange = true:
```typescript
const payload: Record<string, any> = {
  start_time: isFullDay ? '00:00' : interval.startTime,
  end_time: isFullDay ? '23:59' : interval.endTime,
  exception_type: exceptionType,
  is_recurring: false, // Always false for date range
  description: description || null,
  date: format(selectedDate, 'yyyy-MM-dd'),
  end_date: isDateRange && endDate ? format(endDate, 'yyyy-MM-dd') : null,
  day_of_week: null,
};
```

### 5. Validacija prieš submit
```typescript
if (isDateRange && !endDate) {
  toast.error('Pasirinkite pabaigos datą');
  return;
}
if (isDateRange && endDate && endDate < selectedDate) {
  toast.error('Pabaigos data negali būti ankstesnė už pradžios datą');
  return;
}
```

### 6. Reset funkcijos atnaujinimas
```typescript
const handleClose = () => {
  setIsFullDay(true);
  setIntervals([{ id: '1', startTime: '09:00', endTime: '18:00' }]);
  setIsRecurring(false);
  setIsDateRange(false);  // NAUJAS
  setEndDate(undefined);  // NAUJAS
  setDescription('');
  onClose();
};
```

## Rezultatas
Po įgyvendinimo:
- Paspaudus ant bet kurios dienos kalendoriuje, atsidaro dialogas
- Galima pažymėti "Kelios dienos (atostogos)" varnelę
- Pasirodo datos pasirinkimas "Iki"
- Vienu paspaudimu sukuriamas vienas įrašas, kuris blokuoja visas dienas intervale
- Nereikia žymėti kiekvienos dienos atskirai
- Nustatymuose esantis DateRangeExceptionDialog taip pat veikia kaip alternatyva

## Techniniai detaliai

Duomenų bazėje vienas įrašas:
```text
| id | date       | end_date   | start_time | end_time | exception_type | is_recurring |
|----|------------|------------|------------|----------|----------------|--------------|
| 1  | 2026-02-01 | 2026-02-14 | 00:00      | 23:59    | block          | false        |
```

Backend logika (jau įgyvendinta) patikrina:
```text
if (dateStr >= exception.date && dateStr <= exception.end_date) → BLOCKED
```
