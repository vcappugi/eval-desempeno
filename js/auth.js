import { state } from './state.js';
import { showToast, openModal, closeModal, handleRlsError } from './utils.js';
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
    // Verificar credenciales usando la función RPC en Supabase (Servidor)
    const { data, error } = await state.supabaseClient
      .rpc('verify_worker_credentials', {
        p_username: usernameInput,
        p_password: passwordInput
      });
      
    if (error) throw error;
    
    if (!data || data.length === 0) {
      showToast("Usuario o contraseña incorrectos.", "error");
      return;
    }
    
    state.currentUser = data[0];
    
    // Guardar sesión (excluyendo la contraseña, que no viene de la BD)
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

export async function openPasswordModal() {
  await openModal('passwordModal');
  document.getElementById('passwordForm')?.reset();
}

export async function saveNewPassword(event) {
  if (event) event.preventDefault();
  
  const currentPassword = document.getElementById('currentPassword').value;
  const newPassword = document.getElementById('newPassword').value;
  const confirmPassword = document.getElementById('confirmPassword').value;
  const submitBtn = document.getElementById('savePasswordSubmitBtn');
  
  console.log("Current user state:", state.currentUser);
  console.log("Change password requested for worker ID:", state.currentUser?.id);
  
  if (!currentPassword || !newPassword || !confirmPassword) {
    showToast("Por favor complete todos los campos.", "error");
    return;
  }
  
  if (newPassword !== confirmPassword) {
    showToast("La nueva contraseña y su confirmación no coinciden.", "error");
    return;
  }
  
  if (newPassword.length < 4) {
    showToast("La nueva contraseña debe tener al menos 4 caracteres.", "error");
    return;
  }
  
  submitBtn.disabled = true;
  const originalHtml = submitBtn.innerHTML;
  submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Actualizando...';
  
  try {
    // Actualizar la contraseña en el servidor mediante la función RPC
    const { data: isUpdated, error } = await state.supabaseClient
      .rpc('change_worker_password', {
        p_worker_id: state.currentUser.id,
        p_old_password: currentPassword,
        p_new_password: newPassword
      });
      
    if (error) throw error;
    
    if (!isUpdated) {
      showToast("La contraseña anterior es incorrecta.", "error");
      return;
    }
    
    // Actualizar estado de sesión local
    const userString = JSON.stringify(state.currentUser);
    if (localStorage.getItem('sessionUser')) {
      localStorage.setItem('sessionUser', userString);
    } else if (sessionStorage.getItem('sessionUser')) {
      sessionStorage.setItem('sessionUser', userString);
    }
    
    showToast("Contraseña actualizada correctamente.");
    closeModal('passwordModal');
    
    // Recargar cachés
    await loadCaches();
  } catch (err) {
    console.error("Error updating password:", err);
    showToast(err.message || "Error al actualizar la contraseña.", "error");
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalHtml;
    }
  }
}
