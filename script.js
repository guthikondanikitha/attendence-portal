let branch = "";
let strength = 60;
const today = new Date().toLocaleDateString('en-GB').replace(/\//g, "-");
let viewingDate = today;
let qrScannerInstance = null;
let activeMode = "manual";

window.onload = function() {
    document.getElementById('liveDate').textContent = today;
    evaluateThemeOnLoad();
    restoreSavedSession();

    // Wire single input fields manual submit
    document.getElementById('rollInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') markManualAttendance();
    });
};

function restoreSavedSession() {
    const savedBranch = localStorage.getItem('gioe_local_branch');
    const savedStrength = localStorage.getItem('gioe_local_strength');
    const savedSubject = localStorage.getItem('gioe_local_subject');
    
    if(savedSubject) document.getElementById('subjectInput').value = savedSubject;
    
    if (savedBranch && savedStrength) {
        document.getElementById('classStrength').value = savedStrength;
        initApp(savedBranch);
    } else {
        document.getElementById('branchOverlay').style.display = 'flex';
    }
}

function initApp(chosenBranch) {
    branch = chosenBranch;
    strength = parseInt(document.getElementById('classStrength').value) || 60;
    
    localStorage.setItem('gioe_local_branch', branch);
    localStorage.setItem('gioe_local_strength', strength);

    const overlay = document.getElementById('branchOverlay');
    overlay.style.transform = "translateY(-100%)";
    setTimeout(() => { overlay.style.display = 'none'; }, 400);

    document.getElementById('branchTitle').textContent = `${branch} Branch`;
    document.getElementById('prefixLabel').textContent = `${branch}-`;
    document.getElementById('viewingDateLabel').textContent = viewingDate;
    
    updateUI();
    buildLocalHistoryList();
}

function switchBranch() {
    localStorage.removeItem('gioe_local_branch');
    location.reload();
}

function persistSubject() {
    localStorage.setItem('gioe_local_subject', document.getElementById('subjectInput').value);
}

function getStorageKey() {
    return `gioe_data_${branch}_${viewingDate}`;
}

function getRecords() {
    return JSON.parse(localStorage.getItem(getStorageKey())) || [];
}

function saveRecords(data) {
    localStorage.setItem(getStorageKey(), JSON.stringify(data));
}

// ==========================================
// CONTROL INTERFACES & TAB SWAPPING MODES
// ==========================================
function switchInputMode(targetMode) {
    activeMode = targetMode;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.mode-container').forEach(m => m.style.display = 'none');
    
    if(qrScannerInstance) {
        qrScannerInstance.stop().catch(()=>{});
        qrScannerInstance = null;
    }

    if (targetMode === 'manual') {
        document.getElementById('tabManual').classList.add('active');
        document.getElementById('modeManualInput').style.display = 'block';
    } else if (targetMode === 'grid') {
        document.getElementById('tabGrid').classList.add('active');
        document.getElementById('modeGridInput').style.display = 'block';
        renderMassGrid();
    } else if (targetMode === 'scanner') {
        document.getElementById('tabScanner').classList.add('active');
        document.getElementById('modeScannerInput').style.display = 'block';
        startCameraScanner();
    }
}

function processAttendanceRegistration(pinInput) {
    const pin = String(pinInput).padStart(3, '0');
    if (parseInt(pin) > strength || parseInt(pin) === 0 || isNaN(parseInt(pin))) {
        return { ok: false, msg: "Out of bounds roll number range." };
    }

    let currentLogs = getRecords();
    const activePeriod = document.getElementById('periodDropdown').value;
    const currentSubject = document.getElementById('subjectInput').value || "General Class";

    if (currentLogs.some(r => r.pin === pin && r.period === activePeriod)) {
        return { ok: false, msg: `PIN ${pin} already checked for ${activePeriod}` };
    }

    const stamp = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    currentLogs.push({ pin, period: activePeriod, subject: currentSubject, time: stamp });
    saveRecords(currentLogs);
    
    return { ok: true, msg: `Registered Student PIN ${pin}` };
}

function markManualAttendance() {
    const input = document.getElementById('rollInput');
    const response = processAttendanceRegistration(input.value.trim());
    showToast(response.msg, !response.ok);
    if(response.ok) {
        input.value = "";
        updateUI();
    }
}

