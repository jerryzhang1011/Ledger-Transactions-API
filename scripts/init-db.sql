-- Initialize additional databases for testing
CREATE DATABASE ledger_db_test;

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE ledger_db TO postgres;
GRANT ALL PRIVILEGES ON DATABASE ledger_db_test TO postgres;

