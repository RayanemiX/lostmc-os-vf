-- ============================================================================
-- LOST MC OS - CORRECTIF CRITIQUE : SÉCURITÉ DES TRIGGERS
-- Fichier : 13_fix_trigger_security.sql
-- À exécuter dans TOUS LES CAS, quelle que soit votre progression (peut être
-- exécuté même si vous n'avez encore rien d'autre après 07). Sans risque à
-- rejouer plusieurs fois.
--
-- PROBLÈME CORRIGÉ :
-- Plusieurs fonctions déclenchées automatiquement (calcul du solde de
-- trésorerie, mise à jour des stocks, historique des armes, notifications
-- automatiques) écrivent dans des tables protégées par des policies RLS
-- restrictives (ex: notifications, weapon_history, stock_items). Comme ces
-- fonctions n'étaient PAS déclarées "SECURITY DEFINER", elles s'exécutaient
-- avec les droits du membre connecté, qui n'a pas le droit d'écrire
-- directement dans ces tables (par design, pour empêcher qu'un membre
-- fabrique de fausses notifications). Résultat : PostgreSQL bloquait
-- l'écriture ET annulait TOUTE la transaction d'origine — un mouvement de
-- stock, une nouvelle arme, une transaction de trésorerie ou un nouveau
-- membre pouvait donc être silencieusement rejeté.
--
-- La correction : on déclare ces fonctions "SECURITY DEFINER", ce qui leur
-- permet de s'exécuter avec les droits du propriétaire des tables (qui,
-- lui, n'est pas soumis à la RLS), exactement comme le sont déjà
-- has_permission() et current_grade_id().
-- ============================================================================

create or replace function public.compute_treasury_balance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    prev_balance numeric(14,2);
begin
    select coalesce(balance_after, 0) into prev_balance
    from public.treasury_transactions
    where created_at <= new.created_at and id <> new.id
    order by created_at desc
    limit 1;

    if prev_balance is null then
        prev_balance := 0;
    end if;

    if new.type = 'entree' then
        new.balance_after := prev_balance + new.amount;
    else
        new.balance_after := prev_balance - new.amount;
    end if;

    return new;
end;
$$;

create or replace function public.apply_stock_movement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_current integer;
    v_alert integer;
    v_category_name text;
begin
    insert into public.stock_items (category_id, current_quantity)
    values (new.category_id, 0)
    on conflict (category_id) do nothing;

    if new.type = 'entree' then
        update public.stock_items
            set current_quantity = current_quantity + new.quantity, updated_at = now()
            where category_id = new.category_id
            returning current_quantity into v_current;
    else
        update public.stock_items
            set current_quantity = greatest(current_quantity - new.quantity, 0), updated_at = now()
            where category_id = new.category_id
            returning current_quantity into v_current;
    end if;

    select low_stock_alert, name into v_alert, v_category_name
    from public.stock_categories where id = new.category_id;

    if v_current <= v_alert then
        insert into public.notifications (recipient_id, type, title, message, link_module)
        values (null, 'stock_faible', 'Stock faible',
                'Le stock de "' || v_category_name || '" est descendu à ' || v_current || '.',
                'treasury');
    end if;

    return new;
end;
$$;

create or replace function public.log_weapon_stock_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if (tg_op = 'INSERT') then
        insert into public.weapon_history (weapon_id, action, quantity, comment)
        values (new.id, 'creation', new.stock_quantity, 'Création de l''arme');
    elsif (tg_op = 'UPDATE' and new.stock_quantity <> old.stock_quantity) then
        insert into public.weapon_history (weapon_id, action, quantity, comment)
        values (new.id, case when new.stock_quantity > old.stock_quantity then 'entree_stock' else 'sortie_stock' end,
                abs(new.stock_quantity - old.stock_quantity), 'Ajustement de stock');
    end if;
    return new;
end;
$$;

create or replace function public.notify_member_events()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if (tg_op = 'INSERT') then
        insert into public.notifications (recipient_id, type, title, message, link_module)
        values (null, 'nouveau_membre', 'Nouveau membre', new.rp_name || ' a rejoint le club.', 'members');
    elsif (tg_op = 'UPDATE' and new.grade_id is distinct from old.grade_id) then
        insert into public.notifications (recipient_id, type, title, message, link_module)
        values (null, 'promotion', 'Changement de grade', new.rp_name || ' a changé de grade.', 'members');

        insert into public.member_history (member_id, event_type, old_value, new_value, comment)
        values (new.id, 'promotion', old.grade_id::text, new.grade_id::text, 'Changement de grade automatique');
    end if;
    return new;
end;
$$;

create or replace function public.notify_treasury_events()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.notifications (recipient_id, type, title, message, link_module)
    values (null,
            case when new.type = 'entree' then 'argent_ajoute' else 'argent_retire' end,
            case when new.type = 'entree' then 'Argent ajouté' else 'Argent retiré' end,
            new.amount::text || ' $ - ' || coalesce(new.comment, 'Sans commentaire'),
            'treasury');
    return new;
end;
$$;

create or replace function public.notify_weapon_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.notifications (recipient_id, type, title, message, link_module)
    values (null, 'nouvelle_arme', 'Nouvelle arme', new.name || ' a été ajoutée au catalogue.', 'armory');
    return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- Si vous avez déjà exécuté 10_bar_module.sql / 11_mecano_module.sql, les
-- fichiers ont été mis à jour pour inclure directement le correctif
-- (SECURITY DEFINER) dans leurs fonctions bar_*/mecano_*. Il suffit de
-- rejouer ces deux fichiers en entier : ils sont 100% idempotents
-- (CREATE OR REPLACE / IF NOT EXISTS partout), sans aucun risque de doublon
-- ou de perte de données.
-- ----------------------------------------------------------------------------
