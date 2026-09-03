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

/* ==========================================================================================
 * LES CODES DE SECOURS — ce qui reste quand le téléphone n'est plus là
 * ==========================================================================================
 * Un second facteur bien fait a un défaut par construction : il tient à un objet. Téléphone perdu,
 * volé, tombé dans l'eau, ou simplement remplacé sans avoir pensé à transférer l'application — et
 * la personne est dehors. Définitivement : le secret est réimposé depuis la base à chaque
 * enregistrement, c'est précisément ce qui empêche une page de l'effacer. Personne, pas même un
 * administrateur, ne peut le retirer depuis l'application.
 *
 * Pour le seul compte administrateur de l'entreprise, cela reviendrait à confier les clés de la
 * maison à un appareil qui se casse.
 *
 * Huit codes, donc, tirés une fois, affichés une fois, à imprimer et à ranger. Chacun remplace le
 * téléphone UNE seule fois. C'est ce que font Google, GitHub et les banques, pour cette raison.
 *
 * CE QUI EST GARDÉ, ET CE QUI NE L'EST PAS
 *
 * Le serveur ne garde que des EMPREINTES. Qui lirait la base n'y trouverait pas de quoi entrer :
 * il lui faudrait retrouver le code depuis son empreinte, et un code fait cinquante bits — autant
 * qu'une clé. C'est aussi pourquoi une simple empreinte SHA-256 suffit ici, là où un mot de passe
 * choisi par un humain exige 150 000 tours de PBKDF2 : ce qu'on protège n'est pas devinable.
 *
 * Dix caractères sans O, 0, I ni 1 : ces codes se recopient à la main, souvent depuis une feuille
 * imprimée, parfois dictés au téléphone. Une confusion entre O et 0 sur le dernier recours dont on
 * dispose serait une mauvaise façon de perdre son compte.
 */
const ALPHABET_SECOURS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const LONGUEUR_SECOURS = 10;
export const NOMBRE_CODES_SECOURS = 8;

/** Huit codes neufs, en clair. C'est la seule fois où ils existent sous cette forme. */
export function genererCodesSecours(combien = NOMBRE_CODES_SECOURS) {
  const codes = [];
  for (let i = 0; i < combien; i++) {
    let code = "";
    /* randomBytes, et un rejet des valeurs qui biaiseraient le tirage : 256 n'est pas un multiple
     * de 32, et prendre le reste rendrait les premières lettres plus fréquentes que les autres. */
    while (code.length < LONGUEUR_SECOURS) {
      for (const octet of crypto.randomBytes(LONGUEUR_SECOURS)) {
        if (octet >= 256 - (256 % ALPHABET_SECOURS.length)) continue;
        code += ALPHABET_SECOURS[octet % ALPHABET_SECOURS.length];
        if (code.length === LONGUEUR_SECOURS) break;
      }
    }
    /* Le tiret est pour l'œil : il est retiré à la saisie, on peut donc l'omettre ou le doubler. */
    codes.push(`${code.slice(0, 5)}-${code.slice(5)}`);
  }
  return codes;
}

/**
 * Ce qu'on compare : la saisie débarrassée de tout ce qui n'est pas le code.
 *
 * Tirets, espaces, minuscules : un code recopié depuis une feuille arrive rarement propre, et
 * refuser « abcde fghjk » parce qu'il manque un tiret serait absurde le jour où il sert.
 */
export function normaliserSecours(saisi) {
  const propre = String(saisi || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return propre.length === LONGUEUR_SECOURS ? propre : "";
}

export function empreinteSecours(code) {
  const propre = normaliserSecours(code);
  if (!propre) return null;
  return crypto.createHash("sha256").update(`bde-secours-v1|${propre}`).digest("hex");
}

/** La forme rangée en base : des empreintes, et la date d'usage quand le code a servi. */
export function empreintesDesCodes(codes) {
  return codes.map((c) => ({ h: empreinteSecours(c), le: null }));
}

/**
 * Le code présenté est-il l'un des codes de secours encore valables ?
 *
 * Rend son rang, ou -1. L'appelant s'en sert pour le marquer comme utilisé : un code de secours
 * ne sert qu'une fois, sans quoi une feuille photographiée resterait une porte ouverte.
 */
export function verifierSecours(gardes, presente) {
  const empreinte = empreinteSecours(presente);
  if (!empreinte || !Array.isArray(gardes)) return -1;
  const A = Buffer.from(empreinte, "utf8");
  let trouve = -1;
  /*
   * On parcourt TOUTE la liste, même après avoir trouvé : s'arrêter au bon rang ferait dépendre la
   * durée de la réponse de la position du code, ce qui se mesure.
   */
  gardes.forEach((garde, rang) => {
    if (!garde || garde.le || typeof garde.h !== "string" || garde.h.length !== empreinte.length) return;
    const B = Buffer.from(garde.h, "utf8");
    if (crypto.timingSafeEqual(A, B) && trouve < 0) trouve = rang;
  });
  return trouve;
}

/** Combien il en reste — le seul chiffre que le navigateur a besoin de connaître. */
export function codesSecoursRestants(gardes) {
  return (Array.isArray(gardes) ? gardes : []).filter((g) => g && g.h && !g.le).length;
}

/*
 * LE SECRET NE REDESCEND JAMAIS AU NAVIGATEUR APRÈS L'INSCRIPTION.
 *
 * Il est montré une seule fois, le temps de scanner le QR code. Ensuite il vit côté serveur et
 * nulle part ailleurs : le renvoyer avec la fiche du compte reviendrait à publier la clé du
 * second facteur à chaque chargement de page, et la double authentification n'en serait plus une.
 *
 * Les empreintes des codes de secours suivent la même règle. Elles ne donnent rien à qui les lit,
 * mais elles n'ont rien à faire dans un navigateur non plus : ce qui descend, c'est leur nombre.
 */
export const CHAMPS_TOTP_SECRETS = ["totpSecret", "totpEnAttente", "totpSecours"];
