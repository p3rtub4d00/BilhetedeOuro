const express = require('express');
const router = express.Router();

const generateId = () => Math.random().toString(36).substr(2, 9);

// Middleware de Autenticação
const authMiddleware = (req, res, next) => {
    if (req.session && req.session.isAdmin) return next();
    res.status(401).json({ error: 'Não autorizado' });
};

// Login (Mockado para admin / admin123)
router.post('/login', (req, res) => {
    const { username, password } = req.body;
    if (username === 'admin' && password === 'admin123') {
        req.session.isAdmin = true;
        res.json({ success: true });
    } else {
        res.status(401).json({ error: 'Credenciais inválidas' });
    }
});

// Logout
router.post('/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

// Dashboard Stats
router.get('/stats', authMiddleware, (req, res) => {
    const db = req.app.locals.db;
    const totalRifas = db.rifas.length;
    const comprasAprovadas = db.compras.filter(c => c.statusPagamento === 'aprovado');
    const receitaTotal = comprasAprovadas.reduce((acc, curr) => acc + curr.valorTotal, 0);
    res.json({ totalRifas, receitaTotal });
});

// Criar Rifa
router.post('/rifas', authMiddleware, (req, res) => {
    const db = req.app.locals.db;
    const novaRifa = {
        _id: generateId(),
        ...req.body,
        status: 'ativa',
        numeroSorteado: null,
        vencedorInfo: null,
        criadoEm: new Date().getTime()
    };
    db.rifas.push(novaRifa);
    res.json({ success: true, rifa: novaRifa });
});

// Sortear Rifa
router.post('/rifas/:id/sortear', authMiddleware, (req, res) => {
    const db = req.app.locals.db;
    const rifa = db.rifas.find(r => r._id === req.params.id);
    if (!rifa) return res.status(404).json({ error: 'Rifa não encontrada' });

    const compras = db.compras.filter(c => c.rifaId === rifa._id && c.statusPagamento === 'aprovado');
    let numerosComprados = [];
    let mapaCompradores = {};

    compras.forEach(c => {
        c.numeros.forEach(n => {
            numerosComprados.push(n);
            mapaCompradores[n] = c;
        });
    });

    if (numerosComprados.length === 0) return res.status(400).json({ error: 'Nenhum número pago nesta rifa.' });

    const indexSorteado = Math.floor(Math.random() * numerosComprados.length);
    const numeroSorteado = numerosComprados[indexSorteado];
    const vencedor = mapaCompradores[numeroSorteado];

    rifa.status = 'sorteada';
    rifa.numeroSorteado = numeroSorteado;
    rifa.vencedorInfo = `${vencedor.nome} (Tel: ${vencedor.telefone.substring(0, 6)}****)`;
    rifa.dataSorteio = new Date().getTime();
    
    res.json({ success: true, rifa });
});

module.exports = router;
