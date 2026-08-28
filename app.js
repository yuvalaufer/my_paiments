// ==========================================
// 1. הגדרות ומשתנים גלובליים
// ==========================================
// במידה והקובץ data.json יושב בתוך תיקייה, עדכן את הנתיב כאן (למשל: 'data/data.json')
const DATA_FILE_PATH = 'data.json'; 

let currentData = {};
let selectedMonth = "";
let hasUnsavedChanges = false;

function getGithubConfig() {
    return {
        username: (localStorage.getItem('gh_username') || '').trim(),
        repo: (localStorage.getItem('gh_repo') || '').trim(),
        token: (localStorage.getItem('gh_token') || '').trim()
    };
}

function saveGithubConfig(username, repo, token) {
    localStorage.setItem('gh_username', username.trim());
    localStorage.setItem('gh_repo', repo.trim());
    localStorage.setItem('gh_token', token.trim());
}

// ==========================================
// 2. אתחול האפליקציה וטעינת נתונים
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    loadGithubSettingsToModal();
    loadData();
});

function loadGithubSettingsToModal() {
    const config = getGithubConfig();
    const inputUsername = document.getElementById('ghUsername');
    const inputRepo = document.getElementById('ghRepo');
    const inputToken = document.getElementById('ghToken');

    if (inputUsername) inputUsername.value = config.username;
    if (inputRepo) inputRepo.value = config.repo;
    if (inputToken) inputToken.value = config.token;
}

async function loadData() {
    const config = getGithubConfig();
    showStatusMessage('טוען נתונים...');

    if (config.username && config.repo) {
        // ניסיון 1: טעינה דרך GitHub Raw URL (פשוט, אמין ועובד ללא סיבוכי API)
        const rawUrl = `https://raw.githubusercontent.com/${config.username}/${config.repo}/main/${DATA_FILE_PATH}?t=${new Date().getTime()}`;
        
        try {
            console.log("Attempting to load raw file from:", rawUrl);
            const rawRes = await fetch(rawUrl);
            if (rawRes.ok) {
                currentData = await rawRes.json();
                showStatusMessage('הנתונים נטענו בהצלחה!');
                initDashboard();
                return;
            }
        } catch (rawErr) {
            console.warn("Raw load failed, trying API...", rawErr);
        }

        // ניסיון 2: טעינה דרך GitHub REST API
        try {
            const apiUrl = `https://api.github.com/repos/${config.username}/${config.repo}/contents/${DATA_FILE_PATH}`;
            const headers = { 'Accept': 'application/vnd.github.v3+json' };
            if (config.token) {
                headers['Authorization'] = `token ${config.token}`;
            }

            const res = await fetch(apiUrl, { headers });
            if (res.ok) {
                const data = await res.json();
                // פענוח מותאם לעברית (UTF-8)
                const binaryString = atob(data.content.replace(/\s/g, ''));
                const bytes = Uint8Array.from(binaryString, c => c.charCodeAt(0));
                const decodedContent = new TextDecoder().decode(bytes);

                currentData = JSON.parse(decodedContent);
                showStatusMessage('הנתונים נטענו בהצלחה מ-GitHub API!');
                initDashboard();
                return;
            }
        } catch (apiErr) {
            console.error("API load failed:", apiErr);
        }
    }

    // ניסיון 3: גיבוי מקומי במידה וכל הניסיונות נכשלו
    console.warn("Loading fallback from local storage");
    const localData = localStorage.getItem('local_data_backup');
    if (localData) {
        try {
            currentData = JSON.parse(localData);
            showStatusMessage('נתונים נטענו מגיבוי מקומי (GitHub לא זמין).', true);
        } catch (e) {
            currentData = {};
            showStatusMessage('שגיאה בקריאת הנתונים. נוצר מבנה חדש.', true);
        }
    } else {
        currentData = {};
        showStatusMessage('לא נמצאו נתונים קודמים. נוצר מבנה חדש.', true);
    }

    initDashboard();
}

function initDashboard() {
    const months = Object.keys(currentData).sort().reverse();
    const monthSelect = document.getElementById('monthSelect');
    
    if (monthSelect) {
        monthSelect.innerHTML = '';
        months.forEach(month => {
            const option = document.createElement('option');
            option.value = month;
            option.textContent = month;
            monthSelect.appendChild(option);
        });

        if (months.length > 0) {
            selectedMonth = months[0];
            monthSelect.value = selectedMonth;
        }
    }
    
    renderDashboard();
}

