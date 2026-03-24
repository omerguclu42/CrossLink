// JSONP Endpoints using Google Visualization API. 
// This is the ONLY 100% bulletproof way to bypass CORS when running from file:/// HTML files without a local server.
const DELIVERED_JSONP_URL = "https://docs.google.com/spreadsheets/d/1d-IUF5slokrV36jc5oOZcfK0v-lUz0JoC2fjEAm6CLo/gviz/tq?tqx=out:json";
const PENDING_JSONP_URL = "https://docs.google.com/spreadsheets/d/1McoRE5bx0IWdnbqv-__gtn3ywY0U13zWnMPaArtuCxQ/gviz/tq?tqx=out:json";

// Data Storage
let combinedData = [];
let filteredData = [];
let currentSupplier = "";

// Pagination State
let currentPage = 1;
const rowsPerPage = 100;

// DOM Elements
const supplierNameDisplay = document.getElementById("supplierNameDisplay");
const logoutBtn = document.getElementById("logoutBtn");
const dataTable = document.getElementById("dataTable");
const tableBody = document.getElementById("tableBody");
const loadingDataIndicator = document.getElementById("loadingDataIndicator");
const noDataMessage = document.getElementById("noDataMessage");
const recordCount = document.getElementById("recordCount");
const exportCsvBtn = document.getElementById("exportCsvBtn");

// Filter Elements
const filterHizmetNo = document.getElementById("filterHizmetNo");
const filterDosyaNo = document.getElementById("filterDosyaNo");
const filterDosyaTarihi = document.getElementById("filterDosyaTarihi");
const filterYil = document.getElementById("filterYil");
const filterMusteri = document.getElementById("filterMusteri");
const filterIsim = document.getElementById("filterIsim");
const filterSoyisim = document.getElementById("filterSoyisim");
const filterIl = document.getElementById("filterIl");
const filterDurum = document.getElementById("filterDurum");

