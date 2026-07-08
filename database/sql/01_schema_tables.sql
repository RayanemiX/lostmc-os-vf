-- ============================================================================
-- LOST MC OS - SCHEMA PRINCIPAL
-- Fichier : 01_schema_tables.sql
-- Description : Création de toutes les tables du système.
--
-- ORDRE D'EXECUTION DES FICHIERS SQL (dans l'éditeur SQL de Supabase) :
--   1. 01_schema_tables.sql        <- vous êtes ici
--   2. 02_indexes_constraints.sql
--   3. 03_functions.sql
--   4. 04_views.sql
--   5. 05_rls_policies.sql
--   6. 06_seed_modules.sql
--
-- IMPORTANT : Aucun grade, aucune permission, aucune donnée métier n'est
-- codée en dur. Seule la liste des "modules" applicatifs (ex: 'members',
-- 'treasury'...) est fixe car elle correspond aux écrans du logiciel.
-- Les GRADES et les PERMISSIONS associées sont 100% créés par vous depuis
-- l'application (Paramètres > Grades / Permissions).
-- ============================================================================

-- Extensions nécessaires
create extension if not exists "pgcrypto";      -- gen_random_uuid()
create extension if not exists "pg_trgm";        -- recherche texte (ILIKE / similarity)

-- ============================================================================
-- 1. PARAMÈTRES GÉNÉRAUX DU CLUB (Application Paramètres)
-- ============================================================================
-- Table à ligne unique (singleton) contenant l'identité visuelle du club.
create table if not exists public.club_settings (
    id                  integer primary key default 1,
    club_name           text not null default 'LOST MC',
    logo_url            text,
    wallpaper_url       text,
    primary_color       text default '#8a0303',   -- rouge sombre
    secondary_color     text default '#1a1a1a',   -- gris foncé
    background_color    text default '#0a0a0a',   -- noir
    accent_color        text default '#f5f5f5',   -- blanc
    updated_at          timestamptz not null default now(),
    updated_by          uuid,
    constraint club_settings_singleton check (id = 1)
);

-- ============================================================================
-- 2. CHAPTERS (antennes du club)
-- ============================================================================
create table if not exists public.chapters (
    id              uuid primary key default gen_random_uuid(),
    name            text not null unique,
    city            text,
    description     text,
    is_active       boolean not null default true,
    created_at      timestamptz not null default now()
);

-- ============================================================================
-- 3. GRADES (hiérarchie) - 100% créés par l'utilisateur, aucun grade en dur
-- ============================================================================
create table if not exists public.grades (
    id              uuid primary key default gen_random_uuid(),
    name            text not null unique,          -- ex: "Président"
    color           text default '#f5f5f5',        -- couleur d'affichage du badge
    icon            text,                            -- nom/emoji d'icône optionnel
    hierarchy_order integer not null,               -- 1 = le plus haut grade
    is_staff        boolean not null default false, -- "bureau" du club (accès étendu par défaut)
    description     text,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now(),
    constraint grades_hierarchy_order_unique unique (hierarchy_order)
);

comment on table public.grades is 'Grades entièrement gérés par les utilisateurs depuis Paramètres > Grades. hierarchy_order permet le glisser-déposer de réorganisation (1 = sommet de la hiérarchie).';

-- ============================================================================
-- 4. MODULES APPLICATIFS (écrans/fonctionnalités du logiciel)
-- ============================================================================
-- Liste fixe car elle correspond au code (chaque appli du bureau).
-- C'est la seule chose "en dur" : la clé technique d'un module ne peut pas
-- être inventée par l'utilisateur car elle doit correspondre à un écran réel.
create table if not exists public.modules (
    key             text primary key,       -- ex: 'members', 'treasury'...
    label           text not null,          -- nom affiché
    icon            text,
    description     text,
    sort_order      integer not null default 0
);

-- ============================================================================
-- 5. PERMISSIONS (grade <-> module) - stockées en base, jamais en dur
-- ============================================================================
create table if not exists public.permissions (
    id              uuid primary key default gen_random_uuid(),
    grade_id        uuid not null references public.grades(id) on delete cascade,
    module_key      text not null references public.modules(key) on delete cascade,
    can_view        boolean not null default false,
    can_create      boolean not null default false,
    can_edit        boolean not null default false,
    can_delete      boolean not null default false,
    can_manage      boolean not null default false,  -- ex: gérer les sous-paramètres du module
    created_at      timestamptz not null default now(),
    constraint permissions_grade_module_unique unique (grade_id, module_key)
);

