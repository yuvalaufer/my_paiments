
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

// ==========================================
// 3. מחשבון איכילוב (עם תמיכה במספר מופעים,
// מיקומים ומקטעי ק"מ וזמנים)
// ==========================================
function calculateIchilovAdvanced(
    showsTypesArray,
    kmSegmentsArray,
    timeSegmentsArray
) {
    let basePay = 0;
    showsTypesArray.forEach(type => {
        basePay += (type === "ארוך") ? 840 : 670;
    });

    let totalKm = 0;
    kmSegmentsArray.forEach(km => {
        totalKm += (parseFloat(km) || 0);
    });
    const kmPay = totalKm * 0.5;

    let totalMins = 0;
    timeSegmentsArray.forEach(tMins => {
        totalMins += (parseFloat(tMins) || 0);
    });

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
    const locationsContainer = document.getElementById(`${prefix}ichilov-locations-container`);
    const typesContainer = document.getElementById(`${prefix}ichilov-shows-types-container`);
    const kmContainer = document.getElementById(`${prefix}ichilov-km-container`);
    const timesContainer = document.getElementById(`${prefix}ichilov-times-container`);

    if (!countSelect || !locationsContainer || !typesContainer || !kmContainer || !timesContainer) return;

    const count = parseInt(countSelect.value, 10) || 1;

    // שדות מיקום דינמיים
    let locationsHTML = '<strong>מיקום לכל אחד מהמופעים:</strong><div style="display: flex; gap: 10px; margin-top: 8px; flex-wrap: wrap;">';
    for (let i = 1; i <= count; i++) {
        locationsHTML += `
            <div style="flex: 1; min-width: 140px;">
                <label style="font-size: 13px;">מופע #${i} מיקום:</label>
                <input type="text" id="${prefix}ichilov-location-${i}" class="form-control ichilov-dynamic-location" placeholder="הכנס מיקום מופע ${i}" required>
            </div>
        `;
    }
    locationsHTML += '</div>';
    locationsContainer.innerHTML = locationsHTML;

    // שדות סוג מופע דינמיים
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

    // שדות קילומטראז' דינמיים לפי מקטעי המסלול
    let kmHTML = '<strong>מרחקי נסיעה למקטעי המסלול (בק"מ):</strong><div style="display: flex; flex-direction: column; gap: 10px; margin-top: 8px;">';

    if (count === 1) {
        kmHTML += `
            <div>
                <label style="font-size: 13px; font-weight: bold; display: block; margin-bottom: 3px;">מרחק נסיעה בית - מופע ראשון (הלוך-חזור):</label>
                <input type="number" id="${prefix}ichilov-km-1" class="form-control ichilov-dynamic-km" min="0" step="0.1" placeholder="0" required value="0">
            </div>
        `;
    } else if (count === 2) {
        kmHTML += `
            <div>
                <label style="font-size: 13px; font-weight: bold; display: block; margin-bottom: 3px;">מרחק נסיעה בית - מופע ראשון:</label>
                <input type="number" id="${prefix}ichilov-km-1" class="form-control ichilov-dynamic-km" min="0" step="0.1" placeholder="0" required value="0">
            </div>
            <div>
                <label style="font-size: 13px; font-weight: bold; display: block; margin-bottom: 3px;">מרחק נסיעה מופע ראשון - מופע שני:</label>
                <input type="number" id="${prefix}ichilov-km-2" class="form-control ichilov-dynamic-km" min="0" step="0.1" placeholder="0" required value="0">
            </div>
            <div>
                <label style="font-size: 13px; font-weight: bold; display: block; margin-bottom: 3px;">מרחק נסיעה מופע שני - חזרה הביתה:</label>
                <input type="number" id="${prefix}ichilov-km-3" class="form-control ichilov-dynamic-km" min="0" step="0.1" placeholder="0" required value="0">
            </div>
        `;
    } else if (count === 3) {
        kmHTML += `
            <div>
                <label style="font-size: 13px; font-weight: bold; display: block; margin-bottom: 3px;">מרחק נסיעה בית - מופע ראשון:</label>
                <input type="number" id="${prefix}ichilov-km-1" class="form-control ichilov-dynamic-km" min="0" step="0.1" placeholder="0" required value="0">
            </div>
            <div>
                <label style="font-size: 13px; font-weight: bold; display: block; margin-bottom: 3px;">מרחק נסיעה מופע ראשון - מופע שני:</label>
                <input type="number" id="${prefix}ichilov-km-2" class="form-control ichilov-dynamic-km" min="0" step="0.1" placeholder="0" required value="0">
            </div>
            <div>
                <label style="font-size: 13px; font-weight: bold; display: block; margin-bottom: 3px;">מרחק נסיעה מופע שני - מופע שלישי:</label>
                <input type="number" id="${prefix}ichilov-km-3" class="form-control ichilov-dynamic-km" min="0" step="0.1" placeholder="0" required value="0">
            </div>
            <div>
                <label style="font-size: 13px; font-weight: bold; display: block; margin-bottom: 3px;">מרחק נסיעה מופע שלישי - חזרה הביתה:</label>
                <input type="number" id="${prefix}ichilov-km-4" class="form-control ichilov-dynamic-km" min="0" step="0.1" placeholder="0" required value="0">
            </div>
        `;
    }

    kmHTML += '</div>';
    kmContainer.innerHTML = kmHTML;

    // שדות זמני נסיעה דינמיים
    let timesHTML = '<strong>זמני נסיעה לפי מקטעים (שעות ודקות):</strong><div style="display: flex; flex-direction: column; gap: 12px; margin-top: 8px;">';

    if (count === 1) {
        // תיקון: זמני הלוך וחזור מוזנים בנפרד
        timesHTML += `
            <div>
                <label style="font-size: 13px; font-weight: bold; display: block; margin-bottom: 3px;">זמן נסיעה מהבית למופע (הלוך):</label>
                <div class="time-inputs-grid">
                    <div class="time-input-wrap">
                        <input type="number" id="${prefix}ichilov-hours-1" min="0" value="0" class="form-control ichilov-dynamic-time-h" required>
                        <span class="time-sub-label">שעות</span>
                    </div>
                    <div class="time-input-wrap">
                        <input type="number" id="${prefix}ichilov-mins-1" min="0" max="59" value="0" class="form-control ichilov-dynamic-time-m" required>
                        <span class="time-sub-label">דקות</span>
                    </div>
                </div>
            </div>
            <div>
                <label style="font-size: 13px; font-weight: bold; display: block; margin-bottom: 3px;">זמן נסיעה מהמופע הביתה (חזור):</label>
                <div class="time-inputs-grid">
                    <div class="time-input-wrap">
                        <input type="number" id="${prefix}ichilov-hours-2" min="0" value="0" class="form-control ichilov-dynamic-time-h" required>
                        <span class="time-sub-label">שעות</span>
                    </div>
                    <div class="time-input-wrap">
                        <input type="number" id="${prefix}ichilov-mins-2" min="0" max="59" value="0" class="form-control ichilov-dynamic-time-m" required>
                        <span class="time-sub-label">דקות</span>
                    </div>
                </div>
            </div>
        `;
    } else if (count === 2) {
        timesHTML += `
            <div>
                <label style="font-size: 13px; font-weight: bold; display: block; margin-bottom: 3px;">זמן נסיעה מהבית למופע ראשון:</label>
                <div class="time-inputs-grid">
                    <div class="time-input-wrap">
                        <input type="number" id="${prefix}ichilov-hours-1" min="0" value="0" class="form-control ichilov-dynamic-time-h" required>
                        <span class="time-sub-label">שעות</span>
                    </div>
                    <div class="time-input-wrap">
                        <input type="number" id="${prefix}ichilov-mins-1" min="0" max="59" value="0" class="form-control ichilov-dynamic-time-m" required>
                        <span class="time-sub-label">דקות</span>
                    </div>
                </div>
            </div>
            <div>
                <label style="font-size: 13px; font-weight: bold; display: block; margin-bottom: 3px;">זמן נסיעה בין מופע ראשון ושני:</label>
                <div class="time-inputs-grid">
                    <div class="time-input-wrap">
                        <input type="number" id="${prefix}ichilov-hours-2" min="0" value="0" class="form-control ichilov-dynamic-time-h" required>
                        <span class="time-sub-label">שעות</span>
                    </div>
                    <div class="time-input-wrap">
                        <input type="number" id="${prefix}ichilov-mins-2" min="0" max="59" value="0" class="form-control ichilov-dynamic-time-m" required>
                        <span class="time-sub-label">דקות</span>
                    </div>
                </div>
            </div>
            <div>
                <label style="font-size: 13px; font-weight: bold; display: block; margin-bottom: 3px;">זמן נסיעה מהמופע האחרון חזרה הביתה:</label>
                <div class="time-inputs-grid">
                    <div class="time-input-wrap">
                        <input type="number" id="${prefix}ichilov-hours-3" min="0" value="0" class="form-control ichilov-dynamic-time-h" required>
                        <span class="time-sub-label">שעות</span>
                    </div>
                    <div class="time-input-wrap">
                        <input type="number" id="${prefix}ichilov-mins-3" min="0" max="59" value="0" class="form-control ichilov-dynamic-time-m" required>
                        <span class="time-sub-label">דקות</span>
                    </div>
                </div>
            </div>
        `;
    } else if (count === 3) {
        timesHTML += `
            <div>
                <label style="font-size: 13px; font-weight: bold; display: block; margin-bottom: 3px;">זמן נסיעה מהבית למופע ראשון:</label>
                <div class="time-inputs-grid">
                    <div class="time-input-wrap">
                        <input type="number" id="${prefix}ichilov-hours-1" min="0" value="0" class="form-control ichilov-dynamic-time-h" required>
                        <span class="time-sub-label">שעות</span>
                    </div>
                    <div class="time-input-wrap">
                        <input type="number" id="${prefix}ichilov-mins-1" min="0" max="59" value="0" class="form-control ichilov-dynamic-time-m" required>
                        <span class="time-sub-label">דקות</span>
                    </div>
                </div>
            </div>
            <div>
                <label style="font-size: 13px; font-weight: bold; display: block; margin-bottom: 3px;">זמן נסיעה בין מופע ראשון ושני:</label>
                <div class="time-inputs-grid">
                    <div class="time-input-wrap">
                        <input type="number" id="${prefix}ichilov-hours-2" min="0" value="0" class="form-control ichilov-dynamic-time-h" required>
                        <span class="time-sub-label">שעות</span>
                    </div>
                    <div class="time-input-wrap">
                        <input type="number" id="${prefix}ichilov-mins-2" min="0" max="59" value="0" class="form-control ichilov-dynamic-time-m" required>
                        <span class="time-sub-label">דקות</span>
                    </div>
                </div>
            </div>
            <div>
                <label style="font-size: 13px; font-weight: bold; display: block; margin-bottom: 3px;">זמן נסיעה בין מופע שני ושלישי:</label>
                <div class="time-inputs-grid">
                    <div class="time-input-wrap">
                        <input type="number" id="${prefix}ichilov-hours-3" min="0" value="0" class="form-control ichilov-dynamic-time-h" required>
                        <span class="time-sub-label">שעות</span>
                    </div>
                    <div class="time-input-wrap">
                        <input type="number" id="${prefix}ichilov-mins-3" min="0" max="59" value="0" class="form-control ichilov-dynamic-time-m" required>
                        <span class="time-sub-label">דקות</span>
                    </div>
                </div>
            </div>
            <div>
                <label style="font-size: 13px; font-weight: bold; display: block; margin-bottom: 3px;">זמן נסיעה מהמופע האחרון חזרה הביתה:</label>
                <div class="time-inputs-grid">
                    <div class="time-input-wrap">
                        <input type="number" id="${prefix}ichilov-hours-4" min="0" value="0" class="form-control ichilov-dynamic-time-h" required>
                        <span class="time-sub-label">שעות</span>
                    </div>
                    <div class="time-input-wrap">
                        <input type="number" id="${prefix}ichilov-mins-4" min="0" max="59" value="0" class="form-control ichilov-dynamic-time-m" required>
                        <span class="time-sub-label">דקות</span>
                    </div>
                </div>
            </div>
        `;
    }

    timesHTML += '</div>';
    timesContainer.innerHTML = timesHTML;

    attachIchilovListeners(prefix);
}

