-- DROP SCHEMA public;

CREATE SCHEMA public AUTHORIZATION pg_database_owner;

-- DROP TYPE public."break_type_enum";

CREATE TYPE public."break_type_enum" AS ENUM (
	'Morning',
	'Lunch',
	'Afternoon',
	'NightFirst',
	'NightMeal',
	'NightSecond');

-- DROP TYPE public."gender_enum";

CREATE TYPE public."gender_enum" AS ENUM (
	'Male',
	'Female',
	'Other',
	'Prefer not to say');

-- DROP TYPE public."member_status_enum";

CREATE TYPE public."member_status_enum" AS ENUM (
	'Current Client',
	'Lost Client');

-- DROP TYPE public."report_type_enum";

CREATE TYPE public."report_type_enum" AS ENUM (
	'bug',
	'feature',
	'ui',
	'performance',
	'account',
	'other');

-- DROP TYPE public."task_activity_action";

CREATE TYPE public."task_activity_action" AS ENUM (
	'task_created',
	'task_updated',
	'attachments_added',
	'attachment_deleted');

-- DROP TYPE public."ticket_status_enum";

CREATE TYPE public."ticket_status_enum" AS ENUM (
	'For Approval',
	'On Hold',
	'In Progress',
	'Approved',
	'Stuck',
	'Actioned',
	'Closed');

-- DROP TYPE public."user_type_enum";

CREATE TYPE public."user_type_enum" AS ENUM (
	'Agent',
	'Client',
	'Internal');

-- DROP SEQUENCE public.activity_data_id_seq;

CREATE SEQUENCE public.activity_data_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 2147483647
	START 1
	CACHE 1
	NO CYCLE;
-- DROP SEQUENCE public.agent_restroom_status_id_seq;

CREATE SEQUENCE public.agent_restroom_status_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 2147483647
	START 1
	CACHE 1
	NO CYCLE;
-- DROP SEQUENCE public.break_sessions_id_seq;

CREATE SEQUENCE public.break_sessions_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 2147483647
	START 1
	CACHE 1
	NO CYCLE;
-- DROP SEQUENCE public.event_attendance_id_seq;

CREATE SEQUENCE public.event_attendance_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 2147483647
	START 1
	CACHE 1
	NO CYCLE;
-- DROP SEQUENCE public.events_id_seq;

CREATE SEQUENCE public.events_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 2147483647
	START 1
	CACHE 1
	NO CYCLE;
-- DROP SEQUENCE public.health_check_availability_id_seq;

CREATE SEQUENCE public.health_check_availability_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 2147483647
	START 1
	CACHE 1
	NO CYCLE;
-- DROP SEQUENCE public.health_check_records_id_seq;

CREATE SEQUENCE public.health_check_records_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 2147483647
	START 1
	CACHE 1
	NO CYCLE;
-- DROP SEQUENCE public.health_check_requests_id_seq;

CREATE SEQUENCE public.health_check_requests_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 2147483647
	START 1
	CACHE 1
	NO CYCLE;
-- DROP SEQUENCE public.internal_roles_id_seq;

CREATE SEQUENCE public.internal_roles_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 2147483647
	START 1
	CACHE 1
	NO CYCLE;
-- DROP SEQUENCE public.job_info_id_seq;

CREATE SEQUENCE public.job_info_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 2147483647
	START 1
	CACHE 1
	NO CYCLE;
-- DROP SEQUENCE public.meetings_id_seq;

CREATE SEQUENCE public.meetings_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 2147483647
	START 1
	CACHE 1
	NO CYCLE;
-- DROP SEQUENCE public.members_id_seq;

CREATE SEQUENCE public.members_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 2147483647
	START 1
	CACHE 1
	NO CYCLE;
-- DROP SEQUENCE public.monthly_activity_summary_id_seq;

CREATE SEQUENCE public.monthly_activity_summary_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 2147483647
	START 1
	CACHE 1
	NO CYCLE;
-- DROP SEQUENCE public.notifications_id_seq;

CREATE SEQUENCE public.notifications_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 2147483647
	START 1
	CACHE 1
	NO CYCLE;
-- DROP SEQUENCE public.passwords_id_seq;

CREATE SEQUENCE public.passwords_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 2147483647
	START 1
	CACHE 1
	NO CYCLE;
-- DROP SEQUENCE public.personal_info_id_seq;

CREATE SEQUENCE public.personal_info_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 2147483647
	START 1
	CACHE 1
	NO CYCLE;
-- DROP SEQUENCE public.productivity_scores_id_seq;

CREATE SEQUENCE public.productivity_scores_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 2147483647
	START 1
	CACHE 1
	NO CYCLE;
-- DROP SEQUENCE public.reports_id_seq;

CREATE SEQUENCE public.reports_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 2147483647
	START 1
	CACHE 1
	NO CYCLE;
-- DROP SEQUENCE public.roles_id_seq;

CREATE SEQUENCE public.roles_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 2147483647
	START 1
	CACHE 1
	NO CYCLE;
-- DROP SEQUENCE public.task_activity_events_id_seq;

CREATE SEQUENCE public.task_activity_events_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 2147483647
	START 1
	CACHE 1
	NO CYCLE;
-- DROP SEQUENCE public.task_attachments_id_seq;

CREATE SEQUENCE public.task_attachments_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 2147483647
	START 1
	CACHE 1
	NO CYCLE;
-- DROP SEQUENCE public.task_custom_fields_id_seq;

CREATE SEQUENCE public.task_custom_fields_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 2147483647
	START 1
	CACHE 1
	NO CYCLE;
-- DROP SEQUENCE public.task_groups_id_seq;

CREATE SEQUENCE public.task_groups_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 2147483647
	START 1
	CACHE 1
	NO CYCLE;
-- DROP SEQUENCE public.task_relations_id_seq;

CREATE SEQUENCE public.task_relations_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 2147483647
	START 1
	CACHE 1
	NO CYCLE;
-- DROP SEQUENCE public.tasks_id_seq;

CREATE SEQUENCE public.tasks_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 2147483647
	START 1
	CACHE 1
	NO CYCLE;
-- DROP SEQUENCE public.ticket_categories_id_seq;

CREATE SEQUENCE public.ticket_categories_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 2147483647
	START 1
	CACHE 1
	NO CYCLE;
-- DROP SEQUENCE public.ticket_comments_id_seq;

CREATE SEQUENCE public.ticket_comments_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 2147483647
	START 1
	CACHE 1
	NO CYCLE;
-- DROP SEQUENCE public.ticket_id_seq;

CREATE SEQUENCE public.ticket_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 9223372036854775807
	START 1
	CACHE 1
	NO CYCLE;
COMMENT ON SEQUENCE public.ticket_id_seq IS 'Sequence for auto-generating ticket IDs';
-- DROP SEQUENCE public.tickets_id_seq;

CREATE SEQUENCE public.tickets_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 2147483647
	START 1
	CACHE 1
	NO CYCLE;
-- DROP SEQUENCE public.users_id_seq;

CREATE SEQUENCE public.users_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 2147483647
	START 1
	CACHE 1
	NO CYCLE;
-- DROP SEQUENCE public.weekly_activity_summary_id_seq;

CREATE SEQUENCE public.weekly_activity_summary_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 2147483647
	START 1
	CACHE 1
	NO CYCLE;-- public.break_sessions definition

-- Drop table

-- DROP TABLE public.break_sessions;

CREATE TABLE public.break_sessions (
	id serial4 NOT NULL,
	agent_user_id int4 NOT NULL,
	start_time timestamptz NOT NULL,
	end_time timestamptz NULL,
	break_date date NOT NULL,
	pause_time timestamptz NULL,
	resume_time timestamptz NULL,
	time_remaining_at_pause int4 NULL,
	created_at timestamptz DEFAULT now() NULL,
	updated_at timestamptz DEFAULT now() NULL,
	break_type public."break_type_enum" NOT NULL,
	duration_minutes int4 NULL,
	pause_used bool DEFAULT false NULL,
	CONSTRAINT break_sessions_break_type_check CHECK ((break_type = ANY (ARRAY['Morning'::break_type_enum, 'Lunch'::break_type_enum, 'Afternoon'::break_type_enum, 'NightFirst'::break_type_enum, 'NightMeal'::break_type_enum, 'NightSecond'::break_type_enum]))),
	CONSTRAINT break_sessions_pkey PRIMARY KEY (id)
);
CREATE INDEX idx_break_sessions_agent_user_id ON public.break_sessions USING btree (agent_user_id);
CREATE INDEX idx_break_sessions_break_date ON public.break_sessions USING btree (break_date);
CREATE INDEX idx_break_sessions_break_type ON public.break_sessions USING btree (break_type);

-- Table Triggers

create trigger update_break_sessions_updated_at before
update
    on
    public.break_sessions for each row execute function update_updated_at_column();
create trigger calculate_break_duration_trigger before
insert
    or
update
    on
    public.break_sessions for each row execute function calculate_break_duration();


-- public.members definition

-- Drop table

-- DROP TABLE public.members;

CREATE TABLE public.members (
	id serial4 NOT NULL,
	company text NOT NULL,
	address text NULL,
	phone text NULL,
	logo text NULL,
	service text NULL,
	status public."member_status_enum" NULL,
	created_at timestamp DEFAULT ((CURRENT_TIMESTAMP AT TIME ZONE 'UTC'::text) AT TIME ZONE 'Asia/Manila'::text) NULL,
	updated_at timestamp DEFAULT ((CURRENT_TIMESTAMP AT TIME ZONE 'UTC'::text) AT TIME ZONE 'Asia/Manila'::text) NULL,
	badge_color text NULL,
	country text NULL,
	website _text NULL,
	company_id uuid NOT NULL,
	CONSTRAINT members_company_id_key UNIQUE (company_id),
	CONSTRAINT members_pkey PRIMARY KEY (id)
);


-- public.roles definition

-- Drop table

-- DROP TABLE public.roles;

CREATE TABLE public.roles (
	id serial4 NOT NULL,
	"name" text NOT NULL,
	description text NULL,
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	updated_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	CONSTRAINT roles_name_key UNIQUE (name),
	CONSTRAINT roles_pkey PRIMARY KEY (id)
);

-- Table Triggers

create trigger update_roles_updated_at before
update
    on
    public.roles for each row execute function update_updated_at_column();


-- public.ticket_categories definition

-- Drop table

-- DROP TABLE public.ticket_categories;

CREATE TABLE public.ticket_categories (
	id serial4 NOT NULL,
	"name" varchar(100) NOT NULL,
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	updated_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	CONSTRAINT ticket_categories_name_key UNIQUE (name),
	CONSTRAINT ticket_categories_pkey PRIMARY KEY (id)
);
CREATE INDEX idx_ticket_categories_name ON public.ticket_categories USING btree (name);

-- Table Triggers

create trigger update_ticket_categories_updated_at before
update
    on
    public.ticket_categories for each row execute function update_updated_at_column();


-- public.users definition

-- Drop table

-- DROP TABLE public.users;

CREATE TABLE public.users (
	id serial4 NOT NULL,
	email text NOT NULL,
	user_type public."user_type_enum" NOT NULL,
	created_at timestamp DEFAULT ((CURRENT_TIMESTAMP AT TIME ZONE 'UTC'::text) AT TIME ZONE 'Asia/Manila'::text) NULL,
	updated_at timestamp DEFAULT ((CURRENT_TIMESTAMP AT TIME ZONE 'UTC'::text) AT TIME ZONE 'Asia/Manila'::text) NULL,
	CONSTRAINT users_email_key UNIQUE (email),
	CONSTRAINT users_pkey PRIMARY KEY (id)
);

-- Table Triggers

create trigger update_users_updated_at before
update
    on
    public.users for each row execute function update_updated_at_column();


-- public.activity_data definition

-- Drop table

-- DROP TABLE public.activity_data;

CREATE TABLE public.activity_data (
	id serial4 NOT NULL,
	user_id int4 NOT NULL,
	is_currently_active bool DEFAULT false NULL,
	created_at timestamptz DEFAULT now() NULL,
	updated_at timestamptz DEFAULT now() NULL,
	today_active_seconds int4 DEFAULT 0 NULL,
	today_inactive_seconds int4 DEFAULT 0 NULL,
	last_session_start timestamptz NULL,
	today_date date DEFAULT CURRENT_DATE NOT NULL,
	CONSTRAINT activity_data_pkey PRIMARY KEY (id),
	CONSTRAINT activity_data_user_date_unique UNIQUE (user_id, today_date),
	CONSTRAINT activity_data_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
);
CREATE INDEX idx_activity_data_today_date ON public.activity_data USING btree (today_date);
CREATE INDEX idx_activity_data_user_date ON public.activity_data USING btree (user_id, today_date);

-- Table Triggers

create trigger trg_productivity_score_on_time_change after
insert
    or
update
    on
    public.activity_data for each row execute function update_productivity_score_on_time_change();
create trigger trg_auto_aggregate_on_insert after
insert
    on
    public.activity_data for each row execute function auto_aggregate_all_on_activity_change();
create trigger trg_auto_aggregate_on_update after
update
    on
    public.activity_data for each row execute function auto_aggregate_all_on_activity_change();
create trigger update_activity_data_updated_at before
update
    on
    public.activity_data for each row execute function update_updated_at_column();
create trigger notify_activity_data_change after
insert
    or
update
    on
    public.activity_data for each row execute function notify_activity_data_change();


-- public.agent_restroom_status definition

-- Drop table

-- DROP TABLE public.agent_restroom_status;

CREATE TABLE public.agent_restroom_status (
	id serial4 NOT NULL,
	agent_user_id int4 NOT NULL,
	is_in_restroom bool DEFAULT false NOT NULL,
	created_at timestamptz DEFAULT now() NULL,
	updated_at timestamptz DEFAULT now() NULL,
	restroom_count int4 DEFAULT 0 NOT NULL,
	daily_restroom_count int4 DEFAULT 0 NOT NULL,
	last_daily_reset date DEFAULT CURRENT_DATE NULL,
	CONSTRAINT agent_restroom_status_pkey PRIMARY KEY (id),
	CONSTRAINT agent_restroom_status_agent_user_id_fkey FOREIGN KEY (agent_user_id) REFERENCES public.users(id) ON DELETE CASCADE
);
CREATE INDEX idx_agent_restroom_status_agent_user_id ON public.agent_restroom_status USING btree (agent_user_id);
CREATE INDEX idx_agent_restroom_status_is_in_restroom ON public.agent_restroom_status USING btree (is_in_restroom);
CREATE INDEX idx_agent_restroom_status_last_daily_reset ON public.agent_restroom_status USING btree (last_daily_reset);
CREATE UNIQUE INDEX idx_agent_restroom_status_unique_agent ON public.agent_restroom_status USING btree (agent_user_id);

-- Table Triggers

create trigger update_agent_restroom_status_updated_at before
update
    on
    public.agent_restroom_status for each row execute function update_updated_at_column();


-- public.agents definition

-- Drop table

-- DROP TABLE public.agents;

CREATE TABLE public.agents (
	user_id int4 NOT NULL,
	exp_points int4 DEFAULT 0 NULL,
	member_id int4 NOT NULL,
	department_id int4 NULL,
	created_at timestamp DEFAULT ((CURRENT_TIMESTAMP AT TIME ZONE 'UTC'::text) AT TIME ZONE 'Asia/Manila'::text) NULL,
	updated_at timestamp DEFAULT ((CURRENT_TIMESTAMP AT TIME ZONE 'UTC'::text) AT TIME ZONE 'Asia/Manila'::text) NULL,
	CONSTRAINT agents_pkey PRIMARY KEY (user_id),
	CONSTRAINT agents_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.members(id) ON DELETE CASCADE,
	CONSTRAINT agents_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
);


-- public.clients definition

-- Drop table

-- DROP TABLE public.clients;

CREATE TABLE public.clients (
	user_id int4 NOT NULL,
	member_id int4 NOT NULL,
	department_id int4 NULL,
	created_at timestamp DEFAULT ((CURRENT_TIMESTAMP AT TIME ZONE 'UTC'::text) AT TIME ZONE 'Asia/Manila'::text) NULL,
	updated_at timestamp DEFAULT ((CURRENT_TIMESTAMP AT TIME ZONE 'UTC'::text) AT TIME ZONE 'Asia/Manila'::text) NULL,
	CONSTRAINT clients_pkey PRIMARY KEY (user_id),
	CONSTRAINT clients_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.members(id) ON DELETE CASCADE,
	CONSTRAINT clients_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
);


-- public.events definition

-- Drop table

-- DROP TABLE public.events;

CREATE TABLE public.events (
	id serial4 NOT NULL,
	title varchar(255) NOT NULL,
	description text NULL,
	event_date date NOT NULL,
	start_time time NOT NULL,
	end_time time NOT NULL,
	"location" varchar(255) NULL,
	status varchar(20) DEFAULT 'upcoming'::character varying NULL,
	created_by int4 NOT NULL,
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	updated_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	event_type varchar(20) DEFAULT 'event'::character varying NOT NULL,
	assigned_user_ids _int4 NULL,
	CONSTRAINT events_assigned_user_ids_check CHECK (((assigned_user_ids IS NULL) OR (array_length(assigned_user_ids, 1) > 0))),
	CONSTRAINT events_event_type_check CHECK (((event_type)::text = ANY ((ARRAY['event'::character varying, 'activity'::character varying])::text[]))),
	CONSTRAINT events_pkey PRIMARY KEY (id),
	CONSTRAINT events_status_check CHECK (((status)::text = ANY ((ARRAY['upcoming'::character varying, 'today'::character varying, 'cancelled'::character varying, 'ended'::character varying])::text[]))),
	CONSTRAINT events_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE CASCADE
);
CREATE INDEX idx_events_assigned_user_ids ON public.events USING gin (assigned_user_ids);
CREATE INDEX idx_events_created_by ON public.events USING btree (created_by);
CREATE INDEX idx_events_date ON public.events USING btree (event_date);
CREATE INDEX idx_events_status ON public.events USING btree (status);
CREATE INDEX idx_events_status_date ON public.events USING btree (status, event_date);
CREATE INDEX idx_events_type_status ON public.events USING btree (event_type, status);

-- Table Triggers

create trigger events_notify_trigger after
insert
    or
delete
    or
update
    on
    public.events for each row execute function notify_event_change();


-- public.health_check_availability definition

-- Drop table

-- DROP TABLE public.health_check_availability;

CREATE TABLE public.health_check_availability (
	id serial4 NOT NULL,
	nurse_id int4 NOT NULL,
	day_of_week int4 NOT NULL,
	shift_start time NOT NULL,
	shift_end time NOT NULL,
	is_available bool DEFAULT true NULL,
	break_start time NULL,
	break_end time NULL,
	created_at timestamptz DEFAULT now() NULL,
	updated_at timestamptz DEFAULT now() NULL,
	CONSTRAINT health_check_availability_day_of_week_check CHECK (((day_of_week >= 0) AND (day_of_week <= 6))),
	CONSTRAINT health_check_availability_pkey PRIMARY KEY (id),
	CONSTRAINT health_check_availability_nurse_id_fkey FOREIGN KEY (nurse_id) REFERENCES public.users(id) ON DELETE CASCADE
);
CREATE INDEX idx_health_check_availability_day_of_week ON public.health_check_availability USING btree (day_of_week);
CREATE INDEX idx_health_check_availability_nurse_id ON public.health_check_availability USING btree (nurse_id);
CREATE UNIQUE INDEX idx_health_check_availability_unique ON public.health_check_availability USING btree (nurse_id, day_of_week);

-- Table Triggers

create trigger update_health_check_availability_updated_at before
update
    on
    public.health_check_availability for each row execute function update_updated_at_column();


-- public.health_check_requests definition

-- Drop table

-- DROP TABLE public.health_check_requests;

CREATE TABLE public.health_check_requests (
	id serial4 NOT NULL,
	user_id int4 NOT NULL,
	nurse_id int4 NULL,
	status varchar(50) DEFAULT 'pending'::character varying NOT NULL,
	priority varchar(20) DEFAULT 'normal'::character varying NOT NULL,
	complaint text NULL,
	symptoms text NULL,
	request_time timestamptz DEFAULT now() NULL,
	approved_time timestamptz NULL,
	completed_time timestamptz NULL,
	notes text NULL,
	created_at timestamptz DEFAULT now() NULL,
	updated_at timestamptz DEFAULT now() NULL,
	done bool DEFAULT false NOT NULL,
	going_to_clinic bool DEFAULT false NOT NULL,
	in_clinic bool DEFAULT false NOT NULL,
	going_to_clinic_at timestamptz NULL,
	in_clinic_at timestamptz NULL,
	CONSTRAINT health_check_requests_pkey PRIMARY KEY (id),
	CONSTRAINT health_check_requests_priority_check CHECK (((priority)::text = ANY ((ARRAY['low'::character varying, 'normal'::character varying, 'high'::character varying, 'urgent'::character varying])::text[]))),
	CONSTRAINT health_check_requests_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'approved'::character varying, 'rejected'::character varying, 'completed'::character varying, 'cancelled'::character varying])::text[]))),
	CONSTRAINT health_check_requests_nurse_id_fkey FOREIGN KEY (nurse_id) REFERENCES public.users(id) ON DELETE SET NULL,
	CONSTRAINT health_check_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
);
CREATE INDEX idx_health_check_requests_done ON public.health_check_requests USING btree (done);
CREATE INDEX idx_health_check_requests_going_to_clinic ON public.health_check_requests USING btree (going_to_clinic);
CREATE INDEX idx_health_check_requests_going_to_clinic_at ON public.health_check_requests USING btree (going_to_clinic_at);
CREATE INDEX idx_health_check_requests_in_clinic ON public.health_check_requests USING btree (in_clinic);
CREATE INDEX idx_health_check_requests_in_clinic_at ON public.health_check_requests USING btree (in_clinic_at);
CREATE INDEX idx_health_check_requests_nurse_id ON public.health_check_requests USING btree (nurse_id);
CREATE INDEX idx_health_check_requests_request_time ON public.health_check_requests USING btree (request_time);
CREATE INDEX idx_health_check_requests_status ON public.health_check_requests USING btree (status);
CREATE INDEX idx_health_check_requests_user_id ON public.health_check_requests USING btree (user_id);

-- Table Triggers

create trigger health_check_events_trigger after
insert
    or
update
    on
    public.health_check_requests for each row execute function notify_health_check_event();
create trigger health_check_field_update_trigger before
update
    on
    public.health_check_requests for each row execute function trigger_health_check_field_update();
create trigger update_health_check_requests_updated_at before
update
    on
    public.health_check_requests for each row execute function update_updated_at_column();


-- public.internal definition

-- Drop table

-- DROP TABLE public.internal;

CREATE TABLE public.internal (
	user_id int4 NOT NULL,
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	updated_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	CONSTRAINT internal_pkey PRIMARY KEY (user_id),
	CONSTRAINT internal_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
);

-- Table Triggers

create trigger update_internal_updated_at before
update
    on
    public.internal for each row execute function update_updated_at_column();


-- public.internal_roles definition

-- Drop table

-- DROP TABLE public.internal_roles;

CREATE TABLE public.internal_roles (
	id serial4 NOT NULL,
	internal_user_id int4 NOT NULL,
	role_id int4 NOT NULL,
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	updated_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	CONSTRAINT internal_roles_pkey PRIMARY KEY (id),
	CONSTRAINT unique_internal_role_assignment UNIQUE (internal_user_id, role_id),
	CONSTRAINT internal_roles_internal_user_id_fkey FOREIGN KEY (internal_user_id) REFERENCES public.internal(user_id) ON DELETE CASCADE,
	CONSTRAINT internal_roles_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE
);

-- Table Triggers

create trigger update_internal_roles_updated_at before
update
    on
    public.internal_roles for each row execute function update_updated_at_column();


-- public.job_info definition

-- Drop table

-- DROP TABLE public.job_info;

CREATE TABLE public.job_info (
	id serial4 NOT NULL,
	employee_id varchar(20) NOT NULL,
	agent_user_id int4 NULL,
	internal_user_id int4 NULL,
	job_title text NULL,
	shift_period text NULL,
	shift_schedule text NULL,
	shift_time text NULL,
	work_setup text NULL,
	employment_status text NULL,
	hire_type text NULL,
	staff_source text NULL,
	start_date date NULL,
	exit_date date NULL,
	created_at timestamp DEFAULT ((CURRENT_TIMESTAMP AT TIME ZONE 'UTC'::text) AT TIME ZONE 'Asia/Manila'::text) NULL,
	updated_at timestamp DEFAULT ((CURRENT_TIMESTAMP AT TIME ZONE 'UTC'::text) AT TIME ZONE 'Asia/Manila'::text) NULL,
	CONSTRAINT chk_job_info_employee_type CHECK ((((agent_user_id IS NOT NULL) AND (internal_user_id IS NULL)) OR ((agent_user_id IS NULL) AND (internal_user_id IS NOT NULL)))),
	CONSTRAINT job_info_employee_id_key UNIQUE (employee_id),
	CONSTRAINT job_info_pkey PRIMARY KEY (id),
	CONSTRAINT job_info_agent_user_id_fkey FOREIGN KEY (agent_user_id) REFERENCES public.agents(user_id) ON DELETE CASCADE
);


-- public.meetings definition

-- Drop table

-- DROP TABLE public.meetings;

CREATE TABLE public.meetings (
	id serial4 NOT NULL,
	agent_user_id int4 NOT NULL,
	title varchar(255) NOT NULL,
	description text NULL,
	start_time timestamptz DEFAULT now() NULL,
	end_time timestamptz DEFAULT now() NULL,
	duration_minutes int4 NOT NULL,
	meeting_type varchar(50) NOT NULL,
	status varchar(50) DEFAULT 'scheduled'::character varying NOT NULL,
	is_in_meeting bool DEFAULT false NOT NULL,
	created_at timestamptz DEFAULT now() NULL,
	updated_at timestamptz DEFAULT now() NULL,
	started_automatically bool DEFAULT false NULL,
	CONSTRAINT check_meeting_status_consistency CHECK ((((is_in_meeting = true) AND ((status)::text = 'in-progress'::text)) OR (is_in_meeting = false))),
	CONSTRAINT meetings_meeting_type_check CHECK (((meeting_type)::text = ANY ((ARRAY['video'::character varying, 'audio'::character varying, 'in-person'::character varying])::text[]))),
	CONSTRAINT meetings_pkey PRIMARY KEY (id),
	CONSTRAINT meetings_status_check CHECK (((status)::text = ANY ((ARRAY['scheduled'::character varying, 'in-progress'::character varying, 'completed'::character varying, 'cancelled'::character varying])::text[]))),
	CONSTRAINT meetings_agent_user_id_fkey FOREIGN KEY (agent_user_id) REFERENCES public.users(id) ON DELETE CASCADE
);
CREATE INDEX idx_meetings_agent_user_id ON public.meetings USING btree (agent_user_id);
CREATE INDEX idx_meetings_created_at ON public.meetings USING btree (created_at);
CREATE INDEX idx_meetings_notification_queries ON public.meetings USING btree (status, start_time, started_automatically) WHERE ((status)::text = ANY ((ARRAY['scheduled'::character varying, 'in-progress'::character varying])::text[]));
CREATE INDEX idx_meetings_start_time ON public.meetings USING btree (start_time);
CREATE INDEX idx_meetings_started_automatically ON public.meetings USING btree (started_automatically);
CREATE INDEX idx_meetings_status ON public.meetings USING btree (status);

-- Table Triggers

create trigger trigger_update_meetings_updated_at before
update
    on
    public.meetings for each row execute function update_meetings_updated_at();
create trigger trigger_meeting_status_change after
insert
    or
update
    on
    public.meetings for each row execute function notify_meeting_status_change();
create trigger trigger_meeting_end after
update
    on
    public.meetings for each row execute function notify_meeting_end();


-- public.monthly_activity_summary definition

-- Drop table

-- DROP TABLE public.monthly_activity_summary;

CREATE TABLE public.monthly_activity_summary (
	id serial4 NOT NULL,
	user_id int4 NOT NULL,
	month_start_date date NOT NULL,
	month_end_date date NOT NULL,
	total_active_seconds int4 DEFAULT 0 NULL,
	total_inactive_seconds int4 DEFAULT 0 NULL,
	total_days_active int4 DEFAULT 0 NULL,
	created_at timestamptz DEFAULT now() NULL,
	updated_at timestamptz DEFAULT now() NULL,
	CONSTRAINT monthly_activity_summary_pkey PRIMARY KEY (id),
	CONSTRAINT monthly_activity_summary_user_id_month_start_date_key UNIQUE (user_id, month_start_date),
	CONSTRAINT monthly_activity_summary_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
);
CREATE INDEX idx_monthly_activity_created_at ON public.monthly_activity_summary USING btree (created_at);
CREATE INDEX idx_monthly_activity_month_dates ON public.monthly_activity_summary USING btree (month_start_date, month_end_date);
CREATE INDEX idx_monthly_activity_user_id ON public.monthly_activity_summary USING btree (user_id);

-- Table Triggers

create trigger update_monthly_activity_updated_at before
update
    on
    public.monthly_activity_summary for each row execute function update_updated_at_column();
create trigger notify_monthly_activity_change after
insert
    or
update
    on
    public.monthly_activity_summary for each row execute function notify_monthly_activity_change();
create trigger trg_notify_monthly_activity_insert after
insert
    on
    public.monthly_activity_summary for each row execute function notify_monthly_activity_change();
create trigger trg_notify_monthly_activity_update after
update
    on
    public.monthly_activity_summary for each row execute function notify_monthly_activity_change();
create trigger trg_notify_monthly_activity_delete after
delete
    on
    public.monthly_activity_summary for each row execute function notify_monthly_activity_change();


-- public.notifications definition

-- Drop table

-- DROP TABLE public.notifications;

CREATE TABLE public.notifications (
	id serial4 NOT NULL,
	user_id int4 NOT NULL,
	category text NOT NULL,
	"type" text NOT NULL,
	title text NOT NULL,
	message text NOT NULL,
	payload jsonb NULL,
	is_read bool DEFAULT false NULL,
	created_at timestamptz DEFAULT now() NULL,
	clear bool DEFAULT false NULL,
	CONSTRAINT notifications_pkey PRIMARY KEY (id),
	CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
);
CREATE INDEX idx_notifications_clear ON public.notifications USING btree (clear);
CREATE INDEX idx_notifications_meeting_lookup ON public.notifications USING btree (user_id, category, ((payload ->> 'meeting_id'::text)), ((payload ->> 'notification_type'::text)));
CREATE INDEX idx_notifications_user_created ON public.notifications USING btree (user_id, created_at DESC);

-- Table Triggers

create trigger trg_notify_notification after
insert
    on
    public.notifications for each row execute function notify_notification();


-- public.passwords definition

-- Drop table

-- DROP TABLE public.passwords;

CREATE TABLE public.passwords (
	id serial4 NOT NULL,
	user_id int4 NOT NULL,
	"password" text NOT NULL,
	created_at timestamp DEFAULT ((CURRENT_TIMESTAMP AT TIME ZONE 'UTC'::text) AT TIME ZONE 'Asia/Manila'::text) NULL,
	updated_at timestamp DEFAULT ((CURRENT_TIMESTAMP AT TIME ZONE 'UTC'::text) AT TIME ZONE 'Asia/Manila'::text) NULL,
	CONSTRAINT passwords_pkey PRIMARY KEY (id),
	CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
);

-- Table Triggers

create trigger update_passwords_updated_at before
update
    on
    public.passwords for each row execute function update_updated_at_column();


-- public.personal_info definition

-- Drop table

-- DROP TABLE public.personal_info;

CREATE TABLE public.personal_info (
	id serial4 NOT NULL,
	user_id int4 NOT NULL,
	first_name text NOT NULL,
	middle_name text NULL,
	last_name text NOT NULL,
	nickname text NULL,
	profile_picture text NULL,
	phone text NULL,
	birthday date NULL,
	city text NULL,
	address text NULL,
	gender public."gender_enum" NULL,
	created_at timestamp DEFAULT ((CURRENT_TIMESTAMP AT TIME ZONE 'UTC'::text) AT TIME ZONE 'Asia/Manila'::text) NULL,
	updated_at timestamp DEFAULT ((CURRENT_TIMESTAMP AT TIME ZONE 'UTC'::text) AT TIME ZONE 'Asia/Manila'::text) NULL,
	CONSTRAINT personal_info_pkey PRIMARY KEY (id),
	CONSTRAINT personal_info_user_id_key UNIQUE (user_id),
	CONSTRAINT personal_info_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
);

-- Table Triggers

create trigger update_personal_info_updated_at before
update
    on
    public.personal_info for each row execute function update_updated_at_column();


-- public.productivity_scores definition

-- Drop table

-- DROP TABLE public.productivity_scores;

CREATE TABLE public.productivity_scores (
	id serial4 NOT NULL,
	user_id int4 NOT NULL,
	month_year varchar(7) NOT NULL,
	productivity_score numeric(5, 2) NOT NULL,
	total_active_seconds int4 DEFAULT 0 NULL,
	total_inactive_seconds int4 DEFAULT 0 NULL,
	total_seconds int4 DEFAULT 0 NULL,
	active_percentage numeric(5, 2) DEFAULT 0.00 NULL,
	created_at timestamptz DEFAULT now() NULL,
	updated_at timestamptz DEFAULT now() NULL,
	CONSTRAINT productivity_scores_pkey PRIMARY KEY (id),
	CONSTRAINT productivity_scores_user_id_month_year_key UNIQUE (user_id, month_year),
	CONSTRAINT productivity_scores_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
);
CREATE INDEX idx_productivity_created_at ON public.productivity_scores USING btree (created_at);
CREATE INDEX idx_productivity_month_year ON public.productivity_scores USING btree (month_year);
CREATE INDEX idx_productivity_score ON public.productivity_scores USING btree (productivity_score);
CREATE INDEX idx_productivity_user_id ON public.productivity_scores USING btree (user_id);

-- Table Triggers

create trigger update_productivity_scores_updated_at before
update
    on
    public.productivity_scores for each row execute function update_updated_at_column();


-- public.reports definition

-- Drop table

-- DROP TABLE public.reports;

CREATE TABLE public.reports (
	id serial4 NOT NULL,
	user_id int4 NOT NULL,
	report_type public."report_type_enum" NOT NULL,
	title varchar(255) NOT NULL,
	description text NOT NULL,
	created_at timestamptz DEFAULT now() NULL,
	updated_at timestamptz DEFAULT now() NULL,
	CONSTRAINT reports_pkey PRIMARY KEY (id),
	CONSTRAINT fk_reports_user_id FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
);
CREATE INDEX idx_reports_created_at ON public.reports USING btree (created_at);
CREATE INDEX idx_reports_user_id ON public.reports USING btree (user_id);

-- Table Triggers

create trigger update_reports_updated_at before
update
    on
    public.reports for each row execute function update_reports_updated_at();


-- public.task_groups definition

-- Drop table

-- DROP TABLE public.task_groups;

CREATE TABLE public.task_groups (
	id serial4 NOT NULL,
	title varchar(255) NOT NULL,
	color varchar(100) DEFAULT 'bg-gray-100 dark:bg-gray-800'::character varying NULL,
	"position" int4 DEFAULT 0 NOT NULL,
	is_default bool DEFAULT false NULL,
	created_at timestamptz DEFAULT (now() AT TIME ZONE 'Asia/Manila'::text) NULL,
	updated_at timestamptz DEFAULT (now() AT TIME ZONE 'Asia/Manila'::text) NULL,
	created_by int4 NULL,
	CONSTRAINT task_groups_pkey PRIMARY KEY (id),
	CONSTRAINT task_groups_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id)
);
CREATE INDEX idx_task_groups_created_by ON public.task_groups USING btree (created_by);

-- Table Triggers

create trigger update_task_groups_updated_at before
update
    on
    public.task_groups for each row execute function update_task_updated_at_column();
create trigger notify_task_groups_change after
insert
    or
delete
    or
update
    on
    public.task_groups for each row execute function notify_task_table_change();


-- public.tasks definition

-- Drop table

-- DROP TABLE public.tasks;

CREATE TABLE public.tasks (
	id serial4 NOT NULL,
	user_id int4 NOT NULL,
	group_id int4 NOT NULL,
	title varchar(255) NOT NULL,
	description text NULL,
	priority varchar(50) DEFAULT 'normal'::character varying NULL,
	tags _text NULL,
	"position" int4 DEFAULT 0 NOT NULL,
	status varchar(50) DEFAULT 'active'::character varying NULL,
	created_at timestamptz DEFAULT (now() AT TIME ZONE 'Asia/Manila'::text) NULL,
	updated_at timestamptz DEFAULT (now() AT TIME ZONE 'Asia/Manila'::text) NULL,
	start_date timestamptz NULL,
	due_date timestamptz NULL,
	CONSTRAINT tasks_pkey PRIMARY KEY (id),
	CONSTRAINT tasks_priority_check CHECK (((priority)::text = ANY ((ARRAY['urgent'::character varying, 'high'::character varying, 'normal'::character varying, 'low'::character varying])::text[]))),
	CONSTRAINT tasks_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'deleted'::character varying])::text[]))),
	CONSTRAINT tasks_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.task_groups(id) ON DELETE CASCADE,
	CONSTRAINT tasks_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
);
CREATE INDEX idx_tasks_group_id ON public.tasks USING btree (group_id);
CREATE INDEX idx_tasks_position ON public.tasks USING btree (group_id, "position");
CREATE INDEX idx_tasks_user_id ON public.tasks USING btree (user_id);

-- Table Triggers

create trigger update_tasks_updated_at before
update
    on
    public.tasks for each row execute function update_task_updated_at_column();
create trigger notify_tasks_change after
insert
    or
delete
    or
update
    on
    public.tasks for each row execute function notify_task_table_change();
create trigger trg_task_due_soon after
insert
    or
update
    of due_date,
    status on
    public.tasks for each row execute function notify_task_due_soon();
create trigger trg_auto_assign_task_creator after
insert
    on
    public.tasks for each row execute function auto_assign_task_creator();


