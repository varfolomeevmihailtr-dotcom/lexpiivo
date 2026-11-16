create or replace function public.draw_caravan_coachman(p_candidates uuid[], p_event text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  eligible uuid[];
  winner uuid;
begin
  if (select auth.uid()) is null
     or coalesce(public.current_clan_role(), '') not in ('r4', 'r5', 'admin') then
    raise exception 'Розыгрыш доступен руководству клана';
  end if;

  p_event := trim(coalesce(p_event, ''));
  if char_length(p_event) not between 1 and 120
     or coalesce(cardinality(p_candidates), 0) not between 1 and 100 then
    raise exception 'Укажи событие и отметь от 1 до 100 участников';
  end if;

  -- Serialize draws and queue edits with the existing manual selection flow.
  lock table public.clan_caravan_queue in exclusive mode;
  if exists (
    select from public.clan_caravan_queue
    where request_type = 'coachman' and status = 'selected'
  ) then
    raise exception 'Кучер уже назначен. Обнови очередь перед новым розыгрышем';
  end if;

  with candidates as (
    select q.user_id, count(h.id) as rides
    from public.clan_caravan_queue q
    left join public.clan_caravan_history h
      on h.user_id = q.user_id and h.request_type = 'coachman'
    where q.user_id = any(p_candidates)
      and q.status = 'pending' and q.request_type = 'coachman'
    group by q.user_id
  )
  select array_agg(user_id order by user_id) into eligible
  from candidates
  where rides = (select min(rides) from candidates);

  if eligible is null then
    raise exception 'Среди отмеченных игроков больше нет ожидающих кучеров';
  end if;

  winner := eligible[1 + floor(random() * cardinality(eligible))::int];
  perform public.set_caravan_selection(winner, true, 'Розыгрыш · ' || p_event);
  return jsonb_build_object('winner', winner, 'eligible', eligible);
end;
$$;

revoke execute on function public.draw_caravan_coachman(uuid[], text) from public, anon;
grant execute on function public.draw_caravan_coachman(uuid[], text) to authenticated;
