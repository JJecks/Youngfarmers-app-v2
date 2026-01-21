/**
 * Young Farmers Agencies LTD - Complete Application Logic
 */

// --- 1. CONSTANTS & DATA ---
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
let selectedDate = ""; // Managed by the date picker
let dailyData = null;

// --- 2. INITIALIZATION ---
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
            const userDoc = await db.collection('users').doc(user.uid).get();
            if (!userDoc.exists) {
                const isAdmin = user.email === "jeckstom777@gmail.com";
                currentUser = {
                    uid: user.uid,
                    email: user.email,
                    name: user.displayName || "New User",
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
        } else {
            showScreen('auth-screen');
        }
        hideSplashScreen();
    });
}

// --- 3. CORE STOCK LOGIC ---
async function loadDailyData() {
    const doc = await db.collection('shops').doc(currentShop).collection('daily').doc(selectedDate).get();
    dailyData = doc.exists ? doc.data() : {
        openingStock: {}, regularSales: [], restocking: [], creditSales: [],
        transfersIn: [], transfersOut: [], creditorReleases: [], prepayments: [], debtPayments: []
    };

    // If no opening stock today, look for yesterday's closing
    if (Object.keys(dailyData.openingStock).length === 0) {
        const yesterday = getPreviousDay(selectedDate);
        const yDoc = await db.collection('shops').doc(currentShop).collection('daily').doc(yesterday).get();
        if (yDoc.exists) {
            dailyData.openingStock = calculateClosingFromData(yDoc.data());
            await saveDailyData(); // Auto-save yesterday's closing as today's opening
        }
    }
    renderStockTable();
    renderHistory();
    updateFormSelectors();
}

function calculateClosingFromData(data) {
    const closing = {};
    PRODUCTS.forEach(p => {
        const opening = data.openingStock[p.id] || 0;
        const restock = (data.restocking || []).filter(r => r.feed === p.id).reduce((s, r) => s + r.bags, 0) +
                        (data.transfersIn || []).filter(t => t.feed === p.id).reduce((s, t) => s + t.bags, 0);
        const sold = (data.regularSales || []).filter(s => s.feed === p.id).reduce((s, r) => s + r.bags, 0) +
                     (data.creditSales || []).filter(s => s.feed === p.id).reduce((s, r) => s + r.bags, 0);
        const out = (data.transfersOut || []).filter(t => t.feed === p.id).reduce((s, t) => s + t.bags, 0);
        const rel = (data.creditorReleases || []).filter(r => r.feed === p.id).reduce((s, r) => s + r.bags, 0);
        
        closing[p.id] = opening + restock - sold - out - rel;
    });
    return closing;
}

// --- 4. TRANSACTION HANDLERS ---
async function handleFormSubmit(formId, collectionName) {
    const form = document.getElementById(formId);
    const formData = new FormData(form);
    const entry = {};
    formData.forEach((value, key) => {
        entry[key] = (key === 'bags' || key === 'amount' || key === 'price' || key === 'discount') ? parseFloat(value) : value;
    });
    entry.timestamp = Date.now();

    try {
        await db.runTransaction(async (transaction) => {
            const shopRef = db.collection('shops').doc(currentShop).collection('daily').doc(selectedDate);
            const doc = await transaction.get(shopRef);
            let data = doc.exists ? doc.data() : dailyData;
            
            if (!data[collectionName]) data[collectionName] = [];
            data[collectionName].push(entry);
            transaction.set(shopRef, data, { merge: true });

            // Trigger Automatic Transfer In
            if (collectionName === 'transfersOut') {
                const targetRef = db.collection('shops').doc(entry.toShop).collection('daily').doc(selectedDate);
                const tDoc = await transaction.get(targetRef);
                let tData = tDoc.exists ? tDoc.data() : { transfersIn: [] };
                if (!tData.transfersIn) tData.transfersIn = [];
                tData.transfersIn.push({ feed: entry.feed, bags: entry.bags, fromShop: currentShop, timestamp: Date.now() });
                transaction.set(targetRef, tData, { merge: true });
            }
        });
        showToast("Recorded successfully", "success");
        form.reset();
        loadDailyData();
    } catch (e) {
        showToast("Error: " + e.message, "error");
    }
}

