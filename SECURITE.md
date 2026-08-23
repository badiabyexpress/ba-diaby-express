# Sécurité de l'accès aux données

Ce document décrit l'état réel de la protection des données de Ba-Diaby Express, ce qui a déjà
été fait, et ce qu'il reste à faire. Il est destiné à être lu par quelqu'un qui reprendra le
sujet dans six mois.

---

## Le problème de fond

L'application gère son propre écran de connexion (identifiant + mot de passe, comptes stockés
dans les données). Elle ne se sert pas des comptes Supabase. Pour lire et écrire, le navigateur
utilise donc la **clé « anon » de Supabase**, qui est publiée dans le JavaScript envoyé à chaque
visiteur — elle est publique par construction.

Tant que la base accorde des droits à cette clé, **l'écran de connexion de l'application ne
protège rien** : quelqu'un qui extrait la clé du code peut interroger la base directement, sans
jamais voir l'écran de connexion. La table `bde_data` contient les clients, leurs numéros de
téléphone, leurs adresses, tous les paiements, et les comptes utilisateurs avec l'empreinte de
leur mot de passe.

C'est le compromis assumé au départ, documenté dans `src/lib/storage.js`. Il n'est pas tenable
à long terme.

---

## Ce qui a été fait (15/08/2026)

Migration `limiter_suppression_aux_sauvegardes`.

La table n'avait qu'une seule politique : `ALL / public / USING true` — tous les droits, y compris
la suppression. Elle a été remplacée par quatre politiques explicites :

| Opération | Autorisée à la clé publique | Pourquoi |
|---|---|---|
| Lecture | oui | l'application en a besoin à chaque ouverture |
| Création | oui | première écriture d'une clé (sauvegarde du jour) |
| Mise à jour | oui | chaque enregistrement de colis, de paiement… |
| **Suppression** | **uniquement les clés `bde-backup-%`** | l'application ne supprime que ses vieilles sauvegardes |

**Effet** : la ligne de données vivante (`bde-data`) ne peut plus être effacée avec la clé
publique. Le scénario « quelqu'un vide la base » est écarté.

**Ce que cela ne corrige pas** : la lecture et la modification restent ouvertes à cette clé. La
confidentialité des données n'est donc pas encore assurée — seule leur destruction l'est.

Vérifié après application, sous le rôle `anon` lui-même : lecture OK, écriture OK, rotation des
sauvegardes OK, suppression de `bde-data` bloquée.

### Revenir en arrière

```sql
drop policy if exists "Lecture par la clé applicative" on public.bde_data;
drop policy if exists "Création par la clé applicative" on public.bde_data;
drop policy if exists "Mise à jour par la clé applicative" on public.bde_data;
drop policy if exists "Suppression limitée aux sauvegardes" on public.bde_data;
create policy "Accès complet via la clé anon" on public.bde_data for all using (true) with check (true);
```

---

## La manœuvre : sortir la clé publique du chemin

### Pourquoi les solutions évidentes ne conviennent pas ici

- **Créer un compte Supabase par agent** : les mots de passe sont stockés hachés (PBKDF2), donc
  non récupérables pour créer les comptes correspondants. Il faudrait faire redéfinir son mot de
  passe à toute l'équipe. Et comme tout le monde lit la même ligne de données, les règles d'accès
  ne feraient de toute façon aucune distinction entre eux : le gain serait d'exiger un compte,
  rien de plus.
- **Un compte Supabase unique pour l'application** : ses identifiants devraient se trouver dans le
  code envoyé au navigateur — le problème de la clé anon, à l'identique.
- **Signer un jeton que Supabase accepte** : c'était le plan d'origine, et il tient toujours sur
  le papier. Il exige le « JWT secret » du projet, que les interfaces récentes de Supabase ne
  montrent plus. Attendre cette clé revenait à ne jamais fermer la base.

### L'approche retenue

Le navigateur ne parle plus à Supabase du tout. Il parle à nos propres fonctions serveur, qui
détiennent seules la clé de service. La clé publique devient sans emploi — et une clé sans emploi
peut être privée de tous ses droits sans que rien ne s'arrête.

