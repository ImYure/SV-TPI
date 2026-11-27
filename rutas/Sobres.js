
const router = require("express").Router();

const db = require("../db/conexion");
const verificarToken = require("../middleware/middleware");
const verificarAdmin = require("../middleware/verificarAdmin");


// ==========================================
// OBTENER TODOS LOS SOBRES
// ==========================================

router.get("/", async function (req, res) {
    try {
        const [sobresDB] = await db.query(`
            SELECT
                s.id,
                s.nombre,
                s.descripcion,
                s.precio,
                s.cantidad_carta,
                s.categoria_id,
                s.imagen,
                c.nombre AS categoria,
                sc.cartas_id,
                sc.probabilidad,
                ca.nombre AS nombre_carta
            FROM sobres s
            LEFT JOIN categoria c ON s.categoria_id = c.id
            LEFT JOIN sobres_cartas sc ON s.id = sc.sobres_id
            LEFT JOIN cartas ca ON sc.cartas_id = ca.id
            ORDER BY s.id
        `);

        const sobres = {};

        sobresDB.forEach(function (fila) {
            if (!sobres[fila.id]) {
                sobres[fila.id] = {
                    id: fila.id,
                    nombre: fila.nombre,
                    descripcion: fila.descripcion,
                    precio: fila.precio,
                    cantidad_carta: fila.cantidad_carta,
                    categoria_id: fila.categoria_id,
                    categoria: fila.categoria,
                    imagen: fila.imagen,
                    cartas: []
                };
            }

            if (fila.cartas_id) {
                sobres[fila.id].cartas.push({
                    id: fila.cartas_id,
                    nombre: fila.nombre_carta,
                    probabilidad: fila.probabilidad
                });
            }
        });

        res.json({
            sobres: Object.values(sobres)
        });

    } catch (error) {
        console.error("Error al obtener sobres:", error);

        res.status(500).json({
            mensaje: "Error al obtener los sobres"
        });
    }
});


// ==========================================
// CREAR SOBRE (ADMINISTRADOR)
// ==========================================

router.post("/", verificarToken, verificarAdmin, async function (req, res) {

    const {
        nombre,
        descripcion,
        precio,
        cantidad_carta,
        categoria_id,
        imagen,
        cartas
    } = req.body;

    if (
        !nombre ||
        precio === undefined ||
        cantidad_carta === undefined ||
        !categoria_id ||
        !Array.isArray(cartas) ||
        cartas.length === 0
    ) {
        return res.status(400).json({
            mensaje: "Faltan datos para crear el sobre"
        });
    }

    if (
        Number(precio) < 0 ||
        !Number.isInteger(Number(cantidad_carta)) ||
        Number(cantidad_carta) <= 0
    ) {
        return res.status(400).json({
            mensaje: "El precio o la cantidad de cartas no son válidos"
        });
    }

    const idsCartas = cartas.map(function (carta) {
        return Number(carta.id);
    });

    if (new Set(idsCartas).size !== idsCartas.length) {
        return res.status(400).json({
            mensaje: "No se pueden repetir cartas en la lista"
        });
    }

    for (const carta of cartas) {
        const probabilidad = Number(carta.probabilidad);

        if (
            !carta.id ||
            !Number.isFinite(probabilidad) ||
            probabilidad < 0 ||
            probabilidad > 100
        ) {
            return res.status(400).json({
                mensaje: "Las cartas o sus probabilidades no son válidas"
            });
        }
    }

    const conexion = await db.getConnection();

    try {
        await conexion.beginTransaction();

        const [resultado] = await conexion.query(
            `INSERT INTO sobres
            (nombre, descripcion, precio, cantidad_carta, categoria_id, imagen)
            VALUES (?, ?, ?, ?, ?, ?)`,
            [
                nombre,
                descripcion || "",
                precio,
                cantidad_carta,
                categoria_id,
                imagen || null
            ]
        );

        const sobreId = resultado.insertId;

        for (const carta of cartas) {
            await conexion.query(
                `INSERT INTO sobres_cartas
                (sobres_id, cartas_id, probabilidad)
                VALUES (?, ?, ?)`,
                [
                    sobreId,
                    carta.id,
                    carta.probabilidad
                ]
            );
        }

        await conexion.commit();

        res.status(201).json({
            mensaje: "Sobre creado correctamente",
            id: sobreId
        });

    } catch (error) {
        await conexion.rollback();

        console.error("Error al crear sobre:", error);

        res.status(500).json({
            mensaje: "Error al crear el sobre"
        });

    } finally {
        conexion.release();
    }
});


