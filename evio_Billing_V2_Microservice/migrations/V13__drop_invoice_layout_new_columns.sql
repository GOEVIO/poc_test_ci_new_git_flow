-- Drop columns added in V12 migration from invoice_layouts
ALTER TABLE invoice_layouts DROP COLUMN client_name;
ALTER TABLE invoice_layouts DROP COLUMN type;
ALTER TABLE invoice_layouts DROP COLUMN language;
ALTER TABLE invoice_layouts DROP COLUMN payment_type;
ALTER TABLE invoice_layouts DROP COLUMN doc_type;
ALTER TABLE invoice_layouts DROP COLUMN linked_credit_note_id;
