const express = require("express");
const router = express.Router();
const conexion = require("../db/conexion");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const verificarToken = require("../middleware/middleware");
const verificarAdmin = require("../middleware/verificarAdmin");

// Probar rutas
router.get("/test", function (req, res) {
    res.send("Las rutas funcionan correctamente");
});

// Probar conexión con MySQL
router.get("/db-test", async function (req, res) {
    try {
        const [resultado] = await conexion.query("SELECT 1 AS prueba");

        res.json({
            mensaje: "Conexión con MySQL exitosa",
            resultado: resultado
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            mensaje: "Error al conectar con MySQL"
        });
    }
});

// Ruta protegida para comprobar si el usuario está autenticado
router.get("/perfil", verificarToken, function (req, res) {
    res.json({
        mensaje: "Acceso autorizado",
        usuario: req.usuario
    });
});


// Ruta exclusiva para administradores
router.get("/admin", verificarToken, verificarAdmin, function (req, res) {

    res.json({
        mensaje: "Bienvenido al panel de administración",
        usuario: req.usuario
    });

});

// Obtener todos los roles
router.get("/roles", verificarToken, verificarAdmin, async function (req, res) {
    try {
        const [roles] = await conexion.query(
            "SELECT id, rol FROM rol"
        );

        res.json(roles);

    } catch (error) {
        console.error(error);

        res.status(500).json({
            mensaje: "Error al obtener los roles"
        });
    }
});



//registrar usuario
router.post("/registro", async function (req, res) {
    let conexionTransaccion;
    let transaccionIniciada = false;

    try {
        const { nombre, apellido, mail, pass } = req.body;

        // Validar campos obligatorios
        if (!nombre || !apellido || !mail || !pass) {
            return res.status(400).json({
                mensaje: "Todos los campos son obligatorios"
            });
        }

        // Comprobar que los datos sean texto
        if (
            typeof nombre !== "string" ||
            typeof apellido !== "string" ||
            typeof mail !== "string" ||
            typeof pass !== "string"
        ) {
            return res.status(400).json({
                mensaje: "Los datos deben ser texto"
            });
        }

        // Comprobar formato básico del correo
        if (!mail.includes("@") || !mail.includes(".")) {
            return res.status(400).json({
                mensaje: "El correo electrónico no es válido"
            });
        }

        // Comprobar si el correo ya existe
        const [usuarios] = await conexion.query(
            "SELECT id FROM usuarios WHERE mail = ?",
            [mail]
        );

        if (usuarios.length > 0) {
            return res.status(409).json({
                mensaje: "Ese correo ya está registrado"
            });
        }

        // Encriptar contraseña
        const contraseñaEncriptada = await bcrypt.hash(pass, 10);

        // Obtener conexión e iniciar transacción
        conexionTransaccion = await conexion.getConnection();

        await conexionTransaccion.beginTransaction();
        transaccionIniciada = true;

        // Registrar siempre como Jugador
        const [resultado] = await conexionTransaccion.query(
            `INSERT INTO usuarios
            (nombre, apellido, rol_id, mail, pass)
            VALUES (?, ?, ?, ?, ?)`,
            [nombre, apellido, 2, mail, contraseñaEncriptada]
        );

                // Crear la billetera del usuario
            const usuarioId = resultado.insertId;

            await conexionTransaccion.query(
                `INSERT INTO billetera (usuario_id, saldo)
                VALUES (?, 0)`,
                [usuarioId]
            );


        // Confirmar ambas operaciones
        await conexionTransaccion.commit();
        transaccionIniciada = false;

        res.status(201).json({
            mensaje: "Usuario registrado correctamente"
        });

    } catch (error) {
        // Deshacer cambios si ocurre un error
        if (transaccionIniciada) {
            await conexionTransaccion.rollback();
        }

        console.error(error);

        res.status(500).json({
            mensaje: "Error al registrar el usuario"
        });

    } finally {
        // Liberar conexión
        if (conexionTransaccion) {
            conexionTransaccion.release();
        }
    }
});



