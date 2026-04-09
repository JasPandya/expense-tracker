/* ========================================
   SpendWise - Expense Tracker
   Application Logic
   ======================================== */

// ========== DATA & STATE ==========

const CATEGORIES = {
  food:           { label: 'Food & Dining',   icon: '\uD83C\uDF54', color: 'var(--cat-food)' },
  travel:         { label: 'Travel',           icon: '\u2708\uFE0F', color: 'var(--cat-travel)' },
  office:         { label: 'Office',           icon: '\uD83D\uDCBC', color: 'var(--cat-office)' },
  shopping:       { label: 'Shopping',         icon: '\uD83D\uDECD\uFE0F', color: 'var(--cat-shopping)' },
  entertainment:  { label: 'Entertainment',    icon: '\uD83C\uDFAC', color: 'var(--cat-entertainment)' },
  health:         { label: 'Health',           icon: '\uD83D\uDC8A', color: 'var(--cat-health)' },
  bills:          { label: 'Bills & Utilities',icon: '\uD83D\uDCC4', color: 'var(--cat-bills)' },
  groceries:      { label: 'Groceries',        icon: '\uD83E\uDED2', color: 'var(--cat-groceries)' },
  transport:      { label: 'Transport',        icon: '\uD83D\uDE8C', color: 'var(--cat-transport)' },
  subscriptions:  { label: 'Subscriptions',    icon: '\uD83D\uDD04', color: 'var(--cat-subscriptions)' },
  other:          { label: 'Other',            icon: '\uD83D\uDCCC', color: 'var(--cat-other)' },
};

const DEFAULT_PAYMENT_METHODS = [
  { id: 'cash', type: 'cash', label: 'Cash', network: 'cash', lastFour: '', nameOnCard: '', isDefault: true },
];

function loadState() {
  const saved = localStorage.getItem('spendwise_state');
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to load state', e);
    }
  }
  return {
    expenses: [],
    paymentMethods: [...DEFAULT_PAYMENT_METHODS],
    settings: { theme: 'light', currency: '\u20B9' },
  };
}

function saveState() {
  localStorage.setItem('spendwise_state', JSON.stringify(state));
}

let state = loadState();
let currentSplitTab = 'pending';

// ========== NAVIGATION ==========

function navigateTo(viewName) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-link, .mobile-nav-link').forEach(l => l.classList.remove('active'));

  const view = document.getElementById('view-' + viewName);
  if (view) view.classList.add('active');

  document.querySelectorAll(`[data-view="${viewName}"]`).forEach(l => l.classList.add('active'));

  // Render the view
  switch (viewName) {
    case 'dashboard': renderDashboard(); break;
    case 'expenses': renderExpenses(); break;
    case 'add-expense': prepareAddExpenseView(); break;
    case 'splits': renderSplits(); break;
    case 'payment-methods': renderPaymentMethods(); break;
  }
}

// Set up nav clicks
document.querySelectorAll('.nav-link, .mobile-nav-link').forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    navigateTo(link.dataset.view);
  });
});

// ========== THEME ==========

function initTheme() {
  const theme = state.settings.theme || 'light';
  document.documentElement.setAttribute('data-theme', theme);
}

document.getElementById('themeToggle').addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  state.settings.theme = next;
  saveState();
});

// ========== TOAST NOTIFICATIONS ==========

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'toastOut 0.3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ========== UTILITY ==========

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

function formatCurrency(amount) {
  return state.settings.currency + parseFloat(amount).toFixed(2);
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateShort(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getPaymentMethodLabel(id) {
  const pm = state.paymentMethods.find(p => p.id === id);
  if (!pm) return 'Unknown';
  if (pm.type === 'cash') return 'Cash';
  if (pm.type === 'upi') return pm.label || 'UPI';
  return `${pm.network ? pm.network.toUpperCase() : 'Card'} ****${pm.lastFour}`;
}

function getCategoryBg(cat) {
  const c = CATEGORIES[cat];
  return c ? c.color : 'var(--cat-other)';
}

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// ========== DASHBOARD ==========

function renderDashboard() {
  // Date
  const now = new Date();
  document.getElementById('dashboard-date').textContent =
    now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const expenses = state.expenses;
  const currentMonth = getCurrentMonth();
  const monthExpenses = expenses.filter(e => e.date.startsWith(currentMonth));

  // Summary
  const totalSpent = expenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);
  const monthSpent = monthExpenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);
  const pendingSplits = expenses.filter(e => e.isSplit && !e.splitSettled).length;

  document.getElementById('total-spent').textContent = formatCurrency(totalSpent);
  document.getElementById('month-spent').textContent = formatCurrency(monthSpent);
  document.getElementById('pending-splits').textContent = pendingSplits;
  document.getElementById('total-transactions').textContent = expenses.length;

  // Category Breakdown (this month)
  renderCategoryChart(monthExpenses);

  // Recent transactions
  renderRecentTransactions(expenses.slice().sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)).slice(0, 8));
}

