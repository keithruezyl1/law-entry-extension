-- Match function for vector KNN; suitable for exposure via Supabase Data Connect
create or replace function match_kb_entries(query_embedding vector, match_count int)
returns table(
  entry_id text,
  type text,
  title text,
  canonical_citation text,
  summary text,
  tags jsonb,
  created_by integer,
  created_by_name text,
  similarity real
)
language sql
stable
as $$
  select
    e.entry_id,
    e.type,
    e.title,
    e.canonical_citation,
    e.summary,
    e.tags,
    e.created_by,
    u.name as created_by_name,
    1 - (e.embedding <=> query_embedding) as similarity
  from kb_entries e
  left join users u on e.created_by = u.id
  order by e.embedding <=> query_embedding
  limit match_count;
$$;

-- Function to get team progress for a specific date
create or replace function get_team_progress(target_date date)
returns table(
  user_id integer,
  username text,
  name text,
  person_id text,
  entry_type text,
  count bigint
)
language sql
stable
as $$
  select
    u.id as user_id,
    u.username,
    u.name,
    u.person_id,
    e.type as entry_type,
    count(*) as count
  from users u
  left join kb_entries e on u.id = e.created_by 
    and e.created_at::date = target_date
  group by u.id, u.username, u.name, u.person_id, e.type
  order by u.id, e.type;
$$;

-- Function to get daily quota validation for a user
create or replace function get_user_daily_quota(user_id integer, target_date date)
returns table(
  entry_type text,
  current_count bigint,
  daily_quota integer,
  can_submit boolean
)
language sql
stable
as $$
  with user_quota as (
    select 
      case 
        when u.person_id = 'P1' then jsonb_build_object('statute_section', 7, 'city_ordinance_section', 3)
        when u.person_id = 'P2' then jsonb_build_object('rule_of_court', 7, 'doj_issuance', 2, 'rights_advisory', 1)
        when u.person_id = 'P3' then jsonb_build_object('pnp_sop', 5, 'incident_checklist', 3, 'agency_circular', 2)
        when u.person_id = 'P4' then jsonb_build_object('traffic_rule', 6, 'statute_section', 2, 'agency_circular', 2)
        when u.person_id = 'P5' then jsonb_build_object('rights_advisory', 4, 'constitution_provision', 3, 'doj_issuance', 2, 'executive_issuance', 1)
        else '{}'::jsonb
      end as quota
    from users u where u.id = user_id
  ),
  current_counts as (
    select 
      e.type,
      count(*) as current_count
    from kb_entries e
    where e.created_by = user_id and e.created_at::date = target_date
    group by e.type
  )
  select 
    (jsonb_each(uq.quota)).key as entry_type,
    coalesce(cc.current_count, 0) as current_count,
    (jsonb_each(uq.quota)).value::integer as daily_quota,
    coalesce(cc.current_count, 0) < (jsonb_each(uq.quota)).value::integer as can_submit
  from user_quota uq
  cross join jsonb_each(uq.quota)
  left join current_counts cc on cc.type = (jsonb_each(uq.quota)).key
  order by (jsonb_each(uq.quota)).key;
$$;



