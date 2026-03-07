const API = window.location.hostname === 'localhost' ? 'http://localhost:5000/api' : '/api';
let currentUser = null, token = localStorage.getItem('token');
let allResults = [], socket, storeMap = null, mapMarkers = [], allStores = [], myLocMarker = null;
let routingControl = null, userLat = null, userLng = null;
let mx = 0, my = 0, rx = 0, ry = 0;

// ── LOADER ─────────────────────────────────────────────────────────────────
let pct = 0;
const ldEl = document.getElementById('ldpct');
const ldTimer = setInterval(() => {
  pct += Math.random() * 18;
  if (pct >= 100) {
    pct = 100; clearInterval(ldTimer);
    ldEl.textContent = 'READY';
    setTimeout(() => {
      document.getElementById('loader').classList.add('hide');
      animateCounters();
      spawnMedObjects();
    }, 400);
  }
  ldEl.textContent = Math.floor(pct) + '%';
}, 100);

// ── 3D FLOATING MEDICAL OBJECTS ─────────────────────────────────────────────
function spawnMedObjects() {
  const hero = document.getElementById('heroSection');
  if (!hero) return;
  const types = [
    { cls: 'pill', emoji: null },
    { cls: 'capsule', emoji: null },
    { cls: 'cross', emoji: '⚕️' },
    { cls: 'cross', emoji: '💊' },
    { cls: 'cross', emoji: '💉' },
    { cls: 'cross', emoji: '🩺' },
    { cls: 'drop', emoji: null },
    { cls: 'tablet', emoji: null },
  ];
  for (let i = 0; i < 22; i++) {
    const t = types[Math.floor(Math.random() * types.length)];
    const el = document.createElement('div');
    el.className = 'med-obj ' + t.cls;
    if (t.emoji) el.textContent = t.emoji;
    el.style.cssText = `
      left:${Math.random() * 100}%;
      animation-duration:${8 + Math.random() * 14}s;
      animation-delay:${-Math.random() * 14}s;
      font-size:${1 + Math.random() * 1.2}rem;
      opacity:${0.06 + Math.random() * 0.12};
    `;
    hero.appendChild(el);
  }
}

// ── CUSTOM CURSOR ──────────────────────────────────────────────────────────
const cur = document.getElementById('cur'), cur2 = document.getElementById('cur2');
document.addEventListener('mousemove', e => { mx = e.clientX; my = e.clientY; cur.style.left = mx + 'px'; cur.style.top = my + 'px'; });
function animCur() { rx += (mx - rx) * .14; ry += (my - ry) * .14; cur2.style.left = rx + 'px'; cur2.style.top = ry + 'px'; requestAnimationFrame(animCur); }
animCur();
document.addEventListener('mouseover', e => {
  if (e.target.closest('a,button,.cat-card,.med-card,.store-list-card,.alt-card')) {
    cur.style.width = '18px'; cur.style.height = '18px'; cur.style.background = '#0284c7';
  } else { cur.style.width = '12px'; cur.style.height = '12px'; cur.style.background = 'var(--blue)'; }
});

// ── SCROLL REVEAL ──────────────────────────────────────────────────────────
const revObs = new IntersectionObserver(entries => {
  entries.forEach((e, i) => { if (e.isIntersecting) setTimeout(() => e.target.classList.add('visible'), i * 70); });
}, { threshold: .08 });
document.querySelectorAll('.reveal').forEach(r => revObs.observe(r));

// ── COUNTER ANIMATION ──────────────────────────────────────────────────────
function animateCounters() {
  document.querySelectorAll('.hstat-num[data-t]').forEach(el => {
    const target = +el.dataset.t; let cur = 0;
    const timer = setInterval(() => {
      cur += target / 45;
      if (cur >= target) { cur = target; clearInterval(timer); }
      el.textContent = Math.floor(cur) + '+';
    }, 30);
  });
}

// ── INIT ───────────────────────────────────────────────────────────────────
window.onload = () => {
  const saved = localStorage.getItem('user');
  if (token && saved) { currentUser = JSON.parse(saved); updateNav(); }
  showPage('home');
  initSocket();
};

// ── SOCKET.IO ──────────────────────────────────────────────────────────────
function initSocket() {
  try {
    socket = io();
    socket.on('connect', () => showRT('🟢 Connected — Stock updates are live'));
    socket.on('stock-updated', d => { showRT('📦 Stock updated — ' + d.stock + ' units remaining'); showToast('📦 Stock updated!'); });
    socket.on('order-placed', () => showRT('🛒 New order placed — stock updated'));
    socket.on('order-status-updated', d => { if (currentUser && d.userId === currentUser.id) { showToast('✅ Order status: ' + d.status.toUpperCase()); document.getElementById('obadge').style.display = 'inline'; } });
  } catch(e) {}
}
function showRT(msg) {
  const b = document.getElementById('rtbar');
  document.getElementById('rtmsg').textContent = msg;
  b.style.display = 'flex';
  setTimeout(() => b.style.display = 'none', 5000);
}

// ── NAVIGATION ─────────────────────────────────────────────────────────────
function showPage(p) {
  document.querySelectorAll('.page').forEach(x => x.classList.remove('active'));
  const el = document.getElementById('page-' + p);
  if (el) { el.classList.add('active'); window.scrollTo(0, 0); }
  if (p === 'stores') loadStores();
  if (p === 'orders') loadOrders();
  if (p === 'dashboard') loadDashboard();
}

// ── SEARCH ──────────────────────────────────────────────────────────────────
function heroType(v) { if (v.length > 1) { showPage('search'); document.getElementById('mainSearch').value = v; searchMeds(v); } }
function goSearch() { const v = document.getElementById('heroIn').value; if (v) { showPage('search'); document.getElementById('mainSearch').value = v; searchMeds(v); } }
function qs(q) { showPage('search'); document.getElementById('mainSearch').value = q; searchMeds(q); }

let searchTimer;
function searchMeds(q) { clearTimeout(searchTimer); if (!q || q.length < 2) return; searchTimer = setTimeout(() => doSearch(q), 350); }

async function doSearch(q) {
  const el = document.getElementById('searchResults');
  el.innerHTML = `<div class="loading"><div class="spinner"></div><p style="color:var(--muted);font-size:.85rem">Searching for "<strong>${q}</strong>"...</p></div>`;
  try {
    const meds = await get('/medicines/search?q=' + encodeURIComponent(q));
    allResults = meds;
    renderResults(meds, q);
  } catch {
    el.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-circle"></i><h3>Connection error</h3><p>Please check server is running</p></div>`;
  }
}

function renderResults(meds, q) {
  const el = document.getElementById('searchResults');
  if (!meds.length) { el.innerHTML = `<div class="empty-state"><i class="fas fa-pills"></i><h3>No results for "${q}"</h3><p>Try different keywords or check spelling</p></div>`; return; }
  el.innerHTML = `<p style="color:var(--muted);font-size:.83rem;margin-bottom:1rem">Found <strong style="color:var(--navy)">${meds.length}</strong> result(s) for "<strong style="color:var(--blue)">${q}</strong>"</p>` +
    meds.map((m, i) => `
      <div class="med-card" onclick="viewMed('${m._id}')">
        <div>
          <div class="mc-name">${m.name} ${i === 0 && meds.length > 1 ? '<span class="badge bc">Best Match</span>' : ''}</div>
          <div class="mc-sub">${m.genericName ? m.genericName + ' · ' : ''}${m.manufacturer || ''}</div>
          <div class="mc-badges">
            ${m.category ? `<span class="badge bc">${m.category}</span>` : ''}
            ${m.requiresPrescription ? `<span class="badge bo">⚕️ Rx Required</span>` : `<span class="badge bg">✓ OTC</span>`}
            ${m.availableIn > 0 ? `<span class="badge bg"><span class="live-dot"></span>${m.availableIn} store(s)</span>` : `<span class="badge br">Out of Stock</span>`}
          </div>
        </div>
        <div class="mc-right">
          ${m.lowestPrice !== null ? `<div class="mc-avail">from</div><div class="mc-price">₹${m.lowestPrice.toFixed(2)}</div>` : '<div class="mc-avail">—</div>'}
          <div class="mc-arrow">View Details →</div>
        </div>
      </div>`).join('');
}

