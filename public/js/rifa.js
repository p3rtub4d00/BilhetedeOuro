const urlParams = new URLSearchParams(window.location.search);
const rifaId = urlParams.get('id');
const socket = io();

let rifaData = {};
let quantidade = 1;

document.addEventListener('DOMContentLoaded', async () => {
    if(!rifaId) return window.location.href = '/';

    socket.emit('joinRifa', rifaId);

    try {
        const res = await fetchAPI(`/api/rifas/${rifaId}`);
        rifaData = res.rifa;

        document.getElementById('rifa-title').innerText = rifaData.titulo;
        document.getElementById('rifa-desc').innerText = `Prêmio: ${rifaData.premio} | R$ ${rifaData.valorNumero.toFixed(2)} / cota`;

        const itemDesc = document.getElementById('rifa-item-desc');
        itemDesc.innerText = rifaData.descricao || '';

        const rifaImage = document.getElementById('rifa-image');
        if (rifaData.imagemBase64) {
            rifaImage.src = rifaData.imagemBase64;
            rifaImage.style.display = 'block';
        }

        atualizarCheckout();
    } catch (error) {
        alert('Erro ao carregar rifa.');
    }
});

function mudarQtd(delta) {
    let novaQtd = quantidade + delta;
    if(novaQtd >= 1 && novaQtd <= 500) { // Limite de 500 cotas por compra por segurança
        quantidade = novaQtd;
        document.getElementById('qtd-cotas').innerText = quantidade;
        document.getElementById('qtd-numeros').innerText = quantidade * 2;
        atualizarCheckout();
    }
}

function atualizarCheckout() {
    const total = quantidade * rifaData.valorNumero;
    document.getElementById('valor-total').innerText = `Total: R$ ${total.toFixed(2)}`;
}

function adicionarMarcaDagua(doc) {
    doc.setTextColor(235, 238, 245);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(46);
    doc.text('BILHETE DE OURO', 105, 170, {
        align: 'center',
        angle: 45
    });
}

function gerarAssinaturaVisual(hash) {
    return `${hash.slice(0, 12)}-${hash.slice(-12)}`;
}

function gerarQrDataUrl(texto) {
    if (typeof QRious === 'undefined') return null;

    const qr = new QRious({
        value: texto,
        size: 220,
        level: 'M'
    });

    return qr.toDataURL('image/png');
}

function baixarComprovantePDF(dados) {
    const jsPdfLib = window.jspdf;
    if (!jsPdfLib || !jsPdfLib.jsPDF) {
        throw new Error('Biblioteca de PDF não carregada. Recarregue a página e tente novamente.');
    }

    const { jsPDF } = jsPdfLib;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });

    adicionarMarcaDagua(doc);

    const margemX = 15;
    let y = 18;

    doc.setFillColor(30, 41, 59);
    doc.rect(0, 0, 210, 30, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('BILHETE DE OURO - COMPROVANTE', margemX, 18);

    doc.setTextColor(30, 41, 59);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    y = 40;

    const linhas = [
        ['Rifa', rifaData.titulo],
        ['Prêmio', rifaData.premio],
        ['Compra ID', dados.compraId],
        ['Comprovante', dados.comprovante.numero],
        ['Data/Hora', new Date(dados.comprovante.criadoEm).toLocaleString('pt-BR')],
        ['Valor Total', `R$ ${dados.comprovante.valorTotal.toFixed(2)}`],
        ['Quantidade de cotas', String(quantidade)]
    ];

    linhas.forEach(([chave, valor]) => {
        doc.setFont('helvetica', 'bold');
        doc.text(`${chave}:`, margemX, y);
        doc.setFont('helvetica', 'normal');
        doc.text(String(valor), margemX + 38, y);
        y += 7;
    });

    y += 4;
    doc.setFont('helvetica', 'bold');
    doc.text('Números gerados:', margemX, y);
    y += 6;

    doc.setFont('courier', 'normal');
    const numerosTexto = dados.numerosGerados.join('  •  ');
    const numerosLinhas = doc.splitTextToSize(numerosTexto, 180);
    doc.text(numerosLinhas, margemX, y);
    y += numerosLinhas.length * 5 + 6;

    doc.setFont('helvetica', 'bold');
    doc.text('Hash de verificação:', margemX, y);
    y += 5;

    doc.setFont('courier', 'normal');
    doc.setFontSize(9);
    const hashLinhas = doc.splitTextToSize(dados.comprovante.hash, 125);
    doc.text(hashLinhas, margemX, y);

    // QR de validação
    const urlValidacao = `${window.location.origin}/api/comprovantes/${dados.comprovante.numero}`;
    const qrDataUrl = gerarQrDataUrl(urlValidacao);
    if (qrDataUrl) {
        doc.addImage(qrDataUrl, 'PNG', 155, y - 2, 40, 40);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.text('QR de validação', 175, y + 41, { align: 'center' });
    }

    y += Math.max(hashLinhas.length * 4 + 10, 46);

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.text(`Validação: ${urlValidacao}`, margemX, y);

    y += 6;
    doc.setFont('helvetica', 'bold');
    doc.text(`Assinatura digital: ${gerarAssinaturaVisual(dados.comprovante.hash)}`, margemX, y);

    doc.save(`${dados.comprovante.numero}.pdf`);
}

document.getElementById('form-compra').addEventListener('submit', async (e) => {
    e.preventDefault();

    const nome = document.getElementById('nome').value;
    const telefone = document.getElementById('telefone').value;
    const btn = document.getElementById('btn-finalizar');

    btn.innerText = 'Processando...';
    btn.disabled = true;

    try {
        const res = await fetchAPI('/api/comprar', {
            method: 'POST',
            body: JSON.stringify({ rifaId, nome, telefone, quantidade })
        });

        // Esconde o form e mostra o resultado
        document.getElementById('form-compra').style.display = 'none';
        const panelSucesso = document.getElementById('sucesso-panel');
        panelSucesso.style.display = 'block';

        // Renderiza as tags dos números
        const containerNumeros = document.getElementById('numeros-gerados');
        containerNumeros.innerHTML = '';
        res.numerosGerados.forEach(num => {
            const span = document.createElement('span');
            span.className = 'num-tag';
            span.innerText = num;
            containerNumeros.appendChild(span);
        });

        // Exibe comprovante
        const compInfo = document.getElementById('comprovante-info');
        compInfo.innerHTML = `
            <p style="margin-top:10px;"><strong>Comprovante:</strong> ${res.comprovante.numero}</p>
            <p style="font-size: 0.85rem; color: var(--text-light); word-break: break-all;"><strong>Hash:</strong> ${res.comprovante.hash}</p>
        `;

        const btnDownload = document.getElementById('btn-comprovante');
        btnDownload.style.display = 'block';
        btnDownload.onclick = () => {
            try {
                baixarComprovantePDF(res);
            } catch (err) {
                showAlert('alert-box', err.message || 'Erro ao gerar PDF.');
            }
        };

    } catch (error) {
        showAlert('alert-box', error.message);
        btn.innerText = 'Finalizar Compra';
        btn.disabled = false;
    }
});
