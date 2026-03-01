const API = 'http://localhost:5000/api';
let currentUser = null, token = localStorage.getItem('token');
let allResults = [], socket;

// ── INIT ──────────────────────────────────────────────────────────────────────
window.onload = () => {
  const saved = localStorage.getItem('user');
  if (token && saved) { currentUser = JSON.parse(saved); updateNav(); }
  showPage('home');
  initSocket();
};

// ── REAL-TIME SOCKET.IO ───────────────────────────────────────────────────────
function initSocket() {
  socket = io();

  socket.on('connect', () => {
    showRTBar('🟢 Real-time updates connected!');
  });

  socket.on('stock-updated', (data) => {
    showRTBar('📦 Stock updated live for a medicine!');
    // Update any visible stock numbers
    const stockEl = document.querySelector(`[data-medicine="${data.medicine}"][data-store="${data.store}"]`);
    if (stockEl) { stockEl.textContent = data.stock + ' units'; stockEl.style.color = data.stock < 10 ? '#ef4444' : '#16a34a'; }
    showToast('📦 Stock updated in real-time!');
  });

  socket.on('order-placed', (data) => {
    showRTBar('🛒 New order placed — stock updated!');
  });

  socket.on('order-status-updated', (data) => {
    if (currentUser && data.userId === currentUser.id) {
      showToast('✅ Your order status updated: ' + data.status.toUpperCase());
      const badge = document.getElementById('orderBadge');
      if (badge) { badge.style.display = 'inline'; badge.textContent = '!'; }
    }
  });

  socket.on('store-updated', (data) => {
    showRTBar('🏪 Store info updated: ' + (data.name || ''));
  });
}

function showRTBar(msg) {
  const bar = document.getElementById('rtBar');
  document.getElementById('rtMsg').textContent = msg;
  bar.style.display = 'flex';
  setTimeout(() => { bar.style.display = 'none'; }, 5000);
}

// ── NAVIGATION ────────────────────────────────────────────────────────────────
function showPage(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const el = document.getElementById('page-' + page);
  if (el) el.classList.add('active');
  if (page === 'stores') loadStores();
  if (page === 'orders') loadOrders();
  if (page === 'dashboard') loadDashboard();
}

// ── HERO SEARCH ───────────────────────────────────────────────────────────────
function heroType(v) { if (v.length > 1) { showPage('search'); document.getElementById('mainSearch').value = v; searchMedicines(v); } }
function goSearch() { const v = document.getElementById('heroSearch').value; showPage('search'); document.getElementById('mainSearch').value = v; searchMedicines(v); }
function qs(name) { showPage('search'); document.getElementById('mainSearch').value = name; searchMedicines(name); }

// ── AUTH ──────────────────────────────────────────────────────────────────────
async function login() {
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;
  const errEl = document.getElementById('loginError');
  errEl.style.display = 'none';
  if (!email || !password) { showErr('loginError', 'Please fill in all fields'); return; }
  try {
    const data = await post('/auth/login', { email, password });
    setUser(data);
    showToast('Welcome back, ' + currentUser.name + '! 👋');
    showPage('home');
  } catch (err) { showErr('loginError', err.message); }
}

async function register() {
  const name = document.getElementById('rName').value;
  const email = document.getElementById('rEmail').value;
  const password = document.getElementById('rPass').value;
  const phone = document.getElementById('rPhone').value;
  const role = document.getElementById('rRole').value;
  if (!name || !email || !password) { showErr('registerError', 'Please fill required fields'); return; }
  try {
    const data = await post('/auth/register', { name, email, password, phone, role });
    setUser(data);
    showToast('Account created! Welcome ' + name + ' 🎉');
    showPage('home');
  } catch (err) { showErr('registerError', err.message); }
}

function setUser(data) {
  token = data.token; currentUser = data.user;
  localStorage.setItem('token', token); localStorage.setItem('user', JSON.stringify(currentUser));
  updateNav();
}

function logout() {
  token = null; currentUser = null;
  localStorage.removeItem('token'); localStorage.removeItem('user');
  document.getElementById('authLinks').style.display = 'inline-flex';
  document.getElementById('userLinks').style.display = 'none';
  showToast('Logged out'); showPage('home');
}