-- public.tickets definition

-- Drop table

-- DROP TABLE public.tickets;

CREATE TABLE public.tickets (
	id serial4 NOT NULL,
	ticket_id varchar(50) NOT NULL,
	user_id int4 NOT NULL,
	concern text NOT NULL,
	details text NULL,
	status public."ticket_status_enum" DEFAULT 'For Approval'::ticket_status_enum NOT NULL,
	resolved_by int4 NULL,
	resolved_at timestamptz NULL,
	created_at timestamptz DEFAULT now() NULL,
	updated_at timestamptz DEFAULT now() NULL,
	"position" int4 DEFAULT 0 NOT NULL,
	category_id int4 NULL,
	supporting_files _text DEFAULT '{}'::text[] NULL,
	file_count int4 DEFAULT 0 NULL,
	role_id int4 NULL,
	CONSTRAINT check_file_count CHECK (((file_count = array_length(supporting_files, 1)) OR ((file_count = 0) AND (supporting_files = '{}'::text[])))),
	CONSTRAINT tickets_pkey PRIMARY KEY (id),
	CONSTRAINT tickets_ticket_id_key UNIQUE (ticket_id),
	CONSTRAINT tickets_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.ticket_categories(id) ON DELETE SET NULL,
	CONSTRAINT tickets_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES public.users(id) ON DELETE SET NULL,
	CONSTRAINT tickets_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE SET NULL,
	CONSTRAINT tickets_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
);
CREATE INDEX idx_tickets_category_id ON public.tickets USING btree (category_id);
CREATE INDEX idx_tickets_created_at ON public.tickets USING btree (created_at);
CREATE INDEX idx_tickets_resolved_by ON public.tickets USING btree (resolved_by);
CREATE INDEX idx_tickets_role_id ON public.tickets USING btree (role_id);
CREATE INDEX idx_tickets_status ON public.tickets USING btree (status);
CREATE INDEX idx_tickets_ticket_id ON public.tickets USING btree (ticket_id);
CREATE INDEX idx_tickets_user_id ON public.tickets USING btree (user_id);
CREATE INDEX idx_tickets_user_id_created_at ON public.tickets USING btree (user_id, created_at DESC);

-- Table Triggers

create trigger update_tickets_updated_at before
update
    on
    public.tickets for each row execute function update_updated_at_column();
create trigger auto_generate_ticket_id before
insert
    on
    public.tickets for each row
    when (((new.ticket_id is null)
        or ((new.ticket_id)::text = ''::text))) execute function generate_ticket_id();
create trigger notify_ticket_insert after
insert
    on
    public.tickets for each row execute function notify_ticket_change();
create trigger notify_ticket_update after
update
    on
    public.tickets for each row execute function notify_ticket_change();
create trigger notify_ticket_delete after
delete
    on
    public.tickets for each row execute function notify_ticket_change();
create trigger trg_ticket_status_notification after
update
    on
    public.tickets for each row execute function create_ticket_status_notification();
create trigger ticket_changes_notify_insert after
insert
    on
    public.tickets for each row execute function notify_ticket_change();
create trigger ticket_changes_notify_update after
update
    on
    public.tickets for each row execute function notify_ticket_change();
create trigger ticket_changes_notify_delete after
delete
    on
    public.tickets for each row execute function notify_ticket_change();


-- public.weekly_activity_summary definition

-- Drop table

-- DROP TABLE public.weekly_activity_summary;

CREATE TABLE public.weekly_activity_summary (
	id serial4 NOT NULL,
	user_id int4 NOT NULL,
	week_start_date date NOT NULL,
	week_end_date date NOT NULL,
	total_active_seconds int4 DEFAULT 0 NULL,
	total_inactive_seconds int4 DEFAULT 0 NULL,
	total_days_active int4 DEFAULT 0 NULL,
	created_at timestamptz DEFAULT now() NULL,
	updated_at timestamptz DEFAULT now() NULL,
	CONSTRAINT weekly_activity_summary_pkey PRIMARY KEY (id),
	CONSTRAINT weekly_activity_summary_user_id_week_start_date_key UNIQUE (user_id, week_start_date),
	CONSTRAINT weekly_activity_summary_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
);
CREATE INDEX idx_weekly_activity_created_at ON public.weekly_activity_summary USING btree (created_at);
CREATE INDEX idx_weekly_activity_user_id ON public.weekly_activity_summary USING btree (user_id);
CREATE INDEX idx_weekly_activity_week_dates ON public.weekly_activity_summary USING btree (week_start_date, week_end_date);

-- Table Triggers

create trigger trg_notify_weekly_activity_insert after
insert
    on
    public.weekly_activity_summary for each row execute function notify_weekly_activity_change();
create trigger trg_notify_weekly_activity_update after
update
    on
    public.weekly_activity_summary for each row execute function notify_weekly_activity_change();
create trigger trg_notify_weekly_activity_delete after
delete
    on
    public.weekly_activity_summary for each row execute function notify_weekly_activity_change();
create trigger update_weekly_activity_updated_at before
update
    on
    public.weekly_activity_summary for each row execute function update_updated_at_column();
create trigger notify_weekly_activity_change after
insert
    or
update
    on
    public.weekly_activity_summary for each row execute function notify_weekly_activity_change();


-- public.event_attendance definition

-- Drop table

-- DROP TABLE public.event_attendance;

CREATE TABLE public.event_attendance (
	id serial4 NOT NULL,
	event_id int4 NOT NULL,
	user_id int4 NOT NULL,
	is_going bool DEFAULT false NULL,
	is_back bool DEFAULT false NULL,
	going_at timestamp NULL,
	back_at timestamp NULL,
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	updated_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	CONSTRAINT event_attendance_event_id_user_id_key UNIQUE (event_id, user_id),
	CONSTRAINT event_attendance_pkey PRIMARY KEY (id),
	CONSTRAINT event_attendance_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE,
	CONSTRAINT event_attendance_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
);
CREATE INDEX idx_event_attendance_event_id ON public.event_attendance USING btree (event_id);
CREATE INDEX idx_event_attendance_going ON public.event_attendance USING btree (is_going, is_back) WHERE (is_going = true);
CREATE INDEX idx_event_attendance_user_event ON public.event_attendance USING btree (user_id, event_id);
CREATE INDEX idx_event_attendance_user_id ON public.event_attendance USING btree (user_id);

-- Table Triggers

create trigger event_attendance_notify_trigger after
insert
    or
delete
    or
update
    on
    public.event_attendance for each row execute function notify_event_attendance_change();


-- public.health_check_records definition

-- Drop table

-- DROP TABLE public.health_check_records;

CREATE TABLE public.health_check_records (
	id serial4 NOT NULL,
	request_id int4 NULL,
	user_id int4 NOT NULL,
	nurse_id int4 NOT NULL,
	visit_date date NOT NULL,
	visit_time time NOT NULL,
	chief_complaint text NOT NULL,
	diagnosis text NULL,
	treatment_plan text NULL,
	medicines_issued text NULL,
	supplies_issued text NULL,
	follow_up_required bool DEFAULT false NULL,
	follow_up_date date NULL,
	follow_up_notes text NULL,
	created_at timestamptz DEFAULT now() NULL,
	updated_at timestamptz DEFAULT now() NULL,
	CONSTRAINT health_check_records_pkey PRIMARY KEY (id),
	CONSTRAINT health_check_records_nurse_id_fkey FOREIGN KEY (nurse_id) REFERENCES public.users(id) ON DELETE CASCADE,
	CONSTRAINT health_check_records_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.health_check_requests(id) ON DELETE SET NULL,
	CONSTRAINT health_check_records_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
);
CREATE INDEX idx_health_check_records_nurse_id ON public.health_check_records USING btree (nurse_id);
CREATE INDEX idx_health_check_records_request_id ON public.health_check_records USING btree (request_id);
CREATE UNIQUE INDEX idx_health_check_records_unique ON public.health_check_records USING btree (user_id, nurse_id, visit_date, visit_time);
CREATE INDEX idx_health_check_records_user_id ON public.health_check_records USING btree (user_id);
CREATE INDEX idx_health_check_records_visit_date ON public.health_check_records USING btree (visit_date);

-- Table Triggers

create trigger update_health_check_records_updated_at before
update
    on
    public.health_check_records for each row execute function update_updated_at_column();


-- public.task_activity_events definition

-- Drop table

-- DROP TABLE public.task_activity_events;

CREATE TABLE public.task_activity_events (
	id serial4 NOT NULL,
	task_id int4 NOT NULL,
	actor_user_id int4 NULL,
	"action" public."task_activity_action" NOT NULL,
	details jsonb DEFAULT '{}'::jsonb NOT NULL,
	created_at timestamptz DEFAULT now() NOT NULL,
	CONSTRAINT task_activity_events_pkey PRIMARY KEY (id),
	CONSTRAINT task_activity_events_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES public.users(id) ON DELETE SET NULL,
	CONSTRAINT task_activity_events_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE
);
CREATE INDEX idx_task_activity_events_created_at ON public.task_activity_events USING btree (created_at DESC);
CREATE INDEX idx_task_activity_events_task_id ON public.task_activity_events USING btree (task_id);


-- public.task_assignees definition

-- Drop table

-- DROP TABLE public.task_assignees;

CREATE TABLE public.task_assignees (
	task_id int4 NOT NULL,
	user_id int4 NOT NULL,
	CONSTRAINT task_assignees_pkey PRIMARY KEY (task_id, user_id),
	CONSTRAINT task_assignees_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE,
	CONSTRAINT task_assignees_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
);

-- Table Triggers

create trigger trg_task_assignment_notification after
insert
    on
    public.task_assignees for each row execute function create_task_assignment_notification();
create trigger trg_task_assignment_removal_notification after
delete
    on
    public.task_assignees for each row execute function handle_task_assignment_removal();
create trigger notify_task_assignees_change after
insert
    or
delete
    or
update
    on
    public.task_assignees for each row execute function notify_task_table_change();


-- public.task_attachments definition

-- Drop table

-- DROP TABLE public.task_attachments;

CREATE TABLE public.task_attachments (
	id serial4 NOT NULL,
	task_id int4 NOT NULL,
	"name" text NULL,
	url text NOT NULL,
	"type" text NULL,
	"size" int8 NULL,
	"position" int4 DEFAULT 0 NULL,
	created_at timestamptz DEFAULT now() NULL,
	updated_at timestamptz DEFAULT now() NULL,
	"path" text NULL,
	CONSTRAINT task_attachments_pkey PRIMARY KEY (id),
	CONSTRAINT task_attachments_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE
);
CREATE INDEX idx_task_attachments_task_id ON public.task_attachments USING btree (task_id);

-- Table Triggers

create trigger update_task_attachments_updated_at before
update
    on
    public.task_attachments for each row execute function update_updated_at_column();
create trigger notify_task_attachments_change after
insert
    or
delete
    or
update
    on
    public.task_attachments for each row execute function notify_task_table_change();


-- public.task_comments definition

-- Drop table

-- DROP TABLE public.task_comments;

CREATE TABLE public.task_comments (
	id uuid DEFAULT gen_random_uuid() NOT NULL,
	task_id int4 NOT NULL,
	user_id int4 NOT NULL,
	"content" text NOT NULL,
	created_at timestamptz DEFAULT now() NOT NULL,
	updated_at timestamptz DEFAULT now() NOT NULL,
	CONSTRAINT task_comments_pkey PRIMARY KEY (id),
	CONSTRAINT task_comments_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE,
	CONSTRAINT task_comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
);
CREATE INDEX idx_task_comments_created_at ON public.task_comments USING btree (created_at);
CREATE INDEX idx_task_comments_task_id ON public.task_comments USING btree (task_id);
CREATE INDEX idx_task_comments_user_id ON public.task_comments USING btree (user_id);

-- Table Triggers

create trigger trg_task_comments_set_updated_at before
update
    on
    public.task_comments for each row execute function update_task_comments_updated_at();
create trigger notify_task_comment_change after
insert
    or
delete
    or
update
    on
    public.task_comments for each row execute function notify_task_comment_change();
create trigger trg_task_comment_notification after
insert
    on
    public.task_comments for each row execute function create_task_comment_notification();


-- public.task_custom_fields definition

-- Drop table

-- DROP TABLE public.task_custom_fields;

CREATE TABLE public.task_custom_fields (
	id serial4 NOT NULL,
	task_id int4 NOT NULL,
	title text NOT NULL,
	description text DEFAULT ''::text NOT NULL,
	"position" int4 DEFAULT 0 NOT NULL,
	created_at timestamptz DEFAULT now() NULL,
	updated_at timestamptz DEFAULT now() NULL,
	CONSTRAINT task_custom_fields_pkey PRIMARY KEY (id),
	CONSTRAINT task_custom_fields_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE
);
CREATE INDEX idx_task_custom_fields_position ON public.task_custom_fields USING btree (task_id, "position");
CREATE INDEX idx_task_custom_fields_task_id ON public.task_custom_fields USING btree (task_id);

-- Table Triggers

create trigger trg_update_task_custom_fields_updated_at before
update
    on
    public.task_custom_fields for each row execute function update_task_custom_fields_updated_at();
create trigger notify_task_custom_fields_change after
insert
    or
delete
    or
update
    on
    public.task_custom_fields for each row execute function notify_task_table_change();


-- public.task_relations definition

-- Drop table

-- DROP TABLE public.task_relations;

CREATE TABLE public.task_relations (
	id serial4 NOT NULL,
	task_id int4 NOT NULL,
	related_task_id int4 NOT NULL,
	"type" text DEFAULT 'related_to'::text NOT NULL,
	created_at timestamptz DEFAULT (now() AT TIME ZONE 'Asia/Manila'::text) NULL,
	CONSTRAINT task_relations_pkey PRIMARY KEY (id),
	CONSTRAINT task_relations_type_check CHECK ((type = 'related_to'::text)),
	CONSTRAINT task_relations_related_task_id_fkey FOREIGN KEY (related_task_id) REFERENCES public.tasks(id) ON DELETE CASCADE,
	CONSTRAINT task_relations_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE
);
CREATE INDEX idx_task_relations_related_task_id ON public.task_relations USING btree (related_task_id);
CREATE INDEX idx_task_relations_task_id ON public.task_relations USING btree (task_id);
CREATE UNIQUE INDEX uniq_task_relation ON public.task_relations USING btree (task_id, related_task_id, type);

-- Table Triggers

create trigger notify_task_relations_change after
insert
    or
delete
    or
update
    on
    public.task_relations for each row execute function notify_task_table_change();


-- public.ticket_comments definition

-- Drop table

-- DROP TABLE public.ticket_comments;

CREATE TABLE public.ticket_comments (
	id serial4 NOT NULL,
	ticket_id int4 NOT NULL,
	user_id int4 NOT NULL,
	"comment" text NOT NULL,
	created_at timestamptz DEFAULT now() NULL,
	updated_at timestamptz DEFAULT now() NULL,
	CONSTRAINT ticket_comments_pkey PRIMARY KEY (id),
	CONSTRAINT ticket_comments_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE CASCADE,
	CONSTRAINT ticket_comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
);
CREATE INDEX idx_ticket_comments_ticket_id ON public.ticket_comments USING btree (ticket_id);
CREATE INDEX idx_ticket_comments_user_id ON public.ticket_comments USING btree (user_id);

-- Table Triggers

create trigger update_ticket_comments_updated_at before
update
    on
    public.ticket_comments for each row execute function update_updated_at_column();
create trigger ticket_comments_notify_insert after
insert
    on
    public.ticket_comments for each row execute function notify_ticket_comment_change();
create trigger ticket_comments_notify_update after
update
    on
    public.ticket_comments for each row execute function notify_ticket_comment_change();
create trigger ticket_comments_notify_delete after
delete
    on
    public.ticket_comments for each row execute function notify_ticket_comment_change();



-- DROP FUNCTION public.aggregate_monthly_activity(date);

CREATE OR REPLACE FUNCTION public.aggregate_monthly_activity(target_date date DEFAULT NULL::date)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
    month_start DATE;
    month_end DATE;
    user_record RECORD;
    monthly_record RECORD;
    total_active INTEGER;
    total_inactive INTEGER;
    days_active INTEGER;
BEGIN
    -- Get month dates
    month_start := get_month_start_date(target_date);
    month_end := get_month_end_date(target_date);
    
    -- Loop through all users
    FOR user_record IN 
        SELECT DISTINCT user_id FROM activity_data 
        WHERE today_date BETWEEN month_start AND month_end
    LOOP
        -- Calculate totals for this user in this month
        SELECT 
            COALESCE(SUM(today_active_seconds), 0) as total_active,
            COALESCE(SUM(today_inactive_seconds), 0) as total_inactive,
            COUNT(*) as days_active
        INTO total_active, total_inactive, days_active
        FROM activity_data 
        WHERE user_id = user_record.user_id 
        AND today_date BETWEEN month_start AND month_end;
        
        -- Check if monthly record exists
        SELECT * INTO monthly_record 
        FROM monthly_activity_summary 
        WHERE user_id = user_record.user_id AND month_start_date = month_start;
        
        IF FOUND THEN
            -- Update existing monthly record
            UPDATE monthly_activity_summary 
            SET 
                total_active_seconds = total_active,
                total_inactive_seconds = total_inactive,
                total_days_active = days_active,
                updated_at = NOW()
            WHERE user_id = user_record.user_id AND month_start_date = month_start;
        ELSE
            -- Create new monthly record
            INSERT INTO monthly_activity_summary (
                user_id, month_start_date, month_end_date,
                total_active_seconds, total_inactive_seconds, total_days_active
            ) VALUES (
                user_record.user_id, month_start, month_end,
                total_active, total_inactive, days_active
            );
        END IF;
    END LOOP;
END;
$function$
;

-- DROP FUNCTION public.aggregate_weekly_activity(date);

CREATE OR REPLACE FUNCTION public.aggregate_weekly_activity(target_date date DEFAULT NULL::date)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
    week_start DATE;
    week_end DATE;
    user_record RECORD;
    weekly_record RECORD;
    total_active INTEGER;
    total_inactive INTEGER;
    days_active INTEGER;
BEGIN
    -- Get week dates
    week_start := get_week_start_date(target_date);
    week_end := get_week_end_date(target_date);
    
    -- Loop through all users
    FOR user_record IN 
        SELECT DISTINCT user_id FROM activity_data 
        WHERE today_date BETWEEN week_start AND week_end
    LOOP
        -- Calculate totals for this user in this week
        SELECT 
            COALESCE(SUM(today_active_seconds), 0) as total_active,
            COALESCE(SUM(today_inactive_seconds), 0) as total_inactive,
            COUNT(*) as days_active
        INTO total_active, total_inactive, days_active
        FROM activity_data 
        WHERE user_id = user_record.user_id 
        AND today_date BETWEEN week_start AND week_end;
        
        -- Check if weekly record exists
        SELECT * INTO weekly_record 
        FROM weekly_activity_summary 
        WHERE user_id = user_record.user_id AND week_start_date = week_start;
        
        IF FOUND THEN
            -- Update existing weekly record
            UPDATE weekly_activity_summary 
            SET 
                total_active_seconds = total_active,
                total_inactive_seconds = total_inactive,
                total_days_active = days_active,
                updated_at = NOW()
            WHERE user_id = user_record.user_id AND week_start_date = week_start;
        ELSE
            -- Create new weekly record
            INSERT INTO weekly_activity_summary (
                user_id, week_start_date, week_end_date,
                total_active_seconds, total_inactive_seconds, total_days_active
            ) VALUES (
                user_record.user_id, week_start, week_end,
                total_active, total_inactive, days_active
            );
        END IF;
    END LOOP;
END;
$function$
;

-- DROP FUNCTION public.armor(bytea);

CREATE OR REPLACE FUNCTION public.armor(bytea)
 RETURNS text
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pg_armor$function$
;

-- DROP FUNCTION public.armor(bytea, _text, _text);

CREATE OR REPLACE FUNCTION public.armor(bytea, text[], text[])
 RETURNS text
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pg_armor$function$
;

-- DROP FUNCTION public.auto_aggregate_all_on_activity_change();

CREATE OR REPLACE FUNCTION public.auto_aggregate_all_on_activity_change()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
    week_start DATE;
    month_start DATE;
BEGIN
    -- Only process if the change affects recent data
    IF NEW.today_date >= (NOW() AT TIME ZONE 'Asia/Manila')::date - INTERVAL '60 days' THEN
        -- Get the week and month start dates for the changed record
        SELECT get_week_start_date(NEW.today_date) INTO week_start;
        SELECT get_month_start_date(NEW.today_date) INTO month_start;
        
        -- Aggregate both weekly and monthly data
        PERFORM aggregate_weekly_activity(week_start);
        PERFORM aggregate_monthly_activity(month_start);
        
        -- Log the auto-aggregation (optional, for debugging)
        RAISE LOG 'Auto-aggregated weekly and monthly activity for date % (user_id: %, week: %, month: %)', 
                  NEW.today_date, NEW.user_id, week_start, month_start;
    END IF;
    
    RETURN NEW;
END;
$function$
;

-- DROP FUNCTION public.auto_aggregate_monthly_on_activity_change();

CREATE OR REPLACE FUNCTION public.auto_aggregate_monthly_on_activity_change()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
    month_start DATE;
    affected_month_start DATE;
BEGIN
    -- Get the month start date for the changed record
    SELECT get_month_start_date(NEW.today_date) INTO affected_month_start;
    
    -- Only aggregate if the change affects data in the current month or recent months
    -- This prevents unnecessary aggregation for old data
    IF NEW.today_date >= (NOW() AT TIME ZONE 'Asia/Manila')::date - INTERVAL '60 days' THEN
        -- Aggregate the specific month that was affected
        PERFORM aggregate_monthly_activity(affected_month_start);
        
        -- Log the auto-aggregation (optional, for debugging)
        RAISE LOG 'Auto-aggregated monthly activity for month starting % (user_id: %)', 
                  affected_month_start, NEW.user_id;
    END IF;
    
    RETURN NEW;
END;
$function$
;

-- DROP FUNCTION public.auto_aggregate_weekly_on_activity_change();

CREATE OR REPLACE FUNCTION public.auto_aggregate_weekly_on_activity_change()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
    week_start DATE;
    week_end DATE;
    affected_week_start DATE;
BEGIN
    -- Get the week start date for the changed record
    SELECT get_week_start_date(NEW.today_date) INTO affected_week_start;
    
    -- Only aggregate if the change affects data in the current week or recent weeks
    -- This prevents unnecessary aggregation for old data
    IF NEW.today_date >= (NOW() AT TIME ZONE 'Asia/Manila')::date - INTERVAL '14 days' THEN
        -- Aggregate the specific week that was affected
        PERFORM aggregate_weekly_activity(affected_week_start);
        
        -- Log the auto-aggregation (optional, for debugging)
        RAISE LOG 'Auto-aggregated weekly activity for week starting % (user_id: %)', 
                  affected_week_start, NEW.user_id;
    END IF;
    
    RETURN NEW;
END;
$function$
;

-- DROP FUNCTION public.auto_assign_task_creator();

CREATE OR REPLACE FUNCTION public.auto_assign_task_creator()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    -- Insert the task creator as an assignee if they're not already assigned
    INSERT INTO task_assignees (task_id, user_id)
    VALUES (NEW.id, NEW.user_id)
    ON CONFLICT (task_id, user_id) DO NOTHING;
    
    RETURN NEW;
END;
$function$
;

-- DROP FUNCTION public.calculate_break_duration();

CREATE OR REPLACE FUNCTION public.calculate_break_duration()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    -- If end_time is being set and start_time exists, calculate duration
    IF NEW.end_time IS NOT NULL AND NEW.start_time IS NOT NULL THEN
        -- If break was paused, calculate based on pause state
        IF NEW.pause_time IS NOT NULL THEN
            -- If break was resumed, use normal pause calculation
            IF NEW.resume_time IS NOT NULL THEN
                -- Total duration = (pause_time - start_time) + (end_time - resume_time)
                NEW.duration_minutes = EXTRACT(EPOCH FROM (
                    (NEW.pause_time - NEW.start_time) + 
                    (NEW.end_time - NEW.resume_time)
                )) / 60;
            ELSE
                -- Break was paused but never resumed (auto-ended)
                -- Use the time from start to pause as the actual break duration
                NEW.duration_minutes = EXTRACT(EPOCH FROM (NEW.pause_time - NEW.start_time)) / 60;
            END IF;
        ELSE
            -- Normal calculation for non-paused breaks
            NEW.duration_minutes = EXTRACT(EPOCH FROM (NEW.end_time - NEW.start_time)) / 60;
        END IF;
    END IF;
    RETURN NEW;
END;
$function$
;

-- DROP FUNCTION public.calculate_break_windows(int4);

CREATE OR REPLACE FUNCTION public.calculate_break_windows(p_user_id integer)
 RETURNS TABLE(break_type break_type_enum, start_time time without time zone, end_time time without time zone)
 LANGUAGE plpgsql
AS $function$
      DECLARE
          shift_info RECORD;
          shift_start_time TIME;
          shift_end_time TIME;
          is_night_shift BOOLEAN;
      BEGIN
          -- Get agent's actual shift information
          SELECT * INTO shift_info FROM get_agent_shift_info(p_user_id) LIMIT 1;
          
          IF NOT FOUND OR shift_info.shift_time IS NULL THEN
              RETURN; -- No shift configured
          END IF;
          
          -- Parse shift time (e.g., "7:00 AM - 4:00 PM" or "10:00 PM - 7:00 AM")
          shift_start_time := CASE 
              WHEN split_part(shift_info.shift_time, ' - ', 1) LIKE '%PM' AND 
                   NOT split_part(shift_info.shift_time, ' - ', 1) LIKE '12:%PM' THEN
                  (split_part(split_part(shift_info.shift_time, ' - ', 1), ' ', 1)::TIME + INTERVAL '12 hours')::TIME
              WHEN split_part(shift_info.shift_time, ' - ', 1) LIKE '12:%AM' THEN
                  replace(split_part(shift_info.shift_time, ' - ', 1), '12:', '00:')::TIME
              ELSE
                  split_part(split_part(shift_info.shift_time, ' - ', 1), ' ', 1)::TIME
          END;
          
          shift_end_time := CASE 
              WHEN split_part(shift_info.shift_time, ' - ', 2) LIKE '%PM' AND 
                   NOT split_part(shift_info.shift_time, ' - ', 2) LIKE '12:%PM' THEN
                  (split_part(split_part(shift_info.shift_time, ' - ', 2), ' ', 1)::TIME + INTERVAL '12 hours')::TIME
              WHEN split_part(shift_info.shift_time, ' - ', 2) LIKE '12:%PM' THEN
                  (split_part(split_part(shift_info.shift_time, ' - ', 2), ' ', 1)::TIME + INTERVAL '12 hours')::TIME
              ELSE
                  split_part(split_part(shift_info.shift_time, ' - ', 2), ' ', 1)::TIME
          END;
          
          -- Determine if it's a night shift (crosses midnight)
          is_night_shift := shift_start_time > shift_end_time;
          
          -- Return break windows based on shift start time
          -- Morning/First Night break: 2 hours after shift start
          RETURN QUERY SELECT 
              CASE 
                  WHEN shift_info.shift_period = 'Day Shift' THEN 'Morning'::break_type_enum
                  ELSE 'NightFirst'::break_type_enum
              END,
              shift_start_time + INTERVAL '2 hours',
              shift_start_time + INTERVAL '3 hours';
          
          -- Lunch/Night Meal break: 4 hours after shift start
          RETURN QUERY SELECT 
              CASE 
                  WHEN shift_info.shift_period = 'Day Shift' THEN 'Lunch'::break_type_enum
                  ELSE 'NightMeal'::break_type_enum
              END,
              shift_start_time + INTERVAL '4 hours',
              shift_start_time + INTERVAL '7 hours';
          
          -- Afternoon/Second Night break: 7 hours 45 minutes after shift start
          RETURN QUERY SELECT 
              CASE 
                  WHEN shift_info.shift_period = 'Day Shift' THEN 'Afternoon'::break_type_enum
                  ELSE 'NightSecond'::break_type_enum
              END,
              shift_start_time + INTERVAL '7 hours 45 minutes',
              shift_start_time + INTERVAL '8 hours 45 minutes';
      END;
      $function$
;

-- DROP FUNCTION public.calculate_monthly_productivity_score(int4, varchar);

CREATE OR REPLACE FUNCTION public.calculate_monthly_productivity_score(target_user_id integer, target_month_year character varying DEFAULT NULL::character varying)
 RETURNS numeric
 LANGUAGE plpgsql
AS $function$
DECLARE
    month_start DATE;
    month_end DATE;
    total_active INTEGER;
    total_inactive INTEGER;
    total_seconds INTEGER;
    active_percentage DECIMAL(5,2);
    productivity_score DECIMAL(5,2);
    month_year_str VARCHAR(7);
BEGIN
    -- Get month_year string
    IF target_month_year IS NULL THEN
        month_year_str := get_month_year();
    ELSE
        month_year_str := target_month_year;
    END IF;
    
    -- Convert month_year to start/end dates
    month_start := TO_DATE(month_year_str || '-01', 'YYYY-MM-DD');
    month_end := (month_start + INTERVAL '1 month' - INTERVAL '1 day')::date;
    
    -- Get total active and inactive seconds for the month
    SELECT 
        COALESCE(SUM(today_active_seconds), 0) as total_active,
        COALESCE(SUM(today_inactive_seconds), 0) as total_inactive
    INTO total_active, total_inactive
    FROM activity_data 
    WHERE user_id = target_user_id 
    AND today_date BETWEEN month_start AND month_end;
    
    -- Calculate productivity score
    productivity_score := calculate_productivity_score(total_active, total_inactive);
    
    -- Calculate percentages
    total_seconds := total_active + total_inactive;
    IF total_seconds > 0 THEN
        active_percentage := (total_active::DECIMAL / total_seconds::DECIMAL) * 100;
    ELSE
        active_percentage := 0.00;
    END IF;
    
    -- Insert or update productivity score
    INSERT INTO productivity_scores (
        user_id, month_year, productivity_score,
        total_active_seconds, total_inactive_seconds, total_seconds, active_percentage
    ) VALUES (
        target_user_id, month_year_str, productivity_score,
        total_active, total_inactive, total_seconds, active_percentage
    )
    ON CONFLICT (user_id, month_year) 
    DO UPDATE SET
        productivity_score = EXCLUDED.productivity_score,
        total_active_seconds = EXCLUDED.total_active_seconds,
        total_inactive_seconds = EXCLUDED.total_inactive_seconds,
        total_seconds = EXCLUDED.total_seconds,
        active_percentage = EXCLUDED.active_percentage,
        updated_at = NOW();
    
    RETURN productivity_score;
END;
$function$
;

-- DROP FUNCTION public.calculate_productivity_score(int4, int4);

CREATE OR REPLACE FUNCTION public.calculate_productivity_score(active_seconds integer, inactive_seconds integer)
 RETURNS numeric
 LANGUAGE plpgsql
AS $function$
      DECLARE
          active_points DECIMAL(5,2);
          inactive_points DECIMAL(5,2);
          productivity_score DECIMAL(5,2);
      BEGIN
          -- Calculate points based on hours
          -- +1 point for every 3600 seconds (1 hour) of active time
          active_points := (active_seconds::DECIMAL / 3600.0);
          
          -- -1 point for every 3600 seconds (1 hour) of inactive time
          inactive_points := (inactive_seconds::DECIMAL / 3600.0);
          
          -- Final score = active points - inactive points
          productivity_score := active_points - inactive_points;
          
          -- Ensure score is not negative (minimum 0)
          IF productivity_score < 0 THEN
              productivity_score := 0.00;
          END IF;
          
          RETURN ROUND(productivity_score, 2);
      END;
      $function$
;

-- DROP FUNCTION public.can_agent_take_break(int4, break_type_enum);

CREATE OR REPLACE FUNCTION public.can_agent_take_break(p_agent_user_id integer, p_break_type break_type_enum)
 RETURNS boolean
 LANGUAGE plpgsql
AS $function$
			DECLARE
				break_count INTEGER;
			BEGIN
				-- Check if agent has already used this break type today
				SELECT COUNT(*)
				INTO break_count
				FROM public.break_sessions
				WHERE agent_user_id = p_agent_user_id
				AND break_type = p_break_type
				AND break_date = (NOW() AT TIME ZONE 'Asia/Manila')::date
				AND end_time IS NOT NULL; -- Only count completed breaks
				
				-- Each break type can only be used once per day
				RETURN break_count = 0;
			END;
			$function$
;

-- DROP FUNCTION public.cancel_meeting(int4);

CREATE OR REPLACE FUNCTION public.cancel_meeting(p_meeting_id integer)
 RETURNS boolean
 LANGUAGE plpgsql
AS $function$
DECLARE
    meeting_record meetings%ROWTYPE;
BEGIN
    -- Get the meeting
    SELECT * INTO meeting_record
    FROM meetings
    WHERE id = p_meeting_id;
    
    -- Check if meeting exists and is scheduled
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    IF meeting_record.status != 'scheduled' THEN
        RETURN FALSE;
    END IF;
    
    -- Update meeting status to cancelled and set is_in_meeting to false
    UPDATE meetings
    SET status = 'cancelled',
        is_in_meeting = FALSE,
        updated_at = now()
    WHERE id = p_meeting_id;
    
    RETURN TRUE;
END;
$function$
;

-- DROP FUNCTION public.check_aggregation_status(int4);

CREATE OR REPLACE FUNCTION public.check_aggregation_status(p_user_id integer DEFAULT NULL::integer)
 RETURNS TABLE(user_id integer, today_date date, week_start_date date, month_start_date date, weekly_aggregated boolean, monthly_aggregated boolean, last_weekly_update timestamp with time zone, last_monthly_update timestamp with time zone)
 LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    SELECT 
        ad.user_id,
        ad.today_date,
        get_week_start_date(ad.today_date) as week_start_date,
        get_month_start_date(ad.today_date) as month_start_date,
        CASE WHEN was.week_start_date IS NOT NULL THEN true ELSE false END as weekly_aggregated,
        CASE WHEN mas.month_start_date IS NOT NULL THEN true ELSE false END as monthly_aggregated,
        was.updated_at as last_weekly_update,
        mas.updated_at as last_monthly_update
    FROM activity_data ad
    LEFT JOIN weekly_activity_summary was ON 
        was.user_id = ad.user_id AND 
        was.week_start_date = get_week_start_date(ad.today_date)
    LEFT JOIN monthly_activity_summary mas ON 
        mas.user_id = ad.user_id AND 
        mas.month_start_date = get_month_start_date(ad.today_date)
    WHERE (p_user_id IS NULL OR ad.user_id = p_user_id)
    AND ad.today_date >= (NOW() AT TIME ZONE 'Asia/Manila')::date - INTERVAL '30 days'
    ORDER BY ad.today_date DESC, ad.user_id;
END;
$function$
;

-- DROP FUNCTION public.check_all_task_notifications();

CREATE OR REPLACE FUNCTION public.check_all_task_notifications()
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
DECLARE
    total_notifications INTEGER := 0;
BEGIN
    -- First, move overdue tasks to Overdue column
    PERFORM move_overdue_tasks_to_overdue_column();
    
    -- Check for overdue notifications (prevents spamming)
    total_notifications := total_notifications + check_overdue_task_notifications();
    
    -- Check for due soon notifications
    total_notifications := total_notifications + check_task_due_notifications();
    
    RETURN total_notifications;
END;
$function$
;

-- DROP FUNCTION public.check_and_reset_activity_for_shift_starts(timestamp);

CREATE OR REPLACE FUNCTION public.check_and_reset_activity_for_shift_starts(p_check_time timestamp without time zone DEFAULT (now() AT TIME ZONE 'Asia/Manila'::text))
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
DECLARE
    rec RECORD;
    reset_count INTEGER := 0;
    current_date DATE := p_check_time::date;
    current_time_minutes INTEGER := EXTRACT(HOUR FROM p_check_time) * 60 + EXTRACT(MINUTE FROM p_check_time);
    shift_start_minutes INTEGER;
    shift_end_minutes INTEGER;
    shift_text TEXT;
    is_night_shift BOOLEAN;
    shift_start_time TIMESTAMP WITHOUT TIME ZONE;
    time_diff_seconds INTEGER;
    activity_row RECORD;
    agent_name TEXT;
