-- ============================================================================
-- LOST MC OS - APPLICATION BLOC-NOTES
-- Fichier : 16_notepad.sql
-- À exécuter après 15_lost_grades_seed.sql
--
-- Bloc-notes personnel : chaque membre ne voit et ne modifie QUE ses propres
-- notes (RLS strict sur member_id = auth.uid()), quel que soit son grade.
-- Application "commune" : visible par tous, aucune permission à configurer.
-- ============================================================================

create table if not exists public.personal_notes (
    id              uuid primary key default gen_random_uuid(),
    member_id       uuid not null references public.members(id) on delete cascade,
    title           text not null default 'Sans titre',
    content         text,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

create index if not exists idx_personal_notes_member on public.personal_notes (member_id, updated_at desc);

drop trigger if exists trg_personal_notes_updated_at on public.personal_notes;
create trigger trg_personal_notes_updated_at before update on public.personal_notes
    for each row execute function public.set_updated_at();

alter table public.personal_notes enable row level security;

drop policy if exists personal_notes_all_own on public.personal_notes;
create policy personal_notes_all_own on public.personal_notes
    for all using (member_id = auth.uid())
    with check (member_id = auth.uid());

insert into public.modules (key, label, icon, description, sort_order, is_common) values
    ('notepad', 'Bloc-notes', '📝', 'Notes personnelles privées', 8, true)
on conflict (key) do update set label = excluded.label, icon = excluded.icon, description = excluded.description, is_common = true;
