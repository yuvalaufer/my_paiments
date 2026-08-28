// --- הגדרות ראשוניות ומשתנים גלובליים ---
let appData = {
    clients: ["איכילוב", "פרטי"],
    payments: [],
    ichilov: []
};

// הגדרות GitHub (יישמרו ב-localStorage)
let githubConfig = {
    username: localStorage.getItem('gh_username') || '',
    repo: localStorage.getItem('gh_repo') || '',
    token: localStorage.getItem('gh_token') || ''
};

const FILE_PATH = 'data.json';

// --- טעינת נתונים באתחול ---
document.addEventListener('DOMContentLoaded', () => {
    // הגדרת חודש נוכחי בבורר החודשים
    const monthSelect = document.getElementById('month-select');
    if (monthSelect) {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        monthSelect.value = `${year}-${month}`;
        
        monthSelect.addEventListener('change', () => {
            renderData();
        });
    }

    // הגדרת תאריך ברירת מחדל להיום בטפסים
    const todayStr = new Date().toISOString().split('T')[0];
    const jobDateInput = document.getElementById('job-date');
    const ichilovDateInput = document.getElementById('ichilov-date');
    if (jobDateInput) jobDateInput.value = todayStr;
    if (ichilovDateInput) ichilovDateInput.value = todayStr;

    // אתחול לשוניות (Tabs)
    initTabs();

    // אתחול אירועי טפסים
    initForms();

    // אתחול מודאל הגדרות
    initSettingsModal();

    // טעינת נתונים (מ-GitHub אם יש הגדרות, או מ-localStorage כגיבוי)
    loadData();
});

// --- ניהול לשוניות (Tabs) ---
function initTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.getAttribute('data-tab');
            
            // הסרת active מכל הכפתורים והתוכן
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            
            // הוספת active ללשונית הנבחרת
            btn.classList.add('active');
            const targetContent = document.getElementById(targetTab);
            if (targetContent) targetContent.classList.add('active');
        });
    });
}

// --- ניהול טפסים והזנת נתונים ---
function initForms() {
    // טיפול בבחירת לקוח בטופס הרגיל (הצגת אינפוט ללקוח חדש במידת הצורך)
    const clientSelect = document.getElementById('client-select');
    const newClientContainer = document.getElementById('new-client-container');
    
    if (clientSelect) {
        clientSelect.addEventListener('change', () => {
            if (clientSelect.value === 'ADD_NEW') {
                newClientContainer.style.display = 'block';
                document.getElementById('new-client-name').setAttribute('required', 'true');
            } else {
                newClientContainer.style.display = 'none';
                document.getElementById('new-client-name').removeAttribute('required');
            }
        });
    }

    // טופס עבודה רגילה
    const regularForm = document.getElementById('add-regular-form');
    if (regularForm) {
        regularForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            let clientName = clientSelect.value;
            if (clientName === 'ADD_NEW') {
                clientName = document.getElementById('new-client-name').value.trim();
                if (clientName && !appData.clients.includes(clientName)) {
                    appData.clients.push(clientName);
                }
            }

            const newJob = {
                id: 'reg_' + Date.now(),
                date: document.getElementById('job-date').value,
                client: clientName,
                jobType: document.getElementById('job-type').value.trim(),
                location: document.getElementById('job-location').value.trim(),
                amount: parseFloat(document.getElementById('job-amount').value) || 0,
                isPaid: document.getElementById('job-status').value === 'true'
            };

            appData.payments.push(newJob);
            saveAndRefresh();
            
            // איפוס חלק מהשדות
            regularForm.reset();
            const jobDateInput = document.getElementById('job-date');
            if (jobDateInput) jobDateInput.value = new Date().toISOString().split('T')[0];
            if (clientSelect) clientSelect.value = appData.clients[0] || '';
            if (newClientContainer) newClientContainer.style.display = 'none';
            showStatus('העבודה הרגילה נוספה בהצלחה!', 'success');
        });
    }

    // מעקב בזמן אמת לחישוב איכילוב בטופס
    const ichilovInputs = ['ichilov-show-type', 'ichilov-km', 'ichilov-time-there', 'ichilov-time-back'];
    ichilovInputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', updateIchilovPreview);
            el.addEventListener('change', updateIchilovPreview);
        }
    });

    // טופס איכילוב
    const ichilovForm = document.getElementById('add-ichilov-form');
    if (ichilovForm) {
        ichilovForm.addEventListener('submit', (e) => {
            e.preventDefault();

            const showType = document.getElementById('ichilov-show-type').value;
            const kmOneWay = parseFloat(document.getElementById('ichilov-km').value) || 0;
            const timeThere = parseInt(document.getElementById('ichilov-time-there').value) || 0;
            const timeBack = parseInt(document.getElementById('ichilov-time-back').value) || 0;

            const calc = calculateIchilov(showType, kmOneWay, timeThere, timeBack);

            const newIchilovShow = {
                id: 'ichi_' + Date.now(),
                date: document.getElementById('ichilov-date').value,
                location: document.getElementById('ichilov-location').value.trim(),
                showType: showType,
                kmOneWay: kmOneWay,
                totalKm: calc.totalKm,
                timeThere: timeThere,
                timeBack: timeBack,
                totalMins: calc.totalMins,
                totalHoursStr: calc.totalHoursStr,
                basePay: calc.basePay,
                kmPay: calc.kmPay,
                timePay: calc.timePay,
                totalPay: calc.totalPay,
                isPaid: document.getElementById('ichilov-status').value === 'true'
            };

            appData.ichilov.push(newIchilovShow);

            // הוספה אוטומטית גם לרשימת התשלומים הכללית לצורך סיכום מרוכז
            const generalEquivalent = {
                id: 'gen_from_ichi_' + Date.now(),
                date: newIchilovShow.date,
                client: 'איכילוב',
                jobType: `מופע איכילוב (${showType})`,
                location: newIchilovShow.location,
                amount: calc.totalPay,
                isPaid: newIchilovShow.isPaid,
                linkedIchilovId: newIchilovShow.id
            };
            appData.payments.push(generalEquivalent);

            saveAndRefresh();

            ichilovForm.reset();
            const ichilovDateInput = document.getElementById('ichilov-date');
            if (ichilovDateInput) ichilovDateInput.value = new Date().toISOString().split('T')[0];
            updateIchilovPreview();
            showStatus('מופע איכילוב נוסף בהצלחה!', 'success');
        });
    }
}

