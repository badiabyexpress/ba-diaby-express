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

/*
 * L'EMPREINTE QUI REND UNE SESSION RÉVOCABLE
 * ─────────────────────────────────────────────────────────────────────────────
 * Un jeton valait douze heures, et rien ne pouvait l'arrêter. Changer le mot de passe n'y faisait
 * rien ; supprimer le compte non plus. Pour un téléphone perdu ou quelqu'un qui part fâché, c'était
 * une demi-journée d'accès complet aux données de l'entreprise APRÈS la décision de le lui retirer.
 *
 * L'empreinte est calculée à partir de ce qui, dans le compte, ne survit pas à une reprise en
 * main : l'empreinte du mot de passe, et une date de révocation posée à la demande. Elle voyage
 * dans le jeton, et le serveur la recalcule à chaque appel depuis le compte tel qu'il est
 * MAINTENANT. Les deux diffèrent ? Le jeton ne vaut plus rien, à la seconde.
 *
 * Elle est dérivée, jamais l'empreinte elle-même : un jeton intercepté ne donne pas de quoi
 * attaquer le mot de passe.
 *
 * Ce choix évite surtout un compteur à tenir à jour. Une douzaine d'endroits changent un mot de
 * passe dans l'application ; il aurait suffi d'en oublier un pour que la révocation ne marche pas
 * là — et personne ne s'en serait aperçu avant d'en avoir besoin.
 */
export function empreinteDuCompte(compte) {
  const matiere = [
    compte?.motdepasseSecure || compte?.motdepasse || "",
    compte?.motdepasseSalt || "",
    compte?.sessionsRevoqueesLe || "",
  ].join("|");
  return crypto.createHash("sha256").update(`bde-emp-v1|${matiere}`).digest("hex").slice(0, 16);
}

/** Signe une charge utile. Retourne null si aucun secret n'est disponible (serveur non configuré). */
export function signerSession({ userId, identifiant, role, empreinte }) {
  const secret = secretDeSignature();
  if (!secret) return null;
  const maintenant = Math.floor(Date.now() / 1000);
  const charge = {
    sub: userId, identifiant, role: role || "",
    ...(empreinte ? { emp: empreinte } : {}),
    iat: maintenant, exp: maintenant + DUREE_SESSION_SECONDES,
  };
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

/** Vrai si le serveur sait signer et vérifier des jetons — c'est-à-dire s'il est configuré. */
export function signatureDisponible() {
  return !!secretDeSignature();
}

/*
 * LE DÉFI DU SECOND FACTEUR — l'objet qui relie les deux étapes de la connexion
 * ─────────────────────────────────────────────────────────────────────────────
 * Quand un compte porte une double authentification, la connexion se fait en deux appels : le mot
 * de passe d'abord, le code du téléphone ensuite. Entre les deux, il faut se souvenir que le mot
 * de passe a été vérifié — sinon le second appel accepterait un code juste sans mot de passe du
 * tout, et le second facteur deviendrait le seul facteur.
 *
 * Deux façons de s'en souvenir : garder un état sur le serveur, ou le faire porter par le
 * navigateur sous une forme qu'il ne peut pas fabriquer. Ici, la seconde — parce qu'une fonction
 * serverless n'a pas de mémoire commune : l'état écrit par l'instance qui répond au premier appel
 * n'existerait pas pour celle qui répond au second.
 *
 * Le défi est donc un petit jeton signé, valable CINQ MINUTES. Il ne donne accès à rien : il
 * atteste seulement « le mot de passe de ce compte a été vérifié à l'instant ». Sa signature est
 * dérivée d'un secret DIFFÉRENT de celui des sessions, pour qu'un défi ne puisse jamais être
 * présenté à la place d'une session, ni l'inverse.
 */
export const DUREE_DEFI_SECONDES = 5 * 60;

function secretDuDefi() {
  const base = secretDeSignature();
  if (!base) return null;
  return crypto.createHmac("sha256", base).update("bde-defi-v1").digest();
}

export function signerDefi({ userId, espace }) {
  const secret = secretDuDefi();
  if (!secret) return null;
  const maintenant = Math.floor(Date.now() / 1000);
  const corps = base64url(JSON.stringify({
    sub: userId, espace: espace || "equipe", iat: maintenant, exp: maintenant + DUREE_DEFI_SECONDES,
  }));
  const signature = crypto.createHmac("sha256", secret).update(corps).digest("base64")
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${corps}.${signature}`;
}

/** Rend la charge du défi, ou null : signature fausse, forme inattendue, ou délai dépassé. */
export function verifierDefi(jeton) {
  const secret = secretDuDefi();
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

/*
 * LE LAISSEZ-PASSER DES APPELS DE SERVEUR À SERVEUR
 *
 * api/motdepasse.js envoie le code de réinitialisation en repassant par api/whatsapp.js — un appel
 * HTTP qui sort et revient. Il n'a aucune session à présenter, et pour cause : la personne qui
 * demande n'est pas connectée, c'est justement son mot de passe qu'elle a perdu.
 *
 * Sans ce laissez-passer, fermer api/whatsapp.js aux inconnus fermerait du même coup la
 * réinitialisation. Il est dérivé du même secret — jamais égal à lui — et ne quitte jamais le
 * serveur : il voyage entre deux fonctions du même déploiement, qui partagent leurs variables.
 */
export const ENTETE_INTERNE = "x-bde-interne";

export function jetonInterne() {
  const secret = secretDeSignature();
  if (!secret) return null;
  return crypto.createHmac("sha256", secret).update("bde-interne-v1").digest("hex");
}

function estAppelInterne(req) {
  const attendu = jetonInterne();
  const recu = req.headers?.[ENTETE_INTERNE];
  if (!attendu || typeof recu !== "string" || recu.length !== attendu.length) return false;
  return crypto.timingSafeEqual(Buffer.from(recu, "utf8"), Buffer.from(attendu, "utf8"));
}

/**
 * Le garde commun des fonctions QUI DÉPENSENT : WhatsApp, e-mail, l'assistant, les taux du jour.
 *
 * Chacune coûte à chaque appel — un message facturé par Meta, un courriel qui engage la réputation
 * du domaine, des jetons chez Anthropic, une part d'un quota mensuel. Elles étaient ouvertes à qui
 * connaissait leur adresse : n'importe qui pouvait faire partir des messages depuis le numéro de
 * l'entreprise, et le prix comme la sanction — un numéro que Meta restreint — auraient été pour
 * elle.
 *
 * Ni un client ni un partenaire n'y ont affaire : leurs écrans ne les appellent jamais. Ce sont
 * des gestes de l'équipe, et le client est ici le compte le plus exposé, puisque n'importe qui
 * peut en créer un.
 *
 * Tant que le serveur n'est pas configuré, rien ne change : sans secret, aucun jeton ne serait
 * vérifiable et exiger une session reviendrait à tout fermer, y compris à l'équipe.
 *
 * Retourne null si l'appel est autorisé, sinon { code, corps } à renvoyer tel quel.
 */
export function refusSaufEquipe(req) {
  if (!signatureDisponible()) return null;
  if (estAppelInterne(req)) return null;
  const session = sessionDeLaRequete(req);
  if (!session) return { code: 401, corps: { error: "Session absente ou expirée." } };
  if (session.role === "client" || session.role === "Partenaire") {
    return { code: 403, corps: { error: "Action réservée à l’équipe." } };
  }
  return null;
}
