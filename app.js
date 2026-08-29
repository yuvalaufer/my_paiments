// משתנים גלובליים למצב האפליקציה
let currentData = {
    clients: [],
    payments: [],
    ichilovShows: []
};

// מפתח לאחסון מקומי ונתוני GitHub
const STORAGE_KEYS = {
    GITHUB_CONFIG: 'github_config',
    CURRENT_MONTH: 'current_selected_month'
};

// הגדרות ברירת מחדל לחישוב איכילוב
const ICHILOV_CONFIG = {
    baseRate: 450,          // שכר בסיס למופע ראשון
    extraShowRate: 300,     // שכר למופע נוסף באותו יום
    kmRate: 2.2,            // תעריף לק"מ
    hourlyRate: 60,         // תעריף לשעה עבור זמני נסיעה
    minTravelHours: 1.5     // מינימום שעות נסיעה מזוכות (אם הנסיעה קצרה ממנו)
};

document.addEventListener('DOMContentLoaded', () => {
    // אתחול חודש נוכחי בבורר החודשים (או טעינה מה-LocalStorage)
    initMonthSelector();
    
    // טעינת הגדרות GitHub אם קיימות
    loadGitHubConfigToUI();

    // אתחול מאזיני אירועים ללשוניות
    initTabs();

    // הגדרת תאריך ברירת מחדל בטפסים להיום
    setDefaultDates();

    // טעינת נתונים ראשונית (מ-GitHub או מקומי)
    loadData().then(() => {
        populateClientDropdown();
        renderAll();
    });

    // האזנה לשינוי בבורר החודשים
    document.getElementById('month-select').addEventListener('change', (e) => {
        localStorage.setItem(STORAGE_KEYS.CURRENT_MONTH, e.target.value);
        renderAll();
    });

    // מאזיני אירועים לטפסים ולמודאלים
    initFormListeners();
    initModalListeners();
    initIchilovCalculatorLogic('main');
    initIchilovCalculatorLogic('modal');
});

/* ==========================================
   ניהול תאריכים ולשוניות
   ========================================== */

function initMonthSelector() {
    const monthSelect = document.getElementById('month-select');
    const savedMonth = localStorage.getItem(STORAGE_KEYS.CURRENT_MONTH);
    
    if (savedMonth) {
        monthSelect.value = savedMonth;
    } else {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        monthSelect.value = `${year}-${month}`;
        localStorage.setItem(STORAGE_KEYS.CURRENT_MONTH, monthSelect.value);
    }
}

function setDefaultDates() {
    const today = new Date().toISOString().split('T')[0];
    const dateInputs = ['job-date', 'ichilov-date', 'modal-ichilov-date'];
    dateInputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = today;
    });
}

function initTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.getAttribute('data-tab');
            
            // הסרת active מכל הלשוניות והתוכן
            document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
            
            // הוספת active ללשונית ולתוכן הנבחרים
            button.classList.add('active');
            const targetContent = document.getElementById(targetTab);
            if (targetContent) targetContent.classList.add('active');
        });
    });
}

/* ==========================================
   טעינה ושמירת נתונים (מקומי / GitHub)
   ========================================== */

function getGitHubConfig() {
    const configStr = localStorage.getItem(STORAGE_KEYS.GITHUB_CONFIG);
    return configStr ? JSON.parse(configStr) : null;
}

