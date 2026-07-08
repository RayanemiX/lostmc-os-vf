-- ============================================================================
-- LOST MC OS - FOND D'ÉCRAN PAR GRADE
-- Fichier : 08_grade_wallpaper.sql
-- À exécuter après 07_auth_helpers.sql (si votre base est déjà créée,
-- exécutez uniquement ce fichier, pas besoin de tout rejouer).
--
-- Chaque grade peut désormais avoir son propre fond d'écran de bureau.
-- Si un grade n'a pas de wallpaper_url défini, le fond d'écran général du
-- club (club_settings.wallpaper_url) est utilisé à la place (fallback géré
-- côté frontend dans js/main.js).
-- ============================================================================

alter table public.grades
    add column if not exists wallpaper_url text;

comment on column public.grades.wallpaper_url is
    'Fond d''écran de bureau spécifique à ce grade. Si NULL, le club_settings.wallpaper_url général est utilisé.';

-- On recrée la vue v_members_full pour exposer ce nouveau champ
-- (nécessaire pour que le frontend sache quel fond d'écran afficher
-- dès la connexion, sans requête supplémentaire).
-- On DROP puis recrée la vue plutôt que "CREATE OR REPLACE" : PostgreSQL
-- interdit de réordonner ou d'insérer une colonne au milieu d'une vue
-- existante avec REPLACE (il faudrait l'ajouter uniquement à la toute fin).
-- Le DROP est sans risque : aucune autre vue ni contrainte ne dépend de
-- v_members_full, seul le frontend l'interroge par son nom.
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
    c.name as chapter_name
from public.members m
left join public.grades g on g.id = m.grade_id
left join public.chapters c on c.id = m.chapter_id;
