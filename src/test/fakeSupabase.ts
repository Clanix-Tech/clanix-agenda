import type { Session } from '@supabase/supabase-js';

export type Row = Record<string, unknown>;
type Result = { data: unknown; error: unknown; count?: number };
type Handler = (args: unknown) => { data?: unknown; error?: unknown };
type AuthListener = (event: string, session: Session | null) => void;
type Operation = 'select' | 'insert' | 'update' | 'delete';

type AuthMethod =
  'signInWithPassword' | 'signUp' | 'resetPasswordForEmail' | 'updateUser' | 'signOut';

export type FakeSupabaseOptions = {
  rpc?: Record<string, Handler>;
  tables?: Record<string, Row[]>;
  session?: Session | null;
  /** Substitui o comportamento de um método de `auth` (ex.: devolver `{ error }`). */
  auth?: Partial<Record<AuthMethod, Handler>>;
  /** Erro devolvido por operação de tabela: `{ appointments: { insert: { code: 'AE001' } } }`. */
  errors?: Record<string, Partial<Record<Operation, unknown>>>;
};

export function makeSession(email = 'camila@example.com'): Session {
  return {
    access_token: 'token',
    refresh_token: 'refresh',
    expires_in: 3600,
    token_type: 'bearer',
    user: {
      id: 'user-1',
      email,
      app_metadata: {},
      user_metadata: {},
      aud: 'authenticated',
      created_at: '',
    },
  } as Session;
}

const ISO_LIKE = /^\d{4}-\d{2}-\d{2}/;

/** Datas ISO comparam por instante (offsets diferentes); o resto, como texto/número. */
function compare(a: unknown, b: unknown): number {
  if (typeof a === 'string' && typeof b === 'string' && ISO_LIKE.test(a) && ISO_LIKE.test(b)) {
    const x = Date.parse(a);
    const y = Date.parse(b);
    if (!Number.isNaN(x) && !Number.isNaN(y)) return x - y;
  }
  return (a as string) < (b as string) ? -1 : (a as string) > (b as string) ? 1 : 0;
}

const isNil = (v: unknown) => v === null || v === undefined;

/** Semântica SQL: com null/undefined nada é igual, diferente, maior nem menor. */
function sqlCompare(a: unknown, b: unknown): number | null {
  if (isNil(a) || isNil(b)) return null;
  return compare(a, b);
}

function sqlEquals(a: unknown, b: unknown): boolean {
  if (isNil(a) || isNil(b)) return false;
  const isoA = typeof a === 'string' && ISO_LIKE.test(a);
  const isoB = typeof b === 'string' && ISO_LIKE.test(b);
  return isoA && isoB ? compare(a, b) === 0 : a === b;
}

type Filter = (row: Row) => boolean;

