ALTER TABLE documents   ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents   FORCE  ROW LEVEL SECURITY;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships FORCE  ROW LEVEL SECURITY;
ALTER TABLE doc_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE doc_updates FORCE  ROW LEVEL SECURITY;
ALTER TABLE versions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE versions    FORCE  ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION current_app_user() RETURNS text AS $$
  SELECT COALESCE(current_setting('app.user_id', true), '')
$$ LANGUAGE sql STABLE;

CREATE POLICY documents_isolation ON documents
  USING (
    EXISTS (
      SELECT 1 FROM memberships m
      WHERE m."documentId" = documents.id
        AND m."userId" = current_app_user()
    )
  );

CREATE POLICY memberships_isolation ON memberships
  USING (
    EXISTS (
      SELECT 1 FROM memberships mine
      WHERE mine."documentId" = memberships."documentId"
        AND mine."userId" = current_app_user()
    )
  );

CREATE POLICY doc_updates_isolation ON doc_updates
  USING (
    EXISTS (
      SELECT 1 FROM memberships m
      WHERE m."documentId" = doc_updates."documentId"
        AND m."userId" = current_app_user()
    )
  );

CREATE POLICY versions_isolation ON versions
  USING (
    EXISTS (
      SELECT 1 FROM memberships m
      WHERE m."documentId" = versions."documentId"
        AND m."userId" = current_app_user()
    )
  );
