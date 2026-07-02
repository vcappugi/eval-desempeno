// js/supabase.js - Cliente de Supabase y recarga de cachés de datos

import { state } from './state.js';
import { showToast } from './utils.js';
import { populateSupervisorSelects, populateCompetenciasSelects } from './admin.js';

export async function initSupabase() {
  try {
    let url = '';
    let anonKey = '';
    
    // 1. Intentar obtener la configuración desde la API Serverless de Vercel (Producción)
    try {
      const res = await fetch('api/config');
      if (res.ok) {
        const config = await res.json();
        url = config.SUPABASE_URL || '';
        anonKey = config.SUPABASE_ANON_KEY || '';
      }
    } catch (e) {
      console.warn("No se pudo obtener la configuración desde /api/config, intentando con .env local...", e);
    }
    
    // 2. Fallback: Si no se obtuvo de la API (Desarrollo Local), leer el archivo .env
    if (!url || !anonKey) {
      const res = await fetch('.env');
      if (!res.ok) {
        throw new Error(`No se pudo cargar el archivo .env (HTTP ${res.status})`);
      }
      const text = await res.text();
      
      const config = {};
      text.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;
        const idx = trimmed.indexOf('=');
        if (idx === -1) return;
        const key = trimmed.substring(0, idx).trim();
        let value = trimmed.substring(idx + 1).trim();
        // Remover comillas del valor si existen
        if ((value.startsWith("'") && value.endsWith("'")) || (value.startsWith('"') && value.endsWith('"'))) {
          value = value.substring(1, value.length - 1);
        }
        config[key] = value;
      });
      
      url = config.API_URL || config.SUPABASE_URL || '';
      anonKey = config.ANON_KEY || config.SUPABASE_ANON_KEY || '';
    }
    
    // Si viene como API_URL (formato Supabase REST), extraer la URL base
    if (url.endsWith('/rest/v1')) {
      url = url.substring(0, url.length - 8);
    }
    
    if (!url || !anonKey) {
      throw new Error("Variables de conexión de Supabase (URL / ANON_KEY) no encontradas.");
    }
    
    // Utiliza el objeto global 'supabase' inyectado por el CDN
    state.supabaseClient = supabase.createClient(url, anonKey);
  } catch (err) {
    console.error("Error al inicializar Supabase:", err);
    showToast("Error al inicializar la base de datos (verifique la configuración).", "error");
    throw err;
  }
}

// Cargar catálogos en caché
export async function loadCaches() {
  try {
    // 1. Trabajadores - cargar todos paginando desde la BD para evitar el límite de 1000 de Supabase
    let allWorkers = [];
    let from = 0;
    let to = 999;
    let hasMore = true;
    while (hasMore) {
      const workersRes = await state.supabaseClient
        .from('trabajador')
        .select('id, ficha, cedula, nombre, empresa, departamento, cargo, rol, usuario, supervisor_id, created_at')
        .order('nombre')
        .range(from, to);
      if (workersRes.error) throw workersRes.error;
      const data = workersRes.data || [];
      allWorkers = allWorkers.concat(data);
      if (data.length < 1000) {
        hasMore = false;
      } else {
        from += 1000;
        to += 1000;
      }
    }
    state.workersCache = allWorkers;
    
    // 2. Competencias
    const classesRes = await state.supabaseClient.from('clase').select('*').order('orden');
    if (classesRes.error) throw classesRes.error;
    state.classesCache = classesRes.data || [];
    
    // 3. Aspectos de evaluación
    const aspectsRes = await state.supabaseClient.from('item_evaluacion').select('*').order('orden');
    if (aspectsRes.error) throw aspectsRes.error;
    state.aspectsCache = aspectsRes.data || [];
    
    // Unir con competencias (clase) en memoria para evitar FK físicas en BD
    state.aspectsCache.forEach(a => {
      const parentClass = state.classesCache.find(c => c.id === a.clase_id);
      a.clase = parentClass ? { titulo: parentClass.titulo } : null;
    });
    
    // 4. Evaluaciones
    const evalsRes = await state.supabaseClient.from('evaluacion').select('*');
    if (evalsRes.error) throw evalsRes.error;
    state.evaluationsCache = evalsRes.data || [];
    
    // 5. Fechas de Evaluación
    const datesRes = await state.supabaseClient.from('fecha_eval').select('*').order('fecha', { ascending: false });
    if (datesRes.error) throw datesRes.error;
    state.fechaEvalCache = datesRes.data || [];
    
    // Llenar selects dinámicos si es que ya están cargados en el DOM
    populateSupervisorSelects();
    populateCompetenciasSelects();
  } catch (err) {
    console.error("Error cargando cachés:", err);
    showToast("Error al sincronizar datos con el servidor.", "error");
  }
}
