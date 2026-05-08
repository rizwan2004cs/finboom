-- Notifications table (in-app)
create table if not exists notifications (
  id uuid default gen_random_uuid() primary key,
  user_id text not null,
  type text not null,
  title text not null,
  body text not null,
  data jsonb default '{}',
  read boolean default false,
  created_at timestamptz default now()
);

create index if not exists idx_notifications_user_id on notifications(user_id);
create index if not exists idx_notifications_read on notifications(user_id, read);

-- Push subscriptions table
create table if not exists push_subscriptions (
  id uuid default gen_random_uuid() primary key,
  user_id text not null,
  endpoint text not null unique,
  keys_p256dh text not null,
  keys_auth text not null,
  created_at timestamptz default now()
);

create index if not exists idx_push_subscriptions_user_id on push_subscriptions(user_id);

-- RLS
alter table notifications enable row level security;
alter table push_subscriptions enable row level security;

create policy "Users can manage their own notifications" on notifications
  for all using (true) with check (true);

create policy "Users can manage their own push_subscriptions" on push_subscriptions
  for all using (true) with check (true);
