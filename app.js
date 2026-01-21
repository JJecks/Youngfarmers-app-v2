/**
 * Young Farmers Agencies LTD - Final Production Logic (Robust Version)
 */

// --- 1. UI UTILITIES (Defined first to prevent ReferenceErrors) ---
function showScreen(id) {
    const screen = document.getElementById(id);
    if (!screen) {
        console.error(`Screen with ID "${id}" not found.`);
        return;
    }
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    screen.classList.remove('hidden');
}

function showToast(message, type) {
    const container = document.getElementById('toast-container');
    const div = document.createElement('div');
    div.className = `toast ${type}`;
    div.textContent = message;
    container.appendChild(div);
    setTimeout(() => div.remove(), 3000);
}

function hideSplashScreen() {
    const s = document.getElementById('splash-screen');
    if (s) {
        s.style.opacity = '0';
        setTimeout(() => s.remove(), 800);
    }
}

// --- 2. CONSTANTS & DATA ---
const SHOPS = ["Usigu", "Port Victoria", "Mbita", "Usenge", "Lwanda Kotieno", "Obambo", "Sori"];
const PRODUCTS = [
    { id: "STARTER MASH", name: "Starter Mash", cost: 4240, sales: 4600 },
    { id: "SAMAKGRO 1MM", name: "Samakgro 1MM", cost: 3690, sales: 4150 },
    { id: "SAMAKGRO 2MM", name: "Samakgro 2MM", cost: 3600, sales: 3200 },
    { id: "SAMAKGRO 3MM", name: "Samakgro 3MM", cost: 3200, sales: 2850 },
    { id: "SAMAKGRO 4MMHP", name: "Samakgro 4MMHP", cost: 2950, sales: 2650 },
    { id: "SAMAKGRO 4.5MM", name: "Samakgro 4.5MM", cost: 2800, sales: 2500 },
    { id: "BROODSTOCK", name: "Broodstock", cost: 3900, sales: 3900 }
];

let currentUser = null;
let currentShop = null;
let selectedDate = ""; 
let dailyData = null;

// --- 3. INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    const dateInput = document.getElementById('global-date-selector');
    const today = new Date();
    dateInput.value = today.toISOString().split('T')[0];
    selectedDate = formatDateForFirestore(dateInput.value);

    initAuth();
    setupEventListeners();
});

function initAuth() {
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            try {
                const userDoc = await db.collection('users').doc(user.uid).get();
                if (!userDoc.exists) {
                    const isAdmin = user.email === "jeckstom777@gmail.com";
                    currentUser = {
                        uid: user.uid,
                        email: user.email,
                        name: user.displayName || "User",
                        role: isAdmin ? "manager_full" : "pending",
                        status: isAdmin ? "active" : "pending",
                        shop: null
                    };
                    await db.collection('users').doc(user.uid).set(currentUser);
                } else {
                    currentUser = userDoc.data();
                }

                if (currentUser.status === "pending") {
                    showScreen('pending-screen');
                } else {
                    showScreen('app-container');
                    renderDashboard();
                }
            } catch (err) {
                console.error("Auth Error:", err);
            }
        } else {
            showScreen('auth-screen');
        }
        hideSplashScreen();
    });
}

// --- 4. DATA LOGIC ---
async function loadDailyData() {
    const doc = await db.collection('shops').doc(currentShop).collection('daily').doc(selectedDate).get();
    dailyData = doc.exists ? doc.data() : {
        openingStock: {}, regularSales: [], restocking: [], creditSales: [],
        transfersIn: [], transfersOut: [], creditorReleases: [], prepayments: [], debtPayments: []
    };

    if (Object.keys(dailyData.openingStock).length === 0) {
        const yesterday = getPreviousDay(selectedDate);
        const yDoc = await db.collection('shops').doc(currentShop).collection('daily').doc(yesterday).get();
        if (yDoc.exists) {
            dailyData.openingStock = calculateClosingFromData(yDoc.data());
        }
    }
    renderStockTable();
    updateSelectors();
}

/** * Total Sales Formula:
 * (Sales Made + Prepayments + Debt Payments) - (Underpayments + Discounts)
 */
function calculateTotalSales(data) {
    const salesMade = (data.regularSales || []).reduce((s, r) => s + (r.bags * (PRODUCTS.find(p=>p.id===r.feed)?.sales || 0)), 0);
    const prepayments = (data.prepayments || []).reduce((s, r) => s + (r.amount || 0), 0);
    const debtPayments = (data.debtPayments || []).reduce((s, r) => s + (r.amount || 0), 0);
    const underpayments = (data.underpayments || []).reduce((s, r) => s + (r.amount || 0), 0);
    const discounts = (data.discounts || []).reduce((s, r) => s + (r.amount || 0), 0);

    return (salesMade + prepayments + debtPayments) - (underpayments + discounts);
}

