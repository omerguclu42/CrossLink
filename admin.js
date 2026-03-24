const DELIVERED_URL = 'https://docs.google.com/spreadsheets/d/1d-IUF5slokrV36jc5oOZcfK0v-lUz0JoC2fjEAm6CLo/gviz/tq?tqx=out:json';
const PENDING_URL = 'https://docs.google.com/spreadsheets/d/1McoRE5bx0IWdnbqv-__gtn3ywY0U13zWnMPaArtuCxQ/gviz/tq?tqx=out:json';

if (window.google && google.charts) {
    google.charts.load('current', { 'packages': ['corechart', 'geochart'] });
}


// ---- Helpers ----
function fetchJSONP(baseUrl) {
    return new Promise((resolve, reject) => {
        const callbackName = 'adminGviz_' + Math.round(1000000 * Math.random()) + '_' + Date.now();
        let script;
        window[callbackName] = function (data) {
            delete window[callbackName];
            if (script && script.parentNode) document.head.removeChild(script);
            resolve(data);
        };
        script = document.createElement('script');
        // Google Visualization API: inject responseHandler inside the tqx param
        const finalUrl = baseUrl + ';responseHandler:' + callbackName;
        script.src = finalUrl;
        script.onerror = function () {
            delete window[callbackName];
            if (script && script.parentNode) document.head.removeChild(script);
            reject(new Error('Admin verisi yüklenemedi.'));
        };
        document.head.appendChild(script);
    });
}

function parseGvizJSON(data, status) {
    const rows = [];
    if (!data || !data.table || !data.table.cols) return rows;
    const cols = data.table.cols;
    const headers = cols.map(c => (c.label || c.id || '').trim());
    (data.table.rows || []).forEach(row => {
        const obj = { 'Teslimat Durumu': status };
        let hasData = false;
        headers.forEach((h, i) => {
            const cell = row.c ? row.c[i] : null;
            // Use formatted value (cell.f) first — it gives proper date strings like '07.01.2026 10:13:58'
            const val = cell ? (cell.f != null ? cell.f : (cell.v != null ? String(cell.v) : '')) : '';
            obj[h] = String(val).trim();
            if (obj[h] && obj[h] !== 'null') hasData = true;
        });
        if (hasData) rows.push(obj);
    });
    return rows;
}

function parseTurkishDate(dateStr) {
    if (!dateStr || dateStr === '-' || !dateStr.trim()) return null;
    const parts = dateStr.trim().split(' ');
    if (parts.length !== 2) return null;
    const dP = parts[0].split('.');
    const tP = parts[1].split(':');
    if (dP.length !== 3 || tP.length < 2) return null;
    return new Date(dP[2], dP[1] - 1, dP[0], tP[0], tP[1]);
}

function fmtMs(ms) {
    if (!ms || ms <= 0) return '-';
    const totalMin = Math.floor(ms / 60000);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return h > 0 ? `${h} Saat ${m} Dak.` : `${m} Dak.`;
}

// Apply localStorage demo overrides
function applyDemoOverrides(rows) {
    rows.forEach(row => {
        const dn = row['Dosya No'];
        const localStatus = localStorage.getItem('crosslink_status_' + dn);
        if (localStatus === 'Teslim Edildi') row['Teslimat Durumu'] = 'Teslim Edildi';
        const localTeslimat = localStorage.getItem('crosslink_teslimat_date_' + dn);
        if (localTeslimat) row['Teslimat Tarihi'] = localTeslimat;
        const localIade = localStorage.getItem('crosslink_iade_date_' + dn);
        if (localIade) row['İade Tarihi'] = localIade;
        const localSeg = localStorage.getItem('crosslink_segment_' + dn);
        if (localSeg) row['İkame Araç Segmenti'] = localSeg;
    });
    return rows;
}

// ---- State ----
let allRowsGlobal = [];
let adminMusteri = ''; // active customer filter

// ---- Main ----
async function initAdmin() {
    if (!sessionStorage.getItem('crosslink_admin')) {
        window.location.href = 'index.html';
        return;
    }

    document.getElementById('adminLogoutBtn').addEventListener('click', () => {
        sessionStorage.removeItem('crosslink_admin');
        window.location.href = 'index.html';
    });

    try {
        const [deliveredJson, pendingJson] = await Promise.all([fetchJSONP(DELIVERED_URL), fetchJSONP(PENDING_URL)]);
        let allRows = [
            ...parseGvizJSON(deliveredJson, 'Teslim Edildi'),
            ...parseGvizJSON(pendingJson, 'Teslim Edilmedi')
        ];
        allRows = applyDemoOverrides(allRows);
        allRowsGlobal = allRows;

        // Build Musteri filter
        buildMusteriFilter(allRows);
        renderAdmin(allRows);
    } catch (e) {
        document.getElementById('adminLoadingDiv').innerHTML = `<p style="color:#dc2626">Veriler y\u00fcklenemedi: ${e.message}</p>`;
    }
}

