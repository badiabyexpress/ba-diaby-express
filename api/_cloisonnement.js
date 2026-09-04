/**
 * Ce qu'un compte qui n'est pas de la maison a le droit de voir, et d'écrire.
 *
 * Deux populations sont concernées, pour deux raisons différentes :
 *
 *   — LE CLIENT, parce que n'importe qui peut créer un compte depuis la page d'accueil ;
 *   — LE PARTENAIRE, parce que c'est une entreprise tierce. Son compte, lui, est ouvert par
 *     l'administrateur : le risque n'est pas « n'importe qui » mais « le confrère à qui l'on a
 *     ouvert une porte ». L'entreprise s'est donné une règle — ce qu'un partenaire facture à ses
 *     propres clients ne la regarde pas — et l'inverse est tout aussi vrai.
 *
 * POURQUOI CE FICHIER
 * -------------------
 * Toutes les données de l'entreprise tiennent dans un seul document. api/donnees.js limitait
 * jusqu'ici QUELLES CLÉS une session peut demander — mais pas ce qu'il y a dedans. Ces deux
 * comptes recevaient donc le document entier : les colis de tous les clients avec leurs noms,
 * leurs téléphones et ce qu'ils ont payé, le répertoire, le journal d'activité, la caisse, les
 * tarifs des autres partenaires, et la liste des employés avec l'empreinte de leur mot de passe.
 *
 * Le tri se fait ICI, sur le serveur. C'est le seul endroit qui tienne : le navigateur exécute du
 * code que celui qui le tient peut modifier, et un écran ne cache rien à qui ouvre les outils de
 * développement.
 *
 * DEUX SENS, DEUX RÈGLES
 * ----------------------
 * En lecture, une LISTE BLANCHE : ce qui n'y figure pas ne sort pas. Une section ajoutée plus
 * tard est donc privée par défaut — c'est l'inverse d'une liste noire, qu'on oublie de compléter
 * le jour où l'on ajoute une section, et qui ne se trahit jamais avant la fuite.
 *
 * En écriture, on ne retient du document envoyé que les fragments qui appartiennent au compte, et
 * on les repose sur le document réel. Les écrans continuent d'envoyer le document entier, comme
 * avant, et ce qu'ils n'ont pas le droit de changer est simplement ignoré. Sans cette moitié-là,
 * le tri en lecture serait pire que rien : le navigateur renverrait le document amputé, et
 * effacerait d'un seul enregistrement tout ce qu'on venait de lui cacher.
 */

import { effectivePermission } from "./_permissions.js";
import { CHAMPS_TOTP_SECRETS, codesSecoursRestants } from "./_totp.js";

/*
 * Ce que tout le monde peut voir.
 *
 * Ces sections s'impriment déjà sur les tickets, s'affichent sur la vitrine publique, ou n'ont de
 * sens qu'affichées : l'adresse des agences, le calendrier des départs, les taux de change, les
 * moyens de paiement acceptés. Les cacher au client n'apporterait rien et casserait son espace.
 */
export const SECTIONS_PARTAGEES = [
  "branding",
  "entreprise",
  "sites",
  "agencesReception",
  "agenceRetraitClient",
  "departs",
  "exchangeRates",
  "tauxMisAJourLe",
  "categories",
  "paymentConfig",
  "expressTarifEurKg",
  "theme",
  "lang",
];

/*
 * Tout ce qui touche au mot de passe reste au serveur.
 *
 * Le portail n'en a aucun usage : la connexion se vérifie dans api/login.js, et le changement de
 * mot de passe envoie une empreinte neuve sans avoir besoin de l'ancienne. Une empreinte qui ne
 * part pas est une empreinte qu'on ne peut pas attaquer hors ligne.
 */
const CHAMPS_MOT_DE_PASSE = [
  "motdepasse", "motdepasseSecure", "motdepasseSalt", "motdepasseIter", "motdepasseAlgo",
];

/*
 * Ce qu'un colis ne dit pas à son destinataire : les notes que l'agence prend pour elle-même, et
 * le prix convenu avec un partenaire — que l'application ne doit jamais exposer, à personne.
 */
const CHAMPS_COLIS_INTERNES = ["notesInternes", "prixPartenaire", "devisePartenaire"];

/*
 * Ce qu'un client peut changer sur SON colis : demander l'expédition express, déclarer un
 * paiement, signaler un problème. Rien d'autre — ni le poids, ni le prix, ni le statut, qui sont
 * constatés par l'agence et engagent l'entreprise.
 */
const CHAMPS_COLIS_MODIFIABLES = ["demandeExpress", "declarationsPaiement", "signalements"];

/** Les listes personnelles, reconnues à l'identifiant de compte que porte chaque élément. */
const LISTES_PERSONNELLES = ["preAlertes", "demandesRegroupement"];

/*
 * Ce qu'un client peut changer sur SON compte : ses coordonnées, ses messages à l'agence, la date
 * de sa dernière visite, et son mot de passe.
 *
 * Pas son identifiant, ni son nom : ils ont été constatés à l'inscription et servent à le
 * retrouver. Pas son identifiant technique non plus, sans quoi il écrirait dans la fiche d'un
 * autre. Une liste blanche, là encore : le jour où le portail gagnera un réglage, il faudra
 * l'ajouter ici — un réglage qui ne s'enregistre pas se remarque tout de suite, une porte laissée
 * ouverte jamais.
 */
/*
 * Ce qu'un client peut changer sur sa propre fiche.
 *
 * `nom` et `prenom` en font partie : c'est son état civil, personne d'autre n'a à le corriger à sa
 * place, et une faute de saisie au comptoir le suivait jusque sur ses factures.
 *
 * `telephone` N'EN FAIT PLUS PARTIE, et c'est délibéré. Ce n'est pas un champ comme un autre :
 * c'est là que partent son ticket, l'annonce de l'arrivée de son colis et le code qui lui rendrait
 * son mot de passe. Tant qu'il s'écrivait d'ici, un chiffre de travers le privait de tout sans que
 * personne ne l'apprenne, et rien n'empêchait d'inscrire le numéro d'un autre — qui recevrait
 * alors ses références et ses montants. Il passe désormais par api/numero.js, qui envoie un code
 * sur le numéro proposé et ne l'inscrit qu'une fois la preuve faite.
 */
const CHAMPS_COMPTE_MODIFIABLES = [
  "nom", "prenom", "adresse", "email", "messages", "derniereVisite",
  "motdepasseSecure", "motdepasseSalt", "motdepasseIter", "motdepasseAlgo",
];

function liste(valeur) {
  return Array.isArray(valeur) ? valeur : [];
}

/*
 * UNE CONVERSATION NE SE REMPLACE PAS, ELLE SE COMPLÈTE.
 *
 * Les messages échangés avec un client ou un partenaire étaient repris tels quels de ce que la
 * page envoyait. Le geste ordinaire — ouvrir sa messagerie, ce qui marque les messages comme lus
 * et enregistre — renvoyait donc la liste telle que cette page la connaissait. Un onglet resté
 * ouvert depuis le matin, ou un second appareil, et les messages arrivés entre-temps
 * disparaissaient des deux côtés, sans trace et sans que personne le voie.
 *
 * On garde donc ce que la page rapporte — c'est là que vivent ses marques de lecture et son
 * nouveau message — et l'on remet ce qu'elle ignorait. Supprimer un message n'est jamais un
 * geste légitime ici : rien n'est perdu à ne pas le permettre, et beaucoup à le permettre.
 */
function fusionnerConversation(base, envoye) {
  if (!Array.isArray(envoye)) return liste(base);
  const rapportes = new Set(envoye.map((m) => m && m.id).filter(Boolean));
  const oublies = liste(base).filter((m) => m && m.id && !rapportes.has(m.id));
  if (oublies.length === 0) return envoye;
  /* Remis dans l'ordre du temps : une conversation se lit du plus ancien au plus récent. */
  return [...envoye, ...oublies].sort((a, b) => new Date(a?.date || 0) - new Date(b?.date || 0));
}

function sans(objet, champs) {
  if (!objet || typeof objet !== "object") return objet;
  const sortie = { ...objet };
  champs.forEach((c) => { delete sortie[c]; });
  return sortie;
}

/*
 * LE SECRET DU SECOND FACTEUR NE DESCEND JAMAIS AU NAVIGATEUR — À PERSONNE, PAS MÊME À L'ÉQUIPE.
 * ─────────────────────────────────────────────────────────────────────────────
 * Les empreintes de mots de passe sont retirées des espaces cloisonnés, mais l'équipe, elle,
 * reçoit le document entier : c'est son travail de le réécrire. Une empreinte PBKDF2 n'y est pas
 * un cadeau — il faut 150 000 tours par essai pour en tirer quelque chose.
 *
 * Un secret TOTP, lui, N'EST PAS UNE EMPREINTE : c'est la clé elle-même. Qui la lit calcule les
 * codes aussi bien que le téléphone de la personne, pour toujours, sans rien casser. La laisser
 * circuler reviendrait à afficher le second facteur de chaque collègue dans les données que
 * n'importe quel poste de l'agence télécharge à chaque chargement de page.
 *
 * On la retire donc de TOUTES les lectures, et l'on met à la place un booléen : de quoi afficher
 * « en place » ou « pas en place » dans les écrans, sans rien livrer de ce qui sert à entrer.
 * L'écriture, elle, la remet en place (voir preserverIdentifiants) — un navigateur ne peut donc
 * ni la lire ni l'effacer.
 */
function compteSansSecretTotp(compte) {
  if (!compte || typeof compte !== "object") return compte;
  const actif = !!compte.totpSecret;
  const enPreparation = !!compte.totpEnAttente;
  const restants = codesSecoursRestants(compte.totpSecours);
  if (!actif && !enPreparation && !restants && compte.totpActif === undefined) return compte;
  return {
    ...sans(compte, CHAMPS_TOTP_SECRETS),
    totpActif: actif,
    totpEnPreparation: enPreparation,
    /* Le nombre, jamais les empreintes : c'est tout ce dont l'écran a besoin pour prévenir. */
    totpSecoursRestants: restants,
  };
}

export function sansSecretsTotp(document) {
  if (!document || typeof document !== "object" || Array.isArray(document)) return document;
  const sortie = { ...document };
  ["users", "clientAccounts"].forEach((cle) => {
    if (!Array.isArray(sortie[cle])) return;
    sortie[cle] = sortie[cle].map(compteSansSecretTotp);
  });
  return sortie;
}

/** Les éléments d'une liste qui portent le compte de ce client. */
function aMoi(valeurs, compteId) {
  return liste(valeurs).filter((x) => x && x.clientAccountId === compteId);
}

/**
 * Le document tel qu'un client doit le recevoir.
 *
 * Sans identifiant de compte — un jeton client dont le compte a été supprimé, par exemple — il ne
 * reste que les sections partagées. Un espace vide vaut mieux que l'espace de quelqu'un d'autre.
 */
