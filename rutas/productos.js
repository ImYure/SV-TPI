
const router = require('express').Router();

const conexion = require('../db/conexion');
const verificarToken = require('../middleware/middleware');


// Obtener todos los paquetes de monedas
router.get('/', async function (req, res) {
    try {
        const [productos] = await conexion.query(
            `SELECT id, nombre, precio_unitario, cantidad_monedas
            FROM producto
            WHERE tipo = 1`
        );

        res.json(productos);

    } catch (error) {
        console.error(error);
        res.status(500).json({
            mensaje: 'Error al obtener los paquetes de monedas'
        });
    }
});


// Obtener el saldo de monedas del usuario
router.get('/saldo', verificarToken, async function (req, res) {

    try {

        const [billeteras] = await conexion.query(
            `SELECT saldo
            FROM billetera
            WHERE usuario_id = ?`,
            [req.usuario.id]
        );

        if (billeteras.length === 0) {
            return res.status(404).json({
                mensaje: 'No se encontró la billetera del usuario'
            });
        }

        res.json({
            saldo: billeteras[0].saldo
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            mensaje: 'Error al obtener el saldo'
        });

    }

});


// Realizar una compra simulada de monedas
router.post('/comprar', verificarToken, async function (req, res) {

    const { producto_id, codigo_simulacion } = req.body;

    // Validar los datos recibidos
    if (!Number.isInteger(Number(producto_id)) || Number(producto_id) <= 0) {
        return res.status(400).json({
            mensaje: 'El ID del paquete no es válido'
        });
    }

    if (
        codigo_simulacion !== 'VOL-APROBADO' &&
        codigo_simulacion !== 'VOL-RECHAZADO'
    ) {
        return res.status(400).json({
            mensaje: 'Código de simulación inválido'
        });
    }

    let conexionTransaccion;

    try {

        conexionTransaccion = await conexion.getConnection();

        await conexionTransaccion.beginTransaction();

        // Buscar el paquete seleccionado
        const [productos] = await conexionTransaccion.query(
            `SELECT id, precio_unitario, cantidad_monedas
            FROM producto
            WHERE id = ? AND tipo = 1`,
            [producto_id]
        );

        if (productos.length === 0) {
            await conexionTransaccion.rollback();

            return res.status(404).json({
                mensaje: 'El paquete de monedas no existe'
            });
        }

        const producto = productos[0];

        // Verificar que el usuario tenga una billetera
        const [billeteras] = await conexionTransaccion.query(
            `SELECT id
            FROM billetera
            WHERE usuario_id = ?`,
            [req.usuario.id]
        );

        if (billeteras.length === 0) {
            await conexionTransaccion.rollback();

            return res.status(404).json({
                mensaje: 'No se encontró la billetera del usuario'
            });
        }

        // Registrar la compra
        const [compra] = await conexionTransaccion.query(
            `INSERT INTO compra
            (usuario_id, monto_total, estado_pago)
            VALUES (?, ?, 'pendiente')`,
            [req.usuario.id, producto.precio_unitario]
        );

        // Registrar el detalle de la compra
        await conexionTransaccion.query(
            `INSERT INTO detalle_compra
            (compra_id, producto_id, cantidad, precio_unitario)
            VALUES (?, ?, 1, ?)`,
            [compra.insertId, producto.id, producto.precio_unitario]
        );

        // Simular el resultado del pago
        let estadoPago;

        if (codigo_simulacion === 'VOL-APROBADO') {
            estadoPago = 'aprobado';
        } else {
            estadoPago = 'rechazado';
        }

        // Actualizar el estado de la compra
        await conexionTransaccion.query(
            `UPDATE compra
            SET estado_pago = ?
            WHERE id = ?`,
            [estadoPago, compra.insertId]
        );

        // Acreditar monedas solamente si la compra fue aprobada
        if (estadoPago === 'aprobado') {

            const [acreditacion] = await conexionTransaccion.query(
                `UPDATE billetera
                SET saldo = saldo + ?
                WHERE usuario_id = ?`,
                [producto.cantidad_monedas, req.usuario.id]
            );

            if (acreditacion.affectedRows === 0) {
                throw new Error('No se pudieron acreditar las monedas');
            }

        }

        await conexionTransaccion.commit();

        res.json({
            mensaje: estadoPago === 'aprobado'
                ? 'Compra simulada aprobada'
                : 'Compra simulada rechazada',
            estado: estadoPago,
            monedas: estadoPago === 'aprobado'
                ? producto.cantidad_monedas
                : 0
        });

    } catch (error) {

        if (conexionTransaccion) {
            await conexionTransaccion.rollback();
        }

        console.error(error);

        res.status(500).json({
            mensaje: 'Error al procesar la compra simulada'
        });

    } finally {

        if (conexionTransaccion) {
            conexionTransaccion.release();
        }

    }

});


module.exports = router;
