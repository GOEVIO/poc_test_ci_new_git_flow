-- Rename column credited_amount to credited_amount_exc_vat in invoices table
ALTER TABLE invoices
    RENAME COLUMN credited_amount TO credited_amount_exc_vat;