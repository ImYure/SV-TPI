
const router = require('express').Router();
const verificarToken = require("../middleware/middleware");
const verificarAdmin = require("../middleware/verificarAdmin");

const db = require('../db/conexion');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Carpeta donde se guardarán las imágenes
const carpetaImagenes = path.join(__dirname, '..', 'imagenes', 'cartas');

// Crear la carpeta si todavía no existe
if (!fs.existsSync(carpetaImagenes)) {
    fs.mkdirSync(carpetaImagenes, { recursive: true });
}

// Configuración del almacenamiento
const almacenamiento = multer.diskStorage({
    destination: function (req, file, callback) {
        callback(null, carpetaImagenes);
    },

    filename: function (req, file, callback) {
        const extension = path.extname(file.originalname).toLowerCase();
        const nombreArchivo = `carta-${Date.now()}${extension}`;

        callback(null, nombreArchivo);
    }
});

// Configuración de Multer
const subirImagen = multer({
    storage: almacenamiento,

    fileFilter: function (req, file, callback) {
    const extensionesPermitidas = [
        '.jpg',
        '.jpeg',
        '.png',
        '.webp',
        '.gif',
        '.jfif',
        '.avif'
    ];

    const extension = path.extname(file.originalname).toLowerCase();

    if (extensionesPermitidas.includes(extension)) {
        callback(null, true);
    } else {
        callback(new Error('Formato de imagen no permitido.'));
    }
},

    limits: {
        fileSize: 5 * 1024 * 1024
    }
});


