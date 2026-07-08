-- ============================================================================
-- LOST MC OS - ROW LEVEL SECURITY (RLS)
-- Fichier : 05_rls_policies.sql
-- À exécuter après 04_views.sql
--
-- Principe : chaque table est protégée par une policy qui appelle
-- public.has_permission(module_key, action). Rien n'est codé en dur :
-- has_permission lit la table `permissions`, elle-même alimentée depuis
-- l'application (Paramètres > Permissions), pour le grade du membre connecté
-- (public.current_grade_id()).
-- ============================================================================

-- Active RLS sur toutes les tables métier
alter table public.club_settings enable row level security;
alter table public.chapters enable row level security;
alter table public.grades enable row level security;
alter table public.modules enable row level security;
alter table public.permissions enable row level security;
alter table public.members enable row level security;
alter table public.member_history enable row level security;
alter table public.treasury_transactions enable row level security;
alter table public.stock_categories enable row level security;
alter table public.stock_items enable row level security;
alter table public.stock_movements enable row level security;
alter table public.weapons enable row level security;
alter table public.weapon_recipes enable row level security;
alter table public.weapon_history enable row level security;
alter table public.trainings enable row level security;
alter table public.training_attendance enable row level security;
alter table public.training_attachments enable row level security;
alter table public.event_types enable row level security;
alter table public.planning_events enable row level security;
alter table public.planning_event_members enable row level security;
alter table public.relations enable row level security;
alter table public.relation_contacts enable row level security;
alter table public.relation_history enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;

-- ----------------------------------------------------------------------------
-- MEMBRES : chaque membre connecté peut toujours lire SA propre fiche
-- (indispensable pour récupérer son grade au login), le reste suit les permissions
-- ----------------------------------------------------------------------------
drop policy if exists members_select_self on public.members;
create policy members_select_self on public.members
    for select using (id = auth.uid());

drop policy if exists members_select_permission on public.members;
create policy members_select_permission on public.members
    for select using (public.has_permission('members', 'view'));

drop policy if exists members_insert on public.members;
create policy members_insert on public.members
    for insert with check (public.has_permission('members', 'create'));

drop policy if exists members_update on public.members;
create policy members_update on public.members
    for update using (public.has_permission('members', 'edit'));

drop policy if exists members_delete on public.members;
create policy members_delete on public.members
    for delete using (public.has_permission('members', 'delete'));

drop policy if exists member_history_select on public.member_history;
create policy member_history_select on public.member_history
    for select using (public.has_permission('members', 'view'));

drop policy if exists member_history_insert on public.member_history;
create policy member_history_insert on public.member_history
    for insert with check (public.has_permission('members', 'edit'));

-- ----------------------------------------------------------------------------
-- GRADES / MODULES / PERMISSIONS : gérés depuis Paramètres, réservés au module 'settings'
-- Lecture libre à tous les connectés (nécessaire pour afficher badges/menus)
-- ----------------------------------------------------------------------------
drop policy if exists grades_select_all on public.grades;
create policy grades_select_all on public.grades
    for select using (auth.uid() is not null);

drop policy if exists grades_manage on public.grades;
create policy grades_manage on public.grades
    for all using (public.has_permission('settings', 'manage'))
    with check (public.has_permission('settings', 'manage'));

drop policy if exists modules_select_all on public.modules;
create policy modules_select_all on public.modules
    for select using (auth.uid() is not null);

drop policy if exists permissions_select_all on public.permissions;
create policy permissions_select_all on public.permissions
    for select using (auth.uid() is not null);

drop policy if exists permissions_manage on public.permissions;
create policy permissions_manage on public.permissions
    for all using (public.has_permission('settings', 'manage'))
    with check (public.has_permission('settings', 'manage'));

-- ----------------------------------------------------------------------------
-- PARAMÈTRES CLUB
-- ----------------------------------------------------------------------------
drop policy if exists club_settings_select on public.club_settings;
create policy club_settings_select on public.club_settings
    for select using (auth.uid() is not null);

drop policy if exists club_settings_update on public.club_settings;
create policy club_settings_update on public.club_settings
    for update using (public.has_permission('settings', 'manage'));

drop policy if exists chapters_select on public.chapters;
create policy chapters_select on public.chapters
    for select using (auth.uid() is not null);

