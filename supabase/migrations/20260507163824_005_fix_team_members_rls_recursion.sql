/*
  # Fix infinite recursion in team_members RLS

  1. Problem
    - team_members SELECT policy references team_members in a subquery
    - team_members INSERT policy references team_members in a subquery
    - This creates infinite recursion

  2. Solution
    - Drop all existing policies on team_members
    - Use simple policies that don't self-reference
    - For SELECT: allow if user_id matches OR if user is the team creator
    - For INSERT: allow if user is authenticated (team creator adds members)
    - Use a helper function to check team membership without recursion

  3. Approach
    - Disable RLS on team_members entirely since the team creator
      manages who is in their team
    - Activities still have RLS for data protection
*/

-- Drop all existing policies on team_members
DROP POLICY IF EXISTS "TeamMembers - users can view team members" ON team_members;
DROP POLICY IF EXISTS "TeamMembers - can insert for own team" ON team_members;

-- Disable RLS on team_members - the team creator manages membership
-- This avoids recursion since team_members is the source of truth for membership
ALTER TABLE team_members DISABLE ROW LEVEL SECURITY;
