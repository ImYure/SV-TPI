
const router = require('express').Router();

const db = require('../db/conexion');

router.get('/', function (req, res, next) {

    // 1. Consulta inicial
    let sql = `
        SELECT
            c.id,
            'carta' AS tipo,
            c.nombre,
            cat.nombre AS categoria,
            r.nombre AS rareza,
            c.descripcion,
            c.imagen,
            c.precio,
            c.ataque,
            c.vida,
            c.defensa,
            c.velocidad,
            c.critico
        FROM cartas c
        INNER JOIN categoria cat ON c.categoria_id = cat.id
        INNER JOIN rareza r ON c.rareza_id = r.id
    `;

    // 2. Condiciones y parámetros
    const condiciones = [];
    const parametros = [];

    // Filtrar por categoría
    if (req.query.categoria && req.query.categoria !== "todos") {
        condiciones.push("cat.nombre = ?");
        parametros.push(req.query.categoria);
    }

    // Filtrar por rareza
    if (req.query.rareza) {

        const rarezas = req.query.rareza.split(",");

        if (rarezas.length > 0) {
            const signos = rarezas.map(() => "?").join(",");

            condiciones.push(`r.nombre IN (${signos})`);
            parametros.push(...rarezas);
        }
    }

    // 3. Agregar condiciones a la consulta
    if (condiciones.length > 0) {
        sql += " WHERE " + condiciones.join(" AND ");
    }

    // 4. Ordenar resultados
    if (req.query.orden === "precio") {
        sql += " ORDER BY c.precio ASC";
    }

    if (req.query.orden === "reciente") {
        sql += " ORDER BY c.id DESC";
    }

    // 5. Ejecutar consulta
    db.query(sql, parametros)

        .then(([result]) => {
            res.status(200).json({ cartas: result });
        })

        .catch((error) => {
            res.status(500).send("Ocurrió un error al obtener las cartas");
            console.error(error);
        });
});

// Obtener categorías
router.get('/categorias', function (req, res, next) {

    const sql = `
        SELECT id, nombre
        FROM categoria
        ORDER BY nombre ASC
    `;

    db.query(sql)

        .then(([result]) => {
            res.status(200).json({ categorias: result });
        })

        .catch((error) => {
            res.status(500).send("Ocurrió un error al obtener las categorías");
            console.error(error);
        });
});


// Obtener rarezas
router.get('/rareza', function (req, res, next) {

    const sql = `
        SELECT id, nombre
        FROM rareza
        ORDER BY nombre ASC
    `;

    db.query(sql)

        .then(([result]) => {
            res.status(200).json({ rarezas: result });
        })

        .catch((error) => {
            res.status(500).send("Ocurrió un error al obtener las rarezas");
            console.error(error);
        });
});

module.exports = router;
