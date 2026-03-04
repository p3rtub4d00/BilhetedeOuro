const express = require('express');
const router = express.Router();

// Função auxiliar para gerar IDs únicos aleatórios
const generateId = () => Math.random().toString(36).substr(2, 9);

// Listar Rifas Ativas
router.get('/rifas', (req, res) => {
    const db = req.app.locals.db;
    const rifas = db.rifas
        .filter(r => ['ativa', 'encerrada', 'sorteada'].includes(r.status))
        .sort((a, b) => b.criadoEm - a.criadoEm);
    res.json(rifas);
});

// Detalhes da Rifa e Números Vendidos
router.get('/rifas/:id', (req, res) => {
    const db = req.app.locals.db;
    const rifa = db.rifas.find(r => r._id === req.params.id);
    
    if (!rifa) return res.status(404).json({ error: 'Rifa não encontrada' });

    const compras = db.compras.filter(c => c.rifaId === rifa._id && ['aprovado', 'pendente'].includes(c.statusPagamento));
    let numerosOcupados = [];
    compras.forEach(compra => {
        numerosOcupados = numerosOcupados.concat(compra.numeros);
    });

    res.json({ rifa, numerosOcupados });
});

// Comprar Números
router.post('/comprar', (req, res) => {
    const db = req.app.locals.db;
    const { rifaId, telefone, nome, numeros } = req.body;
    
    const rifa = db.rifas.find(r => r._id === rifaId);
    if (!rifa || rifa.status !== 'ativa') return res.status(400).json({ error: 'Rifa indisponível' });

    // Verificar duplicidade
    const comprasExistentes = db.compras.filter(c => c.rifaId === rifaId && ['aprovado', 'pendente'].includes(c.statusPagamento));
    const numerosComprados = comprasExistentes.flatMap(c => c.numeros);
    const duplicados = numeros.filter(n => numerosComprados.includes(n));
    
    if (duplicados.length > 0) {
        return res.status(400).json({ error: 'Alguns números já foram comprados', duplicados });
    }

    const valorTotal = numeros.length * rifa.valorNumero;
    const novaCompra = {
        _id: generateId(),
        rifaId,
        telefone,
        nome,
        numeros,
        valorTotal,
        statusPagamento: 'aprovado', // Já aprova direto para facilitar o teste local
        criadoEm: new Date().getTime()
    };
    
    db.compras.push(novaCompra);

    // Emitir socket
    const io = req.app.get('io');
    io.to(`rifa_${rifaId}`).emit('numerosComprados', numeros);

    res.json({ success: true, compraId: novaCompra._id, mensagem: 'Compra aprovada com sucesso (Modo Teste).' });
});

// Consultar Minhas Compras por telefone
router.get('/minhas-compras/:telefone', (req, res) => {
    const db = req.app.locals.db;
    const compras = db.compras
        .filter(c => c.telefone === req.params.telefone)
        .map(c => {
            // Popula os dados da rifa na compra
            const rifa = db.rifas.find(r => r._id === c.rifaId);
            return { ...c, rifaId: rifa || { titulo: 'Rifa Excluída' } };
        });
    res.json(compras);
});

// Resultados / Ganhadores
router.get('/resultados', (req, res) => {
    const db = req.app.locals.db;
    const rifasSorteadas = db.rifas
        .filter(r => r.status === 'sorteada')
        .sort((a, b) => b.dataSorteio - a.dataSorteio);
    res.json(rifasSorteadas);
});

module.exports = router;
