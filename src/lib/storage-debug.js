/**
 * 🔧 OUTIL DE DIAGNOSTIC ET DÉBLOCAGE - File d'attente Supabase
 * 
 * Utilitaires pour diagnostiquer et résoudre les blocages de synchronisation
 */

import { detailFileAttente, abandonnerEcriture, flushOutbox, pendingSyncCount } from "./storage.js";

/**
 * Affiche l'état détaillé de la file d'attente
 */
export function afficherEtatFile() {
  const nombre = pendingSyncCount();
  const details = detailFileAttente();
  
  console.group("📊 ÉTAT DE LA FILE D'ATTENTE");
  console.log(`Total en attente: ${nombre}`);
  
  if (nombre === 0) {
    console.log("✅ La file est vide - tout est synchronisé");
    console.groupEnd();
    return { nombre, details };
  }
  
  details.forEach((item, idx) => {
    const now = Date.now();
    const duree = item.depuis ? Math.round((now - item.depuis) / 1000) : "?";
    const status = item.erreur ? "❌" : "⏳";
    
    console.group(`${status} Écriture #${idx + 1}`);
    console.log(`Clé: ${item.cle}`);
    console.log(`Depuis: ${duree}s`);
    console.log(`Tentatives: ${item.essais}`);
    if (item.erreur) {
      console.error(`Erreur: ${item.erreur}`);
    }
    console.log(`Contenu: `, item.contenu);
    console.groupEnd();
  });
  
  console.groupEnd();
  return { nombre, details };
}

/**
 * Force la synchronisation immédiate
 */
export async function forcerSynchronisation() {
  console.log("🔄 Forçage de la synchronisation...");
  try {
    const result = await flushOutbox({ forcer: true });
    console.log("✅ Synchronisation terminée:", result);
    return result;
  } catch (e) {
    console.error("❌ Erreur lors de la synchronisation:", e);
    throw e;
  }
}

/**
 * Abandonne une écriture bloquée (DANGER - utiliser avec précaution)
 */
export function abandonnerEcritureBloquee(cleOuIndex) {
  console.warn("⚠️  ABANDON D'UNE ÉCRITURE - CETTE ACTION SUPPRIME DES DONNÉES EN ATTENTE");
  
  const details = detailFileAttente();
  let cle = cleOuIndex;
  
  // Si c'est un index, récupérer la clé
  if (typeof cleOuIndex === "number" && details[cleOuIndex]) {
    cle = details[cleOuIndex].cle;
  }
  
  console.log(`Suppression de l'écriture pour la clé: ${cle}`);
  const result = abandonnerEcriture(cle);
  console.log(`Écritures restantes: ${result.restant}`);
  
  return result;
}

/**
 * Récupère les détails bruts pour débogage
 */
export function obtenirDetailsFichier() {
  try {
    const file = localStorage.getItem("bde-outbox") || "[]";
    return JSON.parse(file);
  } catch (e) {
    console.error("Erreur lors de la lecture du localStorage:", e);
    return [];
  }
}

/**
 * Nettoie les écritures qui ont plus de X heures
 */
export function nettoyerEcrituresAnciennnes(heures = 6) {
  const limit = Date.now() - (heures * 60 * 60 * 1000);
  const file = obtenirDetailsFichier();
  const avant = file.length;
  
  const apres = file.filter(item => {
    return !item.ts || item.ts > limit;
  });
  
  const supprimees = avant - apres.length;
  
  if (supprimees > 0) {
    try {
      localStorage.setItem("bde-outbox", JSON.stringify(apres));
      console.log(`🗑️  ${supprimees} écriture(s) de plus de ${heures}h supprimée(s)`);
    } catch (e) {
      console.error("Erreur lors de la sauvegarde:", e);
    }
  } else {
    console.log("✅ Aucune ancienne écriture à nettoyer");
  }
  
  return { supprimees, restantes: apres.length };
}

/**
 * Interface globale pour déboguer
 */
export function activerDebugMode() {
  window.debugBDE = {
    etat: afficherEtatFile,
    forcer: forcerSynchronisation,
    abandonner: abandonnerEcritureBloquee,
    raw: obtenirDetailsFichier,
    nettoyer: nettoyerEcrituresAnciennnes,
  };
  
  console.log(
    "%c🛠️ MODE DEBUG ACTIVÉ",
    "font-weight: bold; font-size: 14px; color: #ff6b00;"
  );
  console.log("Utilisez window.debugBDE pour accéder aux outils:");
  console.log("  - window.debugBDE.etat()          : voir l'état de la file");
  console.log("  - window.debugBDE.forcer()        : forcer la synchronisation");
  console.log("  - window.debugBDE.abandonner(0)   : supprimer l'écriture #1");
  console.log("  - window.debugBDE.raw()           : données brutes");
  console.log("  - window.debugBDE.nettoyer(6)     : nettoyer écritures > 6h");
}