// Iniciar sesión
router.post("/login", async function (req, res) {

    try {
        const { mail, pass } = req.body;

        // Validar campos obligatorios
        if (!mail || !pass) {
            return res.status(400).json({
                mensaje: "El correo y la contraseña son obligatorios"
            });
        }

        // Comprobar que sean texto
        if (typeof mail !== "string") {
            return res.status(400).json({
                mensaje: "El correo debe ser texto"
            });
        }

        if (typeof pass !== "string") {
            return res.status(400).json({
                mensaje: "La contraseña debe ser texto"
            });
        }

        // Comprobar formato básico del correo
        if (!mail.includes("@") || !mail.includes(".")) {
            return res.status(400).json({
                mensaje: "El correo electrónico no es válido"
            });
        }

        // Buscar usuario por correo
        const [usuarios] = await conexion.query(
            "SELECT * FROM usuarios WHERE mail = ?",
            [mail]
        );

        if (usuarios.length === 0) {
            return res.status(401).json({
                mensaje: "Correo o contraseña incorrectos"
            });
        }

        const usuario = usuarios[0];

        // Comparar contraseña con bcrypt
        const contraseñaCorrecta = await bcrypt.compare(
            pass,
            usuario.pass
        );

        if (!contraseñaCorrecta) {
            return res.status(401).json({
                mensaje: "Correo o contraseña incorrectos"
            });
        }

        // Crear token JWT
        const token = jwt.sign(
            {
                id: usuario.id,
                rol_id: usuario.rol_id
            },
            process.env.TOKEN_SECRET,
            {
                expiresIn: "2h"
            }
        );

        // Login exitoso
        res.json({
            mensaje: "Inicio de sesión exitoso",
            token: token,
            usuario: {
                id: usuario.id,
                nombre: usuario.nombre,
                apellido: usuario.apellido,
                mail: usuario.mail,
                rol_id: usuario.rol_id
            }
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            mensaje: "Error al iniciar sesión"
        });
    }
});


// Obtener todos los usuarios
router.get("/usuarios", verificarToken, verificarAdmin, async function (req, res) {
    try {
        const [usuarios] = await conexion.query(
            `SELECT id, nombre, apellido, mail, rol_id
             FROM usuarios
             ORDER BY id DESC`
        );

        res.json(usuarios);

    } catch (error) {
        console.error(error);

        res.status(500).json({
            mensaje: "Error al obtener los usuarios"
        });
    }
});


// Crear un usuario desde el panel administrador
router.post("/usuarios", verificarToken, verificarAdmin, async function (req, res) {

    let conexionTransaccion;
    let transaccionIniciada = false;

    try {
        const { nombre, apellido, mail, pass, rol_id } = req.body;

        if (!nombre || !apellido || !mail || !pass || ![1, 2].includes(Number(rol_id))) {
            return res.status(400).json({
                mensaje: "Completá todos los campos correctamente"
            });
        }

        if (
            typeof nombre !== "string" ||
            typeof apellido !== "string" ||
            typeof mail !== "string" ||
            typeof pass !== "string"
        ) {
            return res.status(400).json({
                mensaje: "Los datos deben ser texto"
            });
        }

        if (!mail.includes("@") || !mail.includes(".")) {
            return res.status(400).json({
                mensaje: "El correo electrónico no es válido"
            });
        }

        const [existentes] = await conexion.query(
            "SELECT id FROM usuarios WHERE mail = ?",
            [mail]
        );

        if (existentes.length > 0) {
            return res.status(409).json({
                mensaje: "Ese correo ya está registrado"
            });
        }

        const contraseñaEncriptada = await bcrypt.hash(pass, 10);

        conexionTransaccion = await conexion.getConnection();

        await conexionTransaccion.beginTransaction();
        transaccionIniciada = true;

        const [resultado] = await conexionTransaccion.query (
            `INSERT INTO usuarios
            (nombre, apellido, rol_id, mail, pass)
            VALUES (?, ?, ?, ?, ?)`,
            [nombre, apellido, Number(rol_id), mail, contraseñaEncriptada]
        );

        //crea la billetera
        const usuarioId = resultado.insertId;

        await  conexionTransaccion.query(
        `INSERT INTO billetera (usuario_id, saldo)
        values(?,0)`,
        [usuarioId]
        );


        //confirmamos la billetera del usuario
        await conexionTransaccion.commit();
        transaccionIniciada = false;

        res.status(201).json({
            mensaje: "Usuario creado correctamente"
        });

    } catch (error) {
        if(transaccionIniciada){
            await conexionTransaccion.rollback();
        }

        console.error(error);

        res.status(500).json({
            mensaje: "Error al crear el usuario"
        });
    }finally{
        if(conexionTransaccion){
            conexionTransaccion.release();
        }
    }
});


