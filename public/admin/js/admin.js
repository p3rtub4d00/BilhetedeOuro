document.addEventListener('DOMContentLoaded', () => {
    carregarStats();
    carregarRifasAdmin();
});

async function logout() {
    await fetchAPI('/admin-api/logout', { method: 'POST' });
    window.location.href = '/admin/';
}

async function carregarStats() {
    try {
        const stats = await fetchAPI('/admin-api/stats');
        document.getElementById('stat-rifas').innerText = stats.totalRifas;
        document.getElementById('stat-receita').innerText = `R$ ${stats.receitaTotal.toFixed(2)}`;
    } catch (error) {
        if(error.message === 'Não autorizado') window.location.href = '/admin/';
    }
}

async function carregarRifasAdmin() {
    const tbody = document.getElementById('lista-rifas-admin');
    tbody.innerHTML = '';
    const rifas = await fetchAPI('/api/rifas');
    
    rifas.forEach(r => {
        let acao = '';
        if(r.status === 'ativa') {
            acao = `<button onclick="sortear('${r._id}')" class="btn" style="background:var(--secondary); padding:5px 10px;">Encerrar e Sortear</button>`;
        } else if (r.status === 'sorteada') {
            acao = `<span style="color:var(--primary)">Vencedor: ${r.numeroSorteado}</span>`;
        }

        tbody.innerHTML += `
            <tr>
                <td>${r.titulo}<br><small style="color:#888;">${r.premio}</small></td>
                <td>${r.status.toUpperCase()}</td>
                <td>${acao}</td>
            </tr>
        `;
    });
}

document.getElementById('form-nova-rifa').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
        titulo: document.getElementById('n-titulo').value,
        premio: document.getElementById('n-premio').value,
        valorNumero: parseFloat(document.getElementById('n-valor').value),
        totalNumeros: parseInt(document.getElementById('n-total').value)
    };

    try {
        await fetchAPI('/admin-api/rifas', { method: 'POST', body: JSON.stringify(data) });
        alert('Rifa criada com sucesso!');
        e.target.reset();
        carregarRifasAdmin();
    } catch (err) {
        alert('Erro ao criar: ' + err.message);
    }
});

async function sortear(id) {
    if(!confirm('Atenção: Isso encerrará a rifa e sorteará um número pago. Continuar?')) return;
    try {
        const res = await fetchAPI(`/admin-api/rifas/${id}/sortear`, { method: 'POST' });
        alert(`Sorteio realizado! Ganhador: Bilhete ${res.rifa.numeroSorteado}\nInfo: ${res.rifa.vencedorInfo}`);
        carregarRifasAdmin();
    } catch (err) {
        alert(err.message);
    }
}