function filterR(type, el) {
  document.querySelectorAll('.ftag').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  let f = [...allResults];
  if (type === 'otc') f = f.filter(m => !m.requiresPrescription);
  else if (type === 'rx') f = f.filter(m => m.requiresPrescription);
  else if (type === 'avail') f = f.filter(m => m.availableIn > 0);
  else if (type === 'disc') f = f.filter(m => m.lowestPrice !== null);
  renderResults(f, document.getElementById('mainSearch').value);
}

// ── MEDICINE DETAIL ────────────────────────────────────────────────────────
async function viewMed(id) {
  showPage('medicine');
  const el = document.getElementById('medicineDetail');
  el.innerHTML = `<div class="loading" style="padding:5rem"><div class="spinner"></div><p style="color:var(--muted)">Loading medicine details...</p></div>`;
  try {
    const [{ medicine, availability }, alternatives] = await Promise.all([get('/medicines/' + id), get('/medicines/' + id + '/alternatives')]);
    el.innerHTML = `
      <div class="med-detail">
        <button class="back-btn" onclick="showPage('search')"><i class="fas fa-arrow-left"></i> Back to Search</button>
        <div class="md-header">
          <h1>${medicine.name}</h1>
          <p>${medicine.genericName ? '🔬 Generic: ' + medicine.genericName + ' · ' : ''}${medicine.manufacturer ? '🏭 ' + medicine.manufacturer : ''}</p>
          ${medicine.description ? `<p style="margin-top:.6rem;font-size:.9rem;opacity:.85">${medicine.description}</p>` : ''}
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:1rem">
            ${medicine.category ? `<span style="background:rgba(255,255,255,.15);color:white;padding:3px 12px;border-radius:20px;font-size:.75rem;font-weight:700">${medicine.category}</span>` : ''}
            ${medicine.requiresPrescription ? `<span style="background:rgba(245,158,11,.3);color:#fef3c7;padding:3px 12px;border-radius:20px;font-size:.75rem;font-weight:700">⚕️ Prescription Required</span>` : `<span style="background:rgba(16,185,129,.3);color:#d1fae5;padding:3px 12px;border-radius:20px;font-size:.75rem;font-weight:700">✓ Over The Counter</span>`}
            ${medicine.dosage ? `<span style="background:rgba(255,255,255,.12);color:white;padding:3px 12px;border-radius:20px;font-size:.75rem">💊 ${medicine.dosage}</span>` : ''}
            ${availability.length ? `<span style="background:rgba(16,185,129,.3);color:#d1fae5;padding:3px 12px;border-radius:20px;font-size:.75rem;font-weight:700"><span class="live-dot"></span>Live Stock</span>` : ''}
          </div>
        </div>
        <div class="md-grid">
          <div class="dcard"><h3><i class="fas fa-stethoscope"></i> Medical Uses</h3><ul>${medicine.uses?.length ? medicine.uses.map(u=>`<li>${u}</li>`).join('') : '<li>Not specified</li>'}</ul></div>
          <div class="dcard"><h3><i class="fas fa-exclamation-circle"></i> Side Effects</h3><ul>${medicine.sideEffects?.length ? medicine.sideEffects.map(s=>`<li>${s}</li>`).join('') : '<li>Not specified</li>'}</ul></div>
        </div>
        <div class="avail-sec">
          <h2><i class="fas fa-store" style="color:var(--blue)"></i> Available at ${availability.length} Pharmacy(s) <span style="font-size:.75rem;color:var(--muted);font-weight:500">sorted cheapest first</span></h2>
          ${availability.length ? availability.map((inv, i) => {
            const fp = (inv.price * (1-(inv.discount||0)/100)).toFixed(2);
            return `<div class="store-card ${i===0?'cheapest-card':''}">
              <div class="si">
                <h4><i class="fas fa-clinic-medical" style="color:var(--blue);font-size:.85rem"></i>${inv.store?.name||'Store'} ${i===0?'<span class="cheapest-tag">CHEAPEST</span>':''}</h4>
                <p><i class="fas fa-map-marker-alt"></i>${inv.store?.address||''}</p>
                <p><i class="fas fa-clock"></i>${inv.store?.openingHours||''} <span style="color:${inv.store?.isOpen?'#059669':'#dc2626'};font-weight:700;margin-left:4px">${inv.store?.isOpen?'● Open Now':'● Closed'}</span></p>
                <p><i class="fas fa-boxes"></i><span style="color:${inv.stock<10?'#dc2626':'#059669'};font-weight:700">${inv.stock} units</span> in stock</p>
                ${inv.expiryDate?`<p><i class="fas fa-calendar-alt"></i>Expires: ${inv.expiryDate}</p>`:''}
              </div>
              <div style="display:flex;align-items:center;gap:.7rem;flex-wrap:wrap">
                <div style="text-align:right">
                  ${inv.discount?`<div class="sp-orig">₹${inv.price.toFixed(2)}</div>`:''}
                  <div class="sp-final">₹${fp}</div>
                  ${inv.discount?`<div class="sp-disc">🏷️ ${inv.discount}% OFF</div>`:''}
                </div>
                ${currentUser
                  ? `<button class="btn-order" onclick="placeOrder('${inv.store?._id}','${medicine._id}','${inv.price}','${inv.discount||0}')"><i class="fas fa-cart-plus"></i> Order</button>`
                  : `<button class="btn-order" onclick="showPage('login')"><i class="fas fa-lock"></i> Login to Order</button>`}
                <button class="btn-map" onclick="viewOnMap('${inv.store?._id}')"><i class="fas fa-map-marked-alt"></i> On Map</button>
              </div>
            </div>`;
          }).join('') : `<div class="empty-state"><i class="fas fa-store-slash"></i><h3>Not available anywhere right now</h3></div>`}
        </div>
        ${alternatives.length ? `
        <div class="alt-sec">
          <h2><i class="fas fa-robot" style="color:var(--green2)"></i> Cheaper Alternatives <span style="font-size:.75rem;color:var(--muted);font-weight:500">AI suggested alternatives</span></h2>
          ${alternatives.map(a => `
            <div class="alt-card" onclick="viewMed('${a.medicine._id}')">
              <div>
                <strong style="color:var(--navy);font-size:.9rem">${a.medicine.name}</strong>
                <div style="color:var(--muted);font-size:.78rem;margin-top:2px">${a.medicine.genericName||''} · ${a.medicine.category||''}</div>
                ${!a.medicine.requiresPrescription?'<span class="badge bg" style="margin-top:4px">OTC — No Prescription</span>':''}
              </div>
              <div style="text-align:right">
                ${a.cheapestOption ? `<div class="sp-final" style="font-size:1rem">₹${(a.cheapestOption.price*(1-(a.cheapestOption.discount||0)/100)).toFixed(2)}</div><div style="font-size:.72rem;color:var(--muted)">${a.cheapestOption.store?.name||''}</div>` : '<div style="color:var(--muted);font-size:.8rem">Check stock</div>'}
                <div style="color:var(--blue);font-size:.75rem;margin-top:3px;font-weight:700">View →</div>
              </div>
            </div>`).join('')}
        </div>` : ''}
      </div>`;
  } catch(err) {
    el.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-circle"></i><h3>Error loading medicine</h3><p>${err.message}</p></div>`;
  }
}

function viewOnMap(storeId) {
  showPage('stores');
  setTimeout(() => { focusStore(storeId); }, 900);
}

