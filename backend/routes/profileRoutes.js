const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { readDB, writeDB } = require('../../db');
const { authMiddleware, isUser } = require('../middleware/auth');

// Get profile
router.get('/', isUser, (req, res) => {
  try {
    const db = readDB();
    const user = db.users.find(u => u._id === req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    const { password: _, ...safeUser } = user;
    const orders = db.orders.filter(o => o.user === req.user.id);
    res.json({
      ...safeUser,
      totalOrders: orders.length,
      totalSpent: orders.reduce((s,o)=>s+(o.totalAmount||0),0),
      loyaltyPoints: user.loyaltyPoints || 0
    });
  } catch(err) { res.status(500).json({ message: err.message }); }
});

// Update profile
// BUG FIX #5: Return success:true and user object so frontend works
router.put('/', isUser, async (req, res) => {
  try {
    const { name, phone, address, age, bloodGroup, allergies } = req.body;
    const db = readDB();
    const user = db.users.find(u => u._id === req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (name) user.name = name;
    if (phone) user.phone = phone;
    if (address) user.address = address;
    if (age) user.age = age;
    if (bloodGroup) user.bloodGroup = bloodGroup;
    if (allergies) user.allergies = allergies;
    user.updatedAt = new Date().toISOString();
    writeDB(db);
    const { password: _, ...safeUser } = user;
    res.json({ success: true, user: safeUser });
  } catch(err) { res.status(500).json({ message: err.message }); }
});

// Change password
// BUG FIX #6: Route was missing from profileRoutes — frontend calls PUT /api/profile/change-password
router.put('/change-password', isUser, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ message: 'Both passwords required' });
    if (newPassword.length < 6) return res.status(400).json({ message: 'New password must be 6+ characters' });
    const db = readDB();
    const user = db.users.find(u => u._id === req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.password) {
      const match = await bcrypt.compare(currentPassword, user.password);
      if (!match) return res.status(400).json({ message: 'Current password is incorrect' });
    }
    user.password = await bcrypt.hash(newPassword, 10);
    writeDB(db);
    res.json({ success: true, message: 'Password changed successfully' });
  } catch(err) { res.status(500).json({ message: err.message }); }
});

// Reminders
router.post('/reminders', isUser, (req, res) => {
  try {
    const { medicineName, time, frequency, notes, familyMemberId, familyMemberName } = req.body;
    const db = readDB();
    if (!db.reminders) db.reminders = [];
    // NOTE: both 'userId' and 'user' are stored — 'userId' is what this route's
    // own GET/DELETE filter on, 'user' is what reminderScheduler.js (real-time
    // socket notifications) reads. Without 'user' the scheduler fires but sends
    // to an empty 'user-undefined' room, so nobody ever gets the reminder.
    const reminder = { _id: Date.now().toString(), userId: req.user.id, user: req.user.id, medicineName, time, frequency, notes, familyMemberId: familyMemberId || null, familyMemberName: familyMemberName || null, active: true, createdAt: new Date().toISOString() };
    db.reminders.push(reminder);
    writeDB(db);
    res.status(201).json(reminder);
  } catch(err) { res.status(500).json({ message: err.message }); }
});

router.get('/reminders', isUser, (req, res) => {
  try {
    const db = readDB();
    res.json((db.reminders || []).filter(r => r.userId === req.user.id));
  } catch(err) { res.status(500).json({ message: err.message }); }
});

router.delete('/reminders/:id', isUser, (req, res) => {
  try {
    const db = readDB();
    if (!db.reminders) db.reminders = [];
    db.reminders = db.reminders.filter(r => !(r._id === req.params.id && r.userId === req.user.id));
    writeDB(db);
    res.json({ message: 'Reminder deleted' });
  } catch(err) { res.status(500).json({ message: err.message }); }
});

// Favourites
router.post('/favourites', isUser, (req, res) => {
  try {
    const { medicineId } = req.body;
    const db = readDB();
    if (!db.favourites) db.favourites = [];
    if (db.favourites.find(f => f.userId === req.user.id && f.medicineId === medicineId)) {
      return res.status(400).json({ message: 'Already saved' });
    }
    db.favourites.push({ _id: Date.now().toString(), userId: req.user.id, medicineId, createdAt: new Date().toISOString() });
    writeDB(db);
    res.json({ message: 'Saved to favourites' });
  } catch(err) { res.status(500).json({ message: err.message }); }
});

