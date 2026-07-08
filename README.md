# LOST MC OS

Système d'exploitation virtuel RP pour le Motorcycle Club **LOST MC**.
Interface immersive (boot → login → bureau → applications), connectée à Supabase, sans grade ni permission codés en dur.

---

## 📁 Architecture du projet

```
lost-mc-os/
├── assets/
│   ├── fonts/          # Polices custom (western/biker + police système)
│   ├── icons/           # Icônes du bureau et des applications (SVG/PNG)
│   └── images/          # Logo Lost MC, fond d'écran, textures
│
├── css/                 # Feuilles de style (une par domaine : boot, login, desktop, apps...)
│
├── js/
│   ├── components/       # Composants réutilisables (fenêtre, context menu, notification toast...)
│   ├── pages/
│   │   ├── boot/          # Séquence de démarrage
│   │   ├── login/         # Écran de connexion façon Windows
│   │   ├── desktop/       # Bureau, barre des tâches, menu démarrer
│   │   └── apps/           # Une sous-app par module (members, treasury, armory...)
│   ├── services/           # Accès Supabase (auth, membres, permissions, trésorerie...)
│   └── utils/               # Fonctions transverses (formatage date, debounce, validation...)
│
├── database/
│   └── sql/               # Scripts SQL Supabase, à exécuter DANS L'ORDRE (voir ci-dessous)
│
└── README.md
```

Chaque application du bureau (Dossiers Membres, Trésorerie, Armurerie...) sera un module JS
indépendant dans `js/pages/apps/`, avec son propre fichier CSS, pour garder une architecture
propre et évolutive.

---

## 🗄️ Mise en place de la base Supabase

