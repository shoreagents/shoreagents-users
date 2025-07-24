-- ShoreAgents Comprehensive Database Schema
-- This migration creates the complete database structure including members, agents, clients, and job info

-- DROP SCHEMA public;

CREATE SCHEMA IF NOT EXISTS public AUTHORIZATION pg_database_owner;

COMMENT ON SCHEMA public IS 'standard public schema';

-- Create ENUM types
-- DROP TYPE public."gender_enum";

CREATE TYPE IF NOT EXISTS public."gender_enum" AS ENUM (
	'Male',
	'Female',
	'Other',
	'Prefer not to say');

-- DROP TYPE public.member_status_enum;

CREATE TYPE IF NOT EXISTS public.member_status_enum AS ENUM (
	'Current Client',
	'Lost Client');

-- DROP TYPE public."user_type_enum";

CREATE TYPE IF NOT EXISTS public."user_type_enum" AS ENUM (
	'Agent',
	'Client',
	'Internal');

-- Create sequences
-- DROP SEQUENCE public.job_info_id_seq;

CREATE SEQUENCE IF NOT EXISTS public.job_info_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 2147483647
	START 1
	CACHE 1
	NO CYCLE;

-- DROP SEQUENCE public.members_id_seq;

CREATE SEQUENCE IF NOT EXISTS public.members_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 2147483647
	START 1
	CACHE 1
	NO CYCLE;

-- DROP SEQUENCE public.passwords_id_seq;

CREATE SEQUENCE IF NOT EXISTS public.passwords_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 2147483647
	START 1
	CACHE 1
	NO CYCLE;

-- DROP SEQUENCE public.personal_info_id_seq;

CREATE SEQUENCE IF NOT EXISTS public.personal_info_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 2147483647
	START 1
	CACHE 1
	NO CYCLE;

-- DROP SEQUENCE public.users_id_seq;

CREATE SEQUENCE IF NOT EXISTS public.users_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 2147483647
	START 1
	CACHE 1
	NO CYCLE;

-- Create trigger function for updating updated_at column
-- DROP FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$function$
;

-- Create main tables

-- public.members definition

-- DROP TABLE IF EXISTS public.members;

CREATE TABLE IF NOT EXISTS public.members (
	id serial4 NOT NULL,
	company text NOT NULL,
	address text NULL,
	phone text NULL,
	logo text NULL,
	service text NULL,
	status public.member_status_enum NULL,
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	updated_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	badge_color text NULL,
	country text NULL,
	website _text NULL,
	CONSTRAINT members_pkey PRIMARY KEY (id)
);

-- public.users definition

-- DROP TABLE IF EXISTS public.users;

CREATE TABLE IF NOT EXISTS public.users (
	id serial4 NOT NULL,
	email text NOT NULL,
	user_type public."user_type_enum" NOT NULL,
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	updated_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	CONSTRAINT users_email_key UNIQUE (email),
	CONSTRAINT users_pkey PRIMARY KEY (id)
);

-- Table Triggers for users

DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
CREATE TRIGGER update_users_updated_at 
	BEFORE UPDATE ON public.users 
	FOR EACH ROW 
	EXECUTE FUNCTION update_updated_at_column();

-- public.agents definition

-- DROP TABLE IF EXISTS public.agents;

CREATE TABLE IF NOT EXISTS public.agents (
	user_id int4 NOT NULL,
	exp_points int4 DEFAULT 0 NULL,
	member_id int4 NOT NULL,
	department_id int4 NULL,
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	updated_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	CONSTRAINT agents_pkey PRIMARY KEY (user_id),
	CONSTRAINT agents_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.members(id) ON DELETE CASCADE,
	CONSTRAINT agents_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
);

-- public.clients definition

-- DROP TABLE IF EXISTS public.clients;

CREATE TABLE IF NOT EXISTS public.clients (
	user_id int4 NOT NULL,
	member_id int4 NOT NULL,
	department_id int4 NULL,
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	updated_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	CONSTRAINT clients_pkey PRIMARY KEY (user_id),
	CONSTRAINT clients_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.members(id) ON DELETE CASCADE,
	CONSTRAINT clients_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
);

-- public.job_info definition

-- DROP TABLE IF EXISTS public.job_info;

CREATE TABLE IF NOT EXISTS public.job_info (
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
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	updated_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	CONSTRAINT chk_job_info_employee_type CHECK ((((agent_user_id IS NOT NULL) AND (internal_user_id IS NULL)) OR ((agent_user_id IS NULL) AND (internal_user_id IS NOT NULL)))),
	CONSTRAINT job_info_employee_id_key UNIQUE (employee_id),
	CONSTRAINT job_info_pkey PRIMARY KEY (id),
	CONSTRAINT job_info_agent_user_id_fkey FOREIGN KEY (agent_user_id) REFERENCES public.agents(user_id) ON DELETE CASCADE
);

-- public.passwords definition

-- DROP TABLE IF EXISTS public.passwords;

CREATE TABLE IF NOT EXISTS public.passwords (
	id serial4 NOT NULL,
	user_id int4 NOT NULL,
	"password" text NOT NULL,
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	updated_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	CONSTRAINT passwords_pkey PRIMARY KEY (id),
	CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
);

-- Table Triggers for passwords

DROP TRIGGER IF EXISTS update_passwords_updated_at ON public.passwords;
CREATE TRIGGER update_passwords_updated_at 
	BEFORE UPDATE ON public.passwords 
	FOR EACH ROW 
	EXECUTE FUNCTION update_updated_at_column();

-- public.personal_info definition

-- DROP TABLE IF EXISTS public.personal_info;

CREATE TABLE IF NOT EXISTS public.personal_info (
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
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	updated_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	CONSTRAINT personal_info_pkey PRIMARY KEY (id),
	CONSTRAINT personal_info_user_id_key UNIQUE (user_id),
	CONSTRAINT personal_info_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
);

-- Table Triggers for personal_info

DROP TRIGGER IF EXISTS update_personal_info_updated_at ON public.personal_info;
CREATE TRIGGER update_personal_info_updated_at 
	BEFORE UPDATE ON public.personal_info 
	FOR EACH ROW 
	EXECUTE FUNCTION update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_user_type ON public.users(user_type);
CREATE INDEX IF NOT EXISTS idx_passwords_user_id ON public.passwords(user_id);
CREATE INDEX IF NOT EXISTS idx_personal_info_user_id ON public.personal_info(user_id);
CREATE INDEX IF NOT EXISTS idx_agents_user_id ON public.agents(user_id);
CREATE INDEX IF NOT EXISTS idx_agents_member_id ON public.agents(member_id);
CREATE INDEX IF NOT EXISTS idx_clients_user_id ON public.clients(user_id);
CREATE INDEX IF NOT EXISTS idx_clients_member_id ON public.clients(member_id);
CREATE INDEX IF NOT EXISTS idx_job_info_employee_id ON public.job_info(employee_id);
CREATE INDEX IF NOT EXISTS idx_job_info_agent_user_id ON public.job_info(agent_user_id);
CREATE INDEX IF NOT EXISTS idx_job_info_internal_user_id ON public.job_info(internal_user_id);
CREATE INDEX IF NOT EXISTS idx_members_company ON public.members(company);
CREATE INDEX IF NOT EXISTS idx_members_status ON public.members(status); 