create table if not exists public.admin_ops_jobs (
  id uuid primary key default gen_random_uuid(),
  job_type text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued',
  step_results jsonb not null default '[]'::jsonb,
  result_json jsonb null,
  error_message text null,
  started_at timestamptz null,
  finished_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_admin_ops_jobs_status_created_at
  on public.admin_ops_jobs (status, created_at);

create index if not exists idx_admin_ops_jobs_status_updated_at
  on public.admin_ops_jobs (status, updated_at);

create index if not exists idx_admin_ops_jobs_created_at_desc
  on public.admin_ops_jobs (created_at desc);