document.addEventListener("DOMContentLoaded", () => {
    // 1. Session Check
    currentSupplier = sessionStorage.getItem("crosslink_supplier");

    if (!currentSupplier) {
        // Not logged in, redirect to login
        window.location.href = "index.html";
        return;
    }

    // Display Supplier Name
    supplierNameDisplay.textContent = currentSupplier;

    // 2. Fetch and initialize
    initDashboard();

    // 3. Setup Listeners
    setupEventListeners();
});

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
        const deliveredRows = parseGvizJSON(deliveredJson, "Teslim Edildi");
        const pendingRows = parseGvizJSON(pendingJson, "Teslim Edilmedi");
        console.log("Delivered Rows parsed: " + deliveredRows.length + ", Pending: " + pendingRows.length);

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
            // Find correct header dynamically in case of encoding artifacts (e.g. "Tedarikçi" vs "Tedarikci")
            const tedarikciKey = Object.keys(row).find(k => toLowerTr(k).includes("tedarik"));
            const rawRowSupplier = tedarikciKey ? (row[tedarikciKey] || "") : "";

            const rowSupplierNorm = normalizeForSearch(rawRowSupplier);

            // If the row has no supplier but we require one, skip it
            if (!rowSupplierNorm) return false;

            return rowSupplierNorm === supplierNorm ||
                rowSupplierNorm.includes(supplierNorm) ||
                supplierNorm.includes(rowSupplierNorm);
        });
        console.log("Filtered Combined Data Length: " + combinedData.length);

        // Sort combinedData by 'Dosya Açılış Tarihi' Descending (Newest first)
        combinedData.sort((a, b) => {
            return parseDateString(b['Dosya Açılış Tarihi']) - parseDateString(a['Dosya Açılış Tarihi']);
        });

        filteredData = [...combinedData];
        console.log("Filtering and Sorting Done.");

        // Populate dynamic dropdowns based on strictly the supplier's available data
        populateDropdowns();

        // Render initial table
        renderTable();
        console.log("Table Rendered.");

    } catch (error) {
        console.error("Error in initDashboard:", error);
        loadingDataIndicator.innerHTML = "<p style='color: var(--error)'>Veriler yüklenirken bir hata oluştu. Lütfen bağlantınızı kontrol edin.</p>";
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

    const TR_MONTHS = ['Ocak', '\u015eubat', 'Mart', 'Nisan', 'May\u0131s', 'Haziran', 'Temmuz', 'A\u011ftos', 'Eyl\u00fcl', 'Ekim', 'Kas\u0131m', 'Aral\u0131k'];

    combinedData.forEach(row => {
        if (row['Dosya A\u00e7\u0131l\u0131\u015f Tarihi']) {
            const parts = row['Dosya A\u00e7\u0131l\u0131\u015f Tarihi'].split(' ')[0].split('.');
            if (parts.length === 3) uniqueYears.add(parts[2]); // YYYY
        }
        if (row['\u0130l']) uniqueProvinces.add(row['\u0130l']);
        if (row['M\u00fc\u015fteri']) uniqueCustomers.add(row['M\u00fc\u015fteri']);
    });

    // Year filter — all years found, newest first
    const sortedYears = Array.from(uniqueYears).sort((a, b) => parseInt(b) - parseInt(a));
    if (filterYil) {
        filterYil.innerHTML = '<option value="">T\u00fcm Y\u0131llar</option>';
        sortedYears.forEach(yyyy => {
            const opt = document.createElement('option');
            opt.value = yyyy;
            opt.textContent = yyyy;
            filterYil.appendChild(opt);
        });
    }

    // Month filter — all 12 months for each year, ONLY month name (no year), value = MM
    filterDosyaTarihi.innerHTML = '<option value="">T\u00fcm Aylar</option>';
    // Add months 1-12 once (shared across years, year filter separates)
    for (let mm = 1; mm <= 12; mm++) {
        const mmStr = String(mm).padStart(2, '0');
        const option = document.createElement('option');
        option.value = mmStr; // just MM
        option.textContent = TR_MONTHS[mm - 1];
        filterDosyaTarihi.appendChild(option);
    }

    const sortedProvinces = Array.from(uniqueProvinces).sort((a, b) => a.localeCompare(b, 'tr'));
    sortedProvinces.forEach(il => {
        const option = document.createElement('option');
        option.value = il;
        option.textContent = il;
        filterIl.appendChild(option);
    });

    const sortedCustomers = Array.from(uniqueCustomers).sort((a, b) => a.localeCompare(b, 'tr'));
    sortedCustomers.forEach(musteri => {
        const option = document.createElement('option');
        option.value = musteri;
        option.textContent = musteri;
        filterMusteri.appendChild(option);
    });
}

