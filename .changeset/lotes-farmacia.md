---
'@coongro/kit-veterinary': minor
---

feat: vista unificada de Lotes en Farmacia (medicamentos + vacunas) (COONG-220)

Nueva vista "Farmacia → Lotes" que compone la `BatchesView` genérica de `@coongro/products`, inyectando los clasificadores de tipo del kit: vacunas (vía `vaccination.catalog.list`) y medicamentos (vía `vet-pharmacy.medications.list`). Una sola tabla de lotes para todo lo loteable, con filtro por tipo y vencimiento, en lugar de la antigua vista siloada bajo Vacunación. Las dependencias hacia vaccination/vet-pharmacy son blandas: si un plugin no está instalado, su tipo simplemente no aparece.
