const express = require('express');
const router = express.Router();
const Rifa = require('../models/Rifa');
const Compra = require('../models/Compra');

// Listar Rifas Ativas
router.get('/rifas', async (req, res) => {
    try {
        const rifas = await Rifa.find({ status: { $in: ['ativa', 'encerrada', 'sorteada'] } }).sort({ criadoEm: -1 });
        res.json(rifas);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar rifas' });
    }
});

// Detalhes da Rifa e Números Vendidos
router.get('/rifas/:id', async (req, res) => {
    try {
        const rifa = await Rifa.findById(req.params.id);
        if (!rifa) return res.status(404).json({ error: 'Rifa não encontrada' });

        const compras = await Compra.find({ rifaId: rifa._id, statusPagamento: { $in: ['aprovado', 'pendente'] } });
        let numerosOcupados = [];
        compras.forEach(compra => {
            numerosOcupados = numerosOcupados.concat(compra.numeros);
        });

        res.json({ rifa, numerosOcupados });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar detalhes' });
    }
});

// Comprar Números
router.post('/comprar', async (req, res) => {
    const { rifaId, telefone, nome, numeros } = req.body;
    try {
        const rifa = await Rifa.findById(rifaId);
        if (!rifa || rifa.status !== 'ativa') return res.status(400).json({ error: 'Rifa indisponível' });

        // Verificar duplicidade
        const comprasExistentes = await Compra.find({ rifaId, statusPagamento: { $in: ['aprovado', 'pendente'] } });
        const numerosComprados = comprasExistentes.flatMap(c => c.numeros);
        const duplicados = numeros.filter(n => numerosComprados.includes(n));
        
        if (duplicados.length > 0) {
            return res.status(400).json({ error: 'Alguns números já foram comprados', duplicados });
        }

        const valorTotal = numeros.length * rifa.valorNumero;
        const novaCompra = new Compra({ rifaId, telefone, nome, numeros, valorTotal });
        await novaCompra.save();

        // Emitir socket
        const io = req.app.get('io');
        io.to(`rifa_${rifaId}`).emit('numerosComprados', numeros);

        // Aqui entraria a integração da API do PIX, retornando copia e cola / qrcode
        res.json({ success: true, compraId: novaCompra._id, mensagem: 'Reserva feita! Aguardando PIX (Simulado).' });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao processar compra' });
    }
});

// Consultar Minhas Compras por telefone
router.get('/minhas-compras/:telefone', async (req, res) => {
    try {
        const compras = await Compra.find({ telefone: req.params.telefone }).populate('rifaId');
        res.json(compras);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar compras' });
    }
});

// Resultados / Ganhadores
router.get('/resultados', async (req, res) => {
    try {
        const rifasSorteadas = await Rifa.find({ status: 'sorteada' }).sort({ dataSorteio: -1 });
        res.json(rifasSorteadas);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar resultados' });
    }
});

module.exports = router;
