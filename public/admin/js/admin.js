document.addEventListener('DOMContentLoaded', () => {
    carregarStats();
    carregarRifasAdmin();
    configurarPreviewFoto();
});

async function logout() {
    await fetchAPI('/admin-api/logout', { method: 'POST' });
    window.location.href = '/admin/';
}

function configurarPreviewFoto() {
    const inputFoto = document.getElementById('n-foto');
    const preview = document.getElementById('preview-foto');
    if (!inputFoto || !preview) return;

    inputFoto.addEventListener('change', () => {
        const file = inputFoto.files && inputFoto.files[0];
        if (!file) {
            preview.style.display = 'none';
            preview.removeAttribute('src');
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            preview.src = reader.result;
            preview.style.display = 'block';
        };
        reader.readAsDataURL(file);
    });
}

function arquivoParaBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Falha ao ler a imagem.'));
        reader.readAsDataURL(file);
    });
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
            acao = `<button onclick="abrirSorteioLoteria('${r._id}')" class="btn" style="background:var(--secondary-color); padding:5px 10px;">Informar Loteria Federal</button>`;
        } else if (r.status === 'sorteada') {
            acao = `<span style="color:var(--primary-color)">Sorteado: ${r.numeroSorteado}</span>`;
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

    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.innerText = 'Cadastrando...';

    const fotoInput = document.getElementById('n-foto');
    const fotoArquivo = fotoInput.files && fotoInput.files[0];

    try {
        let imagemBase64 = '';
        if (fotoArquivo) {
            if (!fotoArquivo.type.startsWith('image/')) {
                throw new Error('Selecione um arquivo de imagem válido.');
            }

            // Limite no cliente: 2MB (evita travar e erro de payload)
            if (fotoArquivo.size > 2 * 1024 * 1024) {
                throw new Error('A imagem deve ter no máximo 2MB.');
            }

            imagemBase64 = await arquivoParaBase64(fotoArquivo);
        }

        const data = {
            titulo: document.getElementById('n-titulo').value.trim(),
            premio: document.getElementById('n-premio').value.trim(),
            descricao: document.getElementById('n-descricao').value.trim(),
            imagemBase64,
            valorNumero: parseFloat(document.getElementById('n-valor').value)
        };

        await fetchAPI('/admin-api/rifas', { method: 'POST', body: JSON.stringify(data) });
        alert('Rifa criada!');
        e.target.reset();
        const preview = document.getElementById('preview-foto');
        preview.style.display = 'none';
        preview.removeAttribute('src');
        carregarStats();
        carregarRifasAdmin();
    } catch (err) {
        alert('Erro ao criar: ' + err.message);
    } finally {
        btn.disabled = false;
        btn.innerText = 'Cadastrar Rifa';
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
