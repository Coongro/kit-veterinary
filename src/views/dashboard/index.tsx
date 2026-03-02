import { CreateConsultationButton } from '@coongro/consultations';
import { CreatePetButton } from '@coongro/patients';
import {
  getHostReact,
  getHostUI,
  usePlugin,
  useViewContributions,
  actions,
} from '@coongro/plugin-sdk';

const React = getHostReact();
const UI = getHostUI();
const { useState, useEffect, useMemo } = React;
const h = React.createElement;

// --- Tipos ---

interface Consultation {
  id: string;
  pet_id: string;
  vet_name: string;
  date: string;
  reason: string;
  reason_category?: string;
  diagnosis?: string;
  follow_up_date?: string;
  follow_up_notes?: string;
  created_at: string;
}

interface ConsultationService {
  id: string;
  consultation_id: string;
  product_name: string;
  quantity: string;
  unit_price: string;
  subtotal: string;
  created_at: string;
}

interface Pet {
  id: string;
  name: string;
  species: string;
  breed?: string;
}

interface Contact {
  id: string;
  name: string;
  created_at: string;
}

// --- Helpers de fecha ---

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysFromNow(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function monthStartStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function prevMonthRange(): { start: string; end: string } {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  const start = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  return { start, end: monthStartStr() };
}

function dateKey(iso: string): string {
  return iso.slice(0, 10);
}

function formatDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
}