function renderCategoryChart(expenses) {
  const chart = document.getElementById('category-chart');

  if (expenses.length === 0) {
    chart.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">\uD83D\uDCCA</div>
        <h3>No expenses this month</h3>
        <p>Start tracking your spending to see a breakdown here.</p>
      </div>`;
    return;
  }

  // Aggregate by category
  const catTotals = {};
  expenses.forEach(e => {
    catTotals[e.category] = (catTotals[e.category] || 0) + parseFloat(e.amount);
  });

  const sorted = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);
  const maxAmount = sorted[0] ? sorted[0][1] : 1;

  chart.innerHTML = sorted.map(([cat, amount]) => {
    const c = CATEGORIES[cat] || CATEGORIES.other;
    const pct = (amount / maxAmount) * 100;
    return `
      <div class="cat-bar-row">
        <div class="cat-bar-icon" style="background: ${c.color}15; color: ${c.color}">${c.icon}</div>
        <div class="cat-bar-info">
          <div class="cat-bar-header">
            <span class="cat-bar-name">${c.label}</span>
            <span class="cat-bar-amount">${formatCurrency(amount)}</span>
          </div>
          <div class="cat-bar-track">
            <div class="cat-bar-fill" style="width: ${pct}%; background: ${c.color}"></div>
          </div>
        </div>
      </div>`;
  }).join('');
}

function renderRecentTransactions(expenses) {
  const list = document.getElementById('recent-list');

  if (expenses.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">\uD83D\uDCDD</div>
        <h3>No transactions yet</h3>
        <p>Add your first expense to get started!</p>
      </div>`;
    return;
  }

  list.innerHTML = expenses.map(e => {
    const c = CATEGORIES[e.category] || CATEGORIES.other;
    const splitBadge = e.isSplit ?
      `<span class="transaction-split-badge">\uD83D\uDC65 Split (${e.splitPeople})</span>` : '';
    return `
      <div class="transaction-item">
        <div class="transaction-cat-icon" style="background: ${c.color}15; color: ${c.color}">${c.icon}</div>
        <div class="transaction-info">
          <div class="transaction-desc">${escapeHtml(e.description)}${splitBadge}</div>
          <div class="transaction-meta">${formatDateShort(e.date)} &middot; ${getPaymentMethodLabel(e.paymentMethod)}</div>
        </div>
        <div class="transaction-amount">${formatCurrency(e.amount)}</div>
      </div>`;
  }).join('');
}

// ========== EXPENSES LIST ==========