let adminTedarikci = ''; // active supplier filter
let adminYil = '';
let adminAy = '';

function buildAdminFilters(allRows) {
    const musSet = new Set();
    const supSet = new Set();
    const yearSet = new Set();

    allRows.forEach(row => {
        const m = row['Müşteri'] || row['Sigorta Şirketi'] || '';
        if (m) musSet.add(m.trim());
        const supKey = Object.keys(row).find(k => k.toLowerCase().includes('tedarik')) || '';
        const sup = supKey ? (row[supKey] || '').trim() : '';
        if (sup) supSet.add(sup);

        const dateStr = row['Dosya Açılış Tarihi'] || '';
        if (dateStr) {
            const parts = dateStr.split(' ')[0].split('.');
            if (parts.length === 3) yearSet.add(parts[2]);
        }
    });

    const musteriSel = document.getElementById('adminMusteriFilter');
    const tedarikciSel = document.getElementById('adminTedarikciFilter');
    const yilSel = document.getElementById('adminYilFilter');
    const aySel = document.getElementById('adminAyFilter');

    if (musteriSel) {
        musteriSel.innerHTML = '<option value="">Tüm Müşteriler</option>';
        Array.from(musSet).sort((a, b) => a.localeCompare(b, 'tr')).forEach(m => {
            const opt = document.createElement('option'); opt.value = m; opt.textContent = m;
            musteriSel.appendChild(opt);
        });
        musteriSel.addEventListener('change', () => { adminMusteri = musteriSel.value; _applyAdminFilters(); });
    }

    if (tedarikciSel) {
        tedarikciSel.innerHTML = '<option value="">Tüm Tedarikçiler</option>';
        Array.from(supSet).sort((a, b) => a.localeCompare(b, 'tr')).forEach(s => {
            const opt = document.createElement('option'); opt.value = s; opt.textContent = s;
            tedarikciSel.appendChild(opt);
        });
        tedarikciSel.addEventListener('change', () => { adminTedarikci = tedarikciSel.value; _applyAdminFilters(); });
    }

    if (yilSel) {
        yilSel.innerHTML = '<option value="">Tüm Yıllar</option>';
        Array.from(yearSet).sort((a, b) => parseInt(b) - parseInt(a)).forEach(y => {
            const opt = document.createElement('option'); opt.value = y; opt.textContent = y;
            yilSel.appendChild(opt);
        });
        yilSel.addEventListener('change', () => { adminYil = yilSel.value; _applyAdminFilters(); });
    }

    if (aySel) {
        aySel.innerHTML = '<option value="">Tüm Aylar</option>';
        const TR_MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
        for (let mm = 1; mm <= 12; mm++) {
            const opt = document.createElement('option');
            opt.value = String(mm).padStart(2, '0');
            opt.textContent = TR_MONTHS[mm - 1];
            aySel.appendChild(opt);
        }
        aySel.addEventListener('change', () => { adminAy = aySel.value; _applyAdminFilters(); });
    }

    const btnResetFilters = document.getElementById('adminBtnResetFilters');
    if (btnResetFilters) {
        btnResetFilters.addEventListener('click', () => {
            adminMusteri = '';
            adminTedarikci = '';
            adminYil = '';
            adminAy = '';

            if (musteriSel) musteriSel.value = '';
            if (tedarikciSel) tedarikciSel.value = '';
            if (yilSel) yilSel.value = '';
            if (aySel) aySel.value = '';

            _applyAdminFilters();
        });
    }
}

// Keep old name for backward compat (called from initAdmin)
function buildMusteriFilter(allRows) { buildAdminFilters(allRows); }

function _applyAdminFilters() {
    let rows = allRowsGlobal;

    // Filter by Müşteri
    if (adminMusteri) rows = rows.filter(r => (r['Müşteri'] || r['Sigorta Şirketi'] || '').trim() === adminMusteri);

    // Filter by Tedarikçi
    if (adminTedarikci) {
        rows = rows.filter(r => {
            const supKey = Object.keys(r).find(k => k.toLowerCase().includes('tedarik')) || '';
            return supKey ? (r[supKey] || '').trim() === adminTedarikci : false;
        });
    }

    // Filter by Date (Yıl/Ay)
    if (adminYil || adminAy) {
        rows = rows.filter(r => {
            const dateStr = r['Dosya Açılış Tarihi'];
            if (!dateStr) return false;
            const parts = dateStr.split(' ')[0].split('.');
            if (parts.length === 3) {
                if (adminYil && parts[2] !== adminYil) return false;
                if (adminAy && parts[1] !== adminAy) return false;
                return true;
            }
            return false;
        });
    }

    renderAdmin(rows);
}