// LISTAR CARTAS
router.get('/', function (req, res) {

    let sql = `
        SELECT
            c.id,
            'carta' AS tipo,
            c.nombre,
            c.categoria_id,
            cat.nombre AS categoria,
            c.rareza_id,
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

    const condiciones = [];
    const parametros = [];

    if (req.query.categoria && req.query.categoria !== "todos") {
        condiciones.push("cat.nombre = ?");
        parametros.push(req.query.categoria);
    }

    if (req.query.rareza) {
        const rarezas = req.query.rareza.split(",");

        if (rarezas.length > 0) {
            const signos = rarezas.map(() => "?").join(",");
            condiciones.push(`r.nombre IN (${signos})`);
            parametros.push(...rarezas);
        }
    }

    if (condiciones.length > 0) {
        sql += " WHERE " + condiciones.join(" AND ");
    }

    if (req.query.orden === "precio") {
        sql += " ORDER BY c.precio ASC";
    }

    if (req.query.orden === "reciente") {
        sql += " ORDER BY c.id DESC";
    }

    db.query(sql, parametros)
        .then(([result]) => {
            res.status(200).json({ cartas: result });
        })
        .catch(error => {
            console.error(error);
            res.status(500).send("Ocurrió un error al obtener las cartas");
        });
});


// OBTENER CATEGORÍAS
router.get('/categorias', function (req, res) {

    const sql = `
        SELECT id, nombre
        FROM categoria
        ORDER BY nombre ASC
    `;

    db.query(sql)
        .then(([result]) => {
            res.status(200).json({ categorias: result });
        })
        .catch(error => {
            console.error(error);
            res.status(500).send("Ocurrió un error al obtener las categorías");
        });
});


// OBTENER RAREZAS
router.get('/rareza', function (req, res) {

    const sql = `
        SELECT id, nombre
        FROM rareza
        ORDER BY nombre ASC
    `;

    db.query(sql)
        .then(([result]) => {
            res.status(200).json({ rarezas: result });
        })
        .catch(error => {
            console.error(error);
            res.status(500).send("Ocurrió un error al obtener las rarezas");
        });
});


// CREAR CARTA
router.post(
    "/",
    verificarToken,
    verificarAdmin,
    subirImagen.single('imagen'),
    function (req, res) {

        const {
            nombre,
            descripcion,
            precio,
            ataque,
            defensa,
            vida,
            velocidad,
            critico,
            categoria_id,
            rareza_id
        } = req.body;

        if (
            !nombre ||
            !descripcion ||
            precio === undefined ||
            precio === "" ||
            ataque === undefined ||
            defensa === undefined ||
            vida === undefined ||
            velocidad === undefined ||
            !categoria_id ||
            !rareza_id ||
            !req.file
        ) {
            if (req.file) fs.unlinkSync(req.file.path);

            return res.status(400).json({
                mensaje: "Faltan datos obligatorios o no seleccionaste una imagen."
            });
        }

        const imagen = req.file.filename;

        const sql = `
            INSERT INTO cartas
            (nombre, descripcion, imagen, precio, ataque, defensa, vida,
            velocidad, critico, categoria_id, rareza_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const valores = [
            nombre,
            descripcion,
            imagen,
            precio,
            ataque,
            defensa,
            vida,
            velocidad,
            critico || 0,
            categoria_id,
            rareza_id
        ];

        db.query(sql, valores)
            .then(([resultado]) => {
                res.status(201).json({
                    mensaje: "Carta creada correctamente.",
                    id: resultado.insertId,
                    imagen: imagen
                });
            })
            .catch(error => {
                console.error(error);
                fs.unlink(req.file.path, () => {});

                res.status(500).json({
                    mensaje: "Error al crear la carta."
                });
            });
    }
);


// EDITAR CARTA
router.put(
    "/:id",
    verificarToken,
    verificarAdmin,
    subirImagen.single('imagen'),
    function (req, res) {

        const {
            nombre,
            descripcion,
            precio,
            ataque,
            defensa,
            vida,
            velocidad,
            critico,
            categoria_id,
            rareza_id
        } = req.body;

        // Si se seleccionó una imagen nueva, usamos esa.
        // Si no, conservamos la imagen que ya tenía la carta.
        const consultaImagen = "SELECT imagen FROM cartas WHERE id = ?";

        db.query(consultaImagen, [req.params.id])
            .then(([cartasEncontradas]) => {

                if (cartasEncontradas.length === 0) {
                    if (req.file) fs.unlinkSync(req.file.path);

                    return res.status(404).json({
                        mensaje: "No se encontró la carta."
                    });
                }

                const imagenAnterior = cartasEncontradas[0].imagen;
                const imagenNueva = req.file
                    ? req.file.filename
                    : imagenAnterior;

                const sql = `
                    UPDATE cartas
                    SET nombre = ?,
                        descripcion = ?,
                        imagen = ?,
                        precio = ?,
                        ataque = ?,
                        defensa = ?,
                        vida = ?,
                        velocidad = ?,
                        critico = ?,
                        categoria_id = ?,
                        rareza_id = ?
                    WHERE id = ?
                `;

                const valores = [
                    nombre,
                    descripcion,
                    imagenNueva,
                    precio,
                    ataque,
                    defensa,
                    vida,
                    velocidad,
                    critico || 0,
                    categoria_id,
                    rareza_id,
                    req.params.id
                ];

                return db.query(sql, valores)
                    .then(() => {

                        // Borrar la imagen anterior solo si se reemplazó
                        if (
                            req.file &&
                            imagenAnterior &&
                            imagenAnterior !== imagenNueva
                        ) {
                            const rutaAnterior = path.join(
                                carpetaImagenes,
                                imagenAnterior
                            );

                            if (fs.existsSync(rutaAnterior)) {
                                fs.unlinkSync(rutaAnterior);
                            }
                        }

                        res.json({
                            mensaje: "Carta actualizada correctamente.",
                            imagen: imagenNueva
                        });
                    });
            })
            .catch(error => {
                console.error(error);

                if (req.file && fs.existsSync(req.file.path)) {
                    fs.unlink(req.file.path, () => {});
                }

                res.status(500).json({
                    mensaje: "Error al editar la carta."
                });
            });
    }
);


// ELIMINAR CARTA
router.delete("/:id", verificarToken, verificarAdmin, function (req, res) {

    const consulta = "SELECT imagen FROM cartas WHERE id = ?";

    db.query(consulta, [req.params.id])
        .then(([cartasEncontradas]) => {

            if (cartasEncontradas.length === 0) {
                return res.status(404).json({
                    mensaje: "No se encontró la carta."
                });
            }

            const imagen = cartasEncontradas[0].imagen;

            const sql = "DELETE FROM cartas WHERE id = ?";

            return db.query(sql, [req.params.id])
                .then(([resultado]) => {

                    if (resultado.affectedRows === 0) {
                        return res.status(404).json({
                            mensaje: "No se encontró la carta."
                        });
                    }

                    // Eliminar el archivo de imagen
                    if (imagen) {
                        const rutaImagen = path.join(carpetaImagenes, imagen);

                        if (fs.existsSync(rutaImagen)) {
                            fs.unlinkSync(rutaImagen);
                        }
                    }

                    res.json({
                        mensaje: "Carta eliminada correctamente."
                    });
                });
        })
        .catch(error => {
            console.error(error);

            res.status(409).json({
                mensaje: "No se puede eliminar esta carta porque está relacionada con otros registros."
            });
        });
});


module.exports = router;
