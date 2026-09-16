// js/utils.js - Funciones de utilidad y cargador de plantillas HTML

const loadedTemplates = new Set();

// Helper para decodificar campos JSON de Supabase de forma segura
export function safeParseJSON(field) {
  if (field === null || field === undefined) return null;
  if (typeof field === 'object') return field;
  try {
    return JSON.parse(field);
  } catch (e) {
    console.error("Error al parsear JSON:", e, field);
    return null;
  }
}

// Helper para verificar contraseñas (soporta hash bcrypt y texto plano)
export function verifyPassword(plainPassword, storedPassword) {
  if (!storedPassword || !plainPassword) return false;
  
  // Si la contraseña almacenada es un hash bcrypt ($2a$, $2b$, $2y$)
  if (storedPassword.startsWith('$2')) {
    try {
      const bcrypt = window.dcodeIO?.bcrypt || window.bcrypt;
      if (bcrypt && bcrypt.compareSync) {
        return bcrypt.compareSync(plainPassword, storedPassword);
      }
    } catch (e) {
      console.warn("Error al verificar hash bcrypt:", e);
    }
  }
  
  // Comparación directa en texto plano (retrocompatibilidad)
  return storedPassword === plainPassword;
}

// Helper para generar hash bcrypt con factor de costo 6
export function hashPassword(plainPassword) {
  try {
    const bcrypt = window.dcodeIO?.bcrypt || window.bcrypt;
    if (bcrypt && bcrypt.hashSync) {
      return bcrypt.hashSync(plainPassword, 6);
    }
  } catch (e) {
    console.warn("Error al generar hash bcrypt:", e);
  }
  return plainPassword;
}

// Helper para Toasts (Notificaciones)
export function showToast(message, type = 'success') {
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

// Helper para errores RLS de Supabase
export function handleRlsError(err) {
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

// Carga asíncrona de archivos HTML para vistas y modales
export async function ensureTemplateLoaded(id, filepath, parentId = null) {
  if (loadedTemplates.has(id) || document.getElementById(id)) {
    return;
  }
  
  try {
    const cacheBuster = filepath.includes('?') ? `&_=${Date.now()}` : `?_=${Date.now()}`;
    const response = await fetch(filepath + cacheBuster);
    if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
    const html = await response.text();
    
    const container = parentId ? document.getElementById(parentId) : document.body;
    if (!container) return;
    
    // Crear un contenedor temporal para parsear el string HTML
    const temp = document.createElement('div');
    temp.innerHTML = html.trim();
    
    // Mover los nodos hijos del temporal al contenedor final
    while (temp.firstChild) {
      container.appendChild(temp.firstChild);
    }
    
    loadedTemplates.add(id);
  } catch (error) {
    console.error(`Error al cargar la plantilla ${id} desde ${filepath}:`, error);
  }
}

// Controladores de Modales con Carga Asíncrona (Lazy-loading)
export async function openModal(modalId) {
  if (modalId === 'trabajadorModal') {
    await ensureTemplateLoaded('trabajadorModal', 'modals/trabajador.html');
  } else if (modalId === 'competenciaModal') {
    await ensureTemplateLoaded('competenciaModal', 'modals/competencia.html');
  } else if (modalId === 'aspectoModal') {
    await ensureTemplateLoaded('aspectoModal', 'modals/aspecto.html');
  } else if (modalId === 'workerChartModal') {
    await ensureTemplateLoaded('workerChartModal', 'modals/chart.html');
  } else if (modalId === 'passwordModal') {
    await ensureTemplateLoaded('passwordModal', 'modals/password.html');
  } else if (modalId === 'fechaEvalModal') {
    await ensureTemplateLoaded('fechaEvalModal', 'modals/fecha_eval.html');
  }
  
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.setAttribute('open', 'true');
  }
}

export function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.removeAttribute('open');
  }
}
