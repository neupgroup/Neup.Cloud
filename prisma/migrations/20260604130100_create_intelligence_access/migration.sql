CREATE TABLE "intelligence_access" (
  id BIGSERIAL PRIMARY KEY,
  account_id TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL,
  available_to JSONB NOT NULL DEFAULT '[]'::jsonb,
  details JSONB NOT NULL DEFAULT '[]'::jsonb,
  max_token INTEGER,
  created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT intelligence_access_type_check CHECK (type IN ('open', 'model_def', 'model_key_def', 'prompt_def'))
);

CREATE INDEX "intelligence_access_account_id_idx"
ON "intelligence_access" (account_id);
