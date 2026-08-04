// קבועים ומשתנים גלובליים
const ICHILOV_NAME = "איכילוב";
let githubConfig = {
    username: "",
    repo: "",
    token: ""
};

let currentData = {};

// אתחול האפליקציה
document.addEventListener("DOMContentLoaded", () => {
    loadSettingsFromLocalStorage();
    setupMonthSelector();
    setupTabSwitching();
    setupFormListeners();
    setupModal();
    setupIchilovLiveCalc();
    fetchDataFromGitHub();
});

// --- הגדרות ה-Modal ו-GitHub ---
function setupModal() {
    const modal = document.getElementById("settings-modal");
    const btn = document.getElementById("settings-btn");
    const span = document.getElementsByClassName("close-btn")[0];
    const form = document.getElementById("settings-form");

    btn.onclick = () => {
        document.getElementById("github-username").value = githubConfig.username || "";
        document.getElementById("github-repo").value = githubConfig.repo || "";
        document.getElementById("github-token").value = githubConfig.token || "";
        modal.style.display = "block";
    };

    span.onclick = () => modal.style.display = "none";
    window.onclick = (event) => {
        if (event.target === modal) modal.style.display = "none";
    };

    form.onsubmit = (e) => {
        e.preventDefault();
        githubConfig.username = document.getElementById("github-username").value.trim();
        githubConfig.repo = document.getElementById("github-repo").value.trim();
        githubConfig.token = document.getElementById("github-token").value.trim();

        localStorage.setItem("github_config", JSON.stringify(githubConfig));
        modal.style.display = "none";
        showStatus("הגדרות GitHub שנשמרו בהצלחה!", "success");
        fetchDataFromGitHub();
    };
}

function loadSettingsFromLocalStorage() {
    const saved = localStorage.getItem("github_config");
    if (saved) {
        try {
            githubConfig = JSON.parse(saved);
        } catch (e) {
            console.error("שגיאה שטופלה בטעינת הגדרות מקומיות", e);
        }
    }
}

// --- תקשורת מול GitHub (API) ---
async function fetchDataFromGitHub() {
    if (!githubConfig.username || !githubConfig.repo || !githubConfig.token) {
        showStatus("נא להגדיר את פרטי ה-GitHub (לחץ על כפתור הגדרות)", "warning");
        renderAllTables();
        return;
    }

    showStatus("טוען נתונים מ-GitHub...", "info");
    const url = `https://api.github.com/repos/${githubConfig.username}/${githubConfig.repo}/contents/data.json`;

    try {
        const response = await fetch(url, {
            headers: {
                "Authorization": `token ${githubConfig.token}`,
                "Accept": "application/vnd.github.v3+json"
            }
        });

        if (response.status === 404) {
            currentData = {};
            showStatus("קובץ data.json לא נמצא ב-Repo. ייקרא ויווצר בעת השמירה הראשונה.", "info");
        } else if (response.ok) {
            const resData = await response.json();
            const decodedContent = decodeURIComponent(escape(atob(resData.content)));
            currentData = JSON.parse(decodedContent);
            showStatus("הנתונים נטענו בהצלחה!", "success");
        } else {
            showStatus("שגיאה בחיבור ל-GitHub. ודא שפרטי ה-PAT וה-Repo תקינים.", "error");
        }
    } catch (err) {
        console.error(err);
        showStatus("שגיאת רשת בטעינת הנתונים.", "error");
    }

    renderAllTables();
}

async function saveDataToGitHub() {
    if (!githubConfig.username || !githubConfig.repo || !githubConfig.token) {
        showStatus("לא ניתן לשמור: חסרים פרטי GitHub בחיבור", "error");
        return;
    }

    showStatus("שומר שינויים ב-GitHub...", "info");
    const url = `https://api.github.com/repos/${githubConfig.username}/${githubConfig.repo}/contents/data.json`;

    try {
        let sha = null;
        const getRes = await fetch(url, {
            headers: {
                "Authorization": `token ${githubConfig.token}`,
                "Accept": "application/vnd.github.v3+json"
            }
        });
        if (getRes.ok) {
            const getData = await getRes.json();
            sha = getData.sha;
        }

        const jsonString = JSON.stringify(currentData, null, 2);
        const encodedContent = btoa(unescape(encodeURIComponent(jsonString)));

        const bodyData = {
            message: "עדכון נתוני תשלומים דרך המערכת",
            content: encodedContent
        };
        if (sha) bodyData.sha = sha;

        const putRes = await fetch(url, {
            method: "PUT",
            headers: {
                "Authorization": `token ${githubConfig.token}`,
                "Accept": "application/vnd.github.v3+json",
                "Content-Type": "application/json"
            },
            body: JSON.stringify(bodyData)
        });

        if (putRes.ok) {
            showStatus("הנתונים נשמרו בהצלחה ב-GitHub!", "success");
        } else {
            showStatus("שגיאה בשמירת הנתונים ל-GitHub.", "error");
        }
    } catch (err) {
        console.error(err);
        showStatus("שגיאת תקשורת בעת השמירה.", "error");
    }
}

