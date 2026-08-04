// ==========================================
// 1. פונקציות עזר לבדיקה והמרת נתונים
// ==========================================

// המרת זמנים (HH:MM או מספר) לדקות באופן בטוח
function parseTimeToMinutes(val) {
    if (!val) return 0;
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

// המרת דקות חזרה לפורמט תצוגה HH:MM
function formatMinutesToHHMM(totalMinutes) {
    if (isNaN(totalMinutes) || totalMinutes <= 0) return "0:00";
    const hrs = Math.floor(totalMinutes / 60);
    const mins = Math.round(totalMinutes % 60);
    return `${hrs}:${mins < 10 ? '0' : ''}${mins}`;
}

// ==========================================
// 2. חישוב מופעי איכילוב (לוגיקה בטוחה)
// ==========================================
function calculateIchilov(showType, kmOneWay, timeThere, timeBack) {
    const km = parseFloat(kmOneWay) || 0;
    const totalKm = km * 2;

    const tThereMins = parseTimeToMinutes(timeThere);
    const tBackMins = parseTimeToMinutes(timeBack);
    const totalMins = tThereMins + tBackMins;

    // שכר בסיס
    let basePay = 670;
    if (showType === "ארוך") basePay = 840;
    else if (showType === "זוגי") basePay = 250;

    // תשלום קילומטראז'
    const kmPay = totalKm; 

    // תשלום זמן עודף (מעל 90 דקות)
    let excessMins = 0;
    let timePay = 0;
    if (totalMins > 90) {
        excessMins = totalMins - 90;
        timePay = Math.round(excessMins * (840 / 700));
    }

    const totalPay = basePay + kmPay + timePay;

    return {
        basePay: basePay,
        kmPay: kmPay,
        timePay: timePay,
        totalPay: totalPay,
        totalHoursStr: formatMinutesToHHMM(totalMins),
        excessHoursStr: formatMinutesToHHMM(excessMins)
    };
}

// ==========================================
// 3. טעינה ורינדור הנתונים (Render)
// ==========================================
let currentData = {};
let selectedMonth = "2026-07";

async function loadData() {
    try {
        const response = await fetch('data.json');
        if (!response.ok) throw new Error("לא ניתן שטען את data.json");
        currentData = await response.json();
        renderDashboard();
    } catch (err) {
        console.error("שגיאה שטעינת הנתונים:", err);
    }
}

function renderDashboard() {
    const events = currentData[selectedMonth] || [];
    
    let totalAll = 0;
    let totalPaid = 0;
    let totalUnpaid = 0;

    const mainTableBody = document.getElementById('mainTableBody');
    const ichilovTableBody = document.getElementById('ichilovTableBody');

    if (mainTableBody) mainTableBody.innerHTML = '';
    if (ichilovTableBody) ichilovTableBody.innerHTML = '';

    events.forEach(item => {
        try {
            // חישוב סכומים לכרטיסי הסיכום העליונים
            const itemAmount = Number(item.amount) || 0;
            totalAll += itemAmount;
            if (item.isPaid) {
                totalPaid += itemAmount;
            } else {
                totalUnpaid += itemAmount;
            }

            // 1. רינדור טבלה כללית
            if (mainTableBody) {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${item.date || ''}</td>
                    <td>${item.client || ''}</td>
                    <td>${item.type || ''}</td>
                    <td>${item.location || ''}</td>
                    <td>₪${itemAmount}</td>
                    <td>
                        <span class="badge ${item.isPaid ? 'bg-success' : 'bg-danger'}">
                            ${item.isPaid ? 'שולם' : 'X טרם שולם'}
                        </span>
                    </td>
                    <td>
                        <button class="btn btn-sm btn-outline-danger" onclick="deleteEvent(${item.id})">🗑️</button>
                    </td>
                `;
                mainTableBody.appendChild(tr);
            }

            // 2. רינדור טבלת איכילוב (מי שמשויך לאיכילוב)
            if (item.isIchilov && ichilovTableBody) {
                const iData = item.ichilovData || {};
                const calc = iData.calcDetails || calculateIchilov(
                    iData.showType || item.type,
                    iData.kmOneWay || 0,
                    iData.timeThere || 0,
                    iData.timeBack || 0
                );

                const trI = document.createElement('tr');
                trI.innerHTML = `
                    <td>${item.date || ''}</td>
                    <td>${iData.location || item.location || ''}</td>
                    <td>${iData.showType || item.type || ''}</td>
                    <td>${(Number(iData.kmOneWay) || 0) * 2} ק"מ</td>
                    <td>${calc.totalHoursStr || (iData.timeThere + '+' + iData.timeBack)}</td>
                    <td>₪${calc.basePay || 0}</td>
                    <td>₪${calc.kmPay || 0}</td>
                    <td>₪${calc.timePay || 0}</td>
                    <td><strong>₪${itemAmount}</strong></td>
                    <td>
                        <span class="badge ${item.isPaid ? 'bg-success' : 'bg-danger'}">
                            ${item.isPaid ? 'שולם' : 'טרם שולם'}
                        </span>
                    </td>
                    <td>
                        <button class="btn btn-sm btn-outline-danger" onclick="deleteEvent(${item.id})">🗑️</button>
                    </td>
                `;
                ichilovTableBody.appendChild(trI);
            }

        } catch (itemErr) {
            console.error("שגיאה ברינדור שורה ספציפית:", item, itemErr);
        }
    });

    // עדכון כרטיסי הסיכום בחלק העליון
    updateCardValues(totalAll, totalPaid, totalUnpaid);
}

function updateCardValues(total, paid, unpaid) {
    const elTotal = document.getElementById('totalAmount');
    const elPaid = document.getElementById('paidAmount');
    const elUnpaid = document.getElementById('unpaidAmount');

    if (elTotal) elTotal.textContent = `₪${total.toLocaleString()}`;
    if (elPaid) elPaid.textContent = `₪${paid.toLocaleString()}`;
    if (elUnpaid) elUnpaid.textContent = `₪${unpaid.toLocaleString()}`;
}

// שינוי חודש בתפריט הנגלל
function onMonthChange(event) {
    selectedMonth = event.target.value;
    renderDashboard();
}

// הפעלה בטעינת העמוד
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    
    const monthPicker = document.getElementById('monthPicker');
    if (monthPicker) {
        monthPicker.addEventListener('change', onMonthChange);
    }
});