function renderTable() {
    // Hide loader, show table/no data
    loadingDataIndicator.classList.add("hidden");

    tableBody.innerHTML = "";

    if (filteredData.length === 0) {
        dataTable.classList.add("hidden");
        noDataMessage.classList.remove("hidden");
        recordCount.textContent = "Toplam: 0 Dosya";
        return;
    }

    dataTable.classList.remove("hidden");
    noDataMessage.classList.add("hidden");

    // Pagination Slicing (only affects table, not the stats or export)
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    const paginatedData = filteredData.slice(startIndex, endIndex);

    paginatedData.forEach(row => {
        const tr = document.createElement("tr");

        // Format Status Badge
        const statusClass = row['Teslimat Durumu'] === 'Teslim Edildi' ? 'status-delivered' : 'status-pending';

        // SLA Column Logic — show elapsed time for ALL rows
        let slaCell = '';
        const acilisDate = parseTurkishDate(row['Dosya Açılış Tarihi']);
        let diffMs = null;

        if (row['Teslimat Durumu'] === 'Teslim Edildi') {
            const teslimatStr = localStorage.getItem('crosslink_teslimat_date_' + row['Dosya No']) || row['Teslimat Tarihi'];
            const teslimatDate = parseTurkishDate(teslimatStr);
            if (acilisDate && teslimatDate && teslimatDate >= acilisDate) {
                diffMs = teslimatDate - acilisDate;
            }
        } else {
            if (acilisDate) {
                diffMs = new Date().getTime() - acilisDate;
            }
        }

        if (diffMs !== null) {
            const diffHrs = diffMs / (1000 * 60 * 60);
            const totalMin = Math.floor(diffMs / 60000);
            const h = Math.floor(totalMin / 60);
            const m = totalMin % 60;
            const diffDisplay = h > 0 ? `${h} Saat ${m} Dak.` : `${m} Dak.`;

            let slaColor = '#16a34a';
            if (diffHrs >= 24) slaColor = '#dc2626';
            else if (diffHrs >= 8) slaColor = '#d97706';

            slaCell = `<span style="font-weight:700; color:${slaColor}; font-size:0.8rem; white-space:nowrap;">${diffDisplay}</span>`;
        } else {
            slaCell = row['Teslimat Durumu'] === 'Teslim Edildi' ? '<span style="color:#16a34a;font-weight:600;">-</span>' : '-';
        }

        tr.innerHTML = `
            <td data-label="SLA">${slaCell}</td>
            <td data-label="Hizmet No"><strong>${row['Hizmet No'] || ""}</strong></td>
            <td data-label="Dosya No">${row['Dosya No'] || ""}</td>
            <td data-label="Açılış Tarihi">${row['Dosya Açılış Tarihi'] || ""}</td>
            <td data-label="Müşteri">${row['Müşteri'] || ""}</td>
            <td data-label="İsim">${row['İsim'] || ""}</td>
            <td data-label="Soyisim">${row['Soyisim'] || ""}</td>
            <td data-label="Telefon">${row['Telefon'] || ""}</td>
            <td data-label="İl">${row['İl'] || ""}</td>
            <td data-label="Durum"><span class="status-badge ${statusClass}">${row['Teslimat Durumu'] || ""}</span></td>
            <td class="actions-th" data-label="İşlem">
                <a href="detail.html?dosyaNo=${row['Dosya No'] || ""}" class="row-action-btn">Dosyaya Gir</a>
            </td>
        `;

        // The native <a> tag href will now handle navigation without the double loading overlay

        tableBody.appendChild(tr);
    });

    recordCount.textContent = `Toplam: ${filteredData.length} Dosya`;

    renderPagination();

    // Update Statistics & Charts based on the new completely filteredData
    updateStatistics();
}

function renderPagination() {
    const paginationControls = document.getElementById("paginationControls");
    paginationControls.innerHTML = ""; // Clear existing

    if (filteredData.length <= rowsPerPage) {
        return; // No need for pagination if rows are less than or equal to limit
    }

    const totalPages = Math.ceil(filteredData.length / rowsPerPage);

    // Add "Önceki" (Previous) button
    if (currentPage > 1) {
        const prevBtn = document.createElement("button");
        prevBtn.textContent = "«";
        prevBtn.className = "page-btn";
        prevBtn.onclick = () => {
            currentPage--;
            renderTable();
        };
        paginationControls.appendChild(prevBtn);
    }

    // Add numbered page buttons
    // To prevent too many buttons, let's show a rolling window of max 5 buttons
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, startPage + 4);

    // Adjust start page if we hit the end
    if (endPage - startPage < 4) {
        startPage = Math.max(1, endPage - 4);
    }

    for (let i = startPage; i <= endPage; i++) {
        const btn = document.createElement("button");
        btn.textContent = i;
        btn.className = "page-btn" + (i === currentPage ? " active" : "");
        btn.onclick = () => {
            currentPage = i;
            renderTable();
        };
        paginationControls.appendChild(btn);
    }

    // Add "Sonraki" (Next) button
    if (currentPage < totalPages) {
        const nextBtn = document.createElement("button");
        nextBtn.textContent = "»";
        nextBtn.className = "page-btn";
        nextBtn.onclick = () => {
            currentPage++;
            renderTable();
        };
        paginationControls.appendChild(nextBtn);
    }
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
    const fHizmet = toLowerTr(filterHizmetNo.value.trim());
    const fDosya = toLowerTr(filterDosyaNo.value.trim());
    const fMusteri = filterMusteri.value;
    const fIsim = toLowerTr(filterIsim.value.trim());
    const fSoyisim = toLowerTr(filterSoyisim.value.trim());
    const fIl = filterIl.value;
    const fDurum = filterDurum.value;
    // Month filter: value = MM (just month number)
    const fMonth = filterDosyaTarihi ? filterDosyaTarihi.value : '';
    // Year filter
    const fYear = filterYil ? filterYil.value : '';

    filteredData = combinedData.filter(row => {
        // Match Hizmet No
        if (fHizmet && !toLowerTr(row['Hizmet No']).includes(fHizmet)) return false;

        // Match Dosya No
        if (fDosya && !toLowerTr(row['Dosya No']).includes(fDosya)) return false;

        // Match Dosya Açılış Tarihi — month (MM) and/or year (YYYY) filters
        if (fMonth || fYear) {
            const rowDate = (row['Dosya Açılış Tarihi'] || '').split(' ')[0]; // DD.MM.YYYY
            const parts = rowDate.split('.');
            if (parts.length === 3) {
                if (fMonth && parts[1] !== fMonth) return false;
                if (fYear && parts[2] !== fYear) return false;
            } else {
                return false;
            }
        }

        // Match Müşteri
        if (fMusteri && row['Müşteri'] !== fMusteri) return false;

        // Match Isim
        if (fIsim && !toLowerTr(row['İsim']).includes(fIsim)) return false;

        // Match Soyisim
        if (fSoyisim && !toLowerTr(row['Soyisim']).includes(fSoyisim)) return false;

        // Match Il
        if (fIl && row['İl'] !== fIl) return false;

        // Match Durum
        if (fDurum && row['Teslimat Durumu'] !== fDurum) return false;

        return true;
    });

    // Reset pagination to first page whenever filters change
    currentPage = 1;

    // Sort: Teslim Edilmedi (oldest first = highest SLA), then Teslim Edildi
    filteredData.sort((a, b) => {
        const aDelivered = a['Teslimat Durumu'] === 'Teslim Edildi';
        const bDelivered = b['Teslimat Durumu'] === 'Teslim Edildi';
        if (aDelivered !== bDelivered) return aDelivered ? 1 : -1; // pending first
        if (!aDelivered) {
            // Both pending: oldest opening date first (ascending = highest SLA first)
            return parseDateString(a['Dosya Açılış Tarihi']) - parseDateString(b['Dosya Açılış Tarihi']);
        }
        // Both delivered: newest first
        return parseDateString(b['Dosya Açılış Tarihi']) - parseDateString(a['Dosya Açılış Tarihi']);
    });

    renderTable();
}


