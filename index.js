
console.log("INICIO DEL BACKEND");
console.log("Carpeta actual:", __dirname);

require('dotenv').config();

const express = require('express');
const path = require('path');

console.log("ANTES DE CARGAR LAS RUTAS");

const rutasProductos = require('./rutas/productos');
const router = require('./rutas/PerfilUsuario');
const rutas = require('./rutas/ruta');

const aperturaSobres = require('./rutas/AperturaSobres');
const rutasCartas = require('./rutas/Cartas');
const rutasSobres = require('./rutas/Sobres');
const rutasMazos = require('./rutas/Mazos');

console.log("DESPUES DE CARGAR LAS RUTAS");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Mostrar imágenes de cartas
app.use('/imagenes', express.static(path.join(__dirname, 'imagenes')));

// Configuración CORS
app.use(function(req, res, next) {
    res.setHeader("Access-Control-Allow-Origin", "http://localhost:5173");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

    if (req.method === "OPTIONS") {
        return res.sendStatus(204);
    }

    next();
});

// Routers
app.use('/perfil', router);
app.use('/api', rutas);
app.use('/sobres', aperturaSobres);
app.use('/sobres', rutasSobres);
app.use('/cartas', rutasCartas);
app.use('/productos', rutasProductos);
app.use('/mazos', rutasMazos);

// Ruta principal
app.get("/", function (req, res) {
    res.send("Backend funcionando");
});

// Iniciar servidor
app.listen(PORT, function () {
    console.log(`Servidor escuchando en puerto ${PORT}`);
});
