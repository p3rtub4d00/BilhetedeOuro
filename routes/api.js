const express = require('express');
const crypto = require('crypto');
const router = express.Router();

const OTP_TTL_MS = 5 * 60 * 1000;
const TOKEN_TTL_MS = 15 * 60 * 1000;

const generateId = () => crypto.randomUUID();
const gerarCodigoOtp = () => crypto.randomInt(0, 1000000).toString().padStart(6, '0');
const hashTexto = (txt) => crypto.createHash('sha256').update(String(txt)).digest('hex');

const gerarNumeroComprovante = () => {
    const agora = new Date();
    const y = agora.getFullYear();
    const m = String(agora.getMonth() + 1).padStart(2, '0');
    const d = String(agora.getDate()).padStart(2, '0');
    const sufixo = crypto.randomInt(10000, 99999);
    return `CMP-${y}${m}${d}-${sufixo}`;
};

const registrarAuditoria = (db, evento, detalhes = {}) => {
    db.auditLogs.push({
        _id: generateId(),
        evento,
        detalhes,
        criadoEm: Date.now()
    });
};

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
    const totalNumerosVendidos = compras.reduce((acc, compra) => acc + compra.numeros.length, 0);

    res.json({ rifa, totalNumerosVendidos });
});

// Comprar Cotas (Gera 2 números por cota)
router.post('/comprar', (req, res) => {
    const db = req.app.locals.db;
    const { rifaId, telefone, nome, quantidade } = req.body;

    const quantidadeInt = Number(quantidade);
    const telefoneLimpo = String(telefone || '').replace(/\D/g, '');
    const nomeLimpo = String(nome || '').trim();

    const rifa = db.rifas.find(r => r._id === rifaId);
    if (!rifa || rifa.status !== 'ativa') return res.status(400).json({ error: 'Rifa indisponível' });

    if (!nomeLimpo || nomeLimpo.length < 3) return res.status(400).json({ error: 'Informe um nome válido.' });
    if (telefoneLimpo.length < 10 || telefoneLimpo.length > 13) return res.status(400).json({ error: 'Informe um telefone válido.' });
    if (!Number.isInteger(quantidadeInt) || quantidadeInt < 1 || quantidadeInt > 500) {
        return res.status(400).json({ error: 'Quantidade inválida.' });
    }

    // Pega todos os números já gerados para esta rifa
    const comprasExistentes = db.compras.filter(c => c.rifaId === rifaId);
    const numerosComprados = new Set(comprasExistentes.flatMap(c => c.numeros));

    // Regra: 2 números de 4 dígitos (0000 a 9999) por cota
    const totalNumerosParaGerar = quantidadeInt * 2;
    const novosNumeros = [];

    // Proteção para não entrar em loop infinito se acabarem os números (10.000 max)
    if (numerosComprados.size + totalNumerosParaGerar > 10000) {
        return res.status(400).json({ error: 'Não há cotas suficientes disponíveis nesta rifa.' });
    }

    // Gera números aleatórios criptograficamente mais seguros que Math.random
    while (novosNumeros.length < totalNumerosParaGerar) {
        const rand = crypto.randomInt(0, 10000).toString().padStart(4, '0');
        if (!numerosComprados.has(rand)) {
            numerosComprados.add(rand);
            novosNumeros.push(rand);
        }
    }

    const valorTotal = quantidadeInt * rifa.valorNumero;
    const numeroComprovante = gerarNumeroComprovante();
    const novaCompra = {
        _id: generateId(),
        rifaId,
        telefone: telefoneLimpo,
        nome: nomeLimpo,
        quantidade: quantidadeInt,
        numeros: novosNumeros,
        valorTotal,
        statusPagamento: 'aprovado', // Modo de teste, aprova direto
        numeroComprovante,
        criadoEm: Date.now()
    };

    novaCompra.hashComprovante = hashTexto(
        `${novaCompra._id}|${novaCompra.rifaId}|${novaCompra.telefone}|${novaCompra.numeros.join(',')}|${novaCompra.valorTotal}|${novaCompra.criadoEm}`
    );

    db.compras.push(novaCompra);
    registrarAuditoria(db, 'COMPRA_CRIADA', {
        compraId: novaCompra._id,
        rifaId,
        telefoneFinal: telefoneLimpo.slice(-4),
        numeroComprovante
    });

    // Emitir socket para atualizar contadores na tela de outras pessoas
    const io = req.app.get('io');
    io.to(`rifa_${rifaId}`).emit('atualizarVendidos', totalNumerosParaGerar);

    res.json({
        success: true,
        compraId: novaCompra._id,
        numerosGerados: novosNumeros,
        mensagem: 'Compra aprovada com sucesso.',
        comprovante: {
            numero: novaCompra.numeroComprovante,
            hash: novaCompra.hashComprovante,
            criadoEm: novaCompra.criadoEm,
            valorTotal: novaCompra.valorTotal
        }
    });
});

