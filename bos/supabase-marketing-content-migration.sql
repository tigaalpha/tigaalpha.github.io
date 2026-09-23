-- marketing_content: permanent storage for AI-generated marketing content
-- Replaces localStorage-based persistence for cross-device, unlimited history

CREATE TABLE IF NOT EXISTS marketing_content (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  tool_type   text NOT NULL,
  topic       text NOT NULL,
  language    text NOT NULL DEFAULT 'th',
  model       text NOT NULL DEFAULT 'gemini',
  title       text NOT NULL DEFAULT '',
  content     text NOT NULL,
  summary     text NOT NULL DEFAULT '',
  tags        jsonb DEFAULT '[]'::jsonb,
  category    text DEFAULT '',
  created_at  timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE marketing_content ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own marketing content' AND tablename = 'marketing_content') THEN
    CREATE POLICY "Users can view own marketing content" ON marketing_content FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert own marketing content' AND tablename = 'marketing_content') THEN
    CREATE POLICY "Users can insert own marketing content" ON marketing_content FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can delete own marketing content' AND tablename = 'marketing_content') THEN
    CREATE POLICY "Users can delete own marketing content" ON marketing_content FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_marketing_content_user_created ON marketing_content (user_id, created_at DESC);
