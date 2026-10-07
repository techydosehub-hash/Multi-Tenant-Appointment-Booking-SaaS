-- Apply once in the Supabase SQL editor. No browser role can invoke trusted booking/job/billing functions.
create extension if not exists btree_gist with schema extensions;
set search_path = public, extensions;
create schema if not exists private;
revoke all on schema private from public;

create table public.businesses (
 id uuid primary key default gen_random_uuid(), owner_user_id uuid not null references auth.users(id),
 name text not null check(length(name) between 2 and 120), slug text not null unique check(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) between 3 and 64),
 description text not null default '', timezone text not null default 'Asia/Kolkata', currency text not null default 'INR' check(currency in ('INR','USD','EUR','GBP')),
 phone text not null default '', email text not null default '', status text not null default 'active' check(status in ('active','paused')),
 requires_approval boolean not null default false, email_notifications boolean not null default true, sms_notifications boolean not null default false,
 created_at timestamptz not null default now()
);
create table public.business_members (
 id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade, role text not null check(role in ('owner','admin')), created_at timestamptz not null default now(), unique(business_id,user_id)
);
create table public.services (
 id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id), name text not null check(length(name) between 2 and 120),
 description text not null default '', duration_minutes integer not null check(duration_minutes between 5 and 480), price integer not null check(price between 0 and 100000000),
 active boolean not null default true, created_at timestamptz not null default now(), unique(business_id,id)
);
create table public.providers (
 id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id), name text not null check(length(name) between 2 and 120),
 active boolean not null default true, created_at timestamptz not null default now(), unique(business_id,id)
);
create table public.provider_services (
 business_id uuid not null references public.businesses(id), provider_id uuid not null, service_id uuid not null,
 primary key(provider_id,service_id), foreign key(business_id,provider_id) references public.providers(business_id,id), foreign key(business_id,service_id) references public.services(business_id,id)
);
create table public.business_hours (
 id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id), day_of_week integer not null check(day_of_week between 0 and 6),
 start_time time not null, end_time time not null, enabled boolean not null default true, check(end_time > start_time), unique(business_id,day_of_week)
);
create table public.provider_hours (
 id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id), provider_id uuid not null,
 day_of_week integer not null check(day_of_week between 0 and 6), start_time time not null, end_time time not null, enabled boolean not null default true,
 check(end_time > start_time), unique(provider_id,day_of_week), foreign key(business_id,provider_id) references public.providers(business_id,id)
);
create table public.blocked_periods (
 id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id), provider_id uuid,
 starts_at timestamptz not null, ends_at timestamptz not null, reason text not null default '', check(ends_at>starts_at), foreign key(business_id,provider_id) references public.providers(business_id,id)
);
create table public.clients (
 id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id), name text not null,
 email text not null, phone text not null, notes text not null default '', created_at timestamptz not null default now(),
 unique(business_id,email), unique(business_id,id), check(email=lower(trim(email)))
);
create table public.bookings (
 id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id), service_id uuid not null, provider_id uuid not null, client_id uuid not null,
 starts_at timestamptz not null, ends_at timestamptz not null, status text not null check(status in ('pending','confirmed','cancelled','completed','no_show')),
 price integer not null check(price>=0), source text not null default 'public' check(source in ('public','admin')), customer_notes text not null default '',
 request_key uuid not null, request_fingerprint text not null, version integer not null default 1, created_at timestamptz not null default now(),
 check(ends_at>starts_at), unique(business_id,id), unique(business_id,request_key),
 foreign key(business_id,service_id) references public.services(business_id,id), foreign key(business_id,provider_id) references public.providers(business_id,id),
 foreign key(business_id,client_id) references public.clients(business_id,id),
 exclude using gist (provider_id with =, tstzrange(starts_at,ends_at,'[)') with &&) where(status in ('pending','confirmed','completed','no_show'))
);
create table public.booking_events (
 id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id), booking_id uuid not null,
 event_type text not null, actor_id uuid references auth.users(id), metadata jsonb not null default '{}', created_at timestamptz not null default now(),
 foreign key(business_id,booking_id) references public.bookings(business_id,id)
);
create table public.subscriptions (
 id uuid primary key default gen_random_uuid(), business_id uuid not null unique references public.businesses(id),
 provider_customer_id text not null, provider_subscription_id text, plan text not null default 'studio_monthly',
 status text not null default 'trialing' check(status in ('active','trialing','past_due','cancelled','incomplete')),
 current_period_end timestamptz not null default now()+interval '14 days', last_event_at timestamptz, updated_at timestamptz not null default now()
);
create table public.billing_events (
 id text primary key, business_id uuid not null references public.businesses(id), event_type text not null, created_at timestamptz not null default now(), metadata jsonb not null default '{}'
);
create table public.billing_sessions (
 id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id), status text not null default 'pending' check(status in ('pending','completed','expired')),
 expires_at timestamptz not null default now()+interval '30 minutes', created_at timestamptz not null default now()
);
create table public.reminders (
 id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id), booking_id uuid not null,
 channel text not null check(channel in ('email','sms')), template text not null check(template in ('confirmation','reminder','rescheduled','cancelled')),
 booking_version integer not null, scheduled_for timestamptz not null, status text not null default 'queued' check(status in ('queued','processing','sent','failed','skipped')),
 attempts integer not null default 0, sent_at timestamptz, locked_at timestamptz, lease_token uuid, last_error text,
 foreign key(business_id,booking_id) references public.bookings(business_id,id), unique(booking_id,channel,template,booking_version)
);
create table public.notification_logs (
 id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id), booking_id uuid not null,
 reminder_id uuid not null references public.reminders(id), channel text not null, template text not null, status text not null,
 provider_message_id text, error text, created_at timestamptz not null default now(), foreign key(business_id,booking_id) references public.bookings(business_id,id)
);

