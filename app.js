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
// 3. מחשבון איכילוב (עם תמיכה במספר מופעים, מיקומים ומקטעי ק"מ וזמנים)
// ==========================================
function calculateIchilovAdvanced(showsTypesArray, kmSegmentsArray, timeSegmentsArray) {
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

function renderIchilovDynamicFields(prefix = '', existingData = null) {
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
        let locVal = '';
        if (existingData && existingData.locationsArray && existingData.locationsArray[i-1]) {
            locVal = existingData.locationsArray[i-1];
        } else if (i === 1 && existingData && existingData.location && count === 1) {
            locVal = existingData.location;
        }
        locationsHTML += `
            <div style="flex: 1; min-width: 140px;">
                <label style="font-size: 13px;">מופע #${i} מיקום:</label>
                <input type="text" id="${prefix}ichilov-location-${i}" class="form-control ichilov-dynamic-location" placeholder="הכנס מיקום מופע ${i}" value="${locVal}" required>
            </div>
        `;
    }
    locationsHTML += '</div>';
    locationsContainer.innerHTML = locationsHTML;

    // שדות סוג מופע דינמיים
    let typesHTML = '<strong>סוג מופע לכל אחד מהמופעים:</strong><div style="display: flex; gap: 10px; margin-top: 8px; flex-wrap: wrap;">';
    for (let i = 1; i <= count; i++) {
        let typeVal = 'רגיל';
        if (existingData && existingData.showsTypesArray && existingData.showsTypesArray[i-1]) {
            typeVal = existingData.showsTypesArray[i-1];
        } else if (i === 1 && existingData && existingData.showType && count === 1) {
            typeVal = existingData.showType;
        }
        typesHTML += `
            <div style="flex: 1; min-width: 140px;">
                <label style="font-size: 13px;">מופע #${i}:</label>
                <select id="${prefix}ichilov-show-type-${i}" class="form-control ichilov-dynamic-type" data-index="${i}">
                    <option value="רגיל" ${typeVal === 'רגיל' ? 'selected' : ''}>רגיל (₪670)</option>
                    <option value="ארוך" ${typeVal === 'ארוך' ? 'selected' : ''}>ארוך (₪840)</option>
                </select>
            </div>
        `;
    }
    typesHTML += '</div>';
    typesContainer.innerHTML = typesHTML;

    // שדות קילומטראז' דינמיים לפי מקטעי המסלול המבוקשים
    let kmHTML = '<strong>מרחקי נסיעה למקטעי המסלול (בק"מ):</strong><div style="display: flex; flex-direction: column; gap: 10px; margin-top: 8px;">';
    
    if (count === 1) {
        let kmVal = 0;
        if (existingData) {
            if (existingData.kmSegmentsArray && existingData.kmSegmentsArray[0] !== undefined) {
                kmVal = existingData.kmSegmentsArray[0] / 2;
            } else if (existingData.kmOneWay !== undefined) {
                kmVal = existingData.kmOneWay;
            }
        }
        kmHTML += `
            <div>
                <label style="font-size: 13px; font-weight: bold; display: block; margin-bottom: 3px;">מרחק נסיעה בית - מופע ראשון (הלוך-חזור):</label>
                <input type="number" id="${prefix}ichilov-km-1" class="form-control ichilov-dynamic-km" min="0" step="0.1" placeholder="0" required value="${kmVal}">
            </div>
        `;
    } else if (count === 2) {
        let km1 = 0, km2 = 0, km3 = 0;
        if (existingData && existingData.kmSegmentsArray) {
            km1 = existingData.kmSegmentsArray[0] || 0;
            km2 = existingData.kmSegmentsArray[1] || 0;
            km3 = existingData.kmSegmentsArray[2] || 0;
        }
        kmHTML += `
            <div>
                <label style="font-size: 13px; font-weight: bold; display: block; margin-bottom: 3px;">מרחק נסיעה בית - מופע ראשון:</label>
                <input type="number" id="${prefix}ichilov-km-1" class="form-control ichilov-dynamic-km" min="0" step="0.1" placeholder="0" required value="${km1}">
            </div>
            <div>
                <label style="font-size: 13px; font-weight: bold; display: block; margin-bottom: 3px;">מרחק נסיעה מופע ראשון - מופע שני:</label>
                <input type="number" id="${prefix}ichilov-km-2" class="form-control ichilov-dynamic-km" min="0" step="0.1" placeholder="0" required value="${km2}">
            </div>
            <div>
                <label style="font-size: 13px; font-weight: bold; display: block; margin-bottom: 3px;">מרחק נסיעה מופע שני - חזרה הביתה:</label>
                <input type="number" id="${prefix}ichilov-km-3" class="form-control ichilov-dynamic-km" min="0" step="0.1" placeholder="0" required value="${km3}">
            </div>
        `;
    } else if (count === 3) {
        let km1 = 0, km2 = 0, km3 = 0, km4 = 0;
        if (existingData && existingData.kmSegmentsArray) {
            km1 = existingData.kmSegmentsArray[0] || 0;
            km2 = existingData.kmSegmentsArray[1] || 0;
            km3 = existingData.kmSegmentsArray[2] || 0;
            km4 = existingData.kmSegmentsArray[3] || 0;
        }
        kmHTML += `
            <div>
                <label style="font-size: 13px; font-weight: bold; display: block; margin-bottom: 3px;">מרחק נסיעה בית - מופע ראשון:</label>
                <input type="number" id="${prefix}ichilov-km-1" class="form-control ichilov-dynamic-km" min="0" step="0.1" placeholder="0" required value="${km1}">
            </div>
            <div>
                <label style="font-size: 13px; font-weight: bold; display: block; margin-bottom: 3px;">מרחק נסיעה מופע ראשון - מופע שני:</label>
                <input type="number" id="${prefix}ichilov-km-2" class="form-control ichilov-dynamic-km" min="0" step="0.1" placeholder="0" required value="${km2}">
            </div>
            <div>
                <label style="font-size: 13px; font-weight: bold; display: block; margin-bottom: 3px;">מרחק נסיעה מופע שני - מופע שלישי:</label>
                <input type="number" id="${prefix}ichilov-km-3" class="form-control ichilov-dynamic-km" min="0" step="0.1" placeholder="0" required value="${km3}">
            </div>
            <div>
                <label style="font-size: 13px; font-weight: bold; display: block; margin-bottom: 3px;">מרחק נסיעה מופע שלישי - חזרה הביתה:</label>
                <input type="number" id="${prefix}ichilov-km-4" class="form-control ichilov-dynamic-km" min="0" step="0.1" placeholder="0" required value="${km4}">
            </div>
        `;
    }
    kmHTML += '</div>';
    kmContainer.innerHTML = kmHTML;

    // שדות זמני נסיעה דינמיים לפי מקטעים ותצוגה טורית (אנכית)
    let timesHTML = '<strong>זמני נסיעה לפי מקטעים (שעות ודקות):</strong><div style="display: flex; flex-direction: column; gap: 12px; margin-top: 8px;">';

    if (count === 1) {
        let hThere = 0, mThere = 0;
        let hBack = 0, mBack = 0;
        if (existingData) {
            if (existingData.timeSegmentsArray && existingData.timeSegmentsArray.length > 0) {
                let totalM = existingData.timeSegmentsArray[0] || 0;
                let halfM = Math.floor(totalM / 2);
                hThere = Math.floor(halfM / 60);
                mThere = halfM % 60;
                hBack = Math.floor((totalM - halfM) / 60);
                mBack = (totalM - halfM) % 60;
            } else {
                if (existingData.timeThere) {
                    let m = parseTimeToMinutes(existingData.timeThere);
                    hThere = Math.floor(m / 60);
                    mThere = m % 60;
                }
                if (existingData.timeBack) {
                    let m = parseTimeToMinutes(existingData.timeBack);
                    hBack = Math.floor(m / 60);
                    mBack = m % 60;
                }
            }
        }
        timesHTML += `
            <div>
                <label style="font-size: 13px; font-weight: bold; display: block; margin-bottom: 3px;">זמן נסיעה מהבית למופע ראשון (הלוך):</label>
                <div class="time-inputs-grid">
                    <div class="time-input-wrap">
                        <input type="number" id="${prefix}ichilov-hours-1" min="0" value="${hThere}" class="form-control ichilov-dynamic-time-h" required>
                        <span class="time-sub-label">שעות</span>
                    </div>
                    <div class="time-input-wrap">
                        <input type="number" id="${prefix}ichilov-mins-1" min="0" max="59" value="${mThere}" class="form-control ichilov-dynamic-time-m" required>
                        <span class="time-sub-label">דקות</span>
                    </div>
                </div>
            </div>
            <div>
                <label style="font-size: 13px; font-weight: bold; display: block; margin-bottom: 3px;">זמן נסיעה מהמופע הביתה (חזור):</label>
                <div class="time-inputs-grid">
                    <div class="time-input-wrap">
                        <input type="number" id="${prefix}ichilov-hours-2" min="0" value="${hBack}" class="form-control ichilov-dynamic-time-h" required>
                        <span class="time-sub-label">שעות</span>
                    </div>
                    <div class="time-input-wrap">
                        <input type="number" id="${prefix}ichilov-mins-2" min="0" max="59" value="${mBack}" class="form-control ichilov-dynamic-time-m" required>
                        <span class="time-sub-label">דקות</span>
                    </div>
                </div>
            </div>
        `;
    } else if (count === 2) {
        let t1h=0, t1m=0, t2h=0, t2m=0, t3h=0, t3m=0;
        if (existingData && existingData.timeSegmentsArray) {
            let m1 = existingData.timeSegmentsArray[0] || 0;
            let m2 = existingData.timeSegmentsArray[1] || 0;
            let m3 = existingData.timeSegmentsArray[2] || 0;
            t1h = Math.floor(m1/60); t1m = m1%60;
            t2h = Math.floor(m2/60); t2m = m2%60;
            t3h = Math.floor(m3/60); t3m = m3%60;
        }
        timesHTML += `
            <div>
                <label style="font-size: 13px; font-weight: bold; display: block; margin-bottom: 3px;">זמן נסיעה מהבית למופע ראשון:</label>
                <div class="time-inputs-grid">
                    <div class="time-input-wrap">
                        <input type="number" id="${prefix}ichilov-hours-1" min="0" value="${t1h}" class="form-control ichilov-dynamic-time-h" required>
                        <span class="time-sub-label">שעות</span>
                    </div>
                    <div class="time-input-wrap">
                        <input type="number" id="${prefix}ichilov-mins-1" min="0" max="59" value="${t1m}" class="form-control ichilov-dynamic-time-m" required>
                        <span class="time-sub-label">דקות</span>
                    </div>
                </div>
            </div>
            <div>
                <label style="font-size: 13px; font-weight: bold; display: block; margin-bottom: 3px;">זמן נסיעה בין מופע ראשון ושני:</label>
                <div class="time-inputs-grid">
                    <div class="time-input-wrap">
                        <input type="number" id="${prefix}ichilov-hours-2" min="0" value="${t2h}" class="form-control ichilov-dynamic-time-h" required>
                        <span class="time-sub-label">שעות</span>
                    </div>
                    <div class="time-input-wrap">
                        <input type="number" id="${prefix}ichilov-mins-2" min="0" max="59" value="${t2m}" class="form-control ichilov-dynamic-time-m" required>
                        <span class="time-sub-label">דקות</span>
                    </div>
                </div>
            </div>
            <div>
                <label style="font-size: 13px; font-weight: bold; display: block; margin-bottom: 3px;">זמן נסיעה מהמופע האחרון חזרה הביתה:</label>
                <div class="time-inputs-grid">
                    <div class="time-input-wrap">
                        <input type="number" id="${prefix}ichilov-hours-3" min="0" value="${t3h}" class="form-control ichilov-dynamic-time-h" required>
                        <span class="time-sub-label">שעות</span>
                    </div>
                    <div class="time-input-wrap">
                        <input type="number" id="${prefix}ichilov-mins-3" min="0" max="59" value="${t3m}" class="form-control ichilov-dynamic-time-m" required>
                        <span class="time-sub-label">דקות</span>
                    </div>
                </div>
            </div>
        `;
    } else if (count === 3) {
        let t1h=0, t1m=0, t2h=0, t2m=0, t3h=0, t3m=0, t4h=0, t4m=0;
        if (existingData && existingData.timeSegmentsArray) {
            let m1 = existingData.timeSegmentsArray[0] || 0;
            let m2 = existingData.timeSegmentsArray[1] || 0;
            let m3 = existingData.timeSegmentsArray[2] || 0;
            let m4 = existingData.timeSegmentsArray[3] || 0;
            t1h = Math.floor(m1/60); t1m = m1%60;
            t2h = Math.floor(m2/60); t2m = m2%60;
            t3h = Math.floor(m3/60); t3m = m3%60;
            t4h = Math.floor(m4/60); t4m = m4%60;
        }
        timesHTML += `
            <div>
                <label style="font-size: 13px; font-weight: bold; display: block; margin-bottom: 3px;">זמן נסיעה מהבית למופע ראשון:</label>
                <div class="time-inputs-grid">
                    <div class="time-input-wrap">
                        <input type="number" id="${prefix}ichilov-hours-1" min="0" value="${t1h}" class="form-control ichilov-dynamic-time-h" required>
                        <span class="time-sub-label">שעות</span>
                    </div>
                    <div class="time-input-wrap">
                        <input type="number" id="${prefix}ichilov-mins-1" min="0" max="59" value="${t1m}" class="form-control ichilov-dynamic-time-m" required>
                        <span class="time-sub-label">דקות</span>
                    </div>
                </div>
            </div>
            <div>
                <label style="font-size: 13px; font-weight: bold; display: block; margin-bottom: 3px;">זמן נסיעה בין מופע ראשון ושני:</label>
                <div class="time-inputs-grid">
                    <div class="time-input-wrap">
                        <input type="number" id="${prefix}ichilov-hours-2" min="0" value="${t2h}" class="form-control ichilov-dynamic-time-h" required>
                        <span class="time-sub-label">שעות</span>
                    </div>
                    <div class="time-input-wrap">
                        <input type="number" id="${prefix}ichilov-mins-2" min="0" max="59" value="${t2m}" class="form-control ichilov-dynamic-time-m" required>
                        <span class="time-sub-label">דקות</span>
                    </div>
                </div>
            </div>
            <div>
                <label style="font-size: 13px; font-weight: bold; display: block; margin-bottom: 3px;">זמן נסיעה בין מופע שני ושלישי:</label>
                <div class="time-inputs-grid">
                    <div class="time-input-wrap">
                        <input type="number" id="${prefix}ichilov-hours-3" min="0" value="${t3h}" class="form-control ichilov-dynamic-time-h" required>
                        <span class="time-sub-label">שעות</span>
                    </div>
                    <div class="time-input-wrap">
                        <input type="number" id="${prefix}ichilov-mins-3" min="0" max="59" value="${t3m}" class="form-control ichilov-dynamic-time-m" required>
                        <span class="time-sub-label">דקות</span>
                    </div>
                </div>
            </div>
            <div>
                <label style="font-size: 13px; font-weight: bold; display: block; margin-bottom: 3px;">זמן נסיעה מהמופע האחרון חזרה הביתה:</label>
                <div class="time-inputs-grid">
                    <div class="time-input-wrap">
                        <input type="number" id="${prefix}ichilov-hours-4" min="0" value="${t4h}" class="form-control ichilov-dynamic-time-h" required>
                        <span class="time-sub-label">שעות</span>
                    </div>
                    <div class="time-input-wrap">
                        <input type="number" id="${prefix}ichilov-mins-4" min="0" max="59" value="${t4m}" class="form-control ichilov-dynamic-time-m" required>
                        <span class="time-sub-label">דקות</span>
                    </div>
                </div>
            </div>
        `;
    }
    timesHTML += '</div>';
    timesContainer.innerHTML = timesHTML;

    attachIchilovListeners(prefix);
    updateIchilovPreviewUnified(prefix);
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

    const timeSegmentsArray = [];
    const timeFieldsCount = (count === 1) ? 2 : (count + 1);
    for (let i = 1; i <= timeFieldsCount; i++) {
        const hEl = document.getElementById(`${prefix}ichilov-hours-${i}`);
        const mEl = document.getElementById(`${prefix}ichilov-mins-${i}`);
        if (hEl || mEl) {
            const hrs = hEl ? parseInt(hEl.value, 10) || 0 : 0;
            const mins = mEl ? parseInt(mEl.value, 10) || 0 : 0;
            timeSegmentsArray.push((hrs * 60) + mins);
        }
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
    const calc = calculateIchilovAdvanced(data.showsTypesArray, data.kmSegmentsArray, data.timeSegmentsArray);

    const previewEl = document.getElementById(prefix ? 'modal-calc-breakdown' : 'calc-breakdown');
    if (previewEl) {
        previewEl.innerHTML = `שכר בסיס (${data.count} מופעים): ₪${calc.basePay} | נסיעות: ₪${calc.kmPay} (${calc.totalKm} ק"מ) | תוספת זמן: ₪${calc.timePay} (${calc.totalHoursStr}) | <strong>סה"כ: ₪${calc.totalPay}</strong>`;
    }
}

function attachIchilovListeners(prefix = '') {
    const countSelect = document.getElementById(`${prefix}ichilov-shows-count`);
    if (countSelect && !countSelect.dataset.listenerAttached) {
        countSelect.dataset.listenerAttached = 'true';
        countSelect.addEventListener('change', () => {
            renderIchilovDynamicFields(prefix);
            updateIchilovPreviewUnified(prefix);
        });
    }

    const container = document.getElementById(prefix ? 'ichilov-modal' : 'ichilov-form');
    if (container) {
        container.querySelectorAll('input, select').forEach(el => {
            if (!el.dataset.listenerAttached) {
                el.dataset.listenerAttached = 'true';
                el.addEventListener('input', () => updateIchilovPreviewUnified(prefix));
                el.addEventListener('change', () => updateIchilovPreviewUnified(prefix));
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
        if (!response.ok) throw new Error("שגיאה בטעינת data.json");
        currentData = await response.json();
        
        const monthPicker = document.getElementById('month-select');
        if (monthPicker) {
            if (!selectedMonth) {
                const now = new Date();
                const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
                selectedMonth = currentMonthKey;
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

    selectEl.innerHTML = '<option value="" disabled selected>בחר לקוח...</option>';

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

    if (previousValue && Array.from(selectEl.options).some(o => o.value === previousValue)) {
        selectEl.value = previousValue;
    }
}

function renderDashboard() {
    const events = currentData[selectedMonth] || [];
    
    let totalAll = 0;
    let totalPaid = 0;
    let totalUnpaid = 0;

    const mainList = document.getElementById('payments-list');
    const ichilovList = document.getElementById('ichilov-table') ? document.getElementById('ichilov-table').querySelector('tbody') : document.getElementById('ichilov-list');

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
                if (Array.isArray(item.ichilovData.locationsArray) && item.ichilovData.locationsArray.length > 0) {
                    displayLocation = item.ichilovData.locationsArray.join(' | ');
                } else if (item.ichilovData.location) {
                    displayLocation = item.ichilovData.location;
                }
            }

            if (mainList) {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${item.date || ''}</td>
                    <td>${item.client || ''}</td>
                    <td>${item.type || ''}</td>
                    <td>${displayLocation}</td>
                    <td>₪${itemAmount.toLocaleString()}</td>
                    <td>${statusSelectHTML}</td>
                    <td>
                        <button class="edit-btn" onclick="window.openEditModal(${item.id})" title="ערוך" style="background: none; border: none; cursor: pointer; font-size: 1.1rem; padding: 4px; margin-left: 5px;">✏️</button>
                        <button class="delete-btn" onclick="window.deleteEvent(${item.id})" title="מחק">🗑️</button>
                    </td>
                `;
                mainList.appendChild(tr);
            }

            if (item.isIchilov && ichilovList) {
                const iData = item.ichilovData || {};
                const calc = iData.calcDetails || calculateIchilovAdvanced(iData.showsTypesArray || ['רגיל'], iData.kmSegmentsArray || [0], iData.timeSegmentsArray || [0]);

                // בניית פירוט זמנים מתקדם ונקי ללחיצה
                let timesArr = iData.timeSegmentsArray || [];
                if (timesArr.length === 0 && (iData.timeThere || iData.timeBack)) {
                    timesArr = [parseTimeToMinutes(iData.timeThere) + parseTimeToMinutes(iData.timeBack)];
                }
                
                let timeDetailsLines = [];
                let showCount = iData.showsCount || (iData.showsTypesArray ? iData.showsTypesArray.length : 1);
                
                if (showCount === 1) {
                    let toM = timesArr[0] !== undefined ? timesArr[0] : (parseTimeToMinutes(iData.timeThere) + parseTimeToMinutes(iData.timeBack));
                    let h1 = Math.floor(toM/2), h2 = toM - Math.floor(toM/2);
                    timeDetailsLines.push(`מהבית למופע (הלוך): ${formatMinutesToHHMM(h1)}`);
                    timeDetailsLines.push(`מהמופע הביתה (חזור): ${formatMinutesToHHMM(h2)}`);
                } else {
                    for (let idx = 0; idx < timesArr.length; idx++) {
                        let mVal = timesArr[idx] || 0;
                        if (idx === 0) {
                            timeDetailsLines.push(`מהבית למופע ראשון: ${formatMinutesToHHMM(mVal)}`);
                        } else if (idx < showCount) {
                            timeDetailsLines.push(`בין מופע ${idx} למופע ${idx+1}: ${formatMinutesToHHMM(mVal)}`);
                        } else {
                            timeDetailsLines.push(`מהמופע האחרון הביתה: ${formatMinutesToHHMM(mVal)}`);
                        }
                    }
                }

                const timeCollapseId = `ichilov-time-collapse-${item.id}`;
                const timeCellHTML = `
                    <div style="cursor: pointer; color: var(--secondary-color); font-weight: bold;" onclick="window.toggleIchilovCollapse('${timeCollapseId}')">
                        ${calc.totalHoursStr || '0:00'} 🔽
                    </div>
                    <div id="${timeCollapseId}" style="display: none; margin-top: 6px; font-size: 0.85rem; background: #f8f9fa; padding: 6px; border-radius: 4px; border: 1px solid #ddd; text-align: right;">
                        ${timeDetailsLines.length > 0 ? timeDetailsLines.join('<br>') : 'אין פירוט זמנים'}
                    </div>
                `;

                // בניית פירוט ק"מ מתקדם ונקי ללחיצה
                let kmArr = iData.kmSegmentsArray || [];
                let kmDetailsLines = [];
                if (showCount === 1) {
                    let totalKmVal = kmArr[0] !== undefined ? kmArr[0] : (iData.kmOneWay ? iData.kmOneWay * 2 : 0);
                    let oneWayVal = totalKmVal / 2;
                    kmDetailsLines.push(`מהבית למופע ובחזרה (הלוך-חזור): ${totalKmVal} ק"מ (${oneWayVal} לכיוון)`);
                } else {
                    for (let idx = 0; idx < kmArr.length; idx++) {
                        let kmVal = kmArr[idx] || 0;
                        if (idx === 0) {
                            kmDetailsLines.push(`מהבית למופע ראשון: ${kmVal} ק"מ`);
                        } else if (idx < showCount) {
                            kmDetailsLines.push(`בין מופע ${idx} למופע ${idx+1}: ${kmVal} ק"מ`);
                        } else {
                            kmDetailsLines.push(`מהמופע האחרון הביתה: ${kmVal} ק"מ`);
                        }
                    }
                }

                const kmCollapseId = `ichilov-km-collapse-${item.id}`;
                const kmCellHTML = `
                    <div style="cursor: pointer; color: var(--secondary-color); font-weight: bold;" onclick="window.toggleIchilovCollapse('${kmCollapseId}')">
                        ${calc.totalKm || 0} ק"מ 🔽
                    </div>
                    <div id="${kmCollapseId}" style="display: none; margin-top: 6px; font-size: 0.85rem; background: #f8f9fa; padding: 6px; border-radius: 4px; border: 1px solid #ddd; text-align: right;">
                        ${kmDetailsLines.length > 0 ? kmDetailsLines.join('<br>') : 'אין פירוט מרחקים'}
                    </div>
                `;

                const trI = document.createElement('tr');
                trI.innerHTML = `
                    <td>${item.date || ''}</td>
                    <td>${displayLocation}</td>
                    <td>${iData.showsTypesSummary || item.type || ''}</td>
                    <td>${kmCellHTML}</td>
                    <td>${timeCellHTML}</td>
                    <td>₪${calc.basePay || 0}</td>
                    <td>₪${calc.kmPay || 0}</td>
                    <td>₪${calc.timePay || 0}</td>
                    <td><strong>₪${itemAmount.toLocaleString()}</strong></td>
                    <td>${statusSelectHTML}</td>
                    <td>
                        <button class="edit-btn" onclick="window.openEditModal(${item.id})" title="ערוך" style="background: none; border: none; cursor: pointer; font-size: 1.1rem; padding: 4px; margin-left: 5px;">✏️</button>
                        <button class="delete-btn" onclick="window.deleteEvent(${item.id})" title="מחק">🗑️</button>
                    </td>
                `;
                ichilovList.appendChild(trI);
            }

        } catch (itemErr) {
            console.error("שגיאה ברינדור שורת אירוע:", item, itemErr);
        }
    });

    const elTotal = document.getElementById('total-amount');
    const elPaid = document.getElementById('paid-amount');
    const elUnpaid = document.getElementById('unpaid-amount');

    if (elTotal) elTotal.textContent = `₪${totalAll.toLocaleString()}`;
    if (elPaid) elPaid.textContent = `₪${totalPaid.toLocaleString()}`;
    if (elUnpaid) elUnpaid.textContent = `₪${totalUnpaid.toLocaleString()}`;

    updateClientsDropdown();
    renderSaveButton();
    renderGlobalUnpaidTable();
}

window.toggleIchilovCollapse = function(collapseId) {
    const el = document.getElementById(collapseId);
    if (el) {
        el.style.display = (el.style.display === 'none' || !el.style.display) ? 'block' : 'none';
    }
};

// ==========================================
// 5. ניהול טבלת חובות פתוחים גלובלית ומעבר חודש מהיר
// ==========================================
function renderGlobalUnpaidTable() {
    const unpaidListEl = document.getElementById('global-unpaid-list');
    const totalUnpaidSummaryEl = document.getElementById('total-unpaid-summary');
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
                    displayType = item.ichilovData.showsTypesSummary || item.type;
                    if (Array.isArray(item.ichilovData.locationsArray) && item.ichilovData.locationsArray.length > 0) {
                        displayLocation = item.ichilovData.locationsArray.join(' | ');
                    } else {
                        displayLocation = item.ichilovData.location || item.location;
                    }
                }

                tr.innerHTML = `
                    <td><strong>${monthKey}</strong></td>
                    <td>${item.date || ''}</td>
                    <td>${item.client || ''}</td>
                    <td>${displayType}</td>
                    <td>${displayLocation}</td>
                    <td><strong>₪${itemAmount.toLocaleString()}</strong></td>
                    <td>
                        <button class="status-btn unpaid" onclick="window.jumpToMonthAndEvent('${monthKey}')" style="cursor: pointer;">
                            🔍 צפה בחודש
                        </button>
                    </td>
                `;
                unpaidListEl.appendChild(tr);
            }
        });
    });

    if (!hasItems) {
        unpaidListEl.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--success-color); font-weight: bold; padding: 20px;">אין תשלומים ממתינים לגבייה! הכל שולם 🌟</td></tr>`;
    }

    if (totalUnpaidSummaryEl) {
        totalUnpaidSummaryEl.textContent = `סך הכל ממתין לגבייה בכל החודשים: ₪${grandTotalUnpaid.toLocaleString()}`;
    }
}

