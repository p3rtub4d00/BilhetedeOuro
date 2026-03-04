const mongoose = require('mongoose');

const CompraSchema = new mongoose.Schema({
    rifaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Rifa', required: true },
    telefone: { type: String, required: true },
    nome: { type: String, required: true },
    numeros: [{ type: Number, required: true }],
    valorTotal: { type: Number, required: true },
    statusPagamento: { type: String, enum: ['pendente', 'aprovado', 'cancelado'], default: 'pendente' },
    criadoEm: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Compra', CompraSchema);
