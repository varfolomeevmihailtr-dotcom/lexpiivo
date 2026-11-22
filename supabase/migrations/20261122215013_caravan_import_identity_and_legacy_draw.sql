alter table public.clan_caravan_history drop constraint caravan_history_identity;
alter table public.clan_caravan_history add constraint caravan_history_identity check (
user_id is not null or coalesce(char_length(trim(guest_nickname)) between 1 and 100,false));

create or replace function public.draw_caravan_coachman(p_candidates uuid[],p_event text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare result jsonb;
begin
 result:=public.draw_caravan_list(p_candidates,array[]::text[],p_event,gen_random_uuid());
 return jsonb_build_object('winner',result->>'winner','eligible',
 (select jsonb_agg(x->>'id') from jsonb_array_elements(result->'eligible') x));
end $$;
