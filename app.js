import { auth, db } from './firebase-config.js';
import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signInWithPopup,
    GoogleAuthProvider,
    onAuthStateChanged,
    signOut
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import {
    collection,
    doc,
    setDoc,
    getDoc,
    getDocs,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

const ADMIN_EMAIL = 'jeckstom777@gmail.com';
const SHOPS = ['Usigu', 'Port Victoria', 'Mbita', 'Usenge', 'Lwanda Kotieno', 'Obambo', 'Sori'];
const PRODUCTS = [
    { id: 'STARTER_MASH', name: 'Starter Mash', cost: 4240, sales: 4600 },
    { id: 'SAMAKGRO_1MM', name: 'Samakgro 1MM', cost: 3690, sales: 4150 },
    { id: 'SAMAKGRO_2MM', name: 'Samakgro 2MM', cost: 3600, sales: 3200 },
    { id: 'SAMAKGRO_3MM', name: 'Samakgro 3MM', cost: 3200, sales: 2850 },
    { id: 'SAMAKGRO_4MMHP', name: 'Samakgro 4MMHP', cost: 2950, sales: 2650 },
    { id: 'SAMAKGRO_4.5MM', name: 'Samakgro 4.5MM', cost: 2800, sales: 2500 },
    { id: 'BROODSTOCK', name: 'Broodstock', cost: 3900, sales: 3900 }
];

let currentUser = null;
let currentUserData = null;
let currentShop = null;
let currentDate = formatDate(new Date());
let productsData = [...PRODUCTS];
window.currentUserData = null;

function formatDate(date) {
    const d = new Date(date);
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
}

function formatDateDisplay(dateStr) {
    const [day, month, year] = dateStr.split('-');
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];
    const suffix = (d) => {
        const num = parseInt(d);
        if (num > 3 && num < 21) return 'th';
        switch (num % 10) {
            case 1: return 'st';
            case 2: return 'nd';
            case 3: return 'rd';
            default: return 'th';
        }
    };
    return `${parseInt(day)}${suffix(day)} ${monthNames[parseInt(month) - 1]} ${year}`;
}

function dateToISO(dateStr) {
    const [day, month, year] = dateStr.split('-');
    return `${year}-${month}-${day}`;
}

function isoToDate(isoStr) {
    const [year, month, day] = isoStr.split('-');
    return `${day}-${month}-${year}`;
}

function getPreviousDate(dateStr) {
    const [day, month, year] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    date.setDate(date.getDate() - 1);
    return formatDate(date);
}

