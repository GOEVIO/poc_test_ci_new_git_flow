-- Add invoice_layout_id column to invoices table
ALTER TABLE invoices
    ADD COLUMN invoice_layout_id INT;

-- Add foreign key constraint to invoice_layouts
ALTER TABLE invoices
    ADD CONSTRAINT fk_invoice_layout_id FOREIGN KEY (invoice_layout_id)
        REFERENCES invoice_layouts(id);