export function vueClient(donnees, compteId) {
  if (!donnees || typeof donnees !== "object" || Array.isArray(donnees)) return donnees;
  const vue = {};
  SECTIONS_PARTAGEES.forEach((cle) => {
    if (donnees[cle] !== undefined) vue[cle] = donnees[cle];
  });
  vue.colis = aMoi(donnees.colis, compteId).map((c) => sans(c, CHAMPS_COLIS_INTERNES));
  LISTES_PERSONNELLES.forEach((cle) => { vue[cle] = aMoi(donnees[cle], compteId); });
  /*
   * Son compte, et lui seul. Le portail lit `clientAccounts` pour y retrouver le sien : une liste
   * d'un seul élément lui suffit, et les autres n'ont rien à faire dans son navigateur.
   */
  vue.clientAccounts = liste(donnees.clientAccounts)
    .filter((c) => c && c.id === compteId)
    .map((c) => sans(c, CHAMPS_MOT_DE_PASSE));
  return vue;
}

/**
 * Le document réel, augmenté des seules modifications qu'un client avait le droit de faire.
 *
 * On part TOUJOURS de ce que porte la base, jamais de ce qu'envoie le navigateur : c'est ce qui
 * garantit qu'une écriture de client ne peut rien effacer, même si elle arrive amputée, périmée,
 * ou fabriquée à la main.
 */
export function fusionnerEcritureClient(actuel, propose, compteId) {
  const base = actuel && typeof actuel === "object" && !Array.isArray(actuel) ? actuel : {};
  const envoye = propose && typeof propose === "object" && !Array.isArray(propose) ? propose : {};

  const envoyesParTracking = new Map();
  liste(envoye.colis).forEach((c) => { if (c && c.tracking) envoyesParTracking.set(c.tracking, c); });

  const colis = liste(base.colis).map((c) => {
    if (!c || c.clientAccountId !== compteId) return c;
    const envoyeC = envoyesParTracking.get(c.tracking);
    if (!envoyeC) return c;
    const retenu = { ...c };
    CHAMPS_COLIS_MODIFIABLES.forEach((champ) => {
      if (envoyeC[champ] !== undefined) retenu[champ] = envoyeC[champ];
    });
    return retenu;
  });

  /*
   * Les listes personnelles se recomposent : ce qui est aux autres vient du document réel, ce qui
   * est au client vient de ce qu'il envoie — avec son identifiant réimposé, pour qu'un compte ne
   * puisse pas déposer une pré-alerte au nom d'un autre.
   */
  const recomposees = {};
  LISTES_PERSONNELLES.forEach((cle) => {
    recomposees[cle] = [
      ...liste(base[cle]).filter((x) => !x || x.clientAccountId !== compteId),
      ...aMoi(envoye[cle], compteId).map((x) => ({ ...x, clientAccountId: compteId })),
    ];
  });

  /*
   * Son compte : on reprend la fiche telle qu'elle est en base et l'on n'y remplace que les champs
   * qu'il a le droit de changer, quand il les envoie.
   *
   * Rien ne disparaît faute d'avoir été envoyé — c'est ce qui permet de lui cacher son empreinte
   * de mot de passe sans qu'un simple changement d'adresse la lui efface, tout en le laissant
   * changer ce mot de passe, puisqu'il envoie alors une empreinte neuve.
   */
  const envoyeCompte = liste(envoye.clientAccounts).find((x) => x && x.id === compteId);
  const clientAccounts = liste(base.clientAccounts).map((c) => {
    if (!c || c.id !== compteId || !envoyeCompte) return c;
    const retenu = { ...c };
    CHAMPS_COMPTE_MODIFIABLES.forEach((champ) => {
      if (envoyeCompte[champ] === undefined) return;
      // La conversation se complète ; tout le reste se remplace.
      retenu[champ] = champ === "messages"
        ? fusionnerConversation(c.messages, envoyeCompte.messages)
        : envoyeCompte[champ];
    });
    return retenu;
  });

  return { ...base, colis, ...recomposees, clientAccounts };
}

/* =============================================================================================
 * LE PARTENAIRE
 *
 * Un partenaire est une entreprise tierce qui nous confie des colis. Il travaille sous sa propre
 * marque, avec ses propres clients — que l'entreprise ne connaît pas, et n'a pas à connaître. La
 * réciproque n'était pourtant pas vraie : son compte recevait tout notre carnet.
 *
 * Un partenaire peut avoir des employés, dont le compte porte le même rôle et pointe vers le sien
 * par `partenaireParent`. Les deux voient le même espace ; seul le titulaire gère les accès.
 * ========================================================================================== */

/** Les six champs d'identité qu'un partenaire tient lui-même à jour. */
const CHAMPS_IDENTITE_PARTENAIRE = ["nomCommercial", "logo", "adresse", "telephone", "email", "siteWeb"];

/*
 * Ce qu'un titulaire peut changer sur le compte d'un de ses employés.
 *
 * Pas `role`, pas `partenaireParent` : ils sont réimposés à chaque fois. Sans cela, un partenaire
 * fabriquerait un compte administrateur en changeant deux mots dans ce qu'il envoie.
 */
const CHAMPS_EMPLOYE_MODIFIABLES = [
  "prenom", "nom", "identifiant", "telephone", "email", "lieuOperation", "voitLesMontants", "twoFA",
  "motdepasseSecure", "motdepasseSalt", "motdepasseIter", "motdepasseAlgo",
];

/**
 * Efface le mot de passe hérité quand une empreinte moderne vient d'être posée.
 *
 * `motdepasse` est le champ des comptes repris de l'ancienne plateforme : mot de passe en clair,
 * ou haché sans sel. Il n'est PAS dans la liste ci-dessus, et c'est volontaire — personne ne doit
 * pouvoir en poser un depuis un navigateur.
 *
 * Mais cette fusion part de la fiche telle que la base la porte, et n'y remplace que les champs
 * envoyés. Un partenaire qui changeait son mot de passe recevait bien sa nouvelle empreinte
 * PBKDF2 — et gardait l'ancien mot de passe en clair à côté, indéfiniment. La connexion prenant
 * l'empreinte en premier, rien ne se voyait : l'ancien mot de passe dormait simplement dans la
 * base, prêt à resservir le jour où l'empreinte viendrait à manquer.
 */
function sansMotDePasseHerite(retenu, envoye) {
  if (!envoye || !envoye.motdepasseSecure) return retenu;
  if (retenu.motdepasse === undefined) return retenu;
  const { motdepasse, ...propre } = retenu;
  return propre;
}

/*
 * Ce qu'un partenaire ne pose jamais sur un colis, même à sa création.
 *
 * Le rattachement à un compte client, les paiements encaissés par l'entreprise, la preuve de
 * remise, la photo prise à la vérification, les notes internes : tout cela appartient au circuit
 * de l'entreprise. `validationPartenaire` est réimposée séparément — un partenaire ne se valide
 * pas lui-même.
 */
const CHAMPS_COLIS_RESERVES = [
  "clientAccountId", "paiements", "pod", "photoVerification", "photoEntrepot",
  "notesInternes", "declarationsPaiement", "signalements", "demandeExpress",
];

/** Le seul champ qu'un partenaire change sur un colis déjà enregistré : sa propre marque de paiement. */
const CHAMPS_COLIS_PARTENAIRE_MODIFIABLES = ["paiementPartenaire"];

/** Même plafond que l'écran, mais posé là où il compte : le navigateur ne se vérifie pas lui-même. */
const MAX_EMPLOYES_PARTENAIRE = 5;

/** Ce qu'une seule écriture peut ajouter au journal. De quoi tracer un geste, pas de quoi le noyer. */
const MAX_ENTREES_JOURNAL = 20;
/*
 * Le plafond de la liste vivante. Il ne jette plus : au-delà, la tâche de nuit archive (voir
 * api/_journal.js). Il reste large pour qu'un incident ne coure jamais après l'archivage, et
 * borné parce que le document entier repart à chaque enregistrement, sur la 4G d'un dépôt.
 */
const MAX_JOURNAL_EN_LIGNE = 3000;

/**
 * Le partenaire dont relève un compte : lui-même s'il est titulaire, sinon son employeur.
 *
 * Rien ne vient du jeton, qui ne porte que l'identifiant et le rôle : c'est le document qui fait
 * foi. Un compte introuvable ou qui n'est pas partenaire ne relève de personne — et ne verra donc
 * que les sections partagées, jamais l'espace d'un autre.
 */
export function partenaireDuCompte(donnees, compteId) {
  const u = liste(donnees?.users).find((x) => x && x.id === compteId && x.role === "Partenaire");
  if (!u) return null;
  return u.partenaireParent || u.id;
}

/** Le document tel qu'un partenaire — ou l'un de ses employés — doit le recevoir. */
export function vuePartenaire(donnees, partenaireId) {
  if (!donnees || typeof donnees !== "object" || Array.isArray(donnees)) return donnees;
  const vue = {};
  SECTIONS_PARTAGEES.forEach((cle) => {
    if (donnees[cle] !== undefined) vue[cle] = donnees[cle];
  });
  const sien = (x) => !!x && !!partenaireId && x.partenaireId === partenaireId;
  vue.colis = liste(donnees.colis).filter(sien);
  vue.facturesPartenaire = liste(donnees.facturesPartenaire).filter(sien);
  vue.preAlertesPartenaire = liste(donnees.preAlertesPartenaire).filter(sien);
  /*
   * Sa fiche et celles de ses employés — sans rien de ce qui touche aux mots de passe. Les autres
   * partenaires, les agents et les administrateurs n'y sont pas : c'est là que dormaient les
   * empreintes de toute l'équipe.
   */
  vue.users = liste(donnees.users)
    .filter((u) => u && u.role === "Partenaire" && (u.id === partenaireId || u.partenaireParent === partenaireId))
    .map((u) => sans(u, CHAMPS_MOT_DE_PASSE));
  /*
   * Le journal part vide plutôt qu'absent. L'espace y ajoute une ligne à chaque geste ; avec une
   * section absente il en ferait une liste neuve, avec le journal de l'entreprise il le lui
   * donnerait à lire. Vide, il n'apprend rien et ses ajouts sont récupérés à l'écriture.
   */
  vue.activityLog = [];
  return vue;
}

/**
 * Le document réel, augmenté des seules modifications qu'un partenaire avait le droit de faire.
 *
 * `compteId` distingue le titulaire de ses employés : seul le titulaire gère les accès et son
 * identité commerciale. Un employé ne peut toucher qu'à ses propres identifiants, aux colis, et
 * aux annonces de dépôt.
 */