function updateNav() {
  document.getElementById('authLinks').style.display = 'none';
  document.getElementById('userLinks').style.display = 'inline-flex';
  document.getElementById('userName').textContent = '👤 ' + currentUser.name;
}

function fill(e, p) { document.getElementById('loginEmail').value = e; document.getElementById('loginPassword').value = p; }

// ── SEARCH ────────────────────────────────────────────────────────────────────
let searchTimer;
function searchMedicines(q) {
  clearTimeout(searchTimer);
  if (!q || q.length < 2) return;
  searchTimer = setTimeout(() => doSearch(q), 350);
}

async function doSearch(q) {
  const el = document.getElementById('searchResults');
  el.innerHTML = `<div class="loading"><div class="spinner"></div><p>Searching for "${q}"...</p></div>`;
  try {
    const meds = await get('/medicines/search?q=' + encodeURIComponent(q));
    allResults = meds;
    renderResults(meds, q);
  } catch {
    el.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-circle"></i><h3>Connection error</h3><p>Make sure server is running</p></div>`;
  }
}

function renderResults(meds, q) {
  const el = document.getElementById('searchResults');
  if (!meds.length) {
    el.innerHTML = `<div class="empty-state"><i class="fas fa-pills"></i><h3>No results for "${q}"</h3><p>Try: Paracetamol, Aspirin, Vitamin D, Diabetes...</p></div>`;
    return;
  }
  el.innerHTML = `<p style="color:#64748b;margin-bottom:1rem;font-size:0.9rem">Found <strong>${meds.length}</strong> result(s) for "<strong>${q}</strong>"</p>` +
    meds.map((m, i) => `
      <div class="med-card" onclick="viewMed('${m._id}')">
        <div class="med-card-info">
          <h3>${m.name} ${i === 0 && meds.length > 1 ? '<span class="badge b-purple" style="margin-left:4px">Top Match</span>' : ''}</h3>
          <p>${m.genericName ? m.genericName + ' · ' : ''}${m.manufacturer || ''}</p>
          <div class="med-badges">
            ${m.category ? `<span class="badge b-blue">${m.category}</span>` : ''}
            ${m.requiresPrescription ? `<span class="badge b-orange">Rx Required</span>` : `<span class="badge b-green">OTC</span>`}
            ${m.availableIn > 0 ? `<span class="badge b-green">✓ Available in ${m.availableIn} store(s)</span>` : `<span class="badge b-red">✗ Out of stock</span>`}
          </div>
        </div>
        <div class="med-card-right">
          ${m.lowestPrice !== null ? `<div class="avail-count">from</div><div class="lowest-price">₹${m.lowestPrice.toFixed(2)}</div>` : '<div class="avail-count">No stock</div>'}
          <div class="view-link">View Details →</div>
        </div>
      </div>`).join('');
}

function filterResults(type, el) {
  document.querySelectorAll('.filter-tag').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  let filtered = [...allResults];
  if (type === 'otc') filtered = filtered.filter(m => !m.requiresPrescription);
  if (type === 'rx') filtered = filtered.filter(m => m.requiresPrescription);
  if (type === 'discount') filtered = filtered.filter(m => m.lowestPrice !== null);
  renderResults(filtered, document.getElementById('mainSearch').value);
}