router.get('/favourites', isUser, (req, res) => {
  try {
    const db = readDB();
    const favs = (db.favourites || []).filter(f => f.userId === req.user.id).map(f => ({
      ...f, medicine: db.medicines.find(m => m._id === f.medicineId)
    }));
    res.json(favs);
  } catch(err) { res.status(500).json({ message: err.message }); }
});

router.delete('/favourites/:medicineId', isUser, (req, res) => {
  try {
    const db = readDB();
    if (!db.favourites) db.favourites = [];
    db.favourites = db.favourites.filter(f => !(f.medicineId === req.params.medicineId && f.userId === req.user.id));
    writeDB(db);
    res.json({ message: 'Removed from favourites' });
  } catch(err) { res.status(500).json({ message: err.message }); }
});

// Loyalty points
// ── Family Members ────────────────────────────────────────────────
router.get('/family', isUser, (req, res) => {
  try {
    const db = readDB();
    const user = db.users.find(u => u._id === req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user.familyMembers || []);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post('/family', isUser, (req, res) => {
  try {
    const { name, relation, age, allergies, notes } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ message: 'Name is required' });
    const db = readDB();
    const user = db.users.find(u => u._id === req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (!user.familyMembers) user.familyMembers = [];
    const member = {
      _id: Date.now().toString(),
      name: name.trim(),
      relation: relation || 'Family',
      age: age || null,
      allergies: allergies || '',
      notes: notes || '',
      createdAt: new Date().toISOString()
    };
    user.familyMembers.push(member);
    writeDB(db);
    res.status(201).json(member);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.delete('/family/:memberId', isUser, (req, res) => {
  try {
    const db = readDB();
    const user = db.users.find(u => u._id === req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    user.familyMembers = (user.familyMembers || []).filter(m => m._id !== req.params.memberId);
    writeDB(db);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ message: err.message }); }
});


// User's medicine list ─────────────────────────────────────────
router.get('/medicines/my-list', isUser, (req, res) => {
  try {
    const db = readDB();
    const user = db.users.find(u => u._id === req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    let list = user.medicineList;
    if (!list) list = [];
    res.json(list);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post('/medicines/my-list', isUser, (req, res) => {
  try {
    const { action, medicineId } = req.body; // action: 'add' | 'remove'
    const db = readDB();
    const user = db.users.find(u => u._id === req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    let list = user.medicineList;
    if (!list) list = [];
    if (action === 'add' && !list.includes(medicineId)) list.push(medicineId);
    if (action === 'remove' && list.includes(medicineId)) list = list.filter(id => id !== medicineId);
    user.medicineList = list;
    writeDB(db);
    res.json({ list, count: list.length });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Find pharmacies having all user's medicines ────────────────────
router.post('/medicines/find-pharmacies', isUser, (req, res) => {
  try {
    const db = readDB();
    const user = db.users.find(u => u._id === req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const myList = user.medicineList || [];
    if (!myList.length) return res.json({ pharmacies: [], message: 'Your medicine list is empty' });

    const medInventory = {};
    myList.forEach(medId => {
      const items = db.inventory.filter(i => i.medicine === medId);
      if (items.length) medInventory[medId] = items;
    });

    const pharmacyMatchCount = {};
    myList.forEach(medId => {
      const items = medInventory[medId] || [];
      items.forEach(inv => {
        const storeId = inv.store;
        if (!pharmacyMatchCount[storeId]) pharmacyMatchCount[storeId] = 0;
        pharmacyMatchCount[storeId]++;
      });
    });

    const pharmacyTotal = {};
    myList.forEach(medId => {
      const items = medInventory[medId] || [];
      items.forEach(inv => {
        const storeId = inv.store;
        if (!pharmacyTotal[storeId]) pharmacyTotal[storeId] = 0;
        pharmacyTotal[storeId]++;
      });
    });

    const results = [];
    Object.keys(pharmacyMatchCount).forEach(storeId => {
      const total = pharmacyTotal[storeId] || 0;
      const match = pharmacyMatchCount[storeId] || 0;
      const pct = myList.length > 0 ? Math.round((match / myList.length) * 100) : 0;
      const store = db.stores.find(s => s._id === storeId);
      results.push({
        storeId,
        storeName: store ? store.name : 'Unknown Store',
        matchCount: match,
        totalCount: myList.length,
        matchPercentage: pct,
        distance: store ? (store.distanceKm || null) : null,
        open: store ? store.isOpen : null,
        medicines: myList.map(medId => {
          const item = medInventory[medId]?.find(i => i.store === storeId);
          return {
            medicineId,
            available: !!item,
            stock: item ? item.stock : 0,
            price: item ? item.price : null
          };
        })
      });
    });

    results.sort((a, b) => b.matchCount - a.matchCount || b.matchPercentage - a.matchPercentage);

    res.json({ pharmacies: results, myListCount: myList.length });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Loyalty points


// Prescription matching with Find All Medicines ─────────────────────
router.post('/prescriptions/match', authMiddleware, (req, res) => {
  try {
    const db = readDB();
    const user = db.users.find(u => u._id === req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Get user's prescription medicines (unconfirmed)
    const prescriptions = db.prescriptions || [];
    const confirmedPrescriptions = prescriptions.filter(p => p.status === 'verified');
    const unconfirmedPrescriptions = prescriptions.filter(p => p.status !== 'verified');

    // Extract medicine names from unconfirmed prescriptions
    const unconfirmedNames = unconfirmedPrescriptions
      .map(p => p.originalName)
      .filter(name => name);

    // Start with unconfirmed medicine names as search terms
    const searchTerms = [...unconfirmedNames];

    // Get inventory for all search terms
    const medInventory = {};
    searchTerms.forEach(term => {
      const matches = db.medicines.filter(m =>
        m.name.toLowerCase().includes(term.toLowerCase()) ||
        (m.genericName && m.genericName.toLowerCase().includes(term.toLowerCase()))
      );
      matches.forEach(m => {
        if (!medInventory[m._id]) medInventory[m._id] = [];
        medInventory[m._id].push({ name: m.name, source: 'prescription' });
      });
    });

    // If we have confirmed prescriptions, also search for those
    if (confirmedPrescriptions.length > 0) {
      confirmedPrescriptions.forEach(p => {
        const meds = db.medicines.filter(m =>
          m.name.toLowerCase().includes(p.originalName.toLowerCase()) ||
          (m.genericName && m.genericName.toLowerCase().includes(p.originalName.toLowerCase()))
        );
        meds.forEach(m => {
          if (!medInventory[m._id]) medInventory[m._id] = [];
          medInventory[m._id].push({ name: m.name, source: 'confirmed prescription' });
        });
      });
    }

    // Get pharmacy availability for matched medicines
    const medicineIds = Object.keys(medInventory);
    if (!medicineIds.length) {
      return res.json({
        prescriptions: [],
        unconfirmed: [],
        confirmed: [],
        pharmacies: [],
        message: 'No medicines found from prescriptions'
      });
    }

    // Get inventory for all matched medicines
    const inventoryByMed = {};
    medicineIds.forEach(medId => {
      inventoryByMed[medId] = db.inventory.filter(i => i.medicine === medId);
    });

    // Build prescription results
    const prescriptionResults = unconfirmedNames.map(name => ({
      name,
      confirmed: false,
      source: 'prescription upload'
    }));

    const confirmedResults = confirmedPrescriptions.map(p => ({
      name: p.originalName,
      confirmed: true,
      source: 'verified prescription'
    }));

    // Get pharmacy availability for each medicine
    const pharmacyAvailability = {};
    medicineIds.forEach(medId => {
      const inventoryItems = inventoryByMed[medId] || [];
      const stores = {};
      inventoryItems.forEach(inv => {
        const store = db.stores.find(s => s._id === inv.store);
        if (store) {
          stores[store._id] = {
            name: store.name,
            availability: inv.stock > 0 ? 'available' : 'out_of_stock',
            stock: inv.stock,
            price: inv.price
          };
        }
      });
      pharmacyAvailability[medId] = stores;
    });

    res.json({
      prescriptions: {
        unconfirmed: prescriptionResults,
        confirmed: confirmedResults
      },
      pharmacyAvailability,
      message: 'Prescription matching complete - review results above'
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.get('/loyalty', isUser, (req, res) => {
  try {
    const db = readDB();
    const user = db.users.find(u => u._id === req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({
      points: user.loyaltyPoints || 0,
      worth: Math.floor((user.loyaltyPoints || 0) / 100) * 10,
      nextReward: 100 - ((user.loyaltyPoints || 0) % 100)
    });
  } catch(err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
