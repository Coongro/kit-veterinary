---
'@coongro/kit-veterinary': patch
---

fix(dashboard): "Servicios Más Frecuentes" excluye las salidas (COONG-249)

Las cuentas por pagar del ledger (pagos a proveedores, retiros) aparecían como servicios facturados en el top del dashboard. Ahora se pide `billing.lines.listInRange` con `direction: 'receivable'` y se filtra defensivamente `account_direction` del lado cliente para versiones viejas de billing que ignoran el parámetro.