function renderExpenses() {
  populateFilterDropdowns();

  const search = document.getElementById('search-expenses').value.toLowerCase();
  const catFilter = document.getElementById('filter-category').value;
  const payFilter = document.getElementById('filter-payment').value;
  const splitFilter = document.getElementById('filter-split').value;

  let filtered = [...state.expenses];

  if (search) {
    filtered = filtered.filter(e =>
      e.description.toLowerCase().includes(search) ||
      (CATEGORIES[e.category] && CATEGORIES[e.category].label.toLowerCase().includes(search))
    );
  }
  if (catFilter !== 'all') filtered = filtered.filter(e => e.category === catFilter);
  if (payFilter !== 'all') filtered = filtered.filter(e => e.paymentMethod === payFilter);
  if (splitFilter === 'split') filtered = filtered.filter(e => e.isSplit);
  if (splitFilter === 'not-split') filtered = filtered.filter(e => !e.isSplit);

  filtered.sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));

  const list = document.getElementById('expense-list');

  if (filtered.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">\uD83D\uDCCB</div>
        <h3>No expenses found</h3>
        <p>${state.expenses.length === 0 ? 'Add your first expense to see it here.' : 'Try adjusting your filters.'}</p>
      </div>`;
    return;
  }

  list.innerHTML = filtered.map(e => {
    const c = CATEGORIES[e.category] || CATEGORIES.other;
    const splitBadge = e.isSplit ?
      `<span class="transaction-split-badge">\uD83D\uDC65 ${e.splitPeople} people</span>` : '';
    const yourShare = e.isSplit ?
      `<div class="expense-your-share">Your share: ${formatCurrency(parseFloat(e.amount) / e.splitPeople)}</div>` : '';

    return `
      <div class="expense-item">
        <div class="expense-cat-icon" style="background: ${c.color}15; color: ${c.color}">${c.icon}</div>
        <div class="expense-details">
          <div class="expense-desc">${escapeHtml(e.description)}${splitBadge}</div>
          <div class="expense-meta">
            <span class="expense-meta-item">${formatDate(e.date)}</span>
            <span class="expense-meta-item">${c.label}</span>
            <span class="expense-meta-item">${getPaymentMethodLabel(e.paymentMethod)}</span>
          </div>
        </div>
        <div class="expense-amount-section">
          <div class="expense-amount">${formatCurrency(e.amount)}</div>
          ${yourShare}
        </div>
        <div class="expense-actions">
          <button class="btn btn-icon btn-secondary" onclick="editExpense('${e.id}')" title="Edit">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
          </button>
          <button class="btn btn-icon btn-danger" onclick="deleteExpense('${e.id}')" title="Delete">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        </div>
      </div>`;
  }).join('');
}

function populateFilterDropdowns() {
  // Category filter
  const catSelect = document.getElementById('filter-category');
  const catVal = catSelect.value;
  catSelect.innerHTML = '<option value="all">All Categories</option>';
  Object.entries(CATEGORIES).forEach(([key, val]) => {
    catSelect.innerHTML += `<option value="${key}" ${catVal === key ? 'selected' : ''}>${val.icon} ${val.label}</option>`;
  });

  // Payment filter
  const paySelect = document.getElementById('filter-payment');
  const payVal = paySelect.value;
  paySelect.innerHTML = '<option value="all">All Payment Methods</option>';
  state.paymentMethods.forEach(pm => {
    const label = pm.type === 'cash' ? 'Cash' : `${pm.label || (pm.network || 'Card').toUpperCase()} ****${pm.lastFour}`;
    paySelect.innerHTML += `<option value="${pm.id}" ${payVal === pm.id ? 'selected' : ''}>${label}</option>`;
  });
}

// Attach filter listeners
['search-expenses', 'filter-category', 'filter-payment', 'filter-split'].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener(el.type === 'text' ? 'input' : 'change', renderExpenses);
});

// ========== ADD / EDIT EXPENSE ==========

function prepareAddExpenseView() {
  // Populate payment methods dropdown
  const paySelect = document.getElementById('expense-payment');
  paySelect.innerHTML = '<option value="">Select payment method...</option>';
  state.paymentMethods.forEach(pm => {
    const label = pm.type === 'cash' ? 'Cash' : `${pm.label || (pm.network || 'Card').toUpperCase()} ****${pm.lastFour}`;
    paySelect.innerHTML += `<option value="${pm.id}">${label}</option>`;
  });

  // Default date to today
  if (!document.getElementById('expense-date').value) {
    document.getElementById('expense-date').value = new Date().toISOString().split('T')[0];
  }

  // Pre-select default payment method if none selected
  if (!document.getElementById('expense-payment').value) {
    const def = state.paymentMethods.find(p => p.isDefault);
    if (def) document.getElementById('expense-payment').value = def.id;
  }
}

// Split toggle
document.getElementById('split-toggle').addEventListener('change', function () {
  document.getElementById('split-details').classList.toggle('hidden', !this.checked);
  updateSplitShare();
});

document.getElementById('split-people').addEventListener('input', updateSplitShare);
document.getElementById('expense-amount').addEventListener('input', updateSplitShare);

function updateSplitShare() {
  const amount = parseFloat(document.getElementById('expense-amount').value) || 0;
  const people = parseInt(document.getElementById('split-people').value) || 2;
  document.getElementById('split-share').textContent = formatCurrency(amount / people);
}

function saveExpense() {
  const desc = document.getElementById('expense-description').value.trim();
  const amount = parseFloat(document.getElementById('expense-amount').value);
  const category = document.getElementById('expense-category').value;
  const date = document.getElementById('expense-date').value;
  const paymentMethod = document.getElementById('expense-payment').value;
  const notes = document.getElementById('expense-notes').value.trim();
  const isSplit = document.getElementById('split-toggle').checked;
  const splitPeople = isSplit ? parseInt(document.getElementById('split-people').value) || 2 : 0;
  const splitNames = isSplit ? document.getElementById('split-names').value.trim() : '';

  // Validation
  if (!desc) { showToast('Please enter a description.', 'error'); return; }
  if (!amount || amount <= 0) { showToast('Please enter a valid amount.', 'error'); return; }
  if (!category) { showToast('Please select a category.', 'error'); return; }
  if (!date) { showToast('Please select a date.', 'error'); return; }
  if (!paymentMethod) { showToast('Please select a payment method.', 'error'); return; }

  const editId = document.getElementById('edit-expense-id').value;

  const expense = {
    id: editId || generateId(),
    description: desc,
    amount: amount,
    category: category,
    date: date,
    paymentMethod: paymentMethod,
    notes: notes,
    isSplit: isSplit,
    splitPeople: splitPeople,
    splitNames: splitNames ? splitNames.split(',').map(n => n.trim()).filter(Boolean) : [],
    splitSettled: false,
    createdAt: editId ? (state.expenses.find(e => e.id === editId) || {}).createdAt || new Date().toISOString() : new Date().toISOString(),
  };

  if (editId) {
    const idx = state.expenses.findIndex(e => e.id === editId);
    if (idx !== -1) {
      expense.splitSettled = state.expenses[idx].splitSettled;
      state.expenses[idx] = expense;
    }
    showToast('Expense updated successfully!', 'success');
  } else {
    state.expenses.push(expense);
    showToast('Expense added successfully!', 'success');
  }

  saveState();
  resetExpenseForm();
  navigateTo('expenses');
}

function editExpense(id) {
  const expense = state.expenses.find(e => e.id === id);
  if (!expense) return;

  navigateTo('add-expense');

  document.getElementById('expense-form-title').textContent = 'Edit Expense';
  document.getElementById('edit-expense-id').value = expense.id;
  document.getElementById('expense-description').value = expense.description;
  document.getElementById('expense-amount').value = expense.amount;
  document.getElementById('expense-category').value = expense.category;
  document.getElementById('expense-date').value = expense.date;
  document.getElementById('expense-payment').value = expense.paymentMethod;
  document.getElementById('expense-notes').value = expense.notes || '';
  document.getElementById('split-toggle').checked = expense.isSplit;
  document.getElementById('split-details').classList.toggle('hidden', !expense.isSplit);

  if (expense.isSplit) {
    document.getElementById('split-people').value = expense.splitPeople;
    document.getElementById('split-names').value = (expense.splitNames || []).join(', ');
  }
  updateSplitShare();
}

function deleteExpense(id) {
  if (!confirm('Delete this expense?')) return;
  state.expenses = state.expenses.filter(e => e.id !== id);
  saveState();
  showToast('Expense deleted.', 'info');
  renderExpenses();
}

function resetExpenseForm() {
  document.getElementById('expense-form-title').textContent = 'Add Expense';
  document.getElementById('edit-expense-id').value = '';
  document.getElementById('expense-form').reset();
  document.getElementById('split-toggle').checked = false;
  document.getElementById('split-details').classList.add('hidden');
  document.getElementById('expense-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('split-share').textContent = formatCurrency(0);
}

// ========== SPLIT REQUESTS ==========

function switchSplitTab(tab) {
  currentSplitTab = tab;
  document.querySelectorAll('.split-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  renderSplits();
}

function renderSplits() {
  const list = document.getElementById('splits-list');
  const splitExpenses = state.expenses.filter(e => e.isSplit);

  let filtered;
  if (currentSplitTab === 'pending') {
    filtered = splitExpenses.filter(e => !e.splitSettled);
  } else {
    filtered = splitExpenses.filter(e => e.splitSettled);
  }

  filtered.sort((a, b) => b.date.localeCompare(a.date));

  if (filtered.length === 0) {
    const msg = currentSplitTab === 'pending'
      ? 'No pending split requests.'
      : 'No settled splits yet.';
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">\uD83D\uDC65</div>
        <h3>${msg}</h3>
        <p>Mark an expense as split when adding it to create split requests.</p>
      </div>`;
    return;
  }

  list.innerHTML = filtered.map(e => {
    const c = CATEGORIES[e.category] || CATEGORIES.other;
    const perPerson = parseFloat(e.amount) / e.splitPeople;
    const names = e.splitNames && e.splitNames.length > 0 ? e.splitNames : Array(e.splitPeople - 1).fill(null).map((_, i) => `Person ${i + 1}`);

    const peopleHtml = names.map(name => {
      const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
      return `
        <span class="split-person">
          <span class="split-person-avatar">${initials}</span>
          ${escapeHtml(name)}
        </span>`;
    }).join('');

    const statusBadge = e.splitSettled
      ? '<span class="split-status-badge settled">\u2713 Settled</span>'
      : '<span class="split-status-badge pending">\u25CF Pending</span>';

    const actions = e.splitSettled
      ? `<button class="btn btn-sm btn-secondary" onclick="unsettleSplit('${e.id}')">Mark Unsettled</button>`
      : `<button class="btn btn-sm btn-success" onclick="settleSplit('${e.id}')">Mark Settled</button>`;

    return `
      <div class="split-card">
        <div class="split-card-header">
          <div>
            <div class="split-card-title">${c.icon} ${escapeHtml(e.description)}</div>
            ${statusBadge}
          </div>
          <div class="split-card-amount">${formatCurrency(e.amount)}</div>
        </div>
        <div class="split-card-meta">
          <span>${formatDate(e.date)}</span>
          <span>${c.label}</span>
          <span>${getPaymentMethodLabel(e.paymentMethod)}</span>
        </div>
        <div class="split-per-person">
          Each person owes <strong>${formatCurrency(perPerson)}</strong> (split ${e.splitPeople} ways)
        </div>
        <div class="split-people-list">${peopleHtml}</div>
        <div class="split-card-actions">${actions}</div>
      </div>`;
  }).join('');
}