// --- ניהול חודשים ולשוניות ---
function setupMonthSelector() {
    const monthSelect = document.getElementById("month-select");
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    monthSelect.value = `${yyyy}-${mm}`;

    monthSelect.addEventListener("change", () => {
        renderAllTables();
    });
}

function setupTabSwitching() {
    const tabs = document.querySelectorAll(".tab-btn");
    tabs.forEach(tab => {
        tab.addEventListener("click", () => {
            tabs.forEach(t => t.classList.remove("active"));
            document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));

            tab.classList.add("active");
            const targetId = tab.getAttribute("data-tab");
            document.getElementById(targetId).classList.add("active");
        });
    });
}

// --- לוגיקת מחשבון איכילוב ---
function calculateIchilov(showType, kmOneWay, timeThere, timeBack) {
    const totalKm = kmOneWay * 2;
    const totalTime = timeThere + timeBack;

    let basePay = (showType === "זוגי") ? 250 : 350;
    let travelPay = totalKm * 2; // 2 ש"ח לק"מ
    let extraTimePay = 0;

    if (totalTime > 90) {
        const extraMinutes = totalTime - 90;
        extraTimePay = extraMinutes * (50 / 60); // 50 ש"ח לשעה
    }

    const totalPay = basePay + travelPay + extraTimePay;

    return {
        basePay,
        travelPay,
        extraTimePay,
        totalPay,
        totalKm,
        totalTime
    };
}

function setupIchilovLiveCalc() {
    const inputs = ["ichilov-show-type", "ichilov-km", "ichilov-time-there", "ichilov-time-back"];
    inputs.forEach(id => {
        document.getElementById(id).addEventListener("input", updateIchilovPreview);
    });
}

function updateIchilovPreview() {
    const showType = document.getElementById("ichilov-show-type").value;
    const kmOneWay = parseFloat(document.getElementById("ichilov-km").value) || 0;
    const timeThere = parseFloat(document.getElementById("ichilov-time-there").value) || 0;
    const timeBack = parseFloat(document.getElementById("ichilov-time-back").value) || 0;

    if (kmOneWay === 0 && timeThere === 0 && timeBack === 0) {
        document.getElementById("calc-breakdown").innerText = "הזן נתונים לצפייה בחישוב";
        return;
    }

    const calc = calculateIchilov(showType, kmOneWay, timeThere, timeBack);
    document.getElementById("calc-breakdown").innerText = 
        `בסיס: ₪${calc.basePay} | נסיעות (${calc.totalKm} ק"מ): ₪${calc.travelPay.toFixed(1)} | תוספת זמן (${calc.totalTime} דק'): ₪${calc.extraTimePay.toFixed(1)} ===> סה"כ לתשלום: ₪${calc.totalPay.toFixed(1)}`;
}

// --- הוספת נתונים מהטפסים ---
function setupFormListeners() {
    // טופס לקוח רגיל
    document.getElementById("add-regular-form").addEventListener("submit", (e) => {
        e.preventDefault();
        const dateVal = document.getElementById("job-date").value;
        if (!dateVal) return;

        const monthKey = dateVal.substring(0, 7);
        if (!currentData[monthKey]) currentData[monthKey] = [];

        const newJob = {
            id: Date.now(),
            client: document.getElementById("client-name").value.trim(),
            type: document.getElementById("job-type").value.trim(),
            location: document.getElementById("job-location").value.trim() || "-", // שדה המיקום
            date: dateVal,
            amount: parseFloat(document.getElementById("job-amount").value) || 0,
            isPaid: document.getElementById("job-status").value === "true",
            isIchilov: false
        };

        currentData[monthKey].push(newJob);
        saveDataToGitHub();
        renderAllTables();

        // איפוס טופס
        document.getElementById("client-name").value = "";
        document.getElementById("job-type").value = "";
        document.getElementById("job-location").value = "";
        document.getElementById("job-amount").value = "";
    });

    // טופס איכילוב
    document.getElementById("add-ichilov-form").addEventListener("submit", (e) => {
        e.preventDefault();
        const dateVal = document.getElementById("ichilov-date").value;
        if (!dateVal) return;

        const monthKey = dateVal.substring(0, 7);
        if (!currentData[monthKey]) currentData[monthKey] = [];

        const showType = document.getElementById("ichilov-show-type").value;
        const kmOneWay = parseFloat(document.getElementById("ichilov-km").value) || 0;
        const timeThere = parseFloat(document.getElementById("ichilov-time-there").value) || 0;
        const timeBack = parseFloat(document.getElementById("ichilov-time-back").value) || 0;
        const location = document.getElementById("ichilov-location").value.trim();

        const calc = calculateIchilov(showType, kmOneWay, timeThere, timeBack);

        const newIchilovJob = {
            id: Date.now(),
            client: ICHILOV_NAME,
            type: `מופע (${showType})`,
            location: location || "-", // מיקום ברמה כללית
            date: dateVal,
            amount: calc.totalPay,
            isPaid: document.getElementById("ichilov-status").value === "true",
            isIchilov: true,
            ichilovData: {
                location: location,
                showType: showType,
                kmOneWay: kmOneWay,
                timeThere: timeThere,
                timeBack: timeBack,
                calcDetails: calc
            }
        };

        currentData[monthKey].push(newIchilovJob);
        saveDataToGitHub();
        renderAllTables();

        // איפוס טופס
        document.getElementById("ichilov-location").value = "";
        document.getElementById("ichilov-km").value = "";
        document.getElementById("ichilov-time-there").value = "";
        document.getElementById("ichilov-time-back").value = "";
        updateIchilovPreview();
    });
}

