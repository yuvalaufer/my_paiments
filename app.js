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

// פונקציית עזר חדשה לקריאת שדות שעות ודקות נפרדים
function getDurationMinutes(prefix, fieldName) {
    const hoursEl = document.getElementById(`${prefix}ichilov-${fieldName}-hours`);
    const minsEl = document.getElementById(`${prefix}ichilov-${fieldName}-mins`);
    
    const hours = hoursEl ? (parseInt(hoursEl.value, 10) || 0) : 0;
    const mins = minsEl ? (parseInt(minsEl.value, 10) || 0) : 0;
    
    return (hours * 60) + mins;
}

// ==========================================
// 3. מחשבון איכילוב (עם תמיכה במספר מופעים ומקטעי ק"מ)
// ==========================================
function calculateIchilovAdvanced(showsTypesArray, kmSegmentsArray, totalMins) {
    let basePay = 0;
    showsTypesArray.forEach(type => {
        basePay += (type === "ארוך") ? 840 : 670;
    });

    let totalKm = 0;
    kmSegmentsArray.forEach(km => {
        totalKm += (parseFloat(km) || 0);
    });
    const kmPay = totalKm * 0.5;

    let excessMins = 0;
    let timePay = 0;
    if (totalMins > 120) {
        excessMins = totalMins - 120;
        timePay = Math.round(Math.ceil(excessMins / 60) * 70);
    }

    const totalPay = basePay + kmPay + timePay;

    return {
        basePay,
        kmPay,
        timePay,
        totalPay,
        totalKm,
        totalMins,
        excessMins,
        totalHoursStr: formatMinutesToHHMM(totalMins),
        excessHoursStr: formatMinutesToHHMM(excessMins)
    };
}

function renderIchilovDynamicFields(prefix = '') {
    const countSelect = document.getElementById(`${prefix}ichilov-shows-count`);
    const typesContainer = document.getElementById(`${prefix}ichilov-shows-types-container`);
    const kmContainer = document.getElementById(`${prefix}ichilov-km-container`);
    const extraTimesContainer = document.getElementById(`${prefix}ichilov-extra-times-container`);

    if (!countSelect || !typesContainer || !kmContainer) return;

    const count = parseInt(countSelect.value, 10) || 1;

    if (extraTimesContainer) {
        extraTimesContainer.style.display = count > 1 ? 'block' : 'none';
    }

    let typesHTML = '<strong>סוג מופע לכל אחד מהמופעים:</strong><div style="display: flex; gap: 10px; margin-top: 8px; flex-wrap: wrap;">';
    for (let i = 1; i <= count; i++) {
        typesHTML += `
            <div style="flex: 1; min-width: 140px;">
                <label style="font-size: 13px;">מופע #${i}:</label>
                <select id="${prefix}ichilov-show-type-${i}" class="form-control ichilov-dynamic-type" data-index="${i}">
                    <option value="רגיל">רגיל (₪670)</option>
                    <option value="ארוך">ארוך (₪840)</option>
                </select>
            </div>
        `;
    }
    typesHTML += '</div>';
    typesContainer.innerHTML = typesHTML;

    let kmHTML = '<strong>קילומטראז\' למקטעי המסלול (בק"מ):</strong><div style="display: flex; gap: 10px; margin-top: 8px; flex-wrap: wrap;">';
    
    if (count === 1) {
        kmHTML += `
            <div style="flex: 1; min-width: 180px;">
                <label style="font-size: 13px;">ק"מ הלוך (יחושב כהלוך-חזור):</label>
                <input type="number" id="${prefix}ichilov-km-1" class="form-control ichilov-dynamic-km" min="0" step="0.1" placeholder="0" required value="0">
            </div>
        `;
    } else {
        kmHTML += `
            <div style="flex: 1; min-width: 150px;">
                <label style="font-size: 13px;">בית ➔ מופע 1:</label>
                <input type="number" id="${prefix}ichilov-km-1" class="form-control ichilov-dynamic-km" min="0" step="0.1" placeholder="0" required value="0">
            </div>
        `;
        for (let i = 1; i < count; i++) {
            kmHTML += `
                <div style="flex: 1; min-width: 150px;">
                    <label style="font-size: 13px;">מופע ${i} ➔ מופע ${i+1}:</label>
                    <input type="number" id="${prefix}ichilov-km-${i+1}" class="form-control ichilov-dynamic-km" min="0" step="0.1" placeholder="0" required value="0">
                </div>
            `;
        }
        kmHTML += `
            <div style="flex: 1; min-width: 150px;">
                <label style="font-size: 13px;">מופע ${count} ➔ הביתה:</label>
                <input type="number" id="${prefix}ichilov-km-${count+1}" class="form-control ichilov-dynamic-km" min="0" step="0.1" placeholder="0" required value="0">
            </div>
        `;
    }
    kmHTML += '</div>';
    kmContainer.innerHTML = kmHTML;

    attachIchilovListeners(prefix);
}

