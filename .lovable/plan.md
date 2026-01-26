

# Automatinių "fake" rezervacijų ir Google Calendar integracijos planas

## Apžvalga

Šis planas apima dvi pagrindines funkcijas:
1. **Automatinės sisteminės rezervacijos** - sukuria fiktyvias rezervacijas pagal algoritmą, kad kalendorius atrodytų užimtesnis
2. **Google Calendar sinchronizacija** - visos rezervacijos matomos Google Calendar, sisteminės pažymėtos atskirai

---

## 1. Automatinės sisteminės rezervacijos

### Algoritmo veikimas

| Likus dienų | Veiksmas |
|-------------|----------|
| 4 dienos | Rezervuoti 1 atsitiktinį laiką |
| 3 dienos | Rezervuoti dar 2 laikus |
| 2 dienos | Atšaukti ARBA perkelti 1 laiką |
| 1 diena | Rezervuoti dar 1 laiką |

**Rezultatas**: 3-4 sisteminės rezervacijos per dieną (priklausomai nuo atšaukimo/perkėlimo)

### Duomenų struktūra

Pridėsime stulpelį `bookings` lentelėje:
- `is_system_booking` (boolean) - pažymi ar tai sistemos sukurta rezervacija
- `system_action_day` (integer) - kuria diena buvo sukurta (4, 3, 2, 1)

Sukursime specialų klientą:
- Vardas: "SISTEMA"
- Telefonas: "SYSTEM-INTERNAL"
- El. paštas: nėra

### Techninis įgyvendinimas

**Nauja Edge funkcija**: `system-bookings`
- Veiks kaip cron job, paleista kiekvieną dieną
- Tikrina artimiausias dienas ir atlieka reikiamus veiksmus
- Pasirenka atsitiktinius laisvus laikus
- Atsitiktinai pasirenka paslaugą

### Cron tvarkaraštis

Paleidžiama kasdien, pvz. 02:00 nakties:
```text
0 2 * * * → Kiekvieną dieną 02:00
```

---

## 2. Google Calendar integracija

### Autentifikacijos procesas (OAuth 2.0)

1. Administratorius prisijungia prie admin skydelio
2. Paspaudžia "Susieti su Google Calendar"
3. Nukreipiamas į Google prisijungimą
4. Autorizuoja prieigą prie kalendoriaus
5. Sistema gauna refresh_token, kurį saugiai išsaugome

### Google Cloud Console nustatymai (jūsų užduotis)

1. Sukurti projektą Google Cloud Console
2. Įjungti Google Calendar API
3. Sukurti OAuth 2.0 Client ID (Web application)
4. Nustatyti redirect URI: `https://gwjdijkbmesjoqmfepkc.supabase.co/functions/v1/google-calendar-callback`

### Duomenų saugojimas

Nauja lentelė `google_calendar_tokens`:
- `access_token` - trumpalaikis prieigos token
- `refresh_token` - ilgalaikis atnaujinimo token
- `expires_at` - galiojimo laikas
- `calendar_id` - pasirinkto kalendoriaus ID

### Sinchronizacijos logika

Kada sinchronizuojame:
- Sukuriant naują rezervaciją → pridėti į Calendar
- Atšaukiant rezervaciją → ištrinti iš Calendar
- Perkeliant rezervaciją → atnaujinti Calendar įvykį

Sisteminių rezervacijų žymėjimas Google Calendar:
- Pavadinimas: `[SISTEMA] Užimta`
- Spalva: kita nei realių rezervacijų (pvz. pilka)
- Aprašymas: "Sisteminė rezervacija"

Realių rezervacijų formatas:
- Pavadinimas: `Kliento vardas - Paslauga`
- Spalva: pagrindinė
- Aprašymas: kontaktinė informacija

---

## Įgyvendinimo žingsniai

### Žingsnis 1: Duomenų bazės pakeitimai
- Pridėti `is_system_booking` ir `system_action_day` stulpelius į `bookings`
- Sukurti `google_calendar_tokens` lentelę
- Pridėti `google_calendar_event_id` stulpelį į `bookings`

### Žingsnis 2: Google Calendar OAuth
- Sukurti `google-calendar-auth` Edge funkciją (inicijuoja OAuth)
- Sukurti `google-calendar-callback` Edge funkciją (gauna tokens)
- Pridėti mygtuką admin nustatymuose

### Žingsnis 3: Sisteminių rezervacijų Edge funkcija
- Sukurti `system-bookings` Edge funkciją
- Implementuoti algoritmo logiką
- Nustatyti cron job

### Žingsnis 4: Calendar sinchronizacija
- Sukurti `sync-google-calendar` Edge funkciją
- Integruoti į booking create/update/delete procesus
- Skirtingas formatavimas sisteminėms vs realioms rezervacijoms

### Žingsnis 5: Admin UI
- Pridėti "Google Calendar" nustatymų sekciją
- Rodyti sinchronizacijos statusą
- Galimybė atsijungti nuo Calendar

---

## Techninė dalis

### Reikalingi secrets

| Secret pavadinimas | Paskirtis |
|--------------------|-----------|
| `GOOGLE_CLIENT_ID` | OAuth client ID iš Google Cloud |
| `GOOGLE_CLIENT_SECRET` | OAuth client secret iš Google Cloud |

### Naujos Edge funkcijos

```text
supabase/functions/
├── system-bookings/         # Cron: automatinės rezervacijos
├── google-calendar-auth/    # OAuth inicijavimas
├── google-calendar-callback/# OAuth callback
└── sync-google-calendar/    # Sinchronizacija su Calendar
```

### Duomenų bazės schema

```text
bookings (pakeitimai):
├── is_system_booking: boolean (default: false)
├── system_action_day: integer (nullable)
└── google_calendar_event_id: text (nullable)

google_calendar_tokens (nauja):
├── id: uuid
├── access_token: text (encrypted)
├── refresh_token: text (encrypted)
├── expires_at: timestamp
├── calendar_id: text
└── created_at: timestamp
```

### Admin UI pakeitimai

Sisteminės rezervacijos admin kalendoriuje:
- Pažymėtos kitokia spalva (pvz. šviesiai pilka)
- Pavadinimas: "[SISTEMA]"
- Galimybė redaguoti/ištrinti kaip įprastas

Nustatymų skyrelyje:
- Google Calendar susiejimo mygtukas
- Sinchronizacijos statusas
- Atsijungimo mygtukas

---

## Jūsų paruošiamieji veiksmai

Prieš įgyvendinant, jums reikės:

1. **Sukurti Google Cloud projektą**:
   - Eiti į https://console.cloud.google.com
   - Sukurti naują projektą arba naudoti esamą

2. **Įjungti Google Calendar API**:
   - APIs & Services → Library
   - Ieškoti "Google Calendar API"
   - Paspausti "Enable"

3. **Sukurti OAuth kredencialus**:
   - APIs & Services → Credentials
   - Create Credentials → OAuth client ID
   - Application type: Web application
   - Authorized redirect URI: `https://gwjdijkbmesjoqmfepkc.supabase.co/functions/v1/google-calendar-callback`

4. **Pateikti kredencialus**:
   - Client ID
   - Client Secret

---

## Saugumo aspektai

- Refresh token saugomas šifruotai duomenų bazėje
- Tik admin gali susieti Google Calendar
- Sisteminės rezervacijos neturi tikrų klientų duomenų
- RLS politikos apsaugo tokens lentelę

