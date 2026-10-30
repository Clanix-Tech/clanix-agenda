import type { Session } from '@supabase/supabase-js';

export type Row = Record<string, unknown>;
type Result = { data: unknown; error: unknown };
type RpcHandler = (args: unknown) => { data?: unknown; error?: unknown };
type AuthListener = (event: string, session: Session | null) => void;

export type FakeSupabaseOptions = {
  rpc?: Record<string, RpcHandler>;
  tables?: Record<string, Row[]>;
  session?: Session | null;
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

type Filter = (row: Row) => boolean;

/** Construtor de consultas encadeável e "thenable" (como o do supabase-js). */
class FakeQuery implements PromiseLike<Result> {
  private filters: Filter[] = [];
  private orderBy: { column: string; ascending: boolean } | null = null;
  private mode: 'select' | 'update' | 'insert' | 'delete' = 'select';
  private payload: Row | Row[] | null = null;

  private readonly rows: Row[];

  constructor(rows: Row[]) {
    this.rows = rows;
  }

  select() {
    return this;
  }
  update(values: Row) {
    this.mode = 'update';
    this.payload = values;
    return this;
  }
  insert(values: Row | Row[]) {
    this.mode = 'insert';
    this.payload = values;
    return this;
  }
  delete() {
    this.mode = 'delete';
    return this;
  }
  eq(column: string, value: unknown) {
    this.filters.push((r) => r[column] === value);
    return this;
  }
  gte(column: string, value: unknown) {
    this.filters.push((r) => (r[column] as string) >= (value as string));
    return this;
  }
  lt(column: string, value: unknown) {
    this.filters.push((r) => (r[column] as string) < (value as string));
    return this;
  }
  order(column: string, opts?: { ascending?: boolean }) {
    this.orderBy = { column, ascending: opts?.ascending ?? true };
    return this;
  }

  private run(): Result {
    const match = (r: Row) => this.filters.every((f) => f(r));
    if (this.mode === 'insert') {
      const items = Array.isArray(this.payload) ? this.payload : [this.payload as Row];
      this.rows.push(...items);
      return { data: items, error: null };
    }
    if (this.mode === 'update') {
      const hit = this.rows.filter(match);
      hit.forEach((r) => Object.assign(r, this.payload));
      return { data: hit, error: null };
    }
    if (this.mode === 'delete') {
      const hit = this.rows.filter(match);
      for (const r of hit) this.rows.splice(this.rows.indexOf(r), 1);
      return { data: hit, error: null };
    }
    const out = this.rows.filter(match);
    if (this.orderBy) {
      const { column, ascending } = this.orderBy;
      out.sort((a, b) => {
        const x = a[column] as string;
        const y = b[column] as string;
        return (x < y ? -1 : x > y ? 1 : 0) * (ascending ? 1 : -1);
      });
    }
    return { data: out, error: null };
  }

  then<R1 = Result, R2 = never>(
    onfulfilled?: ((value: Result) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    return Promise.resolve(this.run()).then(onfulfilled, onrejected);
  }
}

export function createFakeSupabase(options: FakeSupabaseOptions = {}) {
  const tables: Record<string, Row[]> = options.tables ?? {};
  const listeners = new Set<AuthListener>();
  let session: Session | null = options.session ?? null;
  const calls: { rpc: Array<{ name: string; args: unknown }> } = { rpc: [] };

  const emit = (event: string) => listeners.forEach((l) => l(event, session));
  const ok = <T>(data: T) => Promise.resolve({ data, error: null });

  return {
    calls,
    tables,
    rpc(name: string, args?: unknown) {
      calls.rpc.push({ name, args });
      const handler = options.rpc?.[name];
      const res = handler ? handler(args) : {};
      return Promise.resolve({ data: res.data ?? null, error: res.error ?? null });
    },
    from(table: string) {
      return new FakeQuery((tables[table] ??= []));
    },
    auth: {
      getSession: () => ok({ session }),
      onAuthStateChange(cb: AuthListener) {
        listeners.add(cb);
        return { data: { subscription: { unsubscribe: () => listeners.delete(cb) } } };
      },
      signInWithPassword: ({ email }: { email: string; password: string }) => {
        session = makeSession(email);
        emit('SIGNED_IN');
        return ok({ session, user: session.user });
      },
      signUp: ({ email }: { email: string; password: string }) =>
        ok({ session: null, user: { id: 'user-new', email } }),
      resetPasswordForEmail: () => ok({}),
      updateUser: () => ok({ user: session?.user ?? null }),
      signOut: () => {
        session = null;
        emit('SIGNED_OUT');
        return Promise.resolve({ error: null });
      },
    },
  };
}

export type FakeSupabase = ReturnType<typeof createFakeSupabase>;
