/*
 * LA DOUBLE AUTHENTIFICATION — celle qui tient vraiment
 * ─────────────────────────────────────────────────────────────────────────────
 * L'application avait déjà une case « double authentification ». Elle portait la mention
 * « (démo) », et elle la méritait : le code était tiré par Math.random() DANS LE NAVIGATEUR,
 * comparé DANS LE NAVIGATEUR, et le serveur ne connaissait même pas l'existence du réglage.
 * Autrement dit, appeler /api/login directement rendait un jeton de session valide sans le
 * moindre second facteur. C'était un écran, pas une serrure.
 *
 * POURQUOI UNE APPLICATION PLUTÔT QU'UN SMS
 *
 * Un code envoyé par SMS ou WhatsApp coûte à chaque envoi, dépend d'un service tiers, exige un
 * modèle validé par Meta, ne marche pas sans réseau — et s'intercepte quand on détourne une carte
 * SIM, ce qui est la manière ordinaire de voler un compte bancaire en Afrique de l'Ouest.
 *
 * Ici, rien ne s'envoie. Le serveur et le téléphone partagent un secret, tiré une seule fois, et
 * calculent chacun de leur côté le même code à six chiffres à partir de l'heure. Aucun message,
 * aucun compte à créer, aucun abonnement, aucune bibliothèque à installer : tout tient dans le
 * module `crypto` de Node.
 *
 * C'est la norme TOTP (RFC 6238), celle que lisent Google Authenticator, Microsoft
 * Authenticator, Authy, FreeOTP et les autres. On n'est donc lié à personne.
 *
 * CE QUI COMPTE DANS L'IMPLÉMENTATION
 *
 *   — Le secret est tiré par crypto.randomBytes, jamais par Math.random(). Vingt octets, la
 *     taille recommandée : deviner reviendrait à deviner une clé.
 *   — La comparaison passe par timingSafeEqual. Une comparaison ordinaire s'arrête au premier
 *     caractère faux, et la durée de la réponse finit par dire lesquels étaient bons.
 *   — On accepte la fenêtre précédente et la suivante. Une horloge de téléphone dérive de
 *     quelques secondes ; sans cette tolérance, un utilisateur sur dix serait refusé sans
 *     comprendre pourquoi, et l'on finirait par désactiver la protection.
 */

import crypto from "node:crypto";

/* Trente secondes par code, six chiffres : les valeurs que toutes les applications supposent. */
const PAS_SECONDES = 30;
const CHIFFRES = 6;

/*
 * Une fenêtre de part et d'autre. Deux serait laxiste — cela laisse un code valable deux
 * minutes et demie — et zéro serait inutilisable dès qu'un téléphone retarde de dix secondes.
 */
const TOLERANCE = 1;

