// JSONP Endpoints using Google Visualization API. 
// This is the ONLY 100% bulletproof way to bypass CORS when running from file:/// HTML files without a local server.
const DELIVERED_JSONP_URL = "https://docs.google.com/spreadsheets/d/1d-IUF5slokrV36jc5oOZcfK0v-lUz0JoC2fjEAm6CLo/gviz/tq?tqx=out:json";
const PENDING_JSONP_URL = "https://docs.google.com/spreadsheets/d/1McoRE5bx0IWdnbqv-__gtn3ywY0U13zWnMPaArtuCxQ/gviz/tq?tqx=out:json";

// Data Storage
let combinedData = [];
let filteredData = [];
let currentSupplier = "";

let teslimatiBeklenenData = [];
let kullanimiDevamEdenData = [];
let kullanimiBitenData = [];

// DOM Elements
const supplierNameDisplay = document.getElementById("supplierNameDisplay");
const logoutBtn = document.getElementById("logoutBtn");
const exportCsvBtn = document.getElementById("exportCsvBtn");

document.addEventListener("DOMContentLoaded", () => {
    currentSupplier = sessionStorage.getItem("crosslink_supplier");
    if (!currentSupplier) {
        window.location.href = "index.html";
        return;
    }
    supplierNameDisplay.textContent = currentSupplier;
    setupSidebarNavigation();
    initDashboard();
});

function setupSidebarNavigation() {
    const tabs = {
        'menu-home': 'home-section',
        'menu-teslimati-beklenen': 'teslimati-beklenen-section',
        'menu-kullanimi-devam-eden': 'kullanimi-devam-eden-section',
        'menu-kullanimi-biten': 'kullanimi-biten-section',
        'menu-raporlama': 'raporlama-section'
    };

    const navItems = document.querySelectorAll('.op-nav-item, .op-sub-item');
    const sections = document.querySelectorAll('.section-container');

    const menuIkame = document.getElementById('menu-ikame');
    const submenuIkame = document.getElementById('submenu-ikame');

    if (menuIkame && submenuIkame) {
        menuIkame.addEventListener('click', () => {
            submenuIkame.classList.toggle('hidden');
            menuIkame.classList.toggle('expanded');
        });
    }

    navItems.forEach(item => {
        if (item.id === 'menu-ikame') return; 
        item.addEventListener('click', (e) => {
            e.preventDefault();
            navItems.forEach(n => n.classList.remove('active'));
            item.classList.add('active');

            sections.forEach(sec => sec.classList.add('hidden'));

            if (tabs[item.id]) {
                const target = document.getElementById(tabs[item.id]);
                if (target) {
                    target.classList.remove('hidden');
                    if (item.id === 'menu-raporlama') { 
                        if (typeof drawCharts === 'function' && window.google && google.visualization) {
                            setTimeout(drawCharts, 50);
                        }
                    }
                }
            }
        });
    });

    if (logoutBtn) {
        logoutBtn.addEventListener("click", () => {
            sessionStorage.removeItem("crosslink_supplier");
            window.location.href = "index.html";
        });
    }
}

// Utility for super robust Turkish text matching
function toLowerTr(str) {
    if (!str) return "";
    return str.replace(/İ/g, 'i').replace(/I/g, 'ı').toLowerCase();
}

function normalizeForSearch(str) {
    if (!str) return "";
    return toLowerTr(str).replace(/[^a-z0-9ğüşıöç]/g, ""); // Strips ALL spaces, dashes, punctuation
}

const TURKEY_REGIONS = {
    "Marmara": ["Edirne", "Kırklareli", "Tekirdağ", "İstanbul", "Kocaeli", "Yalova", "Sakarya", "Bilecik", "Bursa", "Balıkesir", "Çanakkale"],
    "Ege": ["İzmir", "Manisa", "Aydın", "Denizli", "Muğla", "Afyonkarahisar", "Kütahya", "Uşak"],
    "Akdeniz": ["Antalya", "Isparta", "Burdur", "Mersin", "Adana", "Hatay", "Osmaniye", "Kahramanmaraş"],
    "İç Anadolu": ["Ankara", "Konya", "Kayseri", "Eskişehir", "Sivas", "Kırıkkale", "Aksaray", "Karaman", "Kırşehir", "Niğde", "Nevşehir", "Yozgat", "Çankırı"],
    "Karadeniz": ["Bolu", "Düzce", "Zonguldak", "Karabük", "Bartın", "Kastamonu", "Çorum", "Sinop", "Samsun", "Amasya", "Tokat", "Ordu", "Giresun", "Gümüşhane", "Trabzon", "Bayburt", "Rize", "Artvin"],
    "Doğu Anadolu": ["Erzurum", "Erzincan", "Kars", "Ardahan", "Ağrı", "Iğdır", "Van", "Muş", "Bitlis", "Bingöl", "Tunceli", "Elazığ", "Malatya", "Hakkari", "Şırnak"],
    "Güneydoğu Anadolu": ["Gaziantep", "Kilis", "Adıyaman", "Şanlıurfa", "Diyarbakır", "Mardin", "Batman", "Siirt"]
};

function getRegionForProvince(province) {
    for (const [region, provinces] of Object.entries(TURKEY_REGIONS)) {
        if (provinces.includes(province)) return region;
    }
    return "Bilinmeyen Bölge";
}

