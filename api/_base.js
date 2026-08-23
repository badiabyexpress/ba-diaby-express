/**
 * Accès à la base avec la clé de service — le petit socle commun aux fonctions serveur.
 *
 * POURQUOI CE FICHIER
 * -------------------
 * api/donnees.js, api/inscription.js et api/motdepasse.js font toutes la même chose : lire une
 * ligne de `bde_data`, en écrire une, avec la clé de service. Trois copies de ce code, ce sont
 * trois occasions de corriger un défaut à deux endroits sur trois.
 *
 * Le préfixe `_` est ce qui empêche Vercel de publier ce fichier comme une fonction : ce n'est
 * pas une porte, c'est un outil.
 */

const TABLE = "bde_data";

export function configurationBase() {
  return {
    url: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    cle: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

export function baseConfiguree() {
  const { url, cle } = configurationBase();
  return !!(url && cle);
}

function entetes(cle) {
  return { apikey: cle, Authorization: `Bearer ${cle}`, "Content-Type": "application/json" };
}

/** Lit une clé. Retourne { valeur, updated_at } ; `valeur` vaut null si la clé n'existe pas. */
export async function lireCle(clef) {
  const { url, cle } = configurationBase();
  const reponse = await fetch(
    `${url}/rest/v1/${TABLE}?key=eq.${encodeURIComponent(clef)}&select=value,updated_at`,
    { headers: entetes(cle) },
  );
  if (!reponse.ok) throw new Error(`lecture_${reponse.status}`);
  const lignes = await reponse.json();
  const ligne = Array.isArray(lignes) ? lignes[0] : null;
  return { valeur: ligne ? ligne.value : null, updated_at: ligne ? ligne.updated_at || null : null };
}

/** Écrit une clé, en écrasant ce qui s'y trouvait. */
export async function ecrireCle(clef, valeur) {
  const { url, cle } = configurationBase();
  const reponse = await fetch(`${url}/rest/v1/${TABLE}?on_conflict=key`, {
    method: "POST",
    headers: { ...entetes(cle), Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ key: clef, value: valeur, updated_at: new Date().toISOString() }),
  });
  if (!reponse.ok) {
    const detail = await reponse.text().catch(() => "");
    throw new Error(`ecriture_${reponse.status}:${detail.slice(0, 200)}`);
  }
}

/**
 * Modifie le document principal sous une relecture immédiate.
 *
 * Deux personnes peuvent écrire en même temps — un agent qui enregistre un colis pendant qu'un
 * client crée son compte. Relire juste avant de transformer réduit la fenêtre pendant laquelle
 * l'un peut effacer le travail de l'autre. Ce n'est pas une transaction : Postgres n'en offre pas
 * sur une écriture via l'API REST. Mais entre relire et ne pas relire, il n'y a pas à hésiter.
 */
export async function modifierDocument(transformer) {
  const { valeur } = await lireCle("bde-data");
  if (!valeur || typeof valeur !== "object") throw new Error("document_absent");
  const resultat = transformer(valeur);
  // Un transformateur peut renoncer : il retourne alors null, et rien n'est écrit.
  if (!resultat) return null;
  await ecrireCle("bde-data", resultat.document);
  return resultat.retour ?? null;
}
