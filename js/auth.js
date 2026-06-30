// js/auth.js - Gestión de sesión y autenticación

import { state } from './state.js';
import { showToast } from './utils.js';
import { loadCaches } from './supabase.js';
import { switchView } from './views.js';

export function checkSession() {
  const savedUser = localStorage.getItem('sessionUser') || sessionStorage.getItem('sessionUser');
  if (savedUser) {
    try {
      state.currentUser = JSON.parse(savedUser);
      loginSuccess(state.currentUser);
    } catch (e) {
      localStorage.removeItem('sessionUser');
      sessionStorage.removeItem('sessionUser');
      showLoginView();
    }
  } else {
    showLoginView();
  }
}

export async function handleLogin(event) {
  if (event) event.preventDefault();
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
    const { data, error } = await state.supabaseClient
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
    
    state.currentUser = user;
    
    // Guardar sesión
    const userString = JSON.stringify(state.currentUser);
    if (rememberMe) {
      localStorage.setItem('sessionUser', userString);
    } else {
      sessionStorage.setItem('sessionUser', userString);
    }
    
    showToast(`¡Bienvenido, ${state.currentUser.nombre}!`);
    loginSuccess(state.currentUser);
    
  } catch (err) {
    console.error("Login error:", err);
    showToast("Error en el servidor de base de datos.", "error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i class="fa-solid fa-right-to-bracket mr-2"></i> Iniciar Sesión';
  }
}

export function loginSuccess(user) {
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

export function handleLogout() {
  state.currentUser = null;
  localStorage.removeItem('sessionUser');
  sessionStorage.removeItem('sessionUser');
  
  // Ocultar vistas principales
  document.getElementById('mainHeader').style.display = 'none';
  document.getElementById('appContainer').style.display = 'none';
  document.getElementById('loginForm').reset();
  document.getElementById('loginView').style.display = 'flex';
  
  showToast("Sesión cerrada correctamente.");
}

export function showLoginView() {
  document.getElementById('loginView').style.display = 'flex';
  document.getElementById('mainHeader').style.display = 'none';
  document.getElementById('appContainer').style.display = 'none';
}