const ALPHABET32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/** Encode en base32, la seule forme que les applications d'authentification savent lire. */
export function versBase32(octets) {
  let bits = 0, valeur = 0, sortie = "";
  for (const octet of octets) {
    valeur = (valeur << 8) | octet;
    bits += 8;
    while (bits >= 5) {
      sortie += ALPHABET32[(valeur >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) sortie += ALPHABET32[(valeur << (5 - bits)) & 31];
  return sortie;
}

/** L'inverse. Tolère les espaces et les minuscules : un secret se recopie parfois à la main. */
export function depuisBase32(texte) {
  const propre = String(texte || "").toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0, valeur = 0;
  const octets = [];
  for (const caractere of propre) {
    const i = ALPHABET32.indexOf(caractere);
    if (i < 0) continue;
    valeur = (valeur << 5) | i;
    bits += 5;
    if (bits >= 8) {
      octets.push((valeur >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(octets);
}

/**
 * Un secret neuf.
 *
 * crypto.randomBytes, et non Math.random() : ce dernier est prévisible pour qui observe assez de
 * tirages, et c'est exactement ce que faisait la version « démo ».
 */
export function genererSecret() {
  return versBase32(crypto.randomBytes(20));
}

/** Le code attendu pour une fenêtre donnée — l'algorithme de la RFC 6238, en dix lignes. */
function codePourFenetre(secret, fenetre) {
  const cle = depuisBase32(secret);
  if (cle.length === 0) return null;

  const compteur = Buffer.alloc(8);
  compteur.writeUInt32BE(Math.floor(fenetre / 2 ** 32), 0);
  compteur.writeUInt32BE(fenetre >>> 0, 4);

  const empreinte = crypto.createHmac("sha1", cle).update(compteur).digest();
  /* Troncature dynamique : le dernier quartet désigne où lire les quatre octets du code. */
  const decalage = empreinte[empreinte.length - 1] & 0x0f;
  const nombre = ((empreinte[decalage] & 0x7f) << 24)
    | (empreinte[decalage + 1] << 16)
    | (empreinte[decalage + 2] << 8)
    | empreinte[decalage + 3];
  return String(nombre % 10 ** CHIFFRES).padStart(CHIFFRES, "0");
}

/** Le code de l'instant, celui qu'affiche le téléphone. Utile pour vérifier une inscription. */
export function codeActuel(secret, maintenant = Date.now()) {
  return codePourFenetre(secret, Math.floor(maintenant / 1000 / PAS_SECONDES));
}

/**
 * Le code présenté est-il le bon ?
 *
 * Rend la fenêtre acceptée plutôt qu'un simple oui — l'appelant s'en sert pour interdire de
 * rejouer deux fois le même code : six chiffres valables trente secondes se lisent par-dessus une
 * épaule, et sans cette précaution ils resserviraient.
 */
export function verifierCode(secret, presente, maintenant = Date.now()) {
  const propre = String(presente || "").replace(/\D/g, "");
  if (propre.length !== CHIFFRES) return { valide: false };
  if (!secret) return { valide: false };

  const courante = Math.floor(maintenant / 1000 / PAS_SECONDES);
  for (let d = -TOLERANCE; d <= TOLERANCE; d++) {
    const attendu = codePourFenetre(secret, courante + d);
    if (!attendu) return { valide: false };
    /*
     * timingSafeEqual : une comparaison ordinaire s'arrête au premier caractère faux, et la
     * durée de la réponse finit par livrer le code chiffre après chiffre.
     */
    const a = Buffer.from(attendu, "utf8");
    const b = Buffer.from(propre, "utf8");
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
      return { valide: true, fenetre: courante + d };
    }
  }
  return { valide: false };
}

/**
 * L'adresse que porte le QR code d'inscription.
 *
 * C'est le format `otpauth://` que toutes les applications savent lire. L'émetteur et le compte
 * y figurent pour que la personne retrouve la bonne ligne dans son application quand elle en a
 * plusieurs — sans cela, elle verrait six chiffres sans savoir à quoi ils servent.
 */
export function uriInscription(secret, identifiant, emetteur = "Ba-Diaby Express") {
  const compte = `${emetteur}:${identifiant || "compte"}`;
  return `otpauth://totp/${encodeURIComponent(compte)}`
    + `?secret=${secret}`
    + `&issuer=${encodeURIComponent(emetteur)}`
    + `&algorithm=SHA1&digits=${CHIFFRES}&period=${PAS_SECONDES}`;
}

/*
 * LE SECRET NE REDESCEND JAMAIS AU NAVIGATEUR APRÈS L'INSCRIPTION.
 *
 * Il est montré une seule fois, le temps de scanner le QR code. Ensuite il vit côté serveur et
 * nulle part ailleurs : le renvoyer avec la fiche du compte reviendrait à publier la clé du
 * second facteur à chaque chargement de page, et la double authentification n'en serait plus une.
 */
export const CHAMPS_TOTP_SECRETS = ["totpSecret", "totpEnAttente"];