// ── MEDICINE DETAIL ───────────────────────────────────────────────────────────
async function viewMed(id) {
  showPage('medicine');
  const el = document.getElementById('medicineDetail');
  el.innerHTML = `<div class="loading" style="padding:4rem"><div class="spinner"></div><p>Loading...</p></div>`;
  try {
    const [{ medicine, availability }, alternatives] = await Promise.all([get('/medicines/' + id), get('/medicines/' + id + '/alternatives')]);
    const lowest = availability.length ? availability[0] : null;

    el.innerHTML = `
      <div class="med-detail">
        <button class="back-btn" onclick="showPage('search')"><i class="fas fa-arrow-left"></i> Back</button>

        <div class="med-detail-header">
          <h1>${medicine.name}</h1>
          <p style="opacity:0.85;margin-top:4px">${medicine.genericName ? medicine.genericName + ' · ' : ''}${medicine.manufacturer || ''} ${medicine.dosage ? '· ' + medicine.dosage : ''}</p>
          ${medicine.description ? `<p style="opacity:0.8;margin-top:8px;font-size:0.9rem">${medicine.description}</p>` : ''}
          <div style="margin-top:1rem;display:flex;gap:8px;flex-wrap:wrap">
            ${medicine.category ? `<span class="badge" style="background:rgba(255,255,255,0.2);color:white">${medicine.category}</span>` : ''}
            ${medicine.requiresPrescription ? `<span class="badge" style="background:rgba(255,200,0,0.25);color:#fef3c7">⚕️ Prescription Required</span>` : `<span class="badge" style="background:rgba(0,255,100,0.2);color:#d1fae5">✓ Over The Counter</span>`}
            ${lowest ? `<span class="badge" style="background:rgba(255,255,255,0.2);color:white">💰 From ₹${(lowest.price*(1-(lowest.discount||0)/100)).toFixed(2)}</span>` : ''}
            <span class="badge" style="background:rgba(255,255,255,0.15);color:white"><span class="live-dot"></span> Live Stock</span>
          </div>
        </div>

        <div class="detail-grid">
          <div class="dcard">
            <h3><i class="fas fa-stethoscope"></i> Uses & Indications</h3>
            <ul>${medicine.uses?.length ? medicine.uses.map(u=>`<li>${u}</li>`).join('') : '<li>Not specified</li>'}</ul>
          </div>
          <div class="dcard">
            <h3><i class="fas fa-exclamation-triangle"></i> Side Effects</h3>
            <ul>${medicine.sideEffects?.length ? medicine.sideEffects.map(s=>`<li>${s}</li>`).join('') : '<li>Not specified</li>'}</ul>
          </div>
        </div>

        <div class="avail-section">
          <h2><i class="fas fa-store" style="color:#1a56db"></i> Available at ${availability.length} Store(s) <span style="font-size:0.8rem;font-weight:400;color:#64748b">— sorted cheapest first</span></h2>
          ${availability.length ? availability.map((inv, i) => {
            const finalP = (inv.price*(1-(inv.discount||0)/100)).toFixed(2);
            return `
              <div class="store-avail-card ${i===0?'cheapest':''}">
                <div class="sinfo">
                  <h4>${inv.store?.name || 'Unknown'} ${i===0?'<span class="cheapest-tag">CHEAPEST</span>':''}</h4>
                  <p><i class="fas fa-map-marker-alt"></i>${inv.store?.address||''}</p>
                  <p><i class="fas fa-clock"></i>${inv.store?.openingHours||''} <span style="color:${inv.store?.isOpen?'#16a34a':'#dc2626'};font-weight:600">${inv.store?.isOpen?'● Open':'● Closed'}</span></p>
                  <p><i class="fas fa-box"></i><span data-medicine="${medicine._id}" data-store="${inv.store?._id}" style="color:${inv.stock<10?'#ef4444':'#16a34a'};font-weight:600">${inv.stock} units</span> in stock</p>
                  ${inv.expiryDate ? `<p><i class="fas fa-calendar"></i>Expires: ${inv.expiryDate}</p>` : ''}
                </div>
                <div style="display:flex;align-items:center;gap:1rem;flex-wrap:wrap">
                  <div class="sprice">
                    ${inv.discount ? `<div class="orig-price">₹${inv.price.toFixed(2)}</div>` : ''}
                    <div class="final-price">₹${finalP}</div>
                    ${inv.discount ? `<div class="disc-tag">🏷️ ${inv.discount}% OFF</div>` : ''}
                  </div>
                  ${currentUser
                    ? `<button class="btn-order" onclick="placeOrder('${inv.store?._id}','${medicine._id}','${inv.price}','${inv.discount||0}')"><i class="fas fa-cart-plus"></i> Order</button>`
                    : `<button class="btn-order" onclick="showPage('login')">Login to Order</button>`}
                </div>
              </div>`;
          }).join('') : `<div class="empty-state"><i class="fas fa-store-slash"></i><h3>Not available anywhere right now</h3></div>`}
        </div>

        ${alternatives.length ? `
        <div class="alt-section">
          <h2>🤖 AI Suggested Alternatives <span style="font-size:0.8rem;font-weight:400;color:#64748b">— may save you money!</span></h2>
          ${alternatives.map(a => `
            <div class="alt-card" onclick="viewMed('${a.medicine._id}')">
              <div>
                <strong>${a.medicine.name}</strong>
                <div style="color:#64748b;font-size:0.82rem">${a.medicine.genericName||''} · ${a.medicine.category||''}</div>
                ${!a.medicine.requiresPrescription ? '<span class="badge b-green" style="margin-top:4px">OTC</span>' : ''}
              </div>
              <div style="text-align:right">
                ${a.cheapestOption
                  ? `<div style="color:#16a34a;font-weight:700;font-size:1.1rem">₹${(a.cheapestOption.price*(1-(a.cheapestOption.discount||0)/100)).toFixed(2)}</div>
                     <div style="font-size:0.75rem;color:#64748b">${a.cheapestOption.store?.name||''}</div>`
                  : '<div style="color:#9ca3af;font-size:0.82rem">Check stock</div>'}
                <div style="color:#1a56db;font-size:0.78rem;margin-top:3px">View →</div>
              </div>
            </div>`).join('')}
        </div>` : ''}
      </div>`;
  } catch (err) {
    el.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-circle"></i><h3>Error loading</h3><p>${err.message}</p></div>`;
  }
}