export function fusionnerEcriturePartenaire(actuel, propose, partenaireId, compteId) {
  const base = actuel && typeof actuel === "object" && !Array.isArray(actuel) ? actuel : {};
  const envoye = propose && typeof propose === "object" && !Array.isArray(propose) ? propose : {};
  if (!partenaireId) return base;
  const titulaire = compteId === partenaireId;

  /* ---- Les colis ------------------------------------------------------------------------ */
  const envoyesParTracking = new Map();
  liste(envoye.colis).forEach((c) => { if (c && c.tracking) envoyesParTracking.set(c.tracking, c); });

  const connus = new Set(liste(base.colis).map((c) => c && c.tracking).filter(Boolean));
  const colis = liste(base.colis).map((c) => {
    if (!c || c.partenaireId !== partenaireId) return c;
    const envoyeC = envoyesParTracking.get(c.tracking);
    if (!envoyeC) return c;
    const retenu = { ...c };
    CHAMPS_COLIS_PARTENAIRE_MODIFIABLES.forEach((champ) => {
      if (envoyeC[champ] !== undefined) retenu[champ] = envoyeC[champ];
    });
    return retenu;
  });

  /*
   * Les colis qu'il vient d'enregistrer. C'est son métier : il dépose, nous acheminons.
   *
   * Deux choses lui sont retirées d'office. Le rattachement au partenaire, d'abord, réimposé au
   * sien — sans quoi il déposerait un colis au compte d'un confrère. La validation ensuite : elle
   * est remise « En attente », car c'est l'entreprise qui pèse le colis et arrête son prix. Un
   * prix qu'il aurait glissé lui-même n'engage donc rien — il est recalculé à la vérification.
   */
  const nouveaux = liste(envoye.colis)
    .filter((c) => c && c.tracking && !connus.has(c.tracking))
    .map((c) => ({
      ...sans(c, CHAMPS_COLIS_RESERVES),
      partenaireId,
      validationPartenaire: { statut: "En attente" },
      /*
       * LES MONTANTS ET LE PARCOURS SONT IMPOSÉS, PAS REÇUS.
       *
       * Le formulaire du partenaire posait déjà ces valeurs ; le serveur, lui, les acceptait
       * telles qu'elles venaient. Un partenaire n'a pas besoin de notre écran pour écrire : il
       * lui suffit d'envoyer autre chose. Vérifié — un colis déposé avec
       * « prix: 999999, paye: 888888, reste: 111111, status: "Livré" » était accepté tel quel.
       *
       * Ce que cela permettait :
       *   — `prix` gonfle le chiffre d'affaires de l'entreprise et le « reste à encaisser » de
       *     ses fiches de voyage, avec de l'argent qu'aucun client ne doit ;
       *   — `paye` fabrique un encaissement qui n'a jamais eu lieu ;
       *   — `facturePartenaireId` rattache le colis à une facture DÉJÀ RÉGLÉE, et il se lit
       *     alors « Réglé » sur le bordereau comme sur la fiche de voyage ;
       *   — `status: "Livré"` fait franchir au colis tout le parcours sans que l'entreprise
       *     l'ait pesé, contrôlé ni transporté.
       *
       * Un colis de partenaire n'est jamais facturé au comptoir : ses trois champs de prix
       * client valent zéro, par construction. Il entre au dépôt, et nulle part ailleurs. Ce
       * qu'il nous doit vit à part, dans `prixPartenaire`, et c'est l'agent qui l'arrête en le
       * vérifiant.
       */
      prix: 0, paye: 0, reste: 0,
      facturePartenaireId: null,
      status: "Enregistré",
      historique: [{ status: "Enregistré", date: new Date().toISOString() }],
    }));

  /* ---- Les utilisateurs ----------------------------------------------------------------- */
  const envoyesUsers = liste(envoye.users);
  const parId = new Map();
  envoyesUsers.forEach((u) => { if (u && u.id) parId.set(u.id, u); });

  /*
   * Un identifiant doit rester unique dans toute l'application : la connexion cherche un compte
   * par identifiant, et deux comptes homonymes rendraient imprévisible celui qui s'ouvre. L'écran
   * le vérifiait déjà — mais il ne voit plus que les comptes du partenaire, et surtout un écran
   * ne se vérifie pas lui-même.
   */
  const prisPar = new Map();
  liste(base.users).forEach((u) => {
    if (u && u.identifiant) prisPar.set(String(u.identifiant).toLowerCase(), u.id);
  });
  const identifiantLibre = (identifiant, pourId) => {
    const detenteur = prisPar.get(String(identifiant || "").toLowerCase());
    return detenteur === undefined || detenteur === pourId;
  };

  /*
   * Une suppression d'accès se lit à une absence — l'écran renvoie la liste sans la fiche retirée.
   * Encore faut-il que cette liste existe : un envoi où `users` manque, ou n'a pas même la fiche
   * du titulaire, n'est pas une suppression de tous ses employés, c'est un envoi incomplet. Le
   * distinguer coûte une ligne ; ne pas le distinguer coûterait cinq accès et leurs mots de passe.
   */
  const listePlausible = envoyesUsers.some((u) => u && u.id === partenaireId);
  const peutSupprimer = titulaire && listePlausible;

  const users = [];
  let supprimes = 0;
  liste(base.users).forEach((u) => {
    if (!u) { users.push(u); return; }
    const envoyeU = parId.get(u.id);

    // Sa propre fiche de titulaire : son identité commerciale, et ses identifiants de connexion.
    if (u.id === partenaireId) {
      if (!envoyeU) { users.push(u); return; }
      const retenu = { ...u };
      if (titulaire && envoyeU.partenaire && typeof envoyeU.partenaire === "object") {
        const identite = { ...(u.partenaire || {}) };
        CHAMPS_IDENTITE_PARTENAIRE.forEach((champ) => {
          if (envoyeU.partenaire[champ] !== undefined) identite[champ] = envoyeU.partenaire[champ];
        });
        retenu.partenaire = identite;
      }
      if (u.id === compteId) {
        CHAMPS_EMPLOYE_MODIFIABLES.forEach((champ) => {
          if (envoyeU[champ] === undefined) return;
          if (champ === "identifiant" && !identifiantLibre(envoyeU[champ], u.id)) return;
          retenu[champ] = envoyeU[champ];
        });
      }
      /*
       * Les messages échangés avec l'entreprise vivent sur sa fiche : il doit pouvoir en ajouter,
       * et marquer comme lus ceux qu'il a lus.
       */
      if (Array.isArray(envoyeU.partenaireMessages)) {
        retenu.partenaireMessages = fusionnerConversation(u.partenaireMessages, envoyeU.partenaireMessages);
      }
      users.push(u.id === compteId ? sansMotDePasseHerite(retenu, envoyeU) : retenu);
      return;
    }

    // Un de ses employés.
    if (u.role === "Partenaire" && u.partenaireParent === partenaireId) {
      // Supprimé : seul le titulaire peut le faire, et seulement en ne le renvoyant pas.
      if (!envoyeU) {
        if (peutSupprimer) { supprimes++; return; }
        users.push(u);
        return;
      }
      const peutModifier = titulaire || u.id === compteId;
      if (!peutModifier) { users.push(u); return; }
      const retenu = { ...u };
      CHAMPS_EMPLOYE_MODIFIABLES.forEach((champ) => {
        if (envoyeU[champ] === undefined) return;
        if (champ === "identifiant" && !identifiantLibre(envoyeU[champ], u.id)) return;
        // Un employé ne s'ouvre pas lui-même l'accès aux montants : c'est son patron qui le décide.
        if (champ === "voitLesMontants" && !titulaire) return;
        retenu[champ] = envoyeU[champ];
      });
      users.push({ ...sansMotDePasseHerite(retenu, envoyeU), role: "Partenaire", partenaireParent: partenaireId });
      return;
    }

    // Tous les autres — agents, administrateurs, autres partenaires — sortent intacts.
    users.push(u);
  });

  /*
   * Les accès qu'il vient de créer. Le rôle et le rattachement sont réimposés, le plafond est
   * appliqué ici et non à l'écran, et un identifiant déjà pris fait tomber la création — sans quoi
   * deux comptes homonymes rendraient imprévisible celui qu'ouvre la page de connexion.
   */
  const dejaConnus = new Set(liste(base.users).map((u) => u && u.id).filter(Boolean));
  let places = MAX_EMPLOYES_PARTENAIRE
    - liste(base.users).filter((u) => u && u.role === "Partenaire" && u.partenaireParent === partenaireId).length
    + supprimes;
  const nouveauxAcces = [];
  if (titulaire) {
    envoyesUsers.forEach((u) => {
      if (!u || !u.id || dejaConnus.has(u.id)) return;
      if (places <= 0) return;
      if (!identifiantLibre(u.identifiant, u.id)) return;
      prisPar.set(String(u.identifiant || "").toLowerCase(), u.id);
      places--;
      nouveauxAcces.push({ ...u, role: "Partenaire", partenaireParent: partenaireId });
    });
  }

  /* ---- Ses annonces de dépôt ------------------------------------------------------------- */
  const preAlertesPartenaire = [
    ...liste(base.preAlertesPartenaire).filter((p) => !p || p.partenaireId !== partenaireId),
    ...liste(envoye.preAlertesPartenaire)
      .filter((p) => p && p.partenaireId === partenaireId)
      .map((p) => ({ ...p, partenaireId })),
  ];

  /* ---- Le journal ------------------------------------------------------------------------ */
  /*
   * Ses gestes restent tracés, mais sous son nom réel.
   *
   * L'auteur est réécrit depuis le compte de la session : le journal ne sert à rien si l'on peut
   * y signer du nom d'un autre. Et l'on n'en prend qu'une poignée par écriture — un journal est
   * une trace, pas un dépôt où l'on peut verser ce qu'on veut.
   */
  const dejaJournal = new Set(liste(base.activityLog).map((e) => e && e.id).filter(Boolean));
  const auteur = liste(base.users).find((u) => u && u.id === compteId);
  const signature = auteur ? `${auteur.prenom || ""} ${auteur.nom || ""}`.trim() || auteur.identifiant : "Partenaire";
  const ajouts = liste(envoye.activityLog)
    .filter((e) => e && e.id && !dejaJournal.has(e.id))
    .slice(0, MAX_ENTREES_JOURNAL)
    .map((e) => ({ ...e, utilisateur: signature, role: "Partenaire" }));
  /* Même règle que pour l'équipe : la coupe ne jette plus, l'archivage de nuit prend le relais. */
  const activityLog = [...ajouts, ...liste(base.activityLog)].slice(0, MAX_JOURNAL_EN_LIGNE);

  return {
    ...base,
    colis: [...nouveaux, ...colis],
    users: [...users, ...nouveauxAcces],
    preAlertesPartenaire,
    activityLog,
  };
}