// ── ORDER ──────────────────────────────────────────────────────────────────
async function placeOrder(storeId, medId, price, discount) {
  if (!currentUser) { showPage('login'); return; }
  const qty = prompt('Enter quantity:', '1');
  if (!qty || isNaN(qty) || +qty <= 0) return;
  try {
    const data = await post('/orders', { store: storeId, items: [{ medicine: medId, quantity: +qty, price: +price }] }, true);
    showToast('✅ Order placed! Total: ₹' + data.totalAmount);
    setTimeout(() => showPage('orders'), 1500);
  } catch(err) { showToast('❌ ' + err.message); }
}

// ── AUTH ───────────────────────────────────────────────────────────────────
async function login() {
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPass').value;
  document.getElementById('loginErr').style.display = 'none';
  if (!email || !password) { showErr('loginErr', 'Please fill all fields'); return; }
  try {
    const data = await post('/auth/login', { email, password });
    setUser(data); showToast('Welcome back, ' + currentUser.name + '! 👋'); showPage('home');
  } catch(err) { showErr('loginErr', err.message); }
}
async function register() {
  const name = document.getElementById('rName').value;
  const email = document.getElementById('rEmail').value;
  const password = document.getElementById('rPass').value;
  const phone = document.getElementById('rPhone').value;
  const role = document.getElementById('rRole').value;
  if (!name || !email || !password) { showErr('regErr', 'Please fill required fields'); return; }
  try {
    const data = await post('/auth/register', { name, email, password, phone, role });
    setUser(data); showToast('Welcome to MediFind, ' + name + '! 🎉'); showPage('home');
  } catch(err) { showErr('regErr', err.message); }
}
function setUser(data) { token = data.token; currentUser = data.user; localStorage.setItem('token', token); localStorage.setItem('user', JSON.stringify(currentUser)); updateNav(); }
function logout() { token = null; currentUser = null; localStorage.removeItem('token'); localStorage.removeItem('user'); document.getElementById('authLinks').style.display = 'inline-flex'; document.getElementById('userLinks').style.display = 'none'; showToast('Logged out successfully'); showPage('home'); }
function updateNav() { document.getElementById('authLinks').style.display = 'none'; document.getElementById('userLinks').style.display = 'inline-flex'; document.getElementById('uname').textContent = '👤 ' + currentUser.name; }
function fill(e, p) { document.getElementById('loginEmail').value = e; document.getElementById('loginPass').value = p; }

// ── STORES & MAP ───────────────────────────────────────────────────────────
async function loadStores() {
  const el = document.getElementById('storesList');
  el.innerHTML = `<div class="loading"><div class="spinner"></div></div>`;
  try {
    allStores = await get('/stores');
    document.getElementById('scnt').textContent = allStores.length + ' pharmacies found';
    renderStoreList(allStores);
    initMap(allStores);
  } catch {
    el.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-circle"></i><h3>Error loading stores</h3></div>`;
  }
}

function renderStoreList(stores) {
  const el = document.getElementById('storesList');
  el.innerHTML = stores.map(s => `
    <div class="store-list-card" id="slc-${s._id}" onclick="focusStore('${s._id}')">
      <h3><i class="fas fa-clinic-medical" style="color:var(--blue)"></i>${s.name}</h3>
      <p><i class="fas fa-map-marker-alt"></i>${s.address}</p>
      ${s.phone ? `<p><i class="fas fa-phone"></i>${s.phone}</p>` : ''}
      <p><i class="fas fa-clock"></i>${s.openingHours || 'Hours not listed'}</p>
      ${s.rating ? `<div class="rating-stars">${'★'.repeat(Math.floor(s.rating))}${'☆'.repeat(5-Math.floor(s.rating))} <span style="color:var(--muted);font-size:.75rem">${s.rating}/5</span></div>` : ''}
      <span class="open-badge ${s.isOpen ? 'is-open' : 'is-closed'}">${s.isOpen ? '● Open Now' : '● Closed'}</span>
      <div class="store-btns">
        <button class="dir-btn" onclick="getDirections(${s.location?.lat},${s.location?.lng},'${s.name}')"><i class="fas fa-route"></i> Directions</button>
        <button class="share-btn" onclick="shareLocation('${s.name}','${s.address}',${s.location?.lat},${s.location?.lng})"><i class="fas fa-share-alt"></i> Share</button>
      </div>
    </div>`).join('');
}

function filterMap(type, btn) {
  document.querySelectorAll('.mc-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  let filtered = [...allStores];
  if (type === 'open') filtered = filtered.filter(s => s.isOpen);
  renderStoreList(filtered);
  mapMarkers.forEach(m => {
    const store = allStores.find(s => s._id === m.storeId);
    if (store) m.setOpacity(type === 'open' && !store.isOpen ? 0.2 : 1);
  });
}

function initMap(stores) {
  if (storeMap) { storeMap.remove(); storeMap = null; }
  storeMap = L.map('storeMap', { zoomControl: true, attributionControl: true }).setView([17.385, 78.4867], 12);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors', maxZoom: 18
  }).addTo(storeMap);
  mapMarkers = [];
  stores.forEach(store => {
    if (!store.location?.lat) return;
    const icon = L.divIcon({
      html: `<div style="
        background:${store.isOpen ? 'linear-gradient(135deg,#0ea5e9,#0284c7)' : 'linear-gradient(135deg,#94a3b8,#64748b)'};
        width:38px;height:38px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);
        border:3px solid white;
        box-shadow:0 4px 16px ${store.isOpen ? 'rgba(14,165,233,.5)' : 'rgba(0,0,0,.2)'};
        display:flex;align-items:center;justify-content:center;">
        <div style="width:12px;height:12px;background:white;border-radius:50%;transform:rotate(45deg)"></div>
      </div>`,
      className: '', iconSize: [38, 38], iconAnchor: [19, 38], popupAnchor: [0, -42]
    });
    const marker = L.marker([store.location.lat, store.location.lng], { icon }).addTo(storeMap);
    marker.storeId = store._id;
    marker.bindPopup(`
      <div style="min-width:210px;padding:.3rem;font-family:Inter,system-ui,sans-serif">
        <div class="popup-title">🏥 ${store.name}</div>
        <div class="popup-info"><i class="fas fa-map-marker-alt" style="color:#0ea5e9"></i> ${store.address}</div>
        ${store.phone ? `<div class="popup-info"><i class="fas fa-phone" style="color:#0ea5e9"></i> ${store.phone}</div>` : ''}
        <div class="popup-info"><i class="fas fa-clock" style="color:#0ea5e9"></i> ${store.openingHours || ''}</div>
        ${store.rating ? `<div class="popup-info">⭐ ${store.rating}/5 rating</div>` : ''}
        <div class="${store.isOpen ? 'popup-open' : 'popup-closed'}">${store.isOpen ? '● Open Now' : '● Currently Closed'}</div>
        <button class="popup-btn" onclick="getDirections(${store.location.lat},${store.location.lng},'${store.name}')">🗺️ Get Directions</button>
        <button class="popup-share" onclick="shareLocation('${store.name}','${store.address}',${store.location.lat},${store.location.lng})">📤 Share Location</button>
      </div>`);
    marker.on('click', () => highlightStore(store._id));
    mapMarkers.push(marker);
  });
  if (mapMarkers.length > 0) {
    const group = L.featureGroup(mapMarkers);
    storeMap.fitBounds(group.getBounds().pad(.12));
  }
}