function formatBags(number) {
    return number % 1 === 0 ? number.toString() : number.toFixed(1);
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type}`;
    toast.style.display = 'block';
    setTimeout(() => {
        toast.style.display = 'none';
    }, 3000);
}

function showView(viewId) {
    document.querySelectorAll('.view-container').forEach(view => {
        view.style.display = 'none';
    });
    const view = document.getElementById(viewId);
    if (view) view.style.display = 'block';
}
window.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        document.getElementById('splash-screen').style.display = 'none';
        document.getElementById('auth-screen').style.display = 'flex';
    }, 3000);
    setupAuthListeners();
    setupAppListeners();
});

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
            currentUserData = userDoc.data();
            window.currentUserData = currentUserData;
            if (currentUserData.status === 'pending') {
                showPendingScreen();
            } else {
                showMainApp();
            }
        }
    } else {
        currentUser = null;
        currentUserData = null;
        window.currentUserData = null;
        document.getElementById('auth-screen').style.display = 'flex';
        document.getElementById('app').style.display = 'none';
        document.getElementById('pending-screen').style.display = 'none';
    }
});

function showPendingScreen() {
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('app').style.display = 'none';
    document.getElementById('pending-screen').style.display = 'flex';
}

function showMainApp() {
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('pending-screen').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    document.getElementById('user-name').textContent = currentUserData.name;
    const roleText = currentUserData.role === 'manager_full' ? 'Manager (Full Access)' :
                     currentUserData.role === 'manager_view' ? 'Manager (View Only)' :
                     `Attendant - ${currentUserData.shop}`;
    document.getElementById('user-role').textContent = roleText;
    loadDashboard();
}

function setupAppListeners() {
    document.getElementById('signout-btn').addEventListener('click', async () => {
        await signOut(auth);
        showToast('Signed out successfully!', 'success');
        setTimeout(() => {
            window.location.reload();
        }, 500);
    });

    document.getElementById('header-home').addEventListener('click', () => {
        loadDashboard();
    });
}
function setupAuthListeners() {
    const signinTab = document.getElementById('signin-tab');
    const signupTab = document.getElementById('signup-tab');
    const authForm = document.getElementById('auth-form');
    const nameField = document.getElementById('name-field');
    const authSubmit = document.getElementById('auth-submit');
    const googleSignin = document.getElementById('google-signin');

    signinTab.addEventListener('click', () => {
        signinTab.classList.add('active');
        signupTab.classList.remove('active');
        nameField.style.display = 'none';
        authSubmit.textContent = 'Sign In';
    });

    signupTab.addEventListener('click', () => {
        signupTab.classList.add('active');
        signinTab.classList.remove('active');
        nameField.style.display = 'block';
        authSubmit.textContent = 'Sign Up';
    });

    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('auth-email').value;
        const password = document.getElementById('auth-password').value;
        const name = document.getElementById('auth-name').value;

        if (signupTab.classList.contains('active')) {
            try {
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                const isAdmin = email === ADMIN_EMAIL;
                await setDoc(doc(db, 'users', userCredential.user.uid), {
                    email, name,
                    role: isAdmin ? 'manager_full' : 'pending',
                    status: isAdmin ? 'active' : 'pending',
                    shop: null,
                    createdAt: new Date().toISOString()
                });
                showToast(isAdmin ? 'Admin account created!' : 'Account created! Awaiting approval.', 'success');
            } catch (error) {
                showToast(error.message, 'error');
            }
        } else {
            try {
                await signInWithEmailAndPassword(auth, email, password);
                showToast('Signed in successfully!', 'success');
            } catch (error) {
                showToast(error.message, 'error');
            }
        }
    });

    googleSignin.addEventListener('click', async () => {
        try {
            const provider = new GoogleAuthProvider();
            provider.setCustomParameters({
                prompt: 'select_account'
            });
        
            const result = await signInWithPopup(auth, provider);
            const userDoc = await getDoc(doc(db, 'users', result.user.uid));
            
            if (!userDoc.exists()) {
                const isAdmin = result.user.email === ADMIN_EMAIL;
                await setDoc(doc(db, 'users', result.user.uid), {
                    email: result.user.email,
                    name: result.user.displayName || result.user.email,
                    role: isAdmin ? 'manager_full' : 'pending',
                    status: isAdmin ? 'active' : 'pending',
                    shop: null,
                    createdAt: new Date().toISOString()
                });
            }
        
            // Force reload user data
            const updatedUserDoc = await getDoc(doc(db, 'users', result.user.uid));
            if (updatedUserDoc.exists()) {
                currentUserData = updatedUserDoc.data();
                window.currentUserData = currentUserData;
            
                if (currentUserData.status === 'pending') {
                    showToast('Account pending approval. Please contact admin.', 'success');
                } else {
                    showToast('Signed in with Google!', 'success');
                }
            }
        } catch (error) {
            if (error.code === 'auth/popup-blocked') {
                showToast('Please allow popups for this site and try again', 'error');
            } else if (error.code === 'auth/cancelled-popup-request' || error.code === 'auth/popup-closed-by-user') {
                showToast('Sign-in cancelled', 'error');
            } else {
                showToast(error.message, 'error');
            }
        }
    });
        document.getElementById('pending-signout').addEventListener('click', async () => {
            await signOut(auth);
            setTimeout(() => {
                window.location.reload();
            }, 500);
    });
}
function loadDashboard() {
    showView('dashboard-view');
    const container = document.getElementById('dashboard-buttons');
    container.innerHTML = '';
    const isManager = currentUserData.role === 'manager_full' || currentUserData.role === 'manager_view';

    const buttons = [
        ...SHOPS.map(shop => ({ label: shop, action: () => loadShopView(shop), color: '#2e7d32' })),
        ...(isManager ? [
            { label: 'Total Sales', action: () => loadTotalSalesView(), color: '#1976d2' },
            { label: 'Analytics', action: () => loadAnalyticsView(), color: '#673ab7' },
            { label: 'Shop Comparison', action: () => loadShopComparisonView(), color: '#00897b' },
            { label: 'Low Stock Alerts', action: () => loadLowStockAlertsView(), color: '#e64a19' },
            { label: 'Debtors', action: () => loadDebtorsView(), color: '#d32f2f' },
            { label: 'Creditors', action: () => loadCreditorsView(), color: '#f57c00' },
            { label: 'Stock Value', action: () => loadStockValueView(), color: '#7b1fa2' },
            { label: 'Products', action: () => loadProductsView(), color: '#0097a7' },
            { label: 'All Clients', action: () => loadAllClientsView(), color: '#388e3c' }
        ] : []),
        ...(currentUserData.role === 'manager_full' ? [
            { label: 'Admin Panel', action: () => loadAdminPanel(), color: '#c62828' }
        ] : [])
    ];

    buttons.forEach(btn => {
        const button = document.createElement('button');
        button.className = 'dashboard-btn';
        button.textContent = btn.label;
        button.style.background = btn.color;
        button.addEventListener('click', btn.action);
        container.appendChild(button);
    });
}

function calculateRestocking(data, productId) {
    let total = 0;
    if (data?.restocking) {
        Object.values(data.restocking).forEach(r => {
            if (r.feedType === productId) total += parseFloat(r.bags || 0);
        });
    }
    if (data?.transfersIn) {
        Object.values(data.transfersIn).forEach(t => {
            if (t.feedType === productId) total += parseFloat(t.bags || 0);
        });
    }
    return total;
}

function calculateSold(data, productId) {
    let total = 0;
    if (data?.regularSales) {
        Object.values(data.regularSales).forEach(s => {
            if (s.feedType === productId) total += parseFloat(s.bags || 0);
        });
    }
    if (data?.creditSales) {
        Object.values(data.creditSales).forEach(s => {
            if (s.feedType === productId) total += parseFloat(s.bags || 0);
        });
    }
    return total;
}

function calculateTransfersOut(data, productId) {
    let total = 0;
    if (data?.transfersOut) {
        Object.values(data.transfersOut).forEach(t => {
            if (t.feedType === productId) total += parseFloat(t.bags || 0);
        });
    }
    return total;
}

function calculateCreditorReleases(data, productId) {
    let total = 0;
    if (data?.creditorReleases) {
        Object.values(data.creditorReleases).forEach(c => {
            if (c.feedType === productId) total += parseFloat(c.bags || 0);
        });
    }
    return total;
}

function calculateClosingStock(data) {
    const closing = {};
    productsData.forEach(product => {
        const opening = data?.openingStock?.[product.id] || 0;
        const restocking = calculateRestocking(data, product.id);
        const sold = calculateSold(data, product.id);
        const transfersOut = calculateTransfersOut(data, product.id);
        const creditorReleases = calculateCreditorReleases(data, product.id);
        closing[product.id] = opening + restocking - sold - transfersOut - creditorReleases;
    });
    return closing;
}
async function loadShopView(shop) {
    currentShop = shop;
    const canEdit = currentUserData.role === 'manager_full' || 
                    (currentUserData.role === 'attendant' && currentUserData.shop === shop);

    if (!canEdit) {
        loadReadOnlyShopView(shop);
        return;
    }

    showView('shop-view');
    document.getElementById('shop-title').textContent = shop;
    
    const dateSelector = document.getElementById('date-selector');
    dateSelector.value = dateToISO(currentDate);
    dateSelector.onchange = (e) => {
        currentDate = isoToDate(e.target.value);
        loadShopData(shop, currentDate);
    };

    if (currentUserData.role !== 'attendant') {
        document.getElementById('sales-total-header').style.display = 'table-cell';
    }

    await loadShopData(shop, currentDate);
    setupTransactionForms(shop);
}

async function loadShopData(shop, date) {
    const shopDocRef = doc(db, 'shops', shop, 'daily', date);
    const shopDoc = await getDoc(shopDocRef);

    let openingStock = {};
    let isFirstEntry = false;
    let openingStockSaved = false;

    if (shopDoc.exists()) {
        const data = shopDoc.data();
        openingStock = data.openingStock || {};
        openingStockSaved = !!data.openingStock;
        renderClosingStockTable(shop, date, openingStock, shopDoc.data(), openingStockSaved, false);
        if (openingStockSaved && currentUserData) {
            document.getElementById('transaction-forms').style.display = 'block';
            document.getElementById('recorded-transactions').style.display = 'block';
            renderRecordedTransactions(shopDoc.data(), shop, date);
        }
    } else {
        const yesterday = getPreviousDate(date);
        const yesterdayDocRef = doc(db, 'shops', shop, 'daily', yesterday);
        const yesterdayDoc = await getDoc(yesterdayDocRef);

        if (yesterdayDoc.exists()) {
            openingStock = calculateClosingStock(yesterdayDoc.data());
            
            // AUTO-SAVE yesterday's closing as today's opening
            try {
                await setDoc(doc(db, 'shops', shop, 'daily', date), { 
                    openingStock 
                }, { merge: true });
                
                openingStockSaved = true;
                renderClosingStockTable(shop, date, openingStock, null, true, false);
                
                // Show transaction forms immediately
                if (currentUserData) {
                    document.getElementById('transaction-forms').style.display = 'block';
                    document.getElementById('recorded-transactions').style.display = 'block';
                }
            } catch (error) {
                showToast('Error auto-saving opening stock: ' + error.message, 'error');
                renderClosingStockTable(shop, date, openingStock, null, false, false);
            }
        } else {
            isFirstEntry = true;
            document.getElementById('first-entry-warning').style.display = 'block';
            renderClosingStockTable(shop, date, {}, null, false, true);
        }
    }

    setupOpeningStockSave(shop, date, openingStockSaved, isFirstEntry);
}

async function loadReadOnlyShopView(shop) {
    showView('readonly-shop-view');
    document.getElementById('readonly-shop-title').textContent = `${shop} - Stock Available (View Only)`;
    
    const shopDocRef = doc(db, 'shops', shop, 'daily', currentDate);
    const shopDoc = await getDoc(shopDocRef);
    
    const tbody = document.getElementById('readonly-stock-body');
    tbody.innerHTML = '';
    
    if (shopDoc.exists()) {
        const closing = calculateClosingStock(shopDoc.data());
        productsData.forEach(product => {
            const row = tbody.insertRow();
            row.innerHTML = `
                <td>${product.name}</td>
                <td style="text-align: right; font-weight: bold;">${formatBags(closing[product.id] || 0)}</td>
            `;
        });
    } else {
        productsData.forEach(product => {
            const row = tbody.insertRow();
            row.innerHTML = `
                <td>${product.name}</td>
                <td style="text-align: right; font-weight: bold;">0</td>
            `;
        });
    }
}
function renderClosingStockTable(shop, date, openingStock, shopData, saved, editable) {
    const tbody = document.getElementById('closing-stock-body');
    const tfoot = document.getElementById('closing-stock-footer');
    tbody.innerHTML = '';
    tfoot.innerHTML = '';

    let totalClosing = 0;
    let totalSales = 0;

    productsData.forEach((product, idx) => {
        const opening = openingStock[product.id] || 0;
        const restocking = shopData ? calculateRestocking(shopData, product.id) : 0;
        const sold = shopData ? calculateSold(shopData, product.id) : 0;
        const transfersOut = shopData ? calculateTransfersOut(shopData, product.id) : 0;
        const creditorReleases = shopData ? calculateCreditorReleases(shopData, product.id) : 0;
        const closing = opening + restocking - sold - transfersOut - creditorReleases;
        const salesTotal = sold * product.sales;

        totalClosing += closing;
        totalSales += salesTotal;

        const row = tbody.insertRow();
        row.innerHTML = `
            <td style="text-align: center;">${idx + 1}</td>
            <td>${product.name}</td>
            <td style="text-align: right;">
                ${editable ? 
                    `<input type="number" step="0.1" min="0" value="${opening}" 
                     class="opening-stock-input" data-product="${product.id}" 
                     style="width: 80px; padding: 5px; border: 1px solid #ddd; border-radius: 3px; text-align: right;">` :
                    formatBags(opening)}
            </td>
            <td style="text-align: right;">${formatBags(restocking)}</td>
            <td style="text-align: right; font-weight: bold; color: #2e7d32;">${formatBags(closing)}</td>
            <td style="text-align: right;">${formatBags(sold)}</td>
            <td style="text-align: right;">KSh ${product.sales.toLocaleString()}</td>
            ${currentUserData.role !== 'attendant' ? 
                `<td style="text-align: right; font-weight: bold;">KSh ${salesTotal.toLocaleString()}</td>` : ''}
        `;
    });

    const footerRow = tfoot.insertRow();
    footerRow.innerHTML = `
        <td colspan="4" style="text-align: left;">TOTAL</td>
        <td style="text-align: right; font-weight: bold; color: #2e7d32;">${formatBags(totalClosing)}</td>
        <td colspan="${currentUserData.role !== 'attendant' ? 1 : 2}"></td>
        ${currentUserData.role !== 'attendant' ? 
            `<td style="text-align: right; font-weight: bold; color: #2e7d32;">KSh ${totalSales.toLocaleString()}</td>` : ''}
    `;

    if (editable) {
        window.currentOpeningStock = openingStock;
        document.querySelectorAll('.opening-stock-input').forEach(input => {
            input.addEventListener('input', (e) => {
                const productId = e.target.dataset.product;
                window.currentOpeningStock[productId] = parseFloat(e.target.value) || 0;
            });
        });
    }
}

function setupOpeningStockSave(shop, date, saved, isFirst) {
    const saveBtn = document.getElementById('save-opening-stock');
    const copyBtn = document.getElementById('copy-clipboard');

    if (!saved && isFirst) {
        saveBtn.style.display = 'inline-block';
        copyBtn.style.display = 'none';
        document.getElementById('transaction-forms').style.display = 'none';
        document.getElementById('recorded-transactions').style.display = 'none';
    } else if (saved) {
        saveBtn.style.display = 'none';
        copyBtn.style.display = 'inline-block';
        document.getElementById('first-entry-warning').style.display = 'none';
    } else {
        saveBtn.style.display = 'inline-block';
        copyBtn.style.display = 'none';
        document.getElementById('transaction-forms').style.display = 'none';
        document.getElementById('recorded-transactions').style.display = 'none';
        document.getElementById('first-entry-warning').style.display = 'none';
    }

    saveBtn.onclick = async () => {
        const openingStock = {};
        document.querySelectorAll('.opening-stock-input').forEach(input => {
            openingStock[input.dataset.product] = parseFloat(input.value) || 0;
        });

        try {
            await setDoc(doc(db, 'shops', shop, 'daily', date), { openingStock }, { merge: true });
            showToast('Opening stock saved successfully!', 'success');
            loadShopData(shop, date);
        } catch (error) {
            showToast('Error saving opening stock: ' + error.message, 'error');
        }
    };

    copyBtn.onclick = async () => {
        const shopDocRef = doc(db, 'shops', shop, 'daily', date);
        const shopDoc = await getDoc(shopDocRef);
        const closing = calculateClosingStock(shopDoc.data());
    
        let text = `Closing Stock as at ${formatDateDisplay(date)}\n\n`;
        let totalBags = 0;
    
        productsData.forEach(product => {
            const bags = closing[product.id] || 0;
            totalBags += bags;
            text += `${product.name} - ${formatBags(bags)} bags\n`;
        });
    
        text += `\nTotal bags - ${formatBags(totalBags)} bags`;
    
        navigator.clipboard.writeText(text);
        showToast('Copied to clipboard!', 'success');
    };
}
function renderRecordedTransactions(shopData, shop, date) {
    const container = document.getElementById('transactions-list');
    container.innerHTML = '';

    const sections = [
        { title: 'Regular Sales', collection: 'regularSales', data: shopData.regularSales, color: '#2e7d32' },
        { title: 'Credit Sales', collection: 'creditSales', data: shopData.creditSales, color: '#c62828' },
        { title: 'Restocking', collection: 'restocking', data: shopData.restocking, color: '#1976d2' },
        { title: 'Transfers In', collection: 'transfersIn', data: shopData.transfersIn, color: '#7b1fa2' },
        { title: 'Transfers Out', collection: 'transfersOut', data: shopData.transfersOut, color: '#d32f2f' },
        { title: 'Creditor Releases', collection: 'creditorReleases', data: shopData.creditorReleases, color: '#f57c00' },
        { title: 'Prepayments', collection: 'prepayments', data: shopData.prepayments, color: '#388e3c' },
        { title: 'Debt Payments', collection: 'debtPayments', data: shopData.debtPayments, color: '#0097a7' }
    ];

    const canDelete = currentUserData && currentUserData.role === 'manager_full';

    sections.forEach(section => {
        if (section.data && Object.keys(section.data).length > 0) {
            const div = document.createElement('div');
            div.style.marginBottom = '20px';
            
            const transactionItems = Object.entries(section.data).map(([key, val]) => {
                const product = productsData.find(p => p.id === val.feedType);
                const productName = product ? product.name : val.feedType;
                
                const transactionDetails = Object.entries(val).map(([k, v]) => {
                    if (k === 'timestamp') return ''; // Skip timestamp display
                    if (k === 'feedType') return `${k}: ${productName}`;
                    return `${k}: ${v}`;
                }).filter(Boolean).join(', ');
                
                const deleteBtn = canDelete ? 
                    `<button onclick="deleteTransaction('${shop}', '${date}', '${section.collection}', '${key}')" 
                     style="margin-left: 10px; padding: 5px 10px; background: #d32f2f; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 0.85em;">
                     ❌ Delete
                     </button>` : '';
                
                return `<div style="padding: 8px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center;">
                    <span>${transactionDetails}</span>
                    ${deleteBtn}
                </div>`;
            }).join('');
            
            div.innerHTML = `
                <h4 style="color: ${section.color}; margin-bottom: 10px;">${section.title}</h4>
                <div style="background: #f9f9f9; padding: 10px; border-radius: 5px;">
                    ${transactionItems}
                </div>
            `;
            container.appendChild(div);
        }
    });
}

async function deleteTransaction(shop, date, collection, transactionId) {
    // Double check permission
    if (currentUserData.role !== 'manager_full') {
        showToast('You do not have permission to delete transactions', 'error');
        return;
    }

    const confirmMsg = `Are you sure you want to delete this transaction?\n\nThis action cannot be undone and will update stock calculations.`;
    
    if (!confirm(confirmMsg)) {
        return;
    }

    try {
        const shopDocRef = doc(db, 'shops', shop, 'daily', date);
        const shopDoc = await getDoc(shopDocRef);
        
        if (!shopDoc.exists()) {
            showToast('Transaction not found', 'error');
            return;
        }

        const data = shopDoc.data();
        
        // Check if this is a transfer out - need to delete corresponding transfer in
        if (collection === 'transfersOut' && data.transfersOut && data.transfersOut[transactionId]) {
            const transferData = data.transfersOut[transactionId];
            const destinationShop = transferData.toShop;
            
            // Delete the corresponding transfer in from destination shop
            if (destinationShop) {
                const destShopRef = doc(db, 'shops', destinationShop, 'daily', date);
                const destShopDoc = await getDoc(destShopRef);
                
                if (destShopDoc.exists()) {
                    const destData = destShopDoc.data();
                    if (destData.transfersIn && destData.transfersIn[transactionId]) {
                        const updatedTransfersIn = { ...destData.transfersIn };
                        delete updatedTransfersIn[transactionId];
                        
                        await updateDoc(destShopRef, {
                            transfersIn: updatedTransfersIn
                        });
                    }
                }
            }
        }

        // Delete the transaction from current shop
        const updatedCollection = { ...data[collection] };
        delete updatedCollection[transactionId];
        
        await updateDoc(shopDocRef, {
            [collection]: updatedCollection
        });

        showToast('Transaction deleted successfully!', 'success');
        
        // Reload the shop data to refresh everything
        loadShopData(shop, date);
        
    } catch (error) {
        console.error('Error deleting transaction:', error);
        showToast('Error deleting transaction: ' + error.message, 'error');
    }
}

// Make deleteTransaction available globally
window.deleteTransaction = deleteTransaction;

function setupTransactionForms(shop) {
    const transactionButtons = document.querySelector('.transaction-buttons');
    transactionButtons.innerHTML = '';

    const forms = [
        { id: 'sale', label: 'Record a Sale', color: '#2e7d32' },
        { id: 'restock', label: 'Record Restocking', color: '#1976d2' },
        { id: 'transferIn', label: 'Transfers In', color: '#7b1fa2' },
        { id: 'transferOut', label: 'Transfers Out', color: '#d32f2f' },
        { id: 'creditorRelease', label: 'Feeds Released to Creditors', color: '#f57c00' },
        { id: 'creditSale', label: 'Sales Made on Credit', color: '#c62828' },
        { id: 'prepayment', label: 'Prepayments Made', color: '#388e3c' },
        { id: 'debtPayment', label: 'Payments Towards Debts', color: '#0097a7' }
    ];

    forms.forEach(form => {
        const btn = document.createElement('button');
        btn.className = 'transaction-btn';
        btn.textContent = form.label;
        btn.style.background = form.color;
        btn.addEventListener('click', () => showTransactionForm(form.id, shop));
        transactionButtons.appendChild(btn);
    });
}

async function saveTransaction(shop, date, collection, data) {
    try {
        const shopDocRef = doc(db, 'shops', shop, 'daily', date);
        const transactionId = Date.now().toString();
        const transactionData = { ...data, timestamp: new Date().toISOString() };
        
        console.log('Attempting to save transaction:', {
            shop,
            date,
            collection,
            data: transactionData
        });
        
        // Get existing document first
        const shopDoc = await getDoc(shopDocRef);
        const existingData = shopDoc.exists() ? shopDoc.data() : {};
        
        console.log('Existing data:', existingData);
        
        // Build the updated collection
        const existingCollection = existingData[collection] || {};
        const updatedCollection = {
            ...existingCollection,
            [transactionId]: transactionData
        };
        
        // Save with the new transaction
        await setDoc(shopDocRef, {
            ...existingData,
            [collection]: updatedCollection
        });
        
        console.log('Transaction saved successfully to Firestore');

        // Handle transfers out
        if (collection === 'transfersOut' && data.toShop) {
            const destShopRef = doc(db, 'shops', data.toShop, 'daily', date);
            const destShopDoc = await getDoc(destShopRef);
            const destData = destShopDoc.exists() ? destShopDoc.data() : {};
            
            const destTransfersIn = destData.transfersIn || {};
            await setDoc(destShopRef, {
                ...destData,
                transfersIn: {
                    ...destTransfersIn,
                    [transactionId]: {
                        feedType: data.feedType,
                        bags: data.bags,
                        fromShop: shop,
                        timestamp: new Date().toISOString()
                    }
                }
            });
        }

        showToast('Transaction saved successfully!', 'success');
        document.getElementById('form-container').innerHTML = '';
        loadShopData(shop, date);
    } catch (error) {
        console.error('Error saving transaction:', error);
        showToast('Error saving transaction: ' + error.message, 'error');
    }
}
function showTransactionForm(formId, shop) {
    const container = document.getElementById('form-container');
    
    if (formId === 'sale') {
        container.innerHTML = `
            <div class="form-box" style="border-color: #2e7d32;">
                <h4 style="color: #2e7d32;">Record a Sale</h4>
                <form id="transaction-form" class="form-grid">
                    <input type="text" class="form-input" id="form-client" placeholder="Client Name" required>
                    <select class="form-input" id="form-feed" required>
                        <option value="">Select Feed Type</option>
                        ${productsData.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
                    </select>
                    <input type="number" step="0.1" min="0.1" class="form-input" id="form-bags" placeholder="Number of Bags" required>
                    <input type="number" class="form-input" id="form-price" placeholder="Price" readonly style="background: #f5f5f5;">
                    <input type="number" min="0" class="form-input" id="form-discount" placeholder="Discount (KSh)" value="0" required>
                    <div class="form-buttons">
                        <button type="submit" class="btn-save" style="background: #2e7d32;">Save</button>
                        <button type="button" class="btn-cancel">Cancel</button>
                    </div>
                </form>
            </div>
        `;
        document.getElementById('form-feed').onchange = (e) => {
            const product = productsData.find(p => p.id === e.target.value);
            document.getElementById('form-price').value = product ? product.sales : '';
        };
        document.getElementById('transaction-form').onsubmit = async (e) => {
            e.preventDefault();
            await saveTransaction(shop, currentDate, 'regularSales', {
                clientName: document.getElementById('form-client').value,
                feedType: document.getElementById('form-feed').value,
                bags: document.getElementById('form-bags').value,
                price: document.getElementById('form-price').value,
                discount: document.getElementById('form-discount').value
            });
        };
    } else if (formId === 'restock') {
        container.innerHTML = `
            <div class="form-box" style="border-color: #1976d2;">
                <h4 style="color: #1976d2;">Record Restocking</h4>
                <form id="transaction-form" class="form-grid">
                    <select class="form-input" id="form-feed" required>
                        <option value="">Select Feed Type</option>
                        ${productsData.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
                    </select>
                    <input type="number" step="0.1" min="0.1" class="form-input" id="form-bags" placeholder="Number of Bags" required>
                    <input type="text" class="form-input" id="form-supplier" placeholder="Supplier Name (optional)">
                    <div class="form-buttons">
                        <button type="submit" class="btn-save" style="background: #1976d2;">Save</button>
                        <button type="button" class="btn-cancel">Cancel</button>
                    </div>
                </form>
            </div>
        `;
        document.getElementById('transaction-form').onsubmit = async (e) => {
            e.preventDefault();
            await saveTransaction(shop, currentDate, 'restocking', {
                feedType: document.getElementById('form-feed').value,
                bags: document.getElementById('form-bags').value,
                supplierName: document.getElementById('form-supplier').value
            });
        };
    } else if (formId === 'transferIn') {
        const otherShops = SHOPS.filter(s => s !== shop);
        container.innerHTML = `
            <div class="form-box" style="border-color: #7b1fa2;">
                <h4 style="color: #7b1fa2;">Transfers In</h4>
                <form id="transaction-form" class="form-grid">
                    <select class="form-input" id="form-feed" required>
                        <option value="">Select Feed Type</option>
                        ${productsData.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
                    </select>
                    <input type="number" step="0.1" min="0.1" class="form-input" id="form-bags" placeholder="Number of Bags" required>
                    <select class="form-input" id="form-from" required>
                        <option value="">From Shop</option>
                        ${otherShops.map(s => `<option value="${s}">${s}</option>`).join('')}
                    </select>
                    <div class="form-buttons">
                        <button type="submit" class="btn-save" style="background: #7b1fa2;">Save</button>
                        <button type="button" class="btn-cancel">Cancel</button>
                    </div>
                </form>
            </div>
        `;
        document.getElementById('transaction-form').onsubmit = async (e) => {
            e.preventDefault();
            await saveTransaction(shop, currentDate, 'transfersIn', {
                feedType: document.getElementById('form-feed').value,
                bags: document.getElementById('form-bags').value,
                fromShop: document.getElementById('form-from').value
            });
        };
    } else if (formId === 'transferOut') {
        const otherShops = SHOPS.filter(s => s !== shop);
        container.innerHTML = `
            <div class="form-box" style="border-color: #d32f2f;">
                <h4 style="color: #d32f2f;">Transfers Out</h4>
                <form id="transaction-form" class="form-grid">
                    <select class="form-input" id="form-feed" required>
                        <option value="">Select Feed Type</option>
                        ${productsData.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
                    </select>
                    <input type="number" step="0.1" min="0.1" class="form-input" id="form-bags" placeholder="Number of Bags" required>
                    <select class="form-input" id="form-to" required>
                        <option value="">To Shop</option>
                        ${otherShops.map(s => `<option value="${s}">${s}</option>`).join('')}
                    </select>
                    <div class="form-buttons">
                        <button type="submit" class="btn-save" style="background: #d32f2f;">Save</button>
                        <button type="button" class="btn-cancel">Cancel</button>
                    </div>
                </form>
            </div>
        `;
        document.getElementById('transaction-form').onsubmit = async (e) => {
            e.preventDefault();
            await saveTransaction(shop, currentDate, 'transfersOut', {
                feedType: document.getElementById('form-feed').value,
                bags: document.getElementById('form-bags').value,
                toShop: document.getElementById('form-to').value
            });
        };
    } else if (formId === 'creditSale') {
        container.innerHTML = `
            <div class="form-box" style="border-color: #c62828;">
                <h4 style="color: #c62828;">Sales Made on Credit</h4>
                <form id="transaction-form" class="form-grid">
                    <input type="text" class="form-input" id="form-debtor" placeholder="Debtor Name" required>
                    <select class="form-input" id="form-feed" required>
                        <option value="">Select Feed Type</option>
                        ${productsData.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
                    </select>
                    <input type="number" step="0.1" min="0.1" class="form-input" id="form-bags" placeholder="Number of Bags" required>
                    <input type="number" class="form-input" id="form-price" placeholder="Price" readonly style="background: #f5f5f5;">
                    <input type="number" min="0" class="form-input" id="form-discount" placeholder="Discount (KSh)" value="0" required>
                    <div class="form-buttons">
                        <button type="submit" class="btn-save" style="background: #c62828;">Save</button>
                        <button type="button" class="btn-cancel">Cancel</button>
                    </div>
                </form>
            </div>
        `;
        document.getElementById('form-feed').onchange = (e) => {
            const product = productsData.find(p => p.id === e.target.value);
            document.getElementById('form-price').value = product ? product.sales : '';
        };
        document.getElementById('transaction-form').onsubmit = async (e) => {
            e.preventDefault();
            await saveTransaction(shop, currentDate, 'creditSales', {
                debtorName: document.getElementById('form-debtor').value,
                feedType: document.getElementById('form-feed').value,
                bags: document.getElementById('form-bags').value,
                price: document.getElementById('form-price').value,
                discount: document.getElementById('form-discount').value
            });
        };
    } else if (formId === 'prepayment') {
        container.innerHTML = `
            <div class="form-box" style="border-color: #388e3c;">
                <h4 style="color: #388e3c;">Prepayments Made</h4>
                <form id="transaction-form" class="form-grid">
                    <input type="text" class="form-input" id="form-client" placeholder="Client Name" required>
                    <input type="number" min="0" class="form-input" id="form-amount" placeholder="Amount Paid (KSh)" required>
                    <div class="form-buttons">
                        <button type="submit" class="btn-save" style="background: #388e3c;">Save</button>
                        <button type="button" class="btn-cancel">Cancel</button>
                    </div>
                </form>
            </div>
        `;
        document.getElementById('transaction-form').onsubmit = async (e) => {
            e.preventDefault();
            await saveTransaction(shop, currentDate, 'prepayments', {
                clientName: document.getElementById('form-client').value,
                amountPaid: document.getElementById('form-amount').value
            });
        };
    } else if (formId === 'creditorRelease') {
        container.innerHTML = `
            <div class="form-box" style="border-color: #f57c00;">
                <h4 style="color: #f57c00;">Feeds Released to Creditors</h4>
                <p id="creditor-loading">Loading creditors...</p>
                <form id="transaction-form" class="form-grid" style="display: none;">
                    <select class="form-input" id="form-creditor" required>
                        <option value="">Select Creditor</option>
                    </select>
                    <select class="form-input" id="form-feed" required>
                        <option value="">Select Feed Type</option>
                        ${productsData.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
                    </select>
                    <input type="number" step="0.1" min="0.1" class="form-input" id="form-bags" placeholder="Number of Bags" required>
                    <input type="number" class="form-input" id="form-price" placeholder="Price" readonly style="background: #f5f5f5;">
                    <input type="number" min="0" class="form-input" id="form-discount" placeholder="Discount (KSh)" value="0" required>
                    <div class="form-buttons">
                        <button type="submit" class="btn-save" style="background: #f57c00;">Save</button>
                        <button type="button" class="btn-cancel">Cancel</button>
                    </div>
                </form>
            </div>
        `;
        loadCreditorsForRelease(shop);
    } else if (formId === 'debtPayment') {
        container.innerHTML = `
            <div class="form-box" style="border-color: #0097a7;">
                <h4 style="color: #0097a7;">Payments Towards Debts</h4>
                <p id="debtor-loading">Loading debtors...</p>
                <form id="transaction-form" class="form-grid" style="display: none;">
                    <select class="form-input" id="form-debtor" required>
                        <option value="">Select Debtor</option>
                    </select>
                    <input type="number" min="0" class="form-input" id="form-amount" placeholder="Amount Paid (KSh)" required>
                    <select class="form-input" id="form-method" required>
                        <option value="">Payment Method</option>
                        <option value="Cash">Cash</option>
                        <option value="M-Pesa">M-Pesa</option>
                        <option value="Bank">Bank</option>
                    </select>
                    <div class="form-buttons">
                        <button type="submit" class="btn-save" style="background: #0097a7;">Save</button>
                        <button type="button" class="btn-cancel">Cancel</button>
                    </div>
                </form>
            </div>
        `;
        loadDebtorsForPayment(shop);
    }
    
    document.querySelectorAll('.btn-cancel').forEach(btn => {
        btn.onclick = () => container.innerHTML = '';
    });
}

async function loadCreditorsForRelease(shop) {
    const creditors = new Set();
    const shopQuery = query(collection(db, 'shops', shop, 'daily'));
    const snapshot = await getDocs(shopQuery);
    
    snapshot.forEach(doc => {
        const data = doc.data();
        if (data.prepayments) {
            Object.values(data.prepayments).forEach(p => {
                creditors.add(p.clientName);
            });
        }
    });

    const creditorSelect = document.getElementById('form-creditor');
    const form = document.getElementById('transaction-form');
    const loading = document.getElementById('creditor-loading');

    if (creditors.size === 0) {
        loading.textContent = 'No creditors available. Record prepayments first.';
        loading.style.color = '#856404';
        loading.style.background = '#fff3cd';
        loading.style.padding = '10px';
        loading.style.borderRadius = '5px';
    } else {
        creditors.forEach(c => {
            const option = document.createElement('option');
            option.value = c;
            option.textContent = c;
            creditorSelect.appendChild(option);
        });
        loading.style.display = 'none';
        form.style.display = 'grid';
        
        // Auto-fill price when feed type is selected
        document.getElementById('form-feed').onchange = (e) => {
            const product = productsData.find(p => p.id === e.target.value);
            document.getElementById('form-price').value = product ? product.sales : '';
        };
        
        form.onsubmit = async (e) => {
            e.preventDefault();
            await saveTransaction(shop, currentDate, 'creditorReleases', {
                creditorName: document.getElementById('form-creditor').value,
                feedType: document.getElementById('form-feed').value,
                bags: document.getElementById('form-bags').value,
                price: document.getElementById('form-price').value,
                discount: document.getElementById('form-discount').value
            });
        };
    }
}

async function loadDebtorsForPayment(shop) {
    const debtors = new Set();
    const shopQuery = query(collection(db, 'shops', shop, 'daily'));
    const snapshot = await getDocs(shopQuery);
    
    snapshot.forEach(doc => {
        const data = doc.data();
        if (data.creditSales) {
            Object.values(data.creditSales).forEach(s => {
                debtors.add(s.debtorName);
            });
        }
    });

    const debtorSelect = document.getElementById('form-debtor');
    const form = document.getElementById('transaction-form');
    const loading = document.getElementById('debtor-loading');

    if (debtors.size === 0) {
        loading.textContent = 'No debtors available. Record credit sales first.';
        loading.style.color = '#856404';
        loading.style.background = '#fff3cd';
        loading.style.padding = '10px';
        loading.style.borderRadius = '5px';
    } else {
        debtors.forEach(d => {
            const option = document.createElement('option');
            option.value = d;
            option.textContent = d;
            debtorSelect.appendChild(option);
        });
        loading.style.display = 'none';
        form.style.display = 'grid';
        
        form.onsubmit = async (e) => {
            e.preventDefault();
            await saveTransaction(shop, currentDate, 'debtPayments', {
                debtorName: document.getElementById('form-debtor').value,
                amountPaid: document.getElementById('form-amount').value,
                paymentMethod: document.getElementById('form-method').value
            });
        };
    }
}
async function loadTotalSalesView() {
    showView('total-sales-view');
    const dateSelector = document.getElementById('total-sales-date');
    dateSelector.value = dateToISO(currentDate);
    dateSelector.onchange = (e) => {
        currentDate = isoToDate(e.target.value);
        loadTotalSalesData(currentDate);
    };
    await loadTotalSalesData(currentDate);
}

async function loadTotalSalesData(date) {
    const tbody = document.getElementById('total-sales-body');
    const tfoot = document.getElementById('total-sales-footer');
    tbody.innerHTML = '';
    tfoot.innerHTML = '';

    let totalBagsRemaining = 0;
    let totalBagsSold = 0;
    let totalSalesAmount = 0;

    for (const shop of SHOPS) {
        const shopDocRef = doc(db, 'shops', shop, 'daily', date);
        const shopDoc = await getDoc(shopDocRef);

        if (shopDoc.exists()) {
            const data = shopDoc.data();
            const closing = calculateClosingStock(data);
            const bagsRemaining = Object.values(closing).reduce((a, b) => a + b, 0);
            
            let bagsSold = 0;
            let salesAmount = 0;
            
            productsData.forEach(product => {
                const sold = calculateSold(data, product.id);
                bagsSold += sold;
                salesAmount += sold * product.sales;
            });

            totalBagsRemaining += bagsRemaining;
            totalBagsSold += bagsSold;
            totalSalesAmount += salesAmount;

            const row = tbody.insertRow();
            row.innerHTML = `
                <td>${shop}</td>
                <td style="text-align: right;">${bagsRemaining.toFixed(1)}</td>
                <td style="text-align: right;">${bagsSold.toFixed(1)}</td>
                <td style="text-align: right; font-weight: bold;">KSh ${salesAmount.toLocaleString()}</td>
            `;
        }
    }

    const footerRow = tfoot.insertRow();
    footerRow.innerHTML = `
        <td style="font-weight: bold;">TOTAL</td>
        <td style="text-align: right; font-weight: bold; color: #2e7d32;">${totalBagsRemaining.toFixed(1)}</td>
        <td style="text-align: right; font-weight: bold; color: #2e7d32;">${totalBagsSold.toFixed(1)}</td>
        <td style="text-align: right; font-weight: bold; color: #2e7d32;">KSh ${totalSalesAmount.toLocaleString()}</td>
    `;
}

async function loadDebtorsView() {
    showView('debtors-view');
    
    // Wait for DOM to update
    await new Promise(resolve => setTimeout(resolve, 0));
    
    const tbody = document.getElementById('debtors-body');
    const tfoot = document.getElementById('debtors-footer');
    const summaryTbody = document.getElementById('debtors-summary-body');
    const summaryTfoot = document.getElementById('debtors-summary-footer');
    
    // Add safety checks
    if (!tbody || !tfoot || !summaryTbody || !summaryTfoot) {
        console.error('Debtors view elements not found:', {
            tbody: !!tbody,
            tfoot: !!tfoot,
            summaryTbody: !!summaryTbody,
            summaryTfoot: !!summaryTfoot
        });
        showToast('Error loading debtors view', 'error');
        return;
    }
    
    tbody.innerHTML = '';
    tfoot.innerHTML = '';
    summaryTbody.innerHTML = '';
    summaryTfoot.innerHTML = '';

    let totalAmount = 0;
    const debtorBalances = {}; // Track per debtor: { name: { owed, paid } }

    // Collect all credit sales
    for (const shop of SHOPS) {
        const shopQuery = query(collection(db, 'shops', shop, 'daily'));
        const snapshot = await getDocs(shopQuery);

        snapshot.forEach(docSnapshot => {
            const data = docSnapshot.data();
            const date = docSnapshot.id;
            
            if (data.creditSales) {
                Object.values(data.creditSales).forEach(sale => {
                    const product = productsData.find(p => p.id === sale.feedType);
                    const amount = (parseFloat(sale.bags) * parseFloat(sale.price)) - parseFloat(sale.discount || 0);
                    totalAmount += amount;

                    // Track debtor balance
                    if (!debtorBalances[sale.debtorName]) {
                        debtorBalances[sale.debtorName] = { owed: 0, paid: 0 };
                    }
                    debtorBalances[sale.debtorName].owed += amount;

                    const row = tbody.insertRow();
                    row.innerHTML = `
                        <td>${sale.debtorName}</td>
                        <td>${product ? product.name : sale.feedType}</td>
                        <td style="text-align: right;">${formatBags(parseFloat(sale.bags))}</td>
                        <td style="text-align: right;">KSh ${parseFloat(sale.price).toLocaleString()}</td>
                        <td style="text-align: right; font-weight: bold;">KSh ${amount.toLocaleString()}</td>
                        <td>${shop}</td>
                        <td>${formatDateDisplay(date)}</td>
                    `;
                });
            }
        });
    }

    // Collect all debt payments
    for (const shop of SHOPS) {
        const shopQuery = query(collection(db, 'shops', shop, 'daily'));
        const snapshot = await getDocs(shopQuery);

        snapshot.forEach(docSnapshot => {
            const data = docSnapshot.data();
            
            if (data.debtPayments) {
                Object.values(data.debtPayments).forEach(payment => {
                    const debtorName = payment.debtorName;
                    const amountPaid = parseFloat(payment.amountPaid);
                    
                    if (debtorBalances[debtorName]) {
                        debtorBalances[debtorName].paid += amountPaid;
                    }
                });
            }
        });
    }

    // Render detailed transactions footer
    const footerRow = tfoot.insertRow();
    footerRow.innerHTML = `
        <td colspan="4" style="text-align: left; font-weight: bold;">TOTAL</td>
        <td style="text-align: right; font-weight: bold; color: #d32f2f;">KSh ${totalAmount.toLocaleString()}</td>
        <td colspan="2"></td>
    `;

    // Render summary table
    let totalOwed = 0;
    let totalPaid = 0;
    let totalBalance = 0;

    Object.entries(debtorBalances).forEach(([name, data]) => {
        const balance = data.owed - data.paid;
        
        // Only show if there's an outstanding balance
        if (balance > 0) {
            totalOwed += data.owed;
            totalPaid += data.paid;
            totalBalance += balance;

            const row = summaryTbody.insertRow();
            row.innerHTML = `
                <td style="font-weight: bold;">${name}</td>
                <td style="text-align: right;">KSh ${data.owed.toLocaleString()}</td>
                <td style="text-align: right; color: #2e7d32;">KSh ${data.paid.toLocaleString()}</td>
                <td style="text-align: right; font-weight: bold; color: #d32f2f;">KSh ${balance.toLocaleString()}</td>
            `;
        }
    });

    // Summary footer
    const summaryFooterRow = summaryTfoot.insertRow();
    summaryFooterRow.innerHTML = `
        <td style="font-weight: bold;">TOTAL</td>
        <td style="text-align: right; font-weight: bold;">KSh ${totalOwed.toLocaleString()}</td>
        <td style="text-align: right; font-weight: bold; color: #2e7d32;">KSh ${totalPaid.toLocaleString()}</td>
        <td style="text-align: right; font-weight: bold; color: #d32f2f; font-size: 1.1em;">KSh ${totalBalance.toLocaleString()}</td>
    `;

    // Store total balance globally for Stock Value calculation
    window.totalDebtorsBalance = totalBalance;
}

async function loadCreditorsView() {
    showView('creditors-view');
    
    // Wait for DOM to update
    await new Promise(resolve => setTimeout(resolve, 0));
    
    const tbody = document.getElementById('creditors-body');
    const tfoot = document.getElementById('creditors-footer');
    const summaryTbody = document.getElementById('creditors-summary-body');
    const summaryTfoot = document.getElementById('creditors-summary-footer');
    
    // Add safety checks
    if (!tbody || !tfoot || !summaryTbody || !summaryTfoot) {
        console.error('Creditors view elements not found');
        showToast('Error loading creditors view', 'error');
        return;
    }
    
    tbody.innerHTML = '';
    tfoot.innerHTML = '';
    summaryTbody.innerHTML = '';
    summaryTfoot.innerHTML = '';

    let totalAmount = 0;
    const creditorBalances = {}; // Track: { name: { prepaid, feedsTaken, balance } }

    // Collect all prepayments
    for (const shop of SHOPS) {
        const shopQuery = query(collection(db, 'shops', shop, 'daily'));
        const snapshot = await getDocs(shopQuery);

        snapshot.forEach(docSnapshot => {
            const data = docSnapshot.data();
            const date = docSnapshot.id;
            
            if (data.prepayments) {
                Object.values(data.prepayments).forEach(payment => {
                    const amount = parseFloat(payment.amountPaid);
                    totalAmount += amount;

                    // Track creditor balance
                    if (!creditorBalances[payment.clientName]) {
                        creditorBalances[payment.clientName] = { prepaid: 0, feedsTaken: 0, feedsAmount: 0 };
                    }
                    creditorBalances[payment.clientName].prepaid += amount;

                    const row = tbody.insertRow();
                    row.innerHTML = `
                        <td>${payment.clientName}</td>
                        <td style="text-align: right; font-weight: bold;">KSh ${amount.toLocaleString()}</td>
                        <td>${shop}</td>
                        <td>${formatDateDisplay(date)}</td>
                    `;
                });
            }
        });
    }

    // Collect all creditor releases (feeds taken)
    for (const shop of SHOPS) {
        const shopQuery = query(collection(db, 'shops', shop, 'daily'));
        const snapshot = await getDocs(shopQuery);

        snapshot.forEach(docSnapshot => {
            const data = docSnapshot.data();
            
            if (data.creditorReleases) {
                Object.values(data.creditorReleases).forEach(release => {
                    const creditorName = release.creditorName;
                    const bags = parseFloat(release.bags);
                    const product = productsData.find(p => p.id === release.feedType);
                    const amount = product ? bags * product.sales : 0;
                    
                    if (creditorBalances[creditorName]) {
                        creditorBalances[creditorName].feedsTaken += bags;
                        creditorBalances[creditorName].feedsAmount += amount;
                    }
                });
            }
        });
    }

    // Render prepayments footer
    const footerRow = tfoot.insertRow();
    footerRow.innerHTML = `
        <td style="font-weight: bold;">TOTAL</td>
        <td style="text-align: right; font-weight: bold; color: #f57c00;">KSh ${totalAmount.toLocaleString()}</td>
        <td colspan="2"></td>
    `;

    // Render summary table
    let totalFeedsTaken = 0;
    let totalFeedsAmount = 0;
    let totalBalance = 0;

    Object.entries(creditorBalances).forEach(([name, data]) => {
        const balance = data.prepaid - data.feedsAmount;
        
        // Only show if there's a balance (positive or negative)
        if (balance !== 0) {
            totalFeedsTaken += data.feedsTaken;
            totalFeedsAmount += data.feedsAmount;
            totalBalance += balance;

            const row = summaryTbody.insertRow();
            row.innerHTML = `
                <td style="font-weight: bold;">${name}</td>
                <td style="text-align: right;">${data.feedsTaken.toFixed(1)} bags</td>
                <td style="text-align: right;">KSh ${data.feedsAmount.toLocaleString()}</td>
                <td style="text-align: right; font-weight: bold; color: ${balance > 0 ? '#2e7d32' : '#d32f2f'};">KSh ${balance.toLocaleString()}</td>
            `;
        }
    });

    // Summary footer
    const summaryFooterRow = summaryTfoot.insertRow();
    summaryFooterRow.innerHTML = `
        <td style="font-weight: bold;">TOTAL</td>
        <td style="text-align: right; font-weight: bold;">${totalFeedsTaken.toFixed(1)} bags</td>
        <td style="text-align: right; font-weight: bold;">KSh ${totalFeedsAmount.toLocaleString()}</td>
        <td style="text-align: right; font-weight: bold; color: #f57c00; font-size: 1.1em;">KSh ${totalBalance.toLocaleString()}</td>
    `;

    // Store total creditor balance globally for Stock Value calculation
    window.totalCreditorsBalance = totalBalance;
}
async function loadStockValueView() {
    showView('stock-value-view');
    const dateSelector = document.getElementById('stock-value-date');
    dateSelector.value = dateToISO(currentDate);
    dateSelector.onchange = (e) => {
        currentDate = isoToDate(e.target.value);
        loadStockValueData(currentDate);
    };
    await loadStockValueData(currentDate);
}

async function loadStockValueData(date) {
    let debtorsValue = 0;
    let shopsValue = 0;
    let creditorsValue = 0;

    // Calculate shops stock value at SELLING PRICE
    for (const shop of SHOPS) {
        const shopDocRef = doc(db, 'shops', shop, 'daily', date);
        const shopDoc = await getDoc(shopDocRef);

        if (shopDoc.exists()) {
            const data = shopDoc.data();
            const closing = calculateClosingStock(data);
            
            productsData.forEach(product => {
                const bags = closing[product.id] || 0;
                shopsValue += bags * product.sales; // CHANGED: Using SELLING PRICE
            });
        }
    }

    // Calculate debtors balance (actual outstanding, not total owed)
    const debtorBalances = {};

    // Collect all credit sales
    for (const shop of SHOPS) {
        const shopQuery = query(collection(db, 'shops', shop, 'daily'));
        const snapshot = await getDocs(shopQuery);

        snapshot.forEach(docSnapshot => {
            const data = docSnapshot.data();
            
            if (data.creditSales) {
                Object.values(data.creditSales).forEach(sale => {
                    const amount = (parseFloat(sale.bags) * parseFloat(sale.price)) - parseFloat(sale.discount || 0);
                    
                    if (!debtorBalances[sale.debtorName]) {
                        debtorBalances[sale.debtorName] = { owed: 0, paid: 0 };
                    }
                    debtorBalances[sale.debtorName].owed += amount;
                });
            }
        });
    }

    // Collect all debt payments
    for (const shop of SHOPS) {
        const shopQuery = query(collection(db, 'shops', shop, 'daily'));
        const snapshot = await getDocs(shopQuery);

        snapshot.forEach(docSnapshot => {
            const data = docSnapshot.data();
            
            if (data.debtPayments) {
                Object.values(data.debtPayments).forEach(payment => {
                    const debtorName = payment.debtorName;
                    const amountPaid = parseFloat(payment.amountPaid);
                    
                    if (debtorBalances[debtorName]) {
                        debtorBalances[debtorName].paid += amountPaid;
                    }
                });
            }
        });
    }

    // Calculate total outstanding debtors balance
    Object.values(debtorBalances).forEach(data => {
        const balance = data.owed - data.paid;
        if (balance > 0) {
            debtorsValue += balance;
        }
    });

    // Calculate creditors balance (prepayments minus feeds taken at SELLING PRICE)
    const creditorBalances = {};

    // Collect all prepayments
    for (const shop of SHOPS) {
        const shopQuery = query(collection(db, 'shops', shop, 'daily'));
        const snapshot = await getDocs(shopQuery);

        snapshot.forEach(docSnapshot => {
            const data = docSnapshot.data();
            
            if (data.prepayments) {
                Object.values(data.prepayments).forEach(payment => {
                    if (!creditorBalances[payment.clientName]) {
                        creditorBalances[payment.clientName] = { prepaid: 0, feedsTaken: 0 };
                    }
                    creditorBalances[payment.clientName].prepaid += parseFloat(payment.amountPaid);
                });
            }
        });
    }

    // Collect all creditor releases (feeds taken at SELLING PRICE)
    for (const shop of SHOPS) {
        const shopQuery = query(collection(db, 'shops', shop, 'daily'));
        const snapshot = await getDocs(shopQuery);

        snapshot.forEach(docSnapshot => {
            const data = docSnapshot.data();
            
            if (data.creditorReleases) {
                Object.values(data.creditorReleases).forEach(release => {
                    const creditorName = release.creditorName;
                    const bags = parseFloat(release.bags);
                    const product = productsData.find(p => p.id === release.feedType);
                    
                    // Use price from transaction if available, otherwise use product selling price
                    const price = release.price ? parseFloat(release.price) : (product ? product.sales : 0);
                    const discount = parseFloat(release.discount || 0);
                    const amount = (bags * price) - discount; // SELLING PRICE with discount
                    
                    if (creditorBalances[creditorName]) {
                        creditorBalances[creditorName].feedsTaken += amount;
                    }
                });
            }
        });
    }

    // Calculate total creditors balance
    Object.values(creditorBalances).forEach(data => {
        const balance = data.prepaid - data.feedsTaken;
        if (balance !== 0) {
            creditorsValue += balance;
        }
    });

    const netValue = shopsValue + debtorsValue - creditorsValue;

    document.getElementById('debtors-value').textContent = `KSh ${debtorsValue.toLocaleString()}`;
    document.getElementById('shops-value').textContent = `KSh ${shopsValue.toLocaleString()}`;
    document.getElementById('creditors-value').textContent = `KSh ${creditorsValue.toLocaleString()}`;
    document.getElementById('net-value').textContent = `KSh ${netValue.toLocaleString()}`;
    document.getElementById('formula-text').innerHTML = `
        Net Stock Value = Stock in Shops (at Selling Price) + Debtors - Creditors<br>
        Net Stock Value = ${shopsValue.toLocaleString()} + ${debtorsValue.toLocaleString()} - ${creditorsValue.toLocaleString()}
    `;
}

async function loadProductsView() {
    showView('products-view');
    const tbody = document.getElementById('products-body');
    tbody.innerHTML = '';

    productsData.forEach(product => {
        const row = tbody.insertRow();
        row.innerHTML = `
            <td>${product.name}</td>
            <td><input type="number" min="0" class="form-input product-cost" data-id="${product.id}" value="${product.cost}" ${currentUserData.role === 'manager_view' ? '' : ''}></td>
            <td><input type="number" min="0" class="form-input product-sales" data-id="${product.id}" value="${product.sales}"></td>
        `;
    });

    document.getElementById('save-prices').onclick = async () => {
        const updates = {};
        document.querySelectorAll('.product-cost').forEach(input => {
            const id = input.dataset.id;
            const product = productsData.find(p => p.id === id);
            product.cost = parseFloat(input.value) || 0;
        });
        document.querySelectorAll('.product-sales').forEach(input => {
            const id = input.dataset.id;
            const product = productsData.find(p => p.id === id);
            product.sales = parseFloat(input.value) || 0;
        });
        
        try {
            await setDoc(doc(db, 'settings', 'products'), { products: productsData });
            showToast('Prices updated successfully!', 'success');
        } catch (error) {
            showToast('Error updating prices: ' + error.message, 'error');
        }
    };
}

async function loadAllClientsView() {
    showView('all-clients-view');
    
    const shopFilter = document.getElementById('client-shop-filter');
    shopFilter.innerHTML = '<option value="">All Shops</option>';
    SHOPS.forEach(shop => {
        const option = document.createElement('option');
        option.value = shop;
        option.textContent = shop;
        shopFilter.appendChild(option);
    });

    const dateFilter = document.getElementById('client-date-filter');
    dateFilter.value = dateToISO(currentDate);

    const loadClients = async () => {
        const tbody = document.getElementById('all-clients-body');
        tbody.innerHTML = '';

        const selectedShop = shopFilter.value;
        const selectedDate = isoToDate(dateFilter.value);
        const shopsToQuery = selectedShop ? [selectedShop] : SHOPS;

        for (const shop of shopsToQuery) {
            if (selectedDate) {
                const shopDocRef = doc(db, 'shops', shop, 'daily', selectedDate);
                const shopDoc = await getDoc(shopDocRef);
                
                if (shopDoc.exists()) {
                    const data = shopDoc.data();
                    if (data.regularSales) {
                        Object.values(data.regularSales).forEach(sale => {
                            const product = productsData.find(p => p.id === sale.feedType);
                            const amount = (parseFloat(sale.bags) * parseFloat(sale.price)) - parseFloat(sale.discount || 0);
                            
                            const row = tbody.insertRow();
                            row.innerHTML = `
                                <td>${sale.clientName}</td>
                                <td>${product ? product.name : sale.feedType}</td>
                                <td style="text-align: right;">${parseFloat(sale.bags).toFixed(1)}</td>
                                <td style="text-align: right; font-weight: bold;">KSh ${amount.toLocaleString()}</td>
                                <td>${shop}</td>
                                <td>${formatDateDisplay(selectedDate)}</td>
                            `;
                        });
                    }
                }
            }
        }
    };

    shopFilter.onchange = loadClients;
    dateFilter.onchange = loadClients;
    await loadClients();
}
// Analytics View
async function loadAnalyticsView() {
    showView('analytics-view');
    
    const rangeSelector = document.getElementById('analytics-range');
    rangeSelector.onchange = () => loadAnalyticsData(parseInt(rangeSelector.value));
    
    await loadAnalyticsData(30); // Default to 30 days
}

async function loadAnalyticsData(days) {
    showToast('Loading analytics...', 'success');
    
    // Get date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    // Collect all data
    const salesByDate = {};
    const salesByShop = {};
    const salesByProduct = {};
    const debtorsData = [];
    let totalRevenue = 0;
    let totalProfit = 0;
    let totalDebts = 0;
    
    SHOPS.forEach(shop => {
        salesByShop[shop] = 0;
    });
    
    productsData.forEach(product => {
        salesByProduct[product.id] = {
            name: product.name,
            quantity: 0,
            revenue: 0,
            cost: product.cost,
            sales: product.sales,
            profit: 0
        };
    });
    
    // Loop through all shops and dates
    for (const shop of SHOPS) {
        const shopQuery = query(collection(db, 'shops', shop, 'daily'));
        const snapshot = await getDocs(shopQuery);
        
        snapshot.forEach(docSnapshot => {
            const dateStr = docSnapshot.id;
            const [day, month, year] = dateStr.split('-').map(Number);
            const docDate = new Date(year, month - 1, day);
            
            // Only include data within range
            if (docDate >= startDate && docDate <= endDate) {
                const data = docSnapshot.data();
                
                // Initialize date in salesByDate
                if (!salesByDate[dateStr]) {
                    salesByDate[dateStr] = 0;
                }
                
                // Calculate sales
                productsData.forEach(product => {
                    const sold = calculateSold(data, product.id);
                    const revenue = sold * product.sales;
                    const profit = sold * (product.sales - product.cost);
                    
                    salesByDate[dateStr] += revenue;
                    salesByShop[shop] += revenue;
                    salesByProduct[product.id].quantity += sold;
                    salesByProduct[product.id].revenue += revenue;
                    salesByProduct[product.id].profit += profit;
                    
                    totalRevenue += revenue;
                    totalProfit += profit;
                });
                
                // Collect debtors data
                if (data.creditSales) {
                    Object.values(data.creditSales).forEach(sale => {
                        const amount = (parseFloat(sale.bags) * parseFloat(sale.price)) - parseFloat(sale.discount || 0);
                        const daysOutstanding = Math.floor((new Date() - docDate) / (1000 * 60 * 60 * 24));
                        
                        totalDebts += amount;
                        
                        debtorsData.push({
                            client: sale.debtorName,
                            amount: amount,
                            days: daysOutstanding,
                            shop: shop,
                            date: docDate
                        });
                    });
                }
            }
        });
    }
    
    // Render all charts and tables
    renderSalesTrendChart(salesByDate);
    renderShopComparisonChart(salesByShop);
    renderProductPerformanceChart(salesByProduct);
    renderProfitMarginsTable(salesByProduct);
    renderFinancialOverview(totalRevenue, totalProfit, totalDebts);
    renderRevenueTrendChart(salesByDate);
    renderDebtorsAgingReport(debtorsData);
    
    showToast('Analytics loaded successfully!', 'success');
}

function renderSalesTrendChart(salesByDate) {
    const ctx = document.getElementById('sales-trend-chart');
    
    // Sort dates
    const sortedDates = Object.keys(salesByDate).sort((a, b) => {
        const [dayA, monthA, yearA] = a.split('-').map(Number);
        const [dayB, monthB, yearB] = b.split('-').map(Number);
        return new Date(yearA, monthA - 1, dayA) - new Date(yearB, monthB - 1, dayB);
    });
    
    const labels = sortedDates.map(date => formatDateDisplay(date));
    const data = sortedDates.map(date => salesByDate[date]);
    
    // Destroy existing chart if it exists
    if (window.salesTrendChart) {
        window.salesTrendChart.destroy();
    }
    
    window.salesTrendChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Daily Sales (KSh)',
                data: data,
                borderColor: '#2e7d32',
                backgroundColor: 'rgba(46, 125, 50, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return 'Sales: KSh ' + context.parsed.y.toLocaleString();
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return 'KSh ' + value.toLocaleString();
                        }
                    }
                }
            }
        }
    });
}

function renderShopComparisonChart(salesByShop) {
    const ctx = document.getElementById('shop-comparison-chart');
    
    const labels = Object.keys(salesByShop);
    const data = Object.values(salesByShop);
    
    const colors = [
        '#2e7d32', '#1976d2', '#d32f2f', '#f57c00', 
        '#7b1fa2', '#0097a7', '#388e3c'
    ];
    
    if (window.shopComparisonChart) {
        window.shopComparisonChart.destroy();
    }
    
    window.shopComparisonChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Total Sales (KSh)',
                data: data,
                backgroundColor: colors,
                borderColor: colors.map(c => c),
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return 'Sales: KSh ' + context.parsed.y.toLocaleString();
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return 'KSh ' + value.toLocaleString();
                        }
                    }
                }
            }
        }
    });
}

function renderProductPerformanceChart(salesByProduct) {
    const ctx = document.getElementById('product-performance-chart');
    
    const labels = [];
    const quantities = [];
    
    Object.values(salesByProduct).forEach(product => {
        if (product.quantity > 0) {
            labels.push(product.name);
            quantities.push(product.quantity);
        }
    });
    
    if (window.productPerformanceChart) {
        window.productPerformanceChart.destroy();
    }
    
    window.productPerformanceChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Total Bags Sold',
                data: quantities,
                backgroundColor: '#1976d2',
                borderColor: '#1565c0',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            indexAxis: 'y',
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return 'Bags Sold: ' + context.parsed.x.toFixed(1);
                        }
                    }
                }
            },
            scales: {
                x: {
                    beginAtZero: true
                }
            }
        }
    });
}

function renderProfitMarginsTable(salesByProduct) {
    const tbody = document.getElementById('profit-margins-body');
    const tfoot = document.getElementById('profit-margins-footer');
    tbody.innerHTML = '';
    tfoot.innerHTML = '';
    
    let grandTotalProfit = 0;
    let grandTotalBags = 0;
    
    Object.values(salesByProduct).forEach(product => {
        if (product.quantity > 0) {
            const profitPerBag = product.sales - product.cost;
            const profitMargin = ((profitPerBag / product.sales) * 100).toFixed(1);
            
            grandTotalProfit += product.profit;
            grandTotalBags += product.quantity;
            
            const row = tbody.insertRow();
            row.innerHTML = `
                <td>${product.name}</td>
                <td style="text-align: right;">KSh ${product.cost.toLocaleString()}</td>
                <td style="text-align: right;">KSh ${product.sales.toLocaleString()}</td>
                <td style="text-align: right; color: #2e7d32; font-weight: bold;">KSh ${profitPerBag.toLocaleString()}</td>
                <td style="text-align: right; font-weight: bold;">${profitMargin}%</td>
                <td style="text-align: right;">${product.quantity.toFixed(1)}</td>
                <td style="text-align: right; color: #2e7d32; font-weight: bold;">KSh ${product.profit.toLocaleString()}</td>
            `;
        }
    });
    
    const footerRow = tfoot.insertRow();
    footerRow.innerHTML = `
        <td colspan="5" style="text-align: left; font-weight: bold;">TOTAL</td>
        <td style="text-align: right; font-weight: bold;">${grandTotalBags.toFixed(1)}</td>
        <td style="text-align: right; font-weight: bold; color: #2e7d32;">KSh ${grandTotalProfit.toLocaleString()}</td>
    `;
}

function renderFinancialOverview(revenue, profit, debts) {
    document.getElementById('total-revenue').textContent = `KSh ${revenue.toLocaleString()}`;
    document.getElementById('total-profit').textContent = `KSh ${profit.toLocaleString()}`;
    document.getElementById('outstanding-debts').textContent = `KSh ${debts.toLocaleString()}`;
}

function renderRevenueTrendChart(salesByDate) {
    const ctx = document.getElementById('revenue-trend-chart');
    
    const sortedDates = Object.keys(salesByDate).sort((a, b) => {
        const [dayA, monthA, yearA] = a.split('-').map(Number);
        const [dayB, monthB, yearB] = b.split('-').map(Number);
        return new Date(yearA, monthA - 1, dayA) - new Date(yearB, monthB - 1, dayB);
    });
    
    const labels = sortedDates.map(date => {
        const [day, month] = date.split('-');
        return `${day}/${month}`;
    });
    const data = sortedDates.map(date => salesByDate[date]);
    
    if (window.revenueTrendChart) {
        window.revenueTrendChart.destroy();
    }
    
    window.revenueTrendChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Revenue Trend (KSh)',
                data: data,
                borderColor: '#7b1fa2',
                backgroundColor: 'rgba(123, 31, 162, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: true
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return 'KSh ' + value.toLocaleString();
                        }
                    }
                }
            }
        }
    });
}

function renderDebtorsAgingReport(debtorsData) {
    const tbody = document.getElementById('debtors-aging-body');
    tbody.innerHTML = '';
    
    // Sort by days outstanding (oldest first)
    debtorsData.sort((a, b) => b.days - a.days);
    
    // Group by client
    const clientDebts = {};
    debtorsData.forEach(debt => {
        if (!clientDebts[debt.client]) {
            clientDebts[debt.client] = {
                amount: 0,
                oldestDays: 0,
                shop: debt.shop
            };
        }
        clientDebts[debt.client].amount += debt.amount;
        if (debt.days > clientDebts[debt.client].oldestDays) {
            clientDebts[debt.client].oldestDays = debt.days;
        }
    });
    
    Object.entries(clientDebts).forEach(([client, data]) => {
        const row = tbody.insertRow();
        
        let status = 'current';
        let statusText = 'Current';
        let statusClass = 'status-current';
        
        if (data.oldestDays > 60) {
            status = 'overdue';
            statusText = 'Overdue';
            statusClass = 'status-overdue';
        } else if (data.oldestDays > 30) {
            status = 'warning';
            statusText = 'Warning';
            statusClass = 'status-warning';
        }
        
        row.innerHTML = `
            <td>${client}</td>
            <td style="text-align: right; font-weight: bold;">KSh ${data.amount.toLocaleString()}</td>
            <td style="text-align: right;">${data.oldestDays} days</td>
            <td><span class="status-badge ${statusClass}">${statusText}</span></td>
            <td>${data.shop}</td>
        `;
    });
    
    if (Object.keys(clientDebts).length === 0) {
        const row = tbody.insertRow();
        row.innerHTML = '<td colspan="5" style="text-align: center; color: #666;">No outstanding debts</td>';
    }
}
// Shop Comparison View
async function loadShopComparisonView() {
    showView('shop-comparison-view');
    
    const periodSelector = document.getElementById('comparison-period');
    periodSelector.onchange = () => loadShopComparisonData(parseInt(periodSelector.value));
    
    await loadShopComparisonData(30);
}

async function loadShopComparisonData(days) {
    showToast('Loading shop comparison...', 'success');
    
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const shopPerformance = {};
    
    // Initialize shop data
    SHOPS.forEach(shop => {
        shopPerformance[shop] = {
            totalSales: 0,
            bagsSold: 0,
            daysWithSales: 0,
            productSales: {},
            stockTurnover: 0,
            openingStock: 0,
            closingStock: 0
        };
        
        productsData.forEach(product => {
            shopPerformance[shop].productSales[product.id] = 0;
        });
    });
    
    // Collect data
    for (const shop of SHOPS) {
        const shopQuery = query(collection(db, 'shops', shop, 'daily'));
        const snapshot = await getDocs(shopQuery);
        
        let firstDayStock = null;
        let lastDayStock = null;
        
        snapshot.forEach(docSnapshot => {
            const dateStr = docSnapshot.id;
            const [day, month, year] = dateStr.split('-').map(Number);
            const docDate = new Date(year, month - 1, day);
            
            if (docDate >= startDate && docDate <= endDate) {
                const data = docSnapshot.data();
                
                if (!firstDayStock && data.openingStock) {
                    firstDayStock = Object.values(data.openingStock).reduce((a, b) => a + b, 0);
                }
                
                if (data.openingStock) {
                    const closing = calculateClosingStock(data);
                    lastDayStock = Object.values(closing).reduce((a, b) => a + b, 0);
                }
                
                let hasSales = false;
                productsData.forEach(product => {
                    const sold = calculateSold(data, product.id);
                    if (sold > 0) {
                        hasSales = true;
                        shopPerformance[shop].bagsSold += sold;
                        shopPerformance[shop].totalSales += sold * product.sales;
                        shopPerformance[shop].productSales[product.id] += sold;
                    }
                });
                
                if (hasSales) {
                    shopPerformance[shop].daysWithSales++;
                }
            }
        });
        
        shopPerformance[shop].openingStock = firstDayStock || 0;
        shopPerformance[shop].closingStock = lastDayStock || 0;
        
        // Calculate stock turnover (bags sold / average stock)
        const avgStock = (shopPerformance[shop].openingStock + shopPerformance[shop].closingStock) / 2;
        if (avgStock > 0) {
            shopPerformance[shop].stockTurnover = (shopPerformance[shop].bagsSold / avgStock).toFixed(2);
        }
    }
    
    // Find best performing shop
    let bestShop = null;
    let bestSales = 0;
    Object.entries(shopPerformance).forEach(([shop, data]) => {
        if (data.totalSales > bestSales) {
            bestSales = data.totalSales;
            bestShop = shop;
        }
    });
    
    document.getElementById('best-shop-name').textContent = bestShop || '-';
    document.getElementById('best-shop-sales').textContent = `KSh ${bestSales.toLocaleString()}`;
    
    // Render performance metrics
    renderShopMetricsTable(shopPerformance, days);
    renderShopSalesComparisonChart(shopPerformance);
    renderProductMixTable(shopPerformance);
    
    showToast('Shop comparison loaded!', 'success');
}

function renderShopMetricsTable(shopPerformance, days) {
    const tbody = document.getElementById('shop-metrics-body');
    tbody.innerHTML = '';
    
    // Sort shops by total sales
    const sortedShops = Object.entries(shopPerformance).sort((a, b) => b[1].totalSales - a[1].totalSales);
    
    sortedShops.forEach(([shop, data], index) => {
        const avgSalePerDay = data.daysWithSales > 0 ? (data.totalSales / days).toFixed(0) : 0;
        
        // Calculate efficiency rating based on stock turnover and sales
        let efficiency = 0;
        let efficiencyClass = 'efficiency-poor';
        let efficiencyText = 'Poor';
        
        if (data.stockTurnover > 2) {
            efficiency = 95;
            efficiencyClass = 'efficiency-excellent';
            efficiencyText = 'Excellent';
        } else if (data.stockTurnover > 1) {
            efficiency = 75;
            efficiencyClass = 'efficiency-good';
            efficiencyText = 'Good';
        } else if (data.stockTurnover > 0.5) {
            efficiency = 50;
            efficiencyClass = 'efficiency-average';
            efficiencyText = 'Average';
        } else if (data.stockTurnover > 0) {
            efficiency = 25;
            efficiencyClass = 'efficiency-poor';
            efficiencyText = 'Poor';
        }
        
        const row = tbody.insertRow();
        row.innerHTML = `
            <td style="text-align: center; font-weight: bold; font-size: 1.2em;">${index + 1}</td>
            <td style="font-weight: bold;">${shop}</td>
            <td style="text-align: right; font-weight: bold;">KSh ${data.totalSales.toLocaleString()}</td>
            <td style="text-align: right;">${data.bagsSold.toFixed(1)}</td>
            <td style="text-align: right;">KSh ${Number(avgSalePerDay).toLocaleString()}</td>
            <td style="text-align: right;">${data.stockTurnover}x</td>
            <td style="text-align: center;"><span class="efficiency-rating ${efficiencyClass}">${efficiencyText} (${efficiency}%)</span></td>
        `;
    });
}

function renderShopSalesComparisonChart(shopPerformance) {
    const ctx = document.getElementById('shop-sales-comparison-chart');
    
    const labels = Object.keys(shopPerformance);
    const salesData = labels.map(shop => shopPerformance[shop].totalSales);
    const bagsData = labels.map(shop => shopPerformance[shop].bagsSold);
    
    if (window.shopSalesComparisonChart) {
        window.shopSalesComparisonChart.destroy();
    }
    
    window.shopSalesComparisonChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Total Sales (KSh)',
                data: salesData,
                backgroundColor: '#2e7d32',
                borderColor: '#1b5e20',
                borderWidth: 2,
                yAxisID: 'y'
            }, {
                label: 'Bags Sold',
                data: bagsData,
                backgroundColor: '#1976d2',
                borderColor: '#1565c0',
                borderWidth: 2,
                yAxisID: 'y1'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                }
            },
            scales: {
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: {
                        display: true,
                        text: 'Sales (KSh)'
                    },
                    ticks: {
                        callback: function(value) {
                            return 'KSh ' + value.toLocaleString();
                        }
                    }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    title: {
                        display: true,
                        text: 'Bags Sold'
                    },
                    grid: {
                        drawOnChartArea: false
                    }
                }
            }
        }
    });
}

function renderProductMixTable(shopPerformance) {
    const tbody = document.getElementById('product-mix-body');
    tbody.innerHTML = '';
    
    Object.entries(shopPerformance).forEach(([shop, data]) => {
        let topProduct = null;
        let topProductSales = 0;
        let totalShopBags = data.bagsSold;
        
        Object.entries(data.productSales).forEach(([productId, quantity]) => {
            if (quantity > topProductSales) {
                topProductSales = quantity;
                topProduct = productsData.find(p => p.id === productId);
            }
        });
        
        const percentage = totalShopBags > 0 ? ((topProductSales / totalShopBags) * 100).toFixed(1) : 0;
        
        const row = tbody.insertRow();
        row.innerHTML = `
            <td>${shop}</td>
            <td style="font-weight: bold;">${topProduct ? topProduct.name : '-'}</td>
            <td style="text-align: right;">${topProductSales.toFixed(1)} bags</td>
            <td style="text-align: right; font-weight: bold; color: #2e7d32;">${percentage}%</td>
        `;
    });
}

// Low Stock Alerts View
async function loadLowStockAlertsView() {
    showView('low-stock-alerts-view');
    await loadLowStockData();
}

async function loadLowStockData() {
    showToast('Loading stock alerts...', 'success');
    
    // Define thresholds
    const thresholds = {
        'BROODSTOCK': 2,
        'STARTER_MASH': 2,
        'SAMAKGRO_1MM': 5,
        'SAMAKGRO_2MM': 10,
        'SAMAKGRO_3MM': 10,
        'SAMAKGRO_4MMHP': 10,
        'SAMAKGRO_4.5MM': 10
    };
    
    const lowStockItems = [];
    const shopStockStatus = {};
    let criticalCount = 0;
    let warningCount = 0;
    let goodCount = 0;
    
    // Collect current stock data
    for (const shop of SHOPS) {
        const shopDocRef = doc(db, 'shops', shop, 'daily', currentDate);
        const shopDoc = await getDoc(shopDocRef);
        
        shopStockStatus[shop] = {
            alerts: [],
            totalItems: productsData.length
        };
        
        if (shopDoc.exists()) {
            const data = shopDoc.data();
            const closing = calculateClosingStock(data);
            
            productsData.forEach(product => {
                const currentStock = closing[product.id] || 0;
                const threshold = thresholds[product.id] || 10;
                const shortage = Math.max(0, threshold - currentStock);
                
                let status = 'good';
                if (currentStock === 0) {
                    status = 'critical';
                    criticalCount++;
                } else if (currentStock < threshold) {
                    status = 'warning';
                    warningCount++;
                } else {
                    goodCount++;
                }
                
                if (status !== 'good') {
                    lowStockItems.push({
                        shop: shop,
                        product: product,
                        currentStock: currentStock,
                        threshold: threshold,
                        shortage: shortage,
                        status: status
                    });
                    
                    shopStockStatus[shop].alerts.push({
                        product: product.name,
                        stock: currentStock,
                        status: status
                    });
                }
            });
        } else {
            // No data - all items critical
            productsData.forEach(product => {
                const threshold = thresholds[product.id] || 10;
                criticalCount++;
                
                lowStockItems.push({
                    shop: shop,
                    product: product,
                    currentStock: 0,
                    threshold: threshold,
                    shortage: threshold,
                    status: 'critical'
                });
                
                shopStockStatus[shop].alerts.push({
                    product: product.name,
                    stock: 0,
                    status: 'critical'
                });
            });
        }
    }
    
    // Update alert summary
    document.getElementById('critical-alerts').textContent = criticalCount;
    document.getElementById('warning-alerts').textContent = warningCount;
    document.getElementById('good-stock').textContent = goodCount;
    
    // Render tables
    renderLowStockTable(lowStockItems);
    renderShopStockStatus(shopStockStatus);
    renderReorderRecommendations(lowStockItems);
    
    showToast('Stock alerts loaded!', 'success');
}

function renderLowStockTable(lowStockItems) {
    const tbody = document.getElementById('low-stock-body');
    tbody.innerHTML = '';
    
    // Sort by status (critical first) then by shortage
    lowStockItems.sort((a, b) => {
        if (a.status === 'critical' && b.status !== 'critical') return -1;
        if (a.status !== 'critical' && b.status === 'critical') return 1;
        return b.shortage - a.shortage;
    });
    
    lowStockItems.forEach(item => {
        const statusBadge = item.status === 'critical' 
            ? '<span class="stock-status stock-critical">🚨 CRITICAL</span>'
            : '<span class="stock-status stock-warning">⚠️ LOW</span>';
        
        const recommendedReorder = Math.ceil(item.shortage * 1.5); // 50% buffer
        
        const row = tbody.insertRow();
        row.innerHTML = `
            <td>${statusBadge}</td>
            <td style="font-weight: bold;">${item.shop}</td>
            <td>${item.product.name}</td>
            <td style="text-align: right; ${item.currentStock === 0 ? 'color: #d32f2f; font-weight: bold;' : ''}">${item.currentStock.toFixed(1)} bags</td>
            <td style="text-align: right;">${item.threshold} bags</td>
            <td style="text-align: right; color: #d32f2f; font-weight: bold;">${item.shortage.toFixed(1)} bags</td>
            <td style="text-align: right; color: #2e7d32; font-weight: bold;">${recommendedReorder} bags</td>
        `;
    });
    
    if (lowStockItems.length === 0) {
        const row = tbody.insertRow();
        row.innerHTML = '<td colspan="7" style="text-align: center; color: #2e7d32; padding: 30px;"><span style="font-size: 2em;">✅</span><br><br><strong>All stock levels are good!</strong></td>';
    }
}

function renderShopStockStatus(shopStockStatus) {
    const container = document.getElementById('shop-stock-status');
    container.innerHTML = '<div class="shop-stock-grid"></div>';
    const grid = container.querySelector('.shop-stock-grid');
    
    Object.entries(shopStockStatus).forEach(([shop, status]) => {
        const hasAlerts = status.alerts.length > 0;
        const cardClass = hasAlerts ? 'shop-stock-card has-alerts' : 'shop-stock-card';
        
        const card = document.createElement('div');
        card.className = cardClass;
        
        let alertsHTML = '';
        if (hasAlerts) {
            alertsHTML = status.alerts.map(alert => {
                const icon = alert.status === 'critical' ? '🚨' : '⚠️';
                return `<div class="shop-stock-item">${icon} ${alert.product}: ${alert.stock.toFixed(1)} bags</div>`;
            }).join('');
        } else {
            alertsHTML = '<div class="shop-stock-item" style="color: #2e7d32;">✅ All products well stocked</div>';
        }
        
        card.innerHTML = `
            <h4>${shop}</h4>
            ${alertsHTML}
        `;
        
        grid.appendChild(card);
    });
}

function renderReorderRecommendations(lowStockItems) {
    const tbody = document.getElementById('reorder-recommendations-body');
    const tfoot = document.getElementById('reorder-recommendations-footer');
    tbody.innerHTML = '';
    tfoot.innerHTML = '';
    
    // Group by product
    const productShortages = {};
    
    lowStockItems.forEach(item => {
        if (!productShortages[item.product.id]) {
            productShortages[item.product.id] = {
                product: item.product,
                totalShortage: 0,
                shopsAffected: [],
                priority: 0
            };
        }
        
        productShortages[item.product.id].totalShortage += item.shortage;
        productShortages[item.product.id].shopsAffected.push(item.shop);
        
        if (item.status === 'critical') {
            productShortages[item.product.id].priority += 10;
        } else {
            productShortages[item.product.id].priority += 1;
        }
    });
    
    // Sort by priority
    const sortedProducts = Object.values(productShortages).sort((a, b) => b.priority - a.priority);
    
    let totalReorderCost = 0;
    
    sortedProducts.forEach(item => {
        const recommendedOrder = Math.ceil(item.totalShortage * 1.5); // 50% buffer
        const estimatedCost = recommendedOrder * item.product.cost;
        totalReorderCost += estimatedCost;
        
        let priorityBadge = '';
        if (item.priority >= 10) {
            priorityBadge = '<span class="priority-badge priority-high">HIGH</span>';
        } else if (item.priority >= 5) {
            priorityBadge = '<span class="priority-badge priority-medium">MEDIUM</span>';
        } else {
            priorityBadge = '<span class="priority-badge priority-low">LOW</span>';
        }
        
        const row = tbody.insertRow();
        row.innerHTML = `
            <td>${priorityBadge}</td>
            <td style="font-weight: bold;">${item.product.name}</td>
            <td style="text-align: right; color: #d32f2f;">${item.totalShortage.toFixed(1)} bags</td>
            <td style="text-align: center;">${item.shopsAffected.length} shops</td>
            <td style="text-align: right; font-weight: bold; color: #2e7d32;">${recommendedOrder} bags</td>
            <td style="text-align: right; font-weight: bold;">KSh ${estimatedCost.toLocaleString()}</td>
        `;
    });
    
    if (sortedProducts.length > 0) {
        const footerRow = tfoot.insertRow();
        footerRow.innerHTML = `
            <td colspan="5" style="text-align: right; font-weight: bold;">TOTAL REORDER COST:</td>
            <td style="text-align: right; font-weight: bold; color: #2e7d32; font-size: 1.1em;">KSh ${totalReorderCost.toLocaleString()}</td>
        `;
    } else {
        const row = tbody.insertRow();
        row.innerHTML = '<td colspan="6" style="text-align: center; color: #2e7d32; padding: 30px;">No reorder recommendations at this time</td>';
    }
}
async function loadAdminPanel() {
    showView('admin-view');
    const container = document.getElementById('admin-users');
    container.innerHTML = '';

    const usersSnapshot = await getDocs(collection(db, 'users'));
    
    usersSnapshot.forEach(userDoc => {
        const userData = userDoc.data();
        const userId = userDoc.id;

        const card = document.createElement('div');
        card.className = 'admin-user-card';
        card.innerHTML = `
            <div class="admin-user-header">
                <div class="admin-user-info">
                    <h4>${userData.name}</h4>
                    <p>${userData.email}</p>
                </div>
                <span class="admin-status ${userData.status}">${userData.status}</span>
            </div>
            <div class="admin-controls">
                <div class="admin-control-group">
                    <label>Role</label>
                    <select class="user-role-select" data-user="${userId}">
                        <option value="manager_full" ${userData.role === 'manager_full' ? 'selected' : ''}>Manager (Full Access)</option>
                        <option value="manager_view" ${userData.role === 'manager_view' ? 'selected' : ''}>Manager (View Only)</option>
                        <option value="attendant" ${userData.role === 'attendant' ? 'selected' : ''}>Attendant</option>
                        <option value="pending" ${userData.role === 'pending' ? 'selected' : ''}>Pending</option>
                    </select>
                </div>
                <div class="admin-control-group">
                    <label>Shop</label>
                    <select class="user-shop-select" data-user="${userId}">
                        <option value="">No Shop</option>
                        ${SHOPS.map(shop => `<option value="${shop}" ${userData.shop === shop ? 'selected' : ''}>${shop}</option>`).join('')}
                    </select>
                </div>
            </div>
            <div class="admin-buttons">
                <button class="btn-admin-save" data-user="${userId}">Save</button>
                <button class="btn-admin-remove" data-user="${userId}">Remove</button>
            </div>
        `;
        container.appendChild(card);
    });

    document.querySelectorAll('.btn-admin-save').forEach(btn => {
        btn.onclick = async () => {
            const userId = btn.dataset.user;
            const role = document.querySelector(`.user-role-select[data-user="${userId}"]`).value;
            const shop = document.querySelector(`.user-shop-select[data-user="${userId}"]`).value;

            try {
                await updateDoc(doc(db, 'users', userId), {
                    role: role,
                    shop: shop || null,
                    status: role === 'pending' ? 'pending' : 'active'
                });
                showToast('User updated successfully!', 'success');
                loadAdminPanel();
            } catch (error) {
                showToast('Error updating user: ' + error.message, 'error');
            }
        };
    });

    document.querySelectorAll('.btn-admin-remove').forEach(btn => {
        btn.onclick = async () => {
            const userId = btn.dataset.user;
            if (confirm('Are you sure you want to remove this user?')) {
                try {
                    await deleteDoc(doc(db, 'users', userId));
                    showToast('User removed successfully!', 'success');
                    loadAdminPanel();
                } catch (error) {
                    showToast('Error removing user: ' + error.message, 'error');
                }
            }
        };
    });
}

// PDF Export Button Handlers
document.getElementById('export-doc1').addEventListener('click', async () => {
    await generateDoc1PDF(currentDate);
});

document.getElementById('export-doc2').addEventListener('click', async () => {
    await generateDoc2PDF();
});

// DOC1: Stock Report PDF
async function generateDoc1PDF(date) {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF();

    showToast('Generating PDF...', 'success');

    // Generate a page for each shop
    for (let shopIndex = 0; shopIndex < SHOPS.length; shopIndex++) {
        const shop = SHOPS[shopIndex];
        
        if (shopIndex > 0) {
            pdf.addPage();
        }

        let yPosition = 20;

        // Shop header
        pdf.setFontSize(16);
        pdf.setFont(undefined, 'bold');
        pdf.text(shop, 105, yPosition, { align: 'center' });
        yPosition += 10;

        pdf.setFontSize(12);
        pdf.setFont(undefined, 'normal');
        pdf.text(`Date: ${formatDateDisplay(date)}`, 105, yPosition, { align: 'center' });
        yPosition += 10;

        // Get shop data from Firestore
        const shopDocRef = doc(db, 'shops', shop, 'daily', date);
        const shopDoc = await getDoc(shopDocRef);

        const tableData = [];
        let totalSalesAmount = 0;
        let totalStockValue = 0;

        if (shopDoc.exists()) {
            const data = shopDoc.data();
            const openingStock = data.openingStock || {};
            const closing = calculateClosingStock(data);

            productsData.forEach((product, idx) => {
                const opening = openingStock[product.id] || 0;
                const restocking = calculateRestocking(data, product.id);
                const sold = calculateSold(data, product.id);
                const closingQty = closing[product.id] || 0;
                const salesAmount = sold * product.sales;
                const stockValue = closingQty * product.sales; // CHANGED: Using SELLING PRICE

                totalSalesAmount += salesAmount;
                totalStockValue += stockValue;

                tableData.push([
                    idx + 1,
                    product.name,
                    opening.toFixed(1),
                    closingQty.toFixed(1),
                    `KSh ${product.cost.toLocaleString()}`,
                    `KSh ${product.sales.toLocaleString()}`,
                    sold.toFixed(1),
                    `KSh ${salesAmount.toLocaleString()}`,
                    `KSh ${stockValue.toLocaleString()}`
                ]);
            });
        } else {
            // If no data exists for this shop on this date, show zeros
            productsData.forEach((product, idx) => {
                tableData.push([
                    idx + 1,
                    product.name,
                    '0.0',
                    '0.0',
                    `KSh ${product.cost.toLocaleString()}`,
                    `KSh ${product.sales.toLocaleString()}`,
                    '0.0',
                    'KSh 0',
                    'KSh 0'
                ]);
            });
        }

        // Add totals row
        tableData.push([
            '',
            'TOTAL',
            '',
            '',
            '',
            '',
            '',
            `KSh ${totalSalesAmount.toLocaleString()}`,
            `KSh ${totalStockValue.toLocaleString()}`
        ]);

        // Draw table using autoTable
        pdf.autoTable({
            startY: yPosition,
            head: [['#', 'Product', 'Opening', 'Closing', 'Cost Price', 'Sales Price', 'Sales Qty', 'Sales Amount', 'Stock Value']],
            body: tableData,
            theme: 'grid',
            headStyles: { 
                fillColor: [46, 125, 50], 
                textColor: 255, 
                fontStyle: 'bold',
                halign: 'center'
            },
            styles: { 
                fontSize: 8,
                cellPadding: 2
            },
            columnStyles: {
                0: { cellWidth: 10, halign: 'center' },
                1: { cellWidth: 28 },
                2: { cellWidth: 18, halign: 'right' },
                3: { cellWidth: 18, halign: 'right' },
                4: { cellWidth: 22, halign: 'right' },
                5: { cellWidth: 22, halign: 'right' },
                6: { cellWidth: 18, halign: 'right' },
                7: { cellWidth: 28, halign: 'right' },
                8: { cellWidth: 28, halign: 'right' }
            },
            didParseCell: function(data) {
                if (data.row.index === tableData.length - 1) {
                    data.cell.styles.fontStyle = 'bold';
                    data.cell.styles.fillColor = [245, 245, 245];
                }
            }
        });
    }

    // Add summary page
    pdf.addPage();
    let summaryY = 20;

    pdf.setFontSize(16);
    pdf.setFont(undefined, 'bold');
    pdf.text('SHOPS SUMMARY TOTALS', 105, summaryY, { align: 'center' });
    summaryY += 15;

    // Collect summary data
    const summaryData = [];
    let grandTotalBags = 0;
    let grandTotalSold = 0;
    let grandTotalSales = 0;

    for (let shopIndex = 0; shopIndex < SHOPS.length; shopIndex++) {
        const shop = SHOPS[shopIndex];
        const shopDocRef = doc(db, 'shops', shop, 'daily', date);
        const shopDoc = await getDoc(shopDocRef);

        if (shopDoc.exists()) {
            const data = shopDoc.data();
            const closing = calculateClosingStock(data);
            const bagsRemaining = Object.values(closing).reduce((a, b) => a + b, 0);

            let bagsSold = 0;
            let salesAmount = 0;

            productsData.forEach(product => {
                const sold = calculateSold(data, product.id);
                bagsSold += sold;
                salesAmount += sold * product.sales;
            });

            grandTotalBags += bagsRemaining;
            grandTotalSold += bagsSold;
            grandTotalSales += salesAmount;

            summaryData.push([
                shopIndex + 1,
                formatDateDisplay(date),
                shop,
                bagsRemaining.toFixed(1),
                bagsSold.toFixed(1),
                `KSh ${salesAmount.toLocaleString()}`
            ]);
        } else {
            summaryData.push([
                shopIndex + 1,
                formatDateDisplay(date),
                shop,
                '0.0',
                '0.0',
                'KSh 0'
            ]);
        }
    }

    // Add grand total row
    summaryData.push([
        '',
        '',
        'TOTAL',
        grandTotalBags.toFixed(1),
        grandTotalSold.toFixed(1),
        `KSh ${grandTotalSales.toLocaleString()}`
    ]);

    pdf.autoTable({
        startY: summaryY,
        head: [['Index', 'Date', 'Shop', 'Bags', 'Bags Sold', 'Sales Amount']],
        body: summaryData,
        theme: 'grid',
        headStyles: { 
            fillColor: [46, 125, 50], 
            textColor: 255, 
            fontStyle: 'bold',
            halign: 'center'
        },
        styles: { 
            fontSize: 10,
            cellPadding: 3
        },
        columnStyles: {
            0: { halign: 'center' },
            1: { halign: 'center' },
            2: { halign: 'left' },
            3: { halign: 'right' },
            4: { halign: 'right' },
            5: { halign: 'right' }
        },
        didParseCell: function(data) {
            if (data.row.index === summaryData.length - 1) {
                data.cell.styles.fontStyle = 'bold';
                data.cell.styles.fillColor = [245, 245, 245];
            }
        }
    });

    // Save the PDF
    pdf.save(`YFarmers Stock Report as at ${formatDateDisplay(date)}.pdf`);
    showToast('PDF exported successfully!', 'success');
}

// DOC2: Stock Value Book PDF
async function generateDoc2PDF() {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF();

    showToast('Generating PDF...', 'success');

    // PAGE 1: Total Sales Summary
    let yPos = 20;
    pdf.setFontSize(16);
    pdf.setFont(undefined, 'bold');
    pdf.text('Total Sales Summary', 105, yPos, { align: 'center' });
    yPos += 15;

    const salesData = [];
    let totalBagsRemaining = 0;
    let totalBagsSold = 0;
    let totalSalesAmount = 0;

    for (const shop of SHOPS) {
        const shopDocRef = doc(db, 'shops', shop, 'daily', currentDate);
        const shopDoc = await getDoc(shopDocRef);

        if (shopDoc.exists()) {
            const data = shopDoc.data();
            const closing = calculateClosingStock(data);
            const bagsRemaining = Object.values(closing).reduce((a, b) => a + b, 0);

            let bagsSold = 0;
            let salesAmount = 0;

            productsData.forEach(product => {
                const sold = calculateSold(data, product.id);
                bagsSold += sold;
                salesAmount += sold * product.sales;
            });

            totalBagsRemaining += bagsRemaining;
            totalBagsSold += bagsSold;
            totalSalesAmount += salesAmount;

            salesData.push([
                shop,
                bagsRemaining.toFixed(1),
                bagsSold.toFixed(1),
                `KSh ${salesAmount.toLocaleString()}`
            ]);
        } else {
            salesData.push([
                shop,
                '0.0',
                '0.0',
                'KSh 0'
            ]);
        }
    }

    salesData.push([
        'TOTAL',
        totalBagsRemaining.toFixed(1),
        totalBagsSold.toFixed(1),
        `KSh ${totalSalesAmount.toLocaleString()}`
    ]);

    pdf.autoTable({
        startY: yPos,
        head: [['Shop Name', 'Bags Remaining', 'Bags Sold', 'Total Sales Amount']],
        body: salesData,
        theme: 'grid',
        headStyles: { 
            fillColor: [46, 125, 50], 
            textColor: 255, 
            fontStyle: 'bold',
            halign: 'center'
        },
        styles: { fontSize: 10, cellPadding: 3 },
        columnStyles: {
            0: { halign: 'left' },
            1: { halign: 'right' },
            2: { halign: 'right' },
            3: { halign: 'right' }
        },
        didParseCell: function(data) {
            if (data.row.index === salesData.length - 1) {
                data.cell.styles.fontStyle = 'bold';
                data.cell.styles.fillColor = [245, 245, 245];
            }
        }
    });

    // PAGE 2: Debtors
    pdf.addPage();
    yPos = 20;

    pdf.setFontSize(16);
    pdf.setFont(undefined, 'bold');
    pdf.text('Debtors', 105, yPos, { align: 'center' });
    yPos += 15;

    const debtorsData = [];
    let totalDebtorsAmount = 0;

    for (const shop of SHOPS) {
        const shopQuery = query(collection(db, 'shops', shop, 'daily'));
        const snapshot = await getDocs(shopQuery);

        snapshot.forEach(docSnapshot => {
            const data = docSnapshot.data();
            const date = docSnapshot.id;

            if (data.creditSales) {
                Object.values(data.creditSales).forEach(sale => {
                    const product = productsData.find(p => p.id === sale.feedType);
                    const amount = (parseFloat(sale.bags) * parseFloat(sale.price)) - parseFloat(sale.discount || 0);
                    totalDebtorsAmount += amount;

                    debtorsData.push([
                        sale.debtorName,
                        product ? product.name : sale.feedType,
                        parseFloat(sale.bags).toFixed(1),
                        `KSh ${parseFloat(sale.price).toLocaleString()}`,
                        `KSh ${amount.toLocaleString()}`,
                        shop,
                        formatDateDisplay(date)
                    ]);
                });
            }
        });
    }

    if (debtorsData.length === 0) {
        debtorsData.push(['No debtors recorded', '', '', '', '', '', '']);
    }

    debtorsData.push([
        '',
        '',
        '',
        'TOTAL',
        `KSh ${totalDebtorsAmount.toLocaleString()}`,
        '',
        ''
    ]);

    pdf.autoTable({
        startY: yPos,
        head: [['Client', 'Feeds', 'Bags', 'Price', 'Amount', 'Shop', 'Date']],
        body: debtorsData,
        theme: 'grid',
        headStyles: { 
            fillColor: [211, 47, 47], 
            textColor: 255, 
            fontStyle: 'bold',
            halign: 'center'
        },
        styles: { fontSize: 9, cellPadding: 2 },
        columnStyles: {
            0: { cellWidth: 30 },
            1: { cellWidth: 28 },
            2: { halign: 'right', cellWidth: 18 },
            3: { halign: 'right', cellWidth: 25 },
            4: { halign: 'right', cellWidth: 25 },
            5: { cellWidth: 25 },
            6: { cellWidth: 25 }
        },
        didParseCell: function(data) {
            if (data.row.index === debtorsData.length - 1) {
                data.cell.styles.fontStyle = 'bold';
                data.cell.styles.fillColor = [245, 245, 245];
            }
        }
    });

    // PAGE 3: Creditors
    pdf.addPage();
    yPos = 20;

    pdf.setFontSize(16);
    pdf.setFont(undefined, 'bold');
    pdf.text('Creditors', 105, yPos, { align: 'center' });
    yPos += 15;

    const creditorsData = [];
    let totalCreditorsAmount = 0;
    let creditorIndex = 1;

    for (const shop of SHOPS) {
        const shopQuery = query(collection(db, 'shops', shop, 'daily'));
        const snapshot = await getDocs(shopQuery);

        snapshot.forEach(docSnapshot => {
            const data = docSnapshot.data();
            const date = docSnapshot.id;

            if (data.prepayments) {
                Object.values(data.prepayments).forEach(payment => {
                    const amount = parseFloat(payment.amountPaid);
                    totalCreditorsAmount += amount;

                    creditorsData.push([
                        creditorIndex++,
                        formatDateDisplay(date),
                        shop,
                        payment.clientName,
                        `KSh ${amount.toLocaleString()}`
                    ]);
                });
            }
        });
    }

    if (creditorsData.length === 0) {
        creditorsData.push(['-', 'No creditors recorded', '', '', '']);
    }

    creditorsData.push([
        '',
        '',
        '',
        'TOTAL',
        `KSh ${totalCreditorsAmount.toLocaleString()}`
    ]);

    pdf.autoTable({
        startY: yPos,
        head: [['Index', 'Date', 'Shop', 'Client', 'Amount']],
        body: creditorsData,
        theme: 'grid',
        headStyles: { 
            fillColor: [245, 124, 0], 
            textColor: 255, 
            fontStyle: 'bold',
            halign: 'center'
        },
        styles: { fontSize: 10, cellPadding: 3 },
        columnStyles: {
            0: { halign: 'center', cellWidth: 20 },
            1: { halign: 'center', cellWidth: 35 },
            2: { cellWidth: 35 },
            3: { cellWidth: 45 },
            4: { halign: 'right', cellWidth: 35 }
        },
        didParseCell: function(data) {
            if (data.row.index === creditorsData.length - 1) {
                data.cell.styles.fontStyle = 'bold';
                data.cell.styles.fillColor = [245, 245, 245];
            }
        }
    });

    // PAGE 4: Stock Value Summary
    pdf.addPage();
    yPos = 20;

    pdf.setFontSize(16);
    pdf.setFont(undefined, 'bold');
    pdf.text('Stock Value Summary', 105, yPos, { align: 'center' });
    yPos += 20;

    // Calculate shops stock value at SELLING PRICE
    let shopsStockValue = 0;

    for (const shop of SHOPS) {
        const shopDocRef = doc(db, 'shops', shop, 'daily', currentDate);
        const shopDoc = await getDoc(shopDocRef);

        if (shopDoc.exists()) {
            const data = shopDoc.data();
            const closing = calculateClosingStock(data);

            productsData.forEach(product => {
                const bags = closing[product.id] || 0;
                shopsStockValue += bags * product.sales; // CHANGED: Using SELLING PRICE
            });
        }
    }

    // Calculate debtors balance (outstanding amount after payments)
    const debtorBalances = {};

    // Collect all credit sales
    for (const shop of SHOPS) {
        const shopQuery = query(collection(db, 'shops', shop, 'daily'));
        const snapshot = await getDocs(shopQuery);

        snapshot.forEach(docSnapshot => {
            const data = docSnapshot.data();
            
            if (data.creditSales) {
                Object.values(data.creditSales).forEach(sale => {
                    const amount = (parseFloat(sale.bags) * parseFloat(sale.price)) - parseFloat(sale.discount || 0);
                    
                    if (!debtorBalances[sale.debtorName]) {
                        debtorBalances[sale.debtorName] = { owed: 0, paid: 0 };
                    }
                    debtorBalances[sale.debtorName].owed += amount;
                });
            }
        });
    }

    // Collect all debt payments
    for (const shop of SHOPS) {
        const shopQuery = query(collection(db, 'shops', shop, 'daily'));
        const snapshot = await getDocs(shopQuery);

        snapshot.forEach(docSnapshot => {
            const data = docSnapshot.data();
            
            if (data.debtPayments) {
                Object.values(data.debtPayments).forEach(payment => {
                    const debtorName = payment.debtorName;
                    const amountPaid = parseFloat(payment.amountPaid);
                    
                    if (debtorBalances[debtorName]) {
                        debtorBalances[debtorName].paid += amountPaid;
                    }
                });
            }
        });
    }

    // Calculate total outstanding debtors balance
    let debtorsValue = 0;
    Object.values(debtorBalances).forEach(data => {
        const balance = data.owed - data.paid;
        if (balance > 0) {
            debtorsValue += balance;
        }
    });

    const netValue = shopsStockValue + debtorsValue - creditorsBalanceDoc2;

    // Create value breakdown table
    pdf.setFontSize(12);
    pdf.setFont(undefined, 'bold');
    
    // Calculate creditors balance properly (matching summary table)
    const creditorBalancesDoc2 = {};

    // Collect all prepayments
    for (const shop of SHOPS) {
        const shopQuery = query(collection(db, 'shops', shop, 'daily'));
        const snapshot = await getDocs(shopQuery);

        snapshot.forEach(docSnapshot => {
            const data = docSnapshot.data();
            
            if (data.prepayments) {
                Object.values(data.prepayments).forEach(payment => {
                    if (!creditorBalancesDoc2[payment.clientName]) {
                        creditorBalancesDoc2[payment.clientName] = { prepaid: 0, feedsTaken: 0 };
                    }
                    creditorBalancesDoc2[payment.clientName].prepaid += parseFloat(payment.amountPaid);
                });
            }
        });
    }

    // Collect all creditor releases
    for (const shop of SHOPS) {
        const shopQuery = query(collection(db, 'shops', shop, 'daily'));
        const snapshot = await getDocs(shopQuery);

        snapshot.forEach(docSnapshot => {
            const data = docSnapshot.data();
            
            if (data.creditorReleases) {
                Object.values(data.creditorReleases).forEach(release => {
                    const creditorName = release.creditorName;
                    const bags = parseFloat(release.bags);
                    const product = productsData.find(p => p.id === release.feedType);
                    const price = release.price ? parseFloat(release.price) : (product ? product.sales : 0);
                    const discount = parseFloat(release.discount || 0);
                    const amount = (bags * price) - discount;
                    
                    if (creditorBalancesDoc2[creditorName]) {
                        creditorBalancesDoc2[creditorName].feedsTaken += amount;
                    }
                });
            }
        });
    }

    // Calculate total creditors balance
    let creditorsBalanceDoc2 = 0;
    Object.values(creditorBalancesDoc2).forEach(data => {
        const balance = data.prepaid - data.feedsTaken;
        if (balance !== 0) {
            creditorsBalanceDoc2 += balance;
        }
    });

    const valueBreakdown = [
        ['Debtors Value:', `KSh ${debtorsValue.toLocaleString()}`],
        ['Shops Stock Value (Selling Price):', `KSh ${shopsStockValue.toLocaleString()}`],
        ['Creditors Value:', `KSh ${creditorsBalanceDoc2.toLocaleString()}`]
    ];

    pdf.autoTable({
        startY: yPos,
        body: valueBreakdown,
        theme: 'plain',
        styles: { 
            fontSize: 12,
            cellPadding: 5,
            fontStyle: 'bold'
        },
        columnStyles: {
            0: { cellWidth: 80 },
            1: { cellWidth: 80, halign: 'right' }
        }
    });

    const afterTable = pdf.lastAutoTable.finalY + 10;

    // Draw calculation
    pdf.setFontSize(11);
    pdf.setFont(undefined, 'normal');
    pdf.text('Net Stock Value = Stock in Shops (at Selling Price) + Debtors - Creditors', 105, afterTable, { align: 'center' });
    
    pdf.setFontSize(10);
    pdf.text(
        `Net Stock Value = ${shopsStockValue.toLocaleString()} + ${debtorsValue.toLocaleString()} - ${totalCreditorsAmount.toLocaleString()}`,
        105,
        afterTable + 7,
        { align: 'center' }
    );

    // Draw net value box
    const boxY = afterTable + 15;
    pdf.setFillColor(46, 125, 50);
    pdf.roundedRect(30, boxY, 150, 20, 3, 3, 'F');
    
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(14);
    pdf.setFont(undefined, 'bold');
    pdf.text('NET STOCK VALUE', 40, boxY + 8);
    pdf.text(`KSh ${netValue.toLocaleString()}`, 170, boxY + 8, { align: 'right' });

    // Reset text color
    pdf.setTextColor(0, 0, 0);

    // Save the PDF
    pdf.save('YFarmers Stock Value Book.pdf');
    showToast('PDF exported successfully!', 'success');
}