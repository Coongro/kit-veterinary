---
'@coongro/kit-veterinary': patch
---

fix(dashboard): brand variant + ingresos label width (COONG-112)

- "Registrar Paciente" button: drop variant='outline' so it matches the brand-yellow style of "Nueva Consulta" next to it.
- Ingresos card: date label width w-12→w-20 + whitespace-nowrap so dates like "19/4/2026" fit on one line instead of wrapping below the bar.