create index members_user_idx on public.business_members(user_id,business_id);
create index bookings_business_date_idx on public.bookings(business_id,starts_at);
create index bookings_client_idx on public.bookings(business_id,client_id,starts_at);
create index blocks_business_date_idx on public.blocked_periods(business_id,starts_at,ends_at);
create index clients_business_name_idx on public.clients(business_id,lower(name));
create index reminders_due_idx on public.reminders(status,scheduled_for) where status in ('queued','failed','processing');
create index events_booking_idx on public.booking_events(business_id,booking_id,created_at);
create index provider_hours_business_idx on public.provider_hours(business_id);
create index provider_services_business_idx on public.provider_services(business_id);
create index reminders_business_idx on public.reminders(business_id,scheduled_for desc);
create index notification_logs_business_idx on public.notification_logs(business_id,created_at desc);
create index billing_events_business_idx on public.billing_events(business_id,created_at desc);
create index billing_sessions_business_idx on public.billing_sessions(business_id,created_at desc);

create function public.is_member(p_business uuid) returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.business_members where business_id=p_business and user_id=auth.uid() and role in ('owner','admin'))
$$;
create function public.has_access(p_business uuid) returns boolean language sql stable security definer set search_path = '' as $$
 select public.is_member(p_business) and exists(select 1 from public.subscriptions where business_id=p_business and
 ((status in ('active','trialing') and current_period_end>now()) or (status='past_due' and current_period_end+interval '3 days'>now())))
$$;

alter table public.businesses enable row level security;
create policy business_read on public.businesses for select to authenticated using(public.is_member(id));
create policy business_update on public.businesses for update to authenticated using(public.has_access(id)) with check(public.has_access(id));
-- Column grants prevent an owner from changing ownership, IDs or created_at directly.
revoke all on public.businesses from anon,authenticated;
grant select on public.businesses to authenticated;
grant update(name,slug,description,timezone,currency,phone,email,status,requires_approval,email_notifications,sms_notifications) on public.businesses to authenticated;