function gatherIchilovInputsData(prefix = '') {
    const countSelect = document.getElementById(`${prefix}ichilov-shows-count`);
    const count = countSelect ? parseInt(countSelect.value, 10) || 1 : 1;

    const locationsArray = [];
    for (let i = 1; i <= count; i++) {
        const locEl = document.getElementById(`${prefix}ichilov-location-${i}`);
        locationsArray.push(locEl ? locEl.value.trim() : '');
    }

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

    // לכל מופע בודד שני מקטעי זמן: הלוך וחזור.
    // במספר מופעים יש מקטע נוסף בין כל שני מופעים.
    const timeSegmentsArray = [];
    const timeFieldsCount = count + 1;

    for (let i = 1; i <= timeFieldsCount; i++) {
        const hEl = document.getElementById(`${prefix}ichilov-hours-${i}`);
        const mEl = document.getElementById(`${prefix}ichilov-mins-${i}`);

        const hrs = hEl ? parseInt(hEl.value, 10) || 0 : 0;
        const mins = mEl ? parseInt(mEl.value, 10) || 0 : 0;

        timeSegmentsArray.push((hrs * 60) + mins);
    }

    const mainLocation = locationsArray.filter(Boolean).join(', ') || '';

    return {
        count,
        locationsArray,
        mainLocation,
        showsTypesArray,
        kmSegmentsArray,
        timeSegmentsArray
    };
}

