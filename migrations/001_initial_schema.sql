-- ShoreAgents Dashboard - Complete Initial Schema Migration
-- This migration creates all the necessary tables for the ShoreAgents dashboard
-- Updated based on comprehensive analysis of the entire application

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    middle_name VARCHAR(100),
    id_number VARCHAR(50) UNIQUE,
    gender VARCHAR(10),
    phone VARCHAR(20),
    date_of_birth DATE,
    position VARCHAR(200),
    company VARCHAR(200) DEFAULT 'SHOREAGENTS',
    department VARCHAR(200),
    start_date DATE,
    status VARCHAR(50) DEFAULT 'REGULAR',
    role VARCHAR(50) DEFAULT 'agent',
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT true,
    last_login_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create tickets table
CREATE TABLE tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_id VARCHAR(50) UNIQUE NOT NULL, -- Custom ticket ID like TKT-xxx
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    concern TEXT NOT NULL,
    comments TEXT,
    category VARCHAR(100) NOT NULL,
    details TEXT,
    nickname VARCHAR(100),
    email VARCHAR(255),
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'in-progress', 'resolved')),
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    assigned_to UUID REFERENCES users(id),
    resolved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create ticket_files table for file attachments
CREATE TABLE ticket_files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_size BIGINT,
    mime_type VARCHAR(100),
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create ticket_comments table for ticket updates
CREATE TABLE ticket_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    comment TEXT NOT NULL,
    is_internal BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create tasks table for productivity management
CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id VARCHAR(100) NOT NULL, -- Custom task ID like task_xxx
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    task_name VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'Not started' CHECK (status IN ('Not started', 'In progress', 'Done')),
    assignee VARCHAR(100) NOT NULL,
    due_date DATE,
    priority VARCHAR(20) DEFAULT 'Medium' CHECK (priority IN ('Low', 'Medium', 'High')),
    task_type VARCHAR(50) DEFAULT 'Document' CHECK (task_type IN ('Document', 'Bug', 'Feature Request', 'Polish')),
    description TEXT,
    attached_files TEXT[], -- Array of file names
    created_by VARCHAR(100) NOT NULL,
    created_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_edited_by VARCHAR(100) NOT NULL,
    last_edited_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(task_id, user_id) -- Ensure task_id is unique per user
);

-- Create task_custom_statuses table for custom status management
CREATE TABLE task_custom_statuses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status_name VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create task_custom_types table for custom task type management
CREATE TABLE task_custom_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type_name VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create notifications table
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    notification_id VARCHAR(100) UNIQUE NOT NULL, -- Custom notification ID
    type VARCHAR(20) NOT NULL CHECK (type IN ('success', 'warning', 'info', 'error')),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    time BIGINT NOT NULL, -- Timestamp in milliseconds
    read BOOLEAN DEFAULT false,
    icon VARCHAR(50),
    action_url TEXT,
    action_data JSONB,
    category VARCHAR(20) NOT NULL CHECK (category IN ('task', 'ticket', 'activity', 'system')),
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
    event_type VARCHAR(20) NOT NULL CHECK (event_type IN ('creation', 'status_change', 'completion', 'assignment', 'system')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create notification_settings table
CREATE TABLE notification_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    task_updates BOOLEAN DEFAULT true,
    task_completions BOOLEAN DEFAULT true,
    ticket_updates BOOLEAN DEFAULT true,
    ticket_resolutions BOOLEAN DEFAULT true,
    system_alerts BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create break_sessions table
CREATE TABLE break_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    break_type VARCHAR(50) NOT NULL CHECK (break_type IN ('morning', 'lunch', 'afternoon')),
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP,
    duration_seconds INTEGER,
    time_left_seconds INTEGER,
    is_paused BOOLEAN DEFAULT false,
    pause_time TIMESTAMP,
    emergency_pause_used BOOLEAN DEFAULT false,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'cancelled')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create break_timer_states table for persistent break timer state
