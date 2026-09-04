/*
 * LES ALERTES DE FRAUDE — reconnaître une attaque pendant qu'elle a lieu
 * ─────────────────────────────────────────────────────────────────────────────
 * Le site sait déjà se défendre : les essais sont plafonnés, les mots de passe passent par
 * 150 000 tours de PBKDF2, un second facteur garde les comptes qui l'ont activé. Tout cela RALENTIT
 * une attaque. Rien, jusqu'ici, ne la RACONTAIT.
 *
 * La différence n'est pas théorique. Un automate qui essaie deux cents mots de passe sur le compte
 * de la comptable est arrêté par le plafond — et personne ne l'apprend. Il revient le lendemain, et
 * le surlendemain, avec une liste plus longue. Le jour où il trouve, la connexion réussie ressemble
 * à toutes les autres : même écran, même heure, aucune trace de ce qui a précédé. C'est cela qu'on
 * répare ici.
 *
 * POURQUOI CE FICHIER EST PUR, ET POURQUOI LE NAVIGATEUR L'IMPORTE
 * ---------------------------------------------------------------
 * Il ne lit ni base, ni variable d'environnement, ni module de Node : il prend un document et rend
 * une liste. La tâche de nuit s'en sert pour envoyer un courriel, et la cloche de l'application
 * s'en sert pour afficher la même chose en direct.
 *
 * Une seule définition, donc, et c'est délibéré : deux copies d'une règle de détection, c'est une
 * qui cesse un jour de correspondre à l'autre — et personne ne s'en aperçoit, puisque le propre
 * d'une alerte qui ne part plus est de ne rien dire.
 *
 * CE QU'ON DÉTECTE, ET CE QU'ON NE PRÉTEND PAS DÉTECTER
 * ----------------------------------------------------
 * On travaille sur le journal des accès et sur les comptes : des faits déjà consignés. On ne
 * devine pas une intention, on constate une FORME — beaucoup d'échecs au même endroit, beaucoup
 * d'identifiants essayés depuis la même adresse, une réussite juste après une rafale.
 *
 * On ne prétend pas repérer un employé qui détourne de l'argent : cela se voit dans les écritures,
 * pas dans les connexions, et une alerte qui promettrait cela ferait baisser la garde là où il
 * faudrait au contraire regarder les comptes.
 *
 * LES SEUILS SONT ÉCRITS POUR UNE PETITE ÉQUIPE, PAS POUR UNE BANQUE
 * -----------------------------------------------------------------
 * Une agence de Conakry, c'est une dizaine de personnes qui partagent une sortie internet et se
 * trompent de mot de passe le lundi matin. Des seuils de banque sonneraient tous les jours, et la
 * première chose qu'on apprend d'une alerte qui crie tout le temps, c'est à ne plus la lire.
 * Chaque seuil ci-dessous est donc justifié par ce qui arrive normalement dans cette entreprise.
 */

/** Une heure : la fenêtre dans laquelle une rafale reste une rafale. */
const HEURE = 3600 * 1000;
const JOUR = 24 * HEURE;

/*
 * SIX ÉCHECS SUR LE MÊME COMPTE EN UNE HEURE.
 *
 * Trois seraient trop peu : quelqu'un qui revient de congé se trompe deux ou trois fois, essaie
 * l'ancien mot de passe, puis celui d'un autre site. Six, en revanche, ne s'explique plus par la
 * mémoire — c'est une liste qu'on déroule.
 */
const ECHECS_PAR_COMPTE = 6;

/*
 * CINQ IDENTIFIANTS DIFFÉRENTS DEPUIS LA MÊME ADRESSE.
 *
 * C'est l'attaque qu'aucun plafond par compte ne voit : un seul mot de passe très courant, essayé
 * sur cent identifiants. Chaque compte n'est touché qu'une fois, donc rien ne se déclenche — et
 * c'est pourtant ainsi qu'on entre le plus souvent, parce qu'il suffit d'une personne qui ait
 * choisi « 123456 ».
 *
 * Cinq, parce qu'une agence partage une sortie internet : trois collègues qui se trompent le même
 * matin ne doivent pas passer pour un balayage.
 */
const IDENTIFIANTS_PAR_ADRESSE = 5;

/*
 * CE QUI PRÉCÈDE UNE RÉUSSITE SUSPECTE.
 *
 * Quatre échecs puis une réussite, sur le même compte, dans l'heure. Le seuil est plus bas que
 * celui d'une rafale seule, et c'est voulu : ici il ne s'agit plus d'un essai qui a échoué, mais
 * d'un essai qui a ABOUTI. Le coût d'une fausse alerte — un courriel de trop — n'a aucune commune
 * mesure avec celui d'un silence.
 */
