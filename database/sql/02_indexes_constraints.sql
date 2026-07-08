-- ============================================================================
-- LOST MC OS - INDEX & CONTRAINTES
-- Fichier : 02_indexes_constraints.sql
-- À exécuter après 01_schema_tables.sql
-- ============================================================================

-- MEMBRES : recherche rapide par nom RP, discord, matricule
create index if not exists idx_members_rp_name_trgm on public.members using gin (rp_name gin_trgm_ops);
create index if not exists idx_members_discord on public.members (discord);
create index if not exists idx_members_grade on public.members (grade_id);
create index if not exists idx_members_chapter on public.members (chapter_id);
create index if not exists idx_members_status on public.members (status);

create index if not exists idx_member_history_member on public.member_history (member_id, created_at desc);

-- PERMISSIONS : lecture rapide par grade (utilisé à chaque requête RLS)
create index if not exists idx_permissions_grade on public.permissions (grade_id);
create index if not exists idx_permissions_module on public.permissions (module_key);

-- TRÉSORERIE : tri chronologique + filtrage par type
create index if not exists idx_treasury_created_at on public.treasury_transactions (created_at desc);
create index if not exists idx_treasury_type on public.treasury_transactions (type);
create index if not exists idx_treasury_member on public.treasury_transactions (member_id);

-- STOCKS
create index if not exists idx_stock_movements_category on public.stock_movements (category_id, created_at desc);

-- ARMURERIE
create index if not exists idx_weapons_name_trgm on public.weapons using gin (name gin_trgm_ops);
create index if not exists idx_weapon_recipes_weapon on public.weapon_recipes (weapon_id);
create index if not exists idx_weapon_history_weapon on public.weapon_history (weapon_id, created_at desc);

-- FORMATIONS
create index if not exists idx_trainings_date on public.trainings (training_date desc);
create index if not exists idx_training_attendance_training on public.training_attendance (training_id);
create index if not exists idx_training_attendance_member on public.training_attendance (member_id);

-- PLANNING : les requêtes de calendrier filtrent toujours par plage de dates
create index if not exists idx_planning_events_starts_at on public.planning_events (starts_at);
create index if not exists idx_planning_events_type on public.planning_events (event_type);

-- RELATIONNEL
create index if not exists idx_relations_type on public.relations (type);
create index if not exists idx_relations_status on public.relations (status);
create index if not exists idx_relation_history_relation on public.relation_history (relation_id, created_at desc);

-- NOTIFICATIONS : l'écran de notifications trie par destinataire + non lues + date
create index if not exists idx_notifications_recipient on public.notifications (recipient_id, is_read, created_at desc);

-- AUDIT LOGS
create index if not exists idx_audit_logs_member on public.audit_logs (member_id, created_at desc);
create index if not exists idx_audit_logs_table on public.audit_logs (table_name, record_id);

-- Contrainte : un membre ne peut pas être son propre responsable de formation cassé
-- (laissé volontairement souple ; règle métier gérée côté application si besoin)

-- Contrainte de cohérence date de promotion <= aujourd'hui
alter table public.members
    drop constraint if exists chk_promotion_date_past;
alter table public.members
    add constraint chk_promotion_date_past check (promotion_date is null or promotion_date <= current_date);
