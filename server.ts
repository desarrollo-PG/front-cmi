const express = require('express');
const path = require('path');
const app = express();

// Servir archivos estáticos
app.use(express.static(path.join(__dirname, 'dist/cmi-front')));

// API para health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Todas las rutas devuelven index.html (para SPA)
app.get('/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist/cmi-front/index.html'));
});
const port = process.env.PORT || 3000;
app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Servidor corriendo en puerto ${port}`);
  console.log(`🌐 Modo: ${process.env.NODE_ENV || 'production'}`);
});