BEGIN
    -- Loop through all agents with their shift information
    FOR rec IN (
        SELECT 
            u.id AS user_id,
            u.email,
            COALESCE(pi.first_name || ' ' || pi.last_name, u.email) AS agent_name,
            ji.shift_time,
            ji.employee_id
        FROM users u
        JOIN agents a ON a.user_id = u.id
        LEFT JOIN job_info ji ON ji.agent_user_id = u.id
        LEFT JOIN personal_info pi ON pi.user_id = u.id
        WHERE u.user_type = 'Agent'
    ) LOOP
        -- Skip if no shift time configured
        IF rec.shift_time IS NULL OR rec.shift_time = '' THEN
            CONTINUE;
        END IF;

        shift_text := rec.shift_time;
        agent_name := rec.agent_name;
        
        -- Parse shift time format like "6:00 AM - 3:00 PM"
        IF shift_text ~* '(\d{1,2}:\d{2}\s*(AM|PM)).*-(.*\d{1,2}:\d{2}\s*(AM|PM))' THEN
            -- Extract start time (first time in the range)
            shift_start_minutes := (
                CASE UPPER(split_part(split_part(shift_text, '-', 1), ' ', 2))
                    WHEN 'AM' THEN (CASE WHEN split_part(split_part(shift_text, '-', 1), ':', 1)::INT % 12 = 0 THEN 0 ELSE split_part(split_part(shift_text, '-', 1), ':', 1)::INT END) * 60 + split_part(split_part(split_part(shift_text, '-', 1), ' ', 1), ':', 2)::INT
                    WHEN 'PM' THEN (CASE WHEN split_part(split_part(shift_text, '-', 1), ':', 1)::INT = 12 THEN 12 ELSE split_part(split_part(shift_text, '-', 1), ':', 1)::INT + 12 END) * 60 + split_part(split_part(split_part(shift_text, '-', 1), ' ', 1), ':', 2)::INT
                END
            );
            
            -- Extract end time (second time in the range)
            shift_end_minutes := (
                CASE UPPER(split_part(split_part(shift_text, '-', 2), ' ', 2))
                    WHEN 'AM' THEN (CASE WHEN split_part(split_part(shift_text, '-', 2), ':', 1)::INT % 12 = 0 THEN 0 ELSE split_part(split_part(shift_text, '-', 2), ':', 1)::INT END) * 60 + split_part(split_part(split_part(shift_text, '-', 2), ' ', 1), ':', 2)::INT
                    WHEN 'PM' THEN (CASE WHEN split_part(split_part(shift_text, '-', 2), ':', 1)::INT = 12 THEN 12 ELSE split_part(split_part(shift_text, '-', 2), ':', 1)::INT + 12 END) * 60 + split_part(split_part(split_part(shift_text, '-', 2), ' ', 1), ':', 2)::INT
                END
            );
        ELSE
            -- Skip if cannot parse shift time
            CONTINUE;
        END IF;

        -- Determine if this is a night shift (spans midnight)
        is_night_shift := shift_end_minutes < shift_start_minutes;
        
        -- Calculate the shift start time for today
        shift_start_time := current_date + (shift_start_minutes || ' minutes')::INTERVAL;
        
        -- For night shifts, if current time is before shift start, the shift started yesterday
        IF is_night_shift AND current_time_minutes < shift_start_minutes THEN
            shift_start_time := (current_date - INTERVAL '1 day') + (shift_start_minutes || ' minutes')::INTERVAL;
        END IF;
        
        -- Check if we're within 10 minutes of the shift start time (increased from 2 minutes for better coverage)
        time_diff_seconds := ABS(EXTRACT(EPOCH FROM (p_check_time - shift_start_time)));
        
        IF time_diff_seconds <= 600 THEN -- Within 10 minutes of shift start (increased from 2 minutes)
            -- Check if we have an activity row for today
            SELECT * INTO activity_row 
            FROM activity_data 
            WHERE user_id = rec.user_id 
            AND today_date = current_date::text;
            
            -- If no activity row exists for today, create one
            IF NOT FOUND THEN
                INSERT INTO activity_data (
                    user_id, 
                    is_currently_active, 
                    last_session_start, 
                    today_date, 
                    today_active_seconds, 
                    today_inactive_seconds, 
                    updated_at
                ) VALUES (
                    rec.user_id, 
                    FALSE, 
                    NULL, 
                    current_date::text, 
                    0, 
                    0, 
                    p_check_time
                );
                
                reset_count := reset_count + 1;
                
                RAISE NOTICE 'Created new activity row for user % (shift starting at %)', agent_name, shift_start_time;
            ELSE
                -- Reset existing activity row to 0 values
                UPDATE activity_data 
                SET 
                    today_active_seconds = 0,
                    today_inactive_seconds = 0,
                    is_currently_active = FALSE,
                    last_session_start = NULL,
                    updated_at = p_check_time
                WHERE user_id = rec.user_id 
                AND today_date = current_date::text;
                
                reset_count := reset_count + 1;
                
                RAISE NOTICE 'Reset activity data for user % (shift starting at %)', agent_name, shift_start_time;
            END IF;
        END IF;
    END LOOP;

    RETURN reset_count;
END;
$function$
;

-- DROP FUNCTION public.check_and_start_scheduled_meetings();

CREATE OR REPLACE FUNCTION public.check_and_start_scheduled_meetings()
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
DECLARE
    meetings_started INTEGER := 0;
    meetings_cancelled INTEGER := 0;
    meeting_record RECORD;
    start_result JSON;
    activity_check RECORD;
    health_check RECORD;
    restroom_check RECORD;
    grace_period_minutes INTEGER := 10; -- 10 minute grace period before auto-cancelling
BEGIN
    -- Find meetings that are scheduled and should start now (with 5 second buffer)
    FOR meeting_record IN
        SELECT id, title, agent_user_id, start_time
        FROM meetings
        WHERE status = 'scheduled'
        AND start_time <= NOW() + INTERVAL '5 seconds' -- Start 5 seconds before scheduled time for better responsiveness
        AND start_time > NOW() - INTERVAL '24 hours' -- Only process meetings within the last 24 hours to avoid processing very old meetings
    LOOP
        -- Check if user is currently in an activity/event BEFORE trying to start
        SELECT ea.is_going, e.title as event_title, e.event_type
        INTO activity_check
        FROM event_attendance ea
        JOIN events e ON ea.event_id = e.id
        WHERE ea.user_id = meeting_record.agent_user_id
        AND ea.is_going = true
        AND ea.is_back = false
        AND e.status NOT IN ('cancelled', 'ended');

        IF FOUND THEN
            -- User is currently in an activity/event, skip this meeting
            -- Don't log this as an error since it's expected behavior
            RAISE NOTICE 'Skipping meeting % (ID: %) - user is in %: %', 
                meeting_record.title, 
                meeting_record.id, 
                LOWER(activity_check.event_type), 
                activity_check.event_title;
            CONTINUE; -- Skip to next meeting
        END IF;

        -- Check if user is going to clinic or in clinic (and not done yet)
        SELECT hcr.going_to_clinic, hcr.in_clinic, hcr.status, hcr.done
        INTO health_check
        FROM health_check_requests hcr
        WHERE hcr.user_id = meeting_record.agent_user_id
        AND hcr.status IN ('pending', 'approved', 'completed')
        AND hcr.done = false
        AND (hcr.going_to_clinic = true OR hcr.in_clinic = true)
        ORDER BY hcr.request_time DESC
        LIMIT 1;

        IF FOUND THEN
            -- Check if the meeting start time has passed the grace period
            IF meeting_record.start_time <= NOW() - INTERVAL '1 minute' * grace_period_minutes THEN
                -- Auto-cancel the meeting since user is in clinic and grace period has passed
                UPDATE meetings 
                SET status = 'cancelled', 
                    end_time = NOW(),
                    updated_at = NOW()
                WHERE id = meeting_record.id;
                
                meetings_cancelled := meetings_cancelled + 1;
                RAISE NOTICE 'Auto-cancelled meeting % (ID: %) - user is % and grace period expired (health check status: %)', 
                    meeting_record.title, 
                    meeting_record.id, 
                    CASE 
                        WHEN health_check.going_to_clinic THEN 'going to clinic'
                        WHEN health_check.in_clinic THEN 'in clinic'
                        ELSE 'in health check'
                    END,
                    health_check.status;
            ELSE
                -- Still within grace period, skip for now
                RAISE NOTICE 'Skipping meeting % (ID: %) - user is % but still within grace period (health check status: %)', 
                    meeting_record.title, 
                    meeting_record.id, 
                    CASE 
                        WHEN health_check.going_to_clinic THEN 'going to clinic'
                        WHEN health_check.in_clinic THEN 'in clinic'
                        ELSE 'in health check'
                    END,
                    health_check.status;
            END IF;
            CONTINUE; -- Skip to next meeting
        END IF;

        -- Check if user is currently in restroom
        SELECT ars.is_in_restroom, ars.restroom_count, ars.daily_restroom_count
        INTO restroom_check
        FROM agent_restroom_status ars
        WHERE ars.agent_user_id = meeting_record.agent_user_id
        AND ars.is_in_restroom = true;

        IF FOUND THEN
            -- Check if the meeting start time has passed the grace period
            IF meeting_record.start_time <= NOW() - INTERVAL '1 minute' * grace_period_minutes THEN
                -- Auto-cancel the meeting since user is in restroom and grace period has passed
                UPDATE meetings 
                SET status = 'cancelled', 
                    end_time = NOW(),
                    updated_at = NOW()
                WHERE id = meeting_record.id;
                
                meetings_cancelled := meetings_cancelled + 1;
                RAISE NOTICE 'Auto-cancelled meeting % (ID: %) - user is in restroom and grace period expired (total visits: %, daily visits: %)', 
                    meeting_record.title, 
                    meeting_record.id, 
                    restroom_check.restroom_count,
                    restroom_check.daily_restroom_count;
            ELSE
                -- Still within grace period, skip for now
                RAISE NOTICE 'Skipping meeting % (ID: %) - user is in restroom but still within grace period (total visits: %, daily visits: %)', 
                    meeting_record.title, 
                    meeting_record.id, 
                    restroom_check.restroom_count,
                    restroom_check.daily_restroom_count;
            END IF;
            CONTINUE; -- Skip to next meeting
        END IF;

        -- Try to start the meeting using the existing start_meeting function with automatic flag
        BEGIN
            -- Call the start_meeting function with is_automatic = true
            SELECT start_meeting(meeting_record.id, meeting_record.agent_user_id, true) INTO start_result;
            
            -- Check if the meeting was successfully started
            IF (start_result->>'success')::boolean THEN
                meetings_started := meetings_started + 1;
                RAISE NOTICE 'Automatically started meeting: % (ID: %)', meeting_record.title, meeting_record.id;
            ELSE
                -- Log the reason for failure
                RAISE NOTICE 'Failed to start meeting % (ID: %): %', 
                    meeting_record.title, 
                    meeting_record.id, 
                    start_result->>'message';
            END IF;
            
        EXCEPTION
            WHEN OTHERS THEN
                -- Log any errors but continue processing other meetings
                RAISE NOTICE 'Failed to start meeting % (ID: %): %', meeting_record.title, meeting_record.id, SQLERRM;
        END;
    END LOOP;
    
    -- Log summary
    RAISE NOTICE 'Meeting processing complete: % meetings started, % meetings auto-cancelled', meetings_started, meetings_cancelled;
    
    RETURN meetings_started;
END;
$function$
;

-- DROP FUNCTION public.check_break_reminders();

CREATE OR REPLACE FUNCTION public.check_break_reminders()
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
            DECLARE
                agent_record RECORD;
                notifications_sent INTEGER := 0;
                check_time TIMESTAMP;
            BEGIN
                check_time := NOW() AT TIME ZONE 'Asia/Manila';

                -- NOTE: Task notifications are now handled by a separate scheduler
                -- This function only handles break-related notifications

                -- Loop through all active agents
                FOR agent_record IN
                    SELECT DISTINCT u.id as user_id
                    FROM users u
                    INNER JOIN agents a ON u.id = a.user_id
                    WHERE u.user_type = 'Agent'
                LOOP
                    -- Check for breaks available soon (15 minutes before)
                    IF is_break_available_soon(agent_record.user_id, 'Morning', check_time) THEN
                        PERFORM create_break_reminder_notification(agent_record.user_id, 'available_soon', 'Morning');
                        notifications_sent := notifications_sent + 1;
                    END IF;

                    IF is_break_available_soon(agent_record.user_id, 'Lunch', check_time) THEN
                        PERFORM create_break_reminder_notification(agent_record.user_id, 'available_soon', 'Lunch');
                        notifications_sent := notifications_sent + 1;
                    END IF;

                    IF is_break_available_soon(agent_record.user_id, 'Afternoon', check_time) THEN
                        PERFORM create_break_reminder_notification(agent_record.user_id, 'available_soon', 'Afternoon');
                        notifications_sent := notifications_sent + 1;
                    END IF;

                    -- Check for night shift breaks available soon
                    IF is_break_available_soon(agent_record.user_id, 'NightFirst', check_time) THEN
                        PERFORM create_break_reminder_notification(agent_record.user_id, 'available_soon', 'NightFirst');
                        notifications_sent := notifications_sent + 1;
                    END IF;

                    IF is_break_available_soon(agent_record.user_id, 'NightMeal', check_time) THEN
                        PERFORM create_break_reminder_notification(agent_record.user_id, 'available_soon', 'NightMeal');
                        notifications_sent := notifications_sent + 1;
                    END IF;

                    IF is_break_available_soon(agent_record.user_id, 'NightSecond', check_time) THEN
                        PERFORM create_break_reminder_notification(agent_record.user_id, 'available_soon', 'NightSecond');
                        notifications_sent := notifications_sent + 1;
                    END IF;

                    -- Check for breaks that are currently available/active (ONLY if notification not already sent)
                    IF is_break_available_now(agent_record.user_id, 'Morning', check_time)
                       AND NOT is_break_available_now_notification_sent(agent_record.user_id, 'Morning', check_time) THEN
                        PERFORM create_break_reminder_notification(agent_record.user_id, 'available_now', 'Morning');
                        notifications_sent := notifications_sent + 1;
                    END IF;

                    IF is_break_available_now(agent_record.user_id, 'Lunch', check_time)
                       AND NOT is_break_available_now_notification_sent(agent_record.user_id, 'Lunch', check_time) THEN
                        PERFORM create_break_reminder_notification(agent_record.user_id, 'available_now', 'Lunch');
                        notifications_sent := notifications_sent + 1;
                    END IF;

                    IF is_break_available_now(agent_record.user_id, 'Afternoon', check_time)
                       AND NOT is_break_available_now_notification_sent(agent_record.user_id, 'Afternoon', check_time) THEN
                        PERFORM create_break_reminder_notification(agent_record.user_id, 'available_now', 'Afternoon');
                        notifications_sent := notifications_sent + 1;
                    END IF;

                    -- Check for night shift breaks currently available (ONLY if notification not already sent)
                    IF is_break_available_now(agent_record.user_id, 'NightFirst', check_time)
                       AND NOT is_break_available_now_notification_sent(agent_record.user_id, 'NightFirst', check_time) THEN
                        PERFORM create_break_reminder_notification(agent_record.user_id, 'available_now', 'NightFirst');
                        notifications_sent := notifications_sent + 1;
                    END IF;

                    IF is_break_available_now(agent_record.user_id, 'NightMeal', check_time)
                       AND NOT is_break_available_now_notification_sent(agent_record.user_id, 'NightMeal', check_time) THEN
                        PERFORM create_break_reminder_notification(agent_record.user_id, 'available_now', 'NightMeal');
                        notifications_sent := notifications_sent + 1;
                    END IF;

                    IF is_break_available_now(agent_record.user_id, 'NightSecond', check_time)
                       AND NOT is_break_available_now_notification_sent(agent_record.user_id, 'NightSecond', check_time) THEN
                        PERFORM create_break_reminder_notification(agent_record.user_id, 'available_now', 'NightSecond');
                        notifications_sent := notifications_sent + 1;
                    END IF;

                    -- Check for missed breaks (30 minutes after break becomes available)
                    -- This will send "You have not taken your [Break] yet!" notifications
                    IF is_break_missed(agent_record.user_id, 'Morning', check_time) THEN
                        PERFORM create_break_reminder_notification(agent_record.user_id, 'missed_break', 'Morning');
                        notifications_sent := notifications_sent + 1;
                    END IF;

                    IF is_break_missed(agent_record.user_id, 'Lunch', check_time) THEN
                        PERFORM create_break_reminder_notification(agent_record.user_id, 'missed_break', 'Lunch');
                        notifications_sent := notifications_sent + 1;
                    END IF;

                    IF is_break_missed(agent_record.user_id, 'Afternoon', check_time) THEN
                        PERFORM create_break_reminder_notification(agent_record.user_id, 'missed_break', 'Afternoon');
                        notifications_sent := notifications_sent + 1;
                    END IF;

                    -- Check for night shift missed breaks
                    IF is_break_missed(agent_record.user_id, 'NightFirst', check_time) THEN
                        PERFORM create_break_reminder_notification(agent_record.user_id, 'missed_break', 'NightFirst');
                        notifications_sent := notifications_sent + 1;
                    END IF;

                    IF is_break_missed(agent_record.user_id, 'NightMeal', check_time) THEN
                        PERFORM create_break_reminder_notification(agent_record.user_id, 'missed_break', 'NightMeal');
                        notifications_sent := notifications_sent + 1;
                    END IF;

                    IF is_break_missed(agent_record.user_id, 'NightSecond', check_time) THEN
                        PERFORM create_break_reminder_notification(agent_record.user_id, 'missed_break', 'NightSecond');
                        notifications_sent := notifications_sent + 1;
                    END IF;

                    -- Check for break window ending soon (15 minutes before break window expires)
                    -- This prevents generic "Break ending soon" notifications
                    IF is_break_window_ending_soon(agent_record.user_id, 'Morning', check_time) THEN
                        PERFORM create_break_reminder_notification(agent_record.user_id, 'ending_soon', 'Morning');
                        notifications_sent := notifications_sent + 1;
                    END IF;

                    IF is_break_window_ending_soon(agent_record.user_id, 'Lunch', check_time) THEN
                        PERFORM create_break_reminder_notification(agent_record.user_id, 'ending_soon', 'Lunch');
                        notifications_sent := notifications_sent + 1;
                    END IF;

                    IF is_break_window_ending_soon(agent_record.user_id, 'Afternoon', check_time) THEN
                        PERFORM create_break_reminder_notification(agent_record.user_id, 'ending_soon', 'Afternoon');
                        notifications_sent := notifications_sent + 1;
                    END IF;

                    -- Check for night shift break windows ending soon
                    IF is_break_window_ending_soon(agent_record.user_id, 'NightFirst', check_time) THEN
                        PERFORM create_break_reminder_notification(agent_record.user_id, 'ending_soon', 'NightFirst');
                        notifications_sent := notifications_sent + 1;
                    END IF;

                    IF is_break_window_ending_soon(agent_record.user_id, 'NightMeal', check_time) THEN
                        PERFORM create_break_reminder_notification(agent_record.user_id, 'ending_soon', 'NightMeal');
                        notifications_sent := notifications_sent + 1;
                    END IF;

                    IF is_break_window_ending_soon(agent_record.user_id, 'NightSecond', check_time) THEN
                        PERFORM create_break_reminder_notification(agent_record.user_id, 'ending_soon', 'NightSecond');
                        notifications_sent := notifications_sent + 1;
                    END IF;
                END LOOP;

                RETURN notifications_sent;
            END;
            $function$
;

-- DROP FUNCTION public.check_meeting_notifications();

CREATE OR REPLACE FUNCTION public.check_meeting_notifications()
 RETURNS json
 LANGUAGE plpgsql
AS $function$
DECLARE
    reminders_sent INTEGER;
    starts_sent INTEGER;
    result JSON;
BEGIN
    -- Send reminder notifications (15 minutes before)
    SELECT send_meeting_reminder_notification() INTO reminders_sent;
    
    -- Send start notifications (when meeting starts)
    SELECT send_meeting_start_notification() INTO starts_sent;
    
    -- Return summary
    result := json_build_object(
        'reminders_sent', reminders_sent,
        'starts_sent', starts_sent,
        'total_sent', reminders_sent + starts_sent,
        'timestamp', NOW()
    );
    
    RETURN result;
END;
$function$
;

-- DROP FUNCTION public.check_meeting_reminders();

CREATE OR REPLACE FUNCTION public.check_meeting_reminders()
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
DECLARE
    reminders_sent INTEGER := 0;
    meeting_record RECORD;
BEGIN
    -- Find meetings that are scheduled and starting within the next hour
    FOR meeting_record IN
        SELECT id, title, agent_user_id, start_time
        FROM meetings
        WHERE status = 'scheduled'
        AND start_time BETWEEN NOW() + INTERVAL '59 minutes' AND NOW() + INTERVAL '61 minutes'
    LOOP
        -- Create a notification for the meeting reminder
        INSERT INTO notifications (
            user_id,
            title,
            message,
            category,
            type,
            created_at
        ) VALUES (
            meeting_record.agent_user_id,
            'Meeting Reminder',
            'Meeting "' || meeting_record.title || '" starts in 1 hour',
            'meeting',
            'reminder',
            NOW()
        );
        
        reminders_sent := reminders_sent + 1;
        
        -- Log the reminder
        RAISE NOTICE 'Sent reminder for meeting: % (ID: %)', meeting_record.title, meeting_record.id;
    END LOOP;
    
    RETURN reminders_sent;
END;
$function$
;

-- DROP FUNCTION public.check_overdue_task_notifications();

CREATE OR REPLACE FUNCTION public.check_overdue_task_notifications()
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
DECLARE
    task_record RECORD;
    notifications_sent INTEGER := 0;
    now_ts timestamptz := now() AT TIME ZONE 'Asia/Manila';
    hours_overdue numeric;
    overdue_group_id INTEGER;
BEGIN
    -- Loop through all active overdue tasks
    FOR task_record IN
        SELECT 
            t.id,
            t.title,
            t.due_date,
            t.user_id,
            t.group_id,
            t.status,
            -- Check if overdue notification already sent for this task in the last 6 hours
            CASE 
                WHEN EXISTS(
                    SELECT 1 FROM notifications n 
                    WHERE n.user_id = t.user_id 
                    AND n.category = 'task' 
                    AND n.title = 'Task overdue'
                    AND n.payload->>'task_id' = t.id::text
                    AND n.created_at > now() - INTERVAL '6 hours'
                ) THEN true
                ELSE false
            END as notification_sent_recently
        FROM tasks t
        WHERE t.due_date IS NOT NULL 
        AND t.status = 'active'
        AND t.due_date < now_ts
        AND t.group_id NOT IN (  -- Exclude tasks already in Done column
            SELECT id FROM task_groups WHERE title = 'Done'
        )
    LOOP
        -- Skip if notification was sent recently (within 6 hours)
        IF task_record.notification_sent_recently THEN
            CONTINUE;
        END IF;
        
        -- Get the Overdue column ID (global for all users)
        SELECT id INTO overdue_group_id
        FROM task_groups 
        WHERE title = 'Overdue';
        
        -- Only send notification if task is NOT in Overdue column
        -- This prevents spamming once tasks are moved to Overdue
        IF overdue_group_id IS NULL OR task_record.group_id != overdue_group_id THEN
            -- Calculate hours overdue
            hours_overdue := EXTRACT(EPOCH FROM (now_ts - task_record.due_date)) / 3600.0;
            
            -- Send notification for overdue tasks
            INSERT INTO notifications (user_id, category, type, title, message, payload, created_at)
            VALUES (
                task_record.user_id,
                'task',
                'error',
                'Task overdue',
                format('"%s" is overdue by %s hours (was due on %s)', 
                    task_record.title, 
                    round(hours_overdue, 1),
                    to_char(task_record.due_date AT TIME ZONE 'Asia/Manila', 'Mon DD, YYYY HH24:MI')
                ),
                jsonb_build_object(
                    'task_id', task_record.id, 
                    'group_id', task_record.group_id, 
                    'due_date', task_record.due_date, 
                    'action_url', '/productivity/task-activity',
                    'hours_overdue', round(hours_overdue, 1)
                ),
                now_ts
            );
            
            notifications_sent := notifications_sent + 1;
        END IF;
    END LOOP;
    
    RETURN notifications_sent;
END;
$function$
;

-- DROP FUNCTION public.check_productivity_calculation_status(int4, varchar);

CREATE OR REPLACE FUNCTION public.check_productivity_calculation_status(p_user_id integer DEFAULT NULL::integer, p_month_year character varying DEFAULT NULL::character varying)
 RETURNS TABLE(user_id integer, month_year character varying, productivity_score numeric, total_active_seconds integer, total_inactive_seconds integer, last_updated timestamp with time zone, needs_recalculation boolean)
 LANGUAGE plpgsql
AS $function$
DECLARE
    target_month_year VARCHAR(7);
