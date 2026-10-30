-- ============================================================
--  Run this ONCE in Supabase  ->  SQL Editor  ->  New query  ->  Run
--  Creates your private visitor-analytics table + the report admin.html reads.
--  Nobody can read or write the table from the browser: visits are saved by
--  your Vercel function (api/hit.js) and read by you (signed in) through analytics_report().
-- ============================================================

create table if not exists public.analytics_events (
  id         bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  type       text not null check (type in ('view', 'engage', 'click', 'section')),
  visitor_id text not null check (char_length(visitor_id) between 8 and 40),   -- random id kept in the visitor's browser (no cookie, no IP)
  session_id text not null check (char_length(session_id) between 8 and 40),
  pv         text          check (char_length(pv) between 6 and 40),            -- one id per page load
  path       text not null check (char_length(path) <= 200),
  referrer   text          check (char_length(referrer) <= 100),
  device     text          check (device in ('mobile', 'tablet', 'desktop')),
  browser    text          check (char_length(browser) <= 30),
  os         text          check (char_length(os) <= 30),
  country    text          check (char_length(country) = 2),
  seconds    int           check (seconds between 0 and 7200),
  scroll     int           check (scroll between 0 and 100),
  target     text          check (char_length(target) <= 80)
);

create index if not exists analytics_events_time_idx on public.analytics_events (created_at desc);
create index if not exists analytics_events_type_time_idx on public.analytics_events (type, created_at desc);

-- security: row level security ON with NO policies = the browser can't touch the table at all
alter table public.analytics_events enable row level security;
revoke all on public.analytics_events from anon, authenticated;

-- the report: only YOUR login can run it (change the email below if you sign in with another one)
create or replace function public.analytics_report(days int default 30, tz text default 'Asia/Manila')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  owner text := 'work.austingarcia@gmail.com';
  d     int  := least(greatest(coalesce(days, 30), 1), 365);
  zone  text := coalesce(nullif(tz, ''), 'UTC');
  since timestamptz;
  result jsonb;
