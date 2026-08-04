// ==========================================
// 1. משתנים גלובליים וניהול GitHub
// ==========================================
let currentData = {};
let selectedMonth = "2026-07";

function getGithubConfig() {
    return {
        token: localStorage.getItem('gh_token') || '',
        owner: localStorage.getItem('gh_owner') || '',
        repo: localStorage.getItem('gh_repo') || '',
        path: localStorage.getItem('gh_path') || 'data.json'
    };
}

// ==========================================
// 2. פונקציות עזר לטיפול בזמנים
// ==========================================
function parseTimeToMinutes(val) {
    if (!val) return 0;
    if (typeof val === 'number') return val;
    const str = String(val).trim();
    if (str.includes(':')) {
        const parts = str.split(':');
        return (parseInt(parts[0], 10) * 60) + (parseInt(parts[1], 10) || 0);
    }
    return parseFloat(str) || 0;
}

function formatMinutesToHHMM(totalMinutes) {
    if (isNaN(totalMinutes) || totalMinutes <= 0) return "0:00";
    const hrs = Math.floor(totalMinutes / 60);
    const mins = Math.round(totalMinutes % 60);
    return `${hrs}:${mins < 10 ? '0' : ''}${mins}`;
}

// ==========================================
// 3. חישוב מופעי איכילוב (לוגיקה בטוחה)
// ==========================================
function calculateIchilov(showType, kmOneWay, timeThere, timeBack) {
    const km = parseFloat(kmOneWay) || 0;
    const totalKm = km * 2;

    const tThereMins = parseTimeToMinutes(timeThere);
    const tBackMins = parseTimeToMinutes(timeBack);
    const totalMins = tThereMins + tBackMins;

    let basePay = 670;
    if (showType === "ארוך") basePay = 840;
    else if (showType === "זוגי") basePay = 250;

    const kmPay = totalKm; 

    let excessMins = 0;
    let timePay = 0;
    if (totalMins > 90) {
        excessMins = totalMins - 90;
        timePay = Math.round(excessMins * (840 / 700));
    }

    const totalPay = basePay + kmPay + timePay;

    return {
        basePay: basePay,
        kmPay: kmPay,
        timePay: timePay,
        totalPay: totalPay,
        totalHoursStr: formatMinutesToHHMM(totalMins),
        excessHoursStr: formatMinutesToHHMM(excessMins)
    };
}

// ==========================================
// 4. טעינה ורינדור הנתונים
// ==========================================
async function loadData() {
    try {
        const response = await fetch('data.json?t=' + Date.now());
        if (!response.ok) throw new Error("לא ניתן לטעון את data.json");
        currentData = await response.json();
        renderDashboard();
    } catch (err) {
        console.error("שגיאה בטעינת הנתונים:", err);
    }
}

