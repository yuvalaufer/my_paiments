// משתנים גלובליים
let globalData = {};
let currentSha = null;

const ICHILOV_NAME = "החברה מאיכילוב";

// טעינה ראשונית
document.addEventListener('DOMContentLoaded', () => {
    const today = new Date();
    const currentMonthStr = today.toISOString().slice(0, 7);
    document.getElementById('month-select').value = currentMonthStr;
    document.getElementById('job-date').valueAsDate = today;
    document.getElementById('ich-date').valueAsDate = today;

    loadConfigUI();
    fetchDataFromGitHub();

    // מאזינים לאירועים
    document.getElementById('month-select').addEventListener('change', renderAllTables);
    document.getElementById('add-regular-form').addEventListener('submit', handleAddRegularJob);
    document.getElementById('add-ichilov-form').addEventListener('submit', handleAddIchilovJob);
    
    // החלפת טפסים
    document.getElementById('toggle-regular-form').addEventListener('click', () => switchForm('regular'));
    document.getElementById('toggle-ichilov-form').addEventListener('click', () => switchForm('ichilov'));

    // חישוב בזמן אמת לטופס איכילוב
    const ichInputs = ['ich-type', 'ich-km-one-way', 'ich-time-there', 'ich-time-back'];
    ichInputs.forEach(id => {
        document.getElementById(id).addEventListener('input', calculateIchilovLive);
    });

    // ניהול מודאל
    document.getElementById('config-btn').addEventListener('click', () => toggleModal(true));
    document.getElementById('close-config-btn').addEventListener('click', () => toggleModal(false));
    document.getElementById('save-config-btn').addEventListener('click', saveConfig);
});

// החלפת טפסים
function switchForm(type) {
    const regForm = document.getElementById('add-regular-form');
    const ichForm = document.getElementById('add-ichilov-form');
    const regBtn = document.getElementById('toggle-regular-form');
    const ichBtn = document.getElementById('toggle-ichilov-form');

    if (type === 'regular') {
        regForm.classList.remove('hidden');
        ichForm.classList.add('hidden');
        regBtn.classList.add('active');
        ichBtn.classList.remove('active');
    } else {
        regForm.classList.add('hidden');
        ichForm.classList.remove('hidden');
        regBtn.classList.remove('active');
        ichBtn.classList.add('active');
        calculateIchilovLive();
    }
}

// לוגיקת החישוב המדויקת של איכילוב
function computeIchilovDetails(showType, kmOneWay, timeThereStr, timeBackStr) {
    // 1. תשלום מופע
    const basePay = showType === 'ארוך' ? 840 : 670;

    // 2. החזר ק"מ (ק"מ לכיוון * 2 * 0.5 = ק"מ לכיוון)
    const kmOneWayNum = parseFloat(kmOneWay) || 0;
    const kmPay = kmOneWayNum; 

    // 3. החזר זמן נסיעה
    const parseMins = (str) => {
        if (!str) return 0;
        const [h, m] = str.split(':').map(Number);
        return (h || 0) * 60 + (m || 0);
    };

    const totalMins = parseMins(timeThereStr) + parseMins(timeBackStr);
    
    // פורמט מחרוזת זמן כולל (HH:MM)
    const totalHoursStr = `${Math.floor(totalMins / 60)}:${String(totalMins % 60).padStart(2, '0')}`;

    let timeOverTwoHoursMins = 0;
    let timePay = 0;
    let excessHoursStr = "0:00";

    if (totalMins > 120) {
        timeOverTwoHoursMins = totalMins - 120;
        const excessH = Math.floor(timeOverTwoHoursMins / 60);
        const excessM = timeOverTwoHoursMins % 60;
        excessHoursStr = `${excessH}:${String(excessM).padStart(2, '0')}`;

        // כל שעה נוספת או חלק ממנה = 70 ₪
        const extraBlocks = Math.ceil(timeOverTwoHoursMins / 60);
        timePay = extraBlocks * 70;
    }

    const totalPay = basePay + kmPay + timePay;

    return {
        basePay,
        kmPay,
        timePay,
        totalPay,
        totalHoursStr,
        excessHoursStr
    };
}

// חישוב בלייב בתוך הטופס
function calculateIchilovLive() {
    const showType = document.getElementById('ich-type').value;
    const kmOneWay = document.getElementById('ich-km-one-way').value;
    const timeThere = document.getElementById('ich-time-there').value;
    const timeBack = document.getElementById('ich-time-back').value;

    const res = computeIchilovDetails(showType, kmOneWay, timeThere, timeBack);

    document.getElementById('calc-show-pay').textContent = `₪${res.basePay}`;
    document.getElementById('calc-km-pay').textContent = `₪${res.kmPay}`;
    document.getElementById('calc-time-pay').textContent = `₪${res.timePay}`;
    document.getElementById('calc-total-pay').textContent = `₪${res.totalPay}`;
}

