-- ============================================================
--  Run this ONCE in Supabase  →  SQL Editor  →  New query  →  Run
--  Creates the one-row "site_status" table your portfolio reads.
-- ============================================================

create table if not exists public.site_status (
  id         int primary key default 1 check (id = 1),                 -- only ever one row
  state      text not null default 'available' check (state in ('available', 'busy')),
  message    text not null default '' check (char_length(message) <= 120),
  updated_at timestamptz not null default now()
);

insert into public.site_status (id) values (1) on conflict (id) do nothing;

-- keep updated_at fresh automatically
create or replace function public.touch_site_status() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;

drop trigger if exists site_status_touch on public.site_status;
create trigger site_status_touch before update on public.site_status
  for each row execute function public.touch_site_status();

-- security: everyone can READ, only YOU can change it
alter table public.site_status enable row level security;

drop policy if exists "anyone can read status" on public.site_status;
create policy "anyone can read status" on public.site_status
  for select to anon, authenticated using (true);

drop policy if exists "owner can update status" on public.site_status;
create policy "owner can update status" on public.site_status
  for update to authenticated
  using      ((auth.jwt() ->> 'email') = 'work.austingarcia@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'work.austingarcia@gmail.com');

-- (no insert / delete policies on purpose: nobody can add or remove rows through the API)
-- If you sign in with a different email, change it in the two lines above before running.