// עזר: עדכון תצוגה מקדימה לחישוב איכילוב בטופס
function updateIchilovPreview() {
    const showType = document.getElementById('ichilov-show-type').value;
    const km = document.getElementById('ichilov-km').value;
    const timeThere = document.getElementById('ichilov-time-there').value;
    const timeBack = document.getElementById('ichilov-time-back').value;
    const breakdownEl = document.getElementById('calc-breakdown');

    if (!breakdownEl) return;

    if (!km && !timeThere && !timeBack) {
        breakdownEl.textContent = 'הזן נתונים לצפייה בחישוב';
        return;
    }

    const calc = calculateIchilov(showType, km, timeThere, timeBack);
    breakdownEl.innerHTML = `שכר בסיס: ₪${calc.basePay} | נסיעות (${calc.totalKm} ק"מ): ₪${calc.kmPay} | תוספת זמן (${calc.excessHoursStr}): ₪${calc.timePay} | <strong>סה"כ: ₪${calc.totalPay}</strong>`;
}

// --- פונקציית החישוב המעודכנת לאיכילוב ---
function calculateIchilov(showType, kmOneWay, timeThere, timeBack) {
    const km = parseFloat(kmOneWay) || 0;
    const totalKm = km * 2;

    const tThereMins = parseTimeToMinutes(timeThere);
    const tBackMins = parseTimeToMinutes(timeBack);
    const totalMins = tThereMins + tBackMins;

    // שכר בסיס מעודכן: 600 לרגיל, 800 לארוך, 500 לזוגי
    let basePay = 600;
    if (showType === "ארוך") {
        basePay = 800;
    } else if (showType === "זוגי") {
        basePay = 500;
    }

    const kmPay = totalKm; 

    let excessMins = 0;
    let timePay = 0;
    
    // תוספת זמן נסיעה מעל שעתיים (120 דקות)
    if (totalMins > 120) {
        excessMins = totalMins - 120;
        timePay = Math.round((excessMins / 60) * 50);
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

// עזרים לפורמט דקות
function parseTimeToMinutes(val) {
    if (!val) return 0;
    return parseInt(val) || 0;
}

function formatMinutesToHHMM(totalMins) {
    const hours = Math.floor(totalMins / 60);
    const mins = totalMins % 60;
    if (hours === 0) return `${mins} דק'`;
    if (mins === 0) return `${hours} שע'`;
    return `${hours}:${mins < 10 ? '0' : ''}${mins} שע'`;
}

// --- רינדור והצגת נתונים במסך ---
function renderData() {
    const monthSelect = document.getElementById('month-select');
    const selectedMonth = monthSelect ? monthSelect.value : ''; // פורמט YYYY-MM

    // סינון רשימות לפי חודש נבחר (אם נבחר)
    let filteredPayments = appData.payments;
    let filteredIchilov = appData.ichilov;

    if (selectedMonth) {
        filteredPayments = appData.payments.filter(item => item.date && item.date.startsWith(selectedMonth));
        filteredIchilov = appData.ichilov.filter(item => item.date && item.date.startsWith(selectedMonth));
    }

    // עדכון תפריט נספח לקוחות בטופס רגיל
    updateClientSelectOptions();

    // רינדור טבלה כללית
    const paymentsListEl = document.getElementById('payments-list');
    if (paymentsListEl) {
        paymentsListEl.innerHTML = '';
        if (filteredPayments.length === 0) {
            paymentsListEl.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #777;">אין אירועים להצגה בחודש זה</td></tr>`;
        } else {
            filteredPayments.forEach(item => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${item.date || ''}</td>
                    <td>${item.client || ''}</td>
                    <td>${item.jobType || ''}</td>
                    <td>${item.location || ''}</td>
                    <td>₪${item.amount || 0}</td>
                    <td>
                        <span class="status-badge ${item.isPaid ? 'paid' : 'unpaid'}" onclick="togglePaymentStatus('${item.id}')" style="cursor:pointer;" title="לחץ לשינוי סטטוס">
                            ${item.isPaid ? '✓ שולם' : '✗ טרם שולם'}
                        </span>
                    </td>
                    <td>
                        <button class="action-btn delete-btn" onclick="deleteItem('payment', '${item.id}')">🗑️</button>
                    </td>
                `;
                paymentsListEl.appendChild(tr);
            });
        }
    }

    // רינדור טבלת איכילוב
    const ichilovListEl = document.getElementById('ichilov-list');
    if (ichilovListEl) {
        ichilovListEl.innerHTML = '';
        if (filteredIchilov.length === 0) {
            ichilovListEl.innerHTML = `<tr><td colspan="10" style="text-align: center; color: #777;">אין מופעי איכילוב להצגה בחודש זה</td></tr>`;
        } else {
            filteredIchilov.forEach(item => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${item.date || ''}</td>
                    <td>${item.location || ''}</td>
                    <td>${item.showType || ''}</td>
                    <td>${item.totalKm || 0} ק"מ</td>
                    <td>${item.totalHoursStr || ''}</td>
                    <td>₪${item.basePay || 0}</td>
                    <td>₪${item.kmPay || 0}</td>
                    <td>₪${item.timePay || 0}</td>
                    <td><strong>₪${item.totalPay || 0}</strong></td>
                    <td>
                        <span class="status-badge ${item.isPaid ? 'paid' : 'unpaid'}" onclick="toggleIchilovStatus('${item.id}')" style="cursor:pointer;" title="לחץ לשינוי סטטוס">
                            ${item.isPaid ? '✓ שולם' : '✗ טרם שולם'}
                        </span>
                    </td>
                    <td>
                        <button class="action-btn delete-btn" onclick="deleteItem('ichilov', '${item.id}')">🗑️</button>
                    </td>
                `;
                ichilovListEl.appendChild(tr);
            });
        }
    }

    // חישוב ועדכון סיכומים כספיים
    let totalAmount = 0;
    let paidAmount = 0;
    let unpaidAmount = 0;

    filteredPayments.forEach(item => {
        const amt = parseFloat(item.amount) || 0;
        totalAmount += amt;
        if (item.isPaid) {
            paidAmount += amt;
        } else {
            unpaidAmount += amt;
        }
    });

    document.getElementById('total-amount').textContent = `₪${totalAmount}`;
    document.getElementById('paid-amount').textContent = `₪${paidAmount}`;
    document.getElementById('unpaid-amount').textContent = `₪${unpaidAmount}`;
}

function updateClientSelectOptions() {
    const clientSelect = document.getElementById('client-select');
    if (!clientSelect) return;
    
    // שמירת הבחירה הנוכחית אם קיימת
    const currentVal = clientSelect.value;
    
    clientSelect.innerHTML = '';
    
    // וידוא ש"איכילוב" ו-"פרטי" תמיד קיימים ברשימה
    if (!appData.clients.includes("איכילוב")) appData.clients.unshift("איכילוב");
    if (!appData.clients.includes("פרטי")) appData.clients.unshift("פרטי");

    appData.clients.forEach(client => {
        const opt = document.createElement('option');
        opt.value = client;
        opt.textContent = client;
        clientSelect.appendChild(opt);
    });

    const addOpt = document.createElement('option');
    addOpt.value = 'ADD_NEW';
    addOpt.textContent = '➕ הוסף לקוח חדש...';
    clientSelect.appendChild(addOpt);

    if (currentVal && currentVal !== 'ADD_NEW') {
        clientSelect.value = currentVal;
    }
}

// --- פעולות על נתונים (מחיקה ושינוי סטטוס) ---
function togglePaymentStatus(id) {
    const item = appData.payments.find(p => p.id === id);
    if (item) {
        item.isPaid = !item.isPaid;
        // אם מדובר באירוע מקושר לאיכילוב, נעדכן גם שם
        if (item.linkedIchilovId) {
            const ichiItem = appData.ichilov.find(i => i.id === item.linkedIchilovId);
            if (ichiItem) ichiItem.isPaid = item.isPaid;
        }
        saveAndRefresh();
    }
}

function toggleIchilovStatus(id) {
    const item = appData.ichilov.find(i => i.id === id);
    if (item) {
        item.isPaid = !item.isPaid;
        // עדכון מקביל ברשימת התשלומים הכללית
        const linkedPayment = appData.payments.find(p => p.linkedIchilovId === id);
        if (linkedPayment) linkedPayment.isPaid = item.isPaid;
        saveAndRefresh();
    }
}

function deleteItem(type, id) {
    if (!confirm('האם אתה בטוח שברצונך למחוק רשומה זו?')) return;

    if (type === 'payment') {
        const item = appData.payments.find(p => p.id === id);
        if (item && item.linkedIchilovId) {
            // מחיקה כפולה גם ממופעי איכילוב
            appData.ichilov = appData.ichilov.filter(i => i.id !== item.linkedIchilovId);
        }
        appData.payments = appData.payments.filter(p => p.id !== id);
    } else if (type === 'ichilov') {
        appData.ichilov = appData.ichilov.filter(i => i.id !== id);
        // מחיקה מקבילה מהטבלה הכללית
        appData.payments = appData.payments.filter(p => p.linkedIchilovId !== id);
    }

    saveAndRefresh();
    showStatus('הרישום נמחק בהצלחה', 'success');
}

// --- שמירה וסנכרון מול GitHub / LocalStorage ---
function saveAndRefresh() {
    renderData();
    saveDataToStorage();
}

function saveDataToStorage() {
    // שמירה מקומית תמיד כגיבוי
    localStorage.setItem('app_data_backup', JSON.stringify(appData));

    // אם הוגדרו פרטי GitHub, נבצע שמירה בענן
    if (githubConfig.username && githubConfig.repo && githubConfig.token) {
        saveToGitHub();
    }
}

async function loadData() {
    showStatus('טוען נתונים...', 'info');

    // נסה לטעון מ-GitHub אם יש הגדרות
    if (githubConfig.username && githubConfig.repo && githubConfig.token) {
        try {
            const response = await fetch(`https://api.github.com/repos/${githubConfig.username}/${githubConfig.repo}/contents/${FILE_PATH}`, {
                headers: {
                    'Authorization': `token ${githubConfig.token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            if (response.ok) {
                const fileData = await response.json();
                // הנתונים מגיעים ב-Base64 (לפי המקור שלך)
                const jsonString = atob(fileData.content);
                appData = JSON.parse(jsonString);
                showStatus('הנתונים נטענו בהצלחה מ-GitHub!', 'success');
                renderData();
                return;
            }
        } catch (err) {
            console.error('שגיאה בטעינה מ-GitHub:', err);
        }
    }

    // גיבוי: טעינה מ-localStorage
    const localBackup = localStorage.getItem('app_data_backup');
    if (localBackup) {
        try {
            appData = JSON.parse(localBackup);
            showStatus('הנתונים נטענו מהזיכרון המקומי.', 'success');
        } catch (e) {
            console.error(e);
        }
    } else {
        showStatus('התחלת עבודה עם נתונים ריקים. הגדר GitHub לשמירה בענן.', 'info');
    }

    renderData();
}

async function saveToGitHub() {
    showStatus('שומר שינויים ב-GitHub...', 'info');

    const apiUrl = `https://api.github.com/repos/${githubConfig.username}/${githubConfig.repo}/contents/${FILE_PATH}`;
    const token = githubConfig.token;

    try {
        // 1. קודם כל נבדוק האם הקובץ קיים ומה ה-SHA שלו (חובה לעדכון ב-GitHub API)
        let sha = '';
        const getRes = await fetch(apiUrl, {
            headers: {
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        if (getRes.ok) {
            const fileInfo = await getRes.json();
            sha = fileInfo.sha;
        }

        // 2. המרת הנתונים ל-Base64 (לפי המקור שלך)
        const jsonContent = JSON.stringify(appData, null, 2);
        const contentBase64 = btoa(jsonContent);

        // 3. שליחת בקשת PUT לעדכון הקובץ
        const putRes = await fetch(apiUrl, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: 'Update data via Web App',
                content: contentBase64,
                sha: sha // אם הקובץ חדש לחלוטין ה-sha יהיה ריק
            })
        });

        if (putRes.ok) {
            showStatus('הנתונים נשמרו בהצלחה ב-GitHub! ☁️', 'success');
        } else {
            const errData = await putRes.json();
            console.error('GitHub save error:', errData);
            showStatus('שגיאה בשמירה ל-GitHub: ' + (errData.message || 'בדוק הגדרות'), 'error');
        }
    } catch (err) {
        console.error('שגיאת תקשורת מול GitHub:', err);
        showStatus('שגיאת תקשורת בשמירה ל-GitHub', 'error');
    }
}

// --- ניהול מודאל הגדרות GitHub ---
function initSettingsModal() {
    const modal = document.getElementById('settings-modal');
    const btn = document.getElementById('settings-btn');
    const closeBtn = document.querySelector('.close-btn');
    const form = document.getElementById('settings-form');

    // מילוי שדות קיימים אם יש
    if (githubConfig.username) document.getElementById('github-username').value = githubConfig.username;
    if (githubConfig.repo) document.getElementById('github-repo').value = githubConfig.repo;
    if (githubConfig.token) document.getElementById('github-token').value = githubConfig.token;

    if (btn && modal) {
        btn.addEventListener('click', () => {
            modal.style.display = 'block';
        });
    }

    if (closeBtn && modal) {
        closeBtn.addEventListener('click', () => {
            modal.style.display = 'none';
        });
    }

    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });

    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            githubConfig.username = document.getElementById('github-username').value.trim();
            githubConfig.repo = document.getElementById('github-repo').value.trim();
            githubConfig.token = document.getElementById('github-token').value.trim();

            localStorage.setItem('gh_username', githubConfig.username);
            localStorage.setItem('gh_repo', githubConfig.repo);
            localStorage.setItem('gh_token', githubConfig.token);

            modal.style.display = 'none';
            showStatus('הגדרות GitHub נשמרו בהצלחה!', 'success');

            // טעינת נתונים מחדש לפי ההגדרות החדשות
            loadData();
        });
    }
}

// --- הודעות מערכת דינמיות ---
function showStatus(text, type = 'info') {
    const statusEl = document.getElementById('status-message');
    if (!statusEl) return;

    statusEl.textContent = text;
    statusEl.className = `status-message ${type}`;
    statusEl.style.display = 'block';

    // הסתרה אוטומטית אחרי 4 שניות בהודעות הצלחה/מידע
    if (type !== 'error') {
        setTimeout(() => {
            statusEl.style.display = 'none';
        }, 4000);
    }
}