CREATE TABLE break_timer_states (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    break_id VARCHAR(50) NOT NULL,
    time_left_seconds INTEGER,
    start_time BIGINT, -- Timestamp in milliseconds
    pause_time BIGINT, -- Timestamp in milliseconds
    emergency_pause_used BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create break_history table for break usage tracking
CREATE TABLE break_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    break_type VARCHAR(50) NOT NULL CHECK (break_type IN ('morning', 'lunch', 'afternoon')),
    used BOOLEAN DEFAULT false,
    paused BOOLEAN DEFAULT false,
    start_time BIGINT, -- Timestamp in milliseconds
    time_left_seconds INTEGER,
    pause_time BIGINT, -- Timestamp in milliseconds
    emergency_pause_used BOOLEAN DEFAULT false,
    date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create activity_sessions table for tracking user activity
CREATE TABLE activity_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_start TIMESTAMP NOT NULL,
    session_end TIMESTAMP,
    total_active_time_seconds INTEGER DEFAULT 0,
    total_inactive_time_seconds INTEGER DEFAULT 0,
    mouse_movements INTEGER DEFAULT 0,
    inactivity_alerts INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    end_reason VARCHAR(50), -- 'logout', 'app-close', 'break', 'inactivity'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create activity_events table for detailed activity tracking
CREATE TABLE activity_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES activity_sessions(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL CHECK (event_type IN ('mouse_move', 'keyboard_activity', 'inactivity_start', 'inactivity_end', 'break_start', 'break_end')),
    event_data JSONB,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create today_activity_data table for today's activity tracking
CREATE TABLE today_activity_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    total_active_time BIGINT DEFAULT 0, -- milliseconds
    total_inactive_time BIGINT DEFAULT 0, -- milliseconds
    total_sessions INTEGER DEFAULT 0,
    average_session_duration BIGINT DEFAULT 0, -- milliseconds
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create yesterday_activity_data table for yesterday's activity tracking
CREATE TABLE yesterday_activity_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    total_active_time BIGINT DEFAULT 0, -- milliseconds
    total_inactive_time BIGINT DEFAULT 0, -- milliseconds
    total_sessions INTEGER DEFAULT 0,
    average_session_duration BIGINT DEFAULT 0, -- milliseconds
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create weekly_activity_data table for weekly summaries
CREATE TABLE weekly_activity_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    week_start_date DATE NOT NULL,
    week_end_date DATE NOT NULL,
    total_active_time BIGINT DEFAULT 0, -- milliseconds
    total_inactive_time BIGINT DEFAULT 0, -- milliseconds
    total_days_worked INTEGER DEFAULT 0,
    average_daily_active_time BIGINT DEFAULT 0, -- milliseconds
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create monthly_activity_data table for monthly summaries
CREATE TABLE monthly_activity_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
    total_active_time BIGINT DEFAULT 0, -- milliseconds
    total_inactive_time BIGINT DEFAULT 0, -- milliseconds
    total_days_worked INTEGER DEFAULT 0,
    average_daily_active_time BIGINT DEFAULT 0, -- milliseconds
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create health_checks table
CREATE TABLE health_checks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    time TIME NOT NULL,
    complaint TEXT NOT NULL,
    medicines TEXT,
    supplies TEXT,
    issued_by VARCHAR(100),
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'completed')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create health_check_requests table
CREATE TABLE health_check_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    request_date DATE NOT NULL,
    request_time TIME NOT NULL,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    approved_by VARCHAR(100),
    approved_at TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create leaderboard_entries table for productivity rankings
CREATE TABLE leaderboard_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    productivity_score DECIMAL(5,2) DEFAULT 0,
    total_active_time BIGINT DEFAULT 0, -- milliseconds
    total_inactive_time BIGINT DEFAULT 0, -- milliseconds
    is_currently_active BOOLEAN DEFAULT false,
    is_in_break BOOLEAN DEFAULT false,
    rank INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create user_profiles table for extended user information
CREATE TABLE user_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    bio TEXT,
    skills TEXT[],
    preferences JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create audit_logs table for system events
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id UUID,
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create system_notifications table for Electron system notifications
CREATE TABLE system_notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    notification_id VARCHAR(100) UNIQUE NOT NULL, -- system_xxx format
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    action_url TEXT,
    is_active BOOLEAN DEFAULT true,
    clicked_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX idx_tickets_user_id ON tickets(user_id);
CREATE INDEX idx_tickets_status ON tickets(status);
CREATE INDEX idx_tickets_category ON tickets(category);
CREATE INDEX idx_tickets_created_at ON tickets(created_at);
CREATE INDEX idx_ticket_files_ticket_id ON ticket_files(ticket_id);
CREATE INDEX idx_ticket_comments_ticket_id ON ticket_comments(ticket_id);
CREATE INDEX idx_tasks_user_id ON tasks(user_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_assignee ON tasks(assignee);
CREATE INDEX idx_tasks_due_date ON tasks(due_date);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(read);
CREATE INDEX idx_notifications_category ON notifications(category);
CREATE INDEX idx_notifications_time ON notifications(time);
CREATE INDEX idx_break_sessions_user_id ON break_sessions(user_id);
CREATE INDEX idx_break_sessions_break_type ON break_sessions(break_type);
CREATE INDEX idx_break_sessions_date ON break_sessions(start_time);
CREATE INDEX idx_break_timer_states_user_id ON break_timer_states(user_id);
CREATE INDEX idx_break_history_user_id ON break_history(user_id);
CREATE INDEX idx_break_history_date ON break_history(date);
CREATE INDEX idx_break_history_break_type ON break_history(break_type);
CREATE INDEX idx_activity_sessions_user_id ON activity_sessions(user_id);
CREATE INDEX idx_activity_sessions_date ON activity_sessions(session_start);
CREATE INDEX idx_activity_events_session_id ON activity_events(session_id);
CREATE INDEX idx_today_activity_data_user_date ON today_activity_data(user_id, date);
CREATE INDEX idx_yesterday_activity_data_user_date ON yesterday_activity_data(user_id, date);
CREATE INDEX idx_weekly_activity_data_user_week_start_date ON weekly_activity_data(user_id, week_start_date);
CREATE INDEX idx_monthly_activity_data_user_year_month ON monthly_activity_data(user_id, year, month);
CREATE INDEX idx_health_checks_user_id ON health_checks(user_id);
CREATE INDEX idx_health_checks_date ON health_checks(date);
CREATE INDEX idx_leaderboard_entries_user_date ON leaderboard_entries(user_id, date);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX idx_system_notifications_user_id ON system_notifications(user_id);
CREATE INDEX idx_system_notifications_active ON system_notifications(is_active);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at columns
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tickets_updated_at BEFORE UPDATE ON tickets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_break_sessions_updated_at BEFORE UPDATE ON break_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_break_timer_states_updated_at BEFORE UPDATE ON break_timer_states FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_break_history_updated_at BEFORE UPDATE ON break_history FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_activity_sessions_updated_at BEFORE UPDATE ON activity_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_today_activity_data_updated_at BEFORE UPDATE ON today_activity_data FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_yesterday_activity_data_updated_at BEFORE UPDATE ON yesterday_activity_data FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_weekly_activity_data_updated_at BEFORE UPDATE ON weekly_activity_data FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_monthly_activity_data_updated_at BEFORE UPDATE ON monthly_activity_data FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_leaderboard_entries_updated_at BEFORE UPDATE ON leaderboard_entries FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_notification_settings_updated_at BEFORE UPDATE ON notification_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default admin user
INSERT INTO users (
    email, 
    password_hash, 
    first_name, 
    last_name, 
    position, 
    department, 
    role
) VALUES (
    'admin@shoreagents.com',
    '$2b$10$example_hash_here', -- Replace with actual hash
    'Admin',
    'User',
    'System Administrator',
    'IT',
    'admin'
);

-- Insert sample user profiles
INSERT INTO user_profiles (user_id, bio, skills, preferences) 
SELECT id, 'System administrator for ShoreAgents dashboard', 
       ARRAY['System Administration', 'Database Management', 'User Support'], 
       '{"theme": "light", "notifications": true}'::jsonb
FROM users WHERE email = 'admin@shoreagents.com';

-- Insert default notification settings
INSERT INTO notification_settings (user_id, task_updates, task_completions, ticket_updates, ticket_resolutions, system_alerts)
SELECT id, true, true, true, true, true
FROM users WHERE email = 'admin@shoreagents.com'; 