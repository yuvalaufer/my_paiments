let appData = {
    regularWorks: [],
    ichilovShows: []
};

const today = new Date();
let currentMonth = today.toISOString().substring(0, 7);

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("month-select").value = currentMonth;
    document.getElementById("month-select").addEventListener("change", (e) => {
        currentMonth = e.target.value;
        renderAll();
    });

    const todayStr = today.toISOString().substring(0, 10);
    if (document.getElementById("reg-date")) document.getElementById("reg-date").value = todayStr;
    if (document.getElementById("ichilov-date")) document.getElementById("ichilov-date").value = todayStr;

    loadData();
});

async function loadData() {
    try {
        const response = await fetch("data.json?t=" + new Date().getTime());
        if (response.ok) {
            appData = await response.json();
            if (!appData.regularWorks) appData.regularWorks = [];
            if (!appData.ichilovShows) appData.ichilovShows = [];
        }
    } catch (e) {
        console.warn("שגיאה שטעינת data.json", e);
    }
    updateClientsDropdown();
    renderAll();
}

function updateClientsDropdown() {
    const select = document.getElementById("client-select");
    if (!select) return;

    const clientsSet = new Set();
    clientsSet.add("החברה מאיכילוב");
    
    appData.regularWorks.forEach(w => {
        if (w.client) clientsSet.add(w.client);
    });

    select.innerHTML = '<option value="" disabled selected>בחר לקוח...</option>';
    
    clientsSet.forEach(client => {
        const opt = document.createElement("option");
        opt.value = client;
        opt.textContent = client;
        select.appendChild(opt);
    });

    const optNew = document.createElement("option");
    optNew.value = "חדש";
    optNew.textContent = "➕ לקוח חדש...";
    select.appendChild(optNew);
}

function handleClientSelectChange(select) {
    if (select.value === "החברה מאיכילוב") {
        switchTab('ichilov');
        select.value = "";
    } else if (select.value === "חדש") {
        showNewClientInput(true);
    } else {
        showNewClientInput(false);
    }
}

function showNewClientInput(show) {
    const input = document.getElementById("reg-client-new");
    if (input) {
        input.style.display = show ? "block" : "none";
        if (show) input.focus();
    }
}

function switchTab(tabName) {
    document.getElementById("tab-regular").classList.remove("active");
    document.getElementById("tab-ichilov").classList.remove("active");
    document.getElementById("tab-summary").classList.remove("active");

    document.getElementById("btn-tab-regular").classList.remove("active");
    document.getElementById("btn-tab-ichilov").classList.remove("active");
    document.getElementById("btn-tab-summary").classList.remove("active");

    if (tabName === 'regular') {
        document.getElementById("tab-regular").classList.add("active");
        document.getElementById("btn-tab-regular").classList.add("active");
    } else if (tabName === 'ichilov') {
        document.getElementById("tab-ichilov").classList.add("active");
        document.getElementById("btn-tab-ichilov").classList.add("active");
    } else if (tabName === 'summary') {
        document.getElementById("tab-summary").classList.add("active");
        document.getElementById("btn-tab-summary").classList.add("active");
    }
}

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

function calculateIchilov(showType, kmOneWay, timeThere, timeBack) {
    const km = parseFloat(kmOneWay) || 0;
    const kmPay = km; // km * 2 * 0.5 = km

    const tThereMins = parseTimeToMinutes(timeThere);
    const tBackMins = parseTimeToMinutes(timeBack);
    const totalMins = tThereMins + tBackMins;

    const basePay = (showType === "ארוך") ? 840 : 670;

    let excessMins = 0;
    let timePay = 0;

    if (totalMins > 120) {
        excessMins = totalMins - 120;
        const extraHours = Math.ceil(excessMins / 60);
        timePay = extraHours * 70;
    }

    const totalPay = basePay + kmPay + timePay;

    return { basePay, kmPay, timePay, totalPay, totalMins, excessMins };
}

function addRegularWork(e) {
    e.preventDefault();
    const select = document.getElementById("client-select");
    let clientName = select.value;
    
    if (clientName === "חדש") {
        clientName = document.getElementById("reg-client-new").value.trim();
    }
    if (!clientName) {
        alert("אנא לבחור או להזין שם לקוח");
        return;
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

function deleteRegularWork(id) {
    appData.regularWorks = appData.regularWorks.filter(w => w.id !== id);
    updateClientsDropdown();
    renderAll();
}

function deleteIchilovShow(id) {
    appData.ichilovShows = appData.ichilovShows.filter(s => s.id !== id);
    renderAll();
}

function renderAll() {
    renderIchilovTable();
    renderSummaryTable();
}

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

    const [year, month] = currentMonth.split('-');
    const dateObj = new Date(year, month - 1);
    const monthName = dateObj.toLocaleString('he-IL', { month: 'long', year: 'numeric' });

    document.getElementById("ichilov-month-summary-label").textContent = `סה"כ לתשלום – חודש ${monthName}:`;
    document.getElementById("ichilov-month-summary-total").textContent = `₪${monthTotal}`;
}

function renderSummaryTable() {
    const tbody = document.getElementById("summary-table-body");
    tbody.innerHTML = "";
    let grandTotal = 0;

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
            <td><span class="badge-link" onclick="switchTab('ichilov')">צפה בפירוט איכילוב ⬅</span></td>
        `;
        tbody.appendChild(tr);
    }

    document.getElementById("grand-total-amount").textContent = `₪${grandTotal}`;
}
