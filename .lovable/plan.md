
# Planas: Pilna dvikrypė Google Calendar sinchronizacija

## Problema
Mygtukas „Sinchronizuoti dabar" šiuo metu tik importuoja iš Google Calendar, bet nesiuntia vidinių rezervacijų (SISTEMA ir tikrų klientų) atgal į Google. Dėl to 7 patvirtintos rezervacijos yra sistemoje, bet jų nėra Google Calendar.

## Sprendimas
Sukurti pilną dvikryptę sinchronizaciją su pasirenkamu datų intervalu.

## Techniniai pakeitimai

### 1. Nauja Edge Function: `full-sync-google-calendar`
Sukursiu naują funkciją, kuri atliks pilną dvikryptę sinchronizaciją:

```text
1. Pirma fazė: PUSH į Google
   - Surinkti visas patvirtintas rezervacijas be google_calendar_event_id
   - Sukurti Google Calendar įvykius kiekvienai
   - Išsaugoti gautą eventId į DB

2. Antra fazė: PULL iš Google  
   - Iškviesti esamą import-google-calendar logiką
   - Importuoti išorinius įvykius kaip blokuojančias rezervacijas
```

### 2. Admin UI pakeitimai (`SettingsTab.tsx`)
- Pridėti datų intervalo pasirinkimą (pradžia/pabaiga)
- Pakeisti mygtuką „Sinchronizuoti dabar" kad iškviestų naują `full-sync-google-calendar`
- Rodyti detalesnę sinchronizacijos statistiką

### 3. Atnaujinta sinchronizacijos logika
Sisteminės rezervacijos (SISTEMA) bus sinchronizuojamos su:
- Pavadinimas: „STS Užimta"
- Spalva: pilka (graphite)

Tikros klientų rezervacijos:
- Pavadinimas: „STS [Vardas] - [Paslauga]"
- Spalva: mėlyna

## UI pakeitimai

Admin Settings > Google Calendar sekcija turės:

```text
+------------------------------------------+
| Google Calendar                           |
| Dvikryptė sinchronizacija                 |
|                                           |
| [x] Susietas (Service Account)            |
| Calendar ID: a6832f3...@group.calendar.google.com |
|                                           |
| Sinchronizacijos intervalas:              |
| Nuo: [2026-01-28]  Iki: [2026-03-28]      |
|                                           |
| [ Sinchronizuoti dabar ]                  |
|                                           |
| Paskutinė sinchronizacija: 2026-01-28 17:45 |
| Rezultatas: +3 į Google, ↻4 atnaujinti,   |
|             +0 iš Google                  |
+------------------------------------------+
```

## Failų pakeitimai

| Failas | Veiksmas |
|--------|----------|
| `supabase/functions/full-sync-google-calendar/index.ts` | Sukurti naują |
| `src/components/admin/SettingsTab.tsx` | Pridėti datų pasirinkimą, pakeisti sync logiką |
| `src/hooks/useGoogleCalendar.ts` | Pridėti `fullSync` funkciją su datų parametrais |
| `supabase/config.toml` | Pridėti naują funkciją |

## Veiksmų seka

1. Sukurti `full-sync-google-calendar` Edge Function
2. Atnaujinti `useGoogleCalendar` hook su `fullSync` metodu
3. Pakeisti `SettingsTab.tsx` - pridėti datų laukus ir naują sinchronizacijos logiką
4. Deplointi Edge Function
5. Testuoti sinchronizaciją

## Rezultatas
Po įgyvendinimo, paspaudus „Sinchronizuoti dabar":
1. Visos 7 patvirtintos rezervacijos be Google event ID bus išsiųstos į Google Calendar
2. Visi išoriniai Google Calendar įvykiai bus importuoti kaip blokuojančios rezervacijos
3. Bus galima pasirinkti sinchronizuojamą datų intervalą
