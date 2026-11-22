create or replace function public.draw_caravan_list(p_candidates uuid[], p_names text[], p_event text, p_request uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
 roster jsonb; winner jsonb; result jsonb; prior jsonb;
 winner_user uuid; winner_name text; history_id bigint;
begin
 if (select auth.uid()) is null or coalesce(public.current_clan_role(),'') not in ('r4','r5','admin') then
  raise exception 'Розыгрыш доступен руководству клана';
 end if;
 if p_request is null or char_length(trim(coalesce(p_event,''))) not between 1 and 120
 or coalesce(cardinality(p_candidates),0)+coalesce(cardinality(p_names),0) not between 1 and 100
 or exists(select from unnest(p_names) n where n is null or char_length(trim(n)) not between 1 and 100) then
  raise exception 'Укажи событие и от 1 до 100 ников длиной до 100 символов';
 end if;
 lock table public.clan_caravan_queue in exclusive mode;
 select h.draw_result into prior from public.clan_caravan_history h where h.draw_request=p_request;
 if prior is not null then return prior; end if;
 if exists(select from public.clan_caravan_queue where request_type='coachman' and status='selected') then
  raise exception 'Кучер уже назначен. Сначала верни его в очередь';
 end if;
 if exists(
  select from unnest(p_names) n join public.clan_accounts a on lower(trim(a.nickname))=lower(trim(n))
  group by lower(trim(n)) having count(*)>1
 ) then raise exception 'На сайте есть одинаковые ники. Выбери такого участника через очередь'; end if;

 with input as (
  select a.user_id, a.nickname as name
  from public.clan_caravan_queue q join public.clan_accounts a using(user_id)
  where q.user_id=any(p_candidates) and q.request_type='coachman' and q.status='pending'
  union all
  select a.user_id,coalesce(a.nickname,trim(n))
  from unnest(p_names) n
  left join public.clan_accounts a on lower(trim(a.nickname))=lower(trim(n))
 ), candidates as (
  select distinct on (lower(trim(name))) user_id,name from input
  order by lower(trim(name)),user_id nulls last
 ), counts as (
  select c.*, (select count(*) from public.clan_caravan_history h
    where h.request_type='coachman' and (
      (c.user_id is not null and h.user_id=c.user_id)
      or (h.user_id is null and lower(trim(h.guest_nickname))=lower(trim(c.name)))
    )) rides from candidates c
 )
 select jsonb_agg(jsonb_build_object('id',coalesce(user_id::text,'guest:'||lower(name)),'name',name,'user_id',user_id) order by name)
 into roster from counts where rides=(select min(rides) from counts);
 if roster is null then raise exception 'Нет участников для розыгрыша'; end if;
 winner := roster->floor(random()*jsonb_array_length(roster))::int;
 winner_user := (winner->>'user_id')::uuid;
 winner_name := winner->>'name';
 result := jsonb_build_object('winner',winner->>'id','eligible',roster);
 if winner_user is null then
  insert into public.clan_caravan_history(user_id,guest_nickname,request_type,selected_at,selected_by,note,draw_request,draw_result)
  values(null,winner_name,'coachman',now(),(select auth.uid()),'Розыгрыш · '||trim(p_event),p_request,result);
 else
  if exists(select from public.clan_caravan_queue where user_id=winner_user and (request_type<>'coachman' or status<>'pending')) then
   raise exception 'У победителя другая активная заявка. Обнови список участников';
  end if;
  insert into public.clan_caravan_queue(user_id,request_type,status)
  values(winner_user,'coachman','pending') on conflict(user_id) do nothing;
  perform public.set_caravan_selection(winner_user,true,'Розыгрыш · '||trim(p_event));
  select h.id into history_id from public.clan_caravan_history h
   where h.user_id=winner_user and h.selected_at=now() and h.request_type='coachman'
   order by h.id desc limit 1;
  update public.clan_caravan_history set draw_request=p_request,draw_result=result where id=history_id;
 end if;
 return result;
end $$;
