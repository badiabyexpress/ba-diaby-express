/**
 * Fonction serverless Vercel — vérification de la connexion côté serveur.
 *
 * POURQUOI CE FICHIER
 * -------------------
 * L'application vérifie aujourd'hui les mots de passe dans le navigateur : pour cela, elle doit
 * d'abord télécharger la liste des comptes — empreintes de mots de passe comprises — avec la clé
 * publique Supabase. Cette clé étant présente dans le code envoyé à chaque visiteur, l'écran de
 * connexion ne protège rien : on peut interroger la base sans jamais le voir.
 *
 * Cette fonction déplace la vérification côté serveur. Elle lit les comptes avec la CLÉ DE SERVICE
 * (qui ne quitte jamais le serveur), compare l'empreinte, et renvoie le compte débarrassé de tout
 * ce qui touche au mot de passe, accompagné d'un jeton de session. C'est ce jeton qui ouvre
 * api/donnees.js — et donc ce qui permettra à l'application de continuer à travailler le jour où
 * la base sera fermée à la clé publique.
 *
 * VARIABLES D'ENVIRONNEMENT À CRÉER SUR VERCEL (Supabase → Settings → API)
 * -----------------------------------------------------------------------
 *   SUPABASE_URL                 adresse du projet (à défaut VITE_SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY    clé de service — SECRET, ne jamais exposer au navigateur
 *
 * Aucune ne commence par VITE_ : ce préfixe les enverrait au navigateur, ce qui annulerait
 * l'intérêt de la manœuvre.
 *
 * SUPABASE_JWT_SECRET reste acceptée mais n'est plus nécessaire : elle ne sert qu'au jeton
 * destiné à Supabase lui-même, une piste abandonnée faute de pouvoir trouver ce secret dans les
 * interfaces récentes (voir api/_session.js).
 *
 * TANT QUE CES VARIABLES N'EXISTENT PAS, la fonction répond 501 et l'application retombe
 * automatiquement sur son fonctionnement actuel. Elle peut donc être mise en ligne sans risque,
 * avant même que la configuration soit faite.
 */

import crypto from "node:crypto";
import {
  signerSession, empreinteDuCompte, signerDefi, verifierDefi, sessionDeLaRequete,
} from "./_session.js";
import {
  genererSecret, verifierCode, uriInscription, CHAMPS_TOTP_SECRETS,
  genererCodesSecours, empreintesDesCodes, verifierSecours, codesSecoursRestants,
} from "./_totp.js";
import { passage, adresseDe, refuser } from "./_verrou.js";
import {
  entreeAcces, inscrireAcces, connexionInhabituelle, envoyerAlerteConnexion,
} from "./_acces.js";
import { modifierDocument } from "./_base.js";

/** Durée de validité du jeton. Assez longue pour une journée de travail, assez courte pour qu'un
 *  jeton volé sur un téléphone perdu cesse de servir rapidement. */
const DUREE_JETON_SECONDES = 12 * 3600;

/** Mêmes paramètres que le navigateur (voir hashPBKDF2 dans src/App.jsx) : toute différence ici
 *  empêcherait tout le monde de se connecter. */
const PBKDF2_ITERATIONS = 150000;

function hashPBKDF2(motDePasse, sel, iterations = PBKDF2_ITERATIONS) {
  return crypto.pbkdf2Sync(motDePasse, sel, iterations, 32, "sha256").toString("hex");
}

/** Ancien schéma, conservé pour les comptes pas encore migrés : SHA-256 de "sel:motdepasse". */
function hashSHA256(motDePasse, sel) {
  return crypto.createHash("sha256").update(`${sel}:${motDePasse}`).digest("hex");
}

/** Comparaison à durée constante : une comparaison ordinaire laisse deviner l'empreinte
 *  caractère par caractère en mesurant le temps de réponse. */
function egalitéSûre(a, b) {
  const A = Buffer.from(String(a || ""), "utf8");
  const B = Buffer.from(String(b || ""), "utf8");
  if (A.length !== B.length) return false;
  return crypto.timingSafeEqual(A, B);
}