-- ============================================================================
-- 6. MEMBRES (profils RP liés à un compte auth Supabase)
-- ============================================================================
create table if not exists public.members (
    id                  uuid primary key references auth.users(id) on delete cascade,
    matricule           text unique,                 -- généré automatiquement (voir 03_functions.sql)
    rp_name             text not null,
    real_username       text,                        -- identifiant de connexion affiché
    avatar_url          text,
    phone               text,
    discord             text,
    grade_id            uuid references public.grades(id) on delete set null,
    chapter_id          uuid references public.chapters(id) on delete set null,
    status              text not null default 'actif'
                            check (status in ('actif','en_conge','suspendu','exclu','prospect')),
    entry_date          date not null default current_date,
    promotion_date      date,
    notes               text,
    last_login_at       timestamptz,
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now(),
    created_by          uuid references auth.users(id)
);

comment on table public.members is 'Un membre = un compte auth.users. Le grade est une FK vers grades, jamais une valeur codée en dur.';

-- Historique des membres : sanctions, récompenses, promotions, changements de statut
create table if not exists public.member_history (
    id              uuid primary key default gen_random_uuid(),
    member_id       uuid not null references public.members(id) on delete cascade,
    event_type      text not null check (event_type in
                        ('promotion','retrogradation','sanction','recompense','statut','note','entree','sortie')),
    old_value       text,
    new_value       text,
    comment         text,
    created_at      timestamptz not null default now(),
    created_by      uuid references auth.users(id)
);

-- ============================================================================
-- 7. TRÉSORERIE
-- ============================================================================
create table if not exists public.treasury_transactions (
    id              uuid primary key default gen_random_uuid(),
    type            text not null check (type in ('entree','sortie')),
    amount          numeric(14,2) not null check (amount > 0),
    category        text,                        -- ex: "cotisation", "vente d'armes", "materiel"
    comment         text,
    balance_after   numeric(14,2),               -- solde calculé après la transaction (trigger)
    member_id       uuid references public.members(id) on delete set null, -- qui a fait l'opération
    created_at      timestamptz not null default now()
);

comment on table public.treasury_transactions is 'Chaque ligne = un mouvement de caisse. balance_after est calculé automatiquement par trigger (voir 03_functions.sql).';

-- ============================================================================
-- 8. STOCKS (matériaux) - même application que la Trésorerie
-- ============================================================================
create table if not exists public.stock_categories (
    id              uuid primary key default gen_random_uuid(),
    name            text not null unique,        -- ex: "Métal raffiné", "Bois raffiné", "Gunpowder"
    unit            text default 'unité',
    low_stock_alert integer not null default 10, -- seuil d'alerte stock faible
    created_at      timestamptz not null default now()
);

create table if not exists public.stock_items (
    id                  uuid primary key default gen_random_uuid(),
    category_id         uuid not null references public.stock_categories(id) on delete cascade,
    current_quantity    integer not null default 0 check (current_quantity >= 0),
    updated_at          timestamptz not null default now(),
    constraint stock_items_category_unique unique (category_id)
);

create table if not exists public.stock_movements (
    id              uuid primary key default gen_random_uuid(),
    category_id     uuid not null references public.stock_categories(id) on delete cascade,
    type            text not null check (type in ('entree','sortie')),
    quantity        integer not null check (quantity > 0),
    comment         text,
    member_id       uuid references public.members(id) on delete set null,
    created_at      timestamptz not null default now()
);

-- ============================================================================
-- 9. ARMURERIE
-- ============================================================================
create table if not exists public.weapons (
    id                  uuid primary key default gen_random_uuid(),
    name                text not null,
    photo_url           text,
    stock_quantity      integer not null default 0 check (stock_quantity >= 0),
    value               numeric(14,2) default 0,       -- valeur estimée
    sale_price          numeric(14,2) default 0,       -- prix de vente
    required_level      integer default 0,             -- niveau nécessaire pour fabriquer/utiliser
    description         text,
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now(),
    created_by          uuid references auth.users(id)
);

-- Recette de craft : une arme nécessite N matériaux (stock_categories) en quantité X
create table if not exists public.weapon_recipes (
    id              uuid primary key default gen_random_uuid(),
    weapon_id       uuid not null references public.weapons(id) on delete cascade,
    category_id     uuid not null references public.stock_categories(id) on delete cascade,
    quantity_needed integer not null check (quantity_needed > 0),
    constraint weapon_recipes_unique unique (weapon_id, category_id)
);

