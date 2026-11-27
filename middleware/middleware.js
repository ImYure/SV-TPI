const jwt = require("jsonwebtoken");

function verificarToken(req, res, next) {
    const token = req.headers.authorization;

    if (!token) {
        return res.status(401).json({
            mensaje: "No se proporcionó un token"
        });
    }

    const partesToken = token.split(" ");

    if (partesToken.length !== 2 || partesToken[0] !== "Bearer" || !partesToken[1]) {
        return res.status(401).json({
            mensaje: "Formato de token incorrecto"
        });
    }

    const tokenSeparado = partesToken[1];

    try {
        const usuario = jwt.verify(tokenSeparado, process.env.TOKEN_SECRET);
        req.usuario = usuario;
        next();
    } catch (error) {
        return res.status(401).json({
            mensaje: "Token inválido o expirado"
        });
    }
}

module.exports = verificarToken;