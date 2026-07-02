// js/main.js - Punto de entrada principal y enlace global para el DOM

import { state } from './state.js';
import { initSupabase } from './supabase.js';
import { closeModal } from './utils.js';
import { checkSession, handleLogin, handleLogout, openPasswordModal, saveNewPassword } from './auth.js';
import { initTheme, toggleTheme, toggleSidebar, switchView, switchAdminTab } from './views.js';
import { startEvaluation, closeEvaluationForm, selectRangoOption, checkEvaluationDateUnique, saveEvaluation, handleEvalWorkerSearch, changeEvalsPage } from './evaluations.js';
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
  editAspecto,
  deleteAspecto,
  openAspectoModal,
  saveAspecto,
  toggleEvaluationStatus,
  editFechaEval,
  deleteFechaEval,
  openFechaEvalModal,
  saveFechaEval
} from './admin.js';
import { showWorkerChartModal, renderReporteSubordinados, printReporteSubordinados } from './reports.js';

// Inicialización de la aplicación al cargar el DOM
document.addEventListener("DOMContentLoaded", () => {
  // Inicializar cliente de Supabase
  initSupabase();

  // Inicializar tema guardado
  initTheme();
  
  // Verificar sesión existente
  checkSession();
  
  // Registrar eventos estáticos globales en el DOM cargado
  document.getElementById('loginForm')?.addEventListener('submit', handleLogin);
});

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

// CRUD Trabajadores
window.editTrabajador = editTrabajador;
window.deleteTrabajador = deleteTrabajador;
window.changeWorkersPage = changeWorkersPage;
window.handleWorkerSearch = handleWorkerSearch;
window.openTrabajadorModal = openTrabajadorModal;
window.saveTrabajador = saveTrabajador;

// CRUD Competencias
window.editCompetencia = editCompetencia;
window.deleteCompetencia = deleteCompetencia;
window.openCompetenciaModal = openCompetenciaModal;
window.saveCompetencia = saveCompetencia;

// CRUD Aspectos
window.editAspecto = editAspecto;
window.deleteAspecto = deleteAspecto;
window.openAspectoModal = openAspectoModal;
window.saveAspecto = saveAspecto;

// Cierre de Evaluaciones
window.toggleEvaluationStatus = toggleEvaluationStatus;

// CRUD Fechas
window.editFechaEval = editFechaEval;
window.deleteFechaEval = deleteFechaEval;
window.openFechaEvalModal = openFechaEvalModal;
window.saveFechaEval = saveFechaEval;

// Reportes y Gráficos
window.showWorkerChartModal = showWorkerChartModal;
window.renderReporteSubordinados = renderReporteSubordinados;
window.printReporteSubordinados = printReporteSubordinados;
