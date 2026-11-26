const router = require('express').Router()
const db = require('../db/conexion')

const probabilidades = {
    comun: 70,
    rara: 25,
    legendaria: 5
}

function sortearRareza() {
    const total = probabilidades.comun + probabilidades.rara + probabilidades.legendaria

    if (total !== 100) {
        throw new Error("Las probabilidades deben sumar 100.")
    }

    const numero = Math.floor(Math.random() * 100 + 1)

    if (numero <= probabilidades.comun) {
        return "comun"
    }
    else if (numero <= probabilidades.comun + probabilidades.rara) {
        return "rara"
    }
    else {
        return "legendaria"
    }
}

function obtenerIdRareza(rareza) {
    if (rareza === "comun") {
        return 1;
    }
    else if (rareza === "rara") {
        return 2;
    }
    else {
        return 3;
    }
}

async function buscarCartas(sobreId, categoriaId, rarezaId) {
    const sql = `SELECT c.* FROM cartas c INNER JOIN sobres_cartas sc ON sc.cartas_id = c.id WHERE sc.sobres_id = ? AND c.categoria_id = ? AND c.rareza_id = ? ORDER BY RAND() LIMIT 1`
    const [resultado] = await db.query(sql, [sobreId, categoriaId, rarezaId]);
    if (resultado.length === 0) {
        return null
    }
    else {
        return resultado[0]
    }

}

async function abrirSobre(sobreId) {
    const sql = 'SELECT * FROM sobres WHERE id = ?'
    const [resultado] = await db.query(sql, [sobreId]);
    if (resultado.length === 0) {
        return null
    }
    else {
        const sobre = resultado[0];

        const cartasObtenidas = []

        const sqlCartas = `SELECT * FROM sobres_cartas WHERE sobres_id = ?`
        const [cartasAsignadas] = await db.query(sqlCartas, [sobreId]);

        if (cartasAsignadas.length === 0) {
            return null
        }

        const sql = `SELECT c.* FROM cartas c INNER JOIN sobres_cartas sc ON sc.cartas_id = c.id WHERE sc.sobres_id = ? AND c.categoria_id = ?`
        const [cartasValidas] = await db.query(sql, [sobreId, sobre.categoria_id])

        if (cartasValidas.length === 0) {
            return null
        }

        const sqlRarezas = `SELECT DISTINCT c.rareza_id FROM cartas c INNER JOIN sobres_cartas sc ON sc.cartas_id = c.id WHERE sc.sobres_id = ? AND c.categoria_id = ?`

        const [rarezasDisponibles] = await db.query(sqlRarezas, [sobreId, sobre.categoria_id])

        const idsNecesarios = [1, 2, 3]

        for (const id of idsNecesarios) {
            const existe = rarezasDisponibles.some(r => Number(r.rareza_id) === id)

            if (!existe) {
                const nombres = {
                    1: "común",
                    2: "rara",
                    3: "legendaria"
                }

                return {
                    error: `No hay cartas de rareza ${nombres[id]} disponibles en este sobre.`
                }
            }
        }

        while (cartasObtenidas.length < 5) {
            const rareza = sortearRareza()
            const rarezaId = obtenerIdRareza(rareza)
            const carta = await buscarCartas(sobreId, sobre.categoria_id, rarezaId)
            if (carta != null) {
                cartasObtenidas.push(carta)
            }
        }
        return { cartasObtenidas, sobre }
    }

}

router.post('/abrir/:id', async (req, res, next) => {

    try {
        const sobreId = req.params.id
        const resultado = await abrirSobre(sobreId)

        if (resultado === null) {
            return res.status(404).json({
                error: "El sobre no existe o no tiene cartas disponibles."
            })
        }

        if (resultado.error) {
            return res.status(400).json(resultado)
        }

        res.json(resultado)
    }
    catch (error) {
        res.status(500).send("ocurrio un error")
        console.error(error)
    }
})

module.exports = router