const escapeRe = (ch: string) => ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Padrão do `ilike` do PostgREST: sem diferenciar caixa; `%` e `_` são curingas; `\` escapa. */
function likeToRegExp(pattern: string): RegExp {
  let out = '';
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i]!;
    if (ch === '\\' && i + 1 < pattern.length) out += escapeRe(pattern[++i]!);
    else if (ch === '%') out += '[\\s\\S]*';
    else if (ch === '_') out += '[\\s\\S]';
    else out += escapeRe(ch);
  }
  return new RegExp(`^${out}$`, 'i');
}

/** Construtor de consultas encadeável e "thenable" (como o do supabase-js). */
class FakeQuery implements PromiseLike<Result> {
  private filters: Filter[] = [];
  private orderBy: Array<{ column: string; ascending: boolean }> = [];
  private mode: Operation = 'select';
  private payload: Row | Row[] | null = null;
  private singleMode: 'one' | 'maybe' | null = null;
  private max: number | null = null;
  private window: [number, number] | null = null;
  private wantCount = false;

  private readonly rows: Row[];
  private readonly errors: Partial<Record<Operation, unknown>>;

  constructor(rows: Row[], errors: Partial<Record<Operation, unknown>>) {
    this.rows = rows;
    this.errors = errors;
  }

  select(_columns?: string, opts?: { count?: 'exact' }) {
    if (opts?.count) this.wantCount = true;
    return this;
  }
  update(values: Row) {
    this.mode = 'update';
    this.payload = structuredClone(values);
    return this;
  }
  insert(values: Row | Row[]) {
    this.mode = 'insert';
    this.payload = structuredClone(values);
    return this;
  }
  delete() {
    this.mode = 'delete';
    return this;
  }
  eq(column: string, value: unknown) {
    this.filters.push((r) => sqlEquals(r[column], value));
    return this;
  }
  gte(column: string, value: unknown) {
    this.filters.push((r) => {
      const c = sqlCompare(r[column], value);
      return c !== null && c >= 0;
    });
    return this;
  }
  lt(column: string, value: unknown) {
    this.filters.push((r) => {
      const c = sqlCompare(r[column], value);
      return c !== null && c < 0;
    });
    return this;
  }
  lte(column: string, value: unknown) {
    this.filters.push((r) => {
      const c = sqlCompare(r[column], value);
      return c !== null && c <= 0;
    });
    return this;
  }
  neq(column: string, value: unknown) {
    this.filters.push((r) => !isNil(r[column]) && !isNil(value) && !sqlEquals(r[column], value));
    return this;
  }
  in(column: string, values: unknown[]) {
    this.filters.push((r) => values.some((v) => sqlEquals(r[column], v)));
    return this;
  }
  ilike(column: string, pattern: string) {
    const re = likeToRegExp(pattern);
    this.filters.push((r) => typeof r[column] === 'string' && re.test(r[column] as string));
    return this;
  }
  range(from: number, to: number) {
    this.window = [from, to];
    return this;
  }
  limit(count: number) {
    this.max = count;
    return this;
  }
  single() {
    this.singleMode = 'one';
    return this;
  }
  maybeSingle() {
    this.singleMode = 'maybe';
    return this;
  }
  order(column: string, opts?: { ascending?: boolean }) {
    this.orderBy.push({ column, ascending: opts?.ascending ?? true });
    return this;
  }

  private run(): Result {
    const res = this.exec();
    if (res.error || !this.singleMode) return res;
    const list = res.data as Row[];
    if (list.length === 1) return { data: list[0], error: null };
    if (list.length === 0 && this.singleMode === 'maybe') return { data: null, error: null };
    return {
      data: null,
      error: { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' },
    };
  }

  private exec(): Result {
    const error = this.errors[this.mode];
    if (error) return { data: null, error: structuredClone(error) };
    const match = (r: Row) => this.filters.every((f) => f(r));
    if (this.mode === 'insert') {
      const items = (Array.isArray(this.payload) ? this.payload : [this.payload as Row]).map(
        (it) => ({
          ...it,
          id: it.id ?? crypto.randomUUID(),
          created_at: it.created_at ?? new Date().toISOString(),
        }),
      );
      this.rows.push(...items);
      return { data: structuredClone(items), error: null };
    }
    if (this.mode === 'update') {
      const hit = this.rows.filter(match);
      hit.forEach((r) => Object.assign(r, this.payload));
      return { data: structuredClone(hit), error: null };
    }
    if (this.mode === 'delete') {
      const hit = this.rows.filter(match);
      for (const r of hit) this.rows.splice(this.rows.indexOf(r), 1);
      return { data: structuredClone(hit), error: null };
    }
    const out = this.rows.filter(match);
    out.sort((a, b) => {
      for (const { column, ascending } of this.orderBy) {
        const c = compare(a[column], b[column]);
        if (c !== 0) return c * (ascending ? 1 : -1);
      }
      return 0;
    });
    let limited = this.max === null ? out : out.slice(0, this.max);
    if (this.window) limited = limited.slice(this.window[0], this.window[1] + 1);
    return {
      data: structuredClone(limited),
      error: null,
      ...(this.wantCount ? { count: out.length } : {}),
    };
  }

  then<R1 = Result, R2 = never>(
    onfulfilled?: ((value: Result) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    return Promise.resolve(this.run()).then(onfulfilled, onrejected);
  }
}

export function createFakeSupabase(options: FakeSupabaseOptions = {}) {
  const tables: Record<string, Row[]> = structuredClone(options.tables ?? {});
  const listeners = new Set<AuthListener>();
  let session: Session | null = options.session ?? null;
  const calls: { rpc: Array<{ name: string; args: unknown }>; signOut: unknown[] } = {
    rpc: [],
    signOut: [],
  };

  const emit = (event: string) => listeners.forEach((l) => l(event, session));
  const ok = <T>(data: T) => Promise.resolve({ data, error: null });
  const override = (name: AuthMethod, args: unknown) => {
    const h = options.auth?.[name];
    if (!h) return null;
    const res = h(args);
    return Promise.resolve({ data: res.data ?? null, error: res.error ?? null });
  };

  return {
    calls,
    tables,
    rpc(name: string, args?: unknown) {
      calls.rpc.push({ name, args });
      const res = options.rpc?.[name]?.(args) ?? {};
      return Promise.resolve({ data: res.data ?? null, error: res.error ?? null });
    },
    from(table: string) {
      const rows = (tables[table] ??= []);
      return new FakeQuery(rows, options.errors?.[table] ?? {});
    },
    auth: {
      getSession: () => ok({ session }),
      onAuthStateChange(cb: AuthListener) {
        listeners.add(cb);
        return { data: { subscription: { unsubscribe: () => listeners.delete(cb) } } };
      },
      signInWithPassword(args: { email: string; password: string }) {
        const o = override('signInWithPassword', args);
        if (o) return o;
        session = makeSession(args.email);
        emit('SIGNED_IN');
        return ok({ session, user: session.user });
      },
      signUp(args: { email: string; password: string }) {
        return (
          override('signUp', args) ??
          ok({ session: null, user: { id: 'user-new', email: args.email } })
        );
      },
      resetPasswordForEmail(email: string, options?: unknown) {
        return override('resetPasswordForEmail', { email, options }) ?? ok({});
      },
      updateUser(args?: unknown) {
        return override('updateUser', args) ?? ok({ user: session?.user ?? null });
      },
      signOut(args?: unknown) {
        calls.signOut.push(args);
        const o = override('signOut', args);
        if (o) return o;
        session = null;
        emit('SIGNED_OUT');
        return Promise.resolve({ error: null });
      },
    },
    /** Teste: o supabase-js encerra a sessão sozinho (ex.: falha ao renovar o token). */
    simulateExternalSignOut() {
      session = null;
      emit('SIGNED_OUT');
    },
  };
}

export type FakeSupabase = ReturnType<typeof createFakeSupabase>;
