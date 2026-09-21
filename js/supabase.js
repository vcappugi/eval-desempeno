// js/supabase.js - Cliente de Supabase y recarga de cachés de datos

import { state } from './state.js';
import { showToast } from './utils.js';
import { populateSupervisorSelects, populateCompetenciasSelects } from './admin.js';
import { CONFIG } from './config.js';

export function initSupabase() {
  const SUPABASE_URL = CONFIG.SUPABASE_URL;
  const SUPABASE_ANON_KEY = CONFIG.SUPABASE_ANON_KEY;
  
  // Utiliza el objeto global 'supabase' inyectado por el CDN
  state.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
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
        .select('*')
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
      a.clase = parentClass ? { titulo: parentClass.titulo, tipo: parentClass.tipo, id: parentClass.id } : null;
    });
    
    // 4. Evaluaciones (cargar todas las páginas de 1000 registros para tener el histórico completo)
    let allEvals = [];
    let evalsFrom = 0;
    const step = 1000;
    let hasMoreEvals = true;

    while (hasMoreEvals) {
      const { data, error } = await state.supabaseClient
        .from('evaluacion')
        .select('*')
        .order('id', { ascending: true })
        .range(evalsFrom, evalsFrom + step - 1);
        
      if (error) throw error;
      
      if (data && data.length > 0) {
        allEvals.push(...data);
        if (data.length < step) {
          hasMoreEvals = false;
        } else {
          evalsFrom += step;
        }
      } else {
        hasMoreEvals = false;
      }
    }
    state.evaluationsCache = allEvals;
    
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
