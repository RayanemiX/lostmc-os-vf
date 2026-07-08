-- ============================================================================
-- LOST MC OS - FONCTIONS MULTIPLES & PERMISSIONS GÉNÉRALISÉES
-- Fichier : 09_functions_and_permissions.sql
-- À exécuter après 08_grade_wallpaper.sql
--
-- Un membre garde toujours UN grade principal hiérarchique (public.grades,
-- inchangé). Il peut en plus cumuler AUTANT DE FONCTIONS QU'ON VEUT
-- (ex: Barman + Mécanicien), chacune pouvant donner accès à des modules
-- supplémentaires. L'accès final à un module = OR entre les permissions du
-- grade ET celles de toutes les fonctions du membre.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. FONCTIONS (rôles secondaires, cumulables, créés par l'utilisateur)
-- ----------------------------------------------------------------------------
create table if not exists public.functions (
    id              uuid primary key default gen_random_uuid(),
    name            text not null unique,      -- ex: "Barman", "Mécanicien", "Gérant Bar"
    icon            text,
    color           text default '#f5f5f5',
    description     text,
    created_at      timestamptz not null default now()
);

comment on table public.functions is 'Fonctions secondaires cumulables (contrairement aux grades, un membre peut en avoir plusieurs à la fois). Créées par l''utilisateur depuis Paramètres > Fonctions.';

-- Table de liaison many-to-many membres <-> fonctions
create table if not exists public.member_functions (
    member_id       uuid not null references public.members(id) on delete cascade,
    function_id     uuid not null references public.functions(id) on delete cascade,
    assigned_at     timestamptz not null default now(),
    primary key (member_id, function_id)
);

create index if not exists idx_member_functions_member on public.member_functions (member_id);
create index if not exists idx_member_functions_function on public.member_functions (function_id);

-- ----------------------------------------------------------------------------
-- 2. GÉNÉRALISATION DE LA TABLE PERMISSIONS
-- Une ligne de permission cible SOIT un grade, SOIT une fonction (jamais les
-- deux à la fois), pour le même système de droits (view/create/edit/delete/manage).
-- ----------------------------------------------------------------------------
alter table public.permissions
    alter column grade_id drop not null;

alter table public.permissions
    add column if not exists function_id uuid references public.functions(id) on delete cascade;

alter table public.permissions
    drop constraint if exists permissions_grade_module_unique;

alter table public.permissions
    add constraint permissions_target_check
    check (
        (grade_id is not null and function_id is null) or
        (grade_id is null and function_id is not null)
    );

-- Unicité séparée grade/module et fonction/module (index partiels)
create unique index if not exists idx_permissions_grade_module_unique
    on public.permissions (grade_id, module_key) where grade_id is not null;

create unique index if not exists idx_permissions_function_module_unique
    on public.permissions (function_id, module_key) where function_id is not null;

create index if not exists idx_permissions_function on public.permissions (function_id);

-- ----------------------------------------------------------------------------
-- 3. Modules "communs" : visibles par tous les membres connectés, sans avoir
--    besoin d'une ligne de permission (ex: Tableau de bord, Profil, Formations,
--    Planning). Les actions create/edit/delete restent, elles, contrôlées par
--    permissions comme avant.
-- ----------------------------------------------------------------------------
alter table public.modules
    add column if not exists is_common boolean not null default false;

update public.modules set is_common = true where key in ('trainings', 'planning');

-- ----------------------------------------------------------------------------
-- 4. Fonction utilitaire : liste des function_id du membre connecté
-- ----------------------------------------------------------------------------
create or replace function public.current_function_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
    select function_id from public.member_functions where member_id = auth.uid();
$$;

-- ----------------------------------------------------------------------------
-- 5. Vue des permissions effectives du membre connecté (grade OR fonctions),
--    agrégées par module. C'est la source de vérité utilisée à la fois par
--    has_permission() (sécurité serveur) et par le frontend (affichage menu).
-- ----------------------------------------------------------------------------
create or replace view public.v_my_effective_permissions as
select
    module_key,
    bool_or(can_view)   as can_view,
    bool_or(can_create) as can_create,
    bool_or(can_edit)   as can_edit,
    bool_or(can_delete) as can_delete,
    bool_or(can_manage) as can_manage
from (
    select module_key, can_view, can_create, can_edit, can_delete, can_manage
    from public.permissions
    where grade_id = public.current_grade_id()

    union all

    select module_key, can_view, can_create, can_edit, can_delete, can_manage
    from public.permissions
    where function_id in (select public.current_function_ids())
) combined
group by module_key;

grant select on public.v_my_effective_permissions to authenticated;

-- ----------------------------------------------------------------------------
-- 6. has_permission() réécrite pour s'appuyer sur la vue ci-dessus
--    (grade OU fonctions, plus besoin de dupliquer la logique en SQL et en JS)
-- ----------------------------------------------------------------------------
create or replace function public.has_permission(p_module_key text, p_action text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select coalesce(
        (select case p_action
                    when 'view'   then can_view
                    when 'create' then can_create
                    when 'edit'   then can_edit
                    when 'delete' then can_delete
                    when 'manage' then can_manage
                    else false
                end
         from public.v_my_effective_permissions
         where module_key = p_module_key),
        false
    )
    or exists (
        select 1 from public.modules where key = p_module_key and is_common = true and p_action = 'view'
    );
$$;

-- ----------------------------------------------------------------------------
-- 7. v_members_full : on ajoute la liste des fonctions (noms) de chaque membre
-- ----------------------------------------------------------------------------
drop view if exists public.v_members_full cascade;

create view public.v_members_full as
select
    m.id,
    m.matricule,
    m.rp_name,
    m.real_username,
    m.avatar_url,
    m.phone,
    m.discord,
    m.status,
    m.entry_date,
    m.promotion_date,
    m.notes,
    m.last_login_at,
    m.created_at,
    g.id   as grade_id,
    g.name as grade_name,
    g.color as grade_color,
    g.hierarchy_order,
    g.wallpaper_url as grade_wallpaper_url,
    c.id   as chapter_id,
    c.name as chapter_name,
    coalesce(
        (select string_agg(f.name, ', ' order by f.name)
         from public.member_functions mf
         join public.functions f on f.id = mf.function_id
         where mf.member_id = m.id),
        ''
    ) as function_names
from public.members m
left join public.grades g on g.id = m.grade_id
left join public.chapters c on c.id = m.chapter_id;

-- ----------------------------------------------------------------------------
-- 8. RLS : fonctions & liaison membre-fonctions
-- ----------------------------------------------------------------------------
alter table public.functions enable row level security;
alter table public.member_functions enable row level security;

drop policy if exists functions_select_all on public.functions;
create policy functions_select_all on public.functions
    for select using (auth.uid() is not null);

drop policy if exists functions_manage on public.functions;
create policy functions_manage on public.functions
    for all using (public.has_permission('settings', 'manage'))
    with check (public.has_permission('settings', 'manage'));

drop policy if exists member_functions_select on public.member_functions;
create policy member_functions_select on public.member_functions
    for select using (auth.uid() is not null);

drop policy if exists member_functions_manage on public.member_functions;
create policy member_functions_manage on public.member_functions
    for all using (public.has_permission('members', 'edit'))
    with check (public.has_permission('members', 'edit'));
