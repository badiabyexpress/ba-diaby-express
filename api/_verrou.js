/*
 * LES VERROUS — ce qui limite ce qu'un automate peut prendre
 * ─────────────────────────────────────────────────────────────────────────────
 * Trois portes de ce site sont ouvertes sans mot de passe : la connexion, la création de compte,
 * et le suivi public d'un colis. Les deux premières comptaient déjà les essais. La troisième, non
 * — et c'est celle qui donne le plus, parce qu'elle donne sans rien demander.
 *
 * Les numéros de suivi se suivent : BDE260801, BDE260802, BDE260803. Un programme qui compte de un
 * en un ramasse, colis après colis, le nom de l'expéditeur et celui du destinataire de toute
 * l'entreprise. Aucune de ces requêtes n'est illégitime prise seule ; c'est leur nombre qui l'est.
 *
 * CE QUE CE FICHIER NE FAIT PAS, ET IL FAUT LE DIRE
 * ------------------------------------------------
 * Le compte est tenu en mémoire, dans l'instance qui répond. Vercel en lance plusieurs, et les
 * éteint : un automate patient, ou réparti sur plusieurs adresses, passera au travers. Ce n'est pas
 * une barrière — c'est un plafond, qui rend l'aspiration lente et voyante là où elle était
 * instantanée et muette. Une vraie barrière demanderait un compteur partagé (base ou service
 * dédié) ; c'est le pas d'après, et il se paie.
 *
 * On garde donc ce qui est vrai : ces verrous arrêtent les automates ordinaires, ceux qui tapent
 * vite depuis une adresse. Ils n'arrêtent pas quelqu'un de déterminé.
 */

/*
 * Une carte par nature de verrou. Séparées, parce que la même adresse peut légitimement suivre
 * des colis et se connecter dans la même minute : mélanger les deux comptes ferait fermer une
 * porte pour un abus commis à l'autre.
 */
const compteurs = new Map();

/* Au-delà, on oublie : la carte ne doit pas grandir tant que l'instance vit. */
const MAX_CLES = 5000;

function purger(carte, maintenant) {
  if (carte.size <= MAX_CLES) return;
  for (const [cle, e] of carte) {
    if (e.expire <= maintenant) carte.delete(cle);
  }
  /* Toujours trop : on vide. Un plafond réinitialisé vaut mieux qu'une mémoire qui enfle. */
  if (carte.size > MAX_CLES) carte.clear();
}

/**
 * Compte un passage et dit s'il est en trop.
 *
 * Rend `{ bloque, restant, dansSecondes }` — `dansSecondes` sert à répondre honnêtement « réessayez
 * dans une minute » plutôt qu'un refus sans horizon, qui donne surtout envie de réessayer tout de
 * suite.
 */
export function passage({ nature, cle, max, fenetreMs, maintenant = Date.now() }) {
  if (!compteurs.has(nature)) compteurs.set(nature, new Map());
  const carte = compteurs.get(nature);
  purger(carte, maintenant);

  const e = carte.get(cle);
  if (!e || e.expire <= maintenant) {
    carte.set(cle, { n: 1, expire: maintenant + fenetreMs });
    return { bloque: false, restant: max - 1, dansSecondes: Math.ceil(fenetreMs / 1000) };
  }
  e.n += 1;
  const dansSecondes = Math.max(1, Math.ceil((e.expire - maintenant) / 1000));
  return { bloque: e.n > max, restant: Math.max(0, max - e.n), dansSecondes };
}

/**
 * L'adresse d'où vient la requête.
 *
 * Derrière Vercel, `x-forwarded-for` porte la chaîne des relais : la PREMIÈRE adresse est celle du
 * visiteur. Prendre la dernière reviendrait à compter tout le monde ensemble sous l'adresse du
 * relais, et à fermer la porte à tous dès le premier automate.
 */
export function adresseDe(req) {
  const brut = req?.headers?.["x-forwarded-for"] || req?.headers?.["x-real-ip"] || "";
  const premiere = String(brut).split(",")[0].trim();
  return premiere || "inconnue";
}

/**
 * Refuse proprement : 429, un délai, et une phrase qui dit quoi faire.
 *
 * `Retry-After` est ce que lisent les robots bien élevés — et ils sont nombreux. Le leur dire
 * évite qu'ils reviennent en boucle.
 */
export function refuser(res, dansSecondes, message) {
  res.setHeader("Retry-After", String(dansSecondes));
  return res.status(429).json({ error: message });
}