function base64url(donnees) {
  return Buffer.from(donnees).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Fabrique un jeton accepté par Supabase, dans la forme exacte de la clé publique du projet :
 * { iss: "supabase", ref: <référence du projet>, role, iat, exp }, signé en HS256.
 * `role: authenticated` est ce que liront les politiques de la base.
 */
function signerJeton({ secret, refProjet, userId, identifiant }) {
  const maintenant = Math.floor(Date.now() / 1000);
  const entete = { alg: "HS256", typ: "JWT" };
  const charge = {
    iss: "supabase",
    ...(refProjet ? { ref: refProjet } : {}),
    role: "authenticated",
    aud: "authenticated",
    sub: userId,
    identifiant,
    iat: maintenant,
    exp: maintenant + DUREE_JETON_SECONDES,
  };
  const corps = `${base64url(JSON.stringify(entete))}.${base64url(JSON.stringify(charge))}`;
  const signature = crypto.createHmac("sha256", secret).update(corps).digest("base64")
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return { token: `${corps}.${signature}`, expireA: (maintenant + DUREE_JETON_SECONDES) * 1000 };
}

/** Référence du projet, telle qu'elle figure dans l'adresse : https://<ref>.supabase.co */
function refDepuisUrl(url) {
  const m = /^https?:\/\/([^.]+)\./.exec(url || "");
  return m ? m[1] : null;
}

/** Ne garde que les chiffres : « +224 620 11 12 22 » et « 620111222 » désignent le même numéro. */
function chiffresSeuls(valeur) {
  return String(valeur || "").replace(/\D/g, "");
}

/*
 * Trois façons d'entrer, pour une seule case.
 *
 * L'identifiant se choisit à l'inscription et s'oublie : ni le client au comptoir ni l'agent
 * revenu de congé ne se rappellent s'ils avaient écrit « mariama », « Mariama » ou
 * « mariama.camara ». Leur numéro et leur adresse e-mail, eux, ils les connaissent par cœur — et
 * ils figurent déjà sur leur fiche. Rien n'obligeait à n'accepter que la troisième.
 *
 * L'ordre compte : un identifiant exact passe avant un contact, pour qu'un compte ne soit jamais
 * éclipsé par l'homonymie d'un numéro. Sur le numéro, on compare les huit derniers chiffres, afin
 * que l'indicatif ne soit pas obligatoire.
 */
const CANDIDATS_MAX = 5;
export function comptesCorrespondants(liste, saisi) {
  const bas = String(saisi || "").trim().toLowerCase();
  if (!bas) return [];
  const numero = chiffresSeuls(bas);
  const parIdentifiant = [];
  const parContact = [];
  for (const c of liste || []) {
    if (String(c.identifiant || "").trim().toLowerCase() === bas) { parIdentifiant.push(c); continue; }
    if (bas.includes("@")) {
      if (String(c.email || "").trim().toLowerCase() === bas) parContact.push(c);
    } else if (numero.length >= 8 && chiffresSeuls(c.telephone).endsWith(numero.slice(-8))) {
      parContact.push(c);
    }
  }
  return [...parIdentifiant, ...parContact].slice(0, CANDIDATS_MAX);
}

/*
 * Ralentissement des essais répétés. Une fonction serverless peut être recréée à tout moment,
 * ce compteur n'est donc pas une protection absolue — c'est un ralentisseur, qui suffit à rendre
 * une attaque par dictionnaire inconfortable, en complément des 150 000 tours de PBKDF2.
 */
/*
 * Le plafond par connexion. Large : dans une agence, plusieurs personnes partagent la même sortie
 * internet et se connectent le matin les unes après les autres, parfois en se trompant. Quarante
 * essais en dix minutes ne gênent personne, et arrêtent net un balayage de mots de passe.
 */
const ESSAIS_PAR_CONNEXION = 40;
const FENETRE_CONNEXION_MS = 10 * 60 * 1000;

/*
 * LE COMPTEUR PAR COMPTE ÉTAIT EN MÉMOIRE — c'est-à-dire nulle part.
 *
 * Celui-ci est le plus important des deux : le compteur par adresse arrête quelqu'un qui essaie
 * mille mots de passe depuis chez lui, mais pas la manière dont on entre vraiment — un même mot de
 * passe courant présenté à tous les comptes, ou un même compte attaqué depuis des centaines
 * d'adresses différentes.
 *
 * Or il vivait dans la mémoire d'une instance serverless. Il ne s'en recrée pas une : il s'en
 * allume autant qu'il en faut, chacune avec sa mémoire vide. Dix essais par instance, et il
 * suffisait d'appeler vite pour en obtenir d'autres. Le plafond arrêtait un agent qui se trompe
 * de touche ; il ne voyait pas passer une attaque distribuée.
 *
 * DEUX CLEFS PLUTÔT QU'UNE.
 *
 *   — « adresse|identifiant », comme avant : la personne qui insiste depuis un même appareil ;
 *   — « identifiant » seul, qui manquait : le même compte visé depuis partout à la fois. Son
 *     plafond est plus haut, parce qu'il peut, lui, enfermer dehors un agent réel — vingt essais
 *     en dix minutes sur un seul compte, ce n'est plus quelqu'un qui cherche son mot de passe.
 */
const ESSAIS_PAR_COMPTE_ET_ADRESSE = 10;
const ESSAIS_PAR_COMPTE = 20;

/* ==========================================================================================
 * LA DOUBLE AUTHENTIFICATION — le socle commun aux deux étapes et à l'inscription
 * ==========================================================================================
 * Trois chemins partagent ce qui suit : la connexion ordinaire, le second appel qui apporte le
 * code du téléphone, et la mise en place du second facteur depuis un compte déjà connecté.
 *
 * Ils vivent tous dans CE fichier, et c'est délibéré : l'hébergement ne publie que douze
 * fonctions, et les douze sont prises. Une porte de plus aurait fait tomber une porte existante.
 * ========================================================================================== */

/** Le document de l'entreprise, lu avec la clé de service. Null si la base ne répond pas. */
async function lireDocument(url, cleService) {
  const reponse = await fetch(`${url}/rest/v1/bde_data?key=eq.bde-data&select=value`, {
    headers: { apikey: cleService, Authorization: `Bearer ${cleService}` },
  });
  if (!reponse.ok) { console.error("Lecture des comptes impossible", reponse.status); return null; }
  const lignes = await reponse.json();
  return lignes?.[0]?.value || {};
}

/** Les employés vivent dans `users`, les clients dans `clientAccounts` : jamais les deux. */
function listeDesComptes(donnees, espaceClient) {
  const l = espaceClient ? donnees?.clientAccounts : donnees?.users;
  return Array.isArray(l) ? l : [];
}

/** Le mot de passe présenté correspond-il à l'empreinte du compte ? */
function motDePasseCorrect(compte, motdepasse) {
  if (!compte?.motdepasseSecure) return false;
  const sel = compte.motdepasseSalt || "sel-inexistant";
  const empreinte = compte.motdepasseAlgo === "pbkdf2"
    ? hashPBKDF2(motdepasse, sel, compte.motdepasseIter || PBKDF2_ITERATIONS)
    : hashSHA256(motdepasse, sel);
  return egalitéSûre(empreinte, compte.motdepasseSecure);
}

/*
 * LE COMPTE TEL QU'IL REDESCEND AU NAVIGATEUR.
 *
 * Sans rien de ce qui touche au mot de passe — c'est ce qui permet à l'écran de connexion de ne
 * plus télécharger la liste des comptes — et sans le secret du second facteur, qui ne se montre
 * qu'une fois, à l'inscription. Le renvoyer ici reviendrait à publier la clé du second facteur à
 * chaque connexion : n'importe qui l'ayant intercepté calculerait les codes aussi bien que le
 * téléphone de la personne.
 *
 * À la place, deux booléens : de quoi afficher l'état du réglage sans livrer de quoi le
 * contourner.
 */
function compteSansSecrets(compte) {
  const {
    motdepasse: _mdp, motdepasseSecure: _sec, motdepasseSalt: _sel,
    motdepasseIter: _iter, motdepasseAlgo: _algo, ...reste
  } = compte;
  CHAMPS_TOTP_SECRETS.forEach((champ) => { delete reste[champ]; });
  return {
    ...reste,
    totpActif: !!compte.totpSecret,
    totpEnPreparation: !!compte.totpEnAttente,
    totpSecoursRestants: codesSecoursRestants(compte.totpSecours),
  };
}

/*
 * LE JOURNAL DES ACCÈS.
 *
 * Le journal d'activité consigne ce qu'on FAIT une fois entré. Il ne dit rien de l'entrée
 * elle-même : quelqu'un qui obtient un mot de passe — noté sur un carnet, réutilisé ailleurs —
 * entre, regarde tout, et repart sans laisser la moindre trace, puisqu'il n'a rien modifié.
 *
 * L'inscription se fait après la vérification et sans jamais faire échouer la connexion : un
 * incident de journal ne doit pas empêcher une agente d'ouvrir sa session à sept heures du matin.
 * Elle est lancée sans être attendue, pour ne pas rallonger l'attente.
 */
function journaliserAcces({ compte, identifiantSaisi, resultat, req, espaceClient, donnees }) {
  const entree = entreeAcces({
    compte, identifiantSaisi, resultat,
    adresse: adresseDe(req), req, espace: espaceClient ? "client" : "equipe",
  });
  modifierDocument((document) => {
    const inhabituelle = resultat === "reussie" && connexionInhabituelle(document, compte?.id, entree);
    return { document: inscrireAcces(document, { ...entree, inhabituelle }), retour: { entree, inhabituelle } };
  })
    .then((retour) => (retour?.inhabituelle ? envoyerAlerteConnexion(donnees, retour.entree) : null))
    .catch((e) => console.error("Journal des accès", e?.message || e));
}

/**
 * La réponse qui ouvre la session — le point d'arrivée commun des deux étapes.
 *
 * Le jeton Supabase n'est fabriqué que si son secret est connu ; le jeton de session, lui, ne
 * dépend d'aucune clé introuvable (voir api/_session.js) et c'est celui qui ouvre api/donnees.js.
 */
function delivrerSession(res, { compte, espaceClient, url, secretJwt, extra = null }) {
  const jeton = secretJwt
    ? signerJeton({
      secret: secretJwt, refProjet: refDepuisUrl(url),
      userId: compte.id, identifiant: compte.identifiant,
    })
    : {};

  const session = signerSession({
    userId: compte.id,
    identifiant: compte.identifiant,
    role: espaceClient ? "client" : (compte.role || ""),
    /*
     * L'empreinte du compte voyage dans le jeton. Le serveur la recalcule à chaque appel : si le
     * mot de passe change, ou si l'on révoque les sessions, ce jeton cesse de valoir sur-le-champ
     * au lieu de vivre ses douze heures.
     */
    empreinte: empreinteDuCompte(compte),
  }) || {};

  return res.status(200).json({
    ...jeton,
    ...session,
    userId: compte.id,
    utilisateur: compteSansSecrets(compte),
    // Dit à l'application si la base acceptera ce jeton, ou s'il faut rester sur la clé publique.
    jetonSigne: !!secretJwt,
    ...(extra || {}),
  });
}

/**
 * DEUXIÈME ÉTAPE : le code à six chiffres.
 *
 * Le défi prouve que le mot de passe vient d'être vérifié ; le code prouve que le téléphone est
 * là. Ni l'un ni l'autre ne suffit seul, et c'est tout l'intérêt.
 */
async function secondFacteur(req, res, corps, { url, cleService, secretJwt }) {
  const charge = verifierDefi(corps.defi);
  if (!charge) {
    return res.status(401).json({ error: "Demande expirée. Reprenez la connexion depuis le début." });
  }
  const espaceClient = charge.espace === "client";

  /*
   * Six chiffres se devinent en un million d'essais — quelques minutes pour un automate si on le
   * laisse faire. Deux plafonds l'en empêchent : un par connexion, et un par compte visé, pour que
   * changer d'adresse ne remette pas le compteur à zéro.
   */
  const parConnexion = await passage({
    nature: "second-facteur", cle: adresseDe(req), max: 20, fenetreMs: FENETRE_CONNEXION_MS,
  });
  if (parConnexion.bloque) {
    return refuser(res, parConnexion.dansSecondes,
      "Trop de codes essayés depuis cette connexion. Réessayez dans quelques minutes.");
  }
  const parCompte = await passage({
    nature: "second-facteur-compte", cle: String(charge.sub), max: 10, fenetreMs: FENETRE_CONNEXION_MS,
  });
  if (parCompte.bloque) {
    return refuser(res, parCompte.dansSecondes,
      "Trop de codes essayés sur ce compte. Réessayez dans quelques minutes.");
  }

  const donnees = await lireDocument(url, cleService);
  if (!donnees) return res.status(502).json({ error: "Base de données injoignable" });
  const compte = listeDesComptes(donnees, espaceClient).find((c) => c && c.id === charge.sub);
  /*
   * Le compte a disparu, ou son second facteur a été retiré entre les deux appels : on renvoie au
   * début plutôt que d'ouvrir une session sur un défi qui ne décrit plus rien.
   */
  if (!compte || !compte.totpSecret) {
    return res.status(401).json({ error: "Demande expirée. Reprenez la connexion depuis le début." });
  }

  const verdict = verifierCode(compte.totpSecret, corps.code);

  /*
   * LE CODE DE SECOURS — quand le téléphone n'est plus là.
   *
   * On ne le tente qu'après le code du téléphone : c'est le chemin ordinaire, et il ne doit pas
   * consommer une réserve limitée à cause d'une faute de frappe. La distinction se fait toute
   * seule — six chiffres d'un côté, dix lettres et chiffres de l'autre.
   */
  let secoursUtilise = -1;
  if (!verdict.valide) {
    secoursUtilise = verifierSecours(compte.totpSecours, corps.code);
  }

  if (!verdict.valide && secoursUtilise < 0) {
    journaliserAcces({
      compte, identifiantSaisi: compte.identifiant, resultat: "refusee", req, espaceClient, donnees,
    });
    return res.status(401).json({
      error: "Code incorrect. Il change toutes les trente secondes — attendez le suivant et réessayez.",
      besoinCode: true,
    });
  }

  /*
   * UN CODE NE SERT QU'UNE FOIS — les deux sortes.
   *
   * Six chiffres affichés trente secondes se lisent par-dessus une épaule, et se retrouvent dans
   * l'historique d'un appareil partagé. Un code de secours, lui, vit sur une feuille de papier que
   * l'on photographie parfois. Le compteur partagé sert ici de marque d'usage : la première
   * présentation passe, la seconde est refusée.
   */
  const marque = secoursUtilise >= 0
    ? { cle: `${charge.sub}|s${secoursUtilise}`, fenetreMs: 24 * 3600 * 1000 }
    : { cle: `${charge.sub}|${verdict.fenetre}`, fenetreMs: 120000 };
  const rejoue = await passage({ nature: "totp-utilise", cle: marque.cle, max: 1, fenetreMs: marque.fenetreMs });
  if (rejoue.bloque) {
    return res.status(401).json({
      error: "Ce code a déjà servi. Prenez le suivant.",
      besoinCode: true,
    });
  }

  /*
   * Le code de secours est rayé de la liste AVANT que la session ne soit délivrée.
   *
   * Le marquage en base est ce qui compte : le compteur ci-dessus vit dans une fenêtre de temps et
   * finirait par oublier. Si l'écriture échoue, on refuse plutôt que d'ouvrir une session sur un
   * code qui resterait utilisable — c'est le seul endroit du fichier où l'on préfère le refus.
   */
  let restants = null;
  if (secoursUtilise >= 0) {
    const raye = await marquerSecoursUtilise(charge.sub, espaceClient, secoursUtilise)
      .catch((e) => { console.error("Code de secours non marqué", e?.message || e); return null; });
    if (raye === null) {
      return res.status(503).json({
        error: "Impossible d’enregistrer l’usage de ce code pour le moment. Réessayez dans un instant.",
        besoinCode: true,
      });
    }
    restants = raye;
  }

  journaliserAcces({
    compte, identifiantSaisi: compte.identifiant,
    resultat: "reussie", req, espaceClient, donnees,
  });
  /*
   * Quand c'est un code de secours qui a servi, on dit combien il en reste — et l'écran le montre.
   * Sans cela, on découvre la réserve vide le jour où l'on n'a plus que ça pour entrer.
   */
  return delivrerSession(res, {
    compte, espaceClient, url, secretJwt,
    extra: secoursUtilise >= 0 ? { secoursUtilise: true, secoursRestants: restants } : null,
  });
}

/**
 * Raye un code de secours, et rend combien il en reste.
 *
 * Passe par modifierDocument, qui relit juste avant d'écrire : deux connexions simultanées avec
 * deux codes différents ne s'effacent donc pas l'une l'autre. Rend null si le compte ou le code
 * a disparu entre-temps — l'appelant refuse alors la connexion plutôt que de laisser un code servir
 * deux fois.
 */
async function marquerSecoursUtilise(userId, espaceClient, rang) {
  const cleListe = espaceClient ? "clientAccounts" : "users";
  return modifierDocument((document) => {
    const liste = Array.isArray(document[cleListe]) ? document[cleListe] : [];
    let restants = null;
    const sortie = liste.map((c) => {
      if (!c || c.id !== userId) return c;
      const gardes = Array.isArray(c.totpSecours) ? c.totpSecours : [];
      if (!gardes[rang] || gardes[rang].le) return c;      // déjà rayé : on ne réécrit rien
      const neufs = gardes.map((g, i) => (i === rang ? { ...g, le: new Date().toISOString() } : g));
      restants = neufs.filter((g) => g && g.h && !g.le).length;
      return { ...c, totpSecours: neufs };
    });
    if (restants === null) return null;
    return { document: { ...document, [cleListe]: sortie }, retour: restants };
  });
}

/**
 * METTRE EN PLACE, OU RETIRER, LE SECOND FACTEUR — depuis un compte déjà connecté.
 *
 * En trois gestes, parce qu'il en faut trois : préparer (le secret est tiré et montré une fois),
 * activer (la personne prouve que son téléphone le lit vraiment), retirer (avec le mot de passe,
 * sans quoi une session volée suffirait à désarmer la protection qu'elle est censée franchir).
 *
 * Le geste « activer » est ce qui évite l'accident le plus courant : un secret enregistré, un QR
 * code mal scanné, et la personne se retrouve dehors à la connexion suivante sans recours. Tant
 * qu'elle n'a pas présenté un code juste, le secret reste « en attente » et ne barre rien.
 */
async function gererTotp(req, res, corps, { url, cleService }) {
  const session = sessionDeLaRequete(req);
  if (!session) return res.status(401).json({ error: "Session absente ou expirée." });

  const espaceClient = session.role === "client";
  const cleListe = espaceClient ? "clientAccounts" : "users";
  const donnees = await lireDocument(url, cleService);
  if (!donnees) return res.status(502).json({ error: "Base de données injoignable" });
  const compte = listeDesComptes(donnees, espaceClient).find((c) => c && c.id === session.sub);
  if (!compte) return res.status(401).json({ error: "Ce compte n’existe plus." });

  /*
   * L'écriture repasse par modifierDocument : elle relit le document juste avant de le transformer,
   * et ne touche qu'à la fiche de la personne connectée. Rien de ce qui vient du navigateur n'entre
   * ici — le secret est tiré par le serveur et n'est jamais réécrit d'après ce qu'on lui envoie.
   */
  const ecrire = (transformer) => modifierDocument((document) => {
    const liste = Array.isArray(document[cleListe]) ? document[cleListe] : [];
    let touche = false;
    const sortie = liste.map((c) => {
      if (!c || c.id !== session.sub) return c;
      touche = true;
      return transformer(c);
    });
    if (!touche) return null;
    return { document: { ...document, [cleListe]: sortie }, retour: true };
  });

  if (corps.action === "totp-preparer") {
    if (compte.totpSecret) {
      return res.status(409).json({
        error: "La double authentification est déjà en place sur ce compte. Retirez-la d’abord si vous changez de téléphone.",
      });
    }
    const secret = genererSecret();
    await ecrire((c) => ({ ...c, totpEnAttente: secret }));
    /*
     * La seule fois où le secret quitte le serveur. Il faut bien qu'il arrive dans le téléphone :
     * c'est le principe même du procédé. Ensuite il n'en ressort plus jamais.
     */
    return res.status(200).json({
      secret,
      uri: uriInscription(secret, compte.identifiant || session.identifiant || "compte"),
    });
  }

  if (corps.action === "totp-activer") {
    const secret = compte.totpEnAttente;
    if (!secret) return res.status(409).json({ error: "Aucune inscription en cours. Recommencez." });
    const limite = await passage({
      nature: "totp-inscription", cle: String(session.sub), max: 10, fenetreMs: FENETRE_CONNEXION_MS,
    });
    if (limite.bloque) {
      return refuser(res, limite.dansSecondes, "Trop d’essais. Réessayez dans quelques minutes.");
    }
    if (!verifierCode(secret, corps.code).valide) {
      return res.status(401).json({
        error: "Code incorrect. Vérifiez que l’heure de votre téléphone est réglée automatiquement, puis réessayez.",
      });
    }
    /*
     * LES CODES DE SECOURS SONT TIRÉS ICI, ET MONTRÉS UNE SEULE FOIS.
     *
     * Sans eux, un téléphone perdu ferme le compte définitivement : le secret est réimposé depuis
     * la base à chaque enregistrement — c'est ce qui empêche une page de l'effacer — et personne,
     * pas même un administrateur, ne peut le retirer depuis l'application. Pour le seul compte
     * administrateur de l'entreprise, cela reviendrait à confier les clés de la maison à un
     * appareil qui se casse.
     */
    const codes = genererCodesSecours();
    await ecrire((c) => {
      const propre = { ...c };
      CHAMPS_TOTP_SECRETS.forEach((champ) => { delete propre[champ]; });
      return {
        ...propre,
        totpSecret: secret,
        totpSecours: empreintesDesCodes(codes),
        totpActiveLe: new Date().toISOString(),
        twoFA: true,
      };
    });
    return res.status(200).json({ ok: true, actif: true, codesSecours: codes });
  }

  if (corps.action === "totp-secours") {
    /*
     * REFAIRE LA LISTE — après en avoir usé, ou quand la feuille a été perdue.
     *
     * Le mot de passe est exigé, comme pour le retrait : ces codes contournent le second facteur,
     * et une session volée qui pourrait s'en fabriquer une série neuve viderait la protection de
     * son sens.
     *
     * Les anciens sont remplacés, jamais complétés : une feuille égarée doit cesser de valoir au
     * moment où l'on en imprime une autre.
     */
    if (!compte.totpSecret) {
      return res.status(409).json({ error: "La double authentification n’est pas en place sur ce compte." });
    }
    if (!motDePasseCorrect(compte, corps.motdepasse)) {
      return res.status(401).json({ error: "Mot de passe incorrect." });
    }
    const codes = genererCodesSecours();
    await ecrire((c) => ({ ...c, totpSecours: empreintesDesCodes(codes) }));
    return res.status(200).json({ ok: true, codesSecours: codes });
  }

  if (corps.action === "totp-retirer") {
    /*
     * LE MOT DE PASSE EST EXIGÉ ICI, ET NULLE PART AILLEURS DANS CE FICHIER.
     *
     * Retirer le second facteur, c'est défaire la protection. Si une session ouverte suffisait,
     * celui qui a volé un téléphone déverrouillé n'aurait qu'à cliquer — et la protection ne
     * vaudrait rien contre le cas précis pour lequel on l'a mise.
     */
    if (!motDePasseCorrect(compte, corps.motdepasse)) {
      return res.status(401).json({ error: "Mot de passe incorrect." });
    }
    await ecrire((c) => {
      const propre = { ...c };
      CHAMPS_TOTP_SECRETS.forEach((champ) => { delete propre[champ]; });
      delete propre.totpActiveLe;
      return { ...propre, twoFA: false };
    });
    return res.status(200).json({ ok: true, actif: false });
  }

  return res.status(400).json({ error: "Action inconnue." });
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Méthode non autorisée" });

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const cleService = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const secretJwt = process.env.SUPABASE_JWT_SECRET;

  /*
   * Le secret de signature est facultatif.
   *
   * Il ne sert qu'à fabriquer un jeton que la base acceptera le jour où elle sera fermée au
   * public. Sans lui, la vérification du mot de passe se fait quand même ici, avec une clé qui ne
   * quitte pas le serveur — et c'est déjà l'essentiel : le navigateur n'a plus besoin de
   * télécharger la liste des comptes, empreintes comprises, pour vérifier une connexion.
   *
   * Les interfaces récentes de Supabase rangent ce secret à un endroit difficile à trouver, et
   * parfois ne le montrent plus du tout. Exiger les trois variables revenait à tout bloquer pour
   * une clé accessoire.
   */
  if (!url || !cleService) {
    return res.status(501).json({
      error: "Connexion serveur non configurée",
      manquantes: [
        !url && "SUPABASE_URL",
        !cleService && "SUPABASE_SERVICE_ROLE_KEY",
      ].filter(Boolean),
    });
  }

  try {
    const corpsRecu = req.body || {};

    /*
     * TROIS PORTES DERRIÈRE UNE SEULE ADRESSE.
     *
     * `action` : la mise en place ou le retrait du second facteur, depuis un compte connecté.
     * `defi`   : la seconde étape d'une connexion — le code du téléphone.
     * Sinon    : la connexion ordinaire, exactement comme avant.
     *
     * Elles cohabitent ici parce que l'hébergement ne publie que douze fonctions et qu'elles sont
     * toutes prises : ajouter un fichier en aurait fait disparaître un autre, silencieusement.
     */
    if (corpsRecu.action) return await gererTotp(req, res, corpsRecu, { url, cleService });
    if (corpsRecu.defi) return await secondFacteur(req, res, corpsRecu, { url, cleService, secretJwt });

    const { identifiant, motdepasse, espace } = corpsRecu;
    if (!identifiant || !motdepasse) return res.status(400).json({ error: "Identifiant et mot de passe requis" });

    /*
     * Deux populations, deux listes : les employés dans `users`, les clients dans `clientAccounts`.
     * L'espace demandé est respecté strictement — un compte client ne doit jamais ouvrir une
     * session d'employé parce qu'il porte le même identifiant qu'un agent, ni l'inverse.
     */
    const espaceClient = espace === "client";

    /*
     * DEUX COMPTEURS, PARCE QU'IL Y A DEUX ATTAQUES.
     *
     * Le premier compte les essais sur UN compte : c'est ce qui arrête quelqu'un qui cherche le mot
     * de passe d'une personne précise. Il ne voyait rien, en revanche, de l'attaque inverse — un
     * seul mot de passe très courant essayé sur cent identifiants différents. Chaque compte n'était
     * touché qu'une fois, donc aucun plafond n'était atteint, et c'est pourtant la manière dont on
     * entre le plus souvent : il suffit d'une personne dans l'entreprise qui ait choisi « 123456 ».
     *
     * Le second compte donc les essais par CONNEXION, quel que soit l'identifiant visé.
     */
    const vise = String(identifiant).toLowerCase();
    const parAppareil = await passage({
      nature: "connexion-compte-appareil", cle: `${adresseDe(req)}|${vise}`,
      max: ESSAIS_PAR_COMPTE_ET_ADRESSE, fenetreMs: FENETRE_CONNEXION_MS,
    });
    if (parAppareil.bloque) {
      return refuser(res, parAppareil.dansSecondes, "Trop de tentatives. Réessayez dans quelques minutes.");
    }
    const parCompte = await passage({
      nature: "connexion-compte", cle: vise,
      max: ESSAIS_PAR_COMPTE, fenetreMs: FENETRE_CONNEXION_MS,
    });
    if (parCompte.bloque) {
      return refuser(res, parCompte.dansSecondes,
        "Trop de tentatives sur ce compte. Réessayez dans quelques minutes.");
    }
    const parConnexion = await passage({
      nature: "connexion", cle: adresseDe(req),
      max: ESSAIS_PAR_CONNEXION, fenetreMs: FENETRE_CONNEXION_MS,
    });
    if (parConnexion.bloque) {
      return refuser(res, parConnexion.dansSecondes,
        "Trop de tentatives de connexion depuis cette connexion. Réessayez dans quelques minutes.");
    }

    const reponse = await fetch(`${url}/rest/v1/bde_data?key=eq.bde-data&select=value`, {
      headers: { apikey: cleService, Authorization: `Bearer ${cleService}` },
    });
    if (!reponse.ok) {
      console.error("Lecture des comptes impossible", reponse.status);
      return res.status(502).json({ error: "Base de données injoignable" });
    }
    const lignes = await reponse.json();
    const donnees = lignes?.[0]?.value || {};
    /* Les clients saisissent leur identifiant sans se soucier de la casse ; l'écran du portail a
     * toujours comparé en minuscules, et changer cela ici enfermerait dehors des comptes existants. */
    const cherche = String(identifiant).trim();
    const candidats = comptesCorrespondants(
      espaceClient ? donnees.clientAccounts : donnees.users, cherche,
    );

    /*
     * Même réponse pour un identifiant inconnu et pour un mot de passe faux : sinon, la page de
     * connexion permet de découvrir qui travaille dans l'entreprise. Le hachage est calculé même
     * quand aucun compte ne correspond, pour que la durée de réponse ne trahisse pas l'information.
     *
     * Plusieurs comptes peuvent répondre à un même numéro — deux inscriptions au comptoir, un
     * gérant et son agent qui partagent une ligne. Plutôt que d'en désigner un au hasard ou de
     * refuser en disant pourquoi (ce qui révélerait l'existence des deux), c'est le mot de passe
     * qui tranche : celui dont l'empreinte correspond est celui qui se connecte.
     */
    const echec = { status: 401, corps: { error: "Identifiant ou mot de passe incorrect." } };
    const empreinteDe = (c) => {
      const sel = c?.motdepasseSalt || "sel-inexistant";
      const algo = c?.motdepasseAlgo === "pbkdf2" || !c ? "pbkdf2" : "sha256";
      return algo === "pbkdf2"
        ? hashPBKDF2(motdepasse, sel, c?.motdepasseIter || PBKDF2_ITERATIONS)
        : hashSHA256(motdepasse, sel);
    };

    let compte = null;
    if (candidats.length === 0) {
      empreinteDe(null);   // le temps de réponse ne doit pas dire « ce compte n'existe pas »
    } else {
      for (const c of candidats) {
        if (c.motdepasseSecure && egalitéSûre(empreinteDe(c), c.motdepasseSecure)) { compte = c; break; }
      }
    }

    const journaliser = (resultat) => journaliserAcces({
      compte, identifiantSaisi: cherche, resultat, req, espaceClient, donnees,
    });

    if (!compte) {
      journaliser("refusee");
      return res.status(echec.status).json(echec.corps);
    }

    /*
     * LE SECOND FACTEUR, S'IL EST EN PLACE — ET AVANT TOUTE DÉLIVRANCE DE JETON.
     *
     * L'ancienne double authentification vivait entièrement dans le navigateur : le code y était
     * tiré par Math.random(), comparé sur place, et cette fonction n'en savait rien. Appeler
     * /api/login directement rendait donc un jeton valide sans le moindre second facteur — la
     * case cochée ne protégeait que celui qui passait par l'écran.
     *
     * Le mot de passe est bon, mais il ne suffit plus : on rend une DEMANDE DE CODE, pas une
     * session. La demande est signée et vaut cinq minutes ; elle ne donne accès à rien par
     * elle-même, elle atteste seulement que le mot de passe a été vérifié à l'instant. C'est ce
     * qui évite de garder un état côté serveur entre les deux étapes.
     *
     * La connexion n'est PAS journalisée ici, ni dans un sens ni dans l'autre : à ce stade
     * personne n'est entré. Le journal est écrit à la seconde étape — « réussie » si le code est
     * bon, « refusée » sinon. Un mot de passe juste suivi d'un code faux est une tentative, et
     * c'est précisément celle qu'on veut voir apparaître en rouge.
     */
    if (compte.totpSecret) {
      return res.status(200).json({
        besoinCode: true,
        defi: signerDefi({ userId: compte.id, espace: espaceClient ? "client" : "equipe" }),
        message: "Entrez le code à six chiffres affiché par votre application d’authentification.",
      });
    }

    journaliser("reussie");

    return delivrerSession(res, { compte, espaceClient, url, secretJwt });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erreur serveur lors de la connexion." });
  }
}