```
        AVANT                                    APRÈS
  navigateur ──clé publique──> base       navigateur ──jeton──> api/… ──clé de service──> base
```

Trois portes, traitées une par une :

| Porte | Fonction | Ce qui en sort |
|---|---|---|
| Suivi d'un colis, mentions légales | `api/public.js` | un seul colis, sans téléphone ni adresse |
| Vitrine | `api/public.js` | l'identité de l'entreprise et les départs à venir |
| Application et espace client | `api/donnees.js` | les données, contre un jeton de session valable |
| Connexion | `api/login.js` | le compte, sans son sel ni son empreinte, et un jeton |
| Création d'un compte client | `api/inscription.js` | le compte créé, et un jeton — sans jeton d'entrée |
| Mot de passe oublié | `api/motdepasse.js` | un accusé de réception, jamais le code |

Le jeton de session est signé et vérifié par nos fonctions (`api/_session.js`), pas par Supabase :
c'est ce qui affranchit toute la manœuvre du secret introuvable. Son secret de signature est
`SESSION_SECRET` si elle existe, sinon une valeur **dérivée** de la clé de service — jamais la clé
elle-même, pour qu'un jeton volé ne redonne pas l'accès à la base. Une variable de plus à créer
serait une variable de plus à oublier, et un déploiement à moitié configuré où plus personne ne se
connecte.

### Où en est le travail

| Lot | Objet | État |
|---|---|---|
| 1 | La page de suivi ne livre plus la base à ses visiteurs | fait, en ligne |
| 2 | Un visiteur non connecté ne charge plus rien | fait, en ligne |
| 3 | L'application et l'espace client passent par le serveur | fait — reste à configurer |
| 4 | Inscription et mot de passe oublié côté client | fait — reste à configurer |
| 5 | Resserrage des politiques de la base | **à faire — c'est la dernière étape** |

Plus rien ne passe par la clé publique. La base peut être fermée dès que la clé de service est
posée sur Vercel et qu'une connexion réelle a été vérifiée sur le site.

### Ce qui reste ouvert après la fermeture

**L'espace client reçoit encore le document entier** une fois connecté, alors qu'il n'affiche que
ses propres colis — donc les colis, les clients et les comptes de toute l'entreprise arrivent dans
le navigateur de n'importe quel client. Ce n'est pas une régression : c'était déjà le cas avant
tout ce travail, et la fermeture de la base n'y change rien puisqu'un client est, lui, identifié.

C'est le prochain chantier, et il est plus profond que les précédents : le portail lit ET réécrit
le document entier à chaque geste (déclarer un paiement, envoyer un message, faire une pré-alerte).
Ne lui en donner qu'une partie sans toucher à ses écritures lui ferait effacer tout le reste. Il
faut donc scinder les deux : une lecture réduite à ce qui le concerne, et des écritures ciblées
côté serveur, geste par geste.

**La clé `bde-reinit`** contient les demandes de réinitialisation en cours, sous forme d'empreintes.
`api/donnees.js` la refuse explicitement — c'est ce qui empêche un client de lire les codes des
autres. Toute nouvelle clé de ce genre doit rester hors de la liste autorisée (`bde-data` et
`bde-backup-*`).

### Ce qu'il faut configurer sur Vercel

Une seule variable est indispensable, dans Vercel → Settings → Environment Variables, prise dans
Supabase → Settings → API → **Secret key**. **Elle ne doit pas commencer par `VITE_`** : ce préfixe
l'enverrait au navigateur et annulerait tout l'intérêt.

- `SUPABASE_SERVICE_ROLE_KEY` — la clé de service

Facultatives :

- `SUPABASE_URL` — à défaut, `VITE_SUPABASE_URL` est réutilisée
- `SESSION_SECRET` — à défaut, dérivée de la clé de service
- `SUPABASE_JWT_SECRET` — n'a plus d'utilité dans cette approche

