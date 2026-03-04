// Funções auxiliares base
async function fetchAPI(endpoint, options = {}) {
    try {
        const response = await fetch(endpoint, {
            headers: { 'Content-Type': 'application/json' },
            ...options
        });

        const contentType = response.headers.get('content-type') || '';
        const isJson = contentType.includes('application/json');
        const data = isJson ? await response.json() : null;

        if (!response.ok) {
            if (data && data.error) throw new Error(data.error);
            if (response.status === 413) throw new Error('Imagem muito grande para envio. Tente uma foto menor (até ~2MB).');
            throw new Error('Erro na requisição');
        }

        return data;
    } catch (error) {
        console.error(error);
        throw error;
    }
}

function showAlert(containerId, message, type = 'error') {
    const box = document.getElementById(containerId);
    if(box) {
        box.innerHTML = `<div class="alert alert-${type}">${message}</div>`;
        setTimeout(() => box.innerHTML = '', 5000);
    } else {
        alert(message);
    }
}
