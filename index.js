console.log("Inicio del backend");

require('dotenv').config();
const express = require('express');
const { PORT } = process.env;

const app = express();

app.use(express.json());


//rutas 



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