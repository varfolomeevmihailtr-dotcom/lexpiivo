-- Recover notifications for assignments that predate the enqueue trigger.
-- Match the current selection so withdrawn or superseded assignments stay excluded.
with current_assignments as (
  select distinct on (q.user_id) q.user_id, h.id as history_id
  from public.clan_caravan_queue q
  join public.clan_caravan_history h
    on h.user_id = q.user_id and h.selected_at = q.selected_at
  where q.status = 'selected'
  order by q.user_id, h.id desc
)
insert into public.clan_telegram_notifications
  (user_id, history_id, kind, due_at, departure_at)
select user_id, history_id, 'selected', now(), null::timestamptz
from current_assignments
union all
select a.user_id, a.history_id, 'reminder',
       greatest(now(), d.departure_at - interval '1 hour'), d.departure_at
from current_assignments a
join public.clan_caravan_departure d on d.id = 1
where d.departure_at > now()
on conflict do nothing;

-- The trigger runs through inserts into caravan history, not through the API.
revoke execute on function public.telegram_history_enqueue() from public, anon, authenticated;