function calculateClosingFromData(data) {
    const closing = {};
    PRODUCTS.forEach(p => {
        const op = data.openingStock[p.id] || 0;
        const restock = (data.restocking || []).filter(r => r.feed === p.id).reduce((s, r) => s + r.bags, 0) +
                        (data.transfersIn || []).filter(t => t.feed === p.id).reduce((s, t) => s + t.bags, 0);
        const sold = (data.regularSales || []).filter(s => s.feed === p.id).reduce((s, r) => s + r.bags, 0) +
                     (data.creditSales || []).filter(s => s.feed === p.id).reduce((s, r) => s + r.bags, 0);
        const out = (data.transfersOut || []).filter(t => t.feed === p.id).reduce((s, t) => s + t.bags, 0);
        const rel = (data.creditorReleases || []).filter(r => r.feed === p.id).reduce((s, r) => s + r.bags, 0);
        closing[p.id] = op + restock - sold - out - rel;
    });
    return closing;
}

// --- 5. TRANSACTION HANDLER ---
async function handleFormSubmit(formId, type) {
    const form = document.getElementById(formId);
    if (!form) return;
    const data = Object.fromEntries(new FormData(form));
    
    ['bags', 'amount', 'price', 'discount'].forEach(key => {
        if(data[key]) data[key] = parseFloat(data[key]);
    });

    try {
        await db.runTransaction(async (transaction) => {
            const shopRef = db.collection('shops').doc(currentShop).collection('daily').doc(selectedDate);
            const doc = await transaction.get(shopRef);
            let sData = doc.exists ? doc.data() : dailyData;
            
            if (!sData[type]) sData[type] = [];
            sData[type].push({...data, timestamp: Date.now()});
            transaction.set(shopRef, sData, { merge: true });

            if (type === 'transfersOut') {
                const targetRef = db.collection('shops').doc(data.toShop).collection('daily').doc(selectedDate);
                const tDoc = await transaction.get(targetRef);
                let tData = tDoc.exists ? tDoc.data() : { transfersIn: [] };
                if (!tData.transfersIn) tData.transfersIn = [];
                tData.transfersIn.push({ feed: data.feed, bags: data.bags, fromShop: currentShop, timestamp: Date.now() });
                transaction.set(targetRef, tData, { merge: true });
            }
        });
        showToast("Recorded!", "success");
        form.reset();
        loadDailyData();
    } catch (e) {
        showToast("Error: " + e.message, "error");
    }
}

// --- 6. UTILS ---
function formatDateForFirestore(val) {
    const [y, m, d] = val.split('-');
    return `${d}-${m}-${y}`;
}

function getPreviousDay(dateStr) {
    const [d, m, y] = dateStr.split('-');
    const date = new Date(y, m - 1, d);
    date.setDate(date.getDate() - 1);
    return date.toLocaleDateString('en-GB').replace(/\//g, '-');
}

function renderDashboard() {
    const container = document.getElementById('shop-buttons-container');
    if (!container) return;
    container.innerHTML = '';
    SHOPS.forEach(shop => {
        const btn = document.createElement('button');
        btn.className = 'shop-btn';
        btn.textContent = shop;
        btn.onclick = () => openShop(shop);
        container.appendChild(btn);
    });

    document.getElementById('user-display-name').textContent = currentUser.name;
    document.getElementById('user-role-badge').textContent = currentUser.role.replace('_', ' ');
}

function updateSelectors() {
    document.querySelectorAll('.feed-select').forEach(s => {
        s.innerHTML = PRODUCTS.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
    });
    document.querySelectorAll('.shop-select').forEach(s => {
        s.innerHTML = SHOPS.filter(sh => sh !== currentShop).map(sh => `<option value="${sh}">${sh}</option>`).join('');
    });
}

function setupEventListeners() {
    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) logoutBtn.onclick = () => auth.signOut();

    const dateSelector = document.getElementById('global-date-selector');
    if (dateSelector) {
        dateSelector.onchange = (e) => {
            selectedDate = formatDateForFirestore(e.target.value);
            if (currentShop) loadDailyData();
        };
    }
    
    const forms = {
        'form-sale': 'regularSales',
        'form-restock': 'restocking',
        'form-transfer-in': 'transfersIn',
        'form-transfer-out': 'transfersOut',
        'form-creditor-release': 'creditorReleases',
        'form-credit-sale': 'creditSales',
        'form-prepayment': 'prepayments',
        'form-debt-payment': 'debtPayments'
    };

    Object.entries(forms).forEach(([id, type]) => {
        const f = document.getElementById(id);
        if (f) {
            const btn = f.querySelector('[data-action="save"]');
            if (btn) btn.onclick = (e) => { e.preventDefault(); handleFormSubmit(id, type); };
        }
    });

    const backBtns = document.querySelectorAll('.btn-back');
    backBtns.forEach(b => b.onclick = () => showScreen('app-container'));
}