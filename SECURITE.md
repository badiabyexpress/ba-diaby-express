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
| Identifiant oublié | `api/motdepasse.js` | un accusé de réception, jamais l'identifiant |

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
| 3 | L'application et l'espace client passent par le serveur | fait, en ligne |
| 4 | Inscription et mot de passe oublié côté client | fait, en ligne |
| 5 | Resserrage des politiques de la base | fait — RLS active, aucune politique |
| 6 | L'espace client cloisonné | fait |
| 7 | L'espace partenaire cloisonné | fait |
| 8 | Les fonctions qui dépensent, fermées aux inconnus | fait |
| 9 | Les rôles de l'équipe tenus par le serveur | fait |

Plus rien ne passe par la clé publique, et la base est effectivement fermée : `bde_data` a RLS
active et **aucune politique**, ce qui ne laisse passer que la clé de service — c'est-à-dire nos
seules fonctions serveur.

### Le cloisonnement de l'espace client (lot 6)

**Le problème.** N'importe qui peut créer un compte client depuis la page d'accueil — c'est fait
pour. Une fois connecté, ce compte présentait un jeton parfaitement valable, et `api/donnees.js`
lui rendait le document ENTIER : les colis de tous les autres clients avec leurs noms, leurs
téléphones et ce qu'ils ont payé, le répertoire, le journal d'activité, la caisse, les tarifs du
partenaire, et la liste des employés avec l'empreinte de leur mot de passe. La fermeture de la
base n'y changeait rien, puisqu'un client est, lui, identifié.

**La difficulté.** Le portail lit ET réécrit le document entier à chaque geste — déclarer un
paiement, envoyer un message, faire une pré-alerte. Ne lui en donner qu'une partie sans toucher à
ses écritures lui aurait fait effacer tout le reste au premier enregistrement. C'eût été pire que
le mal.

**La réponse**, dans `api/_cloisonnement.js`, en deux moitiés indissociables :

- *En lecture*, une **liste blanche** de sections (`SECTIONS_PARTAGEES`), plus les listes
  personnelles réduites à ce qui porte l'identifiant du compte : ses colis, ses pré-alertes, ses
  demandes de regroupement, sa fiche — sans empreinte de mot de passe. Ce qui n'est pas sur la
  liste ne sort pas ; une section ajoutée demain est donc privée par défaut.
- *En écriture*, on repart **toujours du document réel** et l'on n'y repose que les fragments
  autorisés : les trois champs qu'un client peut changer sur son colis (demande express,
  déclaration de paiement, signalement), ses listes personnelles avec son identifiant réimposé, et
  les champs autorisés de sa propre fiche. Le portail continue d'envoyer le document entier tel
  qu'il le connaît ; ce qu'il n'a pas le droit de changer est ignoré.

Trois portes de côté se ferment aussi, avant même de toucher à la base : un client ne peut pas
lire une **sauvegarde** (`bde-backup-*`, une copie complète — c'était le contournement évident),
ni **lister** les clés, ni **supprimer** quoi que ce soit.

### Le cloisonnement de l'espace partenaire (lot 7)

Un partenaire se connecte par `users`, avec un rôle qui n'est pas « client » : il recevait donc,
lui aussi, le document entier. C'est une entreprise tierce, et elle voyait tout le carnet de
Ba-Diaby — les colis de tous les clients, le répertoire, la caisse, le journal d'activité, et les
tarifs de ses propres confrères.

La différence avec le compte client est réelle et vaut d'être notée : un compte partenaire ne se
crée pas tout seul, c'est l'administrateur qui l'ouvre. Le risque n'est donc pas « n'importe qui »
mais « le confrère à qui l'on a ouvert une porte ». Cela restait contraire à la règle que
l'entreprise s'est donnée — ce qu'un partenaire facture à ses propres clients ne regarde pas
Ba-Diaby, et l'inverse est tout aussi vrai.

Même mécanisme, même fichier. Il voit ses colis, ses factures, ses annonces de dépôt, sa fiche et
celles de ses employés — sans empreintes — et les sections partagées. Le journal lui descend
**vide** plutôt qu'absent : son espace y ajoute une ligne à chaque geste, et une section absente
lui ferait fabriquer un journal neuf.

En écriture, il enregistre ses colis et gère ses accès, mais :

- le **rattachement** d'un colis est réimposé au sien — pas moyen d'en déposer un au compte d'un
  confrère — et la **validation** est remise « En attente » : c'est l'entreprise qui pèse et qui
  arrête le prix, un prix qu'il aurait glissé lui-même n'engage donc rien ;
- sur un colis déjà enregistré il ne change qu'une chose, sa propre marque de paiement — la seule
  du circuit partenaire, puisque l'entreprise n'encaisse rien sur ces colis ;
- de son contrat, il ne touche que les six champs d'identité (nom commercial, logo, adresse,
  téléphone, e-mail, site) : ni le tarif, ni les destinations, ni le préfixe de suivi ;