// ── ORDER ─────────────────────────────────────────────────────────────────────
async function placeOrder(storeId, medId, price, discount) {
  if (!currentUser) { showPage('login'); return; }
  const qty = prompt('How many units? (Enter number)', '1');
  if (!qty || isNaN(qty) || parseInt(qty) <= 0) return;
  try {
    const data = await post('/orders', { store: storeId, items: [{ medicine: medId, quantity: parseInt(qty), price: parseFloat(price) }] }, true);
    showToast('✅ Order placed! Total: ₹' + data.totalAmount);
    setTimeout(() => showPage('orders'), 1500);
  } catch (err) { showToast('❌ ' + err.message); }
}

// ── STORES ────────────────────────────────────────────────────────────────────
async function loadStores() {
  const el = document.getElementById('storesList');
  if (!el) return;
  el.innerHTML = `<div class="loading"><div class="spinner"></div></div>`;
  try {
    const stores = await get('/stores');
    document.getElementById('storeCount').textContent = stores.length;
    el.innerHTML = stores.map(s => `
      <div class="store-card">
        <h3><i class="fas fa-store" style="color:#1a56db"></i>${s.name}</h3>
        <p><i class="fas fa-map-marker-alt"></i>${s.address}</p>
        ${s.phone ? `<p><i class="fas fa-phone"></i>${s.phone}</p>` : ''}
        ${s.openingHours ? `<p><i class="fas fa-clock"></i>${s.openingHours}</p>` : ''}
        ${s.rating ? `<p><i class="fas fa-star" style="color:#f59e0b"></i><span class="store-rating">${s.rating}/5</span></p>` : ''}
        <span class="open-badge ${s.isOpen?'is-open':'is-closed'}">${s.isOpen?'● Open Now':'● Closed'}</span>
      </div>`).join('');
  } catch {
    el.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-circle"></i><h3>Error loading</h3></div>`;
  }
}

// ── ORDERS ────────────────────────────────────────────────────────────────────
async function loadOrders() {
  if (!currentUser) { showPage('login'); return; }
  const el = document.getElementById('ordersList');
  el.innerHTML = `<div class="loading"><div class="spinner"></div></div>`;
  try {
    const orders = await get('/orders/my-orders', true);
    const colors = { pending:'#f59e0b', confirmed:'#3b82f6', ready:'#8b5cf6', completed:'#16a34a', cancelled:'#ef4444' };
    el.innerHTML = orders.length ? orders.map(o => `
      <div class="order-card">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.5rem;margin-bottom:0.5rem">
          <h4 style="font-weight:700">${o.store?.name || 'Unknown Store'}</h4>
          <span class="order-status-badge" style="background:${colors[o.status]}20;color:${colors[o.status]}">${o.status.toUpperCase()}</span>
        </div>
        <p style="color:#64748b;font-size:0.88rem">${o.items?.map(i=>i.medicine?.name||'Medicine').join(', ')}</p>
        <div style="display:flex;justify-content:space-between;margin-top:0.8rem;align-items:center">
          <span style="color:#9ca3af;font-size:0.8rem"><i class="fas fa-clock"></i> ${new Date(o.createdAt).toLocaleString()}</span>
          <strong style="color:#16a34a;font-size:1.1rem">₹${o.totalAmount?.toFixed(2)}</strong>
        </div>
      </div>`).join('') :
      `<div class="empty-state"><i class="fas fa-shopping-bag"></i><h3>No orders yet</h3><p>Search and order your first medicine!</p></div>`;
  } catch {
    el.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-circle"></i><h3>Error loading orders</h3></div>`;
  }
}

