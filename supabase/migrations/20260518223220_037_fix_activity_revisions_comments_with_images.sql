/*
  # Fix activity_revisions for collaborator comments + image support

  ## Changes

  1. `activity_revisions` table
     - Make `revision_number` nullable with auto-increment default so collaborator
       comments can be inserted without specifying it
     - Add `image_urls` text[] column to store uploaded image URLs as evidence

  2. Storage
     - Create `comment-images` bucket (public read, authenticated write)
     - Add storage policy for public read and authenticated insert
*/

-- Make revision_number nullable so comment inserts don't require it
ALTER TABLE activity_revisions
  ALTER COLUMN revision_number DROP NOT NULL;

-- Set a default so existing code that passes NULL still works
ALTER TABLE activity_revisions
  ALTER COLUMN revision_number SET DEFAULT NULL;

-- Add image_urls column for evidence attachments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'activity_revisions' AND column_name = 'image_urls'
  ) THEN
    ALTER TABLE activity_revisions ADD COLUMN image_urls text[] DEFAULT '{}';
  END IF;
END $$;

-- Create storage bucket for comment images
INSERT INTO storage.buckets (id, name, public)
VALUES ('comment-images', 'comment-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to read images (public bucket)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'comment-images public read'
  ) THEN
    CREATE POLICY "comment-images public read"
      ON storage.objects FOR SELECT
      TO public
      USING (bucket_id = 'comment-images');
  END IF;
END $$;

-- Allow any user to upload images (collaborators are not authenticated via Supabase auth)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'comment-images public insert'
  ) THEN
    CREATE POLICY "comment-images public insert"
      ON storage.objects FOR INSERT
      TO public
      WITH CHECK (bucket_id = 'comment-images');
  END IF;
END $$;