async function loadData() {
    const config = getGitHubConfig();
    if (config && config.token && config.username && config.repo) {
        try {
            showStatus('טוען נתונים מ-GitHub...', 'info');
            const data = await fetchFromGitHub(config);
            if (data) {
                currentData = data;
                showStatus('הנתונים נטענו בהצלחה מ-GitHub', 'success');
                return;
            }
        } catch (error) {
            console.error('שגיאה בטעינה מ-GitHub, טוען מקומית:', error);
            showStatus('שגיאה בחיבור ל-GitHub, טוען נתונים מקומיים', 'error');
        }
    }
    
    // טעינה מקומית כגיבוי / ברירת מחדל
    const localData = localStorage.getItem('app_saved_data');
    if (localData) {
        try {
            currentData = JSON.parse(localData);
        } catch (e) {
            console.error('שגיאה בפענוח נתונים מקומיים', e);
        }
    } else {
        // נתוני התחלה ריקים או ברירת מחדל
        currentData = {
            clients: ['תלמיד פרטי', 'הרכב מוזיקלי', 'הפקה חיצונית'],
            payments: [],
            ichilovShows: []
        };
    }
}

async function saveData() {
    // שמירה מקומית תמיד
    localStorage.setItem('app_saved_data', JSON.stringify(currentData));

    // שמירה ב-GitHub אם מוגדר
    const config = getGitHubConfig();
    if (config && config.token && config.username && config.repo) {
        try {
            showStatus('שומר שינויים ב-GitHub...', 'info');
            await saveToGitHub(config, currentData);
            showStatus('השינויים נשמרו בהצלחה ב-GitHub!', 'success');
        } catch (error) {
            console.error('שגיאה בשמירה ל-GitHub:', error);
            showStatus('הנתונים נשמרו מקומית, אך השמירה ב-GitHub נכשלה', 'error');
        }
    }
}

/* ==========================================
   אינטגרציית GitHub API (Octokit / Fetch)
   ========================================== */

const DATA_FILE_PATH = 'data.json';

async function fetchFromGitHub(config) {
    const url = `https://api.github.com/repos/${config.username}/${config.repo}/contents/${DATA_FILE_PATH}`;
    const response = await fetch(url, {
        headers: {
            'Authorization': `token ${config.token}`,
            'Accept': 'application/vnd.github.v3+json'
        }
    });

    if (response.status === 404) {
        return null; // הקובץ עוד לא קיים
    }
    if (!response.ok) {
        throw new Error(`GitHub API error: ${response.statusText}`);
    }

    const fileData = await response.json();
    const contentDecoded = decodeURIComponent(escape(atob(fileData.content)));
    return {
        parsedData: JSON.parse(contentDecoded),
        sha: fileData.sha
    };
}

// פונקציית עזר עוקפת לטעינה שחושפת את ה-sha
async function fetchFromGitHubWithSha(config) {
    const url = `https://api.github.com/repos/${config.username}/${config.repo}/contents/${DATA_FILE_PATH}`;
    const response = await fetch(url, {
        headers: {
            'Authorization': `token ${config.token}`,
            'Accept': 'application/vnd.github.v3+json'
        }
    });
    if (!response.ok) return { sha: null };
    const fileData = await response.json();
    const contentDecoded = decodeURIComponent(escape(atob(fileData.content)));
    return {
        data: JSON.parse(contentDecoded),
        sha: fileData.sha
    };
}