function updateIchilovPreviewUnified(prefix = '') {
    const data = gatherIchilovInputsData(prefix);
    const calc = calculateIchilovAdvanced(
        data.showsTypesArray,
        data.kmSegmentsArray,
        data.timeSegmentsArray
    );

    const previewEl = document.getElementById(
        prefix ? 'modal-calc-breakdown' : 'calc-breakdown'
    );

    if (previewEl) {
        previewEl.innerHTML = `שכר בסיס (${data.count} מופעים): ₪${calc.basePay} | נסיעות: ₪${calc.kmPay} (${calc.totalKm} ק"מ) | תוספת זמן: ₪${calc.timePay} (${calc.totalHoursStr}) | <strong>סה"כ: ₪${calc.totalPay}</strong>`;
    }
}

function attachIchilovListeners(prefix = '') {
    const countSelect = document.getElementById(
        `${prefix}ichilov-shows-count`
    );

    if (countSelect && !countSelect.dataset.listenerAttached) {
        countSelect.dataset.listenerAttached = 'true';

        countSelect.addEventListener('change', () => {
            renderIchilovDynamicFields(prefix);
            updateIchilovPreviewUnified(prefix);
        });
    }

    const container = document.getElementById(
        prefix ? 'ichilov-modal' : 'ichilov-form'
    );

    if (container) {
        container.querySelectorAll('input, select').forEach(el => {
            if (!el.dataset.listenerAttached) {
                el.dataset.listenerAttached = 'true';

                el.addEventListener('input', () => {
                    updateIchilovPreviewUnified(prefix);
                });

                el.addEventListener('change', () => {
                    updateIchilovPreviewUnified(prefix);
                });
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

        if (!response.ok) {
            throw new Error("שגיאה בטעינת data.json");
        }

        currentData = await response.json();

        const monthPicker = document.getElementById('month-select');

        if (monthPicker) {
            if (!selectedMonth) {
                // תמיד מתחילים בחודש הנוכחי,
                // גם כאשר עדיין אין בו רשומות.
                const now = new Date();

                selectedMonth =
                    `${now.getFullYear()}-${String(
                        now.getMonth() + 1
                    ).padStart(2, '0')}`;
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

    selectEl.innerHTML =
        '<option value="" disabled selected>בחר לקוח...</option>';

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

    if (
        previousValue &&
        Array.from(selectEl.options).some(
            o => o.value === previousValue
        )
    ) {
        selectEl.value = previousValue;
    }
}

// ==========================================
// פונקציות עזר לפירוט זמני נסיעות איכילוב
// ==========================================

function escapePaymentHTML(value) {
    return String(value ?? '').replace(
        /[&<>"']/g,
        character => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        })[character]
    );
}

function getIchilovShowCount(ichilovData) {
    if (ichilovData.showsCount) {
        return Math.max(
            1,
            Math.min(3, Number(ichilovData.showsCount))
        );
    }

    if (
        Array.isArray(ichilovData.showsTypesArray) &&
        ichilovData.showsTypesArray.length > 0
    ) {
        return ichilovData.showsTypesArray.length;
    }

    return 1;
}

function getIchilovTimeSegments(ichilovData) {
    const count = getIchilovShowCount(ichilovData);

    // רשומות חדשות: כל מקטעי הנסיעה נשמרים בנפרד.
    if (
        Array.isArray(ichilovData.timeSegmentsArray) &&
        ichilovData.timeSegmentsArray.length === count + 1
    ) {
        return ichilovData.timeSegmentsArray.map(
            parseTimeToMinutes
        );
    }

    // תמיכה ברשומות ישנות שבהן נשמרו
    // זמני הלוך וחזור כשני שדות נפרדים.
    if (
        count === 1 &&
        ichilovData.timeThere != null &&
        ichilovData.timeBack != null
    ) {
        return [
            parseTimeToMinutes(ichilovData.timeThere),
            parseTimeToMinutes(ichilovData.timeBack)
        ];
    }

    // אם נשמר רק הזמן הכולל, אין להמציא
    // חלוקה משוערת להלוך ולחזור.
    return null;
}

function getIchilovTimeLabels(count) {
    if (count === 1) {
        return [
            'מהבית למופע (הלוך)',
            'מהמופע הביתה (חזור)'
        ];
    }

    const labels = ['מהבית למופע הראשון'];

    for (let i = 1; i < count; i++) {
        labels.push(`ממופע ${i} למופע ${i + 1}`);
    }

    labels.push('מהמופע האחרון הביתה');

    return labels;
}

function renderIchilovTimeDetails(ichilovData, calc) {
    const count = getIchilovShowCount(ichilovData);
    const segments = getIchilovTimeSegments(ichilovData);

    const totalMinutes =
        calc.totalMins ??
        ichilovData.totalMins ??
        parseTimeToMinutes(calc.totalHoursStr);

    const totalText = calc.totalHoursStr ||
        formatMinutesToHHMM(totalMinutes);

    // ברשומות ישנות ללא פירוט, מציגים
    // את הזמן הכולל בלבד.
    if (!segments) {
        return `
            <span>${escapePaymentHTML(totalText)}</span>
            <small style="display:block;color:#777;">
                פירוט זמני הנסיעה אינו שמור
            </small>
        `;
    }

    const labels = getIchilovTimeLabels(count);

    const detailRows = segments.map((minutes, index) => {
        const label = labels[index] || `מקטע ${index + 1}`;

        return `
            <div style="margin-bottom:4px;">
                ${escapePaymentHTML(label)}:
                <strong>${formatMinutesToHHMM(minutes)}</strong>
            </div>
        `;
    }).join('');

    return `
        <details class="travel-time-details">
            <summary style="cursor:pointer;white-space:nowrap;color:var(--secondary-color);font-weight:bold;">
                ${escapePaymentHTML(totalText)}
            </summary>
            <div style="min-width:180px;text-align:right;padding-top:8px;font-size:0.85rem;line-height:1.6;">
                ${detailRows}
            </div>
        </details>
    `;
}

// ==========================================
// תצוגת הטבלאות והסיכום הכספי
// ==========================================

function renderDashboard() {
    const events = currentData[selectedMonth] || [];

    let totalAll = 0;
    let totalPaid = 0;
    let totalUnpaid = 0;

    const mainList = document.getElementById('payments-list');

    const ichilovList = document.getElementById('ichilov-table')
        ? document.getElementById('ichilov-table').querySelector('tbody')
        : document.getElementById('ichilov-list');

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

            let displayLocation = item.location || '';

            if (item.isIchilov && item.ichilovData) {
                if (
                    Array.isArray(item.ichilovData.locationsArray) &&
                    item.ichilovData.locationsArray.length > 0
                ) {
                    displayLocation =
                        item.ichilovData.locationsArray.join(' | ');
                } else if (item.ichilovData.location) {
                    displayLocation = item.ichilovData.location;
                }
            }

            if (mainList) {
                const tr = document.createElement('tr');

                tr.innerHTML = `
                    <td>${escapePaymentHTML(item.date || '')}</td>
                    <td>${escapePaymentHTML(item.client || '')}</td>
                    <td>${escapePaymentHTML(item.type || '')}</td>
                    <td>${escapePaymentHTML(displayLocation)}</td>
                    <td>₪${itemAmount.toLocaleString()}</td>
                    <td>${statusSelectHTML}</td>
                    <td>
                        <button class="edit-btn"
                                onclick="window.editEvent(${item.id})"
                                title="ערוך רשומה"
                                style="border:0;background:transparent;cursor:pointer;font-size:1.1rem;padding:4px;">✏️</button>
                        <button class="delete-btn"
                                onclick="window.deleteEvent(${item.id})"
                                title="מחק">🗑️</button>
                    </td>
                `;

                mainList.appendChild(tr);
            }

            if (item.isIchilov && ichilovList) {
                const iData = item.ichilovData || {};

                const calc = iData.calcDetails ||
                    calculateIchilovAdvanced(
                        iData.showsTypesArray || ['רגיל'],
                        iData.kmSegmentsArray || [0],
                        iData.timeSegmentsArray || [0]
                    );

                const trI = document.createElement('tr');

                trI.innerHTML = `
                    <td>${escapePaymentHTML(item.date || '')}</td>
                    <td>${escapePaymentHTML(displayLocation)}</td>
                    <td>${escapePaymentHTML(iData.showsTypesSummary || item.type || '')}</td>
                    <td>${calc.totalKm || 0} ק"מ</td>
                    <td>${renderIchilovTimeDetails(iData, calc)}</td>
                    <td>₪${calc.basePay || 0}</td>
                    <td>₪${calc.kmPay || 0}</td>
                    <td>₪${calc.timePay || 0}</td>
                    <td><strong>₪${itemAmount.toLocaleString()}</strong></td>
                    <td>${statusSelectHTML}</td>
                    <td>
                        <button class="edit-btn"
                                onclick="window.editEvent(${item.id})"
                                title="ערוך רשומה"
                                style="border:0;background:transparent;cursor:pointer;font-size:1.1rem;padding:4px;">✏️</button>
                        <button class="delete-btn"
                                onclick="window.deleteEvent(${item.id})"
                                title="מחק">🗑️</button>
                    </td>
                `;

                ichilovList.appendChild(trI);
            }

        } catch (itemErr) {
            console.error(
                "שגיאה ברינדור שורת אירוע:",
                item,
                itemErr
            );
        }
    });

    const elTotal = document.getElementById('total-amount');
    const elPaid = document.getElementById('paid-amount');
    const elUnpaid = document.getElementById('unpaid-amount');

    if (elTotal) {
        elTotal.textContent = `₪${totalAll.toLocaleString()}`;
    }

    if (elPaid) {
        elPaid.textContent = `₪${totalPaid.toLocaleString()}`;
    }

    if (elUnpaid) {
        elUnpaid.textContent = `₪${totalUnpaid.toLocaleString()}`;
    }

    updateClientsDropdown();
    renderSaveButton();
    renderGlobalUnpaidTable();
}

// ==========================================
// 5. ניהול טבלת חובות פתוחים גלובלית
// ומעבר מהיר בין חודשים
// ==========================================

function renderGlobalUnpaidTable() {
    const unpaidListEl = document.getElementById(
        'global-unpaid-list'
    );

    const totalUnpaidSummaryEl = document.getElementById(
        'total-unpaid-summary'
    );

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
                    displayType =
                        item.ichilovData.showsTypesSummary ||
                        item.type;

                    if (
                        Array.isArray(item.ichilovData.locationsArray) &&
                        item.ichilovData.locationsArray.length > 0
                    ) {
                        displayLocation =
                            item.ichilovData.locationsArray.join(' | ');
                    } else {
                        displayLocation =
                            item.ichilovData.location ||
                            item.location;
                    }
                }

                tr.innerHTML = `
                    <td><strong>${escapePaymentHTML(monthKey)}</strong></td>
                    <td>${escapePaymentHTML(item.date || '')}</td>
                    <td>${escapePaymentHTML(item.client || '')}</td>
                    <td>${escapePaymentHTML(displayType)}</td>
                    <td>${escapePaymentHTML(displayLocation)}</td>
                    <td><strong>₪${itemAmount.toLocaleString()}</strong></td>
                    <td>
                        <button class="status-btn unpaid"
                                onclick="window.jumpToMonthAndEvent('${monthKey}')"
                                style="cursor:pointer;">
                            🔍 צפה בחודש
                        </button>
                    </td>
                `;

                unpaidListEl.appendChild(tr);
            }
        });
    });

    if (!hasItems) {
        unpaidListEl.innerHTML = `
            <tr>
                <td colspan="7"
                    style="text-align:center;color:var(--success-color);font-weight:bold;padding:20px;">
                    אין תשלומים ממתינים לגבייה! הכל שולם 🌟
                </td>
            </tr>
        `;
    }

    if (totalUnpaidSummaryEl) {
        totalUnpaidSummaryEl.textContent =
            `סך הכל ממתין לגבייה בכל החודשים: ₪${grandTotalUnpaid.toLocaleString()}`;
    }
}

