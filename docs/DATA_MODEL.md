# Data model

The schema lives in `supabase/migrations/0001_init.sql`. Seeds live in `supabase/seed/`.

## Schema

```sql
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
```

Row level security is enabled on every table with no public policies. Only server code using the service key touches the database.

## Title rules (implement exactly)
- The prefix "World's Best" is fixed and never stored.
- Input remainder: 2 to 40 characters; letters, numbers, spaces, apostrophes, hyphens.
- title_key: Unicode NFKC, lower case, strip apostrophes and punctuation, collapse whitespace, trim.
- title_display: the user's text in Title Case, trimmed.
- slug: title_key with spaces replaced by hyphens.
- Reject input containing URLs, emails, phone numbers, @handles or blocked terms.
- Tier: look up title_key in tier_titles; default is standard.
- Variants for a taken title: append "Ever", prepend one adjective from a fixed list, append "in" plus a placeholder the user completes. Return only variants that are free.

## Reservation and claim flow (implement exactly)
1. POST /api/checkout runs in one transaction: expire stale reservations for the key, insert a row with status reserved and reserved_until = now + 15 minutes, then create the hosted checkout. A unique violation means the title is taken.
2. The payment webhook verifies the signature, inserts into webhook_events (conflict means stop), then:
   - if the reservation row is still reserved: run moderation; set status claimed or in_review; assign registry_no from the sequence; set claimed_at; send the email.
   - if the row has expired and the title is still free: reclaim it the same way.
   - if the title is now held by someone else: refund through the provider and email the buyer with free variants.
3. A refund or chargeback event sets status removed and frees the title.