function renderDashboard() {
    const events = currentData[selectedMonth] || [];
    
    let totalAll = 0;
    let totalPaid = 0;
    let totalUnpaid = 0;

    const mainTableBody = document.getElementById('mainTableBody');
    const ichilovTableBody = document.getElementById('ichilovTableBody');

    if (mainTableBody) mainTableBody.innerHTML = '';
    if (ichilovTableBody) ichilovTableBody.innerHTML = '';

    events.forEach(item => {
        try {
            const itemAmount = Number(item.amount) || 0;
            totalAll += itemAmount;
            if (item.isPaid) {
                totalPaid += itemAmount;
            } else {
                totalUnpaid += itemAmount;
            }

            // 1. טבלה כללית
            if (mainTableBody) {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${item.date || ''}</td>
                    <td>${item.client || ''}</td>
                    <td>${item.type || ''}</td>
                    <td>${item.location || ''}</td>
                    <td>₪${itemAmount}</td>
                    <td>
                        <span class="badge ${item.isPaid ? 'bg-success' : 'bg-danger'}">
                            ${item.isPaid ? 'שולם' : 'X טרם שולם'}
                        </span>
                    </td>
                    <td>
                        <button class="btn btn-sm btn-outline-danger" onclick="deleteEvent(${item.id})">🗑️</button>
                    </td>
                `;
                mainTableBody.appendChild(tr);
            }

            // 2. טבלת איכילוב
            if (item.isIchilov && ichilovTableBody) {
                const iData = item.ichilovData || {};
                const calc = iData.calcDetails || calculateIchilov(
                    iData.showType || item.type,
                    iData.kmOneWay || 0,
                    iData.timeThere || 0,
                    iData.timeBack || 0
                );

                const trI = document.createElement('tr');
                trI.innerHTML = `
                    <td>${item.date || ''}</td>
                    <td>${iData.location || item.location || ''}</td>
                    <td>${iData.showType || item.type || ''}</td>
                    <td>${(Number(iData.kmOneWay) || 0) * 2} ק"מ</td>
                    <td>${calc.totalHoursStr || (iData.timeThere + '+' + iData.timeBack)}</td>
                    <td>₪${calc.basePay || 0}</td>
                    <td>₪${calc.kmPay || 0}</td>
                    <td>₪${calc.timePay || 0}</td>
                    <td><strong>₪${itemAmount}</strong></td>
                    <td>
                        <span class="badge ${item.isPaid ? 'bg-success' : 'bg-danger'}">
                            ${item.isPaid ? 'שולם' : 'טרם שולם'}
                        </span>
                    </td>
                    <td>
                        <button class="btn btn-sm btn-outline-danger" onclick="deleteEvent(${item.id})">🗑️</button>
                    </td>
                `;
                ichilovTableBody.appendChild(trI);
            }

        } catch (itemErr) {
            console.error("שגיאה ברינדור שורה:", item, itemErr);
        }
    });

    updateCardValues(totalAll, totalPaid, totalUnpaid);
}

function updateCardValues(total, paid, unpaid) {
    const elTotal = document.getElementById('totalAmount');
    const elPaid = document.getElementById('paidAmount');
    const elUnpaid = document.getElementById('unpaidAmount');

    if (elTotal) elTotal.textContent = `₪${total.toLocaleString()}`;
    if (elPaid) elPaid.textContent = `₪${paid.toLocaleString()}`;
    if (elUnpaid) elUnpaid.textContent = `₪${unpaid.toLocaleString()}`;
}

// ==========================================
// 5. ניהול חלון הגדרות (Modal) והגדרות GitHub
// ==========================================
function openSettingsModal() {
    const config = getGithubConfig();
    document.getElementById('ghTokenInput').value = config.token;
    document.getElementById('ghOwnerInput').value = config.owner;
    document.getElementById('ghRepoInput').value = config.repo;
    document.getElementById('ghPathInput').value = config.path;

    const modalEl = document.getElementById('settingsModal');
    if (modalEl) {
        if (typeof bootstrap !== 'undefined') {
            const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
            modal.show();
        } else {
            modalEl.style.display = 'block';
        }
    }
}

function saveGithubSettings() {
    const token = document.getElementById('ghTokenInput').value.trim();
    const owner = document.getElementById('ghOwnerInput').value.trim();
    const repo = document.getElementById('ghRepoInput').value.trim();
    const path = document.getElementById('ghPathInput').value.trim() || 'data.json';

    localStorage.setItem('gh_token', token);
    localStorage.setItem('gh_owner', owner);
    localStorage.setItem('gh_repo', repo);
    localStorage.setItem('gh_path', path);

    alert('ההגדרות נשמרו בהצלחה!');

    const modalEl = document.getElementById('settingsModal');
    if (modalEl && typeof bootstrap !== 'undefined') {
        const modal = bootstrap.getInstance(modalEl);
        if (modal) modal.hide();
    }
}

// ==========================================
// 6. שמירה ומחיקה (פונקציות תפעול)
// ==========================================
function deleteEvent(id) {
    if (!confirm("האם אתה בטוח שברצונך למחוק אירוע זה?")) return;
    if (currentData[selectedMonth]) {
        currentData[selectedMonth] = currentData[selectedMonth].filter(item => item.id !== id);
        renderDashboard();
    }
}

function onMonthChange(event) {
    selectedMonth = event.target.value;
    renderDashboard();
}

// ==========================================
// 7. ארועים בעת טעינת העמוד
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    loadData();

    const monthPicker = document.getElementById('monthPicker');
    if (monthPicker) {
        monthPicker.addEventListener('change', onMonthChange);
    }

    // חיבור כפתור ההגדרות למודאל
    const settingsBtn = document.getElementById('settingsBtn') || document.querySelector('[onclick*="settings"]');
    if (settingsBtn) {
        settingsBtn.onclick = openSettingsModal;
    }
});
