// js/evaluations.js - Formulario de evaluaciones y listado de subordinados

import { state } from './state.js';
import { safeParseJSON, showToast, handleRlsError } from './utils.js';
import { loadCaches } from './supabase.js';
import { showWorkerChartModal } from './reports.js';

export function renderSubordinados() {
  const tbody = document.getElementById('subordinadosTableBody');
  if (!tbody) return;
  
  tbody.innerHTML = '';
  
  const isAdmin = state.currentUser && state.currentUser.rol === 'admin';
  
  // Actualizar textos de cabecera según el rol
  const headerTitle = document.getElementById('evaluacionesHeaderTitle');
  const headerDesc = document.getElementById('evaluacionesHeaderDesc');
  if (headerTitle && headerDesc) {
    if (isAdmin) {
      headerTitle.innerHTML = '<i class="fa-solid fa-users-gear text-primary"></i> Evaluaciones de Desempeño';
      headerDesc.textContent = 'Seleccione el trabajador que desea evaluar o ver. Se muestran todos los trabajadores registrados en el sistema por su rol de administrador.';
    } else {
      headerTitle.innerHTML = '<i class="fa-solid fa-users-gear text-primary"></i> Personal a su Cargo';
      headerDesc.textContent = 'Seleccione el trabajador que desea evaluar. Solo se muestran los trabajadores bajo su supervisión directa.';
    }
  }
  
  // Buscar trabajadores bajo la supervisión directa del usuario actual (o todos si es admin)
  const subordinados = isAdmin
    ? state.workersCache
    : state.workersCache.filter(w => w.supervisor_id === state.currentUser.id);
  
  // Filtrar según el término de búsqueda (nombre, cédula o departamento)
  let filtered = subordinados;
  if (state.evalsSearchQuery) {
    const q = state.evalsSearchQuery.toLowerCase();
    filtered = subordinados.filter(w => 
      (w.nombre && w.nombre.toLowerCase().includes(q)) ||
      (w.cedula && w.cedula.toLowerCase().includes(q)) ||
      (w.departamento && w.departamento.toLowerCase().includes(q))
    );
  }
  
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / state.evalsPerPage));
  
  if (state.evalsCurrentPage > totalPages) {
    state.evalsCurrentPage = totalPages;
  }
  
  const startIndex = (state.evalsCurrentPage - 1) * state.evalsPerPage;
  const endIndex = Math.min(startIndex + state.evalsPerPage, total);
  
  // Actualizar controles de interfaz de paginación
  const rangeLabel = document.getElementById('evalsShowingRange');
  const totalLabel = document.getElementById('evalsTotalCount');
  const curPageLabel = document.getElementById('evalsCurrentPageLabel');
  const totPagesLabel = document.getElementById('evalsTotalPagesLabel');
  const prevBtn = document.getElementById('btnPrevEvalsPage');
  const nextBtn = document.getElementById('btnNextEvalsPage');
  
  if (rangeLabel) rangeLabel.textContent = total === 0 ? '0' : `${startIndex + 1}-${endIndex}`;
  if (totalLabel) totalLabel.textContent = total;
  if (curPageLabel) curPageLabel.textContent = state.evalsCurrentPage;
  if (totPagesLabel) totPagesLabel.textContent = totalPages;
  
  if (prevBtn) prevBtn.disabled = state.evalsCurrentPage === 1;
  if (nextBtn) nextBtn.disabled = state.evalsCurrentPage === totalPages;
  
  const paginationContainer = document.getElementById('evalsPaginationContainer');
  if (paginationContainer) {
    paginationContainer.style.display = total === 0 ? 'none' : 'flex';
  }
  
  const pageWorkers = filtered.slice(startIndex, endIndex);
  
  if (pageWorkers.length === 0) {
    const emptyMsg = state.evalsSearchQuery
      ? 'No se encontraron trabajadores que coincidan con la búsqueda.'
      : (isAdmin ? 'No hay trabajadores registrados en el sistema.' : 'Usted no tiene trabajadores registrados bajo su supervisión directa.');
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 2rem;">${emptyMsg}</td></tr>`;
    return;
  }
  
  let html = '';
  pageWorkers.forEach(s => {
    // Buscar si este subordinado tiene alguna evaluación en la caché para pintar el botón del gráfico
    const tieneEvaluaciones = state.evaluationsCache.some(ev => {
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

export function handleEvalWorkerSearch(query) {
  state.evalsSearchQuery = query.trim();
  state.evalsCurrentPage = 1;
  renderSubordinados();
}

export function changeEvalsPage(direction) {
  state.evalsCurrentPage += direction;
  renderSubordinados();
}

export async function startEvaluation(trabajadorId) {
  const t = state.workersCache.find(worker => worker.id === trabajadorId);
  if (!t) return;
  
  // Configurar etiquetas
  document.getElementById('evaluadoIdInput').value = t.id;
  document.getElementById('evaluadoNombreLabel').textContent = t.nombre;
  document.getElementById('evaluadoFichaLabel').textContent = t.ficha || 'N/A';
  const tipoLabel = document.getElementById('evaluadoTipoLabel');
  if (tipoLabel) {
    tipoLabel.textContent = t.tipo || 'ADMINISTRATIVO';
  }
  
  // Resetear formulario
  document.getElementById('evaluacionIdInput').value = '';
  
  // Poblar select de fechas de evaluación
  const selectFecha = document.getElementById('evalFecha');
  if (selectFecha) {
    selectFecha.innerHTML = '';
    state.fechaEvalCache.forEach(fe => {
      const option = document.createElement('option');
      option.value = fe.fecha;
      option.textContent = new Date(fe.fecha + 'T00:00:00').toLocaleDateString();
      selectFecha.appendChild(option);
    });
  }
  
  // Renderizar formulario de competencias y aspectos según el tipo del trabajador
  renderEvaluationFormQuestions(t.tipo);
  
  // Mostrar formulario de evaluación y ocultar lista
  document.getElementById('evaluationFormContainer').style.display = 'block';
  document.getElementById('subordinadosTableBody').closest('.premium-card').style.display = 'none';

  // Consultar evaluaciones de este trabajador en Supabase para asegurar datos frescos
  try {
    const { data: workerDbEvals, error } = await state.supabaseClient
      .from('evaluacion')
      .select('*')
      .like('evaluacion', `%"trabajador_id":${trabajadorId}%`);
      
    if (!error && workerDbEvals && workerDbEvals.length > 0) {
      // Integrar a caché local
      workerDbEvals.forEach(wev => {
        const idx = state.evaluationsCache.findIndex(x => x.id === wev.id);
        if (idx >= 0) state.evaluationsCache[idx] = wev;
        else state.evaluationsCache.push(wev);
      });
      
      // Fechas con evaluaciones para este trabajador
      const fechasConEvaluacion = [...new Set(workerDbEvals.map(ev => ev.fecha))].sort((a,b) => new Date(b) - new Date(a));
      
      // Agregar fechas faltantes al select si no existieran
      if (selectFecha) {
        fechasConEvaluacion.forEach(f => {
          if (![...selectFecha.options].some(opt => opt.value === f)) {
            const opt = document.createElement('option');
            opt.value = f;
            opt.textContent = new Date(f + 'T00:00:00').toLocaleDateString();
            selectFecha.appendChild(opt);
          }
        });
        
        // Seleccionar por defecto la fecha que tiene evaluación existente
        if (fechasConEvaluacion.length > 0) {
          selectFecha.value = fechasConEvaluacion[0];
        }
      }
    } else if (state.fechaEvalCache.length > 0 && selectFecha) {
      selectFecha.value = state.fechaEvalCache[0].fecha;
    }
  } catch (err) {
    console.error("Error al sincronizar evaluaciones del trabajador:", err);
  }

  document.getElementById('evalEstadoLabel').value = 'Abierta (Editable)';
  document.getElementById('btnGuardarEvaluacion').disabled = false;
  
  // Verificar y marcar las respuestas almacenadas para la fecha activa
  await checkEvaluationDateUnique();
}

export function closeEvaluationForm() {
  document.getElementById('evaluationFormContainer').style.display = 'none';
  document.getElementById('subordinadosTableBody').closest('.premium-card').style.display = 'block';
}

export function renderEvaluationFormQuestions(trabajadorTipo) {
  const container = document.getElementById('dynamicCompetenciesContainer');
  if (!container) return;
  
  container.innerHTML = '';
  
  if (state.classesCache.length === 0) {
    container.innerHTML = '<p class="text-error">No hay competencias registradas en el sistema para evaluar.</p>';
    return;
  }
  
  if (state.aspectsCache.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 2rem; background: rgba(21, 128, 61, 0.05); border: 1px dashed var(--primary); border-radius: 12px; color: var(--primary);">
        <i class="fa-solid fa-triangle-exclamation" style="font-size: 2.5rem; margin-bottom: 0.75rem;"></i>
        <p style="margin: 0; font-weight: 600; font-size: 1.1rem;">No hay aspectos de evaluación registrados en la base de datos.</p>
        <p style="margin: 0.25rem 0 0 0; font-size: 0.875rem; color: var(--muted-color);">Por favor, ingrese al Panel Administrativo y agregue aspectos de evaluación para poder realizar evaluaciones.</p>
      </div>
    `;
    return;
  }

  // Determinar tipo de trabajador objetivo (GERENCIAL o ADMINISTRATIVO)
  let tipoTrabajador = trabajadorTipo;
  if (!tipoTrabajador) {
    const evaluadoId = parseInt(document.getElementById('evaluadoIdInput')?.value);
    if (evaluadoId) {
      const worker = state.workersCache.find(w => w.id === evaluadoId);
      if (worker) tipoTrabajador = worker.tipo;
    }
  }
  const tipoNormalizado = (tipoTrabajador || 'ADMINISTRATIVO').toUpperCase().trim();

  // Filtrar competencias según el tipo del trabajador (GERENCIAL o ADMINISTRATIVO)
  const clasesFiltradas = state.classesCache.filter(c => {
    const cTipo = (c.tipo || '').toUpperCase().trim();
    return cTipo === tipoNormalizado;
  });

  if (clasesFiltradas.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 2rem; background: rgba(21, 128, 61, 0.05); border: 1px dashed var(--primary); border-radius: 12px; color: var(--primary);">
        <i class="fa-solid fa-triangle-exclamation" style="font-size: 2.5rem; margin-bottom: 0.75rem;"></i>
        <p style="margin: 0; font-weight: 600; font-size: 1.1rem;">No hay competencias registradas para el tipo "${tipoNormalizado}".</p>
        <p style="margin: 0.25rem 0 0 0; font-size: 0.875rem; color: var(--muted-color);">Por favor, verifique la configuración de competencias en el Panel Administrativo.</p>
      </div>
    `;
    return;
  }

  const escalaOptions = [
    { valor: 1, label: 'Nunca', pts: '(0 Pts)' },
    { valor: 2, label: 'Casi Nunca', pts: '(1 Pts)' },
    { valor: 3, label: 'Frecuentemente', pts: '(2 Pts)' },
    { valor: 4, label: 'Siempre', pts: '(3 Pts)' }
  ];
  
  // Agrupar aspectos por competencia (clase_id) filtradas por tipo del trabajador
  clasesFiltradas.forEach(c => {
    const aspectosDeClase = state.aspectsCache.filter(a => a.clase_id === c.id && a.activo !== false);
    
    // Solo renderizar la competencia si tiene aspectos de evaluación asociados
    if (aspectosDeClase.length > 0) {
      let claseHTML = `
        <div class="competencia-section">
          <div style="display: flex; justify-content: space-between; align-items: baseline; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.5rem;">
            <h4 style="margin: 0; color: var(--primary); font-size: 1.25rem;">${c.titulo}</h4>
            ${c.tipo ? `<span class="badge" style="font-size: 0.75rem; background-color: rgba(21, 128, 61, 0.1); color: var(--primary); border: 1px solid var(--primary);">${c.tipo}</span>` : ''}
          </div>
          <p style="font-size: 0.875rem; color: var(--muted-color); margin-bottom: 1rem; text-align: justify;">${c.descripcion || ''}</p>
          <div class="aspectos-container">
      `;
      
      aspectosDeClase.forEach(a => {
        let answerFieldHTML = '';
        
        if (a.tipo === 'rango1,4') {
          answerFieldHTML = `
            <div class="rango-container" data-aspecto-id="${a.id}">
              ${escalaOptions.map(opt => `
                <div class="rango-option" data-valor="${opt.valor}" id="label-asp-${a.id}-${opt.valor}" onclick="selectRangoOption(${a.id}, ${opt.valor})" title="${opt.valor}. ${opt.label} ${opt.pts}">
                  <input type="radio" name="aspecto_${a.id}" value="${opt.valor}" style="display: none;">
                  <span class="rango-num">${opt.valor}</span>
                  <span class="rango-title">${opt.label}</span>
                  <span class="rango-pts">${opt.pts}</span>
                </div>
              `).join('')}
            </div>
          `;
        } else if (a.tipo === 'si/no') {
          answerFieldHTML = `
            <div class="sino-container" data-aspecto-id="${a.id}">
              <label style="display: flex; align-items: center; gap: 0.35rem; cursor: pointer; margin-bottom: 0;">
                <input type="radio" name="aspecto_${a.id}" value="si"> Sí
              </label>
              <label style="display: flex; align-items: center; gap: 0.35rem; cursor: pointer; margin-bottom: 0;">
                <input type="radio" name="aspecto_${a.id}" value="no"> No
              </label>
            </div>
          `;
        } else { // text
          answerFieldHTML = `
            <textarea name="aspecto_${a.id}" rows="2" placeholder="Escriba comentarios u observaciones (opcional)..." style="margin-top: 0.5rem;"></textarea>
          `;
        }
        
        const ponderacionBadge = (a.ponderacion !== null && a.ponderacion !== undefined && a.ponderacion !== '')
          ? `<span style="font-size: 0.75rem; font-weight: 600; color: var(--muted-color); margin-left: 0.5rem;">[Pond: ${a.ponderacion}%]</span>`
          : '';

        claseHTML += `
          <div class="aspecto-row" data-aspecto-id="${a.id}" data-clase-id="${c.id}" data-tipo="${a.tipo}">
            <div class="aspecto-desc">
              <mark style="background-color: var(--primary-focus); color: var(--primary); border-radius: 4px; font-weight: 700; padding: 0.1rem 0.3rem; margin-right: 0.5rem;">${a.orden}</mark>
              ${a.descripcion}
              ${ponderacionBadge}
            </div>
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

// Lógica de selección de botón de rango 1-4 (con soporte de toggle/deselección)
export function selectRangoOption(aspectoId, valor) {
  const activeOpt = document.getElementById(`label-asp-${aspectoId}-${valor}`);
  const radio = activeOpt ? activeOpt.querySelector('input[type="radio"]') : null;
  
  // Si ya estaba seleccionada, permitir deseleccionar (queda sin respuesta / -1)
  if (activeOpt && activeOpt.classList.contains('selected')) {
    activeOpt.classList.remove('selected');
    if (radio) radio.checked = false;
    return;
  }
  
  // Deseleccionar todas las opciones del rango
  for (let i = 1; i <= 4; i++) {
    const opt = document.getElementById(`label-asp-${aspectoId}-${i}`);
    if (opt) {
      opt.classList.remove('selected');
      const r = opt.querySelector('input[type="radio"]');
      if (r) r.checked = false;
    }
  }
  
  // Seleccionar la opción clickeada
  if (activeOpt) {
    activeOpt.classList.add('selected');
    if (radio) radio.checked = true;
  }
}

// Verificar si existe evaluación previa en la fecha seleccionada
export async function checkEvaluationDateUnique() {
  const trabajadorId = parseInt(document.getElementById('evaluadoIdInput').value);
  const fecha = document.getElementById('evalFecha').value;
  
  if (!trabajadorId || !fecha) return;
  
  // Limpiar respuestas previas en el formulario antes de rellenar
  resetAnswersInForm();
  
  // Buscar en las evaluaciones cargadas en caché
  let evalRows = state.evaluationsCache.filter(ev => {
    if (ev.fecha !== fecha) return false;
    try {
      const parsed = safeParseJSON(ev.evaluacion);
      return parsed && String(parsed.trabajador_id) === String(trabajadorId);
    } catch(e) {
      return false;
    }
  });
  
  // Si no se encontraron en caché para esta fecha, consultar a Supabase directamente
  if (evalRows.length === 0) {
    try {
      const { data, error } = await state.supabaseClient
        .from('evaluacion')
        .select('*')
        .eq('fecha', fecha)
        .like('evaluacion', `%"trabajador_id":${trabajadorId}%`);
        
      if (!error && data && data.length > 0) {
        data.forEach(wev => {
          const idx = state.evaluationsCache.findIndex(x => x.id === wev.id);
          if (idx >= 0) state.evaluationsCache[idx] = wev;
          else state.evaluationsCache.push(wev);
        });
        evalRows = data;
      }
    } catch(e) {
      console.error("Error al buscar evaluación para fecha:", e);
    }
  }
  
  if (evalRows.length > 0) {
    // Ya existe evaluación para este trabajador en esta fecha
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
          
          // Si tiene valor "-1" o está vacío, se deja sin respuesta
          if (rating === '-1' || rating === -1 || rating === '' || rating === null || rating === undefined) {
            disableFieldsInRow(aspectoRow, isClosed);
            return;
          }
          
          if (tipo === 'rango1,4') {
            const valNum = parseInt(rating);
            if (!isNaN(valNum) && valNum >= 1 && valNum <= 4) {
              const activeOpt = document.getElementById(`label-asp-${aspectoId}-${valNum}`);
              if (activeOpt) {
                activeOpt.classList.add('selected');
                const radio = activeOpt.querySelector('input[type="radio"]');
                if (radio) radio.checked = true;
              }
            }
          } else if (tipo === 'si/no') {
            const radio = aspectoRow.querySelector(`input[value="${String(rating).toLowerCase()}"]`);
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
    
    showToast(`Cargada evaluación existente del ${new Date(fecha + 'T00:00:00').toLocaleDateString()}. Status: ${isClosed ? 'Cerrada' : 'Abierta'}.`, "info");
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

export function resetAnswersInForm() {
  const radioButtons = document.querySelectorAll('#dynamicCompetenciesContainer input[type="radio"]');
  radioButtons.forEach(radio => radio.checked = false);
  
  const textareas = document.querySelectorAll('#dynamicCompetenciesContainer textarea');
  textareas.forEach(ta => ta.value = '');
  
  const rangoLabels = document.querySelectorAll('.rango-option');
  rangoLabels.forEach(l => l.classList.remove('selected'));
}

export function disableFieldsInRow(rowElement, disable) {
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
export async function saveEvaluation(event) {
  if (event) event.preventDefault();
  const trabajadorId = parseInt(document.getElementById('evaluadoIdInput').value);
  const fecha = document.getElementById('evalFecha').value;
  const estadoLabel = document.getElementById('evalEstadoLabel').value;
  
  if (!trabajadorId) {
    showToast("No se ha identificado el trabajador a evaluar.", "error");
    return;
  }

  if (!fecha) {
    showToast("Por favor seleccione una fecha de evaluación válida.", "error");
    return;
  }
  
  if (estadoLabel.includes('Cerrada')) {
    showToast("No se puede guardar una evaluación cerrada.", "error");
    return;
  }
  
  // Buscar filas existentes en base de datos para esta combinación (trabajador, fecha)
  const existingRows = state.evaluationsCache.filter(ev => {
    if (ev.fecha !== fecha) return false;
    try {
      const parsed = safeParseJSON(ev.evaluacion);
      return parsed && String(parsed.trabajador_id) === String(trabajadorId);
    } catch(e) {
      return false;
    }
  });
  
  // Recopilar respuestas del formulario
  const rows = document.querySelectorAll('.aspecto-row');
  const insertPayloads = [];
  
  rows.forEach(r => {
    const aspectoId = parseInt(r.getAttribute('data-aspecto-id'));
    const claseId = parseInt(r.getAttribute('data-clase-id'));
    const tipo = r.getAttribute('data-tipo');
    
    let answerValue = '';
    
    if (tipo === 'rango1,4') {
      const checkedRadio = r.querySelector('input[type="radio"]:checked');
      if (checkedRadio) answerValue = checkedRadio.value;
    } else if (tipo === 'si/no') {
      const checkedRadio = r.querySelector('input[type="radio"]:checked');
      if (checkedRadio) answerValue = checkedRadio.value;
    } else {
      const textarea = r.querySelector('textarea');
      if (textarea) answerValue = textarea.value.trim();
    }
    
    // Si no se ha seleccionado respuesta o quedan respuestas sin seleccionar, agregarla como "-1" (no aplica)
    if (!answerValue) {
      answerValue = "-1";
    }
    
    // Determinar si ya existía una fila para este aspecto
    const existingRow = existingRows.find(ev => Number(ev.item_evaluacion_id) === Number(aspectoId));
    
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
    
    if (existingRow && existingRow.id) {
      payload.id = existingRow.id; // Incluir ID para upsert
    }
    
    insertPayloads.push(payload);
  });
  
  if (insertPayloads.length === 0) {
    showToast("No hay aspectos a evaluar en el formulario.", "warning");
    return;
  }
  
  const btnGuardar = document.getElementById('btnGuardarEvaluacion');
  const originalBtnText = btnGuardar ? btnGuardar.innerHTML : '';
  if (btnGuardar) {
    btnGuardar.disabled = true;
    btnGuardar.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';
  }

  try {
    const { error } = await state.supabaseClient
      .from('evaluacion')
      .upsert(insertPayloads);
      
    if (error) throw error;
    
    showToast("Evaluación guardada exitosamente.");
    
    closeEvaluationForm();
    await loadCaches();
    renderSubordinados();
  } catch (err) {
    handleRlsError(err);
  } finally {
    if (btnGuardar) {
      btnGuardar.disabled = false;
      btnGuardar.innerHTML = originalBtnText;
    }
  }
}
