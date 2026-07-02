-- SQL Script: db_security_setup.sql
-- Ejecute este script en el SQL Editor de su Dashboard de Supabase para habilitar la seguridad del lado del servidor.

-- Habilitar extensión pgcrypto para cifrado bcrypt
CREATE EXTENSION IF NOT EXISTS pgcrypto;

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
  -- Buscar el trabajador que coincida con las credenciales (comparando hash bcrypt)
  SELECT t.id INTO v_worker_id
  FROM public.trabajador t
  WHERE (t.usuario = p_username OR t.cedula = p_username)
    AND t.clave = crypt(p_password, t.clave)
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

-- 2. Función para actualizar la contraseña verificando la anterior en el servidor contra el hash
CREATE OR REPLACE FUNCTION change_worker_password(
  p_worker_id BIGINT,
  p_old_password TEXT,
  p_new_password TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_updated BOOLEAN := FALSE;
BEGIN
  -- Actualizar la contraseña si la contraseña anterior coincide con el hash almacenado
  UPDATE public.trabajador
  SET clave = p_new_password  -- El trigger lo encriptará automáticamente
  WHERE id = p_worker_id AND clave = crypt(p_old_password, clave);
  
  IF FOUND THEN
    v_updated := TRUE;
  END IF;
  
  RETURN v_updated;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Crear el trigger para cifrar contraseñas al insertar o actualizar
CREATE OR REPLACE FUNCTION hash_worker_password_trigger()
RETURNS TRIGGER AS $$
BEGIN
  -- Si es un INSERT, o es un UPDATE y la clave ha cambiado
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.clave IS DISTINCT FROM OLD.clave) THEN
    -- Cifrar la contraseña solo si no está ya cifrada en bcrypt (empieza por $2a$ o $2b$)
    IF NEW.clave IS NOT NULL AND NEW.clave NOT LIKE '$2a$%' AND NEW.clave NOT LIKE '$2b$%' THEN
      NEW.clave := crypt(NEW.clave, gen_salt('bf'));
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear o reemplazar el trigger
DROP TRIGGER IF EXISTS trigger_hash_worker_password ON public.trabajador;
CREATE TRIGGER trigger_hash_worker_password
BEFORE INSERT OR UPDATE ON public.trabajador
FOR EACH ROW
EXECUTE FUNCTION hash_worker_password_trigger();

-- 4. Migración de datos existentes: cifrar claves actuales que estén en texto plano
UPDATE public.trabajador
SET clave = crypt(clave, gen_salt('bf'))
WHERE clave IS NOT NULL AND clave NOT LIKE '$2a$%' AND clave NOT LIKE '$2b$%';
