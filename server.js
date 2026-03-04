const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const session = require('express-session');
const path = require('path');
const cors = require('cors');

const apiRoutes = require('./routes/api');
const adminRoutes = require('./routes/admin');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const PORT = process.env.PORT || 3000;
const LIMPEZA_TTL_INTERVAL_MS = 60 * 1000;

// BANCO DE DADOS EM MEMÓRIA (Para testes)
const db = {
    rifas: [],
    compras: [],
    auditLogs: [],
    otpByPhone: new Map(),
    tokensConsulta: new Map()
};
app.locals.db = db; // Disponibiliza o db para as rotas

// Middlewares
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
    secret: 'chave_secreta_teste',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 1000 * 60 * 60 * 24 } // 1 dia
}));

// Disponibilizar io para as rotas
app.set('io', io);

// Limpeza periódica de OTP/token expirados (higiene de memória)
setInterval(() => {
    const agora = Date.now();

    for (const [telefone, otp] of db.otpByPhone.entries()) {
        if (!otp || agora > otp.expiraEm) db.otpByPhone.delete(telefone);
    }

    for (const [token, sessao] of db.tokensConsulta.entries()) {
        if (!sessao || agora > sessao.expiraEm) db.tokensConsulta.delete(token);
    }
}, LIMPEZA_TTL_INTERVAL_MS);

// Rotas
app.use('/api', apiRoutes);
app.use('/admin-api', adminRoutes);

// Socket.IO para atualizações em tempo real
io.on('connection', (socket) => {
    socket.on('joinRifa', (rifaId) => {
        socket.join(`rifa_${rifaId}`);
    });
});

server.listen(PORT, () => {
    console.log(`🚀 Servidor de Testes rodando na porta ${PORT}`);
    console.log(`🔑 Admin: admin / admin123`);
});
