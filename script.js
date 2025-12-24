let branch = "";
let strength = 60;
const today = new Date().toLocaleDateString('en-GB').replace(/\//g, "-");
let viewingDate = today;

function getPeriod() {
    const now = new Date();
    const time = now.getHours() * 100 + now.getMinutes();
    if (now.getDay() === 0) return { n: "Sunday", ok: false };
    const slots = [
        {s:930, e:1020, n:"1st Period"}, {s:1020, e:1110, n:"2nd Period"},
        {s:1110, e:1200, n:"3rd Period"}, {s:1200, e:1250, n:"4th Period"},
        {s:1250, e:1330, n:"Lunch", ok:false}, {s:1330, e:1420, n:"5th Period"},
        {s:1420, e:1510, n:"6th Period"}, {s:1510, e:1600, n:"7th Period"},
        {s:1600, e:1700, n:"Extra"}
    ];
    const match = slots.find(s => time >= s.s && time < s.e);
    return match ? { n: match.n, ok: match.ok !== false } : { n: "College Closed", ok: false };
}

function initApp(b) {
    branch = b;
    strength = parseInt(document.getElementById('classStrength').value) || 60;
    document.getElementById('branchOverlay').style.display = 'none';
    document.getElementById('branchTitle').textContent = b + " Branch";
    document.getElementById('prefixLabel').textContent = `24054-${b}-`;
    document.getElementById('liveDate').textContent = new Date().toDateString();
    updateUI();
    setInterval(updateUI, 30000);
}

function updateUI() {
    const s = getPeriod();
    const b = document.getElementById('statusBanner');
    b.textContent = "Current Status: " + s.n;
    b.style.color = s.ok ? "#28a745" : "#dc3545";
    renderTable();
    renderHistory();
    calculateAbsentees();
}

function markAttendance() {
    const input = document.getElementById('rollInput');
    const pinVal = input.value.trim();
    const s = getPeriod();
    if (!s.ok) return showToast("Attendance Locked: " + s.n, true);
    if (!/^[0-9]{3}$/.test(pinVal)) return showToast("Enter 3 digits (e.g. 021)", true);

    const key = `gioe_${branch}_${today}`;
    let data = JSON.parse(localStorage.getItem(key)) || [];
    const fullPin = `24054-${branch}-${pinVal}`;

    if (data.some(d => d.pin === fullPin && d.period === s.n)) {
        showToast("Already marked for " + s.n, true);
    } else {
        data.unshift({ id: Date.now(), pin: fullPin, period: s.n, time: new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) });
        localStorage.setItem(key, JSON.stringify(data));
        showToast("Marked: " + pinVal);
        viewingDate = today;
    }
    input.value = "";
    updateUI();
}

function deleteRow(id) {
    const key = `gioe_${branch}_${viewingDate}`;
    let data = JSON.parse(localStorage.getItem(key)) || [];
    data = data.filter(item => item.id !== id);
    localStorage.setItem(key, JSON.stringify(data));
    updateUI();
}

function calculateAbsentees() {
    const key = `gioe_${branch}_${viewingDate}`;
    const logs = JSON.parse(localStorage.getItem(key)) || [];
    const presentPins = logs.map(l => parseInt(l.pin.split('-').pop()));
    const uniquePresent = [...new Set(presentPins)];
    
    let absentees = [];
    for (let i = 1; i <= strength; i++) {
        if (!uniquePresent.includes(i)) absentees.push(i.toString().padStart(3, '0'));
    }
    
    document.getElementById('absenteeList').innerHTML = absentees.length > 0 
        ? `<strong>Missing (${absentees.length}):</strong> ` + absentees.join(', ') 
        : "Everyone is present!";
}

async function shareData(date) {
    const key = `gioe_${branch}_${date}`;
    const logs = JSON.parse(localStorage.getItem(key)) || [];
    if (logs.length === 0) return showToast("No records", true);

    let text = `📊 *ATTENDANCE: ${branch}*\n📅 *Date:* ${date.replace(/-/g, "/")}\n\n`;
    const periods = [...new Set(logs.map(l => l.period))];
    periods.forEach(p => {
        text += `*${p}:*\n`;
        logs.filter(l => l.period === p).forEach(l => text += `• ${l.pin.split('-').pop()} (${l.time})\n`);
        text += `\n`;
    });

    if (navigator.share) {
        try { await navigator.share({ title: 'Attendance', text: text }); } 
        catch (e) { copyFallback(text); }
    } else { copyFallback(text); }
}

function downloadExcel() {
    const key = `gioe_${branch}_${viewingDate}`;
    const logs = JSON.parse(localStorage.getItem(key)) || [];
    if (logs.length === 0) return showToast("Nothing to export", true);

    let csv = "PIN,PERIOD,TIME\n";
    logs.forEach(l => { csv += `${l.pin},${l.period},${l.time}\n`; });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Attendance_${branch}_${viewingDate}.csv`;
    a.click();
}

function renderTable() {
    const body = document.getElementById('attendanceTable');
    const logs = JSON.parse(localStorage.getItem(`gioe_${branch}_${viewingDate}`)) || [];
    document.getElementById('viewingDate').textContent = viewingDate === today ? "Today" : viewingDate;
    body.innerHTML = logs.map(l => `
        <tr>
            <td><b>${l.pin}</b></td>
            <td>${l.period}</td>
            <td>${l.time}</td>
            <td><i class="fas fa-trash-alt row-del" onclick="deleteRow(${l.id})"></i></td>
        </tr>
    `).join('') || "<tr><td colspan='4' align='center'>No records found</td></tr>";
}

function filterHistory() {
    const q = document.getElementById('historySearch').value.toLowerCase();
    document.querySelectorAll('.history-item').forEach(item => {
        item.style.display = item.textContent.toLowerCase().includes(q) ? 'flex' : 'none';
    });
}

function renderHistory() {
    const list = document.getElementById('historyList');
    list.innerHTML = "";
    const prefix = `gioe_${branch}_`;
    Object.keys(localStorage).filter(k => k.startsWith(prefix)).sort().reverse().forEach(k => {
        const d = k.replace(prefix, "");
        const div = document.createElement('div');
        div.className = "history-item";
        div.innerHTML = `<span onclick="viewDate('${d}')">${d.replace(/-/g,"/")}/span><i class="fas fa-share-nodes share-btn" onclick="shareData('${d}')"></i>`;
        list.appendChild(div);
    });
}

function viewDate(d) { viewingDate = d; updateUI(); toggleSidebar(); }
function toggleSidebar() { document.getElementById('sidebar').classList.toggle('active'); }
function showToast(m, err) {
    const t = document.getElementById('toast');
    t.textContent = m; t.style.background = err ? "var(--error)" : "var(--success)";
    t.style.display = 'block'; setTimeout(() => t.style.display = 'none', 3000);
}
function copyFallback(t) {
    const el = document.createElement('textarea'); el.value = t; document.body.appendChild(el);
    el.select(); document.execCommand('copy'); document.body.removeChild(el);
    showToast("📋 Copied to Clipboard!");
}
function clearDate() { if(confirm("Delete all records for this day?")) { localStorage.removeItem(`gioe_${branch}_${viewingDate}`); updateUI(); } }

document.getElementById('submitBtn').onclick = markAttendance;
document.getElementById('rollInput').onkeypress = (e) => { if(e.key==='Enter') markAttendance(); };