function calcSupplierStats(rows) {
    const totalMs = { '_total': 0 };
    const deliveredMs = { '_total': 0 };
    const slaIn = {};
    const ikameGun = {};
    const segCounts = {};
    const supplierRows = {};

    rows.forEach(row => {
        const tedarikciKey = Object.keys(row).find(k => k.toLowerCase().includes('tedarik')) || '';
        const sup = tedarikciKey ? (row[tedarikciKey] || 'Bilinmeyen').trim() : 'Bilinmeyen';
        if (!supplierRows[sup]) supplierRows[sup] = [];
        supplierRows[sup].push(row);
    });

    return supplierRows;
}

function computeStats(rows) {
    let delivered = 0, pending = 0;
    let totalDelivMs = 0, delivMsCount = 0;
    let totalIkame = 0, ikameCount = 0;
    let slaOk = 0, slaTotal = 0;
    const segs = {};
    const segDays = {};
    const segDelivMs = {};
    const segDelivCount = {};

    rows.forEach(row => {
        if (row['Teslimat Durumu'] === 'Teslim Edildi') delivered++;
        else pending++;

        const teslimatStr = localStorage.getItem('crosslink_teslimat_date_' + row['Dosya No']) || row['Teslimat Tarihi'];
        const iadeStr = localStorage.getItem('crosslink_iade_date_' + row['Dosya No']) || row['İade Tarihi'];
        const acilisStr = row['Dosya Açılış Tarihi'];

        if (row['Teslimat Durumu'] === 'Teslim Edildi' && teslimatStr) {
            const tDate = parseTurkishDate(teslimatStr);
            const aDate = parseTurkishDate(acilisStr);
            if (tDate && aDate && tDate >= aDate) {
                const ms = tDate - aDate;
                totalDelivMs += ms;
                delivMsCount++;
                slaTotal++;
                if (ms <= 24 * 60 * 60 * 1000) slaOk++;

                const seg3 = localStorage.getItem('crosslink_segment_' + row['Dosya No']) || row['İkame Araç Segmenti'] || row['Segment'] || '';
                if (seg3 && seg3 !== '-' && seg3.trim()) {
                    segDelivMs[seg3] = (segDelivMs[seg3] || 0) + ms;
                    segDelivCount[seg3] = (segDelivCount[seg3] || 0) + 1;
                }
            }
            if (iadeStr) {
                const iDate = parseTurkishDate(iadeStr);
                if (tDate && iDate && iDate >= tDate) {
                    const days = Math.floor((iDate - tDate) / (1000 * 60 * 60 * 24));
                    totalIkame += days;
                    ikameCount++;
                    // segment days
                    const seg2 = localStorage.getItem('crosslink_segment_' + row['Dosya No']) || row['İkame Araç Segmenti'] || row['Segment'] || '';
                    if (seg2 && seg2 !== '-' && seg2.trim()) segDays[seg2] = (segDays[seg2] || 0) + days;
                }
            }
        }

        const seg = localStorage.getItem('crosslink_segment_' + row['Dosya No']) || row['İkame Araç Segmenti'] || row['Segment'] || '';
        if (seg && seg !== '-' && seg.trim()) segs[seg] = (segs[seg] || 0) + 1;
    });

    const total = rows.length;
    const avgDelivMs = delivMsCount > 0 ? totalDelivMs / delivMsCount : 0;
    const avgIkame = ikameCount > 0 ? (totalIkame / ikameCount).toFixed(1) : '0';
    const slaRate = slaTotal > 0 ? Math.round((slaOk / slaTotal) * 100) : null;
    const topSegEntry = Object.entries(segs).sort((a, b) => b[1] - a[1])[0];
    const topSeg = topSegEntry ? topSegEntry[0] : '-';
    const topSegCount = topSegEntry ? topSegEntry[1] : 0;

    return { total, delivered, pending, avgDelivMs, totalIkame, avgIkame, slaRate, segs, segDays, topSeg, topSegCount, slaTotal, segDelivMs, segDelivCount };
}

