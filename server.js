require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const session = require('express-session');
const path = require('path');
const cors = require('cors');

const apiRoutes = require('./routes/api');
const adminRoutes = require('./routes/admin');
const Admin = require('./models/Admin');
const bcrypt = require('bcrypt');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
    secret: process.env.SESSION_SECRET || 'secret_dev',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 1000 * 60 * 60 * 24 } // 1 dia
}));

// Conexão MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/bilhete_ouro')
    .then(async () => {
        console.log('✅ MongoDB Conectado');
        // Criar admin padrão se não existir
        const adminExists = await Admin.findOne({ username: 'admin' });
        if (!adminExists) {
            const hashedPassword = await bcrypt.hash('admin123', 10);
            await Admin.create({ username: 'admin', password: hashedPassword });
            console.log('✅ Admin padrão criado (admin / admin123)');
        }
    })
    .catch(err => console.error('❌ Erro no MongoDB:', err));

// Disponibilizar io para as rotas
app.set('io', io);

// Rotas
app.use('/api', apiRoutes);
app.use('/admin-api', adminRoutes);

// Socket.IO para atualizações em tempo real
io.on('connection', (socket) => {
    socket.on('joinRifa', (rifaId) => {
        socket.join(`rifa_${rifaId}`);
    });

    socket.on('selecionarNumero', (data) => {
        // Broadcast para outros usuários na mesma rifa que o número está sendo analisado
        socket.to(`rifa_${data.rifaId}`).emit('numeroEmAnalise', data.numero);
    });
});

server.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