// ==========================================
// MODIFICAR SOBRE (ADMINISTRADOR)
// ==========================================

router.put("/:id", verificarToken, verificarAdmin, async function (req, res) {

    const { id } = req.params;

    const {
        nombre,
        descripcion,
        precio,
        cantidad_carta,
        categoria_id,
        imagen,
        cartas
    } = req.body;

    if (
        !nombre ||
        precio === undefined ||
        cantidad_carta === undefined ||
        !categoria_id
    ) {
        return res.status(400).json({
            mensaje: "Faltan datos para modificar el sobre"
        });
    }

    if (
        Number(precio) < 0 ||
        !Number.isInteger(Number(cantidad_carta)) ||
        Number(cantidad_carta) <= 0
    ) {
        return res.status(400).json({
            mensaje: "El precio o la cantidad de cartas no son válidos"
        });
    }

    if (cartas !== undefined && !Array.isArray(cartas)) {
        return res.status(400).json({
            mensaje: "La lista de cartas no es válida"
        });
    }

    if (Array.isArray(cartas)) {

        const idsCartas = cartas.map(function (carta) {
            return Number(carta.id);
        });

        if (
            cartas.length === 0 ||
            new Set(idsCartas).size !== idsCartas.length
        ) {
            return res.status(400).json({
                mensaje: "La lista de cartas está vacía o contiene repetidas"
            });
        }

        for (const carta of cartas) {
            const probabilidad = Number(carta.probabilidad);

            if (
                !carta.id ||
                !Number.isFinite(probabilidad) ||
                probabilidad < 0 ||
                probabilidad > 100
            ) {
                return res.status(400).json({
                    mensaje: "Las cartas o sus probabilidades no son válidas"
                });
            }
        }
    }

    const conexion = await db.getConnection();

    try {
        await conexion.beginTransaction();

        const [resultado] = await conexion.query(
            `UPDATE sobres
            SET nombre = ?,
                descripcion = ?,
                precio = ?,
                cantidad_carta = ?,
                categoria_id = ?,
                imagen = COALESCE(?, imagen)
            WHERE id = ?`,
            [
                nombre,
                descripcion || "",
                precio,
                cantidad_carta,
                categoria_id,
                imagen || null,
                id
            ]
        );

        if (resultado.affectedRows === 0) {
            await conexion.rollback();

            return res.status(404).json({
                mensaje: "No se encontró el sobre"
            });
        }

        if (Array.isArray(cartas)) {

            await conexion.query(
                "DELETE FROM sobres_cartas WHERE sobres_id = ?",
                [id]
            );

            for (const carta of cartas) {
                await conexion.query(
                    `INSERT INTO sobres_cartas
                    (sobres_id, cartas_id, probabilidad)
                    VALUES (?, ?, ?)`,
                    [
                        id,
                        carta.id,
                        carta.probabilidad
                    ]
                );
            }
        }

        await conexion.commit();

        res.json({
            mensaje: "Sobre modificado correctamente"
        });

    } catch (error) {
        await conexion.rollback();

        console.error("Error al modificar sobre:", error);

        res.status(500).json({
            mensaje: "Error al modificar el sobre"
        });

    } finally {
        conexion.release();
    }
});


// ==========================================
// ELIMINAR SOBRE (ADMINISTRADOR)
// ==========================================

router.delete("/:id", verificarToken, verificarAdmin, async function (req, res) {

    const { id } = req.params;

    const conexion = await db.getConnection();

    try {
        await conexion.beginTransaction();

        await conexion.query(
            "DELETE FROM sobres_cartas WHERE sobres_id = ?",
            [id]
        );

        const [resultado] = await conexion.query(
            "DELETE FROM sobres WHERE id = ?",
            [id]
        );

        if (resultado.affectedRows === 0) {
            await conexion.rollback();

            return res.status(404).json({
                mensaje: "No se encontró el sobre"
            });
        }

        await conexion.commit();

        res.json({
            mensaje: "Sobre eliminado correctamente"
        });

    } catch (error) {
        await conexion.rollback();

        console.error("Error al eliminar sobre:", error);

        res.status(500).json({
            mensaje: "Error al eliminar el sobre"
        });

    } finally {
        conexion.release();
    }
});


