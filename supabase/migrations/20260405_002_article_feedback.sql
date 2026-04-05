-- Article feedback (replaces localStorage)
CREATE TABLE IF NOT EXISTS article_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_slug TEXT NOT NULL,
  helpful BOOLEAN NOT NULL,
  comment TEXT,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Article views (for dynamic popular articles)
CREATE TABLE IF NOT EXISTS article_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_slug TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_article_feedback_slug ON article_feedback(article_slug);
CREATE INDEX idx_article_views_slug ON article_views(article_slug, created_at);

-- RLS
ALTER TABLE article_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE article_views ENABLE ROW LEVEL SECURITY;

-- Anyone can submit feedback and views
CREATE POLICY "Anyone can insert feedback" ON article_feedback FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can insert views" ON article_views FOR INSERT WITH CHECK (true);

-- Users see own feedback
CREATE POLICY "Users see own feedback" ON article_feedback FOR SELECT USING (user_id = auth.uid());

-- Service role full access
CREATE POLICY "Service role feedback" ON article_feedback FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role views" ON article_views FOR ALL USING (auth.role() = 'service_role');

-- RPC: get popular articles (top 6 by views in last 30 days)
CREATE OR REPLACE FUNCTION get_popular_articles(limit_count INT DEFAULT 6)
RETURNS TABLE(article_slug TEXT, view_count BIGINT) AS $$
  SELECT article_slug, COUNT(*) as view_count
  FROM article_views
  WHERE created_at > NOW() - INTERVAL '30 days'
  GROUP BY article_slug
  ORDER BY view_count DESC
  LIMIT limit_count;
$$ LANGUAGE sql STABLE SECURITY DEFINER;
