-- Drop title column from tickets table
-- Migration: 005_drop_tickets_title.sql

-- Drop the title column from the tickets table
ALTER TABLE public.tickets DROP COLUMN IF EXISTS title; 