async function saveToGitHub(config, dataObj) {
    // נביא קודם את ה-sha העדכני של הקובץ אם קיים
    const existing = await fetchFromGitHubWithSha(config);
    const sha = existing.sha;

    const url = `https://api.github.com/repos/${config.username}/${config.repo}/contents/${DATA_FILE_PATH}`;
    const contentEncoded = btoa(unescape(encodeURIComponent(JSON.stringify(dataObj, null, 2))));

    const body = {
        message: 'Update payment and show tracking data via web app',
        content: contentEncoded
    };
    if (sha) {
        body.sha = sha;
    }

    const response = await fetch(url, {
        method: 'PUT',
        headers: {
            'Authorization': `token ${config.token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/vnd.github.v3+json'
        },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const errJson = await response.json();
        throw new Error(errJson.message || 'Failed to save to GitHub');
    }
}

/* ==========================================
   ניהול ממשק והודעות סטטוס
   ========================================== */

function showStatus(text, type = 'info') {
    const statusEl = document.getElementById('status-message');
    statusEl.textContent = text;
    statusEl.className = `status-message ${type}`;
    statusEl.style.display = 'block';
    
    setTimeout(() => {
        statusEl.style.display = 'none';
    }, 4000);
}

function loadGitHubConfigToUI() {
    const config = getGitHubConfig();
    if (config) {
        document.getElementById('github-username').value = config.username || '';
        document.getElementById('github-repo').value = config.repo || '';
        document.getElementById('github-token').value = config.token || '';
    }
}

/* ==========================================
   לוגיקת מחשבון איכילוב (חישוב אוטומטי ותצוגה מקדימה)
   ========================================== */

function initIchilovCalculatorLogic(mode = 'main') {
    const prefix = mode === 'modal' ? 'modal-ichilov' : 'ichilov';
    
    const showsCountSelect = document.getElementById(`${prefix}-shows-count`);
    const showsTypesContainer = document.getElementById(`${prefix}-shows-types-container`);
    const kmContainer = document.getElementById(`${prefix}-km-container`);
    const extraTimesContainer = document.getElementById(`${prefix}-extra-times-container`);
    
    // שדות זמן נסיעה
    const thereHrsInput = document.getElementById(`${prefix}-time-there-hrs`);
    const thereMinsInput = document.getElementById(`${prefix}-time-there-mins`);
    const backHrsInput = document.getElementById(`${prefix}-time-back-hrs`);
    const backMinsInput = document.getElementById(`${prefix}-time-back-mins`);
    const transHrsInput = document.getElementById(`${prefix}-time-transfers-hrs`);
    const transMinsInput = document.getElementById(`${prefix}-time-transfers-mins`);

    function updateDynamicFields() {
        const count = parseInt(showsCountSelect.value);
        
        // יצירת בחירת סוג מופע לכל מופע
        let typesHtml = '<strong style="display: block; margin-bottom: 8px;">סוגי מופעים:</strong><div class="form-row">';
        for (let i = 1; i <= count; i++) {
            typesHtml.innerHTML += ''; // נבנה באופן נקי למטה
            typesHtml += `
                <div class="form-group">
                    <label>מופע #${i}</label>
                    <select id="${prefix}-show-type-${i}" class="ichilov-show-type-select">
                        <option value="standard">רגיל / סטנדרטי</option>
                        <option value="special">מיוחד / אחר</option>
                    </select>
                </div>
            `;
        }
        typesHtml += '</div>';
        showsTypesContainer.innerHTML = typesHtml;

        // יצירת שדות ק"מ (הלוך, חזור, מעברים) בהתאם לכמות המופעים
        let kmHtml = '<strong style="display: block; margin-bottom: 8px;">מרחקי נסיעה (ק"מ):</strong><div class="form-row">';
        kmHtml += `
            <div class="form-group">
                <label>הלוך (ק"מ)</label>
                <input type="number" id="${prefix}-km-there" min="0" step="any" value="0" required>
            </div>
            <div class="form-group">
                <label>חזור (ק"מ)</label>
                <input type="number" id="${prefix}-km-back" min="0" step="any" value="0" required>
            </div>
        `;
        if (count > 1) {
            kmHtml += `
                <div class="form-group">
                    <label>מעברים בין מופעים (ק"מ)</label>
                    <input type="number" id="${prefix}-km-transfers" min="0" step="any" value="0">
                </div>
            `;
            extraTimesContainer.style.display = 'flex';
        } else {
            extraTimesContainer.style.display = 'none';
        }
        kmHtml += '</div>';
        kmContainer.innerHTML = kmHtml;

        // הוספת האזנות לשינויים לחישוב מחדש
        attachCalculationListeners(prefix);
        calculateIchilovPreview(prefix);
    }

    showsCountSelect.addEventListener('change', updateDynamicFields);
    
    // הרצה ראשונית לבניית השדות
    updateDynamicFields();
}

function attachCalculationListeners(prefix) {
    const container = document.getElementById(prefix === 'modal' ? 'ichilov-modal' : 'add-ichilov-form');
    // האזנה לכל שינוי בתוך הטופס הרלוונטי לצורך עדכון תצוגה מקדימה
    const inputs = container.querySelectorAll('input, select');
    inputs.forEach(input => {
        // הסרת מאזין קודם למניעת כפילויות והוספת חדש
        input.removeEventListener('input', handleInputEvent);
        input.addEventListener('input', handleInputEvent);
        input.removeEventListener('change', handleInputEvent);
        input.addEventListener('change', handleInputEvent);
    });

    function handleInputEvent() {
        calculateIchilovPreview(prefix);
    }
}

function calculateIchilovPreview(prefix) {
    const result = computeIchilovValues(prefix);
    const breakdownEl = document.getElementById(prefix === 'modal' ? 'modal-calc-breakdown' : 'calc-breakdown');
    
    if (!breakdownEl) return;

    if (result.error) {
        breakdownEl.textContent = result.error;
        return;
    }

    breakdownEl.innerHTML = `
        מרחק כולל: <strong>${result.totalKm.toFixed(1)} ק"מ</strong> (${result.formattedKm}) | 
        זמן כולל: <strong>${result.totalTimeFormatted}</strong> (${result.billedHours.toFixed(1)} שש"ז) | 
        שכר בסיס: ₪${result.basePay} | 
        נסיעות (ק"מ+זמן): ₪${result.travelPay.toFixed(0)} | 
        <strong>סה"כ לתשלום: ₪${result.totalPay.toFixed(0)}</strong>
    `;
}

function computeIchilovValues(prefix) {
    const showsCount = parseInt(document.getElementById(`${prefix}-shows-count`).value);
    
    // קריאת מרחקים
    const kmThere = parseFloat(document.getElementById(`${prefix}-km-there`)?.value) || 0;
    const kmBack = parseFloat(document.getElementById(`${prefix}-km-back`)?.value) || 0;
    const kmTransfers = showsCount > 1 ? (parseFloat(document.getElementById(`${prefix}-km-transfers`)?.value) || 0) : 0;
    
    const totalKm = kmThere + kmBack + kmTransfers;

    // קריאת זמנים (הפרדה לשעות ודקות)
    const thereHrs = parseInt(document.getElementById(`${prefix}-time-there-hrs`).value) || 0;
    const thereMins = parseInt(document.getElementById(`${prefix}-time-there-mins`).value) || 0;
    const backHrs = parseInt(document.getElementById(`${prefix}-time-back-hrs`).value) || 0;
    const backMins = parseInt(document.getElementById(`${prefix}-time-back-mins`).value) || 0;
    
    let transHrs = 0;
    let transMins = 0;
    if (showsCount > 1) {
        transHrs = parseInt(document.getElementById(`${prefix}-time-transfers-hrs`)?.value) || 0;
        transMins = parseInt(document.getElementById(`${prefix}-time-transfers-mins`)?.value) || 0;
    }

    const totalMinutes = (thereHrs * 60 + thereMins) + (backHrs * 60 + backMins) + (transHrs * 60 + transMins);
    const totalHoursDecimal = totalMinutes / 60;
    
    const totalTimeFormatted = `${Math.floor(totalMinutes / 60)} שעות ו-${totalMinutes % 60} דקות`;

    // חישוב שכר מופעים
    let basePay = ICHILOV_CONFIG.baseRate;
    let showsBreakdownText = `מופע 1: ₪${ICHILOV_CONFIG.baseRate}`;
    
    for (let i = 2; i <= showsCount; i++) {
        basePay += ICHILOV_CONFIG.extraShowRate;
        showsBreakdownText += `, מופע ${i}: ₪${ICHILOV_CONFIG.extraShowRate}`;
    }

    // חישוב נסיעות וזמן
    const kmPay = totalKm * ICHILOV_CONFIG.kmRate;
    // שעות מזוכות: מינימום שעות נסיעה (למשל 1.5) או הזמן בפועל הגבוה מביניהם
    const billedHours = Math.max(totalHoursDecimal, ICHILOV_CONFIG.minTravelHours);
    const timePay = billedHours * ICHILOV_CONFIG.hourlyRate;
    const travelPay = kmPay + timePay;

    const totalPay = basePay + travelPay;

    // בניית מחרוזת פירוט מופעים לתצוגה בטבלה
    let showsTypesSummary = [];
    for (let i = 1; i <= showsCount; i++) {
        const typeVal = document.getElementById(`${prefix}-show-type-${i}`)?.value || 'standard';
        showsTypesSummary.push(`מופע ${i} (${typeVal === 'standard' ? 'רגיל' : 'מיוחד'})`);
    }

    return {
        showsCount,
        showsTypesSummaryText: showsTypesSummary.join(', '),
        totalKm,
        formattedKm: showsCount > 1 ? `הלוך: ${kmThere}, חזור: ${kmBack}, מעברים: ${kmTransfers}` : `הלוך: ${kmThere}, חזור: ${kmBack}`,
        totalTimeFormatted,
        billedHours,
        basePay,
        travelPay,
        totalPay,
        status: document.getElementById(prefix === 'modal' ? 'modal-ichilov-status' : 'ichilov-status').value === 'true'
    };
}

/* ==========================================
   ניהול טפסים ומאזינים
   ========================================== */

function populateClientDropdown() {
    const select = document.getElementById('client-select');
    if (!select) return;

    let html = '';
    currentData.clients.forEach(client => {
        html += `<option value="${client}">${client}</option>`;
    });
    html += `<option value="ADD_NEW">➕ הוסף לקוח חדש...</option>`;
    select.innerHTML = html;

    select.removeEventListener('change', handleClientSelectChange);
    select.addEventListener('change', handleClientSelectChange);
}

function handleClientSelectChange(e) {
    const newClientContainer = document.getElementById('new-client-container');
    if (e.target.value === 'ADD_NEW') {
        newClientContainer.style.display = 'block';
        document.getElementById('new-client-name').required = true;
    } else {
        newClientContainer.style.display = 'none';
        document.getElementById('new-client-name').required = false;
    }
}

function initFormListeners() {
    // טופס עבודה רגילה
    document.getElementById('add-regular-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const clientSelect = document.getElementById('client-select');
        let clientName = clientSelect.value;
        
        if (clientName === 'ADD_NEW') {
            const newNameInput = document.getElementById('new-client-name');
            clientName = newNameInput.value.trim();
            if (newNameInput && !currentData.clients.includes(clientName)) {
                currentData.clients.push(clientName);
            }
        }

        const newPayment = {
            id: 'pay_' + Date.now(),
            date: document.getElementById('job-date').value,
            client: clientName,
            jobType: document.getElementById('job-type').value,
            location: document.getElementById('job-location').value,
            amount: parseFloat(document.getElementById('job-amount').value) || 0,
            paid: document.getElementById('job-status').value === 'true',
            isIchilov: false
        };

        currentData.payments.push(newPayment);
        await saveData();
        
        populateClientDropdown();
        document.getElementById('add-regular-form').reset();
        setDefaultDates();
        document.getElementById('new-client-container').style.display = 'none';
        renderAll();
        showStatus('האירוע נוסף בהצלחה!', 'success');
    });

    // טופס איכילוב הראשי
    document.getElementById('add-ichilov-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const computed = computeIchilovValues('main');
        const locationVal = document.getElementById('ichilov-location').value;
        const dateVal = document.getElementById('ichilov-date').value;

        const ichilovRecord = {
            id: 'ichilov_' + Date.now(),
            date: dateVal,
            location: locationVal,
            ...computed
        };

        // הוספה גם לטבלת מופעי איכילוב וגם כשורת תשלום כללית
        currentData.ichilovShows.push(ichilovRecord);
        
        currentData.payments.push({
            id: 'pay_ichilov_' + Date.now(),
            date: dateVal,
            client: 'איכילוב (' + locationVal + ')',
            jobType: `מופעי איכילוב (${computed.showsCount})`,
            location: locationVal,
            amount: computed.totalPay,
            paid: computed.status,
            isIchilov: true,
            refId: ichilovRecord.id
        });

        await saveData();
        document.getElementById('add-ichilov-form').reset();
        setDefaultDates();
        initIchilovCalculatorLogic('main');
        renderAll();
        showStatus('מופע איכילוב נוסף בהצלחה!', 'success');
    });

    // טופס איכילוב במודאל
    document.getElementById('modal-ichilov-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const computed = computeIchilovValues('modal');
        const locationVal = document.getElementById('modal-ichilov-location').value;
        const dateVal = document.getElementById('modal-ichilov-date').value;

        const ichilovRecord = {
            id: 'ichilov_' + Date.now(),
            date: dateVal,
            location: locationVal,
            ...computed
        };

        currentData.ichilovShows.push(ichilovRecord);
        currentData.payments.push({
            id: 'pay_ichilov_' + Date.now(),
            date: dateVal,
            client: 'איכילוב (' + locationVal + ')',
            jobType: `מופעי איכילוב (${computed.showsCount})`,
            location: locationVal,
            amount: computed.totalPay,
            paid: computed.status,
            isIchilov: true,
            refId: ichilovRecord.id
        });

        await saveData();
        closeIchilovModal();
        renderAll();
        showStatus('מופע איכילוב נוסף בהצלחה!', 'success');
    });

    // הגדרות GitHub
    document.getElementById('settings-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const config = {
            username: document.getElementById('github-username').value.trim(),
            repo: document.getElementById('github-repo').value.trim(),
            token: document.getElementById('github-token').value.trim()
        };
        localStorage.setItem(STORAGE_KEYS.GITHUB_CONFIG, JSON.stringify(config));
        closeSettingsModal();
        showStatus('הגדרות GitHub נשמרו בהצלחה! מנסה לסנכרן...', 'success');
        loadData().then(() => renderAll());
    });
}

/* ==========================================
   ניהול חלוניות מודאל (Settings & Ichilov Modal)
   ========================================== */

function initModalListeners() {
    const settingsModal = document.getElementById('settings-modal');
    const settingsBtn = document.getElementById('settings-btn');
    const closeSettings = settingsModal.querySelector('.close-btn');

    settingsBtn.addEventListener('click', () => settingsModal.style.display = 'block');
    closeSettings.addEventListener('click', () => settingsModal.style.display = 'none');

    // מודאל איכילוב (ניתן לפתוח דרך כפתור או פעולת עזר בעתיד)
    const ichilovModal = document.getElementById('ichilov-modal');
    const closeIchilov = document.getElementById('close-ichilov-modal');
    closeIchilov.addEventListener('click', closeIchilovModal);

    window.addEventListener('click', (e) => {
        if (e.target === settingsModal) settingsModal.style.display = 'none';
        if (e.target === ichilovModal) closeIchilovModal();
    });
}

function closeSettingsModal() {
    document.getElementById('settings-modal').style.display = 'none';
}

function closeIchilovModal() {
    document.getElementById('ichilov-modal').style.display = 'none';
}

/* ==========================================
   רינדור ותצוגת נתונים בטבלאות ובסיכומים
   ========================================== */

function renderAll() {
    const selectedMonth = document.getElementById('month-select').value; // פורמט YYYY-MM
    
    // סינון תשלומים לפי חודש נבחר
    const filteredPayments = currentData.payments.filter(p => p.date && p.date.startsWith(selectedMonth));
    const filteredIchilov = currentData.ichilovShows.filter(i => i.date && i.date.startsWith(selectedMonth));

    renderSummary(filteredPayments);
    renderPaymentsTable(filteredPayments);
    renderIchilovTable(filteredIchilov);
    renderGlobalUnpaidTable(); // מציג חובות פתוחים מכל החודשים בלשונית הייעודית
}

function renderSummary(payments) {
    let total = 0;
    let paid = 0;
    let unpaid = 0;

    payments.forEach(p => {
        const amt = parseFloat(p.amount) || 0;
        total += amt;
        if (p.paid) {
            paid += amt;
        } else {
            unpaid += amt;
        }
    });

    document.getElementById('total-amount').textContent = `₪${total.toFixed(0)}`;
    document.getElementById('paid-amount').textContent = `₪${paid.toFixed(0)}`;
    document.getElementById('unpaid-amount').textContent = `₪${unpaid.toFixed(0)}`;
}

function renderPaymentsTable(payments) {
    const tbody = document.getElementById('payments-list');
    if (!tbody) return;

    if (payments.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #777;">אין אירועים רשומים בחודש זה</td></tr>`;
        return;
    }

    // מיון לפי תאריך
    payments.sort((a, b) => new Date(a.date) - new Date(b.date));

    let html = '';
    payments.forEach(p => {
        html += `
            <tr>
                <td>${p.date}</td>
                <td><strong>${escapeHtml(p.client)}</strong></td>
                <td>${escapeHtml(p.jobType)}</td>
                <td>${escapeHtml(p.location || '-')}</td>
                <td>₪${parseFloat(p.amount).toFixed(0)}</td>
                <td>
                    <span class="badge ${p.paid ? 'badge-success' : 'badge-warning'}" style="cursor: pointer;" onclick="togglePaymentStatus('${p.id}')">
                        ${p.paid ? '✓ שולם' : '✗ טרם שולם'}
                    </span>
                </td>
                <td>
                    <button class="action-btn delete-btn" onclick="deletePayment('${p.id}')" title="מחק אירוע">🗑️</button>
                </td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
}

function renderIchilovTable(ichilovShows) {
    const tbody = document.getElementById('ichilov-list');
    if (!tbody) return;

    if (ichilovShows.length === 0) {
        tbody.innerHTML = `<tr><td colspan="11" style="text-align: center; color: #777;">אין מופעי איכילוב רשומים בחודש זה</td></tr>`;
        return;
    }

    ichilovShows.sort((a, b) => new Date(a.date) - new Date(b.date));

    let html = '';
    ichilovShows.forEach(item => {
        html += `
            <tr>
                <td>${item.date}</td>
                <td><strong>${escapeHtml(item.location)}</strong></td>
                <td>${escapeHtml(item.showsTypesSummaryText)}</td>
                <td>${item.totalKm.toFixed(1)} ק"מ</td>
                <td>${item.totalTimeFormatted}</td>
                <td>₪${item.basePay}</td>
                <td>₪${item.travelPay.toFixed(0)}</td>
                <td>כלול</td>
                <td><strong>₪${item.totalPay.toFixed(0)}</strong></td>
                <td>
                    <span class="badge ${item.status ? 'badge-success' : 'badge-warning'}" style="cursor: pointer;" onclick="toggleIchilovStatus('${item.id}')">
                        ${item.status ? '✓ שולם' : '✗ טרם שולם'}
                    </span>
                </td>
                <td>
                    <button class="action-btn delete-btn" onclick="deleteIchilovRecord('${item.id}')" title="מחק מופע איכילוב">🗑️</button>
                </td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
}

function renderGlobalUnpaidTable() {
    const tbody = document.getElementById('global-unpaid-list');
    const summaryEl = document.getElementById('total-unpaid-summary');
    if (!tbody) return;

    // איסוף כל התשלומים שלא שולמו מכל החודשים
    const unpaidPayments = currentData.payments.filter(p => !p.paid);
    
    // מיון לפי תאריך מהישן לחדש
    unpaidPayments.sort((a, b) => new Date(a.date) - new Date(b.date));

    let totalUnpaidSum = 0;
    unpaidPayments.forEach(p => { totalUnpaidSum += (parseFloat(p.amount) || 0); });
    
    if (summaryEl) {
        summaryEl.textContent = `סך הכל ממתין לגבייה מכל החודשים: ₪${totalUnpaidSum.toFixed(0)}`;
    }

    if (unpaidPayments.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #777;">אין חובות פתוחים ממתינים לגבייה! כל הכבוד 🎉</td></tr>`;
        return;
    }

    let html = '';
    unpaidPayments.forEach(p => {
        const monthStr = p.date ? p.date.substring(0, 7) : '-';
        html += `
            <tr>
                <td><span class="badge" style="background:#eef2f7; color:#333;">${monthStr}</span></td>
                <td>${p.date}</td>
                <td><strong>${escapeHtml(p.client)}</strong></td>
                <td>${escapeHtml(p.jobType)}</td>
                <td>${escapeHtml(p.location || '-')}</td>
                <td><strong style="color: var(--danger-color);">₪${parseFloat(p.amount).toFixed(0)}</strong></td>
                <td>
                    <button class="submit-btn" style="padding: 4px 10px; font-size: 0.85rem;" onclick="markAsPaidAndRefresh('${p.id}')">סמן ששולם ✓</button>
                </td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
}

/* ==========================================
   פעולות עדכון ומחיקה גלובליות
   ========================================== */

async function togglePaymentStatus(id) {
    const payment = currentData.payments.find(p => p.id === id);
    if (payment) {
        payment.paid = !payment.paid;
        
        // אם מדובר באיכילוב, נעדכן גם את הרשומת איכילוב המקושרת
        if (payment.refId) {
            const ichilov = currentData.ichilovShows.find(i => i.id === payment.refId);
            if (ichilov) ichilov.status = payment.paid;
        }

        await saveData();
        renderAll();
        showStatus('סטטוס תשלום עודכן', 'success');
    }
}

async function toggleIchilovStatus(id) {
    const ichilov = currentData.ichilovShows.find(i => i.id === id);
    if (ichilov) {
        ichilov.status = !ichilov.status;
        
        // עדכון התשלום המקושר בטבלה הכללית
        const payment = currentData.payments.find(p => p.refId === id);
        if (payment) payment.paid = ichilov.status;

        await saveData();
        renderAll();
        showStatus('סטטוס תשלום איכילוב עודכן', 'success');
    }
}

async function markAsPaidAndRefresh(id) {
    await togglePaymentStatus(id);
}

async function deletePayment(id) {
    if (!confirm('האם אתה בטוחที่คุณ מעוניין למחוק אירוע זה?')) return;
    
    const payment = currentData.payments.find(p => p.id === id);
    if (payment && payment.refId) {
        // מחיקת רשומת איכילוב המקושרת
        currentData.ichilovShows = currentData.ichilovShows.filter(i => i.id !== payment.refId);
    }

    currentData.payments = currentData.payments.filter(p => p.id !== id);
    await saveData();
    renderAll();
    showStatus('האירוע נמחק בהצלחה', 'info');
}

async function deleteIchilovRecord(id) {
    if (!confirm('האם אתה בטוח שברצונך למחוק מופע איכילוב זה?')) return;

    currentData.ichilovShows = currentData.ichilovShows.filter(i => i.id !== id);
    currentData.payments = currentData.payments.filter(p => p.refId !== id);
    
    await saveData();
    renderAll();
    showStatus('מופע איכילוב נמחק בהצלחה', 'info');
}

// פונקציית עזר למניעת XSS בטוח
function escapeHtml(str) {
    if (!str) return '';
    return str.toString()
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