Tant que la clé de service est absente, `api/donnees.js` répond 501 et l'application repasse par
l'accès direct : elle peut être mise en ligne sans rien casser.

### Vérifier que la voie serveur est bien en place

```
https://badiabyexpress.com/api/donnees?etat=1
```

`{"configure":true}` : la voie serveur est utilisable. `{"configure":false}` : la clé de service
manque, et fermer la base couperait tout le monde.

### L'ordre de déploiement, qui n'est pas négociable

1. Mettre le code en ligne **en gardant les politiques actuelles**. Rien ne change pour personne.
2. Vérifier `?etat=1`, puis se connecter réellement avec un vrai compte, sur le site en ligne.
3. Essayer aussi les deux gestes qui n'exigent pas de compte : créer un compte client de test
   depuis `?client=1`, et demander un mot de passe oublié. Ce sont eux qui casseraient en premier
   si quelque chose manquait.
4. **Seulement ensuite**, resserrer les politiques.
5. En cas de problème : rétablir les politiques (SQL ci-dessous) — le site refonctionne en
   quelques secondes, sans redéploiement.

Faire l'inverse — resserrer d'abord — bloque toute l'équipe dès la première tentative de connexion.

### Le resserrage, le jour venu

La table a le RLS activé et quatre politiques ouvertes à `public`. Les supprimer suffit : sans
politique, la clé publique n'obtient plus rien, tandis que la clé de service ignore le RLS et
continue de tout faire — c'est-à-dire nos fonctions serveur, et elles seules.

```sql
drop policy if exists "Lecture par la clé applicative" on public.bde_data;
drop policy if exists "Création par la clé applicative" on public.bde_data;
drop policy if exists "Mise à jour par la clé applicative" on public.bde_data;
drop policy if exists "Suppression limitée aux sauvegardes" on public.bde_data;
```

Pour revenir en arrière :

```sql
create policy "Lecture par la clé applicative" on public.bde_data for select using (true);
create policy "Création par la clé applicative" on public.bde_data for insert with check (true);
create policy "Mise à jour par la clé applicative" on public.bde_data for update using (true) with check (true);
create policy "Suppression limitée aux sauvegardes" on public.bde_data for delete using (key like 'bde-backup-%');
```

---

## Ce qui a été éprouvé, et comment

- **Les empreintes calculées par le serveur sont identiques à celles du navigateur** — comparées
  sur cinq cas, dont un mot de passe accentué, un vide, un très long et un nombre d'itérations
  différent. C'est le point critique : le moindre écart empêcherait tout le monde de se connecter.
- **`api/public.js`**, sur 36 cas : ce qui sort pour un suivi, une vitrine, les mentions légales ;
  une recherche vide qui ne renvoie pas « tous les colis » ; l'absence de téléphone, d'adresse et
  de notes internes dans la réponse ; la marque du partenaire sans ses tarifs.
- **`api/donnees.js` et le jeton de session**, sur 53 cas : signature et vérification, jeton
  retouché, expiré, signé avec un autre secret ; aucune donnée sans jeton — et la base pas même
  interrogée ; la clé de service jamais renvoyée au navigateur ; la tête qui ne descend que la
  date ; une clé absente distinguée d'une base injoignable ; une écriture vide refusée ; la liste
  qui ne donne que des noms de clés ; et, du côté de `api/login.js`, qu'un compte client n'ouvre
  pas une session d'agent ni l'inverse.
- **L'application, dans un navigateur, la base fermée** (`t55`, 20 cas) : connexion, jeton porté
  jusqu'au serveur, aucun appel direct à la base, aucun canal temps réel, le changement d'un
  collègue qui arrive quand même, la déconnexion qui emporte le jeton — et le mot de passe de
  l'agent qui survit à sa propre reconnexion.
- **L'espace client** (`t56`, 13 cas) : page de connexion sans la base, refus par le serveur,
  connexion réussie, et le mot de passe du client intact après coup.
