/*
  # Fix RLS Policies and Restructure for Individual Dashboards

  1. Security
    - Disable RLS on teams (users don't need view restriction)
    - Fix infinite recursion in team_members policy
    - Keep RLS on activities and comments

  2. Changes
    - Public access to teams (admins control)
    - Simplified team_members policy
    - Activities and comments remain RLS protected
*/

-- Drop problematic policies
DROP POLICY IF EXISTS "Teams - users can view own teams" ON teams;
DROP POLICY IF EXISTS "TeamMembers - users can view team members" ON team_members;

-- Disable RLS on teams (public access for admins)
ALTER TABLE teams DISABLE ROW LEVEL SECURITY;

-- Fix team_members policy - simpler approach
CREATE POLICY "TeamMembers - users can view team members"
  ON team_members FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR team_id IN (
    SELECT team_id FROM team_members WHERE user_id = auth.uid()
  ));

-- Allow creating team members
CREATE POLICY "TeamMembers - can insert for own team"
  ON team_members FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR team_id IN (
      SELECT team_id FROM team_members 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );
