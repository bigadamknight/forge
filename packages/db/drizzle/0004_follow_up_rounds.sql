ALTER TABLE interview_sections ADD COLUMN round smallint NOT NULL DEFAULT 1;
ALTER TABLE extractions ADD COLUMN round smallint NOT NULL DEFAULT 1;