// ── DASHBOARD ─────────────────────────────────────────────────────────────────
function loadDashboard() {
  if (!currentUser) { showPage('login'); return; }
  const el = document.getElementById('dashboardContent');
  if (currentUser.role === 'admin') el.innerHTML = adminDash();
  else if (currentUser.role === 'store') el.innerHTML = storeDash();
  else el.innerHTML = userDash();
}

function userDash() {
  return `<div class="dashboard">
    <h1>Welcome, ${currentUser.name}! 👋</h1>
    <div class="stat-grid">
      <div class="scard"><i class="fas fa-pills"></i><div class="val">50+</div><div class="lbl">Medicines</div></div>
      <div class="scard"><i class="fas fa-store"></i><div class="val">4</div><div class="lbl">Stores</div></div>
      <div class="scard"><i class="fas fa-bolt"></i><div class="val">Live</div><div class="lbl">Real-time</div></div>
    </div>
    <button class="btn-primary" style="max-width:180px" onclick="showPage('search')"><i class="fas fa-search"></i> Search Medicines</button>
  </div>`;
}

function storeDash() {
  return `<div class="dashboard">
    <h1>Store Dashboard 🏪</h1>
    <div class="dash-tabs">
      <button class="dtab active" onclick="swTab(event,'t-inv')">📦 Inventory</button>
      <button class="dtab" onclick="swTab(event,'t-orders')">📋 Orders</button>
      <button class="dtab" onclick="swTab(event,'t-analytics')">📊 Analytics</button>
      <button class="dtab" onclick="swTab(event,'t-lowstock')">⚠️ Low Stock</button>
    </div>
    <div id="t-inv" class="tcontent active">
      <div class="white-box">
        <h3 style="margin-bottom:1rem">➕ Add / Update Inventory</h3>
        <div class="form-group"><label>Medicine Name</label><input type="text" id="invMed" placeholder="e.g. Paracetamol 500mg"/></div>
        <div class="form-group"><label>Price (₹)</label><input type="number" id="invPrice" placeholder="0.00"/></div>
        <div class="form-group"><label>Stock Quantity</label><input type="number" id="invStock" placeholder="0"/></div>
        <div class="form-group"><label>Discount (%)</label><input type="number" id="invDiscount" placeholder="0" min="0" max="50"/></div>
        <div class="form-group"><label>Expiry Date</label><input type="date" id="invExpiry"/></div>
        <button class="btn-primary" onclick="showToast('Connect your store ID to save inventory!')">Update Inventory</button>
      </div>
    </div>
    <div id="t-orders" class="tcontent">
      <h3 style="margin-bottom:1rem">Incoming Orders</h3>
      <p style="color:#64748b">Customer orders appear here in real-time via Socket.io.</p>
    </div>
    <div id="t-analytics" class="tcontent">
      <div class="stat-grid">
        <div class="scard"><i class="fas fa-rupee-sign"></i><div class="val">₹0</div><div class="lbl">Revenue</div></div>
        <div class="scard"><i class="fas fa-shopping-cart"></i><div class="val">0</div><div class="lbl">Orders</div></div>
        <div class="scard"><i class="fas fa-pills"></i><div class="val">0</div><div class="lbl">In Stock</div></div>
        <div class="scard"><i class="fas fa-exclamation-triangle" style="color:#f59e0b"></i><div class="val">0</div><div class="lbl">Low Stock</div></div>
      </div>
    </div>
    <div id="t-lowstock" class="tcontent">
      <h3 style="margin-bottom:1rem">⚠️ Low Stock Alerts</h3>
      <div id="lowStockList"><div class="loading"><div class="spinner"></div></div></div>
    </div>
  </div>`;
}

