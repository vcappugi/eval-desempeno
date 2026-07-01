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
  
  if (subordinados.length === 0) {
    const emptyMsg = isAdmin
      ? 'No hay trabajadores registrados en el sistema.'
      : 'Usted no tiene trabajadores registrados bajo su supervisión directa.';
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 2rem;">${emptyMsg}</td></tr>`;
    return;
  }
  
  let html = '';
  subordinados.forEach(s => {
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

export function startEvaluation(trabajadorId) {
  const t = state.workersCache.find(worker => worker.id === trabajadorId);
  if (!t) return;
  
  // Configurar etiquetas
  document.getElementById('evaluadoIdInput').value = t.id;
  document.getElementById('evaluadoNombreLabel').textContent = t.nombre;
  document.getElementById('evaluadoFichaLabel').textContent = t.ficha || 'N/A';
  
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
  
  if (state.fechaEvalCache.length > 0) {
    selectFecha.value = state.fechaEvalCache[0].fecha;
  } else {
    showToast("No hay fechas de evaluación registradas en el sistema.", "warning");
  }
  
  document.getElementById('evalEstadoLabel').value = 'Abierta (Editable)';
  document.getElementById('btnGuardarEvaluacion').disabled = false;
  
  // Renderizar formulario de competencias y aspectos
  renderEvaluationFormQuestions();
  
  // Verificar si ya existe evaluación para esta fecha
  checkEvaluationDateUnique();
  
  // Mostrar formulario de evaluación y ocultar lista
  document.getElementById('evaluationFormContainer').style.display = 'block';
  document.getElementById('subordinadosTableBody').closest('.premium-card').style.display = 'none';
}

export function closeEvaluationForm() {
  document.getElementById('evaluationFormContainer').style.display = 'none';
  document.getElementById('subordinadosTableBody').closest('.premium-card').style.display = 'block';
}

export function renderEvaluationFormQuestions() {
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
  
  // Agrupar aspectos por competencia (clase_id) ordenando por competencia y luego aspecto
  state.classesCache.forEach(c => {
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
          answerFieldHTML = `
            <div class="rango-container" data-aspecto-id="${a.id}">
              ${[1,2,3,4].map(v => `
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
        const rating = parsed ? parsed.valor : '';
        const aspectoId = row.item_evaluacion_id;
        
        // Buscar el elemento de respuesta
        const aspectoRow = document.querySelector(`.aspecto-row[data-aspecto-id="${aspectoId}"]`);
        if (aspectoRow) {
          const tipo = aspectoRow.getAttribute('data-tipo');
          
          if (tipo === 'rango1,4') {
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
  
  let valid = true;
  
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
      payload.id = existingRow.id; // Incluir ID para upsert
    }
    
    insertPayloads.push(payload);
  });
  
  if (!valid) {
    showToast("Por favor responda a todos los aspectos de evaluación.", "error");
    return;
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
  }
}
