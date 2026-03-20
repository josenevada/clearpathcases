
-- Create tables
create table public.firms (
  id uuid primary key default gen_random_uuid(),
  name text not null default '',
  primary_contact_name text default '',
  primary_contact_email text default '',
  phone text default '',
  slug text unique,
  default_paralegal text default '',
  default_attorney text default '',
  created_at timestamptz default now()
);

create table public.users (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid references public.firms(id) on delete cascade,
  email text unique not null,
  full_name text not null,
  role text not null check (role in ('super_admin', 'paralegal', 'attorney')),
  created_at timestamptz default now(),
  last_sign_in timestamptz
);

create table public.cases (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid references public.firms(id) on delete cascade,
  client_name text not null,
  client_email text not null,
  client_phone text,
  chapter_type text not null,
  filing_deadline date not null,
  assigned_paralegal_id uuid references public.users(id),
  assigned_attorney_id uuid references public.users(id),
  assigned_paralegal text default '',
  assigned_attorney text default '',
  created_at timestamptz default now(),
  last_client_activity timestamptz,
  urgency text default 'normal',
  wizard_step integer default 0,
  ready_to_file boolean default false,
  case_code text unique
);

create table public.checklist_items (
  id uuid primary key default gen_random_uuid(),
  case_id uuid references public.cases(id) on delete cascade not null,
  category text not null,
  label text not null,
  description text default '',
  why_we_need_this text default '',
  required boolean default true,
  completed boolean default false,
  flagged_for_attorney boolean default false,
  attorney_note text,
  input_type text default 'file' check (input_type in ('file', 'text')),
  text_value jsonb,
  sort_order integer default 0,
  correction_reason text,
  correction_details text,
  correction_requested_by text,
  correction_requested_at timestamptz,
  correction_target_file_id text,
  correction_status text check (correction_status in ('open', 'resolved')),
  resubmitted_at timestamptz
);

create table public.files (
  id uuid primary key default gen_random_uuid(),
  checklist_item_id uuid references public.checklist_items(id) on delete cascade not null,
  case_id uuid references public.cases(id) on delete cascade not null,
  file_name text not null,
  storage_path text,
  data_url text default '',
  uploaded_by text default 'client',
  uploaded_at timestamptz default now(),
  review_status text default 'pending' check (review_status in ('pending', 'approved', 'correction-requested', 'overridden')),
  review_note text
);

create table public.activity_log (
  id uuid primary key default gen_random_uuid(),
  case_id uuid references public.cases(id) on delete cascade not null,
  event_type text not null,
  actor_role text,
  actor_name text,
  description text,
  item_id text,
  created_at timestamptz default now()
);

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  case_id uuid references public.cases(id) on delete cascade not null,
  author_name text,
  author_role text,
  content text,
  visibility text default 'internal' check (visibility in ('internal', 'client_visible')),
  created_at timestamptz default now()
);

create table public.checkpoints (
  id uuid primary key default gen_random_uuid(),
  case_id uuid references public.cases(id) on delete cascade not null,
  checkpoint_type text not null,
  completed_at timestamptz default now(),
  confirmed_by text
);

-- Storage bucket
insert into storage.buckets (id, name, public) values ('case-documents', 'case-documents', false);

-- Enable RLS on all tables
alter table public.firms enable row level security;
alter table public.users enable row level security;
alter table public.cases enable row level security;
alter table public.checklist_items enable row level security;
alter table public.files enable row level security;
alter table public.activity_log enable row level security;
alter table public.notes enable row level security;
alter table public.checkpoints enable row level security;

-- Permissive policies (to be tightened when authentication is added)
create policy "firms_all" on public.firms for all to anon, authenticated using (true) with check (true);
create policy "users_all" on public.users for all to anon, authenticated using (true) with check (true);
create policy "cases_all" on public.cases for all to anon, authenticated using (true) with check (true);
create policy "checklist_items_all" on public.checklist_items for all to anon, authenticated using (true) with check (true);
create policy "files_all" on public.files for all to anon, authenticated using (true) with check (true);
create policy "activity_log_all" on public.activity_log for all to anon, authenticated using (true) with check (true);
create policy "notes_all" on public.notes for all to anon, authenticated using (true) with check (true);
create policy "checkpoints_all" on public.checkpoints for all to anon, authenticated using (true) with check (true);

-- Storage policy
create policy "case_documents_all" on storage.objects for all to anon, authenticated using (bucket_id = 'case-documents') with check (bucket_id = 'case-documents');
