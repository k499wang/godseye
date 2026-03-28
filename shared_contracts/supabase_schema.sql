-- Supabase / Postgres schema for the shared backend models.
-- Source-of-truth priority used here:
-- 1. SHARED_CONTRACTS.md
-- 2. TEAM_DIVISION.md
-- 3. ARCHITECTURE_FLOW.md
--
-- Key resolution:
-- - Column names use `session_id` everywhere.
-- - The session table is named `analysis_sessions` to fit the wider docs.
-- - Extra internal columns like `updated_at` are included where useful for backend ops.

create extension if not exists pgcrypto;

drop trigger if exists set_markets_updated_at on public.markets;
drop trigger if exists set_analysis_sessions_updated_at on public.analysis_sessions;
drop trigger if exists set_claims_updated_at on public.claims;
drop trigger if exists set_simulations_updated_at on public.simulations;
drop trigger if exists set_agents_updated_at on public.agents;
drop trigger if exists set_claim_shares_updated_at on public.claim_shares;
drop trigger if exists set_reports_updated_at on public.reports;

drop function if exists public.set_updated_at();

drop table if exists public.reports cascade;
drop table if exists public.claim_shares cascade;
drop table if exists public.agents cascade;
drop table if exists public.simulations cascade;
drop table if exists public.claims cascade;
drop table if exists public.analysis_sessions cascade;
drop table if exists public.markets cascade;

drop type if exists public.claim_stance cascade;
drop type if exists public.simulation_status cascade;
drop type if exists public.agent_archetype cascade;

create type public.claim_stance as enum ('yes', 'no');

create type public.simulation_status as enum (
  'pending',
  'building',
  'running',
  'complete',
  'failed'
);

create type public.agent_archetype as enum (
  'bayesian_updater',
  'trend_follower',
  'contrarian',
  'data_skeptic',
  'narrative_focused',
  'quantitative_analyst'
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table public.markets (
  id uuid primary key default gen_random_uuid(),
  polymarket_id text not null unique,
  question text not null,
  resolution_criteria text not null,
  current_probability numeric(6, 5) not null check (current_probability >= 0 and current_probability <= 1),
  volume numeric(14, 2) not null default 0 check (volume >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

comment on table public.markets is 'Imported Polymarket market snapshot used to anchor a session.';
comment on column public.markets.polymarket_id is 'Polymarket slug or external market identifier.';

create table public.analysis_sessions (
  id uuid primary key default gen_random_uuid(),
  market_id uuid not null references public.markets(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (market_id)
);

comment on table public.analysis_sessions is 'One analysis session created alongside each imported market.';

create table public.claims (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.analysis_sessions(id) on delete cascade,
  market_id uuid not null references public.markets(id) on delete cascade,
  text text not null,
  stance public.claim_stance not null,
  strength_score numeric(4, 3) not null check (strength_score >= 0 and strength_score <= 1),
  novelty_score numeric(4, 3) not null check (novelty_score >= 0 and novelty_score <= 1),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

comment on table public.claims is 'Shared claim pool generated once per session.';

create table public.simulations (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.analysis_sessions(id) on delete cascade,
  market_id uuid not null references public.markets(id) on delete cascade,
  status public.simulation_status not null default 'pending',
  current_tick integer not null default 0 check (current_tick >= 0 and current_tick <= 30),
  total_ticks integer not null default 30 check (total_ticks > 0 and total_ticks <= 30),
  tick_data jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz null
);

comment on table public.simulations is 'Simulation state; tick_data stores TickSnapshot objects.';

create table public.agents (
  id uuid primary key default gen_random_uuid(),
  simulation_id uuid not null references public.simulations(id) on delete cascade,
  name text not null,
  archetype public.agent_archetype not null,
  initial_belief numeric(4, 3) not null check (initial_belief >= 0 and initial_belief <= 1),
  current_belief numeric(4, 3) not null check (current_belief >= 0 and current_belief <= 1),
  confidence numeric(4, 3) not null check (confidence >= 0 and confidence <= 1),
  professional_background jsonb not null default '{}'::jsonb,
  trust_scores jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

comment on table public.agents is 'Agents generated during world-building. trust_scores is a JSON object keyed by other agent ids.';

create table public.claim_shares (
  id uuid primary key default gen_random_uuid(),
  simulation_id uuid not null references public.simulations(id) on delete cascade,
  from_agent_id uuid not null references public.agents(id) on delete cascade,
  to_agent_id uuid not null references public.agents(id) on delete cascade,
  claim_id uuid not null references public.claims(id) on delete cascade,
  commentary text not null,
  tick_number integer not null check (tick_number >= 1 and tick_number <= 30),
  delivered boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (from_agent_id <> to_agent_id)
);

comment on table public.claim_shares is 'Directed claim shares created on one tick and delivered on the next.';

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  simulation_id uuid not null unique references public.simulations(id) on delete cascade,
  market_probability numeric(6, 5) not null check (market_probability >= 0 and market_probability <= 1),
  simulation_probability numeric(6, 5) not null check (simulation_probability >= 0 and simulation_probability <= 1),
  summary text not null,
  key_drivers jsonb not null default '[]'::jsonb,
  faction_analysis text not null,
  trust_insights text not null,
  recommendation text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

comment on table public.reports is 'Final generated report for a completed simulation.';
comment on column public.reports.key_drivers is 'JSON array of strings.';

create index idx_analysis_sessions_market_id on public.analysis_sessions (market_id);

create index idx_claims_session_id on public.claims (session_id);
create index idx_claims_market_id on public.claims (market_id);
create index idx_claims_stance on public.claims (stance);
create index idx_claims_session_stance on public.claims (session_id, stance);

create index idx_simulations_session_id on public.simulations (session_id);
create index idx_simulations_market_id on public.simulations (market_id);
create index idx_simulations_status on public.simulations (status);

create index idx_agents_simulation_id on public.agents (simulation_id);
create index idx_agents_archetype on public.agents (archetype);

create index idx_claim_shares_simulation_id on public.claim_shares (simulation_id);
create index idx_claim_shares_to_agent_id on public.claim_shares (to_agent_id);
create index idx_claim_shares_from_agent_id on public.claim_shares (from_agent_id);
create index idx_claim_shares_claim_id on public.claim_shares (claim_id);
create index idx_claim_shares_tick_delivered on public.claim_shares (simulation_id, tick_number, delivered);

create trigger set_markets_updated_at
before update on public.markets
for each row
execute function public.set_updated_at();

create trigger set_analysis_sessions_updated_at
before update on public.analysis_sessions
for each row
execute function public.set_updated_at();

create trigger set_claims_updated_at
before update on public.claims
for each row
execute function public.set_updated_at();

create trigger set_simulations_updated_at
before update on public.simulations
for each row
execute function public.set_updated_at();

create trigger set_agents_updated_at
before update on public.agents
for each row
execute function public.set_updated_at();

create trigger set_claim_shares_updated_at
before update on public.claim_shares
for each row
execute function public.set_updated_at();

create trigger set_reports_updated_at
before update on public.reports
for each row
execute function public.set_updated_at();

-- Optional future RLS:
-- alter table public.markets enable row level security;
-- alter table public.analysis_sessions enable row level security;
-- alter table public.claims enable row level security;
-- alter table public.simulations enable row level security;
-- alter table public.agents enable row level security;
-- alter table public.claim_shares enable row level security;
-- alter table public.reports enable row level security;