// Editar un usuario
router.put("/usuarios/:id", verificarToken, verificarAdmin, async function (req, res) {
    try {
        const id = Number(req.params.id);
        const { nombre, apellido, mail, pass, rol_id } = req.body;

        if (
            !Number.isInteger(id) ||
            id <= 0 ||
            !nombre ||
            !apellido ||
            !mail ||
            ![1, 2].includes(Number(rol_id))
        ) {
            return res.status(400).json({
                mensaje: "Los datos enviados no son válidos"
            });
        }

        if (
            typeof nombre !== "string" ||
            typeof apellido !== "string" ||
            typeof mail !== "string" ||
            (pass !== undefined && typeof pass !== "string")
        ) {
            return res.status(400).json({
                mensaje: "Los datos deben ser texto"
            });
        }

        if (!mail.includes("@") || !mail.includes(".")) {
            return res.status(400).json({
                mensaje: "El correo electrónico no es válido"
            });
        }

        // Comprobar que el usuario exista
        const [usuarios] = await conexion.query(
            "SELECT id FROM usuarios WHERE id = ?",
            [id]
        );

        if (usuarios.length === 0) {
            return res.status(404).json({
                mensaje: "El usuario no existe"
            });
        }

        // Comprobar que el correo no pertenezca a otra cuenta
        const [correos] = await conexion.query(
            "SELECT id FROM usuarios WHERE mail = ? AND id != ?",
            [mail, id]
        );

        if (correos.length > 0) {
            return res.status(409).json({
                mensaje: "Ese correo ya pertenece a otro usuario"
            });
        }

        // Evitar que el administrador se quite su propio permiso
        if (
            id === Number(req.usuario.id) &&
            Number(rol_id) !== 1
        ) {
            return res.status(400).json({
                mensaje: "No podés quitarte tu propio rol de administrador"
            });
        }

        // Si se escribió una contraseña nueva, también se actualiza
        if (pass && pass.trim() !== "") {
            const contraseñaEncriptada = await bcrypt.hash(pass, 10);

            await conexion.query(
                `UPDATE usuarios
                 SET nombre = ?, apellido = ?, mail = ?, rol_id = ?, pass = ?
                 WHERE id = ?`,
                [nombre, apellido, mail, Number(rol_id), contraseñaEncriptada, id]
            );

        } else {
            await conexion.query(
                `UPDATE usuarios
                 SET nombre = ?, apellido = ?, mail = ?, rol_id = ?
                 WHERE id = ?`,
                [nombre, apellido, mail, Number(rol_id), id]
            );
        }

        res.json({
            mensaje: "Usuario actualizado correctamente"
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            mensaje: "Error al actualizar el usuario"
        });
    }
});


// Eliminar un usuario
router.delete("/usuarios/:id", verificarToken, verificarAdmin, async function (req, res) {
    try {
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({
                mensaje: "ID no válido"
            });
        }

        // Evitar que el administrador elimine su propia cuenta
        if (id === Number(req.usuario.id)) {
            return res.status(400).json({
                mensaje: "No podés eliminar tu propia cuenta"
            });
        }

        const [usuarios] = await conexion.query(
            "SELECT id FROM usuarios WHERE id = ?",
            [id]
        );

        if (usuarios.length === 0) {
            return res.status(404).json({
                mensaje: "El usuario no existe"
            });
        }

        await conexion.query(
            "DELETE FROM usuarios WHERE id = ?",
            [id]
        );

        res.json({
            mensaje: "Usuario eliminado correctamente"
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            mensaje: "Error al eliminar el usuario"
        });
    }
});

module.exports = router;
