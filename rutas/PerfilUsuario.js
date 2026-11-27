
const router = require('express').Router()

const db = require('../db/conexion')

router.get('/:id', function (req, res, next) {
    const { id } = req.params
    const sql = 'SELECT id, nombre, apellido, mail FROM usuarios WHERE id = ?'

    db.query(sql, [id])

        .then(([result]) => {
            if (result.length === 0) {
                res.status(404).send("No existe ningun usuario")
            } else {
                res.status(200).json({ usuarios: result })
            }

        })
        .catch((error) => {
    console.error("Error al obtener el perfil:", error);
    res.status(500).json({
        mensaje: "Ocurrió un error al obtener el perfil."
    });
});
})

router.put('/:id', function (req, res, next) {
    const { nombre, apellido, mail } = req.body

    const { id } = req.params
    const sql = 'UPDATE usuarios SET nombre = ?, apellido = ?, mail = ? WHERE id = ?'

    db.query(sql, [nombre, apellido, mail, id])
    .then(() => {
        res.status(200).send("se actualizo la informacion")
    })
    .catch((error) => {
    console.error("Error al obtener el perfil:", error);
    res.status(500).json({
        mensaje: "Ocurrió un error al obtener el perfil."
    });
});
})

router.put('/titulo/:id', function (req, res, next) {
    const {titulo} = req.body
    const { id } = req.params

    const sql  = 'UPDATE usuarios SET titulo = ? WHERE id = ?'

    db.query(sql, [titulo, id])
    .then(() => {
        res.status(200).send("se actualizo el titulo")
    })
    .catch((error) => {
    console.error("Error al obtener el perfil:", error);
    res.status(500).json({
        mensaje: "Ocurrió un error al obtener el perfil."
    });
});
})
module.exports = router