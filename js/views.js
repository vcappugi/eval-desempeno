// js/views.js - Control de vistas, temas y navegación SPA

import { state } from './state.js';
import { ensureTemplateLoaded } from './utils.js';
import { renderSubordinados, closeEvaluationForm } from './evaluations.js';
import { renderIndicadoresGenerales, initReporteSubordinadosFilters, renderReporteSubordinados } from './reports.js';
import { renderTrabajadoresCrud, renderCompetenciasCrud, renderAspectosCrud, renderCierreEvaluaciones, renderFechasEvalCrud } from './admin.js';

export async function switchView(viewName) {
  state.activeView = viewName;
  
  // Toggle active class en links de navegación
  const navLinks = {
    evaluaciones: 'navEvaluaciones',
    indicadores: 'navIndicadores',
    reporteSubordinados: 'navReporteSubordinados',
    admin: 'navAdmin'
  };
  
  Object.keys(navLinks).forEach(view => {
    const el = document.getElementById(navLinks[view]);
    if (el) el.classList.toggle('active', view === viewName);
  });
  
  // Cargar y mostrar la vista correspondiente
  if (viewName === 'evaluaciones') {
    await ensureTemplateLoaded('viewEvaluaciones', 'views/evaluaciones.html', 'viewsContainer');
    document.getElementById('viewEvaluaciones').style.display = 'block';
    hideOtherViews('viewEvaluaciones');
    
    // Resetear filtros al ingresar a la vista
    state.evalsSearchQuery = '';
    state.evalsCurrentPage = 1;
    const searchInput = document.getElementById('searchEvalWorkerInput');
    if (searchInput) searchInput.value = '';
    
    renderSubordinados();
    closeEvaluationForm();
  } else if (viewName === 'indicadores') {
    await ensureTemplateLoaded('viewIndicadores', 'views/indicadores.html', 'viewsContainer');
    document.getElementById('viewIndicadores').style.display = 'block';
    hideOtherViews('viewIndicadores');
    renderIndicadoresGenerales();
  } else if (viewName === 'reporteSubordinados') {
    await ensureTemplateLoaded('viewReporteSubordinados', 'views/reporteSubordinados.html', 'viewsContainer');
    document.getElementById('viewReporteSubordinados').style.display = 'block';
    hideOtherViews('viewReporteSubordinados');
    initReporteSubordinadosFilters();
    renderReporteSubordinados();
  } else if (viewName === 'admin' && state.currentUser.rol === 'admin') {
    await ensureTemplateLoaded('viewAdmin', 'views/admin.html', 'viewsContainer');
    document.getElementById('viewAdmin').style.display = 'block';
    hideOtherViews('viewAdmin');
    switchAdminTab(state.activeAdminTab);
  }
  
  // En móviles, colapsar sidebar al cambiar de vista
  if (window.innerWidth <= 991) {
    toggleSidebar(false);
  }
}

function hideOtherViews(activeViewId) {
  const views = ['viewEvaluaciones', 'viewIndicadores', 'viewReporteSubordinados', 'viewAdmin'];
  views.forEach(v => {
    if (v !== activeViewId) {
      const el = document.getElementById(v);
      if (el) el.style.display = 'none';
    }
  });
}

export function switchAdminTab(tabName) {
  state.activeAdminTab = tabName;
  
  // Activar clase en los tabs de forma eficiente usando el atributo onclick
  const tabLinks = document.querySelectorAll('.admin-tabs .tab-link');
  tabLinks.forEach(link => {
    const onclickAttr = link.getAttribute('onclick') || '';
    const isTabActive = onclickAttr.includes(tabName);
    link.classList.toggle('active', isTabActive);
  });
  
  // Mostrar el contenido del tab
  document.getElementById('adminTabTrabajadores').style.display = tabName === 'trabajadores' ? 'block' : 'none';
  document.getElementById('adminTabCompetencias').style.display = tabName === 'competencias' ? 'block' : 'none';
  document.getElementById('adminTabAspectos').style.display = tabName === 'aspectos' ? 'block' : 'none';
  document.getElementById('adminTabCierre').style.display = tabName === 'cierre' ? 'block' : 'none';
  document.getElementById('adminTabFechas').style.display = tabName === 'fechas' ? 'block' : 'none';
  
  // Renderizar información correspondiente
  if (tabName === 'trabajadores') renderTrabajadoresCrud();
  else if (tabName === 'competencias') renderCompetenciasCrud();
  else if (tabName === 'aspectos') renderAspectosCrud();
  else if (tabName === 'cierre') renderCierreEvaluaciones();
  else if (tabName === 'fechas') renderFechasEvalCrud();
}

export function toggleSidebar(forceState) {
  const sidebar = document.getElementById('appSidebar');
  const content = document.getElementById('mainContent');
  const overlay = document.getElementById('sidebarOverlay');
  
  if (!sidebar) return;
  
  if (forceState !== undefined) {
    if (forceState) {
      sidebar.classList.remove('collapsed');
      sidebar.classList.add('active');
      content.classList.remove('expanded');
      overlay.classList.add('active');
    } else {
      sidebar.classList.add('collapsed');
      sidebar.classList.remove('active');
      content.classList.add('expanded');
      overlay.classList.remove('active');
    }
  } else {
    const isCollapsed = sidebar.classList.toggle('collapsed');
    sidebar.classList.toggle('active', !isCollapsed);
    content.classList.toggle('expanded', isCollapsed);
    overlay.classList.toggle('active', !isCollapsed);
  }
}

// ================= ESTILOS Y TEMAS =================

export function initTheme() {
  const savedTheme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeIcon(savedTheme);
}

export function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
  updateThemeIcon(newTheme);
}

function updateThemeIcon(theme) {
  const icon = document.getElementById('themeIcon');
  if (icon) {
    if (theme === 'dark') {
      icon.className = 'fa-solid fa-sun';
    } else {
      icon.className = 'fa-solid fa-moon';
    }
  }
}
