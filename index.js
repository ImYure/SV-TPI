
console.log("INICIO DEL BACKEND");
console.log("Carpeta actual:", __dirname);

require('dotenv').config();

const express = require('express');

console.log("ANTES DE CARGAR LAS RUTAS");

const router = require('./rutas/PerfilUsuario');
const rutas = require('./rutas/ruta');
const rutasCartas = require('./rutas/Cartas');

console.log("DESPUES DE CARGAR LAS RUTAS");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Configuración CORS de testing
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
app.use('/cartas', rutasCartas);

app.get("/", function (req, res) {
    res.send("Backend funcionando");
});

app.listen(PORT, function () {
    console.log(`Servidor escuchando en puerto ${PORT}`);
});