function focusStore(storeId) {
  document.querySelectorAll('.store-list-card').forEach(c => c.classList.remove('active-store'));
  const card = document.getElementById('slc-' + storeId);
  if (card) { card.classList.add('active-store'); card.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
  const marker = mapMarkers.find(m => m.storeId === storeId);
  if (marker && storeMap) { storeMap.setView(marker.getLatLng(), 16, { animate: true }); setTimeout(() => marker.openPopup(), 400); }
}
function highlightStore(storeId) { focusStore(storeId); }

function getMyLoc() {
  if (!navigator.geolocation) { showToast('❌ Geolocation not supported'); return; }
  showToast('📍 Getting your location...');
  navigator.geolocation.getCurrentPosition(pos => {
    userLat = pos.coords.latitude;
    userLng = pos.coords.longitude;
    if (storeMap) {
      if (myLocMarker) storeMap.removeLayer(myLocMarker);
      const myIcon = L.divIcon({
        html: `<div style="width:20px;height:20px;background:#0ea5e9;border:3px solid white;border-radius:50%;box-shadow:0 0 0 8px rgba(14,165,233,.2),0 4px 12px rgba(14,165,233,.4)"></div>`,
        className: '', iconSize: [20, 20], iconAnchor: [10, 10]
      });
      myLocMarker = L.marker([userLat, userLng], { icon: myIcon }).addTo(storeMap);
      myLocMarker.bindPopup('<div style="font-weight:800;color:#1e3a5f">📍 You are here</div>').openPopup();
      storeMap.setView([userLat, userLng], 14, { animate: true });
      sortStoresByDistance(userLat, userLng);
      showToast('✅ Location found! Tap "Directions" on any pharmacy.');
    }
  }, () => showToast('❌ Could not access location. Please allow location permission.'));
}

function sortStoresByDistance(lat, lng) {
  const sorted = [...allStores].sort((a, b) => {
    const da = dist(lat, lng, a.location?.lat||0, a.location?.lng||0);
    const db = dist(lat, lng, b.location?.lat||0, b.location?.lng||0);
    return da - db;
  });
  renderStoreList(sorted);
}

function dist(lat1, lng1, lat2, lng2) {
  const R = 6371, dLat = (lat2-lat1)*Math.PI/180, dLng = (lng2-lng1)*Math.PI/180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// ── IN-APP ROUTING (like Uber/Rapido) ──────────────────────────────────────
function getDirections(destLat, destLng, name) {
  if (!destLat || !destLng) { showToast('❌ Store location not available'); return; }
  showPage('stores');
  setTimeout(() => {
    if (!userLat || !userLng) {
      // Ask for location first
      if (!navigator.geolocation) { showToast('❌ Location not supported'); return; }
      showToast('📍 Getting your location for route...');
      navigator.geolocation.getCurrentPosition(pos => {
        userLat = pos.coords.latitude;
        userLng = pos.coords.longitude;
        drawRoute(userLat, userLng, destLat, destLng, name);
      }, () => {
        // Use Hyderabad center as fallback start
        showToast('📍 Using Hyderabad center as start point');
        drawRoute(17.385, 78.4867, destLat, destLng, name);
      });
    } else {
      drawRoute(userLat, userLng, destLat, destLng, name);
    }
  }, 500);
}

function drawRoute(fromLat, fromLng, toLat, toLng, name) {
  if (!storeMap) return;
  // Remove existing route
  if (routingControl) { storeMap.removeControl(routingControl); routingControl = null; }

  // Show route panel
  const panel = document.getElementById('routePanel');
  if (panel) {
    panel.style.display = 'flex';
    document.getElementById('routeDestName').textContent = '🏥 Route to ' + name;
    document.getElementById('routeDist').textContent = 'Calculating...';
    document.getElementById('routeTime').textContent = '';
  }

  // Draw route on map using OSRM (free, no API key)
  routingControl = L.Routing.control({
    waypoints: [
      L.latLng(fromLat, fromLng),
      L.latLng(toLat, toLng)
    ],
    router: L.Routing.osrmv1({
      serviceUrl: 'https://router.project-osrm.org/route/v1'
    }),
    lineOptions: {
      styles: [
        { color: '#0ea5e9', weight: 5, opacity: 0.9 },
        { color: '#bae6fd', weight: 8, opacity: 0.3 }
      ]
    },
    show: false, // Hide the default turn-by-turn panel (we show our own)
    addWaypoints: false,
    routeWhileDragging: false,
    fitSelectedRoutes: true,
    showAlternatives: false,
    createMarker: function(i, wp) {
      const isStart = i === 0;
      const icon = L.divIcon({
        html: `<div style="
          width:${isStart?'18px':'38px'};
          height:${isStart?'18px':'38px'};
          background:${isStart?'#0ea5e9':'linear-gradient(135deg,#10b981,#059669)'};
          border:3px solid white;
          border-radius:${isStart?'50%':'50% 50% 50% 0'};
          transform:${isStart?'none':'rotate(-45deg)'};
          box-shadow:0 4px 12px ${isStart?'rgba(14,165,233,.5)':'rgba(16,185,129,.5)'};
          display:flex;align-items:center;justify-content:center;
        ">${isStart?'':'<div style="width:12px;height:12px;background:white;border-radius:50%;transform:rotate(45deg)"></div>'}</div>`,
        className: '',
        iconSize: isStart?[18,18]:[38,38],
        iconAnchor: isStart?[9,9]:[19,38]
      });
      return L.marker(wp.latLng, { icon });
    }
  }).addTo(storeMap);

  // Listen for route found to show distance & time
  routingControl.on('routesfound', function(e) {
    const route = e.routes[0];
    const km = (route.summary.totalDistance / 1000).toFixed(1);
    const mins = Math.round(route.summary.totalTime / 60);
    document.getElementById('routeDist').textContent = km + ' km';
    document.getElementById('routeTime').textContent = mins + ' min';
    showToast('✅ Route found — ' + km + ' km, ~' + mins + ' min');
  });

  routingControl.on('routingerror', function() {
    showToast('❌ Could not find route. Check internet connection.');
    document.getElementById('routeDist').textContent = 'Route unavailable';
  });

  // Scroll map into view
  document.getElementById('storeMap')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function clearRoute() {
  if (routingControl) { storeMap.removeControl(routingControl); routingControl = null; }
  const panel = document.getElementById('routePanel');
  if (panel) panel.style.display = 'none';
  showToast('🗺️ Route cleared');
  // Reset map view to show all stores
  if (mapMarkers.length > 0) {
    const group = L.featureGroup(mapMarkers);
    storeMap.fitBounds(group.getBounds().pad(.12));
  }
}

function shareLocation(name, address, lat, lng) {
  const text = `📍 ${name}\n📌 ${address}\n🗺️ https://maps.google.com/?q=${lat},${lng}\n\nShared via MediFind`;
  if (navigator.share) {
    navigator.share({ title: name, text, url: `https://maps.google.com/?q=${lat},${lng}` })
      .then(() => showToast('✅ Location shared!'))
      .catch(() => copyToClipboard(text));
  } else { copyToClipboard(text); }
}
function copyToClipboard(text) { navigator.clipboard.writeText(text).then(() => showToast('📋 Location copied to clipboard!')).catch(() => showToast('❌ Could not copy')); }

// ── ORDERS ─────────────────────────────────────────────────────────────────
async function loadOrders() {
  if (!currentUser) { showPage('login'); return; }
  const el = document.getElementById('ordersList');
  el.innerHTML = `<div class="loading"><div class="spinner"></div></div>`;
  try {
    const orders = await get('/orders/my-orders', true);
    const colors = { pending:'#f59e0b', confirmed:'#3b82f6', ready:'#8b5cf6', completed:'#10b981', cancelled:'#ef4444' };
    el.innerHTML = orders.length ? orders.map(o => `
      <div class="order-card">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:.5rem;margin-bottom:.5rem">
          <h4 style="font-size:.9rem;font-weight:800;color:var(--navy)">${o.store?.name||'Pharmacy'}</h4>
          <span class="os-badge" style="background:${colors[o.status]}18;color:${colors[o.status]};border:1px solid ${colors[o.status]}30">${o.status.toUpperCase()}</span>
        </div>
        <p style="color:var(--muted);font-size:.85rem">${o.items?.map(i=>i.medicine?.name||'Medicine').join(', ')}</p>
        <div style="display:flex;justify-content:space-between;margin-top:.7rem;align-items:center">
          <span style="color:var(--muted);font-size:.77rem"><i class="fas fa-clock"></i> ${new Date(o.createdAt).toLocaleString()}</span>
          <strong style="color:var(--green2);font-size:.97rem">₹${o.totalAmount?.toFixed(2)}</strong>
        </div>
      </div>`).join('') :
      `<div class="empty-state"><i class="fas fa-shopping-bag"></i><h3>No orders yet</h3><p>Search and order your first medicine!</p></div>`;
  } catch { el.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-circle"></i><h3>Error loading orders</h3></div>`; }
}

// ── DASHBOARD ──────────────────────────────────────────────────────────────
function loadDashboard() {
  if (!currentUser) { showPage('login'); return; }
  const el = document.getElementById('dashContent');
  if (currentUser.role === 'admin') el.innerHTML = adminDash();
  else if (currentUser.role === 'store') el.innerHTML = storeDash();
  else el.innerHTML = userDash();
}

function userDash() {
  return `<div class="dashboard">
    <h1>Welcome, ${currentUser.name}! 👋</h1>
    <div class="stat-grid">
      <div class="scard"><i class="fas fa-pills"></i><div class="val">50+</div><div class="lbl">Medicines</div></div>
      <div class="scard"><i class="fas fa-store"></i><div class="val">4</div><div class="lbl">Pharmacies</div></div>
      <div class="scard"><i class="fas fa-map-marked-alt"></i><div class="val">Live</div><div class="lbl">Maps</div></div>
      <div class="scard"><i class="fas fa-bolt"></i><div class="val">RT</div><div class="lbl">Real-Time</div></div>
    </div>
    <div style="display:flex;gap:.8rem;flex-wrap:wrap;margin-bottom:2rem">
      <button class="nb" style="border:none;cursor:none;padding:10px 20px" onclick="showPage('search')"><i class="fas fa-search"></i> Search Medicines</button>
      <button class="nb nb-out" style="cursor:none;padding:10px 20px" onclick="showPage('stores')"><i class="fas fa-map-marked-alt"></i> View Store Map</button>
      <button class="nb nb-out" style="cursor:none;padding:10px 20px" onclick="showPage('orders')"><i class="fas fa-box"></i> My Orders</button>
    </div>
    <div class="white-box">
      <h3>💡 How to Use MediFind</h3>
      <div class="dcard" style="background:transparent;border:none;padding:0">
        <ul>
          <li>Search any medicine to compare prices across all 4 pharmacies</li>
          <li>Click "On Map" on any store to see its exact location</li>
          <li>Use "Get Directions" to navigate to a pharmacy (opens in new tab)</li>
          <li>Share store locations with family using the Share button</li>
          <li>Check AI Alternatives to save up to 70% on medicine costs</li>
          <li>Press SOS button for emergency contacts and quick medicine search</li>
        </ul>
      </div>
    </div>
  </div>`;
}

function storeDash() {
  return `<div class="dashboard">
    <h1>Store Dashboard 🏪</h1>
    <div class="dash-tabs">
      <button class="dtab active" onclick="swTab(event,'t-inv')">📦 Inventory</button>
      <button class="dtab" onclick="swTab(event,'t-orders');loadStoreOrders()">📋 Orders</button>
      <button class="dtab" onclick="swTab(event,'t-lowstock');loadLowStock()">⚠️ Low Stock</button>
    </div>
    <div id="t-inv" class="tc active">
      <div class="white-box">
        <h3>Update Inventory</h3>
        <div class="fg"><label>Medicine Name</label><input class="fi" id="invMed" placeholder="e.g. Paracetamol 500mg"/></div>
        <div class="fg"><label>Price (₹)</label><input class="fi" type="number" id="invPrice" placeholder="0.00"/></div>
        <div class="fg"><label>Stock Quantity</label><input class="fi" type="number" id="invStock" placeholder="0"/></div>
        <div class="fg"><label>Discount (%)</label><input class="fi" type="number" id="invDiscount" placeholder="0"/></div>
        <button class="btn-full" style="max-width:200px;cursor:none" onclick="showToast('✅ Feature ready — connect store ID!')">Save</button>
      </div>
    </div>
    <div id="t-orders" class="tc"><div id="storeOrdersList"><div class="loading"><div class="spinner"></div></div></div></div>
    <div id="t-lowstock" class="tc"><div id="lowStockList"><div class="loading"><div class="spinner"></div></div></div></div>
  </div>`;
}

function adminDash() {
  return `<div class="dashboard">
    <h1>Admin Dashboard 🛡️</h1>
    <div class="dash-tabs">
      <button class="dtab active" onclick="swTab(event,'t-addmed')">💊 Add Medicine</button>
      <button class="dtab" onclick="swTab(event,'t-allstores');loadAdminStores()">🏪 All Stores</button>
      <button class="dtab" onclick="swTab(event,'t-allorders');loadAllOrders()">📋 All Orders</button>
      <button class="dtab" onclick="swTab(event,'t-ls2');loadLowStock2()">⚠️ Low Stock</button>
    </div>
    <div id="t-addmed" class="tc active">
      <div class="white-box">
        <h3>Add New Medicine</h3>
        <div class="fg"><label>Medicine Name *</label><input class="fi" id="mName" placeholder="e.g. Paracetamol 500mg"/></div>
        <div class="fg"><label>Generic Name</label><input class="fi" id="mGeneric" placeholder="e.g. Acetaminophen"/></div>
        <div class="fg"><label>Category</label>
          <select class="fi" id="mCat"><option>Analgesic</option><option>Antibiotic</option><option>Antidiabetic</option><option>Antihypertensive</option><option>Antacid</option><option>Antihistamine</option><option>Antifungal</option><option>Vitamin</option><option>Respiratory</option><option>Antihyperlipidemic</option><option>Thyroid</option><option>Antidepressant</option><option>Other</option></select>
        </div>
        <div class="fg"><label>Manufacturer</label><input class="fi" id="mMfr" placeholder="e.g. Sun Pharma"/></div>
        <div class="fg"><label>Description</label><input class="fi" id="mDesc" placeholder="Brief description..."/></div>
        <div class="fg"><label>Uses (comma separated)</label><input class="fi" id="mUses" placeholder="Pain relief, Fever, Headache"/></div>
        <div class="fg"><label>Side Effects (comma separated)</label><input class="fi" id="mSE" placeholder="Nausea, Dizziness"/></div>
        <div class="fg"><label>Dosage</label><input class="fi" id="mDosage" placeholder="1 tablet twice daily"/></div>
        <div class="fg"><label>Prescription Required?</label><select class="fi" id="mRx"><option value="false">No (OTC)</option><option value="true">Yes (Rx)</option></select></div>
        <button class="btn-full" style="max-width:200px;cursor:none" onclick="addMed()"><i class="fas fa-plus"></i> Add Medicine</button>
        <div id="addMedMsg" style="margin-top:.5rem"></div>
      </div>
    </div>
    <div id="t-allstores" class="tc"><div id="adminStores"><div class="loading"><div class="spinner"></div></div></div></div>
    <div id="t-allorders" class="tc"><div id="adminOrders"><div class="loading"><div class="spinner"></div></div></div></div>
    <div id="t-ls2" class="tc"><div id="lowStock2"><div class="loading"><div class="spinner"></div></div></div></div>
  </div>`;
}

function swTab(e, id) {
  document.querySelectorAll('.dtab').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tc').forEach(t => t.classList.remove('active'));
  e.target.classList.add('active');
  const t = document.getElementById(id);
  if (t) t.classList.add('active');
}

async function loadAdminStores() {
  const el = document.getElementById('adminStores'); if (!el) return;
  const stores = await get('/stores');
  el.innerHTML = stores.map(s => `
    <div style="background:white;border:1.5px solid var(--border);border-radius:12px;padding:1rem;margin-bottom:.6rem;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:.5rem">
      <div><strong style="color:var(--navy);font-size:.88rem">${s.name}</strong><div style="color:var(--muted);font-size:.78rem;margin-top:2px">${s.address}</div></div>
      <div style="display:flex;align-items:center;gap:.5rem">
        <span class="open-badge ${s.isOpen?'is-open':'is-closed'}" style="margin:0">${s.isOpen?'Open':'Closed'}</span>
        <button class="dir-btn" onclick="viewOnMap('${s._id}')"><i class="fas fa-map"></i> Map</button>
      </div>
    </div>`).join('');
}

async function loadAllOrders() {
  const el = document.getElementById('adminOrders'); if (!el) return;
  try {
    const orders = await get('/orders/all', true);
    const colors = { pending:'#f59e0b', confirmed:'#3b82f6', ready:'#8b5cf6', completed:'#10b981', cancelled:'#ef4444' };
    el.innerHTML = orders.slice(0,30).map(o => `
      <div style="background:white;border:1.5px solid var(--border);border-radius:12px;padding:1rem;margin-bottom:.6rem;display:flex;justify-content:space-between;flex-wrap:wrap;gap:.5rem">
        <div><strong style="font-size:.88rem">${o.store?.name||'Store'}</strong> → <span style="color:var(--muted)">${o.user?.name||'User'}</span>
          <div style="color:var(--muted);font-size:.76rem;margin-top:2px">${new Date(o.createdAt).toLocaleString()}</div></div>
        <div style="display:flex;align-items:center;gap:.7rem">
          <strong style="color:var(--green2);font-size:.9rem">₹${o.totalAmount?.toFixed(2)}</strong>
          <span style="background:${colors[o.status]}18;color:${colors[o.status]};padding:3px 10px;border-radius:20px;font-size:.72rem;font-weight:700">${o.status.toUpperCase()}</span>
        </div>
      </div>`).join('') || '<p style="color:var(--muted)">No orders yet</p>';
  } catch { el.innerHTML = '<p style="color:var(--red)">Error loading</p>'; }
}

async function loadLowStock() {
  const el = document.getElementById('lowStockList'); if (!el) return;
  try {
    const items = await get('/inventory/low-stock', true);
    el.innerHTML = items.length ? items.map(i => `
      <div style="background:#fffbeb;border:1.5px solid #fde68a;border-radius:10px;padding:1rem;margin-bottom:.6rem;display:flex;justify-content:space-between;align-items:center">
        <div><strong>${i.medicine?.name||'Medicine'}</strong><div style="color:var(--muted);font-size:.8rem">at ${i.store?.name||'Store'}</div></div>
        <span style="color:var(--red);font-weight:800">${i.stock} left!</span>
      </div>`).join('') : '<p style="color:var(--green2);font-weight:700">✅ All stock levels are healthy!</p>';
  } catch { el.innerHTML = '<p style="color:var(--muted)">Connect as admin/store to view</p>'; }
}

async function loadLowStock2() {
  const el = document.getElementById('lowStock2'); if (!el) return;
  try {
    const items = await get('/inventory/low-stock', true);
    el.innerHTML = items.length ? items.map(i => `
      <div style="background:#fef2f2;border:1.5px solid #fecaca;border-radius:10px;padding:1rem;margin-bottom:.6rem;display:flex;justify-content:space-between;align-items:center">
        <div><strong>${i.medicine?.name||'Medicine'}</strong><div style="color:var(--muted);font-size:.8rem">at ${i.store?.name||'Store'}</div></div>
        <span style="color:var(--red);font-weight:800">${i.stock} units left!</span>
      </div>`).join('') : '<p style="color:var(--green2);font-weight:700">✅ All stock levels healthy!</p>';
  } catch { el.innerHTML = '<p style="color:var(--muted)">Error loading</p>'; }
}

async function loadStoreOrders() {
  const el = document.getElementById('storeOrdersList'); if (!el) return;
  try {
    const orders = await get('/orders/all', true);
    el.innerHTML = orders.length ? orders.slice(0,10).map(o => `
      <div class="order-card">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:.4rem;margin-bottom:.4rem">
          <strong style="font-size:.88rem;color:var(--navy)">${o.user?.name||'Customer'}</strong>
          <button style="background:#dcfce7;color:#166534;border:1px solid #bbf7d0;padding:5px 12px;border-radius:6px;font-size:.75rem;font-weight:700;cursor:pointer" onclick="updateOrderStatus('${o._id}','completed')">Mark Complete</button>
        </div>
        <p style="color:var(--muted);font-size:.82rem">${o.items?.map(i=>i.medicine?.name||'Item').join(', ')}</p>
        <div style="display:flex;justify-content:space-between;margin-top:.5rem">
          <span style="color:var(--muted);font-size:.75rem">${new Date(o.createdAt).toLocaleString()}</span>
          <strong style="color:var(--green2)">₹${o.totalAmount?.toFixed(2)}</strong>
        </div>
      </div>`).join('') : '<p style="color:var(--muted);padding:1rem">No orders yet</p>';
  } catch { el.innerHTML = '<p style="color:var(--muted)">Error loading</p>'; }
}

async function updateOrderStatus(id, status) {
  try {
    await fetch(API + '/orders/' + id + '/status', { method:'PUT', headers:{'Content-Type':'application/json','Authorization':'Bearer '+token}, body:JSON.stringify({status}) });
    showToast('✅ Order marked as ' + status); loadStoreOrders();
  } catch { showToast('❌ Error updating'); }
}

async function addMed() {
  const name = document.getElementById('mName').value;
  if (!name) { showToast('Please enter medicine name'); return; }
  try {
    const body = { name, genericName: document.getElementById('mGeneric').value, category: document.getElementById('mCat').value, manufacturer: document.getElementById('mMfr').value, description: document.getElementById('mDesc').value, uses: document.getElementById('mUses').value.split(',').map(s=>s.trim()).filter(Boolean), sideEffects: document.getElementById('mSE').value.split(',').map(s=>s.trim()).filter(Boolean), dosage: document.getElementById('mDosage').value, requiresPrescription: document.getElementById('mRx').value === 'true' };
    const data = await post('/medicines', body, true);
    document.getElementById('addMedMsg').innerHTML = `<span style="color:var(--green2);font-weight:700">✅ "${data.name}" added successfully!</span>`;
    showToast('Medicine added: ' + data.name);
  } catch(err) { showToast('❌ ' + err.message); }
}

// ── EMERGENCY ──────────────────────────────────────────────────────────────
function toggleEmrg() { const p = document.getElementById('emrgPanel'); p.style.display = p.style.display === 'none' ? 'flex' : 'none'; }
async function emrgSearch(q) {
  if (!q || q.length < 2) return;
  const el = document.getElementById('emrgResults');
  const meds = await get('/medicines/search?q=' + encodeURIComponent(q));
  el.innerHTML = meds.slice(0,5).map(m => `
    <div style="background:#fef2f2;border:1.5px solid #fecaca;border-radius:8px;padding:.8rem;margin-top:.4rem;cursor:pointer;display:flex;justify-content:space-between" onclick="toggleEmrg();viewMed('${m._id}')">
      <div><strong>${m.name}</strong><div style="font-size:.78rem;color:var(--muted)">${m.category}</div></div>
      <div style="color:var(--green2);font-weight:700">${m.availableIn} store(s)</div>
    </div>`).join('') || '<p style="color:var(--muted);padding:.5rem">No results found</p>';
}

// ── PRESCRIPTION ───────────────────────────────────────────────────────────
function handlePresc(input) {
  if (!input.files[0]) return;
  showToast('📋 Prescription "' + input.files[0].name + '" uploaded!');
}

// ── CHATBOT ────────────────────────────────────────────────────────────────
let chatOpen = true;
function toggleChat() { chatOpen = !chatOpen; document.getElementById('chatBody').style.display = chatOpen ? 'flex' : 'none'; document.getElementById('chatTgl').textContent = chatOpen ? '▲' : '▼'; }
function qc(m) { document.getElementById('chatIn').value = m; sendMsg(); }

async function sendMsg() {
  const input = document.getElementById('chatIn');
  const msg = input.value.trim(); if (!msg) return;
  const msgs = document.getElementById('chatMsgs');
  msgs.innerHTML += `<div class="umsg">${msg}</div>`;
  input.value = ''; msgs.scrollTop = msgs.scrollHeight;
  const typing = document.createElement('div');
  typing.className = 'bmsg'; typing.id = 'typing'; typing.innerHTML = '<em style="color:#94a3b8">typing...</em>';
  msgs.appendChild(typing); msgs.scrollTop = msgs.scrollHeight;
  const reply = await botReply(msg);
  document.getElementById('typing')?.remove();
  msgs.innerHTML += `<div class="bmsg">${reply}</div>`;
  msgs.scrollTop = msgs.scrollHeight;
}

async function botReply(msg) {
  const l = msg.toLowerCase();
  if (l.match(/hi|hello|hey/)) return `👋 Hello! I'm <strong>MediBot</strong>. How can I help you today?`;
  if (l.match(/map|store|pharmacy|location|near/)) { showPage('stores'); return `🗺️ Opening the <strong>Store Map</strong>! You can see all 4 pharmacies in Hyderabad. Click <strong>"My Location"</strong> to find the nearest one!`; }
  if (l.match(/direction|navigate|how to reach/)) return `🗺️ Go to <strong>Store Map</strong> → Click any pharmacy → Click <strong>"Get Directions"</strong> to open navigation!`; 
  if (l.match(/share/)) return `📤 Go to <strong>Store Map</strong> → Click any pharmacy → Click <strong>"Share Location"</strong> to share via WhatsApp or SMS!`;
  if (l.match(/price|cost|cheap|save/)) return `💰 Search any medicine to compare prices. Results are sorted <strong>cheapest first</strong>! Also check AI Alternatives to save up to 70%.`;
  if (l.match(/alternative|substitute|generic/)) return `🤖 Search a medicine → click it → scroll to <strong>"Cheaper Alternatives"</strong> section. Generic medicines can save you a lot!`;
  if (l.match(/emergency|urgent|sos/)) { toggleEmrg(); return `🚨 Opened <strong>Emergency Panel</strong>! Ambulance: <strong>108</strong> · Hospital: <strong>102</strong>`; }
  if (l.match(/prescription|rx/)) return `📋 Go to <strong>Search page</strong> → Click <strong>"Upload Prescription"</strong> to upload your doctor's prescription!`;
  try {
    const meds = await get('/medicines/search?q=' + encodeURIComponent(msg));
    if (meds.length) return `💊 Found <strong>${meds.length}</strong> result(s) for "<strong>${msg}</strong>":<br><br>${meds.slice(0,4).map(m=>`• <strong>${m.name}</strong>${m.lowestPrice?' — from ₹'+m.lowestPrice.toFixed(2):''}`).join('<br>')}<br><br><a href="#" onclick="qs('${msg}')" style="color:var(--blue);font-weight:700">View all results →</a>`;
  } catch {}
  return `🤖 I can help with:<br>• "Find Paracetamol"<br>• "Show pharmacy map"<br>• "Cheap alternatives"<br>• "Get directions"<br>• "Emergency help"`;
}

// ── API HELPERS ────────────────────────────────────────────────────────────
async function get(path, auth = false) {
  const headers = auth && token ? { Authorization: 'Bearer ' + token } : {};
  const res = await fetch(API + path, { headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message);
  return data;
}
async function post(path, body, auth = false) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth && token) headers.Authorization = 'Bearer ' + token;
  const res = await fetch(API + path, { method: 'POST', headers, body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message);
  return data;
}
function showErr(id, msg) { const el = document.getElementById(id); el.textContent = msg; el.style.display = 'block'; }
function showToast(msg) { const t = document.getElementById('toast'); t.textContent = msg; t.style.display = 'block'; clearTimeout(t._t); t._t = setTimeout(() => t.style.display = 'none', 3500); }

// ══════════════════════════════════════════════════════════════════
// ── FIX 1: PAYMENT (Razorpay + COD) ──────────────────────────────
// ══════════════════════════════════════════════════════════════════
let pendingOrderData = null;

// Replace old placeOrder with payment-first flow
async function placeOrder(storeId, medId, price, discount) {
  if (!currentUser) { showPage('login'); return; }
  const qty = prompt('Enter quantity:', '1');
  if (!qty || isNaN(qty) || +qty <= 0) return;
  const finalPrice = price * (1 - discount/100);
  const total = (finalPrice * +qty).toFixed(2);
  pendingOrderData = { storeId, medId, price: +price, discount: +discount, qty: +qty, total: +total };
  openPayModal(storeId, medId, total);
}

function openPayModal(storeId, medId, total) {
  const modal = document.getElementById('payModal');
  document.getElementById('payOrderSummary').innerHTML =
    `<div style="display:flex;justify-content:space-between;align-items:center">
      <span style="color:var(--muted)">Order Total</span>
      <strong style="color:var(--green2);font-size:1.1rem">₹${total}</strong>
    </div>
    <div style="color:var(--muted);font-size:.78rem;margin-top:4px">Qty: ${pendingOrderData.qty} · ${pendingOrderData.discount>0?pendingOrderData.discount+'% discount applied':''}</div>`;
  modal.style.display = 'flex';
}

function closePayModal() {
  document.getElementById('payModal').style.display = 'none';
  pendingOrderData = null;
}

async function payWith(method) {
  if (!pendingOrderData) return;
  if (method === 'cod') {
    closePayModal();
    await confirmOrder(null);
  } else {
    // Razorpay
    try {
      const rzpOrder = await post('/payment/create-order', { amount: pendingOrderData.total, receipt: 'order_' + Date.now() }, true);
      if (rzpOrder.demo) {
        // Demo mode — simulate success
        closePayModal();
        showToast('💳 Payment simulated (Demo mode)');
        await confirmOrder('demo_pay_' + Date.now());
        return;
      }
      const options = {
        key: rzpOrder.key,
        amount: rzpOrder.amount,
        currency: rzpOrder.currency,
        name: 'MediFind',
        description: 'Medicine Order',
        image: '',
        order_id: rzpOrder.orderId,
        handler: async (response) => {
          closePayModal();
          // Verify payment
          await post('/payment/verify', {
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature
          }, true);
          await confirmOrder(response.razorpay_payment_id);
        },
        prefill: { name: currentUser.name, email: currentUser.email || '' },
        theme: { color: '#0ea5e9' },
        modal: { ondismiss: () => showToast('Payment cancelled') }
      };
      const rzp = new Razorpay(options);
      rzp.open();
    } catch(err) {
      showToast('❌ Payment error: ' + err.message);
    }
  }
}

async function confirmOrder(paymentId) {
  if (!pendingOrderData) return;
  try {
    const data = await post('/orders', {
      store: pendingOrderData.storeId,
      items: [{ medicine: pendingOrderData.medId, quantity: pendingOrderData.qty, price: pendingOrderData.price }],
      paymentMethod: paymentId ? 'razorpay' : 'cash',
      paymentId: paymentId
    }, true);
    showToast('✅ Order placed! Total: ₹' + data.totalAmount + (paymentId && !paymentId.startsWith('demo') ? ' · Payment confirmed' : ' · Pay at pickup'));
    showToast('📧 Confirmation email sent!');
    pendingOrderData = null;
    document.getElementById('obadge').style.display = 'inline';
    setTimeout(() => showPage('orders'), 1800);
  } catch(err) {
    showToast('❌ Order failed: ' + err.message);
  }
}

// ══════════════════════════════════════════════════════════════════
// ── FIX 2: PROFILE PAGE ──────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════
async function loadProfile() {
  if (!currentUser) { showPage('login'); return; }
  try {
    const profile = await get('/profile', true);
    document.getElementById('pf-name').textContent = profile.name;
    document.getElementById('pf-email').textContent = profile.email;
    document.getElementById('pf-role').innerHTML = `<span style="background:rgba(255,255,255,.2);color:white;padding:3px 12px;border-radius:20px;font-size:.75rem;font-weight:700;text-transform:uppercase">${profile.role}</span>`;
    document.getElementById('pf-orders').textContent = profile.totalOrders || 0;
    document.getElementById('pf-spent').textContent = '₹' + (profile.totalSpent || 0).toFixed(0);
    // Fill form
    document.getElementById('pf-inp-name').value = profile.name || '';
    document.getElementById('pf-inp-phone').value = profile.phone || '';
    document.getElementById('pf-inp-address').value = profile.address || '';
    document.getElementById('pf-inp-age').value = profile.age || '';
    document.getElementById('pf-inp-blood').value = profile.bloodGroup || '';
    document.getElementById('pf-inp-allergies').value = profile.allergies || '';
    loadFavourites();
  } catch(err) { showToast('❌ Error loading profile'); }
}

async function saveProfile() {
  try {
    await fetch(API + '/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({
        name: document.getElementById('pf-inp-name').value,
        phone: document.getElementById('pf-inp-phone').value,
        address: document.getElementById('pf-inp-address').value,
        age: document.getElementById('pf-inp-age').value,
        bloodGroup: document.getElementById('pf-inp-blood').value,
        allergies: document.getElementById('pf-inp-allergies').value
      })
    });
    document.getElementById('pf-msg').textContent = '✅ Profile saved successfully!';
    setTimeout(() => document.getElementById('pf-msg').textContent = '', 3000);
    showToast('✅ Profile updated!');
    // Update nav name
    currentUser.name = document.getElementById('pf-inp-name').value;
    localStorage.setItem('user', JSON.stringify(currentUser));
    document.getElementById('uname').textContent = '👤 ' + currentUser.name;
  } catch { showToast('❌ Save failed'); }
}

async function changePassword() {
  const cur = document.getElementById('pw-cur').value;
  const nw = document.getElementById('pw-new').value;
  const msg = document.getElementById('pw-msg');
  if (!cur || !nw) { msg.style.color='var(--red)'; msg.textContent = 'Fill both fields'; return; }
  try {
    await fetch(API + '/profile/change-password', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ currentPassword: cur, newPassword: nw })
    });
    msg.style.color = 'var(--green2)'; msg.textContent = '✅ Password changed!';
    document.getElementById('pw-cur').value = ''; document.getElementById('pw-new').value = '';
  } catch(err) { msg.style.color = 'var(--red)'; msg.textContent = '❌ ' + err.message; }
}

