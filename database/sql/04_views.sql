-- ============================================================================
-- LOST MC OS - VUES
-- Fichier : 04_views.sql
-- À exécuter après 03_functions.sql
-- ============================================================================

-- Vue complète d'un membre avec libellé de grade et chapter (évite les joins
-- répétés côté frontend)
create or replace view public.v_members_full as
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
    c.id   as chapter_id,
    c.name as chapter_name
from public.members m
left join public.grades g on g.id = m.grade_id
left join public.chapters c on c.id = m.chapter_id;

-- Vue trésorerie enrichie avec le nom du membre ayant fait l'opération
create or replace view public.v_treasury_full as
select
    t.id,
    t.type,
    t.amount,
    t.category,
    t.comment,
    t.balance_after,
    t.created_at,
    m.rp_name as member_name
from public.treasury_transactions t
left join public.members m on m.id = t.member_id;

-- Vue stocks avec état actuel + niveau d'alerte
create or replace view public.v_stock_overview as
select
    sc.id as category_id,
    sc.name,
    sc.unit,
    sc.low_stock_alert,
    coalesce(si.current_quantity, 0) as current_quantity,
    (coalesce(si.current_quantity, 0) <= sc.low_stock_alert) as is_low
from public.stock_categories sc
left join public.stock_items si on si.category_id = sc.id;

-- Vue armurerie avec quantité fabricable calculée
create or replace view public.v_weapons_full as
select
    w.id,
    w.name,
    w.photo_url,
    w.stock_quantity,
    w.value,
    w.sale_price,
    w.required_level,
    w.description,
    public.craftable_quantity(w.id) as craftable_quantity,
    w.created_at,
    w.updated_at
from public.weapons w;

-- Vue formations avec compte des présents/absents
create or replace view public.v_trainings_full as
select
    t.id,
    t.title,
    t.training_date,
    t.training_time,
    t.location,
    t.report,
    r.rp_name as responsible_name,
    (select count(*) from public.training_attendance a where a.training_id = t.id and a.present) as present_count,
    (select count(*) from public.training_attendance a where a.training_id = t.id and not a.present) as absent_count
from public.trainings t
left join public.members r on r.id = t.responsible_id;

-- Vue notifications non lues par destinataire (null recipient = notif globale visible par tous)
create or replace view public.v_my_notifications as
select *
from public.notifications
where recipient_id = auth.uid() or recipient_id is null
order by created_at desc;