function renderAdmin(allRows) {
    document.getElementById('adminLoadingDiv').style.display = 'none';
    document.getElementById('adminContent').style.display = 'block';

    // Global Stats
    const global = computeStats(allRows);
    document.getElementById('adm_total').textContent = global.total;
    document.getElementById('adm_delivered').textContent = global.delivered;
    document.getElementById('adm_pending').textContent = global.pending;
    document.getElementById('adm_sla').textContent = global.slaRate !== null ? global.slaRate + '%' : '-%';
    if (global.slaRate !== null) {
        document.getElementById('adm_sla').style.color = global.slaRate >= 70 ? '#16a34a' : '#dc2626';
    }
    document.getElementById('adm_avgDelivery').textContent = fmtMs(global.avgDelivMs);
    document.getElementById('adm_totalIkame').textContent = global.totalIkame.toLocaleString('tr-TR') + ' Gün';
    document.getElementById('adm_avgIkame').textContent = global.avgIkame + ' Gün';
    document.getElementById('adm_topSeg').textContent = global.topSeg !== '-' ? global.topSeg + ' Segment' : '-';
    const totalSegs = Object.values(global.segs).reduce((a, b) => a + b, 0);
    document.getElementById('adm_topSegSub').textContent = global.topSegCount > 0 ? `${global.topSegCount} adet (${Math.round(global.topSegCount / totalSegs * 100)}%)` : '';

    // Per Supplier Table
    const supplierGroups = calcSupplierStats(allRows);
    const tbody = document.getElementById('supplierTableBody');
    tbody.innerHTML = '';
    const supplierNames = Object.keys(supplierGroups).sort((a, b) => a.localeCompare(b, 'tr'));
    supplierNames.forEach(sup => {
        const st = computeStats(supplierGroups[sup]);
        const delivRate = st.total > 0 ? Math.round((st.delivered / st.total) * 100) : 0;
        const slaText = st.slaRate !== null ? st.slaRate + '%' : '-%';
        const slaBadge = st.slaRate !== null
            ? `<span class="sla-badge ${st.slaRate >= 70 ? 'sla-good' : 'sla-bad'}">${slaText}</span>`
            : '<span style="color:#999">-</span>';

        tbody.innerHTML += `
            <tr data-delivered="${st.delivered}" data-pending="${st.pending}" data-total="${st.total}" data-sla="${st.slaRate ?? -1}" data-ikame="${st.totalIkame}" data-rate="${delivRate}" data-supplier="${sup}" data-avgdeliv="${st.avgDelivMs}" data-avgikame="${st.avgIkame}">
                <td><strong>${sup}</strong></td>
                <td>${st.total}</td>
                <td style="color:#16a34a;font-weight:600;">${st.delivered}</td>
                <td style="color:#dc2626;font-weight:600;">${st.pending}</td>
                <td>${slaBadge}</td>
                <td style="font-family:monospace;font-weight:600;">${fmtMs(st.avgDelivMs)}</td>
                <td>${st.totalIkame.toLocaleString('tr-TR')} Gün</td>
                <td>${st.avgIkame} Gün</td>
                <td>
                    <span class="sla-badge ${delivRate >= 75 ? 'sla-good' : 'sla-bad'}">${delivRate}%</span>
                </td>
            </tr>
        `;
    });
    if (supplierNames.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:30px;color:#999;">Tedarikçi verisi bulunamadı.</td></tr>';
    }

    // Segment Table — Oran based on total DAYS
    const segTbody = document.getElementById('adminSegTableBody');
    segTbody.innerHTML = '';
    const segsArr = Object.entries(global.segs).sort((a, b) => b[1] - a[1]);
    const totalSegDays = Object.values(global.segDays || {}).reduce((a, b) => a + b, 0);
    segsArr.forEach(([seg, cnt]) => {
        const days = (global.segDays || {})[seg] || 0;
        const pct = totalSegDays > 0 ? Math.round(days / totalSegDays * 100) : 0;
        const totalSegMs = (global.segDelivMs || {})[seg] || 0;
        const totalSegCnt = (global.segDelivCount || {})[seg] || 0;
        const avgSegMs = totalSegCnt > 0 ? totalSegMs / totalSegCnt : 0;

        segTbody.innerHTML += `
            <tr>
                <td style="font-weight:600;">${seg}</td>
                <td style="color:var(--primary-color);font-weight:700;">${cnt}</td>
                <td style="color:var(--primary-color);font-weight:700;">${days}</td>
                <td style="font-family:monospace;font-weight:600;">${fmtMs(avgSegMs)}</td>
                <td>${pct}%</td>
                <td style="min-width:120px;">
                    <div class="perf-bar"><div class="perf-bar-fill" style="width:${pct}%"></div></div>
                </td>
            </tr>
        `;
    });
    if (segsArr.length === 0) {
        segTbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;color:#999;">Segment verisi yok</td></tr>';
    }

    // Generic sortable headers for all .supplier-table instances
    document.querySelectorAll('.supplier-table .sortable-th').forEach(th => {
        th.style.cursor = 'pointer';
        // Attach state to the table to allow independent sorting
        const table = th.closest('table');
        if (!table.dataset.sortField) {
            table.dataset.sortField = '';
            table.dataset.sortAsc = 'true';
        }

        th.addEventListener('click', () => {
            const field = th.dataset.sort;
            let isAsc = table.dataset.sortField === field ? table.dataset.sortAsc !== 'true' : true;
            table.dataset.sortField = field;
            table.dataset.sortAsc = isAsc.toString();

            table.querySelectorAll('.sort-icon').forEach(ic => ic.textContent = '⇅');
            th.querySelector('.sort-icon').textContent = isAsc ? '↑' : '↓';

            const tbody = table.querySelector('tbody');
            const rows = Array.from(tbody.querySelectorAll('tr'));

            // Do not sort if it's a loading/no data row
            if (rows.length === 1 && rows[0].cells.length === 1) return;

            rows.sort((a, b) => {
                const aVal = a.dataset[field] || a.cells[th.cellIndex].textContent;
                const bVal = b.dataset[field] || b.cells[th.cellIndex].textContent;

                // Parse numbers (handle formats like '12.5 Gün', '15 Saat 10 Dak.', '67%')
                const parseVal = (str) => {
                    if (!str || str === '-' || str === '-%') return -Infinity;
                    if (str.includes('Saat') || str.includes('Dak.')) {
                        let hrs = 0, mins = 0;
                        const hrMatch = str.match(/(\d+)\s*Saat/);
                        const minMatch = str.match(/(\d+)\s*Dak/);
                        if (hrMatch) hrs = parseInt(hrMatch[1]);
                        if (minMatch) mins = parseInt(minMatch[1]);
                        return (hrs * 60) + mins;
                    }
                    return parseFloat(str.replace(/[^\d.-]/g, ''));
                };

                const aNum = parseVal(aVal);
                const bNum = parseVal(bVal);

                if (!isNaN(aNum) && !isNaN(bNum) && aNum !== -Infinity && bNum !== -Infinity) {
                    return isAsc ? aNum - bNum : bNum - aNum;
                }
                return isAsc ? aVal.localeCompare(bVal, 'tr') : bVal.localeCompare(aVal, 'tr');
            });

            rows.forEach(r => tbody.appendChild(r));
        });
    });

    // Pending Files Table
    renderPendingTable(allRows);

    if (window.google && google.visualization && google.visualization.DataTable) {
        drawCharts(allRows);
    } else if (window.google && google.charts) {
        google.charts.setOnLoadCallback(() => drawCharts(allRows));
    }
}