async function initDashboard() {
    console.log("initDashboard Started - JSONP Global Callback Version");
    try {
        // Load Google Charts library
        google.charts.load('current', {
            'packages': ['corechart', 'geochart']
        });
        console.log("Fetching Google Sheets via JSONP Simultaneously...");
        // Fetch simultaneously using unique callbacks
        const [deliveredJson, pendingJson] = await Promise.all([
            fetchJSONP(DELIVERED_JSONP_URL),
            fetchJSONP(PENDING_JSONP_URL)
        ]);

        console.log("JSONP Data Fetched successfully.");

        // Parse and combine using the Google Viz parser
        // Parse and combine using the Google Viz parser
        const deliveredRows = parseGvizJSON(deliveredJson, "Teslim Edildi");
        let pendingRowsRaw = parseGvizJSON(pendingJson, "Teslim Edilmedi");

        // Cross-Link LocalStorage Injection - Only fetch files Explicitly Assigned to Current Supplier
        const assignments = JSON.parse(localStorage.getItem('crosslink_assignments') || "{}");
        const pendingRows = [];

        pendingRowsRaw.forEach(row => {
             const dosyaNo = row['Dosya No'];
             const assignData = assignments[dosyaNo];
             if (assignData) {
                 const suppNorm = normalizeForSearch(assignData.supplier);
                 const currentNorm = normalizeForSearch(currentSupplier);
                 
                 if (suppNorm === currentNorm || suppNorm.includes(currentNorm) || currentNorm.includes(suppNorm)) {
                     // Force explicit 'Tedarikçi' header onto the schema to ensure the downstream generalized filter passes
                     row['Tedarikçi'] = assignData.supplier;
                     pendingRows.push(row);
                 }
             }
        });

        console.log("Delivered Rows parsed: " + deliveredRows.length + ", Pending (Assigned): " + pendingRows.length);

        // Combine all rows
        let allData = [...deliveredRows, ...pendingRows];

        // Demo Modu Overrides: Check localStorage for status overrides
        allData.forEach(row => {
            const dosyaNo = row['Dosya No'];
            const localStatus = localStorage.getItem("crosslink_status_" + dosyaNo);
            if (localStatus === "Teslim Edildi") {
                row['Teslimat Durumu'] = "Teslim Edildi";
            }
        });

        console.log("Total Combined Rows: " + allData.length);

        // Filter MUST immediately restrict to only the current supplier's data
        const supplierNorm = normalizeForSearch(currentSupplier);
        console.log("Current Supplier: " + currentSupplier + ", Normalized: " + supplierNorm);

        combinedData = allData.filter(row => {
            const tedarikciKey = Object.keys(row).find(k => toLowerTr(k).includes("tedarik"));
            const rawRowSupplier = tedarikciKey ? (row[tedarikciKey] || "") : "";
            const rowSupplierNorm = normalizeForSearch(rawRowSupplier);
            if (!rowSupplierNorm) return false;
            return rowSupplierNorm === supplierNorm || rowSupplierNorm.includes(supplierNorm) || supplierNorm.includes(rowSupplierNorm);
        });

        combinedData.sort((a, b) => parseDateString(b['Dosya Açılış Tarihi']) - parseDateString(a['Dosya Açılış Tarihi']));
        filteredData = [...combinedData];
        // openSupplierModal tarafından kullanılan global referans
        window.HIZMET_DATA = combinedData;

        teslimatiBeklenenData = [];
        kullanimiDevamEdenData = [];
        kullanimiBitenData = [];

        combinedData.forEach(row => {
            const dNo = row['Dosya No'];
            const localStatus = localStorage.getItem("crosslink_status_" + dNo);
            const isCompletedList = row['Teslimat Durumu'] === 'Teslim Edildi';

            const isDelivered = (localStatus === "Teslim Edildi") || isCompletedList;

            const teslimatDateVal = localStorage.getItem('crosslink_teslimat_date_' + dNo) || row['Teslimat Tarihi'];
            const isTeslimatMaked = (teslimatDateVal && teslimatDateVal !== "-");

            const iadeDateVal = localStorage.getItem('crosslink_iade_date_' + dNo) || row['İade Tarihi'];
            const isIadeMaked = (iadeDateVal && iadeDateVal !== "-");

            if (isDelivered || isIadeMaked) {
                kullanimiBitenData.push(row);
            } else if (isTeslimatMaked) {
                kullanimiDevamEdenData.push(row);
            } else {
                teslimatiBeklenenData.push(row);
            }
        });

        // Use setTimeout to ensure DOM is ready
        setTimeout(() => {
            renderTab1(teslimatiBeklenenData);
            renderTab2(kullanimiDevamEdenData);
            renderTab3(kullanimiBitenData);
            
            if (typeof populateDropdowns === 'function') populateDropdowns();
            if (typeof updateStatistics === 'function') updateStatistics();
            if (typeof setupEventListeners === 'function') setupEventListeners();
        }, 50);

    } catch (error) {
        console.error("Error in initDashboard:", error);
    }
}

// JSONP Fetcher to bypass browser CORS rules on file:///
function fetchJSONP(baseUrl) {
    return new Promise((resolve, reject) => {
        // Create a unique global callback name for this specific request
        const callbackName = 'gvizCallback_' + Math.round(1000000 * Math.random()) + '_' + Date.now();

        let script;
        // Define the global callback
        window[callbackName] = function (data) {
            delete window[callbackName]; // Cleanup
            if (script && script.parentNode) document.head.removeChild(script); // Cleanup
            resolve(data);
        };

        script = document.createElement('script');
        // Tell Google Visualization API to wrap the JSON in our unique callback
        // The API requires the responseHandler inside the tqx parameter
        // baseUrl already has `tqx=out:json`, so we append our responseHandler
        const finalUrl = baseUrl + ';' + 'responseHandler:' + callbackName;
        script.src = finalUrl;

        script.onerror = function () {
            delete window[callbackName];
            if (script && script.parentNode) document.head.removeChild(script);
            reject(new Error("Veri kaynağına (Google Sheets) ulaşılamadı."));
        };

        document.head.appendChild(script);
    });
}

// Parser for Google's JSON structure
function parseGvizJSON(jsonData, status) {
    if (!jsonData || !jsonData.table || !jsonData.table.cols || !jsonData.table.rows) return [];

    // Extract Headers
    const headers = jsonData.table.cols.map(col => col.label || col.id);
    const data = [];

    // Extract Rows
    jsonData.table.rows.forEach(row => {
        let rowObj = {};
        let hasData = false;

        headers.forEach((header, index) => {
            const cell = row.c[index];
            const val = cell ? (cell.f || cell.v || "") : "";
            rowObj[header] = String(val).trim();
            if (rowObj[header] && rowObj[header] !== "null") hasData = true;
        });

        // Only push if row isn't completely empty
        if (hasData) {
            rowObj['Teslimat Durumu'] = status;
            data.push(rowObj);
        }
    });

    return data;
}

// Convert "DD.MM.YYYY HH:MM:SS" strictly to a Date object for sorting
function parseDateString(dateStr) {
    if (!dateStr) return 0;

    // Format: "01.01.2026 10:13:58"
    const parts = dateStr.split(' ');
    if (parts.length !== 2) return 0;

    const dateParts = parts[0].split('.'); // [DD, MM, YYYY]
    const timeParts = parts[1].split(':'); // [HH, MM, SS]

    if (dateParts.length === 3 && timeParts.length >= 2) {
        // new Date(YYYY, MM (0-11), DD, HH, MM, SS)
        return new Date(
            parseInt(dateParts[2]),
            parseInt(dateParts[1]) - 1,
            parseInt(dateParts[0]),
            parseInt(timeParts[0]),
            parseInt(timeParts[1]),
            timeParts[2] ? parseInt(timeParts[2]) : 0
        ).getTime();
    }
    return 0;
}

