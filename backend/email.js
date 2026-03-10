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
        </div>
        <div style="background:white;border-radius:12px;padding:18px;margin-bottom:12px;border:1px solid #e2e8f0">
          <p style="margin:0;color:#64748b">Hello <strong style="color:#1e293b">${userName}</strong>, your order from <strong style="color:#0ea5e9">${storeName}</strong> is confirmed.</p>
        </div>
        <div style="background:white;border-radius:12px;padding:18px;margin-bottom:12px;border:1px solid #e2e8f0">
          <table style="width:100%;border-collapse:collapse;font-size:.85rem">
            <tr style="background:#f0f7ff"><th style="padding:8px 12px;text-align:left">Medicine</th><th>Qty</th><th style="text-align:right">Price</th></tr>
            ${rows}
            <tr><td colspan="2" style="padding:10px 12px;font-weight:800">Total</td>
            <td style="padding:10px 12px;text-align:right;font-weight:900;color:#059669">₹${order.totalAmount?.toFixed(2)}</td></tr>
          </table>
        </div>
        ${order.couponApplied ? `<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:10px;margin-bottom:12px;font-size:.83rem;color:#166534">🎟️ Coupon <strong>${order.couponApplied}</strong> applied — you saved ₹${order.discountAmount?.toFixed(2)}!</div>` : ''}
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:14px;font-size:.83rem;color:#166534">
          🏥 Pickup from: <strong>${storeName}</strong><br>🔖 Order ID: <strong>${order._id}</strong>
        </div>
      </div>`
    });
  } catch(e) { console.log('📧 Email error:', e.message); }
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
        </div>
        <div style="background:white;border-radius:12px;padding:18px;border:1px solid #e2e8f0">
          <p>Hello <strong>${userName}</strong>! 👋 Use MediFind to compare prices, find pharmacies, and order medicines easily!</p>
          <p style="color:#64748b;font-size:.85rem">🎁 Use code <strong>WELCOME</strong> for ₹25 off your first order!</p>
        </div>
      </div>`
    });
  } catch(e) { console.log('📧 Welcome email error:', e.message); }
}

async function sendStatusEmail(toEmail, userName, orderId, status, storeName) {
  const t = getTransporter(); if (!t) return;
  const icons = { confirmed:'✅', ready:'📦', completed:'🎉', cancelled:'❌', preparing:'⚗️' };
  const msgs = { confirmed:'Your order has been confirmed!', ready:'Your medicines are ready for pickup!', completed:'Order completed. Thank you!', cancelled:'Your order was cancelled.', preparing:'Your medicines are being packed.' };
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
          <p>Hello <strong>${userName}</strong>, ${msgs[status]||'Your order status has been updated.'}</p>
          <p style="color:#64748b;font-size:.85rem">📋 Order: <strong>${orderId}</strong> | 🏥 Store: <strong>${storeName}</strong></p>
        </div>
      </div>`
    });
  } catch(e) { console.log('📧 Status email error:', e.message); }
}

async function sendResetOTPEmail(toEmail, userName, otp) {
  const t = getTransporter(); if (!t) return;
  try {
    await t.sendMail({
      from: `"MediFind 💊" <${process.env.EMAIL_USER}>`,
      to: toEmail,
      subject: `🔐 Password Reset OTP — MediFind`,
      html: `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:20px">
        <div style="background:linear-gradient(135deg,#1e3a5f,#0284c7);border-radius:12px;padding:24px;text-align:center;color:white;margin-bottom:16px">
          <div style="font-size:2rem">🔐</div>
          <h2 style="margin:8px 0">Password Reset</h2>
        </div>
        <div style="background:white;border:1px solid #e2e8f0;border-radius:12px;padding:18px;text-align:center">
          <p>Hello <strong>${userName}</strong>, your OTP to reset password is:</p>
          <div style="font-size:2.5rem;font-weight:900;color:#0284c7;letter-spacing:8px;padding:16px">${otp}</div>
          <p style="color:#64748b;font-size:.85rem">Valid for 10 minutes. Do not share this OTP.</p>
        </div>
      </div>`
    });
  } catch(e) { console.log('📧 Reset OTP email error:', e.message); }
}

module.exports = { sendOrderEmail, sendWelcomeEmail, sendStatusEmail, sendResetOTPEmail };