- un accès employé qu'il crée reste un accès partenaire rattaché à lui, le **plafond de cinq** est
  tenu ici et non à l'écran, et un identifiant déjà pris ailleurs dans l'application fait tomber la
  création — deux comptes homonymes rendraient imprévisible celui qu'ouvre la page de connexion ;
- ses gestes restent **tracés au journal**, mais l'auteur est réécrit depuis le compte de la
  session : un journal ne sert à rien si l'on peut y signer du nom d'un autre.

Un employé de partenaire relève du contrat de son patron : il voit le même espace, mais ne gère pas
les accès et ne s'ouvre pas lui-même l'accès aux montants.

Deux garde-fous méritent d'être notés, parce qu'ils protègent contre l'accident plutôt que contre
la malveillance : une suppression d'accès se lisant à une absence, un envoi où la liste des comptes
manque n'est pas traité comme la suppression de tous les employés ; et une écriture sur une base
vide est refusée plutôt que devinée.

### Les fonctions qui dépensent (lot 8)

**Le problème.** Une seule fonction vérifiait une session : `api/donnees.js`. Les quatre autres qui
coûtent quelque chose à chaque appel étaient joignables par n'importe qui connaissant leur adresse.

| Fonction | Ce qu'un inconnu pouvait faire |
|---|---|
| `api/whatsapp.js` | faire partir des messages depuis le numéro de l'entreprise, vers n'importe quel numéro, avec ses modèles approuvés |
| `api/email.js` | envoyer des courriels depuis `contact@badiabyexpress.com` |
| `api/claude.js` | consommer la clé Anthropic |
| `api/taux.js` | épuiser le quota mensuel des taux de change |

La première était la plus grave, et pas seulement pour la facture : un numéro qui envoie en masse
se fait restreindre par Meta. Celui de l'entreprise a demandé des jours d'approbation.

**La réponse**, `refusSaufEquipe` dans `api/_session.js`, posée en tête des quatre fonctions. Ni un
client ni un partenaire n'y ont affaire — leurs écrans ne les appellent jamais, et le compte client
est le plus exposé puisque n'importe qui peut en créer un. Le navigateur joint désormais le jeton
de session à ces appels comme il le fait déjà pour les données.

**Le laissez-passer interne.** `api/motdepasse.js` envoie le code de réinitialisation en repassant
par `api/whatsapp.js`. Cet appel n'a aucune session à présenter, et pour cause : la personne n'est
pas connectée, c'est justement son mot de passe qu'elle a perdu. Un jeton dérivé du même secret —
jamais égal à lui — voyage donc entre les deux fonctions du même déploiement. Sans lui, fermer
WhatsApp aux inconnus aurait fermé du même coup la réinitialisation.

**Tant que le serveur n'est pas configuré, rien ne change** : sans secret, aucun jeton ne serait
vérifiable et exiger une session reviendrait à fermer la porte à l'équipe elle-même.

### Les rôles de l'équipe (lot 9)

**Le problème.** `api/donnees.js` distinguait le client et le partenaire du reste. Le reste, il le
croyait sur parole : un agent, un comptable et un administrateur avaient exactement les mêmes
droits d'écriture. Les permissions par rôle existaient, mais elles vivaient dans le navigateur —
elles décidaient quels boutons s'affichent. Un bouton qu'on n'affiche pas n'est pas un bouton qu'on
ne peut pas actionner.

