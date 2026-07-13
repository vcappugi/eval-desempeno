// js/admin.js - Operaciones del Panel Administrativo (CRUDs y cierre de evaluaciones)

import { state } from './state.js?v=2.1.6';
import { showToast, handleRlsError, openModal, closeModal, safeParseJSON } from './utils.js?v=2.1.6';
import { loadCaches } from './supabase.js?v=2.1.6';

// ================= CRUD: TRABAJADORES =================

export async function renderTrabajadoresCrud() {
  const tbody = document.getElementById('trabajadoresTableBody');
  if (!tbody) return;
  
  tbody.innerHTML = '<tr><td colspan="9" style="text-align: center;"><i class="fa-solid fa-spinner fa-spin"></i> Cargando trabajadores...</td></tr>';
  
  const startIndex = (state.workersCurrentPage - 1) * state.workersPerPage;
  const endIndex = startIndex + state.workersPerPage - 1;
  
  try {
    let query = state.supabaseClient
      .from('trabajador')
      .select('*', { count: 'exact' });
      
    if (state.workersSearchQuery) {
      query = query.or(`cedula.ilike.%${state.workersSearchQuery}%,nombre.ilike.%${state.workersSearchQuery}%,usuario.ilike.%${state.workersSearchQuery}%`);
    }
    
    if (state.workersDeptFilter) {
      query = query.eq('departamento', state.workersDeptFilter);
    }
    
    const { data: paginatedWorkers, count, error } = await query
      .order('nombre')
      .range(startIndex, endIndex);
      
    if (error) throw error;
    
    const totalWorkers = count || 0;
    const totalPages = Math.max(1, Math.ceil(totalWorkers / state.workersPerPage));
    
    // Ajustar página actual si excede el total
    if (state.workersCurrentPage > totalPages) {
      state.workersCurrentPage = totalPages;
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
    
    const calculatedEndIndex = Math.min(startIndex + state.workersPerPage, totalWorkers);
    if (rangeLabel) rangeLabel.textContent = totalWorkers === 0 ? '0' : `${startIndex + 1}-${calculatedEndIndex}`;
    if (totalLabel) totalLabel.textContent = totalWorkers;
    if (curPageLabel) curPageLabel.textContent = state.workersCurrentPage;
    if (totPagesLabel) totPagesLabel.textContent = totalPages;
    
    if (prevBtn) prevBtn.disabled = state.workersCurrentPage === 1;
    if (nextBtn) nextBtn.disabled = state.workersCurrentPage === totalPages;
    
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

export async function changeWorkersPage(direction) {
  const newPage = state.workersCurrentPage + direction;
  if (newPage >= 1) {
    state.workersCurrentPage = newPage;
    await renderTrabajadoresCrud();
  }
}

export async function handleWorkerSearch(query) {
  state.workersSearchQuery = query.toLowerCase().trim();
  state.workersCurrentPage = 1; // Reiniciar a la primera página al buscar
  await renderTrabajadoresCrud();
}

export function handleTrabTipoChange() {
  const tipo = document.getElementById('trabTipo').value;
  const credsSection = document.getElementById('credentialsSection');
  const userInp = document.getElementById('trabUsuario');
  const claveInp = document.getElementById('trabClave');
  const rolInp = document.getElementById('trabRol');
  const isNew = !document.getElementById('trabajadorIdInput').value;
  
  if (tipo === 'ADMINISTRATIVO') {
    if (credsSection) credsSection.style.display = 'none';
    if (userInp) userInp.value = '';
    if (claveInp) {
      claveInp.value = '';
      claveInp.required = false;
    }
    if (rolInp) rolInp.value = '';
  } else {
    if (credsSection) credsSection.style.display = 'block';
    if (claveInp) {
      claveInp.required = isNew;
    }
    if (rolInp && !rolInp.value) {
      rolInp.value = 'user';
    }
  }
}

export async function openTrabajadorModal() {
  await openModal('trabajadorModal');
  
  document.getElementById('trabajadorForm').reset();
  document.getElementById('trabajadorIdInput').value = '';
  document.getElementById('trabajadorModalTitle').textContent = 'Agregar Trabajador';
  document.getElementById('trabClave').required = true;
  
  populateDepartamentosSelect();
  populateSupervisorSelects(); // Se filtrará por departamento actual (vacío, mostrando sólo Ninguno)
  
  handleTrabTipoChange();
}

export async function editTrabajador(id) {
  await openModal('trabajadorModal');
  
  const w = state.workersCache.find(worker => worker.id === id);
  if (!w) return;
  
  // 1. Poblar departamentos primero
  populateDepartamentosSelect();
  document.getElementById('trabDepartamento').value = w.departamento || '';
  
  // 2. Poblar supervisores filtrado por el departamento seleccionado
  populateSupervisorSelects();
  
  document.getElementById('trabajadorIdInput').value = w.id;
  document.getElementById('trabFicha').value = w.ficha || '';
  document.getElementById('trabCedula').value = w.cedula || '';
  document.getElementById('trabNombre').value = w.nombre || '';
  document.getElementById('trabEmpresa').value = w.empresa || '';
  document.getElementById('trabCargo').value = w.cargo || '';
  document.getElementById('trabSupervisor').value = w.supervisor_id || '';
  document.getElementById('trabUsuario').value = w.usuario || '';
  document.getElementById('trabRol').value = w.rol || 'user';
  document.getElementById('trabTipo').value = w.tipo || 'GERENCIAL';
  
  // Para editar, la clave no es obligatoria
  document.getElementById('trabClave').value = '';
  document.getElementById('trabClave').required = false;
  
  document.getElementById('trabajadorModalTitle').textContent = 'Modificar Trabajador';
  
  handleTrabTipoChange();
}

export async function saveTrabajador(event) {
  if (event) event.preventDefault();
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
  const tipo = document.getElementById('trabTipo').value;
  const clave = document.getElementById('trabClave').value;
  
  const payload = {
    ficha,
    cedula,
    nombre,
    empresa,
    departamento,
    cargo,
    supervisor_id: supervisor_id ? parseInt(supervisor_id) : null,
    usuario: tipo === 'ADMINISTRATIVO' ? null : (usuario || null),
    rol: tipo === 'ADMINISTRATIVO' ? null : (rol || null),
    tipo
  };
  
  if (tipo === 'ADMINISTRATIVO') {
    payload.clave = null;
  } else if (clave) {
    payload.clave = clave;
  }
  
  try {
    if (id) {
      // Update
      const { error } = await state.supabaseClient
        .from('trabajador')
        .update(payload)
        .eq('id', id);
        
      if (error) throw error;
      showToast("Trabajador actualizado exitosamente.");
    } else {
      // Insert
      const { error } = await state.supabaseClient
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

export async function deleteTrabajador(id) {
  const w = state.workersCache.find(worker => worker.id === id);
  if (!w) return;
  
  if (!confirm(`¿Está seguro de eliminar al trabajador ${w.nombre}?`)) {
    return;
  }
  
  try {
    const { error } = await state.supabaseClient
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

export function renderCompetenciasCrud() {
  const container = document.getElementById('competenciasCardsContainer');
  if (!container) return;
  
  container.innerHTML = '';
  
  if (state.classesCache.length === 0) {
    container.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 2rem;">No hay competencias registradas.</div>';
    return;
  }
  
  let html = '';
  state.classesCache.forEach(c => {
    const cardClass = c.tipo === 'ADMINISTRATIVO' ? 'card-administrativo' : 'card-gerencial';
      
    html += `
      <article class="premium-card competencia-card ${cardClass}">
        <div>
          <div class="competencia-header">
            <h4 style="margin: 0; font-size: 1.1rem; color: var(--primary);">${c.titulo}</h4>
            <span class="competencia-badge">Orden: ${c.orden}</span>
          </div>
          <p style="font-size: 0.875rem; margin-bottom: 0; color: var(--muted-color); text-align: justify;">
            ${c.descripcion || 'Sin descripción.'}
          </p>
          <div style="margin-top: 0.75rem; font-size: 0.8rem; font-weight: 600; opacity: 0.85; display: flex; align-items: center; gap: 0.25rem; color: var(--primary);">
            <i class="fa-solid fa-tags" style="font-size: 0.75rem;"></i>
            <span>Tipo: <strong style="text-transform: uppercase;">${c.tipo || 'GERENCIAL'}</strong></span>
          </div>
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

export async function openCompetenciaModal() {
  await openModal('competenciaModal');
  document.getElementById('competenciaForm').reset();
  document.getElementById('competenciaIdInput').value = '';
  document.getElementById('competenciaModalTitle').textContent = 'Agregar Competencia';
}

export async function editCompetencia(id) {
  await openModal('competenciaModal');
  const c = state.classesCache.find(comp => comp.id === id);
  if (!c) return;
  
  document.getElementById('competenciaIdInput').value = c.id;
  document.getElementById('compTitulo').value = c.titulo || '';
  document.getElementById('compDescripcion').value = c.descripcion || '';
  document.getElementById('compOrden').value = c.orden || '';
  document.getElementById('compTipo').value = c.tipo || 'GERENCIAL';
  
  document.getElementById('competenciaModalTitle').textContent = 'Modificar Competencia';
}

export async function saveCompetencia(event) {
  if (event) event.preventDefault();
  const id = document.getElementById('competenciaIdInput').value;
  const titulo = document.getElementById('compTitulo').value.trim();
  const descripcion = document.getElementById('compDescripcion').value.trim();
  const orden = parseInt(document.getElementById('compOrden').value);
  const tipo = document.getElementById('compTipo').value;
  
  const payload = { titulo, descripcion, orden, tipo };
  
  try {
    if (id) {
      const { error } = await state.supabaseClient
        .from('clase')
        .update(payload)
        .eq('id', id);
        
      if (error) throw error;
      showToast("Competencia actualizada exitosamente.");
    } else {
      const { error } = await state.supabaseClient
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

export async function deleteCompetencia(id) {
  const c = state.classesCache.find(comp => comp.id === id);
  if (!c) return;
  
  if (!confirm(`¿Está seguro de eliminar la competencia "${c.titulo}"? Esto puede afectar a los aspectos asociados.`)) {
    return;
  }
  
  try {
    const { error } = await state.supabaseClient
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

export function renderAspectosCrud() {
  const tbody = document.getElementById('aspectosTableBody');
  if (!tbody) return;
  
  tbody.innerHTML = '';
  
  // Poblar dinámicamente el filtro de competencias
  const compSelect = document.getElementById('filterAspectoCompetencia');
  if (compSelect) {
    const selectedVal = compSelect.value;
    compSelect.innerHTML = '<option value="">Todas las competencias...</option>';
    state.classesCache.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = `${c.titulo} (${c.tipo || 'GERENCIAL'})`;
      compSelect.appendChild(opt);
    });
    compSelect.value = selectedVal;
  }
  
  const filterClaseId = compSelect ? compSelect.value : '';
  const filterTipoSelect = document.getElementById('filterAspectoTipo');
  const filterTipo = filterTipoSelect ? filterTipoSelect.value : '';
  
  // Filtrar cache de aspectos
  let filteredAspects = state.aspectsCache;
  if (filterClaseId) {
    filteredAspects = filteredAspects.filter(a => String(a.clase_id) === String(filterClaseId));
  }
  if (filterTipo) {
    filteredAspects = filteredAspects.filter(a => a.clase && a.clase.tipo === filterTipo);
  }
  
  if (filteredAspects.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">No hay aspectos de evaluación registrados para esta selección.</td></tr>';
    return;
  }
  
  let html = '';
  filteredAspects.forEach(a => {
    const claseTitulo = a.clase ? a.clase.titulo : `<span class="text-error">Desasociada (ID: ${a.clase_id})</span>`;
    let tipoBadge = '';
    if (a.tipo === 'rango1,4') tipoBadge = '<span class="badge">Rango 1-4</span>';
    else if (a.tipo === 'si/no') tipoBadge = '<span class="badge">Sí / No</span>';
    else tipoBadge = '<span class="badge">Texto Abierto</span>';
    
    const ponderacionText = a.ponderacion !== null && a.ponderacion !== undefined ? `${a.ponderacion}%` : '<span class="badge secondary" style="opacity:0.6;">Sin asignar</span>';
    
    html += `
      <tr>
        <td><mark style="background-color: var(--primary-focus); color: var(--primary); font-weight: 700; border-radius: 4px; padding: 0.1rem 0.4rem;">${a.orden}</mark></td>
        <td><strong>${claseTitulo}</strong></td>
        <td style="max-width: 400px; text-align: justify;">${a.descripcion}</td>
        <td>${tipoBadge}</td>
        <td><strong>${ponderacionText}</strong></td>
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

export async function openAspectoModal() {
  if (state.classesCache.length === 0) {
    showToast("No puede agregar aspectos si no hay competencias (clases) creadas en el sistema.", "error");
    return;
  }
  
  await openModal('aspectoModal');
  populateCompetenciasSelects();
  
  document.getElementById('aspectoForm').reset();
  document.getElementById('aspectoIdInput').value = '';
  document.getElementById('aspPonderacion').value = '';
  document.getElementById('aspectoModalTitle').textContent = 'Agregar Aspecto a Evaluar';
}

export async function editAspecto(id) {
  await openModal('aspectoModal');
  populateCompetenciasSelects();
  
  const a = state.aspectsCache.find(asp => asp.id === id);
  if (!a) return;
  
  document.getElementById('aspectoIdInput').value = a.id;
  document.getElementById('aspClase').value = a.clase_id || '';
  document.getElementById('aspDescripcion').value = a.descripcion || '';
  document.getElementById('aspTipo').value = a.tipo || 'rango1,4';
  document.getElementById('aspOrden').value = a.orden || '';
  document.getElementById('aspPonderacion').value = a.ponderacion !== null && a.ponderacion !== undefined ? a.ponderacion : '';
  
  document.getElementById('aspectoModalTitle').textContent = 'Modificar Aspecto a Evaluar';
}

export async function saveAspecto(event) {
  if (event) event.preventDefault();
  const id = document.getElementById('aspectoIdInput').value;
  const clase_id = parseInt(document.getElementById('aspClase').value);
  const descripcion = document.getElementById('aspDescripcion').value.trim();
  const tipo = document.getElementById('aspTipo').value;
  const orden = parseInt(document.getElementById('aspOrden').value);
  const ponderacion = parseFloat(document.getElementById('aspPonderacion').value) || 0;
  
  if (ponderacion < 0 || ponderacion > 100) {
    showToast("La ponderación debe ser un valor porcentual entre 0% y 100%.", "error");
    return;
  }
  
  // Validar que la sumatoria por competencia no supere el 100%
  const currentAspectId = id ? parseInt(id) : null;
  const sumOtherAspects = state.aspectsCache
    .filter(a => a.clase_id === clase_id && a.id !== currentAspectId)
    .reduce((sum, a) => sum + (parseFloat(a.ponderacion) || 0), 0);
    
  if (sumOtherAspects + ponderacion > 100) {
    showToast(`La sumatoria de ponderaciones para esta competencia no debe superar el 100%. Actualmente la suma de los otros aspectos es ${sumOtherAspects}%. El máximo porcentual disponible es ${(100 - sumOtherAspects).toFixed(2)}%.`, "error");
    return;
  }
  
  const payload = { clase_id, descripcion, tipo, orden, ponderacion };
  
  try {
    if (id) {
      const { error } = await state.supabaseClient
        .from('item_evaluacion')
        .update(payload)
        .eq('id', id);
        
      if (error) throw error;
      showToast("Aspecto de evaluación actualizado.");
    } else {
      const { error } = await state.supabaseClient
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

export async function deleteAspecto(id) {
  const a = state.aspectsCache.find(asp => asp.id === id);
  if (!a) return;
  
  if (!confirm(`¿Está seguro de eliminar este aspecto de evaluación?`)) {
    return;
  }
  
  try {
    const { error } = await state.supabaseClient
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

// ================= TAB: CIERRE DE EVALUACIONES =================

export function renderCierreEvaluaciones() {
  const tbody = document.getElementById('cierreEvaluacionesTableBody');
  if (!tbody) return;
  
  tbody.innerHTML = '';
  
  // Agrupar evaluaciones de la caché por (trabajador_id, fecha)
  const grouped = {};
  
  state.evaluationsCache.forEach(ev => {
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
      
      if (ev.estado === true) {
        grouped[key].estado = true;
      }
    } catch(e) {}
  });
  
  const groupsList = Object.values(grouped).sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  
  if (groupsList.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem;">No se han realizado evaluaciones aún.</td></tr>';
    return;
  }
  
  let html = '';
  groupsList.forEach((group, index) => {
    const worker = state.workersCache.find(w => w.id === group.trabajadorId);
    const workerLabel = worker ? `${worker.nombre} (Ficha: ${worker.ficha || 'N/A'})` : `Desconocido (ID: ${group.trabajadorId})`;
    const statusText = group.estado ? 
      '<span class="badge" style="background-color: var(--primary); color: #ffffff;">Cerrada (Finalizada)</span>' : 
      '<span class="badge" style="background-color: #eab308; color: #ffffff;">Abierta (Editable)</span>';
      
    const toggleButton = group.estado ? 
      `<button class="outline secondary" style="padding: 0.25rem 0.5rem; margin-bottom: 0;" onclick="toggleEvaluationStatus('${group.trabajadorId}', '${group.fecha}', false)">Reabrir</button>` : 
      `<button class="primary" style="padding: 0.25rem 0.5rem; margin-bottom: 0;" onclick="toggleEvaluationStatus('${group.trabajadorId}', '${group.fecha}', true)"><i class="fa-solid fa-lock"></i> Cerrar</button>`;
      
    const viewButton = `<button class="outline" style="padding: 0.25rem 0.5rem; margin-bottom: 0; margin-left: 0.25rem; border-color: var(--primary); color: var(--primary);" onclick="showEvaluationDetail('${group.trabajadorId}', '${group.fecha}')" title="Ver Detalle"><i class="fa-solid fa-eye"></i> Ver</button>`;

    html += `
      <tr>
        <td>#${index + 1}</td>
        <td><strong>${workerLabel}</strong></td>
        <td>${new Date(group.fecha).toLocaleDateString()}</td>
        <td>${group.aspectos} aspectos evaluados</td>
        <td>${statusText}</td>
        <td style="text-align: right; white-space: nowrap;">
          ${toggleButton}
          ${viewButton}
        </td>
      </tr>
    `;
  });
  tbody.innerHTML = html;
}

export async function toggleEvaluationStatus(trabajadorId, fecha, closeStatus) {
  const tId = parseInt(trabajadorId);
  
  const rowsToUpdate = state.evaluationsCache.filter(ev => {
    if (ev.fecha !== fecha) return false;
    try {
      const parsed = safeParseJSON(ev.evaluacion);
      return parsed && parsed.trabajador_id === tId;
    } catch(e) {
      return false;
    }
  });
  
  if (rowsToUpdate.length === 0) return;
  
  const updates = rowsToUpdate.map(row => ({
    id: row.id,
    clase_id: row.clase_id,
    item_evaluacion_id: row.item_evaluacion_id,
    fecha: row.fecha,
    estado: closeStatus,
    evaluacion: row.evaluacion
  }));
  
  try {
    const { error } = await state.supabaseClient
      .from('evaluacion')
      .upsert(updates, { defaultToNull: false });
      
    if (error) throw error;
    
    showToast(`Evaluación ${closeStatus ? 'cerrada' : 'reabierta'} correctamente.`);
    await loadCaches();
    renderCierreEvaluaciones();
  } catch (err) {
    handleRlsError(err);
  }
}

// ================= SELECTS DINÁMICOS =================

export function populateSupervisorSelects(deptFilter) {
  const select = document.getElementById('trabSupervisor');
  if (!select) return;
  
  if (deptFilter === undefined) {
    const deptSelect = document.getElementById('trabDepartamento');
    deptFilter = deptSelect ? deptSelect.value : "";
  }
  
  const val = select.value;
  select.innerHTML = '<option value="">Ninguno</option>';
  
  if (deptFilter) {
    const filteredWorkers = state.workersCache.filter(worker => {
      const isSameDept = worker.departamento === deptFilter;
      const isDireccionGeneral = worker.departamento && 
        (worker.departamento.toUpperCase().trim() === 'DIRECCIÓN GENERAL' || 
         worker.departamento.toUpperCase().trim() === 'DIRECCION GENERAL');
      const isGerencial = worker.tipo && worker.tipo.toUpperCase().trim() === 'GERENCIAL';
      return (isSameDept || isDireccionGeneral) && isGerencial;
    });
    filteredWorkers.forEach(worker => {
      select.innerHTML += `<option value="${worker.id}">${worker.nombre} (Ficha: ${worker.ficha || 'N/A'})</option>`;
    });
  }
  
  const optionExists = Array.from(select.options).some(opt => opt.value === val);
  if (optionExists) {
    select.value = val;
  } else {
    select.value = "";
  }
}

export function populateCompetenciasSelects() {
  const select = document.getElementById('aspClase');
  if (!select) return;
  
  const val = select.value;
  select.innerHTML = '<option value="">Seleccione una competencia...</option>';
  state.classesCache.forEach(c => {
    select.innerHTML += `<option value="${c.id}">${c.titulo} (${c.tipo || 'GERENCIAL'})</option>`;
  });
  select.value = val;
}

export function populateSearchDeptFilters() {
  const evalSelect = document.getElementById('searchEvalDeptFilter');
  const workerSelect = document.getElementById('searchWorkerDeptFilter');
  
  // Obtener una lista única de departamentos cargados desde la tabla 'departamento'
  const uniqueDepts = [...new Set(state.departmentsCache.map(dep => dep.departamento).filter(Boolean))].sort();
  
  if (evalSelect) {
    const val = evalSelect.value;
    evalSelect.innerHTML = '<option value="">Todos los departamentos</option>';
    uniqueDepts.forEach(deptName => {
      evalSelect.innerHTML += `<option value="${deptName}">${deptName}</option>`;
    });
    evalSelect.value = val;
  }
  
  if (workerSelect) {
    const val = workerSelect.value;
    workerSelect.innerHTML = '<option value="">Todos los departamentos</option>';
    uniqueDepts.forEach(deptName => {
      workerSelect.innerHTML += `<option value="${deptName}">${deptName}</option>`;
    });
    workerSelect.value = val;
  }
}

export async function handleWorkerDeptFilter(deptName) {
  state.workersDeptFilter = deptName;
  state.workersCurrentPage = 1;
  await renderTrabajadoresCrud();
}

export function populateDepartamentosSelect() {
  const select = document.getElementById('trabDepartamento');
  if (!select) return;
  
  const val = select.value;
  select.innerHTML = '<option value="">Seleccione un departamento...</option>';
  state.departmentsCache.forEach(dep => {
    select.innerHTML += `<option value="${dep.departamento}">${dep.departamento} (${dep.empresa})</option>`;
  });
  select.value = val;
}

export function handleTrabDepartamentoChange(deptName) {
  const dep = state.departmentsCache.find(d => d.departamento === deptName);
  if (dep) {
    const empresaInput = document.getElementById('trabEmpresa');
    if (empresaInput) {
      empresaInput.value = dep.empresa || '';
    }
  }
  
  // Filtrar la lista de supervisores para mostrar sólo los del mismo departamento
  populateSupervisorSelects(deptName);
}

// ================= CRUD: FECHAS DE EVALUACIÓN (FECHA_EVAL) =================

export function renderFechasEvalCrud() {
  const tbody = document.getElementById('fechasEvalTableBody');
  if (!tbody) return;
  
  tbody.innerHTML = '<tr><td colspan="4" style="text-align: center;"><i class="fa-solid fa-spinner fa-spin"></i> Cargando fechas...</td></tr>';
  
  if (state.fechaEvalCache.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 2rem;">No hay fechas de evaluación registradas.</td></tr>';
    return;
  }
  
  let html = '';
  state.fechaEvalCache.forEach(fe => {
    const createdDate = fe.created_at ? new Date(fe.created_at).toLocaleDateString() : 'N/A';
    
    // Verificar si esta fecha ya tiene evaluaciones realizadas
    const tieneEvaluaciones = state.evaluationsCache.some(ev => {
      try {
        const parsed = safeParseJSON(ev.evaluacion);
        // O simplemente comparar ev.fecha con fe.fecha
        return ev.fecha === fe.fecha;
      } catch (e) {
        return false;
      }
    });
    
    let actionButtons = '';
    if (tieneEvaluaciones) {
      actionButtons = `
        <span style="background-color: var(--primary-focus); color: var(--primary); font-size: 0.8rem; padding: 0.25rem 0.5rem; border-radius: 6px; font-weight: 600; display: inline-flex; align-items: center; gap: 0.25rem;">
          <i class="fa-solid fa-lock"></i> Con Evaluaciones
        </span>
      `;
    } else {
      actionButtons = `
        <button class="outline secondary" style="padding: 0.25rem 0.5rem; margin-right: 0.25rem; margin-bottom: 0;" onclick="editFechaEval(${fe.id})" title="Modificar">
          <i class="fa-solid fa-pen"></i>
        </button>
        <button class="outline contrast" style="padding: 0.25rem 0.5rem; margin-bottom: 0;" onclick="deleteFechaEval(${fe.id})" title="Eliminar">
          <i class="fa-solid fa-trash"></i>
        </button>
      `;
    }
    
    html += `
      <tr>
        <td><strong>${fe.id}</strong></td>
        <td>${new Date(fe.fecha + 'T00:00:00').toLocaleDateString()}</td>
        <td>${createdDate}</td>
        <td style="text-align: right; white-space: nowrap;">
          ${actionButtons}
        </td>
      </tr>
    `;
  });
  tbody.innerHTML = html;
}

export async function openFechaEvalModal() {
  await openModal('fechaEvalModal');
  document.getElementById('fechaEvalForm').reset();
  document.getElementById('fechaEvalIdInput').value = '';
  document.getElementById('fechaEvalFecha').disabled = false;
  document.getElementById('fechaEvalModalTitle').textContent = 'Agregar Fecha de Evaluación';
}

export async function editFechaEval(id) {
  const fe = state.fechaEvalCache.find(item => item.id === id);
  if (!fe) return;
  
  // Validar si tiene evaluaciones antes de permitir abrir edición
  const tieneEvaluaciones = state.evaluationsCache.some(ev => ev.fecha === fe.fecha);
  if (tieneEvaluaciones) {
    showToast("No se puede modificar una fecha que ya tiene evaluaciones realizadas.", "error");
    return;
  }
  
  await openModal('fechaEvalModal');
  document.getElementById('fechaEvalIdInput').value = fe.id;
  document.getElementById('fechaEvalFecha').value = fe.fecha;
  document.getElementById('fechaEvalFecha').disabled = false;
  
  document.getElementById('fechaEvalModalTitle').textContent = 'Modificar Fecha de Evaluación';
}

export async function saveFechaEval(event) {
  if (event) event.preventDefault();
  const id = document.getElementById('fechaEvalIdInput').value;
  const fecha = document.getElementById('fechaEvalFecha').value;
  
  if (!fecha) {
    showToast("Por favor seleccione una fecha.", "error");
    return;
  }
  
  // Validar si se está modificando y si la fecha vieja tenía evaluaciones
  if (id) {
    const oldFe = state.fechaEvalCache.find(item => item.id === parseInt(id));
    if (oldFe) {
      const tieneEvaluaciones = state.evaluationsCache.some(ev => ev.fecha === oldFe.fecha);
      if (tieneEvaluaciones) {
        showToast("No se puede modificar una fecha que ya tiene evaluaciones realizadas.", "error");
        return;
      }
    }
  }
  
  // Validar duplicados de fecha en el sistema
  const existeFecha = state.fechaEvalCache.some(item => item.fecha === fecha && item.id !== parseInt(id));
  if (existeFecha) {
    showToast("Esta fecha ya se encuentra registrada en el sistema.", "error");
    return;
  }
  
  const payload = { fecha };
  
  try {
    if (id) {
      const { error } = await state.supabaseClient
        .from('fecha_eval')
        .update(payload)
        .eq('id', id);
        
      if (error) throw error;
      showToast("Fecha de evaluación actualizada exitosamente.");
    } else {
      const { error } = await state.supabaseClient
        .from('fecha_eval')
        .insert([payload]);
        
      if (error) throw error;
      showToast("Fecha de evaluación creada exitosamente.");
    }
    
    closeModal('fechaEvalModal');
    await loadCaches();
    renderFechasEvalCrud();
  } catch (err) {
    handleRlsError(err);
  }
}

export async function deleteFechaEval(id) {
  const fe = state.fechaEvalCache.find(item => item.id === id);
  if (!fe) return;
  
  // Validar si tiene evaluaciones
  const tieneEvaluaciones = state.evaluationsCache.some(ev => ev.fecha === fe.fecha);
  if (tieneEvaluaciones) {
    showToast("No se puede eliminar una fecha que ya tiene evaluaciones realizadas.", "error");
    return;
  }
  
  if (!confirm(`¿Está seguro de eliminar la fecha de evaluación "${new Date(fe.fecha + 'T00:00:00').toLocaleDateString()}"?`)) {
    return;
  }
  
  try {
    const { error } = await state.supabaseClient
      .from('fecha_eval')
      .delete()
      .eq('id', id);
      
    if (error) throw error;
    
    showToast("Fecha de evaluación eliminada correctamente.");
    await loadCaches();
    renderFechasEvalCrud();
  } catch (err) {
    handleRlsError(err);
  }
}

export function renderDepartamentosCrud() {
  const tbody = document.getElementById('departamentosTableBody');
  if (!tbody) return;
  
  tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;"><i class="fa-solid fa-spinner fa-spin"></i> Cargando unidades administrativas...</td></tr>';
  
  if (state.departmentsCache.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 2rem;">No hay unidades administrativas registradas.</td></tr>';
    return;
  }
  
  let html = '';
  state.departmentsCache.forEach(dep => {
    const createdDate = dep.created_at ? new Date(dep.created_at).toLocaleDateString() : 'N/A';
    
    // Verificar si algún trabajador pertenece a este departamento
    const tieneTrabajadores = state.workersCache.some(w => w.departamento === dep.departamento);
    
    let actionButtons = '';
    if (tieneTrabajadores) {
      actionButtons = `
        <button class="outline secondary" style="padding: 0.25rem 0.5rem; margin-right: 0.25rem; margin-bottom: 0;" onclick="editDepartamento(${dep.id})" title="Modificar">
          <i class="fa-solid fa-pen"></i>
        </button>
        <span style="background-color: var(--primary-focus); color: var(--primary); font-size: 0.8rem; padding: 0.25rem 0.5rem; border-radius: 6px; font-weight: 600; display: inline-flex; align-items: center; gap: 0.25rem; margin-left: 0.25rem;" title="Esta unidad contiene trabajadores y no puede ser eliminada.">
          <i class="fa-solid fa-lock"></i> Con Personal
        </span>
      `;
    } else {
      actionButtons = `
        <button class="outline secondary" style="padding: 0.25rem 0.5rem; margin-right: 0.25rem; margin-bottom: 0;" onclick="editDepartamento(${dep.id})" title="Modificar">
          <i class="fa-solid fa-pen"></i>
        </button>
        <button class="outline contrast" style="padding: 0.25rem 0.5rem; margin-bottom: 0;" onclick="deleteDepartamento(${dep.id})" title="Eliminar">
          <i class="fa-solid fa-trash"></i>
        </button>
      `;
    }
    
    html += `
      <tr>
        <td><strong>${dep.id}</strong></td>
        <td>${dep.departamento || 'N/A'}</td>
        <td>${dep.empresa || 'N/A'}</td>
        <td>${createdDate}</td>
        <td style="text-align: right; white-space: nowrap;">
          ${actionButtons}
        </td>
      </tr>
    `;
  });
  tbody.innerHTML = html;
}

export async function openDepartamentoModal() {
  await openModal('departamentoModal');
  document.getElementById('departamentoForm').reset();
  document.getElementById('departamentoIdInput').value = '';
  document.getElementById('departamentoModalTitle').textContent = 'Agregar Unidad Administrativa';
}

export async function editDepartamento(id) {
  const dep = state.departmentsCache.find(item => item.id === id);
  if (!dep) return;
  
  await openModal('departamentoModal');
  document.getElementById('departamentoIdInput').value = dep.id;
  document.getElementById('depNombre').value = dep.departamento || '';
  document.getElementById('depEmpresa').value = dep.empresa || '';
  
  document.getElementById('departamentoModalTitle').textContent = 'Modificar Unidad Administrativa';
}

export async function saveDepartamento(event) {
  if (event) event.preventDefault();
  const id = document.getElementById('departamentoIdInput').value;
  const nombre = document.getElementById('depNombre').value.trim();
  const empresa = document.getElementById('depEmpresa').value.trim();
  
  if (!nombre || !empresa) {
    showToast("Por favor complete todos los campos.", "error");
    return;
  }
  
  // Validar duplicados de departamento en el sistema
  const existeDep = state.departmentsCache.some(item => 
    item.departamento.toLowerCase() === nombre.toLowerCase() && 
    item.empresa.toLowerCase() === empresa.toLowerCase() && 
    item.id !== parseInt(id)
  );
  if (existeDep) {
    showToast("Esta unidad administrativa ya se encuentra registrada para esa empresa.", "error");
    return;
  }
  
  const payload = { 
    departamento: nombre,
    empresa: empresa
  };
  
  try {
    if (id) {
      const { error } = await state.supabaseClient
        .from('departamento')
        .update(payload)
        .eq('id', id);
        
      if (error) throw error;
      showToast("Unidad administrativa actualizada exitosamente.");
    } else {
      const { error } = await state.supabaseClient
        .from('departamento')
        .insert([payload]);
        
      if (error) throw error;
      showToast("Unidad administrativa creada exitosamente.");
    }
    
    closeModal('departamentoModal');
    await loadCaches();
    renderDepartamentosCrud();
  } catch (err) {
    handleRlsError(err);
  }
}

export async function deleteDepartamento(id) {
  const dep = state.departmentsCache.find(item => item.id === id);
  if (!dep) return;
  
  // Validar si tiene trabajadores asignados
  const tieneTrabajadores = state.workersCache.some(w => w.departamento === dep.departamento);
  if (tieneTrabajadores) {
    showToast("No se puede eliminar una unidad administrativa que tiene trabajadores asignados.", "error");
    return;
  }
  
  if (!confirm(`¿Está seguro de eliminar la unidad administrativa "${dep.departamento}"?`)) {
    return;
  }
  
  try {
    const { error } = await state.supabaseClient
      .from('departamento')
      .delete()
      .eq('id', id);
      
    if (error) throw error;
    
    showToast("Unidad administrativa eliminada correctamente.");
    await loadCaches();
    renderDepartamentosCrud();
  } catch (err) {
    handleRlsError(err);
  }
}

export async function showEvaluationDetail(trabajadorId, fecha) {
  const tId = parseInt(trabajadorId);
  const worker = state.workersCache.find(w => w.id === tId);
  
  await openModal('detalleEvaluacionModal');
  
  const workerName = worker ? worker.nombre : `Desconocido (ID: ${tId})`;
  const workerFicha = worker ? (worker.ficha || 'N/A') : 'N/A';
  const workerCargo = worker ? (worker.cargo || 'N/A') : 'N/A';
  const workerDept = worker ? (worker.departamento || 'N/A') : 'N/A';
  
  // Buscar evaluaciones correspondientes a esta combinación
  const workerEvals = state.evaluationsCache.filter(ev => {
    if (ev.fecha !== fecha) return false;
    try {
      const parsed = safeParseJSON(ev.evaluacion);
      return parsed && parsed.trabajador_id === tId;
    } catch(e) { return false; }
  });
  
  const isClosed = workerEvals.some(ev => ev.estado === true);
  
  // Rellenar datos de cabecera
  document.getElementById('detEvalTrabajador').textContent = workerName;
  document.getElementById('detEvalFicha').textContent = workerFicha;
  document.getElementById('detEvalCargo').textContent = workerCargo;
  document.getElementById('detEvalDepartamento').textContent = workerDept;
  document.getElementById('detEvalFecha').textContent = new Date(fecha + 'T00:00:00').toLocaleDateString();
  document.getElementById('detEvalEstado').innerHTML = isClosed ? 
    '<span class="badge" style="background-color: var(--primary); color: #ffffff; padding: 0.1rem 0.4rem; font-size: 0.75rem;">Cerrada</span>' : 
    '<span class="badge" style="background-color: #eab308; color: #ffffff; padding: 0.1rem 0.4rem; font-size: 0.75rem;">Abierta</span>';
    
  // Guardar datos en el botón de eliminar
  const deleteBtn = document.getElementById('btnDeleteEvaluation');
  if (deleteBtn) {
    deleteBtn.setAttribute('data-trabajador-id', tId);
    deleteBtn.setAttribute('data-fecha', fecha);
  }
  
  // Renderizar la tabla de aspectos
  const workerTipo = (worker && worker.tipo) ? worker.tipo.toUpperCase().trim() : 'GERENCIAL';
  const matchingClasses = state.classesCache.filter(c => {
    const compTipo = c.tipo ? c.tipo.toUpperCase().trim() : 'GERENCIAL';
    return compTipo === workerTipo;
  });
  
  let tableHtml = '';
  matchingClasses.forEach(c => {
    const aspectosDeClase = state.aspectsCache.filter(a => a.clase_id === c.id);
    
    aspectosDeClase.forEach(a => {
      const evRow = workerEvals.find(ev => ev.item_evaluacion_id === a.id);
      let answerText = 'Sin responder';
      let pctLabel = '-';
      
      if (evRow) {
        try {
          const parsed = safeParseJSON(evRow.evaluacion);
          const val = parsed ? parsed.valor : null;
          if (val !== null && val !== undefined && val !== '') {
            if (a.tipo === 'si/no') {
              answerText = val.toUpperCase();
            } else if (a.tipo === 'rango1,4') {
              answerText = val;
              const valNum = parseFloat(val);
              const weight = a.ponderacion !== null && a.ponderacion !== undefined ? parseFloat(a.ponderacion) : 0;
              if (!isNaN(valNum)) {
                const pct = (valNum / 4) * weight;
                pctLabel = `${pct.toFixed(1)}% (de ${weight}%)`;
              }
            } else {
              answerText = val;
            }
          }
        } catch(e) {}
      }
      
      tableHtml += `
        <tr>
          <td><strong>${c.titulo}</strong></td>
          <td style="text-align: justify;"><mark style="background-color: var(--primary-focus); color: var(--primary); border-radius: 4px; font-weight: 700; padding: 0.1rem 0.3rem; margin-right: 0.5rem;">${a.orden}</mark>${a.descripcion}</td>
          <td style="text-align: right; font-weight: 600;">${answerText}</td>
          <td style="text-align: right; font-weight: 600; color: var(--primary);">${pctLabel}</td>
        </tr>
      `;
    });
  });
  
  if (tableHtml === '') {
    tableHtml = '<tr><td colspan="4" style="text-align: center;">No hay aspectos de evaluación disponibles para este tipo de colaborador.</td></tr>';
  }
  
  document.getElementById('detalleEvaluacionTableBody').innerHTML = tableHtml;
}

export async function confirmDeleteEvaluation() {
  const deleteBtn = document.getElementById('btnDeleteEvaluation');
  if (!deleteBtn) return;
  const trabajadorId = deleteBtn.getAttribute('data-trabajador-id');
  const fecha = deleteBtn.getAttribute('data-fecha');
  
  if (!trabajadorId || !fecha) return;
  
  const confirmDelete = confirm("¿Está seguro de que desea eliminar permanentemente esta evaluación completa?");
  if (confirmDelete) {
    await deleteEvaluation(trabajadorId, fecha);
  }
}

export async function deleteEvaluation(trabajadorId, fecha) {
  const tId = parseInt(trabajadorId);
  
  const rowsToDelete = state.evaluationsCache.filter(ev => {
    if (ev.fecha !== fecha) return false;
    try {
      const parsed = safeParseJSON(ev.evaluacion);
      return parsed && parsed.trabajador_id === tId;
    } catch (e) {
      return false;
    }
  });
  
  const idsToDelete = rowsToDelete.map(r => r.id);
  
  if (idsToDelete.length === 0) {
    showToast("No se encontraron registros de evaluación para eliminar.", "error");
    return;
  }
  
  try {
    const { error } = await state.supabaseClient
      .from('evaluacion')
      .delete()
      .in('id', idsToDelete);
      
    if (error) throw error;
    
    showToast("Evaluación eliminada correctamente.");
    closeModal('detalleEvaluacionModal');
    await loadCaches();
    renderCierreEvaluaciones();
  } catch (err) {
    handleRlsError(err);
  }
}