/* =============================================================================================
 * L'ÉQUIPE
 *
 * Les deux sections précédentes protègent l'entreprise de gens qui ne sont pas d'elle. Celle-ci
 * la protège de ses propres comptes — et le risque n'est plus du même ordre : ce n'est ni un
 * inconnu, ni un tiers, mais quelqu'un qu'elle a embauché et à qui elle a donné un accès.
 *
 * Les permissions par rôle existaient déjà (voir api/_permissions.js), mais elles ne vivaient que
 * dans le navigateur : elles décidaient quels boutons s'affichent. Un bouton qu'on n'affiche pas
 * n'est pas un bouton qu'on ne peut pas actionner. Un agent qui ouvrait les outils de
 * développement pouvait réécrire la configuration, effacer le journal qui garde trace de ses
 * gestes, et se faire administrateur.
 *
 * Ici, à la différence des espaces cloisonnés, on ne part PAS du document en base : un membre de
 * l'équipe reçoit le document entier et le réécrit entier, c'est son travail. On part donc de ce
 * qu'il envoie, et l'on REMET EN PLACE ce qu'il n'avait pas le droit de changer.
 *
 * Ce lot ne couvre pas tout : les colis, les factures, les bordereaux et la caisse restent
 * écrivables par n'importe quel compte de l'équipe, comme avant. Il couvre les trois choses dont
 * on ne revient pas — se donner des droits, réécrire les règles, effacer les traces.
 * ========================================================================================== */

/*
 * Ce qu'un membre de l'équipe change sur SA propre fiche sans être gestionnaire des comptes : son
 * mot de passe, et de quoi le joindre. C'est aussi par là que passe la remise à niveau de
 * l'empreinte, à la première connexion d'un vieux compte.
 */
const CHAMPS_SOI_MEME = [
  "motdepasse", "motdepasseSecure", "motdepasseSalt", "motdepasseIter", "motdepasseAlgo",
  "twoFA", "telephone", "email",
];

/*
 * Ce qui décide des droits d'un compte. Personne ne se les donne à soi-même — pas même un
 * administrateur, qui les a déjà tous et n'a donc rien à y gagner : la règle vaut surtout pour
 * celui qui n'en a pas.
 */
const CHAMPS_DE_POUVOIR = ["role", "permissionsOverride", "paysAutorises", "agence", "zoneOperation", "partenaireParent"];

/*
 * Les sections de réglages, et la permission qu'il faut pour y toucher — les mêmes que celles qui
 * ouvrent les écrans correspondants, pour qu'un geste possible à l'écran ne soit jamais refusé
 * par le serveur, ni l'inverse.
 */
/*
 * UN RÉGLAGE ABSENT N'EST PAS UN RÉGLAGE EFFACÉ — À TOUTES LES PROFONDEURS.
 *
 * La règle existait, mais elle ne descendait que d'un cran : elle rendait à `notifWhatsApp` une
 * étape entière qui manquait, jamais une case manquante À L'INTÉRIEUR d'une étape. Or c'est
 * exactement ainsi que ce réglage est bâti — une étape, et sous elle « expéditeur »,
 * « destinataire », « partenaire ».
 *
 * Le résultat s'est vu en production : sur sept étapes sur neuf, la case « expéditeur » avait
 * purement disparu de la base — pas mise à faux, ABSENTE — et avec elle « partenaire ». Les
 * destinataires continuaient d'être prévenus, les expéditeurs ne l'étaient plus, et rien dans
 * l'écran des réglages ne montrait de case décochée : il n'y avait plus de case du tout à
 * l'endroit où le code allait lire.
 *
 * On rend donc tout champ absent, à n'importe quelle profondeur. Deux limites voulues :
 * — un champ PRÉSENT et vide reste vide ; on doit toujours pouvoir effacer un réglage à la main ;
 * — les tableaux ne sont pas fusionnés, ils sont remplacés : retirer un élément d'une liste de
 *   réglages est un geste légitime, et une fusion le rendrait impossible.
 */
function completerChampsManquants(avant, apres) {
  let modifie = false;
  const complete = { ...apres };
  Object.keys(avant).forEach((champ) => {
    const valeurAvant = avant[champ];
    if (!Object.prototype.hasOwnProperty.call(apres, champ)) {
      complete[champ] = valeurAvant;
      modifie = true;
      return;
    }
    const valeurApres = apres[champ];
    const objetAvant = valeurAvant && typeof valeurAvant === "object" && !Array.isArray(valeurAvant);
    const objetApres = valeurApres && typeof valeurApres === "object" && !Array.isArray(valeurApres);
    if (!objetAvant || !objetApres) return;
    const fusionne = completerChampsManquants(valeurAvant, valeurApres);
    if (fusionne !== valeurApres) { complete[champ] = fusionne; modifie = true; }
  });
  return modifie ? complete : apres;
}

const SECTIONS_REGLAGES = [
  ["branding", "config.acceder"],
  ["entreprise", "config.acceder"],
  ["sites", "config.acceder"],
  ["agencesReception", "config.acceder"],
  ["agenceRetraitClient", "config.acceder"],
  ["departs", "config.acceder"],
  ["notificationSettings", "config.acceder"],
  ["notifWhatsApp", "config.acceder"],
  /*
   * Le barème du transfert d'argent — frais, taux, limites, commissions. Il décide de la marge de
   * l'entreprise sur chaque envoi : il se garde comme un tarif, derrière sa propre permission, et
   * pas derrière l'accès général à la configuration.
   */
  ["transfertConfig", "transfert.config"],
  ["miraKnowledge", "config.acceder"],
  ["exchangeRates", "config.tarifs"],
  ["tauxMisAJourLe", "config.tarifs"],
  ["commissionConfig", "config.tarifs"],
  /*
   * LES VERSEMENTS DE COMMISSION — de l'argent qui sort vers une personne.
   *
   * Cette liste dit ce que l'entreprise a déjà payé à chacun. Sans garde, un agent pouvait s'y
   * inscrire un versement depuis les outils de développement de son navigateur : son reste dû
   * tombait à zéro, et rien n'aurait montré d'où venait le solde. La même permission que le barème
   * les protège — celle qui décide déjà de ce que chacun gagne décide de ce qu'on lui a versé.
   */
  ["paiementsCommission", "config.tarifs"],
  ["paymentConfig", "config.tarifs"],
  ["expressTarifEurKg", "config.tarifs"],
  ["categories", "config.categories"],
  /*
   * La fiche de pointage n'est pas un réglage, mais elle se garde de la même façon : c'est une
   * pièce sociale, tenue par le responsable. Un agent qui pourrait la réécrire pourrait effacer
   * ses propres absences.
   */
  ["pointages", "equipe.pointage"],
  ["pointageHoraire", "equipe.pointage"],
  /*
   * Les agences dont les commissions ne comptent pas dans le résultat. Ce n'est pas un réglage
   * non plus, mais une décision comptable : elle retire des charges du bilan, et se garde donc
   * comme le droit d'écarter une écriture — celui qui ne peut pas gérer les dépenses ne doit pas
   * pouvoir améliorer le résultat en silence.
   */
  ["agencesHorsBilan", "compta.gerer_depenses"],
];

/** Le rôle le plus modeste : celui qu'on donne quand on n'a pas le droit d'en choisir un. */
const ROLE_LE_PLUS_MODESTE = "Chauffeur";

function signatureDe(compte) {
  return `${compte.prenom || ""} ${compte.nom || ""}`.trim() || compte.identifiant || "Compte";
}

/*
 * LES IDENTIFIANTS NE S'EFFACENT PAS PAR OMISSION
 * ─────────────────────────────────────────────────────────────────────────────
 * Constaté en production le 27 août 2026 : sur trois comptes clients, deux n'avaient plus AUCUN
 * mot de passe — ni empreinte, ni sel, ni rien. L'un gardait même l'algorithme et le nombre
 * d'itérations, sans l'empreinte qu'ils servent à vérifier. Ces personnes ne pouvaient plus entrer,
 * par aucun chemin, et rien ne le signalait : la connexion répondait « identifiant ou mot de passe
 * incorrect », comme pour une faute de frappe.
 *
 * L'explication tient en une ligne : le document circule en entier, et il existe des copies dont
 * les mots de passe ont été délibérément retirés — une sauvegarde téléchargée, par exemple, d'où
 * l'on ôte les empreintes parce qu'elle voyage par courriel ou clé USB. Réimportée, cette copie
 * écrase les vraies. L'omission n'était pas distinguée d'un effacement voulu.
 *
 * La règle : une écriture qui ne porte PAS d'empreinte pour un compte ne peut pas lui en retirer
 * une. Changer de mot de passe, en revanche, se fait toujours — un vrai changement apporte une
 * nouvelle empreinte, et celle-là gagne.
 */
const CHAMPS_IDENTIFIANTS = [
  "motdepasse", "motdepasseSecure", "motdepasseSalt", "motdepasseIter", "motdepasseAlgo",
];

export function preserverIdentifiants(comptesBase, comptesSortie) {
  const parId = new Map();
  liste(comptesBase).forEach((c) => { if (c && c.id) parId.set(c.id, c); });
  return liste(comptesSortie).map((compte) => {
    if (!compte || !compte.id) return compte;
    const ancien = parId.get(compte.id);
    if (!ancien) return compte;                                   // compte nouveau : rien à reprendre
    const repris = { ...compte };
    /*
     * UNE RÉVOCATION NE RECULE JAMAIS.
     *
     * « Déconnecter de tous les appareils » pose une date sur le compte, et c'est elle qui invalide
     * les jetons déjà délivrés. Une page ouverte avant ce geste ne la connaît pas : son prochain
     * enregistrement l'effacerait, et rouvrirait la porte au téléphone qu'on venait de fermer.
     * On garde donc toujours la date la PLUS RÉCENTE des deux — avancer est possible, revenir non.
     */
    const dateBase = Date.parse(ancien.sessionsRevoqueesLe || "") || 0;
    const dateEnvoyee = Date.parse(compte.sessionsRevoqueesLe || "") || 0;
    if (dateBase > dateEnvoyee) repris.sessionsRevoqueesLe = ancien.sessionsRevoqueesLe;

    /*
     * LE SECOND FACTEUR NE SE POSE NI NE SE RETIRE DEPUIS UN NAVIGATEUR.
     *
     * Le secret est retiré de toutes les lectures (voir sansSecretsTotp) : aucune page ne le
     * connaît, donc aucune page ne peut le renvoyer. Sans cette ligne, le premier enregistrement
     * venu l'effacerait par simple omission — exactement la mécanique qui avait vidé les mots de
     * passe de deux comptes clients en août — et la double authentification tomberait toute seule,
     * sans un mot, sur le compte le mieux protégé de l'entreprise.
     *
     * La règle est donc absolue et vaut dans les deux sens : ce qui est en base reste en base, ce
     * qui n'y est pas ne s'y met pas. Poser ou retirer le second facteur passe par api/login.js,
     * qui exige le code du téléphone dans un sens et le mot de passe dans l'autre.
     *
     * Elle est placée AVANT le raccourci du changement de mot de passe : changer son mot de passe
     * ne doit pas emporter son second facteur avec lui.
     */
    CHAMPS_TOTP_SECRETS.forEach((champ) => {
      if (ancien[champ] !== undefined) repris[champ] = ancien[champ];
      else delete repris[champ];
    });
    /* Marques de lecture, pas des données : elles sont recalculées à chaque lecture. */
    delete repris.totpActif;
    delete repris.totpEnPreparation;
    delete repris.totpSecoursRestants;
    if (ancien.totpActiveLe !== undefined) repris.totpActiveLe = ancien.totpActiveLe;
    else delete repris.totpActiveLe;

    if (compte.motdepasseSecure || compte.motdepasse) return repris; // changement voulu : il gagne
    CHAMPS_IDENTIFIANTS.forEach((champ) => {
      if (ancien[champ] !== undefined) repris[champ] = ancien[champ];
    });
    return repris;
  });
}