Le risque n'est pas du même ordre que les précédents : ce n'est ni un inconnu, ni un tiers, mais
quelqu'un que l'entreprise a embauché et à qui elle a donné un accès. C'est pour cette raison que ce
lot vient après les autres, et non parce qu'il serait moins réel.

**Une seule table, deux lecteurs.** Les permissions ont déménagé dans `api/_permissions.js`, que
`src/App.jsx` importe pour construire ses écrans et `api/_cloisonnement.js` pour trancher une
écriture. En recopier une moitié aurait marché le premier jour et divergé le second — et une
divergence, ici, ne se voit pas : elle s'appelle une permission qu'on croyait retirée.

**Le sens de la fusion est inverse** des lots 6 et 7. Un membre de l'équipe reçoit et réécrit le
document entier, c'est son travail : on part donc de ce qu'il envoie, et l'on REMET EN PLACE ce
qu'il n'avait pas le droit de changer.

Trois choses, celles dont on ne revient pas :

- **Les droits.** `role`, `permissionsOverride`, `paysAutorises`, `agence` : nul ne se les réécrit
  à soi-même, pas même un administrateur — il les a déjà tous, la règle ne lui coûte rien et vaut
  surtout pour celui qui n'en a pas. Les modifier chez un autre demande `users.permissions` ;
  créer, corriger ou supprimer un compte demande `users.gerer`. Gérer les comptes sans gérer les
  droits reste possible : le compte créé naît alors avec le rôle le plus modeste, sans quoi « je
  crée un administrateur et je m'y connecte » serait le chemin le plus court pour contourner tout
  le reste. Chacun garde le droit de changer son propre mot de passe et ses coordonnées.
- **Les réglages** — marque, siège, agences, calendrier des départs, notifications, taux,
  commissions, moyens de paiement, catégories : chaque section est gardée par la permission qui
  ouvre l'écran correspondant, pour qu'un geste possible à l'écran ne soit jamais refusé par le
  serveur, ni l'inverse.
- **Le journal**, qui ne se réécrit pas : il s'ajoute. C'est lui qui garde trace de qui a encaissé,
  annulé, supprimé. Le laisser réécrire à celui-là même dont il consigne les gestes reviendrait à
  ne rien consigner du tout. L'auteur y est réinscrit depuis le compte de la session.

**Ce que ce lot ne couvre pas.** Les colis, les factures, les bordereaux et la caisse restent
écrivables par n'importe quel compte de l'équipe, comme avant. C'est un choix : ce sont les gestes
du métier, faits toute la journée par des rôles différents, et les encadrer demanderait de décrire
au serveur ce qu'est un encaissement légitime. Le journal, lui, en garde désormais trace de façon
ineffaçable — ce qui est la vraie réponse à un geste qu'on ne peut pas empêcher.

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
- **`api/donnees.js` et le jeton de session**, sur 111 cas : signature et vérification, jeton
  retouché, expiré, signé avec un autre secret ; aucune donnée sans jeton — et la base pas même
  interrogée ; la clé de service jamais renvoyée au navigateur ; la tête qui ne descend que la
  date ; une clé absente distinguée d'une base injoignable ; une écriture vide refusée ; la liste
  qui ne donne que des noms de clés ; et, du côté de `api/login.js`, qu'un compte client n'ouvre
  pas une session d'agent ni l'inverse.
- **Le cloisonnement**, dans ces mêmes cas — pour le client : le colis du voisin qui ne descend
  pas, ni son nom, ni son téléphone, ni son empreinte ; aucune section réservée (employés,
  répertoire, journal, caisse, factures du partenaire) ; les sauvegardes, la liste et la
  suppression refusées. Puis, en écriture, un client qui envoie sa vue réduite sans rien effacer —
  et un client MALVEILLANT, qui fabrique son envoi à la main : il ne se fait pas administrateur,
  ne vide ni le répertoire ni la caisse, ne change pas le mot de passe du voisin, ne s'approprie
  pas son colis, ne remet pas le prix du sien à zéro, et ne dépose pas de pré-alerte au nom d'un
  autre. C'est le vrai test : l'écran ne protège rien, seul le serveur protège.