function settleSplit(id) {
  const expense = state.expenses.find(e => e.id === id);
  if (expense) {
    expense.splitSettled = true;
    saveState();
    showToast('Split marked as settled!', 'success');
    renderSplits();
  }
}

function unsettleSplit(id) {
  const expense = state.expenses.find(e => e.id === id);
  if (expense) {
    expense.splitSettled = false;
    saveState();
    showToast('Split marked as pending.', 'info');
    renderSplits();
  }
}

// ========== PAYMENT METHODS ==========

function renderPaymentMethods() {
  const list = document.getElementById('payment-methods-list');

  if (state.paymentMethods.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">\uD83D\uDCB3</div>
        <h3>No payment methods</h3>
        <p>Add a card or payment method to get started.</p>
      </div>`;
    return;
  }

  list.innerHTML = state.paymentMethods.map(pm => {
    const network = (pm.network || pm.type || 'default').toLowerCase();
    const visualClass = ['visa', 'mastercard', 'amex', 'discover', 'rupay', 'upi', 'cash'].includes(network) ? network : 'default';
    const defaultBadge = pm.isDefault ? '<span class="default-badge">Default</span>' : '';
    const defaultClass = pm.isDefault ? 'is-default' : '';

    let displayNumber, displayType;
    if (pm.type === 'cash') {
      displayNumber = 'CASH';
      displayType = 'Cash';
    } else if (pm.type === 'upi') {
      displayNumber = pm.lastFour || 'UPI';
      displayType = 'UPI';
    } else {
      displayNumber = '\u2022\u2022\u2022\u2022  \u2022\u2022\u2022\u2022  \u2022\u2022\u2022\u2022  ' + (pm.lastFour || '????');
      displayType = (pm.network || 'Card').toUpperCase();
    }

    return `
      <div class="payment-card ${defaultClass}">
        <div class="payment-card-visual ${visualClass}">
          <div class="payment-card-type">${displayType}</div>
          <div class="payment-card-number">${displayNumber}</div>
          <div class="payment-card-name">${escapeHtml(pm.nameOnCard || pm.label || '')}</div>
        </div>
        <div class="payment-card-info">
          <div>
            <span class="payment-card-label">${escapeHtml(pm.label || displayType)}</span>
            ${defaultBadge}
          </div>
          <div class="payment-card-actions">
            ${!pm.isDefault ? `<button class="btn btn-sm btn-secondary" onclick="setDefaultPayment('${pm.id}')">Set Default</button>` : ''}
            ${pm.id !== 'cash' ? `<button class="btn btn-sm btn-danger" onclick="deletePaymentMethod('${pm.id}')">Remove</button>` : ''}
          </div>
        </div>
      </div>`;
  }).join('');
}

function showAddPaymentModal() {
  document.getElementById('modal-title').textContent = 'Add Payment Method';
  document.getElementById('modal-body').innerHTML = `
    <form id="payment-form" onsubmit="return false;">
      <div class="form-group">
        <label for="pm-type">Type</label>
        <select id="pm-type" onchange="onPaymentTypeChange()">
          <option value="card">Credit/Debit Card</option>
          <option value="upi">UPI</option>
        </select>
      </div>
      <div id="pm-card-fields">
        <div class="form-group">
          <label for="pm-network">Card Network</label>
          <select id="pm-network">
            <option value="visa">Visa</option>
            <option value="mastercard">Mastercard</option>
            <option value="amex">American Express</option>
            <option value="rupay">RuPay</option>
            <option value="discover">Discover</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div class="form-group">
          <label for="pm-last-four">Last 4 Digits</label>
          <input type="text" id="pm-last-four" maxlength="4" pattern="[0-9]{4}" placeholder="1234" />
        </div>
        <div class="form-group">
          <label for="pm-name">Name on Card</label>
          <input type="text" id="pm-name" placeholder="John Doe" />
        </div>
      </div>
      <div id="pm-upi-fields" class="hidden">
        <div class="form-group">
          <label for="pm-upi-id">UPI ID</label>
          <input type="text" id="pm-upi-id" placeholder="yourname@upi" />
        </div>
      </div>
      <div class="form-group">
        <label for="pm-label">Label (optional)</label>
        <input type="text" id="pm-label" placeholder="e.g. My HDFC Card, Personal UPI" />
      </div>
      <div class="form-actions" style="border: none; padding-top: 12px; margin-top: 8px;">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button type="button" class="btn btn-primary" onclick="addPaymentMethod()">Add Method</button>
      </div>
    </form>`;

  document.getElementById('modal-overlay').classList.remove('hidden');
}

function onPaymentTypeChange() {
  const type = document.getElementById('pm-type').value;
  document.getElementById('pm-card-fields').classList.toggle('hidden', type !== 'card');
  document.getElementById('pm-upi-fields').classList.toggle('hidden', type !== 'upi');
}

function addPaymentMethod() {
  const type = document.getElementById('pm-type').value;
  let pm;

  if (type === 'card') {
    const network = document.getElementById('pm-network').value;
    const lastFour = document.getElementById('pm-last-four').value.trim();
    const name = document.getElementById('pm-name').value.trim();
    const label = document.getElementById('pm-label').value.trim();

    if (!lastFour || lastFour.length !== 4 || !/^\d{4}$/.test(lastFour)) {
      showToast('Please enter valid last 4 digits.', 'error');
      return;
    }

    pm = {
      id: generateId(),
      type: 'card',
      network: network,
      lastFour: lastFour,
      nameOnCard: name,
      label: label || `${network.toUpperCase()} ****${lastFour}`,
      isDefault: state.paymentMethods.length === 0,
    };
  } else {
    const upiId = document.getElementById('pm-upi-id').value.trim();
    const label = document.getElementById('pm-label').value.trim();

    if (!upiId) {
      showToast('Please enter a UPI ID.', 'error');
      return;
    }

    pm = {
      id: generateId(),
      type: 'upi',
      network: 'upi',
      lastFour: upiId.split('@')[0].slice(-4),
      nameOnCard: upiId,
      label: label || upiId,
      isDefault: state.paymentMethods.length === 0,
    };
  }

  state.paymentMethods.push(pm);
  saveState();
  closeModal();
  showToast('Payment method added!', 'success');
  renderPaymentMethods();
}

function setDefaultPayment(id) {
  state.paymentMethods.forEach(pm => { pm.isDefault = (pm.id === id); });
  saveState();
  showToast('Default payment method updated.', 'info');
  renderPaymentMethods();
}

function deletePaymentMethod(id) {
  // Check if any expense uses this method
  const inUse = state.expenses.some(e => e.paymentMethod === id);
  if (inUse) {
    showToast('Cannot remove: this method is used by existing expenses.', 'error');
    return;
  }
  state.paymentMethods = state.paymentMethods.filter(pm => pm.id !== id);
  saveState();
  showToast('Payment method removed.', 'info');
  renderPaymentMethods();
}

// ========== MODAL ==========

function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
}

document.getElementById('modal-overlay').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closeModal();
});

// ========== HTML ESCAPING ==========

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ========== INIT ==========

function init() {
  initTheme();
  navigateTo('dashboard');
}

init();