const ECHECS_AVANT_REUSSITE = 4;

/*
 * DIX COMPTES CLIENTS CRÉÉS EN UNE HEURE.
 *
 * N'importe qui peut créer un compte client depuis la page d'accueil : c'est fait pour, et c'est
 * la porte la plus ouverte du site. Une journée chargée au comptoir en produit cinq ou six ; dix
 * en une heure ne vient pas d'un comptoir.
 */
const COMPTES_PAR_HEURE = 10;

/*
 * Trois jours pour les connexions depuis un appareil inconnu.
 *
 * Elles sont déjà signalées une par une, par courriel, au moment où elles arrivent. Les regrouper
 * ici sert à voir la répétition — une seule est banale, quatre en trois jours ne l'est plus.
 */
const FENETRE_INHABITUELLES = 3 * JOUR;
const INHABITUELLES_REPETEES = 3;

const liste = (x) => (Array.isArray(x) ? x : []);
const instant = (v) => { const t = Date.parse(v || ""); return Number.isFinite(t) ? t : null; };

/** Le journal, du plus récent au plus ancien, réduit à la fenêtre demandée. */
function entreesDepuis(document, maintenant, fenetre) {
  return liste(document?.journalAcces)
    .filter((e) => {
      const t = instant(e?.le);
      return t !== null && maintenant - t <= fenetre && t <= maintenant + HEURE;
    })
    .sort((a, b) => instant(b.le) - instant(a.le));
}

/** Regroupe une liste par une clé, en ignorant les clés vides. */
function grouper(entrees, cleDe) {
  const paquets = new Map();
  entrees.forEach((e) => {
    const cle = cleDe(e);
    if (!cle) return;
    if (!paquets.has(cle)) paquets.set(cle, []);
    paquets.get(cle).push(e);
  });
  return paquets;
}

/**
 * Quelqu'un s'acharne sur un compte précis.
 *
 * On compte par identifiant VISÉ, et non par compte trouvé : un identifiant qui n'existe pas
 * produit exactement le même refus, et c'est justement ce qu'on veut voir — quelqu'un qui essaie
 * « admin », « administrateur », « root » ne touche aucun compte réel, et c'est un signal.
 */
export function acharnementsSurUnCompte(document, maintenant = Date.now()) {
  const refus = entreesDepuis(document, maintenant, HEURE).filter((e) => e.resultat === "refusee");
  const sorties = [];
  grouper(refus, (e) => String(e.identifiant || "").trim().toLowerCase()).forEach((paquet, identifiant) => {
    if (paquet.length < ECHECS_PAR_COMPTE) return;
    const adresses = [...new Set(paquet.map((e) => e.adresse).filter(Boolean))];
    sorties.push({
      cle: `acharnement:${identifiant}`,
      gravite: "grave",
      identifiant,
      essais: paquet.length,
      adresses,
      depuis: paquet[paquet.length - 1].le,
      quoi: `${paquet.length} mots de passe essayés sur « ${identifiant} »`,
      detail: adresses.length === 1
        ? `Toutes depuis ${adresses[0]}, en moins d’une heure.`
        : `Depuis ${adresses.length} adresses différentes, en moins d’une heure.`,
    });
  });
  return sorties.sort((a, b) => b.essais - a.essais);
}

/**
 * Un seul mot de passe, essayé sur beaucoup de comptes.
 *
 * L'attaque que le plafond par compte ne voit pas, parce qu'elle ne touche chaque compte qu'une
 * fois. C'est le compteur par connexion qui l'arrête ; c'est celui-ci qui la raconte.
 */
export function balayagesDIdentifiants(document, maintenant = Date.now()) {
  const refus = entreesDepuis(document, maintenant, HEURE).filter((e) => e.resultat === "refusee");
  const sorties = [];
  grouper(refus, (e) => String(e.adresse || "").trim()).forEach((paquet, adresse) => {
    if (adresse === "inconnue") return;
    const vises = [...new Set(paquet.map((e) => String(e.identifiant || "").trim().toLowerCase()).filter(Boolean))];
    if (vises.length < IDENTIFIANTS_PAR_ADRESSE) return;
    sorties.push({
      cle: `balayage:${adresse}`,
      gravite: "grave",
      adresse,
      identifiants: vises,
      essais: paquet.length,
      depuis: paquet[paquet.length - 1].le,
      quoi: `${vises.length} identifiants différents essayés depuis ${adresse}`,
      detail: `Un même mot de passe essayé sur plusieurs comptes — l’attaque qu’aucun plafond par compte ne voit. Visés : ${vises.slice(0, 6).join(", ")}${vises.length > 6 ? "…" : ""}`,
    });
  });
  return sorties.sort((a, b) => b.identifiants.length - a.identifiants.length);
}

