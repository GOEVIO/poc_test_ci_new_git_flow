-- Add sessions_url field to invoices table for storing S3 JSON file location
ALTER TABLE invoices
    ADD COLUMN sessions_url TEXT;