function comptesDeLEquipe(base, envoye, moi, peut) {
  const gere = peut("users.gerer");
  const droitsDesAutres = peut("users.permissions");
  const envoyesParId = new Map();
  liste(envoye.users).forEach((u) => { if (u && u.id) envoyesParId.set(u.id, u); });
  /* Même prudence que pour les partenaires : une liste qui ne contient même pas sa propre fiche
   * n'est pas une suppression de toute l'équipe, c'est un envoi incomplet. */
  const peutSupprimer = gere && envoyesParId.has(moi.id);
  /*
   * LA ZONE DE CELUI QUI ÉCRIT — DÉCLARÉE AVANT D'ÊTRE LUE.
   *
   * Ces deux lignes vivaient à la fin de la fonction, cinquante lignes APRÈS la boucle qui s'en
   * sert. En JavaScript, un `const` lu avant sa déclaration ne vaut pas `undefined` : il lève une
   * erreur. Toute écriture d'un compte qui tient les utilisateurs — donc chaque enregistrement de
   * l'administrateur — s'arrêtait donc net, la fonction serveur répondait « base injoignable », et
   * l'application mettait le travail en file d'attente. C'est le « 1 en attente d'enregistrement »
   * resté affiché sur le téléphone du responsable.
   */
  const zoneDeMoi = String(moi.zoneOperation || moi.agence || "").trim().toLowerCase();
  const compteDansMaZone = (u) => !zoneDeMoi || u?.id === moi.id
    || String(u?.zoneOperation || u?.agence || "").trim().toLowerCase() === zoneDeMoi;

  const sortie = [];
  liste(base.users).forEach((u) => {
    if (!u) { sortie.push(u); return; }
    const envoyeU = envoyesParId.get(u.id);

    if (u.id === moi.id) {
      if (!envoyeU) { sortie.push(u); return; }
      const retenu = { ...u };
      if (gere) {
        // Il tient déjà les comptes : il corrige sa fiche comme les autres, sauf ses droits.
        Object.keys(envoyeU).forEach((c) => { if (!CHAMPS_DE_POUVOIR.includes(c)) retenu[c] = envoyeU[c]; });
      } else {
        CHAMPS_SOI_MEME.forEach((c) => { if (envoyeU[c] !== undefined) retenu[c] = envoyeU[c]; });
      }
      sortie.push(retenu);
      return;
    }

    if (!gere || (zoneDeMoi && !compteDansMaZone(u))) { sortie.push(u); return; }
    if (!envoyeU) { if (peutSupprimer) return; sortie.push(u); return; }
    const retenu = { ...envoyeU };
    if (!droitsDesAutres) {
      CHAMPS_DE_POUVOIR.forEach((c) => {
        if (u[c] !== undefined) retenu[c] = u[c]; else delete retenu[c];
      });
    }
    sortie.push(retenu);
  });

  if (gere) {
    const connus = new Set(liste(base.users).map((u) => u && u.id).filter(Boolean));
    liste(envoye.users).forEach((u) => {
      if (!u || !u.id || connus.has(u.id)) return;
      /*
       * Créer un compte, c'est lui choisir un rôle. Sans le droit sur les permissions, le compte
       * naît donc avec le rôle le plus modeste : sinon, « je crée un administrateur et je m'y
       * connecte » serait le chemin le plus court pour contourner tout ce qui précède.
       */
      sortie.push(droitsDesAutres ? u : { ...u, role: ROLE_LE_PLUS_MODESTE, permissionsOverride: {} });
    });
  }

  /*
   * L'IDENTIFIANT EST LA CLÉ DE CONNEXION, PAS UN LIBELLÉ.
   *
   * Le changer, c'est décider avec quoi quelqu'un entre — et, du même coup, faire cesser de
   * fonctionner ce qu'il tape depuis des mois. Un compte qui « gère les utilisateurs » corrige des
   * fiches ; il n'a pas à disposer des clés d'entrée de ses collègues, ni à s'attribuer celle d'un
   * autre. Cela reste donc à l'administrateur, et à lui seul.
   *
   * DEUX GARDES, ET LA SECONDE COMPTE AUTANT QUE LA PREMIÈRE.
   *
   * L'unicité : deux comptes portant le même identifiant rendent la connexion imprévisible — c'est
   * le mot de passe qui départagerait, ce qui n'est pas une façon de choisir un compte. Un
   * changement qui heurte un identifiant déjà pris est donc annulé, et l'ancien reste en place :
   * mieux vaut un renommage qui n'a pas eu lieu qu'une entrée devenue ambiguë.
   *
   * On compare en minuscules, comme le fait la connexion : « MCamara » et « mcamara » sont le même
   * identifiant, et laisser passer l'un à côté de l'autre créerait exactement l'ambiguïté qu'on
   * cherche à éviter.
   */
  const avantParId = new Map();
  liste(base.users).forEach((u) => { if (u && u.id) avantParId.set(u.id, u); });
  const estAdministrateur = moi.role === "Administrateur";

  const prisAilleurs = (id, candidat) => liste(base.users)
    .some((u) => u && u.id !== id && String(u.identifiant || "").trim().toLowerCase() === candidat);

  const dejaVus = new Set();
  return sortie.map((u) => {
    if (!u || !u.id) return u;
    const avant = avantParId.get(u.id);
    // Un compte qui vient d'être créé choisit son identifiant : il n'y a rien à préserver.
    if (!avant) { dejaVus.add(String(u.identifiant || "").trim().toLowerCase()); return u; }

    const demande = String(u.identifiant || "").trim();
    const ancien = String(avant.identifiant || "");
    if (demande === ancien) { dejaVus.add(ancien.toLowerCase()); return u; }
    /*
     * Un identifiant vidé n'est pas un renommage : c'est un compte qu'on ne pourrait plus ouvrir.
     * On rend l'ancien plutôt que d'enfermer quelqu'un dehors sur une case effacée par mégarde.
     */
    if (!demande) { dejaVus.add(ancien.toLowerCase()); return { ...u, identifiant: ancien }; }

    const candidat = demande.toLowerCase();
    const refuse = !estAdministrateur || prisAilleurs(u.id, candidat) || dejaVus.has(candidat);
    dejaVus.add((refuse ? ancien : demande).toLowerCase());
    return refuse ? { ...u, identifiant: ancien } : u;
  });
}

/*
 * ─────────────────────────────────────────────────────────────────────────────
 * LE GARDE-FOU CONTRE LA PAGE PÉRIMÉE
 *
 * Le 26 août 2026 à 21 h 41, un appareil a enregistré par-dessus la base une copie où les colis,
 * les comptes clients, le répertoire et les dépenses étaient vides. En un enregistrement, seize
 * colis, trois comptes, trois cent quarante-trois contacts et quatre écritures ont disparu. Le
 * journal, lui, a survécu — parce qu'il était déjà protégé ici. Rien d'autre ne l'était.
 *
 * C'est le défaut de fond d'un document unique : l'application envoie TOUT le document à chaque
 * geste. Un onglet resté ouvert depuis une heure — ou une page rechargée sur un cache incomplet —
 * renvoie donc l'état du monde tel qu'il le croit, et l'écrase.
 *
 * La règle : une écriture ne peut pas faire fondre une collection. Supprimer des colis se fait un
 * par un, et chaque suppression est un enregistrement ; passer de seize à zéro d'un coup n'est
 * jamais un geste, c'est un accident.
 *
 * SAUF quand c'en est un. Trois gestes suppriment légitimement en masse : réinitialiser les
 * colis, restaurer une sauvegarde, importer un fichier. Ceux-là posent une intention datée sur le
 * document juste avant d'enregistrer. Une page périmée, elle, n'en a aucune — ou en porte une
 * vieille, ce qui revient au même.
 * ─────────────────────────────────────────────────────────────────────────────
 */
/*
 * LA LISTE S'ÉTAIT ARRÊTÉE AUX NEUF PREMIÈRES VICTIMES.
 *
 * Elle avait été écrite après une perte, et ne contenait donc que ce qui avait déjà disparu. Les
 * catégories de produits sont passées de 58 à 42 sans que rien ne bouge — elles n'étaient pas
 * dedans. Les fiches de pointage, les sites, les prochains départs non plus. Une liste de
 * protection qui se construit par l'expérience protège toujours avec un incident de retard.
 *
 * Elle couvre maintenant tout ce qui est un REGISTRE : des lignes qu'on ajoute, qu'on corrige, et
 * qu'on ne retire qu'une par une. Deux absentes volontaires :
 *
 * — `users`, traité juste en dessous par comptesDeLEquipe et preserverIdentifiants, qui vont plus
 *   loin que cette union : ils protègent aussi les mots de passe et les droits ligne par ligne ;
 * — `messagesWhatsApp`, qui est un journal PLAFONNÉ à trois cents entrées. L'ajout d'un message
 *   en fait légitimement sortir un ancien ; le protéger ici ferait grossir la liste sans fin.
 */
const COLLECTIONS_PROTEGEES = [
  "colis", "clientAccounts", "repertoire", "depenses",
  "bordereaux", "facturesPartenaire", "preAlertes", "remisesCaisse", "voyages",
  "pointages", "factures", "demandesRegroupement", "paiementsCommission",
  "categories", "sites", "departs", "desabonnesMarketing",
];
/*
 * Le seuil ne porte pas sur la TAILLE de la liste, mais sur ce qu'une seule écriture emporte.
 *
 * Un premier essai gardait les listes d'au moins cinq entrées — et laissait donc filer les trois
 * comptes clients et les quatre dépenses, c'est-à-dire une partie exacte de ce qui a été perdu le
 * 26 août. La taille ne dit rien : ce qui compte est que chaque suppression, dans l'application,
 * est un enregistrement. Deux disparitions d'un coup, ce sont déjà deux gestes en un.
 */
