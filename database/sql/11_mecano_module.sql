-- ============================================================================
-- LOST MC OS - APPLICATION ATELIER MÉCANIQUE
-- Fichier : 11_mecano_module.sql
-- À exécuter après 10_bar_module.sql
--
-- Même principe que le module Bar : totalement indépendant, visible
-- uniquement par les membres ayant une fonction (ex: "Mécanicien", "Gérant
-- Mécano") ou un grade avec permission sur le module 'mecano'.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- TABLES
-- ----------------------------------------------------------------------------
create table if not exists public.mecano_treasury_transactions (
    id              uuid primary key default gen_random_uuid(),
    type            text not null check (type in ('entree','sortie')),
    amount          numeric(14,2) not null check (amount > 0),
    comment         text,
    balance_after   numeric(14,2),
    member_id       uuid references public.members(id) on delete set null,
    created_at      timestamptz not null default now()
);

create table if not exists public.mecano_stock_categories (
    id              uuid primary key default gen_random_uuid(),
    name            text not null unique,          -- ex: Pièces moteur, Pneus, Freins, Huile, Batteries, Peinture
    unit            text default 'unité',
    low_stock_alert integer not null default 10,
    created_at      timestamptz not null default now()
);

create table if not exists public.mecano_stock_items (
    id                  uuid primary key default gen_random_uuid(),
    category_id         uuid not null references public.mecano_stock_categories(id) on delete cascade,
    current_quantity    integer not null default 0 check (current_quantity >= 0),
    updated_at          timestamptz not null default now(),
    constraint mecano_stock_items_category_unique unique (category_id)
);

create table if not exists public.mecano_stock_movements (
    id              uuid primary key default gen_random_uuid(),
    category_id     uuid not null references public.mecano_stock_categories(id) on delete cascade,
    type            text not null check (type in ('entree','sortie')),
    quantity        integer not null check (quantity > 0),
    comment         text,
    member_id       uuid references public.members(id) on delete set null,
    created_at      timestamptz not null default now()
);

create table if not exists public.mecano_services (
    id              uuid primary key default gen_random_uuid(),
    name            text not null,                 -- nom de la prestation
    price           numeric(10,2) not null default 0,
    description     text,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

create table if not exists public.mecano_invoices (
    id              uuid primary key default gen_random_uuid(),
    client_name     text not null,
    vehicle         text,                          -- véhicule concerné
    amount          numeric(14,2) not null default 0,
    status          text not null default 'en_attente' check (status in ('en_attente','payee','annulee')),
    comment         text,
    member_id       uuid references public.members(id) on delete set null,
    created_at      timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- INDEX
-- ----------------------------------------------------------------------------
create index if not exists idx_mecano_treasury_created_at on public.mecano_treasury_transactions (created_at desc);
create index if not exists idx_mecano_stock_movements_category on public.mecano_stock_movements (category_id, created_at desc);
create index if not exists idx_mecano_invoices_status on public.mecano_invoices (status);
create index if not exists idx_mecano_invoices_created_at on public.mecano_invoices (created_at desc);

-- ----------------------------------------------------------------------------
-- FONCTIONS / TRIGGERS
-- ----------------------------------------------------------------------------
create or replace function public.mecano_compute_balance()
returns trigger language plpgsql security definer set search_path = public as $$
declare prev_balance numeric(14,2);
begin
    select coalesce(balance_after, 0) into prev_balance
    from public.mecano_treasury_transactions
    where created_at <= new.created_at and id <> new.id
    order by created_at desc limit 1;
    if prev_balance is null then prev_balance := 0; end if;
    new.balance_after := case when new.type = 'entree' then prev_balance + new.amount else prev_balance - new.amount end;
    return new;
end; $$;

drop trigger if exists trg_mecano_treasury_balance on public.mecano_treasury_transactions;
create trigger trg_mecano_treasury_balance before insert on public.mecano_treasury_transactions
    for each row execute function public.mecano_compute_balance();

create or replace function public.get_mecano_balance()
returns numeric language sql stable as $$
    select coalesce(balance_after, 0) from public.mecano_treasury_transactions order by created_at desc limit 1;
$$;

create or replace function public.mecano_apply_stock_movement()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_current integer; v_alert integer; v_name text;
begin
    insert into public.mecano_stock_items (category_id, current_quantity) values (new.category_id, 0)
        on conflict (category_id) do nothing;

    if new.type = 'entree' then
        update public.mecano_stock_items set current_quantity = current_quantity + new.quantity, updated_at = now()
            where category_id = new.category_id returning current_quantity into v_current;
    else
        update public.mecano_stock_items set current_quantity = greatest(current_quantity - new.quantity, 0), updated_at = now()
            where category_id = new.category_id returning current_quantity into v_current;
    end if;

    select low_stock_alert, name into v_alert, v_name from public.mecano_stock_categories where id = new.category_id;
    if v_current <= v_alert then
        insert into public.notifications (recipient_id, type, title, message, link_module)
        values (null, 'stock_faible', 'Stock atelier faible', 'Le stock de "' || v_name || '" (atelier) est descendu à ' || v_current || '.', 'mecano');
    end if;
    return new;
end; $$;

drop trigger if exists trg_mecano_stock_movement on public.mecano_stock_movements;
create trigger trg_mecano_stock_movement before insert on public.mecano_stock_movements
    for each row execute function public.mecano_apply_stock_movement();

-- ----------------------------------------------------------------------------
-- VUES
-- ----------------------------------------------------------------------------
create or replace view public.v_mecano_treasury_full as
select t.id, t.type, t.amount, t.comment, t.balance_after, t.created_at, m.rp_name as member_name
from public.mecano_treasury_transactions t
left join public.members m on m.id = t.member_id;

create or replace view public.v_mecano_stock_overview as
select sc.id as category_id, sc.name, sc.unit, sc.low_stock_alert,
       coalesce(si.current_quantity, 0) as current_quantity,
       (coalesce(si.current_quantity, 0) <= sc.low_stock_alert) as is_low
from public.mecano_stock_categories sc
left join public.mecano_stock_items si on si.category_id = sc.id;

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
alter table public.mecano_treasury_transactions enable row level security;
alter table public.mecano_stock_categories enable row level security;
alter table public.mecano_stock_items enable row level security;
alter table public.mecano_stock_movements enable row level security;
alter table public.mecano_services enable row level security;
alter table public.mecano_invoices enable row level security;

drop policy if exists mecano_treasury_select on public.mecano_treasury_transactions;
create policy mecano_treasury_select on public.mecano_treasury_transactions for select using (public.has_permission('mecano', 'view'));
drop policy if exists mecano_treasury_insert on public.mecano_treasury_transactions;
create policy mecano_treasury_insert on public.mecano_treasury_transactions for insert with check (public.has_permission('mecano', 'create'));

drop policy if exists mecano_stock_categories_select on public.mecano_stock_categories;
create policy mecano_stock_categories_select on public.mecano_stock_categories for select using (public.has_permission('mecano', 'view'));
drop policy if exists mecano_stock_categories_manage on public.mecano_stock_categories;
create policy mecano_stock_categories_manage on public.mecano_stock_categories for all
    using (public.has_permission('mecano', 'manage')) with check (public.has_permission('mecano', 'manage'));

drop policy if exists mecano_stock_items_select on public.mecano_stock_items;
create policy mecano_stock_items_select on public.mecano_stock_items for select using (public.has_permission('mecano', 'view'));

drop policy if exists mecano_stock_movements_select on public.mecano_stock_movements;
create policy mecano_stock_movements_select on public.mecano_stock_movements for select using (public.has_permission('mecano', 'view'));
drop policy if exists mecano_stock_movements_insert on public.mecano_stock_movements;
create policy mecano_stock_movements_insert on public.mecano_stock_movements for insert with check (public.has_permission('mecano', 'create'));

drop policy if exists mecano_services_select on public.mecano_services;
create policy mecano_services_select on public.mecano_services for select using (public.has_permission('mecano', 'view'));
drop policy if exists mecano_services_manage on public.mecano_services;
create policy mecano_services_manage on public.mecano_services for all
    using (public.has_permission('mecano', 'edit')) with check (public.has_permission('mecano', 'edit'));

drop policy if exists mecano_invoices_select on public.mecano_invoices;
create policy mecano_invoices_select on public.mecano_invoices for select using (public.has_permission('mecano', 'view'));
drop policy if exists mecano_invoices_insert on public.mecano_invoices;
create policy mecano_invoices_insert on public.mecano_invoices for insert with check (public.has_permission('mecano', 'create'));
drop policy if exists mecano_invoices_update on public.mecano_invoices;
create policy mecano_invoices_update on public.mecano_invoices for update using (public.has_permission('mecano', 'edit'));
drop policy if exists mecano_invoices_delete on public.mecano_invoices;
create policy mecano_invoices_delete on public.mecano_invoices for delete using (public.has_permission('mecano', 'delete'));

-- ----------------------------------------------------------------------------
-- MODULE
-- ----------------------------------------------------------------------------
insert into public.modules (key, label, icon, description, sort_order, is_common) values
    ('mecano', 'Atelier Mécanique', '🔧', 'Gestion indépendante de l''atelier (trésorerie, stock, factures, prestations)', 95, false)
on conflict (key) do update set label = excluded.label, icon = excluded.icon, description = excluded.description;
