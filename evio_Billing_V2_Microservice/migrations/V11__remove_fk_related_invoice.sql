-- Remove foreign key constraint fk_related_invoice from retry_tasks
ALTER TABLE retry_tasks DROP CONSTRAINT IF EXISTS fk_related_invoice;

-- Remove foreign key constraint fk_related_invoice from file_references
ALTER TABLE file_references DROP CONSTRAINT IF EXISTS fk_related_invoice;
