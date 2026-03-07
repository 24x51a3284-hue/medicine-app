const API = window.location.hostname === 'localhost' ? 'http://localhost:5000/api' : '/api';
let currentUser = null, token = localStorage.getItem('token');
let allResults = [], socket, storeMap = null, mapMarkers = [], allStores = [], myLocMarker = null;
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
    }, 400);
  }
  ldEl.textContent = Math.floor(pct) + '%';
}, 100);

// ── PARTICLE CANVAS ────────────────────────────────────────────────────────
const canvas = document.getElementById('bgc');
const ctx = canvas.getContext('2d');
let W, H, particles = [];
function resize() { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; }
resize(); window.addEventListener('resize', resize);
class Particle {
  constructor() { this.reset(); }
  reset() {
    this.x = Math.random() * W; this.y = Math.random() * H;
    this.vx = (Math.random() - .5) * .35; this.vy = (Math.random() - .5) * .35;
    this.r = Math.random() * 1.2 + .2;
    this.color = Math.random() > .5 ? '0,245,255' : '124,58,237';
    this.alpha = Math.random() * .45 + .08;
  }
  update() { this.x += this.vx; this.y += this.vy; if (this.x < 0 || this.x > W || this.y < 0 || this.y > H) this.reset(); }
  draw() { ctx.beginPath(); ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2); ctx.fillStyle = `rgba(${this.color},${this.alpha})`; ctx.fill(); }
}
for (let i = 0; i < 130; i++) particles.push(new Particle());
function drawCanvas() {
  ctx.clearRect(0, 0, W, H);
  // Connect nearby particles
  for (let i = 0; i < particles.length; i++) {
    for (let j = i + 1; j < particles.length; j++) {
      const dx = particles[i].x - particles[j].x, dy = particles[i].y - particles[j].y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < 110) { ctx.beginPath(); ctx.strokeStyle = `rgba(0,245,255,${.04 * (1 - d / 110)})`; ctx.lineWidth = .5; ctx.moveTo(particles[i].x, particles[i].y); ctx.lineTo(particles[j].x, particles[j].y); ctx.stroke(); }
    }
    particles[i].update(); particles[i].draw();
  }
  requestAnimationFrame(drawCanvas);
}
drawCanvas();

// ── CUSTOM CURSOR ──────────────────────────────────────────────────────────
const cur = document.getElementById('cur'), cur2 = document.getElementById('cur2');
document.addEventListener('mousemove', e => { mx = e.clientX; my = e.clientY; cur.style.left = mx + 'px'; cur.style.top = my + 'px'; });
function animCur() { rx += (mx - rx) * .12; ry += (my - ry) * .12; cur2.style.left = rx + 'px'; cur2.style.top = ry + 'px'; requestAnimationFrame(animCur); }
animCur();
document.addEventListener('mouseover', e => {
  if (e.target.closest('a,button,.cat-card,.med-card,.store-list-card,.feat-card,.alt-card')) {
    cur.style.width = '18px'; cur.style.height = '18px'; cur.style.background = 'var(--purple)';
    cur2.style.width = '55px'; cur2.style.height = '55px';
  } else { cur.style.width = '10px'; cur.style.height = '10px'; cur.style.background = 'var(--cyan)'; cur2.style.width = '35px'; cur2.style.height = '35px'; }
});

// ── SCROLL REVEAL ──────────────────────────────────────────────────────────
const revObs = new IntersectionObserver(entries => {
  entries.forEach((e, i) => { if (e.isIntersecting) setTimeout(() => e.target.classList.add('visible'), i * 80); });
}, { threshold: .1 });
document.querySelectorAll('.reveal').forEach(r => revObs.observe(r));

