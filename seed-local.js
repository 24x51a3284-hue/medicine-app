const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const dbPath = path.join(__dirname, 'database.json');

async function seed() {
  console.log('🌱 Seeding database with 50+ medicines...\n');

  const users = [
    { _id: 'admin1', name: 'Admin User', email: 'admin@medicineapp.com', password: await bcrypt.hash('Admin@123', 10), role: 'admin', createdAt: new Date().toISOString() },
    { _id: 'store1', name: 'Rajesh Kumar', email: 'store@medicineapp.com', password: await bcrypt.hash('Store@123', 10), role: 'store', phone: '9876543210', createdAt: new Date().toISOString() },
    { _id: 'store2', name: 'Priya Sharma', email: 'store2@medicineapp.com', password: await bcrypt.hash('Store@123', 10), role: 'store', phone: '9876543211', createdAt: new Date().toISOString() },
    { _id: 'user1', name: 'Test User', email: 'user@medicineapp.com', password: await bcrypt.hash('User@123', 10), role: 'user', phone: '9000000001', createdAt: new Date().toISOString() }
  ];

  const medicines = [
    // ANALGESICS
    { _id: 'm01', name: 'Paracetamol 500mg', genericName: 'Acetaminophen', category: 'Analgesic', manufacturer: 'GSK', description: 'Common painkiller and fever reducer used for mild to moderate pain.', uses: ['Fever', 'Headache', 'Toothache', 'Body pain', 'Cold & flu'], sideEffects: ['Nausea', 'Liver damage (overdose)', 'Skin rash'], dosage: '1-2 tablets every 4-6 hours', requiresPrescription: false, alternatives: ['m02', 'm03'] },
    { _id: 'm02', name: 'Ibuprofen 400mg', genericName: 'Ibuprofen', category: 'Analgesic', manufacturer: 'Abbott', description: 'Anti-inflammatory pain reliever for moderate pain and inflammation.', uses: ['Pain relief', 'Inflammation', 'Fever', 'Arthritis', 'Menstrual pain'], sideEffects: ['Stomach upset', 'Heartburn', 'Dizziness', 'Bleeding risk'], dosage: '1 tablet every 6-8 hours with food', requiresPrescription: false, alternatives: ['m01', 'm03'] },
    { _id: 'm03', name: 'Aspirin 75mg', genericName: 'Acetylsalicylic Acid', category: 'Analgesic', manufacturer: 'Bayer', description: 'Used for pain relief, fever, and as blood thinner.', uses: ['Pain relief', 'Fever', 'Blood thinner', 'Heart attack prevention'], sideEffects: ['Stomach bleeding', 'Nausea', 'Ringing in ears'], dosage: '1 tablet daily or as prescribed', requiresPrescription: false, alternatives: ['m01', 'm02'] },
    { _id: 'm04', name: 'Diclofenac 50mg', genericName: 'Diclofenac Sodium', category: 'Analgesic', manufacturer: 'Novartis', description: 'NSAID for arthritis, muscle pain, and inflammation.', uses: ['Arthritis', 'Muscle pain', 'Back pain', 'Joint pain'], sideEffects: ['Stomach pain', 'Heartburn', 'Headache', 'Dizziness'], dosage: '1 tablet 2-3 times daily with food', requiresPrescription: true, alternatives: ['m02'] },
    { _id: 'm05', name: 'Tramadol 50mg', genericName: 'Tramadol HCl', category: 'Analgesic', manufacturer: 'Cipla', description: 'Opioid pain medication for moderate to severe pain.', uses: ['Severe pain', 'Post-surgery pain', 'Chronic pain'], sideEffects: ['Nausea', 'Dizziness', 'Constipation', 'Drowsiness'], dosage: '1 tablet every 4-6 hours as needed', requiresPrescription: true, alternatives: ['m04'] },

    // ANTIBIOTICS
    { _id: 'm06', name: 'Amoxicillin 500mg', genericName: 'Amoxicillin Trihydrate', category: 'Antibiotic', manufacturer: 'Cipla', description: 'Broad-spectrum antibiotic for bacterial infections.', uses: ['Bacterial infections', 'Ear infections', 'Throat infections', 'Pneumonia', 'UTI'], sideEffects: ['Diarrhea', 'Nausea', 'Skin rash', 'Allergic reaction'], dosage: '1 capsule 3 times daily for 5-7 days', requiresPrescription: true, alternatives: ['m07', 'm08'] },
    { _id: 'm07', name: 'Azithromycin 500mg', genericName: 'Azithromycin', category: 'Antibiotic', manufacturer: 'Pfizer', description: 'Antibiotic for respiratory and skin infections.', uses: ['Pneumonia', 'Bronchitis', 'Skin infections', 'STDs', 'Ear infections'], sideEffects: ['Nausea', 'Diarrhea', 'Stomach pain', 'Heart rhythm changes'], dosage: '1 tablet daily for 3-5 days', requiresPrescription: true, alternatives: ['m06', 'm08'] },
    { _id: 'm08', name: 'Ciprofloxacin 500mg', genericName: 'Ciprofloxacin HCl', category: 'Antibiotic', manufacturer: 'Bayer', description: 'Fluoroquinolone antibiotic for urinary and respiratory infections.', uses: ['UTI', 'Respiratory infections', 'Skin infections', 'Typhoid', 'Diarrhea'], sideEffects: ['Nausea', 'Diarrhea', 'Headache', 'Tendon damage (rare)'], dosage: '1 tablet twice daily for 7-14 days', requiresPrescription: true, alternatives: ['m06', 'm07'] },
    { _id: 'm09', name: 'Metronidazole 400mg', genericName: 'Metronidazole', category: 'Antibiotic', manufacturer: 'Abbott', description: 'Antibiotic and antiprotozoal for infections.', uses: ['Bacterial vaginosis', 'Dental infections', 'Stomach infections', 'Parasites'], sideEffects: ['Nausea', 'Metallic taste', 'Headache', 'Dizziness'], dosage: '1 tablet 3 times daily', requiresPrescription: true, alternatives: ['m06'] },
    { _id: 'm10', name: 'Doxycycline 100mg', genericName: 'Doxycycline Hyclate', category: 'Antibiotic', manufacturer: 'Sun Pharma', description: 'Tetracycline antibiotic for various infections.', uses: ['Malaria prevention', 'Acne', 'Chest infections', 'Lyme disease'], sideEffects: ['Sun sensitivity', 'Nausea', 'Diarrhea', 'Esophagus irritation'], dosage: '1 capsule daily or twice daily', requiresPrescription: true, alternatives: ['m07'] },

    // ANTIDIABETICS
    { _id: 'm11', name: 'Metformin 500mg', genericName: 'Metformin HCl', category: 'Antidiabetic', manufacturer: 'Sun Pharma', description: 'First-line medication for Type 2 diabetes.', uses: ['Type 2 diabetes', 'Blood sugar control', 'PCOS'], sideEffects: ['Nausea', 'Diarrhea', 'Stomach upset', 'B12 deficiency (long term)'], dosage: '1 tablet twice daily with meals', requiresPrescription: true, alternatives: ['m12', 'm13'] },
    { _id: 'm12', name: 'Glimepiride 2mg', genericName: 'Glimepiride', category: 'Antidiabetic', manufacturer: 'Sanofi', description: 'Sulfonylurea to stimulate insulin release.', uses: ['Type 2 diabetes', 'Blood sugar lowering'], sideEffects: ['Low blood sugar', 'Weight gain', 'Nausea', 'Dizziness'], dosage: '1 tablet daily before breakfast', requiresPrescription: true, alternatives: ['m11', 'm13'] },
    { _id: 'm13', name: 'Januvia 100mg', genericName: 'Sitagliptin', category: 'Antidiabetic', manufacturer: 'MSD', description: 'DPP-4 inhibitor for blood sugar control.', uses: ['Type 2 diabetes', 'Blood sugar control'], sideEffects: ['Runny nose', 'Sore throat', 'Headache', 'Pancreatitis (rare)'], dosage: '1 tablet daily with or without food', requiresPrescription: true, alternatives: ['m11', 'm12'] },

    // ANTIHYPERTENSIVES
    { _id: 'm14', name: 'Amlodipine 5mg', genericName: 'Amlodipine Besylate', category: 'Antihypertensive', manufacturer: 'Pfizer', description: 'Calcium channel blocker for blood pressure and angina.', uses: ['High blood pressure', 'Angina', 'Coronary artery disease'], sideEffects: ['Ankle swelling', 'Flushing', 'Dizziness', 'Palpitations'], dosage: '1 tablet daily', requiresPrescription: true, alternatives: ['m15', 'm16'] },
    { _id: 'm15', name: 'Atenolol 50mg', genericName: 'Atenolol', category: 'Antihypertensive', manufacturer: 'AstraZeneca', description: 'Beta-blocker for blood pressure and heart conditions.', uses: ['High blood pressure', 'Angina', 'Heart attack prevention', 'Arrhythmia'], sideEffects: ['Fatigue', 'Cold hands/feet', 'Slow heartbeat', 'Dizziness'], dosage: '1 tablet daily', requiresPrescription: true, alternatives: ['m14', 'm16'] },
    { _id: 'm16', name: 'Losartan 50mg', genericName: 'Losartan Potassium', category: 'Antihypertensive', manufacturer: 'Merck', description: 'ARB for blood pressure and kidney protection.', uses: ['High blood pressure', 'Kidney protection in diabetes', 'Heart failure'], sideEffects: ['Dizziness', 'High potassium', 'Kidney problems', 'Cough (rare)'], dosage: '1 tablet daily', requiresPrescription: true, alternatives: ['m14', 'm15'] },
    { _id: 'm17', name: 'Telmisartan 40mg', genericName: 'Telmisartan', category: 'Antihypertensive', manufacturer: 'Boehringer', description: 'Long-acting ARB for hypertension.', uses: ['High blood pressure', 'Cardiovascular risk reduction'], sideEffects: ['Dizziness', 'Back pain', 'Diarrhea', 'Sinusitis'], dosage: '1 tablet daily', requiresPrescription: true, alternatives: ['m16'] },

    // ANTACIDS & GI
    { _id: 'm18', name: 'Omeprazole 20mg', genericName: 'Omeprazole', category: 'Antacid', manufacturer: 'AstraZeneca', description: 'PPI for acid reflux and stomach ulcers.', uses: ['Acid reflux', 'GERD', 'Stomach ulcers', 'H. pylori infection'], sideEffects: ['Headache', 'Diarrhea', 'Nausea', 'B12 deficiency (long term)'], dosage: '1 capsule daily before breakfast', requiresPrescription: false, alternatives: ['m19', 'm20'] },
    { _id: 'm19', name: 'Pantoprazole 40mg', genericName: 'Pantoprazole Sodium', category: 'Antacid', manufacturer: 'Sun Pharma', description: 'PPI for acid-related conditions.', uses: ['GERD', 'Stomach ulcers', 'Zollinger-Ellison syndrome'], sideEffects: ['Headache', 'Diarrhea', 'Stomach pain', 'Nausea'], dosage: '1 tablet daily before meals', requiresPrescription: false, alternatives: ['m18', 'm20'] },
    { _id: 'm20', name: 'Ranitidine 150mg', genericName: 'Ranitidine HCl', category: 'Antacid', manufacturer: 'GSK', description: 'H2 blocker for heartburn and ulcers.', uses: ['Heartburn', 'Acid indigestion', 'Stomach ulcers', 'GERD'], sideEffects: ['Headache', 'Constipation', 'Diarrhea', 'Dizziness'], dosage: '1 tablet twice daily', requiresPrescription: false, alternatives: ['m18', 'm19'] },
    { _id: 'm21', name: 'Domperidone 10mg', genericName: 'Domperidone', category: 'Antiemetic', manufacturer: 'Janssen', description: 'Anti-nausea medicine that speeds up digestion.', uses: ['Nausea', 'Vomiting', 'Bloating', 'Slow digestion'], sideEffects: ['Dry mouth', 'Headache', 'Diarrhea', 'Heart rhythm (rare)'], dosage: '1 tablet 3 times daily before meals', requiresPrescription: false, alternatives: [] },
    { _id: 'm22', name: 'Ondansetron 4mg', genericName: 'Ondansetron HCl', category: 'Antiemetic', manufacturer: 'GSK', description: 'Powerful anti-nausea for chemotherapy and surgery.', uses: ['Chemotherapy nausea', 'Post-surgery nausea', 'Severe vomiting'], sideEffects: ['Headache', 'Constipation', 'Fatigue', 'Dizziness'], dosage: '1 tablet 3 times daily', requiresPrescription: true, alternatives: ['m21'] },

    // ANTIHISTAMINES
    { _id: 'm23', name: 'Cetirizine 10mg', genericName: 'Cetirizine HCl', category: 'Antihistamine', manufacturer: 'UCB', description: 'Non-drowsy antihistamine for allergies.', uses: ['Hay fever', 'Allergic rhinitis', 'Hives', 'Itching', 'Watery eyes'], sideEffects: ['Mild drowsiness', 'Dry mouth', 'Headache', 'Nausea'], dosage: '1 tablet daily', requiresPrescription: false, alternatives: ['m24', 'm25'] },
    { _id: 'm24', name: 'Loratadine 10mg', genericName: 'Loratadine', category: 'Antihistamine', manufacturer: 'Schering', description: 'Non-sedating antihistamine for allergy symptoms.', uses: ['Hay fever', 'Hives', 'Allergic reactions', 'Runny nose'], sideEffects: ['Headache', 'Dry mouth', 'Fatigue', 'Stomach upset'], dosage: '1 tablet daily', requiresPrescription: false, alternatives: ['m23', 'm25'] },
    { _id: 'm25', name: 'Fexofenadine 120mg', genericName: 'Fexofenadine HCl', category: 'Antihistamine', manufacturer: 'Sanofi', description: 'Non-drowsy antihistamine.', uses: ['Seasonal allergies', 'Hives', 'Itchy skin'], sideEffects: ['Headache', 'Nausea', 'Dizziness', 'Back pain'], dosage: '1 tablet twice daily', requiresPrescription: false, alternatives: ['m23', 'm24'] },

    // CHOLESTEROL
    { _id: 'm26', name: 'Atorvastatin 10mg', genericName: 'Atorvastatin Calcium', category: 'Antihyperlipidemic', manufacturer: 'Pfizer', description: 'Statin for lowering bad cholesterol.', uses: ['High cholesterol', 'Heart disease prevention', 'Stroke prevention'], sideEffects: ['Muscle pain', 'Liver problems', 'Headache', 'Stomach upset'], dosage: '1 tablet daily at night', requiresPrescription: true, alternatives: ['m27', 'm28'] },
    { _id: 'm27', name: 'Rosuvastatin 10mg', genericName: 'Rosuvastatin Calcium', category: 'Antihyperlipidemic', manufacturer: 'AstraZeneca', description: 'Potent statin for cholesterol management.', uses: ['High cholesterol', 'High triglycerides', 'Heart disease prevention'], sideEffects: ['Muscle pain', 'Headache', 'Nausea', 'Weakness'], dosage: '1 tablet daily', requiresPrescription: true, alternatives: ['m26', 'm28'] },
    { _id: 'm28', name: 'Simvastatin 20mg', genericName: 'Simvastatin', category: 'Antihyperlipidemic', manufacturer: 'Merck', description: 'Statin to lower cholesterol levels.', uses: ['High cholesterol', 'Heart attack prevention'], sideEffects: ['Muscle pain', 'Liver damage', 'Memory problems'], dosage: '1 tablet daily at bedtime', requiresPrescription: true, alternatives: ['m26', 'm27'] },

    // THYROID
    { _id: 'm29', name: 'Levothyroxine 50mcg', genericName: 'Levothyroxine Sodium', category: 'Thyroid', manufacturer: 'Abbott', description: 'Synthetic thyroid hormone for hypothyroidism.', uses: ['Hypothyroidism', 'Goiter', 'Thyroid cancer'], sideEffects: ['Palpitations', 'Weight loss', 'Insomnia', 'Anxiety (overdose)'], dosage: '1 tablet daily on empty stomach', requiresPrescription: true, alternatives: [] },

    // VITAMINS & SUPPLEMENTS
    { _id: 'm30', name: 'Vitamin D3 60000 IU', genericName: 'Cholecalciferol', category: 'Vitamin', manufacturer: 'Sun Pharma', description: 'Vitamin D supplement for bone health.', uses: ['Vitamin D deficiency', 'Bone health', 'Immune support', 'Muscle weakness'], sideEffects: ['Nausea (overdose)', 'Weakness', 'Frequent urination'], dosage: '1 capsule weekly or as prescribed', requiresPrescription: false, alternatives: [] },
    { _id: 'm31', name: 'Vitamin B12 500mcg', genericName: 'Cyanocobalamin', category: 'Vitamin', manufacturer: 'Cipla', description: 'B12 supplement for nerve and blood health.', uses: ['B12 deficiency', 'Nerve health', 'Anemia', 'Fatigue'], sideEffects: ['Very rare at normal doses'], dosage: '1 tablet daily', requiresPrescription: false, alternatives: [] },
    { _id: 'm32', name: 'Calcium + D3', genericName: 'Calcium Carbonate + Vitamin D3', category: 'Supplement', manufacturer: 'GSK', description: 'Combined calcium and vitamin D supplement.', uses: ['Calcium deficiency', 'Osteoporosis', 'Bone health'], sideEffects: ['Constipation', 'Gas', 'Bloating', 'Kidney stones (overdose)'], dosage: '1-2 tablets daily with meals', requiresPrescription: false, alternatives: [] },
    { _id: 'm33', name: 'Iron Folic Acid', genericName: 'Ferrous Sulfate + Folic Acid', category: 'Supplement', manufacturer: 'Sun Pharma', description: 'Iron and folate supplement for anemia.', uses: ['Iron deficiency anemia', 'Pregnancy', 'Fatigue'], sideEffects: ['Constipation', 'Black stools', 'Nausea', 'Stomach cramps'], dosage: '1 tablet daily', requiresPrescription: false, alternatives: [] },

    // RESPIRATORY
    { _id: 'm34', name: 'Salbutamol 100mcg Inhaler', genericName: 'Albuterol', category: 'Bronchodilator', manufacturer: 'GSK', description: 'Fast-acting inhaler for asthma attacks.', uses: ['Asthma', 'COPD', 'Bronchospasm', 'Wheezing'], sideEffects: ['Tremor', 'Palpitations', 'Headache', 'Muscle cramps'], dosage: '1-2 puffs every 4-6 hours as needed', requiresPrescription: true, alternatives: [] },
    { _id: 'm35', name: 'Montelukast 10mg', genericName: 'Montelukast Sodium', category: 'Respiratory', manufacturer: 'MSD', description: 'Leukotriene blocker for asthma and allergies.', uses: ['Asthma prevention', 'Seasonal allergies', 'Exercise-induced asthma'], sideEffects: ['Headache', 'Stomach pain', 'Mood changes', 'Dizziness'], dosage: '1 tablet daily in the evening', requiresPrescription: true, alternatives: [] },
    { _id: 'm36', name: 'Ambroxol 30mg', genericName: 'Ambroxol HCl', category: 'Expectorant', manufacturer: 'Boehringer', description: 'Mucolytic to clear chest congestion.', uses: ['Chest congestion', 'Productive cough', 'Bronchitis', 'COPD'], sideEffects: ['Nausea', 'Stomach upset', 'Diarrhea'], dosage: '1 tablet 3 times daily', requiresPrescription: false, alternatives: [] },

    // SKIN
    { _id: 'm37', name: 'Clotrimazole 1% Cream', genericName: 'Clotrimazole', category: 'Antifungal', manufacturer: 'Bayer', description: 'Antifungal cream for skin infections.', uses: ['Ringworm', 'Athletes foot', 'Jock itch', 'Candidiasis'], sideEffects: ['Skin irritation', 'Burning', 'Redness'], dosage: 'Apply twice daily for 2-4 weeks', requiresPrescription: false, alternatives: [] },
    { _id: 'm38', name: 'Betamethasone Cream', genericName: 'Betamethasone Valerate', category: 'Corticosteroid', manufacturer: 'GSK', description: 'Steroid cream for skin inflammation.', uses: ['Eczema', 'Psoriasis', 'Allergic rash', 'Dermatitis'], sideEffects: ['Skin thinning', 'Stretch marks', 'Acne', 'Skin discoloration'], dosage: 'Apply thin layer twice daily', requiresPrescription: true, alternatives: [] },

    // MENTAL HEALTH
    { _id: 'm39', name: 'Alprazolam 0.25mg', genericName: 'Alprazolam', category: 'Anxiolytic', manufacturer: 'Pfizer', description: 'Benzodiazepine for anxiety and panic disorders.', uses: ['Anxiety', 'Panic disorder', 'Insomnia'], sideEffects: ['Drowsiness', 'Dizziness', 'Dependency', 'Memory problems'], dosage: '1 tablet 3 times daily as prescribed', requiresPrescription: true, alternatives: [] },
    { _id: 'm40', name: 'Escitalopram 10mg', genericName: 'Escitalopram Oxalate', category: 'Antidepressant', manufacturer: 'Lundbeck', description: 'SSRI antidepressant for depression and anxiety.', uses: ['Depression', 'Anxiety disorder', 'OCD', 'Panic disorder'], sideEffects: ['Nausea', 'Insomnia', 'Dry mouth', 'Sexual dysfunction'], dosage: '1 tablet daily', requiresPrescription: true, alternatives: [] },

    // DIABETES CARE
    { _id: 'm41', name: 'Insulin Glargine 100U', genericName: 'Insulin Glargine', category: 'Insulin', manufacturer: 'Sanofi', description: 'Long-acting insulin for Type 1 and 2 diabetes.', uses: ['Type 1 diabetes', 'Type 2 diabetes', 'Blood sugar control'], sideEffects: ['Low blood sugar', 'Weight gain', 'Injection site reactions'], dosage: 'As prescribed by doctor - inject subcutaneously', requiresPrescription: true, alternatives: [] },

    // MALARIA
    { _id: 'm42', name: 'Chloroquine 250mg', genericName: 'Chloroquine Phosphate', category: 'Antimalarial', manufacturer: 'Cipla', description: 'Treatment and prevention of malaria.', uses: ['Malaria treatment', 'Malaria prevention', 'Rheumatoid arthritis'], sideEffects: ['Nausea', 'Stomach cramps', 'Vision changes', 'Headache'], dosage: 'As prescribed based on weight and indication', requiresPrescription: true, alternatives: [] },

    // PAIN / TOPICAL
    { _id: 'm43', name: 'Volini Gel', genericName: 'Diclofenac + Methyl Salicylate', category: 'Topical Analgesic', manufacturer: 'Sun Pharma', description: 'Topical pain relief gel for muscles and joints.', uses: ['Muscle pain', 'Joint pain', 'Sprains', 'Back pain', 'Sports injuries'], sideEffects: ['Skin irritation', 'Redness', 'Burning sensation'], dosage: 'Apply 3-4 times daily on affected area', requiresPrescription: false, alternatives: [] },

    // EYE
    { _id: 'm44', name: 'Ciprofloxacin Eye Drops', genericName: 'Ciprofloxacin 0.3%', category: 'Eye Drops', manufacturer: 'Alcon', description: 'Antibiotic eye drops for eye infections.', uses: ['Conjunctivitis', 'Eye infections', 'Corneal ulcers'], sideEffects: ['Eye irritation', 'Burning', 'Blurred vision (temporary)'], dosage: '1-2 drops every 4-6 hours', requiresPrescription: true, alternatives: [] },

    // FEVER / COLD
    { _id: 'm45', name: 'Sinarest Tablet', genericName: 'Paracetamol + Phenylephrine + Chlorpheniramine', category: 'Cold & Flu', manufacturer: 'Centaur', description: 'Combination medicine for cold and flu symptoms.', uses: ['Common cold', 'Flu', 'Blocked nose', 'Runny nose', 'Headache'], sideEffects: ['Drowsiness', 'Dry mouth', 'Nausea', 'Dizziness'], dosage: '1 tablet 3-4 times daily', requiresPrescription: false, alternatives: [] },
    { _id: 'm46', name: 'Crocin 650mg', genericName: 'Paracetamol 650mg', category: 'Analgesic', manufacturer: 'GSK', description: 'Higher dose paracetamol for stronger fever/pain.', uses: ['High fever', 'Moderate pain', 'Post-vaccination fever'], sideEffects: ['Liver damage (overdose)', 'Nausea', 'Rash'], dosage: '1 tablet every 6-8 hours', requiresPrescription: false, alternatives: ['m01'] },

    // STOMACH
    { _id: 'm47', name: 'Drotin 80mg', genericName: 'Drotaverine HCl', category: 'Antispasmodic', manufacturer: 'IPCA', description: 'Antispasmodic for stomach cramps and pain.', uses: ['Stomach cramps', 'Menstrual cramps', 'Urinary spasms', 'IBS'], sideEffects: ['Nausea', 'Dizziness', 'Dry mouth', 'Headache'], dosage: '1-2 tablets 3 times daily', requiresPrescription: false, alternatives: [] },
    { _id: 'm48', name: 'Digene Syrup', genericName: 'Magnesium Hydroxide + Simethicone', category: 'Antacid', manufacturer: 'Abbott', description: 'Antacid for immediate heartburn relief.', uses: ['Heartburn', 'Acidity', 'Gas', 'Indigestion', 'Bloating'], sideEffects: ['Diarrhea', 'Constipation'], dosage: '2 teaspoons after meals', requiresPrescription: false, alternatives: ['m18', 'm19'] },

    // BLOOD THINNERS
    { _id: 'm49', name: 'Clopidogrel 75mg', genericName: 'Clopidogrel Bisulfate', category: 'Antiplatelet', manufacturer: 'Sanofi', description: 'Blood thinner to prevent heart attacks and strokes.', uses: ['Heart attack prevention', 'Stroke prevention', 'Coronary stents'], sideEffects: ['Bleeding', 'Bruising', 'Stomach pain', 'Headache'], dosage: '1 tablet daily', requiresPrescription: true, alternatives: ['m03'] },

    // INFECTION
    { _id: 'm50', name: 'Fluconazole 150mg', genericName: 'Fluconazole', category: 'Antifungal', manufacturer: 'Pfizer', description: 'Oral antifungal for systemic fungal infections.', uses: ['Vaginal yeast infection', 'Oral thrush', 'Systemic fungal infections'], sideEffects: ['Nausea', 'Headache', 'Stomach pain', 'Liver problems (rare)'], dosage: '1 tablet as single dose or as prescribed', requiresPrescription: true, alternatives: [] }
  ];

  const stores = [
    { _id: 'str1', name: 'MedPlus Pharmacy', owner: 'store1', address: '123 MG Road, Hyderabad - 500001', phone: '040-12345678', email: 'medplus@example.com', openingHours: '8:00 AM - 10:00 PM', isOpen: true, rating: 4.5, location: { lat: 17.385, lng: 78.4867 } },
    { _id: 'str2', name: 'Apollo Pharmacy', owner: 'store2', address: '456 Jubilee Hills, Hyderabad - 500033', phone: '040-87654321', email: 'apollo@example.com', openingHours: '24 Hours Open', isOpen: true, rating: 4.8, location: { lat: 17.432, lng: 78.408 } },
    { _id: 'str3', name: 'City Medical Store', owner: 'store1', address: '789 Banjara Hills, Hyderabad - 500034', phone: '040-11223344', email: 'citymed@example.com', openingHours: '9:00 AM - 9:00 PM', isOpen: false, rating: 4.2, location: { lat: 17.415, lng: 78.448 } },
    { _id: 'str4', name: 'Netmeds Pharmacy', owner: 'store2', address: '321 Gachibowli, Hyderabad - 500032', phone: '040-55667788', email: 'netmeds@example.com', openingHours: '8:00 AM - 11:00 PM', isOpen: true, rating: 4.6, location: { lat: 17.445, lng: 78.348 } }
  ];

  // Generate inventory for all medicines across all stores
  const inventory = [];
  let invId = 1;
  const basePrice = { 'm01':25, 'm02':45, 'm03':30, 'm04':85, 'm05':120, 'm06':95, 'm07':150, 'm08':130, 'm09':70, 'm10':110, 'm11':55, 'm12':80, 'm13':280, 'm14':75, 'm15':65, 'm16':95, 'm17':90, 'm18':60, 'm19':55, 'm20':40, 'm21':35, 'm22':180, 'm23':40, 'm24':45, 'm25':120, 'm26':85, 'm27':150, 'm28':95, 'm29':75, 'm30':140, 'm31':60, 'm32':180, 'm33':45, 'm34':250, 'm35':160, 'm36':55, 'm37':85, 'm38':120, 'm39':35, 'm40':160, 'm41':850, 'm42':65, 'm43':95, 'm44':70, 'm45':45, 'm46':35, 'm47':55, 'm48':80, 'm49':95, 'm50':280 };

  stores.forEach((store, si) => {
    medicines.forEach(med => {
      // Not all stores have all medicines
      if (Math.random() > 0.2) {
        const base = basePrice[med._id] || 50;
        const variation = 0.85 + Math.random() * 0.3; // ±15% price variation
        const price = Math.round(base * variation);
        const discount = [0, 0, 0, 5, 10, 15, 20][Math.floor(Math.random() * 7)];
        const stock = Math.floor(Math.random() * 200) + 5;
        inventory.push({
          _id: `inv${invId++}`,
          store: store._id,
          medicine: med._id,
          price,
          stock,
          discount,
          expiryDate: `202${6 + Math.floor(Math.random()*3)}-${String(Math.floor(Math.random()*12)+1).padStart(2,'0')}-28`,
          updatedAt: new Date().toISOString()
        });
      }
    });
  });

  const db = { users, medicines, stores, inventory, orders: [], prescriptions: [] };
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));

  console.log('✅ Users created:     ' + users.length);
  console.log('✅ Medicines added:   ' + medicines.length);
  console.log('✅ Stores created:    ' + stores.length);
  console.log('✅ Inventory items:   ' + inventory.length);
  console.log('\n═══════════════════════════════════════');
  console.log('LOGIN CREDENTIALS:');
  console.log('───────────────────────────────────────');
  console.log('Admin : admin@medicineapp.com / Admin@123');
  console.log('Store : store@medicineapp.com / Store@123');
  console.log('User  : user@medicineapp.com  / User@123');
  console.log('═══════════════════════════════════════');
  console.log('\nNow run: npm start');
  console.log('Then open: http://localhost:5000\n');
}

seed();