function adminDash() {
  return `<div class="dashboard">
    <h1>Admin Dashboard 🛡️</h1>
    <div class="dash-tabs">
      <button class="dtab active" onclick="swTab(event,'t-addmed')">💊 Add Medicine</button>
      <button class="dtab" onclick="swTab(event,'t-allstores');loadAdminStores()">🏪 Stores</button>
      <button class="dtab" onclick="swTab(event,'t-allorders');loadAllOrders()">📋 All Orders</button>
    </div>
    <div id="t-addmed" class="tcontent active">
      <div class="white-box">
        <h3 style="margin-bottom:1rem">Add New Medicine to Database</h3>
        <div class="form-group"><label>Medicine Name *</label><input type="text" id="mName" placeholder="e.g. Paracetamol 500mg"/></div>
        <div class="form-group"><label>Generic Name</label><input type="text" id="mGeneric" placeholder="e.g. Acetaminophen"/></div>
        <div class="form-group"><label>Category</label>
          <select id="mCat"><option>Analgesic</option><option>Antibiotic</option><option>Antidiabetic</option><option>Antihypertensive</option><option>Antacid</option><option>Antihistamine</option><option>Antifungal</option><option>Vitamin</option><option>Supplement</option><option>Respiratory</option><option>Antihyperlipidemic</option><option>Thyroid</option><option>Antidepressant</option><option>Anxiolytic</option><option>Other</option></select>
        </div>
        <div class="form-group"><label>Manufacturer</label><input type="text" id="mMfr" placeholder="e.g. Sun Pharma"/></div>
        <div class="form-group"><label>Description</label><input type="text" id="mDesc" placeholder="Brief description..."/></div>
        <div class="form-group"><label>Uses (comma separated)</label><input type="text" id="mUses" placeholder="Pain relief, Fever, Headache"/></div>
        <div class="form-group"><label>Side Effects (comma separated)</label><input type="text" id="mSE" placeholder="Nausea, Headache, Dizziness"/></div>
        <div class="form-group"><label>Dosage</label><input type="text" id="mDosage" placeholder="1 tablet twice daily"/></div>
        <div class="form-group"><label>Requires Prescription?</label>
          <select id="mRx"><option value="false">No (OTC)</option><option value="true">Yes (Rx)</option></select>
        </div>
        <button class="btn-primary" onclick="addMed()"><i class="fas fa-plus"></i> Add Medicine</button>
        <div id="addMedMsg" style="margin-top:0.5rem"></div>
      </div>
    </div>
    <div id="t-allstores" class="tcontent">
      <h3 style="margin-bottom:1rem">All Registered Stores</h3>
      <div id="adminStores"></div>
    </div>
    <div id="t-allorders" class="tcontent">
      <h3 style="margin-bottom:1rem">All Orders</h3>
      <div id="adminOrders"></div>
    </div>
  </div>`;
}

function swTab(e, tid) {
  document.querySelectorAll('.dtab').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tcontent').forEach(t => t.classList.remove('active'));
  e.target.classList.add('active');
  const t = document.getElementById(tid);
  if (t) t.classList.add('active');
  if (tid === 't-lowstock') loadLowStock();
}

async function loadAdminStores() {
  const el = document.getElementById('adminStores');
  if (!el) return;
  const stores = await get('/stores');
  el.innerHTML = stores.map(s => `
    <div style="background:white;border-radius:10px;padding:1rem;margin-bottom:0.7rem;border:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.5rem">
      <div><strong>${s.name}</strong><div style="color:#64748b;font-size:0.83rem">${s.address}</div></div>
      <span class="open-badge ${s.isOpen?'is-open':'is-closed'}">${s.isOpen?'Open':'Closed'}</span>
    </div>`).join('');
}