function populateDropdowns() {
    const uniqueYears = new Set();
    const uniqueProvinces = new Set();
    const uniqueCustomers = new Set();

    const TR_MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağtos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

    combinedData.forEach(row => {
        if (row['Dosya Açılış Tarihi']) {
            const parts = row['Dosya Açılış Tarihi'].split(' ')[0].split('.');
            if (parts.length === 3) uniqueYears.add(parts[2]);
        }
        // Find İl key robustly
        const ilKey = Object.keys(row).find(k => k === 'İl' || k === 'Il' || k.toLowerCase() === 'il') || 'İl';
        if (row[ilKey]) uniqueProvinces.add(row[ilKey]);
        // Find Müşteri key robustly
        const musteriKey = Object.keys(row).find(k => k === 'Müşteri' || k.toLowerCase().includes('teri')) || 'Müşteri';
        if (row[musteriKey]) uniqueCustomers.add(row[musteriKey]);
    });

    // Raporlama dropdowns
    const sortedYears = Array.from(uniqueYears).sort((a, b) => parseInt(b) - parseInt(a));
    if (filterYil) {
        filterYil.innerHTML = '<option value="">Tüm Yıllar</option>';
        sortedYears.forEach(yyyy => {
            const opt = document.createElement('option');
            opt.value = yyyy; opt.textContent = yyyy;
            filterYil.appendChild(opt);
        });
    }
    if (filterDosyaTarihi) {
        filterDosyaTarihi.innerHTML = '<option value="">Tüm Aylar</option>';
        for (let mm = 1; mm <= 12; mm++) {
            const mmStr = String(mm).padStart(2, '0');
            const option = document.createElement('option');
            option.value = mmStr; option.textContent = TR_MONTHS[mm - 1];
            filterDosyaTarihi.appendChild(option);
        }
    }
    if (filterIl) {
        filterIl.innerHTML = '<option value="">Tümü</option>';
        Array.from(uniqueProvinces).sort((a, b) => a.localeCompare(b, 'tr')).forEach(il => {
            const opt = document.createElement('option'); opt.value = il; opt.textContent = il;
            filterIl.appendChild(opt);
        });
    }
    if (filterMusteri) {
        filterMusteri.innerHTML = '<option value="">Tümü</option>';
        Array.from(uniqueCustomers).sort((a, b) => a.localeCompare(b, 'tr')).forEach(m => {
            const opt = document.createElement('option'); opt.value = m; opt.textContent = m;
            filterMusteri.appendChild(opt);
        });
    }

    // Tab 1/2/3 dropdowns - her sekmenin kendi verisiyle
    populateTabDropdowns(1, teslimatiBeklenenData);
    populateTabDropdowns(2, kullanimiDevamEdenData);
    populateTabDropdowns(3, kullanimiBitenData);
}

function populateTabDropdowns(tabNo, data) {
    const fillSelect = (id, values) => {
        const el = document.getElementById(id);
        if (!el) return;
        const currentVal = el.value;
        el.innerHTML = '<option value="">Tümü</option>';
        Array.from(values).sort((a, b) => String(a).localeCompare(String(b), 'tr')).forEach(val => {
            const opt = document.createElement('option');
            opt.value = val; opt.textContent = val;
            if (val === currentVal) opt.selected = true;
            el.appendChild(opt);
        });
    };

    const musteriSet = new Set();
    const ilSet = new Set();
    const teminatSet = new Set();
    const segmentSet = new Set();

    data.forEach(row => {
        // Müşteri - key'i dinamik bul
        const mk = Object.keys(row).find(k => k === 'Müşteri' || (k.toLowerCase().includes('m') && k.toLowerCase().includes('teri'))) || 'Müşteri';
        if (row[mk]) musteriSet.add(row[mk]);
        // İl - key'i dinamik bul
        const ik = Object.keys(row).find(k => k === 'İl' || k === 'Il') || 'İl';
        if (row[ik]) ilSet.add(row[ik]);
        // Teminat
        if (row['Teminat']) teminatSet.add(row['Teminat']);
        // Segment
        const seg = localStorage.getItem('crosslink_segment_' + row['Dosya No']) || row['Segment'] || row['İkame Araç Segmenti'] || row['Talep Edilen Araç Segmenti'];
        if (seg) segmentSet.add(seg);
    });

    fillSelect('filter' + tabNo + '-musteri', musteriSet);
    fillSelect('filter' + tabNo + '-il', ilSet);
    fillSelect('filter' + tabNo + '-teminat', teminatSet);
    if (tabNo !== 1) fillSelect('filter' + tabNo + '-segment', segmentSet);
}