BEGIN
    -- Get target month_year
    IF p_month_year IS NULL THEN
        SELECT get_month_year() INTO target_month_year;
    ELSE
        target_month_year := p_month_year;
    END IF;
    
    -- Return productivity score status
    RETURN QUERY
    SELECT 
        ps.user_id,
        ps.month_year,
        ps.productivity_score,
        ps.total_active_seconds,
        ps.total_inactive_seconds,
        ps.updated_at as last_updated,
        -- Check if score needs recalculation (if it's more than 1 hour old)
        (ps.updated_at < NOW() - INTERVAL '1 hour') as needs_recalculation
    FROM productivity_scores ps
    WHERE ps.month_year = target_month_year
    AND (p_user_id IS NULL OR ps.user_id = p_user_id)
    ORDER BY ps.user_id;
END;
$function$
;

-- DROP FUNCTION public.check_task_due_notifications();

CREATE OR REPLACE FUNCTION public.check_task_due_notifications()
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
DECLARE
    task_record RECORD;
    notifications_sent INTEGER := 0;
    now_ts timestamptz := now() AT TIME ZONE 'Asia/Manila';
    hours_diff numeric;
    overdue_group_id INTEGER;
BEGIN
    -- Loop through all active tasks that have due dates (not yet overdue)
    FOR task_record IN
        SELECT 
            t.id,
            t.title,
            t.due_date,
            t.user_id,
            t.group_id,
            t.status,
            -- Check if notification already sent for this task in the last 12 hours
            CASE 
                WHEN EXISTS(
                    SELECT 1 FROM notifications n 
                    WHERE n.user_id = t.user_id 
                    AND n.category = 'task' 
                    AND n.title = 'Task due soon'
                    AND n.payload->>'task_id' = t.id::text
                    AND n.created_at > now() - INTERVAL '12 hours'
                ) THEN true
                ELSE false
            END as notification_sent_recently
        FROM tasks t
        WHERE t.due_date IS NOT NULL 
        AND t.status = 'active'
        AND t.due_date > now_ts
        AND t.due_date <= now_ts + INTERVAL '24 hours'
        AND t.group_id NOT IN (  -- Exclude tasks already in Done column
            SELECT id FROM task_groups WHERE title = 'Done'
        )
    LOOP
        -- Skip if notification was sent recently (within 12 hours)
        IF task_record.notification_sent_recently THEN
            CONTINUE;
        END IF;
        
        -- Get the Overdue column ID (global for all users)
        SELECT id INTO overdue_group_id
        FROM task_groups 
        WHERE title = 'Overdue';
        
        -- Only send notification if task is NOT in Overdue column
        IF overdue_group_id IS NULL OR task_record.group_id != overdue_group_id THEN
            -- Calculate hours until due
            hours_diff := EXTRACT(EPOCH FROM (task_record.due_date - now_ts)) / 3600.0;
            
            -- Send notification if due within next 24 hours
            IF hours_diff <= 24 AND hours_diff >= 0 THEN
                INSERT INTO notifications (user_id, category, type, title, message, payload, created_at)
                VALUES (
                    task_record.user_id,
                    'task',
                    'warning',
                    'Task due soon',
                    format('"%s" is due on %s', task_record.title, to_char(task_record.due_date AT TIME ZONE 'Asia/Manila', 'YYYY-MM-DD HH24:MI')),
                    jsonb_build_object(
                        'task_id', task_record.id, 
                        'group_id', task_record.group_id, 
                        'due_date', task_record.due_date, 
                        'action_url', '/productivity/task-activity',
                        'hours_until_due', round(hours_diff, 1)
                    ),
                    now_ts
                );
                
                notifications_sent := notifications_sent + 1;
            END IF;
        END IF;
    END LOOP;
    
    RETURN notifications_sent;
END;
$function$
;

-- DROP FUNCTION public.comprehensive_activity_reset(timestamp);

CREATE OR REPLACE FUNCTION public.comprehensive_activity_reset(p_check_time timestamp without time zone DEFAULT (now() AT TIME ZONE 'Asia/Manila'::text))
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
DECLARE
    rec RECORD;
    reset_count INTEGER := 0;
    current_date DATE := p_check_time::date;
    current_time_minutes INTEGER := EXTRACT(HOUR FROM p_check_time) * 60 + EXTRACT(MINUTE FROM p_check_time);
    shift_start_minutes INTEGER;
    shift_end_minutes INTEGER;
    shift_text TEXT;
    is_night_shift BOOLEAN;
    shift_start_time TIMESTAMP WITHOUT TIME ZONE;
    time_diff_seconds INTEGER;
    activity_row RECORD;
    agent_name TEXT;
    should_reset BOOLEAN;
BEGIN
    -- Loop through all agents with their shift information
    FOR rec IN (
        SELECT 
            u.id AS user_id,
            u.email,
            COALESCE(pi.first_name || ' ' || pi.last_name, u.email) AS agent_name,
            ji.shift_time,
            ji.employee_id
        FROM users u
        JOIN agents a ON a.user_id = u.id
        LEFT JOIN job_info ji ON ji.agent_user_id = u.id
        LEFT JOIN personal_info pi ON pi.user_id = u.id
        WHERE u.user_type = 'Agent'
    ) LOOP
        -- Skip if no shift time configured
        IF rec.shift_time IS NULL OR rec.shift_time = '' THEN
            CONTINUE;
        END IF;

        shift_text := rec.shift_time;
        agent_name := rec.agent_name;
        should_reset := FALSE;
        
        -- Parse shift time format like "6:00 AM - 3:00 PM"
        IF shift_text ~* '(\d{1,2}:\d{2}\s*(AM|PM)).*-(.*\d{1,2}:\d{2}\s*(AM|PM))' THEN
            -- Extract start time (first time in the range)
            shift_start_minutes := (
                CASE UPPER(split_part(split_part(shift_text, '-', 1), ' ', 2))
                    WHEN 'AM' THEN (CASE WHEN split_part(split_part(shift_text, '-', 1), ':', 1)::INT % 12 = 0 THEN 0 ELSE split_part(split_part(shift_text, '-', 1), ':', 1)::INT END) * 60 + split_part(split_part(split_part(shift_text, '-', 1), ' ', 1), ':', 2)::INT
                    WHEN 'PM' THEN (CASE WHEN split_part(split_part(shift_text, '-', 1), ':', 1)::INT = 12 THEN 12 ELSE split_part(split_part(shift_text, '-', 1), ':', 1)::INT + 12 END) * 60 + split_part(split_part(split_part(shift_text, '-', 1), ' ', 1), ':', 2)::INT
                END
            );
            
            -- Extract end time (second time in the range)
            shift_end_minutes := (
                CASE UPPER(split_part(split_part(shift_text, '-', 2), ' ', 2))
                    WHEN 'AM' THEN (CASE WHEN split_part(split_part(shift_text, '-', 2), ':', 1)::INT % 12 = 0 THEN 0 ELSE split_part(split_part(shift_text, '-', 2), ':', 1)::INT END) * 60 + split_part(split_part(split_part(shift_text, '-', 2), ' ', 1), ':', 2)::INT
                    WHEN 'PM' THEN (CASE WHEN split_part(split_part(shift_text, '-', 2), ':', 1)::INT = 12 THEN 12 ELSE split_part(split_part(shift_text, '-', 2), ':', 1)::INT + 12 END) * 60 + split_part(split_part(split_part(shift_text, '-', 2), ' ', 1), ':', 2)::INT
                END
            );
        ELSE
            -- Skip if cannot parse shift time
            CONTINUE;
        END IF;

        -- Determine if this is a night shift (spans midnight)
        is_night_shift := shift_end_minutes < shift_start_minutes;
        
        -- Calculate the shift start time for today
        shift_start_time := current_date + (shift_start_minutes || ' minutes')::INTERVAL;
        
        -- For night shifts, if current time is before shift start, the shift started yesterday
        IF is_night_shift AND current_time_minutes < shift_start_minutes THEN
            shift_start_time := (current_date - INTERVAL '1 day') + (shift_start_minutes || ' minutes')::INTERVAL;
        END IF;
        
        -- Check if we're within 10 minutes of the shift start time
        time_diff_seconds := ABS(EXTRACT(EPOCH FROM (p_check_time - shift_start_time)));
        
        -- SCENARIO 1: We're near shift start time (within 10 minutes)
        IF time_diff_seconds <= 600 THEN
            should_reset := TRUE;
            RAISE NOTICE 'Scenario 1: Near shift start time for user % (within 10 minutes)', agent_name;
        END IF;
        
        -- SCENARIO 2: We're past shift start time but activity data is from previous day
        -- This handles cases where the system missed the reset window
        IF time_diff_seconds > 600 AND time_diff_seconds <= 3600 THEN -- Between 10 minutes and 1 hour past shift start
            -- Check if we have an activity row for today
            SELECT * INTO activity_row 
            FROM activity_data 
            WHERE user_id = rec.user_id 
            AND today_date = current_date::text;
            
            IF FOUND THEN
                -- Check if the activity data has accumulated significant time (more than 1 hour)
                -- This indicates it wasn't properly reset at shift start
                IF activity_row.today_active_seconds > 3600 OR activity_row.today_inactive_seconds > 3600 THEN
                    should_reset := TRUE;
                    RAISE NOTICE 'Scenario 2: Past shift start with accumulated time for user % (active: %s, inactive: %s)', 
                        agent_name, activity_row.today_active_seconds, activity_row.today_inactive_seconds;
                END IF;
            END IF;
        END IF;
        
        -- Perform the reset if needed
        IF should_reset THEN
            -- Check if we have an activity row for today
            SELECT * INTO activity_row 
            FROM activity_data 
            WHERE user_id = rec.user_id 
            AND today_date = current_date::text;
            
            -- If no activity row exists for today, create one
            IF NOT FOUND THEN
                INSERT INTO activity_data (
                    user_id, 
                    is_currently_active, 
                    last_session_start, 
                    today_date, 
                    today_active_seconds, 
                    today_inactive_seconds, 
                    updated_at
                ) VALUES (
                    rec.user_id, 
                    FALSE, 
                    NULL, 
                    current_date::text, 
                    0, 
                    0, 
                    p_check_time
                );
                
                reset_count := reset_count + 1;
                
                RAISE NOTICE 'Created new activity row for user % (shift starting at %)', agent_name, shift_start_time;
            ELSE
                -- Reset existing activity row to 0 values
                UPDATE activity_data 
                SET 
                    today_active_seconds = 0,
                    today_inactive_seconds = 0,
                    is_currently_active = FALSE,
                    last_session_start = NULL,
                    updated_at = p_check_time
                WHERE user_id = rec.user_id 
                AND today_date = current_date::text;
                
                reset_count := reset_count + 1;
                
                RAISE NOTICE 'Reset activity data for user % (shift starting at %)', agent_name, shift_start_time;
            END IF;
        END IF;
    END LOOP;

    RETURN reset_count;
END;
$function$
;

-- DROP FUNCTION public.corrected_activity_reset(timestamp);

CREATE OR REPLACE FUNCTION public.corrected_activity_reset(p_check_time timestamp without time zone DEFAULT (now() AT TIME ZONE 'Asia/Manila'::text))
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
DECLARE
    rec RECORD;
    reset_count INTEGER := 0;
    manila_date DATE;
    current_time_minutes INTEGER;
    shift_start_minutes INTEGER;
    shift_end_minutes INTEGER;
    shift_text TEXT;
    is_night_shift BOOLEAN;
    shift_start_time TIMESTAMP WITHOUT TIME ZONE;
    time_diff_seconds INTEGER;
    activity_row RECORD;
    agent_name TEXT;
    should_reset BOOLEAN;
    current_manila_time TIMESTAMP WITHOUT TIME ZONE;
BEGIN
    -- Get the correct Manila time and date
    current_manila_time := p_check_time AT TIME ZONE 'Asia/Manila';
    manila_date := current_manila_time::date;
    current_time_minutes := EXTRACT(HOUR FROM current_manila_time) * 60 + EXTRACT(MINUTE FROM current_manila_time);
    
    -- Loop through all agents with their shift information
    FOR rec IN (
        SELECT 
            u.id AS user_id,
            u.email,
            COALESCE(pi.first_name || ' ' || pi.last_name, u.email) AS agent_name,
            ji.shift_time,
            ji.employee_id
        FROM users u
        JOIN agents a ON a.user_id = u.id
        LEFT JOIN job_info ji ON ji.agent_user_id = u.id
        LEFT JOIN personal_info pi ON pi.user_id = u.id
        WHERE u.user_type = 'Agent'
    ) LOOP
        -- Skip if no shift time configured
        IF rec.shift_time IS NULL OR rec.shift_time = '' THEN
            CONTINUE;
        END IF;

        shift_text := rec.shift_time;
        agent_name := rec.agent_name;
        should_reset := FALSE;
        
        -- Simple shift time parsing (basic version)
        IF shift_text ~* '(\d{1,2}):(\d{2})\s*(AM|PM).*-\s*(\d{1,2}):(\d{2})\s*(AM|PM)' THEN
            -- Extract start time components
            shift_start_minutes := 0; -- Simplified for now
            shift_end_minutes := 0;   -- Simplified for now
        ELSE
            -- Skip if cannot parse shift time
            CONTINUE;
        END IF;
        
        -- Determine if this is a night shift (spans midnight)
        is_night_shift := shift_end_minutes < shift_start_minutes;
        
        -- Calculate the shift start time for today (Manila time)
        shift_start_time := manila_date + (shift_start_minutes || ' minutes')::INTERVAL;
        
        -- For night shifts, if current time is before shift start, the shift started yesterday
        IF is_night_shift AND current_time_minutes < shift_start_minutes THEN
            shift_start_time := (manila_date - INTERVAL '1 day') + (shift_start_minutes || ' minutes')::INTERVAL;
        END IF;
        
        -- Check if we're within 5 minutes of the shift start time
        time_diff_seconds := ABS(EXTRACT(EPOCH FROM (current_manila_time - shift_start_time)));
        
        -- Check if we should reset
        IF time_diff_seconds <= 300 THEN
            should_reset := TRUE;
        END IF;
        
        -- Perform the reset if needed
        IF should_reset THEN
            -- Check if we have an activity row for today (current Manila date)
            SELECT * INTO activity_row 
            FROM activity_data 
            WHERE user_id = rec.user_id 
            AND today_date = manila_date;
            
            -- If no activity row exists for today, create one with 0 values
            IF NOT FOUND THEN
                INSERT INTO activity_data (
                    user_id, 
                    is_currently_active, 
                    last_session_start, 
                    today_date, 
                    today_active_seconds, 
                    today_inactive_seconds, 
                    updated_at
                ) VALUES (
                    rec.user_id, 
                    FALSE, 
                    NULL, 
                    manila_date,
                    0, 
                    0, 
                    current_manila_time
                );
                
                reset_count := reset_count + 1;
            ELSE
                -- Reset existing activity row to 0 values (ONLY for current date)
                UPDATE activity_data 
                SET 
                    today_active_seconds = 0,
                    today_inactive_seconds = 0,
                    is_currently_active = FALSE,
                    last_session_start = NULL,
                    updated_at = current_manila_time
                WHERE user_id = rec.user_id 
                AND today_date = manila_date;
                
                reset_count := reset_count + 1;
            END IF;
        END IF;
    END LOOP;

    RETURN reset_count;
END;
$function$
;

-- DROP FUNCTION public.create_break_reminder_notification(int4, text, break_type_enum);

CREATE OR REPLACE FUNCTION public.create_break_reminder_notification(p_agent_user_id integer, p_notification_type text, p_break_type break_type_enum DEFAULT NULL::break_type_enum)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
    notif_category TEXT := 'break';
    notif_type TEXT := 'info';
    title_text TEXT;
    message_text TEXT;
    payload_data JSONB;
    break_name TEXT;
    current_time_manila TIMESTAMP;
    last_notification_time TIMESTAMP;
    minutes_since_last_notification INTEGER;
    detected_break_type break_type_enum;
    duplicate_exists BOOLEAN;
BEGIN
    -- Get current Manila time for logic calculations
    current_time_manila := NOW() AT TIME ZONE 'Asia/Manila';

    -- For ending_soon, detect the current break type based on time and break windows
    IF p_notification_type = 'ending_soon' AND p_break_type IS NULL THEN
        -- Find which break window is ending soon by checking all break windows
        SELECT bw.break_type INTO detected_break_type
        FROM calculate_break_windows(p_agent_user_id) bw
        WHERE bw.end_time > (current_time_manila::TIME - INTERVAL '17 minutes')
        AND bw.end_time <= (current_time_manila::TIME + INTERVAL '2 minutes')
        ORDER BY bw.end_time ASC
        LIMIT 1;
        
        -- If we found a break window ending soon, use it
        IF detected_break_type IS NOT NULL THEN
            p_break_type := detected_break_type;
        END IF;
    END IF;

    -- Determine break name for display
    break_name := CASE p_break_type
        WHEN 'Morning' THEN 'Morning break'
        WHEN 'Lunch' THEN 'Lunch break'
        WHEN 'Afternoon' THEN 'Afternoon break'
        WHEN 'NightFirst' THEN 'First night break'
        WHEN 'NightMeal' THEN 'Night meal break'
        WHEN 'NightSecond' THEN 'Second night break'
        ELSE 'Break'
    END;

    -- Set notification content based on type
    IF p_notification_type = 'available_soon' THEN
        title_text := break_name || ' available soon';
        message_text := 'Your ' || break_name || ' will be available in 15 minutes';
        notif_type := 'info';
        payload_data := jsonb_build_object(
            'reminder_type', 'available_soon',
            'break_type', p_break_type,
            'action_url', '/status/breaks'
        );
    ELSIF p_notification_type = 'available_now' THEN
        title_text := break_name || ' is now available';
        message_text := 'Your ' || break_name || ' is now available! You can take it now.';
        notif_type := 'success';
        payload_data := jsonb_build_object(
            'reminder_type', 'available_now',
            'break_type', p_break_type,
            'action_url', '/status/breaks'
        );
    ELSIF p_notification_type = 'ending_soon' THEN
        title_text := break_name || ' ending soon';
        message_text := 'Your ' || break_name || ' will end soon';
        notif_type := 'warning';
        payload_data := jsonb_build_object(
            'reminder_type', 'ending_soon',
            'break_type', p_break_type,
            'action_url', '/status/breaks'
        );
    ELSIF p_notification_type = 'missed_break' THEN
        title_text := 'You have not taken your ' || break_name || ' yet!';
        message_text := 'Your ' || break_name || ' was available but you haven''t taken it yet. Please take your break soon.';
        notif_type := 'warning';
        payload_data := jsonb_build_object(
            'reminder_type', 'missed_break',
            'break_type', p_break_type,
            'action_url', '/status/breaks'
        );
    ELSE
        RETURN; -- Invalid notification type
    END IF;

    -- FIXED: Enhanced duplicate prevention logic with proper timezone handling
    -- For available_soon notifications, check if we already sent one today for this break type
    IF p_notification_type = 'available_soon' THEN
        -- Check if we already sent an "available_soon" notification today for this break type
        SELECT EXISTS(
            SELECT 1 FROM notifications
            WHERE user_id = p_agent_user_id
            AND category = notif_category
            AND payload->>'reminder_type' = 'available_soon'
            AND payload->>'break_type' = p_break_type::text
            AND DATE(created_at AT TIME ZONE 'Asia/Manila') = current_time_manila::DATE
        ) INTO duplicate_exists;
        
        IF duplicate_exists THEN
            RETURN; -- Already sent today, don't send again
        END IF;
    ELSE
        -- For other notification types, use the existing cooldown logic
        SELECT MAX(created_at) INTO last_notification_time
        FROM notifications
        WHERE user_id = p_agent_user_id
        AND category = notif_category
        AND title = title_text
        AND created_at > (NOW() - INTERVAL '60 minutes');

        -- If a recent notification exists, check if enough time has passed
        IF last_notification_time IS NOT NULL THEN
            -- Calculate minutes since last notification
            minutes_since_last_notification := EXTRACT(EPOCH FROM (NOW() - last_notification_time)) / 60;
            
            -- Different cooldown periods for different notification types
            IF p_notification_type = 'available_now' THEN
                -- Available now: Only send once per break window
                IF minutes_since_last_notification < 60 THEN
                    RETURN; -- Too soon, don't send
                END IF;
            ELSIF p_notification_type = 'ending_soon' THEN
                -- Ending soon: Only send once per 15-minute window
                IF minutes_since_last_notification < 15 THEN
                    RETURN; -- Too soon, don't send
                END IF;
            ELSIF p_notification_type = 'missed_break' THEN
                -- Missed break: Only send once per 30-minute reminder cycle
                IF minutes_since_last_notification < 30 THEN
                    RETURN; -- Too soon, don't send
                END IF;
            END IF;
        END IF;
    END IF;

    -- Insert the notification (database will use default UTC timestamp)
    INSERT INTO notifications (user_id, category, type, title, message, payload)
    VALUES (p_agent_user_id, notif_category, notif_type, title_text, message_text, payload_data);
END;
$function$
;

-- DROP FUNCTION public.create_break_status_notification();

CREATE OR REPLACE FUNCTION public.create_break_status_notification()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  title_text text;
  message_text text;
  notif_type text := 'info';
BEGIN
  IF TG_OP = 'INSERT' THEN
    title_text := 'Break started';
    message_text := format('%s break started', NEW.break_type);
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.end_time IS NOT NULL AND (OLD.end_time IS NULL OR NEW.end_time <> OLD.end_time) THEN
      title_text := 'Break ended';
      message_text := format('%s break completed (%s min)', NEW.break_type, COALESCE(NEW.duration_minutes, 0));
      notif_type := 'success';
    ELSIF NEW.pause_time IS NOT NULL AND (OLD.pause_time IS DISTINCT FROM NEW.pause_time) THEN
      title_text := 'Break paused';
      message_text := format('%s break paused', NEW.break_type);
      notif_type := 'warning';
    ELSIF NEW.resume_time IS NOT NULL AND (OLD.resume_time IS DISTINCT FROM NEW.resume_time) THEN
      title_text := 'Break resumed';
      message_text := format('%s break resumed', NEW.break_type);
    ELSE
      RETURN NEW;
    END IF;
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (user_id, category, type, title, message, payload)
  VALUES (
    NEW.agent_user_id,
    'break',
    notif_type,
    title_text,
    message_text,
    json_build_object('break_type', NEW.break_type, 'break_session_id', NEW.id, 'break_date', NEW.break_date, 'action_url', '/status/breaks')
  );
  RETURN NEW;
END;
$function$
;

-- DROP FUNCTION public.create_default_task_groups(int4);

CREATE OR REPLACE FUNCTION public.create_default_task_groups(user_id_param integer DEFAULT NULL::integer)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
    INSERT INTO task_groups (title, color, position, is_default, created_by)
    VALUES 
        ('To Do', 'bg-gray-200 dark:bg-gray-800', 0, true, user_id_param),
        ('In Progress', 'bg-blue-100 dark:bg-blue-950/20', 1, true, user_id_param),
        ('Review', 'bg-yellow-100 dark:bg-yellow-950/20', 2, true, user_id_param),
        ('On Hold', 'bg-purple-100 dark:bg-purple-950/20', 3, true, user_id_param),
        ('Done', 'bg-green-100 dark:bg-green-950/20', 4, true, user_id_param),
        ('Overdue', 'bg-red-200 dark:bg-red-950/20', 5, true, user_id_param)
    ON CONFLICT (title) DO NOTHING;
END;
$function$
;

-- DROP FUNCTION public.create_event(varchar, text, date, time, time, varchar, varchar);

CREATE OR REPLACE FUNCTION public.create_event(p_title character varying, p_description text, p_event_date date, p_start_time time without time zone, p_end_time time without time zone, p_location character varying, p_created_by_email character varying)
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
DECLARE
    user_id INTEGER;
    event_id INTEGER;
BEGIN
    -- Get user ID and check if admin
    SELECT id INTO user_id FROM users WHERE email = p_created_by_email AND user_type = 'Internal';
    
    IF user_id IS NULL THEN
        RAISE EXCEPTION 'User not found or not authorized to create events';
    END IF;
    
    -- Create event with Philippines timezone
    INSERT INTO events (title, description, event_date, start_time, end_time, location, created_by, created_at, updated_at)
    VALUES (p_title, p_description, p_event_date, p_start_time, p_end_time, p_location, user_id, 
            CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila', CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila')
    RETURNING id INTO event_id;
    
    RETURN event_id;
END;
$function$
;

-- DROP FUNCTION public.create_task_assignment_notification();

CREATE OR REPLACE FUNCTION public.create_task_assignment_notification()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
    task_title TEXT;
    task_creator_id INTEGER;
    task_creator_name TEXT;
    assignee_name TEXT;
    assignee_email TEXT;
BEGIN
    -- Get task details
    SELECT t.title, t.user_id INTO task_title, task_creator_id
    FROM tasks t WHERE t.id = NEW.task_id;
    
    -- Get task creator name
    SELECT COALESCE(NULLIF(TRIM(CONCAT(COALESCE(pi.first_name,''),' ',COALESCE(pi.last_name,''))), ''), u.email)
    INTO task_creator_name
    FROM users u
    LEFT JOIN personal_info pi ON pi.user_id = u.id
    WHERE u.id = task_creator_id;
    
    -- Get assignee details
    SELECT COALESCE(NULLIF(TRIM(CONCAT(COALESCE(pi.first_name,''),' ',COALESCE(pi.last_name,''))), ''), u.email), u.email
    INTO assignee_name, assignee_email
    FROM users u
    LEFT JOIN personal_info pi ON pi.user_id = u.id
    WHERE u.id = NEW.user_id;
    
    -- Only create notification if the assignee is not the task creator
    IF NEW.user_id != task_creator_id THEN
        -- Create notification for the assigned user
        INSERT INTO notifications (user_id, category, type, title, message, payload)
        VALUES (
            NEW.user_id,
            'task',
            'info',
            'You have been assigned to a task',
            COALESCE(task_creator_name, 'Someone') || ' assigned you to "' || COALESCE(task_title, 'a task') || '"',
            json_build_object(
                'task_id', NEW.task_id,
                'assigner_id', task_creator_id,
                'assigner_name', task_creator_name,
                'assignee_id', NEW.user_id,
                'assignee_name', assignee_name,
                'task_title', task_title,
                'action_url', '/productivity/task-activity?taskId=' || NEW.task_id
            )
        );
    END IF;
    
    RETURN NEW;
END;
$function$
;

-- DROP FUNCTION public.create_task_comment_notification();

CREATE OR REPLACE FUNCTION public.create_task_comment_notification()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
      DECLARE
        task_owner_id INTEGER;
        commenter_name TEXT;
        task_title TEXT;
      BEGIN
        -- Only create notifications for INSERT (new comments)
        IF TG_OP != 'INSERT' THEN
          RETURN NEW;
        END IF;
        
        -- Get task owner and title
        SELECT t.user_id, t.title INTO task_owner_id, task_title
        FROM tasks t 
        WHERE t.id = NEW.task_id;
        
        -- Only create notification if someone else commented (not the task owner)
        IF task_owner_id IS NOT NULL AND task_owner_id != NEW.user_id THEN
          -- Get commenter name
          SELECT COALESCE(
            NULLIF(TRIM(COALESCE(pi.first_name,'') || ' ' || COALESCE(pi.last_name,'')), ''), 
            u.email
          ) INTO commenter_name
          FROM users u
          LEFT JOIN personal_info pi ON pi.user_id = u.id
          WHERE u.id = NEW.user_id;
          
          -- Insert notification for task owner with task ID in action URL
          INSERT INTO notifications (user_id, category, type, title, message, payload)
          VALUES (
            task_owner_id,
            'task',
            'info',
            'New comment on your task',
            COALESCE(commenter_name, 'Someone') || ' commented on "' || COALESCE(task_title, 'your task') || '"',
            json_build_object(
              'task_id', NEW.task_id,
              'comment_id', NEW.id,
              'commenter_id', NEW.user_id,
              'commenter_name', commenter_name,
              'action_url', '/productivity/task-activity?taskId=' || NEW.task_id
            )
          );
        END IF;
        
        RETURN NEW;
      END;
      $function$
;

-- DROP FUNCTION public.create_ticket_status_notification();

CREATE OR REPLACE FUNCTION public.create_ticket_status_notification()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  title_text text;
  message_text text;
BEGIN
  IF TG_OP = 'UPDATE' AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    title_text := 'Ticket status updated';
    message_text := format('Ticket %s is now %s', NEW.ticket_id, NEW.status);
    INSERT INTO public.notifications (user_id, category, type, title, message, payload)
    VALUES (
      NEW.user_id,
      'ticket',
      CASE WHEN NEW.status = 'Closed' THEN 'success' ELSE 'info' END,
      title_text,
      message_text,
      json_build_object('ticket_id', NEW.ticket_id, 'status', NEW.status, 'ticket_row_id', NEW.id, 'action_url', concat('/forms/', NEW.ticket_id))
    );
  END IF;
  RETURN NEW;
END;
$function$
;

-- DROP FUNCTION public.crypt(text, text);

CREATE OR REPLACE FUNCTION public.crypt(text, text)
 RETURNS text
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pg_crypt$function$
;

-- DROP FUNCTION public.dearmor(text);

CREATE OR REPLACE FUNCTION public.dearmor(text)
 RETURNS bytea
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pg_dearmor$function$
;

-- DROP FUNCTION public.debug_activity_date(int4);

CREATE OR REPLACE FUNCTION public.debug_activity_date(p_user_id integer)
 RETURNS TABLE(debug_info text)
 LANGUAGE plpgsql
AS $function$
      DECLARE
          shift_info RECORD;
          current_time_manila TIMESTAMP;
          shift_start_time TIME;
          shift_end_time TIME;
          is_night_shift BOOLEAN;
          current_time_only TIME;
          activity_date DATE;
      BEGIN
          current_time_manila := (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Manila';
          current_time_only := current_time_manila::TIME;
          
          SELECT * INTO shift_info FROM get_agent_shift_info(p_user_id) LIMIT 1;
          
          IF NOT FOUND OR shift_info.shift_time IS NULL THEN
              RETURN QUERY SELECT 'No shift configured'::text;
              RETURN;
          END IF;
          
          shift_start_time := CASE 
              WHEN split_part(shift_info.shift_time, ' - ', 1) LIKE '%PM' AND 
                   NOT split_part(shift_info.shift_time, ' - ', 1) LIKE '12:%PM' THEN
                  (split_part(split_part(shift_info.shift_time, ' - ', 1), ' ', 1)::TIME + INTERVAL '12 hours')::TIME
              WHEN split_part(shift_info.shift_time, ' - ', 1) LIKE '12:%AM' THEN
                  replace(split_part(shift_info.shift_time, ' - ', 1), '12:', '00:')::TIME
              ELSE
                  split_part(split_part(shift_info.shift_time, ' - ', 1), ' ', 1)::TIME
          END;
          
          shift_end_time := CASE 
              WHEN split_part(shift_info.shift_time, ' - ', 2) LIKE '%PM' AND 
                   NOT split_part(shift_info.shift_time, ' - ', 2) LIKE '12:%PM' THEN
                  (split_part(split_part(shift_info.shift_time, ' - ', 2), ' ', 1)::TIME + INTERVAL '12 hours')::TIME
              WHEN split_part(shift_info.shift_time, ' - ', 2) LIKE '12:%PM' THEN
                  (split_part(split_part(shift_info.shift_time, ' - ', 2), ' ', 1)::TIME + INTERVAL '12 hours')::TIME
              ELSE
                  split_part(split_part(shift_info.shift_time, ' - ', 2), ' ', 1)::TIME
          END;
          
          is_night_shift := shift_start_time > shift_end_time;
          
          RETURN QUERY SELECT ('Shift: ' || shift_info.shift_time || ', Start: ' || shift_start_time || ', End: ' || shift_end_time || ', IsNight: ' || is_night_shift || ', Current: ' || current_time_only || ', Manila: ' || current_time_manila)::text;
      END;
      $function$
;

-- DROP FUNCTION public.decrypt(bytea, bytea, text);

CREATE OR REPLACE FUNCTION public.decrypt(bytea, bytea, text)
 RETURNS bytea
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pg_decrypt$function$
;

-- DROP FUNCTION public.decrypt_iv(bytea, bytea, bytea, text);

CREATE OR REPLACE FUNCTION public.decrypt_iv(bytea, bytea, bytea, text)
 RETURNS bytea
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pg_decrypt_iv$function$
;

-- DROP FUNCTION public.delete_event(int4, varchar);

CREATE OR REPLACE FUNCTION public.delete_event(p_event_id integer, p_deleted_by_email character varying)
 RETURNS boolean
 LANGUAGE plpgsql
AS $function$
DECLARE
    user_id INTEGER;
BEGIN
    -- Get user ID and check if admin
    SELECT id INTO user_id FROM users WHERE email = p_deleted_by_email AND user_type = 'Internal';
    
    IF user_id IS NULL THEN
        RAISE EXCEPTION 'User not found or not authorized to delete events';
    END IF;
    
    -- Delete event (cascade will handle attendance records)
    DELETE FROM events WHERE id = p_event_id;
    
    RETURN FOUND;
END;
$function$
;

-- DROP FUNCTION public.digest(bytea, text);

CREATE OR REPLACE FUNCTION public.digest(bytea, text)
 RETURNS bytea
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pg_digest$function$
;

-- DROP FUNCTION public.digest(text, text);

CREATE OR REPLACE FUNCTION public.digest(text, text)
 RETURNS bytea
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pg_digest$function$
;

-- DROP FUNCTION public.encrypt(bytea, bytea, text);

CREATE OR REPLACE FUNCTION public.encrypt(bytea, bytea, text)
 RETURNS bytea
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pg_encrypt$function$
;

-- DROP FUNCTION public.encrypt_iv(bytea, bytea, bytea, text);

CREATE OR REPLACE FUNCTION public.encrypt_iv(bytea, bytea, bytea, text)
 RETURNS bytea
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pg_encrypt_iv$function$
;

-- DROP FUNCTION public.end_meeting(int4);

CREATE OR REPLACE FUNCTION public.end_meeting(p_meeting_id integer)
 RETURNS boolean
 LANGUAGE plpgsql
AS $function$
DECLARE
    meeting_record meetings%ROWTYPE;
    actual_duration_minutes INTEGER;
BEGIN
    -- Get the meeting
    SELECT * INTO meeting_record
    FROM meetings
    WHERE id = p_meeting_id;
    
    -- Check if meeting exists and is in-progress
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    IF meeting_record.status != 'in-progress' THEN
        RETURN FALSE;
    END IF;
    
    -- Calculate actual duration in minutes based on start_time
    actual_duration_minutes := EXTRACT(EPOCH FROM (NOW() - meeting_record.start_time)) / 60;
    
    -- Update meeting status to completed, set is_in_meeting to false, 
    -- set end_time to current time, and update duration_minutes
    UPDATE meetings
    SET status = 'completed',
        is_in_meeting = FALSE,
        end_time = NOW(),
        duration_minutes = actual_duration_minutes,
        updated_at = now()
    WHERE id = p_meeting_id;
    
    RETURN TRUE;
END;
$function$
;

-- DROP FUNCTION public.end_meeting(int4, int4);

CREATE OR REPLACE FUNCTION public.end_meeting(meeting_id_param integer, agent_user_id_param integer)
 RETURNS json
 LANGUAGE plpgsql
AS $function$
DECLARE
    meeting_record RECORD;
    duration_minutes INTEGER;
    result JSON;
BEGIN
    -- Check if meeting exists and belongs to the agent
    SELECT * INTO meeting_record
    FROM meetings
    WHERE id = meeting_id_param AND agent_user_id = agent_user_id_param;
    
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'message', 'Meeting not found');
    END IF;
    
    -- Check if meeting is in progress
    IF NOT meeting_record.is_in_meeting THEN
        RETURN json_build_object('success', false, 'message', 'Meeting is not in progress');
    END IF;
    
    -- Calculate duration based on start_time (since actual_start_time is being removed)
    duration_minutes := EXTRACT(EPOCH FROM (NOW() - meeting_record.start_time)) / 60;
    
    -- End the meeting
    UPDATE meetings
    SET 
        status = 'completed',
        is_in_meeting = false,
        end_time = NOW(),
        duration_minutes = duration_minutes
    WHERE id = meeting_id_param;
    
    -- Get updated meeting record
    SELECT * INTO meeting_record
    FROM meetings
    WHERE id = meeting_id_param;
    
    -- Build result
    result := json_build_object(
        'success', true,
        'message', 'Meeting ended successfully',
        'meeting', row_to_json(meeting_record)
    );
    
    RETURN result;
END;
$function$
;

-- DROP FUNCTION public.fixed_comprehensive_activity_reset(timestamp);

CREATE OR REPLACE FUNCTION public.fixed_comprehensive_activity_reset(p_check_time timestamp without time zone DEFAULT (now() AT TIME ZONE 'Asia/Manila'::text))
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
DECLARE
    rec RECORD;
    reset_count INTEGER := 0;
    current_date DATE := p_check_time::date;
    current_time_minutes INTEGER := EXTRACT(HOUR FROM p_check_time) * 60 + EXTRACT(MINUTE FROM p_check_time);
    shift_start_minutes INTEGER;
    shift_end_minutes INTEGER;
    shift_text TEXT;
    is_night_shift BOOLEAN;
    shift_start_time TIMESTAMP WITHOUT TIME ZONE;
    time_diff_seconds INTEGER;
    activity_row RECORD;
    agent_name TEXT;
    should_reset BOOLEAN;
    manila_date DATE;
BEGIN
    -- Get the correct Manila date
    manila_date := (p_check_time AT TIME ZONE 'Asia/Manila')::date;
    
    RAISE NOTICE 'Current Manila date: %, Current time minutes: %', manila_date, current_time_minutes;
    
    -- Loop through all agents with their shift information
    FOR rec IN (
        SELECT 
            u.id AS user_id,
            u.email,
            COALESCE(pi.first_name || ' ' || pi.last_name, u.email) AS agent_name,
            ji.shift_time,
            ji.employee_id
        FROM users u
        JOIN agents a ON a.user_id = u.id
        LEFT JOIN job_info ji ON ji.agent_user_id = u.id
        LEFT JOIN personal_info pi ON pi.user_id = u.id
        WHERE u.user_type = 'Agent'
    ) LOOP
        -- Skip if no shift time configured
        IF rec.shift_time IS NULL OR rec.shift_time = '' THEN
            CONTINUE;
        END IF;

        shift_text := rec.shift_time;
        agent_name := rec.agent_name;
        should_reset := FALSE;
        
        RAISE NOTICE 'Processing agent: % with shift: %', agent_name, shift_text;
        
        -- Parse shift time format like "6:00 AM - 3:00 PM"
        IF shift_text ~* '(\d{1,2}:\d{2}\s*(AM|PM)).*-(.*\d{1,2}:\d{2}\s*(AM|PM))' THEN
            -- Extract start time (first time in the range)
            shift_start_minutes := (
                CASE UPPER(split_part(split_part(shift_text, '-', 1), ' ', 2))
                    WHEN 'AM' THEN (CASE WHEN split_part(split_part(shift_text, '-', 1), ':', 1)::INT % 12 = 0 THEN 0 ELSE split_part(split_part(shift_text, '-', 1), ':', 1)::INT END) * 60 + split_part(split_part(split_part(shift_text, '-', 1), ' ', 1), ':', 2)::INT
                    WHEN 'PM' THEN (CASE WHEN split_part(split_part(shift_text, '-', 1), ':', 1)::INT = 12 THEN 12 ELSE split_part(split_part(shift_text, '-', 1), ':', 1)::INT + 12 END) * 60 + split_part(split_part(split_part(shift_text, '-', 1), ' ', 1), ':', 2)::INT
                END
            );
            
            -- Extract end time (second time in the range)
            shift_end_minutes := (
                CASE UPPER(split_part(split_part(shift_text, '-', 2), ' ', 2))
                    WHEN 'AM' THEN (CASE WHEN split_part(split_part(shift_text, '-', 2), ':', 1)::INT % 12 = 0 THEN 0 ELSE split_part(split_part(shift_text, '-', 2), ':', 1)::INT END) * 60 + split_part(split_part(split_part(shift_text, '-', 2), ' ', 1), ':', 2)::INT
                    WHEN 'PM' THEN (CASE WHEN split_part(split_part(shift_text, '-', 2), ':', 1)::INT = 12 THEN 12 ELSE split_part(split_part(shift_text, '-', 2), ':', 1)::INT + 12 END) * 60 + split_part(split_part(split_part(shift_text, '-', 2), ' ', 1), ':', 2)::INT
                END
            );
        ELSE
            -- Skip if cannot parse shift time
            CONTINUE;
        END IF;

        RAISE NOTICE 'Shift start minutes: %, Shift end minutes: %', shift_start_minutes, shift_end_minutes;
        
        -- Determine if this is a night shift (spans midnight)
        is_night_shift := shift_end_minutes < shift_start_minutes;
        
        -- Calculate the shift start time for today (Manila time)
        shift_start_time := manila_date + (shift_start_minutes || ' minutes')::INTERVAL;
        
        -- For night shifts, if current time is before shift start, the shift started yesterday
        IF is_night_shift AND current_time_minutes < shift_start_minutes THEN
            shift_start_time := (manila_date - INTERVAL '1 day') + (shift_start_minutes || ' minutes')::INTERVAL;
        END IF;
        
        RAISE NOTICE 'Calculated shift start time: %', shift_start_time;
        
        -- Check if we're within 10 minutes of the shift start time
        time_diff_seconds := ABS(EXTRACT(EPOCH FROM (p_check_time - shift_start_time)));
        
        RAISE NOTICE 'Time difference: % seconds (% minutes)', time_diff_seconds, (time_diff_seconds / 60);
        
        -- SCENARIO 1: We're near shift start time (within 10 minutes)
        IF time_diff_seconds <= 600 THEN
            should_reset := TRUE;
            RAISE NOTICE 'Scenario 1: Near shift start time for user % (within 10 minutes)', agent_name;
        END IF;
        
        -- SCENARIO 2: We're past shift start time but activity data is from previous day
        -- This handles cases where the system missed the reset window
        IF time_diff_seconds > 600 AND time_diff_seconds <= 3600 THEN -- Between 10 minutes and 1 hour past shift start
            -- Check if we have an activity row for today
            SELECT * INTO activity_row 
            FROM activity_data 
            WHERE user_id = rec.user_id 
            AND today_date = manila_date::text;
            
            IF FOUND THEN
                -- Check if the activity data has accumulated significant time (more than 1 hour)
                -- This indicates it wasn't properly reset at shift start
                IF activity_row.today_active_seconds > 3600 OR activity_row.today_inactive_seconds > 3600 THEN
                    should_reset := TRUE;
                    RAISE NOTICE 'Scenario 2: Past shift start with accumulated time for user % (active: %s, inactive: %s)', 
                        agent_name, activity_row.today_active_seconds, activity_row.today_inactive_seconds;
                END IF;
            END IF;
        END IF;
        
        -- SCENARIO 3: Force reset for current day if we're within the first hour of shift
        -- This handles the case where we're at 6:10 AM and should reset
        IF current_time_minutes >= shift_start_minutes AND current_time_minutes <= (shift_start_minutes + 60) THEN
            should_reset := TRUE;
            RAISE NOTICE 'Scenario 3: Within first hour of shift for user % (current: % min, shift start: % min)', 
                agent_name, current_time_minutes, shift_start_minutes;
        END IF;
        
        -- Perform the reset if needed
        IF should_reset THEN
            -- Check if we have an activity row for today
            SELECT * INTO activity_row 
            FROM activity_data 
            WHERE user_id = rec.user_id 
            AND today_date = manila_date::text;
            
            -- If no activity row exists for today, create one
            IF NOT FOUND THEN
                INSERT INTO activity_data (
                    user_id, 
                    is_currently_active, 
                    last_session_start, 
                    today_date, 
                    today_active_seconds, 
                    today_inactive_seconds, 
                    updated_at
                ) VALUES (
                    rec.user_id, 
                    FALSE, 
                    NULL, 
                    manila_date::text, 
                    0, 
                    0, 
                    p_check_time
                );
                
                reset_count := reset_count + 1;
                
                RAISE NOTICE 'Created new activity row for user % (shift starting at %)', agent_name, shift_start_time;
            ELSE
                -- Reset existing activity row to 0 values
                UPDATE activity_data 
                SET 
                    today_active_seconds = 0,
                    today_inactive_seconds = 0,
                    is_currently_active = FALSE,
                    last_session_start = NULL,
                    updated_at = p_check_time
                WHERE user_id = rec.user_id 
                AND today_date = manila_date::text;
                
                reset_count := reset_count + 1;
                
                RAISE NOTICE 'Reset activity data for user % (shift starting at %)', agent_name, shift_start_time;
            END IF;
        END IF;
    END LOOP;

    RETURN reset_count;
END;
$function$
;

-- DROP FUNCTION public.gen_random_bytes(int4);

CREATE OR REPLACE FUNCTION public.gen_random_bytes(integer)
 RETURNS bytea
 LANGUAGE c
 PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pg_random_bytes$function$
;

-- DROP FUNCTION public.gen_random_uuid();

CREATE OR REPLACE FUNCTION public.gen_random_uuid()
 RETURNS uuid
 LANGUAGE c
 PARALLEL SAFE
AS '$libdir/pgcrypto', $function$pg_random_uuid$function$
;

-- DROP FUNCTION public.gen_salt(text);

CREATE OR REPLACE FUNCTION public.gen_salt(text)
 RETURNS text
 LANGUAGE c
 PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pg_gen_salt$function$
;

-- DROP FUNCTION public.gen_salt(text, int4);

CREATE OR REPLACE FUNCTION public.gen_salt(text, integer)
 RETURNS text
 LANGUAGE c
 PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pg_gen_salt_rounds$function$
;

-- DROP FUNCTION public.generate_ticket_id();

CREATE OR REPLACE FUNCTION public.generate_ticket_id()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.ticket_id := 'TKT-' || LPAD(nextval('ticket_id_seq')::text, 6, '0');
  RETURN NEW;
END;
$function$
;

-- DROP FUNCTION public.get_active_meeting(int4);

CREATE OR REPLACE FUNCTION public.get_active_meeting(p_user_id integer)
 RETURNS TABLE(id integer, title character varying, description text, start_time timestamp with time zone, end_time timestamp with time zone, duration_minutes integer, meeting_type character varying, status character varying, is_in_meeting boolean, started_automatically boolean)
 LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    SELECT
        m.id,
        m.title,
        m.description,
        m.start_time,
        m.end_time,
        m.duration_minutes,
        m.meeting_type,
        m.status, -- Return the actual status from the table
        m.is_in_meeting,
        m.started_automatically
    FROM meetings m
    WHERE m.agent_user_id = p_user_id
    AND m.is_in_meeting = TRUE
    ORDER BY m.created_at DESC
    LIMIT 1;
END;
$function$
;

-- DROP FUNCTION public.get_activity_date_for_shift(int4, timestamp);

CREATE OR REPLACE FUNCTION public.get_activity_date_for_shift(p_user_id integer, p_current_time timestamp without time zone DEFAULT NULL::timestamp without time zone)
 RETURNS date
 LANGUAGE plpgsql
AS $function$
      DECLARE
          shift_info RECORD;
          current_time_manila TIMESTAMP;
          shift_start_time TIME;
          shift_end_time TIME;
          is_night_shift BOOLEAN;
          current_time_only TIME;
          activity_date DATE;
      BEGIN
          -- Get current Manila time using manual calculation (+8 hours from UTC)
          IF p_current_time IS NULL THEN
              current_time_manila := CURRENT_TIMESTAMP + INTERVAL '8 hours';
          ELSE
              current_time_manila := p_current_time + INTERVAL '8 hours';
          END IF;
          
          current_time_only := current_time_manila::TIME;
          
          -- Get agent's shift information
          SELECT * INTO shift_info FROM get_agent_shift_info(p_user_id) LIMIT 1;
          
          IF NOT FOUND OR shift_info.shift_time IS NULL THEN
              -- No shift configured, use current date
              RETURN current_time_manila::DATE;
          END IF;
          
          -- Parse shift time
          shift_start_time := CASE 
              WHEN split_part(shift_info.shift_time, ' - ', 1) LIKE '%PM' AND 
                   NOT split_part(shift_info.shift_time, ' - ', 1) LIKE '12:%PM' THEN
                  (split_part(split_part(shift_info.shift_time, ' - ', 1), ' ', 1)::TIME + INTERVAL '12 hours')::TIME
              WHEN split_part(shift_info.shift_time, ' - ', 1) LIKE '12:%AM' THEN
                  replace(split_part(shift_info.shift_time, ' - ', 1), '12:', '00:')::TIME
              ELSE
                  split_part(split_part(shift_info.shift_time, ' - ', 1), ' ', 1)::TIME
          END;
          
          shift_end_time := CASE 
              WHEN split_part(shift_info.shift_time, ' - ', 2) LIKE '%PM' AND 
                   NOT split_part(shift_info.shift_time, ' - ', 2) LIKE '12:%PM' THEN
                  (split_part(split_part(shift_info.shift_time, ' - ', 2), ' ', 1)::TIME + INTERVAL '12 hours')::TIME
              WHEN split_part(shift_info.shift_time, ' - ', 2) LIKE '12:%PM' THEN
                  (split_part(split_part(shift_info.shift_time, ' - ', 2), ' ', 1)::TIME + INTERVAL '12 hours')::TIME
              ELSE
                  split_part(split_part(shift_info.shift_time, ' - ', 2), ' ', 1)::TIME
          END;
          
          -- Determine if it's a night shift (crosses midnight)
          is_night_shift := shift_start_time > shift_end_time;
          
          IF is_night_shift THEN
              -- FIXED NIGHT SHIFT LOGIC: Use current calendar date for all night shift activity
              -- This ensures that activity at 5:30 AM on 2025-09-05 is recorded as 2025-09-05
              -- not 2025-09-04, which makes more sense from a user perspective
              activity_date := current_time_manila::DATE;
          ELSE
              -- DAY SHIFT LOGIC: Activity date is the current day
              -- For day shifts, activity resets each day at shift start time
              activity_date := current_time_manila::DATE;
          END IF;
          
          RETURN activity_date;
      END;
      $function$
;

-- DROP FUNCTION public.get_activity_date_for_shift_simple(int4);

CREATE OR REPLACE FUNCTION public.get_activity_date_for_shift_simple(p_user_id integer)
 RETURNS date
 LANGUAGE plpgsql
AS $function$
      DECLARE
          shift_info RECORD;
          current_time_manila TIMESTAMP;
          shift_start_time TIME;
          shift_end_time TIME;
          is_night_shift BOOLEAN;
          current_time_only TIME;
          activity_date DATE;
      BEGIN
          -- Get current Manila time (UTC + 8 hours)
          current_time_manila := CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila';
          current_time_only := current_time_manila::TIME;
          
          -- Get agent's shift information
          SELECT * INTO shift_info FROM get_agent_shift_info(p_user_id) LIMIT 1;
          
          IF NOT FOUND OR shift_info.shift_time IS NULL THEN
              -- No shift configured, use current date
              RETURN current_time_manila::DATE;
          END IF;
          
          -- Parse shift time
          shift_start_time := CASE 
              WHEN split_part(shift_info.shift_time, ' - ', 1) LIKE '%PM' AND 
                   NOT split_part(shift_info.shift_time, ' - ', 1) LIKE '12:%PM' THEN
                  (split_part(split_part(shift_info.shift_time, ' - ', 1), ' ', 1)::TIME + INTERVAL '12 hours')::TIME
              WHEN split_part(shift_info.shift_time, ' - ', 1) LIKE '12:%AM' THEN
                  replace(split_part(shift_info.shift_time, ' - ', 1), '12:', '00:')::TIME
              ELSE
                  split_part(split_part(shift_info.shift_time, ' - ', 1), ' ', 1)::TIME
          END;
          
          shift_end_time := CASE 
              WHEN split_part(shift_info.shift_time, ' - ', 2) LIKE '%PM' AND 
                   NOT split_part(shift_info.shift_time, ' - ', 2) LIKE '12:%PM' THEN
                  (split_part(split_part(shift_info.shift_time, ' - ', 2), ' ', 1)::TIME + INTERVAL '12 hours')::TIME
              WHEN split_part(shift_info.shift_time, ' - ', 2) LIKE '12:%PM' THEN
                  (split_part(split_part(shift_info.shift_time, ' - ', 2), ' ', 1)::TIME + INTERVAL '12 hours')::TIME
              ELSE
                  split_part(split_part(shift_info.shift_time, ' - ', 2), ' ', 1)::TIME
          END;
          
          -- Determine if it's a night shift (crosses midnight)
          is_night_shift := shift_start_time > shift_end_time;
          
          IF is_night_shift THEN
              -- NIGHT SHIFT LOGIC: Activity date is the day the shift starts
              -- For night shifts, if we're between shift start and end times, 
              -- we're in the shift that started the previous day
              IF current_time_only >= shift_start_time OR current_time_only < shift_end_time THEN
                  -- We're within the shift period, so the shift started the previous day
                  activity_date := current_time_manila::DATE - INTERVAL '1 day';
              ELSE
                  -- We're outside the shift period, so we're in today's shift
                  activity_date := current_time_manila::DATE;
              END IF;
          ELSE
              -- DAY SHIFT LOGIC: Activity date is always the current day
              -- For day shifts, activity resets each day at shift start time
              -- Day shifts never cross midnight, so always use current date
              activity_date := current_time_manila::DATE;
          END IF;
          
          RETURN activity_date;
      END;
      $function$
;

-- DROP FUNCTION public.get_agent_daily_breaks(int4);

CREATE OR REPLACE FUNCTION public.get_agent_daily_breaks(p_agent_user_id integer)
 RETURNS TABLE(break_type break_type_enum, break_count integer, total_minutes integer, can_take_break boolean)
 LANGUAGE plpgsql
AS $function$
			BEGIN
				RETURN QUERY
				WITH break_types AS (
					SELECT unnest(enum_range(NULL::break_type_enum)) AS bt
				),
				today_breaks AS (
					SELECT 
						bs.break_type,
						COUNT(*) as break_count,
						COALESCE(SUM(bs.duration_minutes), 0) as total_minutes
					FROM public.break_sessions bs
					WHERE bs.agent_user_id = p_agent_user_id
					AND bs.break_date = (NOW() AT TIME ZONE 'Asia/Manila')::date
					AND bs.end_time IS NOT NULL
					GROUP BY bs.break_type
				)
				SELECT 
					bt.bt as break_type,
					COALESCE(tb.break_count, 0)::INTEGER as break_count,
					COALESCE(tb.total_minutes, 0)::INTEGER as total_minutes,
					(COALESCE(tb.break_count, 0) = 0) as can_take_break
				FROM break_types bt
				LEFT JOIN today_breaks tb ON bt.bt = tb.break_type
				ORDER BY bt.bt;
			END;
			$function$
;

-- DROP FUNCTION public.get_agent_shift_info(int4);

CREATE OR REPLACE FUNCTION public.get_agent_shift_info(p_agent_user_id integer)
 RETURNS TABLE(user_id integer, shift_time text, shift_period text, shift_schedule text)
 LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    SELECT
        u.id as user_id,
        ji.shift_time,  -- Remove COALESCE - return actual value or NULL
        ji.shift_period, -- Remove COALESCE - return actual value or NULL
        ji.shift_schedule -- Remove COALESCE - return actual value or NULL
    FROM users u
    LEFT JOIN agents a ON u.id = a.user_id
    LEFT JOIN job_info ji ON ji.agent_user_id = a.user_id
    WHERE u.id = p_agent_user_id;
END;
$function$
;

-- DROP FUNCTION public.get_current_activity_status(int4, timestamp);

CREATE OR REPLACE FUNCTION public.get_current_activity_status(p_user_id integer, p_current_time timestamp without time zone DEFAULT NULL::timestamp without time zone)
 RETURNS TABLE(today_date date, today_active_seconds integer, today_inactive_seconds integer, is_currently_active boolean, last_session_start timestamp without time zone, updated_at timestamp without time zone, shift_period text)
 LANGUAGE plpgsql
AS $function$
      DECLARE
          current_time_manila TIMESTAMP;
          activity_date DATE;
          shift_period TEXT;
      BEGIN
          -- Get current Manila time
          IF p_current_time IS NULL THEN
              current_time_manila := CURRENT_TIMESTAMP + INTERVAL '8 hours';
          ELSE
              current_time_manila := p_current_time + INTERVAL '8 hours';
          END IF;
          
          -- Get the correct activity date for this shift
          activity_date := get_activity_date_for_shift(p_user_id, p_current_time);
          
          -- Get the current shift period
          shift_period := get_current_shift_period(p_user_id, p_current_time);
          
          -- Return current activity status
          RETURN QUERY
          SELECT 
              ad.today_date,
              COALESCE(ad.today_active_seconds, 0) as today_active_seconds,
              COALESCE(ad.today_inactive_seconds, 0) as today_inactive_seconds,
              COALESCE(ad.is_currently_active, FALSE) as is_currently_active,
              ad.last_session_start,
              ad.updated_at,
              shift_period
          FROM activity_data ad
          WHERE ad.user_id = p_user_id AND ad.today_date = activity_date
          LIMIT 1;
          
          -- If no record found, return default values
          IF NOT FOUND THEN
              RETURN QUERY SELECT
                  activity_date as today_date,
                  0 as today_active_seconds,
                  0 as today_inactive_seconds,
                  FALSE as is_currently_active,
                  NULL::TIMESTAMP as last_session_start,
                  current_time_manila as updated_at,
                  shift_period;
          END IF;
      END;
      $function$
;

-- DROP FUNCTION public.get_current_day_activity(int4);

CREATE OR REPLACE FUNCTION public.get_current_day_activity(p_user_id integer)
 RETURNS activity_data
 LANGUAGE plpgsql
AS $function$
DECLARE
    activity_record activity_data;
BEGIN
    SELECT * INTO activity_record 
    FROM get_or_create_activity_data(p_user_id, (NOW() AT TIME ZONE 'Asia/Manila')::date);
    RETURN activity_record;
END;
$function$
;

-- DROP FUNCTION public.get_current_philippines_time();

CREATE OR REPLACE FUNCTION public.get_current_philippines_time()
 RETURNS timestamp with time zone
 LANGUAGE plpgsql
AS $function$
      BEGIN
          -- Get current time in Philippines timezone
          RETURN NOW() AT TIME ZONE 'Asia/Manila';
      END;
      $function$
;

-- DROP FUNCTION public.get_current_shift_period(int4, timestamp);

CREATE OR REPLACE FUNCTION public.get_current_shift_period(p_user_id integer, p_current_time timestamp without time zone DEFAULT NULL::timestamp without time zone)
 RETURNS text
 LANGUAGE plpgsql
AS $function$
      DECLARE
          shift_info RECORD;
          current_time_manila TIMESTAMP;
          shift_start_time TIME;
          shift_end_time TIME;
          is_night_shift BOOLEAN;
          current_time_only TIME;
          activity_date DATE;
          shift_period TEXT;
      BEGIN
          -- Get current Manila time
          IF p_current_time IS NULL THEN
              current_time_manila := CURRENT_TIMESTAMP + INTERVAL '8 hours';
          ELSE
              current_time_manila := p_current_time + INTERVAL '8 hours';
          END IF;
          
          current_time_only := current_time_manila::TIME;
          
          -- Get agent's shift information
          SELECT * INTO shift_info FROM get_agent_shift_info(p_user_id) LIMIT 1;
          
          IF NOT FOUND OR shift_info.shift_time IS NULL THEN
              -- No shift configured, use date-based period
              RETURN 'day_' || current_time_manila::DATE;
          END IF;
          
          -- Parse shift time
          shift_start_time := CASE 
              WHEN split_part(shift_info.shift_time, ' - ', 1) LIKE '%PM' AND 
                   NOT split_part(shift_info.shift_time, ' - ', 1) LIKE '12:%PM' THEN
                  (split_part(split_part(shift_info.shift_time, ' - ', 1), ' ', 1)::TIME + INTERVAL '12 hours')::TIME
              WHEN split_part(shift_info.shift_time, ' - ', 1) LIKE '12:%AM' THEN
                  replace(split_part(shift_info.shift_time, ' - ', 1), '12:', '00:')::TIME
              ELSE
                  split_part(split_part(shift_info.shift_time, ' - ', 1), ' ', 1)::TIME
          END;
          
          shift_end_time := CASE 
              WHEN split_part(shift_info.shift_time, ' - ', 2) LIKE '%PM' AND 
                   NOT split_part(shift_info.shift_time, ' - ', 2) LIKE '12:%PM' THEN
                  (split_part(split_part(shift_info.shift_time, ' - ', 2), ' ', 1)::TIME + INTERVAL '12 hours')::TIME
              WHEN split_part(shift_info.shift_time, ' - ', 2) LIKE '12:%PM' THEN
                  (split_part(split_part(shift_info.shift_time, ' - ', 2), ' ', 1)::TIME + INTERVAL '12 hours')::TIME
              ELSE
                  split_part(split_part(shift_info.shift_time, ' - ', 2), ' ', 1)::TIME
          END;
          
          -- Determine if it's a night shift
          is_night_shift := shift_start_time > shift_end_time;
          
          -- Get the activity date for this shift
          activity_date := get_activity_date_for_shift(p_user_id, p_current_time);
          
          IF is_night_shift THEN
              -- For night shifts, use the date when the shift started
              -- This ensures the entire shift period is identified consistently
              shift_period := 'night_' || activity_date;
          ELSE
              -- For day shifts, use the current date
              shift_period := 'day_' || activity_date;
          END IF;
          
          RETURN shift_period;
      END;
      $function$
;

-- DROP FUNCTION public.get_daily_activity_summary(int4, date, date);

CREATE OR REPLACE FUNCTION public.get_daily_activity_summary(p_user_id integer, p_start_date date DEFAULT (((now() AT TIME ZONE 'Asia/Manila'::text))::date - '30 days'::interval), p_end_date date DEFAULT ((now() AT TIME ZONE 'Asia/Manila'::text))::date)
 RETURNS TABLE(date date, active_hours numeric, inactive_hours numeric, total_hours numeric)
 LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    SELECT 
        ad.today_date as date,
        ROUND(ad.today_active_seconds / 3600.0, 2) as active_hours,
        ROUND(ad.today_inactive_seconds / 3600.0, 2) as inactive_hours,
        ROUND((ad.today_active_seconds + ad.today_inactive_seconds) / 3600.0, 2) as total_hours
    FROM activity_data ad
    WHERE ad.user_id = p_user_id 
    AND ad.today_date BETWEEN p_start_date AND p_end_date
    ORDER BY ad.today_date DESC;
END;
$function$
;

-- DROP FUNCTION public.get_events_for_user(int4);

CREATE OR REPLACE FUNCTION public.get_events_for_user(p_user_id integer)
 RETURNS TABLE(event_id integer, title character varying, description text, event_date date, start_time time without time zone, end_time time without time zone, location character varying, status character varying, event_type character varying, created_by integer, created_at timestamp without time zone, updated_at timestamp without time zone, assigned_user_ids integer[])
 LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    SELECT 
        e.id,
        e.title,
        e.description,
        e.event_date,
        e.start_time,
        e.end_time,
        e.location,
        e.status,
        e.event_type,
        e.created_by,
        e.created_at,
        e.updated_at,
        e.assigned_user_ids
    FROM public.events e
    WHERE e.assigned_user_ids IS NULL 
       OR p_user_id = ANY(e.assigned_user_ids)
    ORDER BY e.event_date ASC, e.start_time ASC;
END;
$function$
;

-- DROP FUNCTION public.get_local_break_date(text);

CREATE OR REPLACE FUNCTION public.get_local_break_date(p_timezone text DEFAULT 'Asia/Manila'::text)
 RETURNS date
 LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN (CURRENT_TIMESTAMP AT TIME ZONE 'UTC' AT TIME ZONE p_timezone)::DATE;
END;
$function$
;

-- DROP FUNCTION public.get_meeting_statistics(int4, int4);

CREATE OR REPLACE FUNCTION public.get_meeting_statistics(p_user_id integer, p_days integer)
 RETURNS TABLE(total_meetings bigint, completed_meetings bigint, scheduled_meetings bigint, in_progress_meetings bigint, cancelled_meetings bigint, total_duration_minutes bigint, average_duration_minutes numeric)
 LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*) as total_meetings,
        COUNT(*) FILTER (WHERE status = 'completed') as completed_meetings,
        COUNT(*) FILTER (WHERE status = 'scheduled') as scheduled_meetings,
        COUNT(*) FILTER (WHERE status = 'in-progress') as in_progress_meetings,
        COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_meetings,
        COALESCE(SUM(duration_minutes), 0) as total_duration_minutes,
        COALESCE(AVG(duration_minutes), 0) as average_duration_minutes
    FROM meetings
    WHERE agent_user_id = p_user_id
    AND created_at >= NOW() - INTERVAL '1 day' * p_days;
