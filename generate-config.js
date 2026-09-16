// generate-config.js (en la raíz del proyecto)
// Genera js/config.js a partir de las variables de entorno de Vercel o del archivo .env local

const fs = require('fs');
const path = require('path');

let url = process.env.API_URL || process.env.SUPABASE_URL || '';
let key = process.env.ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

// Si no están en process.env (por ejemplo, en local), intentar leer del archivo .env
const envPath = path.join(__dirname, '.env');
if ((!url || !key) && fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const [k, ...v] = trimmed.split('=');
    const val = v.join('=').trim();
    const cleanKey = k.trim();
    if (cleanKey === 'API_URL' || cleanKey === 'SUPABASE_URL') url = url || val;
    if (cleanKey === 'ANON_KEY' || cleanKey === 'SUPABASE_ANON_KEY') key = key || val;
  });
}

if (!url || !key) {
  console.warn('ADVERTENCIA: No se encontraron las variables API_URL / ANON_KEY ni en process.env ni en .env.');
}

const content = `// Archivo generado automáticamente - NO EDITAR DIRECTAMENTE
export const CONFIG = {
  SUPABASE_URL: "${url}",
  SUPABASE_ANON_KEY: "${key}"
};
`;

const targetPath = path.join(__dirname, 'js', 'config.js');
fs.writeFileSync(targetPath, content, 'utf8');
console.log('✔ js/config.js generado exitosamente con la configuración activa.');