### 1. Créer le projet Supabase
Rendez-vous sur [supabase.com](https://supabase.com), créez un nouveau projet, puis récupérez :
- l'**URL du projet** (`Project Settings > API > Project URL`)
- la **clé anonyme publique** (`Project Settings > API > anon public`)

### 2. Exécuter les scripts SQL, DANS CET ORDRE EXACT
Dans l'éditeur SQL de Supabase (`SQL Editor > New query`), collez et exécutez chaque fichier
un par un :

| Ordre | Fichier | Contenu |
|---|---|---|
| 1 | `01_schema_tables.sql` | Toutes les tables (membres, grades, trésorerie, stock, armurerie, formations, planning, relationnel, notifications, audit) |
| 2 | `02_indexes_constraints.sql` | Index de performance + contraintes |
| 3 | `03_functions.sql` | Matricule auto, calcul de solde, permissions, notifications automatiques |
| 4 | `04_views.sql` | Vues prêtes à consommer par le frontend |
| 5 | `05_rls_policies.sql` | Sécurité RLS : chaque table est protégée par les permissions Supabase |
| 6 | `06_seed_modules.sql` | Liste des modules de l'app (fixe) + types d'événements planning (modifiables) |

> ⚠️ Aucun grade, aucune permission, aucun membre n'est créé par ces scripts.
> Base volontairement vide, comme demandé — vous créerez tout depuis l'application.

### 3. Créer votre compte fondateur (obligatoire, une seule fois)

Comme la base est vide, il n'existe encore aucun grade ni aucun moyen de se connecter à
l'application. Il faut créer un premier compte manuellement :

1. **Authentication > Users > Add user** : créez un utilisateur avec un email et un mot de passe.
2. Copiez son **UUID**.
3. Dans le SQL Editor, créez d'abord un grade « fondateur » puis votre fiche membre :

```sql
-- 1. Un grade temporaire avec toutes les permissions (à renommer/réorganiser ensuite)
insert into public.grades (name, hierarchy_order, is_staff)
values ('Président', 1, true)
returning id; -- notez l'UUID retourné

-- 2. Votre fiche membre, en remplaçant les UUID par les vôtres
insert into public.members (id, rp_name, grade_id, status)
values ('UUID_DE_VOTRE_USER_AUTH', 'Votre Nom RP', 'UUID_DU_GRADE_CREE', 'actif');

-- 3. Donnez à ce grade toutes les permissions sur tous les modules
insert into public.permissions (grade_id, module_key, can_view, can_create, can_edit, can_delete, can_manage)
select 'UUID_DU_GRADE_CREE', key, true, true, true, true, true
from public.modules;
```

Une fois connecté avec ce compte, vous pourrez tout gérer (grades, permissions, autres membres)
directement depuis l'application — plus besoin de toucher au SQL Editor.

### 4. Configurer le frontend
Le fichier `js/services/supabaseConfig.js` (livré à l'étape suivante) contiendra un template
à remplir avec votre URL et votre clé anonyme. Ce fichier ne sera jamais commité avec de vraies
clés dans un dépôt public.

### 5. (Optionnel) Notifications planifiées
La fonction `notify_trainings_tomorrow()` doit être appelée une fois par jour pour prévenir des
formations du lendemain. Dans Supabase : **Database > Cron Jobs**, planifiez :
```sql
select public.notify_trainings_tomorrow();
```
à exécuter tous les jours à l'heure de votre choix (ex: `0 18 * * *`).

### 6. Stockage des fichiers (photos, logo, documents)
Créez un bucket Supabase Storage nommé `club-assets` (public en lecture) pour héberger :
logo du club, fond d'écran, photos de profil, photos d'armes, pièces jointes de formations.

---

## 🎨 Direction artistique retenue

- **Fond** : noir profond `#0a0a0a`
- **Surfaces** : gris foncé `#1a1a1a`
- **Accent** : rouge sombre `#8a0303`
- **Texte** : blanc cassé `#f5f5f5`
- Typographie façon patch de blouson pour les titres, police système neutre pour les données
- Glassmorphism sur les fenêtres, ombres profondes, transitions fluides mais sobres (pas d'effet gadget)

---

## 🗺️ Roadmap de livraison (comme demandé, étape par étape)

- [x] **1. Architecture complète du projet**
- [x] **2. Base SQL Supabase complète** (tables, index, fonctions, vues, RLS, seed modules)
- [x] **3. Interface du système d'exploitation** (CSS global, polices, variables de thème)
- [x] **4. Séquence de boot + écran de connexion**
- [x] **5. Bureau** (barre des tâches, fenêtres, menu démarrer, notifications)
- [x] **6. Applications** (Membres, Trésorerie/Stocks, Armurerie, Formations, Planning, Relationnel, Paramètres)
- [x] **7. Système de permissions côté frontend** (masquage dynamique des apps/actions, deny-by-default)
- [ ] **8. Finalisation** (polish visuel poussé, responsive mobile, exports PDF/Excel, vues Jour/Semaine du planning, drag & drop des événements)

L'étape 8 est volontairement la suite naturelle : le projet est déjà utilisable de bout en bout,
mais peut encore être affiné (voir section "Pour aller plus loin" en bas de ce document).

---

## 🚀 Mise en ligne : GitHub + Supabase

### A. Base de données Supabase

1. Créez un projet sur [supabase.com](https://supabase.com).
2. Dans **SQL Editor**, exécutez les fichiers de `database/sql/` **dans l'ordre exact** :
   `01` → `02` → `03` → `04` → `05` → `06` → `07`.
3. Créez votre **compte fondateur** (grade + fiche membre + permissions totales) en suivant
   la section "Créer votre compte fondateur" plus haut dans ce document.
4. Créez un bucket **Storage** nommé `club-assets` (public en lecture) pour héberger logo,
   fond d'écran, photos de profil, photos d'armes.
5. (Optionnel) Planifiez la notification "formation demain" : **Database > Cron Jobs** avec
   `select public.notify_trainings_tomorrow();` une fois par jour.
6. Récupérez vos identifiants dans **Project Settings > API** :
   - `Project URL`
   - `anon public key`

### B. Configuration du frontend

1. Dans `js/services/`, dupliquez `supabaseConfig.example.js` en `supabaseConfig.js`.
2. Remplacez les deux valeurs par celles de votre projet Supabase :
   ```js
   export const SUPABASE_CONFIG = {
       url: 'https://VOTRE-PROJET.supabase.co',
       anonKey: 'VOTRE_CLE_ANONYME_PUBLIQUE',
   };
   ```
3. La clé `anon public` est conçue par Supabase pour être visible côté client (elle est
   protégée par les policies RLS) : vous pouvez la commiter sans risque sur GitHub, y compris
   en dépôt public. Ne mettez en revanche **jamais** la clé `service_role` nulle part dans ce projet.

### C. Hébergement sur GitHub (via GitHub Pages, gratuit)

1. Créez un nouveau dépôt GitHub (ex: `lost-mc-os`).
2. Poussez tout le contenu de ce dossier `lost-mc-os/` à la racine du dépôt :
   ```bash
   cd lost-mc-os
   git init
   git add .
   git commit -m "Initial commit - LOST MC OS"
   git branch -M main
   git remote add origin https://github.com/VOTRE-COMPTE/lost-mc-os.git
   git push -u origin main
   ```
3. Sur GitHub : **Settings > Pages** → Source : `Deploy from a branch` → Branch : `main` / dossier `/ (root)` → Save.
4. Après 1-2 minutes, votre site est accessible à `https://VOTRE-COMPTE.github.io/lost-mc-os/`.
5. Dans **Supabase > Authentication > URL Configuration**, ajoutez cette URL GitHub Pages à la
   liste des **Redirect URLs / Site URL autorisées**, sinon l'authentification refusera de fonctionner
   depuis ce domaine.

> Alternative tout aussi valable : Netlify ou Vercel (glisser-déposer le dossier, ou connecter
> le dépôt GitHub) — le projet est en HTML/CSS/JS pur, sans étape de build, donc compatible
> avec n'importe quel hébergeur statique.

### D. Vérification finale

- Ouvrez l'URL déployée : vous devez voir le boot, puis l'écran de login.
- Connectez-vous avec le compte fondateur créé à l'étape A.3.
- Depuis **Paramètres**, créez vos autres grades, donnez-leur des permissions, puis créez vos
  autres membres (dans **Dossiers Membres**) une fois leur compte Supabase Auth créé.

---

## 🎨 Créer les grades et personnaliser leur fond d'écran

**Créer un grade** : connecté avec un compte ayant la permission `manage` sur `settings`,
va dans **Paramètres > 🎖️ Grades > + Ajouter**. Renseigne le nom, l'ordre hiérarchique
(1 = le plus haut) et, si tu veux, une **URL de fond d'écran spécifique à ce grade**.

**Donner accès aux applications** : un grade sans permission ne voit rien (sécurité
par défaut). Va dans **Paramètres > 🔐 Permissions**, choisis le grade, coche les
modules et actions autorisés.

**Fond d'écran par grade** : chaque grade a un champ `wallpaper_url` optionnel
(colonne ajoutée par `database/sql/08_grade_wallpaper.sql`). Au login, le bureau
affiche en priorité le fond d'écran du grade du membre connecté ; si ce champ est
vide, il retombe sur le fond d'écran général du club (Paramètres > 🎨 Apparence).
Si votre base Supabase existe déjà, exécutez uniquement `08_grade_wallpaper.sql`
dans le SQL Editor — pas besoin de rejouer les fichiers précédents.

---

## 🆕 Extension : rôles multiples, Bar, Atelier Mécanique, Tableau de bord, Profil

Ces fonctionnalités ont été ajoutées par migrations additives. **Si ta base existe déjà**,
exécute uniquement les nouveaux fichiers, dans l'ordre, sans rejouer les précédents :

| Fichier | Contenu |
|---|---|
| `09_functions_and_permissions.sql` | Table `functions` (rôles secondaires cumulables), table de liaison `member_functions`, généralisation de `permissions` (grade OU fonction), modules "communs" |
| `10_bar_module.sql` | Application Bar indépendante (trésorerie, stock, factures, catalogue) |
| `11_mecano_module.sql` | Application Atelier Mécanique indépendante (trésorerie, stock, factures, prestations) |
| `12_dashboard_profile_modules.sql` | Modules communs Tableau de bord & Profil, auto-édition de sa propre fiche |

### Comment ça marche

- Un membre garde **un seul grade principal** (hiérarchique, comme avant) mais peut cumuler
  **autant de fonctions que voulu** (ex: Barman + Mécanicien) depuis **Dossiers Membres** (panneau
  "Fonctions cumulées par membre", en bas de l'appli).
- Créez vos fonctions dans **Paramètres > 🧰 Fonctions** (ex: Barman, Gérant Bar, Mécanicien,
  Gérant Mécano).
- Donnez-leur des permissions dans **Paramètres > 🔐 Permissions**, en basculant l'onglet entre
  **🎖️ Grades** et **🧰 Fonctions** en haut du tableau.
- L'accès final à un module = permissions du grade **OU** permissions de n'importe laquelle des
  fonctions du membre (logique OR), calculé automatiquement côté SQL.
- **Tableau de bord** et **Mon Profil** sont visibles par tous, sans configuration de permission
  (modules marqués `is_common` en base).
- **Bar** et **Atelier Mécanique** sont deux applications totalement indépendantes de la
  trésorerie/stock principaux (leurs propres tables, leur propre solde) : masquées par défaut,
  à débloquer via une fonction ou un grade ayant la permission `view` sur `bar` / `mecano`.

---

## 🩹 Correctif critique + nouvelle application Table

| Fichier | Contenu |
|---|---|
| `13_fix_trigger_security.sql` | **À exécuter dans tous les cas**, quelle que soit votre progression. Corrige un bug qui annulait silencieusement l'ajout d'armes, de mouvements de stock, de transactions de trésorerie et de nouveaux membres (les fonctions automatiques n'étaient pas déclarées `SECURITY DEFINER` et se heurtaient à la sécurité RLS en interne). |
| `14_meeting_reports.sql` | Nouvelle application **Table** : comptes-rendus de la réunion hebdomadaire (une ligne = les remarques d'un membre pour une réunion, avec son grade figé à la date). Module `meetings`, masqué par défaut — à débloquer dans Paramètres > Permissions. |

Un second bug a aussi été corrigé côté JavaScript (`crudEngine.js`, `dom.js`) : les menus déroulants
(grade, statut, chapter...) pouvaient afficher la mauvaise valeur en modification à cause d'un
attribut HTML mal posé. **Remplacez ces deux fichiers** par les nouvelles versions du zip, en plus
de jouer les fichiers SQL.

### Fond d'écran unique et applications restreintes par grade — déjà possible

Pas besoin de nouveau développement, tout est déjà en place :

- **Fond d'écran imposé par grade** : Paramètres > 🎖️ Grades > modifier le grade "Secrétaire" >
  champ *"Fond d'écran de ce grade"*. Ce champ n'est modifiable que par un membre ayant la
  permission `manage` sur `settings` (donc vous, pas le secrétaire lui-même) — c'est déjà imposé
  par la sécurité RLS (`grades_manage`), pas seulement par l'interface.
- **Applications limitées par grade** : Paramètres > 🔐 Permissions > sélectionnez le grade
  "Secrétaire" > ne cochez QUE les modules que vous voulez lui donner (ex: Dossiers Membres,
  Planning, Relationnel) et laissez tout le reste décoché. Par sécurité par défaut
  ("deny by default"), tout module non coché reste invisible et inaccessible pour ce grade,
  y compris en modifiant l'URL ou en interrogeant la base directement (protégé par RLS, pas
  seulement caché côté écran).

---

## 🏁 Version finale : hiérarchie complète, Bar/Atelier verrouillés, Bloc-notes

| Fichier | Contenu |
|---|---|
| `15_lost_grades_seed.sql` | Crée votre hiérarchie complète (Nat Président → Représentant), les fonctions **Barman** et **Mécanicien**, et des permissions par défaut réalistes. **Nécessite `09_functions_and_permissions.sql`** (table `functions`). |
| `16_notepad.sql` | Nouvelle application **Bloc-notes**, privée et commune à tous (chacun ne voit que ses propres notes, imposé par la sécurité Supabase). |

### Ce que fait `15_lost_grades_seed.sql` concrètement

- **Nat Président** et **Président** : accès à absolument toutes les applications, y compris **Bar** et **Atelier Mécanique**.
- **Sergent d'Armes** : uniquement Armurerie (+ Tableau de bord/Profil/Formations/Planning/Bloc-notes, communs à tous).
- **Trésorier** : Trésorerie + Stock en accès complet. **Bookkeeper** : les mêmes en consultation/saisie, sans suppression.
- **Secrétaire** : Membres + Relationnel + Table (comptes-rendus).
- **Diplomate / Représentant** : Relationnel en consultation.
- **Road Captain, Lieutenant Field, Road Guard, Peacemaker, Asskicker, Arc Rider, Tailgunner** : uniquement les apps communes par défaut (à vous d'ajuster si besoin).
- **Bar et Atelier Mécanique ne sont accessibles à PERSONNE d'autre par défaut.** Pour qu'un membre (peu importe son grade) y ait accès, assignez-lui la fonction **Barman** ou **Mécanicien** depuis **Dossiers Membres** — exactement la règle demandée : *Président (par grade) OU la fonction dédiée*, jamais l'un sans l'autre pour les autres grades.

Tout ceci reste **entièrement modifiable** ensuite depuis Paramètres > 🔐 Permissions (bascule 🎖️ Grade Lost / 🧰 Fonction en haut du tableau) — ce seed n'est qu'un point de départ cohérent avec votre demande, pas une valeur figée dans le code.

### Correctif : le solde de trésorerie ne s'actualisait pas

Bug corrigé dans `treasury.js`, `bar.js`, `mecano.js` : le solde affiché était calculé une seule
fois à l'ouverture de l'application et ne se remettait jamais à jour après un ajout. Il est
maintenant recalculé à chaque rafraîchissement de la liste (lu directement depuis la transaction
la plus récente). **Remplacez ces trois fichiers** dans votre projet.

### Fichiers JS modifiés dans cette version

- `js/pages/apps/treasury.js`, `bar.js`, `mecano.js` (correctif solde figé)
- `js/pages/apps/crudEngine.js` (ajout du bypass de permission pour les apps privées comme le Bloc-notes)
- `js/pages/apps/appRegistry.js` (Bloc-notes enregistré)
- `js/pages/apps/notepad.js` (nouveau fichier)
- `js/pages/apps/settings.js` (libellés clarifiés : Grades Lost vs Fonctions)

---

## 🔧 Pour aller plus loin (étape 8 et au-delà)

- Vues Semaine/Jour + glisser-déposer des événements dans Planning (la structure `starts_at`/`ends_at` le permet déjà).
- Upload direct de fichiers vers Supabase Storage (photos, pièces jointes) au lieu de coller des URLs.
- Exports PDF/Excel (trésorerie, membres, inventaire armurerie).
- Page d'audit dédiée (la table `audit_logs` existe déjà).
- Messagerie interne, garage/véhicules, votes, économie d'entreprise (évolutivité prévue dans le schéma).
