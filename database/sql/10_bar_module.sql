-- ============================================================================
-- LOST MC OS - APPLICATION BAR
-- Fichier : 10_bar_module.sql
-- À exécuter après 09_functions_and_permissions.sql
--
-- Application indépendante avec sa propre trésorerie, son propre stock, ses
-- factures et son catalogue. Visible uniquement par les membres ayant une
-- fonction (ex: "Barman", "Gérant Bar") ou un grade avec la permission
-- 'view' sur le module 'bar' — créez cette fonction et donnez-lui cette
-- permission depuis Paramètres > Fonctions / Permissions, rien n'est en dur.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- TABLES
-- ----------------------------------------------------------------------------
create table if not exists public.bar_treasury_transactions (
    id              uuid primary key default gen_random_uuid(),
    type            text not null check (type in ('entree','sortie')),
    amount          numeric(14,2) not null check (amount > 0),
    comment         text,
    balance_after   numeric(14,2),
    member_id       uuid references public.members(id) on delete set null,
    created_at      timestamptz not null default now()
);

create table if not exists public.bar_stock_categories (
    id              uuid primary key default gen_random_uuid(),
    name            text not null unique,          -- ex: Bières, Whisky, Vodka, Rhum, Tequila, Softs, Ingrédients
    unit            text default 'unité',
    low_stock_alert integer not null default 10,
    created_at      timestamptz not null default now()
);

create table if not exists public.bar_stock_items (
    id                  uuid primary key default gen_random_uuid(),
    category_id         uuid not null references public.bar_stock_categories(id) on delete cascade,
    current_quantity    integer not null default 0 check (current_quantity >= 0),
    updated_at          timestamptz not null default now(),
    constraint bar_stock_items_category_unique unique (category_id)
);

create table if not exists public.bar_stock_movements (
    id              uuid primary key default gen_random_uuid(),
    category_id     uuid not null references public.bar_stock_categories(id) on delete cascade,
    type            text not null check (type in ('entree','sortie')),
    quantity        integer not null check (quantity > 0),
    comment         text,
    member_id       uuid references public.members(id) on delete set null,
    created_at      timestamptz not null default now()
);

