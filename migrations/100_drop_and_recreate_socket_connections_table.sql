-- Drop and recreate socket_connections table with same schema
-- This script safely removes the table and all related objects, then recreates them

-- Drop the trigger first
DROP TRIGGER IF EXISTS trigger_update_socket_connections_updated_at ON socket_connections;

-- Drop the function
DROP FUNCTION IF EXISTS update_socket_connections_updated_at();

-- Drop all indexes
DROP INDEX IF EXISTS idx_socket_connections_user_id;
DROP INDEX IF EXISTS idx_socket_connections_socket_id;
DROP INDEX IF EXISTS idx_socket_connections_email;
DROP INDEX IF EXISTS idx_socket_connections_status;
DROP INDEX IF EXISTS idx_socket_connections_connected_at;

-- Drop the table
DROP TABLE IF EXISTS socket_connections;

-- Recreate socket_connections table with same schema
CREATE TABLE socket_connections (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    socket_id VARCHAR(255) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL,
    connected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_heartbeat TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    disconnected_at TIMESTAMP WITH TIME ZONE NULL,
    connection_status VARCHAR(50) DEFAULT 'active' CHECK (connection_status IN ('active', 'disconnected', 'timeout')),
    user_agent TEXT,
    ip_address INET,
    transport VARCHAR(50) DEFAULT 'websocket',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Recreate indexes for better performance
CREATE INDEX idx_socket_connections_user_id ON socket_connections(user_id);
CREATE INDEX idx_socket_connections_socket_id ON socket_connections(socket_id);
CREATE INDEX idx_socket_connections_email ON socket_connections(email);
CREATE INDEX idx_socket_connections_status ON socket_connections(connection_status);
CREATE INDEX idx_socket_connections_connected_at ON socket_connections(connected_at);

-- Recreate function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_socket_connections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger to automatically update updated_at
CREATE TRIGGER trigger_update_socket_connections_updated_at
    BEFORE UPDATE ON socket_connections
    FOR EACH ROW
    EXECUTE FUNCTION update_socket_connections_updated_at();

-- Add comment to table
COMMENT ON TABLE socket_connections IS 'Tracks active socket connections for users';
COMMENT ON COLUMN socket_connections.socket_id IS 'Unique socket.io connection ID';
COMMENT ON COLUMN socket_connections.connection_status IS 'Current status of the connection: active, disconnected, timeout';
COMMENT ON COLUMN socket_connections.transport IS 'Transport type: websocket, polling, etc.';
