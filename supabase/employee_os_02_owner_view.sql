-- ============================================================================
-- EMPLOYEE OS — owner opens an employee's OS (run after employee_os.sql)
-- ============================================================================
-- Lets Rolando step into an employee's actual OS from Team → Field team →
-- "Open <name>'s OS", without knowing the employee's PIN (PINs are stored
-- hashed, so nobody can read them back). Owner-only: the function refuses
-- anyone whose workspace role is not 'owner'. The session it creates lasts
-- 12 hours and is ended when Rolando taps Close. Safe to re-run.

create or replace function public.emp_owner_session(p_employee uuid)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare v_token text;
begin
  if public.ws_role() is distinct from 'owner' then
    raise exception 'owner_only' using errcode = '42501';
  end if;
  if not exists (select 1 from public.emp_employees where id = p_employee) then
    raise exception 'no_such_employee';
  end if;
  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.emp_sessions (token_hash, employee_id, expires_at)
  values (encode(extensions.digest(v_token, 'sha256'), 'hex'), p_employee, now() + interval '12 hours');
  return v_token;
end $$;
