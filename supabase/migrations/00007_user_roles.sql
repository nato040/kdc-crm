-- 00007_user_roles.sql
-- Two-role system: admin and operator.
-- Admin sees everything. Operator sees client work only (campaigns, flows, analysis).
-- Financial data, integrations, and user management are admin-only.

-- ═════════════════════════════════════════════
-- 1. user_roles table
-- ═════════════════════════════════════════════

CREATE TABLE user_roles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('admin', 'operator')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_roles_role ON user_roles(role);

-- ═════════════════════════════════════════════
-- 2. Helper functions
-- ═════════════════════════════════════════════

CREATE OR REPLACE FUNCTION current_user_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT role FROM user_roles WHERE user_id = auth.uid() LIMIT 1
$$;

CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE(
    (SELECT role FROM user_roles WHERE user_id = auth.uid() LIMIT 1) = 'admin',
    false
  )
$$;

-- ═════════════════════════════════════════════
-- 3. RLS on user_roles
-- ═════════════════════════════════════════════

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_roles_admin_all ON user_roles
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY user_roles_self_read ON user_roles
  FOR SELECT USING (user_id = auth.uid());

-- ═════════════════════════════════════════════
-- 4. Lock commission tables to admin-only
-- ═════════════════════════════════════════════

-- commission_statements: replace my_client_ids() policies with admin-only
DROP POLICY IF EXISTS commission_statements_select ON commission_statements;
DROP POLICY IF EXISTS commission_statements_insert ON commission_statements;
DROP POLICY IF EXISTS commission_statements_update ON commission_statements;

CREATE POLICY commission_statements_admin_all ON commission_statements
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- commission_credit_days: replace my_client_ids() chain with admin-only
DROP POLICY IF EXISTS commission_credit_days_select ON commission_credit_days;
DROP POLICY IF EXISTS commission_credit_days_insert ON commission_credit_days;

CREATE POLICY commission_credit_days_admin_all ON commission_credit_days
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- ═════════════════════════════════════════════
-- 5. Harden clients table: admin-only writes
-- ═════════════════════════════════════════════

-- Keep existing SELECT policy ("read own clients") — both roles need it.
-- Replace INSERT and UPDATE with admin-only. Add admin-only DELETE.

DROP POLICY IF EXISTS "insert" ON clients;
DROP POLICY IF EXISTS "update" ON clients;

CREATE POLICY clients_admin_insert ON clients
  FOR INSERT WITH CHECK (is_admin());

CREATE POLICY clients_admin_update ON clients
  FOR UPDATE USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY clients_admin_delete ON clients
  FOR DELETE USING (is_admin());

-- ═════════════════════════════════════════════
-- 6. Restrict Klaviyo key management to admin
-- ═════════════════════════════════════════════

-- Recreate set_klaviyo_key with is_admin() guard.
-- Service role (null auth.uid()) passes through for sync route compatibility.
-- Function body preserved verbatim from 00004_klaviyo_integration.sql.

CREATE OR REPLACE FUNCTION public.set_klaviyo_key(
  p_client_id uuid,
  p_api_key   text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_key_id uuid;
  v_new_key_id      uuid;
BEGIN
  -- Guard: block non-admin authenticated users.
  -- Service role (null auth.uid()) passes through.
  IF auth.uid() IS NOT NULL AND NOT is_admin() THEN
    RAISE EXCEPTION 'Only admin users can manage Klaviyo API keys';
  END IF;

  -- Check if client already has a key
  SELECT klaviyo_key_id INTO v_existing_key_id
  FROM public.clients
  WHERE id = p_client_id;

  IF v_existing_key_id IS NOT NULL THEN
    -- Update existing vault secret in place
    PERFORM vault.update_secret(
      v_existing_key_id,
      p_api_key,
      'klaviyo_' || p_client_id::text,
      'Klaviyo API key for client ' || p_client_id::text
    );
  ELSE
    -- Insert new vault secret
    v_new_key_id := vault.create_secret(
      p_api_key,
      'klaviyo_' || p_client_id::text,
      'Klaviyo API key for client ' || p_client_id::text
    );

    -- Store the vault secret ID on the client row
    UPDATE public.clients
    SET klaviyo_key_id = v_new_key_id
    WHERE id = p_client_id;
  END IF;
END;
$$;

-- Recreate get_klaviyo_key with is_admin() guard.
-- Service role (null auth.uid()) passes through for sync route compatibility.
-- Function body preserved verbatim from 00004_klaviyo_integration.sql.

CREATE OR REPLACE FUNCTION public.get_klaviyo_key(
  p_client_id uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key_id uuid;
  v_decrypted text;
BEGIN
  -- Guard: block non-admin authenticated users.
  -- Service role (null auth.uid()) passes through.
  IF auth.uid() IS NOT NULL AND NOT is_admin() THEN
    RAISE EXCEPTION 'Only admin users can manage Klaviyo API keys';
  END IF;

  SELECT klaviyo_key_id INTO v_key_id
  FROM public.clients
  WHERE id = p_client_id;

  IF v_key_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT decrypted_secret INTO v_decrypted
  FROM vault.decrypted_secrets
  WHERE id = v_key_id;

  RETURN v_decrypted;
END;
$$;

-- Maintain REVOKE from 00004 — these functions should not be callable
-- via anon or authenticated roles directly. Service role only + the
-- is_admin() guard inside for belt-and-suspenders.
REVOKE EXECUTE ON FUNCTION public.set_klaviyo_key(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.set_klaviyo_key(uuid, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.get_klaviyo_key(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_klaviyo_key(uuid) FROM authenticated;
