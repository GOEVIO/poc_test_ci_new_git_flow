-- Change floor column type to VARCHAR(30)
ALTER TABLE invoice_billing
    ALTER COLUMN floor TYPE VARCHAR(30);