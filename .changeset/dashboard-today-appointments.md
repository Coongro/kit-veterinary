---
"@coongro/kit-veterinary": minor
---

Replace the "Seguimientos Pendientes" widget on the dashboard with an "Agenda de Hoy" widget that reads from `@coongro/appointments` via `useTodayAppointments`. The new widget lists today's appointments sorted by time, with status badges and a link to the agenda view, reusing `EventCard` (variant `list`) from `@coongro/calendar` plus the exported status helpers from `@coongro/appointments` so the dashboard stays visually consistent with the agenda. Requires `@coongro/appointments >= 0.2.0`.
