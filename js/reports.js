// js/reports.js - Indicadores, reportes y gráficos

import { state } from './state.js';
import { safeParseJSON, openModal } from './utils.js';

export function renderIndicadoresGenerales() {
  // 1. Total Trabajadores
  const totalTrabajadores = state.workersCache.length;
  document.getElementById('indTotalTrabajadores').textContent = totalTrabajadores;
  
  // 2. Agrupar evaluaciones por (trabajador_id, fecha)
  const groupedEvals = {};
    let totalAspectosEvaluados = 0;
  let totalWeightedSuma = 0;
  let totalWeightSum = 0;
  let totalUnweightedSuma = 0;
  let totalCuenta = 0;
  let evalsAbiertas = 0;
  let evalsCerradas = 0;
  const evaluadosSet = new Set();
  
  // Para promedios por competencia
  const compWeightedSuma = {};
  const compWeightSum = {};
  const compUnweightedSuma = {};
  const compCuenta = {};
  
  state.evaluationsCache.forEach(ev => {
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
      
      // Si el aspecto es de tipo numérico (rango1,4), calculamos promedios
      const aspecto = state.aspectsCache.find(a => a.id === ev.item_evaluacion_id);
      if (aspecto && aspecto.tipo === 'rango1,4') {
        const valNum = parseFloat(valor);
        if (!isNaN(valNum)) {
          const weight = aspecto.ponderacion !== null && aspecto.ponderacion !== undefined ? parseFloat(aspecto.ponderacion) : 0;
          const claseId = ev.clase_id;
          
          if (claseId) {
            if (!compWeightedSuma[claseId]) {
              compWeightedSuma[claseId] = 0;
              compWeightSum[claseId] = 0;
              compUnweightedSuma[claseId] = 0;
              compCuenta[claseId] = 0;
            }
            
            if (weight > 0) {
              compWeightedSuma[claseId] += valNum * weight;
              compWeightSum[claseId] += weight;
              
              totalWeightedSuma += valNum * weight;
              totalWeightSum += weight;
            }
            
            compUnweightedSuma[claseId] += valNum;
            compCuenta[claseId]++;
            
            totalUnweightedSuma += valNum;
            totalCuenta++;
          }
        }
      }
    } catch(e) {}
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
  const compAvgScores = [];
  state.classesCache.forEach(c => {
    const weightedSuma = compWeightedSuma[c.id] || 0;
    const weightSum = compWeightSum[c.id] || 0;
    const unweightedSuma = compUnweightedSuma[c.id] || 0;
    const cuenta = compCuenta[c.id] || 0;
    const promedio = weightSum > 0 ? (weightedSuma / weightSum) : (cuenta > 0 ? (unweightedSuma / cuenta) : null);
    if (promedio !== null) {
      compAvgScores.push(promedio);
    }
  });
  const promedioGeneral = compAvgScores.length > 0 ? compAvgScores.reduce((sum, val) => sum + val, 0) / compAvgScores.length : 0;
  document.getElementById('indPromedioGeneral').textContent = `${promedioGeneral.toFixed(1)} / 4`;
  
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
    
    if (state.classesCache.length === 0) {
      compContainer.innerHTML = '<p style="text-align: center; color: var(--muted-color); font-size: 0.875rem;">No hay competencias registradas.</p>';
    } else {
      state.classesCache.forEach(c => {
        const weightedSuma = compWeightedSuma[c.id] || 0;
        const weightSum = compWeightSum[c.id] || 0;
        const unweightedSuma = compUnweightedSuma[c.id] || 0;
        const cuenta = compCuenta[c.id] || 0;
        const promedio = weightSum > 0 ? (weightedSuma / weightSum) : (cuenta > 0 ? (unweightedSuma / cuenta) : null);
        
        const pctBarra = promedio !== null ? (promedio / 4) * 100 : 0;
        const promedioLabel = promedio !== null ? `${promedio.toFixed(1)} / 4` : 'Sin calificaciones';
        
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

export async function showWorkerChartModal(workerId) {
  const w = state.workersCache.find(worker => worker.id === workerId);
  if (!w) return;
  
  await openModal('workerChartModal');
  
  document.getElementById('chartWorkerName').textContent = w.nombre;
  document.getElementById('chartWorkerFicha').textContent = w.ficha || 'N/A';
  document.getElementById('chartWorkerCargo').textContent = w.cargo || 'N/A';
  
  // Buscar todas las filas de evaluaciones en caché para este trabajador
  const workerEvals = state.evaluationsCache.filter(ev => {
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
  if (state.currentChartInstance) {
    state.currentChartInstance.destroy();
    state.currentChartInstance = null;
  }
  
  if (workerEvals.length === 0) {
    canvas.style.display = 'none';
    noDataMsg.style.display = 'block';
    percentSpan.textContent = '0%';
    scoreLabel.textContent = 'Sin Evaluaciones';
    dateLabel.textContent = 'Evaluado el: -';
    
    const circleContainer = percentSpan.parentElement;
    if (circleContainer) {
      circleContainer.style.borderColor = 'var(--border-color)';
    }
    return;
  }
  
  canvas.style.display = 'block';
  noDataMsg.style.display = 'none';
  
  // Agrupar por competencia (clase_id) y calcular el promedio
  const compWeightedSuma = {};
  const compWeightSum = {};
  const compUnweightedSuma = {};
  const compCuenta = {};
  
  let totalWeightedSuma = 0;
  let totalWeightSum = 0;
  let totalUnweightedSuma = 0;
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
      
      const aspecto = state.aspectsCache.find(a => a.id === ev.item_evaluacion_id);
      if (aspecto && aspecto.tipo === 'rango1,4' && !isNaN(valor)) {
        const claseId = ev.clase_id;
        const weight = aspecto.ponderacion !== null && aspecto.ponderacion !== undefined ? parseFloat(aspecto.ponderacion) : 0;
        
        if (!compWeightedSuma[claseId]) {
          compWeightedSuma[claseId] = 0;
          compWeightSum[claseId] = 0;
          compUnweightedSuma[claseId] = 0;
          compCuenta[claseId] = 0;
        }
        
        if (weight > 0) {
          compWeightedSuma[claseId] += valor * weight;
          compWeightSum[claseId] += weight;
          
          totalWeightedSuma += valor * weight;
          totalWeightSum += weight;
        }
        
        compUnweightedSuma[claseId] += valor;
        compCuenta[claseId]++;
        
        totalUnweightedSuma += valor;
        totalCuenta++;
      }
    } catch(e) {}
  });
  
  // Calcular porcentaje general
  const compAvgScores = [];
  state.classesCache.forEach(c => {
    const weightedSuma = compWeightedSuma[c.id] || 0;
    const weightSum = compWeightSum[c.id] || 0;
    const unweightedSuma = compUnweightedSuma[c.id] || 0;
    const cuenta = compCuenta[c.id] || 0;
    if (cuenta > 0) {
      const promedio = weightSum > 0 ? (weightedSuma / weightSum) : (unweightedSuma / cuenta);
      compAvgScores.push(promedio);
    }
  });
  const promedioGeneral = compAvgScores.length > 0 ? compAvgScores.reduce((sum, val) => sum + val, 0) / compAvgScores.length : 0;
  const porcentajeGeneral = promedioGeneral > 0 ? Math.round((promedioGeneral / 4) * 100) : 0;
  
  percentSpan.textContent = `${porcentajeGeneral}%`;
  
  // Modificar color de borde del círculo dinámicamente según el desempeño
  const circleContainer = percentSpan.parentElement;
  if (circleContainer) {
    if (porcentajeGeneral >= 90) {
      circleContainer.style.borderColor = 'var(--primary)';
    } else if (porcentajeGeneral >= 70) {
      circleContainer.style.borderColor = 'var(--primary-hover)';
    } else if (porcentajeGeneral >= 50) {
      circleContainer.style.borderColor = '#eab308';
    } else {
      circleContainer.style.borderColor = '#ef4444';
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
  
  state.classesCache.forEach(c => {
    const weightedSuma = compWeightedSuma[c.id] || 0;
    const weightSum = compWeightSum[c.id] || 0;
    const unweightedSuma = compUnweightedSuma[c.id] || 0;
    const cuenta = compCuenta[c.id] || 0;
    
    const promedio = weightSum > 0 ? (weightedSuma / weightSum) : (cuenta > 0 ? (unweightedSuma / cuenta) : 0);
    const finalPromedio = parseFloat(promedio.toFixed(1));
    
    // Solo mostrar competencias que tengan datos evaluados para este trabajador
    if (cuenta > 0) {
      labels.push(c.titulo);
      scores.push(finalPromedio);
    }
  });
  
  if (scores.length === 0) {
    canvas.style.display = 'none';
    noDataMsg.style.display = 'block';
    return;
  }
  
  // Crear gráfico Radar de Chart.js
  const isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark';
  const textColor = isDarkMode ? '#e2e8f0' : '#334155';
  const gridColor = isDarkMode ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.08)';
  
  // Utiliza el constructor global de Chart
  state.currentChartInstance = new Chart(canvas.getContext('2d'), {
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
          max: 4
        }
      }
    }
  });
}

// ================= INFORME INDIVIDUAL DE SUBORDINADOS =================

export function initReporteSubordinadosFilters() {
  const selectDept = document.getElementById('repFiltroDepartamento');
  const selectSub = document.getElementById('repFiltroSubordinado');
  if (!selectSub) return;
  
  const isAdmin = state.currentUser && state.currentUser.rol === 'admin';
  const subordinados = isAdmin
    ? state.workersCache
    : state.workersCache.filter(w => w.supervisor_id === state.currentUser.id);
  
  // 1. Poblar departamentos
  if (selectDept) {
    const currentDeptVal = selectDept.value || 'todos';
    const departamentos = [...new Set(subordinados.map(s => s.departamento).filter(Boolean))].sort();
    let deptHtml = '<option value="todos">Todos los departamentos</option>';
    departamentos.forEach(d => {
      deptHtml += `<option value="${d}">${d}</option>`;
    });
    selectDept.innerHTML = deptHtml;
    selectDept.value = currentDeptVal;
  }
  
  // 2. Poblar trabajadores según el departamento seleccionado
  const selectedDept = selectDept ? selectDept.value : 'todos';
  let workersForSelect = subordinados;
  if (selectedDept !== 'todos') {
    workersForSelect = subordinados.filter(s => s.departamento === selectedDept);
  }
  
  const currentSubVal = selectSub.value || 'todos';
  let html = isAdmin
    ? '<option value="todos">Todos los trabajadores</option>'
    : '<option value="todos">Todos los subordinados</option>';
  workersForSelect.forEach(s => {
    html += `<option value="${s.id}">${s.nombre} (Ficha: ${s.ficha || 'N/A'})</option>`;
  });
  
  selectSub.innerHTML = html;
  
  // Mantener selección previa de trabajador si sigue existiendo en el nuevo conjunto
  if (workersForSelect.some(s => s.id.toString() === currentSubVal) || currentSubVal === 'todos') {
    selectSub.value = currentSubVal;
  } else {
    selectSub.value = 'todos';
  }
  
  // Actualizar textos de cabecera en reportes según el rol
  const headerTitle = document.getElementById('reporteSubordinadosHeaderTitle');
  const headerDesc = document.getElementById('reporteSubordinadosHeaderDesc');
  if (headerTitle && headerDesc) {
    if (isAdmin) {
      headerTitle.innerHTML = '<i class="fa-solid fa-file-invoice text-primary"></i> Informe de Desempeño del Personal';
      headerDesc.textContent = 'Genere y exporte el informe de indicadores individuales de todos los trabajadores.';
    } else {
      headerTitle.innerHTML = '<i class="fa-solid fa-file-invoice text-primary"></i> Informe de Subordinados';
      headerDesc.textContent = 'Genere y exporte el informe de indicadores individuales del personal a su cargo.';
    }
  }
}

export function handleReportDeptChange() {
  const selectDept = document.getElementById('repFiltroDepartamento');
  const selectSub = document.getElementById('repFiltroSubordinado');
  if (!selectSub) return;
  
  const isAdmin = state.currentUser && state.currentUser.rol === 'admin';
  const subordinados = isAdmin
    ? state.workersCache
    : state.workersCache.filter(w => w.supervisor_id === state.currentUser.id);
  
  const selectedDept = selectDept ? selectDept.value : 'todos';
  let workersForSelect = subordinados;
  if (selectedDept !== 'todos') {
    workersForSelect = subordinados.filter(s => s.departamento === selectedDept);
  }
  
  let html = isAdmin
    ? '<option value="todos">Todos los trabajadores</option>'
    : '<option value="todos">Todos los subordinados</option>';
  workersForSelect.forEach(s => {
    html += `<option value="${s.id}">${s.nombre} (Ficha: ${s.ficha || 'N/A'})</option>`;
  });
  
  selectSub.innerHTML = html;
  selectSub.value = 'todos'; // Restablecer a todos al cambiar de departamento
  
  renderReporteSubordinados();
}

export function renderReporteSubordinados() {
  const printArea = document.getElementById('reporteSubordinadosPrintArea');
  if (!printArea) return;
  
  const isAdmin = state.currentUser && state.currentUser.rol === 'admin';
  const subordinados = isAdmin
    ? state.workersCache
    : state.workersCache.filter(w => w.supervisor_id === state.currentUser.id);
  
  if (subordinados.length === 0) {
    const emptyTitle = isAdmin ? 'No hay personal registrado' : 'No posee subordinados asignados';
    const emptyMsg = isAdmin
      ? 'No hay trabajadores registrados en el sistema.'
      : 'Usted no tiene trabajadores registrados bajo su supervisión directa en el sistema.';
    printArea.innerHTML = `
      <div class="premium-card" style="text-align: center; padding: 3rem;">
        <i class="fa-solid fa-users-slash text-primary" style="font-size: 3rem; margin-bottom: 1rem;"></i>
        <h4 style="margin: 0 0 0.5rem 0;">${emptyTitle}</h4>
        <p style="color: var(--muted-color); margin: 0;">${emptyMsg}</p>
      </div>
    `;
    return;
  }
  
  const selectedDept = document.getElementById('repFiltroDepartamento')?.value || 'todos';
  const selectedSubId = document.getElementById('repFiltroSubordinado')?.value || 'todos';
  const dateDesde = document.getElementById('repFiltroFechaDesde')?.value || '';
  const dateHasta = document.getElementById('repFiltroFechaHasta')?.value || '';
  
  let filteredSubordinados = subordinados;
  
  // 1. Filtrar por departamento primero si se seleccionó uno específico
  if (selectedDept !== 'todos') {
    filteredSubordinados = filteredSubordinados.filter(s => s.departamento === selectedDept);
  }
  
  // 2. Filtrar por trabajador específico
  if (selectedSubId !== 'todos') {
    const subIdNum = parseInt(selectedSubId);
    filteredSubordinados = filteredSubordinados.filter(s => s.id === subIdNum);
  }
  
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
        <p style="font-size: 0.8rem; margin-top: 0.1rem; color: var(--muted-color);">${isAdmin ? 'Administrador' : 'Supervisor'}: ${state.currentUser.nombre} | Fecha de Emisión: ${new Date().toLocaleDateString()}</p>
      </div>
    </div>
  `;
  
  filteredSubordinados.forEach(s => {
    // Buscar todas las evaluaciones de este subordinado
    const workerEvals = state.evaluationsCache.filter(ev => {
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
    
    const subCompWeightedSuma = {};
    const subCompWeightSum = {};
    const subCompUnweightedSuma = {};
    const subCompCuenta = {};
    
    finalEvals.forEach(ev => {
      try {
        const parsed = safeParseJSON(ev.evaluacion);
        if (!parsed) return;
        const valor = parseFloat(parsed.valor);
        const aspecto = state.aspectsCache.find(a => a.id === ev.item_evaluacion_id);
        if (aspecto && aspecto.tipo === 'rango1,4' && !isNaN(valor)) {
          const claseId = ev.clase_id;
          const weight = aspecto.ponderacion !== null && aspecto.ponderacion !== undefined ? parseFloat(aspecto.ponderacion) : 0;
          
          if (!subCompWeightedSuma[claseId]) {
            subCompWeightedSuma[claseId] = 0;
            subCompWeightSum[claseId] = 0;
            subCompUnweightedSuma[claseId] = 0;
            subCompCuenta[claseId] = 0;
          }
          
          if (weight > 0) {
            subCompWeightedSuma[claseId] += valor * weight;
            subCompWeightSum[claseId] += weight;
          }
          
          subCompUnweightedSuma[claseId] += valor;
          subCompCuenta[claseId]++;
        }
      } catch(e) {}
    });
    
    const compScores = [];
    state.classesCache.forEach(c => {
      const weightedSuma = subCompWeightedSuma[c.id] || 0;
      const weightSum = subCompWeightSum[c.id] || 0;
      const unweightedSuma = subCompUnweightedSuma[c.id] || 0;
      const cuenta = subCompCuenta[c.id] || 0;
      if (cuenta > 0) {
        const promedio = weightSum > 0 ? (weightedSuma / weightSum) : (unweightedSuma / cuenta);
        compScores.push(promedio);
      }
    });
    
    const workerAvg = compScores.length > 0 ? compScores.reduce((sum, val) => sum + val, 0) / compScores.length : null;
    const promedioGeneral = workerAvg !== null ? workerAvg.toFixed(1) : 'N/A';
    
    let nivelDesempeno = 'Sin Evaluaciones';
    if (promedioGeneral !== 'N/A') {
      const avgNum = parseFloat(promedioGeneral);
      if (avgNum >= 3.6) nivelDesempeno = 'Excelente (Sobresaliente)';
      else if (avgNum >= 3.0) nivelDesempeno = 'Bueno (Cumple)';
      else if (avgNum >= 2.2) nivelDesempeno = 'Regular (Tutoría)';
      else nivelDesempeno = 'Deficiente (Bajo)';
      
      // Promediar los promedios ponderados de cada subordinado para el equipo
      totalTeamScore += avgNum;
      totalTeamCount++;
      
      // Acumular los promedios ponderados por competencia de este subordinado para el promedio del equipo
      state.classesCache.forEach(c => {
        const weightedSuma = subCompWeightedSuma[c.id] || 0;
        const weightSum = subCompWeightSum[c.id] || 0;
        const unweightedSuma = subCompUnweightedSuma[c.id] || 0;
        const cuenta = subCompCuenta[c.id] || 0;
        const promedio = weightSum > 0 ? (weightedSuma / weightSum) : (cuenta > 0 ? (unweightedSuma / cuenta) : null);
        
        if (promedio !== null) {
          if (!teamCompSuma[c.id]) {
            teamCompSuma[c.id] = 0;
            teamCompCuenta[c.id] = 0;
          }
          teamCompSuma[c.id] += promedio;
          teamCompCuenta[c.id]++;
        }
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
              <h3>${promedioGeneral !== 'N/A' ? `${promedioGeneral} / 4` : '-'}</h3>
            </div>
            <div class="kpi-card">
              <h5>Desempeño</h5>
              <h3 style="white-space: nowrap;">${workerAvg !== null ? `${((workerAvg / 4) * 100).toFixed(1)}%` : '-'}</h3>
            </div>
          </div>
        </div>
        
        <div style="display: grid; grid-template-columns: 1.2fr 0.8fr; gap: 1.5rem; margin-top: 1.5rem; align-items: start;" class="subordinate-profile-grid">
          <div>
            <h4 style="margin: 0 0 1rem 0; font-size: 1.1rem; color: var(--primary);"><i class="fa-solid fa-list-ol"></i> Total por Competencia</h4>
            <div class="table-wrapper">
              <table class="competency-summary-table">
                <thead>
                  <tr>
                    <th>Competencia</th>
                    <th style="text-align: right;">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${state.classesCache.map(c => {
                    const weightedSuma = subCompWeightedSuma[c.id] || 0;
                    const weightSum = subCompWeightSum[c.id] || 0;
                    const unweightedSuma = subCompUnweightedSuma[c.id] || 0;
                    const cuenta = subCompCuenta[c.id] || 0;
                    const promedio = weightSum > 0 ? (weightedSuma / weightSum) : (cuenta > 0 ? (unweightedSuma / cuenta) : null);
                    const compPct = promedio !== null ? `${((promedio / 4) * 100).toFixed(1)}%` : '-';
                    return `
                      <tr>
                        <td><strong>${c.titulo}</strong></td>
                        <td style="text-align: right; font-weight: 600; color: var(--primary);">${compPct}</td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          </div>
          
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
              
              // Calculate competency scores for this specific evaluation group
              const groupCompWeightedSuma = {};
              const groupCompWeightSum = {};
              const groupCompUnweightedSuma = {};
              const groupCompCuenta = {};
              
              group.rows.forEach(row => {
                try {
                  const parsed = safeParseJSON(row.evaluacion);
                  if (!parsed) return;
                  const valor = parseFloat(parsed.valor);
                  const aspecto = state.aspectsCache.find(a => a.id === row.item_evaluacion_id);
                  if (aspecto && aspecto.tipo === 'rango1,4' && !isNaN(valor)) {
                    const claseId = row.clase_id;
                    const weight = aspecto.ponderacion !== null && aspecto.ponderacion !== undefined ? parseFloat(aspecto.ponderacion) : 0;
                    
                    if (!groupCompWeightedSuma[claseId]) {
                      groupCompWeightedSuma[claseId] = 0;
                      groupCompWeightSum[claseId] = 0;
                      groupCompUnweightedSuma[claseId] = 0;
                      groupCompCuenta[claseId] = 0;
                    }
                    
                    if (weight > 0) {
                      groupCompWeightedSuma[claseId] += valor * weight;
                      groupCompWeightSum[claseId] += weight;
                    }
                    
                    groupCompUnweightedSuma[claseId] += valor;
                    groupCompCuenta[claseId]++;
                  }
                } catch(e) {}
              });
              
              const groupCompScores = [];
              state.classesCache.forEach(c => {
                const weightedSuma = groupCompWeightedSuma[c.id] || 0;
                const weightSum = groupCompWeightSum[c.id] || 0;
                const unweightedSuma = groupCompUnweightedSuma[c.id] || 0;
                const cuenta = groupCompCuenta[c.id] || 0;
                if (cuenta > 0) {
                  const promedio = weightSum > 0 ? (weightedSuma / weightSum) : (unweightedSuma / cuenta);
                  groupCompScores.push(promedio);
                }
              });
              
              const groupAvg = groupCompScores.length > 0 ? groupCompScores.reduce((sum, val) => sum + val, 0) / groupCompScores.length : 0;
              const groupPct = groupAvg > 0 ? (groupAvg / 4) * 100 : 0;
              
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
                          <th style="width: 25%;">Competencia</th>
                          <th style="width: 45%;">Aspecto Evaluado</th>
                          <th style="text-align: right; width: 15%;">Respuesta / Valor</th>
                          <th style="text-align: right; width: 15%;">Ponderación</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${group.rows.map(row => {
                          const comp = state.classesCache.find(c => c.id === row.clase_id);
                          const compLabel = comp ? comp.titulo : 'N/A';
                          
                          const aspect = state.aspectsCache.find(a => a.id === row.item_evaluacion_id);
                          const aspectLabel = aspect ? aspect.descripcion : 'N/A';
                          
                          let ratingVal = 'N/A';
                          let pctLabel = '-';
                          try {
                            const parsed = safeParseJSON(row.evaluacion);
                            if (parsed) {
                              ratingVal = parsed.valor;
                              if (aspect && aspect.tipo === 'si/no') {
                                ratingVal = ratingVal.toUpperCase();
                              } else if (aspect && aspect.tipo === 'rango1,4') {
                                const valNum = parseFloat(ratingVal);
                                const weight = aspect.ponderacion !== null && aspect.ponderacion !== undefined ? parseFloat(aspect.ponderacion) : 0;
                                if (!isNaN(valNum)) {
                                  const pct = (valNum / 4) * weight;
                                  pctLabel = `${pct.toFixed(1)}% (de ${weight}%)`;
                                }
                              }
                            }
                          } catch(e) {}
                          
                          return `
                            <tr>
                              <td style="font-size: 0.85rem;"><strong>${compLabel}</strong></td>
                              <td style="font-size: 0.85rem; text-align: justify;">${aspectLabel}</td>
                              <td style="text-align: right; font-weight: 600; font-size: 0.85rem; color: var(--contrast);">${ratingVal}</td>
                              <td style="text-align: right; font-weight: 600; font-size: 0.85rem; color: var(--primary);">${pctLabel}</td>
                            </tr>
                          `;
                        }).join('')}
                        <tr style="background-color: rgba(21, 128, 61, 0.05); font-weight: bold; border-top: 2px solid var(--border-color);">
                          <td colspan="2" style="font-size: 0.85rem; color: var(--primary);"><strong>Promedio Final de la Evaluación</strong></td>
                          <td style="text-align: right; font-weight: 700; font-size: 0.85rem; color: var(--contrast);">${groupAvg.toFixed(1)} / 4</td>
                          <td style="text-align: right; font-weight: 700; font-size: 0.85rem; color: var(--primary);">${groupPct.toFixed(1)}%</td>
                        </tr>
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
  
  const promedioEquipo = totalTeamCount > 0 ? (totalTeamScore / totalTeamCount) : 0;
  const promedioEquipoLabel = totalTeamCount > 0 ? promedioEquipo.toFixed(1) : 'N/A';
  const efectividadEquipo = promedioEquipo > 0 ? Math.round((promedioEquipo / 4) * 100) : 0;
  
  htmlContent += `
    <article class="premium-card subordinate-report-card summary-report-card" style="margin-top: 3rem; page-break-before: always; break-before: page;">
      <div style="text-align: center; border-bottom: 2px solid var(--primary); padding-bottom: 1rem; margin-bottom: 1.5rem;">
        <h3 style="margin: 0; color: var(--primary); text-transform: uppercase;"><i class="fa-solid fa-chart-line"></i> Informe Resumen del Departamento</h3>
        <p style="margin: 0.25rem 0 0 0; color: var(--muted-color); font-size: 0.9rem;">Consolidado de efectividad y desempeño global del equipo supervisado</p>
      </div>
      
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem; margin-bottom: 2rem;">
        <div class="kpi-card" style="padding: 1rem;">
          <h5 style="font-size: 0.75rem; color: var(--muted-color); text-transform: uppercase;">Personal Evaluado</h5>
          <h3 style="font-size: 1.75rem; margin-top: 0.25rem; font-weight: 700; color: var(--primary);">${workerSummaries.filter(w => w.evalCount > 0).length} / ${filteredSubordinados.length}</h3>
        </div>
        <div class="kpi-card" style="padding: 1rem;">
          <h5 style="font-size: 0.75rem; color: var(--muted-color); text-transform: uppercase;">Promedio General</h5>
          <h3 style="font-size: 1.75rem; margin-top: 0.25rem; font-weight: 700; color: var(--primary);">${promedioEquipoLabel !== 'N/A' ? `${promedioEquipoLabel} / 4` : '-'}</h3>
        </div>
        <div class="kpi-card" style="padding: 1rem; background-color: rgba(21, 128, 61, 0.1); border: 2px solid var(--primary);">
          <h5 style="font-size: 0.75rem; color: var(--muted-color); text-transform: uppercase; font-weight: 600;">Efectividad de Equipo</h5>
          <h3 style="font-size: 1.75rem; margin-top: 0.25rem; font-weight: 800; color: var(--primary);">${efectividadEquipo}%</h3>
        </div>
      </div>
 
      <div style="display: grid; grid-template-columns: 1.2fr 0.8fr; gap: 2rem; margin-top: 1.5rem;" class="subordinate-profile-grid">
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
                  const rating = w.promedio !== 'N/A' ? `${w.promedio} / 4` : '-';
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
 
        <div>
          <h4 style="margin: 0 0 1rem 0; font-size: 1.1rem; color: var(--primary);"><i class="fa-solid fa-award"></i> Total por Competencia</h4>
          <div style="display: flex; flex-direction: column; gap: 1rem; margin-bottom: 2rem;">
            ${state.classesCache.map(c => {
              const prevSuma = teamCompSuma[c.id] || 0;
              const prevCuenta = teamCompCuenta[c.id] || 0;
              const promedio = prevCuenta > 0 ? (prevSuma / prevCuenta).toFixed(1) : null;
              const pctBarra = promedio ? (parseFloat(promedio) / 4) * 100 : 0;
              const promedioLabel = promedio ? `${((parseFloat(promedio) / 4) * 100).toFixed(1)}%` : 'Sin datos';
              return `
                <div>
                  <div style="display: flex; justify-content: space-between; font-size: 0.8rem; font-weight: 500; margin-bottom: 0.2/rem;">
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
    const workerEvals = state.evaluationsCache.filter(ev => {
      try {
        const parsed = safeParseJSON(ev.evaluacion);
        return parsed && parsed.trabajador_id === s.id;
      } catch(e) { return false; }
    });
    
    let finalEvals = workerEvals;
    if (dateDesde) finalEvals = finalEvals.filter(ev => ev.fecha >= dateDesde);
    if (dateHasta) finalEvals = finalEvals.filter(ev => ev.fecha <= dateHasta);
    
    if (finalEvals.length === 0) return;
    
    const subCompWeightedSuma = {};
    const subCompWeightSum = {};
    const subCompUnweightedSuma = {};
    const subCompCuenta = {};
    
    finalEvals.forEach(ev => {
      try {
        const parsed = safeParseJSON(ev.evaluacion);
        if (!parsed) return;
        const valor = parseFloat(parsed.valor);
        const aspecto = state.aspectsCache.find(a => a.id === ev.item_evaluacion_id);
        if (aspecto && aspecto.tipo === 'rango1,4' && !isNaN(valor)) {
          const claseId = ev.clase_id;
          const weight = aspecto.ponderacion !== null && aspecto.ponderacion !== undefined ? parseFloat(aspecto.ponderacion) : 0;
          
          if (!subCompWeightedSuma[claseId]) {
            subCompWeightedSuma[claseId] = 0;
            subCompWeightSum[claseId] = 0;
            subCompUnweightedSuma[claseId] = 0;
            subCompCuenta[claseId] = 0;
          }
          
          if (weight > 0) {
            subCompWeightedSuma[claseId] += valor * weight;
            subCompWeightSum[claseId] += weight;
          }
          
          subCompUnweightedSuma[claseId] += valor;
          subCompCuenta[claseId]++;
        }
      } catch(e) {}
    });
    
    const labels = [];
    const scores = [];
    
    state.classesCache.forEach(c => {
      const weightedSuma = subCompWeightedSuma[c.id] || 0;
      const weightSum = subCompWeightSum[c.id] || 0;
      const unweightedSuma = subCompUnweightedSuma[c.id] || 0;
      const cuenta = subCompCuenta[c.id] || 0;
      
      if (cuenta > 0) {
        labels.push(c.titulo);
        const promedio = weightSum > 0 ? (weightedSuma / weightSum) : (unweightedSuma / cuenta);
        scores.push(parseFloat(promedio.toFixed(1)));
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
          max: 4
        }
      };
    } else {
      config.options.scales = {
        y: {
          min: 0,
          max: 4,
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

export function printReporteSubordinados() {
  window.print();
}
