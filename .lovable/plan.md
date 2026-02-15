

# Planas: Apsauginė RLS SELECT politika `bookings` lentelei

## Kas bus padaryta

Pridėsime SELECT politiką `bookings` lentelei su `USING (false)` -- tai reiškia, kad niekas negali tiesiogiai skaityti rezervacijų duomenų per viešą API. Edge Function ir toliau veiks, nes naudoja `service_role` raktą, kuris apeina RLS.

## Techninis pakeitimas

Viena SQL migracija:

```sql
CREATE POLICY "No direct select access to bookings"
  ON public.bookings
  FOR SELECT
  USING (false);
```

## Kas pasikeis

- Klientų vardai, telefonai, el. paštai bus apsaugoti nuo tiesioginės prieigos
- Admin dashboard, rezervacijų kūrimas ir valdymas veiks kaip ir anksčiau (per Edge Function)
- Jokių frontend pakeitimų nereikia

## Kas nepasikeis

- Visa esama logika lieka tokia pati
- Edge Function naudoja `service_role` raktą, todėl RLS jam netaikomas

