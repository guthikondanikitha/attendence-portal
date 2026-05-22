
let branch = "";
let strength = 100;
const today = new Date().toLocaleDateString('en-GB').replace(/\//g, "-");
let viewingDate = today;

window.onload = function() {
    document.getElementById('liveDate').textContent = today;
    
    // Check if configuration parameters exist from past execution states
    const savedBranch = localStorage.getItem('lastBranch');
    const savedStrength = localStorage.getItem('lastStrength');
    
    if (savedBranch && savedStrength) {
        document.getElementById('classStrength').value = savedStrength;
        initApp(savedBranch);
    }
    
    // Wire up Enter Key Press listeners to prompt quick logging manually
    document.getElementById('rollInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            markAttendance();
        }
    });
};

function getPeriod() {
    const hours = new Date().getHours();
    // Simplified period logic block mapping current system operating hour limits
    if (hours >= 9 && hours < 10) return { ok: true, n: "Period 1" };
    if (hours >= 10 && hours < 11) return { ok: true, n: "Period 2" };
    if (hours >= 11 && hours < 12) return { ok: true, n: "Period 3" };
    if (hours >= 13 && hours < 14) return { ok: true, n: "Period 4" };
    if (hours >= 14 && hours < 16) return { ok: true, n: "Period 5" };
    return { ok: true, n: "General Session" }; // Always default fallback rather than blocking interaction
}

function initApp(selectedBranch) {
    branch = selectedBranch;
    strength = parseInt(document.getElementById('classStrength').value) || 100;
    
    localStorage.setItem('lastBranch', branch);
    localStorage.setItem('lastStrength', strength);

    const overlay = document.getElementById('branchOverlay');
    overlay.style.transform = "translateY(-100%)";
    overlay.style.opacity = "0";
    setTimeout(() => { overlay.style.display = 'none'; }, 600);

    document.getElementById('branchTitle').textContent = branch + " Branch";
    document.getElementById('prefixLabel').textContent = `${branch}-`;
    document.getElementById('viewingDateLabel').textContent = viewingDate;
    
    updateUI();
    buildHistory();
}

function resetApp() {
    localStorage.removeItem('lastBranch');
    location.reload();
}

function markAttendance() {
    const inputField = document.getElementById('rollInput');
    const pinVal = inputField.value.trim().padStart(3, '0');
    
    if (pinVal === "000" || inputField.value.trim() === "") {
        return showToast("Enter a valid PIN", true);
    }

    const sessionInfo = getPeriod();
    if (!sessionInfo.ok) return showToast("Locked: " + sessionInfo.n, true);
    if (!/^[0-9]{3}$/.test(pinVal)) return showToast("Enter 3 digits", true);
    
    if (parseInt(pinVal) > strength) {
        return showToast(`Invalid PIN (Limit: ${strength})`, true);
    }

    const key = `gioe_${branch}_${today}`;
    let data = JSON.parse(localStorage.getItem(key)) || [];

    // Verify duplication conditions across current working array space
    if (data.some(entry => entry.pin === pinVal && entry.period === sessionInfo.n)) {
        return showToast("PIN already marked for this period!", true);
    }

    const timestamp = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    
    data.push({
        pin: pinVal,
        period: sessionInfo.n,
        time: timestamp
    });

    localStorage.setItem(key, JSON.stringify(data));
    inputField.value = "";
    showToast(`Marked PIN ${pinVal}`);
    updateUI();
}