function gatherIchilovInputsData(prefix = '') {
    const countSelect = document.getElementById(`${prefix}ichilov-shows-count`);
    const count = countSelect ? parseInt(countSelect.value, 10) || 1 : 1;

    const showsTypesArray = [];
    for (let i = 1; i <= count; i++) {
        const typeEl = document.getElementById(`${prefix}ichilov-show-type-${i}`);
        showsTypesArray.push(typeEl ? typeEl.value : 'רגיל');
    }

    const kmSegmentsArray = [];
    const kmFieldsCount = (count === 1) ? 1 : (count + 1);
    for (let i = 1; i <= kmFieldsCount; i++) {
        const kmEl = document.getElementById(`${prefix}ichilov-km-${i}`);
        const val = kmEl ? parseFloat(kmEl.value) || 0 : 0;
        if (count === 1) {
            kmSegmentsArray.push(val * 2);
        } else {
            kmSegmentsArray.push(val);
        }
    }

    const timeThere = getDurationMinutes(prefix, 'there');
    const timeBack = getDurationMinutes(prefix, 'back');
    const timeTransfers = getDurationMinutes(prefix, 'transfers');
    const totalMins = timeThere + timeBack + timeTransfers;

    return {
        count,
        showsTypesArray,
        kmSegmentsArray,
        totalMins,
        timeThere,
        timeBack,
        timeTransfers
    };
}

function updateIchilovPreviewUnified(prefix = '') {
    const data = gatherIchilovInputsData(prefix);
    const calc = calculateIchilovAdvanced(data.showsTypesArray, data.kmSegmentsArray, data.totalMins);

    const previewEl = document.getElementById(prefix ? 'modal-calc-breakdown' : 'calc-breakdown');
    if (previewEl) {
        previewEl.innerHTML = `שכר בסיס (${data.count} מופעים): ₪${calc.basePay} | נסיעות: ₪${calc.kmPay} (${calc.totalKm} ק"מ) | תוספת זמן: ₪${calc.timePay} (${calc.totalHoursStr}) | <strong>סה"כ: ₪${calc.totalPay}</strong>`;
    }
}

