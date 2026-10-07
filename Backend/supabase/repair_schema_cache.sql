-- Safe to run after the application schema already exists. Does not drop/create records.
-- First inspect whether the tables exist in this exact project; an empty table is valid.
select
  to_regclass('public.businesses') as businesses,
  to_regclass('public.business_members') as business_members,
  to_regclass('public.client_metrics') as client_metrics;

-- If all are present, request a PostgREST metadata reload, then refresh the application.
notify pgrst, 'reload schema';

-- If any result is NULL, apply the complete initial migration only to an empty schema.
-- Never create only business_members or disable RLS to work around a setup error.