// ==========================================
// COMPRAR SOBRE
// ==========================================

router.post("/comprar/:id", verificarToken, async function (req, res) {

    const { id } = req.params;
    const usuarioId = req.usuario.id;

    const conexion = await db.getConnection();

    try {
        await conexion.beginTransaction();

        const [sobres] = await conexion.query(
            "SELECT id, nombre, precio FROM sobres WHERE id = ?",
            [id]
        );

        if (sobres.length === 0) {
            await conexion.rollback();

            return res.status(404).json({
                mensaje: "El sobre no existe"
            });
        }

        const sobre = sobres[0];

        const [billeteras] = await conexion.query(
            "SELECT * FROM billetera WHERE usuario_id = ? FOR UPDATE",
            [usuarioId]
        );

        if (billeteras.length === 0) {
            await conexion.rollback();

            return res.status(404).json({
                mensaje: "No se encontró la billetera del usuario"
            });
        }

        const saldo = Number(billeteras[0].saldo);

        if (saldo < Number(sobre.precio)) {
            await conexion.rollback();

            return res.status(400).json({
                mensaje: "No tienes monedas suficientes"
            });
        }

        await conexion.query(
            `UPDATE billetera
            SET saldo = saldo - ?
            WHERE usuario_id = ?`,
            [sobre.precio, usuarioId]
        );

        const [sobresUsuario] = await conexion.query(
            `SELECT id, cantidad
            FROM usuario_sobres
            WHERE usuario_id = ? AND sobre_id = ?
            FOR UPDATE`,
            [usuarioId, id]
        );

        if (sobresUsuario.length > 0) {
            await conexion.query(
                `UPDATE usuario_sobres
                SET cantidad = cantidad + 1
                WHERE id = ?`,
                [sobresUsuario[0].id]
            );

        } else {
            await conexion.query(
                `INSERT INTO usuario_sobres
                (usuario_id, sobre_id, cantidad)
                VALUES (?, ?, 1)`,
                [usuarioId, id]
            );
        }

        await conexion.commit();

        res.json({
            mensaje: "Sobre comprado correctamente",
            sobre: sobre.nombre,
            saldo: saldo - Number(sobre.precio)
        });

    } catch (error) {
        await conexion.rollback();

        console.error("Error al comprar sobre:", error);

        res.status(500).json({
            mensaje: "Error al comprar el sobre"
        });

    } finally {
        conexion.release();
    }
});


// ==========================================
// ABRIR SOBRE
// ==========================================

