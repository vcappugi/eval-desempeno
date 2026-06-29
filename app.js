// app.js - Lógica del Sistema de Evaluación de Desempeño BEL

// Cliente de Supabase (se inicializa en DOMContentLoaded)
let supabaseClient = null;

// Variables de Estado de la Aplicación
let currentUser = null;
let activeView = 'login';
let activeAdminTab = 'trabajadores';
let workersCurrentPage = 1;
const workersPerPage = 20;
let workersSearchQuery = '';

// Cachés de Datos de la Base de Datos
let workersCache = [];
let classesCache = [];
let aspectsCache = [];
let evaluationsCache = [];

// Helper para decodificar campos JSON de Supabase de forma segura (soporta objeto pre-parseado o string)
function safeParseJSON(field) {
  if (field === null || field === undefined) return null;
  if (typeof field === 'object') return field;
  try {
    return JSON.parse(field);
  } catch (e) {
    console.error("Error al parsear JSON:", e, field);
    return null;
  }
}

// Inicialización al cargar el documento
document.addEventListener("DOMContentLoaded", () => {
  const SUPABASE_URL = "https://qpyjdbchqbegqacurcdp.supabase.co";
  const SUPABASE_ANON_KEY = "sb_publishable_OfcpnM3O1aZl2mC1GL1_aA_wBltlze2";
  supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  initTheme();
  checkSession();
  
  // Registrar eventos globales
  document.getElementById('loginForm')?.addEventListener('submit', handleLogin);
});

// ================= ESTILOS Y TEMAS =================

function initTheme() {
  const savedTheme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeIcon(savedTheme);
}

