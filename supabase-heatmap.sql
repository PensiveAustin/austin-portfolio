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
