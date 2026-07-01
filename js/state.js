// js/state.js - Estado global de la aplicación

export const state = {
  currentUser: null,
  activeView: 'login',
  activeAdminTab: 'trabajadores',
  workersCurrentPage: 1,
  workersPerPage: 20,
  workersSearchQuery: '',
  
  // Cachés de Datos de la Base de Datos
  workersCache: [],
  classesCache: [],
  aspectsCache: [],
  evaluationsCache: [],
  fechaEvalCache: [],
  
  // Cliente de Supabase
  supabaseClient: null,
  
  // Instancia activa de Chart.js
  currentChartInstance: null
};