const PERTE_TOLEREE = 1;
/* L'intention vaut pour le geste qui vient d'être fait, pas pour un onglet ouvert ce matin. */
const FENETRE_INTENTION_MS = 10 * 60 * 1000;

export const CHAMP_INTENTION = "_remplacementVolontaire";

/*
 * Le champ par lequel l'application dit qu'elle réabonne quelqu'un. Il ne s'installe jamais dans le
 * document : le laisser s'y écrire ferait réabonner à chaque enregistrement suivant.
 */
export const CHAMP_REABONNEMENTS = "_reabonnements";

/** Voir la même règle dans api/whatsapp-entrant.js : le « 00 » de tête vaut le « + ». */
const clefDuTelephone = (telephone) => String(telephone || "").replace(/\D/g, "").replace(/^00/, "");

/** Le document envoyé porte-t-il une intention de remplacement, et est-elle fraîche ? */
export function intentionDeRemplacement(envoye, maintenant = Date.now()) {
  const marque = envoye?.[CHAMP_INTENTION];
  if (!marque || typeof marque !== "object") return false;
  const quand = Date.parse(marque.le || "");
  if (!Number.isFinite(quand)) return false;
  const ecart = Math.abs(maintenant - quand);
  return ecart <= FENETRE_INTENTION_MS;
}

/**
 * Les collections que cette écriture ferait fondre.
 *
 * Rend la liste des noms à préserver — vide quand tout va bien, ce qui est le cas ordinaire.
 */
export function collectionsQuiFondent(base, envoye) {
  const perdues = [];
  for (const cle of COLLECTIONS_PROTEGEES) {
    const avant = base?.[cle];
    if (!Array.isArray(avant) || avant.length === 0) continue;
    /*
     * UNE CLÉ ABSENTE N'EST PAS UNE CLÉ VIDÉE, ET LA CONFONDRE A FAIT PEUR POUR RIEN.
     *
     * Une écriture qui ne parle pas d'une collection la laisse telle quelle : la fusion la
     * reprend de la base, quelques lignes plus haut, et il ne s'est jamais rien passé. Elle était
     * pourtant comptée ici comme « 343 → 0 », et l'écran annonçait à l'agent que son répertoire
     * avait failli disparaître à chaque enregistrement. Le garde-fou criait à la place d'un
     * silence.
     */
    if (!Object.prototype.hasOwnProperty.call(envoye || {}, cle)) continue;
    const apres = envoye?.[cle];
    const compte = Array.isArray(apres) ? apres.length : 0;
    const perdus = avant.length - compte;
    /*
     * VIDER UNE COLLECTION D'UN COUP N'EST PAS UN GESTE — quelle que soit sa taille.
     *
     * La règle de la moitié laissait passer les petites listes : trois comptes clients ramenés à
     * zéro, c'est bien « moins de la moitié », mais c'est aussi trois disparitions pour une seule
     * écriture. Une page qui propose zéro là où la base en a est une page qui ne les a jamais
     * eues : elle ne demande pas une suppression, elle ignore qu'elles existent.
     *
     * Retirer LA DERNIÈRE entrée reste possible, comme retirer n'importe quelle entrée seule :
     * une suppression à la fois est un geste, et c'est la seule façon dont l'application supprime.
     * Un vrai vidage en masse passe, lui, par l'intention datée.
     */
    /*
     * LA RÈGLE DE LA MOITIÉ LAISSAIT PASSER LA MOITIÉ DES PERTES — au sens propre.
     *
     * Il fallait AUSSI qu'il reste moins de la moitié de la liste pour qu'une écriture soit
     * retenue. Autrement dit : perdre 48 % d'une collection d'un seul coup passait sans un mot.
     * Les catégories de produits sont ainsi tombées de 58 à 42 — seize disparues, mais 42 font
     * plus que la moitié de 58, donc rien ne s'est déclenché, ni ici ni dans la base.
     *
     * Le nombre restant ne dit rien de l'intention ; seul le nombre PERDU en dit quelque chose.
     * Dans cette application, une suppression est un geste, et un geste retire une ligne : c'est
     * vrai du colis, de la dépense, du compte client, de la catégorie. Deux lignes qui partent
     * ensemble, ce sont donc deux gestes en un — ou, bien plus probablement, une page qui ne les
     * avait jamais vues.
     *
     * Une vraie suppression en masse — réinitialiser, restaurer, importer — passe par l'intention
     * datée, et n'arrive jamais ici.
     */
    // Une collection existante ne peut jamais devenir vide par une écriture ordinaire.
    // Une remise à zéro légitime doit porter CHAMP_INTENTION, contrôlé avant cet appel.
    if (compte === 0 || perdus > PERTE_TOLEREE) perdues.push({ cle, avant: avant.length, apres: compte });
  }
  return perdues;
}

/*
 * L'IDENTITÉ D'UNE LIGNE — la même notion que dans src/lib/storage.js.
 *
 * Un colis se reconnaît à son numéro de suivi, un compte ou une dépense à son identifiant. Sans
 * cela on ne saurait pas dire si deux lignes sont la même, et l'on ne pourrait que compter.
 */
const CLES_IDENTITE = ["id", "tracking", "numero", "cle", "key"];
function identiteLigne(element) {
  if (!element || typeof element !== "object" || Array.isArray(element)) return null;
  const cle = CLES_IDENTITE.find((k) => typeof element[k] === "string" || typeof element[k] === "number");
  return cle ? `${cle}:${element[cle]}` : null;
}

/**
 * Réunit une collection : ce que la page envoie, PLUS ce qu'elle a laissé tomber.
 *
 * C'est la réponse à « refuser l'écriture conflictuelle sans jeter le travail ». Rendre purement
 * et simplement la version de la base annulait aussi ce que l'agent venait de saisir : le colis
 * qu'il ajoutait dans le même enregistrement disparaissait avec le refus. Ici, ses lignes à lui
 * sont gardées telles qu'il les a écrites, et celles qu'il ne connaissait pas reviennent à leur
 * place. Une page périmée ne peut donc plus rien SUPPRIMER — mais tout ce qu'elle ajoute ou
 * corrige aboutit.
 *
 * Les lignes sans identité (rien à quoi les reconnaître) ne se réunissent pas : on garde alors la
 * base, seule version dont on soit sûr.
 */
export function unirParIdentite(lignesBase, lignesEnvoyees) {
  const base = liste(lignesBase);
  const envoyees = liste(lignesEnvoyees);
  if (!base.every((x) => identiteLigne(x)) || !envoyees.every((x) => identiteLigne(x))) return base;
  const vues = new Set(envoyees.map(identiteLigne));
  const manquantes = base.filter((x) => !vues.has(identiteLigne(x)));
  return [...envoyees, ...manquantes];
}

/*
 * Le nombre d'alertes d'écrasement conservées. Elles servent à comprendre ce qui s'est passé et à
 * aller fermer l'onglet fautif : au-delà d'une vingtaine, elles ne racontent plus rien de neuf.
 */
export const MAX_ALERTES_ECRASEMENT = 20;

/**
 * Réunit les alertes d'écrasement de la base et celles renvoyées par la page.
 *
 * La base fait foi sur le contenu — une page ne réécrit pas une alerte qui la concerne. Elle a en
 * revanche le droit de la marquer comme lue : c'est le seul geste qu'on lui laisse, et c'est celui
 * qui fait disparaître le bandeau une fois l'onglet fautif fermé.
 */
export function reunirAlertesEcrasement(alertesBase, alertesEnvoyees) {
  const vues = new Set(
    (Array.isArray(alertesEnvoyees) ? alertesEnvoyees : [])
      .filter((a) => a && a.vue && a.id).map((a) => a.id),
  );
  return (Array.isArray(alertesBase) ? alertesBase : [])
    .filter((a) => a && a.id)
    .map((a) => (vues.has(a.id) ? { ...a, vue: true } : a));
}

/**
 * Le document réel, augmenté de ce qu'un membre de l'équipe avait le droit de changer.
 *
 * `contexte` porte de quoi nommer l'appareil fautif dans l'alerte ({ appareil, adresse }) — sans
 * lui, l'alerte dirait qu'un enregistrement a été refusé sans dire d'où il venait, et il n'y
 * aurait rien à aller fermer.
 */
/**
 * CE COMPTE REÇOIT-IL UNE VUE RÉDUITE À SA ZONE ?
 *
 * Une seule fonction répond, et la lecture comme l'écriture s'y réfèrent : deux réponses
 * différentes ici, et le serveur rendrait moins que ce qu'il accepte de réécrire — c'est-à-dire
 * qu'il effacerait la différence à chaque enregistrement.
 *
 * TROIS FAÇONS DE TOUT VOIR, et « Voir tous les colis » en est une.
 *
 * Cette permission existe, elle s'affiche dans l'écran des droits, et l'administrateur l'accorde.
 * Elle n'était pourtant lue nulle part ici : l'agent à qui on venait de la donner continuait de
 * ne voir que son agence, sans que rien n'explique pourquoi. Une permission accordée qui ne
 * change rien est pire que pas de permission du tout — personne ne cherche l'erreur là où le
 * réglage dit que c'est bon.
 */
export function estFiltreParZone(document, compteId) {
  const moi = liste(document?.users).find((u) => u && u.id === compteId);
  if (!moi) return false;
  if (moi.role === "Administrateur" || moi.role === "Comptable") return false;
  if (effectivePermission(moi, "colis.voir_tous")) return false;
  return true;
}

/**
 * Vue opérationnelle d'une zone pour les comptes internes non administrateurs.
 * Le filtrage se fait côté serveur : masquer un menu côté navigateur ne suffit pas.
 * Les colis sans site restent visibles afin de ne pas rendre une donnée orpheline introuvable.
 */