async function loadAllOrders() {
  const el = document.getElementById('adminOrders');
  if (!el) return;
  try {
    const orders = await get('/orders/all', true);
    const colors = { pending:'#f59e0b', confirmed:'#3b82f6', ready:'#8b5cf6', completed:'#16a34a', cancelled:'#ef4444' };
    el.innerHTML = orders.slice(0,20).map(o => `
      <div style="background:white;border-radius:10px;padding:1rem;margin-bottom:0.7rem;border:1px solid #e2e8f0;display:flex;justify-content:space-between;flex-wrap:wrap;gap:0.5rem">
        <div><strong>${o.store?.name||'Store'}</strong> → ${o.user?.name||'User'}<div style="color:#64748b;font-size:0.82rem">${new Date(o.createdAt).toLocaleString()}</div></div>
        <div style="display:flex;align-items:center;gap:0.7rem">
          <strong style="color:#16a34a">₹${o.totalAmount?.toFixed(2)}</strong>
          <span style="background:${colors[o.status]}20;color:${colors[o.status]};padding:3px 10px;border-radius:20px;font-size:0.78rem;font-weight:600">${o.status.toUpperCase()}</span>
        </div>
      </div>`).join('') || '<p style="color:#64748b">No orders yet</p>';
  } catch { el.innerHTML = '<p style="color:#ef4444">Error loading orders</p>'; }
}

async function loadLowStock() {
  const el = document.getElementById('lowStockList');
  if (!el) return;
  try {
    const items = await get('/inventory/low-stock', true);
    el.innerHTML = items.length ? items.map(i => `
      <div style="background:#fef9c3;border:1px solid #fde047;border-radius:10px;padding:1rem;margin-bottom:0.7rem;display:flex;justify-content:space-between;align-items:center">
        <div><strong>${i.medicine?.name||'Medicine'}</strong> at ${i.store?.name||'Store'}</div>
        <span style="color:#ef4444;font-weight:700">${i.stock} units left!</span>
      </div>`).join('') : '<p style="color:#16a34a">✅ No low stock alerts!</p>';
  } catch { el.innerHTML = '<p style="color:#64748b">Connect as admin to view</p>'; }
}

async function addMed() {
  const name = document.getElementById('mName').value;
  if (!name) { showToast('Please enter medicine name'); return; }
  try {
    const body = {
      name, genericName: document.getElementById('mGeneric').value,
      category: document.getElementById('mCat').value,
      manufacturer: document.getElementById('mMfr').value,
      description: document.getElementById('mDesc').value,
      uses: document.getElementById('mUses').value.split(',').map(s=>s.trim()).filter(Boolean),
      sideEffects: document.getElementById('mSE').value.split(',').map(s=>s.trim()).filter(Boolean),
      dosage: document.getElementById('mDosage').value,
      requiresPrescription: document.getElementById('mRx').value === 'true'
    };
    const data = await post('/medicines', body, true);
    document.getElementById('addMedMsg').innerHTML = `<span style="color:#16a34a;font-weight:600">✅ "${data.name}" added successfully!</span>`;
    showToast('Medicine added: ' + data.name + ' 💊');
  } catch (err) { showToast('❌ ' + err.message); }
}

// ── PRESCRIPTION ──────────────────────────────────────────────────────────────
function handlePrescription(input) {
  if (!input.files[0]) return;
  showToast('📋 Prescription "' + input.files[0].name + '" uploaded!');
  showRTBar('📋 Prescription uploaded — analyzing...');
  setTimeout(() => { showToast('🤖 OCR feature: Install Tesseract.js for full OCR!'); }, 2000);
}

// ── EMERGENCY ─────────────────────────────────────────────────────────────────
function toggleEmergency() {
  const p = document.getElementById('emergencyPanel');
  p.style.display = p.style.display === 'none' ? 'flex' : 'none';
}
async function emergencySearch(q) {
  if (!q || q.length < 2) return;
  const el = document.getElementById('emergencyResults');
  const meds = await get('/medicines/search?q=' + encodeURIComponent(q));
  el.innerHTML = meds.slice(0, 5).map(m => `
    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:0.8rem;margin-top:0.5rem;cursor:pointer;display:flex;justify-content:space-between" onclick="toggleEmergency();viewMed('${m._id}')">
      <div><strong>${m.name}</strong><div style="font-size:0.8rem;color:#64748b">${m.category}</div></div>
      <div style="color:#16a34a;font-weight:700">${m.availableIn} store(s)</div>
    </div>`).join('') || '<p style="color:#64748b;padding:0.5rem">No results</p>';
}