async function loadFavourites() {
  const el = document.getElementById('favsList'); if (!el) return;
  try {
    const favs = await get('/profile/favourites', true);
    el.innerHTML = favs.length ? favs.map(f => `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:.6rem 0;border-bottom:1px solid #f1f5f9;font-size:.85rem">
        <span style="cursor:pointer;color:var(--blue);font-weight:700" onclick="viewMed('${f.medicineId}')">${f.medicine?.name||'Medicine'}</span>
        <span style="color:var(--muted);font-size:.78rem">${f.medicine?.category||''}</span>
      </div>`).join('') : '<p style="color:var(--muted);font-size:.83rem">No saved medicines yet.<br>Click ⭐ on any medicine to save it.</p>';
  } catch { el.innerHTML = '<p style="color:var(--muted);font-size:.83rem">Log in to see favourites</p>'; }
}

async function saveFavourite(medicineId, name) {
  if (!currentUser) { showPage('login'); return; }
  try {
    await post('/profile/favourites', { medicineId }, true);
    showToast('⭐ ' + name + ' saved to favourites!');
  } catch(err) { showToast(err.message === 'Already saved' ? '⭐ Already in favourites!' : '❌ ' + err.message); }
}

// ══════════════════════════════════════════════════════════════════
// ── FIX 3: MEDICINE REMINDERS ────────────────────────────────────
// ══════════════════════════════════════════════════════════════════
async function loadReminders() {
  if (!currentUser) { showPage('login'); return; }
  const el = document.getElementById('remindersList'); if (!el) return;
  try {
    const reminders = await get('/profile/reminders', true);
    el.innerHTML = reminders.length ? reminders.map(r => `
      <div style="background:white;border:1.5px solid var(--border);border-radius:12px;padding:1rem 1.2rem;margin-bottom:.7rem;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:.5rem;box-shadow:0 1px 6px rgba(0,0,0,.04)">
        <div>
          <div style="font-weight:800;color:var(--navy);font-size:.9rem;display:flex;align-items:center;gap:7px">
            <span style="width:10px;height:10px;background:var(--green);border-radius:50%;display:inline-block"></span>
            ${r.medicineName}
          </div>
          <div style="color:var(--muted);font-size:.78rem;margin-top:3px">
            🕐 ${r.time} · 📅 ${r.frequency.replace('_',' ')} ${r.notes?'· '+r.notes:''}
          </div>
        </div>
        <button onclick="deleteReminder('${r._id}')" style="background:#fee2e2;color:var(--red);border:1px solid #fecaca;padding:6px 12px;border-radius:7px;cursor:pointer;font-weight:700;font-size:.78rem"><i class="fas fa-trash"></i></button>
      </div>`).join('') :
      `<div class="empty-state"><i class="fas fa-bell-slash"></i><h3>No reminders yet</h3><p>Set your first reminder above</p></div>`;
    // Schedule browser notifications for active reminders
    scheduleNotifications(reminders);
  } catch { el.innerHTML = `<div class="empty-state"><i class="fas fa-bell-slash"></i><h3>Login to see reminders</h3></div>`; }
}