// ==========================================
// 3. רינדור הלוח (Dashboard)
// ==========================================
function renderDashboard() {
    const container = document.getElementById('dashboardContent');
    if (!container) return;

    if (!selectedMonth || !currentData[selectedMonth]) {
        container.innerHTML = '<div class="alert alert-info">אין נתונים להצגה עבור החודש הנבחר.</div>';
        return;
    }

    const monthData = currentData[selectedMonth];
    let html = `
        <div class="card mb-4">
            <div class="card-header d-flex justify-content-between align-items-center">
                <h3>נתוני חודש: ${selectedMonth}</h3>
                ${hasUnsavedChanges ? '<span class="badge bg-warning text-dark">ישנם שינויים שלא נשמרו</span>' : ''}
            </div>
            <div class="card-body">
                <table class="table table-striped">
                    <thead>
                        <tr>
                            <th>שם/תיאור</th>
                            <th>סכום</th>
                            <th>סטטוס תשלום</th>
                            <th>פעולות</th>
                        </tr>
                    </thead>
                    <tbody>
    `;

    if (Array.isArray(monthData.items)) {
        monthData.items.forEach((item, index) => {
            html += `
                <tr>
                    <td>${escapeHtml(item.name || '')}</td>
                    <td>${item.amount || 0} ₪</td>
                    <td>
                        <span class="badge ${item.paid ? 'bg-success' : 'bg-danger'}">
                            ${item.paid ? 'שולם' : 'לא שולם'}
                        </span>
                    </td>
                    <td>
                        <button class="btn btn-sm ${item.paid ? 'btn-outline-danger' : 'btn-outline-success'}" 
                                onclick="togglePaymentStatus(${index})">
                            שנה ל-${item.paid ? 'לא שולם' : 'שולם'}
                        </button>
                    </td>
                </tr>
            `;
        });
    }

    html += `
                    </tbody>
                </table>
            </div>
        </div>
    `;

    container.innerHTML = html;
}

// ==========================================
// 4. שינוי סטטוס תשלום
// ==========================================
window.togglePaymentStatus = function(index) {
    if (selectedMonth && currentData[selectedMonth] && currentData[selectedMonth].items[index]) {
        currentData[selectedMonth].items[index].paid = !currentData[selectedMonth].items[index].paid;
        hasUnsavedChanges = true;
        renderDashboard();
    }
};

// ==========================================
// 5. שמירת שינויים ב-GitHub
// ==========================================
window.saveAllChanges = async function() {
    const config = getGithubConfig();

    if (!config.username || !config.repo || !config.token) {
        showStatusMessage('חסרים פרטי חיבור ל-GitHub (משתמש, רפוזיטורי או טוקן). נשמר מקומית.', true);
        localStorage.setItem('local_data_backup', JSON.stringify(currentData));
        hasUnsavedChanges = false;
        renderDashboard();
        return;
    }

    showStatusMessage('שומר שינויים ב-GitHub...');
    try {
        const url = `https://api.github.com/repos/${config.username}/${config.repo}/contents/${DATA_FILE_PATH}`;
        
        let sha = null;
        const getRes = await fetch(url, {
            headers: { 
                'Authorization': `token ${config.token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        if (getRes.ok) {
            const getData = await getRes.json();
            sha = getData.sha;
        }

        const jsonString = JSON.stringify(currentData, null, 2);
        const utf8Bytes = new TextEncoder().encode(jsonString);
        const binaryString = String.fromCharCode(...utf8Bytes);
        const contentEncoded = btoa(binaryString);
        
        const payload = {
            message: 'עדכון נתונים מהאפליקציה',
            content: contentEncoded
        };
        if (sha) payload.sha = sha;

        const putRes = await fetch(url, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${config.token}`,
                'Content-Type': 'application/json',
                'Accept': 'application/vnd.github.v3+json'
            },
            body: JSON.stringify(payload)
        });

        if (putRes.ok) {
            hasUnsavedChanges = false;
            localStorage.setItem('local_data_backup', JSON.stringify(currentData));
            renderDashboard();
            showStatusMessage('השינויים נשמרו בהצלחה ב-GitHub!');
        } else {
            const putErrData = await putRes.json().catch(() => ({}));
            throw new Error(`שגיאה בשמירה (${putRes.status}): ${putErrData.message || ''}`);
        }
    } catch (err) {
        console.error("Save Error:", err);
        showStatusMessage(`שגיאה בשמירה: ${err.message}. נשמר מקומית בלבד.`, true);
        localStorage.setItem('local_data_backup', JSON.stringify(currentData));
        hasUnsavedChanges = false;
        renderDashboard();
    }
};

// ==========================================
// 6. מאזינים ועזרים
// ==========================================
function setupEventListeners() {
    const monthSelect = document.getElementById('monthSelect');
    if (monthSelect) {
        monthSelect.addEventListener('change', (e) => {
            selectedMonth = e.target.value;
            renderDashboard();
        });
    }

    const saveSettingsBtn = document.getElementById('saveSettingsBtn');
    if (saveSettingsBtn) {
        saveSettingsBtn.addEventListener('click', () => {
            const username = document.getElementById('ghUsername')?.value || '';
            const repo = document.getElementById('ghRepo')?.value || '';
            const token = document.getElementById('ghToken')?.value || '';

            saveGithubConfig(username, repo, token);
            showStatusMessage('הגדרות עודכנו!');
            
            const settingsModalEl = document.getElementById('settingsModal');
            if (settingsModalEl && window.bootstrap) {
                const modal = window.bootstrap.Modal.getInstance(settingsModalEl);
                if (modal) modal.hide();
            }

            loadData();
        });
    }

    const btnSaveAll = document.getElementById('btnSaveAll');
    if (btnSaveAll) {
        btnSaveAll.addEventListener('click', saveAllChanges);
    }
}

function showStatusMessage(message, isError = false) {
    const statusEl = document.getElementById('statusMessage');
    if (statusEl) {
        statusEl.textContent = message;
        statusEl.className = isError ? 'alert alert-danger' : 'alert alert-info';
        statusEl.style.display = 'block';
    } else {
        console.log(`[Status] ${isError ? 'ERROR: ' : ''}${message}`);
    }
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
