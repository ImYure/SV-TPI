
const router = require('express').Router();

const db = require('../db/conexion');
const verificarToken = require('../middleware/middleware');

// ==========================================
// OBTENER LOS MAZOS DEL USUARIO
// ==========================================

router.get('/', verificarToken, async function (req, res) {
    try {
        const usuarioId = req.usuario.id;

        const [resultados] = await db.query(
            `SELECT
                m.id AS mazo_id,
                m.nombre AS mazo_nombre,
                mc.carta_id,
                mc.cantidad,
                c.nombre AS carta_nombre,
                c.imagen,
                c.descripcion,
                c.precio,
                c.ataque,
                c.defensa,
                c.vida,
                c.velocidad,
                c.critico,
                cat.nombre AS categoria,
                r.nombre AS rareza
            FROM mazo m
            LEFT JOIN mazo_carta mc ON m.id = mc.mazo_id
            LEFT JOIN cartas c ON mc.carta_id = c.id
            LEFT JOIN categoria cat ON c.categoria_id = cat.id
            LEFT JOIN rareza r ON c.rareza_id = r.id
            WHERE m.usuario_id = ?
            ORDER BY m.id, c.id`,
            [usuarioId]
        );

        const mazos = [];

        resultados.forEach(function (fila) {
            let mazo = mazos.find(function (item) {
                return item.id === fila.mazo_id;
            });

            if (!mazo) {
                mazo = {
                    id: fila.mazo_id,
                    nombre: fila.mazo_nombre,
                    cartas: []
                };

                mazos.push(mazo);
            }

            if (fila.carta_id) {
                mazo.cartas.push({
                    id: fila.carta_id,
                    nombre: fila.carta_nombre,
                    imagen: fila.imagen,
                    descripcion: fila.descripcion,
                    precio: fila.precio,
                    ataque: fila.ataque,
                    defensa: fila.defensa,
                    vida: fila.vida,
                    velocidad: fila.velocidad,
                    critico: fila.critico,
                    categoria: fila.categoria,
                    rareza: fila.rareza,
                    cantidad: fila.cantidad
                });
            }
        });

        res.json({ mazos });

    } catch (error) {
        console.error("Error al obtener los mazos:", error);
        res.status(500).json({
            mensaje: "Error al obtener los mazos"
        });
    }
});


// ==========================================
// CREAR UN MAZO
// ==========================================

router.post('/', verificarToken, async function (req, res) {
    try {
        const usuarioId = req.usuario.id;
        const { nombre } = req.body;

        const nombreMazo = nombre && nombre.trim()
            ? nombre.trim()
            : "Nuevo mazo";

        const [resultado] = await db.query(
            `INSERT INTO mazo (usuario_id, nombre)
             VALUES (?, ?)`,
            [usuarioId, nombreMazo]
        );

        res.status(201).json({
            mensaje: "Mazo creado correctamente",
            mazo: {
                id: resultado.insertId,
                nombre: nombreMazo,
                cartas: []
            }
        });

    } catch (error) {
        console.error("Error al crear el mazo:", error);
        res.status(500).json({
            mensaje: "Error al crear el mazo"
        });
    }
});


// ==========================================
// AGREGAR CARTA AL MAZO
// ==========================================

router.post('/:id/cartas', verificarToken, async function (req, res) {
    let conexion;

    try {
        const usuarioId = req.usuario.id;
        const mazoId = req.params.id;
        const cartaId = req.body.carta_id;

        if (!cartaId) {
            return res.status(400).json({
                mensaje: "Tenés que indicar qué carta querés agregar"
            });
        }

        conexion = await db.getConnection();
        await conexion.beginTransaction();

        // Comprobar que el mazo pertenece al usuario
        const [mazos] = await conexion.query(
            `SELECT id FROM mazo
             WHERE id = ? AND usuario_id = ?`,
            [mazoId, usuarioId]
        );

        if (mazos.length === 0) {
            await conexion.rollback();

            return res.status(404).json({
                mensaje: "No se encontró el mazo"
            });
        }

        // Comprobar que el usuario tiene la carta
        const [cartasUsuario] = await conexion.query(
            `SELECT cantidad FROM usuario_cartas
             WHERE usuario_id = ? AND carta_id = ?`,
            [usuarioId, cartaId]
        );

        if (cartasUsuario.length === 0 || cartasUsuario[0].cantidad < 1) {
            await conexion.rollback();

            return res.status(400).json({
                mensaje: "No tenés esta carta en tu colección"
            });
        }

        // Comprobar cuántas copias de la carta ya hay en el mazo
        const [cartasMazo] = await conexion.query(
            `SELECT cantidad FROM mazo_carta
             WHERE mazo_id = ? AND carta_id = ?`,
            [mazoId, cartaId]
        );

        const cantidadActual = cartasMazo.length > 0
            ? cartasMazo[0].cantidad
            : 0;

        // No permitir agregar más copias de las que posee
        if (cantidadActual >= cartasUsuario[0].cantidad) {
            await conexion.rollback();

            return res.status(400).json({
                mensaje: "No tenés más copias de esta carta"
            });
        }

        // Comprobar el límite de 8 cartas
        const [totalCartas] = await conexion.query(
            `SELECT COALESCE(SUM(cantidad), 0) AS total
             FROM mazo_carta
             WHERE mazo_id = ?`,
            [mazoId]
        );

        if (totalCartas[0].total >= 8) {
            await conexion.rollback();

            return res.status(400).json({
                mensaje: "Este mazo ya tiene 8 cartas"
            });
        }

        // Agregar una copia de la carta
        if (cartasMazo.length > 0) {
            await conexion.query(
                `UPDATE mazo_carta
                 SET cantidad = cantidad + 1
                 WHERE mazo_id = ? AND carta_id = ?`,
                [mazoId, cartaId]
            );
        } else {
            await conexion.query(
                `INSERT INTO mazo_carta (mazo_id, carta_id, cantidad)
                 VALUES (?, ?, 1)`,
                [mazoId, cartaId]
            );
        }

        await conexion.commit();

        res.json({
            mensaje: "Carta agregada al mazo correctamente"
        });

    } catch (error) {
        if (conexion) {
            await conexion.rollback();
        }

        console.error("Error al agregar carta:", error);

        res.status(500).json({
            mensaje: "Error al agregar la carta al mazo"
        });

    } finally {
        if (conexion) {
            conexion.release();
        }
    }
});