function setupEventListeners() {
    // Input/Change Listeners on Filters
    [filterHizmetNo, filterDosyaNo, filterIsim, filterSoyisim].forEach(input => {
        input.addEventListener('input', applyFilters); // Trigger on every keystroke
    });

    [filterDosyaTarihi, filterMusteri, filterIl, filterDurum].forEach(select => {
        select.addEventListener('change', applyFilters);
    });
    if (filterYil) filterYil.addEventListener('change', applyFilters);

    // Logout
    logoutBtn.addEventListener("click", () => {
        sessionStorage.removeItem("crosslink_supplier");
        window.location.href = "index.html";
    });

    // Reset Filters
    const btnResetFilters = document.getElementById('btnResetFilters');
    if (btnResetFilters) {
        btnResetFilters.addEventListener('click', () => {
            [filterHizmetNo, filterDosyaNo, filterIsim, filterSoyisim].forEach(input => input && (input.value = ''));
            [filterDosyaTarihi, filterMusteri, filterIl, filterDurum].forEach(select => select && (select.value = ''));
            if (filterYil) filterYil.value = '';
            applyFilters();
        });
    }

    // PDF Export
    const btnSavePdf = document.getElementById('btnSavePdf');
    if (btnSavePdf) {
        btnSavePdf.addEventListener('click', exportSupplierPDF);
    }

    // Export CSV/Excel
    exportCsvBtn.addEventListener("click", () => {
        if (filteredData.length === 0) {
            alert("Dışa aktarılacak veri bulunamadı.");
            return;
        }

        // We use SheetJS from CDN mapped in HTML
        if (typeof XLSX !== 'undefined') {
            // Re-map the array to remove the "İşlemler" necessity or internal state if we had any,
            // but filteredData is just pure row objects, which is perfect for SheetJS.
            // Create a worksheet from the filtered JSON data
            const ws = XLSX.utils.json_to_sheet(filteredData);

            // Create a workbook
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Dosyalarım");

            // Download it
            const today = new Date().toISOString().split('T')[0];
            XLSX.writeFile(wb, `CrossLink_Dosyalarim_${today}.xlsx`);
        } else {
            console.error("SheetJS library is not loaded.");
            alert("Tablo aktarım kütüphanesi yüklenemedi. İnternet bağlantınızı kontrol edin.");
        }
    });

    // --- Sortable column headers ---
    let sortField = null;
    let sortAsc = true;

    document.querySelectorAll('.sortable-th').forEach(th => {
        th.style.cursor = 'pointer';
        th.style.userSelect = 'none';
        th.addEventListener('click', () => {
            const field = th.dataset.sort;
            if (sortField === field) {
                sortAsc = !sortAsc;
            } else {
                sortField = field;
                sortAsc = true;
            }
            // Update sort icons
            document.querySelectorAll('.sortable-th .sort-icon').forEach(ic => ic.textContent = '⇅');
            th.querySelector('.sort-icon').textContent = sortAsc ? '↑' : '↓';

            filteredData.sort((a, b) => {
                let aVal, bVal;
                if (field === 'sla') {
                    // sort by duration elapsed (desc: longest first)
                    aVal = getSlaMs(a);
                    bVal = getSlaMs(b);
                } else if (field === 'Dosya Açılış Tarihi') {
                    aVal = parseDateString(a[field]);
                    bVal = parseDateString(b[field]);
                } else {
                    aVal = toLowerTr(a[field] || '');
                    bVal = toLowerTr(b[field] || '');
                    return sortAsc ? aVal.localeCompare(bVal, 'tr') : bVal.localeCompare(aVal, 'tr');
                }
                return sortAsc ? aVal - bVal : bVal - aVal;
            });
            currentPage = 1;
            renderTable();
        });
    });
}

