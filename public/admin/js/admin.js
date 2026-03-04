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
            acao = `<button onclick="abrirSorteioLoteria('${r._id}')" class="btn" style="background:var(--secondary); padding:5px 10px;">Informar Loteria Federal</button>`;
        } else if (r.status === 'sorteada') {
            acao = `<span style="color:var(--primary)">Sorteado: ${r.numeroSorteado}</span>`;
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
        valorNumero: parseFloat(document.getElementById('n-valor').value)
    };

    try {
        await fetchAPI('/admin-api/rifas', { method: 'POST', body: JSON.stringify(data) });
        alert('Rifa criada!');
        e.target.reset();
        carregarStats();
        carregarRifasAdmin();
    } catch (err) {
        alert('Erro ao criar: ' + err.message);
    }
});

async function abrirSorteioLoteria(id) {
    const p1 = prompt("Informe o número do 1º Prêmio da Loteria Federal (ex: 12345):");
    if(!p1) return;
    
    const p2 = prompt("Informe o número do 2º Prêmio da Loteria Federal (ex: 54321):");
    if(!p2) return;

    if(!confirm(`Confirma o encerramento da rifa com os dados da Loteria:\n1º Prêmio: ${p1}\n2º Prêmio: ${p2}?`)) return;

    try {
        const res = await fetchAPI(`/admin-api/rifas/${id}/sortear`, { 
            method: 'POST',
            body: JSON.stringify({ p1, p2 })
        });
        
        let msg = `Sorteio realizado!\n\nNúmero Sorteado Formado: ${res.rifa.numeroSorteado}\n`;
        if(res.ganhadorEncontrado) {
            msg += `🎉 Ganhador: ${res.rifa.vencedorInfo}`;
        } else {
            msg += `⚠️ ACUMULOU - Ninguém havia comprado este bilhete.`;
        }

        alert(msg);
        carregarRifasAdmin();
    } catch (err) {
        alert(err.message);
    }
}