create table if not exists public.bar_catalog (
    id              uuid primary key default gen_random_uuid(),
    name            text not null,                 -- nom de la boisson
    price           numeric(10,2) not null default 0,
    is_available    boolean not null default true,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

create table if not exists public.bar_invoices (
    id              uuid primary key default gen_random_uuid(),
    client_name     text not null,
    amount          numeric(14,2) not null default 0,
    status          text not null default 'en_attente' check (status in ('en_attente','payee','annulee')),
    comment         text,
    member_id       uuid references public.members(id) on delete set null,
    created_at      timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- INDEX
-- ----------------------------------------------------------------------------
create index if not exists idx_bar_treasury_created_at on public.bar_treasury_transactions (created_at desc);
create index if not exists idx_bar_stock_movements_category on public.bar_stock_movements (category_id, created_at desc);
create index if not exists idx_bar_invoices_status on public.bar_invoices (status);
create index if not exists idx_bar_invoices_created_at on public.bar_invoices (created_at desc);

-- ----------------------------------------------------------------------------
-- FONCTIONS / TRIGGERS (mêmes principes que la trésorerie/stock principaux)
-- ----------------------------------------------------------------------------
create or replace function public.bar_compute_balance()
returns trigger language plpgsql security definer set search_path = public as $$
declare prev_balance numeric(14,2);
begin
    select coalesce(balance_after, 0) into prev_balance
    from public.bar_treasury_transactions
    where created_at <= new.created_at and id <> new.id
    order by created_at desc limit 1;
    if prev_balance is null then prev_balance := 0; end if;
    new.balance_after := case when new.type = 'entree' then prev_balance + new.amount else prev_balance - new.amount end;
    return new;
end; $$;

drop trigger if exists trg_bar_treasury_balance on public.bar_treasury_transactions;
create trigger trg_bar_treasury_balance before insert on public.bar_treasury_transactions
    for each row execute function public.bar_compute_balance();

create or replace function public.get_bar_balance()
returns numeric language sql stable as $$
    select coalesce(balance_after, 0) from public.bar_treasury_transactions order by created_at desc limit 1;
$$;

create or replace function public.bar_apply_stock_movement()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_current integer; v_alert integer; v_name text;
begin
    insert into public.bar_stock_items (category_id, current_quantity) values (new.category_id, 0)
        on conflict (category_id) do nothing;

    if new.type = 'entree' then
        update public.bar_stock_items set current_quantity = current_quantity + new.quantity, updated_at = now()
            where category_id = new.category_id returning current_quantity into v_current;
    else
        update public.bar_stock_items set current_quantity = greatest(current_quantity - new.quantity, 0), updated_at = now()
            where category_id = new.category_id returning current_quantity into v_current;
    end if;

    select low_stock_alert, name into v_alert, v_name from public.bar_stock_categories where id = new.category_id;
    if v_current <= v_alert then
        insert into public.notifications (recipient_id, type, title, message, link_module)
        values (null, 'stock_faible', 'Stock bar faible', 'Le stock de "' || v_name || '" (bar) est descendu à ' || v_current || '.', 'bar');
    end if;
    return new;
end; $$;

drop trigger if exists trg_bar_stock_movement on public.bar_stock_movements;
create trigger trg_bar_stock_movement before insert on public.bar_stock_movements
    for each row execute function public.bar_apply_stock_movement();

-- ----------------------------------------------------------------------------
-- VUES
-- ----------------------------------------------------------------------------
create or replace view public.v_bar_treasury_full as
select t.id, t.type, t.amount, t.comment, t.balance_after, t.created_at, m.rp_name as member_name
from public.bar_treasury_transactions t
left join public.members m on m.id = t.member_id;

create or replace view public.v_bar_stock_overview as
select sc.id as category_id, sc.name, sc.unit, sc.low_stock_alert,
       coalesce(si.current_quantity, 0) as current_quantity,
       (coalesce(si.current_quantity, 0) <= sc.low_stock_alert) as is_low
from public.bar_stock_categories sc
left join public.bar_stock_items si on si.category_id = sc.id;

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
alter table public.bar_treasury_transactions enable row level security;
alter table public.bar_stock_categories enable row level security;
alter table public.bar_stock_items enable row level security;
alter table public.bar_stock_movements enable row level security;
alter table public.bar_catalog enable row level security;
alter table public.bar_invoices enable row level security;

drop policy if exists bar_treasury_select on public.bar_treasury_transactions;
create policy bar_treasury_select on public.bar_treasury_transactions for select using (public.has_permission('bar', 'view'));
drop policy if exists bar_treasury_insert on public.bar_treasury_transactions;
create policy bar_treasury_insert on public.bar_treasury_transactions for insert with check (public.has_permission('bar', 'create'));

drop policy if exists bar_stock_categories_select on public.bar_stock_categories;
create policy bar_stock_categories_select on public.bar_stock_categories for select using (public.has_permission('bar', 'view'));
drop policy if exists bar_stock_categories_manage on public.bar_stock_categories;
create policy bar_stock_categories_manage on public.bar_stock_categories for all
    using (public.has_permission('bar', 'manage')) with check (public.has_permission('bar', 'manage'));

drop policy if exists bar_stock_items_select on public.bar_stock_items;
create policy bar_stock_items_select on public.bar_stock_items for select using (public.has_permission('bar', 'view'));

drop policy if exists bar_stock_movements_select on public.bar_stock_movements;
create policy bar_stock_movements_select on public.bar_stock_movements for select using (public.has_permission('bar', 'view'));
drop policy if exists bar_stock_movements_insert on public.bar_stock_movements;
create policy bar_stock_movements_insert on public.bar_stock_movements for insert with check (public.has_permission('bar', 'create'));

drop policy if exists bar_catalog_select on public.bar_catalog;
create policy bar_catalog_select on public.bar_catalog for select using (public.has_permission('bar', 'view'));
drop policy if exists bar_catalog_manage on public.bar_catalog;
create policy bar_catalog_manage on public.bar_catalog for all
    using (public.has_permission('bar', 'edit')) with check (public.has_permission('bar', 'edit'));

drop policy if exists bar_invoices_select on public.bar_invoices;
create policy bar_invoices_select on public.bar_invoices for select using (public.has_permission('bar', 'view'));
drop policy if exists bar_invoices_insert on public.bar_invoices;
create policy bar_invoices_insert on public.bar_invoices for insert with check (public.has_permission('bar', 'create'));
drop policy if exists bar_invoices_update on public.bar_invoices;
create policy bar_invoices_update on public.bar_invoices for update using (public.has_permission('bar', 'edit'));
drop policy if exists bar_invoices_delete on public.bar_invoices;
create policy bar_invoices_delete on public.bar_invoices for delete using (public.has_permission('bar', 'delete'));

-- ----------------------------------------------------------------------------
-- MODULE (apparaît dans Paramètres > Permissions, masqué par défaut)
-- ----------------------------------------------------------------------------
insert into public.modules (key, label, icon, description, sort_order, is_common) values
    ('bar', 'Bar', '🍸', 'Gestion indépendante du bar du club (trésorerie, stock, factures, catalogue)', 90, false)
on conflict (key) do update set label = excluded.label, icon = excluded.icon, description = excluded.description;
