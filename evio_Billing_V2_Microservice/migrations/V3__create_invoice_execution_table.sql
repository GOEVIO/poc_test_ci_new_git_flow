CREATE TABLE invoice_executions (
    id SERIAL PRIMARY KEY,
    period VARCHAR(32) NOT NULL,
    status VARCHAR(32) NOT NULL,
    started_at TIMESTAMP NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMP,
    error_message TEXT
);