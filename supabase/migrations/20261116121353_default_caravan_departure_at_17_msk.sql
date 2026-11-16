create or replace function public.next_caravan_departure(p_override timestamptz)
returns timestamptz language sql stable set search_path = ''
as $$
  with clock as (
    select date_trunc('day', now() at time zone 'Europe/Moscow') + interval '17 hours' as today
  )
  select case
    when p_override > now() then p_override
    when today at time zone 'Europe/Moscow' > now() then today at time zone 'Europe/Moscow'
    else (today + interval '1 day') at time zone 'Europe/Moscow'
  end
  from clock;
$$;
revoke execute on function public.next_caravan_departure(timestamptz) from public, anon, authenticated;
CREATE OR REPLACE FUNCTION public.set_caravan_departure(p_departure timestamp with time zone)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare dep timestamptz;
begin
 if (select auth.uid()) is null or coalesce(public.current_clan_role(),'') not in ('r4','r5','admin') then raise exception 'Only R4/R5';end if;
 if p_departure is not null and (p_departure<now() or p_departure>now()+interval '30 days') then raise exception 'Выбери время в пределах следующих 30 дней';end if;
 update public.clan_caravan_departure set departure_at=p_departure,updated_by=(select auth.uid()),updated_at=now() where id=1;
 delete from public.clan_telegram_notifications where kind='reminder' and status='pending';
 dep := public.next_caravan_departure(p_departure);
 if dep is not null then
  insert into public.clan_telegram_notifications(user_id,history_id,kind,due_at,departure_at)
  select q.user_id,h.id,'reminder',greatest(now(),dep-interval '1 hour'),dep
  from public.clan_caravan_queue q
  join lateral (select id from public.clan_caravan_history h where h.user_id=q.user_id order by h.selected_at desc limit 1) h on true
  where q.status='selected' on conflict do nothing;
 end if;
end $function$;

CREATE OR REPLACE FUNCTION public.telegram_history_enqueue()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare dep timestamptz;
begin
 insert into public.clan_telegram_notifications(user_id,history_id,kind,due_at)
 values(new.user_id,new.id,'selected',now()) on conflict do nothing;
 dep := public.next_caravan_departure((select departure_at from public.clan_caravan_departure where id=1));
 if dep>now() then
  insert into public.clan_telegram_notifications(user_id,history_id,kind,due_at,departure_at)
  values(new.user_id,new.id,'reminder',greatest(now(),dep-interval '1 hour'),dep) on conflict do nothing;
 end if;
 return new;
end $function$;
