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
| Vérification d'un numéro | `api/numero.js` | un accusé de réception, jamais le code — session exigée |

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

## Le sens de l'envoi, et les deux bouts de la route (26/08/2026)

Sur le dépôt d'un colis partenaire, le sens ne changeait que le tarif. Les deux blocs du
formulaire gardaient leurs indicatifs — l'expéditeur en Guinée, le destinataire à l'étranger —
quel que soit le choix. Sur « Paris → Conakry » ils étaient donc à l'envers : on proposait **+224**
à quelqu'un qui se tient à Paris, et **+33** à celui qui réceptionne à Conakry.

Un numéro saisi sous le mauvais indicatif ne sonne nulle part, et rien ne le disait : ni l'écran,
ni l'étiquette, ni le ticket, ni la facture.

Les deux bouts suivent maintenant le sens — indicatif proposé, et pays écrit dans le titre du bloc,
qui est ce qui empêche de remplir les deux côtés à l'envers. Comme les quatre documents lisent
`expediteurPays` et `destinatairePays` sur le colis, une seule règle à l'enregistrement les corrige
tous.

La facture partenaire nomme désormais la colonne **« CLIENT »** et non « DESTINATAIRE » : depuis
que chaque partie se tient au bon bout, le client du partenaire n'est plus toujours le
destinataire — sur un colis qui part de Paris, c'est lui l'expéditeur. Garder l'ancien titre aurait
nommé « destinataire » quelqu'un qui expédie, ou affiché le correspondant à Conakry à la place du
client que le partenaire cherche sur sa facture. `clientDuColisPartenaire` tranche : le client est
celui qui n'est pas en Guinée, et l'on retombe sur le destinataire quand les deux bouts le sont.

Éprouvé par `t88` (17 cas), qui enregistre un vrai colis dans le sens « Paris → Conakry » et relit
ce qui a été écrit.

## L'expéditeur qui ne comptait pas (26/08/2026)

`buildClientDirectory` créait la fiche d'un expéditeur une fois, avec `count: 0`, et n'y revenait
plus jamais : ni le compteur d'envois, ni le total, ni même la date ne bougeaient. Le destinataire,
lui, était compté normalement.

Or dans ce métier c'est souvent l'expéditeur qui EST le client : celui qui est en France, qui paie,
et qui envoie tous les mois à sa famille. Trois conséquences, toutes silencieuses :

- il apparaissait éternellement à « 0 envoi, 0 GNF » dans la liste des clients ;
- il ne pouvait jamais devenir « client régulier » ni entrer dans les « meilleurs clients » — d'où
  un écran annonçant **0 client régulier** sur une base qui en comptait ;
- et comme ce compteur pilote la remise de fidélité, **il n'y avait jamais droit**.

L'expéditeur est désormais traité comme le destinataire : même compteur, même total, et la fiche la
plus récente l'emporte pour les coordonnées. Une garde s'ajoute — s'il s'expédie à lui-même, le
colis ne compte qu'une fois, sinon son total serait doublé.

Vérifié sur les données réelles avant de conclure : 18 colis, 18 destinataires distincts, 17
expéditeurs distincts — donc au moins un expéditeur qui a envoyé deux fois sans que rien ne le
compte.

Éprouvé par `t87` (13 cas), qui vérifie aussi que le comptage des destinataires n'a pas bougé.

## L'identifiant de connexion d'un agent (26/08/2026)

Il se choisissait une fois, à la création du compte, et ne bougeait plus. Une faute de frappe —
« MCamra » pour « MCamara » — restait la clé d'entrée de la personne pour toujours, et un agent
devenu partenaire gardait un identifiant qui ne disait plus ce qu'il est.

Il est désormais modifiable, mais **par l'administrateur seul**. Ce n'est pas un libellé : c'est la
clé de connexion, et la changer fait cesser de fonctionner ce que la personne tape depuis des mois.
Un compte qui « gère les utilisateurs » corrige des fiches ; il n'a pas à disposer des clés
d'entrée de ses collègues, ni à s'attribuer celle d'un autre. La règle est tenue par le serveur —
`comptesDeLEquipe` dans `api/_cloisonnement.js` — l'écran ne faisant que la refléter : un champ
fermé côté navigateur ne protège rien de celui qui ouvre les outils de développement.

Trois gardes, toutes du même côté :

- **Seul le rôle Administrateur** renomme un compte. Toute autre demande rend l'ancien identifiant.
- **L'unicité.** Deux comptes portant le même identifiant rendent la connexion imprévisible : c'est
  le mot de passe qui départagerait, ce qui n'est pas une façon de choisir un compte. Un changement
  qui heurte un identifiant déjà pris est annulé, et l'ancien reste — mieux vaut un renommage qui
  n'a pas eu lieu qu'une entrée devenue ambiguë. La comparaison se fait en minuscules, comme à la
  connexion : « MCamara » et « mcamara » sont le même identifiant. Deux comptes renommés d'un coup
  vers le même nom ne passent pas tous les deux non plus.
- **Un identifiant vidé n'est pas un renommage** : c'est un compte qu'on ne pourrait plus ouvrir.
  L'ancien est rendu, plutôt que d'enfermer quelqu'un dehors sur une case effacée par mégarde.

L'écran, lui, dit ce que le geste casse — « *« MCamra » cessera de fonctionner* », avec l'invitation
à prévenir la personne et le rappel que son mot de passe ne change pas. Le journal d'activité range
l'acte sous son propre nom, avec les deux identifiants : sans cela, un compte devenu inaccessible
resterait sans explication dans l'historique.

