

# Planas: Pagreitinti kalendoriaus užkrovimą

## Problema
Kalendoriaus prieinamumo užkrovimas užtrunka ilgai, nes:
1. Backend kiekvieną kartą skaičiuoja 45 dienų prieinamumą (apie 1000 slotų)
2. Atliekamos 3 atskiros duomenų bazės užklausos (settings, bookings, exceptions)
3. Nėra jokio serverio pusės kešavimo
4. Frontend cache galioja tik 2 minutes

## Sprendimas

Siūlau **3 optimizacijas**, kurios drauge sumažins užkrovimo laiką 3-5x:

### 1. Lygiagrečios duomenų bazės užklausos (Backend)
Vietoj 3 nuoseklių užklausų, vykdyti jas lygiagrečiai su `Promise.all()`.

**Dabartinis kodas:**
```typescript
const settings = await getSettings();
const { data: bookingsData } = await supabaseAdmin.from('bookings')...;
const { data: exceptionsData } = await supabaseAdmin.from('schedule_exceptions')...;
```

**Naujas kodas:**
```typescript
const [settings, bookingsResult, exceptionsResult] = await Promise.all([
  getSettings(),
  supabaseAdmin.from('bookings')...,
  supabaseAdmin.from('schedule_exceptions')...,
]);
```

**Rezultatas:** ~60-70% greičiau (3 užklausos per ~100ms vietoj ~300ms)

### 2. Cache-Control header (Backend)
Pridėti HTTP cache header, kad naršyklė ir CDN galėtų kešuoti atsakymą 1 minutę.

```typescript
return new Response(JSON.stringify({ availability, maxDate }), {
  headers: { 
    ...corsHeaders, 
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=60, stale-while-revalidate=120',
  },
});
```

**Rezultatas:** Pakartotinės užklausos per 1 min bus iš cache (~0ms)

### 3. Ilgesnis frontend cache (Frontend)
Padidinti React Query `staleTime` nuo 2 min iki 5 min.

```typescript
staleTime: 5 * 60 * 1000, // 5 minutes (vietoj 2)
```

**Rezultatas:** Mažiau užklausų į serverį, greitesnis navigavimas tarp paslaugų

### 4. Skeleton loading (UI)
Vietoj "Kraunama prieinamumas..." teksto, rodyti kalendoriaus skeleton, kad vartotojas matytų progresą.

## Failų pakeitimai

| Failas | Pakeitimas |
|--------|------------|
| `supabase/functions/airtable-proxy/index.ts` | Lygiagrečios užklausos + Cache-Control header |
| `src/hooks/useCalendarAvailability.ts` | Padidinti staleTime iki 5 min |
| `src/components/booking/BookingSection.tsx` | Pridėti skeleton loading UI |
| `src/components/booking/CalendarSkeleton.tsx` | Naujas komponentas skeleton loading |

## Techninis planas

### A. Backend optimizacija (`airtable-proxy/index.ts`)

**Eilutės 108-145** - pakeisti į:

```typescript
// Run all queries in parallel for faster response
const [settings, bookingsResult, exceptionsResult] = await Promise.all([
  getSettings(),
  supabaseAdmin
    .from('bookings')
    .select('date, start_time, end_time')
    .gte('date', startDateStr)
    .lte('date', endDateStr)
    .eq('status', 'confirmed'),
  supabaseAdmin
    .from('schedule_exceptions')
    .select('*'),
]);

if (bookingsResult.error) throw bookingsResult.error;
if (exceptionsResult.error) throw exceptionsResult.error;

const bookingsData = bookingsResult.data;
const exceptionsData = exceptionsResult.data;
const workStart = settings['work_start'] || '09:00';
const workEnd = settings['work_end'] || '18:00';
const breakBetween = parseInt(settings['break_between'] || '0');
```

**Eilutė 356-361** - pridėti Cache-Control:

```typescript
return new Response(JSON.stringify({ 
  availability,
  maxDate: endDateStr,
}), {
  headers: { 
    ...corsHeaders, 
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=60, stale-while-revalidate=120',
  },
});
```

### B. Frontend cache (`useCalendarAvailability.ts`)

```typescript
staleTime: 5 * 60 * 1000, // 5 minutes
```

### C. Skeleton komponentas (`CalendarSkeleton.tsx`)

```tsx
export const CalendarSkeleton = () => (
  <div className="space-y-4 animate-pulse">
    <div className="h-6 w-24 bg-booking-border rounded" />
    <div className="bg-booking-surface rounded-sm p-3">
      <div className="flex justify-between mb-3">
        <div className="h-4 w-4 bg-booking-border rounded" />
        <div className="h-4 w-32 bg-booking-border rounded" />
        <div className="h-4 w-4 bg-booking-border rounded" />
      </div>
      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="h-4 bg-booking-border rounded mx-1" />
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {Array.from({ length: 35 }).map((_, i) => (
          <div key={i} className="aspect-square bg-booking-border rounded-sm" />
        ))}
      </div>
    </div>
  </div>
);
```

## Tikėtinas rezultatas

| Metrika | Dabar | Po optimizacijos |
|---------|-------|------------------|
| Pirmas užkrovimas | ~800-1200ms | ~300-500ms |
| Pakartotinis (cache) | ~800-1200ms | ~0-50ms |
| Keitimas tarp paslaugų | ~800-1200ms | ~0ms (cache) |

## Eiliškumas

1. Backend lygiagrečios užklausos (didžiausias poveikis)
2. Cache-Control header
3. Frontend staleTime
4. Skeleton UI (vizualinis pagerinimas)