router.post("/abrir/:id", verificarToken, async function (req, res) {

    const { id } = req.params;
    const usuarioId = req.usuario.id;

    const conexion = await db.getConnection();

    try {
        await conexion.beginTransaction();

        const [sobres] = await conexion.query(
            `SELECT id, nombre, cantidad_carta
            FROM sobres
            WHERE id = ?`,
            [id]
        );

        if (sobres.length === 0) {
            await conexion.rollback();

            return res.status(404).json({
                mensaje: "El sobre no existe"
            });
        }

        const sobre = sobres[0];

        const [sobresUsuario] = await conexion.query(
            `SELECT id, cantidad
            FROM usuario_sobres
            WHERE usuario_id = ? AND sobre_id = ?
            FOR UPDATE`,
            [usuarioId, id]
        );

        if (
            sobresUsuario.length === 0 ||
            Number(sobresUsuario[0].cantidad) <= 0
        ) {
            await conexion.rollback();

            return res.status(400).json({
                mensaje: "No tienes este sobre en tu inventario"
            });
        }

        const [cartasDisponibles] = await conexion.query(
            `SELECT
                c.id,
                c.nombre,
                c.descripcion,
                c.imagen,
                c.precio,
                c.ataque,
                c.defensa,
                c.vida,
                c.velocidad,
                c.critico,
                c.categoria_id,
                c.rareza_id,
                cat.nombre AS categoria,
                r.nombre AS rareza,
                sc.probabilidad
            FROM sobres_cartas sc
            INNER JOIN cartas c ON sc.cartas_id = c.id
            LEFT JOIN categoria cat ON c.categoria_id = cat.id
            LEFT JOIN rareza r ON c.rareza_id = r.id
            WHERE sc.sobres_id = ?`,
            [id]
        );

        if (cartasDisponibles.length === 0) {
            await conexion.rollback();

            return res.status(400).json({
                mensaje: "Este sobre no tiene cartas disponibles"
            });
        }

        let sumaProbabilidades = 0;

        for (const carta of cartasDisponibles) {
            const probabilidad = Number(carta.probabilidad);

            if (
                !Number.isFinite(probabilidad) ||
                probabilidad < 0
            ) {
                await conexion.rollback();

                return res.status(400).json({
                    mensaje: "Hay probabilidades inválidas en este sobre"
                });
            }

            sumaProbabilidades += probabilidad;
        }

        if (sumaProbabilidades <= 0) {
            await conexion.rollback();

            return res.status(400).json({
                mensaje: "Este sobre no tiene probabilidades válidas"
            });
        }

        // Seleccionar cartas según sus probabilidades

        const cartasObtenidas = [];
        const cantidadCartas = Number(sobre.cantidad_carta);

        for (let i = 0; i < cantidadCartas; i++) {

            let numeroAleatorio = Math.random() * sumaProbabilidades;
            let cartaElegida = null;

            for (const carta of cartasDisponibles) {

                numeroAleatorio -= Number(carta.probabilidad);

                if (numeroAleatorio < 0) {
                    cartaElegida = carta;
                    break;
                }
            }

            if (!cartaElegida) {
                cartaElegida = cartasDisponibles[cartasDisponibles.length - 1];
            }

            cartasObtenidas.push(cartaElegida);
        }

        // Descontar un sobre

        if (Number(sobresUsuario[0].cantidad) === 1) {

            await conexion.query(
                "DELETE FROM usuario_sobres WHERE id = ?",
                [sobresUsuario[0].id]
            );

        } else {

            await conexion.query(
                `UPDATE usuario_sobres
                SET cantidad = cantidad - 1
                WHERE id = ?`,
                [sobresUsuario[0].id]
            );
        }

        // Guardar las cartas obtenidas

        for (const carta of cartasObtenidas) {

            const [cartasUsuario] = await conexion.query(
                `SELECT id, cantidad
                FROM usuario_cartas
                WHERE usuario_id = ? AND carta_id = ?
                FOR UPDATE`,
                [usuarioId, carta.id]
            );

            if (cartasUsuario.length > 0) {

                await conexion.query(
                    `UPDATE usuario_cartas
                    SET cantidad = cantidad + 1
                    WHERE id = ?`,
                    [cartasUsuario[0].id]
                );

            } else {

                await conexion.query(
                    `INSERT INTO usuario_cartas
                    (usuario_id, carta_id, cantidad)
                    VALUES (?, ?, 1)`,
                    [usuarioId, carta.id]
                );
            }
        }

        await conexion.commit();

        res.json({
            mensaje: "¡Sobre abierto correctamente!",
            sobre: sobre.nombre,
            cartas: cartasObtenidas,
            cantidad: cartasObtenidas.length
        });

    } catch (error) {
        await conexion.rollback();

        console.error("Error al abrir sobre:", error);

        res.status(500).json({
            mensaje: "Error al abrir el sobre"
        });

    } finally {
        conexion.release();
    }
});


// ==========================================
// OBTENER SOBRES DEL INVENTARIO
// ==========================================

router.get("/mis-sobres", verificarToken, async function (req, res) {

    const usuarioId = req.usuario.id;

    try {
        const [sobres] = await db.query(
            `SELECT
                s.id,
                s.nombre,
                s.descripcion,
                s.precio,
                s.cantidad_carta,
                s.categoria_id,
                s.imagen,
                c.nombre AS categoria,
                us.cantidad
            FROM usuario_sobres us
            INNER JOIN sobres s ON us.sobre_id = s.id
            LEFT JOIN categoria c ON s.categoria_id = c.id
            WHERE us.usuario_id = ?
            ORDER BY s.id`,
            [usuarioId]
        );

        res.json(sobres);

    } catch (error) {
        console.error("Error al obtener sobres del usuario:", error);

        res.status(500).json({
            mensaje: "Error al obtener los sobres del inventario"
        });
    }
});


module.exports = router;
