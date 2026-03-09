# MediFind v5.0 — Upgrade Instructions

## 🆕 New Features Added
- ✅ MongoDB Atlas database support
- ✅ OTP login (phone number)
- ✅ Google OAuth login
- ✅ Forgot password via email OTP
- ✅ Coupon/discount codes (MEDIFIND10, FIRST20, SAVE50, HEALTH30, WELCOME)
- ✅ Live order tracking with timeline
- ✅ Push notifications (Socket.io + Web Push)
- ✅ Loyalty points system (earn points on every order)
- ✅ Invoice generation per order
- ✅ Remove from favourites
- ✅ Notification center

## 📁 Files to Replace in Your Project

Copy these files to your MedicineApp3 folder:

### Root files (replace existing):
- `server.js` → replace your server.js
- `db.js` → replace your db.js
- `package.json` → replace your package.json
- `.env.example` → replace your .env.example

### New backend files (add to backend/routes/):
- `backend/routes/otpRoutes.js` → NEW
- `backend/routes/couponRoutes.js` → NEW
- `backend/routes/trackingRoutes.js` → NEW
- `backend/routes/notificationRoutes.js` → NEW
- `backend/routes/orderRoutes.js` → REPLACE existing
- `backend/routes/authRoutes.js` → REPLACE existing
- `backend/routes/profileRoutes.js` → REPLACE existing
- `backend/email.js` → REPLACE existing
- `backend/middleware/auth.js` → REPLACE existing

## 🚀 Setup Steps

### Step 1 — Copy all files to your project

### Step 2 — Install new packages
```
cd MedicineApp3
npm install
```

### Step 3 — Set up MongoDB Atlas (FREE)
1. Go to mongodb.com/cloud/atlas
2. Create free M0 cluster
3. Get connection string
4. Add to .env: MONGODB_URI=mongodb+srv://...

### Step 4 — Add to your .env file
```
MONGODB_URI=your_mongodb_connection_string
TWILIO_SID=your_twilio_sid (optional - OTP works in demo mode without it)
TWILIO_TOKEN=your_twilio_token (optional)
TWILIO_PHONE=+1234567890 (optional)
GOOGLE_CLIENT_ID=your_google_client_id (optional)
```

### Step 5 — Push to GitHub
```
git add .
git commit -m "feat: v5.0 MongoDB, OTP, coupons, tracking, loyalty points"
git push origin master
```

### Step 6 — Update EC2 server
SSH into EC2 and run:
```
cd medicine-app
git pull origin master
npm install
pm2 restart medifind
```

## 🎟️ Default Coupon Codes
| Code | Discount |
|------|---------|
| WELCOME | ₹25 off |
| MEDIFIND10 | 10% off (max ₹50) |
| FIRST20 | 20% off (max ₹100) |
| SAVE50 | ₹50 flat off (min ₹300) |
| HEALTH30 | 30% off (max ₹150, min ₹500) |

## 🏆 Loyalty Points
- Earn 1 point per ₹10 spent
- 100 points = ₹10 discount
- Use points at checkout

## 📱 OTP Login (Demo Mode)
Without Twilio configured, OTP will be shown in the API response for testing.
In production, add Twilio credentials to send real SMS.
