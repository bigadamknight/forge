-- Remove the check constraint on extractions.type to allow custom extraction types.
-- The application layer validates types instead.
ALTER TABLE "extractions" DROP CONSTRAINT IF EXISTS "extractions_type_check";