- **L'application, dans un navigateur, la base fermée** (`t55`, 20 cas) : connexion, jeton porté
  jusqu'au serveur, aucun appel direct à la base, aucun canal temps réel, le changement d'un
  collègue qui arrive quand même, la déconnexion qui emporte le jeton — et le mot de passe de
  l'agent qui survit à sa propre reconnexion.
- **L'espace client** (`t56`, 38 cas) : page de connexion sans la base, refus par le serveur,
  connexion réussie, et le mot de passe du client intact après coup. Depuis le lot 6, le portail y
  est nourri par le VRAI tri du serveur — `vueClient` et `fusionnerEcritureClient` sont importés
  du code livré, pas imités : on ouvre chacun de ses écrans pour vérifier qu'aucun ne tombe faute
  d'une section, puis on fouille tout ce qui est réellement descendu dans le navigateur.
- **L'espace partenaire** (`t68`, 31 cas), même méthode et même exigence : ses cinq onglets
  s'ouvrent, et rien de la maison ne descend — ni le colis d'un confrère, ni son tarif, ni le
  répertoire, ni la caisse, ni une seule empreinte.
- **L'inscription et le mot de passe oublié** (`testcompte`, 53 cas ; `t57`, 22 cas, la base
  fermée) : identifiant déjà pris refusé quelle que soit la casse, champs obligatoires, mot de
  passe trop court, création en rafale ralentie, empreinte identique à celle du navigateur, et
  surtout — le code de réinitialisation absent de la réponse, absent du HTML de la page, absent du
  document servi aux personnes connectées, inutilisable une seconde fois, et jamais affiché quand
  WhatsApp est indisponible.
- **Les fonctions qui dépensent** (`testgardes`, 41 cas) : les quatre portes éprouvées de la même
  façon — l'inconnu refusé sans qu'AUCUN APPEL SORTANT ne parte, le jeton inventé refusé, le client
  et le partenaire refusés, l'équipe qui passe, le laissez-passer interne qui ouvre WhatsApp mais
  pas s'il est inventé, tronqué ou signé d'un autre secret. Et, dans un navigateur (`t55`), que
  l'application joint bien ce jeton à ses appels : sans cela, la fermeture ne protégerait rien et
  casserait tout.
- **Les rôles de l'équipe**, dans les mêmes cas de `testdonnees` : un agent qui envoie ce qu'il
  veut ne se fait pas administrateur, ne se donne pas de permissions, ne rétrograde pas
  l'administrateur ni ne touche à son empreinte, ne supprime personne, ne crée pas de complice, ne
  renomme pas l'entreprise, ne touche ni au taux de change, ni aux catégories, ni aux commissions,
  et n'efface pas le journal — mais change bien son propre mot de passe, et son travail passe.
  L'administrateur, lui, fait tout cela, sauf réécrire son propre rôle.
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

## Une porte publique de plus : la réception WhatsApp (26/08/2026)

`api/whatsapp-entrant.js` est la seule fonction du serveur qui doit être appelable **sans
session**, et c'est intentionnel : c'est Meta qui l'appelle, depuis ses propres serveurs, pour
livrer les messages que les clients écrivent au numéro de l'entreprise. Depuis que ce numéro est
inscrit sur l'API Cloud, il a quitté l'application WhatsApp Business : aucun téléphone ne le
reçoit plus, et si personne n'écoute à cette adresse, le message du client est perdu.

Une adresse publique qui écrit dans la base est exactement ce que le reste de ce document
s'emploie à supprimer. Trois précautions la rendent acceptable.

