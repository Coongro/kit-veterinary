import { DatePicker } from '@coongro/calendar';
import { SPECIES_ICON } from '@coongro/patients';
import { getHostReact, actions } from '@coongro/plugin-sdk';
import { BatchesView } from '@coongro/products';
import type { BatchClassifier, BatchRefInfo } from '@coongro/products';

const React = getHostReact();
const { useState, useEffect, useCallback } = React;
const h = React.createElement;

/**
 * Vista "Lotes" del kit veterinario (sección Inventario). Compone la BatchesView
 * genérica de products inyectándole lo que products no puede saber:
 *  - clasificadores de tipo (vacuna/medicamento) → qué product_ids son de cada uno.
 *  - resolvers de dominio para la trazabilidad del detalle de lote: nombre del
 *    proveedor (origen) y a qué paciente fue cada aplicación (consumos).
 * Las dependencias son blandas (string-based): si un plugin no está, el resolver
 * cae a un label genérico y la vista igual funciona.
 */
const CLASSIFIERS: BatchClassifier[] = [
  {
    kind: 'vaccine',
    label: 'Vacunas',
    icon: 'Syringe',
    color: '#0f766e',
    listProductIds: async () => {
      const details = await actions.execute<Array<{ product_id: string }>>(
        'vaccination.catalog.list'
      );
      return (details ?? []).map((d) => d.product_id);
    },
  },
  {
    kind: 'medication',
    label: 'Medicamentos',
    icon: 'Pill',
    color: '#2563eb',
    listProductIds: async () => {
      const meds = await actions.execute<Array<{ product_id: string }>>(
        'vet-pharmacy.medications.list'
      );
      return (meds ?? []).map((m) => m.product_id);
    },
  },
];

export function LotesView(props: { productId?: string } = {}) {
  // Mapas para resolver la trazabilidad del lote en el detalle.
  const [supplierName, setSupplierName] = useState<Map<string, string>>(new Map());
  // appliedId → paciente (nombre + especie, para el icono según el tipo de animal).
  const [appliedPatient, setAppliedPatient] = useState<
    Map<string, { name: string; species: string }>
  >(new Map());
  // product_id → laboratorio (subtítulo del lote en el detalle).
  const [productLab, setProductLab] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    let active = true;
    void (async () => {
      // Proveedores (origen del lote). purchases es opcional.
      try {
        const suppliers = await actions.execute<Array<{ id: string; name: string }>>(
          'purchases.suppliers.list'
        );
        if (active) setSupplierName(new Map((suppliers ?? []).map((s) => [s.id, s.name])));
      } catch {
        /* purchases no instalado */
      }
      // Aplicaciones de vacuna → paciente, para humanizar los consumos del lote.
      try {
        const [applied, pets] = await Promise.all([
          actions.execute<Array<{ id: string; patient_id: string }>>('vaccination.applied.list'),
          actions.execute<Array<{ id: string; name: string; species: string }>>(
            'patients.pets.list'
          ),
        ]);
        const petById = new Map((pets ?? []).map((p) => [p.id, p]));
        const map = new Map<string, { name: string; species: string }>();
        for (const a of applied ?? []) {
          const pet = petById.get(a.patient_id);
          map.set(a.id, { name: pet?.name ?? 'Paciente', species: pet?.species ?? '' });
        }
        if (active) setAppliedPatient(map);
      } catch {
        /* vaccination/patients no disponibles */
      }
      // Laboratorio por producto (subtítulo del lote): catálogo de vacunas + maestro de labs.
      try {
        const [details, labs] = await Promise.all([
          actions.execute<Array<{ product_id: string; laboratory_id: string }>>(
            'vaccination.catalog.list'
          ),
          actions.execute<Array<{ id: string; name: string }>>('vademecum.laboratories.list'),
        ]);
        const labById = new Map((labs ?? []).map((l) => [l.id, l.name]));
        const map = new Map<string, string>();
        for (const d of details ?? []) {
          const labName = labById.get(d.laboratory_id);
          if (labName) map.set(d.product_id, labName);
        }
        if (active) setProductLab(map);
      } catch {
        /* vaccination/vademecum no disponibles */
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const resolveSupplier = useCallback((id: string) => supplierName.get(id), [supplierName]);

  const resolveProductSubtitle = useCallback(
    (productId: string) => productLab.get(productId),
    [productLab]
  );

  // El origen del lote (cuando vino de una compra) lleva a esa Salida en purchases.
  const resolveOriginLink = useCallback(
    (meta: { sourceType?: string; sourceAccountId?: string }) =>
      meta.sourceType === 'salida' && meta.sourceAccountId
        ? {
            label: 'Ver salida',
            viewId: 'purchases.salidas.open',
            params: { accountId: meta.sourceAccountId },
          }
        : undefined,
    []
  );

  const resolveReference = useCallback(
    (type: string | null, id: string | null): BatchRefInfo => {
      switch (type) {
        case 'vaccination_application': {
          const pet = id ? appliedPatient.get(id) : undefined;
          return {
            label: `Aplicado a ${pet?.name ?? 'paciente'}`,
            // Icono según el tipo de animal, reutilizando el mapeo de la config de pacientes.
            icon: (pet?.species && SPECIES_ICON[pet.species]) || 'PawPrint',
            // Clickeable → lleva a las aplicaciones de ese paciente.
            nav: pet?.name
              ? { viewId: 'vaccination.aplicadas.open', params: { patientName: pet.name } }
              : undefined,
          };
        }
        case 'consultation_medication':
          return { label: 'Medicamento en consulta', icon: 'Pill' };
        case 'prescription':
          return { label: 'Dispensación (receta)', icon: 'FileText' };
        case 'batch_in':
          return { label: 'Ingreso de stock', icon: 'ArrowDownToLine' };
        default:
          return { label: type ?? 'Movimiento', icon: 'ArrowDownRight' };
      }
    },
    [appliedPatient]
  );

  return h(BatchesView, {
    classifiers: CLASSIFIERS,
    title: 'Lotes y stock',
    subtitle:
      'El stock real por lote de todo lo perecedero — vacunas y medicamentos en un mismo inventario. El catálogo define qué se maneja; acá se abastece y se controla el vencimiento.',
    resolveSupplier,
    resolveReference,
    resolveProductSubtitle,
    resolveOriginLink,
    // DatePicker de Coongro (calendar) para el form de alta/edición de lote.
    DateField: DatePicker,
    // Deep-link desde la ficha del catálogo ("Gestionar en Lotes y stock").
    productFilterParam: props.productId,
  });
}
