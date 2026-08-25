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
const CHAMPS_COMPTE_MODIFIABLES = [
  "telephone", "adresse", "email", "messages", "derniereVisite",
  "motdepasseSecure", "motdepasseSalt", "motdepasseIter", "motdepasseAlgo",
];

function liste(valeur) {
  return Array.isArray(valeur) ? valeur : [];
}

function sans(objet, champs) {
  if (!objet || typeof objet !== "object") return objet;
  const sortie = { ...objet };
  champs.forEach((c) => { delete sortie[c]; });
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
      if (envoyeCompte[champ] !== undefined) retenu[champ] = envoyeCompte[champ];
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
      if (Array.isArray(envoyeU.partenaireMessages)) retenu.partenaireMessages = envoyeU.partenaireMessages;
      users.push(retenu);
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
      users.push({ ...retenu, role: "Partenaire", partenaireParent: partenaireId });
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
  const activityLog = [...ajouts, ...liste(base.activityLog)].slice(0, 500);

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
const CHAMPS_DE_POUVOIR = ["role", "permissionsOverride", "paysAutorises", "agence", "partenaireParent"];

/*
 * Les sections de réglages, et la permission qu'il faut pour y toucher — les mêmes que celles qui
 * ouvrent les écrans correspondants, pour qu'un geste possible à l'écran ne soit jamais refusé
 * par le serveur, ni l'inverse.
 */
const SECTIONS_REGLAGES = [
  ["branding", "config.acceder"],
  ["entreprise", "config.acceder"],
  ["sites", "config.acceder"],
  ["agencesReception", "config.acceder"],
  ["agenceRetraitClient", "config.acceder"],
  ["departs", "config.acceder"],
  ["notificationSettings", "config.acceder"],
  ["notifWhatsApp", "config.acceder"],
  ["miraKnowledge", "config.acceder"],
  ["exchangeRates", "config.tarifs"],
  ["tauxMisAJourLe", "config.tarifs"],
  ["commissionConfig", "config.tarifs"],
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
];

/** Le rôle le plus modeste : celui qu'on donne quand on n'a pas le droit d'en choisir un. */
const ROLE_LE_PLUS_MODESTE = "Chauffeur";

function signatureDe(compte) {
  return `${compte.prenom || ""} ${compte.nom || ""}`.trim() || compte.identifiant || "Compte";
}

function comptesDeLEquipe(base, envoye, moi, peut) {
  const gere = peut("users.gerer");
  const droitsDesAutres = peut("users.permissions");
  const envoyesParId = new Map();
  liste(envoye.users).forEach((u) => { if (u && u.id) envoyesParId.set(u.id, u); });
  /* Même prudence que pour les partenaires : une liste qui ne contient même pas sa propre fiche
   * n'est pas une suppression de toute l'équipe, c'est un envoi incomplet. */
  const peutSupprimer = gere && envoyesParId.has(moi.id);

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

    if (!gere) { sortie.push(u); return; }
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
  return sortie;
}

/**
 * Le document réel, augmenté de ce qu'un membre de l'équipe avait le droit de changer.
 *
 * Un compte introuvable dans la base ne peut rien : on rend le document tel qu'il est plutôt que
 * de deviner à quels droits il pourrait bien prétendre.
 */
export function fusionnerEcritureEquipe(actuel, propose, compteId) {
  const base = actuel && typeof actuel === "object" && !Array.isArray(actuel) ? actuel : {};
  const envoye = propose && typeof propose === "object" && !Array.isArray(propose) ? propose : {};
  const moi = liste(base.users).find((u) => u && u.id === compteId);
  if (!moi) return base;
  const peut = (cle) => effectivePermission(moi, cle);

  const sortie = { ...envoye };

  SECTIONS_REGLAGES.forEach(([cle, permission]) => {
    if (peut(permission)) return;
    if (base[cle] === undefined) delete sortie[cle];
    else sortie[cle] = base[cle];
  });

  sortie.users = comptesDeLEquipe(base, envoye, moi, peut);

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
    .map((e) => ({ ...e, utilisateur: signature, role: moi.role }));
  sortie.activityLog = [...ajouts, ...anciens].slice(0, 500);

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

  return sortie;
}