- **Deux preuves d'origine, l'une ou l'autre.** L'adresse déclarée chez Meta porte un jeton en
  fin d'adresse (`?jeton=…`), que lui seul connaît et qu'il renvoie à chaque appel. Et si
  `WHATSAPP_APP_SECRET` est renseigné, la signature `x-hub-signature-256` est vérifiée sur le
  corps. Un appel qui ne porte ni l'un ni l'autre est refusé en 401 : sans cela, n'importe qui
  pourrait faire apparaître dans le Centre clients une conversation qui n'a jamais eu lieu.
- **Elle n'écrit qu'une chose.** Un message entrant est ajouté à `messagesWhatsApp`, avec son
  identifiant Meta comme clé — un même message renvoyé deux fois n'apparaît pas en double. Elle
  ne touche à rien d'autre du document, ne lit aucune autre section, et n'appelle aucun service.
- **Elle acquitte toujours.** Meta désactive un webhook qui échoue trop souvent ; on perdrait
  alors tous les messages suivants, pas seulement celui-ci. Une base momentanément indisponible
  est donc tracée dans les journaux du serveur, mais l'accusé de réception part quand même.

Côté fusion, `messagesWhatsApp` rejoint le journal d'activité parmi les listes qu'une écriture
d'agent ne peut pas réécrire : un message arrivé pendant qu'une page était ouverte serait sinon
effacé par le prochain enregistrement de cet agent — le client aurait écrit, et son message aurait
disparu avant d'être lu.

Le webhook reçoit aussi les ACCUSÉS de ce que nous avons envoyé — parti, remis, lu, échoué. Ils
sont rangés à part, sous `statutsWhatsApp`, indexés par l'identifiant que Meta donne au message :
ils arrivent souvent avant que l'application ait fini d'enregistrer le message correspondant, et
les ranger dans la liste des messages supposerait de retrouver une ligne qui n'existe pas encore.
Comme `messagesWhatsApp`, cette table est protégée à la fusion : une écriture d'agent ne peut pas
l'effacer.