function renderPendingTable(allRows) {
    const tbody = document.getElementById('adminPendingTableBody');
    if (!tbody) return;

    // Filter only pending rows
    const pendingRows = allRows.filter(r => r['Teslimat Durumu'] !== 'Teslim Edildi');

    if (pendingRows.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:24px;color:#999;">Bekleyen dosya yok 🎉</td></tr>';
        return;
    }

    // Sort by oldest opening date first (highest SLA = most urgent at top)
    pendingRows.sort((a, b) => {
        const aDate = parseTurkishDate(a['Dosya Açılış Tarihi']);
        const bDate = parseTurkishDate(b['Dosya Açılış Tarihi']);
        const aTs = aDate ? aDate.getTime() : Infinity;
        const bTs = bDate ? bDate.getTime() : Infinity;
        return aTs - bTs; // ascending date = oldest first = highest SLA first
    });

    tbody.innerHTML = '';
    const now = new Date();

    pendingRows.forEach(row => {
        // Find supplier column
        const supKey = Object.keys(row).find(k => k.toLowerCase().includes('tedarik')) || '';
        const sup = supKey ? (row[supKey] || '-').trim() : '-';

        // SLA calculation
        const acilisDate = parseTurkishDate(row['Dosya Açılış Tarihi']);
        let slaText = '-';
        let slaColor = '#6b7280';
        if (acilisDate) {
            const diffMs = now - acilisDate;
            const diffHrs = diffMs / (1000 * 60 * 60);
            const totalMin = Math.floor(diffMs / 60000);
            const h = Math.floor(totalMin / 60);
            const m = totalMin % 60;
            slaText = h > 0 ? `${h} Saat ${m} Dak.` : `${m} Dak.`;
            if (diffHrs >= 24) slaColor = '#dc2626';
            else if (diffHrs >= 8) slaColor = '#d97706';
            else slaColor = '#16a34a';
        }

        tbody.innerHTML += `
            <tr>
                <td><span style="font-weight:700;color:${slaColor};white-space:nowrap;">${slaText}</span></td>
                <td style="font-weight:600;color:var(--primary-color);">${sup}</td>
                <td>${row['Hizmet No'] || '-'}</td>
                <td>${row['Dosya No'] || '-'}</td>
                <td style="white-space:nowrap;">${row['Dosya Açılış Tarihi'] || '-'}</td>
                <td>${row['Müşteri'] || '-'}</td>
                <td>${row['İsim'] || '-'}</td>
                <td>${row['Soyisim'] || '-'}</td>
                <td>${row['İl'] || '-'}</td>
            </tr>
        `;
    });
}

