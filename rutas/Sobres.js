
const verificarToken = require("../middleware/middleware");
const verificarAdmin = require("../middleware/verificarAdmin");

const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = require('express').Router();

const db = require('../db/conexion');


// LISTAR SOBRES
router.get('/', function (req, res) {

    let sql = `
        SELECT
    s.id,
    'sobre' AS tipo,
    s.nombre,
    s.imagen,
    COALESCE(s.descripcion, '') AS descripcion,
    s.precio,
    s.cantidad_carta,
    s.rareza_id,
    r.nombre AS rareza,
    s.categoria_id,
    cat.nombre AS categoria
        FROM sobres s
        INNER JOIN categoria cat ON s.categoria_id = cat.id
        INNER JOIN rareza r ON s.rareza_id = r.id
    `;

    const condiciones = [];
    const parametros = [];

    // FILTRAR POR CATEGORÍA
    if (req.query.categoria && req.query.categoria !== "todos") {
        condiciones.push("cat.nombre = ?");
        parametros.push(req.query.categoria);
    }

    // FILTRAR POR RAREZA
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

    // ORDENAR
    if (req.query.orden === "precio") {
        sql += " ORDER BY s.precio ASC";
    }

    if (req.query.orden === "reciente") {
        sql += " ORDER BY s.id DESC";
    }

    db.query(sql, parametros)
        .then(([result]) => {
            res.status(200).json({ sobres: result });
        })
        .catch(error => {
            console.error(error);
            res.status(500).send("Ocurrió un error al obtener los sobres");
        });
});


// CARPETA DE IMÁGENES
const carpetaImagenes = path.join(__dirname, '..', 'imagenes', 'sobres');

if (!fs.existsSync(carpetaImagenes)) {
    fs.mkdirSync(carpetaImagenes, { recursive: true });
}

// CONFIGURACIÓN DE MULTER
const almacenamiento = multer.diskStorage({

    destination: function (req, file, callback) {
        callback(null, carpetaImagenes);
    },

    filename: function (req, file, callback) {
        const extension = path.extname(file.originalname).toLowerCase();
        const nombreArchivo = `sobre-${Date.now()}${extension}`;

        callback(null, nombreArchivo);
    }
});

