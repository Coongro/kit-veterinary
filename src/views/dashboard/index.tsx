import {
  type Appointment,
  useTodayAppointments,
  toCalendarEvents,
  buildAppointmentMap,
  STATUS_LABELS,
  STATUS_BADGE_STYLES,
  STATUS_DOT_STYLES,
} from '@coongro/appointments';
import {
  EventCard,
  toDateString,
  formatEventDate,
  formatEventTime,
  getMonthStart,
  useTenantTimezone,
} from '@coongro/calendar';
import { CreateConsultationButton } from '@coongro/consultations';
import { addDays, toDateKey, utcToLocal, type DateKey, type UTCTimestamp } from '@coongro/datetime';
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

/** Hook para detectar si el viewport es mobile (<768px) */
function useIsMobile(breakpoint = 768): boolean {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < breakpoint);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < breakpoint);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, [breakpoint]);
  return isMobile;
}

// --- Tipos ---

interface Consultation {
  id: string;
  pet_id: string;
  vet_name: string;
  date: UTCTimestamp;
  reason: string;
  diagnosis?: string;
  created_at: UTCTimestamp;
}

interface ConsultationService {
  id: string;
  consultation_id: string;
  product_name: string;
  quantity: string;
  unit_price: string;
  subtotal: string;
  created_at: UTCTimestamp;
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
  created_at: UTCTimestamp;
}

/** Cuenta de cobro (billing) con su total derivado. `opened_at` = fecha de negocio (ISO). */
interface BillingAccount {
  total: string;
  opened_at: string;
  status: string;
  source: string;
}

/** Línea de cobro (billing) con la fecha/origen de su cuenta, para agregados por período. */
interface BillingLine {
  description: string;
  quantity: string;
  subtotal: string;
  source_type: string;
  account_source: string;
  opened_at: string;
}

// --- Helpers de fecha (basados en @coongro/calendar) ---

function todayStr(tz: string): DateKey {
  return toDateKey(new Date(), tz);
}

function daysFromNow(n: number, tz: string): DateKey {
  return addDays(todayStr(tz), n);
}

function monthStartStr(tz: string): string {
  const now = utcToLocal(new Date(), tz);
  return toDateString(getMonthStart(now.year, now.month - 1));
}

function prevMonthRange(tz: string): { start: string; end: string } {
  const now = utcToLocal(new Date(), tz);
  const prevMonth = now.month === 1 ? 12 : now.month - 1;
  const prevYear = now.month === 1 ? now.year - 1 : now.year;
  return {
    start: toDateString(getMonthStart(prevYear, prevMonth - 1)),
    end: monthStartStr(tz),
  };
}

/** Día local del tenant para un `UTCTimestamp`. */
function dateKey(value: UTCTimestamp, tz: string): DateKey {
  return toDateKey(value, tz);
}