END;
$function$
;

-- DROP FUNCTION public.get_month_end_date(date);

CREATE OR REPLACE FUNCTION public.get_month_end_date(input_date date DEFAULT NULL::date)
 RETURNS date
 LANGUAGE plpgsql
AS $function$
DECLARE
    target_date DATE;
    month_end DATE;
BEGIN
    -- Use provided date or current Philippines date
    IF input_date IS NULL THEN
        target_date := (NOW() AT TIME ZONE 'Asia/Manila')::date;
    ELSE
        target_date := input_date;
    END IF;
    
    -- Get last day of the month
    month_end := (DATE_TRUNC('month', target_date) + INTERVAL '1 month' - INTERVAL '1 day')::date;
    
    RETURN month_end;
END;
$function$
;

-- DROP FUNCTION public.get_month_start_date(date);

CREATE OR REPLACE FUNCTION public.get_month_start_date(input_date date DEFAULT NULL::date)
 RETURNS date
 LANGUAGE plpgsql
AS $function$
DECLARE
    target_date DATE;
    month_start DATE;
BEGIN
    -- Use provided date or current Philippines date
    IF input_date IS NULL THEN
        target_date := (NOW() AT TIME ZONE 'Asia/Manila')::date;
    ELSE
        target_date := input_date;
    END IF;
    
    -- Get 1st day of the month
    month_start := DATE_TRUNC('month', target_date)::date;
    
    RETURN month_start;
END;
$function$
;

-- DROP FUNCTION public.get_month_year(date);

CREATE OR REPLACE FUNCTION public.get_month_year(input_date date DEFAULT NULL::date)
 RETURNS character varying
 LANGUAGE plpgsql
AS $function$
DECLARE
    target_date DATE;
    month_year VARCHAR(7);
BEGIN
    -- Use provided date or current Philippines date
    IF input_date IS NULL THEN
        target_date := (NOW() AT TIME ZONE 'Asia/Manila')::date;
    ELSE
        target_date := input_date;
    END IF;
    
    -- Format as YYYY-MM
    month_year := TO_CHAR(target_date, 'YYYY-MM');
    
    RETURN month_year;
END;
$function$
;

-- DROP FUNCTION public.get_next_task_position(int4);

CREATE OR REPLACE FUNCTION public.get_next_task_position(group_id_param integer)
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
DECLARE
    next_position INTEGER;
BEGIN
    SELECT COALESCE(COUNT(*), 0) + 1
    INTO next_position
    FROM tasks
    WHERE group_id = group_id_param AND status = 'active';
    
    RETURN next_position;
END;
$function$
;

-- DROP FUNCTION public.get_or_create_activity_data(int4, date);

CREATE OR REPLACE FUNCTION public.get_or_create_activity_data(p_user_id integer, p_date date DEFAULT ((now() AT TIME ZONE 'Asia/Manila'::text))::date)
 RETURNS activity_data
 LANGUAGE plpgsql
AS $function$
DECLARE
    activity_record activity_data;
BEGIN
    SELECT * INTO activity_record 
    FROM activity_data 
    WHERE user_id = p_user_id AND today_date = p_date;
    IF NOT FOUND THEN
        INSERT INTO activity_data (
            user_id, 
            is_currently_active, 
            today_active_seconds, 
            today_inactive_seconds, 
            last_session_start, 
            today_date
        ) VALUES (
            p_user_id, 
            false, 
            0, 
            0, 
            NULL, 
            p_date
        ) RETURNING * INTO activity_record;
    END IF;
    RETURN activity_record;
END;
$function$
;

-- DROP FUNCTION public.get_or_create_activity_for_shift_period(int4, date, time);

CREATE OR REPLACE FUNCTION public.get_or_create_activity_for_shift_period(p_user_id integer, p_shift_date date, p_shift_start_time time without time zone)
 RETURNS TABLE(id integer, today_date date, today_active_seconds integer, today_inactive_seconds integer, shift_period_id character varying)
 LANGUAGE plpgsql
AS $function$
      DECLARE
          v_shift_period_id VARCHAR(50);
          v_row_id INTEGER;
      BEGIN
          -- Generate shift period ID
          v_shift_period_id := generate_shift_period_id(p_user_id, p_shift_date, p_shift_start_time);
          
          -- Check if row exists for this shift period
          SELECT id INTO v_row_id 
          FROM activity_data 
          WHERE user_id = p_user_id 
            AND today_date = p_shift_date 
            AND shift_period_id = v_shift_period_id;
          
          IF v_row_id IS NULL THEN
              -- Create new row for this shift period
              INSERT INTO activity_data (
                  user_id, 
                  today_date, 
                  today_active_seconds, 
                  today_inactive_seconds, 
                  shift_period_id,
                  is_currently_active,
                  last_session_start,
                  created_at,
                  updated_at
              )
              VALUES (
                  p_user_id, 
                  p_shift_date, 
                  0, 
                  0, 
                  v_shift_period_id,
                  FALSE,
                  NOW(),
                  NOW(),
                  NOW()
              )
              RETURNING id INTO v_row_id;
              
              RAISE NOTICE 'Created new activity row for shift period %: ID %', v_shift_period_id, v_row_id;
          ELSE
              RAISE NOTICE 'Found existing activity row for shift period %: ID %', v_shift_period_id, v_row_id;
          END IF;
          
          -- Return the row data
          RETURN QUERY
          SELECT 
              ad.id,
              ad.today_date,
              ad.today_active_seconds,
              ad.today_inactive_seconds,
              ad.shift_period_id
          FROM activity_data ad
          WHERE ad.id = v_row_id;
      END;
      $function$
;

-- DROP FUNCTION public.get_philippines_now();

CREATE OR REPLACE FUNCTION public.get_philippines_now()
 RETURNS timestamp with time zone
 LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN NOW() AT TIME ZONE 'Asia/Manila';
END;
$function$
;

-- DROP FUNCTION public.get_philippines_timestamp(timestamptz);

CREATE OR REPLACE FUNCTION public.get_philippines_timestamp(timestamp_with_timezone timestamp with time zone)
 RETURNS timestamp with time zone
 LANGUAGE plpgsql
AS $function$
      BEGIN
          -- Convert the timestamp to Philippines timezone for display
          RETURN timestamp_with_timezone AT TIME ZONE 'Asia/Manila';
      END;
      $function$
;

-- DROP FUNCTION public.get_user_average_productivity(int4, int4);

CREATE OR REPLACE FUNCTION public.get_user_average_productivity(target_user_id integer, months_back integer DEFAULT 12)
 RETURNS numeric
 LANGUAGE plpgsql
AS $function$
      DECLARE
          avg_score DECIMAL(5,2);
          cutoff_date DATE;
      BEGIN
          -- Calculate cutoff date (months_back months ago)
          cutoff_date := (NOW() AT TIME ZONE 'Asia/Manila')::date - (months_back * 30);
          
          SELECT AVG(productivity_score) INTO avg_score
          FROM productivity_scores 
          WHERE user_id = target_user_id
          AND month_year >= TO_CHAR(cutoff_date, 'YYYY-MM');
          
          RETURN COALESCE(ROUND(avg_score, 2), 0.00);
      END;
      $function$
;

-- DROP FUNCTION public.get_user_conversations(int4);

CREATE OR REPLACE FUNCTION public.get_user_conversations(user_id_param integer)
 RETURNS TABLE(conversation_id integer, conversation_type character varying, last_message_content text, last_message_at timestamp without time zone, unread_count bigint, other_participant_id integer, other_participant_name text, other_participant_email text)
 LANGUAGE plpgsql
AS $function$
      BEGIN
        RETURN QUERY
        SELECT 
          tc.id,
          tc.conversation_type,
          tm.content,
          tc.last_message_at,
          COALESCE(unread.unread_count, 0),
          other_user.id,
          TRIM(CONCAT(COALESCE(pi.first_name,''), ' ', COALESCE(pi.last_name,''))) as other_participant_name,
          other_user.email
        FROM team_conversations tc
        JOIN conversation_participants cp ON tc.id = cp.conversation_id
        JOIN conversation_participants other_cp ON tc.id = other_cp.conversation_id
        JOIN users other_user ON other_cp.user_id = other_user.id
        LEFT JOIN personal_info pi ON other_user.id = pi.user_id
        LEFT JOIN (
          SELECT DISTINCT ON (tm_sub.conversation_id)
            tm_sub.conversation_id,
            tm_sub.content,
            tm_sub.created_at
          FROM team_messages tm_sub
          WHERE tm_sub.is_deleted = FALSE
          ORDER BY tm_sub.conversation_id, tm_sub.created_at DESC
        ) tm ON tc.id = tm.conversation_id
        LEFT JOIN (
          SELECT
            tm2.conversation_id,
            COUNT(*) as unread_count
          FROM team_messages tm2
          LEFT JOIN message_delivery_status mds ON tm2.id = mds.message_id AND mds.user_id = user_id_param
          WHERE tm2.created_at > COALESCE(mds.read_at, '1970-01-01'::timestamp)
            AND tm2.sender_id != user_id_param
            AND tm2.is_deleted = FALSE
            AND (mds.deleted_at IS NULL OR mds.deleted_at < tm2.created_at)
          GROUP BY tm2.conversation_id
        ) unread ON tc.id = unread.conversation_id
        WHERE cp.user_id = user_id_param
          AND other_cp.user_id != user_id_param
          -- Only show conversations where current user is still active AND hasn't left recently
          AND cp.is_active = TRUE 
          AND (cp.left_at IS NULL OR cp.left_at > NOW() - INTERVAL '1 day')
          -- Only show conversations where other user is also active (not deleted by them)
          AND other_cp.is_active = TRUE
          AND (other_cp.left_at IS NULL OR other_cp.left_at > NOW() - INTERVAL '1 day')
        ORDER BY tc.last_message_at DESC NULLS LAST;
      END;
      $function$
;

-- DROP FUNCTION public.get_user_events(varchar);

CREATE OR REPLACE FUNCTION public.get_user_events(user_email character varying)
 RETURNS TABLE(event_id integer, title character varying, description text, event_date date, start_time time without time zone, end_time time without time zone, location character varying, status character varying, created_by_name text, is_going boolean, is_back boolean, going_at timestamp without time zone, back_at timestamp without time zone)
 LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    SELECT 
        e.id as event_id,
        e.title,
        e.description,
        e.event_date,
        e.start_time,
        e.end_time,
        e.location,
        e.status,
        u.email as created_by_name,
        COALESCE(ea.is_going, false) as is_going,
        COALESCE(ea.is_back, false) as is_back,
        ea.going_at AT TIME ZONE 'Asia/Manila' as going_at,
        ea.back_at AT TIME ZONE 'Asia/Manila' as back_at
    FROM events e
    LEFT JOIN users u ON e.created_by = u.id
    LEFT JOIN event_attendance ea ON e.id = ea.event_id AND ea.user_id = (
        SELECT id FROM users WHERE email = user_email
    )
    ORDER BY e.event_date ASC, e.start_time ASC;
END;
$function$
;

-- DROP FUNCTION public.get_user_meeting_status(int4);

CREATE OR REPLACE FUNCTION public.get_user_meeting_status(p_user_id integer)
 RETURNS TABLE(is_in_meeting boolean, meeting_id integer, meeting_title character varying, meeting_type character varying)
 LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    SELECT 
        m.is_in_meeting,
        m.id,
        m.title,
        m.meeting_type
    FROM meetings m
    WHERE m.agent_user_id = p_user_id
    AND m.is_in_meeting = TRUE
    AND m.status = 'in-progress'
    ORDER BY m.created_at DESC
    LIMIT 1;
END;
$function$
;

-- DROP FUNCTION public.get_user_meetings(int4, int4, int4, int4);

CREATE OR REPLACE FUNCTION public.get_user_meetings(p_user_id integer, p_days integer DEFAULT 7, p_limit integer DEFAULT 10, p_offset integer DEFAULT 0)
 RETURNS TABLE(id integer, title character varying, description text, start_time timestamp with time zone, end_time timestamp with time zone, duration_minutes integer, meeting_type character varying, status character varying, is_in_meeting boolean, created_at timestamp with time zone, total_count bigint)
 LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    SELECT 
        m.id,
        m.title,
        m.description,
        m.start_time,
        m.end_time,
        m.duration_minutes,
        m.meeting_type,
        -- Ensure status consistency: if is_in_meeting is true, status should be 'in-progress'
        CASE 
            WHEN m.is_in_meeting = true THEN 'in-progress'
            ELSE m.status
        END as status,
        m.is_in_meeting,
        m.created_at,
        COUNT(*) OVER() as total_count
    FROM meetings m
    WHERE m.agent_user_id = p_user_id
    AND m.start_time >= NOW() - INTERVAL '1 day' * p_days
    ORDER BY m.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$function$
;

-- DROP FUNCTION public.get_user_meetings_count(int4, int4);

CREATE OR REPLACE FUNCTION public.get_user_meetings_count(p_user_id integer, p_days integer DEFAULT 7)
 RETURNS bigint
 LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN (
        SELECT COUNT(*)
        FROM meetings m
        WHERE m.agent_user_id = p_user_id
        AND m.start_time >= NOW() - INTERVAL '1 day' * p_days
    );
END;
$function$
;

-- DROP FUNCTION public.get_user_monthly_summary(int4, date);

CREATE OR REPLACE FUNCTION public.get_user_monthly_summary(target_user_id integer, target_date date DEFAULT NULL::date)
 RETURNS TABLE(month_start_date date, month_end_date date, total_active_seconds integer, total_inactive_seconds integer, total_days_active integer, total_hours_active numeric, total_hours_inactive numeric)
 LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    SELECT 
        mas.month_start_date,
        mas.month_end_date,
        mas.total_active_seconds,
        mas.total_inactive_seconds,
        mas.total_days_active,
        ROUND(mas.total_active_seconds::NUMERIC / 3600, 2) as total_hours_active,
        ROUND(mas.total_inactive_seconds::NUMERIC / 3600, 2) as total_hours_inactive
    FROM monthly_activity_summary mas
    WHERE mas.user_id = target_user_id
    AND (target_date IS NULL OR 
         (mas.month_start_date <= target_date AND mas.month_end_date >= target_date))
    ORDER BY mas.month_start_date DESC;
END;
$function$
;

-- DROP FUNCTION public.get_user_productivity_scores(int4, int4);

CREATE OR REPLACE FUNCTION public.get_user_productivity_scores(target_user_id integer, months_back integer DEFAULT 12)
 RETURNS TABLE(month_year character varying, productivity_score numeric, total_active_seconds integer, total_inactive_seconds integer, total_seconds integer, active_percentage numeric, active_hours numeric, inactive_hours numeric, total_hours numeric)
 LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    SELECT 
        ps.month_year,
        ps.productivity_score,
        ps.total_active_seconds,
        ps.total_inactive_seconds,
        ps.total_seconds,
        ps.active_percentage,
        ROUND(ps.total_active_seconds::DECIMAL / 3600, 2) as active_hours,
        ROUND(ps.total_inactive_seconds::DECIMAL / 3600, 2) as inactive_hours,
        ROUND(ps.total_seconds::DECIMAL / 3600, 2) as total_hours
    FROM productivity_scores ps
    WHERE ps.user_id = target_user_id
    ORDER BY ps.month_year DESC
    LIMIT months_back;
END;
$function$
;

-- DROP FUNCTION public.get_user_weekly_summary(int4, date);

CREATE OR REPLACE FUNCTION public.get_user_weekly_summary(target_user_id integer, target_date date DEFAULT NULL::date)
 RETURNS TABLE(week_start_date date, week_end_date date, total_active_seconds integer, total_inactive_seconds integer, total_days_active integer, total_hours_active numeric, total_hours_inactive numeric)
 LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    SELECT 
        was.week_start_date,
        was.week_end_date,
        was.total_active_seconds,
        was.total_inactive_seconds,
        was.total_days_active,
        ROUND(was.total_active_seconds::NUMERIC / 3600, 2) as total_hours_active,
        ROUND(was.total_inactive_seconds::NUMERIC / 3600, 2) as total_hours_inactive
    FROM weekly_activity_summary was
    WHERE was.user_id = target_user_id
    AND (target_date IS NULL OR 
         (was.week_start_date <= target_date AND was.week_end_date >= target_date))
    ORDER BY was.week_start_date DESC;
END;
$function$
;

-- DROP FUNCTION public.get_week_end_date(date);

CREATE OR REPLACE FUNCTION public.get_week_end_date(input_date date DEFAULT NULL::date)
 RETURNS date
 LANGUAGE plpgsql
AS $function$
BEGIN
    -- Return Sunday of the week
    RETURN get_week_start_date(input_date) + 6;
END;
$function$
;

-- DROP FUNCTION public.get_week_start_date(date);

CREATE OR REPLACE FUNCTION public.get_week_start_date(input_date date DEFAULT NULL::date)
 RETURNS date
 LANGUAGE plpgsql
AS $function$
DECLARE
    target_date DATE;
    week_start DATE;
BEGIN
    -- Use provided date or current Philippines date
    IF input_date IS NULL THEN
        target_date := (NOW() AT TIME ZONE 'Asia/Manila')::date;
    ELSE
        target_date := input_date;
    END IF;
    
    -- Get Monday of the week (week starts on Monday)
    week_start := target_date - (EXTRACT(DOW FROM target_date) - 1)::INTEGER;
    
    -- Adjust for Sunday (DOW = 0)
    IF EXTRACT(DOW FROM target_date) = 0 THEN
        week_start := target_date - 6;
    END IF;
    
    RETURN week_start;
END;
$function$
;

-- DROP FUNCTION public.handle_task_assignment_removal();

CREATE OR REPLACE FUNCTION public.handle_task_assignment_removal()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
    task_title TEXT;
    task_creator_id INTEGER;
    task_creator_name TEXT;
    assignee_name TEXT;
BEGIN
    -- Get task details
    SELECT t.title, t.user_id INTO task_title, task_creator_id
    FROM tasks t WHERE t.id = OLD.task_id;
    
    -- Get task creator name
    SELECT COALESCE(NULLIF(TRIM(CONCAT(COALESCE(pi.first_name,''),' ',COALESCE(pi.last_name,''))), ''), u.email)
    INTO task_creator_name
    FROM users u
    LEFT JOIN personal_info pi ON pi.user_id = u.id
    WHERE u.id = task_creator_id;
    
    -- Get assignee name
    SELECT COALESCE(NULLIF(TRIM(CONCAT(COALESCE(pi.first_name,''),' ',COALESCE(pi.last_name,''))), ''), u.email)
    INTO assignee_name
    FROM users u
    LEFT JOIN personal_info pi ON pi.user_id = u.id
    WHERE u.id = OLD.user_id;
    
    -- Only create notification if the removed assignee is not the task creator
    IF OLD.user_id != task_creator_id THEN
        -- Create notification for the removed user
        INSERT INTO notifications (user_id, category, type, title, message, payload)
        VALUES (
            OLD.user_id,
            'task',
            'warning',
            'You have been removed from a task',
            COALESCE(task_creator_name, 'Someone') || ' removed you from "' || COALESCE(task_title, 'a task') || '"',
            json_build_object(
                'task_id', OLD.task_id,
                'remover_id', task_creator_id,
                'remover_name', task_creator_name,
                'removed_assignee_id', OLD.user_id,
                'removed_assignee_name', assignee_name,
                'task_title', task_title,
                'action_url', '/productivity/task-activity'
            )
        );
    END IF;
    
    RETURN OLD;
END;
$function$
;

-- DROP FUNCTION public.hmac(bytea, bytea, text);

CREATE OR REPLACE FUNCTION public.hmac(bytea, bytea, text)
 RETURNS bytea
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pg_hmac$function$
;

-- DROP FUNCTION public.hmac(text, text, text);

CREATE OR REPLACE FUNCTION public.hmac(text, text, text)
 RETURNS bytea
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pg_hmac$function$
;

-- DROP FUNCTION public.is_break_available(int4, break_type_enum, timestamp);

CREATE OR REPLACE FUNCTION public.is_break_available(p_agent_user_id integer, p_break_type break_type_enum, p_current_time timestamp without time zone DEFAULT (now() AT TIME ZONE 'Asia/Manila'::text))
 RETURNS boolean
 LANGUAGE plpgsql
AS $function$
      DECLARE
        shift_info RECORD;
        break_windows RECORD;
        current_time_only TIME;
        break_start_time TIME;
        break_end_time TIME;
        break_already_taken BOOLEAN;
        minutes_since_start INTEGER;
      BEGIN
        -- Get agent shift information
        SELECT * INTO shift_info FROM get_agent_shift_info(p_agent_user_id) LIMIT 1;

        IF NOT FOUND THEN
          RETURN FALSE;
        END IF;

        -- Check if break was already taken today
        SELECT EXISTS(
          SELECT 1 FROM break_sessions
          WHERE agent_user_id = p_agent_user_id
          AND break_type = p_break_type
          AND break_date = p_current_time::DATE
        ) INTO break_already_taken;

        IF break_already_taken THEN
          RETURN FALSE; -- Break already taken
        END IF;

        -- Get break windows for this shift
        SELECT * INTO break_windows FROM calculate_break_windows(shift_info.shift_time) LIMIT 1;

        current_time_only := p_current_time::TIME;

        -- Determine break start and end times based on break type
        CASE p_break_type
          WHEN 'Morning' THEN
            break_start_time := break_windows.morning_start;
            break_end_time := break_windows.morning_end;
          WHEN 'Lunch' THEN
            break_start_time := break_windows.lunch_start;
            break_end_time := break_windows.lunch_end;
          WHEN 'Afternoon' THEN
            break_start_time := break_windows.afternoon_start;
            break_end_time := break_windows.afternoon_end;
          WHEN 'NightFirst' THEN
            break_start_time := break_windows.morning_start;
            break_end_time := break_windows.morning_end;
          WHEN 'NightMeal' THEN
            break_start_time := break_windows.lunch_start;
            break_end_time := break_windows.lunch_end;
          WHEN 'NightSecond' THEN
            break_start_time := break_windows.afternoon_start;
            break_end_time := break_windows.afternoon_end;
          ELSE
            RETURN FALSE;
        END CASE;

        IF break_start_time IS NULL OR break_end_time IS NULL THEN
          RETURN FALSE;
        END IF;

        -- Break is available ONLY at the exact start time
        -- This prevents the function from returning true for the entire break window
        
        IF current_time_only = break_start_time THEN
          RETURN TRUE; -- Break is available only at start time
        END IF;

        RETURN FALSE;
      END;
$function$
;

-- DROP FUNCTION public.is_break_available_now(int4, break_type_enum, timestamp);

CREATE OR REPLACE FUNCTION public.is_break_available_now(p_agent_user_id integer, p_break_type break_type_enum, p_current_time timestamp without time zone DEFAULT NULL::timestamp without time zone)
 RETURNS boolean
 LANGUAGE plpgsql
AS $function$
      DECLARE
          shift_info RECORD;
          current_time_manila TIMESTAMP;
          current_time_only TIME;
          break_start_time TIME;
          break_end_time TIME;
          break_already_taken BOOLEAN;
      BEGIN
          -- Get agent's actual shift information
          SELECT * INTO shift_info FROM get_agent_shift_info(p_agent_user_id) LIMIT 1;
          
          IF NOT FOUND OR shift_info.shift_time IS NULL THEN
              RETURN FALSE; -- No shift configured
          END IF;
          
          -- Get current Manila time
          IF p_current_time IS NULL THEN
              current_time_manila := CURRENT_TIMESTAMP + INTERVAL '8 hours';
          ELSE
              current_time_manila := p_current_time;
          END IF;
          
          current_time_only := current_time_manila::TIME;
          
          -- Check if break was already taken today
          SELECT EXISTS(
              SELECT 1 FROM break_sessions
              WHERE agent_user_id = p_agent_user_id
              AND break_type = p_break_type
              AND break_date = current_time_manila::DATE
              AND end_time IS NOT NULL
          ) INTO break_already_taken;
          
          IF break_already_taken THEN
              RETURN FALSE; -- Break already taken
          END IF;
          
          -- Get break window from calculate_break_windows
          SELECT start_time, end_time INTO break_start_time, break_end_time
          FROM calculate_break_windows(p_agent_user_id)
          WHERE break_type = p_break_type
          LIMIT 1;
          
          IF NOT FOUND THEN
              RETURN FALSE; -- No break window for this type
          END IF;
          
          -- Check if current time is within the break window
          RETURN current_time_only >= break_start_time AND current_time_only < break_end_time;
      END;
      $function$
;

-- DROP FUNCTION public.is_break_available_now_notification_sent(int4, break_type_enum, timestamp);

CREATE OR REPLACE FUNCTION public.is_break_available_now_notification_sent(p_agent_user_id integer, p_break_type break_type_enum, p_check_time timestamp without time zone)
 RETURNS boolean
 LANGUAGE plpgsql
AS $function$
DECLARE
    break_start_time TIMESTAMP;
    break_end_time TIMESTAMP;
    notification_exists BOOLEAN;