// ניהול מודאל ותקשורת GitHub
function toggleModal(show) {
    document.getElementById('config-modal').classList.toggle('hidden', !show);
}

function saveConfig() {
    localStorage.setItem('gh_owner', document.getElementById('gh-owner').value.trim());
    localStorage.setItem('gh_repo', document.getElementById('gh-repo').value.trim());
    localStorage.setItem('gh_token', document.getElementById('gh-token').value.trim());
    toggleModal(false);
    fetchDataFromGitHub();
}

function loadConfigUI() {
    document.getElementById('gh-owner').value = localStorage.getItem('gh_owner') || '';
    document.getElementById('gh-repo').value = localStorage.getItem('gh_repo') || '';
    document.getElementById('gh-token').value = localStorage.getItem('gh_token') || '';
}

async function fetchDataFromGitHub() {
    const owner = localStorage.getItem('gh_owner');
    const repo = localStorage.getItem('gh_repo');
    const token = localStorage.getItem('gh_token');
    const statusEl = document.getElementById('sync-status');

    if (!owner || !repo || !token) {
        statusEl.textContent = '⚠️ יש להגדיר חיבור ל-GitHub';
        return;
    }

    statusEl.textContent = '🔄 טוען נתונים...';

    try {
        const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/data.json`, {
            headers: { 'Authorization': `token ${token}` }
        });

        if (response.ok) {
            const fileData = await response.json();
            currentSha = fileData.sha;
            const contentDecoded = decodeURIComponent(escape(atob(fileData.content)));
            globalData = JSON.parse(contentDecoded);
            statusEl.textContent = '✅ מחובר ומסונכרן';
            renderAllTables();
        } else if (response.status === 404) {
            globalData = {};
            statusEl.textContent = 'ℹ️ קובץ חדש (אין נתונים עדיין)';
            renderAllTables();
        }
    } catch (err) {
        console.error(err);
        statusEl.textContent = '❌ שגיאה בטעינת הנתונים';
    }
}

async function saveAndCommitToGitHub(commitMessage) {
    const owner = localStorage.getItem('gh_owner');
    const repo = localStorage.getItem('gh_repo');
    const token = localStorage.getItem('gh_token');
    const statusEl = document.getElementById('sync-status');

    if (!owner || !repo || !token) {
        alert('נא להגדיר פרטי GitHub בהגדרות');
        return;
    }

    statusEl.textContent = '⏳ מבצע Commit אוטומטי...';

    const jsonString = JSON.stringify(globalData, null, 2);
    const contentEncoded = btoa(unescape(encodeURIComponent(jsonString)));

    const bodyData = {
        message: commitMessage,
        content: contentEncoded,
        sha: currentSha || undefined
    };

    try {
        const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/data.json`, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(bodyData)
        });

        if (response.ok) {
            const resData = await response.json();
            currentSha = resData.content.sha;
            statusEl.textContent = '✅ השינוי נשמר ב-Repo!';
        } else {
            throw new Error('שגיאה בשמירה');
        }
    } catch (err) {
        console.error(err);
        statusEl.textContent = '❌ שמירה נכשלה';
    }
}

// הוספת עבודה רגילה
function handleAddRegularJob(e) {
    e.preventDefault();
    const dateVal = document.getElementById('job-date').value;
    const monthKey = dateVal.slice(0, 7);

    const newJob = {
        id: Date.now(),
        client: document.getElementById('client-name').value,
        type: document.getElementById('job-type').value,
        date: dateVal,
        amount: parseFloat(document.getElementById('job-amount').value),
        isPaid: document.getElementById('job-status').value === 'true',
        isIchilov: false
    };

    if (!globalData[monthKey]) globalData[monthKey] = [];
    globalData[monthKey].push(newJob);

    document.getElementById('month-select').value = monthKey;
    renderAllTables();
    saveAndCommitToGitHub(`הוספת עבודה: ${newJob.client}`);

    document.getElementById('client-name').value = '';
    document.getElementById('job-amount').value = '';
}