async function saveReminder() {
  const med = document.getElementById('rm-med').value;
  const time = document.getElementById('rm-time').value;
  const freq = document.getElementById('rm-freq').value;
  const notes = document.getElementById('rm-notes').value;
  if (!med || !time) { document.getElementById('rm-msg').style.color='var(--red)'; document.getElementById('rm-msg').textContent='Medicine name and time are required'; return; }
  try {
    await post('/profile/reminders', { medicineName: med, time, frequency: freq, notes }, true);
    document.getElementById('rm-msg').style.color = 'var(--green2)';
    document.getElementById('rm-msg').textContent = '✅ Reminder set for ' + med + ' at ' + time;
    document.getElementById('rm-med').value = '';
    document.getElementById('rm-notes').value = '';
    loadReminders();
    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then(p => { if (p === 'granted') showToast('🔔 Notifications enabled!'); });
    }
  } catch(err) { document.getElementById('rm-msg').textContent = '❌ ' + err.message; }
}

async function deleteReminder(id) {
  try {
    await fetch(API + '/profile/reminders/' + id, { method: 'DELETE', headers: { 'Authorization': 'Bearer ' + token } });
    showToast('🗑️ Reminder deleted'); loadReminders();
  } catch { showToast('❌ Delete failed'); }
}

function scheduleNotifications(reminders) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  reminders.forEach(r => {
    const [h, m] = r.time.split(':').map(Number);
    const now = new Date();
    let fire = new Date(); fire.setHours(h, m, 0, 0);
    if (fire <= now) fire.setDate(fire.getDate() + 1);
    const delay = fire - now;
    if (delay < 24 * 60 * 60 * 1000) { // only schedule if within 24 hrs
      setTimeout(() => {
        new Notification('💊 Medicine Reminder — MediFind', {
          body: 'Time to take: ' + r.medicineName + (r.notes ? '\n' + r.notes : ''),
          icon: '/favicon.ico'
        });
      }, delay);
    }
  });
}

// ══════════════════════════════════════════════════════════════════
// ── OVERRIDE showPage to load new pages ──────────────────────────
// ══════════════════════════════════════════════════════════════════
const _origShowPage = showPage;
showPage = function(p) {
  _origShowPage(p);
  if (p === 'profile') loadProfile();
  if (p === 'reminders') loadReminders();
};