export function vueEquipeZone(donnees, compteId) {
  if (!donnees || typeof donnees !== "object" || Array.isArray(donnees)) return donnees;
  if (!estFiltreParZone(donnees, compteId)) return donnees;
  const moi = liste(donnees.users).find((u) => u && u.id === compteId);
  const zone = String(moi.zoneOperation || moi.agence || "").trim().toLowerCase();
  const pays = String(moi.paysOperation || "").trim().toUpperCase();
  if (!zone) return { ...donnees, users: liste(donnees.users).filter((u) => u && u.id === compteId) };
  const dansZone = (x) => {
    if (!x) return false;
    const valeur = String(x.site || x.agence || x.zoneOperation || "").trim();
    return !valeur || valeur.toLowerCase() === zone;
  };
  const colis = liste(donnees.colis).filter((c) => dansZone(c) && (!pays || !c.expediteurPays || c.expediteurPays === pays));
  const tracks = new Set(colis.map((c) => c.tracking).filter(Boolean));
  const bordereaux = liste(donnees.bordereaux).filter((b) => liste(b.colisTrackings).some((t) => tracks.has(t)) || String(b.site || "").trim().toLowerCase() === zone);
  const bordereauIds = new Set(bordereaux.map((b) => b.id).filter(Boolean));
  const depenses = liste(donnees.depenses).filter((d) =>
    (d.bordereauId && bordereauIds.has(d.bordereauId)) || String(d.bordereauNumero || "").trim() && bordereaux.some((b) => String(b.numero) === String(d.bordereauNumero))
    || String(d.agence || d.site || "").trim().toLowerCase() === zone,
  );
  const users = liste(donnees.users).filter((u) => u && (u.id === compteId || String(u.zoneOperation || u.agence || "").trim().toLowerCase() === zone));
  const clients = liste(donnees.clientAccounts).filter((c) =>
    colis.some((x) => x.clientAccountId === c.id)
    || String(c.zoneOperation || c.agence || "").trim().toLowerCase() === zone,
  );
  const clientIds = new Set(clients.map((c) => c.id).filter(Boolean));
  const idsEquipe = new Set(users.map((u) => u.id).filter(Boolean));
  const vue = {};
  SECTIONS_PARTAGEES.forEach((cle) => { if (donnees[cle] !== undefined) vue[cle] = donnees[cle]; });
  vue.colis = colis;
  vue.bordereaux = bordereaux;
  vue.depenses = depenses;
  vue.users = users;
  vue.clientAccounts = clients;
  vue.preAlertes = liste(donnees.preAlertes).filter((x) => clientIds.has(x?.clientAccountId));
  vue.demandesRegroupement = liste(donnees.demandesRegroupement).filter((x) => clientIds.has(x?.clientAccountId));
  vue.remisesCaisse = liste(donnees.remisesCaisse).filter((x) => idsEquipe.has(x?.agentId) || String(x?.agence || "").trim().toLowerCase() === zone);
  vue.pointages = liste(donnees.pointages).filter((x) => idsEquipe.has(x?.userId) || String(x?.agence || "").trim().toLowerCase() === zone);
  vue.factures = liste(donnees.factures).filter((f) => liste(f?.trackings).some((t) => tracks.has(t)) || String(f?.agence || "").trim().toLowerCase() === zone);
  vue.activityLog = liste(donnees.activityLog).filter((e) => idsEquipe.has(e?.userId) || String(e?.agence || "").trim().toLowerCase() === zone);
  vue.messagesWhatsApp = liste(donnees.messagesWhatsApp).filter((m) => tracks.has(m?.tracking) || clientIds.has(m?.clientAccountId));
  return vue;
}

/**
 * Rend à l'écriture d'un compte de zone tout ce qu'il n'avait pas le droit de voir.
 *
 * Le principe tient en une phrase : CE QU'IL NE VOYAIT PAS, IL NE PEUT PAS L'AVOIR SUPPRIMÉ.
 * On recalcule donc ce que la lecture lui avait montré, et l'on remet en place toute ligne de la
 * base qui n'y figurait pas. Ses propres gestes restent entiers — il ajoute, corrige et supprime
 * dans sa zone exactement comme avant.
 *
 * Sans cela, l'accident du 1er septembre était inévitable : l'agente de Conakry recevait un
 * document sans les comptes clients des autres zones, sans le répertoire et sans les dépenses,
 * et le renvoyait tel quel à chaque enregistrement — « clientAccounts : 8 → 0 ».
 */
export function reconstituerHorsZone(base, envoye, compteId) {
  if (!estFiltreParZone(base, compteId)) return envoye;
  const vueLue = vueEquipeZone(base, compteId);
  const sortie = { ...envoye };
  Object.keys(base).forEach((cle) => {
    /* Les comptes et le journal ont déjà leur propre règle, plus fine que celle-ci. */
    if (cle === "users" || cle === "activityLog") return;
    if (!Array.isArray(base[cle]) || !Array.isArray(envoye?.[cle])) return;
    const visibles = new Set(liste(vueLue?.[cle]).map(identiteLigne).filter(Boolean));
    const invisibles = base[cle].filter((x) => {
      const id = identiteLigne(x);
      /* Une ligne sans identité ne se rattache à rien : on la garde plutôt que de la perdre. */
      return !id || !visibles.has(id);
    });
    if (invisibles.length) sortie[cle] = unirParIdentite(invisibles, envoye[cle]);
  });
  return sortie;
}

