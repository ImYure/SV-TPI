const { DB_HOST, DB_NAME, DB_USER, DB_PASSWORD } = process.env;
const mysql = require('mysql2/promise')

const db = mysql.createPool({
    host: DB_HOST,
    database: DB_NAME,
    user: DB_USER,
    password: DB_PASSWORD,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
})

module.exports = db