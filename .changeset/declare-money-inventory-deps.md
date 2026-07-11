---
'@coongro/kit-veterinary': minor
---

feat: instalar billing, purchases y vet-pharmacy con el kit

El dashboard consume `billing.*` y la vista de lotes consume `purchases.*` y
`vet-pharmacy.*` por RPC. Declararlos como deps los instala transitivamente en el
tenant, con lo que aparecen sus menus (Caja/Cobros, Salidas/Proveedores, Farmacia) y
los RPCs dejan de degradar en silencio.
