-- ShoreAgents Authentication Schema
-- This migration creates the user authentication tables based on the provided schema

-- DROP SCHEMA public;

CREATE SCHEMA IF NOT EXISTS public AUTHORIZATION pg_database_owner;

COMMENT ON SCHEMA public IS 'standard public schema';

-- DROP TYPE public."gender_enum";

CREATE TYPE IF NOT EXISTS public."gender_enum" AS ENUM (
	'Male',
	'Female',
	'Other',
	'Prefer not to say');

-- DROP TYPE public."user_type_enum";

CREATE TYPE IF NOT EXISTS public."user_type_enum" AS ENUM (
	'Agent',
	'Client',
	'Internal');

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

-- Table Triggers

DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
CREATE TRIGGER update_users_updated_at 
	BEFORE UPDATE ON public.users 
	FOR EACH ROW 
	EXECUTE FUNCTION update_updated_at_column();

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

-- Table Triggers

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

-- Table Triggers

DROP TRIGGER IF EXISTS update_personal_info_updated_at ON public.personal_info;
CREATE TRIGGER update_personal_info_updated_at 
	BEFORE UPDATE ON public.personal_info 
	FOR EACH ROW 
	EXECUTE FUNCTION update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_passwords_user_id ON public.passwords(user_id);
CREATE INDEX IF NOT EXISTS idx_personal_info_user_id ON public.personal_info(user_id); 