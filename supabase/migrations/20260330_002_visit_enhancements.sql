-- Visit enhancements — pré-qualification, gestion publique, feedback structuré

ALTER TABLE visits
  ADD COLUMN IF NOT EXISTS manage_token UUID DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS qualification JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS buyer_name TEXT,
  ADD COLUMN IF NOT EXISTS buyer_email TEXT,
  ADD COLUMN IF NOT EXISTS buyer_phone TEXT,
  ADD COLUMN IF NOT EXISTS buyer_message TEXT,
  ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS feedback_sent BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS group_id UUID,
  ADD COLUMN IF NOT EXISTS visit_type TEXT DEFAULT 'sur_place' CHECK (visit_type IN ('sur_place', 'video')),
  ADD COLUMN IF NOT EXISTS video_platform TEXT CHECK (video_platform IN ('google_meet', 'facetime')),
  ADD COLUMN IF NOT EXISTS video_link TEXT;

-- Token unique pour accès public (gestion/feedback)
CREATE UNIQUE INDEX IF NOT EXISTS idx_visits_manage_token ON visits(manage_token);

-- Policy pour accès public par token (report, annulation, feedback)
CREATE POLICY "Public access by manage_token" ON visits
  FOR ALL TO anon
  USING (true)
  WITH CHECK (true);