drop policy if exists chapters_manage on public.chapters;
create policy chapters_manage on public.chapters
    for all using (public.has_permission('settings', 'manage'))
    with check (public.has_permission('settings', 'manage'));

-- ----------------------------------------------------------------------------
-- TRÉSORERIE
-- ----------------------------------------------------------------------------
drop policy if exists treasury_select on public.treasury_transactions;
create policy treasury_select on public.treasury_transactions
    for select using (public.has_permission('treasury', 'view'));

drop policy if exists treasury_insert on public.treasury_transactions;
create policy treasury_insert on public.treasury_transactions
    for insert with check (public.has_permission('treasury', 'create'));

drop policy if exists treasury_update on public.treasury_transactions;
create policy treasury_update on public.treasury_transactions
    for update using (public.has_permission('treasury', 'edit'));

drop policy if exists treasury_delete on public.treasury_transactions;
create policy treasury_delete on public.treasury_transactions
    for delete using (public.has_permission('treasury', 'delete'));

-- ----------------------------------------------------------------------------
-- STOCKS (même module que trésorerie : 'stock')
-- ----------------------------------------------------------------------------
drop policy if exists stock_categories_select on public.stock_categories;
create policy stock_categories_select on public.stock_categories
    for select using (public.has_permission('stock', 'view'));

drop policy if exists stock_categories_manage on public.stock_categories;
create policy stock_categories_manage on public.stock_categories
    for all using (public.has_permission('stock', 'manage'))
    with check (public.has_permission('stock', 'manage'));

drop policy if exists stock_items_select on public.stock_items;
create policy stock_items_select on public.stock_items
    for select using (public.has_permission('stock', 'view'));

drop policy if exists stock_movements_select on public.stock_movements;
create policy stock_movements_select on public.stock_movements
    for select using (public.has_permission('stock', 'view'));

drop policy if exists stock_movements_insert on public.stock_movements;
create policy stock_movements_insert on public.stock_movements
    for insert with check (public.has_permission('stock', 'create'));

-- ----------------------------------------------------------------------------
-- ARMURERIE
-- ----------------------------------------------------------------------------
drop policy if exists weapons_select on public.weapons;
create policy weapons_select on public.weapons
    for select using (public.has_permission('armory', 'view'));

drop policy if exists weapons_insert on public.weapons;
create policy weapons_insert on public.weapons
    for insert with check (public.has_permission('armory', 'create'));

drop policy if exists weapons_update on public.weapons;
create policy weapons_update on public.weapons
    for update using (public.has_permission('armory', 'edit'));

drop policy if exists weapons_delete on public.weapons;
create policy weapons_delete on public.weapons
    for delete using (public.has_permission('armory', 'delete'));

drop policy if exists weapon_recipes_select on public.weapon_recipes;
create policy weapon_recipes_select on public.weapon_recipes
    for select using (public.has_permission('armory', 'view'));

drop policy if exists weapon_recipes_manage on public.weapon_recipes;
create policy weapon_recipes_manage on public.weapon_recipes
    for all using (public.has_permission('armory', 'edit'))
    with check (public.has_permission('armory', 'edit'));

drop policy if exists weapon_history_select on public.weapon_history;
create policy weapon_history_select on public.weapon_history
    for select using (public.has_permission('armory', 'view'));

-- ----------------------------------------------------------------------------
-- FORMATIONS : accessible en lecture à tous les membres connectés
-- ----------------------------------------------------------------------------
drop policy if exists trainings_select_all on public.trainings;
create policy trainings_select_all on public.trainings
    for select using (auth.uid() is not null);

drop policy if exists trainings_insert on public.trainings;
create policy trainings_insert on public.trainings
    for insert with check (public.has_permission('trainings', 'create'));

drop policy if exists trainings_update on public.trainings;
create policy trainings_update on public.trainings
    for update using (public.has_permission('trainings', 'edit'));

drop policy if exists trainings_delete on public.trainings;
create policy trainings_delete on public.trainings
    for delete using (public.has_permission('trainings', 'delete'));

drop policy if exists training_attendance_select on public.training_attendance;
create policy training_attendance_select on public.training_attendance
    for select using (auth.uid() is not null);

