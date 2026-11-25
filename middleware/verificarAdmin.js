// Middleware para comprobar si el usuario es administrador
function verificarAdmin(req, res, next) {

    // Comprobar si el usuario tiene rol de administrador
    if (req.usuario.rol_id !== 1) {
        return res.status(403).json({
            mensaje: "No tenés permisos de administrador"
        });
    }

    // Si es administrador, permitir continuar
    next();
}

module.exports = verificarAdmin;
