-- Initialize test database for FluxHTTP E2E tests
-- This script sets up the database schema and test data

-- Create extension for UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create users table for authentication tests
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    uuid UUID DEFAULT uuid_generate_v4(),
    username VARCHAR(255) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'user',
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create sessions table for session management tests
CREATE TABLE IF NOT EXISTS sessions (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(255) NOT NULL UNIQUE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    data JSONB,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create api_keys table for API key tests
CREATE TABLE IF NOT EXISTS api_keys (
    id SERIAL PRIMARY KEY,
    key_hash VARCHAR(255) NOT NULL UNIQUE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    permissions JSONB DEFAULT '[]',
    active BOOLEAN DEFAULT true,
    last_used_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create test_logs table for audit/logging tests
CREATE TABLE IF NOT EXISTS test_logs (
    id SERIAL PRIMARY KEY,
    request_id UUID DEFAULT uuid_generate_v4(),
    method VARCHAR(10) NOT NULL,
    url TEXT NOT NULL,
    status_code INTEGER,
    response_time_ms INTEGER,
    user_id INTEGER REFERENCES users(id),
    ip_address INET,
    user_agent TEXT,
    request_body JSONB,
    response_body JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create rate_limits table for rate limiting tests
CREATE TABLE IF NOT EXISTS rate_limits (
    id SERIAL PRIMARY KEY,
    identifier VARCHAR(255) NOT NULL, -- IP, user ID, API key, etc.
    limit_type VARCHAR(50) NOT NULL,   -- 'ip', 'user', 'api_key'
    request_count INTEGER DEFAULT 0,
    window_start TIMESTAMP WITH TIME ZONE NOT NULL,
    window_size_seconds INTEGER NOT NULL,
    max_requests INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(identifier, limit_type, window_start)
);

-- Create file_uploads table for file operation tests
CREATE TABLE IF NOT EXISTS file_uploads (
    id SERIAL PRIMARY KEY,
    filename VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(255),
    file_size BIGINT,
    file_path TEXT,
    checksum VARCHAR(255),
    user_id INTEGER REFERENCES users(id),
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_sessions_session_id ON sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_test_logs_created_at ON test_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_test_logs_user_id ON test_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_rate_limits_identifier ON rate_limits(identifier);
CREATE INDEX IF NOT EXISTS idx_rate_limits_window_start ON rate_limits(window_start);
CREATE INDEX IF NOT EXISTS idx_file_uploads_user_id ON file_uploads(user_id);

-- Insert test users
INSERT INTO users (username, email, password_hash, role) VALUES
    ('testuser', 'test@example.com', '$2b$10$rZ5Z5Z5Z5Z5Z5Z5Z5Z5Z5e', 'user'),
    ('admin', 'admin@example.com', '$2b$10$aZ5Z5Z5Z5Z5Z5Z5Z5Z5Z5e', 'admin'),
    ('moderator', 'mod@example.com', '$2b$10$mZ5Z5Z5Z5Z5Z5Z5Z5Z5Z5e', 'moderator'),
    ('readonly', 'readonly@example.com', '$2b$10$pZ5Z5Z5Z5Z5Z5Z5Z5Z5Z5e', 'readonly')
ON CONFLICT (username) DO NOTHING;

-- Insert test API keys
INSERT INTO api_keys (key_hash, user_id, name, permissions) VALUES
    ('sk_test_1234567890abcdef', 1, 'Test API Key', '["read", "write"]'),
    ('sk_admin_abcdef1234567890', 2, 'Admin API Key', '["read", "write", "admin"]'),
    ('sk_readonly_fedcba0987654321', 4, 'Read-only API Key', '["read"]')
ON CONFLICT (key_hash) DO NOTHING;

-- Create function to clean up expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM sessions WHERE expires_at < CURRENT_TIMESTAMP;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create function to reset rate limits
CREATE OR REPLACE FUNCTION reset_rate_limits()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM rate_limits WHERE window_start + (window_size_seconds || ' seconds')::interval < CURRENT_TIMESTAMP;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create function to log test requests
CREATE OR REPLACE FUNCTION log_test_request(
    p_method VARCHAR(10),
    p_url TEXT,
    p_status_code INTEGER DEFAULT NULL,
    p_response_time_ms INTEGER DEFAULT NULL,
    p_user_id INTEGER DEFAULT NULL,
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_request_body JSONB DEFAULT NULL,
    p_response_body JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    request_uuid UUID;
BEGIN
    INSERT INTO test_logs (
        method, url, status_code, response_time_ms, user_id,
        ip_address, user_agent, request_body, response_body
    ) VALUES (
        p_method, p_url, p_status_code, p_response_time_ms, p_user_id,
        p_ip_address, p_user_agent, p_request_body, p_response_body
    ) RETURNING request_id INTO request_uuid;
    
    RETURN request_uuid;
END;
$$ LANGUAGE plpgsql;

-- Create test data views for easy querying
CREATE OR REPLACE VIEW v_active_users AS
SELECT id, username, email, role, created_at
FROM users
WHERE active = true;

CREATE OR REPLACE VIEW v_recent_requests AS
SELECT 
    request_id,
    method,
    url,
    status_code,
    response_time_ms,
    u.username,
    ip_address,
    created_at
FROM test_logs tl
LEFT JOIN users u ON tl.user_id = u.id
WHERE tl.created_at > CURRENT_TIMESTAMP - INTERVAL '24 hours'
ORDER BY tl.created_at DESC;

-- Create test data cleanup function
CREATE OR REPLACE FUNCTION cleanup_test_data()
RETURNS TEXT AS $$
BEGIN
    -- Clean up old test logs (keep last 7 days)
    DELETE FROM test_logs WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '7 days';
    
    -- Clean up expired sessions
    PERFORM cleanup_expired_sessions();
    
    -- Reset rate limits
    PERFORM reset_rate_limits();
    
    -- Clean up orphaned file uploads
    DELETE FROM file_uploads WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '1 day';
    
    RETURN 'Test data cleanup completed';
END;
$$ LANGUAGE plpgsql;

-- Grant permissions to test user
DO $$
BEGIN
    -- Create test user if it doesn't exist
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'test_user') THEN
        CREATE ROLE test_user LOGIN PASSWORD 'test_password';
    END IF;
    
    -- Grant permissions
    GRANT USAGE ON SCHEMA public TO test_user;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO test_user;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO test_user;
    GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO test_user;
    
    -- Set default privileges for future objects
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO test_user;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO test_user;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO test_user;
END
$$;

-- Create a test configuration table
CREATE TABLE IF NOT EXISTS test_config (
    key VARCHAR(255) PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert test configuration
INSERT INTO test_config (key, value, description) VALUES
    ('rate_limits', '{"default": 100, "authenticated": 1000, "admin": 10000}', 'Rate limiting configuration'),
    ('file_upload', '{"max_size": 10485760, "allowed_types": ["text/plain", "image/jpeg", "image/png"]}', 'File upload configuration'),
    ('security', '{"password_min_length": 8, "session_timeout": 3600, "max_login_attempts": 5}', 'Security configuration'),
    ('test_flags', '{"enable_logging": true, "enable_metrics": true, "debug_mode": false}', 'Test feature flags')
ON CONFLICT (key) DO UPDATE SET 
    value = EXCLUDED.value,
    updated_at = CURRENT_TIMESTAMP;

-- Create trigger to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to relevant tables
DO $$
DECLARE
    table_name TEXT;
BEGIN
    FOR table_name IN 
        SELECT tablename FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename IN ('users', 'test_config')
    LOOP
        EXECUTE format('
            DROP TRIGGER IF EXISTS trigger_update_updated_at ON %I;
            CREATE TRIGGER trigger_update_updated_at
                BEFORE UPDATE ON %I
                FOR EACH ROW
                EXECUTE FUNCTION update_updated_at_column();
        ', table_name, table_name);
    END LOOP;
END
$$;

-- Final message
SELECT 'FluxHTTP E2E test database initialized successfully' AS status;