function attachIchilovListeners(prefix = '') {
    const countSelect = document.getElementById(`${prefix}ichilov-shows-count`);
    if (countSelect && !countSelect.dataset.listenerAttached) {
        countSelect.dataset.listenerAttached = 'true';
        countSelect.addEventListener('change', () => {
            renderIchilovDynamicFields(prefix);
            updateIchilovPreviewUnified(prefix);
        });
    }

    const container = document.getElementById(prefix ? 'ichilov-modal' : 'ichilov-form');
    if (container) {
        container.querySelectorAll('input, select').forEach(el => {
            if (!el.dataset.listenerAttached) {
                el.dataset.listenerAttached = 'true';
                el.addEventListener('input', () => updateIchilovPreviewUnified(prefix));
                el.addEventListener('change', () => updateIchilovPreviewUnified(prefix));
            }
        });
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
                const calc = iData.calcDetails || calculateIchilovAdvanced(iData.showsTypesArray || ['רגיל'], iData.kmSegmentsArray || [0], iData.totalMins || 0);

                const trI = document.createElement('tr');
                trI.innerHTML = `
                    <td>${item.date || ''}</td>
                    <td>${iData.location || item.location || ''}</td>
                    <td>${iData.showsTypesSummary || item.type || ''}</td>
                    <td>${calc.totalKm || 0} ק"מ</td>
                    <td>${calc.totalHoursStr || '0:00'}</td>
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
    renderGlobalUnpaidTable();
}

// ==========================================
// 5. ניהול טבלת חובות פתוחים גלובלית ומעבר חודש מהיר
// ==========================================
function renderGlobalUnpaidTable() {
    const unpaidListEl = document.getElementById('global-unpaid-list');
    const totalUnpaidSummaryEl = document.getElementById('total-unpaid-summary');
    if (!unpaidListEl) return;

    unpaidListEl.innerHTML = '';
    let grandTotalUnpaid = 0;
    let hasItems = false;

    Object.keys(currentData).sort().forEach(monthKey => {
        const events = currentData[monthKey];
        if (!Array.isArray(events)) return;

        events.forEach(item => {
            if (!item.isPaid) {
                hasItems = true;
                const itemAmount = Number(item.amount) || 0;
                grandTotalUnpaid += itemAmount;

                const tr = document.createElement('tr');
                
                let displayType = item.type || '';
                let displayLocation = item.location || '';
                if (item.isIchilov && item.ichilovData) {
                    displayType = item.ichilovData.showsTypesSummary || item.type;
                    displayLocation = item.ichilovData.location || item.location;
                }

                tr.innerHTML = `
                    <td><strong>${monthKey}</strong></td>
                    <td>${item.date || ''}</td>
                    <td>${item.client || ''}</td>
                    <td>${displayType}</td>
                    <td>${displayLocation}</td>
                    <td><strong>₪${itemAmount.toLocaleString()}</strong></td>
                    <td>
                        <button class="status-btn unpaid" onclick="window.jumpToMonthAndEvent('${monthKey}')" style="cursor: pointer;">
                            🔍 צפה בחודש
                        </button>
                    </td>
                `;
                unpaidListEl.appendChild(tr);
            }
        });
    });

    if (!hasItems) {
        unpaidListEl.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--success-color); font-weight: bold; padding: 20px;">אין תשלומים ממתינים לגבייה! הכל שולם 🌟</td></tr>`;
    }

    if (totalUnpaidSummaryEl) {
        totalUnpaidSummaryEl.textContent = `סך הכל ממתין לגבייה בכל החודשים: ₪${grandTotalUnpaid.toLocaleString()}`;
    }
}

window.jumpToMonthAndEvent = function(monthKey) {
    selectedMonth = monthKey;
    
    const monthPicker = document.getElementById('month-select');
    if (monthPicker) {
        monthPicker.value = monthKey;
    }

    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

    const regularTabBtn = document.querySelector('[data-tab="regular-form"]');
    const regularTabContent = document.getElementById('regular-form');
    if (regularTabBtn) regularTabBtn.classList.add('active');
    if (regularTabContent) regularTabContent.classList.add('active');

    renderDashboard();
    showStatusMessage(`עברת לתצוגת חודש ${monthKey}`);
};

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
// 6. שינוי סטטוס תשלום + שמירה ל-GitHub
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
// 7. ניהול חלון הגדרות GitHub (Modal)
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
// 8. ניהול לשוניות (Tabs)
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
// 9. ניהול מודאל איכילוב מהטופס הראשי
// ==========================================
function setupIchilovModal() {
    const modal = document.getElementById('ichilov-modal');
    const closeBtn = document.getElementById('close-ichilov-modal');
    const form = document.getElementById('modal-ichilov-form');

    if (closeBtn && modal) {
        closeBtn.onclick = () => { modal.style.display = 'none'; };
    }

    renderIchilovDynamicFields('modal-');

    if (form) {
        form.onsubmit = (e) => {
            e.preventDefault();
            const date = document.getElementById('modal-ichilov-date').value;
            const location = document.getElementById('modal-ichilov-location').value;
            const isPaid = document.getElementById('modal-ichilov-status').value === 'true';

            const inputData = gatherIchilovInputsData('modal-');
            const calc = calculateIchilovAdvanced(inputData.showsTypesArray, inputData.kmSegmentsArray, inputData.totalMins);
            const monthKey = date.substring(0, 7);

            const showsTypesSummary = inputData.showsTypesArray.map((t, idx) => `מופע ${idx+1} (${t})`).join(', ');

            const newEvent = {
                id: Date.now(),
                date,
                client: 'החברה מאיכילוב',
                type: `${inputData.count} מופעים`,
                location,
                amount: calc.totalPay,
                isPaid,
                isIchilov: true,
                ichilovData: {
                    showsCount: inputData.count,
                    showsTypesArray: inputData.showsTypesArray,
                    showsTypesSummary,
                    kmSegmentsArray: inputData.kmSegmentsArray,
                    timeThere: inputData.timeThere,
                    timeBack: inputData.timeBack,
                    timeTransfers: inputData.timeTransfers,
                    totalMins: inputData.totalMins,
                    location,
                    calcDetails: calc
                }
            };

            if (!currentData[monthKey]) currentData[monthKey] = [];
            currentData[monthKey].push(newEvent);

            hasUnsavedChanges = true;
            renderDashboard();
            form.reset();
            renderIchilovDynamicFields('modal-');
            if (modal) modal.style.display = 'none';
            showStatusMessage('מופע איכילוב נוסף בהצלחה! לחץ "שמור שינויים".');
        };
    }
}