function formatCurrency(value: number): string {
  return value.toLocaleString('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function dayLabel(daysAgo: number, dateStr: string, tz: string): string {
  if (daysAgo === 0) return 'Hoy';
  if (daysAgo === 1) return 'Ayer';
  return formatEventDate(dateStr, tz);
}

// --- Cómputos ---

function trendIndicator(
  current: number,
  previous: number,
  // Formateador del delta. Por defecto `String` (conteos crudos); para KPIs de plata se
  // pasa `formatCurrency` para que el comparativo salga como moneda y no como número pelado.
  format: (value: number) => string = String
): { text: string; color: string } {
  if (previous === 0 && current === 0) return { text: '', color: 'var(--cg-text-muted)' };
  if (previous === 0)
    return { text: `+${format(current)}`, color: 'var(--cg-success-text, #16a34a)' };

  const diff = current - previous;

  if (diff === 0) return { text: '=', color: 'var(--cg-text-muted)' };
  if (diff > 0) return { text: `+${format(diff)}`, color: 'var(--cg-success-text, #16a34a)' };
  return { text: format(diff), color: 'var(--cg-error-text, #dc2626)' };
}

/** Calcula ingresos por consulta para un rango de IDs */
function sumRevenueForIds(consultationIds: Set<string>, services: ConsultationService[]): number {
  return services
    .filter((s) => consultationIds.has(s.consultation_id))
    .reduce((sum, s) => sum + Number(s.subtotal || 0), 0);
}

function computeRevenueLast7Days(
  consultations: Consultation[],
  services: ConsultationService[],
  tz: string
): Array<{ date: string; label: string; revenue: number }> {
  const consDateMap = new Map<string, string>();
  for (const c of consultations) consDateMap.set(c.id, dateKey(c.date, tz));

  const result: Array<{ date: string; label: string; revenue: number }> = [];
  for (let i = 6; i >= 0; i--) {
    const day = daysFromNow(-i, tz);
    const dayConsIds = new Set<string>();
    for (const [id, d] of consDateMap) {
      if (d === day) dayConsIds.add(id);
    }
    const revenue = sumRevenueForIds(dayConsIds, services);
    result.push({ date: day, label: dayLabel(i, day, tz), revenue });
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

// --- Cómputos desde billing (cuando el módulo de cobros está instalado) ---
// El KPI de ingresos pasa a salir de las CUENTAS de cobro: incluye consultas Y ventas de
// mostrador (vacunas sueltas), que antes eran invisibles al sumar solo consultation_services.

/** Ingresos por día local del tenant, a partir de las cuentas de billing (clave = opened_at). */
function billingRevenueByDay(accounts: BillingAccount[], tz: string): Map<string, number> {
  const map = new Map<string, number>();
  for (const a of accounts) {
    const key = dateKey(a.opened_at as UTCTimestamp, tz);
    map.set(key, (map.get(key) ?? 0) + Number(a.total || 0));
  }
  return map;
}

/** Ítems más cobrados (servicios + vacunas + productos) a partir de las líneas de billing. */
function computeTopItemsFromBilling(
  lines: BillingLine[]
): Array<{ name: string; count: number; revenue: number }> {
  const map = new Map<string, { count: number; revenue: number }>();
  for (const l of lines) {
    const cur = map.get(l.description) ?? { count: 0, revenue: 0 };
    cur.count += Number(l.quantity || 1);
    cur.revenue += Number(l.subtotal || 0);
    map.set(l.description, cur);
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
  const isMobile = useIsMobile();
  const tz = useTenantTimezone();
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [services, setServices] = useState<ConsultationService[]>([]);
  const [pets, setPets] = useState<Pet[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [billingAccounts, setBillingAccounts] = useState<BillingAccount[]>([]);
  const [billingLines, setBillingLines] = useState<BillingLine[]>([]);
  const [billingOn, setBillingOn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const { data: todayAppointments, loading: appointmentsLoading } = useTodayAppointments();

  const { sections: contributedSections } = useViewContributions('kit-veterinary.dashboard.open', {
    today: todayStr(tz),
  });

  // Patrón correcto para React 18 StrictMode: variable local por efecto
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setLoading(true);
      setError(null);
      try {
        // Resiliencia: allSettled para que cada fuente degrade independiente. Si un plugin
        // (consultations/patients/contacts) está caído o no instalado, el dashboard igual
        // renderiza con lo que sí cargó, en vez de tirar TODO a la pantalla de error.
        // (Antes: Promise.all — un solo fallo rompía el dashboard entero.)
        const [consR, svcsR, petListR, contactListR] = await Promise.allSettled([
          actions.execute<Consultation[]>('consultations.records.list'),
          actions.execute<ConsultationService[]>('consultations.services.list'),
          actions.execute<Pet[]>('patients.pets.list'),
          actions.execute<Contact[]>('contacts.list'),
        ]);
        if (!cancelled) {
          setConsultations(
            consR.status === 'fulfilled' && Array.isArray(consR.value) ? consR.value : []
          );
          setServices(
            svcsR.status === 'fulfilled' && Array.isArray(svcsR.value) ? svcsR.value : []
          );
          setPets(
            petListR.status === 'fulfilled' && Array.isArray(petListR.value) ? petListR.value : []
          );
          setContacts(
            contactListR.status === 'fulfilled' && Array.isArray(contactListR.value)
              ? contactListR.value
              : []
          );
        }
        // Cobros (billing): fuente de ingresos si el plugin está instalado. Dependencia
        // blanda — si no está, el dashboard sigue calculando desde consultation_services.
        try {
          const [accts, lines] = await Promise.all([
            actions.execute<BillingAccount[]>('billing.accounts.listWithTotals'),
            actions.execute<BillingLine[]>('billing.lines.listInRange'),
          ]);
          if (!cancelled) {
            setBillingAccounts(Array.isArray(accts) ? accts : []);
            setBillingLines(Array.isArray(lines) ? lines : []);
            setBillingOn(true);
          }
        } catch {
          if (!cancelled) setBillingOn(false);
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

  const today = todayStr(tz);

  const petMap = useMemo(() => {
    const map = new Map<string, Pet>();
    for (const p of pets) map.set(p.id, p);
    return map;
  }, [pets]);

  const todayConsultations = useMemo(
    () =>
      consultations
        .filter((c) => dateKey(c.date, tz) === today)
        .sort((a, b) => a.date.localeCompare(b.date)),
    [consultations, today, tz]
  );

  const lastWeekSameDayCount = useMemo(
    () => consultations.filter((c) => dateKey(c.date, tz) === daysFromNow(-7, tz)).length,
    [consultations, tz]
  );

  // Mapa fecha→ingresos desde billing (null si el módulo de cobros no está instalado).
  const billingRevByDay = useMemo(
    () => (billingOn ? billingRevenueByDay(billingAccounts, tz) : null),
    [billingOn, billingAccounts, tz]
  );

  const revenueToday = useMemo(() => {
    if (billingRevByDay) return billingRevByDay.get(today) ?? 0;
    const ids = new Set(todayConsultations.map((c) => c.id));
    return sumRevenueForIds(ids, services);
  }, [billingRevByDay, today, todayConsultations, services]);

  const revenueYesterday = useMemo(() => {
    const yesterday = daysFromNow(-1, tz);
    if (billingRevByDay) return billingRevByDay.get(yesterday) ?? 0;
    const ids = new Set(
      consultations.filter((c) => dateKey(c.date, tz) === yesterday).map((c) => c.id)
    );
    return sumRevenueForIds(ids, services);
  }, [billingRevByDay, consultations, services, tz]);

  const activePatients = useMemo(() => {
    const yearAgo = daysFromNow(-365, tz);
    const ids = new Set(
      consultations.filter((c) => dateKey(c.date, tz) >= yearAgo).map((c) => c.pet_id)
    );
    return ids.size;
  }, [consultations, tz]);

  const newClientsMonth = useMemo(
    () => contacts.filter((c) => dateKey(c.created_at, tz) >= monthStartStr(tz)).length,
    [contacts, tz]
  );

  const newClientsLastMonth = useMemo(() => {
    const { start, end } = prevMonthRange(tz);
    return contacts.filter((c) => {
      const d = dateKey(c.created_at, tz);
      return d >= start && d < end;
    }).length;
  }, [contacts, tz]);

  const revenueDays = useMemo(() => {
    if (billingRevByDay) {
      const result: Array<{ date: string; label: string; revenue: number }> = [];
      for (let i = 6; i >= 0; i--) {
        const day = daysFromNow(-i, tz);
        result.push({
          date: day,
          label: dayLabel(i, day, tz),
          revenue: billingRevByDay.get(day) ?? 0,
        });
      }
      return result;
    }
    return computeRevenueLast7Days(consultations, services, tz);
  }, [billingRevByDay, consultations, services, tz]);

  const topServices = useMemo(
    () =>
      (billingOn ? computeTopItemsFromBilling(billingLines) : computeTopServices(services))
        // "Más facturados": ítems sin facturación (revenue 0, ej. "Eutanasia $0") no aportan, se ocultan.
        .filter((s) => s.revenue > 0),
    [billingOn, billingLines, services]
  );

  const pendingAppointments = useMemo(
    () =>
      todayAppointments
        .filter((a) => a.status === 'scheduled')
        .sort((a, b) => (a.event_start_at ?? '').localeCompare(b.event_start_at ?? '')),
    [todayAppointments]
  );

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
  const revenueTrend = trendIndicator(revenueToday, revenueYesterday, formatCurrency);
  const clientTrend = trendIndicator(newClientsMonth, newClientsLastMonth);
  const maxRevenue = Math.max(...revenueDays.map((d) => d.revenue), 1);
  const maxServiceRevenue = topServices.length > 0 ? topServices[0].revenue : 1;

  // --- Render ---

  return h(
    'div',
    {
      style: {
        padding: isMobile ? '16px' : '24px',
        minHeight: '100vh',
        backgroundColor: 'var(--cg-bg-secondary)',
      },
    },

    // Encabezado
    h(
      'header',
      {
        style: {
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          alignItems: isMobile ? 'flex-start' : 'center',
          justifyContent: 'space-between',
          marginBottom: '24px',
          gap: '16px',
        },
      },
      h(
        'div',
        null,
        h(
          'h1',
          {
            style: {
              fontSize: isMobile ? '18px' : '22px',
              fontWeight: '700',
              color: 'var(--cg-text)',
              margin: 0,
              textTransform: 'capitalize',
            },
          },
          formatEventDate(new Date().toISOString(), tz)
        ),
        h(
          'p',
          { style: { fontSize: '13px', color: 'var(--cg-text-muted)', marginTop: '2px' } },
          (() => {
            const parts: string[] = [];
            if (todayConsultations.length > 0)
              parts.push(
                `${todayConsultations.length} consulta${todayConsultations.length > 1 ? 's' : ''} hoy`
              );
            if (pendingAppointments.length > 0) {
              const plural = pendingAppointments.length > 1;
              // Mismo vocabulario que los badges de estas tarjetas y la vista de Agenda:
              // STATUS_LABELS['scheduled'] ("Agendado"). Se pasa a minúscula y se pluraliza para
              // concordar con "turno(s)", en vez de hardcodear "pendiente" (que sugiere atraso y
              // daba dos nombres distintos al mismo estado en la misma pantalla).
              const statusWord = STATUS_LABELS.scheduled.toLowerCase() + (plural ? 's' : '');
              parts.push(`${pendingAppointments.length} turno${plural ? 's' : ''} ${statusWord}`);
            }
            return parts.join(' · ') || 'Sin actividad por el momento';
          })()
        )
      ),
      h(
        'div',
        { style: { display: 'flex', gap: '8px', flexShrink: 0 } },
        h(CreateConsultationButton, {
          label: 'Nueva Consulta',
          onSuccess: (c) => views.open('consultations.detail.open', { consultationId: c.id }),
        }),
        h(CreatePetButton, {
          label: 'Registrar Paciente',
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
          gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 2fr) minmax(0, 1fr)',
          gap: '16px',
          marginBottom: '24px',
        },
      },
      renderTodayConsultations(todayConsultations, petMap, views, tz, isMobile),
      renderTodayAppointments(todayAppointments, appointmentsLoading, views)
    ),

    // Gráficos: Ingresos 7 días + Servicios Top
    h(
      'div',
      {
        style: {
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1fr) minmax(0, 1fr)',
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
  views: ReturnType<typeof usePlugin>['views'],
  tz: string,
  isMobile = false
): React.ReactNode {
  return h(
    UI.Card,
    null,
    h(UI.CardHeader, null, h(UI.CardTitle, null, 'Consultas de Hoy')),
    h(
      UI.CardBody,
      null,
      todayConsultations.length === 0
        ? h(UI.EmptyState, {
            icon: h(UI.DynamicIcon, {
              icon: 'CalendarX2',
              size: 24,
              className: 'text-cg-text-muted',
            }),
            title: 'Sin consultas por ahora',
            description: 'Las consultas agendadas para hoy aparecerán aquí.',
            action: h(CreateConsultationButton, { label: 'Registrar consulta' }),
          })
        : h(
            'div',
            { style: { overflowX: 'auto' } },
            h(
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
                  !isMobile && h(UI.TableHead, null, 'Especie'),
                  h(UI.TableHead, null, 'Motivo'),
                  !isMobile && h(UI.TableHead, null, 'Veterinario')
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
                    h(UI.TableCell, null, formatEventTime(c.date, tz)),
                    h(UI.TableCell, { style: { fontWeight: '500' } }, pet?.name ?? '\u2014'),
                    !isMobile &&
                      h(
                        UI.TableCell,
                        null,
                        pet
                          ? h(UI.Badge, { variant: 'secondary', size: 'sm' }, pet.species)
                          : '\u2014'
                      ),
                    h(UI.TableCell, null, c.reason),
                    !isMobile &&
                      h(UI.TableCell, { style: { color: 'var(--cg-text-muted)' } }, c.vet_name)
                  );
                })
              )
            )
          )
    )
  );
}

function renderStatusBadge(status: Appointment['status']): React.ReactNode {
  return h(
    'span',
    {
      style: {
        fontSize: '11px',
        fontWeight: 600,
        padding: '2px 8px',
        borderRadius: '10px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        flexShrink: 0,
        ...STATUS_BADGE_STYLES[status],
      },
    },
    h('span', {
      style: {
        display: 'inline-block',
        width: '6px',
        height: '6px',
        borderRadius: '50%',
        ...STATUS_DOT_STYLES[status],
      },
    }),
    STATUS_LABELS[status]
  );
}

function renderTodayAppointments(
  appointments: Appointment[],
  loading: boolean,
  views: ReturnType<typeof usePlugin>['views']
): React.ReactNode {
  // Pendientes primero (por hora asc), luego el resto (por hora asc).
  const sorted = [...appointments].sort((a, b) => {
    const aPending = a.status === 'scheduled' ? 0 : 1;
    const bPending = b.status === 'scheduled' ? 0 : 1;
    if (aPending !== bPending) return aPending - bPending;
    return (a.event_start_at ?? '').localeCompare(b.event_start_at ?? '');
  });
  const apptMap = buildAppointmentMap(sorted);
  const events = toCalendarEvents(sorted);
  const openAgenda = () => views.open('appointments.agenda.open');

  return h(
    UI.Card,
    null,
    h(UI.CardHeader, null, h(UI.CardTitle, null, 'Agenda de Hoy')),
    h(
      UI.CardBody,
      null,
      loading
        ? h(UI.EmptyState, { title: 'Cargando turnos…' })
        : events.length === 0
          ? h(UI.EmptyState, {
              icon: h(UI.DynamicIcon, {
                icon: 'CalendarClock',
                size: 24,
                className: 'text-cg-text-muted',
              }),
              title: 'Sin turnos hoy',
              description: 'Los turnos agendados para hoy aparecerán aquí.',
              action: h(UI.Button, {
                variant: 'outline',
                onClick: openAgenda,
                children: 'Ver agenda',
              }),
            })
          : h(
              'div',
              {
                className: 'cg-scrollable',
                style: {
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px',
                  maxHeight: '198px', // ~3 items visibles
                  overflowY: 'scroll' as const, // siempre muestra el track
                  scrollbarGutter: 'stable' as const,
                  paddingRight: '4px',
                },
              },
              ...events.map((evt) => {
                const appt = apptMap.get(evt.id);
                const status = appt?.status ?? 'scheduled';
                return h(EventCard, {
                  key: evt.id,
                  event: evt,
                  variant: 'list',
                  showTime: true,
                  badge: renderStatusBadge(status),
                  subtitle: appt?.reason ?? null,
                  onClick: openAgenda,
                });
              })
            )
    )
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
              {
                className: 'w-20 shrink-0 text-right text-xs text-cg-text-muted whitespace-nowrap',
              },
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