window.jumpToMonthAndEvent = function(monthKey) {
    selectedMonth = monthKey;

    const monthPicker = document.getElementById('month-select');

    if (monthPicker) {
        monthPicker.value = monthKey;
    }

    document.querySelectorAll('.tab-btn').forEach(button => {
        button.classList.remove('active');
    });

    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });

    const regularTabBtn = document.querySelector(
        '[data-tab="regular-form"]'
    );

    const regularTabContent = document.getElementById(
        'regular-form'
    );

    if (regularTabBtn) {
        regularTabBtn.classList.add('active');
    }

    if (regularTabContent) {
        regularTabContent.classList.add('active');
    }

    renderDashboard();

    showStatusMessage(`עברת לתצוגת חודש ${monthKey}`);
};

// ==========================================
// כפתור שמירת שינויים
// ==========================================

function renderSaveButton() {
    let saveBtnContainer = document.getElementById(
        'save-changes-container'
    );

    if (!saveBtnContainer) {
        saveBtnContainer = document.createElement('div');
        saveBtnContainer.id = 'save-changes-container';

        saveBtnContainer.style.cssText =
            'text-align: center; margin: 20px 0;';

        const mainCard =
            document.querySelector('.card') ||
            document.body;

        mainCard.appendChild(saveBtnContainer);
    }

    if (hasUnsavedChanges) {
        saveBtnContainer.innerHTML = `
            <button onclick="window.saveAllChanges()"
                    style="background-color:#28a745;color:white;padding:12px 28px;border:none;border-radius:8px;font-size:16px;font-weight:bold;cursor:pointer;box-shadow:0 4px 6px rgba(0,0,0,0.1);">
                💾 שמור שינויים
            </button>
        `;
    } else {
        saveBtnContainer.innerHTML = '';
    }
}

// ==========================================
// 6. שינוי סטטוס תשלום ושמירה ב-GitHub
// ==========================================

