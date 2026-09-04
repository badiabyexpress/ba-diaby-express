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
 * OÙ LE COMPTE EST TENU, ET POURQUOI CELA A CHANGÉ
 * ------------------------------------------------
 * Il l'était en mémoire, dans l'instance qui répond. Vercel en lance plusieurs et les recycle :
 * deux requêtes tombaient souvent sur deux instances, chacune repartant de zéro. Le plafond de
 * quarante connexions par dix minutes en valait donc, en pratique, bien davantage. Ce fichier le
 * disait honnêtement — « ce n'est pas une barrière, c'est un plafond » — et c'était vrai.
 *
 * Le compte est désormais tenu en base, dans `bde_verrous`, donc commun à toutes les instances.
 * Une seule instruction SQL fait l'insertion ou l'incrément : deux requêtes simultanées ne
 * peuvent pas lire « zéro » toutes les deux avant d'écrire « un ».
 *
 * Le compte en mémoire n'a pas disparu : il est devenu le filet. Si la base ne répond pas, on
 * retombe dessus plutôt que d'ouvrir toutes les portes au moment précis où plus personne ne
 * regarde.
 *
 * CE QUI RESTE VRAI, ET QU'IL FAUT DIRE
 * ------------------------------------
 * Un plafond par adresse n'arrête pas une attaque répartie sur des centaines d'adresses. Cela se
 * met devant le site — pare-feu de l'hébergeur, ou service en frontal — pas dans ce fichier. Ces
 * verrous arrêtent l'automate qui tape vite ; ils rendent lent et voyant celui qui tape lentement.
 */

/*
 * Une carte par nature de verrou. Séparées, parce que la même adresse peut légitimement suivre
 * des colis et se connecter dans la même minute : mélanger les deux comptes ferait fermer une
 * porte pour un abus commis à l'autre.
 */
import { configurationBase } from "./_base.js";

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

/*
 * LE COMPTE EN MÉMOIRE — devenu le filet, plus la barrière.
 *
 * Il ne vaut que dans l'instance qui répond, et Vercel en lance plusieurs. On le garde parce
 * qu'il est le seul à fonctionner quand la base est injoignable : un site dont la base est
 * tombée ne doit pas, en plus, ouvrir ses portes en grand.
 *
 * Rend `{ bloque, restant, dansSecondes }` — `dansSecondes` sert à répondre honnêtement
 * « réessayez dans une minute » plutôt qu'un refus sans horizon, qui donne surtout envie de
 * réessayer tout de suite.
 */
function passageEnMemoire({ nature, cle, max, fenetreMs, maintenant = Date.now() }) {
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

/*
 * LE COMPTE PARTAGÉ — celui qui compte vraiment.
 *
 * Le compteur en mémoire ne valait que dans l'instance qui répond, et Vercel en lance plusieurs :
 * deux requêtes tombaient souvent sur deux instances, chacune repartant de zéro. Le plafond de
 * quarante connexions par dix minutes en valait donc bien davantage.
 *
 * Une seule instruction SQL fait l'insertion ou l'incrément (voir compter_passage) : deux
 * requêtes simultanées ne peuvent pas lire « zéro » toutes les deux avant d'écrire « un ».
 *
 * SI LA BASE NE RÉPOND PAS, ON NE LAISSE PAS PASSER POUR AUTANT.
 *
 * On retombe sur le compte en mémoire. Il est faible, mais il existe — et l'inverse serait pire :
 * une panne de base ouvrirait toutes les portes du site au moment précis où plus personne ne
 * regarde. On ne bloque pas non plus tout le monde : la base est déjà indispensable au reste, un
 * refus général n'ajouterait rien qu'une panne de plus.
 */
export async function passage({ nature, cle, max, fenetreMs, maintenant = Date.now() }) {
  const { url, cle: cleService } = configurationBase();
  if (url && cleService) {
    try {
      const reponse = await fetch(`${url}/rest/v1/rpc/compter_passage`, {
        method: "POST",
        headers: { apikey: cleService, Authorization: `Bearer ${cleService}`, "Content-Type": "application/json" },
        body: JSON.stringify({ p_cle: `${nature}|${cle}`, p_max: max, p_fenetre_ms: fenetreMs }),
      });
      if (reponse.ok) {
        const r = await reponse.json();
        if (r && typeof r.bloque === "boolean") {
          /*
           * Le compte en mémoire est tenu à jour en parallèle : le jour où la base tombera en
           * pleine attaque, le repli ne repartira pas d'une page blanche.
           */
          passageEnMemoire({ nature, cle, max, fenetreMs, maintenant });
          return { bloque: r.bloque, restant: Math.max(0, max - (Number(r.compte) || 0)), dansSecondes: Number(r.dansSecondes) || 60 };
        }
      }
    } catch (e) {
      /* Base injoignable : on descend au filet, sans bruit — ce n'est pas le moment d'échouer. */
    }
  }
  return passageEnMemoire({ nature, cle, max, fenetreMs, maintenant });
}

/**
 * L'adresse d'où vient la requête.
 *
 * Derrière Vercel, `x-forwarded-for` porte la chaîne des relais : la PREMIÈRE adresse est celle du
 * visiteur. Prendre la dernière reviendrait à compter tout le monde ensemble sous l'adresse du
 * relais, et à fermer la porte à tous dès le premier automate.
 */
export function adresseDe(req) {
  const entetes = req?.headers || {};

  /*
   * DERRIÈRE CLOUDFLARE, C'EST « CF-Connecting-IP » QUI FAIT FOI — ET NULLE PART AILLEURS.
   *
   * Si l'on met un service comme Cloudflare devant le site, toutes les requêtes arrivent chez
   * l'hébergeur depuis les adresses de ce service. Sans rien changer, tous les visiteurs se
   * mettent alors à partager le même compteur : un seul robot un peu vif bloquerait le comptoir
   * de Conakry, l'agent de Paris et le client qui suit son colis, tous ensemble.
   *
   * Cloudflare réécrit systématiquement `CF-Connecting-IP` avec l'adresse réelle du visiteur.
   * C'est ce qui en fait une source sûre : le visiteur ne peut pas la fabriquer, elle est
   * remplacée au passage.
   *
   * MAIS SEULEMENT SI L'ON EST VRAIMENT DERRIÈRE. Sans ce service devant, cet en-tête n'est plus
   * réécrit par personne : n'importe qui pourrait l'envoyer, en changer à chaque requête, et
   * repartir avec un compteur neuf à chaque essai. Le verrou deviendrait décoratif.
   *
   * On ne devine donc pas la topologie du réseau — on la déclare. `DERRIERE_CLOUDFLARE=1` dans
   * les variables d'environnement, et seulement quand c'est vrai. Non renseignée, le
   * comportement est exactement celui d'avant : cette ligne peut être posée avant la bascule du
   * DNS, sans rien changer tant qu'elle n'a pas eu lieu.
   */
  if (process.env.DERRIERE_CLOUDFLARE === "1") {
    const reelle = String(entetes["cf-connecting-ip"] || "").trim();
    if (reelle) return reelle;
    /* L'en-tête manque : on retombe sur le chemin ordinaire plutôt que de tout confondre. */
  }

  const brut = entetes["x-forwarded-for"] || entetes["x-real-ip"] || "";
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
