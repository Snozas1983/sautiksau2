# Automatinių "fake" rezervacijų ir Google Calendar integracijos planas

## ✅ Statusas: ĮGYVENDINTA

---

## Įgyvendintos funkcijos

### 1. Automatinės sisteminės rezervacijos ✅

**Algoritmas:**
| Likus dienų | Veiksmas |
|-------------|----------|
| 4 dienos | Rezervuoti 1 atsitiktinį laiką |
| 3 dienos | Rezervuoti dar 2 laikus |
| 2 dienos | Atšaukti ARBA perkelti 1 laiką (50/50) |
| 1 diena | Rezervuoti dar 1 laiką |

**Rezultatas**: 3-4 sisteminės rezervacijos per dieną

**Techninė realizacija:**
- Nauji stulpeliai `bookings` lentelėje: `is_system_booking`, `system_action_day`, `google_calendar_event_id`
- Edge funkcija: `system-bookings`
- Cron job: kasdien 02:00 nakties
- Admin UI: galimybė paleisti rankiniu būdu (Nustatymai → Sisteminės rezervacijos)

### 2. Google Calendar integracija ✅

**Funkcijos:**
- OAuth 2.0 prisijungimas per admin nustatymus
- Automatinis rezervacijų sinchronizavimas į Google Calendar
- Sisteminės rezervacijos pažymėtos "[SISTEMA]" pilka spalva
- Realios rezervacijos su kliento informacija mėlyna spalva

**Edge funkcijos:**
- `google-calendar-auth` - inicijuoja OAuth
- `google-calendar-callback` - gauna tokens
- `sync-google-calendar` - sinchronizuoja rezervacijas

**Reikalingi secrets (jau sukonfigūruoti):**
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

### 3. Admin UI atnaujinimai ✅

- Sisteminės rezervacijos matomos pilka spalva kalendoriuje
- Sisteminės rezervacijos pažymėtos `[SYS]` arba `[SISTEMA]`
- Google Calendar susiejimo mygtukas nustatymuose
- Sinchronizacijos statusas
- Mygtukas paleisti sisteminių rezervacijų funkciją rankiniu būdu

---

## Instrukcijos naudotojui

### Google Calendar susiejimas

1. Eikite į **Admin → Nustatymai**
2. Raskite **Google Calendar** sekciją
3. Paspauskite **"Susieti su Google Calendar"**
4. Prisijunkite su Google paskyra
5. Autorizuokite prieigą prie kalendoriaus
6. Sistema automatiškai ras SAUTIKSAU kalendorių arba naudos pagrindinį

### Sisteminių rezervacijų testavimas

1. Eikite į **Admin → Nustatymai**
2. Raskite **Sisteminės rezervacijos** sekciją
3. Paspauskite **"Paleisti dabar"**
4. Peržiūrėkite kalendorių - pamatysite naujas sistemines rezervacijas pilka spalva

---

## Techninė dokumentacija

### Duomenų bazė

```sql
-- Bookings lentelės pakeitimai
is_system_booking: boolean (default: false)
system_action_day: integer (nullable) -- 4, 3, 2, arba 1
google_calendar_event_id: text (nullable)

-- Nauja lentelė
google_calendar_tokens:
├── access_token: text
├── refresh_token: text
├── expires_at: timestamp
├── calendar_id: text
```

### Edge funkcijos

```
supabase/functions/
├── system-bookings/           # Cron: automatinės rezervacijos
├── google-calendar-auth/      # OAuth inicijavimas
├── google-calendar-callback/  # OAuth callback
└── sync-google-calendar/      # Sinchronizacija
```

### Cron job

```sql
-- Paleidžiamas kasdien 02:00 UTC
SELECT cron.schedule('system-bookings-daily', '0 2 * * *', ...)
```
