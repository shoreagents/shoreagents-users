-- Create socket_connections table to track user socket connections
CREATE TABLE IF NOT EXISTS socket_connections (
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

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_socket_connections_user_id ON socket_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_socket_connections_socket_id ON socket_connections(socket_id);
CREATE INDEX IF NOT EXISTS idx_socket_connections_email ON socket_connections(email);
CREATE INDEX IF NOT EXISTS idx_socket_connections_status ON socket_connections(connection_status);
CREATE INDEX IF NOT EXISTS idx_socket_connections_connected_at ON socket_connections(connected_at);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_socket_connections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER trigger_update_socket_connections_updated_at
    BEFORE UPDATE ON socket_connections
    FOR EACH ROW
    EXECUTE FUNCTION update_socket_connections_updated_at();