BEGIN
    -- Get the break window for the current day
    SELECT 
        (CURRENT_DATE + (SPLIT_PART(ji.shift_time, ' - ', 1))::time) AT TIME ZONE 'Asia/Manila' INTO break_start_time
    FROM job_info ji 
    WHERE ji.agent_user_id = p_agent_user_id;
    
    IF break_start_time IS NULL THEN
        RETURN FALSE; -- No shift configured
    END IF;
    
    -- Calculate break start time based on break type
    CASE p_break_type
        WHEN 'Lunch' THEN
            break_start_time := break_start_time + INTERVAL '4 hours'; -- 4 hours after shift start
            break_end_time := break_start_time + INTERVAL '1 hour'; -- 1 hour break
        WHEN 'Morning' THEN
            break_start_time := break_start_time + INTERVAL '2 hours'; -- 2 hours after shift start
            break_end_time := break_start_time + INTERVAL '15 minutes'; -- 15 minute break
        WHEN 'Afternoon' THEN
            break_start_time := break_start_time + INTERVAL '6 hours'; -- 6 hours after shift start
            break_end_time := break_start_time + INTERVAL '15 minutes'; -- 15 minute break
        ELSE
            RETURN FALSE; -- Unknown break type
    END CASE;
    
    -- Check if "available_now" notification was already sent for this break period today
    -- We check for notifications sent today, not just within the current break window
    SELECT EXISTS(
        SELECT 1 FROM notifications 
        WHERE user_id = p_agent_user_id 
        AND category = 'break'
        AND payload->>'reminder_type' = 'available_now'
        AND payload->>'break_type' = p_break_type::text
        AND DATE(created_at AT TIME ZONE 'Asia/Manila') = CURRENT_DATE
    ) INTO notification_exists;
    
    RETURN notification_exists;
END;
$function$
;

-- DROP FUNCTION public.is_break_available_soon(int4, break_type_enum, timestamp);

CREATE OR REPLACE FUNCTION public.is_break_available_soon(p_agent_user_id integer, p_break_type break_type_enum, p_current_time timestamp without time zone DEFAULT NULL::timestamp without time zone)
 RETURNS boolean
 LANGUAGE plpgsql
AS $function$
      DECLARE
          shift_info RECORD;
          current_time_manila TIMESTAMP;
          current_time_only TIME;
          break_start_time TIME;
          minutes_until_break INTEGER;
          break_already_taken BOOLEAN;
      BEGIN
          -- Get agent's actual shift information
          SELECT * INTO shift_info FROM get_agent_shift_info(p_agent_user_id) LIMIT 1;
          
          IF NOT FOUND OR shift_info.shift_time IS NULL THEN
              RETURN FALSE; -- No shift configured
          END IF;
          
          -- Get current Manila time
          IF p_current_time IS NULL THEN
              current_time_manila := CURRENT_TIMESTAMP + INTERVAL '8 hours';
          ELSE
              current_time_manila := p_current_time;
          END IF;
          
          current_time_only := current_time_manila::TIME;
          
          -- Check if break was already taken today
          SELECT EXISTS(
              SELECT 1 FROM break_sessions
              WHERE agent_user_id = p_agent_user_id
              AND break_type = p_break_type
              AND break_date = current_time_manila::DATE
              AND end_time IS NOT NULL
          ) INTO break_already_taken;
          
          IF break_already_taken THEN
              RETURN FALSE; -- Break already taken
          END IF;
          
          -- Get break start time from calculate_break_windows
          SELECT start_time INTO break_start_time
          FROM calculate_break_windows(p_agent_user_id)
          WHERE break_type = p_break_type
          LIMIT 1;
          
          IF NOT FOUND THEN
              RETURN FALSE; -- No break window for this type
          END IF;
          
          -- Calculate minutes until break starts
          minutes_until_break := EXTRACT(EPOCH FROM (break_start_time - current_time_only)) / 60;
          
          -- Handle day rollover for night shifts
          IF minutes_until_break < -720 THEN -- More than 12 hours in the past
              minutes_until_break := minutes_until_break + 1440; -- Add 24 hours
          END IF;
          
          -- Return true if break starts within the next 15 minutes
          RETURN minutes_until_break > 0 AND minutes_until_break <= 15;
      END;
      $function$
;

-- DROP FUNCTION public.is_break_missed(int4, break_type_enum, timestamp);

CREATE OR REPLACE FUNCTION public.is_break_missed(p_agent_user_id integer, p_break_type break_type_enum, p_current_time timestamp without time zone DEFAULT NULL::timestamp without time zone)
 RETURNS boolean
 LANGUAGE plpgsql
AS $function$
      DECLARE
          shift_info RECORD;
          current_time_manila TIMESTAMP;
          current_time_only TIME;
          break_start_time TIME;
          break_end_time TIME;
          minutes_since_break_start INTEGER;
          break_already_taken BOOLEAN;
          break_currently_active BOOLEAN;  -- NEW: Check for currently active breaks
          current_date_manila DATE;
          last_notification_time TIMESTAMP;
          minutes_since_last_notification INTEGER;
      BEGIN
          -- Get agent's actual shift information
          SELECT * INTO shift_info FROM get_agent_shift_info(p_agent_user_id) LIMIT 1;
          
          IF NOT FOUND OR shift_info.shift_time IS NULL THEN
              RETURN FALSE; -- No shift configured
          END IF;
          
          -- Get current Manila time
          IF p_current_time IS NULL THEN
              current_time_manila := CURRENT_TIMESTAMP + INTERVAL '8 hours';
          ELSE
              current_time_manila := p_current_time;
          END IF;
          
          current_time_only := current_time_manila::TIME;
          current_date_manila := current_time_manila::DATE;
          
          -- NEW: Check if break is currently active (being used right now)
          SELECT EXISTS(
              SELECT 1 FROM break_sessions
              WHERE agent_user_id = p_agent_user_id
              AND break_type = p_break_type
              AND break_date = current_date_manila
              AND end_time IS NULL  -- Currently active break
          ) INTO break_currently_active;
          
          IF break_currently_active THEN
              RETURN FALSE; -- Break is currently active, don't send reminder
          END IF;
          
          -- Check if break was already taken today
          SELECT EXISTS(
              SELECT 1 FROM break_sessions
              WHERE agent_user_id = p_agent_user_id
              AND break_type = p_break_type
              AND break_date = current_date_manila
              AND end_time IS NOT NULL
          ) INTO break_already_taken;
          
          IF break_already_taken THEN
              RETURN FALSE; -- Break already taken
          END IF;
          
          -- Get break window from calculate_break_windows
          SELECT start_time, end_time INTO break_start_time, break_end_time
          FROM calculate_break_windows(p_agent_user_id)
          WHERE break_type = p_break_type
          LIMIT 1;
          
          IF NOT FOUND THEN
              RETURN FALSE; -- No break window for this type
          END IF;
          
          -- Check if we're within the break window
          IF current_time_only < break_start_time OR current_time_only >= break_end_time THEN
              RETURN FALSE; -- Outside break window
          END IF;
          
          -- Calculate minutes since break start
          minutes_since_break_start := EXTRACT(EPOCH FROM (current_time_only - break_start_time)) / 60;
          
          -- Check if it's been at least 30 minutes since break start
          IF minutes_since_break_start < 30 THEN
              RETURN FALSE; -- Too early to send reminder
          END IF;
          
          -- Check if we're too close to break end (within last 15 minutes)
          IF EXTRACT(EPOCH FROM (break_end_time - current_time_only)) / 60 < 15 THEN
              RETURN FALSE; -- Too close to break end
          END IF;
          
          -- Check if we've sent a notification in the last 25 minutes (prevent spam)
          SELECT MAX(created_at) INTO last_notification_time
          FROM notifications 
          WHERE user_id = p_agent_user_id 
          AND category = 'break' 
          AND payload->>'break_type' = p_break_type::TEXT
          AND payload->>'reminder_type' = 'missed_break'
          AND created_at > current_time_manila - INTERVAL '1 hour';
          
          IF last_notification_time IS NOT NULL THEN
              minutes_since_last_notification := EXTRACT(EPOCH FROM (current_time_manila - last_notification_time)) / 60;
              IF minutes_since_last_notification < 25 THEN
                  RETURN FALSE; -- Too soon since last notification
              END IF;
          END IF;
          
          -- Send reminder every 30 minutes during the break window
          -- This ensures reminders at :00 and :30 of each hour
          RETURN (minutes_since_break_start % 30) < 5;
      END;
      $function$
;

-- DROP FUNCTION public.is_break_window_ending_soon(int4, break_type_enum, timestamptz);

CREATE OR REPLACE FUNCTION public.is_break_window_ending_soon(p_agent_user_id integer, p_break_type break_type_enum, p_check_time timestamp with time zone DEFAULT now())
 RETURNS boolean
 LANGUAGE plpgsql
AS $function$
      DECLARE
          shift_info RECORD;
          break_windows RECORD;
          current_time_only TIME;
          break_end_time TIME;
          minutes_until_expiry INTEGER;
          break_already_taken BOOLEAN;
          break_currently_active BOOLEAN;  -- NEW: Check for currently active breaks
      BEGIN
          -- Get agent shift information
          SELECT * INTO shift_info FROM get_agent_shift_info(p_agent_user_id) LIMIT 1;
          
          IF NOT FOUND OR shift_info.shift_time IS NULL THEN
              RETURN FALSE;
          END IF;
          
          -- NEW: Check if break is currently active (being used right now)
          SELECT EXISTS(
              SELECT 1 FROM break_sessions
              WHERE agent_user_id = p_agent_user_id
              AND break_type = p_break_type
              AND break_date = (p_check_time AT TIME ZONE 'Asia/Manila')::DATE
              AND end_time IS NULL  -- Currently active break
          ) INTO break_currently_active;
          
          IF break_currently_active THEN
              RETURN FALSE; -- Break is currently active, don't send ending soon notification
          END IF;
          
          -- Check if break was already taken today
          SELECT EXISTS(
              SELECT 1 FROM break_sessions
              WHERE agent_user_id = p_agent_user_id
              AND break_type = p_break_type
              AND break_date = (p_check_time AT TIME ZONE 'Asia/Manila')::DATE
              AND end_time IS NOT NULL
          ) INTO break_already_taken;
          
          IF break_already_taken THEN
              RETURN FALSE; -- Break already taken, no need for ending soon notification
          END IF;
          
          -- Get break windows using user_id
          SELECT * INTO break_windows FROM calculate_break_windows(p_agent_user_id)
          WHERE break_type = p_break_type LIMIT 1;
          
          IF NOT FOUND THEN
              RETURN FALSE;
          END IF;
          
          -- SIMPLE APPROACH: Extract time part directly from input timestamp
          -- Treat the input as local time (Manila time)
          current_time_only := p_check_time::TIME;
          break_end_time := break_windows.end_time;
          
          -- Calculate minutes until break window expires
          IF current_time_only > break_end_time THEN
              -- Current time is after break end time, so it's already ended
              minutes_until_expiry := 0;
          ELSE
              -- Calculate minutes until end
              minutes_until_expiry := EXTRACT(EPOCH FROM (break_end_time - current_time_only)) / 60;
          END IF;
          
          -- Return true if break window is ending in 15 minutes (with 1-minute tolerance)
          -- This means between 14-16 minutes before the end (narrower, more precise window)
          RETURN (minutes_until_expiry >= 14 AND minutes_until_expiry <= 16);
      END;
      $function$
;

-- DROP FUNCTION public.is_user_assigned_to_event(int4, int4);

CREATE OR REPLACE FUNCTION public.is_user_assigned_to_event(p_event_id integer, p_user_id integer)
 RETURNS boolean
 LANGUAGE plpgsql
AS $function$
BEGIN
    -- If assigned_user_ids is NULL, event is visible to all users
    IF (SELECT assigned_user_ids FROM public.events WHERE id = p_event_id) IS NULL THEN
        RETURN TRUE;
    END IF;
    
    -- Check if user_id is in the assigned_user_ids array
    RETURN p_user_id = ANY(
        SELECT assigned_user_ids 
        FROM public.events 
        WHERE id = p_event_id
    );
END;
$function$
;

-- DROP FUNCTION public.is_user_in_meeting(int4);

CREATE OR REPLACE FUNCTION public.is_user_in_meeting(p_user_id integer)
 RETURNS boolean
 LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM meetings m
        WHERE m.agent_user_id = p_user_id
        AND m.is_in_meeting = TRUE
    );
END;
$function$
;

-- DROP FUNCTION public.mark_user_back(int4, varchar);

CREATE OR REPLACE FUNCTION public.mark_user_back(event_id integer, user_email character varying)
 RETURNS boolean
 LANGUAGE plpgsql
AS $function$
DECLARE
    user_id INTEGER;
BEGIN
    -- Get user ID
    SELECT id INTO user_id FROM users WHERE email = user_email;
    
    IF user_id IS NULL THEN
        RETURN false;
    END IF;
    
    -- Insert or update attendance record with Philippines timezone
    INSERT INTO event_attendance (event_id, user_id, is_back, back_at, updated_at)
    VALUES (event_id, user_id, true, CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila', CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila')
    ON CONFLICT (event_id, user_id)
    DO UPDATE SET 
        is_back = true,
        back_at = CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila',
        updated_at = CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila';
    
    RETURN true;
END;
$function$
;

-- DROP FUNCTION public.mark_user_going(int4, varchar);

CREATE OR REPLACE FUNCTION public.mark_user_going(event_id integer, user_email character varying)
 RETURNS boolean
 LANGUAGE plpgsql
AS $function$
DECLARE
    user_id INTEGER;
BEGIN
    -- Get user ID
    SELECT id INTO user_id FROM users WHERE email = user_email;
    
    IF user_id IS NULL THEN
        RETURN false;
    END IF;
    
    -- Insert or update attendance record with Philippines timezone
    INSERT INTO event_attendance (event_id, user_id, is_going, going_at, updated_at)
    VALUES (event_id, user_id, true, CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila', CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila')
    ON CONFLICT (event_id, user_id)
    DO UPDATE SET 
        is_going = true,
        going_at = CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila',
        updated_at = CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila';
    
    RETURN true;
END;
$function$
;

-- DROP FUNCTION public.move_overdue_tasks_to_overdue_column();

CREATE OR REPLACE FUNCTION public.move_overdue_tasks_to_overdue_column()
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
DECLARE
    task_record RECORD;
    overdue_group_id INTEGER;
    tasks_moved INTEGER := 0;
    now_ts timestamptz := now() AT TIME ZONE 'Asia/Manila';
BEGIN
    -- Get the Overdue column ID (global for all users)
    SELECT id INTO overdue_group_id
    FROM task_groups 
    WHERE title = 'Overdue';
    
    -- If Overdue column doesn't exist, return 0
    IF overdue_group_id IS NULL THEN
        RETURN 0;
    END IF;
    
    -- Loop through all active tasks that are overdue
    FOR task_record IN
        SELECT 
            t.id,
            t.user_id,
            t.group_id,
            t.title
        FROM tasks t
        WHERE t.due_date IS NOT NULL
        AND t.status = 'active'
        AND t.due_date < now_ts
        AND t.group_id != overdue_group_id  -- Exclude tasks already in Overdue column
        AND t.group_id NOT IN (  -- Exclude tasks already in Done column
            SELECT id FROM task_groups WHERE title = 'Done'
        )
    LOOP
        -- Move task to Overdue column
        UPDATE tasks 
        SET group_id = overdue_group_id,
            position = (SELECT COALESCE(MAX(position), 0) + 1 FROM tasks WHERE group_id = overdue_group_id AND status = 'active'),
            updated_at = now_ts
        WHERE id = task_record.id;
        
        tasks_moved := tasks_moved + 1;
    END LOOP;
    
    RETURN tasks_moved;
END;
$function$
;

-- DROP FUNCTION public.normalize_task_positions(int4);

CREATE OR REPLACE FUNCTION public.normalize_task_positions(group_id_param integer)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
    task_record RECORD;
    new_position INTEGER := 1;
BEGIN
    -- Update positions for all tasks in the group to be sequential
    FOR task_record IN 
        SELECT id FROM tasks 
        WHERE group_id = group_id_param AND status = 'active' 
        ORDER BY position, created_at
    LOOP
        UPDATE tasks 
        SET position = new_position, updated_at = NOW() AT TIME ZONE 'Asia/Manila'
        WHERE id = task_record.id;
        new_position := new_position + 1;
    END LOOP;
END;
$function$
;

-- DROP FUNCTION public.notify_activity_data_change();

CREATE OR REPLACE FUNCTION public.notify_activity_data_change()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
    notification_data JSONB;
BEGIN
    -- Build notification payload
    notification_data := jsonb_build_object(
        'user_id', NEW.user_id,
        'action', TG_OP,
        'table', 'activity_data',
        'data', jsonb_build_object(
            'id', NEW.id,
            'user_id', NEW.user_id,
            'is_currently_active', NEW.is_currently_active,
            'today_active_seconds', NEW.today_active_seconds,
            'today_inactive_seconds', NEW.today_inactive_seconds,
            'today_date', NEW.today_date,
            'last_session_start', NEW.last_session_start,
            'created_at', NEW.created_at,
            'updated_at', NEW.updated_at
        )
    );
    
    -- Send notification to the activity_data_change channel
    PERFORM pg_notify('activity_data_change', notification_data::text);
    
    RETURN NEW;
END;
$function$
;

-- DROP FUNCTION public.notify_event_attendance_change();

CREATE OR REPLACE FUNCTION public.notify_event_attendance_change()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
    notification_payload JSONB;
    event_data JSONB;
    user_data JSONB;
BEGIN
    -- Get event details
    SELECT to_jsonb(e) INTO event_data
    FROM events e
    WHERE e.id = COALESCE(NEW.event_id, OLD.event_id);
    
    -- Get user details
    SELECT to_jsonb(u) INTO user_data
    FROM users u
    WHERE u.id = COALESCE(NEW.user_id, OLD.user_id);
    
    -- Determine the operation type
    IF TG_OP = 'INSERT' THEN
        notification_payload := jsonb_build_object(
            'type', 'event_attendance_created',
            'event_id', NEW.event_id,
            'user_id', NEW.user_id,
            'is_going', NEW.is_going,
            'is_back', NEW.is_back,
            'going_at', NEW.going_at,
            'back_at', NEW.back_at,
            'event_data', event_data,
            'user_data', user_data
        );
    ELSIF TG_OP = 'UPDATE' THEN
        notification_payload := jsonb_build_object(
            'type', 'event_attendance_updated',
            'event_id', NEW.event_id,
            'user_id', NEW.user_id,
            'is_going', NEW.is_going,
            'is_back', NEW.is_back,
            'going_at', NEW.going_at,
            'back_at', NEW.back_at,
            'old_data', to_jsonb(OLD),
            'new_data', to_jsonb(NEW),
            'event_data', event_data,
            'user_data', user_data
        );
    ELSIF TG_OP = 'DELETE' THEN
        notification_payload := jsonb_build_object(
            'type', 'event_attendance_deleted',
            'event_id', OLD.event_id,
            'user_id', OLD.user_id,
            'event_data', event_data,
            'user_data', user_data
        );
    END IF;

    -- Send the notification
    PERFORM pg_notify('event_attendance_changes', notification_payload::text);
    
    -- Return the appropriate record
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$function$
;

-- DROP FUNCTION public.notify_event_change();

CREATE OR REPLACE FUNCTION public.notify_event_change()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
    notification_payload JSONB;
    event_data JSONB;
    created_by_name TEXT;
    action_url TEXT;
    current_time_ph TIME;
    event_start_time TIME;
BEGIN
    -- Get current time in Philippines timezone
    current_time_ph := (NOW() AT TIME ZONE 'Asia/Manila')::TIME;
    
    -- Get the name of the user who created the event
    SELECT email INTO created_by_name
    FROM users
    WHERE id = COALESCE(NEW.created_by, OLD.created_by);

    -- Determine the operation type
    IF TG_OP = 'INSERT' THEN
        event_data := to_jsonb(NEW);
        notification_payload := jsonb_build_object(
            'type', 'event_created',
            'event_id', NEW.id,
            'event_title', NEW.title,
            'event_date', NEW.event_date,
            'start_time', NEW.start_time,
            'end_time', NEW.end_time,
            'location', NEW.location,
            'status', NEW.status,
            'created_by', NEW.created_by,
            'created_at', NEW.created_at,
            'data', event_data
        );

        -- Create notifications for assigned users about the new event (only if status is upcoming)
        IF NEW.status = 'upcoming' THEN
            -- Set action URL based on event status
            action_url := '/status/events?tab=upcoming&eventId=' || NEW.id;

            INSERT INTO notifications (user_id, category, type, title, message, payload)
            SELECT
                u.id,
                'event',
                'info',
                format('New %s Scheduled',
                       CASE
                           WHEN COALESCE(NEW.event_type, 'event') = 'activity' THEN 'Activity'
                           ELSE 'Event'
                       END),
                format('A new %s "%s" has been scheduled for %s at %s',
                       CASE
                           WHEN COALESCE(NEW.event_type, 'event') = 'activity' THEN 'activity'
                           ELSE 'event'
                       END,
                       NEW.title,
                       to_char(NEW.event_date AT TIME ZONE 'Asia/Manila', 'YYYY-MM-DD'),
                       NEW.start_time),
                jsonb_build_object(
                    'event_id', NEW.id,
                    'event_title', NEW.title,
                    'event_date', NEW.event_date,
                    'start_time', NEW.start_time,
                    'end_time', NEW.end_time,
                    'location', NEW.location,
                    'status', NEW.status,
                    'event_type', COALESCE(NEW.event_type, 'event'),
                    'created_by', NEW.created_by,
                    'created_by_name', created_by_name,
                    'notification_type', 'event_created',
                    'action_url', action_url
                )
            FROM users u
            WHERE (NEW.assigned_user_ids IS NOT NULL AND array_length(NEW.assigned_user_ids, 1) > 0 AND u.id = ANY(NEW.assigned_user_ids)) -- Only notify assigned users if there are any
              AND u.id != NEW.created_by; -- Don't notify the creator
        END IF;

    ELSIF TG_OP = 'UPDATE' THEN
        event_data := to_jsonb(NEW);
        notification_payload := jsonb_build_object(
            'type', 'event_updated',
            'event_id', NEW.id,
            'event_title', NEW.title,
            'event_date', NEW.event_date,
            'start_time', NEW.start_time,
            'end_time', NEW.end_time,
            'location', NEW.location,
            'status', NEW.status,
            'created_by', NEW.created_by,
            'updated_at', NEW.updated_at,
            'old_data', to_jsonb(OLD),
            'new_data', event_data
        );

        -- Create notifications for all users about the event update (only for specific status changes)
        IF OLD.status IS DISTINCT FROM NEW.status THEN
            -- Event scheduled for today (status changed to 'today') - Notify assigned users
            IF NEW.status = 'today' THEN
                action_url := '/status/events?tab=today&eventId=' || NEW.id;

                -- Send "Today's Event" notification to inform assigned users about the event
                INSERT INTO notifications (user_id, category, type, title, message, payload)
                SELECT
                    u.id,
                    'event',
                    'info',
                    format('Today''s %s - %s',
                           CASE
                               WHEN COALESCE(NEW.event_type, 'event') = 'activity' THEN 'Activity'
                               ELSE 'Event'
                           END,
                           NEW.title),
                    format('%s "%s" is scheduled for today at %s (%s)',
                           CASE
                               WHEN COALESCE(NEW.event_type, 'event') = 'activity' THEN 'Activity'
                               ELSE 'Event'
                           END,
                           NEW.title,
                           to_char(NEW.start_time::TIME, 'HH12:MI AM'),
                           NEW.location),
                    jsonb_build_object(
                        'event_id', NEW.id,
                        'event_title', NEW.title,
                        'event_date', NEW.event_date,
                        'start_time', NEW.start_time,
                        'end_time', NEW.end_time,
                        'location', NEW.location,
                        'event_type', COALESCE(NEW.event_type, 'event'),
                        'old_status', OLD.status,
                        'new_status', NEW.status,
                        'created_by', NEW.created_by,
                        'created_by_name', created_by_name,
                        'notification_type', 'event_scheduled_today',
                        'action_url', action_url
                    )
                FROM users u
                WHERE (NEW.assigned_user_ids IS NOT NULL AND array_length(NEW.assigned_user_ids, 1) > 0 AND u.id = ANY(NEW.assigned_user_ids)); -- Only notify assigned users if there are any

                -- Parse the event start time
                event_start_time := NEW.start_time::TIME;
                
                -- Also send "Event Started" notification if the actual start time has been reached
                IF current_time_ph >= event_start_time THEN
                    INSERT INTO notifications (user_id, category, type, title, message, payload)
                    SELECT
                        u.id,
                        'event',
                        'info',
                        format('%s Started - Please Join',
                               CASE
                                   WHEN COALESCE(NEW.event_type, 'event') = 'activity' THEN 'Activity'
                                   ELSE 'Event'
                               END),
                        format('%s "%s" has started at %s (%s)',
                               CASE
                                   WHEN COALESCE(NEW.event_type, 'event') = 'activity' THEN 'Activity'
                                   ELSE 'Event'
                               END,
                               NEW.title,
                               to_char(NEW.start_time::TIME, 'HH12:MI AM'),
                               NEW.location),
                        jsonb_build_object(
                            'event_id', NEW.id,
                            'event_title', NEW.title,
                            'event_date', NEW.event_date,
                            'start_time', NEW.start_time,
                            'end_time', NEW.end_time,
                            'location', NEW.location,
                            'event_type', COALESCE(NEW.event_type, 'event'),
                            'old_status', OLD.status,
                            'new_status', NEW.status,
                            'created_by', NEW.created_by,
                            'created_by_name', created_by_name,
                            'notification_type', 'event_started',
                            'action_url', action_url
                        )
                    FROM users u
                    WHERE (NEW.assigned_user_ids IS NOT NULL AND array_length(NEW.assigned_user_ids, 1) > 0 AND u.id = ANY(NEW.assigned_user_ids)); -- Only notify assigned users if there are any
                END IF;
            END IF;

            -- Event cancelled
            IF NEW.status = 'cancelled' THEN
                action_url := '/status/events?tab=cancelled&eventId=' || NEW.id;

                INSERT INTO notifications (user_id, category, type, title, message, payload)
                SELECT
                    u.id,
                    'event',
                    'warning',
                    format('%s Cancelled',
                           CASE
                               WHEN COALESCE(NEW.event_type, 'event') = 'activity' THEN 'Activity'
                               ELSE 'Event'
                           END),
                    format('%s "%s" scheduled for %s has been cancelled',
                           CASE
                               WHEN COALESCE(NEW.event_type, 'event') = 'activity' THEN 'Activity'
                               ELSE 'Event'
                           END,
                           NEW.title,
                           to_char(NEW.event_date AT TIME ZONE 'Asia/Manila', 'YYYY-MM-DD')),
                    jsonb_build_object(
                        'event_id', NEW.id,
                        'event_title', NEW.title,
                        'event_date', NEW.event_date,
                        'start_time', NEW.start_time,
                        'end_time', NEW.end_time,
                        'location', NEW.location,
                        'event_type', COALESCE(NEW.event_type, 'event'),
                        'old_status', OLD.status,
                        'new_status', NEW.status,
                        'created_by', NEW.created_by,
                        'created_by_name', created_by_name,
                        'notification_type', 'event_cancelled',
                        'action_url', action_url
                    )
                FROM users u
                WHERE (NEW.assigned_user_ids IS NOT NULL AND array_length(NEW.assigned_user_ids, 1) > 0 AND u.id = ANY(NEW.assigned_user_ids)); -- Only notify assigned users if there are any
            END IF;

            -- Event ended
            IF NEW.status = 'ended' THEN
                action_url := '/status/events?tab=ended&eventId=' || NEW.id;

                INSERT INTO notifications (user_id, category, type, title, message, payload)
                SELECT
                    u.id,
                    'event',
                    'info',
                    format('%s Ended',
                           CASE
                               WHEN COALESCE(NEW.event_type, 'event') = 'activity' THEN 'Activity'
                               ELSE 'Event'
                           END),
                    format('%s "%s" has ended',
                           CASE
                               WHEN COALESCE(NEW.event_type, 'event') = 'activity' THEN 'Activity'
                               ELSE 'Event'
                           END,
                           NEW.title),
                    jsonb_build_object(
                        'event_id', NEW.id,
                        'event_title', NEW.title,
                        'event_date', NEW.event_date,
                        'start_time', NEW.start_time,
                        'end_time', NEW.end_time,
                        'location', NEW.location,
                        'event_type', COALESCE(NEW.event_type, 'event'),
                        'old_status', OLD.status,
                        'new_status', NEW.status,
                        'created_by', NEW.created_by,
                        'created_by_name', created_by_name,
                        'notification_type', 'event_ended',
                        'action_url', action_url
                    )
                FROM users u
                WHERE (NEW.assigned_user_ids IS NOT NULL AND array_length(NEW.assigned_user_ids, 1) > 0 AND u.id = ANY(NEW.assigned_user_ids)); -- Only notify assigned users if there are any
            END IF;
        END IF;

        -- Handle assigned users changes - notify newly assigned users about current event status
        IF (OLD.assigned_user_ids IS DISTINCT FROM NEW.assigned_user_ids) 
           AND NEW.assigned_user_ids IS NOT NULL 
           AND array_length(NEW.assigned_user_ids, 1) > 0 THEN
            
            -- If event is currently 'today', notify newly assigned users
            IF NEW.status = 'today' THEN
                action_url := '/status/events?tab=today&eventId=' || NEW.id;

                INSERT INTO notifications (user_id, category, type, title, message, payload)
                SELECT
                    u.id,
                    'event',
                    'info',
                    format('Today''s %s - %s',
                           CASE
                               WHEN COALESCE(NEW.event_type, 'event') = 'activity' THEN 'Activity'
                               ELSE 'Event'
                           END,
                           NEW.title),
                    format('%s "%s" is scheduled for today at %s (%s)',
                           CASE
                               WHEN COALESCE(NEW.event_type, 'event') = 'activity' THEN 'Activity'
                               ELSE 'Event'
                           END,
                           NEW.title,
                           to_char(NEW.start_time::TIME, 'HH12:MI AM'),
                           NEW.location),
                    jsonb_build_object(
                        'event_id', NEW.id,
                        'event_title', NEW.title,
                        'event_date', NEW.event_date,
                        'start_time', NEW.start_time,
                        'end_time', NEW.end_time,
                        'location', NEW.location,
                        'event_type', COALESCE(NEW.event_type, 'event'),
                        'status', NEW.status,
                        'created_by', NEW.created_by,
                        'created_by_name', created_by_name,
                        'notification_type', 'event_assigned_today',
                        'action_url', action_url
                    )
                FROM users u
                WHERE u.id = ANY(NEW.assigned_user_ids)
                  AND (OLD.assigned_user_ids IS NULL OR u.id != ALL(COALESCE(OLD.assigned_user_ids, ARRAY[]::int4[]))); -- Only notify newly assigned users
            END IF;

            -- If event is currently 'cancelled', notify newly assigned users
            IF NEW.status = 'cancelled' THEN
                action_url := '/status/events?tab=cancelled&eventId=' || NEW.id;

                INSERT INTO notifications (user_id, category, type, title, message, payload)
                SELECT
                    u.id,
                    'event',
                    'warning',
                    format('%s Cancelled',
                           CASE
                               WHEN COALESCE(NEW.event_type, 'event') = 'activity' THEN 'Activity'
                               ELSE 'Event'
                           END),
                    format('%s "%s" scheduled for %s has been cancelled',
                           CASE
                               WHEN COALESCE(NEW.event_type, 'event') = 'activity' THEN 'Activity'
                               ELSE 'Event'
                           END,
                           NEW.title,
                           to_char(NEW.event_date AT TIME ZONE 'Asia/Manila', 'YYYY-MM-DD')),
                    jsonb_build_object(
                        'event_id', NEW.id,
                        'event_title', NEW.title,
                        'event_date', NEW.event_date,
                        'start_time', NEW.start_time,
                        'end_time', NEW.end_time,
                        'location', NEW.location,
                        'event_type', COALESCE(NEW.event_type, 'event'),
                        'status', NEW.status,
                        'created_by', NEW.created_by,
                        'created_by_name', created_by_name,
                        'notification_type', 'event_assigned_cancelled',
                        'action_url', action_url
                    )
                FROM users u
                WHERE u.id = ANY(NEW.assigned_user_ids)
                  AND (OLD.assigned_user_ids IS NULL OR u.id != ALL(COALESCE(OLD.assigned_user_ids, ARRAY[]::int4[]))); -- Only notify newly assigned users
            END IF;

            -- If event is currently 'ended', notify newly assigned users
            IF NEW.status = 'ended' THEN
                action_url := '/status/events?tab=ended&eventId=' || NEW.id;

                INSERT INTO notifications (user_id, category, type, title, message, payload)
                SELECT
                    u.id,
                    'event',
                    'info',
                    format('%s Ended',
                           CASE
                               WHEN COALESCE(NEW.event_type, 'event') = 'activity' THEN 'Activity'
                               ELSE 'Event'
                           END),
                    format('%s "%s" has ended',
                           CASE
                               WHEN COALESCE(NEW.event_type, 'event') = 'activity' THEN 'Activity'
                               ELSE 'Event'
                           END,
                           NEW.title),
                    jsonb_build_object(
                        'event_id', NEW.id,
                        'event_title', NEW.title,
                        'event_date', NEW.event_date,
                        'start_time', NEW.start_time,
                        'end_time', NEW.end_time,
                        'location', NEW.location,
                        'event_type', COALESCE(NEW.event_type, 'event'),
                        'status', NEW.status,
                        'created_by', NEW.created_by,
                        'created_by_name', created_by_name,
                        'notification_type', 'event_assigned_ended',
                        'action_url', action_url
                    )
                FROM users u
                WHERE u.id = ANY(NEW.assigned_user_ids)
                  AND (OLD.assigned_user_ids IS NULL OR u.id != ALL(COALESCE(OLD.assigned_user_ids, ARRAY[]::int4[]))); -- Only notify newly assigned users
            END IF;
        END IF;

    ELSIF TG_OP = 'DELETE' THEN
        event_data := to_jsonb(OLD);
        notification_payload := jsonb_build_object(
            'type', 'event_deleted',
            'event_id', OLD.id,
            'event_title', OLD.title,
            'event_date', OLD.event_date,
            'data', event_data
        );

        -- Create notifications for assigned users about the event deletion
        action_url := '/status/events?tab=ended&eventId=' || OLD.id;

        INSERT INTO notifications (user_id, category, type, title, message, payload)
        SELECT
            u.id,
            'event',
            'warning',
            'Event Deleted',
            format('Event "%s" scheduled for %s has been deleted',
                   OLD.title,
                   to_char(OLD.event_date AT TIME ZONE 'Asia/Manila', 'YYYY-MM-DD')),
            jsonb_build_object(
                'event_id', OLD.id,
                'event_title', OLD.title,
                'event_date', OLD.event_date,
                'start_time', OLD.start_time,
                'end_time', OLD.end_time,
                'location', OLD.location,
                'notification_type', 'event_deleted',
                'action_url', action_url
            )
        FROM users u
        WHERE (OLD.assigned_user_ids IS NOT NULL AND array_length(OLD.assigned_user_ids, 1) > 0 AND u.id = ANY(OLD.assigned_user_ids)); -- Only notify assigned users if there are any
    END IF;

    -- Send the notification for real-time updates
    PERFORM pg_notify('event_changes', notification_payload::text);

    -- Return the appropriate record
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$function$
;

-- DROP FUNCTION public.notify_event_status_change(int4, varchar, varchar);

CREATE OR REPLACE FUNCTION public.notify_event_status_change(event_id integer, old_status character varying, new_status character varying)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
    event_record RECORD;
    notification_payload JSONB;
    action_url TEXT;
BEGIN
    -- Get event details including assigned_user_ids
    SELECT 
        e.id,
        e.title,
        e.description,
        e.event_date,
        e.start_time,
        e.end_time,
        e.location,
        e.status,
        e.event_type,
        e.created_by,
        e.assigned_user_ids,
        u.email as created_by_name
    INTO event_record
    FROM events e
    LEFT JOIN users u ON e.created_by = u.id
    WHERE e.id = event_id;
    
    IF NOT FOUND THEN
        RETURN;
    END IF;
    
    -- Determine action URL based on new status
    CASE new_status
        WHEN 'upcoming' THEN
            action_url := '/status/events?tab=upcoming&eventId=' || event_record.id;
        WHEN 'today' THEN
            action_url := '/status/events?tab=today&eventId=' || event_record.id;
        WHEN 'cancelled' THEN
            action_url := '/status/events?tab=cancelled&eventId=' || event_record.id;
        WHEN 'ended' THEN
            action_url := '/status/events?tab=ended&eventId=' || event_record.id;
        ELSE
            action_url := '/status/events';
    END CASE;
    
    -- Build notification payload
    notification_payload := jsonb_build_object(
        'type', 'event_status_changed',
        'event_id', event_record.id,
        'event_title', event_record.title,
        'event_date', event_record.event_date,
        'start_time', event_record.start_time,
        'end_time', event_record.end_time,
        'location', event_record.location,
        'status', event_record.status,
        'event_type', COALESCE(event_record.event_type, 'event'),
        'old_status', old_status,
        'new_status', new_status,
        'created_by', event_record.created_by,
        'created_by_name', event_record.created_by_name,
        'notification_type', 'event_status_changed',
        'action_url', action_url
    );
    
    -- Create individual notification records for assigned users only
    IF event_record.assigned_user_ids IS NOT NULL THEN
        INSERT INTO notifications (user_id, category, type, title, message, payload)
        SELECT
            u.id,
            'event',
            CASE 
                WHEN new_status = 'cancelled' THEN 'warning'
                ELSE 'info'
            END,
            format('%s Status Changed',
                   CASE
                       WHEN COALESCE(event_record.event_type, 'event') = 'activity' THEN 'Activity'
                       ELSE 'Event'
                   END),
            format('%s "%s" status changed from %s to %s',
                   CASE
                       WHEN COALESCE(event_record.event_type, 'event') = 'activity' THEN 'Activity'
                       ELSE 'Event'
                   END,
                   event_record.title,
                   old_status,
                   new_status),
            jsonb_build_object(
                'event_id', event_record.id,
                'event_title', event_record.title,
                'event_date', event_record.event_date,
                'start_time', event_record.start_time,
                'end_time', event_record.end_time,
                'location', event_record.location,
                'event_type', COALESCE(event_record.event_type, 'event'),
                'old_status', old_status,
                'new_status', new_status,
                'created_by', event_record.created_by,
                'created_by_name', event_record.created_by_name,
                'notification_type', 'event_status_changed',
                'action_url', action_url
            )
        FROM users u
        WHERE u.id = ANY(event_record.assigned_user_ids);
    END IF;
    
    -- Send real-time notification
    PERFORM pg_notify('event_changes', notification_payload::text);
    
    -- Also send to event_attendance_changes channel for broader coverage
    PERFORM pg_notify('event_attendance_changes', notification_payload::text);
