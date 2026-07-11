---
"@coongro/kit-veterinary": minor
---

El dashboard ahora calcula los ingresos (KPI "Ingresos Hoy", gráfico de 7 días y "Servicios más frecuentes") desde el módulo de cobros (@coongro/billing) cuando está instalado. Esto incluye las ventas de mostrador —como vacunas aplicadas fuera de una consulta— que antes eran invisibles al sumar solo los servicios de consultas. Si billing no está instalado, el dashboard sigue calculando desde los servicios de consultas (dependencia blanda).
