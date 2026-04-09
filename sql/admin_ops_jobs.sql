create extension if not exists pgcrypto;

create table if not exists public.admin_ops_jobs (
  id uuid primary key default gen_random_uuid(),
  job_type text not null check (job_type in ('collect', 'map', 'listing', 'summary', 'postprocess', 'all')),
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check (status in ('queued', 'running', 'completed', 'failed')),
  step_results jsonb not null default '[]'::jsonb,
  result_json jsonb,
  error_message text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_admin_ops_jobs_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_admin_ops_jobs_updated_at on public.admin_ops_jobs;

create trigger trg_admin_ops_jobs_updated_at
before update on public.admin_ops_jobs
for each row
execute function public.set_admin_ops_jobs_updated_at();

create index if not exists idx_admin_ops_jobs_status_created_at
  on public.admin_ops_jobs (status, created_at asc);

create index if not exists idx_admin_ops_jobs_status_updated_at
  on public.admin_ops_jobs (status, updated_at asc);

create index if not exists idx_admin_ops_jobs_created_at_desc
  on public.admin_ops_jobs (created_at desc);