END;
$function$
;

-- DROP FUNCTION public.notify_health_check_event();

CREATE OR REPLACE FUNCTION public.notify_health_check_event()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    -- Notify when health check request is created
    IF TG_OP = 'INSERT' AND TG_TABLE_NAME = 'health_check_requests' THEN
        PERFORM pg_notify(
            'health_check_events',
            json_build_object(
                'event', 'request_created',
                'request_id', NEW.id,
                'user_id', NEW.user_id,
                'nurse_id', NEW.nurse_id,
                'status', NEW.status,
                'priority', NEW.priority,
                'complaint', NEW.complaint,
                'request_time', NEW.request_time
            )::text
        );
        
        -- Create notification for the user using existing notifications table
        INSERT INTO public.notifications (user_id, category, type, title, message, payload)
        VALUES (
            NEW.user_id,
            'health_check',
            'info',
            'Health Check Request Submitted',
            'Your health check request has been submitted and is pending approval.',
            json_build_object(
                'request_id', NEW.id,
                'status', NEW.status,
                'priority', NEW.priority,
                'event_type', 'request_created',
                'action_url', '/status/health'
            )
        );
        
        -- Create notification for nurses (if any are available) using existing notifications table
        INSERT INTO public.notifications (user_id, category, type, title, message, payload)
        SELECT 
            u.id,
            'health_check',
            'info',
            'New Health Check Request',
            'A new health check request requires attention.',
            json_build_object(
                'request_id', NEW.id,
                'requesting_user_id', NEW.user_id,
                'priority', NEW.priority,
                'event_type', 'request_created',
                'action_url', '/status/health'
            )
        FROM public.users u
        WHERE u.user_type = 'Internal' 
        AND u.id IN (
            SELECT DISTINCT nurse_id 
            FROM public.health_check_availability 
            WHERE is_available = TRUE
        );
        
        RETURN NEW;
    END IF;
    
    -- Notify when health check request status changes
    IF TG_OP = 'UPDATE' AND TG_TABLE_NAME = 'health_check_requests' THEN
        IF OLD.status != NEW.status THEN
            PERFORM pg_notify(
                'health_check_events',
                json_build_object(
                    'event', 'request_status_changed',
                    'request_id', NEW.id,
                    'user_id', NEW.user_id,
                    'nurse_id', NEW.nurse_id,
                    'old_status', OLD.status,
                    'new_status', NEW.status,
                    'updated_at', NEW.updated_at
                )::text
            );
            
            -- Create appropriate notification based on status change using existing notifications table
            IF NEW.status = 'approved' THEN
                INSERT INTO public.notifications (user_id, category, type, title, message, payload)
                VALUES (
                    NEW.user_id,
                    'health_check',
                    'success',
                    'Health Check Request Approved',
                    'Your health check request has been approved. Please proceed to the clinic.',
                    json_build_object(
                        'request_id', NEW.id,
                        'status', NEW.status,
                        'event_type', 'request_approved',
                        'action_url', '/status/health'
                    )
                );
            ELSIF NEW.status = 'rejected' THEN
                INSERT INTO public.notifications (user_id, category, type, title, message, payload)
                VALUES (
                    NEW.user_id,
                    'health_check',
                    'error',
                    'Health Check Request Rejected',
                    'Your health check request has been rejected. Please contact the nurse for more information.',
                    json_build_object(
                        'request_id', NEW.id,
                        'status', NEW.status,
                        'event_type', 'request_rejected',
                        'action_url', '/status/health'
                    )
                );
            ELSIF NEW.status = 'completed' THEN
                INSERT INTO public.notifications (user_id, category, type, title, message, payload)
                VALUES (
                    NEW.user_id,
                    'health_check',
                    'success',
                    'Health Check Completed',
                    'Your health check has been completed. Check your records for details.',
                    json_build_object(
                        'request_id', NEW.id,
                        'status', NEW.status,
                        'event_type', 'request_completed',
                        'action_url', '/status/health'
                    )
                );
            END IF;
        END IF;
        
        RETURN NEW;
    END IF;
    
    RETURN NEW;
END;
$function$
;

-- DROP FUNCTION public.notify_health_check_field_update(int4, text, bool);

CREATE OR REPLACE FUNCTION public.notify_health_check_field_update(request_id_param integer, field_name text, field_value boolean)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
    request_record RECORD;
BEGIN
    -- Get the request details including timestamps
    SELECT hcr.*, u.email as user_email
    INTO request_record
    FROM health_check_requests hcr
    JOIN users u ON hcr.user_id = u.id
    WHERE hcr.id = request_id_param;
    
    -- If request not found, return
    IF NOT FOUND THEN
        RETURN;
    END IF;
    
    -- Send optimized notification with user email and timestamps included
    PERFORM pg_notify(
        'health_check_events',
        json_build_object(
            'event', 'request_updated',
            'request_id', request_record.id,
            'user_id', request_record.user_id,
            'nurse_id', request_record.nurse_id,
            'user_email', request_record.user_email,
            field_name, field_value,
            'going_to_clinic_at', request_record.going_to_clinic_at,
            'in_clinic_at', request_record.in_clinic_at,
            'updated_at', request_record.updated_at
        )::text
    );
END;
$function$
;

-- DROP FUNCTION public.notify_meeting_end();

CREATE OR REPLACE FUNCTION public.notify_meeting_end()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
    payload JSON;
BEGIN
    -- Notify when meeting status changes to completed
    IF TG_OP = 'UPDATE' AND OLD.status != 'completed' AND NEW.status = 'completed' THEN
        
        payload := json_build_object(
            'meeting_id', NEW.id,
            'agent_user_id', NEW.agent_user_id,
            'is_in_meeting', false,
            'status', NEW.status,
            'title', NEW.title,
            'start_time', NEW.start_time,
            'end_time', NEW.end_time,
            'operation', 'meeting_ended',
            'timestamp', NOW()
        );
        
        -- Send notification
        PERFORM pg_notify('meeting_status_change', payload::text);
        PERFORM pg_notify('"meeting-update"', payload::text);
    END IF;
    
    RETURN NEW;
END;
$function$
;

-- DROP FUNCTION public.notify_meeting_status_change();

CREATE OR REPLACE FUNCTION public.notify_meeting_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
    payload JSON;
BEGIN
    -- Only notify if is_in_meeting status changed
    IF (TG_OP = 'UPDATE' AND OLD.is_in_meeting IS DISTINCT FROM NEW.is_in_meeting) OR
       (TG_OP = 'INSERT' AND NEW.is_in_meeting = true) THEN
        
        -- Create payload with meeting and user information
        payload := json_build_object(
            'meeting_id', NEW.id,
            'agent_user_id', NEW.agent_user_id,
            'is_in_meeting', NEW.is_in_meeting,
            'status', NEW.status,
            'title', NEW.title,
            'start_time', NEW.start_time,
            'end_time', NEW.end_time,
            'operation', TG_OP,
            'timestamp', NOW()
        );
        
        -- Send notification
        PERFORM pg_notify('meeting_status_change', payload::text);
        
        -- Also send a specific notification for meeting updates
        PERFORM pg_notify('"meeting-update"', payload::text);
    END IF;
    
    RETURN NEW;
END;
$function$
;

-- DROP FUNCTION public.notify_monthly_activity_change();

CREATE OR REPLACE FUNCTION public.notify_monthly_activity_change()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    -- Send notification with user_id and action type
    PERFORM pg_notify(
        'monthly_activity_change',
        json_build_object(
            'user_id', NEW.user_id,
            'action', CASE 
                WHEN TG_OP = 'INSERT' THEN 'inserted'
                WHEN TG_OP = 'UPDATE' THEN 'updated'
                WHEN TG_OP = 'DELETE' THEN 'deleted'
            END,
            'month_start_date', COALESCE(NEW.month_start_date, OLD.month_start_date),
            'month_end_date', COALESCE(NEW.month_end_date, OLD.month_end_date),
            'total_active_seconds', COALESCE(NEW.total_active_seconds, OLD.total_active_seconds),
            'total_inactive_seconds', COALESCE(NEW.total_inactive_seconds, OLD.total_inactive_seconds),
            'total_days_active', COALESCE(NEW.total_days_active, OLD.total_days_active),
            'timestamp', NOW()
        )::text
    );
    
    RETURN COALESCE(NEW, OLD);
END;
$function$
;

-- DROP FUNCTION public.notify_notification();

CREATE OR REPLACE FUNCTION public.notify_notification()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  PERFORM pg_notify(
    'notifications',
    json_build_object(
      'id', NEW.id,
      'user_id', NEW.user_id,
      'category', NEW.category,
      'type', NEW.type,
      'title', NEW.title,
      'message', NEW.message,
      'payload', COALESCE(NEW.payload, '{}'::jsonb),
      'created_at', NEW.created_at
    )::text
  );
  RETURN NEW;
END;
$function$
;

-- DROP FUNCTION public.notify_task_comment_change();

CREATE OR REPLACE FUNCTION public.notify_task_comment_change()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  actor_name TEXT;
  actor_email TEXT;
  payload JSON;
BEGIN
  -- Fetch author info
  SELECT COALESCE(pi.first_name || ' ' || pi.last_name, u.email), u.email
  INTO actor_name, actor_email
  FROM public.users u
  LEFT JOIN public.personal_info pi ON pi.user_id = u.id
  WHERE u.id = CASE WHEN TG_OP = 'DELETE' THEN OLD.user_id ELSE NEW.user_id END;

  payload := json_build_object(
    'event', lower(TG_OP),
    'comment_id', (CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END),
    'task_id', (CASE WHEN TG_OP = 'DELETE' THEN OLD.task_id ELSE NEW.task_id END),
    'user_id', (CASE WHEN TG_OP = 'DELETE' THEN OLD.user_id ELSE NEW.user_id END),
    'comment', (CASE WHEN TG_OP = 'DELETE' THEN OLD.content ELSE NEW.content END),
    'authorName', actor_name,
    'authorEmail', actor_email,
    'created_at', (CASE WHEN TG_OP = 'DELETE' THEN OLD.created_at ELSE NEW.created_at END),
    'updated_at', (CASE WHEN TG_OP = 'DELETE' THEN OLD.updated_at ELSE NEW.updated_at END),
    'time', (EXTRACT(EPOCH FROM NOW()) * 1000)::bigint
  );

  PERFORM pg_notify('task_comments', payload::text);
  RETURN NULL;
END;
$function$
;

-- DROP FUNCTION public.notify_task_due_soon();

CREATE OR REPLACE FUNCTION public.notify_task_due_soon()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
    due_ts timestamptz;
    now_ts timestamptz := now() AT TIME ZONE 'Asia/Manila';
    hours_diff numeric;
    overdue_group_id INTEGER;
    done_group_id INTEGER;
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        due_ts := NEW.due_date;
        IF due_ts IS NULL THEN
            RETURN NEW;
        END IF;
        
        -- Get the Overdue column ID (global for all users)
        SELECT id INTO overdue_group_id
        FROM task_groups 
        WHERE title = 'Overdue';
        
        -- Get the Done column ID (global for all users)
        SELECT id INTO done_group_id
        FROM task_groups 
        WHERE title = 'Done';
        
        -- Only send notification if task is NOT in Overdue column AND NOT in Done column
        IF (overdue_group_id IS NULL OR NEW.group_id != overdue_group_id) 
           AND (done_group_id IS NULL OR NEW.group_id != done_group_id) THEN
            -- Compute hours until due
            hours_diff := EXTRACT(EPOCH FROM (due_ts - now_ts)) / 3600.0;
            
            -- If due within next 24h and still active, create a warning notification
            IF hours_diff <= 24 AND hours_diff >= 0 AND NEW.status = 'active' THEN
                INSERT INTO public.notifications (user_id, category, type, title, message, payload)
                VALUES (
                    NEW.user_id,
                    'task',
                    'warning',
                    'Task due soon',
                    format('"%s" is due on %s', NEW.title, to_char(due_ts AT TIME ZONE 'Asia/Manila', 'YYYY-MM-DD HH24:MI')),
                    json_build_object('task_id', NEW.id, 'group_id', NEW.group_id, 'due_date', NEW.due_date, 'action_url', '/productivity/task-activity')
                );
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$function$
;

-- DROP FUNCTION public.notify_task_table_change();

CREATE OR REPLACE FUNCTION public.notify_task_table_change()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  payload JSON;
  channel TEXT;
BEGIN
  payload := json_build_object(
    'table', TG_TABLE_NAME,
    'action', TG_OP,
    'new', CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN row_to_json(NEW) ELSE NULL END,
    'old', CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN row_to_json(OLD) ELSE NULL END,
    'timestamp', now()
  );

  IF TG_TABLE_NAME = 'tasks' THEN
    channel := 'task_updates';
  ELSIF TG_TABLE_NAME = 'task_relations' THEN
    channel := 'task_relations';
  ELSIF TG_TABLE_NAME = 'task_groups' THEN
    channel := 'task_groups';
  ELSIF TG_TABLE_NAME = 'task_custom_fields' THEN
    channel := 'task_custom_fields';
  ELSIF TG_TABLE_NAME = 'task_attachments' THEN
    channel := 'task_attachments';
  ELSIF TG_TABLE_NAME = 'task_assignees' THEN
    channel := 'task_assignees';
  ELSE
    channel := 'task_updates';
  END IF;

  PERFORM pg_notify(channel, payload::text);
  RETURN NULL;
END;
$function$
;

-- DROP FUNCTION public.notify_ticket_change();

CREATE OR REPLACE FUNCTION public.notify_ticket_change()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  payload JSON;
  user_email TEXT;
  category_name TEXT;
BEGIN
  -- Get user email and category name for the ticket
  SELECT u.email, tc.name
  INTO user_email, category_name
  FROM users u
  LEFT JOIN ticket_categories tc ON tc.id = COALESCE(NEW.category_id, OLD.category_id)
  WHERE u.id = COALESCE(NEW.user_id, OLD.user_id);

  IF TG_OP = 'INSERT' THEN
    payload := json_build_object(
      'table', 'tickets',
      'action', 'INSERT',
      'record', json_build_object(
        'id', NEW.id,
        'ticket_id', NEW.ticket_id,
        'user_id', NEW.user_id,
        'concern', NEW.concern,
        'details', NEW.details,
        'status', NEW.status,
        'category_id', NEW.category_id,
        'position', NEW.position,
        'file_count', NEW.file_count,
        'supporting_files', NEW.supporting_files,
        'created_at', NEW.created_at,
        'updated_at', NEW.updated_at,
        'user_email', user_email,
        'category_name', category_name
      )
    );
  ELSIF TG_OP = 'UPDATE' THEN
    payload := json_build_object(
      'table', 'tickets',
      'action', 'UPDATE',
      'record', json_build_object(
        'id', NEW.id,
        'ticket_id', NEW.ticket_id,
        'user_id', NEW.user_id,
        'concern', NEW.concern,
        'details', NEW.details,
        'status', NEW.status,
        'category_id', NEW.category_id,
        'position', NEW.position,
        'file_count', NEW.file_count,
        'supporting_files', NEW.supporting_files,
        'created_at', NEW.created_at,
        'updated_at', NEW.updated_at,
        'user_email', user_email,
        'category_name', category_name
      ),
      'old_record', json_build_object(
        'id', OLD.id,
        'ticket_id', OLD.ticket_id,
        'user_id', OLD.user_id,
        'concern', OLD.concern,
        'details', OLD.details,
        'status', OLD.status,
        'category_id', OLD.category_id,
        'position', OLD.position,
        'file_count', OLD.file_count,
        'supporting_files', OLD.supporting_files,
        'created_at', OLD.created_at,
        'updated_at', OLD.updated_at
      )
    );
  ELSIF TG_OP = 'DELETE' THEN
    payload := json_build_object(
      'table', 'tickets',
      'action', 'DELETE',
      'old_record', json_build_object(
        'id', OLD.id,
        'ticket_id', OLD.ticket_id,
        'user_id', OLD.user_id,
        'concern', OLD.concern,
        'details', OLD.details,
        'status', OLD.status,
        'category_id', OLD.category_id,
        'position', OLD.position,
        'file_count', OLD.file_count,
        'supporting_files', OLD.supporting_files,
        'created_at', OLD.created_at,
        'updated_at', OLD.updated_at
      )
    );
  END IF;

  -- Send notification to ticket_changes channel
  PERFORM pg_notify('ticket_changes', payload::text);
  
  -- Return appropriate record
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$function$
;

-- DROP FUNCTION public.notify_ticket_comment_change();

CREATE OR REPLACE FUNCTION public.notify_ticket_comment_change()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  payload JSON;
  author_name TEXT;
  author_email TEXT;
BEGIN
  -- Get user information for the comment author
  SELECT 
    COALESCE(
      NULLIF(TRIM(COALESCE(pi.first_name,'') || ' ' || COALESCE(pi.last_name,'')), ''),
      u.email
    ) AS name,
    u.email
  INTO author_name, author_email
  FROM users u
  LEFT JOIN personal_info pi ON pi.user_id = u.id
  WHERE u.id = NEW.user_id;

  IF TG_OP = 'INSERT' THEN
    payload := json_build_object(
      'event', 'insert',
      'comment_id', NEW.id,
      'ticket_row_id', NEW.ticket_id,
      'user_id', NEW.user_id,
      'comment', NEW.comment,
      'created_at', to_char((NEW.created_at AT TIME ZONE 'Asia/Manila'), 'YYYY-MM-DD"T"HH24:MI:SS.MS') || '+08:00',
      'authorName', author_name,
      'authorEmail', author_email
    );
    
    -- Persist a notification for the ticket owner (but not for the commenter themself)
    INSERT INTO public.notifications (user_id, category, type, title, message, payload)
    SELECT t.user_id,
           'ticket'::text,
           'info'::text,
           'New comment on your ticket'::text,
           'IT replied to your ticket'::text,
           json_build_object(
             'ticket_id', t.ticket_id,
             'ticket_row_id', t.id,
             'comment_id', NEW.id,
             'action_url', concat('/forms/', t.ticket_id)
           )
    FROM tickets t
    WHERE t.id = NEW.ticket_id
      AND t.user_id <> NEW.user_id;
      
  ELSIF TG_OP = 'UPDATE' THEN
    payload := json_build_object(
      'event', 'update',
      'comment_id', NEW.id,
      'ticket_row_id', NEW.ticket_id,
      'user_id', NEW.user_id,
      'comment', NEW.comment,
      'updated_at', to_char((NEW.updated_at AT TIME ZONE 'Asia/Manila'), 'YYYY-MM-DD"T"HH24:MI:SS.MS') || '+08:00',
      'authorName', author_name,
      'authorEmail', author_email
    );
  ELSIF TG_OP = 'DELETE' THEN
    payload := json_build_object(
      'event', 'delete',
      'comment_id', OLD.id,
      'ticket_row_id', OLD.ticket_id,
      'user_id', OLD.user_id
    );
  END IF;

  PERFORM pg_notify('ticket_comments', payload::text);
  RETURN NULL;
END;
$function$
;

-- DROP FUNCTION public.notify_weekly_activity_change();

CREATE OR REPLACE FUNCTION public.notify_weekly_activity_change()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    -- Send notification with user_id and action type
    PERFORM pg_notify(
        'weekly_activity_change',
        json_build_object(
            'user_id', NEW.user_id,
            'action', CASE 
                WHEN TG_OP = 'INSERT' THEN 'inserted'
                WHEN TG_OP = 'UPDATE' THEN 'updated'
                WHEN TG_OP = 'DELETE' THEN 'deleted'
            END,
            'week_start_date', COALESCE(NEW.week_start_date, OLD.week_start_date),
            'week_end_date', COALESCE(NEW.week_end_date, OLD.week_end_date),
            'total_active_seconds', COALESCE(NEW.total_active_seconds, OLD.total_active_seconds),
            'total_inactive_seconds', COALESCE(NEW.total_inactive_seconds, OLD.total_inactive_seconds),
            'total_days_active', COALESCE(NEW.total_days_active, OLD.total_days_active),
            'timestamp', NOW()
        )::text
    );
    
    RETURN COALESCE(NEW, OLD);
END;
$function$
;

-- DROP FUNCTION public.pgp_armor_headers(in text, out text, out text);

CREATE OR REPLACE FUNCTION public.pgp_armor_headers(text, OUT key text, OUT value text)
 RETURNS SETOF record
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pgp_armor_headers$function$
;

-- DROP FUNCTION public.pgp_key_id(bytea);

CREATE OR REPLACE FUNCTION public.pgp_key_id(bytea)
 RETURNS text
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pgp_key_id_w$function$
;

-- DROP FUNCTION public.pgp_pub_decrypt(bytea, bytea, text);

CREATE OR REPLACE FUNCTION public.pgp_pub_decrypt(bytea, bytea, text)
 RETURNS text
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pgp_pub_decrypt_text$function$
;

-- DROP FUNCTION public.pgp_pub_decrypt(bytea, bytea);

CREATE OR REPLACE FUNCTION public.pgp_pub_decrypt(bytea, bytea)
 RETURNS text
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pgp_pub_decrypt_text$function$
;

-- DROP FUNCTION public.pgp_pub_decrypt(bytea, bytea, text, text);

CREATE OR REPLACE FUNCTION public.pgp_pub_decrypt(bytea, bytea, text, text)
 RETURNS text
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pgp_pub_decrypt_text$function$
;

-- DROP FUNCTION public.pgp_pub_decrypt_bytea(bytea, bytea, text, text);

CREATE OR REPLACE FUNCTION public.pgp_pub_decrypt_bytea(bytea, bytea, text, text)
 RETURNS bytea
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pgp_pub_decrypt_bytea$function$
;

-- DROP FUNCTION public.pgp_pub_decrypt_bytea(bytea, bytea, text);

CREATE OR REPLACE FUNCTION public.pgp_pub_decrypt_bytea(bytea, bytea, text)
 RETURNS bytea
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pgp_pub_decrypt_bytea$function$
;

-- DROP FUNCTION public.pgp_pub_decrypt_bytea(bytea, bytea);

CREATE OR REPLACE FUNCTION public.pgp_pub_decrypt_bytea(bytea, bytea)
 RETURNS bytea
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pgp_pub_decrypt_bytea$function$
;

-- DROP FUNCTION public.pgp_pub_encrypt(text, bytea, text);

CREATE OR REPLACE FUNCTION public.pgp_pub_encrypt(text, bytea, text)
 RETURNS bytea
 LANGUAGE c
 PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pgp_pub_encrypt_text$function$
;

-- DROP FUNCTION public.pgp_pub_encrypt(text, bytea);

CREATE OR REPLACE FUNCTION public.pgp_pub_encrypt(text, bytea)
 RETURNS bytea
 LANGUAGE c
 PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pgp_pub_encrypt_text$function$
;

-- DROP FUNCTION public.pgp_pub_encrypt_bytea(bytea, bytea);

CREATE OR REPLACE FUNCTION public.pgp_pub_encrypt_bytea(bytea, bytea)
 RETURNS bytea
 LANGUAGE c
 PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pgp_pub_encrypt_bytea$function$
;

-- DROP FUNCTION public.pgp_pub_encrypt_bytea(bytea, bytea, text);

CREATE OR REPLACE FUNCTION public.pgp_pub_encrypt_bytea(bytea, bytea, text)
 RETURNS bytea
 LANGUAGE c
 PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pgp_pub_encrypt_bytea$function$
;

-- DROP FUNCTION public.pgp_sym_decrypt(bytea, text);

CREATE OR REPLACE FUNCTION public.pgp_sym_decrypt(bytea, text)
 RETURNS text
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pgp_sym_decrypt_text$function$
;

-- DROP FUNCTION public.pgp_sym_decrypt(bytea, text, text);

CREATE OR REPLACE FUNCTION public.pgp_sym_decrypt(bytea, text, text)
 RETURNS text
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pgp_sym_decrypt_text$function$
;

-- DROP FUNCTION public.pgp_sym_decrypt_bytea(bytea, text);

CREATE OR REPLACE FUNCTION public.pgp_sym_decrypt_bytea(bytea, text)
 RETURNS bytea
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pgp_sym_decrypt_bytea$function$
;

-- DROP FUNCTION public.pgp_sym_decrypt_bytea(bytea, text, text);

CREATE OR REPLACE FUNCTION public.pgp_sym_decrypt_bytea(bytea, text, text)
 RETURNS bytea
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pgp_sym_decrypt_bytea$function$
;

-- DROP FUNCTION public.pgp_sym_encrypt(text, text);

CREATE OR REPLACE FUNCTION public.pgp_sym_encrypt(text, text)
 RETURNS bytea
 LANGUAGE c
 PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pgp_sym_encrypt_text$function$
;

-- DROP FUNCTION public.pgp_sym_encrypt(text, text, text);

CREATE OR REPLACE FUNCTION public.pgp_sym_encrypt(text, text, text)
 RETURNS bytea
 LANGUAGE c
 PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pgp_sym_encrypt_text$function$
;

-- DROP FUNCTION public.pgp_sym_encrypt_bytea(bytea, text);

CREATE OR REPLACE FUNCTION public.pgp_sym_encrypt_bytea(bytea, text)
 RETURNS bytea
 LANGUAGE c
 PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pgp_sym_encrypt_bytea$function$
;

-- DROP FUNCTION public.pgp_sym_encrypt_bytea(bytea, text, text);

CREATE OR REPLACE FUNCTION public.pgp_sym_encrypt_bytea(bytea, text, text)
 RETURNS bytea
 LANGUAGE c
 PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pgp_sym_encrypt_bytea$function$
;

-- DROP FUNCTION public.precreate_next_day_activity_rows(timestamp);

CREATE OR REPLACE FUNCTION public.precreate_next_day_activity_rows(p_check_time timestamp without time zone DEFAULT now())
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
DECLARE
    rec RECORD;
    created_count INTEGER := 0;
    manila_date DATE;
    next_date DATE;
    start_time_tok TEXT;
    end_time_tok TEXT;
    start_minutes INTEGER;
    end_minutes INTEGER;
    now_minutes INTEGER;
    shift_text TEXT;
    is_day_shift BOOLEAN;
    shift_has_both BOOLEAN;
