-- ============================================================================
-- LOST MC OS - SEED DES MODULES
-- Fichier : 06_seed_modules.sql
-- À exécuter en dernier.
--
-- Ceci N'EST PAS un seed de données métier : aucun grade, aucun membre,
-- aucune permission n'est créé ici (conformément à votre demande, vous les
-- créerez vous-même depuis Paramètres). On enregistre uniquement :
--   - la liste des modules/écrans du logiciel (nécessaire pour que l'écran
--     Paramètres > Permissions puisse afficher une grille "grade x module"),
--   - les types d'événements de planning de base (modifiables/complétables
--     ensuite dans Paramètres),
--   - une ligne club_settings par défaut (le singleton, à personnaliser).
-- ============================================================================

insert into public.modules (key, label, icon, description, sort_order) values
    ('members',       'Dossiers Membres',  '🗂️', 'Gestion des membres du club',              10),
    ('treasury',       'Trésorerie',        '💰', 'Gestion financière du club',                20),
    ('stock',           'Stocks',           '📦', 'Gestion des matériaux et ressources',       30),
    ('armory',           'Armurerie',       '🔫', 'Catalogue et stock d''armes',                40),
    ('trainings',       'Formations',       '🎓', 'Organisation des formations',                50),
    ('planning',         'Planning',        '📅', 'Calendrier des événements du club',          60),
    ('relations',       'Relationnel',      '🤝', 'Relations avec MC, gangs, institutions',      70),
    ('settings',         'Paramètres',      '⚙️', 'Configuration du club, grades, permissions', 80)
on conflict (key) do update set
    label = excluded.label,
    icon = excluded.icon,
    description = excluded.description,
    sort_order = excluded.sort_order;

insert into public.event_types (key, label, color) values
    ('formation',   'Formation',           '#4a90d9'),
    ('reunion',     'Réunion',             '#8a0303'),
    ('vente_armes', 'Vente d''armes',      '#c9a227'),
    ('braquage',    'Braquage RP',         '#7a1f1f'),
    ('rdv',         'Rendez-vous',         '#5f5f5f'),
    ('sortie',      'Sortie',              '#2e7d32'),
    ('patrouille',  'Patrouille',          '#3a3a3a')
on conflict (key) do update set
    label = excluded.label,
    color = excluded.color;

-- Ligne unique de paramètres du club, avec le logo fourni par l'utilisateur.
-- Vous pourrez remplacer logo_url / wallpaper_url par vos propres fichiers
-- hébergés dans Supabase Storage (bucket "club-assets", voir README).
insert into public.club_settings (id, club_name, primary_color, secondary_color, background_color, accent_color)
values (1, 'LOST MC', '#8a0303', '#1a1a1a', '#0a0a0a', '#f5f5f5')
on conflict (id) do nothing;

-- ============================================================================
-- NOTE IMPORTANTE
-- ============================================================================
-- Après exécution de ce fichier, votre base est vide de toute donnée métier :
-- - 0 grade -> créez-les dans Paramètres > Grades (l'app vous laissera
--   définir le nom, l'ordre hiérarchique et si le grade fait partie du bureau)
-- - 0 permission -> tant qu'un grade n'a aucune ligne dans `permissions`,
--   les membres de ce grade ne voient AUCUN module (sécurité par défaut :
--   "deny by default"). Pensez à donner au premier grade (ex: Président)
--   toutes les permissions sur tous les modules dès sa création.
-- - 0 membre -> le tout premier compte doit être créé manuellement :
--   1. Créez un utilisateur dans Supabase Auth (email + mot de passe)
--   2. Insérez une ligne dans `public.members` avec cet id, un rp_name,
--      et un grade_id (une fois le grade créé)
--   Ce premier compte "fondateur" vous permettra ensuite de tout gérer
--   depuis l'application elle-même.
-- ============================================================================
