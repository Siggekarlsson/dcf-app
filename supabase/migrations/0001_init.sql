-- Sparade scenarier och chatthistorik per anonym session.
-- Appen når tabellerna endast server-side med service role-nyckeln; RLS är på utan policies,
-- vilket stänger ute anon-nyckeln helt.

create table if not exists public.scenarios (
  session_id uuid not null,
  ticker text not null,
  assumptions jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (session_id, ticker)
);

create table if not exists public.chat_messages (
  id bigint generated always as identity primary key,
  session_id uuid not null,
  ticker text not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  applied jsonb,
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_session_ticker_idx
  on public.chat_messages (session_id, ticker, created_at);

alter table public.scenarios enable row level security;
alter table public.chat_messages enable row level security;