function renderTab1(data) {
    const badge = document.getElementById("badge-teslimati");
    if (badge) {
        badge.textContent = data.length;
        badge.classList.remove("hidden");
        badge.style.background = data.length > 0 ? '#F59E0B' : '#9CA3AF';
    }

    const tbody = document.getElementById("tbody1");
    if(!tbody) return;
    tbody.innerHTML = "";
    if (data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="11" style="text-align:center; padding:24px; color:var(--text-muted);">Teslimatı beklenen hizmet bulunamadı.</td></tr>`;
        return;
    }
    data.forEach(r => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${getSlaHtml(r['Dosya Açılış Tarihi'])}</td>
            <td>${r['Hizmet No'] || '-'}</td>
            <td>${r['Dosya No'] || '-'}</td>
            <td>${r['Müşteri'] || '-'}</td>
            <td>${r['Poliçe No'] || '-'}</td>
            <td>${r['İsim'] || '-'}</td>
            <td>${r['Soyisim'] || '-'}</td>
            <td>${r['İl'] || '-'}</td>
            <td>${r['Teminat'] || '-'}</td>
            <td>${r['Talep Edilen Araç Segmenti'] || '-'}</td>
            <td>
                <button onclick="openSupplierModal('${r['Dosya No']}')" class="row-action-btn" style="background-color:#E0E7FF; color:#4338CA; border:1px solid #C7D2FE; display:inline-block; padding:6px 12px; border-radius:6px; font-weight:600; font-size:0.85rem; text-decoration:none; cursor:pointer;">
                    İncele
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function renderTab2(data) {
    const badge = document.getElementById("badge-devam");
    if (badge) {
        badge.textContent = data.length;
        badge.classList.remove("hidden");
        badge.style.background = data.length > 0 ? '#3B82F6' : '#9CA3AF';
    }

    const tbody = document.getElementById("tbody2");
    if(!tbody) return;
    tbody.innerHTML = "";
    if (data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:24px; color:var(--text-muted);">Kullanımı devam eden hizmet bulunamadı.</td></tr>`;
        return;
    }
    data.forEach(r => {
        const tr = document.createElement("tr");
        
        // 27 Hours Logic Calculation Math
        let acikGun = 0;
        const teslimatStr = localStorage.getItem('crosslink_teslimat_date_' + r['Dosya No']) || r['Teslimat Tarihi'];
        const acilisMs = parseDateString(r['Dosya Açılış Tarihi']);
        const teslimMs = parseDateString(teslimatStr);
        let now = new Date().getTime();
        
        let diffDays = 1;
        if (teslimMs && now > teslimMs) {
            let msDiff = now - teslimMs;
            let hrs = msDiff / (1000 * 60 * 60);
            if (hrs <= 27) {
                diffDays = 1;
            } else {
                diffDays = Math.ceil((hrs - 3) / 24);
            }
        }
        
        const localSeg = localStorage.getItem('crosslink_segment_' + r['Dosya No']) || r['Segment'];

        tr.innerHTML = `
            <td>${r['Hizmet No'] || '-'}</td>
            <td>${r['Dosya No'] || '-'}</td>
            <td>${r['Müşteri'] || '-'}</td>
            <td>${teslimatStr || '-'}</td>
            <td>${diffDays} Gün</td>
            <td>${r['Teminat'] || '-'}</td>
            <td>${localSeg || '-'}</td>
            <td>
                <button onclick="openSupplierModal('${r['Dosya No']}')" class="row-action-btn" style="background-color:#FFFBEB; color:#D97706; border:1px solid #FDE68A; display:inline-block; padding:6px 12px; border-radius:6px; font-weight:600; font-size:0.85rem; text-decoration:none; cursor:pointer;">
                    İncele
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function renderTab3(data) {
    const badge = document.getElementById("badge-biten");
    if (badge) {
        badge.textContent = data.length;
        badge.classList.remove("hidden");
        badge.style.background = data.length > 0 ? '#10B981' : '#9CA3AF';
    }

    const tbody = document.getElementById("tbody3");
    if(!tbody) return;
    tbody.innerHTML = "";
    if (data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding:24px; color:var(--text-muted);">Kullanımı biten hizmet bulunamadı.</td></tr>`;
        return;
    }
    data.forEach(r => {
        const tr = document.createElement("tr");

        // Calculate Gün logic similar to Tab2
        const teslimatStr = localStorage.getItem('crosslink_teslimat_date_' + r['Dosya No']) || r['Teslimat Tarihi'];
        const iadeStr = localStorage.getItem('crosslink_iade_date_' + r['Dosya No']) || r['İade Tarihi'];
        const teslimMs = parseDateString(teslimatStr);
        let nowOrReturn = new Date().getTime();
        
        if (iadeStr && iadeStr !== "-") {
            let iadeMs = parseDateString(iadeStr);
            if(iadeMs) nowOrReturn = iadeMs;
        }

        let diffDays = 1;
        if (teslimMs && nowOrReturn > teslimMs) {
            let msDiff = nowOrReturn - teslimMs;
            let hrs = msDiff / (1000 * 60 * 60);
            if (hrs <= 27) {
                diffDays = 1;
            } else {
                diffDays = Math.ceil((hrs - 3) / 24);
            }
        }

        const localSeg = localStorage.getItem('crosslink_segment_' + r['Dosya No']) || r['Segment'];

        tr.innerHTML = `
            <td>${r['Hizmet No'] || '-'}</td>
            <td>${r['Dosya No'] || '-'}</td>
            <td>${r['Dosya Açılış Tarihi'] || '-'}</td>
            <td>${r['Müşteri'] || '-'}</td>
            <td>${r['İl'] || '-'}</td>
            <td>${r['Teminat'] || '-'}</td>
            <td><span style="font-weight:600; color:#4B5563;">${localSeg || '-'}</span></td>
            <td>${diffDays} Gün</td>
            <td>
                <button onclick="openSupplierModal('${r['Dosya No']}')" class="row-action-btn" style="background-color:#F8FAF0; color:#4B5563; border:1px solid #D1D5DB; display:inline-block; padding:6px 12px; border-radius:6px; font-weight:600; font-size:0.85rem; text-decoration:none; cursor:pointer;">
                    İncele
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function getSlaHtml(dosyaAcilisTarihiStr) {
    if (!dosyaAcilisTarihiStr || dosyaAcilisTarihiStr === "-") return '<span style="color:#9CA3AF;">-</span>';
    const acilisDate = parseTurkishDate(dosyaAcilisTarihiStr);
    if (!acilisDate) return '<span style="color:#9CA3AF;">-</span>';
    
    const now = new Date().getTime();
    const diffMs = now - acilisDate;
    
    if (diffMs < 0) return '<span style="color:#9CA3AF;">-</span>';
    
    const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    return `<div style="display:flex; align-items:center; gap:6px; font-weight:600; color:#dc2626; font-size:0.80rem;">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                <span>${diffHrs} Saat ${diffMins} Dakika</span>
            </div>`;
}

function parseTurkishDate(dateStr) {
    if (!dateStr || dateStr === "-" || dateStr.trim() === "") return null;
    const parts = dateStr.trim().split(' ');
    if (parts.length !== 2) return null;
    const dParts = parts[0].split('.');
    const tParts = parts[1].split(':');
    if (dParts.length !== 3 || tParts.length < 2) return null;
    return new Date(dParts[2], dParts[1] - 1, dParts[0], tParts[0], tParts[1]);
}

function updateStatistics() {
    let deliveredCount = 0;
    let pendingCount = 0;
    let totalMs = 0;
    let validPerformanceCount = 0;

    filteredData.forEach(row => {
        if (row['Teslimat Durumu'] === 'Teslim Edildi') deliveredCount++;
        else if (row['Teslimat Durumu'] === 'Teslim Edilmedi') pendingCount++;

        // Teslimat Performansı calculation
        let teslimatDateStr = localStorage.getItem("crosslink_teslimat_date_" + row['Dosya No']) || row['Teslimat Tarihi'];
        if (teslimatDateStr && teslimatDateStr !== "-") {
            let acilisDate = parseTurkishDate(row['Dosya Açılış Tarihi']);
            let teslimatDate = parseTurkishDate(teslimatDateStr);
            if (acilisDate && teslimatDate && teslimatDate >= acilisDate) {
                totalMs += (teslimatDate - acilisDate);
                validPerformanceCount++;
            }
        }
    });

    document.getElementById('statTotal').textContent = filteredData.length;
    document.getElementById('statDelivered').textContent = deliveredCount;
    document.getElementById('statPending').textContent = pendingCount;

    // --- Yeni Metrikler ---
    let totalIkameGun = 0;
    let ikameGunCount = 0;
    let slaIn = 0;  // teslim edildi ve ikame < 24 saat
    const segmentCounts = {};
    const segmentDays = {};

    filteredData.forEach(row => {
        const isDelivered = row['Teslimat Durumu'] === 'Teslim Edildi';

        // Teslimat tarihi: demo localStorage önce, sonra excel
        const teslimatStr = localStorage.getItem('crosslink_teslimat_date_' + row['Dosya No']) || row['Teslimat Tarihi'];
        const iadeStr = localStorage.getItem('crosslink_iade_date_' + row['Dosya No']) || row['\u0130ade Tarihi'];

        if (isDelivered && teslimatStr && iadeStr) {
            const tDate = parseTurkishDate(teslimatStr);
            const iDate = parseTurkishDate(iadeStr);
            if (tDate && iDate && iDate >= tDate) {
                const diffDays = Math.floor((iDate - tDate) / (1000 * 60 * 60 * 24));
                totalIkameGun += diffDays;
                ikameGunCount++;

                // SLA check: ikame < 24 saat mi? (teslimat süresi = açılış → teslimat)
                const acilisDate = parseTurkishDate(row['Dosya Açılış Tarihi']);
                if (acilisDate && tDate >= acilisDate) {
                    const deliveryHrs = (tDate - acilisDate) / (1000 * 60 * 60);
                    if (deliveryHrs <= 24) slaIn++;
                }

                // Track days per segment
                const seg = localStorage.getItem('crosslink_segment_' + row['Dosya No']) || row['\u0130kame Ara\u00e7 Segmenti'] || row['Segment'];
                if (seg && seg !== '-' && seg.trim() !== '') {
                    segmentDays[seg] = (segmentDays[seg] || 0) + diffDays;
                }
            }
        }

        // Segment count (all rows)
        const seg = localStorage.getItem('crosslink_segment_' + row['Dosya No']) || row['\u0130kame Ara\u00e7 Segmenti'] || row['Segment'];
        if (seg && seg !== '-' && seg.trim() !== '') {
            segmentCounts[seg] = (segmentCounts[seg] || 0) + 1;
        }
    });

    // Total ikame
    document.getElementById('statTotalIkameGun').textContent = totalIkameGun.toLocaleString('tr-TR') + ' G\u00fcn';

    // Per-file ikame
    const avgIkame = ikameGunCount > 0 ? (totalIkameGun / ikameGunCount).toFixed(1) : '0';
    document.getElementById('statAvgIkameGun').textContent = avgIkame + ' G\u00fcn';

    // SLA rate (sadece teslim edildi dosyalar)
    const slaElem = document.getElementById('statSlaRate');
    if (deliveredCount > 0) {
        const slaRate = ((slaIn / deliveredCount) * 100).toFixed(0);
        slaElem.textContent = slaRate + '%';
        slaElem.style.color = parseInt(slaRate) >= 70 ? '#16a34a' : '#dc2626';
    } else {
        slaElem.textContent = '-%';
    }

    // Top segment
    const segEntries = Object.entries(segmentCounts).sort((a, b) => b[1] - a[1]);
    const topSegElem = document.getElementById('statTopSegment');
    const topSegSub = document.getElementById('statTopSegmentSub');
    if (segEntries.length > 0) {
        const [topSeg, topCount] = segEntries[0];
        const totalWithSeg = Object.values(segmentCounts).reduce((a, b) => a + b, 0);
        topSegElem.textContent = topSeg + ' Segment';
        topSegSub.textContent = topCount + ' adet (' + ((topCount / totalWithSeg) * 100).toFixed(0) + '%)';
    }

    // Segment table — Oran based on total DAYS not count
    const segTbody = document.getElementById('segmentTableBody');
    if (segTbody) {
        segTbody.innerHTML = '';
        const totalDays = Object.values(segmentDays).reduce((a, b) => a + b, 0);
        segEntries.forEach(([seg, cnt]) => {
            const days = segmentDays[seg] || 0;
            const pct = totalDays > 0 ? ((days / totalDays) * 100).toFixed(0) : 0;
            segTbody.innerHTML += `<tr style="border-bottom:1px solid var(--border-color);">
                <td style="padding:8px;font-weight:600;">${seg}</td>
                <td style="padding:8px;text-align:right;color:var(--primary-color);font-weight:700;">${cnt}</td>
                <td style="padding:8px;text-align:right;color:var(--primary-color);font-weight:700;">${days}</td>
                <td style="padding:8px;text-align:right;color:#888;">${pct}%</td>
            </tr>`;
        });
        if (segEntries.length === 0) {
            segTbody.innerHTML = '<tr><td colspan="4" style="padding:12px;text-align:center;color:#999;">Veri yok</td></tr>';
        }
    }

    let perfDisplay = "00:00:00";
    if (validPerformanceCount > 0) {
        let avgMs = totalMs / validPerformanceCount;
        let totalSeconds = Math.floor(avgMs / 1000);
        let hours = Math.floor(totalSeconds / 3600);
        let minutes = Math.floor((totalSeconds % 3600) / 60);
        let seconds = totalSeconds % 60;
        perfDisplay = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
    const statPerfElem = document.getElementById('statPerformance');
    if (statPerfElem) statPerfElem.textContent = perfDisplay;

    // Draw charts if Google Charts is loaded
    if (google && google.visualization && google.visualization.DataTable) {
        drawCharts();
    } else {
        google.charts.setOnLoadCallback(drawCharts);
    }
}

function drawCharts() {
    if (filteredData.length === 0) {
        document.getElementById('regions_div').innerHTML = "<p style='text-align:center; color:#999; margin-top:50px;'>Veri Yok</p>";
        document.getElementById('monthly_chart_div').innerHTML = "<p style='text-align:center; color:#999; margin-top:50px;'>Veri Yok</p>";
        document.getElementById('customer_pie_div').innerHTML = "<p style='text-align:center; color:#999; margin-top:50px;'>Veri Yok</p>";
        return;
    }

    // --- 1. Map Chart Data ---
    const provinceCounts = {};
    filteredData.forEach(row => {
        const il = row['İl'];
        if (il) provinceCounts[il] = (provinceCounts[il] || 0) + 1;
    });

    const mapDataArr = [['İl', 'Dosya Sayısı']];
    for (const [il, count] of Object.entries(provinceCounts)) {
        mapDataArr.push([il, count]);
    }
    const mapData = google.visualization.arrayToDataTable(mapDataArr);
    const mapOptions = {
        region: 'TR',
        displayMode: 'regions',
        resolution: 'provinces',
        colorAxis: { colors: ['#ffc8a3', '#F88C42', '#d6681c'] },
        backgroundColor: 'transparent',
        datalessRegionColor: '#f5f5f5',
        defaultColor: '#f5f5f5',
        legend: 'none', // Remove the 1-2 legend bar at the bottom left
        // Make map use maximum space and center
        keepAspectRatio: true,
        width: '100%',
    };
    const mapChart = new google.visualization.GeoChart(document.getElementById('regions_div'));
    mapChart.draw(mapData, mapOptions);

    // --- 1.B Table Population (Provinces & Regions) ---
    const regionCounts = {};
    const sortedProvinces = Object.entries(provinceCounts).sort((a, b) => b[1] - a[1]); // Sort by count descending

    const provTbody = document.getElementById('provinceTableBody');
    provTbody.innerHTML = '';

    sortedProvinces.forEach(([il, count]) => {
        const region = getRegionForProvince(il);
        regionCounts[region] = (regionCounts[region] || 0) + count;

        provTbody.innerHTML += `
            <tr style="border-bottom: 1px solid var(--border-color); background: white;">
                <td style="padding: 8px;">${il}</td>
                <td style="padding: 8px; text-align: right; font-weight: 600; color: var(--primary-color);">${count}</td>
            </tr>
        `;
    });

    const sortedRegions = Object.entries(regionCounts).sort((a, b) => b[1] - a[1]);
    const regTbody = document.getElementById('regionTableBody');
    regTbody.innerHTML = '';

    sortedRegions.forEach(([region, count]) => {
        regTbody.innerHTML += `
             <tr style="border-bottom: 1px solid var(--border-color); background: white;">
                <td style="padding: 8px;">${region}</td>
                <td style="padding: 8px; text-align: right; font-weight: 600; color: var(--primary-color);">${count}</td>
            </tr>
        `;
    });



    // --- 3. Customer Pie Chart Data ---
    const customerCounts = {};
    filteredData.forEach(row => {
        const musteri = row['Müşteri'];
        if (musteri) customerCounts[musteri] = (customerCounts[musteri] || 0) + 1;
    });

    const pieDataArr = [['Müşteri', 'Dosya Sayısı']];
    for (const [musteri, count] of Object.entries(customerCounts)) {
        pieDataArr.push([musteri, count]);
    }
    const pieData = google.visualization.arrayToDataTable(pieDataArr);
    const pieOptions = {
        pieHole: 0.4,
        backgroundColor: 'transparent',
        legend: { position: 'labeled', textStyle: { fontSize: 13, bold: true, color: '#333' } },
        pieSliceText: 'percentage',
        tooltip: { text: 'percentage' },
        colors: ['#F88C42', '#FBBF24', '#34D399', '#60A5FA', '#A78BFA', '#F472B6', '#E879F9', '#38BDF8', '#818CF8', '#FB7185', '#FDE047', '#BEF264', '#6EE7B7', '#BAE6FD', '#C4B5FD', '#FBCFE8'],
        chartArea: { left: 40, right: 40, top: 40, bottom: 40, width: '70%', height: '70%' }
    };
    const pieChart = new google.visualization.PieChart(document.getElementById('customer_pie_div'));
    pieChart.draw(pieData, pieOptions);
}

function applyFilters() {
    // Tab 1 Filters (Teslimatı Beklenen)
    const f1Hizmet = toLowerTr(document.getElementById('filter1-hizmet')?.value || "");
    const f1Dosya = toLowerTr(document.getElementById('filter1-dosya')?.value || "");
    const f1Police = toLowerTr(document.getElementById('filter1-police')?.value || "");
    const f1Isim = toLowerTr(document.getElementById('filter1-isim')?.value || "");
    const f1Soyisim = toLowerTr(document.getElementById('filter1-soyisim')?.value || "");
    const f1Musteri = document.getElementById('filter1-musteri')?.value || "";
    const f1Il = document.getElementById('filter1-il')?.value || "";
    const f1Teminat = document.getElementById('filter1-teminat')?.value || "";

    const filteredTab1 = teslimatiBeklenenData.filter(row => {
        if (f1Hizmet && !toLowerTr(row['Hizmet No']).includes(f1Hizmet)) return false;
        if (f1Dosya && !toLowerTr(row['Dosya No']).includes(f1Dosya)) return false;
        if (f1Police && !toLowerTr(row['Poliçe No']).includes(f1Police)) return false;
        if (f1Isim && !toLowerTr(row['İsim']).includes(f1Isim)) return false;
        if (f1Soyisim && !toLowerTr(row['Soyisim']).includes(f1Soyisim)) return false;
        if (f1Musteri && row['Müşteri'] !== f1Musteri) return false;
        if (f1Il && row['İl'] !== f1Il) return false;
        if (f1Teminat && row['Teminat'] !== f1Teminat) return false;
        return true;
    });
    renderTab1(filteredTab1);

    // Tab 2 Filters (Kullanımı Devam Eden)
    const f2Hizmet = toLowerTr(document.getElementById('filter2-hizmet')?.value || "");
    const f2Dosya = toLowerTr(document.getElementById('filter2-dosya')?.value || "");
    const f2Police = toLowerTr(document.getElementById('filter2-police')?.value || "");
    const f2Isim = toLowerTr(document.getElementById('filter2-isim')?.value || "");
    const f2Soyisim = toLowerTr(document.getElementById('filter2-soyisim')?.value || "");
    const f2Musteri = document.getElementById('filter2-musteri')?.value || "";
    const f2Il = document.getElementById('filter2-il')?.value || "";
    const f2Teminat = document.getElementById('filter2-teminat')?.value || "";
    const f2Segment = document.getElementById('filter2-segment')?.value || "";

    const filteredTab2 = kullanimiDevamEdenData.filter(row => {
        if (f2Hizmet && !toLowerTr(row['Hizmet No']).includes(f2Hizmet)) return false;
        if (f2Dosya && !toLowerTr(row['Dosya No']).includes(f2Dosya)) return false;
        if (f2Police && !toLowerTr(row['Poliçe No']).includes(f2Police)) return false;
        if (f2Isim && !toLowerTr(row['İsim']).includes(f2Isim)) return false;
        if (f2Soyisim && !toLowerTr(row['Soyisim']).includes(f2Soyisim)) return false;
        if (f2Musteri && row['Müşteri'] !== f2Musteri) return false;
        if (f2Il && row['İl'] !== f2Il) return false;
        if (f2Teminat && row['Teminat'] !== f2Teminat) return false;
        const localSeg = localStorage.getItem('crosslink_segment_' + row['Dosya No']) || row['Segment'];
        if (f2Segment && localSeg !== f2Segment) return false;
        return true;
    });
    renderTab2(filteredTab2);

    // Tab 3 Filters (Kullanımı Biten)
    const f3Hizmet = toLowerTr(document.getElementById('filter3-hizmet')?.value || "");
    const f3Dosya = toLowerTr(document.getElementById('filter3-dosya')?.value || "");
    const f3Police = toLowerTr(document.getElementById('filter3-police')?.value || "");
    const f3Isim = toLowerTr(document.getElementById('filter3-isim')?.value || "");
    const f3Soyisim = toLowerTr(document.getElementById('filter3-soyisim')?.value || "");
    const f3Musteri = document.getElementById('filter3-musteri')?.value || "";
    const f3Il = document.getElementById('filter3-il')?.value || "";
    const f3Teminat = document.getElementById('filter3-teminat')?.value || "";
    const f3Segment = document.getElementById('filter3-segment')?.value || "";

    const filteredTab3 = kullanimiBitenData.filter(row => {
        if (f3Hizmet && !toLowerTr(row['Hizmet No']).includes(f3Hizmet)) return false;
        if (f3Dosya && !toLowerTr(row['Dosya No']).includes(f3Dosya)) return false;
        if (f3Police && !toLowerTr(row['Poliçe No']).includes(f3Police)) return false;
        if (f3Isim && !toLowerTr(row['İsim']).includes(f3Isim)) return false;
        if (f3Soyisim && !toLowerTr(row['Soyisim']).includes(f3Soyisim)) return false;
        if (f3Musteri && row['Müşteri'] !== f3Musteri) return false;
        if (f3Il && row['İl'] !== f3Il) return false;
        if (f3Teminat && row['Teminat'] !== f3Teminat) return false;
        const localSeg = localStorage.getItem('crosslink_segment_' + row['Dosya No']) || row['Segment'];
        if (f3Segment && localSeg !== f3Segment) return false;
        return true;
    });
    renderTab3(filteredTab3);
}
function setupEventListeners() {
    const filterInputs = document.querySelectorAll('.filter-input');
    filterInputs.forEach(input => {
        input.addEventListener('input', applyFilters);
        input.addEventListener('change', applyFilters);
    });

    const exportCsvBtn = document.getElementById("exportCsvBtn");
    if (exportCsvBtn) {
        exportCsvBtn.addEventListener("click", () => {
            if (kullanimiBitenData.length === 0 && kullanimiDevamEdenData.length === 0 && teslimatiBeklenenData.length === 0) {
                alert("Aktarilacak veri bulunamadi.");
                return;
            }
            if (typeof XLSX !== 'undefined') {
                const ws = XLSX.utils.json_to_sheet(combinedData);
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, "TedarikciRaporu");
                const today = new Date().toISOString().split('T')[0];
                XLSX.writeFile(wb, "CrossLink_Hizmetler_" + today + ".xlsx");
            } else {
                alert("Tablo aktarim kutuphanesi yuklenemedi.");
            }
        });
    }

    const btnSavePdf = document.getElementById('btnSavePdf');
    if (btnSavePdf) {
        btnSavePdf.addEventListener('click', exportSupplierPDF);
    }
}

function updateStatistics() {
    let deliveredCount = 0;
    let pendingCount = 0;
    let totalMs = 0;
    let validPerformanceCount = 0;

    filteredData.forEach(row => {
        if (row['Teslimat Durumu'] === 'Teslim Edildi') deliveredCount++;
        else if (row['Teslimat Durumu'] === 'Teslim Edilmedi') pendingCount++;

        let teslimatDateStr = localStorage.getItem("crosslink_teslimat_date_" + row['Dosya No']) || row['Teslimat Tarihi'];
        if (teslimatDateStr && teslimatDateStr !== "-") {
            let acilisDate = parseTurkishDate(row['Dosya Acilis Tarihi'] || row[Object.keys(row).find(k => k.includes('Acilis') || k.includes('A\u00e7\u0131l\u0131\u015f'))]);
            let teslimatDate = parseTurkishDate(teslimatDateStr);
            if (acilisDate && teslimatDate && teslimatDate >= acilisDate) {
                totalMs += (teslimatDate - acilisDate);
                validPerformanceCount++;
            }
        }
    });

    const statTotal = document.getElementById('statTotal');
    const statDelivered = document.getElementById('statDelivered');
    const statPending = document.getElementById('statPending');
    if (statTotal) statTotal.textContent = filteredData.length;
    if (statDelivered) statDelivered.textContent = deliveredCount;
    if (statPending) statPending.textContent = pendingCount;

    let perfDisplay = "00:00:00";
    if (validPerformanceCount > 0) {
        let avgMs = totalMs / validPerformanceCount;
        let totalSeconds = Math.floor(avgMs / 1000);
        let hours = Math.floor(totalSeconds / 3600);
        let minutes = Math.floor((totalSeconds % 3600) / 60);
        let seconds = totalSeconds % 60;
        perfDisplay = String(hours).padStart(2, '0') + ':' + String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');
    }
    const statPerfElem = document.getElementById('statPerformance');
    if (statPerfElem) statPerfElem.textContent = perfDisplay;

    if (typeof google !== 'undefined' && google.visualization && google.visualization.DataTable) {
        if (typeof drawCharts === 'function') drawCharts();
    }
}

function drawCharts() {
    if (typeof google === 'undefined' || !google.visualization) return;
    if (filteredData.length === 0) return;

    const provinceCounts = {};
    filteredData.forEach(row => {
        const il = row[Object.keys(row).find(k => k === '\u0130l' || k === 'Il' || k === 'il')] || row['\u0130l'];
        if (il) provinceCounts[il] = (provinceCounts[il] || 0) + 1;
    });

    const mapDataArr = [['\u0130l', 'Dosya Sayisi']];
    for (const [il, count] of Object.entries(provinceCounts)) {
        mapDataArr.push([il, count]);
    }
    try {
        const mapData = google.visualization.arrayToDataTable(mapDataArr);
        const mapOptions = { region: 'TR', displayMode: 'regions', resolution: 'provinces', colorAxis: { colors: ['#ffc8a3', '#F88C42', '#d6681c'] }, backgroundColor: 'transparent', datalessRegionColor: '#f5f5f5', legend: 'none' };
        const mapDiv = document.getElementById('regions_div');
        if (mapDiv) { const mapChart = new google.visualization.GeoChart(mapDiv); mapChart.draw(mapData, mapOptions); }
    } catch(e) { console.warn('Map chart error:', e); }

    const musteri_key = Object.keys(filteredData[0] || {}).find(k => k.includes('\u015c') || k.includes('M') && k.toLowerCase().includes('teri')) || 'M\u00fc\u015fteri';
    const customerCounts = {};
    filteredData.forEach(row => {
        const m = row[musteri_key] || row['Musteri'];
        if (m) customerCounts[m] = (customerCounts[m] || 0) + 1;
    });
    const pieDataArr = [['Musteri', 'Dosya Sayisi']];
    for (const [m, count] of Object.entries(customerCounts)) { pieDataArr.push([m, count]); }
    try {
        const pieData = google.visualization.arrayToDataTable(pieDataArr);
        const pieOptions = { pieHole: 0.4, backgroundColor: 'transparent', legend: { position: 'labeled' }, colors: ['#F88C42', '#FBBF24', '#34D399', '#60A5FA', '#A78BFA', '#F472B6'] };
        const pieDiv = document.getElementById('customer_pie_div');
        if (pieDiv) { const pieChart = new google.visualization.PieChart(pieDiv); pieChart.draw(pieData, pieOptions); }
    } catch(e) { console.warn('Pie chart error:', e); }
}

window.resetDemoStatus = function(dosyaNo) {
    const confirms = confirm("Bu dosyanin statusunu sifirlamak istiyor musunuz?");
    if (!confirms) return;
    ['status', 'teslimat', 'teslimat_date', 'iade_date', 'hakedis', 'marka', 'model', 'yil', 'plaka', 'km', 'drop_km', 'segment'].forEach(k => {
        localStorage.removeItem("crosslink_" + k + "_" + dosyaNo);
    });
    window.location.reload();
};

function getSlaMs(row) {
    const k = Object.keys(row).find(k => k.includes('A\u00e7\u0131l\u0131\u015f') || k.includes('Acilis'));
    const acilisDate = k ? parseTurkishDate(row[k]) : null;
    if (!acilisDate) return -1;
    if (row['Teslimat Durumu'] === 'Teslim Edildi') {
        const teslimatStr = localStorage.getItem('crosslink_teslimat_date_' + row['Dosya No']) || row['Teslimat Tarihi'];
        const teslimatDate = parseTurkishDate(teslimatStr);
        if (teslimatDate && teslimatDate >= acilisDate) return teslimatDate - acilisDate;
        return -1;
    }
    return new Date().getTime() - acilisDate;
}

function exportSupplierPDF() {
    const btn = document.getElementById('btnSavePdf');
    if (btn) { btn.textContent = 'Hazirlaniyor...'; btn.disabled = true; }
    const contentEl = document.querySelector('main.dashboard-main') || document.body;
    if (typeof html2canvas === 'undefined') { if (btn) { btn.textContent = 'PDF Kaydet'; btn.disabled = false; } alert('html2canvas kutuphanesi yuklenemedi.'); return; }
    html2canvas(contentEl, { scale: 1.5, useCORS: true, backgroundColor: '#f5f7fa' }).then(canvas => {
        const { jsPDF } = window.jspdf;
        const pdfWidth = 1000;
        const ratio = pdfWidth / canvas.width;
        const pdfHeight = canvas.height * ratio;
        const pdf = new jsPDF({ orientation: pdfWidth > pdfHeight ? 'landscape' : 'portrait', unit: 'px', format: [pdfWidth, pdfHeight] });
        pdf.addImage(canvas.toDataURL('image/jpeg', 1.0), 'JPEG', 0, 0, pdfWidth, pdfHeight);
        const now = new Date();
        pdf.save('Crosslink Tedarikci - ' + now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0') + '-' + String(now.getDate()).padStart(2,'0') + '.pdf');
        if (btn) { btn.textContent = 'PDF Kaydet'; btn.disabled = false; }
    }).catch(err => { console.error("PDF error:", err); if (btn) { btn.textContent = 'PDF Kaydet'; btn.disabled = false; } });
}

function convertToDatetimeLocal(trDateStr) {
    if (!trDateStr) return "";
    const parts = trDateStr.split(" ");
    if (parts.length < 2) return "";
    const dParts = parts[0].split(".");
    if (dParts.length < 3) return "";
    return dParts[2] + '-' + dParts[1] + '-' + dParts[0] + 'T' + parts[1];
}

window.formatDateToTr = function(datetimeStr) {
    if (!datetimeStr) return "";
    const d = new Date(datetimeStr);
    return String(d.getDate()).padStart(2,'0') + '.' + String(d.getMonth()+1).padStart(2,'0') + '.' + d.getFullYear() + ' ' + String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
};

// ==== SUPPLIER INCELE → detail.html yönlendirmesi ====
let currentSupplierDosyaNo = null;

window.openSupplierModal = function(dosyaNo) {
    // detail.html sayfasına dosyaNo parametresiyle yönlendir — eski çalışan yöntem
    window.location.href = 'detail.html?dosyaNo=' + encodeURIComponent(dosyaNo);
};

document.addEventListener('DOMContentLoaded', () => {
    const closeBtn = document.getElementById('closeSupplierModal');
    if (closeBtn) closeBtn.addEventListener('click', () => {
        document.getElementById('supplierInceleModal').classList.add('hidden');
    });

    const btnT = document.getElementById('btnSupTeslimat');
    if (btnT) btnT.addEventListener('click', () => {
        const dateVal = document.getElementById("supInputTeslimatTarihi").value;
        if (!dateVal) { alert("Lutfen arac teslimat tarihini giriniz!"); return; }
        const trFormat = window.formatDateToTr(dateVal);
        localStorage.setItem('crosslink_teslimat_date_' + currentSupplierDosyaNo, trFormat);
        localStorage.setItem('crosslink_teslimat_' + currentSupplierDosyaNo, "true");
        const now = new Date();
        const ts = now.toLocaleDateString('tr-TR') + " " + now.toLocaleTimeString('tr-TR');
        let asgnT = JSON.parse(localStorage.getItem('crosslink_assignments') || "{}");
        if (!asgnT[currentSupplierDosyaNo]) asgnT[currentSupplierDosyaNo] = { logs: [] };
        if (!asgnT[currentSupplierDosyaNo].logs) asgnT[currentSupplierDosyaNo].logs = [];
        asgnT[currentSupplierDosyaNo].logs.push({ time: ts, user: 'Tedarikci', message: 'Teslimat Tamamlandi (' + trFormat + ')' });
        localStorage.setItem('crosslink_assignments', JSON.stringify(asgnT));
        alert("Teslimat islemi tamamlandi!");
        window.openSupplierModal(currentSupplierDosyaNo);
    });

    const btnI = document.getElementById('btnSupIade');
    if (btnI) btnI.addEventListener('click', () => {
        const nowLocal = new Date().toISOString().slice(0, 16);
        let iadeDate = document.getElementById("supInputIadeTarihi").value;
        if (!iadeDate) iadeDate = nowLocal;
        const trFormat = window.formatDateToTr(iadeDate);
        localStorage.setItem('crosslink_iade_date_' + currentSupplierDosyaNo, trFormat);
        const now = new Date();
        const ts = now.toLocaleDateString('tr-TR') + " " + now.toLocaleTimeString('tr-TR');
        let asgnI = JSON.parse(localStorage.getItem('crosslink_assignments') || "{}");
        if (!asgnI[currentSupplierDosyaNo]) asgnI[currentSupplierDosyaNo] = { logs: [] };
        if (!asgnI[currentSupplierDosyaNo].logs) asgnI[currentSupplierDosyaNo].logs = [];
        asgnI[currentSupplierDosyaNo].logs.push({ time: ts, user: 'Tedarikci', message: 'Iade Alindi (' + trFormat + ')' });
        localStorage.setItem('crosslink_assignments', JSON.stringify(asgnI));
        alert("Iade islemi tamamlandi!");
        window.openSupplierModal(currentSupplierDosyaNo);
    });
});

function populateStatsAndCharts(data) {
    if (!data || data.length === 0) return;
    filteredData = [...data];
    if (typeof updateStatistics === 'function') updateStatistics();
}
