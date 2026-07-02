-- SQL Script: db_security_setup.sql
-- Ejecute este script en el SQL Editor de su Dashboard de Supabase para habilitar la seguridad del lado del servidor.

-- 0. Agregar columna session_token si no existe
ALTER TABLE public.trabajador ADD COLUMN IF NOT EXISTS session_token TEXT;

-- 1. Función para verificar credenciales de trabajador sin exponer contraseñas al cliente
CREATE OR REPLACE FUNCTION verify_worker_credentials(p_username TEXT, p_password TEXT)
RETURNS TABLE (
  id BIGINT,
  ficha TEXT,
  cedula TEXT,
  nombre TEXT,
  empresa TEXT,
  departamento TEXT,
  cargo TEXT,
  rol TEXT,
  usuario TEXT,
  supervisor_id BIGINT,
  session_token TEXT,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
  v_worker_id BIGINT;
  v_token TEXT;
BEGIN
  -- Buscar el trabajador que coincida con las credenciales
  SELECT t.id INTO v_worker_id
  FROM public.trabajador t
  WHERE (t.usuario = p_username OR t.cedula = p_username)
    AND t.clave = p_password
  LIMIT 1;

  IF v_worker_id IS NOT NULL THEN
    -- Generar un token único aleatorio
    v_token := md5(random()::text || clock_timestamp()::text);
    
    -- Guardar el token en la sesión del trabajador
    UPDATE public.trabajador
    SET session_token = v_token
    WHERE trabajador.id = v_worker_id;
  END IF;

  RETURN QUERY
  SELECT 
    t.id::bigint, 
    t.ficha::text, 
    t.cedula::text, 
    t.nombre::text, 
    t.empresa::text, 
    t.departamento::text, 
    t.cargo::text, 
    t.rol::text, 
    t.usuario::text, 
    t.supervisor_id::bigint, 
    t.session_token::text,
    t.created_at::timestamp with time zone
  FROM public.trabajador t
  WHERE t.id = v_worker_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 1.1. Función para verificar la sesión basándose en el session_token
CREATE OR REPLACE FUNCTION verify_worker_session(p_session_token TEXT)
RETURNS TABLE (
  id BIGINT,
  ficha TEXT,
  cedula TEXT,
  nombre TEXT,
  empresa TEXT,
  departamento TEXT,
  cargo TEXT,
  rol TEXT,
  usuario TEXT,
  supervisor_id BIGINT,
  session_token TEXT,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id::bigint, 
    t.ficha::text, 
    t.cedula::text, 
    t.nombre::text, 
    t.empresa::text, 
    t.departamento::text, 
    t.cargo::text, 
    t.rol::text, 
    t.usuario::text, 
    t.supervisor_id::bigint, 
    t.session_token::text,
    t.created_at::timestamp with time zone
  FROM public.trabajador t
  WHERE t.session_token = p_session_token
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 1.2. Función para revocar el session_token al cerrar sesión (logout)
CREATE OR REPLACE FUNCTION revoke_worker_session(p_session_token TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE public.trabajador
  SET session_token = NULL
  WHERE session_token = p_session_token;
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Función para actualizar la contraseña verificando la anterior en el servidor
CREATE OR REPLACE FUNCTION change_worker_password(
  p_worker_id BIGINT,
  p_old_password TEXT,
  p_new_password TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_updated BOOLEAN := FALSE;
BEGIN
  UPDATE public.trabajador
  SET clave = p_new_password
  WHERE id = p_worker_id AND clave = p_old_password;
  
  IF FOUND THEN
    v_updated := TRUE;
  END IF;
  
  RETURN v_updated;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
