-- Add raised_by field to credit_notes table for storing the user who raised the credit note
ALTER TABLE credit_notes
    ADD COLUMN raised_by VARCHAR(255);