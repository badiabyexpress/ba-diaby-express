/*
 * LES COMMISSIONS — LES RÈGLES, ET RIEN QUE LES RÈGLES.
 * ─────────────────────────────────────────────────────────────────────────────
 * Ce fichier ne parle ni au réseau, ni à la base, ni au navigateur. Il ne lit AUCUNE variable
 * d'environnement — `process` n'existe pas dans un navigateur, et src/App.jsx l'importe. C'est la
 * même discipline que api/_permissions.js, api/_fraude.js et api/_parrainage.js : une seule table
 * de règles, lue par l'écran ET par le serveur.
 *
 * En recopier une moitié dans le serveur aurait marché le premier jour et divergé le second — et
 * une divergence, ici, s'appelle « un montant que l'agent voit à l'écran et que la caisse refuse ».
 *
 * CE QUE PAIE L'ENTREPRISE, ET À QUI.
 *
 *   L'AGENT est payé pour le travail qu'il fait : au poids pour ce qui se facture au poids, à
 *   l'unité pour ce qui se facture à l'unité. Pas au colis — un carton de deux kilos et un de
 *   cinquante ne se portent pas de la même façon.
 *
 *   LE RESPONSABLE DE ZONE est payé pour l'équipe qu'il tient : une part plus petite, sur les colis
 *   que SES agents enregistrent. C'est une commission de supervision : elle ne récompense pas un
 *   geste, elle récompense le fait d'avoir amené et d'encadrer quelqu'un qui fait le geste.
 *
 *   ET IL NE SE SUPERVISE PAS LUI-MÊME. Sur un colis qu'il enregistre de sa main, il touche la
 *   commission d'agent, et rien de plus. Sans cette règle, il gagnerait plus en travaillant seul
 *   qu'en formant quelqu'un — exactement l'inverse de ce que la supervision cherche à encourager.
 *
 * AUCUNE COMMISSION SUR UN COLIS PARTENAIRE.
 *
 * Le partenaire facture son propre client ; l'entreprise ne voit passer aucun encaissement au
 * comptoir. Payer une commission dessus, ce serait sortir de l'argent sur une recette qui n'existe
 * pas ici.
 */

/**
 * Les taux, quand rien n'a jamais été enregistré.
 *
 * `agentKg` et `agentUnite` reprennent les valeurs déjà en base sous leurs anciens noms (`parKg`,
 * `parUnite`) : le premier affichage après la mise à jour montre donc les mêmes chiffres qu'avant,
 * et non des zéros qui feraient croire le calcul cassé.
 */
export const TAUX_PAR_DEFAUT = {
  agentKg: 2,
  agentUnite: 5,
  superviseurKg: 0.5,
  superviseurUnite: 1,
};

function nombre(valeur, defaut) {
  if (valeur === undefined || valeur === null || valeur === "") return defaut;
  const n = Number(valeur);
  /* Un taux négatif retirerait de l'argent à quelqu'un qui a travaillé : il n'existe pas. */
  return Number.isFinite(n) && n >= 0 ? n : defaut;
}

function liste(valeur) {
  return Array.isArray(valeur) ? valeur : [];
}

/**
 * Les quatre taux en vigueur, lus dans la configuration de l'entreprise.
 *
 * Les anciens noms sont acceptés en repli — `parKg` et `parUnite` sont ce que votre base contient
 * aujourd'hui, et les effacer aurait remis tous les taux à zéro le temps d'un enregistrement.
 *
 * `parColis`, le forfait d'un euro par colis, N'EST PLUS LU. L'agent est payé au poids et à
 * l'unité ; le laisser s'ajouter en silence aurait payé deux fois le même travail.
 */
export function tauxCommission(config) {
  const cfg = config && typeof config === "object" ? config : {};
  return {
    agentKg: nombre(cfg.agentKg, nombre(cfg.parKg, TAUX_PAR_DEFAUT.agentKg)),
    agentUnite: nombre(cfg.agentUnite, nombre(cfg.parUnite, TAUX_PAR_DEFAUT.agentUnite)),
    superviseurKg: nombre(cfg.superviseurKg, TAUX_PAR_DEFAUT.superviseurKg),
    superviseurUnite: nombre(cfg.superviseurUnite, TAUX_PAR_DEFAUT.superviseurUnite),
  };
}

