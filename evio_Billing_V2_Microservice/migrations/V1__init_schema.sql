CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Table statuses
CREATE TABLE IF NOT EXISTS statuses (
    id INT PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    key VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    applies_to VARCHAR(50) NOT NULL,
    is_final BOOLEAN DEFAULT FALSE
);

-- Table invoices
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    client_name VARCHAR(50) NOT NULL,
    billing_type VARCHAR(20) NOT NULL,
    total_amount_exc_vat NUMERIC(18, 2) NOT NULL,
    total_amount_inc_vat NUMERIC(18, 2) NOT NULL,
    credited_amount NUMERIC(18, 2) DEFAULT 0.00,
    currency VARCHAR(3) DEFAULT 'EUR',
    vat_country VARCHAR(2),
    vat_rate NUMERIC(5, 2),
    vies_vat BOOLEAN,
    status VARCHAR(50) NOT NULL REFERENCES statuses (code),
    invoice_number VARCHAR(100),
    third_party_id VARCHAR(100),
    sent_at TIMESTAMPTZ,
    email_sent BOOLEAN DEFAULT false,
    email_send_timestamp TIMESTAMPTZ,
    sessions JSON,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Table credit_notes
CREATE TABLE IF NOT EXISTS credit_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    invoice_id UUID REFERENCES invoices (id),
    credit_note_number VARCHAR(100),
    third_party_id VARCHAR(100),
    total_amount NUMERIC(18, 2) NOT NULL,
    reason TEXT,
    status VARCHAR(30) NOT NULL,
    sent_at TIMESTAMPTZ,
    email_sent BOOLEAN DEFAULT false,
    email_send_timestamp TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Table retry_tasks
CREATE TABLE IF NOT EXISTS retry_tasks (
    id SERIAL PRIMARY KEY,
    related_object_type VARCHAR(50) NOT NULL,
    related_object_id UUID NOT NULL,
    operation VARCHAR(100) NOT NULL,
    status VARCHAR(30) NOT NULL,
    retry_count INTEGER NOT NULL DEFAULT 0,
    max_retries_allowed INTEGER NOT NULL DEFAULT 5,
    last_retry_attempt_at TIMESTAMPTZ,
    next_retry_schedule_at TIMESTAMPTZ,
    failure_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT fk_related_invoice FOREIGN KEY (related_object_id) REFERENCES invoices (id) -- Reference only invoices.id
);

-- Table file_references
CREATE TABLE IF NOT EXISTS file_references (
    id SERIAL PRIMARY KEY,
    related_object_type VARCHAR(50) NOT NULL,
    related_object_id UUID NOT NULL,
    file_type VARCHAR(30) NOT NULL,
    file_purpose VARCHAR(100),
    file_url TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT fk_related_invoice FOREIGN KEY (related_object_id) REFERENCES invoices (id) -- Reference only invoices.id
);

-- Table invoice_audit_log
CREATE TABLE IF NOT EXISTS invoice_audit_log (
    id SERIAL PRIMARY KEY,
    object_type VARCHAR(50) NOT NULL,
    related_object_id UUID NOT NULL,
    action VARCHAR(100) NOT NULL,
    old_value JSON,
    new_value JSON,
    description TEXT,
    triggered_by VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table excel_templates
CREATE TABLE IF NOT EXISTS excel_templates (
    id SERIAL PRIMARY KEY,
    template_name VARCHAR(255) NOT NULL,
    version INT NOT NULL,
    description TEXT,
    language VARCHAR(10) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    template_json JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Table vat_statuses
CREATE TABLE IF NOT EXISTS vat_statuses (
    id SERIAL PRIMARY KEY,
    tab_iva INTEGER NOT NULL,
    country VARCHAR(255) NOT NULL,
    value NUMERIC(4, 2)
);

-- Table invoice_billing
CREATE TABLE invoice_billing (
    id SERIAL PRIMARY KEY,
    invoice_id UUID NOT NULL REFERENCES invoices (id),
    payment_conditions_id INTEGER REFERENCES payment_conditions (id),
    user_id VARCHAR(50),
    name VARCHAR(255) NOT NULL,
    vat_number VARCHAR(20),
    client_type VARCHAR(5) NOT NULL,
    street VARCHAR(255),
    purchase_order VARCHAR(255),
    number VARCHAR(20),
    zip_code VARCHAR(20),
    city VARCHAR(100),
    state VARCHAR(100),
    country VARCHAR(100),
    country_code VARCHAR(10),
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (invoice_id)
);

-- table invoice_communication
CREATE TABLE invoice_communication (
    id SERIAL PRIMARY KEY,
    invoice_id UUID NOT NULL REFERENCES invoices (id),
    user_id VARCHAR(50),
    -- Communication contact information
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    language VARCHAR(5) NOT NULL,
    client_type VARCHAR(5) NOT null,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- table invoice_layouts
CREATE TABLE invoice_layouts (
    id SERIAL PRIMARY KEY,
    title VARCHAR(100) NOT NULL,
    printtypeid INT NOT NULL,
    doctype VARCHAR(50) NOT NULL
);

-- Table payment_conditions
CREATE TABLE payment_conditions (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    payment_condition_id VARCHAR(255),
);

-- Table tax_exemptions
CREATE TABLE IF NOT EXISTS tax_exemptions (
    id SERIAL PRIMARY KEY,
    code VARCHAR(10) NOT NULL,
    description TEXT NOT NULL,
    language VARCHAR(5) NOT NULL
);