function getRegionForProvince(provinceStr) {
    if (!provinceStr) return "Bilinmeyen Bölge";
    const str = provinceStr.toLocaleUpperCase('TR').trim();

    const marmara = ["İSTANBUL", "EDİRNE", "KIRKLARELİ", "TEKİRDAĞ", "ÇANAKKALE", "BALIKESİR", "BURSA", "YALOVA", "KOCAELİ", "SAKARYA", "BİLECİK"];
    const ege = ["İZMİR", "MANİSA", "AYDIN", "DENİZLİ", "MUĞLA", "AFYONKARAHİSAR", "KÜTAHYA", "UŞAK"];
    const akdeniz = ["ANTALYA", "BURDUR", "ISPARTA", "MERSİN", "ADANA", "HATAY", "OSMANİYE", "KAHRAMANMARAŞ"];
    const icAnadolu = ["ANKARA", "ESKİŞEHİR", "KONYA", "KARAMAN", "AKSARAY", "NİĞDE", "NEVŞEHİR", "KIRŞEHİR", "KIRIKKALE", "YOZGAT", "SİVAS", "ÇANKIRI", "KAYSERİ"];
    const karadeniz = ["BOLU", "DÜZCE", "ZONGULDAK", "KARABÜK", "BARTIN", "KASTAMONU", "SİNOP", "ÇORUM", "AMASYA", "SAMSUN", "TOKAT", "ORDU", "GİRESUN", "GÜMÜŞHANE", "TRABZON", "BAYBURT", "RİZE", "ARTVİN"];
    const doguAnadolu = ["ERZİNCAN", "ERZURUM", "TUNCELİ", "BİNGÖL", "MUŞ", "ELAZIĞ", "MALATYA", "BİTLİS", "ŞIRNAK", "HAKKARİ", "VAN", "AĞRI", "IĞDIR", "KARS", "ARDAHAN"];
    const guneydogu = ["GAZİANTEP", "KİLİS", "ŞANLIURFA", "ADIYAMAN", "DİYARBAKIR", "MARDİN", "BATMAN", "SİİRT"];

    if (marmara.includes(str)) return "Marmara";
    if (ege.includes(str)) return "Ege";
    if (akdeniz.includes(str)) return "Akdeniz";
    if (icAnadolu.includes(str)) return "İç Anadolu";
    if (karadeniz.includes(str)) return "Karadeniz";
    if (doguAnadolu.includes(str)) return "Doğu Anadolu";
    if (guneydogu.includes(str)) return "Güneydoğu Anadolu";

    return "Diğer";
}

