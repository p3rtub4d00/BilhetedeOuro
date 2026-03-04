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
        res.numerosGerados.forEach(num => {
            const span = document.createElement('span');
            span.className = 'num-tag';
            span.innerText = num;
            containerNumeros.appendChild(span);
        });

    } catch (error) {
        showAlert('alert-box', error.message);
        btn.innerText = 'Finalizar Compra';
        btn.disabled = false;
    }
});