/** Un colis de partenaire ne produit aucune commission — voir l'en-tête. */
export function estColisPartenaireCommission(colis) {
  return !!colis?.partenaireId;
}

/**
 * SALARIÉ OU COMMISSIONNÉ — CE N'EST PAS LE MÊME MÉTIER, CE N'EST PAS LA MÊME PAIE.
 *
 * Une partie de l'équipe est salariée : elle reçoit un salaire, et rien au colis. Le reste est
 * payé à la commission. Lui verser les deux, ce serait payer deux fois le même travail — et le
 * tableau des commissions annoncerait chaque mois une dette qui n'en est pas une.
 *
 * LE DÉFAUT EST « COMMISSIONNÉ », ET C'EST VOULU.
 *
 * Aucune fiche ne porte ce réglage aujourd'hui : mettre le salaire par défaut aurait fait tomber à
 * zéro, du jour au lendemain, la commission de toute l'équipe, sans que personne ne comprenne
 * pourquoi. On garde donc le comportement d'avant, et c'est en cochant la case qu'on retire
 * quelqu'un du tableau — un geste, pas un silence.
 */
export function estSalarie(compte) {
  return compte?.remuneration === "salaire";
}

/**
 * CE QUI EST FACTURÉ AU POIDS, ET CE QUI EST FACTURÉ À L'UNITÉ.
 *
 * Un même colis peut porter les deux : trois kilos de tissu et deux téléphones. On rend donc deux
 * bases distinctes, plus le détail ligne à ligne — c'est lui qui permet à une fiche de commission
 * de montrer d'où vient le montant, au lieu d'un total que personne ne peut vérifier.
 *
 * UN COLIS SANS PRODUITS EST COMPTÉ AU POIDS.
 *
 * C'est le cas des colis enregistrés au comptoir en une ligne. Les ignorer aurait mis à zéro la
 * commission de colis bien réels ; les compter à l'unité aurait payé cinq euros un colis de trente
 * kilos. Le poids est ce que ces colis portent de plus sûr.
 */
export function basesDuColis(colis, categories) {
  const cats = liste(categories);
  const lignes = [];
  const produits = liste(colis?.produits);

  if (produits.length === 0) {
    const kg = Number(colis?.poids) || 0;
    if (kg > 0) lignes.push({ nom: colis?.repere || "Colis", type: "kg", base: kg, categorie: "" });
  } else {
    produits.forEach((p) => {
      const cat = cats.find((c) => c && c.nom === p?.categorie);
      /*
       * Le type de la catégorie fait foi ; à défaut, le poids. `tarification` est ce que le
       * formulaire partenaire écrit sur la ligne quand aucune catégorie n'est choisie.
       */
      const type = cat?.type || p?.tarification || "kg";
      const base = type === "unite" ? (Number(p?.quantite) || 1) : (Number(p?.poids) || 0);
      if (base > 0) lignes.push({ nom: p?.nom || "Produit", type: type === "unite" ? "unite" : "kg", base, categorie: p?.categorie || "", cat });
    });
  }

  return {
    lignes,
    kg: lignes.filter((l) => l.type === "kg").reduce((s, l) => s + l.base, 0),
    unites: lignes.filter((l) => l.type === "unite").reduce((s, l) => s + l.base, 0),
  };
}

/**
 * La commission d'agent d'un colis : ce que touche celui qui l'a enregistré.
 *
 * Une catégorie peut porter son propre taux (`commissionRate`) : c'est la « commission prédéfinie
 * par produit ». Elle l'emporte sur le taux général, parce qu'un article rare ne se paie pas comme
 * un carton ordinaire. Aucune de vos catégories n'en porte aujourd'hui — toutes suivent donc le
 * taux général, et c'est un réglage, pas un oubli du calcul.
 */
export function commissionAgent(colis, config, categories) {
  if (!colis || estColisPartenaireCommission(colis)) return 0;
  const t = tauxCommission(config);
  const { lignes } = basesDuColis(colis, categories);
  return +lignes.reduce((total, l) => {
    const propre = l.cat && l.cat.commissionRate !== undefined && l.cat.commissionRate !== null && l.cat.commissionRate !== ""
      ? Number(l.cat.commissionRate) : null;
    const taux = Number.isFinite(propre) && propre >= 0 ? propre : (l.type === "unite" ? t.agentUnite : t.agentKg);
    return total + taux * l.base;
  }, 0).toFixed(2);
}