// --- רינדור ותצוגת נתונים בטבלאות ---
function renderAllTables() {
    const selectedMonth = document.getElementById("month-select").value;
    const monthItems = currentData[selectedMonth] || [];

    const paymentsList = document.getElementById("payments-list");
    const ichilovList = document.getElementById("ichilov-list");

    paymentsList.innerHTML = "";
    ichilovList.innerHTML = "";

    let totalSum = 0;
    let paidSum = 0;
    let unpaidSum = 0;

    monthItems.forEach(item => {
        const amount = Number(item.amount) || 0;
        totalSum += amount;
        if (item.isPaid) paidSum += amount;
        else unpaidSum += amount;

        // 1. שורה בטבלה הכללית
        const trAll = document.createElement("tr");
        trAll.innerHTML = `
            <td>${item.date}</td>
            <td>${escapeHtml(item.client)}</td>
            <td>${escapeHtml(item.type)}</td>
            <td>${escapeHtml(item.location || "-")}</td>
            <td>₪${amount.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 1})}</td>
            <td>
                <button class="status-btn ${item.isPaid ? 'paid' : 'unpaid'}" onclick="toggleStatus('${selectedMonth}', ${item.id})">
                    ${item.isPaid ? '✓ שולם' : '✗ טרם שולם'}
                </button>
            </td>
            <td>
                <button class="delete-btn" onclick="deleteItem('${selectedMonth}', ${item.id})" title="מחק">🗑️</button>
            </td>
        `;
        paymentsList.appendChild(trAll);

        // 2. שורה בטבלת איכילוב (אם שייך)
        if (item.isIchilov && item.ichilovData) {
            const ic = item.ichilovData;
            const cd = ic.calcDetails || calculateIchilov(ic.showType, ic.kmOneWay, ic.timeThere, ic.timeBack);

            const trIchilov = document.createElement("tr");
            trIchilov.innerHTML = `
                <td>${item.date}</td>
                <td>${escapeHtml(ic.location || "-")}</td>
                <td>${escapeHtml(ic.showType)}</td>
                <td>${cd.totalKm} ק"מ</td>
                <td>${cd.totalTime} דק'</td>
                <td>₪${cd.basePay}</td>
                <td>₪${cd.travelPay.toFixed(1)}</td>
                <td>₪${cd.extraTimePay.toFixed(1)}</td>
                <td><strong>₪${cd.totalPay.toFixed(1)}</strong></td>
                <td>
                    <button class="status-btn ${item.isPaid ? 'paid' : 'unpaid'}" onclick="toggleStatus('${selectedMonth}', ${item.id})">
                        ${item.isPaid ? '✓ שולם' : '✗ טרם שולם'}
                    </button>
                </td>
                <td>
                    <button class="delete-btn" onclick="deleteItem('${selectedMonth}', ${item.id})" title="מחק">🗑️</button>
                </td>
            `;
            ichilovList.appendChild(trIchilov);
        }
    });

    // עדכון כרטיסי סיכום
    document.getElementById("total-amount").innerText = `₪${totalSum.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 1})}`;
    document.getElementById("paid-amount").innerText = `₪${paidSum.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 1})}`;
    document.getElementById("unpaid-amount").innerText = `₪${unpaidSum.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 1})}`;
}

// --- שינוי סטטוס ומחיקה ---
window.toggleStatus = function(monthKey, id) {
    if (!currentData[monthKey]) return;
    const item = currentData[monthKey].find(x => x.id === id);
    if (item) {
        item.isPaid = !item.isPaid;
        saveDataToGitHub();
        renderAllTables();
    }
};

window.deleteItem = function(monthKey, id) {
    if (!confirm("האם אתה בטוח שברצונך למחוק רשומה זו?")) return;
    if (!currentData[monthKey]) return;

    currentData[monthKey] = currentData[monthKey].filter(x => x.id !== id);
    saveDataToGitHub();
    renderAllTables();
};

// --- עזרים ---
function showStatus(msg, type) {
    const el = document.getElementById("status-message");
    el.innerText = msg;
    el.className = `status-message ${type}`;
}

function escapeHtml(str) {
    if (!str) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