function formatDateLong(iso: string): string {
  return new Date(iso).toLocaleDateString('es-AR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

function formatCurrency(value: number): string {
  return value.toLocaleString('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function dayLabel(daysAgo: number, dateStr: string): string {
  if (daysAgo === 0) return 'Hoy';
  if (daysAgo === 1) return 'Ayer';
  return formatDateShort(dateStr);
}

// --- Cómputos ---

function trendIndicator(current: number, previous: number): { text: string; color: string } {
  if (previous === 0 && current === 0) return { text: '', color: 'var(--cg-text-muted)' };
  if (previous === 0) return { text: `+${current}`, color: 'var(--cg-success-text, #16a34a)' };

  const diff = current - previous;

  if (diff === 0) return { text: '=', color: 'var(--cg-text-muted)' };
  if (diff > 0) return { text: `+${diff}`, color: 'var(--cg-success-text, #16a34a)' };
  return { text: String(diff), color: 'var(--cg-error-text, #dc2626)' };
}

/** Calcula ingresos por consulta para un rango de IDs */
function sumRevenueForIds(consultationIds: Set<string>, services: ConsultationService[]): number {
  return services
    .filter((s) => consultationIds.has(s.consultation_id))
    .reduce((sum, s) => sum + Number(s.subtotal || 0), 0);
}

function computeRevenueLast7Days(
  consultations: Consultation[],
  services: ConsultationService[]
): Array<{ date: string; label: string; revenue: number }> {
  const consDateMap = new Map<string, string>();
  for (const c of consultations) consDateMap.set(c.id, dateKey(c.date));

  const result: Array<{ date: string; label: string; revenue: number }> = [];
  for (let i = 6; i >= 0; i--) {
    const day = daysFromNow(-i);
    const dayConsIds = new Set<string>();
    for (const [id, d] of consDateMap) {
      if (d === day) dayConsIds.add(id);
    }
    const revenue = sumRevenueForIds(dayConsIds, services);
    result.push({ date: day, label: dayLabel(i, day), revenue });
  }
  return result;
}

function computeTopServices(
  services: ConsultationService[]
): Array<{ name: string; count: number; revenue: number }> {
  const map = new Map<string, { count: number; revenue: number }>();
  for (const s of services) {
    const cur = map.get(s.product_name) ?? { count: 0, revenue: 0 };
    cur.count += Number(s.quantity || 1);
    cur.revenue += Number(s.subtotal || 0);
    map.set(s.product_name, cur);
  }
  return Array.from(map.entries())
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);
}

// --- Helpers de render ---

function trendFooter(trend: { text: string; color: string }, label: string): React.ReactNode {
  return h('span', { style: { color: trend.color } }, trend.text, ` ${label}`);
}

// --- Componente principal ---

export function DashboardView(): React.ReactNode {
  const { views } = usePlugin();
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [services, setServices] = useState<ConsultationService[]>([]);
  const [pets, setPets] = useState<Pet[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const { sections: contributedSections } = useViewContributions('kit-veterinary.dashboard.open', {
    today: todayStr(),
  });

  // Patrón correcto para React 18 StrictMode: variable local por efecto
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const [cons, svcs, petList, contactList] = await Promise.all([
          actions.execute<Consultation[]>('consultations.records.list'),
          actions.execute<ConsultationService[]>('consultations.services.list'),
          actions.execute<Pet[]>('patients.pets.list'),
          actions.execute<Contact[]>('contacts.list'),
        ]);
        if (!cancelled) {
          setConsultations(Array.isArray(cons) ? cons : []);
          setServices(Array.isArray(svcs) ? svcs : []);
          setPets(Array.isArray(petList) ? petList : []);
          setContacts(Array.isArray(contactList) ? contactList : []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Error cargando datos');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [retryCount]);

  // --- Datos derivados ---

  const today = todayStr();

  const petMap = useMemo(() => {
    const map = new Map<string, Pet>();
    for (const p of pets) map.set(p.id, p);
    return map;
  }, [pets]);

  const todayConsultations = useMemo(
    () =>
      consultations
        .filter((c) => dateKey(c.date) === today)
        .sort((a, b) => a.date.localeCompare(b.date)),
    [consultations, today]
  );

  const lastWeekSameDayCount = useMemo(
    () => consultations.filter((c) => dateKey(c.date) === daysFromNow(-7)).length,
    [consultations]
  );

  const revenueToday = useMemo(() => {
    const ids = new Set(todayConsultations.map((c) => c.id));
    return sumRevenueForIds(ids, services);
  }, [todayConsultations, services]);

  const revenueYesterday = useMemo(() => {
    const yesterday = daysFromNow(-1);
    const ids = new Set(
      consultations.filter((c) => dateKey(c.date) === yesterday).map((c) => c.id)
    );
    return sumRevenueForIds(ids, services);
  }, [consultations, services]);

  const activePatients = useMemo(() => {
    const yearAgo = daysFromNow(-365);
    const ids = new Set(
      consultations.filter((c) => dateKey(c.date) >= yearAgo).map((c) => c.pet_id)
    );
    return ids.size;
  }, [consultations]);

  const newClientsMonth = useMemo(
    () => contacts.filter((c) => dateKey(c.created_at) >= monthStartStr()).length,
    [contacts]
  );

  const newClientsLastMonth = useMemo(() => {
    const { start, end } = prevMonthRange();
    return contacts.filter((c) => {
      const d = dateKey(c.created_at);
      return d >= start && d < end;
    }).length;
  }, [contacts]);

  const revenueDays = useMemo(
    () => computeRevenueLast7Days(consultations, services),
    [consultations, services]
  );

  const topServices = useMemo(() => computeTopServices(services), [services]);

  const followUps = useMemo(() => {
    const twoWeeksAhead = daysFromNow(14);
    return consultations
      .filter(
        (c) => c.follow_up_date && c.follow_up_date >= today && c.follow_up_date <= twoWeeksAhead
      )
      .sort((a, b) => (a.follow_up_date ?? '').localeCompare(b.follow_up_date ?? ''))
      .slice(0, 5);
  }, [consultations, today]);

  // --- Estados de error y carga ---

  if (error) {
    return h(UI.ErrorDisplay, {
      title: 'Error',
      message: error,
      onRetry: () => setRetryCount((c) => c + 1),
    });
  }

  if (loading) return h(UI.LoadingOverlay, { variant: 'spinner' });

  // --- Tendencias ---

  const consultationTrend = trendIndicator(todayConsultations.length, lastWeekSameDayCount);
  const revenueTrend = trendIndicator(revenueToday, revenueYesterday);
  const clientTrend = trendIndicator(newClientsMonth, newClientsLastMonth);
  const maxRevenue = Math.max(...revenueDays.map((d) => d.revenue), 1);
  const maxServiceRevenue = topServices.length > 0 ? topServices[0].revenue : 1;

  // --- Render ---

  return h(
    'div',
    {
      style: {
        padding: '24px',
        minHeight: '100vh',
        backgroundColor: 'var(--cg-bg-secondary)',
        fontFamily: 'var(--cg-font-sans, Inter, system-ui, sans-serif)',
      },
    },

    // Encabezado
    h(
      'header',
      {
        style: {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '24px',
        },
      },
      h(
        'div',
        null,
        h(
          'h1',
          { style: { fontSize: '24px', fontWeight: '700', color: 'var(--cg-text)', margin: 0 } },
          'Dashboard'
        ),
        h(
          'p',
          { style: { fontSize: '13px', color: 'var(--cg-text-muted)', marginTop: '2px' } },
          formatDateLong(new Date().toISOString())
        )
      ),
      h(
        'div',
        { style: { display: 'flex', gap: '8px' } },
        h(CreateConsultationButton, {
          label: 'Nueva Consulta',
          onSuccess: (c) => views.open('consultations.detail.open', { consultationId: c.id }),
        }),
        h(CreatePetButton, {
          label: 'Registrar Paciente',
          variant: 'outline',
          onSuccess: (pet) => views.open('patients.detail.open', { petId: pet.id }),
        })
      )
    ),

    // Tarjetas KPI
    h(
      'div',
      {
        style: {
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
          marginBottom: '24px',
        },
      },
      h(UI.StatCard, {
        label: 'Consultas Hoy',
        value: todayConsultations.length,
        footer: trendFooter(consultationTrend, 'vs mismo día sem. pasada'),
      }),
      h(UI.StatCard, {
        label: 'Ingresos Hoy',
        value: formatCurrency(revenueToday),
        footer: trendFooter(revenueTrend, 'vs ayer'),
      }),
      h(UI.StatCard, {
        label: 'Pacientes Activos',
        value: activePatients,
        footer: `de ${pets.length} totales (últ. 12 meses)`,
      }),
      h(UI.StatCard, {
        label: 'Clientes Nuevos',
        value: newClientsMonth,
        footer: trendFooter(clientTrend, 'este mes vs anterior'),
      })
    ),

    // Consultas de Hoy + Seguimientos
    h(
      'div',
      {
        style: {
          display: 'grid',
          gridTemplateColumns: '2fr 1fr',
          gap: '16px',
          marginBottom: '24px',
        },
      },
      renderTodayConsultations(todayConsultations, petMap, views),
      renderFollowUps(followUps, petMap, today, views)
    ),

    // Gráficos: Ingresos 7 días + Servicios Top
    h(
      'div',
      {
        style: {
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '16px',
          marginBottom: '24px',
        },
      },
      renderRevenueChart(revenueDays, maxRevenue),
      renderTopServices(topServices, maxServiceRevenue)
    ),

    // Secciones contribuidas por add-ons
    ...contributedSections.map((s, i) =>
      h(
        'div',
        { key: `contrib-${String(i)}`, style: { marginBottom: '16px' } },
        s.render() as React.ReactNode
      )
    )
  );
}

// --- Sub-componentes de render ---

function renderTodayConsultations(
  todayConsultations: Consultation[],
  petMap: Map<string, Pet>,
  views: ReturnType<typeof usePlugin>['views']
): React.ReactNode {
  return h(
    UI.Card,
    null,
    h(UI.CardHeader, null, h(UI.CardTitle, null, 'Consultas de Hoy')),
    h(
      UI.CardBody,
      null,
      todayConsultations.length === 0
        ? h(UI.EmptyState, { title: 'Sin consultas hoy' })
        : h(
            UI.Table,
            null,
            h(
              UI.TableHeader,
              null,
              h(
                UI.TableRow,
                null,
                h(UI.TableHead, null, 'Hora'),
                h(UI.TableHead, null, 'Paciente'),
                h(UI.TableHead, null, 'Especie'),
                h(UI.TableHead, null, 'Motivo'),
                h(UI.TableHead, null, 'Veterinario')
              )
            ),
            h(
              UI.TableBody,
              null,
              ...todayConsultations.map((c) => {
                const pet = petMap.get(c.pet_id);
                return h(
                  UI.TableRow,
                  {
                    key: c.id,
                    onClick: () =>
                      views.open('consultations.detail.open', { consultationId: c.id }),
                    style: { cursor: 'pointer' },
                  },
                  h(
                    UI.TableCell,
                    null,
                    new Date(c.date).toLocaleTimeString('es-AR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  ),
                  h(UI.TableCell, { style: { fontWeight: '500' } }, pet?.name ?? '\u2014'),
                  h(
                    UI.TableCell,
                    null,
                    pet ? h(UI.Badge, { variant: 'secondary', size: 'sm' }, pet.species) : '\u2014'
                  ),
                  h(UI.TableCell, null, c.reason),
                  h(UI.TableCell, { style: { color: 'var(--cg-text-muted)' } }, c.vet_name)
                );
              })
            )
          )
    )
  );
}

function renderFollowUps(
  followUps: Consultation[],
  petMap: Map<string, Pet>,
  today: string,
  views: ReturnType<typeof usePlugin>['views']
): React.ReactNode {
  return h(
    UI.Card,
    null,
    h(UI.CardHeader, null, h(UI.CardTitle, null, 'Seguimientos Pendientes')),
    h(
      UI.CardBody,
      null,
      followUps.length === 0
        ? h(UI.EmptyState, { title: 'Sin seguimientos próximos' })
        : h(
            'div',
            { className: 'flex flex-col gap-2' },
            ...followUps.map((c) => renderFollowUpItem(c, petMap, today, views))
          )
    )
  );
}

function renderFollowUpItem(
  c: Consultation,
  petMap: Map<string, Pet>,
  today: string,
  views: ReturnType<typeof usePlugin>['views']
): React.ReactNode {
  const pet = petMap.get(c.pet_id);
  const isToday = c.follow_up_date === today;

  return h(
    'div',
    {
      key: c.id,
      onClick: () => views.open('consultations.detail.open', { consultationId: c.id }),
      style: {
        padding: '10px 12px',
        borderRadius: '8px',
        border: isToday
          ? '1px solid var(--cg-warning-border, #f59e0b)'
          : '1px solid var(--cg-border)',
        backgroundColor: isToday ? 'var(--cg-warning-bg, rgba(245,158,11,0.08))' : 'var(--cg-bg)',
        cursor: 'pointer',
      },
    },
    h(
      'div',
      {
        style: {
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        },
      },
      h(
        'span',
        { style: { fontWeight: '500', fontSize: '13px', color: 'var(--cg-text)' } },
        pet?.name ?? 'Paciente'
      ),
      h(
        'span',
        {
          style: {
            fontSize: '12px',
            color: isToday ? 'var(--cg-warning-text, #b45309)' : 'var(--cg-text-muted)',
            fontWeight: isToday ? '600' : '400',
          },
        },
        isToday ? 'HOY' : formatDateShort(c.follow_up_date ?? '')
      )
    ),
    c.follow_up_notes
      ? h(
          'p',
          {
            style: {
              fontSize: '12px',
              color: 'var(--cg-text-muted)',
              marginTop: '4px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap' as const,
            },
          },
          c.follow_up_notes
        )
      : null
  );
}

function renderRevenueChart(
  revenueDays: Array<{ date: string; label: string; revenue: number }>,
  maxRevenue: number
): React.ReactNode {
  return h(
    UI.Card,
    null,
    h(UI.CardHeader, null, h(UI.CardTitle, null, 'Ingresos \u2014 \u00DAltimos 7 d\u00EDas')),
    h(
      UI.CardBody,
      null,
      h(
        'div',
        { className: 'flex flex-col gap-2' },
        ...revenueDays.map((d) =>
          h(
            'div',
            { key: d.date, className: 'flex items-center gap-2' },
            h(
              'span',
              { className: 'w-12 shrink-0 text-right text-xs text-cg-text-muted' },
              d.label
            ),
            h(UI.ProgressBar, {
              value: d.revenue,
              max: maxRevenue,
              size: 'lg',
              className: 'flex-1',
            }),
            h(
              'span',
              { className: 'w-20 shrink-0 text-right text-xs font-medium text-cg-text' },
              formatCurrency(d.revenue)
            )
          )
        )
      )
    )
  );
}

function renderTopServices(
  topServices: Array<{ name: string; count: number; revenue: number }>,
  maxServiceRevenue: number
): React.ReactNode {
  return h(
    UI.Card,
    null,
    h(UI.CardHeader, null, h(UI.CardTitle, null, 'Servicios M\u00E1s Frecuentes')),
    h(
      UI.CardBody,
      null,
      topServices.length === 0
        ? h(UI.EmptyState, { title: 'Sin servicios registrados' })
        : h(
            'div',
            { className: 'flex flex-col gap-2.5' },
            ...topServices.map((s, i) =>
              h(
                'div',
                { key: s.name, className: 'flex flex-col gap-1' },
                h(
                  'div',
                  { className: 'flex items-center justify-between' },
                  h(
                    'span',
                    { className: 'text-[13px] font-medium text-cg-text' },
                    `${i + 1}. ${s.name}`
                  ),
                  h(
                    'span',
                    { className: 'text-xs text-cg-text-muted' },
                    `${s.count}\u00D7 \u00B7 ${formatCurrency(s.revenue)}`
                  )
                ),
                h(UI.ProgressBar, { value: s.revenue, max: maxServiceRevenue, size: 'sm' })
              )
            )
          )
    )
  );
}