// Mode 2: Grid Checkbox Generator
function renderMassGrid() {
    const container = document.getElementById('massCheckboxGrid');
    container.innerHTML = "";
    const activePeriod = document.getElementById('periodDropdown').value;
    const activeCheckedSet = new Set(getRecords().filter(r => r.period === activePeriod).map(r => parseInt(r.pin)));

    for (let i = 1; i <= strength; i++) {
        const pinString = String(i).padStart(3, '0');
        const checkedState = activeCheckedSet.has(i) ? "checked" : "";
        
        const block = document.createElement('div');
        block.className = "check-tile";
        block.innerHTML = `
            <input type="checkbox" id="grid_chk_${i}" class="mass-grid-checkbox" value="${pinString}" ${checkedState}>
            <label for="grid_chk_${i}" class="tile-label">${pinString}</label>
        `;
        container.appendChild(block);
    }
}

function submitMassGridAttendance() {
    const activePeriod = document.getElementById('periodDropdown').value;
    const currentSubject = document.getElementById('subjectInput').value || "General Class";
    let logs = getRecords().filter(r => r.period !== activePeriod);

    const checkBoxesSelected = document.querySelectorAll('.mass-grid-checkbox:checked');
    const stamp = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

    checkBoxesSelected.forEach(box => {
        logs.push({ pin: box.value, period: activePeriod, subject: currentSubject, time: stamp });
    });

    saveRecords(logs);
    updateUI();
    showToast("Grid parameters mapped successfully on browser memory cache.");
}

// Mode 3: Local QR Code Camera Scanning Initialization
function startCameraScanner() {
    qrScannerInstance = new Html5Qrcode("qrReaderView");
    qrScannerInstance.start(
        { facingMode: "environment" },
        { fps: 12, qrbox: { width: 220, height: 220 } },
        (decodedText) => {
            const res = processAttendanceRegistration(decodedText.trim());
            if (res.ok) {
                showToast(res.msg, false);
                if(navigator.vibrate) navigator.vibrate(80);
                updateUI();
            }
        },
        () => {} // Drop verbose runtime loop stream exception traces
    ).catch(() => {
        showToast("Webcam initialization failed. Check browser privacy settings.", true);
    });
}

// ==========================================
// CALCULATE DYNAMIC DATA & SMART INSIGHTS
// ==========================================
function updateUI() {
    const allRecords = getRecords();
    const activePeriod = document.getElementById('periodDropdown').value;
    const filteredDataset = allRecords.filter(r => r.period === activePeriod);
    
    const tableBody = document.getElementById('attendanceTable');
    tableBody.innerHTML = "";

    filteredDataset.forEach((item) => {
        const trueGlobalIndex = allRecords.findIndex(r => r.pin === item.pin && r.period === item.period);
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${item.pin}</strong></td>
            <td>${item.subject}</td>
            <td>${item.period}</td>
            <td>${item.time}</td>
            <td><i class="fas fa-trash row-del" onclick="removeSingleRow(${trueGlobalIndex})"></i></td>
        `;
        tableBody.appendChild(tr);
    });

    runAnalyticsCalculations(filteredDataset);
    if(activeMode === "grid") renderMassGrid();
}

function removeSingleRow(index) {
    let logs = getRecords();
    logs.splice(index, 1);
    saveRecords(logs);
    updateUI();
    showToast("Record clear.");
}

function runAnalyticsCalculations(periodData) {
    const totalPresent = periodData.length;
    const rate = strength > 0 ? Math.round((totalPresent / strength) * 100) : 0;

    document.getElementById('metricPercentage').textContent = `${rate}%`;
    document.getElementById('metricRatio').textContent = `${totalPresent} / ${strength}`;
    document.getElementById('analyticsProgressBar').style.width = `${rate}%`;

    // Calculate Missing Absentees Array
    const checkedPins = new Set(periodData.map(r => parseInt(r.pin)));
    let absentArray = [];
    for(let i = 1; i <= strength; i++) {
        if(!checkedPins.has(i)) absentArray.push(String(i).padStart(3, '0'));
    }

    const absenteeContainer = document.getElementById('absenteeList');
    if(totalPresent === 0) {
        absenteeContainer.innerHTML = "<em>No student inputs submitted yet for this period timeframe.</em>";
    } else {
        absenteeContainer.innerHTML = absentArray.length > 0
            ? `<strong>Missing Absentees (${absentArray.length}):</strong> ` + absentArray.join(', ')
            : "<strong>Perfect Attendance Met!</strong>";
    }

    runRiskEvaluationAnalytics();
}

// Flags students who have missed multiple classes across local memory
function runRiskEvaluationAnalytics() {
    let trackingTallyMap = {};
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith(`gioe_data_${branch}_`)) {
            const records = JSON.parse(localStorage.getItem(key)) || [];
            records.forEach(r => {
                trackingTallyMap[r.pin] = (trackingTallyMap[r.pin] || 0) + 1;
            });
        }
    }

    let flaggedList = [];
    for(let pin in trackingTallyMap) {
        if(trackingTallyMap[pin] >= 3) flaggedList.push(`#${pin}`);
    }

    const alertPanel = document.getElementById('highRiskAlert');
    if(flaggedList.length > 0) {
        alertPanel.style.display = "block";
        alertPanel.innerHTML = `<i class="fas fa-exclamation-triangle"></i> <strong>Frequent Absentee Alert:</strong> Students [ ${flaggedList.join(', ')} ] have missed multiple recorded sessions on this device.`;
    } else {
        alertPanel.style.display = "none";
    }
}

// ==========================================
// HISTORY DRAWER & DATA EXPORTS
// ==========================================
function buildLocalHistoryList() {
    const listContainer = document.getElementById('historyList');
    listContainer.innerHTML = "";
    let extractedDates = [];

    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith(`gioe_data_${branch}_`)) {
            extractedDates.push(key.replace(`gioe_data_${branch}_`, ""));
        }
    }

    extractedDates = [...new Set(extractedDates)].sort().reverse();

    if(extractedDates.length === 0) {
        listContainer.innerHTML = "<p style='padding:15px; color:#999; font-size:0.85rem;'>No logs stored locally.</p>";
        return;
    }

    extractedDates.forEach(date => {
        const div = document.createElement('div');
        div.className = "history-item";
        div.innerHTML = `
            <span style="cursor:pointer; font-weight:600;" onclick="loadHistoricLogsDate('${date}')">${date}</span>
            <i class="fas fa-trash-alt row-del" onclick="purgeEntireDayLog('${date}')"></i>
        `;
        listContainer.appendChild(div);
    });
}

