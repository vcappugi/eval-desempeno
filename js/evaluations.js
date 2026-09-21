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
    { valor: 1, label: 'Nunca' },
    { valor: 2, label: 'Casi Nunca' },
    { valor: 3, label: 'Frecuentemente' },
    { valor: 4, label: 'Siempre' }
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
                <div class="rango-option" data-valor="${opt.valor}" id="label-asp-${a.id}-${opt.valor}" onclick="selectRangoOption(${a.id}, ${opt.valor})" title="${opt.valor}. ${opt.label}">
                  <input type="radio" name="aspecto_${a.id}" value="${opt.valor}" style="display: none;">
                  <span class="rango-num">${opt.valor}</span>
                  <span class="rango-title">${opt.label}</span>
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

        claseHTML += `
          <div class="aspecto-row" data-aspecto-id="${a.id}" data-clase-id="${c.id}" data-tipo="${a.tipo}">
            <div class="aspecto-desc">
              <mark style="background-color: var(--primary-focus); color: var(--primary); border-radius: 4px; font-weight: 700; padding: 0.1rem 0.3rem; margin-right: 0.5rem;">${a.orden}</mark>
              ${a.descripcion}
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

// Lógica de selección de botón de rango 1-4 (con soporte de toggle/deselección estricta de una sola opción)
export function selectRangoOption(aspectoId, valor) {
  // Localizar la fila correspondiente al aspecto
  const aspectoRow = document.querySelector(`.aspecto-row[data-aspecto-id="${aspectoId}"]`);
  if (!aspectoRow) return;

  const targetOption = aspectoRow.querySelector(`.rango-option[data-valor="${valor}"]`);
  const targetRadio = targetOption ? targetOption.querySelector('input[type="radio"]') : null;
  const isCurrentlySelected = targetOption && (targetOption.classList.contains('selected') || (targetRadio && targetRadio.checked));

  // 1. Limpiar SIEMPRE y de forma absoluta todas las opciones de este aspecto
  const allOptions = aspectoRow.querySelectorAll('.rango-option');
  allOptions.forEach(opt => {
    opt.classList.remove('selected');
    const r = opt.querySelector('input[type="radio"]');
    if (r) r.checked = false;
  });

  // 2. Si ya estaba seleccionada la misma opción, queda deseleccionada (toggle a sin respuesta / -1)
  if (isCurrentlySelected) {
    return;
  }

  // 3. Activar ÚNICAMENTE la opción seleccionada
  if (targetOption) {
    targetOption.classList.add('selected');
    if (targetRadio) targetRadio.checked = true;
    aspectoRow.classList.remove('aspecto-incompleto');
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
    
    // Deduplicar las filas recuperadas por item_evaluacion_id conservando siempre la más reciente (mayor id)
    const uniqueMap = new Map();
    evalRows.sort((a, b) => (Number(a.id) || 0) - (Number(b.id) || 0));
    evalRows.forEach(row => {
      uniqueMap.set(Number(row.item_evaluacion_id), row);
    });
    const cleanEvalRows = Array.from(uniqueMap.values());
    
    // Rellenar las respuestas en el formulario garantizando una sola opción activa por aspecto
    cleanEvalRows.forEach(row => {
      try {
        const parsed = safeParseJSON(row.evaluacion);
        const rating = parsed ? parsed.valor : '';
        const aspectoId = row.item_evaluacion_id;
        
        // Buscar el elemento de respuesta
        const aspectoRow = document.querySelector(`.aspecto-row[data-aspecto-id="${aspectoId}"]`);
        if (aspectoRow) {
          const tipo = aspectoRow.getAttribute('data-tipo');
          
          // Limpiar previamente cualquier selección en esta fila para evitar opciones dobles
          const allOptions = aspectoRow.querySelectorAll('.rango-option');
          allOptions.forEach(opt => {
            opt.classList.remove('selected');
            const r = opt.querySelector('input[type="radio"]');
            if (r) r.checked = false;
          });
          
          // Si tiene valor "-1" o está vacío, se deja sin respuesta
          if (rating === '-1' || rating === -1 || rating === '' || rating === null || rating === undefined) {
            disableFieldsInRow(aspectoRow, isClosed);
            return;
          }
          
          if (tipo === 'rango1,4') {
            const valNum = parseInt(rating);
            if (!isNaN(valNum) && valNum >= 1 && valNum <= 4) {
              const activeOpt = aspectoRow.querySelector(`.rango-option[data-valor="${valNum}"]`);
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

  const rows = document.querySelectorAll('.aspecto-row');
  rows.forEach(r => r.classList.remove('aspecto-incompleto'));
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

  // Validar que todas las preguntas del formulario tengan una opción seleccionada (no permitir guardar incompleta)
  const rows = document.querySelectorAll('.aspecto-row');
  let firstMissingRow = null;
  let missingCount = 0;

  rows.forEach(r => {
    const tipo = r.getAttribute('data-tipo');
    let hasAnswer = false;

    if (tipo === 'rango1,4') {
      const checkedRadio = r.querySelector('input[type="radio"]:checked');
      const selectedOpt = r.querySelector('.rango-option.selected');
      const val = checkedRadio ? checkedRadio.value : (selectedOpt ? selectedOpt.getAttribute('data-valor') : null);
      if (val && val !== '-1' && val !== -1 && val !== '') {
        hasAnswer = true;
      }
    } else if (tipo === 'si/no') {
      const checkedRadio = r.querySelector('input[type="radio"]:checked');
      if (checkedRadio && checkedRadio.value) hasAnswer = true;
    } else {
      const ta = r.querySelector('textarea');
      if (ta && ta.value.trim().length > 0) hasAnswer = true;
    }

    if (!hasAnswer) {
      missingCount++;
      if (!firstMissingRow) firstMissingRow = r;
      r.classList.add('aspecto-incompleto');
    } else {
      r.classList.remove('aspecto-incompleto');
    }
  });

  if (missingCount > 0) {
    showToast(`Evaluación incompleta: Debe completar todas las preguntas para poder almacenar (${missingCount} pregunta${missingCount > 1 ? 's' : ''} pendiente${missingCount > 1 ? 's' : ''}).`, "warning");
    if (firstMissingRow) {
      firstMissingRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    return;
  }
  
  // Buscar filas existentes en base de datos para esta combinación (trabajador, fecha)
  let existingRows = [];
  try {
    const { data: dbRows, error: dbErr } = await state.supabaseClient
      .from('evaluacion')
      .select('id, item_evaluacion_id')
      .eq('fecha', fecha)
      .like('evaluacion', `%"trabajador_id":${trabajadorId}%`);
    if (!dbErr && dbRows && dbRows.length > 0) {
      existingRows = dbRows;
    }
  } catch (e) {
    console.error("Error consultando filas existentes para guardar:", e);
  }

  // Si falló la consulta directa a DB, usar la caché local como respaldo
  if (existingRows.length === 0) {
    existingRows = state.evaluationsCache.filter(ev => {
      if (ev.fecha !== fecha) return false;
      try {
        const parsed = safeParseJSON(ev.evaluacion);
        return parsed && String(parsed.trabajador_id) === String(trabajadorId);
      } catch(e) {
        return false;
      }
    });
  }

  // Deduplicar filas existentes por item_evaluacion_id (conservando el mayor id)
  const existingMap = new Map();
  const dupIdsToDelete = [];
  existingRows.forEach(r => {
    const itm = Number(r.item_evaluacion_id);
    if (existingMap.has(itm)) {
      const prev = existingMap.get(itm);
      if (Number(r.id) > Number(prev.id)) {
        dupIdsToDelete.push(prev.id);
        existingMap.set(itm, r);
      } else {
        dupIdsToDelete.push(r.id);
      }
    } else {
      existingMap.set(itm, r);
    }
  });

  if (dupIdsToDelete.length > 0) {
    try {
      await state.supabaseClient.from('evaluacion').delete().in('id', dupIdsToDelete);
    } catch (e) {
      console.error("Error limpiando duplicados en BD:", e);
    }
  }

  // Recopilar respuestas del formulario
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
    const existingRow = existingMap.get(aspectoId);
    
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
      payload.id = existingRow.id; // Incluir ID para upsert in-place
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