// הוספת מופע איכילוב
function handleAddIchilovJob(e) {
    e.preventDefault();
    const dateVal = document.getElementById('ich-date').value;
    const monthKey = dateVal.slice(0, 7);

    const location = document.getElementById('ich-location').value;
    const showType = document.getElementById('ich-type').value;
    const kmOneWay = document.getElementById('ich-km-one-way').value;
    const timeThere = document.getElementById('ich-time-there').value;
    const timeBack = document.getElementById('ich-time-back').value;
    const isPaid = document.getElementById('ich-status').value === 'true';

    const calc = computeIchilovDetails(showType, kmOneWay, timeThere, timeBack);

    const newIchilovJob = {
        id: Date.now(),
        client: ICHILOV_NAME,
        type: `מופע (${showType})`,
        date: dateVal,
        amount: calc.totalPay,
        isPaid: isPaid,
        isIchilov: true,
        // נתוני חישוב מפורטים
        ichilovData: {
            location: location,
            showType: showType,
            kmOneWay: kmOneWay,
            timeThere: timeThere,
            timeBack: timeBack,
            calcDetails: calc
        }
    };

    if (!globalData[monthKey]) globalData[monthKey] = [];
    globalData[monthKey].push(newIchilovJob);

    document.getElementById('month-select').value = monthKey;
    renderAllTables();
    saveAndCommitToGitHub(`הוספת מופע איכילוב: ${location} (${dateVal})`);

    document.getElementById('ich-location').value = '';
    document.getElementById('ich-km-one-way').value = '';
}

// רינדור כל הטבלאות והסיכומים
function renderAllTables() {
    const selectedMonth = document.getElementById('month-select').value;
    const monthData = globalData[selectedMonth] || [];

    // 1. טבלה כללית
    const mainTbody = document.getElementById('table-body');
    mainTbody.innerHTML = '';

    let totalExpected = 0;
    let totalPaid = 0;
    let totalUnpaid = 0;

    monthData.forEach((item) => {
        const tr = document.createElement('tr');
        tr.className = item.isPaid ? 'row-paid' : 'row-unpaid';

        const amount = parseFloat(item.amount) || 0;
        totalExpected += amount;
        if (item.isPaid) totalPaid += amount;
        else totalUnpaid += amount;

        const clientDisplay = item.isIchilov ? 
            `${escapeHtml(item.client)} <span class="ichilov-tag">איכילוב</span>` : 
            escapeHtml(item.client);

        tr.innerHTML = `
            <td>${item.date}</td>
            <td>${clientDisplay}</td>
            <td>${item.type}</td>
            <td>₪${amount.toLocaleString()}</td>
            <td>
                <button class="status-btn ${item.isPaid ? 'paid' : 'unpaid'}" onclick="toggleStatus('${selectedMonth}', ${item.id})">
                    ${item.isPaid ? '✓ שולם' : '✗ לא שולם'}
                </button>
            </td>
            <td>
                <button class="delete-btn" onclick="deleteItem('${selectedMonth}', ${item.id})" title="מחק">🗑️</button>
            </td>
        `;
        mainTbody.appendChild(tr);
    });

    document.getElementById('total-expected').textContent = `₪${totalExpected.toLocaleString()}`;
    document.getElementById('total-paid').textContent = `₪${totalPaid.toLocaleString()}`;
    document.getElementById('total-unpaid').textContent = `₪${totalUnpaid.toLocaleString()}`;

    // 2. טבלת פירוט איכילוב
    const ichTbody = document.getElementById('ichilov-table-body');
    ichTbody.innerHTML = '';

    const ichilovItems = monthData.filter(i => i.isIchilov);
    let ichilovMonthTotal = 0;

    ichilovItems.forEach(item => {
        const d = item.ichilovData;
        const calc = d.calcDetails;
        ichilovMonthTotal += calc.totalPay;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${item.date}</td>
            <td>${escapeHtml(d.location)}</td>
            <td>${calc.totalHoursStr}</td>
            <td>${calc.excessHoursStr}</td>
            <td>₪${calc.basePay}</td>
            <td>₪${calc.kmPay}</td>
            <td>₪${calc.timePay}</td>
            <td><strong>₪${calc.totalPay.toLocaleString()}</strong></td>
        `;
        ichTbody.appendChild(tr);
    });

    document.getElementById('ichilov-month-summary-label').textContent = `סה"כ לתשלום – חודש ${selectedMonth}:`;
    document.getElementById('ichilov-month-summary-amount').textContent = `₪${ichilovMonthTotal.toLocaleString()}`;
}

// שינוי סטטוס
function toggleStatus(month, id) {
    const item = globalData[month].find(i => i.id === id);
    if (!item) return;
    
    item.isPaid = !item.isPaid;
    renderAllTables();
    saveAndCommitToGitHub(`עדכון סטטוס תשלום: ${item.client}`);
}

// מחיקה
function deleteItem(month, id) {
    if (confirm('האם למחוק שורה זו?')) {
        const index = globalData[month].findIndex(i => i.id === id);
        if (index !== -1) {
            const item = globalData[month][index];
            globalData[month].splice(index, 1);
            renderAllTables();
            saveAndCommitToGitHub(`מחיקת שורה: ${item.client}`);
        }
    }
}

function escapeHtml(text) {
    return text.replace(/[&<>"']/g, function(m) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m];
    });
}