do $$ declare t text; begin
 foreach t in array array['business_members','services','providers','provider_services','business_hours','provider_hours','blocked_periods','clients','bookings','booking_events','subscriptions','billing_sessions','billing_events','reminders','notification_logs'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon,authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
  execute format('create policy tenant_read on public.%I for select to authenticated using (public.is_member(business_id))',t);
 end loop;
 foreach t in array array['services','providers','provider_services','business_hours','provider_hours','blocked_periods'] loop
  execute format('grant insert,update,delete on public.%I to authenticated',t);
  execute format('create policy tenant_insert on public.%I for insert to authenticated with check (public.has_access(business_id))',t);
  execute format('create policy tenant_update on public.%I for update to authenticated using (public.has_access(business_id)) with check (public.has_access(business_id))',t);
  execute format('create policy tenant_delete on public.%I for delete to authenticated using (public.has_access(business_id))',t);
 end loop;
end $$;
grant update(notes) on public.clients to authenticated;
create policy client_notes on public.clients for update to authenticated using(public.has_access(business_id)) with check(public.has_access(business_id));

-- Serialize scheduling configuration and bookings per business. RLS remains active on normal CRUD.
create function private.lock_tenant() returns trigger language plpgsql set search_path='' as $$
declare b uuid;
begin
 if TG_TABLE_NAME='businesses' then b:=coalesce(new.id,old.id); else b:=coalesce(new.business_id,old.business_id); end if;
 perform pg_advisory_xact_lock(hashtextextended(b::text,0));
 if TG_OP='UPDATE' then
  if TG_TABLE_NAME='businesses' then
   if new.id<>old.id then raise exception 'Immutable tenant'; end if;
   if new.currency<>old.currency and exists(select 1 from public.bookings where business_id=b) then raise exception 'Currency cannot change after bookings exist'; end if;
  elsif new.business_id<>old.business_id then raise exception 'Immutable tenant'; end if;
 end if;
 if TG_TABLE_NAME='businesses' and TG_OP<>'DELETE' then
  if not exists(select 1 from pg_timezone_names where name=new.timezone) then raise exception 'Invalid timezone'; end if;
 end if;
 if TG_OP='DELETE' then return old; end if; return new;
end $$;
do $$ declare t text; begin
 foreach t in array array['businesses','services','providers','provider_services','business_hours','provider_hours','blocked_periods'] loop
  execute format('create trigger lock_schedule before insert or update or delete on public.%I for each row execute function private.lock_tenant()',t);
 end loop;
end $$;

create function public.create_business(p_name text,p_slug text,p_timezone text) returns uuid language plpgsql security definer set search_path='' as $$
declare b uuid;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,1));
 if (select count(*) from public.businesses where owner_user_id=auth.uid())>=5 then raise exception 'Maximum five businesses created per account'; end if;
 insert into public.businesses(owner_user_id,name,slug,timezone) values(auth.uid(),p_name,p_slug,p_timezone) returning id into b;
 insert into public.business_members(business_id,user_id,role) values(b,auth.uid(),'owner');
 insert into public.subscriptions(business_id,provider_customer_id) values(b,'sim_customer_'||b);
 insert into public.business_hours(business_id,day_of_week,start_time,end_time,enabled) select b,d,'09:00'::time,'17:00'::time,d between 1 and 5 from generate_series(0,6) d;
 return b;
end $$;