/**
 * LE SIGNAL QUI COMPTE LE PLUS : une réussite au bout d'une rafale.
 *
 * Une connexion réussie ne se distingue de rien, prise seule. Précédée de quatre échecs sur le
 * même compte dans l'heure, elle raconte autre chose : quelqu'un a cherché, et a fini par trouver.
 *
 * On ne dit pas « c'est une intrusion » — la personne a pu se tromper quatre fois puis se
 * souvenir. On dit ce qu'on voit, et l'on donne le geste qui referme si ce n'était pas elle.
 */
export function reussitesApresRafale(document, maintenant = Date.now()) {
  const entrees = entreesDepuis(document, maintenant, JOUR);
  const sorties = [];
  entrees.filter((e) => e.resultat === "reussie").forEach((reussite) => {
    const quand = instant(reussite.le);
    const vise = String(reussite.identifiant || "").trim().toLowerCase();
    if (!quand || !vise) return;
    const echecsAvant = entrees.filter((e) => {
      if (e.resultat !== "refusee") return false;
      if (String(e.identifiant || "").trim().toLowerCase() !== vise) return false;
      const t = instant(e.le);
      return t !== null && t < quand && quand - t <= HEURE;
    });
    if (echecsAvant.length < ECHECS_AVANT_REUSSITE) return;
    sorties.push({
      cle: `apres-rafale:${reussite.id || reussite.le}`,
      gravite: "grave",
      identifiant: vise,
      essais: echecsAvant.length,
      le: reussite.le,
      adresse: reussite.adresse,
      appareil: reussite.appareilLisible || "appareil inconnu",
      /* Une réussite depuis un appareil jamais vu APRÈS une rafale est le pire des deux cas. */
      inhabituelle: !!reussite.inhabituelle,
      quoi: `Connexion réussie sur « ${vise} » après ${echecsAvant.length} échecs`,
      detail: `${reussite.inhabituelle ? "Depuis un appareil jamais vu pour ce compte" : `Depuis ${reussite.appareilLisible || "un appareil inconnu"}`}, ${reussite.adresse || "adresse inconnue"}. Si ce n’est pas la personne elle-même, changez son mot de passe et déconnectez-la de tous ses appareils.`,
    });
  });
  return sorties;
}

/**
 * Des comptes clients créés en rafale.
 *
 * C'est la porte la plus ouverte du site — n'importe qui peut en créer un depuis la page
 * d'accueil, et c'est fait pour. Une rafale n'est pas forcément une attaque : ce peut être un
 * script qui teste, quelqu'un qui remplit la base pour la ralentir, ou une inscription qui boucle
 * sur un téléphone. Dans les trois cas, on veut le savoir le jour même et non au prochain export.
 */
export function inscriptionsEnRafale(document, maintenant = Date.now()) {
  const recents = liste(document?.clientAccounts)
    .map((c) => ({ c, t: instant(c?.createdAt) }))
    .filter((x) => x.t !== null && maintenant - x.t <= HEURE)
    .sort((a, b) => b.t - a.t);
  if (recents.length < COMPTES_PAR_HEURE) return [];
  return [{
    cle: "inscriptions-rafale",
    gravite: "alerte",
    compte: recents.length,
    depuis: recents[recents.length - 1].c.createdAt,
    quoi: `${recents.length} comptes clients créés en une heure`,
    detail: "La création de compte est ouverte à tous, sans vérification préalable. Vérifiez qu’il s’agit bien d’inscriptions au comptoir.",
  }];
}

/**
 * Des connexions depuis des appareils jamais vus, qui se répètent.
 *
 * Chacune est déjà signalée par courriel au moment où elle arrive. Une seule est banale — un
 * téléphone neuf, un déplacement. Trois en trois jours sur des comptes différents ne l'est plus :
 * c'est la forme que prend une liste de mots de passe qui a marché plusieurs fois.
 */
export function connexionsInhabituellesRepetees(document, maintenant = Date.now()) {
  const marquees = entreesDepuis(document, maintenant, FENETRE_INHABITUELLES)
    .filter((e) => e.resultat === "reussie" && e.inhabituelle);
  if (marquees.length < INHABITUELLES_REPETEES) return [];
  const comptes = [...new Set(marquees.map((e) => e.identifiant).filter(Boolean))];
  return [{
    cle: "inhabituelles-repetees",
    gravite: "alerte",
    compte: marquees.length,
    identifiants: comptes,
    quoi: `${marquees.length} connexions depuis des appareils inconnus en trois jours`,
    detail: comptes.length > 1
      ? `Sur ${comptes.length} comptes : ${comptes.slice(0, 6).join(", ")}${comptes.length > 6 ? "…" : ""}.`
      : `Toutes sur « ${comptes[0] || "?"} ».`,
  }];
}

