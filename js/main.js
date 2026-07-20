// js/main.js - Punto de entrada principal y enlace global para el DOM

import { state } from './state.js?v=2.2.0';
import { initSupabase } from './supabase.js?v=2.2.0';
import { closeModal } from './utils.js?v=2.2.0';
import { checkSession, handleLogin, handleLogout, openPasswordModal, saveNewPassword } from './auth.js?v=2.2.0';
import { initTheme, toggleTheme, toggleSidebar, switchView, switchAdminTab } from './views.js?v=2.2.0';
import { startEvaluation, closeEvaluationForm, selectRangoOption, checkEvaluationDateUnique, saveEvaluation, handleEvalWorkerSearch, changeEvalsPage, handleEvalWorkerDeptFilter, printMainEvaluationForm } from './evaluations.js?v=2.2.0';
import {
  editTrabajador,
  deleteTrabajador,
  changeWorkersPage,
  handleWorkerSearch,
  openTrabajadorModal,
  saveTrabajador,
  handleTrabTipoChange,
  editCompetencia,
  deleteCompetencia,
  openCompetenciaModal,
  saveCompetencia,
  editAspecto,
  deleteAspecto,
  openAspectoModal,
  saveAspecto,
  renderAspectosCrud,
  toggleEvaluationStatus,
  handleCierreSearch,
  changeCierrePage,
  showEvaluationDetail,
  confirmDeleteEvaluation,
  printEvaluationDetail,
  editFechaEval,
  deleteFechaEval,
  openFechaEvalModal,
  saveFechaEval,
  editDepartamento,
  deleteDepartamento,
  openDepartamentoModal,
  saveDepartamento,
  renderDepartamentosCrud,
  handleTrabDepartamentoChange,
  populateDepartamentosSelect,
  handleWorkerDeptFilter
} from './admin.js?v=2.2.0';
import { showWorkerChartModal, renderReporteColaboradores, printReporteColaboradores, handleReportDeptChange, printFechaEvaluacionReport, showFechaEvaluacionReport, printReporteGeneralDesdeModal, exportReporteGeneralExcel } from './reports.js?v=2.2.0';

// Inicialización de la aplicación al cargar el DOM
document.addEventListener("DOMContentLoaded", async () => {
  try {
    // Inicializar cliente de Supabase cargando .env dinámicamente
    await initSupabase();

    // Inicializar tema guardado
    initTheme();
    
    // Verificar sesión existente
    await checkSession();
    
    // Registrar eventos estáticos globales en el DOM cargado
    document.getElementById('loginForm')?.addEventListener('submit', handleLogin);
  } catch (err) {
    console.error("Error crítico de inicialización de aplicación:", err);
  }
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
window.handleEvalWorkerDeptFilter = handleEvalWorkerDeptFilter;
window.changeEvalsPage = changeEvalsPage;
window.printMainEvaluationForm = printMainEvaluationForm;

// CRUD Trabajadores
window.editTrabajador = editTrabajador;
window.deleteTrabajador = deleteTrabajador;
window.changeWorkersPage = changeWorkersPage;
window.handleWorkerSearch = handleWorkerSearch;
window.handleWorkerDeptFilter = handleWorkerDeptFilter;
window.openTrabajadorModal = openTrabajadorModal;
window.saveTrabajador = saveTrabajador;
window.handleTrabTipoChange = handleTrabTipoChange;

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
window.renderAspectosCrud = renderAspectosCrud;

// Cierre de Evaluaciones
window.toggleEvaluationStatus = toggleEvaluationStatus;
window.showEvaluationDetail = showEvaluationDetail;
window.confirmDeleteEvaluation = confirmDeleteEvaluation;
window.handleCierreSearch = handleCierreSearch;
window.changeCierrePage = changeCierrePage;
window.printEvaluationDetail = printEvaluationDetail;

// CRUD Fechas
window.editFechaEval = editFechaEval;
window.deleteFechaEval = deleteFechaEval;
window.openFechaEvalModal = openFechaEvalModal;
window.saveFechaEval = saveFechaEval;

// CRUD Departamentos (Unidades Administrativas)
window.editDepartamento = editDepartamento;
window.deleteDepartamento = deleteDepartamento;
window.openDepartamentoModal = openDepartamentoModal;
window.saveDepartamento = saveDepartamento;
window.renderDepartamentosCrud = renderDepartamentosCrud;
window.handleTrabDepartamentoChange = handleTrabDepartamentoChange;
window.populateDepartamentosSelect = populateDepartamentosSelect;

// Reportes y Gráficos
window.showWorkerChartModal = showWorkerChartModal;
window.renderReporteColaboradores = renderReporteColaboradores;
window.printReporteColaboradores = printReporteColaboradores;
window.handleReportDeptChange = handleReportDeptChange;
window.printFechaEvaluacionReport = printFechaEvaluacionReport;
window.showFechaEvaluacionReport = showFechaEvaluacionReport;
window.printReporteGeneralDesdeModal = printReporteGeneralDesdeModal;
window.exportReporteGeneralExcel = exportReporteGeneralExcel;
