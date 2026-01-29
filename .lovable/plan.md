
# Planas: Kelių dienų/savaičių kalendoriaus išjungimas

## ✅ ĮGYVENDINTA

### Duomenų bazės pakeitimai
- Pridėtas `end_date` stulpelis į `schedule_exceptions` lentelę

### Backend pakeitimai (`airtable-proxy/index.ts`)
- Atnaujinta `isSlotBlockedByException` funkcija palaikyti datų intervalus
- PUT endpoint atnaujintas priimti `end_date` lauką
- Pridėta `dateRangeExceptions` logika tikrinti ar data patenka į intervalą

### Frontend pakeitimai
- Sukurtas naujas `DateRangeExceptionDialog.tsx` komponentas
- Atnaujintas `SettingsTab.tsx` su "Kalendoriaus išjungimai" sekcija
- Atnaujintas `useScheduleExceptions.ts` tipas su `end_date`

### Funkcionalumas
- Admin nustatymuose nauja sekcija "Kalendoriaus išjungimai"
- Galima sukurti intervalą nuo-iki vienu įrašu
- Galima pasirinkti ar blokuoti visą dieną ar tik tam tikras valandas
- Visos dienos intervale automatiškai užblokuojamos
- Galima redaguoti ir trinti sukurtus išjungimus

