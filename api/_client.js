/**
 * Ce qu'un compte client a le droit de voir, et ce qu'il a le droit d'écrire.
 *
 * POURQUOI CE FICHIER
 * -------------------
 * Toutes les données de l'entreprise tiennent dans un seul document. api/donnees.js limitait
 * jusqu'ici QUELLES CLÉS une session peut demander — mais pas ce qu'il y a dedans. Un compte
 * client, que n'importe qui peut créer depuis la page d'accueil, recevait donc le document
 * entier : les colis de tous les autres clients avec leurs noms, leurs téléphones et ce qu'ils
 * ont payé, le répertoire, le journal d'activité, la caisse, les tarifs du partenaire, et la
 * liste des employés avec l'empreinte de leur mot de passe.
 *
 * Le tri se fait ICI, sur le serveur. C'est le seul endroit qui tienne : le navigateur du client
 * exécute du code qu'il peut modifier, et un écran ne cache rien à qui ouvre les outils de
 * développement.
 *
 * DEUX SENS, DEUX RÈGLES
 * ----------------------
 * En lecture, une LISTE BLANCHE : ce qui n'y figure pas ne sort pas. Une section ajoutée plus
 * tard est donc privée par défaut — c'est l'inverse d'une liste noire, qu'on oublie de compléter
 * le jour où l'on ajoute une section, et qui ne se trahit jamais avant la fuite.
 *
 * En écriture, on ne retient du document envoyé que les fragments qui appartiennent à ce client,
 * et on les repose sur le document réel. Le portail continue d'envoyer le document entier, comme
 * avant, et ce qu'il n'a pas le droit de changer est simplement ignoré. Sans cette moitié-là, le
 * tri en lecture serait pire que rien : le client renverrait le document amputé, et effacerait
 * d'un seul enregistrement tout ce qu'on venait de lui cacher.
 */

/*
 * Ce que tout le monde peut voir.
 *
 * Ces sections s'impriment déjà sur les tickets, s'affichent sur la vitrine publique, ou n'ont de
 * sens qu'affichées : l'adresse des agences, le calendrier des départs, les taux de change, les
 * moyens de paiement acceptés. Les cacher au client n'apporterait rien et casserait son espace.
 */
export const SECTIONS_PARTAGEES = [
  "branding",
  "entreprise",
  "sites",
  "agencesReception",
  "agenceRetraitClient",
  "departs",
  "exchangeRates",
  "tauxMisAJourLe",
  "categories",
  "paymentConfig",
  "expressTarifEurKg",
  "theme",
  "lang",
];

/*
 * Tout ce qui touche au mot de passe reste au serveur.
 *
 * Le portail n'en a aucun usage : la connexion se vérifie dans api/login.js, et le changement de
 * mot de passe envoie une empreinte neuve sans avoir besoin de l'ancienne. Une empreinte qui ne
 * part pas est une empreinte qu'on ne peut pas attaquer hors ligne.
 */
const CHAMPS_MOT_DE_PASSE = [
  "motdepasse", "motdepasseSecure", "motdepasseSalt", "motdepasseIter", "motdepasseAlgo",
];

/*
 * Ce qu'un colis ne dit pas à son destinataire : les notes que l'agence prend pour elle-même, et
 * le prix convenu avec un partenaire — que l'application ne doit jamais exposer, à personne.
 */
const CHAMPS_COLIS_INTERNES = ["notesInternes", "prixPartenaire", "devisePartenaire"];

/*
 * Ce qu'un client peut changer sur SON colis : demander l'expédition express, déclarer un
 * paiement, signaler un problème. Rien d'autre — ni le poids, ni le prix, ni le statut, qui sont
 * constatés par l'agence et engagent l'entreprise.
 */
const CHAMPS_COLIS_MODIFIABLES = ["demandeExpress", "declarationsPaiement", "signalements"];

/** Les listes personnelles, reconnues à l'identifiant de compte que porte chaque élément. */
const LISTES_PERSONNELLES = ["preAlertes", "demandesRegroupement"];

/*
 * Ce qu'un client peut changer sur SON compte : ses coordonnées, ses messages à l'agence, la date
 * de sa dernière visite, et son mot de passe.
 *
 * Pas son identifiant, ni son nom : ils ont été constatés à l'inscription et servent à le
 * retrouver. Pas son identifiant technique non plus, sans quoi il écrirait dans la fiche d'un
 * autre. Une liste blanche, là encore : le jour où le portail gagnera un réglage, il faudra
 * l'ajouter ici — un réglage qui ne s'enregistre pas se remarque tout de suite, une porte laissée
 * ouverte jamais.
 */
const CHAMPS_COMPTE_MODIFIABLES = [
  "telephone", "adresse", "email", "messages", "derniereVisite",
  "motdepasseSecure", "motdepasseSalt", "motdepasseIter", "motdepasseAlgo",
];

