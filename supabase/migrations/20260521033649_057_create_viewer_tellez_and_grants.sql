/*
  # Create viewer user Javier Tellez and grant access to both managers

  ## Changes
  - Creates auth user tellezs@sanborns.com.mx with password 123456
  - Inserts app_roles entry with role='viewer'
  - Grants access to view projects of both managers:
    - habelmont@sears.com.mx
    - romoal@sanborns.com.mx
*/

DO $$
DECLARE
  new_user_id uuid;
  super_admin_id uuid := '65f1583e-1681-4d74-945d-0f3ce3402319';
  habelmont_id uuid := '65f1583e-1681-4d74-945d-0f3ce3402319';
  romoal_id uuid := '680c7da9-a2fa-42b2-8bcb-6723919e0ca6';
BEGIN
  -- Check if user already exists
  SELECT id INTO new_user_id FROM auth.users WHERE email = 'tellezs@sanborns.com.mx';

  -- Create if not exists
  IF new_user_id IS NULL THEN
    new_user_id := gen_random_uuid();
    INSERT INTO auth.users (
      id,
      instance_id,
      email,
      encrypted_password,
      email_confirmed_at,
      created_at,
      updated_at,
      raw_app_meta_data,
      raw_user_meta_data,
      aud,
      role
    )
    VALUES (
      new_user_id,
      '00000000-0000-0000-0000-000000000000',
      'tellezs@sanborns.com.mx',
      crypt('123456', gen_salt('bf')),
      now(),
      now(),
      now(),
      '{"provider":"email","providers":["email"]}',
      '{"name":"Javier Tellez"}',
      'authenticated',
      'authenticated'
    );
  END IF;

  -- Create app_role as viewer
  INSERT INTO app_roles (user_id, role, team_id, created_by)
  VALUES (new_user_id, 'viewer', NULL, super_admin_id)
  ON CONFLICT (user_id) DO UPDATE SET role = 'viewer';

  -- Grant access to habelmont's projects
  INSERT INTO viewer_grants (viewer_user_id, manager_user_id, granted_by)
  VALUES (new_user_id, habelmont_id, super_admin_id)
  ON CONFLICT (viewer_user_id, manager_user_id) DO NOTHING;

  -- Grant access to romoal's projects
  INSERT INTO viewer_grants (viewer_user_id, manager_user_id, granted_by)
  VALUES (new_user_id, romoal_id, super_admin_id)
  ON CONFLICT (viewer_user_id, manager_user_id) DO NOTHING;
END $$;
