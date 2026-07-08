-- ============================================================================
-- LOST MC OS - APPLICATION TABLE (COMPTES-RENDUS DE RÉUNION)
-- Fichier : 14_meeting_reports.sql
-- À exécuter après 13_fix_trigger_security.sql
--
-- Une ligne = la remarque d'UN membre pour UNE réunion donnée. Le grade
-- affiché est TOUJOURS celui du membre au moment de la lecture (jointure
-- live sur members/grades), donc si un membre est promu plus tard, son
-- ancien compte-rendu affichera son grade actuel (comportement volontaire,
-- comme pour le reste de l'app). Si vous préférez figer le grade tel qu'il
-- était CE jour-là, un champ grade_snapshot est prévu et rempli
-- automatiquement à la création.
-- ============================================================================

create table if not exists public.meeting_reports (
    id              uuid primary key default gen_random_uuid(),
    meeting_date    date not null default current_date,
    member_id       uuid references public.members(id) on delete set null,
    grade_snapshot  text,                  -- grade du membre au moment de la réunion (figé)
    remarks         text,
    created_at      timestamptz not null default now(),
    created_by      uuid references auth.users(id)
);

comment on table public.meeting_reports is 'Comptes-rendus de la réunion hebdomadaire : une ligne = les remarques d''un membre pour une réunion donnée.';

create index if not exists idx_meeting_reports_date on public.meeting_reports (meeting_date desc);
create index if not exists idx_meeting_reports_member on public.meeting_reports (member_id);

-- Fige automatiquement le grade du membre au moment de la création de la ligne
create or replace function public.snapshot_member_grade()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if new.grade_snapshot is null and new.member_id is not null then
        select g.name into new.grade_snapshot
        from public.members m
        join public.grades g on g.id = m.grade_id
        where m.id = new.member_id;
    end if;
    return new;
end;
$$;

drop trigger if exists trg_meeting_reports_snapshot on public.meeting_reports;
create trigger trg_meeting_reports_snapshot before insert on public.meeting_reports
    for each row execute function public.snapshot_member_grade();

-- Vue prête à afficher (nom du membre, grade figé, chapter actuel)
create or replace view public.v_meeting_reports_full as
select
    mr.id,
    mr.meeting_date,
    mr.member_id,
    m.rp_name as member_name,
    mr.grade_snapshot,
    m.matricule,
    c.name as chapter_name,
    mr.remarks,
    mr.created_at
from public.meeting_reports mr
left join public.members m on m.id = mr.member_id
left join public.chapters c on c.id = m.chapter_id;

-- RLS
alter table public.meeting_reports enable row level security;

drop policy if exists meeting_reports_select on public.meeting_reports;
create policy meeting_reports_select on public.meeting_reports
    for select using (public.has_permission('meetings', 'view'));

drop policy if exists meeting_reports_insert on public.meeting_reports;
create policy meeting_reports_insert on public.meeting_reports
    for insert with check (public.has_permission('meetings', 'create'));

drop policy if exists meeting_reports_update on public.meeting_reports;
create policy meeting_reports_update on public.meeting_reports
    for update using (public.has_permission('meetings', 'edit'));

drop policy if exists meeting_reports_delete on public.meeting_reports;
create policy meeting_reports_delete on public.meeting_reports
    for delete using (public.has_permission('meetings', 'delete'));

-- Module (masqué par défaut, à débloquer depuis Paramètres > Permissions)
insert into public.modules (key, label, icon, description, sort_order, is_common) values
    ('meetings', 'Table (Comptes-rendus)', '📋', 'Comptes-rendus de la réunion hebdomadaire, par membre', 65, false)
on conflict (key) do update set label = excluded.label, icon = excluded.icon, description = excluded.description;
