-- 0002_admin_analytics.sql: additive columns and indexes for Milestone 5.
-- The one-holder partial unique indexes from 0001 are untouched.

-- Anonymous PostHog distinct id of the buyer's browser session, so the
-- server-side claim_completed event joins the same funnel. Not personal data.
alter table titles add column if not exists analytics_id text;

-- Why an admin removed or rejected a certificate.
alter table titles add column if not exists removal_reason text;

-- Manage-link lookups.
create index if not exists titles_manage_token on titles (manage_token);

-- Open reports per certificate, for the admin queue and auto-hide rule.
create index if not exists reports_open on reports (title_id) where not resolved;

-- Daily stats and loop metrics.
create index if not exists certificate_views_day on certificate_views (day);
create index if not exists rate_limits_window on rate_limits (window_start);
