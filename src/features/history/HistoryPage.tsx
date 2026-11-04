import { Fragment, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Download, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DESKTOP_QUERY, useMediaQuery } from '@/lib/useMediaQuery';
import { toAppError } from '@/lib/errors';
import { formatDateBR, formatTime } from '@/lib/time';
import { useProfile } from '@/features/profile/api';
import { useFavorites } from '@/features/favorites/api';
import { statusMeta, type AppointmentStatus } from '@/features/appointments/domain/status';
import type { Appointment } from '@/features/appointments/api';
import { useOpenAppointment } from '@/features/calendar/useOpenAppointment';
import { StatusFilter } from '@/features/calendar/components/StatusFilter';
import { StatusBadge } from '@/components/status/StatusBadge';
import { LoadingState } from '@/components/feedback/LoadingState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { EmptyState } from '@/components/feedback/EmptyState';
import { exportAppointmentsCsv } from './exportCsv';
import { splitHighlight } from './highlight';
import {
  defaultPeriod,
  PAGE_SIZE,
  useHistorySearch,
  type HistoryFilters,
} from './useHistorySearch';
import { useRecentChanges } from './useRecentChanges';

const FOCUS =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB]';
const FIELD =
  'min-h-11 w-full rounded-xl border border-[#E2E8F0] bg-white px-3 text-base text-[#0F172A]';
const DEBOUNCE_MS = 300;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const STATUSES = Object.keys(statusMeta) as AppointmentStatus[];

function Highlight({ text, term }: { text: string; term: string }) {
  return (
    <>
      {splitHighlight(text, term).map((p, i) =>
        p.match ? (
          <mark key={i} className="rounded bg-[#FEF08A] px-0.5 text-inherit">
            {p.text}
          </mark>
        ) : (
          <Fragment key={i}>{p.text}</Fragment>
        ),
      )}
    </>
  );
}

function dateParam(sp: URLSearchParams, key: string, fallback: string): string {
  if (!sp.has(key)) return fallback;
  const v = sp.get(key) ?? '';
  return v === '' || DATE_RE.test(v) ? v : fallback;
}