// ── CHATBOT ───────────────────────────────────────────────────────────────────
let chatOpen = true;
function toggleChat() {
  chatOpen = !chatOpen;
  document.getElementById('chatBody').style.display = chatOpen ? 'flex' : 'none';
  document.getElementById('chatToggle').textContent = chatOpen ? '▲' : '▼';
}
function qchat(m) { document.getElementById('chatIn').value = m; sendMsg(); }

async function sendMsg() {
  const input = document.getElementById('chatIn');
  const msg = input.value.trim();
  if (!msg) return;
  const msgs = document.getElementById('chatMsgs');
  msgs.innerHTML += `<div class="umsg">${msg}</div>`;
  input.value = ''; msgs.scrollTop = msgs.scrollHeight;
  const typing = document.createElement('div');
  typing.className = 'bmsg'; typing.id = 'typing'; typing.innerHTML = '<i>🤖 Thinking...</i>';
  msgs.appendChild(typing); msgs.scrollTop = msgs.scrollHeight;
  const reply = await botReply(msg);
  document.getElementById('typing')?.remove();
  msgs.innerHTML += `<div class="bmsg">${reply}</div>`;
  msgs.scrollTop = msgs.scrollHeight;
}

async function botReply(msg) {
  const l = msg.toLowerCase();
  if (l.match(/hi|hello|hey/)) return `Hello! 👋 I'm MediBot. I know about <strong>50+ medicines</strong>! Ask me anything about medicines, prices, or alternatives.`;
  if (l.match(/price|cost|cheap|expensive|save/)) return `💰 To compare prices, search the medicine and I'll show you all stores sorted from cheapest first! You can save up to 30% by comparing.`;
  if (l.match(/alternative|substitute|generic|cheap/)) return `🤖 Click any medicine in search results → scroll down to see <strong>AI Suggested Alternatives</strong>. Generic alternatives can save up to 70%!`;
  if (l.match(/store|pharmacy|shop|near/)) return `🏪 Click <strong>Stores</strong> in the top menu to see all 4 registered pharmacies with addresses, phone numbers, and open/closed status!`;
  if (l.match(/prescription|upload|rx/)) return `📋 Go to Search page → Click <strong>"Upload Prescription"</strong> → Upload your doctor's prescription image and we'll find all medicines!`;
  if (l.match(/emergency|urgent|help/)) return `🚨 Click the red <strong>EMERGENCY</strong> button at the top right!<br>• Ambulance: <strong>108</strong><br>• Hospital: <strong>102</strong><br>• Medicine Helpline: <strong>1800-180-1104</strong>`;
  if (l.match(/real.?time|live|socket/)) return `⚡ Yes! MediFind uses <strong>Socket.io</strong> for real-time updates! Stock levels update instantly when orders are placed, and store owners get live order notifications.`;
  if (l.match(/side.?effect|danger|safe/)) return `⚕️ Click on any medicine to see detailed <strong>uses and side effects</strong>. Always consult your doctor before taking prescription medicines!`;
  try {
    const meds = await get('/medicines/search?q=' + encodeURIComponent(msg));
    if (meds.length) return `💊 Found <strong>${meds.length}</strong> result(s) for "<strong>${msg}</strong>"!<br><br>${meds.slice(0,4).map(m=>`• <strong>${m.name}</strong> — ${m.category} ${m.lowestPrice ? '(from ₹'+m.lowestPrice.toFixed(2)+')' : ''}`).join('<br>')}<br><br>Click a medicine in Search to see prices & availability!`;
  } catch {}
  return `🤖 I can help with:<br>• "Find <medicine name>"<br>• "Cheap alternatives for aspirin"<br>• "Side effects of metformin"<br>• "Show nearby pharmacies"<br>• "What is omeprazole used for?"`;
}

// ── API HELPERS ───────────────────────────────────────────────────────────────
async function get(path, auth = false) {
  const headers = auth && token ? { 'Authorization': 'Bearer ' + token } : {};
  const res = await fetch(API + path, { headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message);
  return data;
}

async function post(path, body, auth = false) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth && token) headers['Authorization'] = 'Bearer ' + token;
  const res = await fetch(API + path, { method: 'POST', headers, body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message);
  return data;
}

function showErr(id, msg) { const el = document.getElementById(id); el.textContent = msg; el.style.display = 'block'; }

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.style.display = 'block';
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.style.display = 'none'; }, 3500);
}
