const fs = require('fs');

const filepath = 'operasyon.js';
let content = fs.readFileSync(filepath, 'utf8');

const target1 = `    function parseRaporDate(dStr) {
        if (!dStr) return new Date(0);
        let parts = dStr.split(/[\\s.:\\/,-]/);
        if (parts.length >= 3) {
            let day = parseInt(parts[0], 10);
            let month = parseInt(parts[1], 10) - 1;
            let year = parseInt(parts[2], 10);
            if (year < 100) year += 2000;
            let d = new Date(year, month, day);
            if (isNaN(d.getTime())) return new Date(0);
            return d;
        }
        return new Date(0);
    }`;

const replace1 = `    function parseRaporDate(dStr) {
        if (!dStr) return new Date(0);
        let datePart = dStr;
        let timePart = "00:00:00";
        if (dStr.includes(" ")) {
            const split = dStr.split(" ");
            datePart = split[0];
            timePart = split[1] || "00:00:00";
        }
        let parts = datePart.split(/[\\s.:\\/,-]/);
        if (parts.length >= 3) {
            let day = parseInt(parts[0], 10);
            let month = parseInt(parts[1], 10) - 1;
            let year = parseInt(parts[2], 10);
            if (year < 100) year += 2000;
            let tParts = timePart.split(":");
            let hour = parseInt(tParts[0], 10) || 0;
            let min = parseInt(tParts[1], 10) || 0;
            let sec = parseInt(tParts[2], 10) || 0;
            let d = new Date(year, month, day, hour, min, sec);
            if (isNaN(d.getTime())) return new Date(0);
            return d;
        }
        return new Date(0);
    }`;

function normalize(str) { return str.replace(/\r\n/g, '\n'); }

// Fallback regex approach if exact string search fails due to space/newline differences
const rx1 = /function parseRaporDate\(dStr\) \{[\s\S]*?return new Date\(0\);\s*?\}/;

if (normalize(content).includes(normalize(target1))) {
    content = normalize(content).replace(normalize(target1), replace1);
    console.log("Replaced parseRaporDate (exact).");
} else if (rx1.test(content)) {
    content = content.replace(rx1, replace1);
    console.log("Replaced parseRaporDate (regex).");
} else {
    console.log("Could not find parseRaporDate.");
}

// target2 is the charts insertion that succeeded previously via multi_replace but since I restored from git, I need to redo it!
// Oh wait, did git restore override the charts?
// Let's replace target2:
const rx2 = /(if\(document\.getElementById\("kpi-8-toplam-gun"\)\) document\.getElementById\("kpi-8-toplam-gun"\)\.textContent =) sumGun;/;
if (rx2.test(content)) {
    content = content.replace(rx2, '$1 new Intl.NumberFormat(\'tr-TR\').format(sumGun);');
    console.log("Replaced target2 (sumGun formatting).");
}

// Chart snippet appending before the end of applyReportFiltersAndDraw
const rx3 = /(if\s*\(document\.getElementById\("kpi-11-ort-tutar"\)\)\s*document\.getElementById\("kpi-11-ort-tutar"\)\.textContent\s*=\s*.+?;)[\s\r\n]*\};/;

const replace3 = `$1
        // Chart Updates
        if (window.reportsCharts.monthly) { window.reportsCharts.monthly.destroy(); }
        if (window.reportsCharts.daily) { window.reportsCharts.daily.destroy(); }
        
        const monthlyCtx = document.getElementById("monthlyAnalysisChart");
        const dailyCtx = document.getElementById("dailyAnalysisChart");
        
        if (monthlyCtx && dailyCtx) {
            const monthMap = {};
            const aylar = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
            
            filtered.forEach(f => {
                if (!f.ay || f.type !== "Completed") return;
                if (!monthMap[f.ay]) monthMap[f.ay] = { gun: 0, tutar: 0 };
                monthMap[f.ay].gun += f.ikameGunu;
                monthMap[f.ay].tutar += f.toplamMaliyet;
            });
            
            const mLabels = aylar.filter(a => monthMap[a]);
            const mGunData = mLabels.map(a => monthMap[a].gun);
            const mTutarData = mLabels.map(a => monthMap[a].tutar);
            
            window.reportsCharts.monthly = new Chart(monthlyCtx, {
                type: 'bar',
                data: {
                    labels: mLabels,
                    datasets: [
                        { label: 'İkame Gün', data: mGunData, backgroundColor: '#3b82f6', yAxisID: 'y' },
                        { label: 'İkame Tutar (₺)', data: mTutarData, type: 'line', borderColor: '#f59e0b', backgroundColor: '#f59e0b', yAxisID: 'y1' }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: { type: 'linear', position: 'left', beginAtZero: true },
                        y1: { type: 'linear', position: 'right', beginAtZero: true, grid: { drawOnChartArea: false } }
                    }
                }
            });
            
            const dayMap = {};
            filtered.forEach(f => {
                if(f.acilisMs && f.atanmaMs && f.atanmaMs >= f.acilisMs) {
                    const dStr = f.tarihObj.toLocaleDateString("tr-TR");
                    if (!dayMap[dStr]) dayMap[dStr] = { ms: 0, count: 0 };
                    dayMap[dStr].ms += (f.atanmaMs - f.acilisMs);
                    dayMap[dStr].count++;
                }
            });
            
            const dLabels = Object.keys(dayMap).sort((a,b) => {
                const partsA = a.split("."); const partsB = b.split(".");
                return new Date(partsA[2], partsA[1]-1, partsA[0]) - new Date(partsB[2], partsB[1]-1, partsB[0]);
            }).slice(-15);
            
            const dPerfData = dLabels.map(d => (dayMap[d].ms / dayMap[d].count / (1000 * 60 * 60)).toFixed(2));
            
            window.reportsCharts.daily = new Chart(dailyCtx, {
                type: 'line',
                data: {
                    labels: dLabels,
                    datasets: [{ label: 'Ortalama Atama Süresi (Saat)', data: dPerfData, borderColor: '#ec4899', backgroundColor: 'rgba(236, 72, 153, 0.1)', fill: true, tension: 0.3 }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: { y: { beginAtZero: true } }
                }
            });
        }
    };`;

if (rx3.test(content)) {
    content = content.replace(rx3, replace3);
    console.log("Replaced target3 (charts appending).");
} else {
    console.log("Could not find target3 location.");
}

fs.writeFileSync(filepath, content, 'utf8');
console.log("Update completed.");
