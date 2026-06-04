-- Drop pricing fields from intelligence_models
ALTER TABLE "intelligence_models"
  DROP COLUMN IF EXISTS "rate",
  DROP COLUMN IF EXISTS "costPer1000Tokens",
  DROP COLUMN IF EXISTS "price";
