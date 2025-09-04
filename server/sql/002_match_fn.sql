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
language plpgsql
stable
as $$
declare
  quota_record record;
  current_count_val bigint;
begin
  -- Get user's quota configuration
  select 
    case 
      when u.person_id = 'P1' then jsonb_build_object('statute_section', 7, 'city_ordinance_section', 3)
      when u.person_id = 'P2' then jsonb_build_object('rule_of_court', 7, 'doj_issuance', 2, 'rights_advisory', 1)
      when u.person_id = 'P3' then jsonb_build_object('pnp_sop', 5, 'incident_checklist', 3, 'agency_circular', 2)
      when u.person_id = 'P4' then jsonb_build_object('statute_section', 8, 'agency_circular', 2)
      when u.person_id = 'P5' then jsonb_build_object('rights_advisory', 4, 'constitution_provision', 3, 'doj_issuance', 2, 'executive_issuance', 1)
      else '{}'::jsonb
    end as quota
  into quota_record
  from users u where u.id = user_id;
  
  -- Return quota for each entry type
  for quota_record in 
    select key as entry_type, value::integer as daily_quota
    from jsonb_each(quota_record.quota)
  loop
    -- Get current count for this entry type
    select count(*) into current_count_val
    from kb_entries e
    where e.created_by = user_id 
      and e.created_at::date = target_date
      and e.type = quota_record.entry_type;
    
    -- Return the record
    entry_type := quota_record.entry_type;
    current_count := coalesce(current_count_val, 0);
    daily_quota := quota_record.daily_quota;
    can_submit := coalesce(current_count_val, 0) < quota_record.daily_quota;
    return next;
  end loop;
end;
$$;