create table if not exists public.weapon_history (
    id              uuid primary key default gen_random_uuid(),
    weapon_id       uuid not null references public.weapons(id) on delete cascade,
    action          text not null check (action in ('creation','modification','entree_stock','sortie_stock','vente','suppression')),
    quantity        integer,
    comment         text,
    member_id       uuid references public.members(id) on delete set null,
    created_at      timestamptz not null default now()
);

-- ============================================================================
-- 10. FORMATIONS
-- ============================================================================
create table if not exists public.trainings (
    id                  uuid primary key default gen_random_uuid(),
    title               text not null,
    training_date       date not null,
    training_time       time,
    location            text,
    responsible_id      uuid references public.members(id) on delete set null,
    report               text,                           -- compte rendu
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now(),
    created_by          uuid references auth.users(id)
);

create table if not exists public.training_attendance (
    id              uuid primary key default gen_random_uuid(),
    training_id     uuid not null references public.trainings(id) on delete cascade,
    member_id       uuid not null references public.members(id) on delete cascade,
    present         boolean not null default false,
    comment         text,
    constraint training_attendance_unique unique (training_id, member_id)
);

create table if not exists public.training_attachments (
    id              uuid primary key default gen_random_uuid(),
    training_id     uuid not null references public.trainings(id) on delete cascade,
    file_url        text not null,
    file_type       text,                       -- 'photo' | 'document'
    uploaded_at     timestamptz not null default now(),
    uploaded_by     uuid references auth.users(id)
);

-- ============================================================================
-- 11. PLANNING / CALENDRIER
-- ============================================================================
create table if not exists public.event_types (
    key             text primary key,          -- ex: 'formation', 'reunion', 'vente_armes'
    label           text not null,
    color           text default '#8a0303'
);

create table if not exists public.planning_events (
    id              uuid primary key default gen_random_uuid(),
    title           text not null,
    event_type      text references public.event_types(key) on delete set null,
    starts_at       timestamptz not null,
    ends_at         timestamptz,
    location        text,
    description     text,
    related_training_id uuid references public.trainings(id) on delete set null,
    created_at      timestamptz not null default now(),
    created_by      uuid references auth.users(id)
);

create table if not exists public.planning_event_members (
    event_id        uuid not null references public.planning_events(id) on delete cascade,
    member_id       uuid not null references public.members(id) on delete cascade,
    primary key (event_id, member_id)
);

-- ============================================================================
-- 12. RELATIONNEL (MC, gangs, entreprises, police, gouvernement...)
-- ============================================================================
create table if not exists public.relations (
    id              uuid primary key default gen_random_uuid(),
    name            text not null,
    type            text not null check (type in ('mc','gang','organisation','entreprise','police','gouvernement','autre')),
    status          text not null default 'neutre' check (status in ('allie','neutre','en_guerre','danger')),
    description     text,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now(),
    created_by      uuid references auth.users(id)
);

create table if not exists public.relation_contacts (
    id              uuid primary key default gen_random_uuid(),
    relation_id     uuid not null references public.relations(id) on delete cascade,
    full_name       text not null,
    role            text,
    notes           text
);

create table if not exists public.relation_history (
    id              uuid primary key default gen_random_uuid(),
    relation_id     uuid not null references public.relations(id) on delete cascade,
    event           text not null,
    comment         text,
    created_at      timestamptz not null default now(),
    created_by      uuid references auth.users(id)
);

-- ============================================================================
-- 13. NOTIFICATIONS
-- ============================================================================
create table if not exists public.notifications (
    id              uuid primary key default gen_random_uuid(),
    recipient_id    uuid references public.members(id) on delete cascade, -- null = notif globale
    type            text not null,     -- 'nouveau_membre','promotion','formation','stock_faible','argent_ajoute','argent_retire','nouvelle_arme'
    title           text not null,
    message         text,
    link_module     text references public.modules(key),
    is_read         boolean not null default false,
    created_at      timestamptz not null default now()
);

-- ============================================================================
-- 14. AUDIT / LOGS (évolutivité, traçabilité globale)
-- ============================================================================
create table if not exists public.audit_logs (
    id              uuid primary key default gen_random_uuid(),
    member_id       uuid references public.members(id) on delete set null,
    action          text not null,          -- ex: 'login','create_member','delete_weapon'
    table_name      text,
    record_id       uuid,
    details         jsonb,
    created_at      timestamptz not null default now()
);