function liste(valeur) {
  return Array.isArray(valeur) ? valeur : [];
}

function sans(objet, champs) {
  if (!objet || typeof objet !== "object") return objet;
  const sortie = { ...objet };
  champs.forEach((c) => { delete sortie[c]; });
  return sortie;
}

/** Les éléments d'une liste qui portent le compte de ce client. */
function aMoi(valeurs, compteId) {
  return liste(valeurs).filter((x) => x && x.clientAccountId === compteId);
}

/**
 * Le document tel qu'un client doit le recevoir.
 *
 * Sans identifiant de compte — un jeton client dont le compte a été supprimé, par exemple — il ne
 * reste que les sections partagées. Un espace vide vaut mieux que l'espace de quelqu'un d'autre.
 */
export function vueClient(donnees, compteId) {
  if (!donnees || typeof donnees !== "object" || Array.isArray(donnees)) return donnees;
  const vue = {};
  SECTIONS_PARTAGEES.forEach((cle) => {
    if (donnees[cle] !== undefined) vue[cle] = donnees[cle];
  });
  vue.colis = aMoi(donnees.colis, compteId).map((c) => sans(c, CHAMPS_COLIS_INTERNES));
  LISTES_PERSONNELLES.forEach((cle) => { vue[cle] = aMoi(donnees[cle], compteId); });
  /*
   * Son compte, et lui seul. Le portail lit `clientAccounts` pour y retrouver le sien : une liste
   * d'un seul élément lui suffit, et les autres n'ont rien à faire dans son navigateur.
   */
  vue.clientAccounts = liste(donnees.clientAccounts)
    .filter((c) => c && c.id === compteId)
    .map((c) => sans(c, CHAMPS_MOT_DE_PASSE));
  return vue;
}

/**
 * Le document réel, augmenté des seules modifications qu'un client avait le droit de faire.
 *
 * On part TOUJOURS de ce que porte la base, jamais de ce qu'envoie le navigateur : c'est ce qui
 * garantit qu'une écriture de client ne peut rien effacer, même si elle arrive amputée, périmée,
 * ou fabriquée à la main.
 */
export function fusionnerEcritureClient(actuel, propose, compteId) {
  const base = actuel && typeof actuel === "object" && !Array.isArray(actuel) ? actuel : {};
  const envoye = propose && typeof propose === "object" && !Array.isArray(propose) ? propose : {};

  const envoyesParTracking = new Map();
  liste(envoye.colis).forEach((c) => { if (c && c.tracking) envoyesParTracking.set(c.tracking, c); });

  const colis = liste(base.colis).map((c) => {
    if (!c || c.clientAccountId !== compteId) return c;
    const envoyeC = envoyesParTracking.get(c.tracking);
    if (!envoyeC) return c;
    const retenu = { ...c };
    CHAMPS_COLIS_MODIFIABLES.forEach((champ) => {
      if (envoyeC[champ] !== undefined) retenu[champ] = envoyeC[champ];
    });
    return retenu;
  });

  /*
   * Les listes personnelles se recomposent : ce qui est aux autres vient du document réel, ce qui
   * est au client vient de ce qu'il envoie — avec son identifiant réimposé, pour qu'un compte ne
   * puisse pas déposer une pré-alerte au nom d'un autre.
   */
  const recomposees = {};
  LISTES_PERSONNELLES.forEach((cle) => {
    recomposees[cle] = [
      ...liste(base[cle]).filter((x) => !x || x.clientAccountId !== compteId),
      ...aMoi(envoye[cle], compteId).map((x) => ({ ...x, clientAccountId: compteId })),
    ];
  });

  /*
   * Son compte : on reprend la fiche telle qu'elle est en base et l'on n'y remplace que les champs
   * qu'il a le droit de changer, quand il les envoie.
   *
   * Rien ne disparaît faute d'avoir été envoyé — c'est ce qui permet de lui cacher son empreinte
   * de mot de passe sans qu'un simple changement d'adresse la lui efface, tout en le laissant
   * changer ce mot de passe, puisqu'il envoie alors une empreinte neuve.
   */
  const envoyeCompte = liste(envoye.clientAccounts).find((x) => x && x.id === compteId);
  const clientAccounts = liste(base.clientAccounts).map((c) => {
    if (!c || c.id !== compteId || !envoyeCompte) return c;
    const retenu = { ...c };
    CHAMPS_COMPTE_MODIFIABLES.forEach((champ) => {
      if (envoyeCompte[champ] !== undefined) retenu[champ] = envoyeCompte[champ];
    });
    return retenu;
  });

  return { ...base, colis, ...recomposees, clientAccounts };
}
