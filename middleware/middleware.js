const jwt = require("jsonwebtoken");

function verificarToken(req, res, next) {
  const token = req.headers.authorization;


  if(!token){
    return res.status(401).json({
        mensaje: "no se proporciono un token"
    })
  }

  const  tokenSeparado = token.split(" ")[1];


  try{
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