function drawCharts(rows) {
    if (rows.length === 0) {
        if (document.getElementById('regions_div')) document.getElementById('regions_div').innerHTML = "<p style='text-align:center;color:#999;margin-top:50px;'>Veri Yok</p>";
        if (document.getElementById('provinceTableBody')) document.getElementById('provinceTableBody').innerHTML = '<tr><td colspan="5" style="text-align:center;color:#999;">Veri Yok</td></tr>';
        if (document.getElementById('regionTableBody')) document.getElementById('regionTableBody').innerHTML = '<tr><td colspan="5" style="text-align:center;color:#999;">Veri Yok</td></tr>';
        ['adminChart_dosya', 'adminChart_ikame', 'adminChart_delivMs', 'adminChart_sla'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = "<p style='text-align:center;color:#999;margin-top:50px;'>Veri Yok</p>";
        });
        return;
    }

    // --- 1. Province & Region Stats ---
    const provinceStats = {};
    rows.forEach(row => {
        const il = row['İl'];
        if (il) {
            if (!provinceStats[il]) provinceStats[il] = [];
            provinceStats[il].push(row);
        }
    });

    const mapDataArr = [['İl', 'Dosya Sayısı']];
    for (const [il, rArr] of Object.entries(provinceStats)) {
        mapDataArr.push([il, rArr.length]);
    }

    if (document.getElementById('regions_div')) {
        const mapData = google.visualization.arrayToDataTable(mapDataArr);
        const mapOptions = {
            region: 'TR',
            displayMode: 'regions',
            resolution: 'provinces',
            colorAxis: { colors: ['#ffc8a3', '#F88C42', '#d6681c'] },
            backgroundColor: 'transparent',
            datalessRegionColor: '#f5f5f5',
            defaultColor: '#f5f5f5',
            legend: 'none',
            keepAspectRatio: true,
            width: '100%'
        };
        const mapChart = new google.visualization.GeoChart(document.getElementById('regions_div'));
        mapChart.draw(mapData, mapOptions);
    }

    const regionStats = {};
    const sortedProvinces = Object.keys(provinceStats).sort((a, b) => provinceStats[b].length - provinceStats[a].length);

    const provTbody = document.getElementById('provinceTableBody');
    if (provTbody) {
        provTbody.innerHTML = '';
        sortedProvinces.forEach(il => {
            const rArr = provinceStats[il];
            const st = computeStats(rArr);
            const region = getRegionForProvince(il);

            if (!regionStats[region]) regionStats[region] = [];
            regionStats[region] = regionStats[region].concat(rArr);

            const slaRate = st.slaRate !== null ? st.slaRate + '%' : '-%';
            provTbody.innerHTML += `
                <tr style="border-bottom: 1px solid var(--border-color); background: white;">
                    <td style="padding: 8px;">${il}</td>
                    <td style="padding: 8px; font-weight: 600; color: var(--primary-color);">${st.total}</td>
                    <td style="padding: 8px;">${st.totalIkame}</td>
                    <td style="padding: 8px;">${slaRate}</td>
                    <td style="padding: 8px; font-family: monospace;">${fmtMs(st.avgDelivMs)}</td>
                </tr>
            `;
        });
    }

    const regTbody = document.getElementById('regionTableBody');
    if (regTbody) {
        const sortedRegions = Object.keys(regionStats).sort((a, b) => regionStats[b].length - regionStats[a].length);
        regTbody.innerHTML = '';
        sortedRegions.forEach(region => {
            const rArr = regionStats[region];
            const st = computeStats(rArr);
            const slaRate = st.slaRate !== null ? st.slaRate + '%' : '-%';

            regTbody.innerHTML += `
                <tr style="border-bottom: 1px solid var(--border-color); background: white;">
                    <td style="padding: 8px;">${region}</td>
                    <td style="padding: 8px; font-weight: 600; color: var(--primary-color);">${st.total}</td>
                    <td style="padding: 8px;">${st.totalIkame}</td>
                    <td style="padding: 8px;">${slaRate}</td>
                    <td style="padding: 8px; font-family: monospace;">${fmtMs(st.avgDelivMs)}</td>
                </tr>
            `;
        });
    }

    // --- 2. Monthly Trend Charts ---
    const TR_MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
    const monthData = {};
    for (let i = 1; i <= 12; i++) monthData[String(i).padStart(2, '0')] = {};
    const suppliersSet = new Set();

    rows.forEach(r => {
        const supKey = Object.keys(r).find(k => k.toLowerCase().includes('tedarik')) || '';
        const sup = supKey ? (r[supKey] || 'Bilinmeyen').trim() : 'Bilinmeyen';
        suppliersSet.add(sup);
        const dateStr = r['Dosya Açılış Tarihi'];
        if (dateStr) {
            const parts = dateStr.split(' ')[0].split('.');
            if (parts.length === 3) {
                const mm = parts[1];
                if (monthData[mm]) {
                    if (!monthData[mm][sup]) monthData[mm][sup] = [];
                    monthData[mm][sup].push(r);
                }
            }
        }
    });

    const supArray = Array.from(suppliersSet).sort((a, b) => a.localeCompare(b, 'tr'));

    const dosyaDt = new google.visualization.DataTable();
    const ikameDt = new google.visualization.DataTable();
    const delivDt = new google.visualization.DataTable();
    const slaDt = new google.visualization.DataTable();

    [dosyaDt, ikameDt, delivDt, slaDt].forEach(dt => {
        dt.addColumn('string', 'Ay');
        supArray.forEach(s => dt.addColumn('number', s));
    });

    let maxMonthIdx = 11; // Push to all 12 months unconditionally to fill x-axis

    if (maxMonthIdx >= 0) {
        for (let i = 0; i <= maxMonthIdx; i++) {
            const mm = String(i + 1).padStart(2, '0');
            const monthName = TR_MONTHS[i];

            const dosyaRow = [monthName];
            const ikameRow = [monthName];
            const delivRow = [monthName];
            const slaRow = [monthName];

            supArray.forEach(s => {
                const sRows = monthData[mm][s] || [];
                if (sRows.length > 0) {
                    const st = computeStats(sRows);
                    dosyaRow.push(st.total);
                    ikameRow.push(st.totalIkame);
                    delivRow.push(st.avgDelivMs > 0 ? parseFloat((st.avgDelivMs / (1000 * 60 * 60)).toFixed(1)) : 0); // Saat
                    slaRow.push(st.slaRate !== null ? st.slaRate : 0);
                } else {
                    // Inject null or 0 so x-axis remains but line dots might drop or skip
                    dosyaRow.push(null);
                    ikameRow.push(null);
                    delivRow.push(null);
                    slaRow.push(null);
                }
            });

            dosyaDt.addRow(dosyaRow);
            ikameDt.addRow(ikameRow);
            delivDt.addRow(delivRow);
            slaDt.addRow(slaRow);
        }

        const commonOpts = {
            curveType: 'function',
            legend: { position: 'bottom', textStyle: { fontSize: 9 } },
            chartArea: { width: '85%', height: '70%' },
            pointSize: 5,
            vAxis: { viewWindow: { min: 0 } },
            lineWidth: 2,
            interpolateNulls: false // Break the line if no data point for the month
        };

        if (document.getElementById('adminChart_dosya'))
            new google.visualization.LineChart(document.getElementById('adminChart_dosya')).draw(dosyaDt, commonOpts);

        if (document.getElementById('adminChart_ikame'))
            new google.visualization.LineChart(document.getElementById('adminChart_ikame')).draw(ikameDt, commonOpts);

        if (document.getElementById('adminChart_delivMs'))
            new google.visualization.LineChart(document.getElementById('adminChart_delivMs')).draw(delivDt, { ...commonOpts, vAxis: { title: 'Saat', viewWindow: { min: 0 } } });

        if (document.getElementById('adminChart_sla'))
            new google.visualization.LineChart(document.getElementById('adminChart_sla')).draw(slaDt, { ...commonOpts, vAxis: { title: '% Oran', viewWindow: { min: 0, max: 100 } } });
    } else {
        ['adminChart_dosya', 'adminChart_ikame', 'adminChart_delivMs', 'adminChart_sla'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = "<p style='text-align:center;color:#999;margin-top:50px;'>Bu tarihte veri yok</p>";
        });
    }
}

