-- ============================================================================
-- LOST MC OS - FONCTIONS SQL
-- Fichier : 03_functions.sql
-- À exécuter après 02_indexes_constraints.sql
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Fonction utilitaire : maj automatique de updated_at
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists trg_grades_updated_at on public.grades;
create trigger trg_grades_updated_at before update on public.grades
    for each row execute function public.set_updated_at();

drop trigger if exists trg_members_updated_at on public.members;
create trigger trg_members_updated_at before update on public.members
    for each row execute function public.set_updated_at();

drop trigger if exists trg_weapons_updated_at on public.weapons;
create trigger trg_weapons_updated_at before update on public.weapons
    for each row execute function public.set_updated_at();

drop trigger if exists trg_trainings_updated_at on public.trainings;
create trigger trg_trainings_updated_at before update on public.trainings
    for each row execute function public.set_updated_at();

drop trigger if exists trg_relations_updated_at on public.relations;
create trigger trg_relations_updated_at before update on public.relations
    for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 2. Génération automatique du matricule membre (ex: LMC-0001)
-- ----------------------------------------------------------------------------
create sequence if not exists public.matricule_seq start 1;

create or replace function public.generate_matricule()
returns trigger
language plpgsql
as $$
begin
    if new.matricule is null then
        new.matricule := 'LMC-' || lpad(nextval('public.matricule_seq')::text, 4, '0');
    end if;
    return new;
end;
$$;

drop trigger if exists trg_members_matricule on public.members;
create trigger trg_members_matricule before insert on public.members
    for each row execute function public.generate_matricule();

-- ----------------------------------------------------------------------------
-- 3. Trésorerie : calcul automatique du solde après chaque transaction
-- ----------------------------------------------------------------------------
create or replace function public.compute_treasury_balance()
returns trigger
language plpgsql
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

drop trigger if exists trg_treasury_balance on public.treasury_transactions;
create trigger trg_treasury_balance before insert on public.treasury_transactions
    for each row execute function public.compute_treasury_balance();

-- Fonction pratique : solde actuel du club
create or replace function public.get_treasury_balance()
returns numeric
language sql
stable
as $$
    select coalesce(balance_after, 0)
    from public.treasury_transactions
    order by created_at desc
    limit 1;
$$;

-- ----------------------------------------------------------------------------
-- 4. Stocks : mise à jour automatique de la quantité + alerte stock faible
-- ----------------------------------------------------------------------------
create or replace function public.apply_stock_movement()
returns trigger
language plpgsql
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

drop trigger if exists trg_stock_movement on public.stock_movements;
create trigger trg_stock_movement before insert on public.stock_movements
    for each row execute function public.apply_stock_movement();

-- ----------------------------------------------------------------------------
-- 5. Armurerie : mise à jour du stock d'armes + historique automatique
-- ----------------------------------------------------------------------------
create or replace function public.log_weapon_stock_change()
returns trigger
language plpgsql
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

drop trigger if exists trg_weapon_stock_log on public.weapons;
create trigger trg_weapon_stock_log after insert or update on public.weapons
    for each row execute function public.log_weapon_stock_change();

-- ----------------------------------------------------------------------------
-- 6. Permissions : fonctions utilisées par les policies RLS
-- ----------------------------------------------------------------------------

-- Retourne le grade_id du membre actuellement connecté
create or replace function public.current_grade_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
    select grade_id from public.members where id = auth.uid();
$$;

-- Vérifie si le membre connecté a une permission donnée sur un module
-- action ∈ ('view','create','edit','delete','manage')
create or replace function public.has_permission(p_module_key text, p_action text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select coalesce(
        (select case p_action
                    when 'view'   then can_view
                    when 'create' then can_create
                    when 'edit'   then can_edit
                    when 'delete' then can_delete
                    when 'manage' then can_manage
                    else false
                end
         from public.permissions
         where grade_id = public.current_grade_id()
           and module_key = p_module_key),
        false
    );
$$;

-- ----------------------------------------------------------------------------
-- 7. Armurerie : combien d'exemplaires peuvent être fabriqués avec le stock actuel
-- ----------------------------------------------------------------------------
create or replace function public.craftable_quantity(p_weapon_id uuid)
returns integer
language sql
stable
as $$
    select coalesce(
        min(floor(si.current_quantity::numeric / wr.quantity_needed)),
        0
    )::integer
    from public.weapon_recipes wr
    join public.stock_items si on si.category_id = wr.category_id
    where wr.weapon_id = p_weapon_id;
$$;

-- ----------------------------------------------------------------------------
-- 8. Notification automatique : nouveau membre / promotion
-- ----------------------------------------------------------------------------
create or replace function public.notify_member_events()
returns trigger
language plpgsql
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

drop trigger if exists trg_notify_member_events on public.members;
create trigger trg_notify_member_events after insert or update on public.members
    for each row execute function public.notify_member_events();

-- Notification : mouvement de trésorerie
create or replace function public.notify_treasury_events()
returns trigger
language plpgsql
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

drop trigger if exists trg_notify_treasury on public.treasury_transactions;
create trigger trg_notify_treasury after insert on public.treasury_transactions
    for each row execute function public.notify_treasury_events();

-- Notification : nouvelle arme
create or replace function public.notify_weapon_created()
returns trigger
language plpgsql
as $$
begin
    insert into public.notifications (recipient_id, type, title, message, link_module)
    values (null, 'nouvelle_arme', 'Nouvelle arme', new.name || ' a été ajoutée au catalogue.', 'armory');
    return new;
end;
$$;

drop trigger if exists trg_notify_weapon on public.weapons;
create trigger trg_notify_weapon after insert on public.weapons
    for each row execute function public.notify_weapon_created();

-- Notification : formation prévue (à appeler via un cron Supabase - voir README)
create or replace function public.notify_trainings_tomorrow()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.notifications (recipient_id, type, title, message, link_module)
    select null, 'formation', 'Formation demain', t.title || ' aura lieu demain.', 'trainings'
    from public.trainings t
    where t.training_date = current_date + interval '1 day';
end;
$$;

-- ----------------------------------------------------------------------------
-- 9. Mise à jour du last_login_at (appelée depuis le front après connexion)
-- ----------------------------------------------------------------------------
create or replace function public.update_last_login()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    update public.members set last_login_at = now() where id = auth.uid();
end;
$$;
