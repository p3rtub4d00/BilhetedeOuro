const express = require('express');
const router = express.Router();

const generateId = () => Math.random().toString(36).substr(2, 9);

const authMiddleware = (req, res, next) => {
    if (req.session && req.session.isAdmin) return next();
    res.status(401).json({ error: 'Não autorizado' });
};

router.post('/login', (req, res) => {
    const { username, password } = req.body;
    if (username === 'admin' && password === 'admin123') {
        req.session.isAdmin = true;
        res.json({ success: true });
    } else {
        res.status(401).json({ error: 'Credenciais inválidas' });
    }
});

router.post('/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

router.get('/stats', authMiddleware, (req, res) => {
    const db = req.app.locals.db;
    const totalRifas = db.rifas.length;
    const comprasAprovadas = db.compras.filter(c => c.statusPagamento === 'aprovado');
    const receitaTotal = comprasAprovadas.reduce((acc, curr) => acc + curr.valorTotal, 0);
    res.json({ totalRifas, receitaTotal });
});

router.post('/rifas', authMiddleware, (req, res) => {
    const db = req.app.locals.db;
    const novaRifa = {
        _id: generateId(),
        ...req.body,
        status: 'ativa',
        numeroSorteado: null,
        resultadoLoteria: null,
        vencedorInfo: null,
        criadoEm: new Date().getTime()
    };
    db.rifas.push(novaRifa);
    res.json({ success: true, rifa: novaRifa });
});

// Sortear Rifa via Loteria Federal
router.post('/rifas/:id/sortear', authMiddleware, (req, res) => {
    const db = req.app.locals.db;
    const { p1, p2 } = req.body; // Prêmios 1 e 2 informados pelo admin

    if(!p1 || !p2 || p1.length < 3 || p2.length < 1) {
        return res.status(400).json({ error: 'Informe os prêmios da Loteria Federal corretamente.'});
    }

    const rifa = db.rifas.find(r => r._id === req.params.id);
    if (!rifa) return res.status(404).json({ error: 'Rifa não encontrada' });

    // Lógica: 3 últimos do 1º Prêmio + Último do 2º Prêmio
    const tresUltimosP1 = p1.toString().slice(-3);
    const ultimoP2 = p2.toString().slice(-1);
    const numeroSorteado = tresUltimosP1 + ultimoP2; // String de 4 dígitos

    const compras = db.compras.filter(c => c.rifaId === rifa._id && c.statusPagamento === 'aprovado');
    
    // Busca se alguém tem esse número
    let vencedorEncontrado = null;
    compras.forEach(compra => {
        if(compra.numeros.includes(numeroSorteado)) {
            vencedorEncontrado = compra;
        }
    });

    rifa.status = 'sorteada';
    rifa.numeroSorteado = numeroSorteado;
    rifa.resultadoLoteria = `1º Prêmio: ${p1} | 2º Prêmio: ${p2}`;
    
    if(vencedorEncontrado) {
        rifa.vencedorInfo = `${vencedorEncontrado.nome} (Tel: ${vencedorEncontrado.telefone.substring(0, 6)}****)`;
    } else {
        rifa.vencedorInfo = "ACUMULOU - Ninguém comprou este bilhete.";
    }
    
    rifa.dataSorteio = new Date().getTime();
    
    res.json({ success: true, rifa, ganhadorEncontrado: !!vencedorEncontrado });
});

module.exports = router;