/**
 * Tout ce qui, dans ce document, ressemble à une attaque en cours.
 *
 * L'ordre n'est pas cosmétique : le plus grave d'abord, parce qu'une liste se lit par le haut et
 * qu'on ne descend pas toujours jusqu'au bout.
 */
export function signauxDeFraude(document, maintenant = Date.now()) {
  if (!document || typeof document !== "object") return [];
  return [
    ...reussitesApresRafale(document, maintenant),
    ...acharnementsSurUnCompte(document, maintenant),
    ...balayagesDIdentifiants(document, maintenant),
    ...inscriptionsEnRafale(document, maintenant),
    ...connexionsInhabituellesRepetees(document, maintenant),
  ];
}

/** Le résumé gardé dans le relevé de nuit — assez pour la cloche, jamais le journal entier. */
export function releveDeFraude(document, maintenant = Date.now()) {
  const signaux = signauxDeFraude(document, maintenant);
  return {
    le: new Date(maintenant).toISOString(),
    graves: signaux.filter((s) => s.gravite === "grave").length,
    total: signaux.length,
    /* Cinq au plus : ce relevé voyage dans le document que chaque page recharge. */
    signaux: signaux.slice(0, 5).map((s) => ({ cle: s.cle, gravite: s.gravite, quoi: s.quoi, detail: s.detail })),
  };
}

const echapper = (texte) => String(texte == null ? "" : texte)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Le courriel de la nuit, quand il y a quelque chose à dire.
 *
 * Il dit d'abord ce qui a été vu, ensuite quoi faire. Une alerte qui décrit un risque sans nommer
 * le geste qui le referme laisse son lecteur inquiet et sans prise — et, la fois d'après, il ne
 * l'ouvre plus.
 */
/*
 * `entete` est PASSÉ PAR L'APPELANT, et non fabriqué ici — ce fichier doit rester pur.
 *
 * Le navigateur l'importe pour calculer la cloche en direct (voir l'en-tête). Lui faire lire une
 * variable d'environnement le ferait tomber à l'ouverture de la page : `process` n'existe pas dans
 * un navigateur. La règle vaut pour tout ce qui sera ajouté ici.
 */
export function corpsAlerteFraude(signaux, document, entete = "") {
  const nom = document?.branding?.nom || "Ba-Diaby Express";
  const graves = signaux.filter((s) => s.gravite === "grave").length;
  const lignes = signaux.map((s) => `
    <tr>
      <td style="padding:10px 12px;border-top:1px solid #eee;vertical-align:top">
        <div style="font-weight:700;color:${s.gravite === "grave" ? "#B3253A" : "#8A6410"}">${echapper(s.quoi)}</div>
        <div style="color:#555;font-size:13.5px;margin-top:3px">${echapper(s.detail)}</div>
      </td>
    </tr>`).join("");
  return {
    sujet: `${nom} — ${graves > 0 ? "tentatives d’intrusion détectées" : "activité inhabituelle sur les connexions"}`,
    html: `
      <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;color:#0A2647;line-height:1.6">
        ${entete}
        <p><strong>Le relevé de cette nuit a repéré ${signaux.length} chose${signaux.length > 1 ? "s" : ""} inhabituelle${signaux.length > 1 ? "s" : ""} sur les connexions.</strong></p>
        <table style="border-collapse:collapse;margin:14px 0;width:100%">${lignes}</table>
        <p style="font-size:13.5px">
          <strong>Ce qu’il y a à faire :</strong> ouvrez Configuration → Journal des accès pour voir
          les entrées complètes. Si un compte a pu être ouvert par quelqu’un d’autre, réinitialisez
          son mot de passe et déconnectez-le de tous ses appareils — les deux gestes sont sur la
          même ligne, dans Gestion Utilisateurs. La déconnexion coupe la session en cours
          immédiatement, où qu’elle soit.
        </p>
        <p style="font-size:13.5px;color:#555">
          Activer la double authentification sur les comptes visés est ce qui referme durablement :
          un mot de passe trouvé ne suffit alors plus à entrer.
        </p>
        <p style="color:#999;font-size:12px;margin-top:22px">
          Message automatique. Les essais sont déjà plafonnés et bloqués — ce message dit ce qui a
          été tenté, pas ce qui a réussi, sauf mention contraire ci-dessus.
        </p>
      </div>`,
  };
}