// ==========================================
// 10. הוספת אירועים (כולל האזנה לבחירת איכילוב בטופס הראשי)
// ==========================================
function setupForms() {
    const clientSelect = document.getElementById('client-select');
    const newClientContainer = document.getElementById('new-client-container');

    if (clientSelect && newClientContainer) {
        clientSelect.addEventListener('change', (e) => {
            const selectedVal = e.target.value;
            if (selectedVal === 'החברה מאיכילוב') {
                const ichilovModal = document.getElementById('ichilov-modal');
                if (ichilovModal) {
                    ichilovModal.style.display = 'block';
                    clientSelect.value = "";
                }
            } else if (selectedVal === '__NEW__') {
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

    renderIchilovDynamicFields('');

    const ichilovForm = document.getElementById('add-ichilov-form');
    if (ichilovForm) {
        ichilovForm.onsubmit = (e) => {
            e.preventDefault();
            const date = document.getElementById('ichilov-date').value;
            const location = document.getElementById('ichilov-location').value;
            const isPaid = document.getElementById('ichilov-status').value === 'true';

            const inputData = gatherIchilovInputsData('');
            const calc = calculateIchilovAdvanced(inputData.showsTypesArray, inputData.kmSegmentsArray, inputData.totalMins);
            const monthKey = date.substring(0, 7);

            const showsTypesSummary = inputData.showsTypesArray.map((t, idx) => `מופע ${idx+1} (${t})`).join(', ');

            const newEvent = {
                id: Date.now(),
                date,
                client: 'החברה מאיכילוב',
                type: `${inputData.count} מופעים`,
                location,
                amount: calc.totalPay,
                isPaid,
                isIchilov: true,
                ichilovData: {
                    showsCount: inputData.count,
                    showsTypesArray: inputData.showsTypesArray,
                    showsTypesSummary,
                    kmSegmentsArray: inputData.kmSegmentsArray,
                    timeThere: inputData.timeThere,
                    timeBack: inputData.timeBack,
                    timeTransfers: inputData.timeTransfers,
                    totalMins: inputData.totalMins,
                    location,
                    calcDetails: calc
                }
            };

            if (!currentData[monthKey]) currentData[monthKey] = [];
            currentData[monthKey].push(newEvent);

            hasUnsavedChanges = true;
            renderDashboard();
            ichilovForm.reset();
            renderIchilovDynamicFields('');
            updateIchilovPreviewUnified('');
            showStatusMessage('מופע איכילוב נוסף! לחץ "שמור שינויים" לעדכון הקובץ.');
        };
    }
}

// ==========================================
// 11. אתחול האפליקציה בטעינה
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    setupModal->() => {}; // handled below
    setupModal();
    setupTabs();
    setupForms();
    setupIchilovModal();

    const monthSelect = document.getElementById('month-select');
    if (monthSelect) {
        monthSelect.addEventListener('change', (e) => {
            const newMonth = e.target.value;
            
            if (!newMonth) {
                e.target.value = selectedMonth;
                showStatusMessage('פעולת איפוס החודש בוטלה כדי למנוע היעלמות נתונים.', true);
                return;
            }

            selectedMonth = newMonth;
            renderDashboard();
        });
    }

    loadData();
});