Variables à poser dans Vercel : `WHATSAPP_VERIFY_TOKEN` (obligatoire, choisie par vous et
recopiée chez Meta), `WHATSAPP_APP_SECRET` (facultative, secret de l'application Meta) et
`WHATSAPP_APP_ID` (nécessaire seulement pour changer la photo de profil depuis l'application :
Meta exige un dépôt de fichier préalable, qui passe par l'identifiant de l'application).

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

## Savoir si Meta appelle vraiment (26/08/2026)

`api/whatsapp-entrant.js` rangeait les messages et les accusés, et ne gardait aucune trace des
appels qui n'en portaient pas. Le Centre clients affichait alors « Aucun message reçu » — une
phrase qui recouvre deux situations opposées :

- personne n'a encore écrit, et tout va bien ;
- Meta n'appelle pas cette adresse, et **les messages des clients se perdent depuis des jours**.

Les deux se ressemblaient trait pour trait, et l'écran renvoyait dans les deux cas à la même liste
de vérifications sans dire laquelle s'appliquait. On ne pouvait trancher qu'en allant lire les
journaux de l'hébergeur.

Chaque appel authentifié laisse désormais un relevé — `receptionWhatsApp` : date du dernier appel,
nombre d'appels, nature du dernier contenu (`message`, `accuse`, `vide`) et **numéro servi**. Ce
dernier compte : si les appels arrivent mais portent une autre ligne, c'est un autre compte qu'on
écoute, et aucun message de nos clients n'arrivera jamais.

Les appels vides sont gardés exprès : le bouton **Tester** du tableau de bord Meta en envoie un, et
il suffit à prouver que la plomberie tient sans attendre qu'un client écrive. Un appel non
authentifié, lui, ne compte pas — sinon n'importe qui pourrait faire croire que la réception
fonctionne.

Le relevé appartient au serveur seul : `fusionnerEcritureEquipe` le reprend toujours du document
réel. Une page ouverte avant le premier appel le renverrait absent, et l'écran se remettrait à dire
qu'il n'a jamais rien reçu — en effaçant précisément la preuve du contraire ; et une page ne peut
pas non plus en inventer un.

Éprouvé par `testentrant` (53 cas) et `t82` (18 cas, les deux états de l'écran).

## Les deux causes d'un webhook muet (26/08/2026)

Le numéro envoie, les modèles sont approuvés, l'adresse est vérifiée, le champ `messages` affiche
« Abonné » — et rien n'arrive. Deux causes possibles, opposées, et jusqu'ici indistinguables.

**L'application n'est pas abonnée au compte professionnel.** Déclarer l'adresse du webhook et
cocher `messages` se fait au niveau de l'APPLICATION. Encore faut-il que cette application soit
abonnée au COMPTE (la WABA) qui porte le numéro : c'est une seconde opération, invisible dans
l'écran des webhooks, et rien n'avertit quand elle manque. `?abonnement=1` sur `api/whatsapp.js`
pose la question à Meta (`GET /{WABA}/subscribed_apps`) et la même adresse en POST l'abonne. On lit
la réponse de Meta plutôt que de la deviner, et le bouton fait un vrai appel — pas un succès de
façade. Sans `WHATSAPP_WABA_ID`, la fonction le dit et n'invente rien.

**Meta appelle, et c'est nous qui refusons.** L'adresse déclarée doit porter son `?jeton=` — la
preuve que l'appel vient bien de lui. Recopiée sans ce bout, la vérification passe quand même (elle
emprunte `hub.verify_token`, un autre chemin), et pourtant chaque notification repart en 401. Tout
paraît en ordre, rien n'arrive, et le relevé des appels restait vide exactement comme si Meta
n'appelait pas.

`api/whatsapp-entrant.js` note donc aussi les appels REFUSÉS — `receptionWhatsApp.refuses` et
`dernierRefus`. Un refus plus récent que le dernier appel accepté désigne ce cas, et l'écran donne
alors l'adresse exacte à recoller. Deux précautions, parce que cette porte est publique et
qu'écrire coûte : on ne note que ce qui a la **forme** d'une notification Meta (`object` et `entry`),
et au plus une note toutes les cinq minutes par instance — sans ce frein, n'importe qui provoquerait
une écriture en base à volonté.

Éprouvé par `testabonnement.mjs` (28 cas), `testentrant` (55, dont un qui décrivait l'ancien
silence), `t82` (26 cas, les trois états de l'écran) et `t83` (15 cas, la carte d'abonnement).

## Récupérer un compte perdu (26/08/2026)

Trois défauts se tenaient l'un derrière l'autre dans ce qui est, pour un client, la seule sortie
de secours.

**Le code de réinitialisation ne pouvait plus arriver.** `api/motdepasse.js` appelait
`api/whatsapp.js` sans demander de modèle. Or cette fonction retombe alors sur celui configuré par
défaut sur le serveur — `WHATSAPP_TEMPLATE`, le modèle de **suivi de colis**. Le client recevait
donc un message de suivi à la place de son code, ou rien du tout, Meta refusant un modèle dont les
variables manquent. Le défaut est né du passage de Twilio à Meta : sur Twilio, tout envoi était du
texte libre, la question du modèle ne se posait pas. Personne ne pouvait l'apprendre — l'écran
disait « contactez notre agence », ce qui ressemble à une panne passagère.

Il fallait pouvoir dire « aucun modèle » : c'est le drapeau `texteLibre`, que `api/whatsapp.js`
honore avant tout repli. Une variable facultative, `WHATSAPP_TEMPLATE_CODE`, permet de nommer un
modèle de catégorie `AUTHENTICATION` — sans lui, le code part en texte libre, donc seulement dans
les vingt-quatre heures suivant le dernier message du client.

**Une seule voie, et un client sans WhatsApp restait dehors.** Le code part désormais sur les deux
voies inscrites au compte — WhatsApp *et* e-mail, le même code des deux côtés. Une seule qui
aboutit suffit ; si aucune n'aboutit, aucune demande n'est ouverte, puisqu'il n'y a pas de code à
valider. L'e-mail emprunte `api/email.js` avec le laissez-passer interne, comme WhatsApp : ces
fonctions restent fermées aux inconnus.

**L'identifiant, lui, ne se récupérait pas du tout.** Il se choisit librement à l'inscription,
donc il s'oublie — et sans lui, la réinitialisation elle-même était hors d'atteinte. L'étape
`identifiant` le renvoie sur le numéro ou l'adresse déjà inscrits au compte, jamais à l'écran. Le
connaître ne donne d'ailleurs aucun accès : il faut ensuite le code, qui part au même endroit. La
recherche par numéro compare les huit derniers chiffres, pour qu'un client n'ait pas à retrouver
son indicatif.

**Ce qui a changé dans les réponses.** L'échec d'envoi répondait 502 avec un renvoi vers l'agence.
C'était juste pour le client, et un aveu pour l'inconnu : ce refus ne pouvait tomber que sur un
compte réel, si bien qu'il suffisait de comparer un 502 à un 200 pour savoir qui est client de
l'entreprise. Toutes les réponses de l'étape `demande` sont désormais identiques. Ce que le client
y perd lui est rendu sur l'écran suivant, qui dit d'avance quoi faire si rien n'arrive.

**Un ralentisseur, enfin.** Cette porte est ouverte à qui connaît son adresse — c'est sa nature,
celui qui a perdu son mot de passe n'a pas de session à présenter. Mais chacun de ses appels fait
dépenser l'entreprise : un message facturé par Meta, un courriel qui engage la réputation du
domaine. Dix demandes par heure et par adresse, comme à l'inscription.

**La même sortie pour l'équipe.** Elle n'existait que pour les clients. Un agent qui perdait son
mot de passe attendait qu'un administrateur lui en fabrique un, le lui dicte au téléphone — et le
connaisse donc, ce qui est précisément ce qu'un mot de passe ne doit pas être. Un partenaire, lui,
n'a personne au-dessus : son compte est le seul de son entreprise, et sa perte l'arrêtait net.
L'étape porte désormais un `espace` (`client` ou `equipe`) qui décide de la liste consultée et de
celle où l'empreinte est réécrite. Il est respecté strictement, comme à la connexion : un compte
client ne doit jamais ouvrir une session d'employé parce qu'il porte le même identifiant qu'un
agent, ni l'inverse — et le contact d'un agent ne doit pas fuir par la porte des clients.

## Trois façons d'entrer (26/08/2026)

La connexion n'acceptait que l'identifiant. Il se choisit une fois, à la création du compte, et
s'oublie — tandis que le numéro et l'adresse e-mail, déjà inscrits sur la fiche et obligatoires à
la création, ne s'oublient jamais. `comptesCorrespondants` (`api/login.js`) accepte les trois, pour
l'équipe comme pour les clients.

Trois précautions le tiennent :

- **L'identifiant exact passe avant un contact**, pour qu'un compte ne soit jamais éclipsé par
  l'homonymie d'un numéro.
- **Plusieurs comptes peuvent répondre à un même numéro** — deux inscriptions au comptoir, un
  gérant et son agent qui partagent la ligne du dépôt. Désigner l'un au hasard serait imprévisible ;
  refuser en disant pourquoi révélerait l'existence des deux. C'est donc le mot de passe qui
  tranche : chaque candidat est éprouvé, celui dont l'empreinte correspond se connecte. Au plus
  cinq, pour que la porte ne devienne pas un moyen de faire travailler le serveur.
- **Le temps de réponse ne dit rien.** Quand aucun compte ne correspond, une empreinte est calculée
  quand même : sans cela, la rapidité du refus trahirait qu'aucun compte ne porte ce numéro.

L'espace reste cloisonné et le refus reste le même pour un compte inconnu et pour un mot de passe
faux. Le repli hors ligne du navigateur (`comptesParTroisCles`) applique les mêmes règles : sans
cela, la connexion réussirait en ligne et échouerait à la première coupure — c'est-à-dire au moment
où cet écran doit encore marcher.

Éprouvé par `testrecuperation.mjs` (52 cas, les vraies fonctions serveur avec le réseau
intercepté), `testtroiscles.mjs` (36 cas, connexion et récupération de l'équipe), `t80` (18 cas,
les écrans du client), `t81` (17 cas, l'écran de l'équipe et son repli hors ligne) et `testcompte`
(55 cas).