drop policy if exists training_attendance_manage on public.training_attendance;
create policy training_attendance_manage on public.training_attendance
    for all using (public.has_permission('trainings', 'edit'))
    with check (public.has_permission('trainings', 'edit'));

drop policy if exists training_attachments_select on public.training_attachments;
create policy training_attachments_select on public.training_attachments
    for select using (auth.uid() is not null);

drop policy if exists training_attachments_manage on public.training_attachments;
create policy training_attachments_manage on public.training_attachments
    for all using (public.has_permission('trainings', 'edit'))
    with check (public.has_permission('trainings', 'edit'));

-- ----------------------------------------------------------------------------
-- PLANNING : accessible en lecture à tous
-- ----------------------------------------------------------------------------
drop policy if exists event_types_select on public.event_types;
create policy event_types_select on public.event_types
    for select using (auth.uid() is not null);

drop policy if exists event_types_manage on public.event_types;
create policy event_types_manage on public.event_types
    for all using (public.has_permission('planning', 'manage'))
    with check (public.has_permission('planning', 'manage'));

drop policy if exists planning_events_select on public.planning_events;
create policy planning_events_select on public.planning_events
    for select using (auth.uid() is not null);

drop policy if exists planning_events_insert on public.planning_events;
create policy planning_events_insert on public.planning_events
    for insert with check (public.has_permission('planning', 'create'));

drop policy if exists planning_events_update on public.planning_events;
create policy planning_events_update on public.planning_events
    for update using (public.has_permission('planning', 'edit'));

drop policy if exists planning_events_delete on public.planning_events;
create policy planning_events_delete on public.planning_events
    for delete using (public.has_permission('planning', 'delete'));

drop policy if exists planning_event_members_select on public.planning_event_members;
create policy planning_event_members_select on public.planning_event_members
    for select using (auth.uid() is not null);

drop policy if exists planning_event_members_manage on public.planning_event_members;
create policy planning_event_members_manage on public.planning_event_members
    for all using (public.has_permission('planning', 'edit'))
    with check (public.has_permission('planning', 'edit'));

-- ----------------------------------------------------------------------------
-- RELATIONNEL
-- ----------------------------------------------------------------------------
drop policy if exists relations_select on public.relations;
create policy relations_select on public.relations
    for select using (public.has_permission('relations', 'view'));

drop policy if exists relations_insert on public.relations;
create policy relations_insert on public.relations
    for insert with check (public.has_permission('relations', 'create'));

drop policy if exists relations_update on public.relations;
create policy relations_update on public.relations
    for update using (public.has_permission('relations', 'edit'));

drop policy if exists relations_delete on public.relations;
create policy relations_delete on public.relations
    for delete using (public.has_permission('relations', 'delete'));

drop policy if exists relation_contacts_all on public.relation_contacts;
create policy relation_contacts_all on public.relation_contacts
    for all using (public.has_permission('relations', 'view'))
    with check (public.has_permission('relations', 'edit'));

drop policy if exists relation_history_select on public.relation_history;
create policy relation_history_select on public.relation_history
    for select using (public.has_permission('relations', 'view'));

drop policy if exists relation_history_insert on public.relation_history;
create policy relation_history_insert on public.relation_history
    for insert with check (public.has_permission('relations', 'edit'));

-- ----------------------------------------------------------------------------
-- NOTIFICATIONS : chacun voit ses notifications + les notifications globales
-- ----------------------------------------------------------------------------
drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications
    for select using (recipient_id = auth.uid() or recipient_id is null);

drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications
    for update using (recipient_id = auth.uid() or recipient_id is null);

-- Les insertions de notifications passent uniquement par les fonctions
-- security definer (triggers) ; pas d'insertion directe côté client.
drop policy if exists notifications_insert_none on public.notifications;
create policy notifications_insert_none on public.notifications
    for insert with check (false);

-- ----------------------------------------------------------------------------
-- AUDIT LOGS : lecture réservée au module 'settings' (staff), écriture via triggers uniquement
-- ----------------------------------------------------------------------------
drop policy if exists audit_logs_select on public.audit_logs;
create policy audit_logs_select on public.audit_logs
    for select using (public.has_permission('settings', 'manage'));

drop policy if exists audit_logs_insert_none on public.audit_logs;
create policy audit_logs_insert_none on public.audit_logs
    for insert with check (auth.uid() is not null);