const subirImagen = multer({

    storage: almacenamiento,

    fileFilter: function (req, file, callback) {

        const extensionesPermitidas = [
            '.jpg', '.jpeg', '.png',
            '.webp', '.gif', '.jfif', '.avif'
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


// CREAR SOBRE
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
            cantidad_carta,
            categoria_id,
            rareza_id
        } = req.body;

        // VALIDAR DATOS
        if (
            !nombre ||
            !nombre.trim() ||
            !descripcion ||
            !descripcion.trim() ||
            precio === undefined ||
            precio === "" ||
            cantidad_carta === undefined ||
            cantidad_carta === "" ||
            !categoria_id ||
            !rareza_id ||
            !req.file
        ) {

            if (req.file) fs.unlinkSync(req.file.path);

            return res.status(400).json({
                mensaje: "Completá todos los campos y seleccioná una imagen."
            });
        }

        const imagen = req.file.filename;

        const sql = `
            INSERT INTO sobres
            (nombre, descripcion, precio, cantidad_carta,
            rareza_id, categoria_id, imagen)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;

        const valores = [
            nombre.trim(),
            descripcion.trim(),
            precio,
            cantidad_carta,
            rareza_id,
            categoria_id,
            imagen
        ];

        db.query(sql, valores)

            .then(([resultado]) => {

                res.status(201).json({
                    mensaje: "Sobre creado correctamente.",
                    id: resultado.insertId,
                    imagen: imagen
                });

            })

            .catch(error => {

                console.error(error);

                fs.unlink(req.file.path, () => { });

                res.status(500).json({
                    mensaje: "Error al crear el sobre."
                });
            });
    }
);

// EDITAR SOBRE
router.put(
    "/:id",
    verificarToken,
    verificarAdmin,
    subirImagen.single("imagen"),
    function (req, res) {

        const { id } = req.params;

        const {
            nombre,
            descripcion,
            precio,
            cantidad_carta,
            categoria_id,
            rareza_id
        } = req.body;

        // VALIDAR DATOS
        if (
            !nombre || !nombre.trim() ||
            !descripcion || !descripcion.trim() ||
            precio === undefined || precio === "" ||
            cantidad_carta === undefined || cantidad_carta === "" ||
            !categoria_id ||
            !rareza_id
        ) {
            if (req.file) fs.unlink(req.file.path, () => { });

            return res.status(400).json({
                mensaje: "Completá todos los campos."
            });
        }

        // BUSCAR EL SOBRE ACTUAL
        const sqlBuscar = "SELECT imagen FROM sobres WHERE id = ?";

        db.query(sqlBuscar, [id])

            .then(([resultado]) => {

                if (resultado.length === 0) {
                    if (req.file) fs.unlink(req.file.path, () => { });

                    return res.status(404).json({
                        mensaje: "No se encontró el sobre."
                    });
                }

                const imagenAnterior = resultado[0].imagen;

                // Si se subió una imagen nueva, utilizarla.
                // Si no, conservar la anterior.
                const imagen = req.file
                    ? req.file.filename
                    : imagenAnterior;

                const sqlActualizar = `
                    UPDATE sobres
                    SET nombre = ?,
                        descripcion = ?,
                        precio = ?,
                        cantidad_carta = ?,
                        categoria_id = ?,
                        rareza_id = ?,
                        imagen = ?
                    WHERE id = ?
                `;

                const valores = [
                    nombre.trim(),
                    descripcion.trim(),
                    precio,
                    cantidad_carta,
                    categoria_id,
                    rareza_id,
                    imagen,
                    id
                ];

                return db.query(sqlActualizar, valores)
                    .then(() => {

                        // Borrar la imagen anterior si fue reemplazada.
                        if (req.file && imagenAnterior) {
                            const rutaAnterior = path.join(
                                carpetaImagenes,
                                path.basename(imagenAnterior)
                            );

                            fs.unlink(rutaAnterior, () => { });
                        }

                        res.status(200).json({
                            mensaje: "Sobre actualizado correctamente."
                        });

                    });
            })

            .catch(error => {

                console.error(error);

                if (req.file) fs.unlink(req.file.path, () => { });

                res.status(500).json({
                    mensaje: "Error al actualizar el sobre."
                });
            });
    }
);


// ELIMINAR SOBRE
router.delete(
    "/:id",
    verificarToken,
    verificarAdmin,
    function (req, res) {

        const { id } = req.params;

        // BUSCAR LA IMAGEN DEL SOBRE
        const sqlBuscar = "SELECT imagen FROM sobres WHERE id = ?";

        db.query(sqlBuscar, [id])

            .then(([resultado]) => {

                if (resultado.length === 0) {
                    return res.status(404).json({
                        mensaje: "No se encontró el sobre."
                    });
                }

                const imagen = resultado[0].imagen;

                // ELIMINAR EL REGISTRO
                const sqlEliminar = "DELETE FROM sobres WHERE id = ?";

                return db.query(sqlEliminar, [id])
                    .then(() => {

                        // ELIMINAR LA IMAGEN DE LA CARPETA
                        if (imagen) {
                            const rutaImagen = path.join(
                                carpetaImagenes,
                                path.basename(imagen)
                            );

                            fs.unlink(rutaImagen, () => { });
                        }

                        res.status(200).json({
                            mensaje: "Sobre eliminado correctamente."
                        });

                    });
            })

            .catch(error => {

                console.error(error);

                res.status(500).json({
                    mensaje: "Error al eliminar el sobre."
                });
            });
    }
);

module.exports = router;