/**
 * La commission de supervision d'un colis : ce que touche le responsable de l'agent.
 *
 * Elle ne dépend pas de qui a enregistré — elle dépend de QUI ENCADRE celui qui a enregistré. C'est
 * `commissionDuColis` qui décide s'il y a quelqu'un à payer ; ici on ne calcule que le montant.
 */
export function commissionSuperviseur(colis, config, categories) {
  if (!colis || estColisPartenaireCommission(colis)) return 0;
  const t = tauxCommission(config);
  const { lignes } = basesDuColis(colis, categories);
  return +lignes.reduce((total, l) => {
    const propre = l.cat && l.cat.commissionRateSuperviseur !== undefined && l.cat.commissionRateSuperviseur !== null
      && l.cat.commissionRateSuperviseur !== "" ? Number(l.cat.commissionRateSuperviseur) : null;
    const taux = Number.isFinite(propre) && propre >= 0 ? propre : (l.type === "unite" ? t.superviseurUnite : t.superviseurKg);
    return total + taux * l.base;
  }, 0).toFixed(2);
}

/**
 * LE RESPONSABLE DONT DÉPEND UN COMPTE, S'IL Y EN A UN.
 *
 * Le rattachement est un identifiant sur la fiche de l'agent, et non une devinette sur sa zone.
 * Deux responsables peuvent travailler dans la même ville ; la zone ne dit pas qui encadre qui.
 *
 * On refuse trois choses, et chacune a coûté quelque part :
 *   — se rattacher à soi-même : le responsable toucherait sa supervision sur ses propres colis ;
 *   — se rattacher à un compte qui n'existe plus : on paierait dans le vide ;
 *   — se rattacher à quelqu'un qui n'est pas responsable de zone : la supervision n'est pas un
 *     droit qu'un agent puisse s'accorder en désignant un collègue.
 */
export function responsableDe(compte, users) {
  const id = compte?.responsableId;
  if (!id || id === compte?.id) return null;
  const chef = liste(users).find((u) => u && u.id === id);
  if (!chef || chef.role !== "Responsable de zone") return null;
  return chef;
}

/**
 * TOUT CE QU'UN COLIS PRODUIT, ET POUR QUI.
 *
 * Rend toujours la même forme, même quand il n'y a rien à payer : un appelant qui doit vérifier la
 * présence de chaque champ finit par en oublier un.
 *
 * LE CAS QUI DÉCIDE DE TOUT : le responsable qui enregistre lui-même. Il est alors son propre
 * agent, touche 2 €/kg comme n'importe qui, et AUCUNE supervision. `superviseurId` reste nul.
 */
export function commissionDuColis(colis, { users, config, categories, auteur } = {}) {
  const vide = { agentId: null, agentNom: "", agentMontant: 0, salarie: false, superviseurId: null, superviseurNom: "", superviseurMontant: 0, kg: 0, unites: 0 };
  if (!colis || estColisPartenaireCommission(colis)) return vide;
  /*
   * Un colis annulé n'a pas voyagé : rien n'a été facturé, rien n'est dû. La trace de ce qui avait
   * été calculé avant l'annulation n'est pas perdue pour autant — elle vit dans le journal
   * d'ajustements, et non dans un montant qu'on continuerait d'afficher comme s'il était dû.
   */
  if (colis.status === "Annulé" || colis.status === "Refusé") return vide;

  const equipe = liste(users);
  const agent = auteur || null;
  const bases = basesDuColis(colis, categories);
  const montantAgent = commissionAgent(colis, config, categories);
  if (!agent) return { ...vide, agentMontant: montantAgent, kg: bases.kg, unites: bases.unites };

  /*
   * UN COLIS DE SALARIÉ NE PRODUIT RIEN — NI POUR LUI, NI POUR SON RESPONSABLE.
   *
   * « Un salarié est un salarié : il est seulement payé en salaire. » Le travail est déjà payé, une
   * fois, par la paie du mois. Verser en plus une supervision dessus reviendrait à le payer une
   * seconde fois par un autre chemin — et l'entreprise n'aurait aucun moyen de s'en apercevoir,
   * puisque le salaire et les commissions ne se lisent pas au même endroit.
   *
   * On rend tout de même le poids et les unités : l'écran « Mon équipe » doit pouvoir montrer ce
   * qu'un salarié a traité. Ne pas le payer n'est pas une raison de ne pas compter son travail.
   */
  if (estSalarie(agent)) {
    return {
      ...vide,
      agentId: agent.id || null,
      agentNom: `${agent.prenom || ""} ${agent.nom || ""}`.trim(),
      salarie: true,
      kg: bases.kg,
      unites: bases.unites,
    };
  }

  const chef = responsableDe(agent, equipe);
  return {
    agentId: agent.id || null,
    agentNom: `${agent.prenom || ""} ${agent.nom || ""}`.trim(),
    agentMontant: montantAgent,
    salarie: false,
    superviseurId: chef ? chef.id : null,
    superviseurNom: chef ? `${chef.prenom || ""} ${chef.nom || ""}`.trim() : "",
    superviseurMontant: chef ? commissionSuperviseur(colis, config, categories) : 0,
    kg: bases.kg,
    unites: bases.unites,
  };
}

