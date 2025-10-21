-- Add map_date field to invoices table for storing S3 JSON file location
ALTER TABLE invoices
    ADD COLUMN map_date VARCHAR(6);