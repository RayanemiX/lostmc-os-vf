-- ============================================================================
-- LOST MC OS - MODULES COMMUNS : TABLEAU DE BORD & PROFIL
-- Fichier : 12_dashboard_profile_modules.sql
-- À exécuter après 11_mecano_module.sql
--
-- Ces deux applications sont accessibles à TOUS les membres connectés
-- (is_common = true), sans qu'il soit nécessaire de leur donner une
-- permission explicite. Elles ne créent pas de nouvelles tables : elles
-- réutilisent les données déjà existantes (membres, trésorerie, stock,
-- planning, notifications).
-- ============================================================================

insert into public.modules (key, label, icon, description, sort_order, is_common) values
    ('dashboard', 'Tableau de bord', '🏠', 'Vue d''ensemble du club', 1, true),
    ('profile',   'Mon Profil',      '🪪', 'Fiche personnelle du membre connecté', 5, true)
on conflict (key) do update set
    label = excluded.label, icon = excluded.icon, description = excluded.description, is_common = excluded.is_common;

-- Le Profil doit permettre à chaque membre de lire (et éditer un minimum,
-- ex: son avatar/téléphone/discord) sa PROPRE fiche, même sans permission
-- 'members'. La policy members_select_self existe déjà (voir 05_rls_policies.sql).
-- On ajoute ici la possibilité de s'auto-éditer un sous-ensemble de champs.
drop policy if exists members_update_self on public.members;
create policy members_update_self on public.members
    for update using (id = auth.uid())
    with check (id = auth.uid());

comment on policy members_update_self on public.members is
    'Permet à un membre de modifier sa propre fiche (utilisé par l''application Profil). Le frontend ne doit exposer que des champs non sensibles (avatar, téléphone, discord) dans ce formulaire, jamais le grade ou le statut.';