// ==========================================
// QUITAR UNA COPIA DE UNA CARTA DEL MAZO
// ==========================================

router.delete('/:id/cartas/:cartaId', verificarToken, async function (req, res) {
    let conexion;

    try {
        const usuarioId = req.usuario.id;
        const mazoId = req.params.id;
        const cartaId = req.params.cartaId;

        conexion = await db.getConnection();
        await conexion.beginTransaction();

        // Comprobar que el mazo pertenece al usuario
        const [mazos] = await conexion.query(
            `SELECT id FROM mazo
             WHERE id = ? AND usuario_id = ?`,
            [mazoId, usuarioId]
        );

        if (mazos.length === 0) {
            await conexion.rollback();

            return res.status(404).json({
                mensaje: "No se encontró el mazo"
            });
        }

        // Buscar la carta dentro del mazo
        const [cartas] = await conexion.query(
            `SELECT cantidad FROM mazo_carta
             WHERE mazo_id = ? AND carta_id = ?`,
            [mazoId, cartaId]
        );

        if (cartas.length === 0) {
            await conexion.rollback();

            return res.status(404).json({
                mensaje: "La carta no está en este mazo"
            });
        }

        if (cartas[0].cantidad > 1) {
            await conexion.query(
                `UPDATE mazo_carta
                 SET cantidad = cantidad - 1
                 WHERE mazo_id = ? AND carta_id = ?`,
                [mazoId, cartaId]
            );
        } else {
            await conexion.query(
                `DELETE FROM mazo_carta
                 WHERE mazo_id = ? AND carta_id = ?`,
                [mazoId, cartaId]
            );
        }

        await conexion.commit();

        res.json({
            mensaje: "Carta quitada del mazo correctamente"
        });

    } catch (error) {
        if (conexion) {
            await conexion.rollback();
        }

        console.error("Error al quitar carta:", error);

        res.status(500).json({
            mensaje: "Error al quitar la carta del mazo"
        });

    } finally {
        if (conexion) {
            conexion.release();
        }
    }
});


// ==========================================
// ELIMINAR UN MAZO
// ==========================================

router.delete('/:id', verificarToken, async function (req, res) {
    let conexion;

    try {
        const usuarioId = req.usuario.id;
        const mazoId = req.params.id;

        conexion = await db.getConnection();
        await conexion.beginTransaction();

        // Comprobar que el mazo pertenece al usuario
        const [mazos] = await conexion.query(
            `SELECT id FROM mazo
             WHERE id = ? AND usuario_id = ?`,
            [mazoId, usuarioId]
        );

        if (mazos.length === 0) {
            await conexion.rollback();

            return res.status(404).json({
                mensaje: "No se encontró el mazo"
            });
        }

        // Eliminar primero las cartas del mazo
        await conexion.query(
            `DELETE FROM mazo_carta
             WHERE mazo_id = ?`,
            [mazoId]
        );

        // Eliminar el mazo
        await conexion.query(
            `DELETE FROM mazo
             WHERE id = ? AND usuario_id = ?`,
            [mazoId, usuarioId]
        );

        await conexion.commit();

        res.json({
            mensaje: "Mazo eliminado correctamente"
        });

    } catch (error) {
        if (conexion) {
            await conexion.rollback();
        }

        console.error("Error al eliminar el mazo:", error);

        res.status(500).json({
            mensaje: "Error al eliminar el mazo"
        });

    } finally {
        if (conexion) {
            conexion.release();
        }
    }
});


module.exports = router;
