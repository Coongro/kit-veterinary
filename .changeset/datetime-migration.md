---
"@coongro/kit-veterinary": minor
---

Migrate dashboard to strict `@coongro/datetime` API.

- Local `Consultation` / `Contact` types use branded `UTCTimestamp` / `DateKey`.
- Dashboard uses `toDateKey` / `addDays` for day-local comparisons.
- `follow_up_date` consumed directly (already `DateKey` from consultations schema).
- Added `@coongro/appointments` as a kit dependency so installing the kit auto-installs the full veterinary bundle (appointments + calendar + consultations + patients + products + staff + contacts).
- Deleted the transitional `dateKey()` regex workaround that handled both ISO and custom `follow_up_date` formats.

Description updated to mention turnos.