- **L'inscription et le mot de passe oublié** (`testcompte`, 53 cas ; `t57`, 22 cas, la base
  fermée) : identifiant déjà pris refusé quelle que soit la casse, champs obligatoires, mot de
  passe trop court, création en rafale ralentie, empreinte identique à celle du navigateur, et
  surtout — le code de réinitialisation absent de la réponse, absent du HTML de la page, absent du
  document servi aux personnes connectées, inutilisable une seconde fois, et jamais affiché quand
  WhatsApp est indisponible.
- **Le déploiement à moitié configuré** (`t58`, 10 cas) : toutes les fonctions serveur répondent
  501, et le portail, l'inscription et la connexion continuent de fonctionner par l'ancien chemin.
  C'est l'état exact du site tant que la clé de service n'est pas posée.

Ce qui **n'a pas pu être vérifié depuis ce conteneur** : le site en ligne, dont le réseau sortant
est filtré. D'où l'étape 2 ci-dessus, à faire depuis un navigateur ordinaire.

---

## Trois défauts trouvés en chemin

Ils sont corrigés, mais méritent d'être notés — les deux premiers étaient en ligne.

- **Le code de réinitialisation était fabriqué et vérifié dans le navigateur.** La page le tirait
  au sort, le gardait dans son état, l'envoyait sur WhatsApp, puis le comparait à ce que la
  personne saisissait — le tout du même côté. N'importe qui pouvait le lire dans les outils de
  développement et changer le mot de passe de n'importe quel compte client dont il connaissait
  l'identifiant. L'envoi WhatsApp donnait l'apparence d'une protection sans en être une. Le code
  est désormais tiré au sort par le serveur, ne redescend jamais, et c'est le serveur qui le
  compare.

- **`api/login.js` ne pouvait pas s'exécuter.** Deux variables `motdepasse` étaient déclarées dans
  la même portée : le fichier ne se chargeait pas, la fonction répondait 500, et l'application
  traitait ce 500 comme un refus de connexion. Personne ne pouvait se connecter. Corrigé, et
  l'application ne laisse plus un serveur en panne prononcer un refus : seuls 401 et 429 viennent
  de la vérification elle-même, tout le reste ramène au chemin d'origine.
- **La connexion pouvait effacer le mot de passe de celui qui se connectait.** Le serveur renvoie
  le compte débarrassé de son sel et de son empreinte — c'est voulu. L'application le réécrivait
  tel quel dans la base, ce qui effaçait ces champs et interdisait toute connexion ultérieure. Le
  compte se superpose désormais à la fiche existante au lieu de la remplacer.

---

## À garder en tête

- **Le mode hors ligne** conserve une copie locale des données : elle reste lisible sur l'appareil.
  C'est voulu — c'est ce qui permet de travailler sans réseau — mais cela signifie qu'un téléphone
  perdu expose les données qu'il a en cache. La vraie réponse est le verrouillage de l'appareil.
- **Le temps réel s'arrête à la fermeture de la base** : le canal Supabase parle à la clé publique.
  Il est remplacé par une interrogation du serveur toutes les vingt secondes, qui ne redescend le
  document que s'il a changé. Un agent voit donc arriver le colis de son collègue sans recharger,
  avec au plus vingt secondes de retard.
- **La reprise de session** : le jeton expire au bout de douze heures. Une reconnexion sera
  demandée à l'expiration, ce qui n'était pas le cas avant.
- **Les documents des colis** (photos, justificatifs) passent par le stockage de fichiers Supabase,
  pas par la table `bde_data`. Le resserrage décrit ici ne les concerne pas — c'est un sujet à part.
- **La taille du document, à surveiller.** Toutes les données tiennent dans une seule ligne, qui
  fait 830 ko au 23/08/2026 — contre 187 ko trois jours plus tôt. Elle passe désormais par une
  fonction serverless à chaque lecture et à chaque enregistrement, et Vercel plafonne ces échanges
  aux alentours de 4,5 Mo. Au rythme actuel, ce plafond sera atteint. Ce n'est pas une régression
  (l'enregistrement renvoyait déjà le document entier), mais c'est une échéance : il faudra soit
  sortir les pièces jointes du document, soit n'échanger que ce qui a changé.