// ── COUNTER ANIMATION ──────────────────────────────────────────────────────
function animateCounters() {
  document.querySelectorAll('.hstat-num[data-t]').forEach(el => {
    const target = +el.dataset.t; let cur = 0;
    const timer = setInterval(() => {
      cur += target / 50;
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

// ── REAL-TIME SOCKET.IO ────────────────────────────────────────────────────
function initSocket() {
  try {
    socket = io();
    socket.on('connect', () => showRT('🟢 Real-time connected! Stock updates live.'));
    socket.on('stock-updated', d => { showRT('📦 Stock updated — ' + d.stock + ' units remaining'); showToast('📦 Live stock update received!'); });
    socket.on('order-placed', () => showRT('🛒 New order placed — stock updated live'));
    socket.on('order-status-updated', d => { if (currentUser && d.userId === currentUser.id) { showToast('✅ Your order: ' + d.status.toUpperCase()); document.getElementById('obadge').style.display = 'inline'; } });
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

// ── SEARCH HELPERS ─────────────────────────────────────────────────────────
function heroType(v) { if (v.length > 1) { showPage('search'); document.getElementById('mainSearch').value = v; searchMeds(v); } }
function goSearch() { const v = document.getElementById('heroIn').value; if (v) { showPage('search'); document.getElementById('mainSearch').value = v; searchMeds(v); } }
function qs(q) { showPage('search'); document.getElementById('mainSearch').value = q; searchMeds(q); }

let searchTimer;
function searchMeds(q) {
  clearTimeout(searchTimer);
  if (!q || q.length < 2) return;
  searchTimer = setTimeout(() => doSearch(q), 350);
}

async function doSearch(q) {
  const el = document.getElementById('searchResults');
  el.innerHTML = `<div class="loading"><div class="spinner"></div><p style="color:var(--muted);font-size:.85rem">Searching for "${q}"...</p></div>`;
  try {
    const meds = await get('/medicines/search?q=' + encodeURIComponent(q));
    allResults = meds;
    renderResults(meds, q);
  } catch {
    el.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-circle"></i><h3>Connection error</h3><p>Make sure the server is running</p></div>`;
  }
}

function renderResults(meds, q) {
  const el = document.getElementById('searchResults');
  if (!meds.length) { el.innerHTML = `<div class="empty-state"><i class="fas fa-pills"></i><h3>No results for "${q}"</h3><p>Try different keywords</p></div>`; return; }
  el.innerHTML = `<p style="color:var(--muted);font-size:.83rem;margin-bottom:1rem">Found <strong style="color:white">${meds.length}</strong> result(s) for "<strong style="color:var(--cyan)">${q}</strong>"</p>` +
    meds.map((m, i) => `
      <div class="med-card" onclick="viewMed('${m._id}')">
        <div class="med-card-info">
          <div class="mc-name">${m.name} ${i === 0 && meds.length > 1 ? '<span class="badge bp">TOP MATCH</span>' : ''}</div>
          <div class="mc-sub">${m.genericName ? m.genericName + ' · ' : ''}${m.manufacturer || ''}</div>
          <div class="mc-badges">
            ${m.category ? `<span class="badge bc">${m.category}</span>` : ''}
            ${m.requiresPrescription ? `<span class="badge bo">Rx Required</span>` : `<span class="badge bg">OTC</span>`}
            ${m.availableIn > 0 ? `<span class="badge bg"><span class="live-dot"></span>${m.availableIn} store(s)</span>` : `<span class="badge br">Out of stock</span>`}
          </div>
        </div>
        <div class="mc-right">
          ${m.lowestPrice !== null ? `<div class="mc-avail">from</div><div class="mc-price">₹${m.lowestPrice.toFixed(2)}</div>` : '<div class="mc-avail">No stock</div>'}
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
  el.innerHTML = `<div class="loading" style="padding:5rem"><div class="spinner"></div><p style="color:var(--muted)">Loading medicine...</p></div>`;
  try {
    const [{ medicine, availability }, alternatives] = await Promise.all([get('/medicines/' + id), get('/medicines/' + id + '/alternatives')]);
    const lowest = availability[0];
    el.innerHTML = `
      <div class="med-detail">
        <button class="back-btn" onclick="showPage('search')"><i class="fas fa-arrow-left"></i> Back to Search</button>
        <div class="md-header">
          <h1>${medicine.name}</h1>
          <p>${medicine.genericName ? medicine.genericName + ' · ' : ''}${medicine.manufacturer || ''}</p>
          ${medicine.description ? `<p style="margin-top:.5rem;font-size:.88rem">${medicine.description}</p>` : ''}
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:1rem">
            ${medicine.category ? `<span class="badge bc">${medicine.category}</span>` : ''}
            ${medicine.requiresPrescription ? `<span class="badge bo">⚕️ Prescription Required</span>` : `<span class="badge bg">✓ Over The Counter</span>`}
            ${medicine.dosage ? `<span class="badge bp">💊 ${medicine.dosage}</span>` : ''}
            ${lowest ? `<span class="badge bg">💰 From ₹${(lowest.price*(1-(lowest.discount||0)/100)).toFixed(2)}</span>` : ''}
            <span class="badge bg"><span class="live-dot"></span>Live Stock</span>
          </div>
        </div>
        <div class="md-grid">
          <div class="dcard"><h3><i class="fas fa-stethoscope"></i> Uses & Indications</h3><ul>${medicine.uses?.length ? medicine.uses.map(u=>`<li>${u}</li>`).join('') : '<li>Not specified</li>'}</ul></div>
          <div class="dcard"><h3><i class="fas fa-exclamation-triangle"></i> Side Effects</h3><ul>${medicine.sideEffects?.length ? medicine.sideEffects.map(s=>`<li>${s}</li>`).join('') : '<li>Not specified</li>'}</ul></div>
        </div>
        <div class="avail-sec">
          <h2><i class="fas fa-store" style="color:var(--cyan)"></i> Available at ${availability.length} Store(s) <span style="font-size:.78rem;font-weight:400;color:var(--muted)">— sorted cheapest first</span></h2>
          ${availability.length ? availability.map((inv, i) => {
            const fp = (inv.price * (1 - (inv.discount||0)/100)).toFixed(2);
            return `<div class="store-card ${i===0?'cheapest-card':''}">
              <div class="si">
                <h4>${inv.store?.name || 'Unknown'} ${i===0?'<span class="cheapest-tag">CHEAPEST</span>':''}</h4>
                <p><i class="fas fa-map-marker-alt"></i>${inv.store?.address||''}</p>
                <p><i class="fas fa-clock"></i>${inv.store?.openingHours||''} <span style="color:${inv.store?.isOpen?'#10b981':'#ef4444'};font-weight:600;margin-left:4px">${inv.store?.isOpen?'● Open':'● Closed'}</span></p>
                <p><i class="fas fa-boxes"></i><span data-med="${medicine._id}" data-store="${inv.store?._id}" style="color:${inv.stock<10?'#ef4444':'#10b981'};font-weight:600">${inv.stock} units</span> in stock</p>
                ${inv.expiryDate?`<p><i class="fas fa-calendar-alt"></i>Exp: ${inv.expiryDate}</p>`:''}
              </div>
              <div style="display:flex;align-items:center;gap:.8rem;flex-wrap:wrap">
                <div class="text-right">
                  ${inv.discount?`<div class="sp-orig">₹${inv.price.toFixed(2)}</div>`:''}
                  <div class="sp-final">₹${fp}</div>
                  ${inv.discount?`<div class="sp-disc">🏷️ ${inv.discount}% OFF</div>`:''}
                </div>
                ${currentUser
                  ? `<button class="btn-order" onclick="placeOrder('${inv.store?._id}','${medicine._id}','${inv.price}','${inv.discount||0}')"><i class="fas fa-cart-plus"></i> Order</button>`
                  : `<button class="btn-order" onclick="showPage('login')">Login to Order</button>`}
                <button class="btn-map" onclick="viewOnMap('${inv.store?._id}')"><i class="fas fa-map-marked-alt"></i> Map</button>
              </div>
            </div>`;
          }).join('') : `<div class="empty-state"><i class="fas fa-store-slash"></i><h3>Not available anywhere</h3></div>`}
        </div>
        ${alternatives.length ? `
        <div class="alt-sec">
          <h2><i class="fas fa-robot" style="color:#10b981"></i> AI Suggested Alternatives <span style="font-size:.78rem;font-weight:400;color:var(--muted)">— may save you money!</span></h2>
          ${alternatives.map(a => `
            <div class="alt-card" onclick="viewMed('${a.medicine._id}')">
              <div>
                <strong>${a.medicine.name}</strong>
                <div style="color:var(--muted);font-size:.8rem;margin-top:2px">${a.medicine.genericName||''} · ${a.medicine.category||''}</div>
                ${!a.medicine.requiresPrescription?'<span class="badge bg" style="margin-top:4px">OTC</span>':''}
              </div>
              <div style="text-align:right">
                ${a.cheapestOption ? `<div style="color:#10b981;font-family:Orbitron,sans-serif;font-size:1rem;font-weight:700">₹${(a.cheapestOption.price*(1-(a.cheapestOption.discount||0)/100)).toFixed(2)}</div><div style="font-size:.72rem;color:var(--muted)">${a.cheapestOption.store?.name||''}</div>` : '<div style="color:var(--muted);font-size:.8rem">Check stock</div>'}
                <div style="color:var(--cyan);font-size:.72rem;margin-top:3px">View →</div>
              </div>
            </div>`).join('')}
        </div>` : ''}
      </div>`;
  } catch(err) {
    el.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-circle"></i><h3>Error loading</h3><p>${err.message}</p></div>`;
  }
}

function viewOnMap(storeId) {
  showPage('stores');
  setTimeout(() => {
    highlightStore(storeId);
    const marker = mapMarkers.find(m => m.storeId === storeId);
    if (marker && storeMap) { storeMap.setView(marker.getLatLng(), 16); marker.openPopup(); }
  }, 800);
}

// ── ORDER ──────────────────────────────────────────────────────────────────
async function placeOrder(storeId, medId, price, discount) {
  if (!currentUser) { showPage('login'); return; }
  const qty = prompt('Enter quantity (units):', '1');
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
  document.getElementById('uname').textContent = '👤 ' + currentUser.name;
}

function fill(e, p) { document.getElementById('loginEmail').value = e; document.getElementById('loginPass').value = p; }

// ── STORES & MAP ───────────────────────────────────────────────────────────
async function loadStores() {
  const el = document.getElementById('storesList');
  el.innerHTML = `<div class="loading"><div class="spinner"></div></div>`;
  try {
    allStores = await get('/stores');
    document.getElementById('scnt').textContent = allStores.length + ' Stores';
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
      <h3><i class="fas fa-clinic-medical" style="color:var(--cyan)"></i>${s.name}</h3>
      <p><i class="fas fa-map-marker-alt"></i>${s.address}</p>
      ${s.phone?`<p><i class="fas fa-phone"></i>${s.phone}</p>`:''}
      <p><i class="fas fa-clock"></i>${s.openingHours||'Hours not listed'}</p>
      ${s.rating?`<div class="rating-stars">${'★'.repeat(Math.floor(s.rating))}${'☆'.repeat(5-Math.floor(s.rating))} <span style="color:var(--muted);font-size:.75rem">${s.rating}/5</span></div>`:''}
      <span class="open-badge ${s.isOpen?'is-open':'is-closed'}">${s.isOpen?'● Open Now':'● Closed'}</span>
      <div class="store-btns">
        <button class="dir-btn" onclick="getDirections(${s.location?.lat},${s.location?.lng},'${s.name}')"><i class="fas fa-directions"></i> Directions</button>
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
  // Update map markers
  mapMarkers.forEach(m => {
    const store = allStores.find(s => s._id === m.storeId);
    if (store) {
      if (type === 'open' && !store.isOpen) m.setOpacity(.25);
      else m.setOpacity(1);
    }
  });
}

function initMap(stores) {
  if (storeMap) { storeMap.remove(); storeMap = null; }
  // Default center: Hyderabad
  storeMap = L.map('storeMap', { zoomControl: true, attributionControl: false }).setView([17.385, 78.4867], 12);

  // Dark tile layer
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap',
    opacity: 0.7
  }).addTo(storeMap);

  mapMarkers = [];

  stores.forEach(store => {
    if (!store.location?.lat) return;
    const icon = L.divIcon({
      html: `<div style="
        width:40px;height:40px;
        background:linear-gradient(135deg,${store.isOpen?'#00f5ff':'#ef4444'},${store.isOpen?'#7c3aed':'#991b1b'});
        border-radius:50% 50% 50% 0;
        transform:rotate(-45deg);
        border:2px solid rgba(255,255,255,.3);
        box-shadow:0 0 20px ${store.isOpen?'rgba(0,245,255,.5)':'rgba(239,68,68,.5)'};
        display:flex;align-items:center;justify-content:center;
      "><div style="width:14px;height:14px;background:white;border-radius:50%;transform:rotate(45deg)"></div></div>`,
      className: '',
      iconSize: [40, 40],
      iconAnchor: [20, 40],
      popupAnchor: [0, -45]
    });

    const marker = L.marker([store.location.lat, store.location.lng], { icon }).addTo(storeMap);
    marker.storeId = store._id;

    marker.bindPopup(`
      <div style="min-width:200px;padding:.2rem">
        <div class="popup-title">🏪 ${store.name}</div>
        <div class="popup-info"><i class="fas fa-map-marker-alt" style="color:var(--cyan)"></i> ${store.address}</div>
        ${store.phone?`<div class="popup-info"><i class="fas fa-phone" style="color:var(--cyan)"></i> ${store.phone}</div>`:''}
        <div class="popup-info"><i class="fas fa-clock" style="color:var(--cyan)"></i> ${store.openingHours||''}</div>
        ${store.rating?`<div class="popup-info">⭐ ${store.rating}/5</div>`:''}
        <div class="${store.isOpen?'popup-open':'popup-closed'}">${store.isOpen?'● Open Now':'● Currently Closed'}</div>
        <button class="popup-btn" onclick="getDirections(${store.location.lat},${store.location.lng},'${store.name}')">🗺️ Get Directions</button>
        <button class="popup-share" onclick="shareLocation('${store.name}','${store.address}',${store.location.lat},${store.location.lng})">📤 Share Location</button>
      </div>
    `);

    marker.on('click', () => highlightStore(store._id));
    mapMarkers.push(marker);
  });

  // Fit map to all markers
  if (mapMarkers.length > 0) {
    const group = L.featureGroup(mapMarkers);
    storeMap.fitBounds(group.getBounds().pad(.1));
  }
}

function focusStore(storeId) {
  // Highlight card
  document.querySelectorAll('.store-list-card').forEach(c => c.classList.remove('active-store'));
  const card = document.getElementById('slc-' + storeId);
  if (card) { card.classList.add('active-store'); card.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
  // Focus map marker
  const marker = mapMarkers.find(m => m.storeId === storeId);
  if (marker && storeMap) { storeMap.setView(marker.getLatLng(), 15, { animate: true }); setTimeout(() => marker.openPopup(), 400); }
}

function highlightStore(storeId) { focusStore(storeId); }

function getMyLoc() {
  if (!navigator.geolocation) { showToast('❌ Geolocation not supported'); return; }
  showToast('📍 Getting your location...');
  navigator.geolocation.getCurrentPosition(pos => {
    const { latitude: lat, longitude: lng } = pos.coords;
    if (storeMap) {
      if (myLocMarker) storeMap.removeLayer(myLocMarker);
      const myIcon = L.divIcon({
        html: `<div style="width:20px;height:20px;background:radial-gradient(circle,#00f5ff,rgba(0,245,255,0));border:2px solid #00f5ff;border-radius:50%;box-shadow:0 0 20px #00f5ff;animation:blink 1.5s infinite"></div>`,
        className: '', iconSize: [20, 20], iconAnchor: [10, 10]
      });
      myLocMarker = L.marker([lat, lng], { icon: myIcon }).addTo(storeMap);
      myLocMarker.bindPopup('<div class="popup-title">📍 You are here</div>').openPopup();
      storeMap.setView([lat, lng], 14, { animate: true });
      // Sort stores by distance
      sortStoresByDistance(lat, lng);
      showToast('✅ Location found! Stores sorted by distance.');
    }
  }, () => showToast('❌ Could not get location'));
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

function getDirections(lat, lng, name) {
  if (!lat || !lng) { showToast('❌ Location not available'); return; }
  const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&destination_place_id=${encodeURIComponent(name)}`;
  window.open(url, '_blank');
  showToast('🗺️ Opening Google Maps...');
}

function shareLocation(name, address, lat, lng) {
  const text = `📍 ${name}\n📌 ${address}\n🗺️ https://maps.google.com/?q=${lat},${lng}\n\n— Shared via MediFind`;
  if (navigator.share) {
    navigator.share({ title: name, text, url: `https://maps.google.com/?q=${lat},${lng}` })
      .then(() => showToast('✅ Location shared!'))
      .catch(() => copyText(text));
  } else { copyText(text); }
}

function copyText(text) {
  navigator.clipboard.writeText(text).then(() => showToast('📋 Location copied to clipboard!')).catch(() => showToast('❌ Could not copy'));
}

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
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:.5rem;margin-bottom:.6rem">
          <h4 style="font-family:Orbitron,sans-serif;font-size:.85rem">${o.store?.name||'Store'}</h4>
          <span class="os-badge" style="background:${colors[o.status]}18;color:${colors[o.status]};border:1px solid ${colors[o.status]}30">${o.status.toUpperCase()}</span>
        </div>
        <p style="color:var(--muted);font-size:.85rem">${o.items?.map(i=>i.medicine?.name||'Medicine').join(', ')}</p>
        <div style="display:flex;justify-content:space-between;margin-top:.8rem;align-items:center">
          <span style="color:var(--muted);font-size:.78rem"><i class="fas fa-clock"></i> ${new Date(o.createdAt).toLocaleString()}</span>
          <strong style="color:#10b981;font-family:Orbitron,sans-serif;font-size:.95rem">₹${o.totalAmount?.toFixed(2)}</strong>
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
      <div class="scard"><i class="fas fa-store"></i><div class="val">4</div><div class="lbl">Stores</div></div>
      <div class="scard"><i class="fas fa-map-marked-alt"></i><div class="val">Live</div><div class="lbl">Store Maps</div></div>
      <div class="scard"><i class="fas fa-bolt"></i><div class="val">RT</div><div class="lbl">Real-Time</div></div>
    </div>
    <div style="display:flex;gap:1rem;flex-wrap:wrap;margin-bottom:2rem">
      <button class="nb" onclick="showPage('search')"><i class="fas fa-search"></i> Search Medicines</button>
      <button class="nb nb-out" onclick="showPage('stores')"><i class="fas fa-map-marked-alt"></i> View Store Map</button>
      <button class="nb nb-out" onclick="showPage('orders')"><i class="fas fa-box"></i> My Orders</button>
    </div>
    <div class="white-box">
      <h3>💡 Tips for You</h3>
      <div class="dcard" style="background:transparent;border:none;padding:0">
        <ul>
          <li>Search any medicine to compare prices across all 4 stores</li>
          <li>Click "Map" on any store to see its exact location</li>
          <li>Use "Get Directions" to navigate directly to a pharmacy</li>
          <li>Share store locations with family using the Share button</li>
          <li>Check AI Alternatives to save up to 70% on medicines</li>
          <li>Emergency SOS button for instant help numbers</li>
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
      <button class="dtab" onclick="swTab(event,'t-map')">🗺️ My Store Map</button>
    </div>
    <div id="t-inv" class="tc active">
      <div class="white-box">
        <h3>➕ Add / Update Inventory</h3>
        <div class="fg"><label>Medicine Name</label><input class="fi" id="invMed" placeholder="e.g. Paracetamol 500mg"/></div>
        <div class="fg"><label>Price (₹)</label><input class="fi" type="number" id="invPrice" placeholder="0.00"/></div>
        <div class="fg"><label>Stock Quantity</label><input class="fi" type="number" id="invStock" placeholder="0"/></div>
        <div class="fg"><label>Discount (%)</label><input class="fi" type="number" id="invDiscount" placeholder="0" min="0" max="50"/></div>
        <div class="fg"><label>Expiry Date</label><input class="fi" type="date" id="invExpiry"/></div>
        <button class="btn-full" style="max-width:220px" onclick="showToast('✅ Connect store ID to save!')">Save Inventory</button>
      </div>
    </div>
    <div id="t-orders" class="tc">
      <div id="storeOrdersList"><div class="loading"><div class="spinner"></div></div></div>
    </div>
    <div id="t-lowstock" class="tc">
      <div id="lowStockList"><div class="loading"><div class="spinner"></div></div></div>
    </div>
    <div id="t-map" class="tc">
      <div class="white-box" style="max-width:100%">
        <h3>🗺️ Your Store Locations</h3>
        <p style="color:var(--muted);font-size:.88rem;margin-bottom:1rem">Click on stores in the map to see details and share locations.</p>
        <button class="nb" onclick="showPage('stores')"><i class="fas fa-map-marked-alt"></i> Open Full Store Map</button>
      </div>
    </div>
  </div>`;
}

function adminDash() {
  return `<div class="dashboard">
    <h1>Admin Dashboard 🛡️</h1>
    <div class="dash-tabs">
      <button class="dtab active" onclick="swTab(event,'t-addmed')">💊 Add Medicine</button>
      <button class="dtab" onclick="swTab(event,'t-allstores');loadAdminStores()">🏪 All Stores</button>
      <button class="dtab" onclick="swTab(event,'t-allorders');loadAllOrders()">📋 All Orders</button>
      <button class="dtab" onclick="swTab(event,'t-lowstock2');loadLowStock2()">⚠️ Low Stock</button>
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
        <div class="fg"><label>Side Effects (comma separated)</label><input class="fi" id="mSE" placeholder="Nausea, Headache"/></div>
        <div class="fg"><label>Dosage</label><input class="fi" id="mDosage" placeholder="1 tablet twice daily"/></div>
        <div class="fg"><label>Requires Prescription?</label><select class="fi" id="mRx"><option value="false">No (OTC)</option><option value="true">Yes (Rx)</option></select></div>
        <button class="btn-full" style="max-width:220px" onclick="addMed()"><i class="fas fa-plus"></i> Add Medicine</button>
        <div id="addMedMsg" style="margin-top:.5rem"></div>
      </div>
    </div>
    <div id="t-allstores" class="tc"><div id="adminStores"><div class="loading"><div class="spinner"></div></div></div></div>
    <div id="t-allorders" class="tc"><div id="adminOrders"><div class="loading"><div class="spinner"></div></div></div></div>
    <div id="t-lowstock2" class="tc"><div id="lowStock2"><div class="loading"><div class="spinner"></div></div></div></div>
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
    <div style="background:var(--card);border:1px solid var(--border);border-radius:12px;padding:1rem;margin-bottom:.7rem;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:.5rem">
      <div><strong style="font-family:Orbitron,sans-serif;font-size:.82rem">${s.name}</strong><div style="color:var(--muted);font-size:.8rem;margin-top:2px">${s.address}</div></div>
      <div style="display:flex;align-items:center;gap:.5rem">
        <span class="open-badge ${s.isOpen?'is-open':'is-closed'}">${s.isOpen?'Open':'Closed'}</span>
        <button class="dir-btn" onclick="viewOnMap('${s._id}')"><i class="fas fa-map"></i></button>
      </div>
    </div>`).join('');
}

async function loadAllOrders() {
  const el = document.getElementById('adminOrders'); if (!el) return;
  try {
    const orders = await get('/orders/all', true);
    const colors = { pending:'#f59e0b', confirmed:'#3b82f6', ready:'#8b5cf6', completed:'#10b981', cancelled:'#ef4444' };
    el.innerHTML = orders.slice(0,30).map(o => `
      <div style="background:var(--card);border:1px solid var(--border);border-radius:12px;padding:1rem;margin-bottom:.7rem;display:flex;justify-content:space-between;flex-wrap:wrap;gap:.5rem">
        <div><strong style="font-size:.88rem">${o.store?.name||'Store'}</strong> → <span style="color:var(--muted)">${o.user?.name||'User'}</span>
          <div style="color:var(--muted);font-size:.78rem;margin-top:2px">${new Date(o.createdAt).toLocaleString()}</div></div>
        <div style="display:flex;align-items:center;gap:.7rem">
          <strong style="color:#10b981;font-family:Orbitron,sans-serif;font-size:.88rem">₹${o.totalAmount?.toFixed(2)}</strong>
          <span style="background:${colors[o.status]}18;color:${colors[o.status]};padding:3px 10px;border-radius:20px;font-size:.72rem;font-weight:700;border:1px solid ${colors[o.status]}28">${o.status.toUpperCase()}</span>
        </div>
      </div>`).join('') || '<p style="color:var(--muted)">No orders yet</p>';
  } catch { el.innerHTML = '<p style="color:#ef4444">Error loading</p>'; }
}

async function loadLowStock() {
  const el = document.getElementById('lowStockList'); if (!el) return;
  try {
    const items = await get('/inventory/low-stock', true);
    el.innerHTML = items.length ? items.map(i => `
      <div style="background:rgba(245,158,11,.05);border:1px solid rgba(245,158,11,.2);border-radius:10px;padding:1rem;margin-bottom:.6rem;display:flex;justify-content:space-between;align-items:center">
        <div><strong>${i.medicine?.name||'Medicine'}</strong><div style="color:var(--muted);font-size:.8rem">at ${i.store?.name||'Store'}</div></div>
        <span style="color:#ef4444;font-family:Orbitron,sans-serif;font-size:.88rem;font-weight:700">${i.stock} left!</span>
      </div>`).join('') : '<p style="color:#10b981">✅ No low stock alerts!</p>';
  } catch { el.innerHTML = '<p style="color:var(--muted)">Connect as admin/store to view</p>'; }
}

async function loadLowStock2() {
  const el = document.getElementById('lowStock2'); if (!el) return;
  try {
    const items = await get('/inventory/low-stock', true);
    el.innerHTML = items.length ? items.map(i => `
      <div style="background:rgba(239,68,68,.05);border:1px solid rgba(239,68,68,.18);border-radius:10px;padding:1rem;margin-bottom:.6rem;display:flex;justify-content:space-between;align-items:center">
        <div><strong>${i.medicine?.name||'Medicine'}</strong><div style="color:var(--muted);font-size:.8rem">at ${i.store?.name||'Store'}</div></div>
        <span style="color:#ef4444;font-family:Orbitron,sans-serif;font-weight:700">${i.stock} units left!</span>
      </div>`).join('') : '<p style="color:#10b981">✅ All stock levels healthy!</p>';
  } catch { el.innerHTML = '<p style="color:var(--muted)">Error loading</p>'; }
}

async function loadStoreOrders() {
  const el = document.getElementById('storeOrdersList'); if (!el) return;
  try {
    const orders = await get('/orders/all', true);
    el.innerHTML = orders.length ? orders.slice(0,10).map(o => `
      <div class="order-card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.4rem;flex-wrap:wrap;gap:.4rem">
          <strong style="font-size:.88rem">${o.user?.name||'Customer'}</strong>
          <button style="background:rgba(16,185,129,.1);color:#10b981;border:1px solid rgba(16,185,129,.2);padding:4px 12px;border-radius:6px;font-family:Rajdhani,sans-serif;font-size:.75rem;cursor:pointer" onclick="updateOrderStatus('${o._id}','completed')">Mark Complete</button>
        </div>
        <p style="color:var(--muted);font-size:.82rem">${o.items?.map(i=>i.medicine?.name||'Item').join(', ')}</p>
        <div style="display:flex;justify-content:space-between;margin-top:.5rem">
          <span style="color:var(--muted);font-size:.75rem">${new Date(o.createdAt).toLocaleString()}</span>
          <strong style="color:#10b981;font-family:Orbitron,sans-serif;font-size:.85rem">₹${o.totalAmount?.toFixed(2)}</strong>
        </div>
      </div>`).join('') : '<p style="color:var(--muted);padding:1rem">No orders yet</p>';
  } catch { el.innerHTML = '<p style="color:var(--muted)">Error loading orders</p>'; }
}

async function updateOrderStatus(id, status) {
  try {
    await fetch(API + '/orders/' + id + '/status', { method:'PUT', headers:{'Content-Type':'application/json','Authorization':'Bearer '+token}, body:JSON.stringify({status}) });
    showToast('✅ Order marked as ' + status); loadStoreOrders();
  } catch { showToast('❌ Error updating status'); }
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
    document.getElementById('addMedMsg').innerHTML = `<span style="color:#10b981;font-weight:600">✅ "${data.name}" added!</span>`;
    showToast('Medicine added: ' + data.name + ' 💊');
  } catch(err) { showToast('❌ ' + err.message); }
}

// ── EMERGENCY ──────────────────────────────────────────────────────────────
function toggleEmrg() {
  const p = document.getElementById('emrgPanel');
  p.style.display = p.style.display === 'none' ? 'flex' : 'none';
}
async function emrgSearch(q) {
  if (!q || q.length < 2) return;
  const el = document.getElementById('emrgResults');
  const meds = await get('/medicines/search?q=' + encodeURIComponent(q));
  el.innerHTML = meds.slice(0,5).map(m => `
    <div style="background:rgba(239,68,68,.07);border:1px solid rgba(239,68,68,.18);border-radius:8px;padding:.8rem;margin-top:.4rem;cursor:pointer;display:flex;justify-content:space-between" onclick="toggleEmrg();viewMed('${m._id}')">
      <div><strong>${m.name}</strong><div style="font-size:.78rem;color:var(--muted)">${m.category}</div></div>
      <div style="color:#10b981;font-weight:700;font-size:.9rem">${m.availableIn} store(s)</div>
    </div>`).join('') || '<p style="color:var(--muted);padding:.5rem">No results found</p>';
}

// ── PRESCRIPTION ───────────────────────────────────────────────────────────
function handlePresc(input) {
  if (!input.files[0]) return;
  showToast('📋 Prescription "' + input.files[0].name + '" uploaded!');
  showRT('📋 Analyzing prescription...');
  setTimeout(() => showToast('🤖 Install Tesseract.js for full OCR support!'), 2000);
}

// ── CHATBOT ────────────────────────────────────────────────────────────────
let chatOpen = true;
function toggleChat() {
  chatOpen = !chatOpen;
  document.getElementById('chatBody').style.display = chatOpen ? 'flex' : 'none';
  document.getElementById('chatTgl').textContent = chatOpen ? '▲' : '▼';
}
function qc(m) { document.getElementById('chatIn').value = m; sendMsg(); }

async function sendMsg() {
  const input = document.getElementById('chatIn');
  const msg = input.value.trim();
  if (!msg) return;
  const msgs = document.getElementById('chatMsgs');
  msgs.innerHTML += `<div class="umsg">${msg}</div>`;
  input.value = ''; msgs.scrollTop = msgs.scrollHeight;
  const typing = document.createElement('div');
  typing.className = 'bmsg'; typing.id = 'typing'; typing.innerHTML = '<em style="color:var(--muted)">thinking...</em>';
  msgs.appendChild(typing); msgs.scrollTop = msgs.scrollHeight;
  const reply = await botReply(msg);
  document.getElementById('typing')?.remove();
  msgs.innerHTML += `<div class="bmsg">${reply}</div>`;
  msgs.scrollTop = msgs.scrollHeight;
}

async function botReply(msg) {
  const l = msg.toLowerCase();
  if (l.match(/hi|hello|hey/)) return `👋 Hi! I'm <strong>MediBot</strong>! I can help find medicines, show store maps, and suggest alternatives!`;
  if (l.match(/map|store|location|pharmacy|near/)) { showPage('stores'); return `🗺️ Opening the <strong>Store Map</strong> now! You'll see all 4 pharmacies with live locations. Click <strong>"My Location"</strong> to find the nearest one!`; }
  if (l.match(/direction|navigate|how to reach|reach/)) return `🗺️ Go to the <strong>Map page</strong> → Click any store → Click <strong>"Get Directions"</strong> to open Google Maps navigation!`;
  if (l.match(/share/)) return `📤 Go to <strong>Map page</strong> → Click any store → Click <strong>"Share Location"</strong> to share via WhatsApp, SMS, or copy the link!`;
  if (l.match(/price|cost|cheap|expensive|save/)) return `💰 Search any medicine → I'll show all stores sorted <strong>cheapest first</strong>! Also check AI Alternatives to save up to 70%.`;
  if (l.match(/alternative|substitute|generic/)) return `🤖 Click any medicine in search → scroll down for <strong>"AI Suggested Alternatives"</strong>. Generic medicines can save up to 70%!`;
  if (l.match(/emergency|urgent|sos/)) { toggleEmrg(); return `🚨 Opened <strong>Emergency Panel</strong>! Ambulance: <strong>108</strong> · Hospital: <strong>102</strong>`; }
  if (l.match(/real.?time|live|socket/)) return `⚡ Yes! MediFind uses <strong>Socket.io</strong> for live stock updates. When someone orders, stock numbers update instantly for everyone!`;
  if (l.match(/prescription|rx|upload/)) return `📋 Go to <strong>Search page</strong> → Click <strong>"Upload Rx"</strong> to upload your prescription image!`;
  try {
    const meds = await get('/medicines/search?q=' + encodeURIComponent(msg));
    if (meds.length) return `💊 Found <strong>${meds.length}</strong> result(s) for "<strong>${msg}</strong>"!<br><br>${meds.slice(0,4).map(m=>`• <strong>${m.name}</strong> ${m.lowestPrice?'— from ₹'+m.lowestPrice.toFixed(2):''}`).join('<br>')}<br><br><a href="#" onclick="qs('${msg}')" style="color:var(--cyan)">View all in Search →</a>`;
  } catch {}
  return `🤖 Try asking:<br>• "Find <medicine name>"<br>• "Show store map"<br>• "Get directions"<br>• "Share pharmacy location"<br>• "Cheap alternatives for aspirin"`;
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

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.style.display = 'block';
  clearTimeout(t._t);
  t._t = setTimeout(() => t.style.display = 'none', 3500);
}