-- Slots are generated in canonical time and filtered by local wall-clock hours. This correctly
-- omits nonexistent DST times and retains both offsets during a repeated hour.
create function public.available_slots(p_business uuid,p_service uuid,p_date date,p_provider uuid default null,p_exclude uuid default null)
returns table(provider_id uuid,provider_name text,starts_at timestamptz,ends_at timestamptz)
language sql stable security definer set search_path='' as $$
 with config as (
  select b.timezone,s.duration_minutes,h.start_time,h.end_time
  from public.businesses b join public.services s on s.business_id=b.id and s.id=p_service and s.active
  join public.business_hours h on h.business_id=b.id and h.day_of_week=extract(dow from p_date) and h.enabled
  where b.id=p_business and b.status='active'
   and p_date between (now() at time zone b.timezone)::date and (now() at time zone b.timezone)::date+90
 ), candidates as (
  select p.id,p.name,c.*,g as slot,g+make_interval(mins=>c.duration_minutes) as finish,
   ph.id as override_id,ph.enabled as override_enabled,ph.start_time as provider_start,ph.end_time as provider_end
  from config c join public.providers p on p.business_id=p_business and p.active
  join public.provider_services ps on ps.provider_id=p.id and ps.service_id=p_service and ps.business_id=p_business
  left join public.provider_hours ph on ph.provider_id=p.id and ph.day_of_week=extract(dow from p_date)
  cross join lateral generate_series(p_date::timestamp at time zone c.timezone,
   ((p_date+1)::timestamp at time zone c.timezone)-interval '1 minute',interval '1 minute') g
  where p_provider is null or p.id=p_provider
 )
 select c.id,c.name,c.slot,c.finish from candidates c
 where c.slot>now() and extract(minute from c.slot at time zone c.timezone)::integer % 15=0
 and (c.slot at time zone c.timezone)::time>=c.start_time
 and (c.finish at time zone c.timezone)::date=p_date and (c.finish at time zone c.timezone)::time<=c.end_time
 and (c.override_id is null or (c.override_enabled and (c.slot at time zone c.timezone)::time>=c.provider_start and (c.finish at time zone c.timezone)::time<=c.provider_end))
 -- Reject any elapsed minute outside working hours, including unusual DST boundary shifts.
 and not exists(select 1 from generate_series(c.slot,c.finish-interval '1 minute',interval '1 minute') m
   where (m at time zone c.timezone)::date<>p_date or (m at time zone c.timezone)::time<c.start_time or (m at time zone c.timezone)::time>=c.end_time
   or (c.override_id is not null and ((m at time zone c.timezone)::time<c.provider_start or (m at time zone c.timezone)::time>=c.provider_end)))
 and not exists(select 1 from public.blocked_periods x where x.business_id=p_business and (x.provider_id is null or x.provider_id=c.id) and x.starts_at<c.finish and x.ends_at>c.slot)
 and not exists(select 1 from public.bookings x where x.business_id=p_business and x.provider_id=c.id and x.status<>'cancelled' and (p_exclude is null or x.id<>p_exclude) and x.starts_at<c.finish and x.ends_at>c.slot)
 order by c.slot,c.name
$$;

create function private.enqueue(p_booking uuid,p_template text) returns void language plpgsql security definer set search_path='' as $$
declare a public.bookings; b public.businesses; ch text;
begin
 select * into a from public.bookings where id=p_booking;
 select * into b from public.businesses where id=a.business_id;
 foreach ch in array array['email','sms'] loop
  if (ch='email' and b.email_notifications) or (ch='sms' and b.sms_notifications) then
   insert into public.reminders(business_id,booking_id,channel,template,booking_version,scheduled_for)
   values(a.business_id,a.id,ch,p_template,a.version,case when p_template='reminder' then greatest(now(),a.starts_at-interval '24 hours') else now() end)
   on conflict do nothing;
  end if;
 end loop;
end $$;

