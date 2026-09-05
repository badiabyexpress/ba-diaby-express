# 🔴 PROBLÈME : Enregistrements en attente de synchronisation

**Date** : 5 septembre 2026  
**Statut** : 🚨 Critique  
**Impact** : Les écritures utilisateurs restent bloquées dans la file d'attente

## Symptôme
Le site affiche "Enregistrement en attente" depuis ce matin. Les données ne se synchronisent pas avec la base de données.

## Cause probable
Selon le code dans `src/lib/storage.js` et `api/donnees.js` :
- Les écritures échouent à atteindre Supabase
- Le système réessaye avec délai exponentiel (20s, 40s, 80s... jusqu'à 5 min)
- Les anciennes écritures restent bloquées indéfiniment

## À vérifier
1. ✅ Connexion à Supabase (URL, clés API, table `bde-data`)
2. ✅ Logs Vercel - chercher erreurs 409, 502, 413
3. ✅ Quota/limite de la base de données
4. ✅ Authentification API (token de session valide?)

## Code concerné
- `src/lib/storage.js` - File d'attente (`flushOutbox()`)
- `api/donnees.js` - Écriture en base

## Solution rapide
- Vider le cache navigateur et recharger
- Si persiste : vérifier les logs backend
- Forcer une reconnexion à Supabase

## Prochaines étapes
- [ ] Vérifier logs Vercel
- [ ] Tester l'API Supabase directement
- [ ] Ajouter meilleur logging des erreurs de sync
- [ ] Implémenter un bouton pour nettoyer la file
