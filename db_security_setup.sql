-- SQL Script: db_security_setup.sql
-- Ejecute este script en el SQL Editor de su Dashboard de Supabase para habilitar la seguridad del lado del servidor.

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
    t.created_at::timestamp with time zone
  FROM public.trabajador t
  WHERE (t.usuario = p_username OR t.cedula = p_username)
    AND t.clave = p_password
  LIMIT 1;
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
