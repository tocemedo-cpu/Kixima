CREATE TABLE IF NOT EXISTS "feedback" (
  "id"         TEXT PRIMARY KEY,
  "name"       TEXT NOT NULL,
  "company"    TEXT NOT NULL,
  "role"       TEXT NOT NULL,
  "rating"     INTEGER NOT NULL,
  "message"    TEXT NOT NULL,
  "approved"   BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "feedback_approved_created_at_idx" ON "feedback"("approved", "created_at");
