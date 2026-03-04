// Funções auxiliares base
async function fetchAPI(endpoint, options = {}) {
    try {
        const response = await fetch(endpoint, {
            headers: { 'Content-Type': 'application/json' },
            ...options
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Erro na requisição');
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
