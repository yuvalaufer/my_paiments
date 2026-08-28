// ==========================================
// 1. משתנים גלובליים וניהול הגדרות GitHub
// ==========================================
let currentData = {};
let selectedMonth = "";
let hasUnsavedChanges = false;

function getGithubConfig() {
    return {
        username: (localStorage.getItem('gh_username') || localStorage.getItem('username') || localStorage.getItem('gh-username') || '').trim(),
        repo: (localStorage.getItem('gh_repo') || localStorage.getItem('repo') || '').trim(),
        token: (localStorage.getItem('gh_token') || localStorage.getItem('token') || '').trim()
    };
}

function showStatusMessage(text, isError = false) {
    const statusEl = document.getElementById('status-message');
    if (statusEl) {
        statusEl.textContent = text;
        statusEl.style.color = isError ? '#d9534f' : '#5cb85c';
        setTimeout(() => { statusEl.textContent = ''; }, 5000);
    }
}

// ==========================================
// 2. פונקציות עזר לבדיקה והמרת זמנים
// ==========================================
function parseTimeToMinutes(val) {
    if (!val && val !== 0) return 0;
    if (typeof val === 'number') return val;
    
    const str = String(val).trim();
    if (str.includes(':')) {
        const parts = str.split(':');
        const hrs = parseInt(parts[0], 10) || 0;
        const mins = parseInt(parts[1], 10) || 0;
        return (hrs * 60) + mins;
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
// 3. מחשבון איכילוב
// ==========================================
function calculateIchilov(showType, kmOneWay, timeThere, timeBack) {
    const km = parseFloat(kmOneWay) || 0;
    const totalKm = km * 2;

    const tThereMins = parseTimeToMinutes(timeThere);
    const tBackMins = parseTimeToMinutes(timeBack);
    const totalMins = tThereMins + tBackMins;

    let basePay = 350;
    if (showType === "זוגי") basePay = 250;
    else if (showType === "ארוך") basePay = 840;

    const kmPay = totalKm; 

    let excessMins = 0;
    let timePay = 0;
    if (totalMins > 90) {
        excessMins = totalMins - 90;
        timePay = Math.round(excessMins * (840 / 700));
    }

    const totalPay = basePay + kmPay + timePay;

    return {
        basePay,
        kmPay,
        timePay,
        totalPay,
        totalMins,
        excessMins,
        totalHoursStr: formatMinutesToHHMM(totalMins),
        excessHoursStr: formatMinutesToHHMM(excessMins)
    };
}

function updateIchilovPreview() {
    const showType = document.getElementById('ichilov-show-type')?.value || 'רגיל';
    const km = document.getElementById('ichilov-km')?.value || 0;
    const timeThere = document.getElementById('ichilov-time-there')?.value || 0;
    const timeBack = document.getElementById('ichilov-time-back')?.value || 0;

    const calc = calculateIchilov(showType, km, timeThere, timeBack);
    const previewEl = document.getElementById('calc-breakdown');
    if (previewEl) {
        previewEl.innerHTML = `שכר בסיס: ₪${calc.basePay} | נסיעות: ₪${calc.kmPay} (${parseFloat(km)*2} ק"מ) | תוספת זמן: ₪${calc.timePay} (${calc.totalHoursStr}) | <strong>סה"כ: ₪${calc.totalPay}</strong>`;
    }
}

// ==========================================
// 4. טעינה ורינדור הנתונים (Dashboard)
// ==========================================
async function loadData() {
    try {
        const response = await fetch('data.json?t=' + Date.now());
        if (!response.ok) throw new Error("שגיאה בטעינת data.json");
        currentData = await response.json();
        
        const monthPicker = document.getElementById('month-select');
        if (monthPicker) {
            if (!selectedMonth) {
                const availableMonths = Object.keys(currentData);
                if (availableMonths.length > 0) {
                    selectedMonth = availableMonths[0];
                } else {
                    const now = new Date();
                    selectedMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
                }
            }
            monthPicker.value = selectedMonth;
        }
        
        renderDashboard();
    } catch (err) {
        console.error("שגיאה בטעינת הנתונים:", err);
        showStatusMessage("שגיאה בטעינת קובץ הנתונים", true);
    }
}

function updateClientsDropdown() {
    const selectEl = document.getElementById('client-select');
    if (!selectEl) return;

    const previousValue = selectEl.value;

    const clientsSet = new Set();
    Object.values(currentData).forEach(monthEvents => {
        if (Array.isArray(monthEvents)) {
            monthEvents.forEach(item => {
                if (item.client && item.client.trim()) {
                    clientsSet.add(item.client.trim());
                }
            });
        }
    });

    selectEl.innerHTML = '<option value="" disabled selected>בחר לקוח...</option>';

    Array.from(clientsSet).sort().forEach(clientName => {
        const option = document.createElement('option');
        option.value = clientName;
        option.textContent = clientName;
        selectEl.appendChild(option);
    });

    const newOpt = document.createElement('option');
    newOpt.value = "__NEW__";
    newOpt.textContent = "➕ לקוח חדש...";
    selectEl.appendChild(newOpt);

    if (previousValue && Array.from(selectEl.options).some(o => o.value === previousValue)) {
        selectEl.value = previousValue;
    }
}

function renderDashboard() {
    const events = currentData[selectedMonth] || [];
    
    let totalAll = 0;
    let totalPaid = 0;
    let totalUnpaid = 0;

    const mainList = document.getElementById('payments-list');
    const ichilovList = document.getElementById('ichilov-list');

    if (mainList) mainList.innerHTML = '';
    if (ichilovList) ichilovList.innerHTML = '';

    events.forEach(item => {
        try {
            const itemAmount = Number(item.amount) || 0;
            totalAll += itemAmount;
            if (item.isPaid) {
                totalPaid += itemAmount;
            } else {
                totalUnpaid += itemAmount;
            }

            const statusSelectHTML = `
                <select onchange="window.handleStatusChange(${item.id}, this.value)" 
                        style="padding: 4px 8px; border-radius: 8px; border: 1px solid #ccc; font-weight: bold; cursor: pointer; background-color: ${item.isPaid ? '#d4edda' : '#f8d7da'}; color: ${item.isPaid ? '#155724' : '#721c24'};">
                    <option value="false" ${!item.isPaid ? 'selected' : ''}>✗ טרם שולם</option>
                    <option value="true" ${item.isPaid ? 'selected' : ''}>✓ שולם</option>
                </select>
            `;

            if (mainList) {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${item.date || ''}</td>
                    <td>${item.client || ''}</td>
                    <td>${item.type || ''}</td>
                    <td>${item.location || ''}</td>
                    <td>₪${itemAmount.toLocaleString()}</td>
                    <td>${statusSelectHTML}</td>
                    <td>
                        <button class="btn-delete" onclick="window.deleteEvent(${item.id})">🗑️</button>
                    </td>
                `;
                mainList.appendChild(tr);
            }

            if (item.isIchilov && ichilovList) {
                const iData = item.ichilovData || {};
                
                const tThere = iData.timeThere || 0;
                const tBack = iData.timeBack || 0;
                const totalMins = parseTimeToMinutes(tThere) + parseTimeToMinutes(tBack);

                const calc = iData.calcDetails || calculateIchilov(
                    iData.showType || item.type,
                    iData.kmOneWay || 0,
                    tThere,
                    tBack
                );

                const trI = document.createElement('tr');
                trI.innerHTML = `
                    <td>${item.date || ''}</td>
                    <td>${iData.location || item.location || ''}</td>
                    <td>${iData.showType || item.type || ''}</td>
                    <td>${(Number(iData.kmOneWay) || 0) * 2} ק"מ</td>
                    <td>${calc.totalHoursStr || formatMinutesToHHMM(totalMins)}</td>
                    <td>₪${calc.basePay || 0}</td>
                    <td>₪${calc.kmPay || 0}</td>
                    <td>₪${calc.timePay || 0}</td>
                    <td><strong>₪${itemAmount.toLocaleString()}</strong></td>
                    <td>${statusSelectHTML}</td>
                    <td>
                        <button class="btn-delete" onclick="window.deleteEvent(${item.id})">🗑️</button>
                    </td>
                `;
                ichilovList.appendChild(trI);
            }

        } catch (itemErr) {
            console.error("שגיאה ברינדור שורת אירוע:", item, itemErr);
        }
    });

    const elTotal = document.getElementById('total-amount');
    const elPaid = document.getElementById('paid-amount');
    const elUnpaid = document.getElementById('unpaid-amount');

    if (elTotal) elTotal.textContent = `₪${totalAll.toLocaleString()}`;
    if (elPaid) elPaid.textContent = `₪${totalPaid.toLocaleString()}`;
    if (elUnpaid) elUnpaid.textContent = `₪${totalUnpaid.toLocaleString()}`;

    updateClientsDropdown();
    renderSaveButton();
}

function renderSaveButton() {
    let saveBtnContainer = document.getElementById('save-changes-container');
    if (!saveBtnContainer) {
        saveBtnContainer = document.createElement('div');
        saveBtnContainer.id = 'save-changes-container';
        saveBtnContainer.style.cssText = 'text-align: center; margin: 20px 0;';
        
        const mainCard = document.querySelector('.card') || document.body;
        mainCard.appendChild(saveBtnContainer);
    }

    if (hasUnsavedChanges) {
        saveBtnContainer.innerHTML = `
            <button onclick="window.saveAllChanges()" 
                    style="background-color: #28a745; color: white; padding: 12px 28px; border: none; border-radius: 8px; font-size: 16px; font-weight: bold; cursor: pointer; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                💾 שמור שינויים
            </button>
        `;
    } else {
        saveBtnContainer.innerHTML = '';
    }
}

// ==========================================
// 5. שינוי סטטוס תשלום + שמירה ל-GitHub
// ==========================================
window.handleStatusChange = function(id, value) {
    const monthEvents = currentData[selectedMonth] || [];
    const targetEvent = monthEvents.find(item => item.id === id);

    if (!targetEvent) return;

    const newStatus = (value === 'true');

    if (targetEvent.isIchilov || targetEvent.client === 'החברה מאיכילוב') {
        monthEvents.forEach(item => {
            if (item.isIchilov || item.client === 'החברה מאיכילוב') {
                item.isPaid = newStatus;
            }
        });
    } else {
        targetEvent.isPaid = newStatus;
    }

    hasUnsavedChanges = true;
    renderDashboard();
    showStatusMessage('ישנם שינויים שלא נשמרו. לחץ על "שמור שינויים"');
};

window.saveAllChanges = async function() {
    const config = getGithubConfig();

    if (!config.username || !config.repo || !config.token) {
        localStorage.setItem('local_data_backup', JSON.stringify(currentData));
        hasUnsavedChanges = false;
        renderDashboard();
        showStatusMessage('השינויים נשמרו מקומית בדפדפן (חסרים פרטי חיבור בהגדרות GitHub)', true);
        return;
    }

    showStatusMessage('שומר שינויים ב-GitHub...');
    try {
        const url = `https://api.github.com/repos/${config.username}/${config.repo}/contents/data.json`;
        const headers = { 
            'Authorization': `Bearer ${config.token}`,
            'Accept': 'application/vnd.github.v3+json'
        };
        
        let sha = null;
        const getRes = await fetch(url, { headers });
        
        if (getRes.ok) {
            const getData = await getRes.json();
            sha = getData.sha;
        } else if (getRes.status !== 404) {
            const errData = await getRes.json().catch(() => ({}));
            throw new Error(errData.message || `שגיאת גישה (${getRes.status})`);
        }

        const jsonString = JSON.stringify(currentData, null, 2);
        const utf8Bytes = new TextEncoder().encode(jsonString);
        let binaryString = "";
        for (let i = 0; i < utf8Bytes.length; i++) {
            binaryString += String.fromCharCode(utf8Bytes[i]);
        }
        const contentEncoded = btoa(binaryString);
        
        const payload = {
            message: 'עדכון נתונים מאפליקציית התשלומים',
            content: contentEncoded
        };
        if (sha) payload.sha = sha;

        const putRes = await fetch(url, {
            method: 'PUT',
            headers: {
                ...headers,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (putRes.ok) {
            hasUnsavedChanges = false;
            renderDashboard();
            showStatusMessage('השינויים נשמרו בהצלחה ב-GitHub!');
        } else {
            const putErr = await putRes.json().catch(() => ({}));
            throw new Error(putErr.message || 'שגיאה בשמירה ל-GitHub');
        }
    } catch (err) {
        console.error(err);
        showStatusMessage(`שגיאה בשמירה ל-GitHub: ${err.message}`, true);
    }
};

window.deleteEvent = function(id) {
    if (!confirm("האם אתה בטוח שברצונך למחוק אירוע זה?")) return;
    if (currentData[selectedMonth]) {
        currentData[selectedMonth] = currentData[selectedMonth].filter(item => item.id !== id);
        hasUnsavedChanges = true;
        renderDashboard();
        showStatusMessage('האירוע נמחק. זכור ללחוץ על "שמור שינויים"');
    }
};

// ==========================================
// 6. ניהול חלון הגדרות GitHub (Modal)
// ==========================================
function setupModal() {
    const modal = document.getElementById('settings-modal');
    const btn = document.getElementById('settings-btn');
    const closeBtn = document.querySelector('.close-btn');
    const form = document.getElementById('settings-form');

    const getInputElement = (...ids) => {
        for (let id of ids) {
            const el = document.getElementById(id);
            if (el) return el;
        }
        return null;
    };

    if (btn && modal) {
        btn.onclick = () => {
            const config = getGithubConfig();
            
            const userInput = getInputElement('github-username', 'username', 'gh-username');
            const repoInput = getInputElement('github-repo', 'repo', 'gh-repo');
            const tokenInput = getInputElement('github-token', 'token', 'gh-token', 'pat');

            if (userInput) userInput.value = config.username;
            if (repoInput) repoInput.value = config.repo;
            if (tokenInput) tokenInput.value = config.token;

            modal.style.display = 'block';
        };
    }

    if (closeBtn && modal) {
        closeBtn.onclick = () => { modal.style.display = 'none'; };
    }

    window.onclick = (event) => {
        if (event.target === modal) modal.style.display = 'none';
    };

    if (form) {
        form.onsubmit = (e) => {
            e.preventDefault();

            const userInput = getInputElement('github-username', 'username', 'gh-username');
            const repoInput = getInputElement('github-repo', 'repo', 'gh-repo');
            const tokenInput = getInputElement('github-token', 'token', 'gh-token', 'pat');

            const username = userInput ? userInput.value.trim() : '';
            const repo = repoInput ? repoInput.value.trim() : '';
            const token = tokenInput ? tokenInput.value.trim() : '';

            localStorage.setItem('gh_username', username);
            localStorage.setItem('gh_repo', repo);
            localStorage.setItem('gh_token', token);

            showStatusMessage('הגדרות GitHub נשמרו בהצלחה!');
            if (modal) modal.style.display = 'none';
        };
    }
}

// ==========================================
// 7. ניהול לשוניות (Tabs)
// ==========================================
function setupTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

            btn.classList.add('active');
            const tabId = btn.getAttribute('data-tab');
            const targetTab = document.getElementById(tabId);
            if (targetTab) targetTab.classList.add('active');
        });
    });
}

// ==========================================
// 8. הוספת אירועים
// ==========================================
function setupForms() {
    const clientSelect = document.getElementById('client-select');
    const newClientContainer = document.getElementById('new-client-container');

    if (clientSelect && newClientContainer) {
        clientSelect.addEventListener('change', (e) => {
            if (e.target.value === '__NEW__') {
                newClientContainer.style.display = 'block';
                document.getElementById('new-client-name').required = true;
            } else {
                newClientContainer.style.display = 'none';
                document.getElementById('new-client-name').required = false;
            }
        });
    }

    const regularForm = document.getElementById('add-regular-form');
    if (regularForm) {
        regularForm.onsubmit = (e) => {
            e.preventDefault();
            
            let client = clientSelect ? clientSelect.value : '';
            if (client === '__NEW__') {
                client = document.getElementById('new-client-name').value.trim();
            }

            if (!client) {
                alert('אנא בחר או הכנס שם לקוח');
                return;
            }

            const type = document.getElementById('job-type').value;
            const location = document.getElementById('job-location').value;
            const date = document.getElementById('job-date').value;
            const amount = parseFloat(document.getElementById('job-amount').value) || 0;
            const isPaid = document.getElementById('job-status').value === 'true';

            const monthKey = date.substring(0, 7);

            const newEvent = {
                id: Date.now(),
                date,
                client,
                type,
                location,
                amount,
                isPaid,
                isIchilov: false
            };

            if (!currentData[monthKey]) currentData[monthKey] = [];
            currentData[monthKey].push(newEvent);

            hasUnsavedChanges = true;
            regularForm.reset();
            if (newClientContainer) newClientContainer.style.display = 'none';
            renderDashboard();
            showStatusMessage('אירוע נוצר! לחץ "שמור שינויים" לעדכון הקובץ.');
        };
    }

    const ichilovForm = document.getElementById('add-ichilov-form');
    if (ichilovForm) {
        ['ichilov-show-type', 'ichilov-km', 'ichilov-time-there', 'ichilov-time-back'].forEach(id => {
            const input = document.getElementById(id);
            if (input) {
                input.addEventListener('input', updateIchilovPreview);
                input.addEventListener('change', updateIchilovPreview);
            }
        });

        ichilovForm.onsubmit = (e) => {
            e.preventDefault();
            const date = document.getElementById('ichilov-date').value;
            const location = document.getElementById('ichilov-location').value;
            const showType = document.getElementById('ichilov-show-type').value;
            const kmOneWay = parseFloat(document.getElementById('ichilov-km').value) || 0;
            const timeThere = document.getElementById('ichilov-time-there').value;
            const timeBack = document.getElementById('ichilov-time-back').value;
            const isPaid = document.getElementById('ichilov-status').value === 'true';

            const calc = calculateIchilov(showType, kmOneWay, timeThere, timeBack);
            const monthKey = date.substring(0, 7);

            const newEvent = {
                id: Date.now(),
                date,
                client: 'החברה מאיכילוב',
                type: `מופע (${showType})`,
                location,
                amount: calc.totalPay,
                isPaid,
                isIchilov: true,
                ichilovData: {
                    showType,
                    kmOneWay,
                    timeThere,
                    timeBack,
                    location,
                    calcDetails: calc
                }
            };

            if (!currentData[monthKey]) currentData[monthKey] = [];
            currentData[monthKey].push(newEvent);

            hasUnsavedChanges = true;
            renderDashboard();
            ichilovForm.reset();
            updateIchilovPreview();
            showStatusMessage('מופע איכילוב נוסף! לחץ "שמור שינויים" לעדכון הקובץ.');
        };
    }
}

// ==========================================
// 9. אתחול האפליקציה בטעינה
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    setupModal();
    setupTabs();
    setupForms();

    const monthSelect = document.getElementById('month-select');
    if (monthSelect) {
        monthSelect.addEventListener('change', (e) => {
            selectedMonth = e.target.value;
            renderDashboard();
        });
    }

    loadData();
});