/**
 * L'ÉQUIPE D'UN RESPONSABLE.
 *
 * Ceux qui lui sont rattachés aujourd'hui. Un agent qui a changé d'équipe n'y figure plus — mais
 * les colis qu'il a enregistrés pendant qu'il en faisait partie restent payés à l'ancien
 * responsable : c'est `historiqueRattachement` qui le dit, et non la fiche du jour.
 */
export function equipeDe(responsableId, users) {
  if (!responsableId) return [];
  return liste(users).filter((u) => u && u.responsableId === responsableId && u.id !== responsableId);
}

/**
 * LE COMPTE RENDU D'UNE ÉQUIPE — ce que chaque agent a produit, et ce qu'il rapporte au responsable.
 *
 * Une seule fonction pour les trois écrans qui en ont besoin : celui du responsable, celui de
 * l'administrateur, et la fiche PDF. Trois calculs séparés finissent toujours par ne plus dire la
 * même chose, et la première fois que cela arrive, c'est devant la personne qu'on doit payer.
 *
 * `du` et `au` bornent une période — c'est ce que demande une fiche mensuelle. Sans bornes, tout
 * est compté depuis le début.
 *
 * L'ACTIVITÉ PERSONNELLE DU RESPONSABLE EST À PART.
 *
 * Elle ne se mélange pas à celle de l'équipe : ce sont deux natures de revenu, et les additionner
 * sans les nommer rend impossible de vérifier l'une ou l'autre. La fiche doit pouvoir dire « vous
 * avez gagné tant en travaillant, et tant en encadrant ».
 */
