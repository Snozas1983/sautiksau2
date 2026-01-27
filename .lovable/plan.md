
# Planas: Logo + "Masažo studija" el. laiškuose ir valdymo formoje

## Situacija

1. **El. pašto šablonuose** logotipas jau yra numatytas (`{{logo_url}}`), tačiau trūksta "Masažo studija" teksto Montserrat šriftu
2. **ManageBooking puslapyje** logotipas rodomas, bet trūksta "Masažo studija" teksto
3. **Montserrat šriftas** nėra įkeltas į projektą

---

## Pakeitimai

### 1. Pridėti Montserrat šriftą

**Failas:** `index.html`

Pridėti prie esamų šriftų importų:

```html
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400&display=swap" rel="stylesheet">
```

---

### 2. Atnaujinti ManageBooking puslapį

**Failas:** `src/pages/ManageBooking.tsx`

Pakeisti logotipo bloką (abu vietose - pagrindinėje ir klaidos būsenoje):

**Dabartinis kodas:**
```tsx
<div className="flex justify-center mb-6">
  <a href="/">
    <img src={logo} alt="SAU TIK SAU masažo studija" className="w-32 md:w-40" />
  </a>
</div>
```

**Naujas kodas:**
```tsx
<div className="flex flex-col items-center mb-6">
  <a href="/">
    <img src={logo} alt="SAU TIK SAU" className="w-32 md:w-40" />
  </a>
  <p 
    className="text-sm text-muted-foreground tracking-[0.2em] mt-2 uppercase"
    style={{ fontFamily: "'Montserrat', sans-serif" }}
  >
    Masažo studija
  </p>
</div>
```

---

### 3. Atnaujinti el. pašto šablonus duomenų bazėje

Atnaujinti 4 klientų el. pašto šablonus - pakeisti logotipo bloką, kad būtų rodomas "Masažo studija" tekstas:

**Naujas logotipo blokas šablonuose:**
```html
{{#if logo_url}}
<div style="text-align: center; margin-bottom: 30px;">
  <img src="{{logo_url}}" alt="SAU TIK SAU" style="max-width: 180px;" />
  <p style="font-family: 'Montserrat', Arial, sans-serif; font-size: 12px; color: #666; margin-top: 8px; letter-spacing: 3px; text-transform: uppercase;">
    Masažo studija
  </p>
</div>
{{/if}}
```

**Šablonai, kuriuos reikia atnaujinti:**
- `email_customer` - rezervacijos patvirtinimas
- `email_cancel_customer` - vizito atšaukimas
- `email_reschedule_customer` - vizito perkėlimas
- `email_pending_customer` - laukiantis patvirtinimo

---

## Techninė santrauka

| Failas/Resursas | Veiksmas |
|-----------------|----------|
| `index.html` | Pridėti Montserrat šrifto importą |
| `src/pages/ManageBooking.tsx` | Pridėti "Masažo studija" tekstą po logotipu (2 vietos) |
| DB: `notification_templates` | Atnaujinti 4 el. pašto šablonų logotipo bloką |

---

## Rezultatas

Po įgyvendinimo:
- Klientai matys profesionalų brendingą su logotipu ir "Masažo studija" užrašu
- Vienodas stilius visuose kontaktiniuose taškuose (el. laiškai, valdymo puslapis)
