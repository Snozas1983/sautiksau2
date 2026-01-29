

# Planas: Pataisyti "Kelios dienos" varnelės matomumą

## Problema
Vartotojas nemato "Kelios dienos (atostogos)" varnelės dialoge, kai paspaudžia ant kalendoriaus dienos. Mato tik "Kartoti kiekvieną savaitę".

## Priežastis
Dabartinėje implementacijoje "Kelios dienos" sekcija rodoma tik kai `!isWeekend` (eilutė 293). Tai reiškia:
- Jei paspausite ant **pirmadienio-penktadienio** → Turėtų matyti abi varneles
- Jei paspausite ant **šeštadienio/sekmadienio** → "Kelios dienos" varnelė PASLEPTA

## Sprendimas
Pašalinti `!isWeekend` sąlygą, kad "Kelios dienos (atostogos)" varnelė būtų rodoma **visoms dienoms**, ne tik darbo dienoms. Tai leis kurti atostogų intervalus pradedant nuo bet kurios savaitės dienos.

## Pakeitimai

### `src/components/admin/ExceptionDialog.tsx`

**Dabartinis kodas (eilutė 293):**
```tsx
{!isWeekend && (
  <div className="space-y-3">
    ...
  </div>
)}
```

**Naujas kodas:**
```tsx
<div className="space-y-3">
  ...
</div>
```

Tiesiog pašalinti `{!isWeekend && (...)}` apvalkalą, kad "Kelios dienos" sekcija būtų visada rodoma.

## UI po pakeitimo

```text
+------------------------------------------+
| Blokuoti laiką / Leisti registraciją      |
| [Pasirinkta diena]                        |
|                                           |
| Visa diena: [ĮJUNGTA]                     |
|                                           |
| [x] Kelios dienos (atostogos)             |  ← VISADA RODOMA
|     Iki: [📅 2026-02-14]                  |
|                                           |
| [ ] Kartoti kiekvieną savaitę             |
|                                           |
| Aprašymas: [________________]             |
|                                           |
| [Atšaukti]              [Sukurti]         |
+------------------------------------------+
```

## Failų pakeitimai

| Failas | Pakeitimas |
|--------|------------|
| `src/components/admin/ExceptionDialog.tsx` | Pašalinti `!isWeekend` sąlygą nuo "Kelios dienos" sekcijos (eilutė 293) |

## Rezultatas
- "Kelios dienos (atostogos)" varnelė bus matoma paspaudus ant **bet kurios** kalendoriaus dienos
- Galėsite pasirinkti pradžios dieną (paspaudę ant jos) ir pabaigos datą (su kalendoriaus picker)
- Vienu įrašu užblokuosite visą atostogų periodą

