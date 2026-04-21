# @coongro/kit-veterinary

## 0.3.1

### Patch Changes

- ed3837c: Declare `@coongro/vet-staff` as a kit dependency so tenants installing the veterinary kit get the vet professionals module automatically. Also normalizes version constraints for `consultations` and `patients` (removes loose `*`).

## 0.3.0

### Minor Changes

- 431a4b2: Migrate dashboard to strict `@coongro/datetime` API.
  - Local `Consultation` / `Contact` types use branded `UTCTimestamp` / `DateKey`.
  - Dashboard uses `toDateKey` / `addDays` for day-local comparisons.
  - `follow_up_date` consumed directly (already `DateKey` from consultations schema).
  - Added `@coongro/appointments` as a kit dependency so installing the kit auto-installs the full veterinary bundle (appointments + calendar + consultations + patients + products + staff + contacts).
  - Deleted the transitional `dateKey()` regex workaround that handled both ISO and custom `follow_up_date` formats.

  Description updated to mention turnos.

## 0.2.0

### Minor Changes

- 5c7a124: Replace custom date utilities with @coongro/calendar exports

## 0.1.5

### Patch Changes

- 9092bc4: Disable Tailwind preflight to avoid duplicating host CSS reset

## 0.1.4

### Patch Changes

- d9c059b: fix(ci): correct release and publish workflows
  - Fix changesets/action version command (use shell script instead of inline &&)
  - Fix scoped registry override in production publish
  - Add tag creation and GitHub Release in publish workflow
  - Remove obsolete tag-release workflow

## 1.0.0

### Patch Changes

- Updated dependencies [3a28d12]
- Updated dependencies [792063d]
  - @coongro/plugin-sdk@0.13.0
  - @coongro/consultations@1.0.0
