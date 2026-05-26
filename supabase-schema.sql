create table if not exists public.schedules (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  title text not null,
  time text not null,
  reminder text not null default '不提醒',
  note text not null default '',
  done boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.todos (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  done boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.bills (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('income', 'expense')),
  amount numeric(12, 2) not null,
  time text not null,
  merchant text not null,
  category text not null,
  note text not null default '',
  status text not null check (status in ('pending', 'confirmed')),
  source text not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.diaries (
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  mood text not null,
  content text not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, date)
);

alter table public.schedules enable row level security;
alter table public.todos enable row level security;
alter table public.bills enable row level security;
alter table public.diaries enable row level security;

create policy "Users can manage own schedules"
on public.schedules
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can manage own todos"
on public.todos
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can manage own bills"
on public.bills
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can manage own diaries"
on public.diaries
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
