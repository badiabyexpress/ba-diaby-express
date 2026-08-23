/**
 * Jetons de session maison — signature et vérification.
 *
 * POURQUOI PAS LE JETON SUPABASE
 * ------------------------------
 * api/login.js sait déjà fabriquer un jeton que Supabase accepte, mais il lui faut pour cela le
 * « JWT secret » du projet, que les interfaces récentes de Supabase ne montrent plus. Attendre
 * cette clé revenait à ne jamais fermer la base.
 *
 * Le jeton d'ici ne s'adresse pas à Supabase : il s'adresse à NOS fonctions serveur. Le serveur
 * le signe, le serveur le vérifie, et lui seul parle à la base — avec la clé de service. Le
 * navigateur n'a donc plus besoin d'aucune clé Supabase, et la base peut être fermée au public
 * sans dépendre d'un secret qu'on ne trouve pas.
 *
 * LE SECRET DE SIGNATURE
 * ----------------------
 * `SESSION_SECRET` si elle existe ; sinon une valeur dérivée de la clé de service, qui est déjà
 * secrète et déjà présente. C'est délibéré : une variable de plus à créer, c'est une variable de
 * plus à oublier, et un déploiement à moitié configuré où plus personne ne se connecte. Dérivée,
 * elle n'est jamais la clé de service elle-même : un jeton volé ne redonne pas l'accès à la base.
 */

import crypto from "node:crypto";

/** Assez long pour une journée de travail, assez court pour qu'un téléphone perdu cesse de servir. */
export const DUREE_SESSION_SECONDES = 12 * 3600;

function secretDeSignature() {
  const explicite = process.env.SESSION_SECRET;
  if (explicite) return explicite;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!service) return null;
  return crypto.createHmac("sha256", service).update("bde-session-v1").digest();
}

function base64url(donnees) {
  return Buffer.from(donnees).toString("base64")
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Signe une charge utile. Retourne null si aucun secret n'est disponible (serveur non configuré). */
export function signerSession({ userId, identifiant, role }) {
  const secret = secretDeSignature();
  if (!secret) return null;
  const maintenant = Math.floor(Date.now() / 1000);
  const charge = { sub: userId, identifiant, role: role || "", iat: maintenant, exp: maintenant + DUREE_SESSION_SECONDES };
  const corps = base64url(JSON.stringify(charge));
  const signature = crypto.createHmac("sha256", secret).update(corps).digest("base64")
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return { session: `${corps}.${signature}`, sessionExpireA: charge.exp * 1000 };
}

/**
 * Vérifie un jeton et retourne sa charge utile, ou null.
 *
 * La comparaison de signature passe par timingSafeEqual : une comparaison ordinaire laisse
 * reconstruire une signature valide octet par octet en mesurant le temps de réponse.
 */
export function verifierSession(jeton) {
  const secret = secretDeSignature();
  if (!secret || typeof jeton !== "string") return null;
  const points = jeton.split(".");
  if (points.length !== 2) return null;
  const [corps, signature] = points;
  const attendue = crypto.createHmac("sha256", secret).update(corps).digest("base64")
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const A = Buffer.from(signature, "utf8");
  const B = Buffer.from(attendue, "utf8");
  if (A.length !== B.length || !crypto.timingSafeEqual(A, B)) return null;
  let charge;
  try { charge = JSON.parse(Buffer.from(corps.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")); }
  catch (e) { return null; }
  if (!charge || !charge.exp || Math.floor(Date.now() / 1000) >= charge.exp) return null;
  return charge;
}

/** Extrait le jeton de l'en-tête Authorization d'une requête. */
export function sessionDeLaRequete(req) {
  const entete = req.headers?.authorization || req.headers?.Authorization || "";
  const m = /^Bearer\s+(.+)$/i.exec(String(entete).trim());
  return m ? verifierSession(m[1]) : null;
}