BEGIN
    -- Convert to Manila time and get dates
    manila_date := (p_check_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Manila')::date;
    next_date := manila_date + INTERVAL '1 day';
    
    -- Get current time in Manila timezone, converted to minutes since midnight
    now_minutes := EXTRACT(HOUR FROM (p_check_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Manila')) * 60 + 
                   EXTRACT(MINUTE FROM (p_check_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Manila'));
    
    -- Loop through all agents
    FOR rec IN (
        SELECT u.id AS user_id, ji.shift_time
        FROM users u
        JOIN agents a ON a.user_id = u.id
        LEFT JOIN job_info ji ON ji.agent_user_id = u.id
        WHERE u.user_type = 'Agent'
    ) LOOP
        shift_text := COALESCE(rec.shift_time, '');
        shift_has_both := false;
        start_minutes := NULL; 
        end_minutes := NULL;

        -- Parse times like "6:00 AM - 1:36 PM"
        IF shift_text ~* '(\d{1,2}:\d{2}\s*(AM|PM)).*-\s*(\d{1,2}:\d{2}\s*(AM|PM))' THEN
            shift_has_both := true;
            start_time_tok := regexp_replace(shift_text, '^.*?(\d{1,2}:\d{2}\s*(AM|PM)).*$', '\1', 1, 0, 'i');
            end_time_tok := regexp_replace(shift_text, '^.*-\s*(\d{1,2}:\d{2}\s*(AM|PM)).*$', '\1', 1, 0, 'i');
        ELSE
            -- Skip if cannot parse
            CONTINUE;
        END IF;

        -- Convert start time to minutes
        IF start_time_tok IS NOT NULL THEN
            start_minutes := (
                CASE UPPER(split_part(start_time_tok, ' ', 2))
                    WHEN 'AM' THEN 
                        (CASE WHEN split_part(start_time_tok, ':', 1)::INT % 12 = 0 THEN 0 
                         ELSE split_part(start_time_tok, ':', 1)::INT END) * 60 + 
                        split_part(split_part(start_time_tok, ' ', 1), ':', 2)::INT
                    WHEN 'PM' THEN 
                        (CASE WHEN split_part(start_time_tok, ':', 1)::INT = 12 THEN 12 
                         ELSE split_part(start_time_tok, ':', 1)::INT + 12 END) * 60 + 
                        split_part(split_part(start_time_tok, ' ', 1), ':', 2)::INT
                END
            );
        END IF;
        
        -- Convert end time to minutes
        IF end_time_tok IS NOT NULL THEN
            end_minutes := (
                CASE UPPER(split_part(end_time_tok, ' ', 2))
                    WHEN 'AM' THEN 
                        (CASE WHEN split_part(end_time_tok, ':', 1)::INT % 12 = 0 THEN 0 
                         ELSE split_part(end_time_tok, ':', 1)::INT END) * 60 + 
                        split_part(split_part(end_time_tok, ' ', 1), ':', 2)::INT
                    WHEN 'PM' THEN 
                        (CASE WHEN split_part(end_time_tok, ':', 1)::INT = 12 THEN 12 
                         ELSE split_part(end_time_tok, ':', 1)::INT + 12 END) * 60 + 
                        split_part(split_part(end_time_tok, ' ', 1), ':', 2)::INT
                END
            );
        END IF;

        -- Skip if we couldn't parse the times
        IF start_minutes IS NULL OR end_minutes IS NULL THEN
            CONTINUE;
        END IF;

        -- Determine if this is a day shift (end > start) or night shift (end < start)
        is_day_shift := end_minutes > start_minutes;

        -- Check if shift has ended
        IF is_day_shift THEN
            -- Day shift: ended if current time >= end time
            IF now_minutes < end_minutes THEN
                CONTINUE; -- shift not yet ended
            END IF;
        ELSE
            -- Night shift: end is next day; ended if current time >= end time (past midnight)
            IF now_minutes < end_minutes THEN
                CONTINUE; -- shift not yet ended
            END IF;
        END IF;

        -- Check if row already exists for next day
        IF EXISTS (
            SELECT 1 FROM activity_data 
            WHERE user_id = rec.user_id AND today_date = next_date
        ) THEN
            CONTINUE; -- row already exists, skip
        END IF;

        -- Create new row for next day
        BEGIN
            INSERT INTO activity_data (
                user_id, 
                is_currently_active, 
                last_session_start, 
                today_date, 
                today_active_seconds, 
                today_inactive_seconds, 
                updated_at
            ) VALUES (
                rec.user_id, 
                FALSE, 
                NULL, 
                next_date::text, 
                0, 
                0, 
                p_check_time
            );
            
            -- If we get here, the insert was successful
            created_count := created_count + 1;
            
        EXCEPTION WHEN OTHERS THEN
            -- Log error and continue with next user
            RAISE WARNING 'Error creating row for user %: %', rec.user_id, SQLERRM;
            CONTINUE;
        END;
    END LOOP;

    RETURN created_count;
END;
$function$
;

-- DROP FUNCTION public.precreate_next_day_activity_rows_debug(timestamp);

CREATE OR REPLACE FUNCTION public.precreate_next_day_activity_rows_debug(p_check_time timestamp without time zone DEFAULT now())
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
DECLARE
    rec RECORD;
    created_count INTEGER := 0;
    manila_date DATE;
    next_date DATE;
    start_time_tok TEXT;
    end_time_tok TEXT;
    start_minutes INTEGER;
    end_minutes INTEGER;
    now_minutes INTEGER;
    shift_text TEXT;
    is_day_shift BOOLEAN;
    shift_has_both BOOLEAN;
    debug_info TEXT;
BEGIN
    -- Convert to Manila time and get dates
    manila_date := (p_check_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Manila')::date;
    next_date := manila_date + INTERVAL '1 day';
    
    RAISE NOTICE 'DEBUG: manila_date = %, next_date = %', manila_date, next_date;
    
    -- Get current time in Manila timezone, converted to minutes since midnight
    now_minutes := EXTRACT(HOUR FROM (p_check_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Manila')) * 60 + 
                   EXTRACT(MINUTE FROM (p_check_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Manila'));
    
    RAISE NOTICE 'DEBUG: now_minutes = %', now_minutes;
    
    -- Loop through all agents
    FOR rec IN (
        SELECT u.id AS user_id, ji.shift_time
        FROM users u
        JOIN agents a ON a.user_id = u.id
        LEFT JOIN job_info ji ON ji.agent_user_id = u.id
        WHERE u.user_type = 'Agent'
    ) LOOP
        RAISE NOTICE 'DEBUG: Processing user_id = %, shift_time = %', rec.user_id, rec.shift_time;
        
        shift_text := COALESCE(rec.shift_time, '');
        shift_has_both := false;
        start_minutes := NULL; 
        end_minutes := NULL;

        -- Parse times like "6:00 AM - 1:36 PM"
        IF shift_text ~* '(\d{1,2}:\d{2}\s*(AM|PM)).*-\s*(\d{1,2}:\d{2}\s*(AM|PM))' THEN
            shift_has_both := true;
            start_time_tok := regexp_replace(shift_text, '^.*?(\d{1,2}:\d{2}\s*(AM|PM)).*$', '\1', 1, 0, 'i');
            end_time_tok := regexp_replace(shift_text, '^.*-\s*(\d{1,2}:\d{2}\s*(AM|PM)).*$', '\1', 1, 0, 'i');
            RAISE NOTICE 'DEBUG: Parsed start_time_tok = %, end_time_tok = %', start_time_tok, end_time_tok;
        ELSE
            RAISE NOTICE 'DEBUG: Could not parse shift_text = %', shift_text;
            CONTINUE;
        END IF;

        -- Convert start time to minutes
        IF start_time_tok IS NOT NULL THEN
            start_minutes := (
                CASE UPPER(split_part(start_time_tok, ' ', 2))
                    WHEN 'AM' THEN 
                        (CASE WHEN split_part(start_time_tok, ':', 1)::INT % 12 = 0 THEN 0 
                         ELSE split_part(start_time_tok, ':', 1)::INT END) * 60 + 
                        split_part(split_part(start_time_tok, ' ', 1), ':', 2)::INT
                    WHEN 'PM' THEN 
                        (CASE WHEN split_part(start_time_tok, ':', 1)::INT = 12 THEN 12 
                         ELSE split_part(start_time_tok, ':', 1)::INT + 12 END) * 60 + 
                        split_part(split_part(start_time_tok, ' ', 1), ':', 2)::INT
                END
            );
            RAISE NOTICE 'DEBUG: start_minutes = %', start_minutes;
        END IF;
        
        -- Convert end time to minutes
        IF end_time_tok IS NOT NULL THEN
            end_minutes := (
                CASE UPPER(split_part(end_time_tok, ' ', 2))
                    WHEN 'AM' THEN 
                        (CASE WHEN split_part(end_time_tok, ':', 1)::INT % 12 = 0 THEN 0 
                         ELSE split_part(end_time_tok, ':', 1)::INT END) * 60 + 
                        split_part(split_part(end_time_tok, ' ', 1), ':', 2)::INT
                    WHEN 'PM' THEN 
                        (CASE WHEN split_part(end_time_tok, ':', 1)::INT = 12 THEN 12 
                         ELSE split_part(end_time_tok, ':', 1)::INT + 12 END) * 60 + 
                        split_part(split_part(end_time_tok, ' ', 1), ':', 2)::INT
                END
            );
            RAISE NOTICE 'DEBUG: end_minutes = %', end_minutes;
        END IF;

        -- Skip if we couldn't parse the times
        IF start_minutes IS NULL OR end_minutes IS NULL THEN
            RAISE NOTICE 'DEBUG: Skipping - could not parse times';
            CONTINUE;
        END IF;

        -- Determine if this is a day shift (end > start) or night shift (end < start)
        is_day_shift := end_minutes > start_minutes;
        RAISE NOTICE 'DEBUG: is_day_shift = %', is_day_shift;

        -- Check if shift has ended
        IF is_day_shift THEN
            -- Day shift: ended if current time >= end time
            IF now_minutes < end_minutes THEN
                RAISE NOTICE 'DEBUG: Day shift not yet ended - now_minutes (%) < end_minutes (%)', now_minutes, end_minutes;
                CONTINUE; -- shift not yet ended
            ELSE
                RAISE NOTICE 'DEBUG: Day shift has ended - now_minutes (%) >= end_minutes (%)', now_minutes, end_minutes;
            END IF;
        ELSE
            -- Night shift: end is next day; ended if current time >= end time (past midnight)
            IF now_minutes < end_minutes THEN
                RAISE NOTICE 'DEBUG: Night shift not yet ended - now_minutes (%) < end_minutes (%)', now_minutes, end_minutes;
                CONTINUE; -- shift not yet ended
            ELSE
                RAISE NOTICE 'DEBUG: Night shift has ended - now_minutes (%) >= end_minutes (%)', now_minutes, end_minutes;
            END IF;
        END IF;

        -- Check if row already exists for next day
        IF EXISTS (
            SELECT 1 FROM activity_data 
            WHERE user_id = rec.user_id AND today_date = next_date
        ) THEN
            RAISE NOTICE 'DEBUG: Row already exists for user % on date % - skipping', rec.user_id, next_date;
            CONTINUE; -- row already exists, skip
        ELSE
            RAISE NOTICE 'DEBUG: No existing row found for user % on date % - will create', rec.user_id, next_date;
        END IF;

        -- Create new row for next day
        BEGIN
            RAISE NOTICE 'DEBUG: Attempting to INSERT for user % on date %', rec.user_id, next_date;
            
            INSERT INTO activity_data (
                user_id, 
                is_currently_active, 
                last_session_start, 
                today_date, 
                today_active_seconds, 
                today_inactive_seconds, 
                updated_at
            ) VALUES (
                rec.user_id, 
                FALSE, 
                NULL, 
                next_date::text, 
                0, 
                0, 
                p_check_time
            );
            
            -- If we get here, the insert was successful
            created_count := created_count + 1;
            RAISE NOTICE 'DEBUG: SUCCESS! Inserted row for user % on date %. Total created: %', rec.user_id, next_date, created_count;
            
        EXCEPTION WHEN OTHERS THEN
            -- Log error and continue with next user
            RAISE WARNING 'DEBUG: Error creating row for user %: %', rec.user_id, SQLERRM;
            CONTINUE;
        END;
    END LOOP;

    RAISE NOTICE 'DEBUG: Function completed. Total rows created: %', created_count;
    RETURN created_count;
END;
$function$
;

-- DROP FUNCTION public.process_productivity_updates();

CREATE OR REPLACE FUNCTION public.process_productivity_updates()
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
    notification_data JSONB;
    user_id_val INTEGER;
    month_year_val VARCHAR(7);
BEGIN
    -- This function will be called by a background process or scheduled job
    -- to process the queued productivity updates
    
    -- For now, we'll just log that it's available
    RAISE LOG 'Productivity update processor is available for background processing';
END;
$function$
;

-- DROP FUNCTION public.reorder_task_position(int4, int4, int4);

CREATE OR REPLACE FUNCTION public.reorder_task_position(task_id_param integer, new_position_param integer, group_id_param integer)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
    current_position INTEGER;
    temp_position INTEGER;
BEGIN
    -- Get current position of the task
    SELECT position INTO current_position
    FROM tasks
    WHERE id = task_id_param AND group_id = group_id_param AND status = 'active';
    
    -- If task not found or same position, do nothing
    IF current_position IS NULL OR current_position = new_position_param THEN
        RETURN;
    END IF;
    
    -- Use a temporary position to avoid conflicts
    temp_position := 999999;
    
    -- Move the target task to temporary position
    UPDATE tasks 
    SET position = temp_position, updated_at = NOW() AT TIME ZONE 'Asia/Manila'
    WHERE id = task_id_param;
    
    -- Shift other tasks
    IF current_position < new_position_param THEN
        -- Moving down: shift tasks between current and new position up by 1
        UPDATE tasks 
        SET position = position - 1, updated_at = NOW() AT TIME ZONE 'Asia/Manila'
        WHERE group_id = group_id_param 
          AND status = 'active' 
          AND position > current_position 
          AND position <= new_position_param;
    ELSE
        -- Moving up: shift tasks between new and current position down by 1
        UPDATE tasks 
        SET position = position + 1, updated_at = NOW() AT TIME ZONE 'Asia/Manila'
        WHERE group_id = group_id_param 
          AND status = 'active' 
          AND position >= new_position_param 
          AND position < current_position;
    END IF;
    
    -- Move the target task to its new position
    UPDATE tasks 
    SET position = new_position_param, updated_at = NOW() AT TIME ZONE 'Asia/Manila'
    WHERE id = task_id_param;
END;
$function$
;

-- DROP FUNCTION public.reset_daily_breaks();

CREATE OR REPLACE FUNCTION public.reset_daily_breaks()
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
			DECLARE
				reset_count INTEGER := 0;
			BEGIN
				-- This function doesn't delete data, it just ensures that break usage
				-- is calculated based on today's date only
				
				-- Count how many agents would be affected (for logging purposes)
				SELECT COUNT(DISTINCT agent_user_id) 
				INTO reset_count
				FROM public.break_sessions 
				WHERE break_date = (NOW() AT TIME ZONE 'Asia/Manila')::date;
				
				-- The reset is implicit - break availability is checked by querying
				-- only today's break_sessions records
				
				RETURN reset_count;
			END;
			$function$
;

-- DROP FUNCTION public.send_event_reminders();

CREATE OR REPLACE FUNCTION public.send_event_reminders()
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
DECLARE
    event_record RECORD;
    reminder_time TIMESTAMP;
    now_time TIMESTAMP;
    notifications_sent INTEGER := 0;
    user_count INTEGER;
BEGIN
    -- Get current time in Asia/Manila timezone
    now_time := NOW() AT TIME ZONE 'Asia/Manila';
    reminder_time := now_time + INTERVAL '15 minutes';
    
    -- Find events that start in approximately 15 minutes and are still upcoming
    FOR event_record IN
        SELECT 
            e.id,
            e.title,
            e.event_date,
            e.start_time,
            e.end_time,
            e.location,
            e.status,
            e.event_type,
            e.created_by,
            u.email as created_by_name
        FROM events e
        LEFT JOIN users u ON e.created_by = u.id
        WHERE e.status IN ('upcoming', 'today')
        AND e.event_date = CURRENT_DATE
        AND e.start_time::TIME >= (reminder_time::TIME - INTERVAL '2 minutes')::TIME
        AND e.start_time::TIME <= (reminder_time::TIME + INTERVAL '2 minutes')::TIME
    LOOP
        -- Check if we already sent a reminder for this event today
        IF NOT EXISTS (
            SELECT 1 FROM notifications 
            WHERE payload->>'event_id' = event_record.id::text
            AND payload->>'notification_type' = 'event_reminder'
            AND created_at::date = CURRENT_DATE
        ) THEN
            -- Send reminder notification to all users
            WITH inserted_notifications AS (
                INSERT INTO notifications (user_id, category, type, title, message, payload)
                SELECT 
                    u.id,
                    'event',
                    'info',
                    format('%s Reminder - Starting Soon', 
                           CASE 
                               WHEN COALESCE(event_record.event_type, 'event') = 'activity' THEN 'Activity'
                               ELSE 'Event'
                           END),
                format('%s "%s" will start in 15 minutes at %s (%s)', 
                       CASE 
                           WHEN COALESCE(event_record.event_type, 'event') = 'activity' THEN 'Activity'
                           ELSE 'Event'
                       END,
                       event_record.title, 
                       to_char(event_record.start_time::TIME, 'HH12:MI AM'),
                       event_record.location),
                    jsonb_build_object(
                        'event_id', event_record.id,
                        'event_title', event_record.title,
                        'event_date', event_record.event_date,
                        'start_time', event_record.start_time,
                        'end_time', event_record.end_time,
                        'location', event_record.location,
                        'status', event_record.status,
                        'event_type', COALESCE(event_record.event_type, 'event'),
                        'created_by', event_record.created_by,
                        'created_by_name', event_record.created_by_name,
                        'notification_type', 'event_reminder',
                        'action_url', '/status/events?tab=today&eventId=' || event_record.id
                    )
                FROM users u
                RETURNING 1
            )
            SELECT COUNT(*) INTO user_count FROM inserted_notifications;
            notifications_sent := notifications_sent + user_count;
        END IF;
    END LOOP;
    
    RETURN notifications_sent;
END;
$function$
;

-- DROP FUNCTION public.send_meeting_reminder_notification();

CREATE OR REPLACE FUNCTION public.send_meeting_reminder_notification()
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
DECLARE
    notifications_sent INTEGER := 0;
    meeting_record RECORD;
BEGIN
    -- Find meetings that are scheduled to start in 15 minutes
    -- and haven't had a reminder notification sent yet
    FOR meeting_record IN
        SELECT m.id, m.agent_user_id, m.title, m.start_time, u.email
        FROM meetings m
        JOIN users u ON u.id = m.agent_user_id
        WHERE m.status = 'scheduled'
        AND m.start_time BETWEEN NOW() + INTERVAL '14 minutes' AND NOW() + INTERVAL '16 minutes'
        AND NOT EXISTS (
            SELECT 1 FROM notifications n 
            WHERE n.user_id = m.agent_user_id 
            AND n.category = 'meeting'
            AND n.payload->>'meeting_id' = m.id::text
            AND n.payload->>'notification_type' = 'reminder'
        )
    LOOP
        
        -- Insert notification
        INSERT INTO notifications (
            user_id,
            category,
            type,
            title,
            message,
            payload,
            is_read,
            created_at
        ) VALUES (
            meeting_record.agent_user_id,
            'meeting',
            'info',
            'Meeting Starting Soon',
            'Your meeting "' || meeting_record.title || '" is starting in 15 minutes at ' || 
            TO_CHAR(meeting_record.start_time, 'HH12:MI AM'),
            json_build_object(
                'meeting_id', meeting_record.id,
                'meeting_title', meeting_record.title,
                'start_time', meeting_record.start_time,
                'notification_type', 'reminder',
                'action_url', '/status/meetings'
            ),
            false,
            NOW()
        );
        
        notifications_sent := notifications_sent + 1;
        
        -- Send PostgreSQL notification for real-time updates
        PERFORM pg_notify('notification_created', json_build_object(
            'user_id', meeting_record.agent_user_id,
            'category', 'meeting',
            'type', 'reminder'
        )::text);
        
        RAISE NOTICE 'Sent reminder notification for meeting % to user %', meeting_record.title, meeting_record.email;
    END LOOP;
    
    RETURN notifications_sent;
END;
$function$
;

-- DROP FUNCTION public.send_meeting_start_notification();

CREATE OR REPLACE FUNCTION public.send_meeting_start_notification()
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
DECLARE
    notifications_sent INTEGER := 0;
    meeting_record RECORD;
BEGIN
    -- Find meetings that just started automatically (within the last 2 minutes)
    -- and haven't had a start notification sent yet
    FOR meeting_record IN
        SELECT m.id, m.agent_user_id, m.title, m.start_time, u.email
        FROM meetings m
        JOIN users u ON u.id = m.agent_user_id
        WHERE m.status = 'in-progress'
        AND m.started_automatically = true  -- Only send notifications for automatically started meetings
        AND m.start_time BETWEEN NOW() - INTERVAL '2 minutes' AND NOW()
        AND NOT EXISTS (
            SELECT 1 FROM notifications n 
            WHERE n.user_id = m.agent_user_id 
            AND n.category = 'meeting'
            AND n.payload->>'meeting_id' = m.id::text
            AND n.payload->>'notification_type' = 'start'
        )
    LOOP
        
        -- Insert notification
        INSERT INTO notifications (
            user_id,
            category,
            type,
            title,
            message,
            payload,
            is_read,
            created_at
        ) VALUES (
            meeting_record.agent_user_id,
            'meeting',
            'success',
            'Meeting Started Automatically',
            'Your scheduled meeting "' || meeting_record.title || '" has started automatically',
            json_build_object(
                'meeting_id', meeting_record.id,
                'meeting_title', meeting_record.title,
                'start_time', meeting_record.start_time,
                'notification_type', 'start',
                'started_automatically', true,
                'action_url', '/status/meetings'
            ),
            false,
            NOW()
        );
        
        notifications_sent := notifications_sent + 1;
        
        -- Send PostgreSQL notification for real-time updates
        PERFORM pg_notify('notification_created', json_build_object(
            'user_id', meeting_record.agent_user_id,
            'category', 'meeting',
            'type', 'start'
        )::text);
        
        RAISE NOTICE 'Sent start notification for automatically started meeting % to user %', meeting_record.title, meeting_record.email;
    END LOOP;
    
    RETURN notifications_sent;
END;
$function$
;

-- DROP FUNCTION public.should_reset_activity_for_shift(int4, timestamp);

CREATE OR REPLACE FUNCTION public.should_reset_activity_for_shift(p_user_id integer, p_current_time timestamp without time zone DEFAULT NULL::timestamp without time zone)
 RETURNS boolean
 LANGUAGE plpgsql
AS $function$
      DECLARE
          shift_info RECORD;
          current_time_manila TIMESTAMP;
          shift_start_time TIME;
          shift_end_time TIME;
          is_night_shift BOOLEAN;
          current_time_only TIME;
          last_activity_date DATE;
          current_activity_date DATE;
          should_reset BOOLEAN := FALSE;
      BEGIN
          -- Get current Manila time
          IF p_current_time IS NULL THEN
              current_time_manila := CURRENT_TIMESTAMP + INTERVAL '8 hours';
          ELSE
              current_time_manila := p_current_time + INTERVAL '8 hours';
          END IF;
          
          current_time_only := current_time_manila::TIME;
          
          -- Get agent's shift information
          SELECT * INTO shift_info FROM get_agent_shift_info(p_user_id) LIMIT 1;
          
          IF NOT FOUND OR shift_info.shift_time IS NULL THEN
              -- No shift configured, reset daily
              RETURN TRUE;
          END IF;
          
          -- Parse shift time
          shift_start_time := CASE 
              WHEN split_part(shift_info.shift_time, ' - ', 1) LIKE '%PM' AND 
                   NOT split_part(shift_info.shift_time, ' - ', 1) LIKE '12:%PM' THEN
                  (split_part(split_part(shift_info.shift_time, ' - ', 1), ' ', 1)::TIME + INTERVAL '12 hours')::TIME
              WHEN split_part(shift_info.shift_time, ' - ', 1) LIKE '12:%AM' THEN
                  replace(split_part(shift_info.shift_time, ' - ', 1), '12:', '00:')::TIME
              ELSE
                  split_part(split_part(shift_info.shift_time, ' - ', 1), ' ', 1)::TIME
          END;
          
          shift_end_time := CASE 
              WHEN split_part(shift_info.shift_time, ' - ', 2) LIKE '%PM' AND 
                   NOT split_part(shift_info.shift_time, ' - ', 2) LIKE '12:%PM' THEN
                  (split_part(split_part(shift_info.shift_time, ' - ', 2), ' ', 1)::TIME + INTERVAL '12 hours')::TIME
              WHEN split_part(shift_info.shift_time, ' - ', 2) LIKE '12:%PM' THEN
                  (split_part(split_part(shift_info.shift_time, ' - ', 2), ' ', 1)::TIME + INTERVAL '12 hours')::TIME
              ELSE
                  split_part(split_part(shift_info.shift_time, ' - ', 2), ' ', 1)::TIME
          END;
          
          -- Determine if it's a night shift
          is_night_shift := shift_start_time > shift_end_time;
          
          -- Get the last activity date for this user
          SELECT MAX(today_date) INTO last_activity_date
          FROM activity_data
          WHERE user_id = p_user_id;
          
          -- Get the current activity date for this shift
          current_activity_date := get_activity_date_for_shift(p_user_id, p_current_time);
          
          IF last_activity_date IS NULL THEN
              -- No previous activity, this is a new shift
              RETURN TRUE;
          END IF;
          
          IF is_night_shift THEN
              -- NIGHT SHIFT LOGIC: Only reset when we start a completely new night shift
              -- A night shift continues until the end time (7 AM), then resets at the next start time (10 PM)
              
              -- Check if we've moved to a new night shift period
              -- This happens when we're at or past the shift start time AND the last activity was from a different date
              IF current_time_only >= shift_start_time AND last_activity_date != current_activity_date THEN
                  should_reset := TRUE;
              END IF;
              
              -- Also reset if we're starting a new day and it's been more than 2 hours since last activity
              -- This handles cases where the user logs in after a long break
              IF last_activity_date != current_activity_date THEN
                  DECLARE
                      last_activity_time TIMESTAMP;
                      hours_since_last_activity NUMERIC;
                  BEGIN
                      SELECT MAX(updated_at) INTO last_activity_time
                      FROM activity_data
                      WHERE user_id = p_user_id AND today_date = last_activity_date;
                      
                      IF last_activity_time IS NOT NULL THEN
                          hours_since_last_activity := EXTRACT(EPOCH FROM (current_time_manila - last_activity_time)) / 3600;
                          IF hours_since_last_activity > 2 THEN
                              should_reset := TRUE;
                          END IF;
                      END IF;
                  END;
              END IF;
          ELSE
              -- DAY SHIFT LOGIC: Reset daily at shift start time
              IF last_activity_date != current_activity_date THEN
                  should_reset := TRUE;
              END IF;
          END IF;
          
          RETURN should_reset;
      END;
      $function$
;

-- DROP FUNCTION public.should_reset_activity_simple(int4);

CREATE OR REPLACE FUNCTION public.should_reset_activity_simple(p_user_id integer)
 RETURNS boolean
 LANGUAGE plpgsql
AS $function$
  DECLARE
    current_activity_date DATE;
    last_activity_date DATE;
  BEGIN
    current_activity_date := get_activity_date_for_shift_simple(p_user_id);
    SELECT MAX(today_date) INTO last_activity_date FROM activity_data WHERE user_id=p_user_id;
    IF last_activity_date IS NULL THEN
      RETURN TRUE;
    END IF;
    RETURN last_activity_date <> current_activity_date;
  END; $function$
;

-- DROP FUNCTION public.should_reset_agent_breaks(int4);

CREATE OR REPLACE FUNCTION public.should_reset_agent_breaks(p_agent_user_id integer)
 RETURNS boolean
 LANGUAGE plpgsql
AS $function$
DECLARE
    last_reset_date DATE;
    current_local_date DATE;
BEGIN
    -- Get current date in Philippines timezone
    current_local_date := (NOW() AT TIME ZONE 'Asia/Manila')::date;
    
    -- Get the latest break_date for this agent
    SELECT MAX(break_date) INTO last_reset_date
    FROM break_sessions
    WHERE agent_user_id = p_agent_user_id;
    
    -- If no breaks exist or last break was before today, reset is needed
    RETURN (last_reset_date IS NULL OR last_reset_date < current_local_date);
END;
$function$
;

-- DROP FUNCTION public.start_meeting(int4, int4, bool);

CREATE OR REPLACE FUNCTION public.start_meeting(meeting_id_param integer, agent_user_id_param integer, is_automatic boolean DEFAULT false)
 RETURNS json
 LANGUAGE plpgsql
AS $function$
DECLARE
    meeting_record RECORD;
    activity_check RECORD;
    result JSON;
BEGIN
    -- Check if meeting exists and belongs to the agent
    SELECT * INTO meeting_record
    FROM meetings
    WHERE id = meeting_id_param AND agent_user_id = agent_user_id_param;
    
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'message', 'Meeting not found');
    END IF;
    
    -- Check if meeting is already in progress
    IF meeting_record.is_in_meeting THEN
        RETURN json_build_object('success', false, 'message', 'Meeting is already in progress');
    END IF;
    
    -- Check if user is currently in an activity/event
    SELECT ea.is_going, e.title as event_title, e.event_type
    INTO activity_check
    FROM event_attendance ea
    JOIN events e ON ea.event_id = e.id
    WHERE ea.user_id = agent_user_id_param 
    AND ea.is_going = true 
    AND ea.is_back = false
    AND e.status NOT IN ('cancelled', 'ended');
    
    IF FOUND THEN
        -- User is currently in an activity/event, prevent meeting start
        RETURN json_build_object(
            'success', false, 
            'message', 'Cannot start meeting while in ' || LOWER(activity_check.event_type) || ': ' || activity_check.event_title || '. Please leave the ' || LOWER(activity_check.event_type) || ' first.'
        );
    END IF;
    
    -- Check if meeting is scheduled and it's time to start
    IF meeting_record.status = 'scheduled' THEN
        -- For automatic starts, allow starting if current time is at or after scheduled start time
        -- For manual starts, allow starting if current time is at or after scheduled start time (with grace period)
        IF is_automatic THEN
            -- Automatic starts: must be at or after scheduled time
            IF NOW() < meeting_record.start_time THEN
                RETURN json_build_object('success', false, 'message', 'Meeting is scheduled for a future time');
            END IF;
        ELSE
            -- Manual starts: allow starting up to 10 minutes before scheduled time
            IF NOW() < (meeting_record.start_time - INTERVAL '10 minutes') THEN
                RETURN json_build_object('success', false, 'message', 'Meeting is scheduled for a future time');
            END IF;
        END IF;
    END IF;
    
    -- Start the meeting and update start_time to actual start time for accurate duration calculation
    UPDATE meetings
    SET 
        status = 'in-progress',
        is_in_meeting = true,
        started_automatically = is_automatic,
        start_time = NOW()  -- Always use actual start time for accurate elapsed time calculation
    WHERE id = meeting_id_param;
    
    -- Get updated meeting record
    SELECT * INTO meeting_record
    FROM meetings
    WHERE id = meeting_id_param;
    
    -- Build result
    result := json_build_object(
        'success', true,
        'message', 'Meeting started successfully',
        'meeting', row_to_json(meeting_record)
    );
    
    RETURN result;
END;
$function$
;

-- DROP FUNCTION public.trigger_break_availability_check();

CREATE OR REPLACE FUNCTION public.trigger_break_availability_check()
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
    PERFORM check_break_availability();
END;
$function$
;

-- DROP FUNCTION public.trigger_health_check_field_update();

CREATE OR REPLACE FUNCTION public.trigger_health_check_field_update()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    -- Only trigger on specific field changes
    IF TG_OP = 'UPDATE' AND TG_TABLE_NAME = 'health_check_requests' THEN
        -- Check if going_to_clinic field changed to true
        IF OLD.going_to_clinic IS DISTINCT FROM NEW.going_to_clinic AND NEW.going_to_clinic = true THEN
            -- Set timestamp when going_to_clinic becomes true
            NEW.going_to_clinic_at = NOW();
            PERFORM notify_health_check_field_update(NEW.id, 'going_to_clinic', NEW.going_to_clinic);
        ELSIF OLD.going_to_clinic IS DISTINCT FROM NEW.going_to_clinic THEN
            PERFORM notify_health_check_field_update(NEW.id, 'going_to_clinic', NEW.going_to_clinic);
        END IF;
        
        -- Check if in_clinic field changed to true
        IF OLD.in_clinic IS DISTINCT FROM NEW.in_clinic AND NEW.in_clinic = true THEN
            -- Set timestamp when in_clinic becomes true
            NEW.in_clinic_at = NOW();
            -- Automatically set going_to_clinic to false when in_clinic becomes true
            NEW.going_to_clinic = false;
            PERFORM notify_health_check_field_update(NEW.id, 'in_clinic', NEW.in_clinic);
            PERFORM notify_health_check_field_update(NEW.id, 'going_to_clinic', false);
        ELSIF OLD.in_clinic IS DISTINCT FROM NEW.in_clinic THEN
            PERFORM notify_health_check_field_update(NEW.id, 'in_clinic', NEW.in_clinic);
        END IF;
        
        -- Check if done field changed to true
        IF OLD.done IS DISTINCT FROM NEW.done AND NEW.done = true THEN
            -- Automatically set in_clinic to false when done becomes true
            NEW.in_clinic = false;
            PERFORM notify_health_check_field_update(NEW.id, 'done', NEW.done);
            PERFORM notify_health_check_field_update(NEW.id, 'in_clinic', false);
        ELSIF OLD.done IS DISTINCT FROM NEW.done THEN
            PERFORM notify_health_check_field_update(NEW.id, 'done', NEW.done);
        END IF;
    END IF;
    
    RETURN NEW;
END;
$function$
;

-- DROP FUNCTION public.trigger_manual_aggregation(int4, date);

CREATE OR REPLACE FUNCTION public.trigger_manual_aggregation(p_user_id integer DEFAULT NULL::integer, p_date date DEFAULT ((now() AT TIME ZONE 'Asia/Manila'::text))::date)
 RETURNS text
 LANGUAGE plpgsql
AS $function$
DECLARE
    week_start DATE;
    month_start DATE;
    result_text TEXT;
BEGIN
    -- Get week and month start dates
    SELECT get_week_start_date(p_date) INTO week_start;
    SELECT get_month_start_date(p_date) INTO month_start;
    
    -- Aggregate data
    PERFORM aggregate_weekly_activity(week_start);
    PERFORM aggregate_monthly_activity(month_start);
    
    -- Build result message
    result_text := format('Manual aggregation completed for date %s (week: %s, month: %s)', 
                         p_date, week_start, month_start);
    
    IF p_user_id IS NOT NULL THEN
        result_text := result_text || format(' for user %s', p_user_id);
    END IF;
    
    RETURN result_text;
END;
$function$
;

-- DROP FUNCTION public.trigger_manual_productivity_calculation(int4, varchar);

CREATE OR REPLACE FUNCTION public.trigger_manual_productivity_calculation(p_user_id integer DEFAULT NULL::integer, p_month_year character varying DEFAULT NULL::character varying)
 RETURNS text
 LANGUAGE plpgsql
AS $function$
DECLARE
    target_month_year VARCHAR(7);
    result_text TEXT;
    calculated_score DECIMAL(5,2);
BEGIN
    -- Get target month_year
    IF p_month_year IS NULL THEN
        SELECT get_month_year() INTO target_month_year;
    ELSE
        target_month_year := p_month_year;
    END IF;
    
    -- Calculate productivity score
    IF p_user_id IS NULL THEN
        -- Calculate for all users in the month
        SELECT SUM(calculate_monthly_productivity_score(u.id, target_month_year)) INTO calculated_score
        FROM users u
        WHERE u.user_type = 'Agent';
        
        result_text := format('Manual productivity calculation completed for month %s for all users (total score: %s)', 
                             target_month_year, calculated_score);
    ELSE
        -- Calculate for specific user
        SELECT calculate_monthly_productivity_score(p_user_id, target_month_year) INTO calculated_score;
        
        result_text := format('Manual productivity calculation completed for month %s for user %s (score: %s)', 
                             target_month_year, p_user_id, calculated_score);
    END IF;
    
    RETURN result_text;
END;
$function$
;

-- DROP FUNCTION public.update_activity_with_night_shift_logic(int4, bool, timestamp);

CREATE OR REPLACE FUNCTION public.update_activity_with_night_shift_logic(p_user_id integer, p_is_currently_active boolean, p_current_time timestamp without time zone DEFAULT NULL::timestamp without time zone)
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
      DECLARE
          current_time_manila TIMESTAMP;
          activity_date DATE;
          shift_period TEXT;
          should_reset BOOLEAN;
          existing_record RECORD;
          new_active_seconds INTEGER;
          new_inactive_seconds INTEGER;
          session_start TIMESTAMP;
          updated_rows INTEGER := 0;
      BEGIN
          -- Get current Manila time
          IF p_current_time IS NULL THEN
              current_time_manila := CURRENT_TIMESTAMP + INTERVAL '8 hours';
          ELSE
              current_time_manila := p_current_time + INTERVAL '8 hours';
          END IF;
          
          -- Get the correct activity date for this shift
          activity_date := get_activity_date_for_shift(p_user_id, p_current_time);
          
          -- Get the current shift period
          shift_period := get_current_shift_period(p_user_id, p_current_time);
          
          -- Check if we should reset the activity timer
          should_reset := should_reset_activity_for_shift(p_user_id, p_current_time);
          
          -- Get existing activity record for this date
          SELECT * INTO existing_record
          FROM activity_data
          WHERE user_id = p_user_id AND today_date = activity_date
          LIMIT 1;
          
          IF should_reset OR existing_record IS NULL THEN
              -- Create new activity record or reset existing one
              IF existing_record IS NULL THEN
                  -- Insert new record
                  INSERT INTO activity_data (
                      user_id, 
                      is_currently_active, 
                      today_active_seconds, 
                      today_inactive_seconds, 
                      last_session_start, 
                      today_date, 
                      updated_at
                  ) VALUES (
                      p_user_id,
                      p_is_currently_active,
                      0,
                      0,
                      current_time_manila,
                      activity_date,
                      current_time_manila
                  );
                  updated_rows := 1;
              ELSE
                  -- Reset existing record
                  UPDATE activity_data SET
                      is_currently_active = p_is_currently_active,
                      today_active_seconds = 0,
                      today_inactive_seconds = 0,
                      last_session_start = current_time_manila,
                      updated_at = current_time_manila
                  WHERE user_id = p_user_id AND today_date = activity_date;
                  updated_rows := 1;
              END IF;
          ELSE
              -- Update existing record with time tracking
              IF existing_record.is_currently_active != p_is_currently_active THEN
                  -- State is changing, calculate time differences
                  DECLARE
                      time_diff_seconds INTEGER;
                  BEGIN
                      -- Calculate time difference since last update
                      time_diff_seconds := EXTRACT(EPOCH FROM (current_time_manila - existing_record.updated_at));
                      
                      IF existing_record.is_currently_active THEN
                          -- Was active, now inactive - add to active time
                          new_active_seconds := existing_record.today_active_seconds + time_diff_seconds;
                          new_inactive_seconds := existing_record.today_inactive_seconds;
                      ELSE
                          -- Was inactive, now active - add to inactive time
                          new_active_seconds := existing_record.today_active_seconds;
                          new_inactive_seconds := existing_record.today_inactive_seconds + time_diff_seconds;
                      END IF;
                      
                      -- Update the record
                      UPDATE activity_data SET
                          is_currently_active = p_is_currently_active,
                          today_active_seconds = new_active_seconds,
                          today_inactive_seconds = new_inactive_seconds,
                          last_session_start = CASE 
                              WHEN p_is_currently_active THEN current_time_manila
                              ELSE existing_record.last_session_start
                          END,
                          updated_at = current_time_manila
                      WHERE user_id = p_user_id AND today_date = activity_date;
                      
                      updated_rows := 1;
                  END;
              ELSE
                  -- State hasn't changed, just update timestamp
                  UPDATE activity_data SET
                      updated_at = current_time_manila
                  WHERE user_id = p_user_id AND today_date = activity_date;
                  
                  updated_rows := 1;
              END IF;
          END IF;
          
          RETURN updated_rows;
      END;
      $function$
;

-- DROP FUNCTION public.update_all_event_statuses();

CREATE OR REPLACE FUNCTION public.update_all_event_statuses()
 RETURNS TABLE(updated_count integer, details text)
 LANGUAGE plpgsql
AS $function$
DECLARE
    upcoming_to_today_count INTEGER := 0;
    today_to_ended_count INTEGER := 0;
    past_to_ended_count INTEGER := 0;
    total_updated INTEGER := 0;
    event_record RECORD;
BEGIN
    -- Update events to 'today' if event_date is today (regardless of start_time)
    FOR event_record IN
        SELECT id, title, event_type, start_time, end_time, location, created_by, status
        FROM events 
        WHERE event_date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila')::date 
        AND status = 'upcoming'
    LOOP
        -- Update the event status
        UPDATE events 
        SET status = 'today', updated_at = CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila'
        WHERE id = event_record.id;
        
        -- Send real-time notification
        PERFORM notify_event_status_change(event_record.id, event_record.status, 'today');
        
        upcoming_to_today_count := upcoming_to_today_count + 1;
    END LOOP;
    
    -- Update events to 'ended' if event_date is in the past
    FOR event_record IN
        SELECT id, title, event_type, start_time, end_time, location, created_by, status
        FROM events 
        WHERE event_date < (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila')::date 
        AND status IN ('upcoming', 'today')
    LOOP
        -- Update the event status
        UPDATE events 
        SET status = 'ended', updated_at = CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila'
        WHERE id = event_record.id;
        
        -- Send real-time notification
        PERFORM notify_event_status_change(event_record.id, event_record.status, 'ended');
        
        past_to_ended_count := past_to_ended_count + 1;
    END LOOP;
    
    -- Update events to 'ended' if they are 'today' but have passed their end_time
    FOR event_record IN
        SELECT id, title, event_type, start_time, end_time, location, created_by, status
        FROM events 
        WHERE event_date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila')::date 
        AND status = 'today'
        AND end_time::TIME < (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila')::TIME
    LOOP
        -- Update the event status
        UPDATE events 
        SET status = 'ended', updated_at = CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila'
        WHERE id = event_record.id;
        
        -- Send real-time notification
        PERFORM notify_event_status_change(event_record.id, event_record.status, 'ended');
        
        today_to_ended_count := today_to_ended_count + 1;
    END LOOP;
    
    total_updated := upcoming_to_today_count + today_to_ended_count + past_to_ended_count;
    
    RETURN QUERY SELECT 
        total_updated,
        format('Updated: %s upcoming→today, %s today→ended (time), %s past→ended', 
               upcoming_to_today_count, today_to_ended_count, past_to_ended_count);
END;
$function$
;

-- DROP FUNCTION public.update_conversation_last_message();

CREATE OR REPLACE FUNCTION public.update_conversation_last_message()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  UPDATE team_conversations 
  SET last_message_at = NEW.created_at,
      updated_at = NOW()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$function$
;

-- DROP FUNCTION public.update_event(int4, varchar, text, date, time, time, varchar, varchar, varchar);

CREATE OR REPLACE FUNCTION public.update_event(p_event_id integer, p_title character varying, p_description text, p_event_date date, p_start_time time without time zone, p_end_time time without time zone, p_location character varying, p_status character varying, p_updated_by_email character varying)
 RETURNS boolean
 LANGUAGE plpgsql
AS $function$
DECLARE
    user_id INTEGER;
BEGIN
    -- Get user ID and check if admin
    SELECT id INTO user_id FROM users WHERE email = p_updated_by_email AND user_type = 'Internal';
    
    IF user_id IS NULL THEN
        RAISE EXCEPTION 'User not found or not authorized to update events';
    END IF;
    
    -- Update event with Philippines timezone
    UPDATE events 
    SET 
        title = p_title,
        description = p_description,
        event_date = p_event_date,
        start_time = p_start_time,
        end_time = p_end_time,
        location = p_location,
        status = p_status,
        updated_at = CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila'
    WHERE id = p_event_id;
    
    RETURN FOUND;
END;
$function$
;

-- DROP FUNCTION public.update_event_status();

CREATE OR REPLACE FUNCTION public.update_event_status()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    -- Update events to 'today' if event_date is today (Philippines time) 
    -- BUT ONLY if they are still 'upcoming' (not manually cancelled)
    UPDATE events 
    SET status = 'today', updated_at = CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila'
    WHERE event_date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila')::date 
    AND status = 'upcoming';
    
    -- Update events to 'ended' if event_date is in the past and status is not 'cancelled' (Philippines time)
    -- This respects manually cancelled events - they stay cancelled
    UPDATE events 
    SET status = 'ended', updated_at = CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila'
    WHERE event_date < (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila')::date 
    AND status IN ('upcoming', 'today');
    
    RETURN NULL;
END;
$function$
;

-- DROP FUNCTION public.update_meetings_updated_at();

CREATE OR REPLACE FUNCTION public.update_meetings_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$function$
;

-- DROP FUNCTION public.update_productivity_score_on_time_change();

CREATE OR REPLACE FUNCTION public.update_productivity_score_on_time_change()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
    affected_month_year VARCHAR(7);
    time_changed BOOLEAN;
    old_score DECIMAL(5,2);
    new_score DECIMAL(5,2);
BEGIN
    -- Only proceed if this is an UPDATE operation with time tracking changes
    IF TG_OP = 'UPDATE' THEN
        -- Check if time tracking values actually changed significantly (more than 1 second)
        time_changed := (
            ABS(COALESCE(NEW.today_active_seconds, 0) - COALESCE(OLD.today_active_seconds, 0)) > 1 OR
            ABS(COALESCE(NEW.today_inactive_seconds, 0) - COALESCE(OLD.today_inactive_seconds, 0)) > 1
        );
        
        -- Only update if there was a meaningful time change
        IF NOT time_changed THEN
            RETURN NEW;
        END IF;
    END IF;
    
    -- Get the month_year for the changed record
    SELECT get_month_year(NEW.today_date) INTO affected_month_year;
    
    -- Only update productivity scores for recent months (within 3 months)
    -- Convert month_year string to date for proper comparison
    IF affected_month_year >= to_char((NOW() AT TIME ZONE 'Asia/Manila')::date - INTERVAL '3 months', 'YYYY-MM') THEN
        -- Get the old productivity score before updating
        SELECT COALESCE(productivity_score, 0) INTO old_score
        FROM productivity_scores 
        WHERE user_id = NEW.user_id AND month_year = affected_month_year;
        
        -- Actually calculate and update the productivity score
        -- Use a separate transaction to avoid blocking the main operation
        BEGIN
            PERFORM calculate_monthly_productivity_score(NEW.user_id, affected_month_year);
            
            -- Get the new productivity score after updating
            SELECT COALESCE(productivity_score, 0) INTO new_score
            FROM productivity_scores 
            WHERE user_id = NEW.user_id AND month_year = affected_month_year;
            
            -- Log the successful calculation
            RAISE LOG 'Productivity score calculated and updated for month % (user_id: %): % -> %', 
                      affected_month_year, NEW.user_id, old_score, new_score;
            
            -- Emit real-time update via WebSocket if score changed
            IF old_score != new_score THEN
                -- Use pg_notify to signal that a productivity score was updated
                -- The socket server will listen for this notification and emit updates
                PERFORM pg_notify(
                    'productivity_score_updated',
                    json_build_object(
                        'user_id', NEW.user_id,
                        'month_year', affected_month_year,
                        'old_score', old_score,
                        'new_score', new_score,
                        'timestamp', NOW()
                    )::text
                );
                
                RAISE LOG 'Real-time productivity update notification sent for user %: % -> %', 
                          NEW.user_id, old_score, new_score;
            END IF;
            
        EXCEPTION WHEN OTHERS THEN
            -- Log the error but don't fail the main operation
            RAISE LOG 'Error calculating productivity score for month % (user_id: %): %', 
                      affected_month_year, NEW.user_id, SQLERRM;
        END;
    END IF;
    
    RETURN NEW;
END;
$function$
;

-- DROP FUNCTION public.update_reports_updated_at();

CREATE OR REPLACE FUNCTION public.update_reports_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$
;

-- DROP FUNCTION public.update_task_comments_updated_at();

CREATE OR REPLACE FUNCTION public.update_task_comments_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$function$
;

-- DROP FUNCTION public.update_task_custom_fields_updated_at();

CREATE OR REPLACE FUNCTION public.update_task_custom_fields_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW() AT TIME ZONE 'Asia/Manila';
  RETURN NEW;
END;
$function$
;

-- DROP FUNCTION public.update_task_updated_at_column();

CREATE OR REPLACE FUNCTION public.update_task_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = NOW() AT TIME ZONE 'Asia/Manila';
    RETURN NEW;
END;
$function$
;

-- DROP FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$
;