function loadHistoricLogsDate(date) {
    viewingDate = date;
    document.getElementById('viewingDateLabel').textContent = date;
    updateUI();
    toggleSidebar();
    showToast(`Displaying device logs retrieved from ${date}`);
}

function purgeEntireDayLog(date) {
    if(confirm(`Are you sure you want to completely erase tracking records on this device for ${date}?`)) {
        localStorage.removeItem(`gioe_data_${branch}_${date}`);
        if(viewingDate === date) viewingDate = today;
        document.getElementById('viewingDateLabel').textContent = viewingDate;
        updateUI();
        buildLocalHistoryList();
    }
}

function downloadExcel() {
    const logs = getRecords();
    if (logs.length === 0) return showToast("No logging entry parameters generated to map document columns.", true);
    
    let csv = "PIN,SUBJECT,PERIOD,TIMESTAMP\n" + logs.map(l => `"${l.pin}","${l.subject}","${l.period}","${l.time}"`).join("\n");
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const dynamicLinkElement = document.createElement('a');
    dynamicLinkElement.href = URL.createObjectURL(blob);
    dynamicLinkElement.download = `Attendance_Report_${branch}_${viewingDate}.csv`;
    dynamicLinkElement.click();
}

// ==========================================
// CORE INTERFACE UTILITIES (UX ENHANCEMENTS)
// ==========================================
function toggleSidebar() { document.getElementById('sidebar').classList.toggle('active'); }
function filterHistory() {
    const query = document.getElementById('historySearch').value.toLowerCase();
    document.querySelectorAll('.history-item').forEach(item => {
        item.style.display = item.textContent.toLowerCase().includes(query) ? "flex" : "none";
    });
}

function toggleDarkMode() {
    const activeTheme = document.documentElement.getAttribute('data-theme');
    const nextTheme = activeTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', nextTheme);
    localStorage.setItem('gioe_pure_theme', nextTheme);
    document.getElementById('themeBtn').innerHTML = nextTheme === 'dark' ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
}

function evaluateThemeOnLoad() {
    const activeTheme = localStorage.getItem('gioe_pure_theme') || 'light';
    document.documentElement.setAttribute('data-theme', activeTheme);
    document.getElementById('themeBtn').innerHTML = activeTheme === 'dark' ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
}

function showToast(text, isError = false) {
    const container = document.getElementById('toast');
    container.textContent = text;
    container.style.background = isError ? "var(--error)" : "var(--success)";
    container.style.display = "block";
    setTimeout(() => { container.style.display = "none"; }, 3000);
}
