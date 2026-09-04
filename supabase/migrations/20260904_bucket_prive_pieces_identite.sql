-- UN COFFRE À PART POUR LES PIÈCES D'IDENTITÉ.
--
-- Le bucket « colis-documents » est PUBLIC : tout fichier qui s'y trouve est lisible par quiconque
-- connaît son adresse, et une adresse de fichier se retrouve dans un historique de navigateur, un
-- message, un journal de serveur. Y déposer des photos de passeports et de cartes d'identité serait
-- une faute grave — et, pour la partie française de l'activité, une infraction.
--
-- Celui-ci n'est pas public. Aucun lien direct n'y donne accès : il faut un lien SIGNÉ, valable
-- cinq minutes, que seul le serveur peut fabriquer, et seulement pour un administrateur
-- (voir l'action « piece » dans api/donnees.js).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('pieces-identite', 'pieces-identite', false, 8388608,
        array['image/png','image/jpeg','image/jpg','image/webp','image/heic','image/heif','application/pdf'])
on conflict (id) do update
  set public = false,
      file_size_limit = 8388608,
      allowed_mime_types = excluded.allowed_mime_types;

-- LE NAVIGATEUR PEUT DÉPOSER, IL NE PEUT PAS RELIRE.
--
-- Le dépôt vient de la personne qui crée le compte, avec la clé publique : il lui faut donc le
-- droit d'écrire. La lecture, elle, n'est accordée à personne — pas même à un compte connecté.
--
-- Sans cette asymétrie, la clé publique — qui se lit dans le code envoyé au navigateur — aurait
-- suffi à télécharger les pièces d'identité de toute l'équipe.
drop policy if exists "Depot seul depuis le navigateur (pieces-identite)" on storage.objects;
create policy "Depot seul depuis le navigateur (pieces-identite)"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'pieces-identite');
