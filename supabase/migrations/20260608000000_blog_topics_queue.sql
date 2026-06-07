-- Queue of blog topics for automated publishing.
create table if not exists public.blog_topics (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  normalized_title text not null unique,
  source text not null default 'pdf_seed',
  status text not null default 'pending' check (status in ('pending', 'posted', 'skipped')),
  sort_order integer not null default 1000,
  notes text,
  published_title text,
  published_slug text,
  posted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_blog_topics_status_order on public.blog_topics(status, sort_order, created_at);

create or replace function public.set_blog_topics_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_updated_at_blog_topics on public.blog_topics;
create trigger set_updated_at_blog_topics
before update on public.blog_topics
for each row execute function public.set_blog_topics_updated_at();

alter table public.blog_topics enable row level security;

drop policy if exists "Service role can manage blog topics" on public.blog_topics;
create policy "Service role can manage blog topics"
  on public.blog_topics for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "Authenticated can read blog topics" on public.blog_topics;
create policy "Authenticated can read blog topics"
  on public.blog_topics for select
  using (auth.role() = 'authenticated');

grant select on public.blog_topics to authenticated;
grant all on public.blog_topics to service_role;
