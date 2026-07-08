-- ============================================================================
-- LOST MC OS - HELPERS D'AUTHENTIFICATION
-- Fichier : 07_auth_helpers.sql
-- À exécuter après 06_seed_modules.sql
--
-- Problème résolu : l'écran de connexion doit ressembler à Windows (nom du
-- membre + mot de passe), mais Supabase Auth s'authentifie par email, et la
-- table `members` est protégée par RLS (illisible tant qu'on n'est pas
-- connecté). Ces deux fonctions "security definer" exposent le strict
-- minimum nécessaire à l'écran de login, sans jamais exposer l'annuaire
-- complet des membres à un visiteur non connecté.
-- ============================================================================

-- 1. Retrouve l'email lié à un identifiant de connexion (real_username)
--    Utilisée juste avant signInWithPassword({ email, password }).
create or replace function public.get_login_email(p_username text)
returns text
language sql
stable
security definer
set search_path = public
as $$
    select u.email
    from auth.users u
    join public.members m on m.id = u.id
    where m.real_username = p_username
    limit 1;
$$;

-- 2. Aperçu non sensible (nom RP + avatar) pour afficher le grand avatar
--    façon Windows pendant que l'utilisateur tape son identifiant.
--    Ne retourne QUE ces deux colonnes, jamais le grade, le téléphone, etc.
create or replace function public.get_login_preview(p_username text)
returns table (rp_name text, avatar_url text)
language sql
stable
security definer
set search_path = public
as $$
    select m.rp_name, m.avatar_url
    from public.members m
    where m.real_username = p_username
    limit 1;
$$;

-- Autorise ces deux fonctions à être appelées par un visiteur NON connecté
-- (rôle "anon"), ce qui est nécessaire puisqu'elles sont appelées avant le login.
grant execute on function public.get_login_email(text) to anon, authenticated;
grant execute on function public.get_login_preview(text) to anon, authenticated;
