begin;
-- Demo workspace ownership is real, but it must not consume the five-business allowance.
-- Only the server can set raw_app_meta_data; editable user metadata is not trusted.
create or replace function public.create_business(p_name text,p_slug text,p_timezone text) returns uuid language plpgsql security definer set search_path='' as $$
declare b uuid; demo_id uuid; guest boolean;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,1));
 select coalesce((raw_app_meta_data->>'demo_guest')::boolean,false),
   nullif(raw_app_meta_data#>>'{steadly_demo,business_id}','')::uuid
 into guest,demo_id from auth.users where id=auth.uid();
 if guest then raise exception 'Create your own account to create a real workspace' using errcode='42501'; end if;
 if (select count(*) from public.businesses where owner_user_id=auth.uid() and id is distinct from demo_id)>=5 then raise exception 'Maximum five businesses created per account'; end if;
 insert into public.businesses(owner_user_id,name,slug,timezone) values(auth.uid(),p_name,p_slug,p_timezone) returning id into b;
 insert into public.business_members(business_id,user_id,role) values(b,auth.uid(),'owner');
 insert into public.subscriptions(business_id,provider_customer_id) values(b,'sim_customer_'||b);
 insert into public.business_hours(business_id,day_of_week,start_time,end_time,enabled) select b,d,'09:00'::time,'17:00'::time,d between 1 and 5 from generate_series(0,6) d;
 return b;
end $$;
notify pgrst, 'reload schema';
commit;