export function bilanEquipe(responsableId, { users, colis, categories, config, du = null, au = null } = {}) {
  const equipe = liste(users);
  const chef = equipe.find((u) => u && u.id === responsableId) || null;
  const debut = du ? new Date(du).getTime() : -Infinity;
  const fin = au ? new Date(au).getTime() : Infinity;
  const dansLaPeriode = (c) => {
    const d = c?.createdAt ? new Date(c.createdAt).getTime() : NaN;
    if (!Number.isFinite(d)) return debut === -Infinity && fin === Infinity;
    return d >= debut && d <= fin;
  };

  const parAgent = new Map();
  const perso = { colis: 0, kg: 0, unites: 0, montant: 0 };

  liste(colis).forEach((c) => {
    if (!c || estColisPartenaireCommission(c) || !dansLaPeriode(c)) return;
    const agent = equipe.find((u) => u && (u.id === c.agentCreationId
      || (!c.agentCreationId && `${u.prenom || ""} ${u.nom || ""}`.trim().toLowerCase() === String(c.agentCreation || "").trim().toLowerCase())));
    if (!agent) return;

    /* Ce que le responsable a fait de sa main. */
    if (agent.id === responsableId) {
      const p = commissionDuColis(c, { users: equipe, config, categories, auteur: agent });
      perso.colis += 1; perso.kg += p.kg; perso.unites += p.unites; perso.montant += p.agentMontant;
      return;
    }

    /*
     * Ce que son équipe a fait. On demande qui l'encadrait LE JOUR DU COLIS, et non aujourd'hui :
     * sans cela, un agent qui change d'équipe le 15 ferait basculer d'un coup tout le mois.
     */
    const chefDuJour = responsableAuMoment(agent, c.createdAt, equipe);
    if (!chefDuJour || chefDuJour.id !== responsableId) return;
    const p = commissionDuColis(c, { users: equipe, config, categories, auteur: agent });
    const ligne = parAgent.get(agent.id) || {
      id: agent.id,
      nom: `${agent.prenom || ""} ${agent.nom || ""}`.trim() || agent.identifiant || "—",
      zone: agent.zoneOperation || agent.agence || "—",
      salarie: estSalarie(agent),
      colis: 0, kg: 0, unites: 0, commissionAgent: 0, commissionResponsable: 0,
    };
    ligne.colis += 1;
    ligne.kg += p.kg;
    ligne.unites += p.unites;
    ligne.commissionAgent += p.agentMontant;
    ligne.commissionResponsable += p.superviseurMontant;
    parAgent.set(agent.id, ligne);
  });

  const agents = [...parAgent.values()]
    .map((l) => ({ ...l, kg: +l.kg.toFixed(1), commissionAgent: +l.commissionAgent.toFixed(2), commissionResponsable: +l.commissionResponsable.toFixed(2) }))
    .sort((a, b) => b.commissionResponsable - a.commissionResponsable);

  /*
   * `rattaches` compte l'équipe TELLE QU'ELLE EST, et non celle qui a produit quelque chose. Un
   * agent rattaché qui n'a rien enregistré ce mois-ci n'est pas absent de l'équipe : il est
   * inactif, et c'est une information différente — c'est même celle qui intéresse le responsable.
   */
  const rattaches = equipeDe(responsableId, equipe);
  return {
    responsable: chef,
    responsableNom: chef ? `${chef.prenom || ""} ${chef.nom || ""}`.trim() : "",
    zone: chef ? (chef.zoneOperation || chef.agence || "—") : "—",
    agentsRattaches: rattaches.length,
    agentsActifs: agents.filter((a) => a.colis > 0).length,
    agentsInactifs: rattaches.filter((u) => !agents.some((a) => a.id === u.id)).map((u) => ({
      id: u.id, nom: `${u.prenom || ""} ${u.nom || ""}`.trim() || u.identifiant || "—",
      zone: u.zoneOperation || u.agence || "—", salarie: estSalarie(u),
      colis: 0, kg: 0, unites: 0, commissionAgent: 0, commissionResponsable: 0,
    })),
    agents,
    personnel: { ...perso, kg: +perso.kg.toFixed(1), montant: +perso.montant.toFixed(2) },
    equipeColis: agents.reduce((s, a) => s + a.colis, 0),
    equipeKg: +agents.reduce((s, a) => s + a.kg, 0).toFixed(1),
    equipeUnites: agents.reduce((s, a) => s + a.unites, 0),
    commissionEquipe: +agents.reduce((s, a) => s + a.commissionResponsable, 0).toFixed(2),
    total: +(perso.montant + agents.reduce((s, a) => s + a.commissionResponsable, 0)).toFixed(2),
  };
}

/**
 * QUI ENCADRAIT CET AGENT LE JOUR OÙ CE COLIS A ÉTÉ ENREGISTRÉ.
 *
 * Sans cette question, un agent qui change d'équipe le 15 fait basculer d'un coup au nouveau
 * responsable toutes les commissions du mois — y compris celles des colis pris sous l'ancien. Le
 * nouveau serait payé pour un travail qu'il n'a pas encadré, et l'ancien perdrait ce qui lui était
 * dû sans qu'aucun écran ne le dise.
 *
 * L'historique fait foi quand il existe ; à défaut, le rattachement du jour — c'est le cas de tous
 * les colis antérieurs à cette mise à jour, et les compter au responsable actuel reste plus juste
 * que de ne rien leur attribuer.
 */
export function responsableAuMoment(agent, quand, users) {
  const historique = liste(agent?.historiqueRattachement);
  const date = quand ? new Date(quand).getTime() : NaN;
  if (historique.length && Number.isFinite(date)) {
    const periode = historique.find((h) => {
      if (!h || !h.responsableId) return false;
      const debut = h.du ? new Date(h.du).getTime() : -Infinity;
      const fin = h.au ? new Date(h.au).getTime() : Infinity;
      return date >= debut && date <= fin;
    });
    if (periode) {
      const chef = liste(users).find((u) => u && u.id === periode.responsableId);
      if (chef && chef.role === "Responsable de zone") return chef;
      return null;
    }
  }
  return responsableDe(agent, users);
}
