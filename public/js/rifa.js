const urlParams = new URLSearchParams(window.location.search);
const rifaId = urlParams.get('id');
const socket = io();

let rifaData = {};
let numerosOcupados = [];
let numerosSelecionados = [];

document.addEventListener('DOMContentLoaded', async () => {
    if(!rifaId) return window.location.href = '/';

    socket.emit('joinRifa', rifaId);

    try {
        const res = await fetchAPI(`/api/rifas/${rifaId}`);
        rifaData = res.rifa;
        numerosOcupados = res.numerosOcupados;

        document.getElementById('rifa-title').innerText = rifaData.titulo;
        document.getElementById('rifa-desc').innerText = `Prêmio: ${rifaData.premio} | R$ ${rifaData.valorNumero.toFixed(2)} / cota`;
        
        renderizarGrid();
    } catch (error) {
        alert('Erro ao carregar rifa.');
    }

    socket.on('numerosComprados', (numeros) => {
        numerosOcupados = [...numerosOcupados, ...numeros];
        numerosSelecionados = numerosSelecionados.filter(n => !numerosOcupados.includes(n));
        renderizarGrid();
        atualizarCheckout();
    });
});

function renderizarGrid() {
    const grid = document.getElementById('grid');
    grid.innerHTML = '';
    
    const limiteUI = Math.min(rifaData.totalNumeros, 2000); 

    for(let i = 1; i <= limiteUI; i++) {
        const btn = document.createElement('button');
        btn.innerText = i.toString().padStart(3, '0');
        btn.className = 'numero-btn';
        
        if(numerosOcupados.includes(i)) {
            btn.classList.add('ocupado');
            btn.disabled = true;
        } else if(numerosSelecionados.includes(i)) {
            btn.classList.add('selecionado');
            btn.onclick = () => toggleNumero(i);
        } else {
            btn.classList.add('livre');
            btn.onclick = () => toggleNumero(i);
        }
        grid.appendChild(btn);
    }
}

function toggleNumero(num) {
    const index = numerosSelecionados.indexOf(num);
    if(index > -1) {
        numerosSelecionados.splice(index, 1);
    } else {
        numerosSelecionados.push(num);
    }
    renderizarGrid();
    atualizarCheckout();
}

function atualizarCheckout() {
    document.getElementById('numeros-selecionados').innerText = numerosSelecionados.length > 0 
        ? numerosSelecionados.map(n => n.toString().padStart(3, '0')).join(', ') 
        : 'Nenhum número selecionado';
    
    const total = numerosSelecionados.length * rifaData.valorNumero;
    document.getElementById('valor-total').innerText = `Total: R$ ${total.toFixed(2)}`;
}

document.getElementById('form-compra').addEventListener('submit', async (e) => {
    e.preventDefault();
    if(numerosSelecionados.length === 0) return showAlert('alert-box', 'Selecione pelo menos 1 número.');

    const nome = document.getElementById('nome').value;
    const telefone = document.getElementById('telefone').value;

    const btn = document.getElementById('btn-finalizar');
    btn.innerText = 'Processando...';
    btn.disabled = true;

    try {
        const res = await fetchAPI('/api/comprar', {
            method: 'POST',
            body: JSON.stringify({ rifaId, nome, telefone, numeros: numerosSelecionados })
        });
        
        document.querySelector('.checkout-panel').innerHTML = `
            <h3 style="color: var(--secondary)">Compra Aprovada! (Teste)</h3>
            <p>Seus números foram garantidos com sucesso.</p>
            <p style="margin-top:10px; font-weight:bold;">ID: ${res.compraId}</p>
            <a href="/compras.html" class="btn" style="margin-top: 15px;">Ver Minhas Compras</a>
        `;
    } catch (error) {
        showAlert('alert-box', error.message);
        btn.innerText = 'Finalizar Compra';
        btn.disabled = false;
    }
});
