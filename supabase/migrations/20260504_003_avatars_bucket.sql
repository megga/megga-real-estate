-- Migration : avatars bucket Supabase Storage.
--
-- Le hook useAvatar conservait les avatars en data URL dans localStorage.
-- Cette migration crée un bucket public `avatars` + policies RLS pour
-- permettre aux users d'uploader leur propre avatar (path = {user_id}/avatar.jpg).
--
-- Les avatars sont publics (lisibles sans auth) car ils apparaissent dans
-- les conversations agent/contact, sur les profils publics si activés, etc.
-- L'écriture est restreinte au propriétaire du path.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  2097152, -- 2 Mo
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Lecture publique (sans auth) — les avatars sont visibles partout
CREATE POLICY "Public avatars are viewable by everyone"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

-- Upload : seul l'user lui-même peut uploader sous son préfixe
CREATE POLICY "Users can upload their own avatar"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Update (overwrite) — seul l'user
CREATE POLICY "Users can update their own avatar"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Delete — seul l'user
CREATE POLICY "Users can delete their own avatar"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
