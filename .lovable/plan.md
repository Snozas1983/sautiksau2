
# Planas: Dvikryptė Google Calendar sinchronizacija

## Apžvalga

Reikia sukurti pilną dvikryptę sinchronizaciją tarp Lovable rezervacijų sistemos ir Google Calendar "SAU TIK SAU". Tai apima:
- Lovable rezervacijos automatiškai atsiranda Google Calendar
- Google Calendar įvykiai automatiškai atsiranda Lovable kaip "užimtas laikas"
- Atšaukimai abiejose sistemose sinchronizuojami

---

## Dabartinė situacija

| Funkcionalumas | Būsena |
|----------------|--------|
| Google OAuth prisijungimas | Veikia |
| Sinchronizacija Lovable → Google | Dalinai (reikia integruoti į booking kūrimą) |
| Sinchronizacija Google → Lovable | Neegzistuoja |
| Webhook iš Google | Neegzistuoja |

---

## Pakeitimai

### 1. Automatinė sinchronizacija kuriant rezervacijas (Lovable → Google)

**Failas:** `supabase/functions/airtable-proxy/index.ts`

Po sėkmingo rezervacijos sukūrimo (eilutė ~576), iškviesti `sync-google-calendar` funkciją:

```typescript
// Po newBooking sukūrimo ir prieš grąžinant response:
if (newBooking && newBooking.status === 'confirmed') {
  fetch(`${SUPABASE_URL}/functions/v1/sync-google-calendar`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({
      bookingId: newBooking.id,
      action: 'create'
    }),
  }).catch(err => console.error('Google Calendar sync error:', err));
}
```

### 2. Sinchronizacija atšaukiant/perkeliant rezervacijas

**Failas:** `supabase/functions/airtable-proxy/index.ts`

Atnaujinti admin booking update endpoint (~795-829 eilutės):
- Jei `status` keičiamas į `cancelled` - ištrinti iš Google Calendar
- Jei keičiasi data/laikas - atnaujinti Google Calendar

### 3. Nauja Edge funkcija: `import-google-calendar`

**Naujas failas:** `supabase/functions/import-google-calendar/index.ts`

Ši funkcija:
1. Nuskaito visus Google Calendar įvykius nurodytam laikotarpiui
2. Palygina su esančiais Lovable įrašais (pagal `google_calendar_event_id`)
3. Sukuria naujus sisteminius įrašus iš Google Calendar
4. Ištrina Lovable sisteminius įrašus, kurių nebėra Google Calendar

```typescript
// Pagrindinė logika:
async function importFromGoogleCalendar(accessToken, calendarId, supabase) {
  // 1. Gauti įvykius iš Google Calendar (30 dienų į priekį)
  const events = await fetchGoogleEvents(accessToken, calendarId);
  
  // 2. Gauti esamus sisteminius bookings su google_calendar_event_id
  const existingBookings = await getExistingGoogleSyncedBookings(supabase);
  
  // 3. Sukurti naujus įrašus iš Google (kurių dar nėra Lovable)
  for (const event of events) {
    if (!existingBookings.has(event.id)) {
      await createSystemBookingFromGoogleEvent(supabase, event);
    }
  }
  
  // 4. Ištrinti Lovable įrašus, kurių nebėra Google
  for (const booking of existingBookings) {
    if (!events.find(e => e.id === booking.google_calendar_event_id)) {
      await deleteBooking(supabase, booking.id);
    }
  }
}
```

### 4. Duomenų bazės pakeitimai

Pridėti naują stulpelį `bookings` lentelėje importui sekti:

```sql
ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS google_calendar_source boolean DEFAULT false;
```

Tai padės atskirti:
- `is_system_booking = true, google_calendar_source = false` - Lovable sisteminis
- `is_system_booking = true, google_calendar_source = true` - Importuotas iš Google

### 5. Periodinė sinchronizacija (Cron)

Sukurti naują cron job, kuris kas 15 min paleidžia `import-google-calendar`:

**Failas:** `supabase/config.toml` (jei palaikomas) arba naudoti išorinį cron servisą

### 6. Admin UI papildymas

**Failas:** `src/components/admin/SettingsTab.tsx`

Pridėti mygtukus:
- "Sinchronizuoti dabar" - rankiniu būdu paleisti importą
- Rodyti paskutinės sinchronizacijos laiką

---

## Techninė architektūra

```text
+------------------+       +-------------------+       +------------------+
|                  |       |                   |       |                  |
|     Lovable      | <---> |   Edge Functions  | <---> | Google Calendar  |
|   (bookings)     |       |                   |       |    (events)      |
+------------------+       +-------------------+       +------------------+
        |                          |
        |                          |
        v                          v
   Naujas booking         sync-google-calendar
   Atšaukimas             import-google-calendar
   Perkėlimas
```

### Sinchronizacijos taisyklės

| Šaltinis | Veiksmas | Rezultatas |
|----------|----------|------------|
| Lovable: naujas booking (confirmed) | → | Sukuriamas Google Calendar event |
| Lovable: booking atšauktas | → | Ištrinamas iš Google Calendar |
| Lovable: booking perkeltas | → | Atnaujinamas Google Calendar event |
| Google: naujas event | ← | Sukuriamas sisteminis booking |
| Google: event ištrintas | ← | Ištrinamas sisteminis booking |
| Google: event pakeistas | ← | Atnaujinamas sisteminis booking |

---

## Įgyvendinimo eiliškumas

1. **Pirmas žingsnis**: Atnaujinti `airtable-proxy` - automatinis sync kuriant/keičiant rezervacijas
2. **Antras žingsnis**: Sukurti `import-google-calendar` Edge funkciją
3. **Trečias žingsnis**: Pridėti DB migracijas (`google_calendar_source` stulpelis)
4. **Ketvirtas žingsnis**: Atnaujinti Admin UI su sinchronizacijos mygtuku
5. **Penktas žingsnis**: Nustatyti periodinę sinchronizaciją

---

## Rizikos ir sprendimai

| Rizika | Sprendimas |
|--------|------------|
| Dublikatai | Tikrinti pagal `google_calendar_event_id` prieš kuriant |
| Rate limits | Sinchronizuoti kas 15 min, ne realiu laiku |
| Token galiojimas | Jau yra token refresh logika `sync-google-calendar` |
| Konfliktai | Google Calendar yra "master" importuojamiems įvykiams |

---

## Failų sąrašas

| Failas | Veiksmas |
|--------|----------|
| `supabase/functions/airtable-proxy/index.ts` | Modifikuoti - pridėti auto-sync |
| `supabase/functions/import-google-calendar/index.ts` | Sukurti naują |
| `supabase/config.toml` | Modifikuoti - pridėti naują funkciją |
| `src/components/admin/SettingsTab.tsx` | Modifikuoti - pridėti sync mygtuką |
| `src/hooks/useGoogleCalendar.ts` | Modifikuoti - pridėti importo funkcijas |
| DB migracija | Pridėti `google_calendar_source` stulpelį |
