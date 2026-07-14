-- Migration: Add phone number to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone TEXT;
