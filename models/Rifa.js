const mongoose = require('mongoose');

const RifaSchema = new mongoose.Schema({
    titulo: { type: String, required: true },
    descricao: { type: String },
    premio: { type: String, required: true },
    valorNumero: { type: Number, required: true },
    totalNumeros: { type: Number, required: true },
    status: { type: String, enum: ['ativa', 'encerrada', 'sorteada'], default: 'ativa' },
    numeroSorteado: { type: Number, default: null },
    vencedorInfo: { type: String, default: null },
    dataSorteio: { type: Date },
    criadoEm: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Rifa', RifaSchema);
