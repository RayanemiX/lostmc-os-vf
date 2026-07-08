-- ============================================================================
-- LOST MC OS - HIÉRARCHIE COMPLÈTE DES GRADES + FONCTIONS BAR/MÉCANO
-- Fichier : 15_lost_grades_seed.sql
-- À exécuter après 14_meeting_reports.sql (nécessite 09_functions_and_permissions.sql
-- pour la table `functions` et la généralisation de `permissions`).
--
-- Ce fichier :
--  1. Crée (ou réordonne si elle existe déjà) votre hiérarchie complète de
--     GRADES LOST (rôle principal, un seul par membre).
--  2. Crée les FONCTIONS (rôles secondaires cumulables) "Barman" et
--     "Mécanicien", bien distinctes des grades.
--  3. Configure des permissions par défaut cohérentes avec votre demande :
--     Bar/Atelier réservés au(x) grade(s) de tête + à la fonction dédiée ;
--     Sergent d'Armes -> Armurerie uniquement ; Trésorier -> Trésorerie/Stock ;
--     Secrétaire -> Membres/Relationnel/Table ; etc.
--     C'est un point de départ réaliste : modifiez-le librement ensuite
--     depuis Paramètres > Permissions, rien n'est figé dans le code.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. GRADES LOST (hiérarchie principale)
-- On libère d'abord la plage 1-15 en décalant les grades existants, pour
-- éviter tout conflit avec l'unicité de hierarchy_order (ex: votre grade
-- fondateur "Président" créé manuellement en tout début de mise en place).
-- ----------------------------------------------------------------------------
update public.grades set hierarchy_order = hierarchy_order + 1000;

insert into public.grades (name, hierarchy_order, is_staff) values
    ('Nat Président',    1, true),
    ('Président',        2, true),
    ('Sergent d''Armes',  3, true),
    ('Road Captain',      4, true),
    ('Trésorier',          5, true),
    ('Secrétaire',          6, true),
    ('Lieutenant Field',     7, false),
    ('Road Guard',            8, false),
    ('Peacemaker',              9, false),
    ('Asskicker',                10, false),
    ('Arc Rider',                  11, false),
    ('Tailgunner',                   12, false),
    ('Bookkeeper',                    13, false),
    ('Diplomate',                       14, false),
    ('Représentant',                     15, false)
on conflict (name) do update set
    hierarchy_order = excluded.hierarchy_order,
    is_staff = excluded.is_staff;

comment on table public.grades is
    'Hiérarchie principale LOST MC. Un membre a UN SEUL grade ici. Pour les rôles secondaires cumulables (Barman, Mécanicien...), voir la table functions.';

-- ----------------------------------------------------------------------------
-- 2. FONCTIONS (rôles secondaires cumulables, distincts des grades)
-- ----------------------------------------------------------------------------
insert into public.functions (name, icon, description) values
    ('Barman',      '🍸', 'Accès à l''application Bar (trésorerie, stock, factures, catalogue du bar)'),
    ('Mécanicien',   '🔧', 'Accès à l''application Atelier Mécanique (trésorerie, stock, factures, prestations)')
on conflict (name) do nothing;

-- ----------------------------------------------------------------------------
-- 3. PERMISSIONS PAR DÉFAUT
-- Rappel : Tableau de bord, Profil, Formations et Planning sont "communs"
-- (visibles par tous automatiquement) : pas besoin de ligne de permission
-- pour ceux-là.
-- ----------------------------------------------------------------------------

-- 3.a Nat Président & Président : accès total à TOUS les modules, y compris
--     Bar et Atelier (comme demandé : "président a toutes les app").
insert into public.permissions (grade_id, module_key, can_view, can_create, can_edit, can_delete, can_manage)
select g.id, m.key, true, true, true, true, true
from public.grades g
cross join public.modules m
where g.name in ('Nat Président', 'Président')
on conflict (grade_id, module_key) where grade_id is not null
    do update set can_view = true, can_create = true, can_edit = true, can_delete = true, can_manage = true;