create function public.create_booking(p_business uuid,p_service uuid,p_provider uuid,p_starts timestamptz,p_name text,p_email text,p_phone text,p_notes text,p_request uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare b public.businesses; s public.services; a public.bookings; c uuid; finish timestamptz; fingerprint text;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_business::text,0));
 select * into b from public.businesses where id=p_business;
 fingerprint:=md5(jsonb_build_array(p_service,p_provider,p_starts,p_name,lower(trim(p_email)),p_phone,p_notes)::text);
 select * into a from public.bookings where business_id=p_business and request_key=p_request;
 if found then
  if a.request_fingerprint<>fingerprint then raise exception 'Idempotency key already used for another request'; end if;
  return jsonb_build_object('id',a.id,'starts_at',a.starts_at,'ends_at',a.ends_at,'status',a.status,'price',a.price,'provider_id',a.provider_id);
 end if;
 select x.ends_at into finish from public.available_slots(p_business,p_service,(p_starts at time zone b.timezone)::date,p_provider) x where x.starts_at=p_starts limit 1;
 if finish is null then raise exception 'Slot no longer available' using errcode='23P01'; end if;
 select * into s from public.services where id=p_service and business_id=p_business;
 insert into public.clients(business_id,name,email,phone) values(p_business,p_name,lower(trim(p_email)),p_phone)
 on conflict(business_id,email) do update set name=excluded.name,phone=excluded.phone returning id into c;
 insert into public.bookings(business_id,service_id,provider_id,client_id,starts_at,ends_at,status,price,customer_notes,request_key,request_fingerprint)
 values(p_business,p_service,p_provider,c,p_starts,finish,case when b.requires_approval then 'pending' else 'confirmed' end,s.price,p_notes,p_request,fingerprint) returning * into a;
 insert into public.booking_events(business_id,booking_id,event_type,metadata) values(p_business,a.id,'created',jsonb_build_object('source','public'));
 perform private.enqueue(a.id,'confirmation'); perform private.enqueue(a.id,'reminder');
 return jsonb_build_object('id',a.id,'starts_at',a.starts_at,'ends_at',a.ends_at,'status',a.status,'price',a.price,'provider_id',a.provider_id);
end $$;

create function public.change_booking(p_business uuid,p_booking uuid,p_actor uuid,p_version integer,p_status text default null,p_starts timestamptz default null,p_provider uuid default null)
returns public.bookings language plpgsql security definer set search_path='' as $$
declare a public.bookings; before_row public.bookings; tz text; finish timestamptz;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_business::text,0));
 if not exists(select 1 from public.business_members where business_id=p_business and user_id=p_actor) then raise exception 'Forbidden' using errcode='42501'; end if;
 if not exists(select 1 from public.subscriptions where business_id=p_business and ((status in ('active','trialing') and current_period_end>now()) or (status='past_due' and current_period_end+interval '3 days'>now()))) then raise exception 'Subscription required' using errcode='42501'; end if;
 select * into a from public.bookings where id=p_booking and business_id=p_business for update;
 if not found then raise exception 'Booking not found' using errcode='P0002'; end if;
 before_row:=a;
 if a.version<>p_version then raise exception 'Booking changed; refresh before retrying' using errcode='PT409'; end if;
 if a.status in ('cancelled','completed','no_show') then raise exception 'Terminal bookings cannot be changed'; end if;
 if p_starts is not null then
  if a.starts_at<=now() then raise exception 'Past appointments cannot be rescheduled'; end if;
  select timezone into tz from public.businesses where id=p_business;
  select x.ends_at into finish from public.available_slots(p_business,a.service_id,(p_starts at time zone tz)::date,coalesce(p_provider,a.provider_id),a.id) x where x.starts_at=p_starts limit 1;
  if finish is null then raise exception 'Slot no longer available' using errcode='23P01'; end if;
  update public.bookings set starts_at=p_starts,ends_at=finish,provider_id=coalesce(p_provider,a.provider_id),version=version+1 where id=a.id returning * into a;
 else
  if not ((a.status='pending' and p_status in ('confirmed','cancelled')) or (a.status='confirmed' and p_status in ('completed','cancelled','no_show'))) then raise exception 'Invalid status transition'; end if;
  if p_status in ('completed','no_show') and a.ends_at>now() then raise exception 'Appointment has not ended yet'; end if;
  update public.bookings set status=p_status,version=version+1 where id=a.id returning * into a;
 end if;
 update public.reminders set status='skipped' where booking_id=a.id and status in ('queued','failed','processing');
 if a.status in ('pending','confirmed') then perform private.enqueue(a.id,'reminder'); end if;
 if p_starts is not null then perform private.enqueue(a.id,'rescheduled');
 elsif a.status='cancelled' then perform private.enqueue(a.id,'cancelled');
 elsif a.status='confirmed' then perform private.enqueue(a.id,'confirmation'); end if;
 insert into public.booking_events(business_id,booking_id,event_type,actor_id,metadata)
 values(p_business,a.id,case when p_starts is null then a.status else 'rescheduled' end,p_actor,
 jsonb_build_object('previous_status',before_row.status,'previous_starts_at',before_row.starts_at,'starts_at',a.starts_at,'version',a.version));
 return a;