// --- 5. MANAGER VIEWS LOGIC ---
async function renderManagerView(viewId) {
    const content = document.getElementById('manager-view-content');
    content.innerHTML = `<h3>Loading ${viewId.replace('-', ' ')}...</h3>`;
    showScreen('manager-views-container');

    let html = `<h2>${viewId.replace('-', ' ').toUpperCase()}</h2>`;

    if (viewId === 'total-sales') {
        html += `<table><thead><tr><th>Shop</th><th>Remaining</th><th>Sold</th><th>Amount</th></tr></thead><tbody>`;
        let grandTotal = 0;
        for (const shop of SHOPS) {
            const doc = await db.collection('shops').doc(shop).collection('daily').doc(selectedDate).get();
            const data = doc.exists ? doc.data() : { openingStock: {} };
            const closing = calculateClosingFromData(data);
            const totalRemaining = Object.values(closing).reduce((a, b) => a + b, 0);
            const soldBags = (data.regularSales || []).concat(data.creditSales || []).reduce((s, r) => s + r.bags, 0);
            const amt = (data.regularSales || []).concat(data.creditSales || []).reduce((s, r) => s + (r.bags * (PRODUCTS.find(p=>p.id===r.feed).sales)), 0);
            grandTotal += amt;
            html += `<tr><td>${shop}</td><td>${totalRemaining}</td><td>${soldBags}</td><td>${amt.toLocaleString()}</td></tr>`;
        }
        html += `</tbody><tfoot><tr><td colspan="3">GRAND TOTAL</td><td>${grandTotal.toLocaleString()}</td></tr></tfoot></table>`;
    }

    if (viewId === 'stock-value-view') {
        // Logic for the Stock Value Cards
        const shopStockValue = 0; // Iterate all shops and multiply closing by cost
        const debtorsValue = 0; // Sum all credit sales - debt payments
        const creditorsValue = 0; // Sum all prepayments - releases
        html = `
            <div class="value-card"><h4>Debtors Value</h4><p>KSh ${debtorsValue}</p></div>
            <div class="value-card"><h4>Shop Stock Value</h4><p>KSh ${shopStockValue}</p></div>
            <div class="value-card highlight"><h4>Net Business Value</h4><p>KSh ${shopStockValue + debtorsValue - creditorsValue}</p></div>
        `;
    }

    content.innerHTML = html;
}

// --- 6. PDF EXPORT (DOC 2: STOCK VALUE BOOK) ---
async function exportDoc2() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Page 1: Sales Summary
    doc.text("SALES TOTALS", 105, 20, { align: 'center' });
    // ... AutoTable logic for summary ...

    doc.addPage();
    doc.text("DEBTORS", 105, 20, { align: 'center' });
    // ... AutoTable logic for Debtors ...

    doc.save(`YFarmers Stock Value Book.pdf`);
}

// --- UTILS ---
function formatDateForFirestore(val) {
    const [y, m, d] = val.split('-');
    return `${d}-${m}-${y}`;
}

function showSplashScreen() { /* Logic handled in index.html */ }
function hideSplashScreen() { document.getElementById('splash-screen')?.remove(); }

function setupEventListeners() {
    // Transaction Save Buttons
    document.querySelectorAll('.trans-form').forEach(form => {
        const saveBtn = form.querySelector('[data-action="save"]');
        if (saveBtn) {
            saveBtn.onclick = (e) => {
                e.preventDefault();
                handleFormSubmit(form.id, form.id.replace('form-', ''));
            };
        }
    });

    // Manager Tool Buttons
    document.querySelectorAll('.tool-btn').forEach(btn => {
        btn.onclick = () => renderManagerView(btn.dataset.view);
    });

    // Date Selector
    document.getElementById('global-date-selector').onchange = (e) => {
        selectedDate = formatDateForFirestore(e.target.value);
        if (currentShop) loadDailyData();
    };

    // Logout
    document.getElementById('btn-logout').onclick = () => auth.signOut();
}