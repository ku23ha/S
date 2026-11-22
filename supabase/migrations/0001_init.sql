-- 0001_init.sql: The World's Best Registry, initial schema.
-- Source of truth: docs/DATA_MODEL.md. Do not change the partial unique
-- indexes; they are what enforces one active holder per title.

create extension if not exists pgcrypto;
create sequence registry_no_seq start 1;

create table titles (
  id uuid primary key default gen_random_uuid(),
  title_key text not null,          -- normalised remainder, e.g. 'dad'
  title_display text not null,      -- as typed, e.g. 'Dad'
  slug text not null,               -- e.g. 'dad', 'parallel-parker'
  tier text not null check (tier in ('standard','popular','iconic')),
  status text not null check (status in
    ('reserved','claimed','in_review','rejected','removed','expired')),
  registry_no bigint unique,        -- nextval on claim, never reused
  recipient_name text not null,
  giver_name text,
  dedication text,
  addon_print boolean not null default false,
  buyer_email text not null,
  price_cents integer not null,
  currency text not null default 'USD',
  checkout_id text unique,
  payment_id text unique,
  manage_token text not null,
  ref_title_id uuid references titles(id),  -- certificate that led to this sale
  reserved_until timestamptz,
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One active holder per title. This index is the product.
create unique index titles_one_holder on titles (title_key)
  where status in ('reserved','claimed','in_review');
create unique index titles_slug_active on titles (slug)
  where status in ('reserved','claimed','in_review');
create index titles_recent on titles (claimed_at desc) where status = 'claimed';

create table tier_titles (
  title_key text primary key,
  tier text not null check (tier in ('popular','iconic'))
);

create table blocked_terms (term text primary key);

create table certificate_views (
  title_id uuid not null references titles(id),
  viewer_hash text not null,        -- salted hash of IP and user agent, rotated daily
  day date not null,
  primary key (title_id, viewer_hash, day)
);

create table reports (
  id uuid primary key default gen_random_uuid(),
  title_id uuid not null references titles(id),
  reason text not null,
  reporter_email text,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

create table webhook_events (
  event_id text primary key,        -- provider event id, for idempotency
  type text not null,
  payload jsonb not null,
  received_at timestamptz not null default now()
);

create table rate_limits (
  bucket text not null,
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (bucket, window_start)
);

-- Row level security on every table with no public policies.
-- Only server code using the service key touches the database.
alter table titles enable row level security;
alter table tier_titles enable row level security;
alter table blocked_terms enable row level security;
alter table certificate_views enable row level security;
alter table reports enable row level security;
alter table webhook_events enable row level security;
alter table rate_limits enable row level security;