end $$;

-- security_invoker views apply the caller's base-table RLS.
create view public.client_metrics with (security_invoker=true) as
 select c.*,coalesce(m.lifetime_value,0) as lifetime_value,coalesce(m.booking_count,0) as booking_count,m.last_appointment,m.next_appointment
 from public.clients c left join lateral (
 select sum(price) filter(where status='completed') as lifetime_value,count(*) as booking_count,
 max(starts_at) filter(where status='completed') as last_appointment,
 min(starts_at) filter(where status in ('pending','confirmed') and starts_at>now()) as next_appointment
 from public.bookings b where b.business_id=c.business_id and b.client_id=c.id
 ) m on true;
grant select on public.client_metrics to authenticated;
revoke all on public.client_metrics from anon;

create function public.dashboard_metrics(p_business uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object(
 'today',(select count(*) from public.bookings a join public.businesses b on b.id=a.business_id where a.business_id=p_business and (a.starts_at at time zone b.timezone)::date=(now() at time zone b.timezone)::date),
 'upcoming',(select count(*) from public.bookings where business_id=p_business and status in ('pending','confirmed') and starts_at between now() and now()+interval '7 days'),
 'revenue',(select coalesce(sum(price),0) from public.bookings where business_id=p_business and status='completed'),
 'clients',(select count(*) from public.clients where business_id=p_business),
 'no_show_rate',(select coalesce(round(100.0*count(*) filter(where status='no_show')/nullif(count(*) filter(where status in ('completed','no_show')),0),1),0) from public.bookings where business_id=p_business))
$$;

create function public.complete_checkout(p_business uuid,p_session uuid,p_actor uuid) returns public.subscriptions language plpgsql security definer set search_path='' as $$
declare s public.subscriptions; c public.billing_sessions;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_business::text,0));
 if not exists(select 1 from public.business_members where business_id=p_business and user_id=p_actor and role='owner') then raise exception 'Owner access required' using errcode='42501'; end if;
 select * into c from public.billing_sessions where id=p_session and business_id=p_business for update;
 if not found or (c.status<>'completed' and c.expires_at<now()) then raise exception 'Checkout expired or missing'; end if;
 if c.status='completed' then select * into s from public.subscriptions where business_id=p_business; return s; end if;
 update public.subscriptions set status='active',provider_subscription_id='sim_subscription_'||p_business,current_period_end=now()+interval '1 month',last_event_at=now(),updated_at=now() where business_id=p_business returning * into s;
 update public.billing_sessions set status='completed' where id=p_session;
 insert into public.billing_events(id,business_id,event_type) values('checkout_'||p_session,p_business,'simulation.checkout.completed') on conflict do nothing;
 return s;
end $$;

create function public.apply_billing_event(p_id text,p_business uuid,p_status text,p_period timestamptz,p_created timestamptz) returns text language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(p_business::text,0));
 if exists(select 1 from public.billing_events where id=p_id) then return 'duplicate'; end if;
 if not exists(select 1 from public.subscriptions where business_id=p_business) then raise exception 'Subscription missing'; end if;
 insert into public.billing_events(id,business_id,event_type,metadata) values(p_id,p_business,'simulation.subscription.'||p_status,jsonb_build_object('created',p_created));
 update public.subscriptions set status=p_status,current_period_end=p_period,last_event_at=p_created,updated_at=now()
 where business_id=p_business and (last_event_at is null or last_event_at<p_created);
 return 'processed';
end $$;