begin
  if (auth.jwt() ->> 'email') is distinct from owner then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  begin perform now() at time zone zone; exception when others then zone := 'UTC'; end;
  since := (date_trunc('day', now() at time zone zone) - make_interval(days => d - 1)) at time zone zone;

  select jsonb_build_object(
    'since', since,
    'zone', zone,
    'online', (select count(distinct visitor_id) from analytics_events where created_at > now() - interval '5 minutes'),

    'totals', (select jsonb_build_object(
        'views',    count(*) filter (where type = 'view'),
        'visitors', count(distinct visitor_id) filter (where type = 'view'),
        'sessions', count(distinct session_id) filter (where type = 'view'),
        'clicks',   count(*) filter (where type = 'click')
      ) from analytics_events where created_at >= since),

    'new_visitors', (select count(*) from (
        select visitor_id from analytics_events where type = 'view' group by visitor_id having min(created_at) >= since) n),

    'engage', (select jsonb_build_object('seconds', coalesce(round(avg(seconds))::int, 0), 'scroll', coalesce(round(avg(scroll))::int, 0))
        from (select distinct on (pv) seconds, scroll from analytics_events
               where type = 'engage' and pv is not null and created_at >= since
               order by pv, created_at desc) e),

    'daily', (select coalesce(jsonb_agg(jsonb_build_object('d', to_char(g.day, 'YYYY-MM-DD'), 'views', coalesce(v.views, 0), 'visitors', coalesce(v.visitors, 0)) order by g.day), '[]'::jsonb)
        from generate_series(date_trunc('day', since at time zone zone), date_trunc('day', now() at time zone zone), interval '1 day') as g(day)
        left join (select (created_at at time zone zone)::date as day, count(*) as views, count(distinct visitor_id) as visitors
                     from analytics_events where type = 'view' and created_at >= since group by 1) v
               on v.day = g.day::date),

    'pages', (select coalesce(jsonb_agg(jsonb_build_object('k', k, 'n', n, 'u', u) order by n desc), '[]'::jsonb) from (
        select path as k, count(*) as n, count(distinct visitor_id) as u from analytics_events
         where type = 'view' and created_at >= since group by path order by n desc limit 10) t),

    'referrers', (select coalesce(jsonb_agg(jsonb_build_object('k', k, 'n', n, 'u', u) order by n desc), '[]'::jsonb) from (
        select coalesce(referrer, 'Direct') as k, count(*) as n, count(distinct visitor_id) as u from analytics_events
         where type = 'view' and created_at >= since group by 1 order by n desc limit 10) t),

    'countries', (select coalesce(jsonb_agg(jsonb_build_object('k', k, 'n', n, 'u', u) order by n desc), '[]'::jsonb) from (
        select coalesce(country, '??') as k, count(*) as n, count(distinct visitor_id) as u from analytics_events
         where type = 'view' and created_at >= since group by 1 order by n desc limit 10) t),

    'devices', (select coalesce(jsonb_agg(jsonb_build_object('k', k, 'n', n, 'u', u) order by n desc), '[]'::jsonb) from (
        select coalesce(device, 'unknown') as k, count(*) as n, count(distinct visitor_id) as u from analytics_events
         where type = 'view' and created_at >= since group by 1 order by n desc limit 10) t),

    'browsers', (select coalesce(jsonb_agg(jsonb_build_object('k', k, 'n', n, 'u', u) order by n desc), '[]'::jsonb) from (
        select coalesce(browser, 'Other') as k, count(*) as n, count(distinct visitor_id) as u from analytics_events
         where type = 'view' and created_at >= since group by 1 order by n desc limit 10) t),

    'systems', (select coalesce(jsonb_agg(jsonb_build_object('k', k, 'n', n, 'u', u) order by n desc), '[]'::jsonb) from (
        select coalesce(os, 'Other') as k, count(*) as n, count(distinct visitor_id) as u from analytics_events
         where type = 'view' and created_at >= since group by 1 order by n desc limit 10) t),

    -- how many visits reached each part of the page (the "where do people stop" view)
    'sections', (select coalesce(jsonb_agg(jsonb_build_object('k', k, 'n', n) order by n desc), '[]'::jsonb) from (
        select target as k, count(distinct pv) as n from analytics_events
         where type = 'section' and target is not null and created_at >= since group by target order by n desc limit 12) t),

    'clicks', (select coalesce(jsonb_agg(jsonb_build_object('k', k, 'n', n) order by n desc), '[]'::jsonb) from (
        select target as k, count(*) as n from analytics_events
         where type = 'click' and target is not null and created_at >= since group by target order by n desc limit 10) t),

    'recent', (select coalesce(jsonb_agg(jsonb_build_object('t', created_at, 'p', path, 'c', country, 'd', device, 'b', browser, 'r', referrer) order by created_at desc), '[]'::jsonb) from (
        select created_at, path, country, device, browser, referrer from analytics_events
         where type = 'view' order by created_at desc limit 12) t)
  ) into result;

  return result;
end $$;

revoke all on function public.analytics_report(int, text) from public, anon;
grant execute on function public.analytics_report(int, text) to authenticated;

-- ============================================================
--  Click map: stores where on the page people click, and lets admin.html read it.
--  Safe to run more than once.
-- ============================================================
alter table public.analytics_events
  add column if not exists x  int check (x  between 0 and 1000),      -- click position across the page, 0-1000 (thousandths of the width)
  add column if not exists y  int check (y  between 0 and 1000),      -- click position down the page, 0-1000 (thousandths of the height)
  add column if not exists vw int check (vw between 0 and 10000);     -- visitor's window width, used to split mobile / desktop

create or replace function public.analytics_clicks(days int default 30, tz text default 'Asia/Manila', mobile boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  owner text := 'work.austingarcia@gmail.com';
  d     int  := least(greatest(coalesce(days, 30), 1), 365);
  zone  text := coalesce(nullif(tz, ''), 'UTC');
  since timestamptz;
begin
  if (auth.jwt() ->> 'email') is distinct from owner then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  begin perform now() at time zone zone; exception when others then zone := 'UTC'; end;
  since := (date_trunc('day', now() at time zone zone) - make_interval(days => d - 1)) at time zone zone;

  return (select jsonb_build_object(
            'n', count(*),
            'points', coalesce(jsonb_agg(jsonb_build_array(x, y)), '[]'::jsonb))
          from (select x, y from analytics_events
                 where type = 'click' and x is not null and y is not null and created_at >= since
                   and ((coalesce(vw, 1280) < 700) = coalesce(mobile, false))
                 order by created_at desc limit 4000) c);
end $$;

revoke all on function public.analytics_clicks(int, text, boolean) from public, anon;
grant execute on function public.analytics_clicks(int, text, boolean) to authenticated;

-- optional housekeeping: run now and then to keep only the last year
-- delete from public.analytics_events where created_at < now() - interval '365 days';
