-- Notificações: assinaturas Web Push (gravadas pelo navegador via RLS) e
-- controle de lembretes enviados (somente backend com service role).

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  endpoint text not null unique check (endpoint ~ '^https://' and char_length(endpoint) <= 2048),
  p256dh text not null check (char_length(p256dh) <= 200),
  auth text not null check (char_length(auth) <= 100),
  device_label text check (device_label is null or char_length(device_label) <= 80),
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

comment on table public.push_subscriptions is 'Assinaturas Web Push (um navegador/dispositivo por linha) do profissional.';

alter table public.push_subscriptions enable row level security;

grant select, delete on public.push_subscriptions to authenticated;
grant insert (endpoint, p256dh, auth, device_label) on public.push_subscriptions to authenticated;

create policy push_subscriptions_select_own on public.push_subscriptions
  for select to authenticated
  using (owner_id = (select auth.uid()));

create policy push_subscriptions_insert_own on public.push_subscriptions
  for insert to authenticated
  with check (owner_id = (select auth.uid()));

create policy push_subscriptions_delete_own on public.push_subscriptions
  for delete to authenticated
  using (owner_id = (select auth.uid()));

create table public.appointment_reminders (
  appointment_id uuid not null references public.appointments (id) on delete cascade,
  starts_at timestamptz not null,
  sent_at timestamptz not null default now(),
  primary key (appointment_id, starts_at)
);

comment on table public.appointment_reminders is 'Controle de lembretes já enviados (dedupe); acesso apenas via service role.';

-- Sem grants para anon/authenticated e sem políticas: só o service role acessa.
alter table public.appointment_reminders enable row level security;
