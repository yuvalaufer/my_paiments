// ==========================================
// 1. משתנים גלובליים וניהול הגדרות GitHub
// ==========================================
let currentData = {};
let selectedMonth = "";
let hasUnsavedChanges = false;

function getGithubConfig() {
    return {
        username: localStorage.getItem('gh_username') || '',
        repo: localStorage.getItem('gh_repo') || '',
        token: localStorage.getItem('gh_token') || ''
    };
}

function showStatusMessage(text, isError = false) {
    const statusEl = document.getElementById('status-message');
    if (statusEl) {
        statusEl.textContent = text;
        statusEl.style.color = isError ? '#d9534f' : '#28a745';
        setTimeout(() => { statusEl.textContent = ''; }, 5000);
    }
}

// פונקציות עזר לקידוד UTF-8 ב-Base64 בשביל עברית
function utf8ToBase64(str) {
    return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, function(match, p1) {
        return String.fromCharCode('0x' + p1);
    }));
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

            // 1. רינדור טבלה כללית
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

            // 2. רינדור טבלת איכילוב
            if (item.isIchilov && ichilovList) {
                const iData = item.ichilovData || {};
                
                const tThere = iData.timeThere || 0;
                const tBack = iData.timeBack || 0;
                const totalMins = parseTimeToMinutes(tThere) + parseTimeToMinutes(tBack);
                const hoursFormatted = formatMinutesToHHMM(totalMins);

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
                    <td>${calc.totalHoursStr || hoursFormatted}</td>
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

    // עדכון כרטיסי הסיכום
    const elTotal = document.getElementById('total-amount');
    const elPaid = document.getElementById('paid-amount');
    const elUnpaid = document.getElementById('unpaid-amount');

    if (elTotal) elTotal.textContent = `₪${totalAll.toLocaleString()}`;
    if (elPaid) elPaid.textContent = `₪${totalPaid.toLocaleString()}`;
    if (elUnpaid) elUnpaid.textContent = `₪${totalUnpaid.toLocaleString()}`;

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
                    style="background-color: #28a745; color: white; padding: 12px 28px; border: none; border-radius: 8px; font-size: 16px; font-weight: bold; cursor: pointer; box-shadow: 0 4px 6px rgba(0,0,0,0.15);">
                💾 שמור שינויים ל-GitHub
            </button>
        `;
    } else {
        saveBtnContainer.innerHTML = '';
    }
}

// ==========================================
// 5. שינוי סטטוס תשלום + שמירה מתוקנת ל-GitHub
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
        showStatusMessage('חסרים פרטי התחברות ל-GitHub (משתמש/מאגר/טוקן). בדוק בהגדרות.', true);
        return;
    }

    showStatusMessage('שומר שינויים ב-GitHub...');

    try {
        const url = `https://api.github.com/repos/${config.username}/${config.repo}/contents/data.json`;
        
        // 1. קבלת ה-SHA הנוכחי של הקובץ מ-GitHub
        const getRes = await fetch(url, {
            headers: { 
                'Authorization': `token ${config.token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        if (!getRes.ok) {
            throw new Error(`שגיאה בשליפת קובץ מ-GitHub (${getRes.status})`);
        }

        const getData = await getRes.json();
        const sha = getData.sha;

        // 2. המרת ה-JSON למחרוזת וקידוד נכון בעברית ל-Base64
        const jsonString = JSON.stringify(currentData, null, 2);
        const contentEncoded = utf8ToBase64(jsonString);

        // 3. עדכון הקובץ ב-Commit
        const putRes = await fetch(url, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${config.token}`,
                'Content-Type': 'application/json',
                'Accept': 'application/vnd.github.v3+json'
            },
            body: JSON.stringify({
                message: 'עדכון סטטוס תשלומים מתוך ה-Dashboard',
                content: contentEncoded,
                sha: sha
            })
        });

        if (putRes.ok) {
            hasUnsavedChanges = false;
            renderDashboard();
            showStatusMessage('השינויים נשמרו בהצלחה ב-GitHub!');
        } else {
            const errData = await putRes.json();
            throw new Error(errData.message || 'שגיאה בשמירה ל-GitHub');
        }
    } catch (err) {
        console.error("GitHub Save Error:", err);
        showStatusMessage(`שגיאה בשמירה: ${err.message}`, true);
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

    if (btn && modal) {
        btn.onclick = () => {
            const config = getGithubConfig();
            document.getElementById('github-username').value = config.username;
            document.getElementById('github-repo').value = config.repo;
            document.getElementById('github-token').value = config.token;
            modal.style.display = 'block';
        };
    }

    if (closeBtn && modal) {
        closeBtn.onclick = () => {
            modal.style.display = 'none';
        };
    }

    window.onclick = (event) => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    };

    if (form) {
        form.onsubmit = (e) => {
            e.preventDefault();
            const username = document.getElementById('github-username').value.trim();
            const repo = document.getElementById('github-repo').value.trim();
            const token = document.getElementById('github-token').value.trim();

            localStorage.setItem('gh_username', username);
            localStorage.setItem('gh_repo', repo);
            localStorage.setItem('gh_token', token);

            showStatusMessage('ההגדרות נשמרו בהצלחה!');
            modal.style.display = 'none';
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
    const regularForm = document.getElementById('add-regular-form');
    if (regularForm) {
        regularForm.onsubmit = (e) => {
            e.preventDefault();
            const client = document.getElementById('client-name').value;
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
            renderDashboard();
            regularForm.reset();
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
