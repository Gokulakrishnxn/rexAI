-- 1. Medications (The "Doctor's Intent")
create table if not exists medications (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  document_id uuid references documents(id) on delete set null,
  
  drug_name text not null,
  normalized_name text,
  form text,
  dosage text,
  
  frequency_text text,
  duration_days integer default 7,
  
  instructions text,
  
  confidence_score float default 1.0,
  status text default 'draft' check (status in ('draft', 'active', 'archived')),
  
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Medication Schedules (The "Execution Plan")
create table if not exists medication_schedules (
  id uuid default gen_random_uuid() primary key,
  medication_id uuid references medications(id) on delete cascade not null,
  user_id uuid references public.users(id) on delete cascade not null,
  
  start_date date not null,
  end_date date,
  
  times_per_day integer default 1,
  exact_times jsonb default '[]'::jsonb,
  
  active boolean default true,
  adherence_rate integer default 0,
  
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Medication Intakes (The "Daily Log")
create table if not exists medication_intakes (
  id uuid default gen_random_uuid() primary key,
  schedule_id uuid references medication_schedules(id) on delete cascade not null,
  user_id uuid references public.users(id) on delete cascade not null,
  
  scheduled_time timestamp with time zone not null,
  taken_time timestamp with time zone,
  
  status text default 'pending' check (status in ('pending', 'taken', 'skipped', 'missed')),
  
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS (Safe to re-run)
alter table medications enable row level security;
alter table medication_schedules enable row level security;
alter table medication_intakes enable row level security;

-- Policies (Drop first to avoid "already exists" error)
drop policy if exists "Users can CRUD their own medications" on medications;
create policy "Users can CRUD their own medications"
  on medications for all
  using (auth.uid() = user_id);

drop policy if exists "Users can CRUD their own schedules" on medication_schedules;
create policy "Users can CRUD their own schedules"
  on medication_schedules for all
  using (auth.uid() = user_id);

drop policy if exists "Users can CRUD their own intakes" on medication_intakes;
create policy "Users can CRUD their own intakes"
  on medication_intakes for all
  using (auth.uid() = user_id);

-- Indexing (If not exists logic for indexes requires specific SQL or just tolerate error. 
-- In Postgres, CREATE INDEX IF NOT EXISTS is supported in newer versions, 
-- but a simple workaround is usually fine or ignoring it.)
create index if not exists idx_meds_user on medications(user_id);
create index if not exists idx_schedules_user on medication_schedules(user_id);
create index if not exists idx_intakes_schedule on medication_intakes(schedule_id);
create index if not exists idx_intakes_date on medication_intakes(scheduled_time);
