/*
 * L'ADRESSE D'EXPÉDITION — une seule lecture de EMAIL_FROM, pour tout le monde
 * ─────────────────────────────────────────────────────────────────────────────
 * CE QUI S'EST PASSÉ, ET QU'IL FAUT ÉCRIRE ICI POUR QUE ÇA NE RECOMMENCE PAS.
 *
 * api/email.js — celui qui envoie les documents aux clients — réparait déjà les deux fautes de
 * saisie courantes de cette variable avant de la donner à Resend. Il marchait.
 *
 * Les cinq autres expéditeurs du serveur — la copie de secours hors site, le bilan quotidien,
 * l'alerte d'écrasement, l'alerte de connexion inhabituelle, l'alerte de fraude — donnaient
 * `process.env.EMAIL_FROM` TEL QUEL. Resend répondait :
 *
 *     422 validation_error — Invalid `from` field. The email address needs to follow the
 *     `email@example.com` or `Name <email@example.com>` format.
 *
 * Résultat visible en production : les courriels aux clients partaient, et AUCUN courriel
 * automatique ne partait — la copie de secours hors du serveur a échoué toutes les nuits depuis le
 * 31 août sans que rien ne l'annonce. On a cherché du côté du domaine, qui était vérifié, et du
 * DNS, qui était correct. C'était un caractère manquant, lu correctement à un endroit sur six.
 *
 * D'où ce fichier : la variable ne se lit plus qu'ici. Un expéditeur ajouté demain ne pourra pas
 * réintroduire la faute sans passer devant cette page.
 *
 * Le préfixe `_` est ce qui empêche l'hébergeur de publier ce fichier comme une fonction : ce
 * n'est pas une porte, c'est un outil.
 */

/** Une adresse nue, sans nom ni chevrons. */
const ADRESSE_SEULE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Lit EMAIL_FROM et en rend la forme que Resend accepte, ou dit pourquoi il n'y en a pas.
 *
 * On répare les deux fautes de saisie courantes plutôt que de les refuser. Cette valeur se saisit
 * dans l'interface de Vercel, souvent depuis un téléphone : les chevrons demandent d'aller chercher
 * la table des symboles et se perdent en route ; les guillemets, eux, s'ajoutent par réflexe. Dans
 * les deux cas Resend refuse sans dire lequel des deux manque.
 *
 * Rien n'est deviné : on ne reconstruit l'adresse que si la fin de la valeur EST une adresse
 * e-mail. Ce qui précède devient le nom affiché.
 */
export function analyserExpediteur(valeur) {
  let brut = String(valeur || "").trim();
  // Guillemets englobants, simples ou doubles.
  const englobants = /^(["'])([\s\S]*)\1$/.exec(brut);
  if (englobants) brut = englobants[2].trim();

  const entreChevrons = /<([^>]+)>\s*$/.exec(brut);
  if (entreChevrons) {
    const adresse = entreChevrons[1].trim();
    const valide = ADRESSE_SEULE.test(adresse);
    const nom = brut.slice(0, entreChevrons.index).trim().replace(/^(["'])([\s\S]*)\1$/, "$2");
    return {
      valide,
      domaine: valide ? adresse.split("@")[1] : null,
      avecNom: !!nom,
      normalise: valide ? (nom ? `${nom} <${adresse}>` : adresse) : null,
    };
  }

  if (ADRESSE_SEULE.test(brut)) {
    return { valide: true, domaine: brut.split("@")[1], avecNom: false, normalise: brut };
  }

  // « Ba-Diaby Express contact@badiabyexpress.com » — les chevrons manquent, on les remet.
  const morceaux = brut.split(/\s+/);
  const derniere = morceaux[morceaux.length - 1] || "";
  if (morceaux.length > 1 && ADRESSE_SEULE.test(derniere)) {
    const nom = morceaux.slice(0, -1).join(" ").replace(/^(["'])([\s\S]*)\1$/, "$2").trim();
    return {
      valide: true,
      domaine: derniere.split("@")[1],
      avecNom: !!nom,
      normalise: nom ? `${nom} <${derniere}>` : derniere,
      repare: true,
    };
  }

  return { valide: false, domaine: null, avecNom: false, normalise: null };
}

/**
 * L'adresse à mettre dans `from`, ou null.
 *
 * C'est CETTE fonction que doit appeler tout expéditeur, jamais `process.env.EMAIL_FROM`
 * directement. Un null se traite comme une absence de configuration : mieux vaut dire « pas
 * configuré » que faire refuser l'envoi par Resend avec un code que personne n'ira lire.
 */
export function expediteurCourriel() {
  return analyserExpediteur(process.env.EMAIL_FROM).normalise;
}
