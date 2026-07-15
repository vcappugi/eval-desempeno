// js/evaluations.js - Formulario de evaluaciones y listado de colaboradores

import { state } from './state.js?v=2.1.6';
import { safeParseJSON, showToast, handleRlsError } from './utils.js?v=2.1.6';
import { loadCaches } from './supabase.js?v=2.1.6';
import { showWorkerChartModal } from './reports.js?v=2.1.6';

export function renderColaboradores() {
  const tbody = document.getElementById('colaboradoresTableBody');
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
  const colaboradores = isAdmin
    ? state.workersCache
    : state.workersCache.filter(w => w.supervisor_id === state.currentUser.id);
  
  // Filtrar según el término de búsqueda (nombre, cédula o departamento)
  let filtered = colaboradores;
  
  if (state.evalsDeptFilter) {
    filtered = filtered.filter(w => w.departamento === state.evalsDeptFilter);
  }
  
  if (state.evalsSearchQuery) {
    const q = state.evalsSearchQuery.toLowerCase();
    filtered = filtered.filter(w => 
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
    // Buscar si este colaborador tiene alguna evaluación en la caché para pintar el botón del gráfico
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
  renderColaboradores();
}

export function handleEvalWorkerDeptFilter(deptName) {
  state.evalsDeptFilter = deptName;
  state.evalsCurrentPage = 1;
  renderColaboradores();
}

export function changeEvalsPage(direction) {
  state.evalsCurrentPage += direction;
  renderColaboradores();
}

export function startEvaluation(trabajadorId) {
  const t = state.workersCache.find(worker => worker.id === trabajadorId);
  if (!t) return;
  
  // Configurar etiquetas
  document.getElementById('evaluadoIdInput').value = t.id;
  document.getElementById('evaluadoNombreLabel').textContent = t.nombre;
  document.getElementById('evaluadoFichaLabel').textContent = t.ficha || 'N/A';
  
  // Resetear formulario
  document.getElementById('evaluacionIdInput').value = '';
  
  // Poblar select de fechas de evaluación (sólo fechas publicadas)
  const selectFecha = document.getElementById('evalFecha');
  const publishedDates = state.fechaEvalCache.filter(fe => fe.publicado === true);
  if (selectFecha) {
    selectFecha.innerHTML = '';
    publishedDates.forEach(fe => {
      const option = document.createElement('option');
      option.value = fe.fecha;
      option.textContent = new Date(fe.fecha + 'T00:00:00').toLocaleDateString();
      selectFecha.appendChild(option);
    });
  }
  
  if (publishedDates.length > 0) {
    selectFecha.value = publishedDates[0].fecha;
  } else {
    showToast("No hay fechas de evaluación publicadas en el sistema.", "warning");
  }
  
  document.getElementById('evalEstadoLabel').value = 'Abierta (Editable)';
  document.getElementById('btnGuardarEvaluacion').disabled = false;
  
  // Renderizar formulario de competencias y aspectos
  renderEvaluationFormQuestions(t);
  
  // Verificar si ya existe evaluación para esta fecha
  checkEvaluationDateUnique();
  
  // Mostrar formulario de evaluación y ocultar lista
  document.getElementById('evaluationFormContainer').style.display = 'block';
  document.getElementById('colaboradoresTableBody').closest('.premium-card').style.display = 'none';
}

export function closeEvaluationForm() {
  document.getElementById('evaluationFormContainer').style.display = 'none';
  document.getElementById('colaboradoresTableBody').closest('.premium-card').style.display = 'block';
}

export function renderEvaluationFormQuestions(worker) {
  const container = document.getElementById('dynamicCompetenciesContainer');
  if (!container) return;
  
  container.innerHTML = '';
  
  if (!worker) {
    const trabajadorId = parseInt(document.getElementById('evaluadoIdInput').value);
    worker = state.workersCache.find(w => w.id === trabajadorId);
  }
  
  if (!worker) {
    container.innerHTML = '<p class="text-error">No se encontró la información del trabajador.</p>';
    return;
  }
  
  const workerTipo = worker.tipo ? worker.tipo.toUpperCase().trim() : 'GERENCIAL';
  
  const matchingClasses = state.classesCache.filter(c => {
    const compTipo = c.tipo ? c.tipo.toUpperCase().trim() : 'GERENCIAL';
    return compTipo === workerTipo;
  });
  
  if (matchingClasses.length === 0) {
    container.innerHTML = `<p class="text-error">No hay competencias de tipo "${workerTipo}" registradas en el sistema para evaluar a este trabajador.</p>`;
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
  
  // Agrupar aspectos por competencia (clase_id) ordenando por competencia y luego aspecto
  matchingClasses.forEach(c => {
    const aspectosDeClase = state.aspectsCache.filter(a => a.clase_id === c.id);
    
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
        
        if (a.tipo === 'rango1,4') {
          const tooltips = {
            1: "Casi nunca presenta esta característica",
            2: "Ocasionalmente presenta esta característica",
            3: "Frecuentemente presenta esta característica",
            4: "Siempre presenta esta característica"
          };
          const shortLabels = {
            1: "Casi Nunca",
            2: "Ocasionalmente",
            3: "Frecuentemente",
            4: "Siempre"
          };
          answerFieldHTML = `
            <div class="rango-container" data-aspecto-id="${a.id}">
              ${[1,2,3,4].map(v => `
                <label class="rango-option" id="label-asp-${a.id}-${v}" title="${tooltips[v]}" onclick="selectRangoOption(${a.id}, ${v})">
                  <input type="radio" name="aspecto_${a.id}" value="${v}">
                  <span style="font-size: 0.65rem; font-weight: 600; text-transform: uppercase; margin-bottom: 0.25rem; text-align: center; opacity: 0.8; word-break: break-word; line-height: 1.2;">${shortLabels[v]}</span>
                  <span style="font-size: 1.25rem; font-weight: 700;">${v}</span>
                </label>
              `).join('')}
            </div>
          `;
        } else if (a.tipo === 'si/no') {
          answerFieldHTML = `
            <div class="sino-container" data-aspecto-id="${a.id}">
              <label style="display: flex; align-items: center; gap: 0.25rem; cursor: pointer; margin-bottom: 0;">
                <input type="radio" name="aspecto_${a.id}" value="si"> Sí
              </label>
              <label style="display: flex; align-items: center; gap: 0.25rem; cursor: pointer; margin-bottom: 0;">
                <input type="radio" name="aspecto_${a.id}" value="no"> No
              </label>
            </div>
          `;
        } else { // text
          answerFieldHTML = `
            <textarea name="aspecto_${a.id}" rows="2" placeholder="Escriba comentarios y observaciones..." style="margin-top: 0.5rem;"></textarea>
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

// Lógica de selección de botón de rango 1-4
export function selectRangoOption(aspectoId, valor) {
  // Deseleccionar todas las opciones del rango
  for (let i = 1; i <= 4; i++) {
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
export function checkEvaluationDateUnique() {
  const trabajadorId = parseInt(document.getElementById('evaluadoIdInput').value);
  const fecha = document.getElementById('evalFecha').value;
  
  if (!trabajadorId || !fecha) return;
  
  // Limpiar respuestas previas en el formulario antes de rellenar
  resetAnswersInForm();
  
  // Buscar en las evaluaciones cargadas en caché
  const evalRows = state.evaluationsCache.filter(ev => {
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
        const rating = parsed ? parsed.valor : null;
        const aspectoId = row.item_evaluacion_id;
        
        // Buscar el elemento de respuesta
        const aspectoRow = document.querySelector(`.aspecto-row[data-aspecto-id="${aspectoId}"]`);
        if (aspectoRow) {
          const tipo = aspectoRow.getAttribute('data-tipo');
          
          if (tipo === 'rango1,4') {
            if (rating !== null && rating !== undefined && rating !== '') {
              selectRangoOption(aspectoId, parseInt(rating));
            }
          } else if (tipo === 'si/no') {
            if (rating !== null && rating !== undefined && rating !== '') {
              const radio = aspectoRow.querySelector(`input[value="${rating.toLowerCase()}"]`);
              if (radio) radio.checked = true;
            }
          } else {
            const textarea = aspectoRow.querySelector('textarea');
            if (textarea) textarea.value = rating || '';
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
  
  if (estadoLabel.includes('Cerrada')) {
    showToast("No se puede guardar una evaluación cerrada.", "error");
    return;
  }
  
  // Buscar filas existentes en base de datos para esta combinación (trabajador, fecha)
  const existingRows = state.evaluationsCache.filter(ev => {
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
  
  rows.forEach(r => {
    const aspectoId = parseInt(r.getAttribute('data-aspecto-id'));
    const claseId = parseInt(r.getAttribute('data-clase-id'));
    const tipo = r.getAttribute('data-tipo');
    
    let answerValue = null;
    
    if (tipo === 'rango1,4') {
      const checkedRadio = r.querySelector('input[type="radio"]:checked');
      if (checkedRadio) answerValue = checkedRadio.value;
    } else if (tipo === 'si/no') {
      const checkedRadio = r.querySelector('input[type="radio"]:checked');
      if (checkedRadio) answerValue = checkedRadio.value;
    } else {
      const textarea = r.querySelector('textarea');
      if (textarea) answerValue = textarea.value.trim() || null;
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
      payload.id = existingRow.id; // Incluir ID para upsert
    }
    
    insertPayloads.push(payload);
  });
  
  try {
    const { error } = await state.supabaseClient
      .from('evaluacion')
      .upsert(insertPayloads, { defaultToNull: false });
      
    if (error) throw error;
    
    showToast("Evaluación guardada exitosamente.");
    
    closeEvaluationForm();
    await loadCaches();
    renderColaboradores();
  } catch (err) {
    handleRlsError(err);
  }
}

export function printMainEvaluationForm() {
  const workerId = parseInt(document.getElementById('evaluadoIdInput').value);
  const worker = state.workersCache.find(w => w.id === workerId);
  const fecha = document.getElementById('evalFecha').value;
  const estadoText = document.getElementById('evalEstadoLabel').value;
  
  // Leer los valores directamente del formulario en el DOM
  const rows = document.querySelectorAll('#dynamicCompetenciesContainer .aspecto-row');
  const workerEvals = [];
  
  rows.forEach(r => {
    const aspectoId = parseInt(r.getAttribute('data-aspecto-id'));
    const claseId = parseInt(r.getAttribute('data-clase-id'));
    const tipo = r.getAttribute('data-tipo');
    
    let answerValue = null;
    if (tipo === 'rango1,4') {
      const checkedRadio = r.querySelector('input[type="radio"]:checked');
      if (checkedRadio) answerValue = checkedRadio.value;
    } else if (tipo === 'si/no') {
      const checkedRadio = r.querySelector('input[type="radio"]:checked');
      if (checkedRadio) answerValue = checkedRadio.value;
    } else {
      const textarea = r.querySelector('textarea');
      if (textarea) answerValue = textarea.value.trim() || null;
    }
    
    workerEvals.push({
      clase_id: claseId,
      item_evaluacion_id: aspectoId,
      evaluacion: JSON.stringify({
        trabajador_id: workerId,
        valor: answerValue
      })
    });
  });
  
  printEvaluationReport(worker, fecha, workerEvals, estadoText);
}

export function printEvaluationReport(worker, fecha, workerEvals, estadoText) {
  const workerName = worker ? worker.nombre : 'N/A';
  const workerFicha = worker ? (worker.ficha || 'N/A') : 'N/A';
  const workerCargo = worker ? (worker.cargo || 'N/A') : 'N/A';
  const workerDept = worker ? (worker.departamento || 'N/A') : 'N/A';
  const workerTipo = worker ? (worker.tipo || 'GERENCIAL').toUpperCase().trim() : 'GERENCIAL';

  // 1. Calcular puntajes por competencia y general
  const compWeightedSuma = {};
  const compWeightSum = {};
  const compUnweightedSuma = {};
  const compCuenta = {};
  const compAvgScores = [];

  workerEvals.forEach(ev => {
    try {
      const parsed = typeof ev.evaluacion === 'string' ? JSON.parse(ev.evaluacion) : ev.evaluacion;
      const rawValor = parsed ? parsed.valor : null;
      let valor = (rawValor !== null && rawValor !== undefined && rawValor !== '') ? parseFloat(rawValor) : 0;
      
      const aspecto = state.aspectsCache.find(a => a.id === ev.item_evaluacion_id);
      if (aspecto && aspecto.tipo === 'rango1,4') {
        const claseId = ev.clase_id;
        const weight = aspecto.ponderacion !== null && aspecto.ponderacion !== undefined ? parseFloat(aspecto.ponderacion) : 0;
        
        if (!compWeightedSuma[claseId]) {
          compWeightedSuma[claseId] = 0;
          compWeightSum[claseId] = 0;
          compUnweightedSuma[claseId] = 0;
          compCuenta[claseId] = 0;
        }
        
        let valToUse = valor;
        if (aspecto.revverse && valor >= 1 && valor <= 4) {
          valToUse = 5 - valor;
        }
        
        if (weight > 0) {
          compWeightedSuma[claseId] += valToUse * weight;
          compWeightSum[claseId] += weight;
        }
        compUnweightedSuma[claseId] += valToUse;
        compCuenta[claseId]++;
      }
    } catch(e) {}
  });

  // Calcular promedios por competencia
  state.classesCache.forEach(c => {
    const compTipo = c.tipo ? c.tipo.toUpperCase().trim() : 'GERENCIAL';
    if (compTipo !== workerTipo) return;

    const weightedSuma = compWeightedSuma[c.id] || 0;
    const weightSum = compWeightSum[c.id] || 0;
    const unweightedSuma = compUnweightedSuma[c.id] || 0;
    const cuenta = compCuenta[c.id] || 0;
    
    if (cuenta > 0) {
      const promedio = weightSum > 0 ? (weightedSuma / weightSum) : (unweightedSuma / cuenta);
      compAvgScores.push({
        id: c.id,
        titulo: c.titulo,
        promedio: promedio,
        cuenta: cuenta
      });
    }
  });

  let totalWeight = 0;
  let weightedSum = 0;
  compAvgScores.forEach(item => {
    const compObj = state.classesCache.find(c => c.id === item.id);
    const weight = compObj && compObj.peso !== null && compObj.peso !== undefined ? parseFloat(compObj.peso) : 0;
    weightedSum += item.promedio * (weight / 100);
    totalWeight += weight;
  });

  const promedioGeneral = totalWeight > 0 ? (weightedSum / (totalWeight / 100)) : (compAvgScores.length > 0 ? compAvgScores.reduce((sum, val) => sum + val.promedio, 0) / compAvgScores.length : 0);
  const porcentajeGeneral = promedioGeneral > 0 ? Math.round((promedioGeneral / 4) * 100) : 0;

  // Clasificar resultado
  let clasificacion = 'No evaluado';
  if (porcentajeGeneral >= 90) clasificacion = 'Excelente (Sobresaliente)';
  else if (porcentajeGeneral >= 75) clasificacion = 'Bueno (Cumple expectativas)';
  else if (porcentajeGeneral >= 55) clasificacion = 'Regular (Requiere tutoría)';
  else if (porcentajeGeneral > 0) clasificacion = 'Deficiente (Bajo desempeño)';

  // 2. Generar filas de la tabla de aspectos
  let tableHtml = '';
  const matchingClasses = state.classesCache.filter(c => {
    const compTipo = c.tipo ? c.tipo.toUpperCase().trim() : 'GERENCIAL';
    return compTipo === workerTipo;
  });

  matchingClasses.forEach(c => {
    const aspectosDeClase = state.aspectsCache.filter(a => a.clase_id === c.id);
    
    aspectosDeClase.forEach(a => {
      const evRow = workerEvals.find(ev => ev.item_evaluacion_id === a.id);
      let answerText = 'Sin responder';
      let pctLabel = '-';
      
      if (evRow) {
        try {
          const parsed = typeof evRow.evaluacion === 'string' ? JSON.parse(evRow.evaluacion) : evRow.evaluacion;
          const val = parsed ? parsed.valor : null;
          if (val !== null && val !== undefined && val !== '') {
            if (a.tipo === 'si/no') {
              answerText = val.toUpperCase();
            } else if (a.tipo === 'rango1,4') {
              answerText = val;
              let valNum = parseFloat(val);
              const weight = a.ponderacion !== null && a.ponderacion !== undefined ? parseFloat(a.ponderacion) : 0;
              if (!isNaN(valNum)) {
                let displayedVal = valNum;
                if (a.revverse && valNum >= 1 && valNum <= 4) {
                  displayedVal = 5 - valNum;
                }
                const pct = (displayedVal / 4) * weight;
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
          <td style="border: 1px solid #cbd5e1; padding: 6px;"><strong>${c.titulo}</strong></td>
          <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: justify;"><mark style="background-color: #f1f5f9; color: #000000; border: 1px solid #cbd5e1; border-radius: 4px; font-weight: 700; padding: 0.1rem 0.3rem; margin-right: 0.5rem;">${a.orden}</mark>${a.descripcion}${a.revverse ? ' <small style="background-color: #fef3c7; color: #b45309; border: 1px solid #fde68a; border-radius: 4px; padding: 1px 4px; font-size: 0.7rem; font-weight: 600;">Inversa</small>' : ''}</td>
          <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: right; font-weight: 600;">${answerText}</td>
          <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: right; font-weight: 600; color: #2e7d32;">${pctLabel}</td>
        </tr>
      `;
    });
  });

  // 3. Generar filas de la tabla de totales por competencia
  let compTotalsHtml = '';
  compAvgScores.forEach(item => {
    const pct = (item.promedio / 4) * 100;
    compTotalsHtml += `
      <tr>
        <td style="border: 1px solid #cbd5e1; padding: 6px;"><strong>${item.titulo}</strong></td>
        <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: right; font-weight: 600;">${item.promedio.toFixed(2)} / 4.00</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: right; font-weight: 600; color: #2e7d32;">${pct.toFixed(1)}%</td>
      </tr>
    `;
  });

  // 4. Crear contenedor de impresión
  const printDiv = document.createElement('div');
  printDiv.id = 'print-evaluation-container';
  printDiv.innerHTML = `
    <div style="font-family: Arial, sans-serif; padding: 2rem; color: #000000; background: #ffffff;">
      <!-- Membrete con Logo -->
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #2e7d32; padding-bottom: 1rem; margin-bottom: 1.5rem;">
        <div>
          <img src="images/BEL_LOGO.jpg" alt="BEL Logo" style="height: 50px;" onerror="this.src='https://placehold.co/120x80/2e7d32/ffffff?text=BEL+Group'">
        </div>
        <div style="text-align: right;">
          <h2 style="margin: 0; color: #2e7d32; font-size: 1.5rem;">Reporte de Evaluación</h2>
          <small style="color: #666666;">Corporación BEL</small>
        </div>
      </div>
      
      <!-- Ficha del Colaborador -->
      <div style="background-color: #f1f8e9; border-left: 5px solid #2e7d32; padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem; display: grid; grid-template-columns: 2fr 1fr; gap: 1rem; font-size: 0.9rem;">
        <div>
          <p style="margin: 0 0 0.5rem 0; color: #666666;">Colaborador:</p>
          <strong style="font-size: 1.2rem; color: #2e7d32;">${workerName}</strong>
          <div style="display: flex; gap: 1.5rem; margin-top: 0.5rem;">
            <span>Ficha: <strong>${workerFicha}</strong></span>
            <span>Cargo: <strong>${workerCargo}</strong></span>
            <span>Departamento: <strong>${workerDept}</strong></span>
          </div>
        </div>
        <div style="text-align: right; border-left: 1px solid rgba(0,0,0,0.1); padding-left: 1rem;">
          <p style="margin: 0 0 0.5rem 0; color: #666666;">Fecha:</p>
          <strong style="font-size: 1.2rem;">${new Date(fecha + 'T00:00:00').toLocaleDateString()}</strong>
          <p style="margin: 0.5rem 0 0 0;">Estado: <strong>${estadoText}</strong></p>
        </div>
      </div>

      <!-- Cuadro de Resultado General -->
      <div style="border: 2px solid #2e7d32; border-radius: 8px; padding: 1.25rem; margin-bottom: 1.5rem; display: flex; justify-content: space-between; align-items: center; background-color: #f9fafb;">
        <div>
          <h4 style="margin: 0; color: #2e7d32; font-size: 1.1rem; text-transform: uppercase;">Resultado General del Trabajador</h4>
          <p style="margin: 0.25rem 0 0 0; font-size: 0.9rem; color: #555555;">Clasificación: <strong>${clasificacion}</strong></p>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 2.25rem; font-weight: 800; color: #2e7d32; line-height: 1;">${porcentajeGeneral}%</div>
          <small style="color: #666666; font-size: 0.75rem;">sobre el 100% de la ponderación</small>
        </div>
      </div>
      
      <!-- Tabla de Totales por Competencia -->
      <h3 style="color: #2e7d32; font-size: 1.1rem; border-bottom: 1px solid #cbd5e1; padding-bottom: 0.25rem; margin-top: 1.5rem; margin-bottom: 0.75rem;">Resumen de Resultados por Competencia</h3>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 1.5rem; font-size: 0.85rem;">
        <thead>
          <tr style="background-color: #f1f5f9;">
            <th style="border: 1px solid #cbd5e1; padding: 6px; text-align: left;">Competencia / Dimensión</th>
            <th style="border: 1px solid #cbd5e1; padding: 6px; text-align: right; width: 25%;">Promedio (Escala 1.0 - 4.0)</th>
            <th style="border: 1px solid #cbd5e1; padding: 6px; text-align: right; width: 25%;">Cumplimiento (%)</th>
          </tr>
        </thead>
        <tbody>
          ${compTotalsHtml}
        </tbody>
      </table>

      <!-- Tabla de Aspectos Detallados -->
      <h3 style="color: #2e7d32; font-size: 1.1rem; border-bottom: 1px solid #cbd5e1; padding-bottom: 0.25rem; margin-top: 1.5rem; margin-bottom: 0.75rem;">Detalle de Respuestas por Factor</h3>
      <table style="width: 100%; border-collapse: collapse; font-size: 0.8rem;">
        <thead>
          <tr style="background-color: #f1f5f9;">
            <th style="border: 1px solid #cbd5e1; padding: 6px; text-align: left; width: 25%;">Competencia</th>
            <th style="border: 1px solid #cbd5e1; padding: 6px; text-align: left;">Aspecto Específico Evaluado</th>
            <th style="border: 1px solid #cbd5e1; padding: 6px; text-align: right; width: 15%;">Respuesta</th>
            <th style="border: 1px solid #cbd5e1; padding: 6px; text-align: right; width: 15%;">Puntaje (%)</th>
          </tr>
        </thead>
        <tbody>
          ${tableHtml}
        </tbody>
      </table>
      
      <!-- Nota de Cierre -->
      <div style="margin-top: 3rem; text-align: center; font-size: 0.75rem; color: #888888; border-top: 1px solid #e2e8f0; padding-top: 1rem;">
        Este documento es un reporte oficial de evaluación de desempeño generado por el Sistema de Evaluación de Desempeño - BEL.
      </div>
    </div>
  `;

  // Estilo de impresión
  const style = document.createElement('style');
  style.id = 'print-evaluation-style';
  style.innerHTML = `
    @media print {
      body > *:not(#print-evaluation-container) {
        display: none !important;
      }
      #print-evaluation-container {
        display: block !important;
        position: absolute;
        left: 0;
        top: 0;
        width: 100%;
      }
    }
  `;

  document.head.appendChild(style);
  document.body.appendChild(printDiv);
  
  window.print();
  
  setTimeout(() => {
    printDiv.remove();
    style.remove();
  }, 1000);
}