export function fusionnerEcritureEquipe(actuel, propose, compteId, contexte = {}) {
  const base = actuel && typeof actuel === "object" && !Array.isArray(actuel) ? actuel : {};
  const recu = propose && typeof propose === "object" && !Array.isArray(propose) ? propose : {};
  const moi = liste(base.users).find((u) => u && u.id === compteId);
  if (!moi) return base;
  const peut = (cle) => effectivePermission(moi, cle);
  /*
   * D'ABORD, RENDRE CE QUE LA LECTURE AVAIT RETIRÉ.
   *
   * Un compte de zone n'a jamais reçu le document entier : le lui laisser réécrire tel quel
   * effacerait les autres zones à chaque enregistrement. Tout ce qui suit travaille donc sur une
   * écriture déjà complétée — les garde-fous d'après n'ont ainsi plus rien d'anormal à voir.
   */
  const envoye = reconstituerHorsZone(base, recu, compteId);

  const sortie = { ...envoye };

  /*
   * UNE SECTION ABSENTE N'EST PAS UNE SECTION SUPPRIMÉE.
   *
   * Constaté en production le 27 août 2026 : les fiches de pointage de toute l'équipe ont disparu
   * du document. Elles étaient là dans la sauvegarde de la nuit, plus là le soir. Personne ne les
   * avait effacées — personne n'a de bouton pour cela.
   *
   * Le mécanisme : cette fusion part de CE QUE LE NAVIGATEUR ENVOIE. Un appareil dont la page
   * était ouverte avant que les pointages n'existent, ou dont le cache local datait d'avant,
   * envoie un document où la clé `pointages` ne figure tout simplement pas. Toutes les sections
   * protégées plus bas le sont par une permission ; un administrateur les a toutes, donc rien ne
   * le retenait. Son moindre enregistrement — corriger un téléphone — emportait la section
   * entière, sans un mot.
   *
   * C'est exactement la faute qui avait effacé deux mots de passe clients en août, et la règle est
   * la même : NE PAS PARLER D'UNE CHOSE N'EST PAS DEMANDER SA SUPPRESSION. Une clé absente est
   * donc reprise de la base. Une clé présente mais vide, elle, est respectée : vider une liste est
   * un geste, l'omettre n'en est pas un.
   */
  Object.keys(base).forEach((cle) => {
    if (!Object.prototype.hasOwnProperty.call(envoye, cle)) sortie[cle] = base[cle];
  });

  /*
   * Le garde-fou, avant tout le reste.
   *
   * L'intention ne survit jamais dans le document : elle vaut pour cette écriture-ci, et c'est
   * tout. La laisser s'y installer reviendrait à donner à toutes les pages ouvertes un
   * laissez-passer permanent.
   */
  const deliberee = intentionDeRemplacement(envoye);
  delete sortie[CHAMP_INTENTION];
  const fondues = deliberee ? [] : collectionsQuiFondent(base, envoye);
  /*
   * ON NE REND PLUS LA COLLECTION ENTIÈRE : ON LA RÉUNIT.
   *
   * Reposer la version de la base annulait aussi ce que l'agent venait de saisir — le colis
   * ajouté dans le même enregistrement partait avec le refus, et il ne lui restait qu'un message.
   * Désormais ses lignes sont gardées, et celles qu'il ne connaissait pas reviennent à leur
   * place : une page périmée ne peut plus rien supprimer, mais tout ce qu'elle apporte aboutit.
   */
  fondues.forEach(({ cle }) => { sortie[cle] = unirParIdentite(base[cle], envoye[cle]); });

  /*
   * DEUX AGENTS DANS LA MÊME SECONDE — le cas que rien ne voyait.
   *
   * A et B ont chargé la même version. A enregistre son colis ; B enregistre le sien une
   * demi-seconde plus tard, sur une copie d'AVANT celui de A. Il y a autant de colis des deux
   * côtés : aucun compte ne bouge, aucun garde-fou ne se déclenche — et le colis de A disparaît
   * en silence. C'est arrivé, et rien dans l'application n'aurait pu le montrer.
   *
   * Quand `contexte.conflit` dit que la page a écrit sur une version dépassée, aucune ligne ne
   * peut plus disparaître : ce que la page ignore revient à sa place, ce qu'elle apporte est
   * gardé. Sans bruit, ni journal, ni alerte — deux agents qui travaillent en même temps, c'est
   * la vie normale d'une agence, pas un incident.
   */
  if (contexte?.conflit && !deliberee) {
    COLLECTIONS_PROTEGEES.forEach((cle) => {
      if (!Array.isArray(base?.[cle]) || base[cle].length === 0) return;
      if (!Object.prototype.hasOwnProperty.call(envoye || {}, cle)) return;
      sortie[cle] = unirParIdentite(base[cle], envoye[cle]);
    });
  }

  /*
   * LE JOURNAL DES ACCÈS NE SE RÉÉCRIT JAMAIS DEPUIS UN NAVIGATEUR.
   *
   * Il consigne les entrées — dont celles qu'on n'a pas faites soi-même. Le laisser réécrire par
   * la page reviendrait à laisser effacer la trace de sa propre visite, et un journal qu'on peut
   * effacer ne prouve rien. Seul api/login.js y ajoute, ligne à ligne.
   */
  if (base.journalAcces === undefined) delete sortie.journalAcces;
  else sortie.journalAcces = base.journalAcces;

  SECTIONS_REGLAGES.forEach(([cle, permission]) => {
    if (!peut(permission)) {
      if (base[cle] === undefined) delete sortie[cle];
      else sortie[cle] = base[cle];
      return;
    }
    /*
     * UN CHAMP DE RÉGLAGE QUE LA PAGE NE CONNAÎT PAS N'EST PAS UN CHAMP EFFACÉ.
     *
     * C'est la règle des sections absentes, appliquée un cran plus bas. Le numéro RCCM avait été
     * réglé un matin ; une page ouverte AVANT, qui ne l'avait donc jamais reçu, a renvoyé son
     * bloc « entreprise » sans lui — et le numéro a disparu de la base sans que personne ne
     * l'efface. Le même sort attendait n'importe quel réglage ajouté pendant qu'un onglet reste
     * ouvert quelque part.
     *
     * Ce que la page envoie fait foi sur ce dont elle parle ; ce dont elle ne parle pas revient de
     * la base. Vider un champ à la main reste possible : il est alors présent, et vide.
     */
    const avant = base[cle];
    const apres = sortie[cle];
    if (!avant || typeof avant !== "object" || Array.isArray(avant)) return;
    if (!apres || typeof apres !== "object" || Array.isArray(apres)) return;
    const complete = completerChampsManquants(avant, apres);
    if (complete !== apres) sortie[cle] = complete;
  });

  sortie.users = preserverIdentifiants(base.users, comptesDeLEquipe(base, envoye, moi, peut));
  /*
   * Le rattrapage des lignes hors zone se fait tout en haut, par `reconstituerHorsZone` : il part
   * de ce que la LECTURE avait réellement montré à ce compte, et non d'une devinette sur le nom de
   * son agence. Un premier essai le faisait ici, à partir du champ `site` de chaque ligne, et pour
   * toute personne ayant une agence — même celles qui reçoivent le document entier. Elles ne
   * pouvaient alors plus rien supprimer hors de leur agence, sans un mot d'explication.
   */
  /*
   * Les comptes clients ne passent par aucun tamis — l'équipe les gère entièrement. Ils ont donc
   * besoin de la même protection, et ce sont eux qui l'ont payée : deux des trois comptes clients
   * de la base n'avaient plus de mot de passe.
   */
  if (sortie.clientAccounts !== undefined) {
    sortie.clientAccounts = preserverIdentifiants(base.clientAccounts, sortie.clientAccounts);
  }

  /*
   * Le journal ne se réécrit pas, il s'ajoute.
   *
   * C'est lui qui garde trace de qui a encaissé, annulé, supprimé. Le laisser réécrire à celui-là
   * même dont il consigne les gestes reviendrait à ne rien consigner du tout. L'auteur est
   * réinscrit depuis le compte de la session, pour la même raison.
   */
  const anciens = liste(base.activityLog);
  const dejaLa = new Set(anciens.map((e) => e && e.id).filter(Boolean));
  const signature = signatureDe(moi);
  const ajouts = liste(envoye.activityLog)
    .filter((e) => e && e.id && !dejaLa.has(e.id))
    .slice(0, MAX_ENTREES_JOURNAL)
    /*
     * La DATE aussi vient du serveur, comme l'auteur et le rôle.
     *
     * Elle arrivait du navigateur, où elle se change en une ligne. Une entrée antidatée se range
     * au milieu de la liste et cesse d'être lue : on n'a rien effacé, on a seulement fait en sorte
     * que personne ne regarde. L'heure du serveur ne se négocie pas.
     */
    .map((e) => ({ ...e, utilisateur: signature, role: moi.role, date: new Date().toISOString() }));
  /*
   * Un refus se consigne. Sans cela, l'appareil fautif continuerait d'essayer à chaque
   * enregistrement, et personne ne saurait qu'une page périmée tourne quelque part — jusqu'au jour
   * où elle passe. C'est la trace qui permet d'aller la fermer.
   */
  /*
   * LE JOURNAL DIT MAINTENANT CE QUI S'EST RÉELLEMENT PASSÉ.
   *
   * « Enregistrement refusé » était faux, et cette inexactitude a coûté une frayeur : rien
   * n'était refusé — le colis, l'encaissement, le changement de statut de la même écriture
   * étaient bel et bien enregistrés. Seules les DISPARITIONS proposées étaient écartées. Un
   * responsable qui lit « refusé » croit son travail perdu et le refait.
   */
  const refus = fondues.length === 0 ? [] : [{
    id: `garde-${Date.now()}`,
    date: new Date().toISOString(),
    action: "Suppressions écartées — page incomplète",
    detail: `${fondues.map(({ cle, avant, apres }) => `${cle} : ${avant} → ${apres}`).join(" · ")}`
      + " · lignes rétablies, le reste de l’enregistrement est bien passé",
    utilisateur: signature,
    role: moi.role,
  }];
  /*
   * LE JOURNAL NE SE COUPE PLUS À CINQ CENTS LIGNES.
   *
   * Il l'était, et la coupe JETAIT. Au 4 septembre 2026 il en comptait quatre cent soixante-quinze :
   * vingt-cinq de plus et les plus anciennes disparaissaient, sans un mot. Or c'est lui qui dit qui
   * a encaissé, qui a annulé, qui a supprimé — il n'a de valeur que s'il remonte plus loin que le
   * souvenir des gens.
   *
   * C'était aussi une porte. Vingt lignes sont acceptées par enregistrement : vingt-cinq
   * enregistrements de suite repoussaient dehors tout ce qui précédait. Effacer la trace d'un geste
   * ne demandait pas de la modifier — il suffisait de travailler un moment.
   *
   * Le plafond d'ici ne sert plus qu'à borner un emballement le temps d'une écriture. Ce qui
   * dépasse durablement n'est pas jeté : la tâche de nuit le dépose dans une archive par mois
   * (api/_journal.js), et l'on n'en perd rien.
   */
  sortie.activityLog = [...refus, ...ajouts, ...anciens].slice(0, MAX_JOURNAL_EN_LIGNE);

  /*
   * L'alerte d'écrasement — la trace que quelqu'un doit VOIR, pas seulement retrouver.
   *
   * Le journal consigne le refus, mais personne ne lit le journal à l'heure où l'accident se
   * produit. Cette liste-ci est celle que l'application affiche en bandeau rouge, et celle que le
   * serveur transforme en courriel immédiat au responsable. Elle nomme le compte et l'appareil :
   * sans cela on saurait qu'une page périmée tourne, sans savoir laquelle aller fermer.
   */
  const alertesBase = liste(base.alertesEcrasement);
  const alertes = reunirAlertesEcrasement(alertesBase, envoye.alertesEcrasement);
  if (fondues.length) {
    alertes.unshift({
      id: `ecrasement-${Date.now()}`,
      le: new Date().toISOString(),
      compte: signature,
      compteId: moi.id,
      role: moi.role,
      collections: fondues,
      appareil: typeof contexte?.appareil === "string" ? contexte.appareil.slice(0, 300) : "",
      adresse: typeof contexte?.adresse === "string" ? contexte.adresse.slice(0, 60) : "",
      /* Deux causes bien différentes à distinguer : une page incomplète, ou deux agents en même temps. */
      conflit: !!contexte?.conflit,
      vue: false,
    });
  }
  if (alertes.length) sortie.alertesEcrasement = alertes.slice(0, MAX_ALERTES_ECRASEMENT);
  else delete sortie.alertesEcrasement;

  /*
   * Les messages WhatsApp entrants ne se réécrivent pas non plus.
   *
   * Ils n'arrivent pas de l'application mais du serveur, poussés par Meta à n'importe quel
   * moment — y compris pendant qu'un agent a la page ouverte. Sa copie du document ne les
   * contient donc pas, et sans cette réunion son prochain enregistrement les effacerait : le
   * client aurait écrit, et son message aurait disparu avant d'être lu. On réunit les deux
   * listes par identifiant, en laissant l'application décider de ce qui est lu et de ce qu'elle
   * a répondu.
   */
  /*
   * LES DÉSABONNÉS NE SE PERDENT PAS PAR OMISSION.
   *
   * Depuis que le serveur inscrit lui-même un client qui répond STOP (api/whatsapp-entrant.js),
   * cette liste grandit sans que les pages ouvertes le sachent. Sans la réunion ci-dessous, le
   * premier enregistrement venu d'un onglet un peu ancien effacerait un désabonnement pris entre
   * temps — et l'on réécrirait à quelqu'un qui a demandé l'arrêt. C'est précisément ce qui fait
   * signaler un numéro chez Meta, et restreindre la ligne pour tout le monde.
   *
   * Réabonner reste possible, mais jamais par omission : l'application doit le DIRE, en envoyant
   * les numéros concernés dans `reabonnements`. Ce champ ne s'écrit jamais dans le document — il
   * vaut pour cette écriture-ci, comme l'intention de remplacement.
   */
  const desabonnesBase = liste(base.desabonnesMarketing);
  const desabonnesEnvoyes = liste(envoye.desabonnesMarketing);
  const reabonnes = new Set(liste(envoye[CHAMP_REABONNEMENTS]).map(clefDuTelephone).filter(Boolean));
  delete sortie[CHAMP_REABONNEMENTS];
  if (desabonnesBase.length || desabonnesEnvoyes.length) {
    const parClef = new Map();
    [...desabonnesBase, ...desabonnesEnvoyes].forEach((t) => {
      const clef = clefDuTelephone(t);
      if (clef && !reabonnes.has(clef)) parClef.set(clef, t);
    });
    sortie.desabonnesMarketing = [...parClef.values()];
  }

  const messagesBase = liste(base.messagesWhatsApp);
  const messagesEnvoyes = liste(envoye.messagesWhatsApp);
  if (messagesBase.length || messagesEnvoyes.length) {
    const parId = new Map();
    messagesBase.forEach((m) => { if (m && m.id) parId.set(m.id, m); });
    messagesEnvoyes.forEach((m) => { if (m && m.id) parId.set(m.id, { ...parId.get(m.id), ...m }); });
    sortie.messagesWhatsApp = [...parId.values()]
      .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
      .slice(0, 300);
  }

  /*
   * Les accusés de réception non plus : c'est le webhook qui les écrit, pas l'application.
   * Un agent dont la page est ouverte depuis dix minutes renverrait sinon un document où le
   * message parti tout à l'heure n'a jamais été remis.
   */
  const accusesBase = base.statutsWhatsApp && typeof base.statutsWhatsApp === "object" ? base.statutsWhatsApp : null;
  const accusesEnvoyes = envoye.statutsWhatsApp && typeof envoye.statutsWhatsApp === "object" ? envoye.statutsWhatsApp : null;
  if (accusesBase || accusesEnvoyes) sortie.statutsWhatsApp = { ...accusesEnvoyes, ...accusesBase };

  /*
   * Le relevé des appels du webhook appartient au serveur seul.
   *
   * C'est lui qui répond à « Meta appelle-t-il vraiment cette adresse ? ». Une page ouverte avant
   * le premier appel le renverrait absent, et le Centre clients se remettrait à dire qu'il n'a
   * jamais rien reçu — en effaçant précisément la preuve du contraire.
   */
  if (base.receptionWhatsApp !== undefined) sortie.receptionWhatsApp = base.receptionWhatsApp;
  else delete sortie.receptionWhatsApp;

  /*
   * Le compte rendu de la sauvegarde de nuit appartient au serveur, pour la même raison.
   *
   * C'est lui qui répond à « la sauvegarde a-t-elle bien eu lieu cette nuit ? ». Une page ouverte
   * avant le passage de la tâche le renverrait absent, et l'écran se remettrait à dire qu'aucune
   * sauvegarde n'existe — en effaçant la preuve du contraire. Un relevé de surveillance qu'on
   * peut effacer par accident ne surveille rien.
   */
  if (base.veille !== undefined) sortie.veille = base.veille;
  else delete sortie.veille;

  return sortie;
}
