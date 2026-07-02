// api/config.js
// Función Serverless de Vercel para servir las variables de entorno de producción al frontend de manera dinámica.

module.exports = (req, res) => {
  // Leer variables del panel de Vercel
  const url = process.env.SUPABASE_URL || process.env.API_URL || "";
  const key = process.env.SUPABASE_ANON_KEY || process.env.ANON_KEY || "";
  
  // Establecer cabeceras y responder con JSON
  res.setHeader('Content-Type', 'application/json');
  res.status(200).send(JSON.stringify({
    SUPABASE_URL: url,
    SUPABASE_ANON_KEY: key
  }));
};
