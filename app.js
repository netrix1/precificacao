const state = {
  items: [],
  calculationRows: []
};

const modal = document.getElementById('items-modal');
const itemForm = document.getElementById('item-form');
const calcForm = document.getElementById('calc-form');

const formatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL'
});

function formatCurrency(value) {
  return formatter.format(Number(value) || 0);
}

function formatCategoria(categoria) {
  const labels = {
    ingrediente: 'Ingrediente',
    mao_de_obra: 'Mão de obra',
    outros_custos: 'Outros custos'
  };
  return labels[categoria] || categoria;
}

async function apiRequest(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Erro na requisição.');
  }

  return response.status === 204 ? null : response.json();
}

async function loadItems() {
  state.items = await apiRequest('/api/items');
  renderItemsTable();
  renderItemSelect();
}

function renderItemSelect() {
  const select = document.getElementById('calc-item');

  if (state.items.length === 0) {
    select.innerHTML = '<option value="">Cadastre um item primeiro</option>';
    select.disabled = true;
    return;
  }

  select.disabled = false;
  select.innerHTML = state.items
    .map((item) => `<option value="${item.id}">${item.nome} (${formatCategoria(item.categoria)})</option>`)
    .join('');
}

function renderItemsTable() {
  const tbody = document.getElementById('items-body');

  tbody.innerHTML = state.items
    .map(
      (item) => `
      <tr class="border-b">
        <td class="py-2">${item.nome}</td>
        <td class="py-2">${formatCategoria(item.categoria)}</td>
        <td class="py-2">${item.quantidade_base}</td>
        <td class="py-2">${item.tipo_quantidade}</td>
        <td class="py-2">${formatCurrency(item.preco_por_quantidade)}</td>
        <td class="py-2 flex gap-2">
          <button class="bg-amber-500 text-white px-2 py-1 rounded" data-edit-id="${item.id}">Editar</button>
          <button class="bg-red-600 text-white px-2 py-1 rounded" data-delete-id="${item.id}">Excluir</button>
        </td>
      </tr>
    `
    )
    .join('');
}

function renderCalculationTable() {
  const tbody = document.getElementById('calculation-body');

  tbody.innerHTML = state.calculationRows
    .map(
      (row, index) => `
      <tr class="border-b">
        <td class="py-2">${row.item.nome}</td>
        <td class="py-2">${formatCategoria(row.item.categoria)}</td>
        <td class="py-2">${row.quantidadeUsada} ${row.item.tipo_quantidade}</td>
        <td class="py-2">${formatCurrency(row.custoUnitario)}</td>
        <td class="py-2">${formatCurrency(row.subtotal)}</td>
        <td class="py-2">${row.observacao || '-'}</td>
        <td class="py-2"><button class="bg-slate-700 text-white px-2 py-1 rounded" data-remove-row="${index}">Remover</button></td>
      </tr>
    `
    )
    .join('');

  renderTotals();
}

function renderTotals() {
  const totals = {
    ingrediente: 0,
    mao_de_obra: 0,
    outros_custos: 0
  };

  state.calculationRows.forEach((row) => {
    totals[row.item.categoria] += row.subtotal;
  });

  const totalGeral = totals.ingrediente + totals.mao_de_obra + totals.outros_custos;

  document.getElementById('total-ingredientes').textContent = formatCurrency(totals.ingrediente);
  document.getElementById('total-mao-obra').textContent = formatCurrency(totals.mao_de_obra);
  document.getElementById('total-outros').textContent = formatCurrency(totals.outros_custos);
  document.getElementById('total-geral').textContent = formatCurrency(totalGeral);
}

function openModal() {
  modal.classList.remove('hidden');
  document.body.classList.add('modal-open');
}

function closeModal() {
  modal.classList.add('hidden');
  document.body.classList.remove('modal-open');
}

function resetItemForm() {
  document.getElementById('item-id').value = '';
  document.getElementById('item-nome').value = '';
  document.getElementById('item-categoria').value = 'ingrediente';
  document.getElementById('item-quantidade-base').value = '';
  document.getElementById('item-tipo-quantidade').value = '';
  document.getElementById('item-preco').value = '';
}

itemForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const id = document.getElementById('item-id').value;
  const payload = {
    nome: document.getElementById('item-nome').value,
    categoria: document.getElementById('item-categoria').value,
    quantidade_base: Number(document.getElementById('item-quantidade-base').value),
    tipo_quantidade: document.getElementById('item-tipo-quantidade').value,
    preco_por_quantidade: Number(document.getElementById('item-preco').value)
  };

  try {
    if (id) {
      await apiRequest(`/api/items/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
    } else {
      await apiRequest('/api/items', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    }

    resetItemForm();
    await loadItems();
  } catch (error) {
    alert(error.message);
  }
});

document.getElementById('items-body').addEventListener('click', async (event) => {
  const editId = event.target.getAttribute('data-edit-id');
  const deleteId = event.target.getAttribute('data-delete-id');

  if (editId) {
    const item = state.items.find((entry) => entry.id === Number(editId));
    if (!item) return;

    document.getElementById('item-id').value = item.id;
    document.getElementById('item-nome').value = item.nome;
    document.getElementById('item-categoria').value = item.categoria;
    document.getElementById('item-quantidade-base').value = item.quantidade_base;
    document.getElementById('item-tipo-quantidade').value = item.tipo_quantidade;
    document.getElementById('item-preco').value = item.preco_por_quantidade;
  }

  if (deleteId) {
    const shouldDelete = window.confirm('Deseja realmente remover este item?');
    if (!shouldDelete) return;

    try {
      await apiRequest(`/api/items/${deleteId}`, { method: 'DELETE' });
      state.calculationRows = state.calculationRows.filter((row) => row.item.id !== Number(deleteId));
      renderCalculationTable();
      await loadItems();
    } catch (error) {
      alert(error.message);
    }
  }
});

calcForm.addEventListener('submit', (event) => {
  event.preventDefault();

  const itemId = Number(document.getElementById('calc-item').value);
  const quantidadeUsada = Number(document.getElementById('calc-quantidade').value);
  const observacao = document.getElementById('calc-observacao').value;

  const item = state.items.find((entry) => entry.id === itemId);
  if (!item || quantidadeUsada <= 0) {
    alert('Escolha um item válido e quantidade acima de zero.');
    return;
  }

  const custoUnitario = item.preco_por_quantidade / item.quantidade_base;
  const subtotal = custoUnitario * quantidadeUsada;

  state.calculationRows.push({
    item,
    quantidadeUsada,
    observacao,
    custoUnitario,
    subtotal
  });

  document.getElementById('calc-quantidade').value = '';
  document.getElementById('calc-observacao').value = '';
  renderCalculationTable();
});

document.getElementById('calculation-body').addEventListener('click', (event) => {
  const rowIndex = event.target.getAttribute('data-remove-row');
  if (rowIndex === null) return;

  state.calculationRows.splice(Number(rowIndex), 1);
  renderCalculationTable();
});

document.getElementById('open-modal').addEventListener('click', openModal);
document.getElementById('close-modal').addEventListener('click', closeModal);
document.getElementById('cancel-edit').addEventListener('click', resetItemForm);
modal.addEventListener('click', (event) => {
  if (event.target === modal) closeModal();
});

document.addEventListener('DOMContentLoaded', async () => {
  try {
    await loadItems();
    renderCalculationTable();
  } catch (error) {
    alert('Não foi possível carregar os itens iniciais.');
  }
});