Éprouvé par `testdonnees` (227 cas, dont le gestionnaire qui ne renomme pas un collègue, le doublon,
la casse, le double renommage et l'identifiant vidé) et `t86` (20 cas, les deux écrans).

## Le numéro d'un client ne se tape plus : il se prouve (26/08/2026)

Le téléphone se saisissait comme une adresse — on tapait ce qu'on voulait, et l'application le
croyait. Ce n'est pourtant pas un champ de plus sur une fiche : c'est là que partent le ticket
d'envoi, l'annonce de l'arrivée du colis, et le code qui rendrait le mot de passe.

Deux dégâts en sortaient, tous deux silencieux :

- **une faute de frappe** — un chiffre de travers, et le client cesse d'être prévenu sans que
  personne ne l'apprenne. Il croit qu'on l'oublie, l'entreprise croit l'avoir prévenu, et l'on ne
  s'en aperçoit qu'au comptoir des semaines plus tard ;
- **le numéro d'un autre** — rien n'empêchait d'inscrire celui du voisin, qui recevrait alors les
  références de colis et les montants dus de quelqu'un d'autre.

`telephone` a donc été **retiré de `CHAMPS_COMPTE_MODIFIABLES`** : le portail ne peut plus l'écrire.
Il passe par `api/numero.js`, qui envoie un code sur le numéro **proposé** — seul celui qui a ce
téléphone en main va au bout — et ne l'inscrit qu'ensuite, avec la clé de service.

Ce qui tient la preuve debout :

- **La session décide du compte, jamais le corps de la requête.** Accepter un identifiant envoyé
  par le navigateur laisserait un client connecté changer le numéro d'un autre, et détourner ses
  notifications. Le jeton nomme le compte sous `sub`, comme partout ailleurs.
- **La demande retient le numéro visé.** Sans cela, un code reçu pour un numéro servirait à en
  faire valider un autre, et la preuve ne prouverait rien.
- **Le code est haché** sous une clé à part, `bde-verif-numero` — que `api/donnees.js` refuse déjà,
  puisqu'il n'ouvre que `bde-data` et ses sauvegardes.
- **Le ralentisseur ne compte que les demandes d'envoi**, celles qui font partir un message facturé.
  L'appliquer aux validations aurait répondu « Trop de demandes, réessayez dans une heure » à un
  client qui se trompe de chiffre — un refus qui parle d'autre chose que ce qu'il vient de faire.
  La saisie du code est bornée à part, par cinq essais.

`nom` et `prenom` entrent au contraire dans les champs modifiables : c'est son état civil, et une
faute de saisie au comptoir le suivait jusque sur ses factures.

**L'adresse e-mail devient obligatoire**, à l'inscription comme au profil. C'est la seconde voie
par laquelle un compte se récupère : le code de réinitialisation part sur le WhatsApp *et* sur
l'adresse. Sans elle, un compte ne tient qu'à un numéro — celui-là même qui change, se perd, ou
tombe hors de la fenêtre de vingt-quatre heures de WhatsApp.

Éprouvé par `testnumero.mjs` (42 cas, dont le code d'un numéro rejoué sur un autre et le compte
d'un voisin), `testcompte` (59 cas), `testdonnees` (220 cas, dont le téléphone devenu non
modifiable depuis le portail) et `t85` (30 cas, l'écran du client sur un téléphone).

## Un modèle modifié n'est plus le même modèle (26/08/2026)

Un modèle se remplit **exactement** comme il a été déposé : trois variables si le corps en porte
trois, un en-tête « document » seulement s'il en a un, un paramètre de bouton seulement si le
bouton en attend un. Toute différence est refusée en bloc — code #132000, avec le même message pour
les trois causes.

D'où le piège. On retouche un modèle chez Meta : on ajoute une ligne, on retire une variable. Il
repasse en examen, il est réapprouvé, tout paraît normal. Mais l'application, elle, envoie toujours
l'ancien nombre de variables. Les envois échouent en silence, et l'on ne s'en aperçoit qu'en
constatant, des jours plus tard, que des clients n'ont rien reçu — sans qu'aucun écran ne l'ait dit.

`api/whatsapp.js?modeles=1` demande donc aussi les `components` et en tire la forme réelle :
nombre de variables (le **plus grand** indice `{{n}}` rencontré, pas le nombre d'occurrences), type
d'en-tête, et présence d'un bouton URL à suffixe variable. Configuration → Notifications la compare
à ce que `MODELES_WHATSAPP` envoie vraiment, et nomme chaque écart avec ses deux chiffres.

Deux précautions pour que l'alerte reste crédible :

- **Un modèle en examen n'est pas jugé.** Sa forme n'est pas stable tant que Meta ne l'a pas
  approuvé ; crier à l'écart pendant l'examen serait une fausse alerte exactement au moment où l'on
  modifie un modèle.
- **Un modèle absent n'est pas jugé non plus** : il est déjà signalé au-dessus, et le redire
  n'ajouterait rien.

Éprouvé par `testforme.mjs` (17 cas, la lecture de la forme chez Meta) et `t84` (16 cas, l'écran —
y compris son silence quand tout concorde).

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

## Choisir ce qui compte dans le bilan (26/08/2026)

Toute écriture de la comptabilité pesait sur le résultat, sans exception. Or il en passe qui n'ont
rien à y faire : une avance qu'on se remboursera, une dépense saisie deux fois qu'on n'ose pas
effacer parce qu'elle a servi de justificatif, une somme avancée pour le compte d'un tiers. La
seule issue était de **supprimer la ligne** — c'est-à-dire de fausser le résultat dans l'autre sens,
et de perdre la trace de ce qui avait réellement été payé.

Une écriture peut désormais être mise **hors bilan**. Elle reste dans la liste, gardée et lisible ;
elle cesse seulement d'entrer dans le calcul — dépenses, salaires, commissions manuelles, et donc
le résultat de la période.

Trois précautions, qui tiennent toutes à la même idée : **ce que le total ne compte pas doit être
dit.** Un total qui omettrait des lignes en silence tromperait le comptable plus sûrement qu'un
total faux — il n'aurait aucune raison d'aller vérifier.

- **La ligne pâlit, elle ne disparaît pas.** Elle porte la mention « hors bilan », son montant est
  barré, et elle garde ses boutons. La faire disparaître reviendrait à la supprimer, ce qu'on
  voulait précisément éviter.
- **Ce qui est écarté est chiffré à part**, sous le tableau (« *N* écritures hors bilan — *X* GNF
  qui ne pèsent pas sur le résultat ») et sur le récapitulatif PDF, qui gagne une ligne « Dont hors
  bilan ». Le rapport CSV porte la mention dans le libellé, pour qu'un tableur trié par montant ne
  perde pas l'information.
- **Le journal d'activité enregistre le geste** — « Écriture retirée du bilan » / « Écriture remise
  dans le bilan », avec le libellé concerné. Un résultat qui change sans qu'on sache pourquoi est
  exactement ce qu'une comptabilité ne peut pas se permettre.

Le geste est ouvert à la permission `compta.gerer_depenses`, la même que modifier et supprimer :
qui peut effacer une écriture peut à plus forte raison l'écarter du calcul. Le champ ne vit que
dans la comptabilité ; les dépenses de voyage et la caisse sont des listes distinctes, qu'il ne
touche pas.

Éprouvé par `t89` (22 cas) : le résultat change, la ligne survit, le montant reste intact en base,
l'écran annonce ce qu'il n'a pas compté, le journal le nomme, et l'on peut tout remettre.

## Les commissions d'agence, et le droit de ne pas les compter (26/08/2026)

Une écriture de dépense peut être écartée du bilan. Les commissions d'agence, non — alors qu'elles
ne sont même pas saisies : elles se **calculent** sur les colis selon les taux de Configuration. On
ne pouvait donc ni les corriger ni les effacer, et elles pesaient sur le résultat en toutes
circonstances. Une agence qui ne doit rien sur la période — commissions déjà réglées en dehors des
comptes, agence qui ne tourne pas encore, taux provisoire qu'on veut voir sans le subir — faussait
le bilan sans recours.

Chaque agence porte désormais le même bouton que les écritures. Le choix est gardé dans
`agencesHorsBilan`, une liste de noms d'agences.

Les mêmes précautions, pour la même raison :

- **L'agence reste affichée avec son montant**, barré. C'est le point important : une commission
  écartée du bilan **reste calculée et reste due**. La remettre à zéro reviendrait à la retirer à
  l'agence, ce qui n'est pas la question posée.
- **Ce qui sort du résultat est nommé et chiffré** — sous le bloc (« 1 agence hors bilan — Madina ·
  570 000 GNF qui ne pèse pas sur le résultat »), sur la tuile Commissions (« dont auto : … ·
  … hors bilan ») et sur le récapitulatif PDF. Un résultat qui monte sans qu'on sache pourquoi est
  un résultat qu'on ne peut pas défendre.
- **Le journal enregistre le geste** dans les deux sens, avec le nom de l'agence.

**Le nom sert de repère** parce que c'est déjà lui qui relie un colis à son agence partout ailleurs
(`colis.site`, avec Bambeto par défaut). Une agence renommée redevient donc comptée. C'est le sens
d'erreur qu'on préfère : un oubli qui **gonfle** les charges se voit sur le bilan, un oubli qui les
efface, non.

**Le choix se garde comme un droit, pas comme un réglage.** `agencesHorsBilan` entre dans
`SECTIONS_REGLAGES` (`api/_cloisonnement.js`) sous la permission `compta.gerer_depenses` — la même
que gérer les dépenses. Sans cela, un agent qui envoie son propre document pourrait retirer des
charges du résultat, ou en remettre que le responsable en avait sorties, sans jamais ouvrir
l'écran. Le bouton n'est pas la serrure.

Éprouvé par `t90` (29 cas) et par deux cas de `testdonnees` qui vérifient les **deux sens** de la
porte : l'agent ne décide pas de ce qui compte dans le bilan, l'administrateur oui — une décision
comptable qui ne s'enregistrerait pour personne serait un bilan qu'on ne peut pas corriger.

## Les rôles tournent, les personnes ne bougent pas (26/08/2026)

Correction de la section précédente sur le sens de l'envoi — le remède était pris à l'envers, et
une étiquette réelle l'a montré.

Un colis de partenaire a toujours les mêmes deux parties : le partenaire — ou son correspondant —
se tient **en Guinée**, son client se tient **au pays de la route**. Le sens de l'envoi n'y change
rien : ce sont les mêmes personnes, aux mêmes endroits, avec les mêmes numéros. Ce que le sens
change, c'est **le rôle que chacun tient** :

| Sens | Expéditeur | Destinataire |
| --- | --- | --- |
| Conakry → Paris | la partie guinéenne | le client au pays de la route |
| Paris → Conakry | le client au pays de la route | la partie guinéenne |

On avait d'abord fait tourner **les blocs de saisie** : l'indicatif du premier bloc passait de +224
à +33 selon le sens. Cela revenait à demander à celui qui saisit d'échanger deux personnes de place
à chaque changement de sens, alors qu'elles n'ont pas bougé — et personne ne le fait. Le colis
enregistré s'en est ressenti : l'entreprise guinéenne inscrite **expéditrice d'un colis qu'elle
reçoit**, avec son numéro en +224 sous la mention du pays de la route, et son client français
inscrit **« Livrer à » sous la mention GUINÉE**, avec un numéro en +33. Chaque bout se contredisait
lui-même, et les quatre documents recopiaient la contradiction.

Les blocs sont donc redevenus fixes — le bloc guinéen garde +224, le bloc du client garde
l'indicatif de la route — et c'est **l'écriture du colis qui distribue les rôles** selon le sens.
Les titres suivent (« Destinataire · Guinée » sur un colis qui arrive, « Remis par » au lieu de
« Remis à » quand le correspondant expédie), ainsi que les messages d'erreur : réclamer
« l'expéditeur » en désignant le bloc de celui qui réceptionne fait chercher l'erreur au mauvais
endroit.

**La route de l'étiquette était fausse elle aussi**, et pour la même raison : elle s'écrivait
`GN-<pays>` en toutes circonstances, comme si tout partait de Conakry. Sur un colis Paris →
Conakry, l'étiquette annonçait donc « GN-FR » — la route à l'envers, sur la seule ligne qui la
donne, juste au-dessus d'un destinataire qui est bien en Guinée. `routeDuColis` lit désormais les
deux bouts écrits sur le colis, dans l'ordre où il voyage ; les deux étiquettes (PDF et thermique)
y passent.

Le cloisonnement n'est pas touché : `buildClientDirectory` écarte le colis partenaire **avant** de
lire l'un ou l'autre bout, donc l'échange des rôles ne peut pas faire entrer le client d'un
partenaire dans les listes commerciales de l'entreprise. `clientDuColisPartenaire` continue de
désigner celui qui n'est pas en Guinée, et retombe donc sur le bon nom dans les deux sens.

Éprouvé par `t88` (18 cas), réécrit : les indicatifs ne s'échangent plus d'un sens à l'autre, les
titres portent le rôle, et le colis enregistré met le client à un bout et l'entreprise à l'autre.

## La sauvegarde qui ne dépend de personne (26/08/2026)

Toute l'entreprise tient dans un seul document JSON : les colis, les clients, la caisse, les
factures, les comptes. Il existait bien une copie quotidienne — mais elle partait du
**navigateur**, au chargement de l'application, et seulement là. Autrement dit, elle supposait que
quelqu'un ouvre l'application ce jour-là.

C'est exactement la supposition qui tombe quand on en a le plus besoin. L'agence ferme une
semaine, personne ne se connecte, et il n'existe aucune copie de cette semaine ; une fausse
manœuvre le lundi matin efface alors huit jours de travail. Pire, l'écran de Configuration
annonçait « la première sera créée à la prochaine ouverture de l'application » — une protection
conditionnelle, présentée sans sa condition.

`api/veille.js` fait le même geste depuis le serveur, à heure fixe (2 h, déclarée dans
`vercel.json`), que quelqu'un ouvre l'application ou non. La sauvegarde du navigateur reste en
place : deux filets valent mieux qu'un, et celui-ci continue de servir tant que la tâche n'est pas
configurée.

**Ce que la tâche refuse de faire.** Elle ne sauvegarde pas n'importe quoi. Un document vide ou
tronqué — une lecture partielle, une base en cours de migration — recopié tel quel occuperait la
place du jour **et** pousserait une bonne copie hors de la fenêtre de quatorze jours. Une mauvaise
copie qui chasse les bonnes est pire que pas de copie du tout : on se croit protégé.
`documentPlausible` vérifie donc le minimum qui ne peut pas manquer — c'est un objet, il porte une
équipe, cette équipe n'est pas vide — et à défaut la tâche s'arrête net : **rien n'est écrit, et
surtout rien n'est purgé.** Garder les anciennes copies est alors la seule chose utile qui reste à
faire. La purge ne s'exécute d'ailleurs qu'**après** une écriture réussie, jamais avant.

**La copie du jour ne se réécrit pas.** Ce n'est pas une économie : la première copie de la journée
précède les fausses manœuvres de la journée. La réécrire par-dessus reviendrait à sauvegarder
l'accident.

**Trois façons légitimes d'appeler**, et le secret de la tâche est éprouvé en premier — il voyage
dans l'en-tête `Authorization`, où `refusSaufEquipe` chercherait un jeton de session et n'en
trouverait pas :

| Qui | Comment |
| --- | --- |
| La tâche planifiée | `Authorization: Bearer $CRON_SECRET`, comparé en temps constant |
| Une autre fonction du déploiement | le laissez-passer interne `x-bde-interne` |
| Un membre de l'équipe | sa session, via le bouton « Sauvegarder maintenant » |

**`CRON_SECRET` est obligatoire.** Vercel n'ajoute l'en-tête à ses appels planifiés que si la
variable existe ; sans elle, la tâche appellerait sans rien présenter, et cette adresse serait
ouverte à qui la devine. La fonction la refuse alors — la sauvegarde ne se fait plus, mais la porte
reste fermée. Un client ou un partenaire connecté est refusé dans tous les cas.

**Et le relevé, pour qu'on sache qu'elle a tourné.** Une tâche planifiée silencieuse est une tâche
dont on ne sait rien : elle peut n'avoir jamais tourné, et l'écran continuerait d'annoncer une
protection imaginaire — c'est ce qui rendait un webhook muet indétectable. Chaque passage écrit
`veille` dans le document, l'échec compris, et Configuration en tire trois états distincts :
jamais sauvegardé · silence de plus de 30 heures · à jour, avec le nombre de colis et de comptes.
Ce relevé est protégé dans `fusionnerEcritureEquipe` comme `receptionWhatsApp` : une page ouverte
avant le passage de la tâche l'effacerait sinon en enregistrant, et l'écran se remettrait à dire
qu'aucune sauvegarde n'existe.

Éprouvé par `testveille` (51 cas, la vraie fonction serveur avec la base interceptée) et `t91`
(17 cas, les trois états de l'écran et le bouton manuel).

## L'incident du 26 août, et le garde-fou contre la page périmée (26/08/2026)

**Ce qui s'est passé.** À 21 h 41, un appareil a enregistré par-dessus la base une copie où les
colis, les comptes clients, le répertoire et les dépenses étaient vides. En un enregistrement :
seize colis, trois comptes clients, trois cent quarante-trois contacts, quatre écritures et trois
bordereaux effacés. Le journal d'activité, lui, a survécu — parce qu'il était déjà protégé dans
`fusionnerEcritureEquipe`. Rien d'autre ne l'était.

C'est le journal qui a permis de tout reconstituer : il portait encore les 230 actions de la
journée, et nommait le geste déclencheur (« Profil utilisateur modifié — MOUSTAPAHA BAH », 21 h 40).

**La restauration** est partie du document vivant, pas de la sauvegarde : on n'y a remis que les
collections effacées, en réunissant les colis et les factures par identifiant. Les modifications
du soir — le renommage d'un identifiant partenaire, une fiche de compte, les messages WhatsApp,
les pointages — ont donc été conservées. L'état avant restauration a d'abord été copié sous
`bde-backup-2026-08-26-avant-restauration`, pour que la réparation elle-même soit annulable.

**La cause de fond.** L'application envoie le document ENTIER à chaque geste. Un onglet resté
ouvert depuis une heure renvoie donc l'état du monde tel qu'il le croit, et l'écrase. Le
cloisonnement protégeait déjà les comptes, le journal et les messages ; il ne disait rien du reste.

**La règle ajoutée.** Une écriture ne peut pas faire fondre une collection. Chaque suppression,
dans l'application, est un enregistrement : passer de seize colis à zéro d'un coup n'est jamais un
geste, c'est un accident. Le refus porte sur neuf collections — `colis`, `clientAccounts`,
`repertoire`, `depenses`, `bordereaux`, `facturesPartenaire`, `preAlertes`, `remisesCaisse`,
`voyages` — et se déclenche quand **plus d'une entrée disparaît d'un coup ET qu'il en reste moins
de la moitié**.

Le seuil ne porte pas sur la taille de la liste. Un premier essai ne gardait que les listes d'au
moins cinq entrées : il laissait donc filer les trois comptes clients et les quatre dépenses,
c'est-à-dire une partie exacte de ce qui avait été perdu. La taille ne dit rien ; ce qui compte est
ce qu'une seule écriture emporte.

**Les trois suppressions légitimes continuent de fonctionner.** Réinitialiser les colis, restaurer
une sauvegarde, importer un fichier : ces gestes posent sur le document une intention datée
(`_remplacementVolontaire`) juste avant d'enregistrer. Une page périmée n'en porte aucune — ou en
porte une vieille, ce qui revient au même : la fenêtre est de dix minutes. Le serveur **retire
l'intention avant d'écrire**, car la laisser s'installer donnerait à toutes les pages ouvertes un
laissez-passer permanent, et le garde-fou serait mort dès l'enregistrement suivant.

Un garde-fou qui bloquerait le travail ordinaire serait retiré dans la semaine et ne protégerait
plus rien : retirer un colis sur seize passe, en retirer six aussi. C'est en perdre neuf d'un coup
qui ne passe pas.

**Le refus se consigne.** Sans trace, l'appareil fautif recommencerait à chaque enregistrement et
personne ne saurait qu'une page périmée tourne quelque part — jusqu'au jour où elle passe. Le
journal porte donc « Enregistrement refusé — page périmée », avec le détail de ce qui a été sauvé
(`colis : 16 → 0 · repertoire : 343 → 0`) et le nom du compte qui a envoyé. C'est cette ligne qui
permet d'aller fermer l'onglet.

Éprouvé par `testgardefou` (34 cas), qui rejoue l'envoi exact du 26 août et vérifie aussi que les
trois suppressions légitimes passent toujours.

## « Enregistré » ne se dit plus sur parole

L'application annonçait « Colis enregistré » dès que l'appel au serveur n'avait pas levé d'erreur.
Ce n'est pas la même chose que constater que le colis y est. Le 26 août, l'écriture qui a effacé la
journée a répondu comme les autres : sans erreur.

Toute création passe désormais par une **relecture du serveur**. On écrit, puis on relit la base et
on y cherche ce qu'on vient d'écrire — le numéro de suivi du colis, l'identifiant du compte. Trois
réponses, et la troisième n'existait pas avant :

- **le serveur l'a gardé** → « enregistré et vérifié sur le serveur » ;
- **le serveur est injoignable pour la relecture** → « en attente de synchronisation, ne fermez pas
  cette page ». Ne pas pouvoir vérifier n'est pas constater une perte : on dit qu'on ne sait pas ;
- **le serveur a répondu, et ce n'est pas là** → « NON ENREGISTRÉ — le serveur ne l'a pas gardé ».
  Le formulaire **reste ouvert**, la saisie est intacte, et il n'y a rien à retaper.

La relecture ne s'appuie jamais sur le cache du navigateur (`relireDuServeur` interroge le serveur
et lui seul). C'est le piège central de ce garde-fou : l'écriture dépose le document dans le cache
**avant** d'appeler le serveur, donc une relecture tolérante au cache retrouverait toujours ce
qu'elle cherche et confirmerait un enregistrement qui n'a pas eu lieu. Ce serait pire que l'ancien
comportement — une fausse certitude, au lieu d'une simple absence de vérification.

Quatre endroits sont couverts : le formulaire de colis de l'équipe, celui de l'espace partenaire,
l'import Excel (qui referme sa fenêtre seulement si le serveur a gardé les colis), et la création
d'un compte client quand elle se fait sans le serveur d'inscription. Une alerte de ce genre ne doit
pas s'effacer avant qu'on l'ait lue : le bandeau ordinaire dure 2,8 secondes, celui-ci quinze.

Éprouvé par `t92` (16 cas), qui enregistre un colis par le vrai formulaire face à un serveur qui
répond 200 sans rien garder — le cas du 26 août, enfin visible à l'écran.

## Être prévenu pendant que ça arrive

Le garde-fou empêche la perte et consigne son refus. Mais un refus consigné n'est vu que par celui
qui va le chercher : le 26 août, la trace était dans le journal dès 21 h 41, et elle a été lue le
lendemain matin. Le refus arrive maintenant par trois chemins, dont deux ne demandent d'aller rien
chercher.

**Le document garde une alerte nommée.** `alertesEcrasement` retient les vingt derniers refus avec
la date, le compte, son rôle, ce qui allait disparaître, l'appareil (`User-Agent`) et l'adresse de
connexion. Sans ces deux derniers, on saurait qu'une page périmée tourne quelque part sans savoir
laquelle aller fermer — ce qui ne sert à rien.

L'application peut **marquer une alerte lue**, et c'est tout ce qu'elle peut en faire. Elle ne peut
ni la réécrire ni la supprimer : sinon un enregistrement venu de la page fautive effacerait le seul
indice de son existence.

**Un bandeau rouge s'affiche dans l'application**, sur toutes les pages, pour les comptes de
l'entreprise. Il commence par dire que les données sont intactes — une alerte qui annonce d'abord
une perte fait perdre une heure à celui qui la lit, alors que le refus est précisément ce qui a tout
sauvé. Puis il nomme le compte, ce qui allait partir, et le geste à faire : fermer l'onglet, le
rouvrir.

**Un courriel part immédiatement au responsable** (`api/_alerte.js`), avant même que la fonction ne
rende la main — un envoi non attendu ne partirait pas, une fonction serverless étant arrêtée dès sa
réponse. Il est envoyé **après** l'écriture : prévenir avant laisserait une fenêtre où le message
affirme que les données sont intactes alors que rien n'est encore enregistré. Un échec d'envoi ne
transforme jamais un enregistrement réussi en erreur ; il est seulement consigné. Destinataire :
`ALERTE_EMAIL` si elle est réglée, sinon le premier administrateur ayant une adresse.

**Pas de WhatsApp, et ce n'est pas un oubli.** Hors de la fenêtre de vingt-quatre heures, Meta
n'autorise que les modèles approuvés. Une alerte d'incident est par définition imprévisible : elle
tomberait presque toujours hors fenêtre. Il faudrait d'abord faire approuver un modèle « alerte »
dans WhatsApp Manager. Écrire aujourd'hui du code qui « enverrait un WhatsApp » reviendrait à
promettre une alerte qui n'arriverait jamais.

Éprouvé par `testalerte` (31 cas), qui vérifie aussi qu'un nom de compte contenant du HTML ne
devient pas du HTML dans le courriel.
## Les verrous contre les automates

Trois portes de ce site s'ouvrent sans mot de passe : la connexion, la création de compte, et le
suivi public d'un colis. Les deux premières comptaient déjà les essais. La troisième donnait sans
rien demander — et c'est la plus intéressante à aspirer, parce que les numéros de suivi se suivent :
`BDE260801`, `BDE260802`, `BDE260803`. Un programme qui compte de un en un ramassait, colis après
colis, le nom de l'expéditeur et du destinataire de toute l'entreprise. Aucune de ces requêtes
n'est illégitime prise seule ; c'est leur nombre qui l'est.

Deux plafonds, par connexion (`api/_verrou.js`) :

- **trente recherches de suivi par dix minutes.** Une personne qui suit ses colis en consulte
  quelques-uns, revient plus tard : la marge est très large. Un automate fait cela en trois
  secondes ;
- **dix numéros inconnus par dix minutes.** Chercher un numéro qui n'existe pas est normal — faute
  de frappe, colis pas encore saisi. En chercher dix d'affilée qui n'existent pas, c'est un
  balayage. On coupe donc plus tôt là-dessus, parce qu'un aspirateur en produit beaucoup et un
  client presque aucun.

La réponse à un numéro inconnu **ne change pas** : une liste vide, comme avant. Dire « ce numéro
n'existe pas » apprendrait à l'automate où continuer. Le refus, lui, porte un `Retry-After` : les
robots honnêtes le lisent et cessent de revenir en boucle.

**Ce que ces verrous ne font pas, et il faut le dire.** Le compte est tenu en mémoire, dans
l'instance qui répond. Vercel en lance plusieurs et les éteint : un automate patient, ou réparti sur
plusieurs adresses, passera au travers. Ce n'est pas une barrière, c'est un plafond — il rend
l'aspiration lente et voyante là où elle était instantanée et muette. Une vraie barrière demanderait
un compteur partagé (base ou service dédié) ; c'est le pas d'après, et il se paie.

### Les en-têtes de sécurité

`vercel.json` pose désormais une **politique de sécurité de contenu** (CSP) et six en-têtes qui
manquaient. La CSP est la seule qui change vraiment quelque chose : elle nomme les origines
autorisées, de sorte qu'un script glissé dans une page ne peut ni s'exécuter depuis un domaine
inconnu, ni renvoyer les données ailleurs (`connect-src`). S'y ajoutent HSTS, `nosniff`,
`X-Frame-Options: DENY` et `frame-ancestors 'none'` (le site ne peut plus être encadré dans une page
qui l'imite), `Referrer-Policy`, `Permissions-Policy` et `Cross-Origin-Opener-Policy`.

Un seul endroit du site obligeait à laisser `script-src 'unsafe-inline'` — c'est-à-dire à laisser
passer n'importe quel script inséré dans une page : l'attribut `onload=` de quatre mots qui
promouvait la feuille de polices. Il est parti dans `public/polices.js`, de même origine. Pour un
attribut, on renonçait à la protection principale.

`style-src` garde `'unsafe-inline'`, et c'est assumé : toute l'interface est écrite en styles
attribués (`style={{…}}`), il n'y a pas de moyen de faire autrement sans réécrire l'application.
Le risque y est sans commune mesure avec celui des scripts.

Une CSP ne casse rien à la compilation : elle casse le site chez le client, silencieusement, en
refusant une police, un export PDF ou la connexion à la base. Elle est donc éprouvée par `testcsp`
(7 cas) **sur le site compilé, derrière les vrais en-têtes** : la page s'affiche, la connexion
fonctionne, les polices sont appliquées, le CDN des exports passe, un script venu d'ailleurs est
refusé, et la navigation ordinaire ne déclenche aucun refus.

`public/robots.txt` complète le tout en écartant `/api/`, la page de récupération et les URL de
suivi nommées — indexer `?suivi=BDE260801` reviendrait à publier dans un moteur de recherche le nom
de l'expéditeur et du destinataire. Ce fichier ne protège rien, il demande : c'est pour ceux qui
l'ignorent que les verrous existent.

Éprouvé par `testverrou` (24 cas), qui appelle la vraie fonction de suivi et vérifie qu'un client
qui fait dix recherches d'affilée n'est jamais gêné.

## Ce que l'audit du 27 août a trouvé

Trois défauts réels, dont deux constatés dans la base de production.

### Les mots de passe s'effaçaient par omission

Sur trois comptes clients, **deux n'avaient plus aucun mot de passe** — ni empreinte, ni sel. L'un
gardait même l'algorithme et le nombre d'itérations, sans l'empreinte qu'ils servent à vérifier.
Ces personnes ne pouvaient plus entrer, par aucun chemin, et rien ne le signalait : la connexion
répondait « identifiant ou mot de passe incorrect », comme pour une faute de frappe.

La cause tient en une ligne : le document circule en entier, et il existe des copies dont les
empreintes ont été **délibérément retirées** — une sauvegarde téléchargée, par exemple, d'où l'on
ôte les mots de passe parce qu'elle voyage par courriel ou clé USB. Réimportée, cette copie écrasait
les vraies. L'omission n'était pas distinguée d'un effacement voulu.

La règle est maintenant : une écriture qui ne porte pas d'empreinte pour un compte ne peut pas lui
en retirer une. Changer de mot de passe continue de fonctionner — un vrai changement apporte une
empreinte neuve, et celle-là gagne. Vaut pour l'équipe comme pour les clients.

**Les deux comptes abîmés doivent être réparés à la main** : depuis Centre clients, réinitialiser
l'accès de `Gourrasy` et de `MOUSTAPHA`, ou leur faire utiliser « mot de passe oublié ».

### Une seule requête effaçait tout

`DELETE /api/donnees` acceptait n'importe quelle clé autorisée — y compris `bde-data`, le document
de l'entreprise. Une seule requête, faite depuis n'importe quelle session d'équipe, effaçait les
colis, les clients, la caisse et le journal. Et elle passait à côté du garde-fou, qui ne protège que
les **écritures** : il n'y avait plus de document à protéger.

Aucun écran n'en avait besoin. La seule suppression que fait l'application est la rotation des
vieilles sauvegardes ; la porte est désormais limitée aux clés `bde-backup-`.

### Le balayage de mots de passe passait sous le radar

La page de connexion comptait les essais sur **un compte** : elle arrêtait qui cherche le mot de
passe d'une personne précise, et ne voyait rien de l'attaque inverse — un seul mot de passe très
courant essayé sur cent identifiants. Chaque compte n'était touché qu'une fois, donc aucun plafond
n'était atteint. C'est pourtant la manière dont on entre le plus souvent : il suffit d'une personne
dans l'entreprise qui ait choisi « 123456 ». Un second compteur, par connexion et quel que soit
l'identifiant visé, coupe au quarantième essai — un seuil que plusieurs personnes partageant la
sortie internet d'une agence n'atteignent jamais.

### Ce que l'audit n'a PAS trouvé

La séparation des espaces tient : un client ou un partenaire ne peut lire ni les sauvegardes, ni la
liste des clés, ni le document entier, et ce qu'il écrit est reposé sur le vrai document. Les mots
de passe sont hachés en PBKDF2-SHA256, 150 000 tours, avec un sel par compte. La connexion répond
la même chose pour un identifiant inconnu et un mot de passe faux, en calculant une empreinte même
quand aucun compte ne correspond, pour que la durée ne trahisse rien. Les jetons de session sont
signés et vérifiés à durée constante. Le webhook WhatsApp refuse tout appel non authentifié. La
table est fermée par RLS sans aucune politique : seule la clé de service passe.

### Ce qui reste ouvert, et qu'il faut savoir

- **Une session vit douze heures et ne peut pas être révoquée.** Changer un mot de passe ou
  supprimer un compte n'invalide pas le jeton déjà délivré : il reste valable jusqu'à son
  expiration. Pour un téléphone perdu ou quelqu'un qui part, c'est une demi-journée d'accès. Le
  remède demande un numéro de version par compte, vérifié à chaque appel.
- **Le garde-fou est un anti-accident, pas un anti-malveillance.** Un compte d'équipe authentifié
  peut poser lui-même la marque d'intention et remplacer le document : c'est précisément ce dont
  une restauration a besoin. Il protège d'une page périmée, pas de quelqu'un qui veut nuire depuis
  un compte valide.
- **Les verrous comptent en mémoire** et ne survivent pas au redémarrage d'une instance (voir plus
  haut).
- **`CRON_SECRET` n'est toujours pas renseigné** : la sauvegarde de nuit ne tourne pas. Les
  sauvegardes actuelles sont écrites par le navigateur, à la première ouverture de la journée —
  elles dépendent donc de quelqu'un qui ouvre l'application.
- **`WHATSAPP_APP_SECRET` reste facultatif.** Sans lui, le webhook n'est protégé que par le jeton
  inscrit dans son adresse ; avec lui, chaque appel est vérifié par signature.

## L'annonce que le bouton va chercher

Le message d'une campagne porte un bouton « Voir l'offre » qui ramène sur la page d'accueil. L'offre
n'y était nulle part : le client arrivait sur un site qui ne parlait pas de ce qu'il venait de lire,
et devait en plus cliquer sur un pays pour voir un départ. Un bouton qui mène à une page muette fait
perdre confiance au lieu d'en donner.

Ce qui part par message s'affiche donc au même moment sur la page publique, **en haut, avant le
suivi de colis**, sans rien à cliquer.

Elle **s'efface d'elle-même** à sa date. C'est pour cela que l'échéance est un vrai champ de date et
non du texte libre : on ne peut pas comparer « la fin du mois » à aujourd'hui, et personne ne va
retirer une offre périmée à la main — c'est précisément ce qu'on oublie. Une offre encore affichée
après sa fin est pire que pas d'offre du tout : le client se déplace pour rien. Le jour de
l'échéance compte encore ; le lendemain, elle a disparu.

L'échéance est vérifiée **au serveur** (`api/public.js`) et pas seulement dans la page. Une offre
périmée qui quitte le serveur reste affichée chez qui a gardé sa page ouverte.

Le champ de date rend au passage impossible une faute de frappe qui partirait chez tous les clients
à la fois — « 4 setpembre » était jusqu'ici recopié tel quel.

Éprouvé par `t93` (11 cas) sur la vraie page publique, et par `testverrou` pour la porte serveur.

## Une seule adresse publique, et jamais celle de l'hébergeur

Le QR code d'une étiquette, le lien de suivi d'un message WhatsApp, le bouton d'un courriel, le reçu
de paiement : tous portaient l'adresse **depuis laquelle l'agent travaillait**. Un agent connecté
sur l'adresse technique de l'hébergeur (`…vercel.app`) imprimait donc des étiquettes qui y
renvoient — et une étiquette collée sur un carton vit des mois.

Deux raisons d'y mettre fin, dont une sérieuse.

La marque, d'abord : ce qui arrive chez un client doit porter le nom de l'entreprise, pas celui d'un
prestataire technique.

**La réputation ensuite.** Les filtres anti-hameçonnage de WhatsApp, de Gmail et des opérateurs se
méfient des sous-domaines partagés : n'importe qui peut ouvrir un `quelquechose.vercel.app`, et
beaucoup s'en servent pour de faux sites. Un message d'entreprise qui pointe vers l'un d'eux part
avec un handicap, et **une plainte contre un voisin suffit à faire tomber le domaine partagé tout
entier** — sans que l'on y soit pour rien. Le domaine de l'entreprise, lui, n'engage qu'elle.

Une seule fonction (`adressePublique`) décide, et tout en découle. Elle rend le domaine de
l'entreprise dès que l'origine courante est celle d'un hébergeur mutualisé ; l'adresse locale de
développement, elle, reste utilisée telle quelle, sans quoi rien ne serait vérifiable hors ligne.

**Les liens déjà partis sont rattrapés.** Les étiquettes déjà collées, les messages déjà envoyés,
les QR déjà imprimés continuent d'arriver sur l'adresse de l'hébergeur : la page les renvoie sur le
domaine, en gardant le chemin et le numéro de suivi.

**Sauf l'écran de connexion, et c'est délibéré.** Si le domaine venait à tomber — DNS expiré,
certificat, erreur de configuration — l'adresse de l'hébergeur reste la porte de service par
laquelle l'équipe entre pour réparer. Tout rediriger fermerait cette porte le jour où elle est la
seule qui reste.

Éprouvé par `t94` (9 cas), qui fait croire au navigateur qu'il est sur l'adresse de l'hébergeur et
vérifie les trois cas : le vieux lien est rattrapé, la porte de service reste ouverte, et ce qu'un
agent connecté là-bas fabrique porte quand même le domaine.
