let branch = "";
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
    return match ? { n: match.n, ok: match.ok !== false } : { n: "Closed", ok: false };
}

function initApp(b) {
    branch = b;
    document.getElementById('branchOverlay').style.display = 'none';
    document.getElementById('branchTitle').textContent = b + " Attendance";
    document.getElementById('prefixLabel').textContent = `24054-${b}-`;
    document.getElementById('liveDate').textContent = new Date().toDateString();
    updateUI();
    setInterval(updateUI, 30000);
}

function updateUI() {
    const s = getPeriod();
    const b = document.getElementById('statusBanner');
    b.textContent = "Current: " + s.n;
    b.style.color = s.ok ? "#28a745" : "#dc3545";
    renderTable();
    renderHistory();
}

function markAttendance() {
    const input = document.getElementById('rollInput');
    const pin = input.value.trim();
    const s = getPeriod();
    if (!s.ok) return showToast("College Closed", true);
    if (!/^[0-9]{3}$/.test(pin)) return showToast("Enter 3 digits", true);

    const key = `gioe_${branch}_${today}`;
    let data = JSON.parse(localStorage.getItem(key)) || [];
    const fullPin = `24054-${branch}-${pin}`;

    if (data.some(d => d.pin === fullPin && d.period === s.n)) {
        showToast("Already marked!", true);
    } else {
        data.unshift({ pin: fullPin, period: s.n, time: new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) });
        localStorage.setItem(key, JSON.stringify(data));
        showToast("Marked " + pin);
    }
    input.value = "";
    renderTable();
    renderHistory();
}

// THE FIX: SHARING LOGIC
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

    // Try Share Menu (WhatsApp/Drive)
    if (navigator.share) {
        try {
            await navigator.share({ title: 'Attendance', text: text });
            return;
        } catch (e) { /* Fallback if cancelled */ }
    }

    // Fallback: Clipboard Copy (Works everywhere)
    const dummy = document.createElement("textarea");
    document.body.appendChild(dummy);
    dummy.value = text;
    dummy.select();
    document.execCommand("copy");
    document.body.removeChild(dummy);
    showToast("📋 Copied to Clipboard! Open WhatsApp and Paste.", false);
}

function renderTable() {
    const body = document.getElementById('attendanceTable');
    const logs = JSON.parse(localStorage.getItem(`gioe_${branch}_${viewingDate}`)) || [];
    document.getElementById('viewingDate').textContent = viewingDate === today ? "Today" : viewingDate;
    body.innerHTML = logs.map(l => `<tr><td><b>${l.pin}</b></td><td>${l.period}</td><td>${l.time}</td></tr>`).join('') || "<tr><td colspan='3'>No records</td></tr>";
}

function renderHistory() {
    const list = document.getElementById('historyList');
    list.innerHTML = "";
    const prefix = `gioe_${branch}_`;
    Object.keys(localStorage).filter(k => k.startsWith(prefix)).sort().reverse().forEach(k => {
        const d = k.replace(prefix, "");
        const div = document.createElement('div');
        div.className = "history-item";
        div.innerHTML = `<span onclick="view('${d}')">${d.replace(/-/g,"/")}</span><i class="fas fa-share-nodes share-btn" onclick="shareData('${d}')"></i>`;
        list.appendChild(div);
    });
}

function view(d) { viewingDate = d; renderTable(); toggleSidebar(); }
function toggleSidebar() { document.getElementById('sidebar').classList.toggle('active'); }
function showToast(m, err) {
    const t = document.getElementById('toast');
    t.textContent = m; t.style.background = err ? "#dc3545" : "#28a745";
    t.style.display = 'block'; setTimeout(() => t.style.display = 'none', 3000);
}
function clearDate() { localStorage.removeItem(`gioe_${branch}_${viewingDate}`); renderTable(); renderHistory(); }

document.getElementById('submitBtn').onclick = markAttendance;
document.getElementById('rollInput').onkeypress = (e) => { if(e.key==='Enter') markAttendance(); };