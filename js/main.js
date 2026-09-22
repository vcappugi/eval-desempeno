// js/main.js - Punto de entrada principal y enlace global para el DOM

import { state } from './state.js';
import { initSupabase } from './supabase.js';
import { closeModal } from './utils.js';
import { checkSession, handleLogin, handleLogout, openPasswordModal, saveNewPassword } from './auth.js';
import { initTheme, toggleTheme, toggleSidebar, switchView, switchAdminTab } from './views.js';
import { startEvaluation, closeEvaluationForm, selectRangoOption, checkEvaluationDateUnique, saveEvaluation, handleEvalWorkerSearch, changeEvalsPage, isAspectoReverse, getItemMultiplier, calculateItemScore } from './evaluations.js';
import {
  editTrabajador,
  deleteTrabajador,
  changeWorkersPage,
  handleWorkerSearch,
  openTrabajadorModal,
  saveTrabajador,
  editCompetencia,
  deleteCompetencia,
  openCompetenciaModal,
  saveCompetencia,
  handleCompetenciaFilterTipoChange,
  resetCompetenciasFilter,
  editAspecto,
  deleteAspecto,
  openAspectoModal,
  saveAspecto,
  toggleEvaluationStatus,
  editFechaEval,
  deleteFechaEval,
  openFechaEvalModal,
  saveFechaEval,
  toggleFechaEvalPublicado,
  handleTrabRolChange,
  handleAspectosFilterTipoChange,
  handleAspectosFilterClaseChange,
  resetAspectosFilters,
  handleCierreSearch,
  resetCierreSearch
} from './admin.js';
import { showWorkerChartModal, renderReporteSubordinados, printReporteSubordinados, handleReportDeptChange, filterWorkerChartByPeriod } from './reports.js';

// Inicialización de la aplicación al cargar el DOM
function initApp() {
  // Inicializar cliente de Supabase
  initSupabase();

  // Inicializar tema guardado
  initTheme();
  
  // Verificar sesión existente
  checkSession();
  
  // Registrar eventos estáticos globales en el DOM cargado
  document.getElementById('loginForm')?.addEventListener('submit', handleLogin);
}

if (document.readyState === 'loading') {
  document.addEventListener("DOMContentLoaded", initApp);
} else {
  initApp();
}

// Vincular funciones a Window para soportar invocaciones en atributos inline del HTML
window.toggleTheme = toggleTheme;
window.toggleSidebar = toggleSidebar;
window.switchView = switchView;
window.switchAdminTab = switchAdminTab;
window.handleLogin = handleLogin;
window.handleLogout = handleLogout;
window.closeModal = closeModal;
window.openPasswordModal = openPasswordModal;
window.saveNewPassword = saveNewPassword;

// Supervisor / Evaluaciones
window.startEvaluation = startEvaluation;
window.closeEvaluationForm = closeEvaluationForm;
window.selectRangoOption = selectRangoOption;
window.checkEvaluationDateUnique = checkEvaluationDateUnique;
window.saveEvaluation = saveEvaluation;
window.handleEvalWorkerSearch = handleEvalWorkerSearch;
window.changeEvalsPage = changeEvalsPage;
window.isAspectoReverse = isAspectoReverse;
window.getItemMultiplier = getItemMultiplier;
window.calculateItemScore = calculateItemScore;

// CRUD Trabajadores
window.editTrabajador = editTrabajador;
window.deleteTrabajador = deleteTrabajador;
window.changeWorkersPage = changeWorkersPage;
window.handleWorkerSearch = handleWorkerSearch;
window.openTrabajadorModal = openTrabajadorModal;
window.saveTrabajador = saveTrabajador;
window.handleTrabRolChange = handleTrabRolChange;

// CRUD Competencias
window.editCompetencia = editCompetencia;
window.deleteCompetencia = deleteCompetencia;
window.openCompetenciaModal = openCompetenciaModal;
window.saveCompetencia = saveCompetencia;
window.handleCompetenciaFilterTipoChange = handleCompetenciaFilterTipoChange;
window.resetCompetenciasFilter = resetCompetenciasFilter;

// CRUD Aspectos
window.editAspecto = editAspecto;
window.deleteAspecto = deleteAspecto;
window.openAspectoModal = openAspectoModal;
window.saveAspecto = saveAspecto;
window.handleAspectosFilterTipoChange = handleAspectosFilterTipoChange;
window.handleAspectosFilterClaseChange = handleAspectosFilterClaseChange;
window.resetAspectosFilters = resetAspectosFilters;

// Cierre de Evaluaciones
window.toggleEvaluationStatus = toggleEvaluationStatus;
window.handleCierreSearch = handleCierreSearch;
window.resetCierreSearch = resetCierreSearch;

// CRUD Fechas
window.editFechaEval = editFechaEval;
window.deleteFechaEval = deleteFechaEval;
window.openFechaEvalModal = openFechaEvalModal;
window.saveFechaEval = saveFechaEval;
window.toggleFechaEvalPublicado = toggleFechaEvalPublicado;

// Reportes y Gráficos
window.showWorkerChartModal = showWorkerChartModal;
window.renderReporteSubordinados = renderReporteSubordinados;
window.printReporteSubordinados = printReporteSubordinados;
window.handleReportDeptChange = handleReportDeptChange;
window.filterWorkerChartByPeriod = filterWorkerChartByPeriod;
