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
import { signerSession, empreinteDuCompte } from "./_session.js";
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

const essais = new Map();
function tropDEssais(cle) {
  const maintenant = Date.now();
  const e = essais.get(cle);
  if (!e || maintenant - e.debut > 10 * 60 * 1000) { essais.set(cle, { debut: maintenant, n: 1 }); return false; }
  e.n += 1;
  return e.n > 10;
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
    const { identifiant, motdepasse, espace } = req.body || {};
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
    const cleEssais = `${adresseDe(req)}|${String(identifiant).toLowerCase()}`;
    if (tropDEssais(cleEssais)) {
      return res.status(429).json({ error: "Trop de tentatives. Réessayez dans quelques minutes." });
    }
    const parConnexion = passage({
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

    /*
     * LE JOURNAL DES ACCÈS.
     *
     * Le journal d'activité consigne ce qu'on FAIT une fois entré. Il ne dit rien de l'entrée
     * elle-même : quelqu'un qui obtient un mot de passe — noté sur un carnet, réutilisé ailleurs —
     * entre, regarde tout, et repart sans laisser la moindre trace, puisqu'il n'a rien modifié.
     *
     * L'inscription se fait après la vérification et sans jamais faire échouer la connexion : un
     * incident de journal ne doit pas empêcher une agente d'ouvrir sa session à sept heures du
     * matin. Elle est lancée sans être attendue, pour ne pas rallonger l'attente.
     */
    const journaliser = (resultat) => {
      const entree = entreeAcces({
        compte, identifiantSaisi: cherche, resultat,
        adresse: adresseDe(req), req, espace: espaceClient ? "client" : "equipe",
      });
      modifierDocument((document) => {
        const inhabituelle = resultat === "reussie" && connexionInhabituelle(document, compte?.id, entree);
        return { document: inscrireAcces(document, { ...entree, inhabituelle }), retour: { entree, inhabituelle } };
      })
        .then((retour) => {
          if (retour?.inhabituelle) return envoyerAlerteConnexion(donnees, retour.entree);
          return null;
        })
        .catch((e) => console.error("Journal des accès", e?.message || e));
    };

    if (!compte) {
      journaliser("refusee");
      return res.status(echec.status).json(echec.corps);
    }
    journaliser("reussie");

    const jeton = secretJwt
      ? signerJeton({
        secret: secretJwt,
        refProjet: refDepuisUrl(url),
        userId: compte.id,
        identifiant: compte.identifiant,
      })
      : {};

    /*
     * Le jeton de session, lui, ne dépend d'aucune clé introuvable : le serveur le signe et le
     * vérifie lui-même (voir api/_session.js). C'est ce jeton qui ouvre api/donnees.js, et donc
     * ce qui permettra à l'application de continuer à travailler une fois la base fermée à la
     * clé publique.
     */
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

    /*
     * Le compte revient d'ici, débarrassé de tout ce qui touche au mot de passe.
     *
     * C'est ce qui permet à la page de connexion de ne plus avoir besoin de la liste des comptes :
     * elle demandait jusqu'ici la base entière avant de pouvoir vérifier quoi que ce soit, et la
     * livrait donc à quiconque ouvrait le site. Le sel, l'empreinte, le nombre d'itérations et
     * l'algorithme restent au serveur — ils ne servent qu'ici.
     */
    const {
      motdepasse: _mdp, motdepasseSecure: _sec, motdepasseSalt: _sel,
      motdepasseIter: _iter, motdepasseAlgo: _algo, ...compteSur
    } = compte;

    return res.status(200).json({
      ...jeton,
      ...session,
      userId: compte.id,
      utilisateur: compteSur,
      // Dit à l'application si la base acceptera ce jeton, ou s'il faut rester sur la clé publique.
      jetonSigne: !!secretJwt,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erreur serveur lors de la connexion." });
  }
}
