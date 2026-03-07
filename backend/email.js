const nodemailer = require('nodemailer');

function getTransporter() {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) return null;
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
  });
}

async function sendOrderEmail(toEmail, userName, order, storeName) {
  const t = getTransporter(); if (!t) return;
  try {
    const rows = (order.items||[]).map(i =>
      `<tr><td style="padding:8px 12px;border-bottom:1px solid #f1f5f9">${i.medicine?.name||'Medicine'}</td>
       <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;text-align:center">${i.quantity}</td>
       <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;text-align:right;color:#059669;font-weight:700">₹${(i.price*i.quantity).toFixed(2)}</td></tr>`
    ).join('');
    await t.sendMail({
      from: `"MediFind 💊" <${process.env.EMAIL_USER}>`,
      to: toEmail,
      subject: `✅ Order Confirmed — ${storeName} | MediFind`,
      html: `<div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;background:#f8fafc;padding:20px;border-radius:16px">
        <div style="background:linear-gradient(135deg,#1e3a5f,#0284c7);border-radius:12px;padding:28px;text-align:center;margin-bottom:16px">
          <div style="font-size:2.5rem">💊</div>
          <h1 style="color:white;font-size:1.4rem;margin:8px 0 4px">Order Confirmed!</h1>
          <p style="color:rgba(255,255,255,.7);font-size:.85rem;margin:0">Your medicine order is placed successfully</p>
        </div>
        <div style="background:white;border-radius:12px;padding:18px;margin-bottom:12px;border:1px solid #e2e8f0">
          <p style="margin:0;color:#64748b;font-size:.88rem">Hello <strong style="color:#1e293b">${userName}</strong>, your order from <strong style="color:#0ea5e9">${storeName}</strong> is confirmed.</p>
        </div>
        <div style="background:white;border-radius:12px;padding:18px;margin-bottom:12px;border:1px solid #e2e8f0">
          <h3 style="color:#1e3a5f;font-size:.88rem;margin:0 0 12px">📦 Order Items</h3>
          <table style="width:100%;border-collapse:collapse;font-size:.85rem">
            <tr style="background:#f0f7ff"><th style="padding:8px 12px;text-align:left;color:#64748b;font-weight:600">Medicine</th><th style="padding:8px 12px;color:#64748b;font-weight:600">Qty</th><th style="padding:8px 12px;text-align:right;color:#64748b;font-weight:600">Price</th></tr>
            ${rows}
            <tr><td colspan="2" style="padding:10px 12px;font-weight:800;color:#1e3a5f">Total</td>
            <td style="padding:10px 12px;text-align:right;font-weight:900;color:#059669;font-size:1.1rem">₹${order.totalAmount?.toFixed(2)}</td></tr>
          </table>
        </div>
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:14px;font-size:.83rem;color:#166534">
          🏥 Pickup from: <strong>${storeName}</strong><br>
          🔖 Order ID: <strong>${order._id}</strong><br>
          ⏰ Status: <strong>Pending — store will confirm shortly</strong>
        </div>
        <p style="text-align:center;color:#94a3b8;font-size:.72rem;margin-top:16px">MediFind · Hyderabad, Telangana</p>
      </div>`
    });
    console.log('📧 Order email sent to:', toEmail);
  } catch(e) { console.log('📧 Email error (non-critical):', e.message); }
}

async function sendWelcomeEmail(toEmail, userName) {
  const t = getTransporter(); if (!t) return;
  try {
    await t.sendMail({
      from: `"MediFind 💊" <${process.env.EMAIL_USER}>`,
      to: toEmail,
      subject: `Welcome to MediFind, ${userName}! 🎉`,
      html: `<div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;background:#f8fafc;padding:20px;border-radius:16px">
        <div style="background:linear-gradient(135deg,#1e3a5f,#0284c7);border-radius:12px;padding:28px;text-align:center;margin-bottom:16px">
          <div style="font-size:2.5rem">💊</div>
          <h1 style="color:white;font-size:1.5rem;margin:8px 0 4px">Welcome to MediFind!</h1>
          <p style="color:rgba(255,255,255,.7);margin:0">Your trusted medicine platform in Hyderabad</p>
        </div>
        <div style="background:white;border-radius:12px;padding:18px;border:1px solid #e2e8f0">
          <p style="color:#1e293b">Hello <strong>${userName}</strong>! 👋</p>
          <p style="color:#64748b;font-size:.9rem;line-height:1.7">You can now use MediFind to:</p>
          <ul style="color:#64748b;font-size:.88rem;line-height:2.2;padding-left:20px">
            <li>🔍 Search 50+ medicines instantly</li>
            <li>💰 Compare prices across 4 pharmacies</li>
            <li>🗺️ Find nearest pharmacy with in-app routing</li>
            <li>🤖 Get AI-suggested cheaper alternatives</li>
            <li>📦 Order medicines online</li>
          </ul>
        </div>
        <p style="text-align:center;color:#94a3b8;font-size:.72rem;margin-top:16px">MediFind · Hyderabad, Telangana</p>
      </div>`
    });
    console.log('📧 Welcome email sent to:', toEmail);
  } catch(e) { console.log('📧 Welcome email error:', e.message); }
}

async function sendStatusEmail(toEmail, userName, orderId, status, storeName) {
  const t = getTransporter(); if (!t) return;
  const icons = { confirmed:'✅', ready:'📦', completed:'🎉', cancelled:'❌' };
  const msgs = { confirmed:'Your order has been confirmed by the pharmacy.', ready:'Your medicines are ready for pickup!', completed:'Order completed. Thank you!', cancelled:'Your order was cancelled. Contact store for help.' };
  try {
    await t.sendMail({
      from: `"MediFind 💊" <${process.env.EMAIL_USER}>`,
      to: toEmail,
      subject: `${icons[status]||'📋'} Order ${status.toUpperCase()} — MediFind`,
      html: `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:20px">
        <div style="background:linear-gradient(135deg,#1e3a5f,#0284c7);border-radius:12px;padding:24px;text-align:center;color:white;margin-bottom:16px">
          <div style="font-size:2rem">${icons[status]||'📋'}</div>
          <h2 style="margin:8px 0">Order ${status.charAt(0).toUpperCase()+status.slice(1)}</h2>
        </div>
        <div style="background:white;border:1px solid #e2e8f0;border-radius:12px;padding:18px">
          <p>Hello <strong>${userName}</strong>,</p>
          <p style="color:#64748b">${msgs[status]||'Your order status has been updated.'}</p>
          <p style="color:#64748b;font-size:.85rem">📋 Order ID: <strong>${orderId}</strong><br>🏥 Store: <strong>${storeName}</strong></p>
        </div>
      </div>`
    });
  } catch(e) { console.log('📧 Status email error:', e.message); }
}

module.exports = { sendOrderEmail, sendWelcomeEmail, sendStatusEmail };
