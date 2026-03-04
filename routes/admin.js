const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const Admin = require('../models/Admin');
const Rifa = require('../models/Rifa');
const Compra = require('../models/Compra');

// Middleware de Autenticação
const authMiddleware = (req, res, next) => {
    if (req.session && req.session.adminId) return next();
    res.status(401).json({ error: 'Não autorizado' });
};

// Login
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const admin = await Admin.findOne({ username });
    if (admin && await bcrypt.compare(password, admin.password)) {
        req.session.adminId = admin._id;
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
router.get('/stats', authMiddleware, async (req, res) => {
    const totalRifas = await Rifa.countDocuments();
    const comprasAprovadas = await Compra.find({ statusPagamento: 'aprovado' });
    const receitaTotal = comprasAprovadas.reduce((acc, curr) => acc + curr.valorTotal, 0);
    res.json({ totalRifas, receitaTotal });
});

// Criar Rifa
router.post('/rifas', authMiddleware, async (req, res) => {
    try {
        const novaRifa = new Rifa(req.body);
        await novaRifa.save();
        res.json({ success: true, rifa: novaRifa });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao criar rifa' });
    }
});

// Sortear Rifa
router.post('/rifas/:id/sortear', authMiddleware, async (req, res) => {
    try {
        const rifa = await Rifa.findById(req.params.id);
        if (!rifa) return res.status(404).json({ error: 'Rifa não encontrada' });

        const compras = await Compra.find({ rifaId: rifa._id, statusPagamento: 'aprovado' });
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
        rifa.dataSorteio = new Date();
        
        await rifa.save();
        res.json({ success: true, rifa });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao sortear' });
    }
});

// Aprovar Pagamento Manualmente (Simulação)
router.post('/compras/:id/aprovar', authMiddleware, async (req, res) => {
    try {
        await Compra.findByIdAndUpdate(req.params.id, { statusPagamento: 'aprovado' });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao aprovar' });
    }
});

module.exports = router;