window.handleStatusChange = function(id, value) {
    const monthEvents = currentData[selectedMonth] || [];

    const targetEvent = monthEvents.find(
        item => item.id === id
    );

    if (!targetEvent) return;

    const newStatus = (value === 'true');

    // תשלום איכילוב מתקבל במרוכז לכל חודש.
    // לכן מעדכנים רק את מופעי איכילוב
    // בחודש של הרשומה שנבחרה.
    if (
        targetEvent.isIchilov ||
        targetEvent.client === 'החברה מאיכילוב'
    ) {
        monthEvents.forEach(item => {
            if (
                item.isIchilov ||
                item.client === 'החברה מאיכילוב'
            ) {
                item.isPaid = newStatus;
            }
        });
    } else {
        targetEvent.isPaid = newStatus;
    }

    hasUnsavedChanges = true;

    renderDashboard();

    showStatusMessage(
        'ישנם שינויים שלא נשמרו. לחץ על "שמור שינויים"'
    );
};

// ==========================================
// שמירת הנתונים הקיימת ב-GitHub
// ==========================================

window.saveAllChanges = async function() {
    const config = getGithubConfig();

    if (!config.username || !config.repo || !config.token) {
        localStorage.setItem(
            'local_data_backup',
            JSON.stringify(currentData)
        );

        hasUnsavedChanges = false;
        renderDashboard();

        showStatusMessage(
            'השינויים נשמרו מקומית בדפדפן (חסרים פרטי חיבור בהגדרות GitHub)',
            true
        );

        return;
    }

    showStatusMessage('שומר שינויים ב-GitHub...');

    try {
        const url =
            `https://api.github.com/repos/${config.username}/${config.repo}/contents/data.json`;

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
            const errData = await getRes.json().catch(
                () => ({})
            );

            throw new Error(
                errData.message ||
                `שגיאת גישה (${getRes.status})`
            );
        }

        const jsonString = JSON.stringify(
            currentData,
            null,
            2
        );

        const utf8Bytes = new TextEncoder().encode(
            jsonString
        );

        let binaryString = "";

        for (let i = 0; i < utf8Bytes.length; i++) {
            binaryString += String.fromCharCode(
                utf8Bytes[i]
            );
        }

        const contentEncoded = btoa(binaryString);

        const payload = {
            message: 'עדכון נתונים מאפליקציית התשלומים',
            content: contentEncoded
        };

        if (sha) {
            payload.sha = sha;
        }

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

            showStatusMessage(
                'השינויים נשמרו בהצלחה ב-GitHub!'
            );
        } else {
            const putErr = await putRes.json().catch(
                () => ({})
            );

            throw new Error(
                putErr.message ||
                'שגיאה בשמירה ל-GitHub'
            );
        }

    } catch (err) {
        console.error(err);

        showStatusMessage(
            `שגיאה בשמירה ל-GitHub: ${err.message}`,
            true
        );
    }
};

// ==========================================
// מחיקת רשומה קיימת
// ==========================================

window.deleteEvent = function(id) {
    if (!confirm(
        "האם אתה בטוח שברצונך למחוק אירוע זה?"
    )) {
        return;
    }

    if (currentData[selectedMonth]) {
        currentData[selectedMonth] =
            currentData[selectedMonth].filter(
                item => item.id !== id
            );

        hasUnsavedChanges = true;

        renderDashboard();

        showStatusMessage(
            'האירוע נמחק. זכור ללחוץ על "שמור שינויים"'
        );
    }
};

// ==========================================
// מכאן מתחיל מנגנון עריכת הרשומות
// שיופיע בחלק 5
// ==========================================

// ==========================================
// 7. עריכת רשומות קיימות
// ==========================================

let editingPayment = null;

function closePaymentEditModal() {
    const modal = document.getElementById('payment-edit-modal');

    if (modal) {
        modal.style.display = 'none';
    }

    editingPayment = null;
}