// Solicitar código OTP para consultar compras
router.post('/minhas-compras/solicitar-codigo', (req, res) => {
    const db = req.app.locals.db;
    const telefone = String(req.body.telefone || '').replace(/\D/g, '');

    if (telefone.length < 10 || telefone.length > 13) {
        return res.status(400).json({ error: 'Telefone inválido.' });
    }

    const codigo = gerarCodigoOtp();
    db.otpByPhone.set(telefone, {
        codigoHash: hashTexto(codigo),
        expiraEm: Date.now() + OTP_TTL_MS,
        tentativas: 0
    });

    registrarAuditoria(db, 'OTP_SOLICITADO', { telefoneFinal: telefone.slice(-4) });

    // Em produção: enviar por WhatsApp/SMS. Aqui retornamos para ambiente de testes.
    res.json({
        success: true,
        mensagem: 'Código de verificação enviado.',
        codigoDebug: codigo
    });
});

// Verificar OTP e emitir token temporário de consulta
router.post('/minhas-compras/verificar-codigo', (req, res) => {
    const db = req.app.locals.db;
    const telefone = String(req.body.telefone || '').replace(/\D/g, '');
    const codigo = String(req.body.codigo || '').trim();

    const otp = db.otpByPhone.get(telefone);
    if (!otp || Date.now() > otp.expiraEm) {
        return res.status(400).json({ error: 'Código expirado. Solicite um novo.' });
    }

    if (otp.tentativas >= 5) {
        db.otpByPhone.delete(telefone);
        return res.status(429).json({ error: 'Muitas tentativas. Solicite novo código.' });
    }

    if (hashTexto(codigo) !== otp.codigoHash) {
        otp.tentativas += 1;
        return res.status(401).json({ error: 'Código inválido.' });
    }

    db.otpByPhone.delete(telefone);
    const token = generateId();
    db.tokensConsulta.set(token, { telefone, expiraEm: Date.now() + TOKEN_TTL_MS });

    registrarAuditoria(db, 'OTP_VALIDADO', { telefoneFinal: telefone.slice(-4) });

    res.json({ success: true, token, expiraEm: Date.now() + TOKEN_TTL_MS });
});

// Consultar Minhas Compras com token temporário
router.get('/minhas-compras', (req, res) => {
    const db = req.app.locals.db;
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';

    if (!token) return res.status(401).json({ error: 'Token de consulta não informado.' });

    const sessao = db.tokensConsulta.get(token);
    if (!sessao || Date.now() > sessao.expiraEm) {
        return res.status(401).json({ error: 'Token inválido ou expirado.' });
    }

    const compras = db.compras
        .filter(c => c.telefone === sessao.telefone)
        .map(c => {
            const rifa = db.rifas.find(r => r._id === c.rifaId);
            return {
                ...c,
                telefone: `${c.telefone.slice(0, 2)}******${c.telefone.slice(-2)}`,
                rifaId: rifa || { titulo: 'Rifa Excluída' }
            };
        });

    registrarAuditoria(db, 'CONSULTA_COMPRAS', {
        telefoneFinal: sessao.telefone.slice(-4),
        totalCompras: compras.length
    });

    res.json(compras);
});

// Endpoint legado bloqueado por segurança
router.get('/minhas-compras/:telefone', (req, res) => {
    return res.status(410).json({ error: 'Consulta por telefone direto foi desativada. Use verificação por código.' });
});

// Verificar comprovante público
router.get('/comprovantes/:numero', (req, res) => {
    const db = req.app.locals.db;
    const compra = db.compras.find(c => c.numeroComprovante === req.params.numero);

    if (!compra) return res.status(404).json({ error: 'Comprovante não encontrado.' });

    const rifa = db.rifas.find(r => r._id === compra.rifaId);

    res.json({
        numeroComprovante: compra.numeroComprovante,
        hashComprovante: compra.hashComprovante,
        statusPagamento: compra.statusPagamento,
        criadoEm: compra.criadoEm,
        valorTotal: compra.valorTotal,
        rifa: rifa ? { titulo: rifa.titulo, premio: rifa.premio } : null,
        comprador: {
            nome: compra.nome,
            telefoneMascarado: `${compra.telefone.slice(0, 2)}******${compra.telefone.slice(-2)}`
        }
    });
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
