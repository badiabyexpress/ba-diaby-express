/**
 * Empreintes de mots de passe — les mêmes que celles du navigateur.
 *
 * Ces paramètres doivent correspondre EXACTEMENT à hashPBKDF2 dans src/App.jsx : un compte créé
 * ici doit pouvoir se connecter là-bas, et inversement. Le moindre écart — une itération de plus,
 * un encodage différent — rendrait le compte inutilisable sans que rien ne le signale.
 */

import crypto from "node:crypto";

export const PBKDF2_ITERATIONS = 150000;

export function hashPBKDF2(motDePasse, sel, iterations = PBKDF2_ITERATIONS) {
  return crypto.pbkdf2Sync(motDePasse, sel, iterations, 32, "sha256").toString("hex");
}

/** Sel aléatoire, dans la même forme que celui du navigateur : 32 caractères hexadécimaux. */
export function genererSel() {
  return crypto.randomBytes(16).toString("hex");
}

/** Le jeu de champs qu'un compte porte pour son mot de passe. */
export function identifiantsMotDePasse(motDePasse) {
  const sel = genererSel();
  return {
    motdepasseAlgo: "pbkdf2",
    motdepasseIter: PBKDF2_ITERATIONS,
    motdepasseSalt: sel,
    motdepasseSecure: hashPBKDF2(motDePasse, sel),
  };
}

/** Comparaison à durée constante — voir api/login.js. */
export function egaliteSure(a, b) {
  const A = Buffer.from(String(a || ""), "utf8");
  const B = Buffer.from(String(b || ""), "utf8");
  if (A.length !== B.length) return false;
  return crypto.timingSafeEqual(A, B);
}

/** Code à six chiffres, tiré au sort sans biais. */
export function genererCode() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, "0");
}