function ensurePaymentEditModal() {
    let modal = document.getElementById('payment-edit-modal');

    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'payment-edit-modal';
    modal.className = 'modal';

    modal.innerHTML = `
        <div class="modal-content" style="max-width:720px;">
            <button id="close-payment-edit"
                    type="button"
                    aria-label="סגור"
                    class="close-btn"
                    style="border:0;background:none;">
                &times;
            </button>

            <h2>✏️ עריכת רשומה</h2>

            <form id="payment-edit-form">
                <div id="payment-edit-fields"></div>

                <div style="display:flex;gap:10px;margin-top:15px;">
                    <button class="submit-btn" type="submit">
                        💾 עדכן רשומה
                    </button>

                    <button class="submit-btn"
                            id="cancel-payment-edit"
                            type="button"
                            style="background:#777;">
                        ביטול
                    </button>
                </div>
            </form>
        </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('#close-payment-edit').onclick =
        closePaymentEditModal;

    modal.querySelector('#cancel-payment-edit').onclick =
        closePaymentEditModal;

    modal.addEventListener('click', event => {
        if (event.target === modal) {
            closePaymentEditModal();
        }
    });

    modal.querySelector('#payment-edit-form')
        .addEventListener('submit', saveEditedPayment);

    return modal;
}

// ==========================================
// פתיחת רשומה לעריכה
// ==========================================

window.editEvent = function(id) {
    const item = (currentData[selectedMonth] || [])
        .find(event => event.id === id);

    if (!item) return;

    editingPayment = {
        id,
        sourceMonth: selectedMonth
    };

    const modal = ensurePaymentEditModal();
    const fields = modal.querySelector('#payment-edit-fields');

    const input = (
        label,
        name,
        value,
        type = 'text',
        extra = ''
    ) => `
        <div class="form-group" style="margin-top:10px;">
            <label for="edit-${name}">
                ${label}
            </label>
            <input class="form-control"
                   id="edit-${name}"
                   name="${name}"
                   type="${type}"
                   value="${escapePaymentHTML(value)}"
                   ${extra}>
        </div>
    `;

    const status = `
        <div class="form-group" style="margin-top:10px;">
            <label for="edit-paid">סטטוס תשלום</label>

            <select id="edit-paid" class="form-control">
                <option value="false"
                    ${!item.isPaid ? 'selected' : ''}>
                    טרם שולם
                </option>

                <option value="true"
                    ${item.isPaid ? 'selected' : ''}>
                    שולם
                </option>
            </select>
        </div>
    `;

    // ======================================
    // עריכת עבודה רגילה
    // ======================================

    if (!item.isIchilov) {
        fields.innerHTML =
            input(
                'לקוח',
                'client',
                item.client || '',
                'text',
                'required'
            ) +
            input(
                'סוג עבודה',
                'type',
                item.type || '',
                'text',
                'required'
            ) +
            input(
                'מיקום',
                'location',
                item.location || ''
            ) +
            input(
                'תאריך',
                'date',
                item.date || '',
                'date',
                'required'
            ) +
            input(
                'סכום (₪)',
                'amount',
                item.amount ?? 0,
                'number',
                'min="0" step="any" required'
            ) +
            status;

    } else {
        // ==================================
        // עריכת מופע איכילוב
        // ==================================

        const data = item.ichilovData || {};
        const count = getIchilovShowCount(data);

        const types =
            data.showsTypesArray ||
            [data.showType || 'רגיל'];

        const locations =
            data.locationsArray ||
            [data.location || item.location || ''];

        let kmSegments = Array.isArray(data.kmSegmentsArray)
            ? [...data.kmSegmentsArray]
            : [];

        if (
            !kmSegments.length &&
            data.kmOneWay != null
        ) {
            kmSegments = [
                parseFloat(data.kmOneWay) * 2
            ];
        }

        const times = getIchilovTimeSegments(data);

        const totalTime = parseTimeToMinutes(
            data.calcDetails?.totalMins ??
            data.calcDetails?.totalHoursStr ??
            data.totalMins ??
            0
        );

        // רשומה ישנה שלא מכילה את פירוט
        // מקטעי הזמן המקוריים.
        const legacyCombined =
            !times && count === 1;

        fields.innerHTML =
            input(
                'תאריך',
                'date',
                item.date || '',
                'date',
                'required'
            ) +
            `
                <div class="form-group"
                     style="margin-top:10px;">
                    <label for="edit-count">
                        מספר מופעים
                    </label>

                    <select id="edit-count"
                            class="form-control">
                        ${[1, 2, 3].map(n => `
                            <option value="${n}"
                                ${n === count ? 'selected' : ''}>
                                ${n}
                            </option>
                        `).join('')}
                    </select>
                </div>

                <div id="edit-ichilov-dynamic"></div>
            ` +
            status;

        const fill = (n, initial) => {
            const names = getIchilovTimeLabels(n);

            const dest = document.getElementById(
                'edit-ichilov-dynamic'
            );

            let html = '';

            // מיקומים וסוגי מופעים
            for (let i = 0; i < n; i++) {
                html += input(
                    `מיקום מופע ${i + 1}`,
                    `location-${i}`,
                    initial ? (locations[i] || '') : '',
                    'text',
                    'required'
                );

                html += `
                    <div class="form-group"
                         style="margin-top:10px;">
                        <label>
                            סוג מופע ${i + 1}
                        </label>

                        <select class="form-control"
                                id="edit-type-${i}">
                            <option value="רגיל"
                                ${(!initial || types[i] !== 'ארוך') ? 'selected' : ''}>
                                רגיל (₪670)
                            </option>

                            <option value="ארוך"
                                ${(initial && types[i] === 'ארוך') ? 'selected' : ''}>
                                ארוך (₪840)
                            </option>
                        </select>
                    </div>
                `;
            }

            // מרחקי נסיעה
            const kmLabels = n === 1
                ? ['מרחק בית–מופע (כיוון אחד, ק״מ)']
                : names.map(
                    name => `מרחק ${name} (ק״מ)`
                );

            for (let i = 0; i < kmLabels.length; i++) {
                const value = initial
                    ? (
                        n === 1
                            ? (kmSegments[0] || 0) / 2
                            : (kmSegments[i] || 0)
                    )
                    : 0;

                html += input(
                    kmLabels[i],
                    `km-${i}`,
                    value,
                    'number',
                    'min="0" step="0.1" required'
                );
            }

            // זמני נסיעה – כל מקטע בנפרד
            for (let i = 0; i < names.length; i++) {
                const minutes =
                    initial && times
                        ? (times[i] || 0)
                        : 0;

                html += `
                    <div class="form-group"
                         style="margin-top:10px;">
                        <label>
                            ${escapePaymentHTML(names[i])}
                        </label>

                        <div class="time-inputs-grid">
                            <div class="time-input-wrap">
                                <input type="number"
                                       class="form-control"
                                       id="edit-hours-${i}"
                                       min="0"
                                       value="${Math.floor(minutes / 60)}"
                                       required>

                                <span class="time-sub-label">
                                    שעות
                                </span>
                            </div>

                            <div class="time-input-wrap">
                                <input type="number"
                                       class="form-control"
                                       id="edit-mins-${i}"
                                       min="0"
                                       max="59"
                                       value="${minutes % 60}"
                                       required>

                                <span class="time-sub-label">
                                    דקות
                                </span>
                            </div>
                        </div>
                    </div>
                `;
            }

            if (initial && legacyCombined) {
                html += `
                    <p id="edit-old-time-notice"
                       style="color:#a94442;margin-top:10px;">
                        ברשומה הישנה נשמר זמן נסיעה כולל
                        (${escapePaymentHTML(formatMinutesToHHMM(totalTime))})
                        ללא חלוקה להלוך וחזור.

                        יש להזין את זמני הנסיעה
                        בנפרד לפני שמירת הרשומה.
                    </p>
                `;
            }

            html += `
                <div id="edit-calc-preview"
                     class="calc-preview"
                     style="margin-top:12px;">
                </div>
            `;

            dest.innerHTML = html;

            dest.querySelectorAll('input,select')
                .forEach(element => {
                    element.addEventListener(
                        'input',
                        updateEditedIchilovPreview
                    );

                    element.addEventListener(
                        'change',
                        updateEditedIchilovPreview
                    );
                });

            updateEditedIchilovPreview();
        };

        fields.querySelector('#edit-count')
            .addEventListener('change', event => {
                fill(Number(event.target.value), false);
            });

        fill(count, true);
    }

    modal.style.display = 'block';
};

// ==========================================
// איסוף נתוני עריכת איכילוב
// ==========================================

function gatherEditedIchilov() {
    const count = Number(
        document.getElementById('edit-count').value
    );

    const locationsArray = [];
    const showsTypesArray = [];
    const kmSegmentsArray = [];
    const timeSegmentsArray = [];

    for (let i = 0; i < count; i++) {
        locationsArray.push(
            document.getElementById(
                `edit-location-${i}`
            ).value.trim()
        );

        showsTypesArray.push(
            document.getElementById(
                `edit-type-${i}`
            ).value
        );
    }

    for (
        let i = 0;
        i < (count === 1 ? 1 : count + 1);
        i++
    ) {
        const value = Number(
            document.getElementById(
                `edit-km-${i}`
            ).value
        ) || 0;

        kmSegmentsArray.push(
            count === 1 ? value * 2 : value
        );
    }

    for (let i = 0; i < count + 1; i++) {
        const hours = Number(
            document.getElementById(
                `edit-hours-${i}`
            ).value
        ) || 0;

        const minutes = Number(
            document.getElementById(
                `edit-mins-${i}`
            ).value
        ) || 0;

        timeSegmentsArray.push(
            hours * 60 + minutes
        );
    }

    return {
        count,
        locationsArray,
        showsTypesArray,
        kmSegmentsArray,
        timeSegmentsArray
    };
}

// ==========================================
// עדכון תצוגת החישוב בזמן עריכה
// ==========================================

function updateEditedIchilovPreview() {
    const dest = document.getElementById(
        'edit-calc-preview'
    );

    if (!dest) return;

    const entry = gatherEditedIchilov();

    const calc = calculateIchilovAdvanced(
        entry.showsTypesArray,
        entry.kmSegmentsArray,
        entry.timeSegmentsArray
    );

    dest.textContent =
        `שכר בסיס: ₪${calc.basePay} | ` +
        `מרחק: ${calc.totalKm} ק״מ (₪${calc.kmPay}) | ` +
        `זמן: ${calc.totalHoursStr} (₪${calc.timePay}) | ` +
        `סה״כ: ₪${calc.totalPay}`;
}

// ==========================================
// שמירת הרשומה הערוכה
// ==========================================

function saveEditedPayment(event) {
    event.preventDefault();

    if (!editingPayment) return;

    const { id, sourceMonth } = editingPayment;
    const sourceList = currentData[sourceMonth] || [];

    const index = sourceList.findIndex(
        item => item.id === id
    );

    if (index < 0) return;

    const oldItem = sourceList[index];

    const date = document.getElementById(
        'edit-date'
    ).value;

    if (!date) return;

    const newMonth = date.slice(0, 7);

    const paid = document.getElementById(
        'edit-paid'
    ).value === 'true';

    // אין לייצר חלוקה בדויה של זמני נסיעה.
    if (
        oldItem.isIchilov &&
        document.getElementById('edit-old-time-notice')
    ) {
        const values =
            gatherEditedIchilov().timeSegmentsArray;

        if (values.every(value => value === 0)) {
            alert(
                'ברשומה ישנה זו לא נשמרו זמני הלוך וחזור. ' +
                'יש להזין אותם בנפרד לפני השמירה.'
            );

            return;
        }
    }

    let updated;

    if (oldItem.isIchilov) {
        const fields = gatherEditedIchilov();

        if (
            fields.locationsArray.some(
                location => !location
            )
        ) {
            alert('יש למלא מיקום לכל מופע');
            return;
        }

        const calc = calculateIchilovAdvanced(
            fields.showsTypesArray,
            fields.kmSegmentsArray,
            fields.timeSegmentsArray
        );

        const location =
            fields.locationsArray.join(', ');

        updated = {
            ...oldItem,
            date,
            location,
            amount: calc.totalPay,
            isPaid: paid,
            type: `${fields.count} מופעים`,
            ichilovData: {
                ...oldItem.ichilovData,
                showsCount: fields.count,
                locationsArray: fields.locationsArray,
                showsTypesArray: fields.showsTypesArray,
                showsTypesSummary:
                    fields.showsTypesArray.map(
                        (type, index) =>
                            `מופע ${index + 1} (${type})`
                    ).join(', '),
                kmSegmentsArray: fields.kmSegmentsArray,
                timeSegmentsArray: fields.timeSegmentsArray,
                totalMins: calc.totalMins,
                location,
                calcDetails: calc
            }
        };

        // הסרת שדות ישנים לאחר המרה
        // לפורמט המקטעים החדש.
        delete updated.ichilovData.timeThere;
        delete updated.ichilovData.timeBack;
        delete updated.ichilovData.timeTransfers;
        delete updated.ichilovData.kmOneWay;
        delete updated.ichilovData.showType;

    } else {
        updated = {
            ...oldItem,
            date,
            client: document.getElementById(
                'edit-client'
            ).value.trim(),
            type: document.getElementById(
                'edit-type'
            ).value.trim(),
            location: document.getElementById(
                'edit-location'
            ).value.trim(),
            amount: Number(
                document.getElementById(
                    'edit-amount'
                ).value
            ),
            isPaid: paid
        };

        if (!updated.client || !updated.type) {
            alert('יש למלא לקוח וסוג עבודה');
            return;
        }
    }

    // הסרת הרשומה ממיקומה המקורי.
    sourceList.splice(index, 1);

    // הכנסת הרשומה לחודש המתאים לתאריך המעודכן.
    if (!currentData[newMonth]) {
        currentData[newMonth] = [];
    }

    currentData[newMonth].push(updated);

    // סטטוס איכילוב חל על כל המופעים
    // של אותו חודש בלבד.
    if (
        updated.isIchilov ||
        updated.client === 'החברה מאיכילוב'
    ) {
        currentData[newMonth].forEach(item => {
            if (
                item.isIchilov ||
                item.client === 'החברה מאיכילוב'
            ) {
                item.isPaid = paid;
            }
        });
    }

    hasUnsavedChanges = true;
    selectedMonth = newMonth;

    const picker = document.getElementById(
        'month-select'
    );

    if (picker) {
        picker.value = newMonth;
    }

    closePaymentEditModal();
    renderDashboard();

    showStatusMessage(
        'הרשומה עודכנה. לחץ על "שמור שינויים" כדי לשמור ב-GitHub.'
    );
}

// ==========================================
// 8. ניהול חלון הגדרות GitHub (Modal)
// ==========================================

function setupModal() {
    const modal = document.getElementById('settings-modal');
    const btn = document.getElementById('settings-btn');
    const closeBtn = document.querySelector(
        '#settings-modal .close-btn'
    );
    const form = document.getElementById('settings-form');

    const getInputElement = (...ids) => {
        for (const id of ids) {
            const el = document.getElementById(id);
            if (el) return el;
        }
        return null;
    };

    if (btn && modal) {
        btn.onclick = () => {
            const config = getGithubConfig();

            const userInput = getInputElement(
                'github-username', 'username', 'gh-username'
            );
            const repoInput = getInputElement(
                'github-repo', 'repo', 'gh-repo'
            );
            const tokenInput = getInputElement(
                'github-token', 'token', 'gh-token', 'pat'
            );

            if (userInput) userInput.value = config.username;
            if (repoInput) repoInput.value = config.repo;
            if (tokenInput) tokenInput.value = config.token;

            modal.style.display = 'block';
        };
    }

    if (closeBtn && modal) {
        closeBtn.onclick = () => {
            modal.style.display = 'none';
        };
    }

    window.addEventListener('click', event => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });

    if (form) {
        form.onsubmit = event => {
            event.preventDefault();

            const userInput = getInputElement(
                'github-username', 'username', 'gh-username'
            );
            const repoInput = getInputElement(
                'github-repo', 'repo', 'gh-repo'
            );
            const tokenInput = getInputElement(
                'github-token', 'token', 'gh-token', 'pat'
            );

            const username = userInput
                ? userInput.value.trim()
                : '';

            const repo = repoInput
                ? repoInput.value.trim()
                : '';

            const token = tokenInput
                ? tokenInput.value.trim()
                : '';

            localStorage.setItem('gh_username', username);
            localStorage.setItem('gh_repo', repo);
            localStorage.setItem('gh_token', token);

            showStatusMessage(
                'הגדרות GitHub נשמרו בהצלחה!'
            );

            modal.style.display = 'none';
        };
    }
}

// ==========================================
// 9. ניהול לשוניות (Tabs)
// ==========================================

function setupTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(button => {
                button.classList.remove('active');
            });

            document.querySelectorAll('.tab-content')
                .forEach(content => {
                    content.classList.remove('active');
                });

            btn.classList.add('active');

            const tabId = btn.getAttribute('data-tab');
            const targetTab = document.getElementById(tabId);

            if (targetTab) {
                targetTab.classList.add('active');
            }
        });
    });
}

// ==========================================
// 10. מחשבון איכילוב בחלונית נפרדת
// ==========================================

function setupIchilovModal() {
    const modal = document.getElementById('ichilov-modal');
    const closeBtn = document.getElementById(
        'close-ichilov-modal'
    );
    const form = document.getElementById(
        'modal-ichilov-form'
    );

    if (closeBtn && modal) {
        closeBtn.onclick = () => {
            modal.style.display = 'none';
        };
    }

    renderIchilovDynamicFields('modal-');

    if (form) {
        form.onsubmit = event => {
            event.preventDefault();

            const date = document.getElementById(
                'modal-ichilov-date'
            ).value;

            const isPaid = document.getElementById(
                'modal-ichilov-status'
            ).value === 'true';

            const inputData = gatherIchilovInputsData('modal-');

            const calc = calculateIchilovAdvanced(
                inputData.showsTypesArray,
                inputData.kmSegmentsArray,
                inputData.timeSegmentsArray
            );

            const monthKey = date.substring(0, 7);

            const showsTypesSummary =
                inputData.showsTypesArray.map(
                    (type, index) =>
                        `מופע ${index + 1} (${type})`
                ).join(', ');

            const newEvent = {
                id: Date.now(),
                date,
                client: 'החברה מאיכילוב',
                type: `${inputData.count} מופעים`,
                location: inputData.mainLocation,
                amount: calc.totalPay,
                isPaid,
                isIchilov: true,
                ichilovData: {
                    showsCount: inputData.count,
                    locationsArray: inputData.locationsArray,
                    showsTypesArray: inputData.showsTypesArray,
                    showsTypesSummary,
                    kmSegmentsArray: inputData.kmSegmentsArray,
                    timeSegmentsArray: inputData.timeSegmentsArray,
                    totalMins: calc.totalMins,
                    location: inputData.mainLocation,
                    calcDetails: calc
                }
            };

            if (!currentData[monthKey]) {
                currentData[monthKey] = [];
            }

            currentData[monthKey].push(newEvent);

            hasUnsavedChanges = true;
            renderDashboard();

            form.reset();
            renderIchilovDynamicFields('modal-');

            if (modal) {
                modal.style.display = 'none';
            }

            showStatusMessage(
                'מופע איכילוב נוסף בהצלחה! לחץ "שמור שינויים".'
            );
        };
    }
}

// ==========================================
// 11. הוספת עבודות רגילות ומופעי איכילוב
// ==========================================

function setupForms() {
    const clientSelect = document.getElementById(
        'client-select'
    );

    const newClientContainer = document.getElementById(
        'new-client-container'
    );

    if (clientSelect && newClientContainer) {
        clientSelect.addEventListener('change', event => {
            const selectedVal = event.target.value;

            if (selectedVal === 'החברה מאיכילוב') {
                const ichilovModal = document.getElementById(
                    'ichilov-modal'
                );

                if (ichilovModal) {
                    ichilovModal.style.display = 'block';
                    clientSelect.value = "";
                }

            } else if (selectedVal === '__NEW__') {
                newClientContainer.style.display = 'block';

                document.getElementById(
                    'new-client-name'
                ).required = true;

            } else {
                newClientContainer.style.display = 'none';

                document.getElementById(
                    'new-client-name'
                ).required = false;
            }
        });
    }

    // --------------------------------------
    // הוספת עבודה רגילה
    // --------------------------------------

    const regularForm = document.getElementById(
        'add-regular-form'
    );

    if (regularForm) {
        regularForm.onsubmit = event => {
            event.preventDefault();

            let client = clientSelect
                ? clientSelect.value
                : '';

            if (client === '__NEW__') {
                client = document.getElementById(
                    'new-client-name'
                ).value.trim();
            }

            if (!client) {
                alert('אנא בחר או הכנס שם לקוח');
                return;
            }

            const type = document.getElementById(
                'job-type'
            ).value;

            const location = document.getElementById(
                'job-location'
            ).value;

            const date = document.getElementById(
                'job-date'
            ).value;

            const amount = parseFloat(
                document.getElementById('job-amount').value
            ) || 0;

            const isPaid = document.getElementById(
                'job-status'
            ).value === 'true';

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

            if (!currentData[monthKey]) {
                currentData[monthKey] = [];
            }

            currentData[monthKey].push(newEvent);

            hasUnsavedChanges = true;

            regularForm.reset();

            if (newClientContainer) {
                newClientContainer.style.display = 'none';
            }

            renderDashboard();

            showStatusMessage(
                'אירוע נוצר! לחץ "שמור שינויים" לעדכון הקובץ.'
            );
        };
    }

    // --------------------------------------
    // הוספת מופע איכילוב בטופס הייעודי
    // --------------------------------------

    renderIchilovDynamicFields('');

    const ichilovForm = document.getElementById(
        'add-ichilov-form'
    );

    if (ichilovForm) {
        ichilovForm.onsubmit = event => {
            event.preventDefault();

            const date = document.getElementById(
                'ichilov-date'
            ).value;

            const isPaid = document.getElementById(
                'ichilov-status'
            ).value === 'true';

            const inputData = gatherIchilovInputsData('');

            const calc = calculateIchilovAdvanced(
                inputData.showsTypesArray,
                inputData.kmSegmentsArray,
                inputData.timeSegmentsArray
            );

            const monthKey = date.substring(0, 7);

            const showsTypesSummary =
                inputData.showsTypesArray.map(
                    (type, index) =>
                        `מופע ${index + 1} (${type})`
                ).join(', ');

            const newEvent = {
                id: Date.now(),
                date,
                client: 'החברה מאיכילוב',
                type: `${inputData.count} מופעים`,
                location: inputData.mainLocation,
                amount: calc.totalPay,
                isPaid,
                isIchilov: true,
                ichilovData: {
                    showsCount: inputData.count,
                    locationsArray: inputData.locationsArray,
                    showsTypesArray: inputData.showsTypesArray,
                    showsTypesSummary,
                    kmSegmentsArray: inputData.kmSegmentsArray,
                    timeSegmentsArray: inputData.timeSegmentsArray,
                    totalMins: calc.totalMins,
                    location: inputData.mainLocation,
                    calcDetails: calc
                }
            };

            if (!currentData[monthKey]) {
                currentData[monthKey] = [];
            }

            currentData[monthKey].push(newEvent);

            hasUnsavedChanges = true;

            renderDashboard();

            ichilovForm.reset();
            renderIchilovDynamicFields('');
            updateIchilovPreviewUnified('');

            showStatusMessage(
                'מופע איכילוב נוסף! לחץ "שמור שינויים" לעדכון הקובץ.'
            );
        };
    }
}

// ==========================================
// 12. אתחול האתר בטעינה
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    setupModal();
    setupTabs();
    setupForms();
    setupIchilovModal();

    const monthSelect = document.getElementById(
        'month-select'
    );

    if (monthSelect) {
        monthSelect.addEventListener('change', event => {
            const newMonth = event.target.value;

            if (!newMonth) {
                event.target.value = selectedMonth;

                showStatusMessage(
                    'פעולת איפוס החודש בוטלה כדי למנוע היעלמות נתונים.',
                    true
                );

                return;
            }

            selectedMonth = newMonth;
            renderDashboard();
        });
    }

    loadData();
});