-- SKIP LOCKED leases permit concurrent schedulers; retry a crashed lease after five minutes.
create function public.claim_notifications() returns setof public.reminders language plpgsql security definer set search_path='' as $$
begin
 update public.reminders set status='failed',last_error='Retry limit reached' where status='processing' and locked_at<now()-interval '5 minutes' and attempts>=3;
 return query with due as (
  select id from public.reminders where attempts<3 and scheduled_for<=now() and
  (status in ('queued','failed') or (status='processing' and locked_at<now()-interval '5 minutes'))
  order by scheduled_for limit 50 for update skip locked
 ) update public.reminders r set status='processing',attempts=attempts+1,locked_at=now(),lease_token=gen_random_uuid()
 from due where r.id=due.id returning r.*;
end $$;

-- Mock adapter finalization is transactional: the log is the simulated delivery, so no external
-- side effect can occur between revalidation and marking sent.
create function public.deliver_mock_notification(p_id uuid,p_lease uuid) returns text language plpgsql security definer set search_path='' as $$
declare r public.reminders; a public.bookings; b public.businesses;
begin
 select * into r from public.reminders where id=p_id;
 if not found then return 'missing'; end if;
 perform pg_advisory_xact_lock(hashtextextended(r.business_id::text,0));
 select * into r from public.reminders where id=p_id for update;
 if r.status<>'processing' or r.lease_token is distinct from p_lease then return 'stale'; end if;
 select * into a from public.bookings where id=r.booking_id;
 select * into b from public.businesses where id=r.business_id;
 if a.version<>r.booking_version or (r.template<>'cancelled' and a.status not in ('pending','confirmed')) or (r.template='reminder' and a.starts_at<=now())
 or (r.channel='email' and not b.email_notifications) or (r.channel='sms' and not b.sms_notifications) then
  update public.reminders set status='skipped' where id=r.id; return 'skipped';
 end if;
 insert into public.notification_logs(business_id,booking_id,reminder_id,channel,template,status,provider_message_id)
 values(r.business_id,r.booking_id,r.id,r.channel,r.template,'simulated','mock_'||r.id);
 update public.reminders set status='sent',sent_at=now(),last_error=null where id=r.id;
 return 'simulated';
end $$;

create function public.fail_notification(p_id uuid,p_lease uuid) returns void language plpgsql security definer set search_path='' as $$
declare r public.reminders;
begin
 update public.reminders set status='failed',last_error='Adapter delivery failed',scheduled_for=now()+interval '5 minutes'
 where id=p_id and lease_token=p_lease and status='processing' returning * into r;
 if found then insert into public.notification_logs(business_id,booking_id,reminder_id,channel,template,status,error)
 values(r.business_id,r.booking_id,r.id,r.channel,r.template,'failed','Adapter delivery failed'); end if;
end $$;

-- Default PostgreSQL functions are executable by PUBLIC; explicitly close that boundary.
revoke all on all functions in schema private from public,anon,authenticated;
revoke all on function public.is_member(uuid),public.has_access(uuid),public.create_business(text,text,text),public.dashboard_metrics(uuid) from public,anon;
grant execute on function public.is_member(uuid),public.has_access(uuid),public.create_business(text,text,text),public.dashboard_metrics(uuid) to authenticated;
revoke all on function public.available_slots(uuid,uuid,date,uuid,uuid),public.create_booking(uuid,uuid,uuid,timestamptz,text,text,text,text,uuid),
 public.change_booking(uuid,uuid,uuid,integer,text,timestamptz,uuid),public.complete_checkout(uuid,uuid,uuid),public.apply_billing_event(text,uuid,text,timestamptz,timestamptz),
 public.claim_notifications(),public.deliver_mock_notification(uuid,uuid),public.fail_notification(uuid,uuid) from public,anon,authenticated;
grant execute on function public.available_slots(uuid,uuid,date,uuid,uuid),public.create_booking(uuid,uuid,uuid,timestamptz,text,text,text,text,uuid),
 public.change_booking(uuid,uuid,uuid,integer,text,timestamptz,uuid),public.complete_checkout(uuid,uuid,uuid),public.apply_billing_event(text,uuid,text,timestamptz,timestamptz),
 public.claim_notifications(),public.deliver_mock_notification(uuid,uuid),public.fail_notification(uuid,uuid) to service_role;
grant all on all tables in schema public to service_role;
