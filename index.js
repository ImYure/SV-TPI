console.log("Inicio del backend");

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const router = require('./rutas/PerfilUsuario')
const { PORT } = process.env;

const app = express();

app.use(cors({
  origin: 'http://localhost:5173'
}));

app.use(express.json());

app.use('/perfil', router)



app.get('/', function (req, res, next) {
  console.log("ingreso a /");
  res.send("Backend funcionando");
});

app.listen(PORT, function (error) {
  if (error) {
    console.error(error);
    process.exit(1);
  }
  console.log(`Servidor escuchando en puerto ${PORT}`);
});