function toggleTheme() {
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

function toggleSidebar(forceState) {
  const sidebar = document.getElementById('appSidebar');
  const content = document.getElementById('mainContent');
  const overlay = document.getElementById('sidebarOverlay');
  
  if (!sidebar) return;
  
  if (forceState !== undefined) {
    if (forceState) {
      sidebar.classList.remove('collapsed');
      content.classList.remove('expanded');
      overlay.classList.add('active');
    } else {
      sidebar.classList.add('collapsed');
      content.classList.add('expanded');
      overlay.classList.remove('active');
    }
  } else {
    const isCollapsed = sidebar.classList.toggle('collapsed');
    content.classList.toggle('expanded', isCollapsed);
    overlay.classList.toggle('active', !isCollapsed);
  }
}

// Helper para Toasts (Notificaciones)
function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  
  const toast = document.createElement('div');
  toast.className = `alert-toast ${type}`;
  
  const iconClass = type === 'success' ? 'fa-circle-check' : 'fa-triangle-exclamation';
  toast.innerHTML = `
    <i class="fa-solid ${iconClass}"></i>
    <div>${message}</div>
  `;
  
  container.appendChild(toast);
  
  // Remover después de 4 segundos
  setTimeout(() => {
    toast.style.animation = 'slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) reverse';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// RLS Error Helper
function handleRlsError(err) {
  console.error("DB Error:", err);
  if (err.code === '42501') {
    showToast(
      "Error RLS: Acceso de escritura bloqueado en Supabase. Por favor, desactive RLS o agregue políticas en Supabase SQL Editor para 'item_evaluacion' y 'evaluacion'.",
      "error"
    );
  } else {
    showToast(err.message || "Error al realizar la operación en la Base de Datos.", "error");
  }
}

// ================= AUTENTICACIÓN Y SESIÓN =================

function checkSession() {
  const savedUser = localStorage.getItem('sessionUser') || sessionStorage.getItem('sessionUser');
  if (savedUser) {
    try {
      currentUser = JSON.parse(savedUser);
      loginSuccess(currentUser);
    } catch (e) {
      localStorage.removeItem('sessionUser');
      sessionStorage.removeItem('sessionUser');
      showLoginView();
    }
  } else {
    showLoginView();
  }
}

async function handleLogin(event) {
  event.preventDefault();
  const usernameInput = document.getElementById('loginUsername').value.trim();
  const passwordInput = document.getElementById('loginPassword').value;
  const rememberMe = document.getElementById('rememberMe').checked;
  const submitBtn = document.getElementById('loginSubmitBtn');
  
  if (!usernameInput || !passwordInput) {
    showToast("Por favor complete todos los campos.", "error");
    return;
  }
  
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Autenticando...';
  
  try {
    // Buscar en la tabla 'trabajador' por usuario o cédula
    const { data, error } = await supabaseClient
      .from('trabajador')
      .select('*')
      .or(`usuario.eq."${usernameInput}",cedula.eq."${usernameInput}"`);
      
    if (error) throw error;
    
    if (!data || data.length === 0) {
      showToast("Usuario o contraseña incorrectos.", "error");
      return;
    }
    
    const user = data[0];
    
    // Verificar contraseña (clave)
    if (user.clave !== passwordInput) {
      showToast("Usuario o contraseña incorrectos.", "error");
      return;
    }
    
    currentUser = user;
    
    // Guardar sesión
    const userString = JSON.stringify(currentUser);
    if (rememberMe) {
      localStorage.setItem('sessionUser', userString);
    } else {
      sessionStorage.setItem('sessionUser', userString);
    }
    
    showToast(`¡Bienvenido, ${currentUser.nombre}!`);
    loginSuccess(currentUser);
    
  } catch (err) {
    console.error("Login error:", err);
    showToast("Error en el servidor de base de datos.", "error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i class="fa-solid fa-right-to-bracket mr-2"></i> Iniciar Sesión';
  }
}

function loginSuccess(user) {
  // Configurar interfaz
  document.getElementById('loginView').style.display = 'none';
  document.getElementById('mainHeader').style.display = 'flex';
  document.getElementById('appContainer').style.display = 'flex';
  
  // Actualizar perfil lateral
  document.getElementById('userName').textContent = user.nombre;
  document.getElementById('userRole').textContent = user.rol === 'admin' ? 'Administrador' : 'Supervisor';
  document.getElementById('userAvatar').textContent = user.nombre.charAt(0).toUpperCase();
  
  // Mostrar u ocultar opciones administrativas
  const adminElements = document.querySelectorAll('.admin-only');
  adminElements.forEach(el => {
    el.style.display = user.rol === 'admin' ? 'block' : 'none';
  });
  
  // Cargar cachés y activar vista por defecto
  loadCaches().then(() => {
    switchView('evaluaciones');
  });
}

function handleLogout() {
  currentUser = null;
  localStorage.removeItem('sessionUser');
  sessionStorage.removeItem('sessionUser');
  
  // Ocultar vistas principales
  document.getElementById('mainHeader').style.display = 'none';
  document.getElementById('appContainer').style.display = 'none';
  document.getElementById('loginForm').reset();
  document.getElementById('loginView').style.display = 'flex';
  
  showToast("Sesión cerrada correctamente.");
}

function showLoginView() {
  document.getElementById('loginView').style.display = 'flex';
  document.getElementById('mainHeader').style.display = 'none';
  document.getElementById('appContainer').style.display = 'none';
}

// Cargar catálogos en caché
async function loadCaches() {
  try {
    // 1. Trabajadores - cargar todos paginando desde la BD para evitar el límite de 1000 de Supabase
    let allWorkers = [];
    let from = 0;
    let to = 999;
    let hasMore = true;
    while (hasMore) {
      const workersRes = await supabaseClient
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
    workersCache = allWorkers;
    
    // 2. Competencias
    const classesRes = await supabaseClient.from('clase').select('*').order('orden');
    if (classesRes.error) throw classesRes.error;
    classesCache = classesRes.data || [];
    
    // 3. Aspectos de evaluación
    const aspectsRes = await supabaseClient.from('item_evaluacion').select('*').order('orden');
    if (aspectsRes.error) throw aspectsRes.error;
    aspectsCache = aspectsRes.data || [];
    
    // Unir con competencias (clase) en memoria para evitar depender de una clave foránea física en BD
    aspectsCache.forEach(a => {
      const parentClass = classesCache.find(c => c.id === a.clase_id);
      a.clase = parentClass ? { titulo: parentClass.titulo } : null;
    });
    
    // 4. Evaluaciones
    const evalsRes = await supabaseClient.from('evaluacion').select('*');
    if (evalsRes.error) throw evalsRes.error;
    evaluationsCache = evalsRes.data || [];
    
    // Llenar selects dinámicos en los formularios
    populateSupervisorSelects();
    populateCompetenciasSelects();
  } catch (err) {
    console.error("Error cargando cachés:", err);
    showToast("Error al sincronizar datos con el servidor.", "error");
  }
}

// ================= ENRUTAMIENTO SPA =================

function switchView(viewName) {
  activeView = viewName;
  
  // Toggle active class on links
  document.getElementById('navEvaluaciones').classList.toggle('active', viewName === 'evaluaciones');
  document.getElementById('navIndicadores')?.classList.toggle('active', viewName === 'indicadores');
  document.getElementById('navReporteSubordinados')?.classList.toggle('active', viewName === 'reporteSubordinados');
  document.getElementById('navAdmin')?.classList.toggle('active', viewName === 'admin');
  
  // Show/Hide views
  document.getElementById('viewEvaluaciones').style.display = viewName === 'evaluaciones' ? 'block' : 'none';
  document.getElementById('viewIndicadores').style.display = viewName === 'indicadores' ? 'block' : 'none';
  document.getElementById('viewReporteSubordinados').style.display = viewName === 'reporteSubordinados' ? 'block' : 'none';
  document.getElementById('viewAdmin').style.display = viewName === 'admin' ? 'block' : 'none';
  
  // Cargar datos de la vista correspondiente
  if (viewName === 'evaluaciones') {
    renderSubordinados();
    closeEvaluationForm();
  } else if (viewName === 'indicadores') {
    renderIndicadoresGenerales();
  } else if (viewName === 'reporteSubordinados') {
    initReporteSubordinadosFilters();
    renderReporteSubordinados();
  } else if (viewName === 'admin' && currentUser.rol === 'admin') {
    switchAdminTab(activeAdminTab);
  }
  
  // En móviles, colapsar sidebar al cambiar de vista
  if (window.innerWidth <= 991) {
    toggleSidebar(false);
  }
}

function switchAdminTab(tabName) {
  activeAdminTab = tabName;
  
  // Activar clase en los tabs de forma eficiente usando el atributo de texto
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
  
  // Renderizar información correspondiente
  if (tabName === 'trabajadores') renderTrabajadoresCrud();
  else if (tabName === 'competencias') renderCompetenciasCrud();
  else if (tabName === 'aspectos') renderAspectosCrud();
  else if (tabName === 'cierre') renderCierreEvaluaciones();
}

// ================= SELECTS DINÁMICOS =================

function populateSupervisorSelects() {
  const select = document.getElementById('trabSupervisor');
  if (!select) return;
  
  // Guardar valor anterior
  const val = select.value;
  
  select.innerHTML = '<option value="">Ninguno</option>';
  workersCache.forEach(worker => {
    select.innerHTML += `<option value="${worker.id}">${worker.nombre} (Ficha: ${worker.ficha || 'N/A'})</option>`;
  });
  
  select.value = val;
}

function populateCompetenciasSelects() {
  const select = document.getElementById('aspClase');
  if (!select) return;
  
  const val = select.value;
  select.innerHTML = '<option value="">Seleccione una competencia...</option>';
  classesCache.forEach(c => {
    select.innerHTML += `<option value="${c.id}">${c.titulo}</option>`;
  });
  
  select.value = val;
}

// ================= MODALS CONTROLLER =================

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.setAttribute('open', 'true');
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.removeAttribute('open');
  }
}

// ================= CRUD: TRABAJADORES =================

async function renderTrabajadoresCrud() {
  const tbody = document.getElementById('trabajadoresTableBody');
  if (!tbody) return;
  
  tbody.innerHTML = '<tr><td colspan="9" style="text-align: center;"><i class="fa-solid fa-spinner fa-spin"></i> Cargando trabajadores...</td></tr>';
  
  const startIndex = (workersCurrentPage - 1) * workersPerPage;
  const endIndex = startIndex + workersPerPage - 1;
  
  try {
    let query = supabaseClient
      .from('trabajador')
      .select('*', { count: 'exact' });
      
    if (workersSearchQuery) {
      query = query.or(`cedula.ilike.%${workersSearchQuery}%,nombre.ilike.%${workersSearchQuery}%,usuario.ilike.%${workersSearchQuery}%`);
    }
    
    const { data: paginatedWorkers, count, error } = await query
      .order('nombre')
      .range(startIndex, endIndex);
      
    if (error) throw error;
    
    const totalWorkers = count || 0;
    const totalPages = Math.max(1, Math.ceil(totalWorkers / workersPerPage));
    
    // Ajustar página actual si excede el total
    if (workersCurrentPage > totalPages) {
      workersCurrentPage = totalPages;
      renderTrabajadoresCrud();
      return;
    }
    
    tbody.innerHTML = '';
    
    // Actualizar controles de interfaz de paginación
    const rangeLabel = document.getElementById('workersShowingRange');
    const totalLabel = document.getElementById('workersTotalCount');
    const curPageLabel = document.getElementById('workersCurrentPageLabel');
    const totPagesLabel = document.getElementById('workersTotalPagesLabel');
    const prevBtn = document.getElementById('btnPrevWorkersPage');
    const nextBtn = document.getElementById('btnNextWorkersPage');
    
    const calculatedEndIndex = Math.min(startIndex + workersPerPage, totalWorkers);
    if (rangeLabel) rangeLabel.textContent = totalWorkers === 0 ? '0' : `${startIndex + 1}-${calculatedEndIndex}`;
    if (totalLabel) totalLabel.textContent = totalWorkers;
    if (curPageLabel) curPageLabel.textContent = workersCurrentPage;
    if (totPagesLabel) totPagesLabel.textContent = totalPages;
    
    if (prevBtn) prevBtn.disabled = workersCurrentPage === 1;
    if (nextBtn) nextBtn.disabled = workersCurrentPage === totalPages;
    
    // Mostrar u ocultar el contenedor de paginación
    const paginationContainer = document.getElementById('workersPaginationContainer');
    if (paginationContainer) {
      paginationContainer.style.display = totalWorkers === 0 ? 'none' : 'flex';
    }
    
    if (totalWorkers === 0) {
      tbody.innerHTML = '<tr><td colspan="9" style="text-align: center;">No se encontraron trabajadores que coincidan con la búsqueda.</td></tr>';
      return;
    }
    
    let html = '';
    paginatedWorkers.forEach(w => {
      const createdDate = w.created_at ? new Date(w.created_at).toLocaleDateString() : 'N/A';
      html += `
        <tr>
          <td><strong>${w.ficha || 'N/A'}</strong></td>
          <td>${w.cedula}</td>
          <td>${w.nombre}</td>
          <td>${w.empresa}</td>
          <td>${w.departamento}</td>
          <td>${w.cargo}</td>
          <td><mark style="background-color: ${w.rol === 'admin' ? '#dcfce7' : '#f3f4f6'}; color: ${w.rol === 'admin' ? '#15803d' : '#374151'}">${w.rol}</mark></td>
          <td>${createdDate}</td>
          <td style="text-align: right; white-space: nowrap;">
            <button class="outline secondary" style="padding: 0.25rem 0.5rem; margin-right: 0.25rem; margin-bottom: 0;" onclick="editTrabajador(${w.id})">
              <i class="fa-solid fa-pen"></i>
            </button>
            <button class="outline contrast" style="padding: 0.25rem 0.5rem; margin-bottom: 0;" onclick="deleteTrabajador(${w.id})">
              <i class="fa-solid fa-trash"></i>
            </button>
          </td>
        </tr>
      `;
    });
    tbody.innerHTML = html;
  } catch (err) {
    console.error("Error al renderizar trabajadores en admin:", err);
    tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; color: var(--form-element-invalid-border-color);">Error al cargar los trabajadores del servidor.</td></tr>';
    showToast("Error al cargar los trabajadores.", "error");
  }
}

async function changeWorkersPage(direction) {
  const newPage = workersCurrentPage + direction;
  if (newPage >= 1) {
    workersCurrentPage = newPage;
    await renderTrabajadoresCrud();
  }
}

async function handleWorkerSearch(query) {
  workersSearchQuery = query.toLowerCase().trim();
  workersCurrentPage = 1; // Reiniciar a la primera página al buscar
  await renderTrabajadoresCrud();
}

function openTrabajadorModal() {
  document.getElementById('trabajadorForm').reset();
  document.getElementById('trabajadorIdInput').value = '';
  document.getElementById('trabajadorModalTitle').textContent = 'Agregar Trabajador';
  document.getElementById('trabClave').required = true;
  
  openModal('trabajadorModal');
}

function editTrabajador(id) {
  const w = workersCache.find(worker => worker.id === id);
  if (!w) return;
  
  document.getElementById('trabajadorIdInput').value = w.id;
  document.getElementById('trabFicha').value = w.ficha || '';
  document.getElementById('trabCedula').value = w.cedula || '';
  document.getElementById('trabNombre').value = w.nombre || '';
  document.getElementById('trabEmpresa').value = w.empresa || '';
  document.getElementById('trabDepartamento').value = w.departamento || '';
  document.getElementById('trabCargo').value = w.cargo || '';
  document.getElementById('trabSupervisor').value = w.supervisor_id || '';
  document.getElementById('trabUsuario').value = w.usuario || '';
  document.getElementById('trabRol').value = w.rol || 'user';
  
  // Para editar, la clave no es obligatoria
  document.getElementById('trabClave').value = '';
  document.getElementById('trabClave').required = false;
  
  document.getElementById('trabajadorModalTitle').textContent = 'Modificar Trabajador';
  openModal('trabajadorModal');
}

async function saveTrabajador(event) {
  event.preventDefault();
  const id = document.getElementById('trabajadorIdInput').value;
  const ficha = document.getElementById('trabFicha').value.trim();
  const cedula = document.getElementById('trabCedula').value.trim();
  const nombre = document.getElementById('trabNombre').value.trim();
  const empresa = document.getElementById('trabEmpresa').value.trim();
  const departamento = document.getElementById('trabDepartamento').value.trim();
  const cargo = document.getElementById('trabCargo').value.trim();
  const supervisor_id = document.getElementById('trabSupervisor').value || null;
  const usuario = document.getElementById('trabUsuario').value.trim() || null;
  const rol = document.getElementById('trabRol').value;
  const clave = document.getElementById('trabClave').value;
  
  const payload = {
    ficha,
    cedula,
    nombre,
    empresa,
    departamento,
    cargo,
    supervisor_id: supervisor_id ? parseInt(supervisor_id) : null,
    usuario,
    rol
  };
  
  // Guardar clave solo si se ingresó (obligatoria en insert, opcional en update)
  if (clave) {
    payload.clave = clave;
  }
  
  try {
    if (id) {
      // Update
      const { error } = await supabaseClient
        .from('trabajador')
        .update(payload)
        .eq('id', id);
        
      if (error) throw error;
      showToast("Trabajador actualizado exitosamente.");
    } else {
      // Insert
      const { error } = await supabaseClient
        .from('trabajador')
        .insert([payload]);
        
      if (error) throw error;
      showToast("Trabajador creado exitosamente.");
    }
    
    closeModal('trabajadorModal');
    await loadCaches();
    await renderTrabajadoresCrud();
  } catch (err) {
    handleRlsError(err);
  }
}

async function deleteTrabajador(id) {
  const w = workersCache.find(worker => worker.id === id);
  if (!w) return;
  
  if (!confirm(`¿Está seguro de eliminar al trabajador ${w.nombre}?`)) {
    return;
  }
  
  try {
    const { error } = await supabaseClient
      .from('trabajador')
      .delete()
      .eq('id', id);
      
    if (error) throw error;
    
    showToast("Trabajador eliminado correctamente.");
    await loadCaches();
    await renderTrabajadoresCrud();
  } catch (err) {
    handleRlsError(err);
  }
}

// ================= CRUD: COMPETENCIAS (CLASE) =================

function renderCompetenciasCrud() {
  const container = document.getElementById('competenciasCardsContainer');
  if (!container) return;
  
  container.innerHTML = '';
  
  if (classesCache.length === 0) {
    container.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 2rem;">No hay competencias registradas.</div>';
    return;
  }
  
  let html = '';
  classesCache.forEach(c => {
    html += `
      <article class="premium-card competencia-card">
        <div>
          <div class="competencia-header">
            <h4 style="margin: 0; font-size: 1.1rem; color: var(--primary);">${c.titulo}</h4>
            <span class="competencia-badge">Orden: ${c.orden}</span>
          </div>
          <p style="font-size: 0.875rem; margin-bottom: 0; color: var(--muted-color); text-align: justify;">
            ${c.descripcion || 'Sin descripción.'}
          </p>
        </div>
        <div class="competencia-actions">
          <button class="outline secondary" style="padding: 0.25rem 0.5rem; flex: 1; font-size: 0.875rem; margin-bottom: 0;" onclick="editCompetencia(${c.id})">
            <i class="fa-solid fa-pen"></i> Editar
          </button>
          <button class="outline contrast" style="padding: 0.25rem 0.5rem; flex: 1; font-size: 0.875rem; margin-bottom: 0;" onclick="deleteCompetencia(${c.id})">
            <i class="fa-solid fa-trash"></i> Eliminar
          </button>
        </div>
      </article>
    `;
  });
  container.innerHTML = html;
}

function openCompetenciaModal() {
  document.getElementById('competenciaForm').reset();
  document.getElementById('competenciaIdInput').value = '';
  document.getElementById('competenciaModalTitle').textContent = 'Agregar Competencia';
  
  openModal('competenciaModal');
}

function editCompetencia(id) {
  const c = classesCache.find(comp => comp.id === id);
  if (!c) return;
  
  document.getElementById('competenciaIdInput').value = c.id;
  document.getElementById('compTitulo').value = c.titulo || '';
  document.getElementById('compDescripcion').value = c.descripcion || '';
  document.getElementById('compOrden').value = c.orden || '';
  
  document.getElementById('competenciaModalTitle').textContent = 'Modificar Competencia';
  openModal('competenciaModal');
}

async function saveCompetencia(event) {
  event.preventDefault();
  const id = document.getElementById('competenciaIdInput').value;
  const titulo = document.getElementById('compTitulo').value.trim();
  const descripcion = document.getElementById('compDescripcion').value.trim();
  const orden = parseInt(document.getElementById('compOrden').value);
  
  const payload = { titulo, descripcion, orden };
  
  try {
    if (id) {
      const { error } = await supabaseClient
        .from('clase')
        .update(payload)
        .eq('id', id);
        
      if (error) throw error;
      showToast("Competencia actualizada exitosamente.");
    } else {
      const { error } = await supabaseClient
        .from('clase')
        .insert([payload]);
        
      if (error) throw error;
      showToast("Competencia creada exitosamente.");
    }
    
    closeModal('competenciaModal');
    await loadCaches();
    renderCompetenciasCrud();
  } catch (err) {
    handleRlsError(err);
  }
}

async function deleteCompetencia(id) {
  const c = classesCache.find(comp => comp.id === id);
  if (!c) return;
  
  if (!confirm(`¿Está seguro de eliminar la competencia "${c.titulo}"? Esto puede afectar a los aspectos asociados.`)) {
    return;
  }
  
  try {
    const { error } = await supabaseClient
      .from('clase')
      .delete()
      .eq('id', id);
      
    if (error) throw error;
    
    showToast("Competencia eliminada correctamente.");
    await loadCaches();
    renderCompetenciasCrud();
  } catch (err) {
    handleRlsError(err);
  }
}

// ================= CRUD: ASPECTOS (ITEM_EVALUACION) =================

function renderAspectosCrud() {
  const tbody = document.getElementById('aspectosTableBody');
  if (!tbody) return;
  
  tbody.innerHTML = '';
  
  if (aspectsCache.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">No hay aspectos de evaluación registrados.</td></tr>';
    return;
  }
  
  let html = '';
  aspectsCache.forEach(a => {
    const claseTitulo = a.clase ? a.clase.titulo : `<span class="text-error">Desasociada (ID: ${a.clase_id})</span>`;
    let tipoBadge = '';
    if (a.tipo === 'rango1,5') tipoBadge = '<span class="badge">Rango 1-5</span>';
    else if (a.tipo === 'si/no') tipoBadge = '<span class="badge">Sí / No</span>';
    else tipoBadge = '<span class="badge">Texto Abierto</span>';
    
    html += `
      <tr>
        <td><mark style="background-color: var(--primary-focus); color: var(--primary); font-weight: 700; border-radius: 4px; padding: 0.1rem 0.4rem;">${a.orden}</mark></td>
        <td><strong>${claseTitulo}</strong></td>
        <td style="max-width: 400px; text-align: justify;">${a.descripcion}</td>
        <td>${tipoBadge}</td>
        <td style="text-align: right; white-space: nowrap;">
          <button class="outline secondary" style="padding: 0.25rem 0.5rem; margin-right: 0.25rem; margin-bottom: 0;" onclick="editAspecto(${a.id})">
            <i class="fa-solid fa-pen"></i>
          </button>
          <button class="outline contrast" style="padding: 0.25rem 0.5rem; margin-bottom: 0;" onclick="deleteAspecto(${a.id})">
            <i class="fa-solid fa-trash"></i>
          </button>
        </td>
      </tr>
    `;
  });
  tbody.innerHTML = html;
}

function openAspectoModal() {
  // Validación de que existan competencias creadas
  if (classesCache.length === 0) {
    showToast("No puede agregar aspectos si no hay competencias (clases) creadas en el sistema.", "error");
    return;
  }
  
  document.getElementById('aspectoForm').reset();
  document.getElementById('aspectoIdInput').value = '';
  document.getElementById('aspectoModalTitle').textContent = 'Agregar Aspecto a Evaluar';
  
  openModal('aspectoModal');
}

function editAspecto(id) {
  const a = aspectsCache.find(asp => asp.id === id);
  if (!a) return;
  
  document.getElementById('aspectoIdInput').value = a.id;
  document.getElementById('aspClase').value = a.clase_id || '';
  document.getElementById('aspDescripcion').value = a.descripcion || '';
  document.getElementById('aspTipo').value = a.tipo || 'rango1,5';
  document.getElementById('aspOrden').value = a.orden || '';
  
  document.getElementById('aspectoModalTitle').textContent = 'Modificar Aspecto a Evaluar';
  openModal('aspectoModal');
}

async function saveAspecto(event) {
  event.preventDefault();
  const id = document.getElementById('aspectoIdInput').value;
  const clase_id = parseInt(document.getElementById('aspClase').value);
  const descripcion = document.getElementById('aspDescripcion').value.trim();
  const tipo = document.getElementById('aspTipo').value;
  const orden = parseInt(document.getElementById('aspOrden').value);
  
  const payload = { clase_id, descripcion, tipo, orden };
  
  try {
    if (id) {
      const { error } = await supabaseClient
        .from('item_evaluacion')
        .update(payload)
        .eq('id', id);
        
      if (error) throw error;
      showToast("Aspecto de evaluación actualizado.");
    } else {
      const { error } = await supabaseClient
        .from('item_evaluacion')
        .insert([payload]);
        
      if (error) throw error;
      showToast("Aspecto de evaluación creado.");
    }
    
    closeModal('aspectoModal');
    await loadCaches();
    renderAspectosCrud();
  } catch (err) {
    handleRlsError(err);
  }
}

async function deleteAspecto(id) {
  const a = aspectsCache.find(asp => asp.id === id);
  if (!a) return;
  
  if (!confirm(`¿Está seguro de eliminar este aspecto de evaluación?`)) {
    return;
  }
  
  try {
    const { error } = await supabaseClient
      .from('item_evaluacion')
      .delete()
      .eq('id', id);
      
    if (error) throw error;
    
    showToast("Aspecto de evaluación eliminado.");
    await loadCaches();
    renderAspectosCrud();
  } catch (err) {
    handleRlsError(err);
  }
}

// ================= MÓDULO DE EVALUACIÓN (VISTA SUPERVISOR) =================

function renderSubordinados() {
  const tbody = document.getElementById('subordinadosTableBody');
  if (!tbody) return;
  
  tbody.innerHTML = '';
  
  // Buscar trabajadores cuya supervisor_id sea el ID del usuario autenticado
  const subordinados = workersCache.filter(w => w.supervisor_id === currentUser.id);
  
  if (subordinados.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem;">Usted no tiene trabajadores registrados bajo su supervisión directa.</td></tr>';
    return;
  }
  
  let html = '';
  subordinados.forEach(s => {
    // Buscar si este subordinado tiene alguna evaluación en la caché para pintar el botón del gráfico
    const tieneEvaluaciones = evaluationsCache.some(ev => {
      try {
        const parsed = safeParseJSON(ev.evaluacion);
        return parsed && parsed.trabajador_id === s.id;
      } catch(e) {
        return false;
      }
    });
    
    const miniChartIcon = tieneEvaluaciones ? 
      `<button class="outline" style="padding: 0.4rem 0.6rem; margin-bottom: 0; margin-left: 0.25rem; border-color: var(--primary); color: var(--primary);" onclick="showWorkerChartModal(${s.id})" title="Ver Gráfico de Desempeño"><i class="fa-solid fa-chart-simple"></i></button>` : 
      `<button class="outline secondary" style="padding: 0.4rem 0.6rem; margin-bottom: 0; margin-left: 0.25rem; opacity: 0.5;" onclick="showWorkerChartModal(${s.id})" title="Sin evaluaciones todavía"><i class="fa-solid fa-chart-simple"></i></button>`;

    html += `
      <tr>
        <td><strong>${s.ficha || 'N/A'}</strong></td>
        <td>${s.cedula}</td>
        <td>${s.nombre}</td>
        <td>${s.departamento}</td>
        <td>${s.cargo}</td>
        <td style="text-align: right; white-space: nowrap;">
          <button class="primary" style="padding: 0.4rem 0.8rem; font-size: 0.875rem; margin-bottom: 0;" onclick="startEvaluation(${s.id})">
            <i class="fa-solid fa-file-circle-check"></i> Evaluar / Ver
          </button>
          ${miniChartIcon}
        </td>
      </tr>
    `;
  });
  tbody.innerHTML = html;
}

function startEvaluation(trabajadorId) {
  const t = workersCache.find(worker => worker.id === trabajadorId);
  if (!t) return;
  
  // Configurar etiquetas
  document.getElementById('evaluadoIdInput').value = t.id;
  document.getElementById('evaluadoNombreLabel').textContent = t.nombre;
  document.getElementById('evaluadoFichaLabel').textContent = t.ficha || 'N/A';
  
  // Resetear formulario
  document.getElementById('evaluacionIdInput').value = '';
  document.getElementById('evalFecha').value = new Date().toISOString().split('T')[0]; // Hoy
  document.getElementById('evalEstadoLabel').value = 'Abierta (Editable)';
  document.getElementById('btnGuardarEvaluacion').disabled = false;
  
  // Renderizar formulario de competencias y aspectos
  renderEvaluationFormQuestions();
  
  // Verificar si ya existe evaluación para esta fecha (se ejecuta automáticamente por el evento onchange)
  checkEvaluationDateUnique();
  
  // Mostrar formulario de evaluación y ocultar lista
  document.getElementById('evaluationFormContainer').style.display = 'block';
  document.getElementById('subordinadosTableBody').closest('.premium-card').style.display = 'none';
}

function closeEvaluationForm() {
  document.getElementById('evaluationFormContainer').style.display = 'none';
  document.getElementById('subordinadosTableBody').closest('.premium-card').style.display = 'block';
}

function renderEvaluationFormQuestions() {
  const container = document.getElementById('dynamicCompetenciesContainer');
  if (!container) return;
  
  container.innerHTML = '';
  
  if (classesCache.length === 0) {
    container.innerHTML = '<p class="text-error">No hay competencias registradas en el sistema para evaluar.</p>';
    return;
  }
  
  if (aspectsCache.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 2rem; background: rgba(21, 128, 61, 0.05); border: 1px dashed var(--primary); border-radius: 12px; color: var(--primary);">
        <i class="fa-solid fa-triangle-exclamation" style="font-size: 2.5rem; margin-bottom: 0.75rem;"></i>
        <p style="margin: 0; font-weight: 600; font-size: 1.1rem;">No hay aspectos de evaluación registrados en la base de datos.</p>
        <p style="margin: 0.25rem 0 0 0; font-size: 0.875rem; color: var(--muted-color);">Por favor, ingrese al Panel Administrativo y agregue aspectos de evaluación para poder realizar evaluaciones.</p>
      </div>
    `;
    return;
  }
  
  // Agrupar aspectos por competencia (clase_id) ordenando por competencia y luego aspecto
  classesCache.forEach(c => {
    const aspectosDeClase = aspectsCache.filter(a => a.clase_id === c.id);
    
    // Solo renderizar la competencia si tiene aspectos de evaluación asociados
    if (aspectosDeClase.length > 0) {
      let claseHTML = `
        <div class="competencia-section">
          <h4 style="margin: 0; color: var(--primary); font-size: 1.25rem;">${c.titulo}</h4>
          <p style="font-size: 0.875rem; color: var(--muted-color); margin-bottom: 1rem; text-align: justify;">${c.descripcion || ''}</p>
          <div class="aspectos-container">
      `;
      
      aspectosDeClase.forEach(a => {
        let answerFieldHTML = '';
        
        if (a.tipo === 'rango1,5') {
          answerFieldHTML = `
            <div class="rango-container" data-aspecto-id="${a.id}">
              ${[1,2,3,4,5].map(v => `
                <label class="rango-option" id="label-asp-${a.id}-${v}" onclick="selectRangoOption(${a.id}, ${v})">
                  <input type="radio" name="aspecto_${a.id}" value="${v}" required>
                  <span>${v}</span>
                </label>
              `).join('')}
            </div>
          `;
        } else if (a.tipo === 'si/no') {
          answerFieldHTML = `
            <div class="sino-container" data-aspecto-id="${a.id}">
              <label style="display: flex; align-items: center; gap: 0.25rem; cursor: pointer; margin-bottom: 0;">
                <input type="radio" name="aspecto_${a.id}" value="si" required> Sí
              </label>
              <label style="display: flex; align-items: center; gap: 0.25rem; cursor: pointer; margin-bottom: 0;">
                <input type="radio" name="aspecto_${a.id}" value="no" required> No
              </label>
            </div>
          `;
        } else { // text
          answerFieldHTML = `
            <textarea name="aspecto_${a.id}" rows="2" placeholder="Escriba comentarios y observaciones..." required style="margin-top: 0.5rem;"></textarea>
          `;
        }
        
        claseHTML += `
          <div class="aspecto-row" data-aspecto-id="${a.id}" data-clase-id="${c.id}" data-tipo="${a.tipo}">
            <div class="aspecto-desc"><mark style="background-color: var(--primary-focus); color: var(--primary); border-radius: 4px; font-weight: 700; padding: 0.1rem 0.3rem; margin-right: 0.5rem;">${a.orden}</mark>${a.descripcion}</div>
            ${answerFieldHTML}
          </div>
        `;
      });
      
      claseHTML += `
          </div>
        </div>
      `;
      
      container.innerHTML += claseHTML;
    }
  });
}

// Lógica de selección de botón de rango 1-5
function selectRangoOption(aspectoId, valor) {
  // Deseleccionar todas las opciones del rango
  for (let i = 1; i <= 5; i++) {
    const label = document.getElementById(`label-asp-${aspectoId}-${i}`);
    if (label) label.classList.remove('selected');
  }
  
  // Seleccionar la opción clickeada
  const activeLabel = document.getElementById(`label-asp-${aspectoId}-${valor}`);
  if (activeLabel) {
    activeLabel.classList.add('selected');
    const radio = activeLabel.querySelector('input[type="radio"]');
    if (radio) radio.checked = true;
  }
}

// Verificar si existe evaluación previa en la fecha seleccionada
function checkEvaluationDateUnique() {
  const trabajadorId = parseInt(document.getElementById('evaluadoIdInput').value);
  const fecha = document.getElementById('evalFecha').value;
  
  if (!trabajadorId || !fecha) return;
  
  // Limpiar respuestas previas en el formulario antes de rellenar
  resetAnswersInForm();
  
  // Buscar en las evaluaciones cargadas en caché
  // En las evaluaciones, 'evaluacion' contiene JSON: {"trabajador_id": X, "valor": Y}
  const evalRows = evaluationsCache.filter(ev => {
    if (ev.fecha !== fecha) return false;
    try {
      const parsed = safeParseJSON(ev.evaluacion);
      return parsed && parsed.trabajador_id === trabajadorId;
    } catch(e) {
      return false;
    }
  });
  
  if (evalRows.length > 0) {
    // Ya existe evaluación para este trabajador en esta fecha!
    const isClosed = evalRows[0].estado === true;
    
    document.getElementById('evalEstadoLabel').value = isClosed ? 'Cerrada (Lectura Única)' : 'Abierta (Modificable)';
    document.getElementById('btnGuardarEvaluacion').disabled = isClosed;
    
    // Rellenar las respuestas en el formulario
    evalRows.forEach(row => {
      try {
        const parsed = safeParseJSON(row.evaluacion);
        const rating = parsed ? parsed.valor : '';
        const aspectoId = row.item_evaluacion_id;
        
        // Buscar el elemento de respuesta
        const aspectoRow = document.querySelector(`.aspecto-row[data-aspecto-id="${aspectoId}"]`);
        if (aspectoRow) {
          const tipo = aspectoRow.getAttribute('data-tipo');
          
          if (tipo === 'rango1,5') {
            selectRangoOption(aspectoId, parseInt(rating));
          } else if (tipo === 'si/no') {
            const radio = aspectoRow.querySelector(`input[value="${rating.toLowerCase()}"]`);
            if (radio) radio.checked = true;
          } else {
            const textarea = aspectoRow.querySelector('textarea');
            if (textarea) textarea.value = rating;
          }
          
          // Deshabilitar campos si está cerrada
          disableFieldsInRow(aspectoRow, isClosed);
        }
      } catch (e) {
        console.error("Error al parsear respuesta cargada:", e);
      }
    });
    
    // Deshabilitar la selección de fecha si la evaluación existe para protegerla
    document.getElementById('evalFecha').disabled = isClosed;
    
    showToast(`Cargada evaluación existente del ${new Date(fecha).toLocaleDateString()}. Status: ${isClosed ? 'Cerrada' : 'Abierta'}.`, "info");
  } else {
    // Es una nueva evaluación
    document.getElementById('evalEstadoLabel').value = 'Abierta (Editable)';
    document.getElementById('btnGuardarEvaluacion').disabled = false;
    document.getElementById('evalFecha').disabled = false;
    
    // Asegurar que todos los campos del formulario estén habilitados
    const rows = document.querySelectorAll('.aspecto-row');
    rows.forEach(r => disableFieldsInRow(r, false));
  }
}

function resetAnswersInForm() {
  const radioButtons = document.querySelectorAll('#dynamicCompetenciesContainer input[type="radio"]');
  radioButtons.forEach(radio => radio.checked = false);
  
  const textareas = document.querySelectorAll('#dynamicCompetenciesContainer textarea');
  textareas.forEach(ta => ta.value = '');
  
  const rangoLabels = document.querySelectorAll('.rango-option');
  rangoLabels.forEach(l => l.classList.remove('selected'));
}

function disableFieldsInRow(rowElement, disable) {
  const inputs = rowElement.querySelectorAll('input, textarea');
  inputs.forEach(el => el.disabled = disable);
  
  const labels = rowElement.querySelectorAll('.rango-option');
  labels.forEach(l => {
    if (disable) {
      l.style.pointerEvents = 'none';
      l.style.opacity = '0.7';
    } else {
      l.style.pointerEvents = 'auto';
      l.style.opacity = '1';
    }
  });
}

// Guardar/Actualizar Evaluación
async function saveEvaluation(event) {
  event.preventDefault();
  const trabajadorId = parseInt(document.getElementById('evaluadoIdInput').value);
  const fecha = document.getElementById('evalFecha').value;
  const estadoLabel = document.getElementById('evalEstadoLabel').value;
  
  if (estadoLabel.includes('Cerrada')) {
    showToast("No se puede guardar una evaluación cerrada.", "error");
    return;
  }
  
  // Buscar filas existentes en base de datos para esta combinación (trabajador, fecha)
  const existingRows = evaluationsCache.filter(ev => {
    if (ev.fecha !== fecha) return false;
    try {
      const parsed = safeParseJSON(ev.evaluacion);
      return parsed && parsed.trabajador_id === trabajadorId;
    } catch(e) {
      return false;
    }
  });
  
  // Recopilar respuestas del formulario
  const rows = document.querySelectorAll('.aspecto-row');
  const insertPayloads = [];
  
  let valid = true;
  
  rows.forEach(r => {
    const aspectoId = parseInt(r.getAttribute('data-aspecto-id'));
    const claseId = parseInt(r.getAttribute('data-clase-id'));
    const tipo = r.getAttribute('data-tipo');
    
    let answerValue = '';
    
    if (tipo === 'rango1,5') {
      const checkedRadio = r.querySelector('input[type="radio"]:checked');
      if (checkedRadio) answerValue = checkedRadio.value;
    } else if (tipo === 'si/no') {
      const checkedRadio = r.querySelector('input[type="radio"]:checked');
      if (checkedRadio) answerValue = checkedRadio.value;
    } else {
      const textarea = r.querySelector('textarea');
      if (textarea) answerValue = textarea.value.trim();
    }
    
    if (!answerValue) {
      valid = false;
      return;
    }
    
    // Determinar si ya existía una fila para este aspecto
    const existingRow = existingRows.find(ev => ev.item_evaluacion_id === aspectoId);
    
    const payload = {
      clase_id: claseId,
      item_evaluacion_id: aspectoId,
      fecha: fecha,
      estado: false, // Por defecto abierta al guardar
      evaluacion: JSON.stringify({
        trabajador_id: trabajadorId,
        valor: answerValue
      })
    };
    
    if (existingRow) {
      payload.id = existingRow.id; // Incluir ID para que haga UPDATE/UPSERT correcto
    }
    
    insertPayloads.push(payload);
  });
  
  if (!valid) {
    showToast("Por favor responda a todos los aspectos de evaluación.", "error");
    return;
  }
  
  try {
    // Guardar (upsert) en la tabla 'evaluacion'
    const { error } = await supabaseClient
      .from('evaluacion')
      .upsert(insertPayloads);
      
    if (error) throw error;
    
    showToast("Evaluación guardada exitosamente.");
    
    closeEvaluationForm();
    await loadCaches();
    renderSubordinados();
  } catch (err) {
    handleRlsError(err);
  }
}

// ================= TAB: CIERRE DE EVALUACIONES (ADMIN) =================

function renderCierreEvaluaciones() {
  const tbody = document.getElementById('cierreEvaluacionesTableBody');
  if (!tbody) return;
  
  tbody.innerHTML = '';
  
  // Agrupar evaluaciones de la caché por (trabajador_id, fecha)
  const grouped = {};
  
  evaluationsCache.forEach(ev => {
    try {
      const parsed = safeParseJSON(ev.evaluacion);
      const trabajadorId = parsed ? parsed.trabajador_id : null;
      if (!trabajadorId) return;
      const key = `${trabajadorId}_${ev.fecha}`;
      
      if (!grouped[key]) {
        grouped[key] = {
          trabajadorId: trabajadorId,
          fecha: ev.fecha,
          estado: ev.estado,
          aspectos: 0,
          rowIds: []
        };
      }
      
      grouped[key].aspectos++;
      grouped[key].rowIds.push(ev.id);
      
      // Si alguna fila está cerrada, representamos la evaluación grupal como cerrada
      if (ev.estado === true) {
        grouped[key].estado = true;
      }
    } catch(e) {
      // Ignorar filas corruptas o que no correspondan
    }
  });
  
  const groupsList = Object.values(grouped).sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  
  if (groupsList.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem;">No se han realizado evaluaciones aún.</td></tr>';
    return;
  }
  
  let html = '';
  groupsList.forEach((group, index) => {
    const worker = workersCache.find(w => w.id === group.trabajadorId);
    const workerLabel = worker ? `${worker.nombre} (Ficha: ${worker.ficha || 'N/A'})` : `Desconocido (ID: ${group.trabajadorId})`;
    const statusText = group.estado ? 
      '<span class="badge" style="background-color: var(--primary); color: #ffffff;">Cerrada (Finalizada)</span>' : 
      '<span class="badge" style="background-color: #eab308; color: #ffffff;">Abierta (Editable)</span>';
      
    const toggleButton = group.estado ? 
      `<button class="outline secondary" style="padding: 0.25rem 0.5rem; margin-bottom: 0;" onclick="toggleEvaluationStatus('${group.trabajadorId}', '${group.fecha}', false)">Reabrir</button>` : 
      `<button class="primary" style="padding: 0.25rem 0.5rem; margin-bottom: 0;" onclick="toggleEvaluationStatus('${group.trabajadorId}', '${group.fecha}', true)"><i class="fa-solid fa-lock"></i> Cerrar</button>`;
      
    html += `
      <tr>
        <td>#${index + 1}</td>
        <td><strong>${workerLabel}</strong></td>
        <td>${new Date(group.fecha).toLocaleDateString()}</td>
        <td>${group.aspectos} aspectos evaluados</td>
        <td>${statusText}</td>
        <td style="text-align: right; white-space: nowrap;">
          ${toggleButton}
        </td>
      </tr>
    `;
  });
  tbody.innerHTML = html;
}

async function toggleEvaluationStatus(trabajadorId, fecha, closeStatus) {
  const tId = parseInt(trabajadorId);
  
  // Buscar todas las filas de la base de datos que corresponden a este trabajador y fecha
  const rowsToUpdate = evaluationsCache.filter(ev => {
    if (ev.fecha !== fecha) return false;
    try {
      const parsed = safeParseJSON(ev.evaluacion);
      return parsed && parsed.trabajador_id === tId;
    } catch(e) {
      return false;
    }
  });
  
  if (rowsToUpdate.length === 0) return;
  
  // Crear payloads de actualización
  const updates = rowsToUpdate.map(row => ({
    id: row.id,
    clase_id: row.clase_id,
    item_evaluacion_id: row.item_evaluacion_id,
    fecha: row.fecha,
    estado: closeStatus,
    evaluacion: row.evaluacion
  }));
  
  try {
    const { error } = await supabaseClient
      .from('evaluacion')
      .upsert(updates);
      
    if (error) throw error;
    
    showToast(`Evaluación ${closeStatus ? 'cerrada' : 'reabierta'} correctamente.`);
    await loadCaches();
    renderCierreEvaluaciones();
  } catch (err) {
    handleRlsError(err);
  }
}

function renderIndicadoresGenerales() {
  // 1. Total Trabajadores
  const totalTrabajadores = workersCache.length;
  document.getElementById('indTotalTrabajadores').textContent = totalTrabajadores;
  
  // 2. Agrupar evaluaciones por (trabajador_id, fecha)
  const groupedEvals = {};
  let totalAspectosEvaluados = 0;
  let sumaCalificaciones = 0;
  let cuentaCalificaciones = 0;
  let evalsAbiertas = 0;
  let evalsCerradas = 0;
  const evaluadosSet = new Set();
  
  // Para promedios por competencia
  const competenciaSuma = {};
  const competenciaCuenta = {};
  
  evaluationsCache.forEach(ev => {
    try {
      const parsed = safeParseJSON(ev.evaluacion);
      if (!parsed) return;
      const trabajadorId = parsed.trabajador_id;
      const valor = parsed.valor;
      const key = `${trabajadorId}_${ev.fecha}`;
      
      evaluadosSet.add(trabajadorId);
      totalAspectosEvaluados++;
      
      // Agrupar
      if (!groupedEvals[key]) {
        groupedEvals[key] = {
          trabajadorId: trabajadorId,
          fecha: ev.fecha,
          estado: ev.estado
        };
      } else if (ev.estado === true) {
        groupedEvals[key].estado = true;
      }
      
      // Si el aspecto es de tipo numérico (rango1,5), calculamos promedios
      const aspecto = aspectsCache.find(a => a.id === ev.item_evaluacion_id);
      if (aspecto && aspecto.tipo === 'rango1,5') {
        const valNum = parseFloat(valor);
        if (!isNaN(valNum)) {
          sumaCalificaciones += valNum;
          cuentaCalificaciones++;
          
          // Agrupar por competencia (clase_id)
          const claseId = ev.clase_id;
          if (claseId) {
            if (!competenciaSuma[claseId]) {
              competenciaSuma[claseId] = 0;
              competenciaCuenta[claseId] = 0;
            }
            competenciaSuma[claseId] += valNum;
            competenciaCuenta[claseId]++;
          }
        }
      }
    } catch(e) {
      // Ignorar filas inválidas
    }
  });
  
  // Contar abiertas y cerradas grupales
  Object.values(groupedEvals).forEach(g => {
    if (g.estado) {
      evalsCerradas++;
    } else {
      evalsAbiertas++;
    }
  });
  
  const totalEvaluacionesHechas = Object.keys(groupedEvals).length;
  document.getElementById('indTotalEvaluaciones').textContent = totalEvaluacionesHechas;
  
  // 3. Calificación Promedio General
  const promedioGeneral = cuentaCalificaciones > 0 ? (sumaCalificaciones / cuentaCalificaciones).toFixed(1) : '0.0';
  document.getElementById('indPromedioGeneral').textContent = `${promedioGeneral} / 5`;
  
  // 4. Tasa de Participación (% de personal evaluado)
  const pctEvaluados = totalTrabajadores > 0 ? Math.round((evaluadosSet.size / totalTrabajadores) * 100) : 0;
  document.getElementById('indPorcentajeEvaluados').textContent = `${pctEvaluados}%`;
  
  // 5. Estado de las Evaluaciones
  document.getElementById('indEvalsAbiertas').textContent = evalsAbiertas;
  document.getElementById('indEvalsCerradas').textContent = evalsCerradas;
  document.getElementById('indTotalAspectosEvaluados').textContent = totalAspectosEvaluados;
  
  // 6. Renderizar Competencias List
  const compContainer = document.getElementById('indCompetenciasList');
  if (compContainer) {
    compContainer.innerHTML = '';
    
    if (classesCache.length === 0) {
      compContainer.innerHTML = '<p style="text-align: center; color: var(--muted-color); font-size: 0.875rem;">No hay competencias registradas.</p>';
    } else {
      classesCache.forEach(c => {
        const suma = competenciaSuma[c.id] || 0;
        const cuenta = competenciaCuenta[c.id] || 0;
        const promedio = cuenta > 0 ? (suma / cuenta).toFixed(1) : null;
        
        const pctBarra = promedio ? (parseFloat(promedio) / 5) * 100 : 0;
        const promedioLabel = promedio ? `${promedio} / 5` : 'Sin calificaciones';
        
        compContainer.innerHTML += `
          <div>
            <div style="display: flex; justify-content: space-between; font-size: 0.875rem; font-weight: 500; margin-bottom: 0.25rem;">
              <span style="color: var(--contrast);">${c.titulo}</span>
              <span style="color: var(--primary); font-weight: 600;">${promedioLabel}</span>
            </div>
            <div style="background-color: var(--border-color); height: 8px; border-radius: 4px; overflow: hidden; width: 100%;">
              <div style="background-color: var(--primary); height: 100%; width: ${pctBarra}%; border-radius: 4px; transition: width 0.3s ease;"></div>
            </div>
          </div>
        `;
      });
    }
  }
}

let currentChartInstance = null;

function showWorkerChartModal(workerId) {
  const w = workersCache.find(worker => worker.id === workerId);
  if (!w) return;
  
  document.getElementById('chartWorkerName').textContent = w.nombre;
  document.getElementById('chartWorkerFicha').textContent = w.ficha || 'N/A';
  document.getElementById('chartWorkerCargo').textContent = w.cargo || 'N/A';
  
  // Buscar todas las filas de evaluaciones en caché para este trabajador
  const workerEvals = evaluationsCache.filter(ev => {
    try {
      const parsed = safeParseJSON(ev.evaluacion);
      return parsed && parsed.trabajador_id === workerId;
    } catch(e) {
      return false;
    }
  });
  
  const canvas = document.getElementById('workerChartCanvas');
  const noDataMsg = document.getElementById('chartNoDataMsg');
  const percentSpan = document.getElementById('chartScorePercent');
  const scoreLabel = document.getElementById('chartScoreLabel');
  const dateLabel = document.getElementById('chartDateLabel');
  
  // Destruir gráfico anterior si existe
  if (currentChartInstance) {
    currentChartInstance.destroy();
    currentChartInstance = null;
  }
  
  if (workerEvals.length === 0) {
    // Sin datos
    canvas.style.display = 'none';
    noDataMsg.style.display = 'block';
    percentSpan.textContent = '0%';
    scoreLabel.textContent = 'Sin Evaluaciones';
    dateLabel.textContent = 'Evaluado el: -';
    
    const circleContainer = percentSpan.parentElement;
    if (circleContainer) {
      circleContainer.style.borderColor = 'var(--border-color)';
    }
    
    openModal('workerChartModal');
    return;
  }
  
  // Con datos
  canvas.style.display = 'block';
  noDataMsg.style.display = 'none';
  
  // Agrupar por competencia (clase_id) y calcular el promedio
  const compSuma = {};
  const compCuenta = {};
  let totalSuma = 0;
  let totalCuenta = 0;
  let ultimaFecha = null;
  
  workerEvals.forEach(ev => {
    try {
      const parsed = safeParseJSON(ev.evaluacion);
      if (!parsed) return;
      const valor = parseFloat(parsed.valor);
      
      // Tomar la fecha más reciente de evaluación
      if (!ultimaFecha || new Date(ev.fecha) > new Date(ultimaFecha)) {
        ultimaFecha = ev.fecha;
      }
      
      const aspecto = aspectsCache.find(a => a.id === ev.item_evaluacion_id);
      if (aspecto && aspecto.tipo === 'rango1,5' && !isNaN(valor)) {
        const claseId = ev.clase_id;
        if (!compSuma[claseId]) {
          compSuma[claseId] = 0;
          compCuenta[claseId] = 0;
        }
        compSuma[claseId] += valor;
        compCuenta[claseId]++;
        
        totalSuma += valor;
        totalCuenta++;
      }
    } catch(e) {}
  });
  
  // Calcular porcentaje general
  const promedioGeneral = totalCuenta > 0 ? (totalSuma / totalCuenta) : 0;
  const porcentajeGeneral = promedioGeneral > 0 ? Math.round((promedioGeneral / 5) * 100) : 0;
  
  percentSpan.textContent = `${porcentajeGeneral}%`;
  
  // Modificar color de borde del círculo dinámicamente según el desempeño
  const circleContainer = percentSpan.parentElement;
  if (circleContainer) {
    if (porcentajeGeneral >= 90) {
      circleContainer.style.borderColor = 'var(--primary)'; // Verde primario (excelente)
    } else if (porcentajeGeneral >= 70) {
      circleContainer.style.borderColor = 'var(--primary-hover)'; // Verde suave (cumple)
    } else if (porcentajeGeneral >= 50) {
      circleContainer.style.borderColor = '#eab308'; // Amarillo (regular)
    } else {
      circleContainer.style.borderColor = '#ef4444'; // Rojo (bajo)
    }
  }
  
  // Clasificar resultado
  let clasificacion = 'No evaluado';
  if (porcentajeGeneral >= 90) clasificacion = 'Excelente (Sobresaliente)';
  else if (porcentajeGeneral >= 75) clasificacion = 'Bueno (Cumple expectativas)';
  else if (porcentajeGeneral >= 55) clasificacion = 'Regular (Requiere tutoría)';
  else if (porcentajeGeneral > 0) clasificacion = 'Deficiente (Bajo desempeño)';
  
  scoreLabel.textContent = clasificacion;
  dateLabel.textContent = `Evaluado el: ${ultimaFecha ? new Date(ultimaFecha).toLocaleDateString() : 'N/A'}`;
  
  // Preparar datos para el gráfico
  const labels = [];
  const scores = [];
  
  classesCache.forEach(c => {
    const suma = compSuma[c.id] || 0;
    const cuenta = compCuenta[c.id] || 0;
    const promedio = cuenta > 0 ? parseFloat((suma / cuenta).toFixed(1)) : 0;
    
    // Solo mostrar competencias que tengan datos evaluados para este trabajador
    if (cuenta > 0) {
      labels.push(c.titulo);
      scores.push(promedio);
    }
  });
  
  // Si por alguna razón no hay aspectos numéricos pero hay respuestas
  if (scores.length === 0) {
    canvas.style.display = 'none';
    noDataMsg.style.display = 'block';
    openModal('workerChartModal');
    return;
  }
  
  // Crear gráfico Radar de Chart.js
  const isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark';
  const textColor = isDarkMode ? '#e2e8f0' : '#334155';
  const gridColor = isDarkMode ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.08)';
  
  currentChartInstance = new Chart(canvas.getContext('2d'), {
    type: 'radar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Promedio por Competencia',
        data: scores,
        backgroundColor: 'rgba(21, 128, 61, 0.25)',
        borderColor: 'rgba(21, 128, 61, 1)',
        borderWidth: 2,
        pointBackgroundColor: 'rgba(21, 128, 61, 1)',
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: 'rgba(21, 128, 61, 1)'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        }
      },
      scales: {
        r: {
          angleLines: {
            color: gridColor
          },
          grid: {
            color: gridColor
          },
          pointLabels: {
            color: textColor,
            font: {
              size: 11,
              weight: 'bold'
            }
          },
          ticks: {
            color: textColor,
            backdropColor: 'transparent',
            stepSize: 1
          },
          min: 0,
          max: 5
        }
      }
    }
  });
  
  openModal('workerChartModal');
}

// ================= INFORME INDIVIDUAL DE SUBORDINADOS (REPORTE & IMPRESIÓN) =================

function initReporteSubordinadosFilters() {
  const select = document.getElementById('repFiltroSubordinado');
  if (!select) return;
  
  const currentVal = select.value || 'todos';
  
  const subordinados = workersCache.filter(w => w.supervisor_id === currentUser.id);
  
  let html = '<option value="todos">Todos los subordinados</option>';
  subordinados.forEach(s => {
    html += `<option value="${s.id}">${s.nombre} (Ficha: ${s.ficha || 'N/A'})</option>`;
  });
  
  select.innerHTML = html;
  select.value = currentVal;
}

function renderReporteSubordinados() {
  const printArea = document.getElementById('reporteSubordinadosPrintArea');
  if (!printArea) return;
  
  const subordinados = workersCache.filter(w => w.supervisor_id === currentUser.id);
  
  if (subordinados.length === 0) {
    printArea.innerHTML = `
      <div class="premium-card" style="text-align: center; padding: 3rem;">
        <i class="fa-solid fa-users-slash text-primary" style="font-size: 3rem; margin-bottom: 1rem;"></i>
        <h4 style="margin: 0 0 0.5rem 0;">No posee subordinados asignados</h4>
        <p style="color: var(--muted-color); margin: 0;">Usted no tiene trabajadores registrados bajo su supervisión directa en el sistema.</p>
      </div>
    `;
    return;
  }
  
  const selectedSubId = document.getElementById('repFiltroSubordinado')?.value || 'todos';
  const dateDesde = document.getElementById('repFiltroFechaDesde')?.value || '';
  const dateHasta = document.getElementById('repFiltroFechaHasta')?.value || '';
  
  let filteredSubordinados = subordinados;
  if (selectedSubId !== 'todos') {
    const subIdNum = parseInt(selectedSubId);
    filteredSubordinados = subordinados.filter(s => s.id === subIdNum);
  }
  
  // Variables acumuladoras para el resumen del departamento
  let totalTeamScore = 0;
  let totalTeamCount = 0;
  const teamCompSuma = {};
  const teamCompCuenta = {};
  const workerSummaries = [];
  const statusCounts = {
    'Excelente (Sobresaliente)': 0,
    'Bueno (Cumple)': 0,
    'Regular (Tutoría)': 0,
    'Deficiente (Bajo)': 0,
    'Sin Evaluaciones': 0
  };

  let htmlContent = `
    <div class="report-header">
      <img src="images/BEL_LOGO.jpg" alt="BEL Logo" class="report-logo" onerror="this.src='https://placehold.co/100x60/2e7d32/ffffff?text=BEL'">
      <div class="report-header-text">
        <h3>Corporación BEL</h3>
        <p><strong>Informe de Indicadores Individuales de Desempeño</strong></p>
        <p style="font-size: 0.8rem; margin-top: 0.1rem; color: var(--muted-color);">Supervisor: ${currentUser.nombre} | Fecha de Emisión: ${new Date().toLocaleDateString()}</p>
      </div>
    </div>
  `;
  
  filteredSubordinados.forEach(s => {
    // Buscar todas las evaluaciones de este subordinado
    const workerEvals = evaluationsCache.filter(ev => {
      try {
        const parsed = safeParseJSON(ev.evaluacion);
        return parsed && parsed.trabajador_id === s.id;
      } catch(e) { return false; }
    });
    
    let finalEvals = workerEvals;
    if (dateDesde) {
      finalEvals = finalEvals.filter(ev => ev.fecha >= dateDesde);
    }
    if (dateHasta) {
      finalEvals = finalEvals.filter(ev => ev.fecha <= dateHasta);
    }
    
    // Agrupar evaluaciones por fecha
    const evalGroups = {};
    finalEvals.forEach(ev => {
      const key = ev.fecha;
      if (!evalGroups[key]) {
        evalGroups[key] = {
          fecha: ev.fecha,
          estado: ev.estado,
          rows: []
        };
      }
      evalGroups[key].rows.push(ev);
    });
    const sortedDates = Object.keys(evalGroups).sort((a, b) => new Date(b) - new Date(a));
    
    // Calcular promedio general e individuales
    let totalSuma = 0;
    let totalCuenta = 0;
    const subCompSuma = {};
    const subCompCuenta = {};
    
    finalEvals.forEach(ev => {
      try {
        const parsed = safeParseJSON(ev.evaluacion);
        if (!parsed) return;
        const valor = parseFloat(parsed.valor);
        const aspecto = aspectsCache.find(a => a.id === ev.item_evaluacion_id);
        if (aspecto && aspecto.tipo === 'rango1,5' && !isNaN(valor)) {
          totalSuma += valor;
          totalCuenta++;
          
          const claseId = ev.clase_id;
          if (!subCompSuma[claseId]) {
            subCompSuma[claseId] = 0;
            subCompCuenta[claseId] = 0;
          }
          subCompSuma[claseId] += valor;
          subCompCuenta[claseId]++;
        }
      } catch(e) {}
    });
    
    const promedioGeneral = totalCuenta > 0 ? (totalSuma / totalCuenta).toFixed(1) : 'N/A';
    
    let nivelDesempeno = 'Sin Evaluaciones';
    if (promedioGeneral !== 'N/A') {
      const avgNum = parseFloat(promedioGeneral);
      if (avgNum >= 4.5) nivelDesempeno = 'Excelente (Sobresaliente)';
      else if (avgNum >= 3.75) nivelDesempeno = 'Bueno (Cumple)';
      else if (avgNum >= 2.75) nivelDesempeno = 'Regular (Tutoría)';
      else nivelDesempeno = 'Deficiente (Bajo)';
      
      // Sumar al acumulador general del equipo
      totalTeamScore += totalSuma;
      totalTeamCount += totalCuenta;
      
      // Sumar a los acumuladores por competencia del equipo
      Object.keys(subCompSuma).forEach(claseId => {
        const cId = parseInt(claseId);
        if (!teamCompSuma[cId]) {
          teamCompSuma[cId] = 0;
          teamCompCuenta[cId] = 0;
        }
        teamCompSuma[cId] += subCompSuma[cId];
        teamCompCuenta[cId] += subCompCuenta[cId];
      });
    }
    
    statusCounts[nivelDesempeno]++;
    workerSummaries.push({
      s,
      promedio: promedioGeneral,
      nivel: nivelDesempeno,
      evalCount: sortedDates.length
    });
    
    htmlContent += `
      <article class="premium-card subordinate-report-card">
        <div class="subordinate-profile-grid">
          <div>
            <h3 style="margin: 0; color: var(--primary);"><i class="fa-solid fa-user-tie"></i> ${s.nombre}</h3>
            <p style="margin: 0.25rem 0 1rem 0; color: var(--muted-color); font-size: 0.9rem;">Ficha: <strong>${s.ficha || 'N/A'}</strong></p>
            
            <div class="subordinate-meta">
              <div>Cédula: <strong>${s.cedula}</strong></div>
              <div>Empresa: <strong>${s.empresa}</strong></div>
              <div>Cargo: <strong>${s.cargo}</strong></div>
              <div>Departamento: <strong>${s.departamento}</strong></div>
            </div>
          </div>
          
          <div class="kpi-row">
            <div class="kpi-card">
              <h5>Evaluaciones</h5>
              <h3>${sortedDates.length}</h3>
            </div>
            <div class="kpi-card">
              <h5>Promedio</h5>
              <h3>${promedioGeneral !== 'N/A' ? `${promedioGeneral} / 5` : '-'}</h3>
            </div>
            <div class="kpi-card">
              <h5>Desempeño</h5>
              <h3 style="font-size: 0.8rem; padding-top: 0.25rem; white-space: nowrap;">${nivelDesempeno}</h3>
            </div>
          </div>
        </div>
        
        <div style="display: grid; grid-template-columns: 1.2fr 0.8fr; gap: 1.5rem; margin-top: 1.5rem; align-items: start;" class="subordinate-profile-grid">
          <!-- Tabla Resumen -->
          <div>
            <h4 style="margin: 0 0 1rem 0; font-size: 1.1rem; color: var(--primary);"><i class="fa-solid fa-list-ol"></i> Promedio por Competencia</h4>
            <div class="table-wrapper">
              <table class="competency-summary-table">
                <thead>
                  <tr>
                    <th>Competencia</th>
                    <th style="text-align: right;">Promedio</th>
                  </tr>
                </thead>
                <tbody>
                  ${classesCache.map(c => {
                    const suma = subCompSuma[c.id] || 0;
                    const cuenta = subCompCuenta[c.id] || 0;
                    const promedio = cuenta > 0 ? (suma / cuenta).toFixed(1) : '-';
                    return `
                      <tr>
                        <td><strong>${c.titulo}</strong></td>
                        <td style="text-align: right; font-weight: 600; color: var(--primary);">${promedio}</td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          </div>
          
          <!-- Gráfico -->
          <div style="text-align: center;">
            <h4 style="margin: 0 0 1rem 0; font-size: 1.1rem; color: var(--primary);"><i class="fa-solid fa-chart-simple"></i> Gráfico de Desempeño</h4>
            <div style="position: relative; width: 100%; height: 220px; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.01); border-radius: 8px; border: 1px solid var(--border-color); padding: 0.5rem;">
              <canvas id="repChart_${s.id}" style="width: 100%; height: 100%;"></canvas>
              ${sortedDates.length === 0 ? `<div style="position: absolute; color: var(--muted-color); font-size: 0.9rem;"><i class="fa-solid fa-folder-open" style="display:block; font-size:1.5rem; margin-bottom:0.25rem;"></i>Sin evaluaciones</div>` : ''}
            </div>
          </div>
        </div>

        <!-- Detalle de Evaluaciones -->
        ${sortedDates.length > 0 ? `
          <div class="evaluation-detail-section">
            <h4 style="margin: 0 0 1.5rem 0; font-size: 1.1rem; color: var(--primary);"><i class="fa-solid fa-clock-rotate-left"></i> Historial de Evaluaciones</h4>
            
            ${sortedDates.map(fecha => {
              const group = evalGroups[fecha];
              const statusText = group.estado ? 'Cerrada' : 'Abierta';
              return `
                <div class="evaluation-date-block">
                  <div class="evaluation-date-title" style="display: flex; justify-content: space-between; font-size:0.95rem;">
                    <span>Evaluación realizada el ${new Date(fecha).toLocaleDateString()}</span>
                    <small style="font-weight: normal; font-size: 0.8rem; text-transform: uppercase;">Estado: ${statusText}</small>
                  </div>
                  
                  <div class="table-wrapper">
                    <table>
                      <thead>
                        <tr>
                          <th style="width: 30%;">Competencia</th>
                          <th style="width: 50%;">Aspecto Evaluado</th>
                          <th style="width: 20%; text-align: right;">Respuesta / Valor</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${group.rows.map(row => {
                          const comp = classesCache.find(c => c.id === row.clase_id);
                          const compLabel = comp ? comp.titulo : 'N/A';
                          
                          const aspect = aspectsCache.find(a => a.id === row.item_evaluacion_id);
                          const aspectLabel = aspect ? aspect.descripcion : 'N/A';
                          
                          let ratingVal = 'N/A';
                          try {
                            const parsed = safeParseJSON(row.evaluacion);
                            if (parsed) {
                              ratingVal = parsed.valor;
                              if (aspect && aspect.tipo === 'si/no') {
                                ratingVal = ratingVal.toUpperCase();
                              }
                            }
                          } catch(e) {}
                          
                          return `
                            <tr>
                              <td style="font-size: 0.85rem;"><strong>${compLabel}</strong></td>
                              <td style="font-size: 0.85rem; text-align: justify;">${aspectLabel}</td>
                              <td style="text-align: right; font-weight: 600; font-size: 0.85rem; color: var(--contrast);">${ratingVal}</td>
                            </tr>
                          `;
                        }).join('')}
                      </tbody>
                    </table>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        ` : `
          <div style="text-align: center; padding: 2rem; background: rgba(0,0,0,0.02); border-radius: 8px; margin-top: 1.5rem; color: var(--muted-color);">
            <i class="fa-solid fa-folder-open" style="font-size: 2rem; margin-bottom: 0.5rem; display: block; color: var(--primary);"></i>
            No se registran evaluaciones de desempeño para este trabajador en el sistema.
          </div>
        `}
      </article>
    `;
  });
  
  // Calcular efectividad del equipo
  const promedioEquipo = totalTeamCount > 0 ? (totalTeamScore / totalTeamCount) : 0;
  const promedioEquipoLabel = totalTeamCount > 0 ? promedioEquipo.toFixed(1) : 'N/A';
  const efectividadEquipo = promedioEquipo > 0 ? Math.round((promedioEquipo / 5) * 100) : 0;
  
  // Agregar la sección de resumen del departamento al final del reporte
  htmlContent += `
    <article class="premium-card subordinate-report-card summary-report-card" style="margin-top: 3rem; page-break-before: always; break-before: page;">
      <div style="text-align: center; border-bottom: 2px solid var(--primary); padding-bottom: 1rem; margin-bottom: 1.5rem;">
        <h3 style="margin: 0; color: var(--primary); text-transform: uppercase;"><i class="fa-solid fa-chart-line"></i> Informe Resumen del Departamento</h3>
        <p style="margin: 0.25rem 0 0 0; color: var(--muted-color); font-size: 0.9rem;">Consolidado de efectividad y desempeño global del equipo supervisado</p>
      </div>
      
      <!-- Grid de KPIs del Equipo -->
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem; margin-bottom: 2rem;">
        <div class="kpi-card" style="padding: 1rem;">
          <h5 style="font-size: 0.75rem; color: var(--muted-color); text-transform: uppercase;">Personal Evaluado</h5>
          <h3 style="font-size: 1.75rem; margin-top: 0.25rem; font-weight: 700; color: var(--primary);">${workerSummaries.filter(w => w.evalCount > 0).length} / ${filteredSubordinados.length}</h3>
        </div>
        <div class="kpi-card" style="padding: 1rem;">
          <h5 style="font-size: 0.75rem; color: var(--muted-color); text-transform: uppercase;">Promedio General</h5>
          <h3 style="font-size: 1.75rem; margin-top: 0.25rem; font-weight: 700; color: var(--primary);">${promedioEquipoLabel !== 'N/A' ? `${promedioEquipoLabel} / 5` : '-'}</h3>
        </div>
        <div class="kpi-card" style="padding: 1rem; background-color: rgba(21, 128, 61, 0.1); border: 2px solid var(--primary);">
          <h5 style="font-size: 0.75rem; color: var(--muted-color); text-transform: uppercase; font-weight: 600;">Efectividad de Equipo</h5>
          <h3 style="font-size: 1.75rem; margin-top: 0.25rem; font-weight: 800; color: var(--primary);">${efectividadEquipo}%</h3>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1.2fr 0.8fr; gap: 2rem; margin-top: 1.5rem;" class="subordinate-profile-grid">
        <!-- Tabla de Resumen de Subordinados -->
        <div>
          <h4 style="margin: 0 0 1rem 0; font-size: 1.1rem; color: var(--primary);"><i class="fa-solid fa-users"></i> Desempeño Individual del Personal</h4>
          <div class="table-wrapper">
            <table class="competency-summary-table">
              <thead>
                <tr>
                  <th>Ficha</th>
                  <th>Nombre y Apellido</th>
                  <th style="text-align: center;">Evals</th>
                  <th style="text-align: right;">Promedio</th>
                  <th style="text-align: right;">Nivel Desempeño</th>
                </tr>
              </thead>
              <tbody>
                ${workerSummaries.map(w => {
                  const rating = w.promedio !== 'N/A' ? `${w.promedio} / 5` : '-';
                  return `
                    <tr>
                      <td><strong>${w.s.ficha || 'N/A'}</strong></td>
                      <td>${w.s.nombre}</td>
                      <td style="text-align: center;">${w.evalCount}</td>
                      <td style="text-align: right; font-weight: 600; color: var(--primary);">${rating}</td>
                      <td style="text-align: right; font-size: 0.85rem; font-weight: 500;">${w.nivel}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Promedio de Competencias del Equipo y Distribución -->
        <div>
          <h4 style="margin: 0 0 1rem 0; font-size: 1.1rem; color: var(--primary);"><i class="fa-solid fa-award"></i> Promedio por Competencia</h4>
          <div style="display: flex; flex-direction: column; gap: 1rem; margin-bottom: 2rem;">
            ${classesCache.map(c => {
              const prevSuma = teamCompSuma[c.id] || 0;
              const prevCuenta = teamCompCuenta[c.id] || 0;
              const promedio = prevCuenta > 0 ? (prevSuma / prevCuenta).toFixed(1) : null;
              const pctBarra = promedio ? (parseFloat(promedio) / 5) * 100 : 0;
              const promedioLabel = promedio ? `${promedio} / 5` : 'Sin datos';
              return `
                <div>
                  <div style="display: flex; justify-content: space-between; font-size: 0.8rem; font-weight: 500; margin-bottom: 0.2rem;">
                    <span style="color: var(--contrast);">${c.titulo}</span>
                    <span style="color: var(--primary); font-weight: 600;">${promedioLabel}</span>
                  </div>
                  <div style="background-color: var(--border-color); height: 6px; border-radius: 3px; overflow: hidden; width: 100%;">
                    <div style="background-color: var(--primary); height: 100%; width: ${pctBarra}%; border-radius: 3px;"></div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>

          <h4 style="margin: 0 0 1rem 0; font-size: 1.1rem; color: var(--primary);"><i class="fa-solid fa-circle-info"></i> Distribución de Desempeño</h4>
          <div style="display: flex; flex-direction: column; gap: 0.5rem; font-size: 0.85rem;">
            <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed var(--border-color); padding-bottom: 0.25rem;">
              <span>Excelente (Sobresaliente)</span>
              <strong style="color: var(--primary);">${statusCounts['Excelente (Sobresaliente)']}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed var(--border-color); padding-bottom: 0.25rem;">
              <span>Bueno (Cumple)</span>
              <strong style="color: var(--primary);">${statusCounts['Bueno (Cumple)']}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed var(--border-color); padding-bottom: 0.25rem;">
              <span>Regular (Tutoría)</span>
              <strong style="color: #eab308;">${statusCounts['Regular (Tutoría)']}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed var(--border-color); padding-bottom: 0.25rem;">
              <span>Deficiente (Bajo)</span>
              <strong style="color: #ef4444;">${statusCounts['Deficiente (Bajo)']}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; padding-bottom: 0.25rem;">
              <span>Sin Evaluaciones</span>
              <strong style="color: var(--muted-color);">${statusCounts['Sin Evaluaciones']}</strong>
            </div>
          </div>
        </div>
      </div>
    </article>
  `;

  printArea.innerHTML = htmlContent;
  
  // Renderizar los gráficos de cada subordinado
  filteredSubordinados.forEach(s => {
    const workerEvals = evaluationsCache.filter(ev => {
      try {
        const parsed = safeParseJSON(ev.evaluacion);
        return parsed && parsed.trabajador_id === s.id;
      } catch(e) { return false; }
    });
    
    let finalEvals = workerEvals;
    if (dateDesde) finalEvals = finalEvals.filter(ev => ev.fecha >= dateDesde);
    if (dateHasta) finalEvals = finalEvals.filter(ev => ev.fecha <= dateHasta);
    
    if (finalEvals.length === 0) return;
    
    const subCompSuma = {};
    const subCompCuenta = {};
    
    finalEvals.forEach(ev => {
      try {
        const parsed = safeParseJSON(ev.evaluacion);
        if (!parsed) return;
        const valor = parseFloat(parsed.valor);
        const aspecto = aspectsCache.find(a => a.id === ev.item_evaluacion_id);
        if (aspecto && aspecto.tipo === 'rango1,5' && !isNaN(valor)) {
          const claseId = ev.clase_id;
          if (!subCompSuma[claseId]) {
            subCompSuma[claseId] = 0;
            subCompCuenta[claseId] = 0;
          }
          subCompSuma[claseId] += valor;
          subCompCuenta[claseId]++;
        }
      } catch(e) {}
    });
    
    const labels = [];
    const scores = [];
    
    classesCache.forEach(c => {
      const suma = subCompSuma[c.id] || 0;
      const cuenta = subCompCuenta[c.id] || 0;
      if (cuenta > 0) {
        labels.push(c.titulo);
        scores.push(parseFloat((suma / cuenta).toFixed(1)));
      }
    });
    
    if (scores.length === 0) return;
    
    const canvas = document.getElementById(`repChart_${s.id}`);
    if (!canvas) return;
    
    const isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDarkMode ? '#e2e8f0' : '#334155';
    const gridColor = isDarkMode ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.08)';
    
    const chartType = scores.length >= 3 ? 'radar' : 'bar';
    const config = {
      type: chartType,
      data: {
        labels: labels,
        datasets: [{
          label: 'Promedio por Competencia',
          data: scores,
          backgroundColor: 'rgba(21, 128, 61, 0.25)',
          borderColor: 'rgba(21, 128, 61, 1)',
          borderWidth: 2,
          pointBackgroundColor: 'rgba(21, 128, 61, 1)',
          pointBorderColor: '#fff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {}
      }
    };
    
    if (chartType === 'radar') {
      config.options.scales = {
        r: {
          angleLines: { color: gridColor },
          grid: { color: gridColor },
          pointLabels: {
            color: textColor,
            font: { size: 9, weight: 'bold' }
          },
          ticks: {
            color: textColor,
            backdropColor: 'transparent',
            stepSize: 1
          },
          min: 0,
          max: 5
        }
      };
    } else {
      config.options.scales = {
        y: {
          min: 0,
          max: 5,
          ticks: { color: textColor, stepSize: 1 },
          grid: { color: gridColor }
        },
        x: {
          ticks: { color: textColor, font: { size: 9 } },
          grid: { display: false }
        }
      };
    }
    
    new Chart(canvas.getContext('2d'), config);
  });
}

function printReporteSubordinados() {
  window.print();
}
