-- Apply after 001 to the existing database. Preserves rows, RLS and privileges.
-- A stale UI version is a domain conflict, not a serialization failure.
begin;
create or replace function public.change_booking(p_business uuid,p_booking uuid,p_actor uuid,p_version integer,p_status text default null,p_starts timestamptz default null,p_provider uuid default null)
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
-- Shared/demo memberships must not consume the creator's business allowance.
create or replace function public.create_business(p_name text,p_slug text,p_timezone text) returns uuid language plpgsql security definer set search_path='' as $$
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
notify pgrst, 'reload schema';
commit;