window.resetDemoStatus = function (dosyaNo) {
    const confirms = confirm("Bu dosyanın statüsünü 'Teslim Edilmedi' statüsüne alıp tüm süreç kilitlerini açmak istiyor musunuz?");
    if (!confirms) return;
    localStorage.removeItem("crosslink_status_" + dosyaNo);
    localStorage.removeItem("crosslink_teslimat_" + dosyaNo);
    localStorage.removeItem("crosslink_teslimat_date_" + dosyaNo);
    localStorage.removeItem("crosslink_iade_date_" + dosyaNo);
    localStorage.removeItem("crosslink_hakedis_" + dosyaNo);
    localStorage.removeItem("crosslink_marka_" + dosyaNo);
    localStorage.removeItem("crosslink_model_" + dosyaNo);
    localStorage.removeItem("crosslink_yil_" + dosyaNo);
    window.location.reload();
};

function getSlaMs(row) {
    const acilisDate = parseTurkishDate(row['Dosya Açılış Tarihi']);
    if (!acilisDate) return -1;
    if (row['Teslimat Durumu'] === 'Teslim Edildi') {
        const teslimatStr = localStorage.getItem('crosslink_teslimat_date_' + row['Dosya No']) || row['Teslimat Tarihi'];
        const teslimatDate = parseTurkishDate(teslimatStr);
        if (teslimatDate && teslimatDate >= acilisDate) {
            return teslimatDate - acilisDate;
        }
        return -1;
    } else {
        return new Date().getTime() - acilisDate;
    }
}

// ---- PDF Export for Supplier ----
function exportSupplierPDF() {
    const btn = document.getElementById('btnSavePdf');
    if (btn) {
        btn.textContent = '⏳ Hazırlanıyor...';
        btn.disabled = true;
    }

    const contentEl = document.querySelector('main.dashboard-main') || document.body;

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
        const pdfWidth = 1000; // Matching Admin resolution
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

        const now = new Date();
        const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        pdf.save(`Crosslink Tedarikci - ${dateStr}.pdf`);

        if (btn) {
            btn.textContent = '📄 PDF Olarak Kaydet';
            btn.disabled = false;
        }
    }).catch(err => {
        console.error('PDF oluşturma hatası:', err);
        alert('PDF oluşturulurken bir hata oluştu: ' + err.message);
        if (btn) {
            btn.textContent = '📄 PDF Olarak Kaydet';
            btn.disabled = false;
        }
    });
}
