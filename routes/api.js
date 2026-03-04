const express = require('express');
const router = express.Router();

const generateId = () => Math.random().toString(36).substr(2, 9);

// Listar Rifas Ativas
router.get('/rifas', (req, res) => {
    const db = req.app.locals.db;
    const rifas = db.rifas
        .filter(r => ['ativa', 'encerrada', 'sorteada'].includes(r.status))
        .sort((a, b) => b.criadoEm - a.criadoEm);
    res.json(rifas);
});

// Detalhes da Rifa e Quantidade Vendida
router.get('/rifas/:id', (req, res) => {
    const db = req.app.locals.db;
    const rifa = db.rifas.find(r => r._id === req.params.id);
    
    if (!rifa) return res.status(404).json({ error: 'Rifa não encontrada' });

    const compras = db.compras.filter(c => c.rifaId === rifa._id && ['aprovado', 'pendente'].includes(c.statusPagamento));
    let totalNumerosVendidos = 0;
    compras.forEach(compra => {
        totalNumerosVendidos += compra.numeros.length;
    });

    res.json({ rifa, totalNumerosVendidos });
});

// Comprar Cotas (Gera 2 números por cota)
router.post('/comprar', (req, res) => {
    const db = req.app.locals.db;
    const { rifaId, telefone, nome, quantidade } = req.body;
    
    const rifa = db.rifas.find(r => r._id === rifaId);
    if (!rifa || rifa.status !== 'ativa') return res.status(400).json({ error: 'Rifa indisponível' });

    if (quantidade < 1) return res.status(400).json({ error: 'Quantidade inválida' });

    // Pega todos os números já gerados para esta rifa
    const comprasExistentes = db.compras.filter(c => c.rifaId === rifaId);
    const numerosComprados = comprasExistentes.flatMap(c => c.numeros);
    
    // Regra: 2 números de 4 dígitos (0000 a 9999) por cota
    const totalNumerosParaGerar = quantidade * 2;
    const novosNumeros = [];

    // Proteção para não entrar em loop infinito se acabarem os números (10.000 max)
    if (numerosComprados.length + totalNumerosParaGerar > 10000) {
        return res.status(400).json({ error: 'Não há cotas suficientes disponíveis nesta rifa.' });
    }

    // Gera números aleatórios que ainda não saíram
    while (novosNumeros.length < totalNumerosParaGerar) {
        let rand = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        if (!numerosComprados.includes(rand) && !novosNumeros.includes(rand)) {
            novosNumeros.push(rand);
        }
    }

    const valorTotal = quantidade * rifa.valorNumero;
    const novaCompra = {
        _id: generateId(),
        rifaId,
        telefone,
        nome,
        quantidade,
        numeros: novosNumeros,
        valorTotal,
        statusPagamento: 'aprovado', // Modo de teste, aprova direto
        criadoEm: new Date().getTime()
    };
    
    db.compras.push(novaCompra);

    // Emitir socket para atualizar contadores na tela de outras pessoas
    const io = req.app.get('io');
    io.to(`rifa_${rifaId}`).emit('atualizarVendidos', totalNumerosParaGerar);

    res.json({ 
        success: true, 
        compraId: novaCompra._id, 
        numerosGerados: novosNumeros,
        mensagem: 'Compra aprovada com sucesso.' 
    });
});

// Consultar Minhas Compras por telefone
router.get('/minhas-compras/:telefone', (req, res) => {
    const db = req.app.locals.db;
    const compras = db.compras
        .filter(c => c.telefone === req.params.telefone)
        .map(c => {
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