-- 3.b Sergent d'Armes : Armurerie uniquement (+ modules communs automatiques)
insert into public.permissions (grade_id, module_key, can_view, can_create, can_edit, can_delete, can_manage)
select g.id, 'armory', true, true, true, true, false
from public.grades g where g.name = 'Sergent d''Armes'
on conflict (grade_id, module_key) where grade_id is not null
    do update set can_view = true, can_create = true, can_edit = true, can_delete = true;

-- 3.c Trésorier : Trésorerie + Stock (accès complet)
insert into public.permissions (grade_id, module_key, can_view, can_create, can_edit, can_delete, can_manage)
select g.id, m.key, true, true, true, true, true
from public.grades g cross join (values ('treasury'), ('stock')) as m(key)
where g.name = 'Trésorier'
on conflict (grade_id, module_key) where grade_id is not null
    do update set can_view = true, can_create = true, can_edit = true, can_delete = true, can_manage = true;

-- 3.d Bookkeeper (assistant-comptable) : Trésorerie + Stock en consultation/saisie, sans suppression
insert into public.permissions (grade_id, module_key, can_view, can_create, can_edit, can_delete, can_manage)
select g.id, m.key, true, true, false, false, false
from public.grades g cross join (values ('treasury'), ('stock')) as m(key)
where g.name = 'Bookkeeper'
on conflict (grade_id, module_key) where grade_id is not null
    do update set can_view = true, can_create = true;

-- 3.e Secrétaire : Membres + Relationnel + Table (comptes-rendus)
insert into public.permissions (grade_id, module_key, can_view, can_create, can_edit, can_delete, can_manage)
select g.id, m.key, true, true, true, false, false
from public.grades g cross join (values ('members'), ('relations'), ('meetings')) as m(key)
where g.name = 'Secrétaire'
on conflict (grade_id, module_key) where grade_id is not null
    do update set can_view = true, can_create = true, can_edit = true;

-- 3.f Diplomate & Représentant : Relationnel en consultation
insert into public.permissions (grade_id, module_key, can_view, can_create, can_edit, can_delete, can_manage)
select g.id, 'relations', true, false, false, false, false
from public.grades g where g.name in ('Diplomate', 'Représentant')
on conflict (grade_id, module_key) where grade_id is not null
    do update set can_view = true;

-- 3.g Fonctions Barman / Mécanicien : accès à LEUR application uniquement.
--     C'est cette ligne, combinée à 3.a, qui réalise exactement votre règle :
--     Bar/Atelier visibles seulement par Nat Président/Président (par grade)
--     OU par le membre spécifique ayant la fonction Barman/Mécanicien
--     (assignable un par un depuis Dossiers Membres, indépendamment du grade).
insert into public.permissions (function_id, module_key, can_view, can_create, can_edit, can_delete, can_manage)
select f.id, 'bar', true, true, true, true, true
from public.functions f where f.name = 'Barman'
on conflict (function_id, module_key) where function_id is not null
    do update set can_view = true, can_create = true, can_edit = true, can_delete = true, can_manage = true;

insert into public.permissions (function_id, module_key, can_view, can_create, can_edit, can_delete, can_manage)
select f.id, 'mecano', true, true, true, true, true
from public.functions f where f.name = 'Mécanicien'
on conflict (function_id, module_key) where function_id is not null
    do update set can_view = true, can_create = true, can_edit = true, can_delete = true, can_manage = true;

-- ============================================================================
-- IMPORTANT : Bar/Atelier ne sont donc PLUS accessibles par défaut à aucun
-- autre grade que Nat Président/Président. Pour qu'un membre "normal" (ex:
-- Road Guard) puisse travailler au bar, assignez-lui la fonction "Barman"
-- depuis Dossiers Membres > panneau "Fonctions cumulées par membre" — son
-- grade Lost ne change pas, il gagne juste l'accès à l'application Bar.
-- ============================================================================
