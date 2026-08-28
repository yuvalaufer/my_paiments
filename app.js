// נתוני האפליקציה
let appData = {
    regularWorks: [],
    ichilovShows: []
};

// הגדרת חודש נוכחי ברירת מחדל (YYYY-MM)
const today = new Date();
let currentMonth = today.toISOString().substring(0, 7);

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("month-select").value = currentMonth;
    document.getElementById("month-select").addEventListener("change", (e) => {
        currentMonth = e.target.value;
        renderAll();
    });

    // הגדרת תאריך של היום בטפסים
    const todayStr = today.toISOString().substring(0, 10);
    if (document.getElementById("reg-date")) document.getElementById("reg-date").value = todayStr;
    if (document.getElementById("ichilov-date")) document.getElementById("ichilov-date").value = todayStr;

    loadData();
});

// טעינת נתונים מ-data.json
async function loadData() {
    try {
        const response = await fetch("data.json?t=" + new Date().getTime());
        if (response.ok) {
            appData = await response.json();
            if (!appData.regularWorks) appData.regularWorks = [];
            if (!appData.ichilovShows) appData.ichilovShows = [];
        }
    } catch (e) {
        console.warn("לא ניתן היה לטעון data.json, משתמש בנתונים ריקים.", e);
    }
    updateClientsDropdown();
    renderAll();
}

// עדכון רשימת לקוחות נפתחת
function updateClientsDropdown() {
    const select = document.getElementById("client-select");
    if (!select) return;

    const clientsSet = new Set();
    // הבטחה ש"החברה מאיכילוב" תופיע ברשימה
    clientsSet.add("החברה מאיכילוב");

    appData.regularWorks.forEach(w => {
        if (w.client) clientsSet.add(w.client);
    });

    const clients = Array.from(clientsSet);

    select.innerHTML = "";
    
    clients.forEach(client => {
        const opt = document.createElement("option");
        opt.value = client;
        opt.textContent = client;
        select.appendChild(opt);
    });

    const optNew = document.createElement("option");
    optNew.value = "חדש";
    optNew.textContent = "➕ לקוח חדש...";
    select.appendChild(optNew);

    showNewClientInput(false);
}

// טיפול בשינוי בבחירת הלקוח
function handleClientSelectChange(select) {
    const val = select.value;
    
    // אם נבחר "החברה מאיכילוב", נעבור מיד לטאב מחשבון איכילוב
    if (val === "החברה מאיכילוב") {
        switchTab('ichilov');
        // נחזיר את הרשימה הנפתחת לברירת מחדל לשימוש עתידי
        select.selectedIndex = 0;
        return;
    }

    showNewClientInput(val === "חדש");
}

function showNewClientInput(show) {
    const input = document.getElementById("reg-client-new");
    if (input) {
        input.style.display = show ? "block" : "none";
        if (show) input.focus();
    }
}