export default function HistoryPage() {
  const desktop = useMediaQuery(DESKTOP_QUERY);
  const [sp, setSp] = useSearchParams();
  const openAppointment = useOpenAppointment();
  const profile = useProfile();
  const favorites = useFavorites(true);
  const tz = profile.data?.timezone ?? 'America/Sao_Paulo';

  const q = sp.get('q') ?? '';
  const [text, setText] = useState(q);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // Texto digitado ainda não enviado ao URL (null = nada pendente).
  const pending = useRef<string | null>(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const period = defaultPeriod(tz);
  const statuses = (sp.get('status') ?? '')
    .split(',')
    .filter((s): s is AppointmentStatus => STATUSES.includes(s as AppointmentStatus));
  const filters: HistoryFilters = {
    q: q.trim(),
    statuses,
    service: sp.get('servico') ?? '',
    from: dateParam(sp, 'de', period.from),
    to: dateParam(sp, 'ate', period.to),
  };
  const page = Math.max(1, Number.parseInt(sp.get('pagina') ?? '1', 10) || 1);

  const search = useHistorySearch(filters, profile.data?.timezone, page);
  const recent = useRecentChanges();

  const update = (patch: Record<string, string | null>, opts?: { keepPage?: boolean }) => {
    // Outra mudança de filtro leva junto a busca digitada e ainda não enviada.
    if (pending.current !== null) {
      clearTimeout(timer.current);
      const typed = pending.current.trim();
      pending.current = null;
      patch = { q: typed === '' ? null : typed, ...patch };
    }
    setSp(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [k, v] of Object.entries(patch)) {
          if (v === null) next.delete(k);
          else next.set(k, v);
        }
        if (!opts?.keepPage) next.delete('pagina');
        return next;
      },
      { replace: true },
    );
  };
  // O temporizador usa sempre o `update` da renderização mais recente (searchParams atual).
  const updateRef = useRef(update);
  useEffect(() => {
    updateRef.current = update;
  });

  const onSearchChange = (value: string) => {
    setText(value);
    clearTimeout(timer.current);
    pending.current = value;
    timer.current = setTimeout(() => updateRef.current({}), DEBOUNCE_MS);
  };

  const clearAll = () => {
    clearTimeout(timer.current);
    pending.current = null;
    setText('');
    setSp(new URLSearchParams(), { replace: true });
  };

  const onExport = async () => {
    if (exporting) return;
    setExporting(true);
    setExportError(null);
    try {
      await exportAppointmentsCsv({ ...filters, q: text.trim() }, tz);
    } catch (err) {
      setExportError(toAppError(err).message);
    } finally {
      setExporting(false);
    }
  };

  if (profile.isPending) return <LoadingState label="Carregando…" />;
  if (profile.isError) {
    return (
      <ErrorState
        message="Não foi possível carregar o histórico."
        onRetry={() => void profile.refetch()}
      />
    );
  }

  const serviceNames = new Set((favorites.data ?? []).map((f) => f.name));
  if (filters.service) serviceNames.add(filters.service);
  const services = [...serviceNames].sort((a, b) => a.localeCompare(b, 'pt-BR'));

  const rows = search.data?.rows ?? [];
  const count = search.data?.count ?? 0;
  const firstShown = (page - 1) * PAGE_SIZE + 1;
  const lastShown = Math.min(count, (page - 1) * PAGE_SIZE + rows.length);

  const clearBtn = (label: string) => (
    <button
      type="button"
      onClick={clearAll}
      className={cn(
        'inline-flex min-h-11 items-center justify-center rounded-xl border border-[#E2E8F0] bg-white px-5 text-sm font-semibold text-[#0F2D5B]',
        FOCUS,
      )}
    >
      {label}
    </button>
  );

  const nameCell = (a: Appointment) => (
    <span
      title={a.client_name}
      className={cn('block truncate', a.status === 'cancelado' && 'line-through')}
    >
      <Highlight text={a.client_name} term={filters.q} />
    </span>
  );

  let results;
  if (search.isPending) results = <LoadingState label="Buscando…" />;
  else if (search.isError) {
    results = (
      <ErrorState
        message="Não foi possível carregar os atendimentos."
        onRetry={() => void search.refetch()}
      />
    );
  } else if (rows.length === 0 && count > 0) {
    results = (
      <EmptyState
        title="Esta página não existe mais."
        action={
          <button
            type="button"
            onClick={() => update({ pagina: null })}
            className={cn(
              'inline-flex min-h-11 items-center justify-center rounded-xl border border-[#E2E8F0] bg-white px-5 text-sm font-semibold text-[#0F2D5B]',
              FOCUS,
            )}
          >
            Voltar para a página 1
          </button>
        }
      />
    );
  } else if (rows.length === 0) {
    results = (
      <EmptyState
        title="Nenhum atendimento encontrado com esses filtros."
        action={clearBtn('Limpar filtros')}
      />
    );
  } else if (desktop) {
    results = (
      <table className="w-full text-left text-sm">
        <thead className="bg-[#F8FAFC] text-xs text-[#64748B]">
          <tr>
            <th className="px-3 py-2">Data</th>
            <th className="px-3 py-2">Horário</th>
            <th className="px-3 py-2">Cliente</th>
            <th className="px-3 py-2">Serviço</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">
              <span className="sr-only">Ações</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((a) => (
            <tr key={a.id} className="border-t border-[#E2E8F0]">
              <td className="px-3 py-2 whitespace-nowrap">{formatDateBR(a.starts_at, tz)}</td>
              <td className="px-3 py-2 whitespace-nowrap">
                {formatTime(a.starts_at, tz)} – {formatTime(a.ends_at, tz)}
              </td>
              <td className="max-w-[220px] px-3 py-2">{nameCell(a)}</td>
              <td className="max-w-[180px] truncate px-3 py-2" title={a.service_name}>
                {a.service_name}
              </td>
              <td className="px-3 py-2">
                <StatusBadge status={a.status} compact />
              </td>
              <td className="px-3 py-2 text-right">
                <button
                  type="button"
                  aria-label={`Ver detalhes de ${a.client_name}, ${formatDateBR(a.starts_at, tz)} ${formatTime(a.starts_at, tz)}`}
                  onClick={() => openAppointment(a.id)}
                  className={cn(
                    'min-h-11 rounded-lg border border-[#E2E8F0] px-3 font-semibold text-[#0F2D5B]',
                    FOCUS,
                  )}
                >
                  Ver
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  } else {
    results = (
      <ul className="flex flex-col gap-2 p-2">
        {rows.map((a) => (
          <li key={a.id}>
            <button
              type="button"
              onClick={() => openAppointment(a.id)}
              className={cn(
                'flex min-h-[64px] w-full flex-col gap-1 rounded-[14px] border border-[#E2E8F0] bg-white p-3 text-left',
                FOCUS,
              )}
            >
              <span className="text-xs font-semibold text-[#64748B]">
                {formatDateBR(a.starts_at, tz)} · {formatTime(a.starts_at, tz)}
              </span>
              <span className="font-semibold text-[#0F172A]">{nameCell(a)}</span>
              <span className="flex items-center justify-between gap-2 text-sm text-[#475569]">
                <span className="truncate" title={a.service_name}>
                  {a.service_name}
                </span>
                <StatusBadge status={a.status} compact />
              </span>
            </button>
          </li>
        ))}
      </ul>
    );
  }

  const pager = (label: string, disabled: boolean, to: number) => (
    <button
      type="button"
      disabled={disabled}
      onClick={() => update({ pagina: to <= 1 ? null : String(to) }, { keepPage: true })}
      className={cn(
        'min-h-11 rounded-xl border border-[#E2E8F0] bg-white px-4 text-sm font-semibold text-[#0F2D5B] disabled:opacity-50',
        FOCUS,
      )}
    >
      {label}
    </button>
  );

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 pt-5 pb-6 lg:px-8 lg:pt-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-[#0F2D5B]">Histórico e busca</h1>
          <p className="text-sm text-[#64748B]">
            Encontre atendimentos por cliente, data, serviço ou status.
          </p>
        </div>
        <button
          type="button"
          disabled={exporting}
          onClick={() => void onExport()}
          className={cn(
            'inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#2563EB] px-5 text-sm font-semibold text-white disabled:opacity-60',
            FOCUS,
          )}
        >
          <Download aria-hidden="true" className="size-4" />
          {exporting ? 'Exportando…' : 'Exportar CSV'}
        </button>
      </header>
      {exportError && (
        <p role="alert" className="rounded-xl bg-[#FEF2F2] px-4 py-3 text-sm text-[#991B1B]">
          {exportError}
        </p>
      )}

      <section
        aria-label="Filtros"
        className="flex flex-col gap-4 rounded-[18px] border border-[#E2E8F0] bg-white p-4"
      >
        <label className="flex flex-col gap-1 text-sm font-semibold text-[#334155]">
          Buscar por nome do cliente
          <span className="relative block">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-[#64748B]"
            />
            <input
              type="search"
              value={text}
              maxLength={120}
              placeholder="Nome do cliente"
              onChange={(e) => onSearchChange(e.target.value)}
              className={cn(FIELD, 'pl-10 font-normal', FOCUS)}
            />
          </span>
        </label>
        <StatusFilter
          value={statuses.length ? statuses : null}
          onChange={(v) => update({ status: v?.length ? v.join(',') : null })}
        />
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="flex flex-col gap-1 text-sm font-semibold text-[#334155]">
            Serviço
            <select
              value={filters.service}
              onChange={(e) => update({ servico: e.target.value || null })}
              className={cn(FIELD, 'font-normal', FOCUS)}
            >
              <option value="">Todos os serviços</option>
              {services.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold text-[#334155]">
            De
            <input
              type="date"
              value={filters.from}
              max={filters.to || undefined}
              onChange={(e) => update({ de: e.target.value })}
              className={cn(FIELD, 'font-normal', FOCUS)}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold text-[#334155]">
            Até
            <input
              type="date"
              value={filters.to}
              min={filters.from || undefined}
              onChange={(e) => update({ ate: e.target.value })}
              className={cn(FIELD, 'font-normal', FOCUS)}
            />
          </label>
        </div>
        <div>{clearBtn('Limpar')}</div>
      </section>

      <div className={cn('grid gap-5', desktop && 'grid-cols-[1fr_300px] items-start')}>
        <section
          aria-label="Resultados"
          className="min-w-0 rounded-[18px] border border-[#E2E8F0] bg-white"
        >
          {search.data && (
            <p
              role="status"
              className="border-b border-[#E2E8F0] px-4 py-3 font-display font-bold text-[#0F2D5B]"
            >
              {count} {count === 1 ? 'resultado' : 'resultados'}
            </p>
          )}
          {results}
          {rows.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E2E8F0] px-4 py-3">
              <p className="text-sm text-[#64748B]">
                Mostrando {firstShown}–{lastShown} de {count}
              </p>
              <div className="flex gap-2">
                {pager('Anterior', page <= 1, page - 1)}
                {pager('Próxima', lastShown >= count, page + 1)}
              </div>
            </div>
          )}
        </section>

        <section
          aria-labelledby="remarcacoes"
          className="rounded-[18px] border border-[#E2E8F0] bg-white p-4"
        >
          <h2 id="remarcacoes" className="mb-2 font-display text-lg font-bold text-[#0F2D5B]">
            Remarcações e cancelamentos
          </h2>
          {recent.isPending ? (
            <p className="text-sm text-[#64748B]">Carregando…</p>
          ) : recent.isError ? (
            <p className="text-sm text-[#64748B]">Não foi possível carregar.</p>
          ) : recent.data.length === 0 ? (
            <p className="text-sm text-[#64748B]">Nenhuma remarcação ou cancelamento ainda.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {recent.data.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => openAppointment(c.appointmentId)}
                    className={cn(
                      'flex min-h-11 w-full flex-col rounded-lg px-2 py-1.5 text-left hover:bg-[#F8FAFC]',
                      FOCUS,
                    )}
                  >
                    <span className="text-sm font-semibold text-[#0F2D5B]">
                      {c.action === 'cancelado' ? 'Cancelado' : 'Remarcado'} ·{' '}
                      <span className="font-normal">{formatDateBR(c.at, tz)}</span>
                    </span>
                    <span className="truncate text-sm text-[#475569]" title={c.clientName}>
                      {c.clientName}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