document.addEventListener('DOMContentLoaded', initAdmin);

// ---- PDF Export ----
function exportAdminPDF() {
    const btn = document.getElementById('btnSavePdf');
    if (btn) {
        btn.textContent = '⏳ Hazırlanıyor...';
        btn.disabled = true;
    }

    const contentEl = document.querySelector('main.admin-main') || document.body;

    html2canvas(contentEl, {
        scale: 1.5,
        useCORS: true,
        backgroundColor: '#f5f7fa',
        scrollY: -window.scrollY,
        windowWidth: contentEl.scrollWidth,
        windowHeight: contentEl.scrollHeight
    }).then(canvas => {
        const { jsPDF } = window.jspdf;

        // Calculate dynamic height to fit exactly one page without cutting
        const pdfWidth = 1000; // Fixed width for nice scaling (slightly wider for admin)
        const ratio = pdfWidth / canvas.width;
        const pdfHeight = canvas.height * ratio;

        // Create PDF with custom page size matching the content perfectly
        const pdf = new jsPDF({
            orientation: pdfWidth > pdfHeight ? 'landscape' : 'portrait',
            unit: 'px',
            format: [pdfWidth, pdfHeight]
        });

        const imgData = canvas.toDataURL('image/jpeg', 1.0);
        pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);

        // Filename with current date for uniqueness
        const now = new Date();
        const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        pdf.save(`Crosslink Dashboard - ${dateStr}.pdf`);

        if (btn) {
            btn.textContent = '📄 PDF Olarak Kaydet';
            btn.disabled = false;
        }
    }).catch(err => {
        console.error('PDF oluşturma hatası:', err);
        alert('PDF oluşturulurken bir hata oluştu.');
        if (btn) {
            btn.textContent = '📄 PDF Olarak Kaydet';
            btn.disabled = false;
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    const pdfBtn = document.getElementById('btnSavePdf');
    if (pdfBtn) {
        pdfBtn.addEventListener('click', exportAdminPDF);
    }
});
