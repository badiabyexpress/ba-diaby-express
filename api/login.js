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
import { signerSession } from "./_session.js";

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

/*
 * Ralentissement des essais répétés. Une fonction serverless peut être recréée à tout moment,
 * ce compteur n'est donc pas une protection absolue — c'est un ralentisseur, qui suffit à rendre
 * une attaque par dictionnaire inconfortable, en complément des 150 000 tours de PBKDF2.
 */
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

    const cleEssais = `${req.headers["x-forwarded-for"] || "?"}|${String(identifiant).toLowerCase()}`;
    if (tropDEssais(cleEssais)) {
      return res.status(429).json({ error: "Trop de tentatives. Réessayez dans quelques minutes." });
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
    const compte = espaceClient
      ? (donnees.clientAccounts || []).find((c) => String(c.identifiant || "").toLowerCase() === cherche.toLowerCase())
      : (donnees.users || []).find((u) => u.identifiant === cherche);

    /*
     * Même réponse pour un identifiant inconnu et pour un mot de passe faux : sinon, la page de
     * connexion permet de découvrir qui travaille dans l'entreprise. Le hachage est calculé même
     * quand le compte n'existe pas, pour que la durée de réponse ne trahisse pas l'information.
     */
    const echec = { status: 401, corps: { error: "Identifiant ou mot de passe incorrect." } };
    const sel = compte?.motdepasseSalt || "sel-inexistant";
    const attendu = compte?.motdepasseSecure || "";
    const algo = compte?.motdepasseAlgo === "pbkdf2" || !compte ? "pbkdf2" : "sha256";
    const calcule = algo === "pbkdf2"
      ? hashPBKDF2(motdepasse, sel, compte?.motdepasseIter || PBKDF2_ITERATIONS)
      : hashSHA256(motdepasse, sel);

    if (!compte || !attendu || !egalitéSûre(calcule, attendu)) {
      return res.status(echec.status).json(echec.corps);
    }

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