// מעבר בין טאבים
function switchTab(tabName) {
    document.querySelectorAll(".tab-btn").forEach(btn => btn.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach(content => content.classList.remove("active"));

    if (tabName === 'regular') {
        document.querySelectorAll(".tab-btn")[0].classList.add("active");
        document.getElementById("tab-regular").classList.add("active");
    } else if (tabName === 'ichilov') {
        document.querySelectorAll(".tab-btn")[1].classList.add("active");
        document.getElementById("tab-ichilov").classList.add("active");
    } else if (tabName === 'summary') {
        document.querySelectorAll(".tab-btn")[2].classList.add("active");
        document.getElementById("tab-summary").classList.add("active");
    }
}

// עזרים לזמנים
function parseTimeToMinutes(timeStr) {
    if (!timeStr) return 0;
    const [hours, minutes] = timeStr.split(':').map(Number);
    return (hours || 0) * 60 + (minutes || 0);
}

function formatMinutesToHHMM(totalMinutes) {
    const hrs = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

// אלגוריתם חישוב איכילוב
function calculateIchilov(showType, kmOneWay, timeThere, timeBack) {
    const km = parseFloat(kmOneWay) || 0;
    
    // החזר ק"מ: ק"מ לכיוון אחד ב-₪ (ק"מ * 2 * 0.5)
    const kmPay = km;

    const tThereMins = parseTimeToMinutes(timeThere);
    const tBackMins = parseTimeToMinutes(timeBack);
    const totalMins = tThereMins + tBackMins;

    // שכר בסיס
    const basePay = (showType === "ארוך") ? 840 : 670;

    // החזר זמן: קיזוז 2 שעות ראשונות (120 דקות)
    let excessMins = 0;
    let timePay = 0;

    if (totalMins > 120) {
        excessMins = totalMins - 120;
        // חישוב לפי 70 ₪ לכל שעה/חלק משעה
        const extraHours = Math.ceil(excessMins / 60);
        timePay = extraHours * 70;
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

// הוספת עבודה רגילה
function addRegularWork(e) {
    e.preventDefault();
    const select = document.getElementById("client-select");
    let clientName = select.value;
    if (clientName === "חדש") {
        clientName = document.getElementById("reg-client-new").value.trim();
        if (!clientName) {
            alert("אנא הזן שם לקוח חדש");
            return;
        }
    }

    const newWork = {
        id: Date.now().toString(),
        date: document.getElementById("reg-date").value,
        client: clientName,
        description: document.getElementById("reg-desc").value,
        hours: parseFloat(document.getElementById("reg-hours").value),
        rate: parseFloat(document.getElementById("reg-rate").value),
        total: parseFloat(document.getElementById("reg-hours").value) * parseFloat(document.getElementById("reg-rate").value)
    };

    appData.regularWorks.push(newWork);
    document.getElementById("regular-form").reset();
    document.getElementById("reg-date").value = new Date().toISOString().substring(0, 10);
    
    updateClientsDropdown();
    renderAll();
}

// הוספת מופע איכילוב
function addIchilovShow(e) {
    e.preventDefault();
    const showType = document.getElementById("ichilov-show-type").value;
    const kmOneWay = parseFloat(document.getElementById("ichilov-km").value) || 0;
    const timeThere = document.getElementById("ichilov-time-there").value;
    const timeBack = document.getElementById("ichilov-time-back").value;

    const calc = calculateIchilov(showType, kmOneWay, timeThere, timeBack);

    const newShow = {
        id: Date.now().toString(),
        date: document.getElementById("ichilov-date").value,
        location: document.getElementById("ichilov-location").value,
        showType: showType,
        kmOneWay: kmOneWay,
        timeThere: timeThere,
        timeBack: timeBack,
        totalMins: calc.totalMins,
        excessMins: calc.excessMins,
        basePay: calc.basePay,
        kmPay: calc.kmPay,
        timePay: calc.timePay,
        totalPay: calc.totalPay
    };

    appData.ichilovShows.push(newShow);
    document.getElementById("ichilov-form").reset();
    document.getElementById("ichilov-date").value = new Date().toISOString().substring(0, 10);

    renderAll();
}

// מחיקת פריטים
function deleteRegularWork(id) {
    appData.regularWorks = appData.regularWorks.filter(w => w.id !== id);
    updateClientsDropdown();
    renderAll();
}

function deleteIchilovShow(id) {
    appData.ichilovShows = appData.ichilovShows.filter(s => s.id !== id);
    renderAll();
}

// רינדור ותצוגת כל הטבלאות
function renderAll() {
    renderIchilovTable();
    renderSummaryTable();
}

// רינדור טבלת איכילוב המפורטת
function renderIchilovTable() {
    const tbody = document.getElementById("ichilov-table-body");
    tbody.innerHTML = "";

    const monthShows = appData.ichilovShows.filter(s => s.date.startsWith(currentMonth));
    let monthTotal = 0;

    monthShows.forEach(s => {
        monthTotal += s.totalPay;
        const tr = document.createElement("tr");

        tr.innerHTML = `
            <td>${s.date}</td>
            <td>${s.location}</td>
            <td>${formatMinutesToHHMM(s.totalMins)}</td>
            <td>${formatMinutesToHHMM(s.excessMins)}</td>
            <td>₪${s.basePay}</td>
            <td>₪${s.kmPay}</td>
            <td>₪${s.timePay}</td>
            <td><strong>₪${s.totalPay}</strong></td>
            <td><button class="btn btn-danger" onclick="deleteIchilovShow('${s.id}')">מחק</button></td>
        `;
        tbody.appendChild(tr);
    });

    // עדכון כותרת וסיכום בתחתית הטבלה
    const [year, month] = currentMonth.split('-');
    const dateObj = new Date(year, month - 1);
    const monthName = dateObj.toLocaleString('he-IL', { month: 'long', year: 'numeric' });

    document.getElementById("ichilov-month-summary-label").textContent = `סה"כ לתשלום – חודש ${monthName}:`;
    document.getElementById("ichilov-month-summary-total").textContent = `₪${monthTotal}`;
}

// רינדור הטבלה הראשית (ריכוז חודשי)
function renderSummaryTable() {
    const tbody = document.getElementById("summary-table-body");
    tbody.innerHTML = "";

    let grandTotal = 0;

    // 1. עבודות רגילות בחודש זה
    const monthRegular = appData.regularWorks.filter(w => w.date.startsWith(currentMonth));
    monthRegular.forEach(w => {
        grandTotal += w.total;
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${w.date}</td>
            <td>${w.client}</td>
            <td>${w.description} (${w.hours} שעות)</td>
            <td>₪${w.total}</td>
            <td><button class="btn btn-danger" onclick="deleteRegularWork('${w.id}')">מחק</button></td>
        `;
        tbody.appendChild(tr);
    });

    // 2. מופעי איכילוב בחודש זה
    const monthIchilov = appData.ichilovShows.filter(s => s.date.startsWith(currentMonth));
    
    if (monthIchilov.length > 0) {
        const ichilovMonthTotal = monthIchilov.reduce((sum, s) => sum + s.totalPay, 0);
        grandTotal += ichilovMonthTotal;

        const tr = document.createElement("tr");
        tr.style.backgroundColor = "#f0fdf4";
        tr.innerHTML = `
            <td>${currentMonth}</td>
            <td><strong>החברה מאיכילוב</strong></td>
            <td>ריכוז מופעי איכילוב (${monthIchilov.length} מופעים)</td>
            <td><strong>₪${ichilovMonthTotal}</strong></td>
            <td>
                <span class="badge-link" onclick="switchTab('ichilov')">צפה בפירוט איכילוב ⬅</span>
            </td>
        `;
        tbody.appendChild(tr);
    }

    document.getElementById("grand-total-amount").textContent = `₪${grandTotal}`;
}