function updateUI() {
    const key = `gioe_${branch}_${viewingDate}`;
    const data = JSON.parse(localStorage.getItem(key)) || [];
    const tableBody = document.getElementById('attendanceTable');
    
    tableBody.innerHTML = "";
    
    data.forEach((item, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong>${item.pin}</strong></td>
            <td>${item.period}</td>
            <td>${item.time}</td>
            <td><i class="fas fa-trash row-del" onclick="deleteRecord(${index})"></i></td>
        `;
        tableBody.appendChild(row);
    });

    calculateAbsentees(data);
    document.getElementById('statusBanner').textContent = `Total Submissions Today: ${data.length}`;
}

function deleteRecord(index) {
    const key = `gioe_${branch}_${viewingDate}`;
    let data = JSON.parse(localStorage.getItem(key)) || [];
    data.splice(index, 1);
    localStorage.setItem(key, JSON.stringify(data));
    updateUI();
    showToast("Record dropped successfully");
}

function calculateAbsentees(currentLogs) {
    let checkedPins = new Set(currentLogs.map(item => parseInt(item.pin)));
    let absentees = [];

    for (let i = 1; i <= strength; i++) {
        if (!checkedPins.has(i)) {
            absentees.push(String(i).padStart(3, '0'));
        }
    }

    const outputElement = document.getElementById('absenteeList');
    if (currentLogs.length === 0) {
        outputElement.innerHTML = "Mark attendance to see missing students...";
    } else {
        outputElement.innerHTML = absentees.length > 0 
            ? `<strong>Missing (${absentees.length}):</strong> ` + absentees.join(', ') 
            : "Everyone Present!";
    }
}

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('active');
}

function buildHistory() {
    const container = document.getElementById('historyList');
    container.innerHTML = "";
    let systemDates = [];

    for (let i = 0; i < localStorage.length; i++) {
        const targetKey = localStorage.key(i);
        if (targetKey.startsWith(`gioe_${branch}_`)) {
            const extractDate = targetKey.replace(`gioe_${branch}_`, "");
            systemDates.push(extractDate);
        }
    }

    // Ensure unique values sorted symmetrically
    systemDates = [...new Set(systemDates)].sort().reverse();

    if (systemDates.length === 0) {
        container.innerHTML = `<p style='color:#777; font-size:0.9rem; text-align:center;'>No historic logs located</p>`;
        return;
    }

    systemDates.forEach(dateStr => {
        const historicRow = document.createElement('div');
        historicRow.className = 'history-item';
        historicRow.innerHTML = `
            <span style="cursor:pointer; font-weight:600;" onclick="viewHistoricDate('${dateStr}')">${dateStr}</span>
            <i class="fas fa-share-alt share-btn" onclick="shareData('${dateStr}')"></i>
        `;
        container.appendChild(historicRow);
    });
}

function viewHistoricDate(selectedDate) {
    viewingDate = selectedDate;
    document.getElementById('viewingDateLabel').textContent = selectedDate;
    updateUI();
    toggleSidebar();
    showToast(`Viewing data from ${selectedDate}`);
}

function filterHistory() {
    const val = document.getElementById('historySearch').value.toLowerCase();
    const records = document.getElementsByClassName('history-item');
    Array.from(records).forEach(item => {
        const matches = item.textContent.toLowerCase().includes(val);
        item.style.display = matches ? "flex" : "none";
    });
}

function downloadExcel() {
    const logs = JSON.parse(localStorage.getItem(`gioe_${branch}_${viewingDate}`)) || [];
    if (logs.length === 0) return showToast("No data available to export", true);
    
    let csv = "PIN,PERIOD,TIME\n" + logs.map(l => `${l.pin},${l.period},${l.time}`).join("\n");
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `Attendance_${branch}_${viewingDate}.csv`;
    a.click();
}

async function shareData(date) {
    const logs = JSON.parse(localStorage.getItem(`gioe_${branch}_${date}`)) || [];
    if(logs.length === 0) return showToast("No records found", true);
    
    let text = `📊 *ATTENDANCE: ${branch}*\n📅 *Date:* ${date}\n\n`;
    const distinctPeriods = [...new Set(logs.map(l => l.period))];
    
    distinctPeriods.forEach(p => {
        text += `*${p}:*\n` + logs.filter(l => l.period === p).map(l => l.pin).join(", ") + "\n\n";
    });

    if (navigator.share) { 
        try { 
            await navigator.share({ text }); 
        } catch(e) { 
            copyFallback(text); 
        } 
    } else { 
        copyFallback(text); 
    }
}

function copyFallback(t) {
    const el = document.createElement('textarea'); 
    el.value = t; 
    document.body.appendChild(el);
    el.select(); 
    document.execCommand('copy'); 
    document.body.removeChild(el);
    showToast("📋 Copied text dump directly to Clipboard!");
}

function clearDate() { 
    if(confirm(`Are you certain you wish to purge records for ${viewingDate}?`)) { 
        localStorage.removeItem(`gioe_${branch}_${viewingDate}`); 
        updateUI(); 
        buildHistory();
    } 
}

function showToast(msg, isError = false) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.style.background = isError ? "var(--error)" : "var(--success)";
    toast.style.display = "block";
    setTimeout(() => { toast.style.display = "none"; }, 2500);
}
