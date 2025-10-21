-- Add 'floor' column to 'invoice_billing' table
ALTER TABLE invoice_billing
    ADD COLUMN floor VARCHAR(10);