window.jumpToMonthAndEvent = function(monthKey) {
    selectedMonth = monthKey;
    
    const monthPicker = document.getElementById('month-select');
    if (monthPicker) {
        monthPicker.value = monthKey;
    }

    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

    const regularTabBtn = document.querySelector('[data-tab="regular-form"]');
    const regularTabContent = document.getElementById('regular-form');
    if (regularTabBtn) regularTabBtn.classList.add('active');
    if (regularTabContent) regularTabContent.classList.add('active');

    renderDashboard();
    showStatusMessage(`עברת לתצוגת חודש ${monthKey}`);
};

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
                    style="background-color: #28a745; color: white; padding: 12px 28px; border: none; border-radius: 8px; font-size: 16px; font-weight: bold; cursor: pointer; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                💾 שמור שינויים
            </button>
        `;
    } else {
        saveBtnContainer.innerHTML = '';
    }
}

// ==========================================
// 6. שינוי סטטוס תשלום + שמירה לגלובל/GitHub
// ==========================================
window.handleStatusChange = function(id, value) {
    const monthEvents = currentData[selectedMonth] || [];
    const targetEvent = monthEvents.find(item => item.id === id);

    if (!targetEvent) return;

    const newStatus = (value === 'true');

    if (targetEvent.isIchilov || targetEvent.client === 'החברה מאיכילוב') {
        Object.keys(currentData).forEach(mKey => {
            if (Array.isArray(currentData[mKey])) {
                currentData[mKey].forEach(item => {
                    if (item.isIchilov || item.client === 'החברה מאיכילוב') {
                        item.isPaid = newStatus;
                    }
                });
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
        localStorage.setItem('local_data_backup', JSON.stringify(currentData));
        hasUnsavedChanges = false;
        renderDashboard();
        showStatusMessage('השינויים נשמרו מקומית בדפדפן (חסרים פרטי חיבור בהגדרות GitHub)', true);
        return;
    }

    showStatusMessage('שומר שינויים ב-GitHub...');
    try {
        const url = `https://api.github.com/repos/${config.username}/${config.repo}/contents/data.json`;
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
            const errData = await getRes.json().catch(() => ({}));
            throw new Error(errData.message || `שגיאת גישה (${getRes.status})`);
        }

        const jsonString = JSON.stringify(currentData, null, 2);
        const utf8Bytes = new TextEncoder().encode(jsonString);
        let binaryString = "";
        for (let i = 0; i < utf8Bytes.length; i++) {
            binaryString += String.fromCharCode(utf8Bytes[i]);
        }
        const contentEncoded = btoa(binaryString);
        
        const payload = {
            message: 'עדכון נתונים מאפליקציית התשלומים',
            content: contentEncoded
        };
        if (sha) payload.sha = sha;

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
            showStatusMessage('השינויים נשמרו בהצלחה ב-GitHub!');
        } else {
            const putErr = await putRes.json().catch(() => ({}));
            throw new Error(putErr.message || 'שגיאה בשמירה ל-GitHub');
        }
    } catch (err) {
        console.error(err);
        showStatusMessage(`שגיאה בשמירה ל-GitHub: ${err.message}`, true);
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
// 7. ניהול חלון הגדרות GitHub (Modal)
// ==========================================
function setupModal() {
    const modal = document.getElementById('settings-modal');
    const btn = document.getElementById('settings-btn');
    const closeBtn = document.querySelector('.close-btn');
    const form = document.getElementById('settings-form');

    const getInputElement = (...ids) => {
        for (let id of ids) {
            const el = document.getElementById(id);
            if (el) return el;
        }
        return null;
    };

    if (btn && modal) {
        btn.onclick = () => {
            const config = getGithubConfig();
            
            const userInput = getInputElement('github-username', 'username', 'gh-username');
            const repoInput = getInputElement('github-repo', 'repo', 'gh-repo');
            const tokenInput = getInputElement('github-token', 'token', 'gh-token', 'pat');

            if (userInput) userInput.value = config.username;
            if (repoInput) repoInput.value = config.repo;
            if (tokenInput) tokenInput.value = config.token;

            modal.style.display = 'block';
        };
    }

    if (closeBtn && modal) {
        closeBtn.onclick = () => { modal.style.display = 'none'; };
    }

    window.onclick = (event) => {
        if (event.target === modal) modal.style.display = 'none';
    };

    if (form) {
        form.onsubmit = (e) => {
            e.preventDefault();

            const userInput = getInputElement('github-username', 'username', 'gh-username');
            const repoInput = getInputElement('github-repo', 'repo', 'gh-repo');
            const tokenInput = getInputElement('github-token', 'token', 'gh-token', 'pat');

            const username = userInput ? userInput.value.trim() : '';
            const repo = repoInput ? repoInput.value.trim() : '';
            const token = tokenInput ? tokenInput.value.trim() : '';

            localStorage.setItem('gh_username', username);
            localStorage.setItem('gh_repo', repo);
            localStorage.setItem('gh_token', token);

            showStatusMessage('הגדרות GitHub נשמרו בהצלחה!');
            if (modal) modal.style.display = 'none';
        };
    }
}

// ==========================================
// 8. ניהול לשוניות (Tabs)
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
// 9. ניהול מודאל איכילוב מהטופס הראשי ועריכת רשומות
// ==========================================
window.openEditModal = function(id) {
    const monthEvents = currentData[selectedMonth] || [];
    const item = monthEvents.find(e => e.id === id);
    if (!item) return;

    if (item.isIchilov) {
        let modal = document.getElementById('edit-ichilov-modal');
        if (!modal) {
            modal = document.createElement('div
