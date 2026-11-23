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

// Registrar usuario
router.post("/registro", async function (req, res) {
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

        // Registrar siempre como Jugador
        await conexion.query(
            `INSERT INTO usuarios
            (nombre, apellido, rol_id, mail, pass)
            VALUES (?, ?, ?, ?, ?)`,
            [nombre, apellido, 2, mail, contraseñaEncriptada]
        );

        res.status(201).json({
            mensaje: "Usuario registrado correctamente"
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            mensaje: "Error al registrar el usuario"
        });
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


// Crear usuario desde el panel de administración
router.post("/usuarios", verificarToken, verificarAdmin, async function (req, res) {
    try {
        const { nombre, apellido, mail, pass, rol_id } = req.body;

        // Validar campos obligatorios
        if (!nombre || !apellido || !mail || !pass || !rol_id) {
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
                mensaje: "Los datos personales y la contraseña deben ser texto"
            });
        }

        // Comprobar formato básico del correo
        if (!mail.includes("@") || !mail.includes(".")) {
            return res.status(400).json({
                mensaje: "El correo electrónico no es válido"
            });
        }

        // Comprobar que el rol sea un número válido
        const rolId = Number(rol_id);

        if (!Number.isInteger(rolId) || rolId <= 0) {
            return res.status(400).json({
                mensaje: "El rol seleccionado no es válido"
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

        // Comprobar que el rol exista
        const [roles] = await conexion.query(
            "SELECT id FROM rol WHERE id = ?",
            [rolId]
        );

        if (roles.length === 0) {
            return res.status(400).json({
                mensaje: "El rol seleccionado no existe"
            });
        }

        // Encriptar contraseña
        const contraseñaEncriptada = await bcrypt.hash(pass, 10);

        // Insertar usuario en MySQL
        await conexion.query(
            `INSERT INTO usuarios
            (nombre, apellido, rol_id, mail, pass)
            VALUES (?, ?, ?, ?, ?)`,
            [nombre, apellido, rolId, mail, contraseñaEncriptada]
        );

        res.status(201).json({
            mensaje: "Usuario creado correctamente"
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            mensaje: "Error al crear el usuario"
        });
    }
});



// Obtener los roles disponibles
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


// Obtener todos los usuarios
router.get("/usuarios", verificarToken, verificarAdmin, async function (req, res) {
    try {
        const [usuarios] = await conexion.query(
            `SELECT
                usuarios.id,
                usuarios.nombre,
                usuarios.apellido,
                usuarios.mail,
                usuarios.rol_id,
                rol.rol
            FROM usuarios
            INNER JOIN rol ON usuarios.rol_id = rol.id`
        );

        res.json(usuarios);

    } catch (error) {
        console.error(error);

        res.status(500).json({
            mensaje: "Error al obtener los usuarios"
        });
    }
});


module.exports = router;
