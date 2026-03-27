document.addEventListener("DOMContentLoaded", () => {
    // 1. Session Protection
    const sessionData = sessionStorage.getItem("crosslink_operasyon");
    if (!sessionData) {
        window.location.href = "index.html";
        return;
    }

    let user;
    try {
        user = JSON.parse(sessionData);
    } catch (e) {
        user = {};
    }

    // 2. Populate User Profile
    document.getElementById("profileName").textContent = user.adSoyad;
    document.getElementById("profileTitle").textContent = user.pozisyon || "Pozisyon Bulunamadı";
    const profileDept = document.getElementById("profileDept");
    if(profileDept) profileDept.textContent = user.departman || "Departman Bulunamadı";
    document.getElementById("welcomeText").textContent = `Hoş geldin, ${user.adSoyad}!`;

    // 3. Role-Based Access Control (Admin Check)
    const raporlamaMenu = document.getElementById("menu-raporlama");
    if (user.admin === "Evet") {
        raporlamaMenu.classList.remove("hidden");
    }

    // 4. Accordion Logic
    const ikameMenu = document.getElementById("menu-ikame");
    const submenuIkame = document.getElementById("submenu-ikame");
    
    ikameMenu.addEventListener("click", () => {
        const isExpanded = ikameMenu.getAttribute("aria-expanded") === "true";
        if (isExpanded) {
            submenuIkame.classList.add("hidden");
            ikameMenu.setAttribute("aria-expanded", "false");
        } else {
            submenuIkame.classList.remove("hidden");
            ikameMenu.setAttribute("aria-expanded", "true");
        }
    });

    // 5. Logout Logic
    const logoutBtn = document.getElementById("opLogoutBtn");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", () => {
            sessionStorage.removeItem("crosslink_operasyon");
            window.location.href = "index.html";
        });
    }

    // 6. Theme Toggle Logic
    function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        const themeBtn = document.getElementById('themeToggleBtn');
        if (themeBtn) {
            themeBtn.textContent = theme === 'dark' ? '☀️' : '🌙';
        }
    }

    function initTheme() {
        const savedTheme = localStorage.getItem('crosslink_theme');
        if (savedTheme) {
            applyTheme(savedTheme);
        } else {
            const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
            applyTheme(prefersDark ? 'dark' : 'light');
        }

        const themeBtn = document.getElementById('themeToggleBtn');
        if (themeBtn) {
            themeBtn.addEventListener('click', () => {
                const currentTheme = document.documentElement.getAttribute('data-theme');
                const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
                localStorage.setItem('crosslink_theme', newTheme);
                applyTheme(newTheme);
            });
        }
    }

    // 7. Navigation Logic
    const homeSection = document.getElementById("home-section");
    const atamasiBeklenenSection = document.getElementById("atamasi-beklenen-section");
    
    const menuHome = document.getElementById("menu-home");
    const subMenus = document.querySelectorAll(".op-sub-item");
    const menuAtamasiBeklenen = Array.from(subMenus).find(el => el.textContent.includes("Ataması Beklenen Hizmetler"));

    function switchView(viewId) {
        document.querySelectorAll('.section-container').forEach(sec => sec.classList.add('hidden'));
        document.getElementById(viewId).classList.remove('hidden');
        document.querySelectorAll('.op-nav-item, .op-sub-item').forEach(el => el.classList.remove('active'));
    }

    menuHome.addEventListener("click", () => {
        switchView("home-section");
        menuHome.classList.add("active");
    });

    let pendingData = [];

    if (menuAtamasiBeklenen) {
        menuAtamasiBeklenen.addEventListener("click", () => {
             switchView("atamasi-beklenen-section");
             menuAtamasiBeklenen.classList.add("active");
             loadPendingData();
        });
    }

    const menuKullanimiBiten = document.getElementById("menu-kullanimi-biten");
    if (menuKullanimiBiten) {
        menuKullanimiBiten.addEventListener("click", () => {
             switchView("kullanimi-biten-section");
             menuKullanimiBiten.classList.add("active");
             loadCompletedData();
        });
    }

    const menuKullanimiDevamEden = document.getElementById("menu-kullanimi-devam-eden");
    if (menuKullanimiDevamEden) {
        menuKullanimiDevamEden.addEventListener("click", () => {
             switchView("kullanimi-devam-eden-section");
             menuKullanimiDevamEden.classList.add("active");
             if(typeof loadActiveRentalsData === 'function') loadActiveRentalsData();
        });
    }

    const menuTeslimatiBeklenen = document.getElementById("menu-teslimati-beklenen");
    if (menuTeslimatiBeklenen) {
        menuTeslimatiBeklenen.addEventListener("click", () => {
             switchView("teslimati-beklenen-section");
             menuTeslimatiBeklenen.classList.add("active");
             loadDeliveryData();
        });
    }

    const PENDING_URL = 'https://docs.google.com/spreadsheets/d/1McoRE5bx0IWdnbqv-__gtn3ywY0U13zWnMPaArtuCxQ/gviz/tq?tqx=out:json';
    const COMPLETED_URL = 'https://docs.google.com/spreadsheets/d/1d-IUF5slokrV36jc5oOZcfK0v-lUz0JoC2fjEAm6CLo/gviz/tq?tqx=out:json';
    const SUPPLIER_MATRIX_URL = 'https://docs.google.com/spreadsheets/d/1BPCQjEIoRmG73RLwNXquB7fc6XmoyaK_De_yc5c2JFY/gviz/tq?tqx=out:json';
    const SUPPLIER_TARGETS_URL = 'https://docs.google.com/spreadsheets/d/1I5Ybk-cgTFv6jVgqoMQw5Hz-ykF0_Lnk9rb9PzZEvjo/gviz/tq?tqx=out:json';
    const PRICING_URL = 'https://docs.google.com/spreadsheets/d/1MIIKEV-w0Nyh2CbIUY_uxRpMwB1Y5ySgl3x0ICEVpVM/gviz/tq?tqx=out:json';
    
    let completedData = [];
    let supplierPriorityData = {};
    let supplierTargetsData = {};
    let supplierPricingData = [];

    function toLowerTr(str) {
        if (!str) return "";
        return str.replace(/İ/g, 'i').replace(/I/g, 'ı').toLowerCase();
    }

    function normalizeForSearch(str) {
        if (!str) return "";
        let s = String(str);
        // Normalize basic Turkish mapping explicitly to english variants preventing I/İ matching disasters
        s = s.replace(/İ/g, 'i').replace(/I/g, 'i').replace(/ı/g, 'i').replace(/i̇/g, 'i');
        s = s.replace(/Ş/g, 's').replace(/ş/g, 's');
        s = s.replace(/Ğ/g, 'g').replace(/ğ/g, 'g');
        s = s.replace(/Ü/g, 'u').replace(/ü/g, 'u');
        s = s.replace(/Ö/g, 'o').replace(/ö/g, 'o');
        s = s.replace(/Ç/g, 'c').replace(/ç/g, 'c');
        
        return s.toLowerCase().replace(/[^a-z0-9]/g, ""); 
    }

    function parseSupplierJSON(data) {
        if (!data || !data.table || !data.table.rows || data.table.rows.length === 0) return {};
        const headersRow = data.table.rows[0].c;
        const headers = headersRow.map(cell => cell ? String(cell.v).trim() : '');
        const priorityResult = {};
        for (let i = 1; i < data.table.rows.length; i++) {
            const row = data.table.rows[i];
            if (!row || !row.c || !row.c[0] || !row.c[0].v) continue;
            const ilName = String(row.c[0].v).trim();
            const obj = { province: ilName, suppliersEligible: [], priorities: [] };
            headers.forEach((h, index) => {
                if (index === 0) return;
                const cell = row.c[index];
                const val = cell ? String(cell.v).trim() : '';
                if (h.includes("Öncelik")) {
                    if (val) obj.priorities.push(val);
                } else {
                    if (val === "Evet" || val === "evet") {
                        obj.suppliersEligible.push(h);
                    }
                }
            });
            priorityResult[ilName] = obj;
        }
        return priorityResult;
    }

    async function loadSupplierData() {
        try {
            const raw = await fetchJSONP(SUPPLIER_MATRIX_URL);
            supplierPriorityData = parseSupplierJSON(raw);
            console.log("Supplier Map loaded:", Object.keys(supplierPriorityData).length, "provinces");
        } catch(err) {
            console.error("Supplier data load error:", err);
        }
    }
    
    async function loadTargetsData() {
        try {
            const raw = await fetchJSONP(SUPPLIER_TARGETS_URL);
            if (!raw || !raw.table || !raw.table.rows) return;
            const headers = raw.table.cols.map(c => c.label);
            raw.table.rows.forEach(row => {
                let obj = {};
                headers.forEach((h, i) => {
                    const cell = row.c[i];
                    obj[h] = cell ? (cell.f !== undefined && cell.f !== null ? cell.f : cell.v) : null;
                });
                if (obj['Tedarikçiler']) {
                    supplierTargetsData[normalizeForSearch(obj['Tedarikçiler'])] = obj;
                }
            });
            console.log("Supplier Targets Map loaded:", Object.keys(supplierTargetsData).length, "suppliers");
        } catch(err) {
            console.error("Supplier targets load error:", err);
        }
    }

    async function loadPricingData() {
        try {
            const raw = await fetchJSONP(PRICING_URL);
            supplierPricingData = parseGvizJSON(raw);
            console.log("Supplier Pricing Map loaded:", supplierPricingData.length, "rows");
        } catch(err) {
            console.error("Supplier pricing load error:", err);
        }
    }

    // Auto-load on initialization
    loadSupplierData();
    loadTargetsData();
    loadPricingData();
    loadCompletedData();

    // Badge'leri sayfa yüklenince hemen hesapla (sekmeye tıklanmadan)
    function updateAllBadgesFromLocalStorage() {
        const assignments = JSON.parse(localStorage.getItem('crosslink_assignments') || "{}");
        const allAssigned = Object.values(assignments);

        let teslimatiBeklenenCount = 0;
        let kullanimiDevamCount = 0;

        allAssigned.forEach(a => {
            const dn = a.fullData ? a.fullData['Dosya No'] : null;
            if (!dn) return;
            const isTeslimat = localStorage.getItem("crosslink_teslimat_" + dn) === "true";
            const teslimatDate = localStorage.getItem("crosslink_teslimat_date_" + dn);
            const iadeDate = localStorage.getItem("crosslink_iade_date_" + dn);
            const isIade = iadeDate ? true : false;
            const isTeslimatMaked = (teslimatDate && teslimatDate !== "-") || isTeslimat;

            if (!isIade && !isTeslimatMaked) {
                teslimatiBeklenenCount++;
            } else if (isTeslimatMaked && !isIade) {
                kullanimiDevamCount++;
            }
        });

        const badgeTeslimati = document.getElementById("badge-teslimati");
        if (badgeTeslimati) {
            badgeTeslimati.textContent = teslimatiBeklenenCount;
            badgeTeslimati.classList.remove("hidden");
            badgeTeslimati.style.background = teslimatiBeklenenCount > 0 ? '#F59E0B' : '#9CA3AF';
        }
        const badgeDevam = document.getElementById("badge-devam");
        if (badgeDevam) {
            badgeDevam.textContent = kullanimiDevamCount;
            badgeDevam.classList.remove("hidden");
            badgeDevam.style.background = kullanimiDevamCount > 0 ? '#3B82F6' : '#9CA3AF';
        }
    }

    // Ataması Beklenen badge için arka planda sessiz veri çek
    async function preloadPendingBadge() {
        try {
            const json = await fetchJSONP(PENDING_URL);
            const rawData = parseGvizJSON(json);
            const badgeAtamasi = document.getElementById("badge-atamasi");
            if (badgeAtamasi) {
                badgeAtamasi.textContent = rawData.length;
                badgeAtamasi.classList.remove("hidden");
                badgeAtamasi.style.background = rawData.length > 0 ? '#EF4444' : '#9CA3AF';
            }
            // Veriyi pendingData'ya da ata ki sekmeye tıklayınca yeniden fetch etmesin
            pendingData = rawData;
        } catch(e) {
            console.warn("Badge preload for pending failed:", e.message);
        }
    }

    // Çalıştır
    updateAllBadgesFromLocalStorage();
    preloadPendingBadge();

    function fetchJSONP(baseUrl) {
        return new Promise((resolve, reject) => {
            const callbackName = 'opGviz_' + Math.round(1000000 * Math.random()) + '_' + Date.now();
            let script;
            window[callbackName] = function (data) {
                delete window[callbackName];
                if (script && script.parentNode) document.head.removeChild(script);
                resolve(data);
            };
            script = document.createElement('script');
            
            let finalUrl = baseUrl;
            if (finalUrl.includes('tqx=out:json')) {
                finalUrl = finalUrl.replace('tqx=out:json', 'tqx=out:json;responseHandler:' + callbackName);
            } else {
                finalUrl += ';responseHandler:' + callbackName;
            }
            finalUrl += '&_t=' + Date.now();
            
            script.src = finalUrl;
            script.onerror = function () {
                delete window[callbackName];
                if (script && script.parentNode) document.head.removeChild(script);
                reject(new Error('Admin verisi yüklenemedi.'));
            };
            document.head.appendChild(script);
        });
    }

    function parseGvizJSON(data) {
        const rows = [];
        if (!data || !data.table || !data.table.cols) return rows;
        const cols = data.table.cols;
        const headers = cols.map(c => (c.label || c.id || '').trim());
        (data.table.rows || []).forEach(row => {
            const obj = {};
            let hasData = false;
            headers.forEach((h, i) => {
                const cell = row.c ? row.c[i] : null;
                const val = cell ? (cell.f != null ? cell.f : (cell.v != null ? String(cell.v) : '')) : '';
                obj[h] = String(val).trim();
                if (obj[h] && obj[h] !== 'null') hasData = true;
            });
            if (hasData) rows.push(obj);
        });
        return rows;
    }

    function calculateSLA(dateStr) {
        if (!dateStr) return "Bilinmiyor";
        const parts = dateStr.split(' ');
        if (parts.length < 2) return dateStr;
        const dateParts = parts[0].split('.');
        const timeParts = parts[1].split(':');
        if (dateParts.length < 3 || timeParts.length < 2) return dateStr;

        const d = new Date(dateParts[2], parseInt(dateParts[1])-1, dateParts[0], timeParts[0], timeParts[1], timeParts[2] || 0);
        const now = new Date();
        
        let diffMs = now - d;
        if (diffMs < 0) diffMs = 0; 

        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        
        return `${diffHours} Saat ${diffMins} Dakika`;
    }

    function calculateCompletedSLA(acilisStr, teslimStr) {
        if (!acilisStr || !teslimStr) return "Bilinmiyor";
        
        const parseDate = (dateStr) => {
            if (!dateStr) return null;
            const parts = dateStr.split(' ');
            if (parts.length < 2) return null;
            const dateParts = parts[0].split('.');
            const timeParts = parts[1].split(':');
            if (dateParts.length < 3 || timeParts.length < 2) return null;
            return new Date(dateParts[2], parseInt(dateParts[1])-1, dateParts[0], timeParts[0], timeParts[1], timeParts[2] || 0);
        };
        
        const acilis = parseDate(acilisStr);
        const teslim = parseDate(teslimStr);
        
        if (!acilis || !teslim) return "Hatalı Veri";
        
        let diffMs = teslim - acilis;
        if (diffMs < 0) return "0 Saat 0 Dakika"; 
        
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        
        return `${diffHours} Saat ${diffMins} Dakika`;
    }

    async function loadPendingData() {
        const loading = document.getElementById("atamasiBeklenenLoading");
        loading.classList.remove("hidden");
        try {
            const json = await fetchJSONP(PENDING_URL);
            pendingData = parseGvizJSON(json);
            populateFilters(pendingData);
            applyFiltersAndSort(); // Triggers render
        } catch (e) {
            console.error(e);
            alert("Veriler yüklenirken bir hata oluştu: " + e.message);
        } finally {
            loading.classList.add("hidden");
        }
    }

    async function loadCompletedData() {
        const loading = document.getElementById("completedLoading");
        if(loading) loading.classList.remove("hidden");
        try {
            const json = await fetchJSONP(COMPLETED_URL);
            let fetchedData = parseGvizJSON(json);
            
            // Append explicit local returns completing assignment lifecycles directly within UI overriding strict Google Sheets bounds
            const assignments = JSON.parse(localStorage.getItem('crosslink_assignments') || "{}");
            const locallyReturned = Object.values(assignments).filter(a => {
                const dn = a.fullData ? a.fullData['Dosya No'] : null;
                if(!dn) return false;
                return localStorage.getItem("crosslink_iade_date_" + dn) ? true : false;
            }).map(a => {
                const dn = a.fullData['Dosya No'];
                // Mirroring completed payload schemas explicitly
                return {
                    ...a.fullData,
                    'Tedarikçi': a.supplier,
                    'CG Teslimat Tarihi': localStorage.getItem("crosslink_teslimat_date_" + dn) || "-",
                    'İade Tarihi': localStorage.getItem("crosslink_iade_date_" + dn) || "-",
                    'İkame Araç Segmenti': localStorage.getItem("crosslink_segment_" + dn) || a.fullData['Talep Edilen Araç Segmenti'] || "-",
                    'Gün': "-", // Will be bypassed if strict math omitted
                };
            });
            
            completedData = [...fetchedData, ...locallyReturned];
            populateCompletedFilters(completedData);
            applyCompletedFiltersAndSort();
        } catch (e) {
            console.error(e);
            alert("Kullanımı Biten Hizmetler yüklenirken bir hata oluştu: " + e.message);
        } finally {
            if(loading) loading.classList.add("hidden");
        }
    }

    let currentDosyaNo = null;

    window.openAtamaModal = function(dosyaNo) {
        const rowData = pendingData.find(r => r['Dosya No'] === dosyaNo);
        if (!rowData) return;
        
        document.getElementById('mDosyaNoHeader').textContent = rowData['Dosya No'];
        document.getElementById('mDosyaNoVal').textContent = rowData['Dosya No'];
        document.getElementById('mAdSoyad').textContent = (rowData['İsim'] || '') + ' ' + (rowData['Soyisim'] || '');
        document.getElementById('mTelefon').textContent = rowData['Telefon'] || '';
        document.getElementById('mIlIlce').textContent = (rowData['İl'] || '') + ' / ' + (rowData['İlçe'] || '');
        
        document.getElementById('mMusteri').textContent = rowData['Müşteri'] || '';
        document.getElementById('mPolice').textContent = rowData['Poliçe No'] || '';
        document.getElementById('mTeminat').textContent = rowData['Teminat'] || '';
        document.getElementById('mSegment').textContent = rowData['Talep Edilen Araç Segmenti'] || '';
        document.getElementById('mPlanTeslimat').textContent = rowData['Planlanmış Teslimat Tarihi'] || '-';
        document.getElementById('mPlanIade').textContent = rowData['Planlanmış İade Tarihi'] || '-';
        document.getElementById('mTarih').textContent = rowData['Dosya Açılış Tarihi'] || '';
        document.getElementById('mHizmetNo').textContent = rowData['Hizmet No'] || '';

        // İkame Araç Hizmet Bilgileri (SMS ile gelen veya önceden var olan tedarikçi verisi)
        document.getElementById('mHizmetPlaka').textContent = localStorage.getItem("crosslink_plaka_" + dosyaNo) || rowData['Plaka'] || '-';
        document.getElementById('mHizmetMarka').textContent = localStorage.getItem("crosslink_marka_" + dosyaNo) || rowData['Marka'] || '-';
        document.getElementById('mHizmetModel').textContent = localStorage.getItem("crosslink_model_" + dosyaNo) || rowData['Model'] || '-';
        document.getElementById('mHizmetSegment').textContent = localStorage.getItem("crosslink_segment_" + dosyaNo) || rowData['Araç Segmenti'] || '-';
        document.getElementById('mHizmetKm').textContent = localStorage.getItem("crosslink_km_" + dosyaNo) || rowData['Kilometre'] || '-';
        document.getElementById('mHizmetYil').textContent = localStorage.getItem("crosslink_yil_" + dosyaNo) || rowData['Araç Yılı'] || rowData['Model Yılı'] || '-';
        document.getElementById('mHizmetTeslimat').textContent = localStorage.getItem("crosslink_teslimat_date_" + dosyaNo) || rowData['Teslimat Tarihi'] || '-';
        document.getElementById('mHizmetIade').textContent = localStorage.getItem("crosslink_iade_date_" + dosyaNo) || rowData['İade Tarihi'] || '-';
        
        const dropKmEl = document.getElementById('mHizmetDropKm');
        if (dropKmEl) dropKmEl.textContent = localStorage.getItem("crosslink_drop_km_" + dosyaNo) || rowData['Drop Kilometre'] || '-';
        
        const tutarContainer = document.getElementById('atamaTutarsalContainer');
        if (tutarContainer) {
            tutarContainer.innerHTML = "";
            if (typeof populateTutarsalVeriler === "function") populateTutarsalVeriler(dosyaNo, rowData, tutarContainer);
        }
        
        currentDosyaNo = dosyaNo;
        
        // Reset state
        document.getElementById('mAtamaYetkilisiText').textContent = "-";
        document.getElementById('atamaSoruContainer').classList.add("hidden");
        document.getElementById('btnTedarikciSec').classList.add("hidden");
        document.getElementById('btnAtamaBaslat').classList.add("hidden");
        
        const noteEl = document.getElementById("operasyonNotInput");
        if (noteEl) noteEl.value = "";
        const noteContainer = document.getElementById("operasyonNotContainer");
        if (noteContainer) noteContainer.classList.add("hidden");
        
        // Check Local Storage Cache for Assignment
        const cachedYetkili = localStorage.getItem("atama_" + dosyaNo);
        if (cachedYetkili) {
            document.getElementById('mAtamaYetkilisiText').textContent = cachedYetkili;
            if (cachedYetkili === user.adSoyad) {
                document.getElementById('btnTedarikciSec').classList.remove("hidden");
                if (noteContainer) noteContainer.classList.remove("hidden");
            } else {
                document.getElementById('btnTedarikciSec').classList.add("hidden");
            }
        } else {
            // Not assigned yet, verify button permission
            if (user.atamaYetkisi && user.atamaYetkisi.trim().toLowerCase() === "evet") {
                document.getElementById('btnAtamaBaslat').classList.remove("hidden");
            }
        }
        
        // Logs array compilation
        const logList = document.getElementById("atamaLogList");
        logList.innerHTML = "";
        let logsToRender = [];
        const assignments = JSON.parse(localStorage.getItem('crosslink_assignments') || "{}");
        
        if (assignments[dosyaNo] && assignments[dosyaNo].logs) {
            logsToRender = assignments[dosyaNo].logs;
        } else {
            logsToRender.push({ time: rowData['Dosya Açılış Tarihi'] || "Bilinmiyor", user: 'Sistem', message: 'Dosya İşleme Alındı (Açılış)' });
            const manualClaimStamp = localStorage.getItem("atama_time_" + dosyaNo);
            if (manualClaimStamp && cachedYetkili) {
                 logsToRender.push({ time: manualClaimStamp, user: cachedYetkili, message: 'Operatör Dosyayı Atama Sırasına Aldı' });
            }
        }

        logsToRender.forEach(log => {
             const li = document.createElement("li");
             li.style.cssText = "padding:6px 0; border-bottom:1px dashed #E5E7EB; font-size:0.9rem;";
             li.innerHTML = `
                 <strong style="color:var(--primary-color)">[${log.time}]</strong> 
                 <span style="font-weight:600; color:#374151;">${log.user}:</span> 
                 <span style="color:var(--text-muted)">${log.message}</span>
             `;
             logList.appendChild(li);
        });

        // "Eklenen Notlar" bölümünü doldur
        renderNotlarBolumu(logsToRender);
        
        document.getElementById('atamaModal').classList.remove("hidden");
    };

    // "Eklenen Notlar" bölümünü render eder (sadece Operasyon Notu: içeren loglar)
    function renderNotlarBolumu(logs) {
        const container = document.getElementById("eklenenNotlarContainer");
        const listesi = document.getElementById("notlarListesi");
        if (!container || !listesi) return;

        const notLogs = logs.filter(l => l.message && l.message.startsWith("Operasyon Notu:"));
        listesi.innerHTML = "";

        if (notLogs.length === 0) {
            container.classList.add("hidden");
            return;
        }

        notLogs.forEach(log => {
            const noteText = log.message.replace("Operasyon Notu:", "").trim();
            const card = document.createElement("div");
            card.style.cssText = "background:#F0F0FF; border:1px solid #C7D2FE; border-left:4px solid #4338CA; border-radius:8px; padding:10px 14px;";
            card.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                    <span style="font-weight:700; color:#4338CA; font-size:0.9rem;">👤 ${log.user}</span>
                    <span style="font-size:0.78rem; color:#9CA3AF;">${log.time}</span>
                </div>
                <p style="margin:0; color:#374151; font-size:0.92rem; line-height:1.5;">${noteText}</p>
            `;
            listesi.appendChild(card);
        });

        container.classList.remove("hidden");
    }

    function renderPendingTable(data) {
        const badge = document.getElementById("badge-atamasi");
        if (badge) {
            badge.textContent = data.length;
            badge.classList.remove("hidden");
            badge.style.background = data.length > 0 ? '#EF4444' : '#9CA3AF';
        }
        
        const tbody = document.querySelector("#atamasiBeklenenTable tbody");
        tbody.innerHTML = "";
        data.forEach(row => {
            const slaText = calculateSLA(row['Dosya Açılış Tarihi']);
            const match = slaText.match(/(\d+) Saat/);
            const hours = match ? parseInt(match[1], 10) : 0;
            const slaColor = hours > 24 ? '#EF4444' : '#10B981'; // Kırmızı (Red) veya Yeşil (Green)

            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td style="white-space:nowrap">
                    <span class="sla-badge" style="background-color:rgba(217, 119, 6, 0.05); color:${slaColor}; padding:6px 12px; border-radius:20px; font-weight:600; font-size:0.85rem;">
                        <span style="margin-right:4px;">⏱️</span> ${slaText}
                    </span>
                    <br><span style="font-size:0.75rem; color:var(--text-muted); opacity:0.8; margin-top:4px; display:block;">Açılış: ${row['Dosya Açılış Tarihi'] || '-'}</span>
                </td>
                <td>${row['Hizmet No'] || '-'}</td>
                <td>${row['Dosya No'] || '-'}</td>
                <td>${row['Müşteri'] || '-'}</td>
                <td>${row['İl'] || '-'}</td>
                <td>${row['Teminat'] || '-'}</td>
                <td>${row['Poliçe No'] || '-'}</td>
                <td>${row['İsim'] || '-'}</td>
                <td>${row['Soyisim'] || '-'}</td>
                <td>${row['Telefon'] || '-'}</td>
                <td>${row['İl'] || '-'}</td>
                <td>${row['Teminat'] || '-'}</td>
                <td>${row['Talep Edilen Araç Segmenti'] || '-'}</td>
                <td><button class="action-btn atama-yap-btn" onclick="openAtamaModal('${row['Dosya No']}')">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="vertical-align: middle; margin-right: 4px;">
                      <path d="M4 14C4 14 7 14 9 16C11 18 16 18 20 15V20H4V14Z" fill="#F1C27B"/>
                      <path d="M4 14L8 10L14 11L18 8V12L12 15" stroke="#DCA554" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                      <circle cx="16" cy="7" r="6" fill="#4ade80"/>
                      <path d="M13.5 7L15 8.5L18.5 5" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg> Atama Yap
                </button></td>
            `;
            tbody.appendChild(tr);
        });
    }

    // Modal Events
    document.getElementById('closeAtamaModal').addEventListener('click', () => {
        document.getElementById('atamaModal').classList.add("hidden");
    });
    
    document.getElementById('btnAtamaBaslat').addEventListener('click', () => {
        document.getElementById('atamaSoruContainer').classList.remove("hidden");
        document.getElementById('btnAtamaBaslat').classList.add("hidden");
    });

    document.getElementById('btnAtamaEvet').addEventListener('click', () => {
        document.getElementById('mAtamaYetkilisiText').textContent = user.adSoyad;
        document.getElementById('atamaSoruContainer').classList.add("hidden");
        document.getElementById('btnTedarikciSec').classList.remove("hidden");
        
        const noteContainer = document.getElementById('operasyonNotContainer');
        if (noteContainer) noteContainer.classList.remove("hidden");
        
        if (currentDosyaNo) {
            const now = new Date();
            const ts = now.toLocaleDateString('tr-TR') + " " + now.toLocaleTimeString('tr-TR');
            localStorage.setItem("atama_" + currentDosyaNo, user.adSoyad);
            localStorage.setItem("atama_time_" + currentDosyaNo, ts);
            
            // Logu DOM'a anında enjekte et!
            const logListElem = document.getElementById("atamaLogList");
            if (logListElem) {
                const li = document.createElement("li");
                li.style.padding = "6px 0";
                li.style.borderBottom = "1px dashed #F3F4F6";
                li.style.fontSize = "0.9rem";
                li.innerHTML = `<strong style="color:var(--primary-color)">[${ts}]</strong> <span style="font-weight:600; color:#374151;">${user.adSoyad}:</span> <span style="color:var(--text-muted)">Operatör Dosyayı Atama Sırasına Aldı</span>`;
                logListElem.appendChild(li);
            }
        }
    });

    document.getElementById('btnAtamaHayir').addEventListener('click', () => {
        document.getElementById('atamaSoruContainer').classList.add("hidden");
        document.getElementById('btnAtamaBaslat').classList.remove("hidden");
    });

    // Kaydet Button Logic for Operasyon Notu
    const btnNotKaydet = document.getElementById('btnNotKaydet');
    if (btnNotKaydet) {
        btnNotKaydet.addEventListener('click', () => {
            const noteText = document.getElementById("operasyonNotInput").value.trim();
            if (!noteText) {
                alert("Lütfen kaydetmek için bir not giriniz.");
                return;
            }
            let assignments = JSON.parse(localStorage.getItem('crosslink_assignments') || "{}");
            let assigned = assignments[currentDosyaNo];
            const now = new Date();
            const ts = now.toLocaleDateString('tr-TR') + " " + now.toLocaleTimeString('tr-TR');
            const userLabel = (typeof user !== "undefined" && user.adSoyad) ? user.adSoyad : "Operatör";

            if (!assigned) {
                let rowData = null;
                if (typeof pendingData !== "undefined") rowData = pendingData.find(r => r['Dosya No'] === currentDosyaNo);
                
                assigned = {
                    dosyaNo: currentDosyaNo,
                    fullData: rowData || {},
                    logs: []
                };
                if (rowData && rowData['Dosya Açılış Tarihi']) {
                    assigned.logs.push({ time: rowData['Dosya Açılış Tarihi'], user: 'Sistem', message: 'Dosya İşleme Alındı (Açılış)' });
                }
            }
            if (!assigned.logs) assigned.logs = [];
            
            const newLog = { time: ts, user: userLabel, message: `Operasyon Notu: ${noteText}` };
            assigned.logs.push(newLog);
            
            assignments[currentDosyaNo] = assigned;
            localStorage.setItem('crosslink_assignments', JSON.stringify(assignments));
            
            // Doğrudan atamaLogList DOM'una ekle (modal kapatılmadan)
            const logList = document.getElementById("atamaLogList");
            if (logList) {
                const li = document.createElement("li");
                li.style.cssText = "padding:6px 0; border-bottom:1px dashed #E5E7EB; font-size:0.9rem;";
                li.innerHTML = `
                    <strong style="color:var(--primary-color)">[${ts}]</strong> 
                    <span style="font-weight:600; color:#374151;">${userLabel}:</span> 
                    <span style="color:#10B981; font-weight:500;">📝 Operasyon Notu: ${noteText}</span>
                `;
                logList.appendChild(li);
                logList.parentElement.scrollTop = logList.parentElement.scrollHeight;
            }

            // "Eklenen Notlar" bölümüne de anında kart ekle
            const notlarListesi = document.getElementById("notlarListesi");
            const notlarContainer = document.getElementById("eklenenNotlarContainer");
            if (notlarListesi && notlarContainer) {
                const card = document.createElement("div");
                card.style.cssText = "background:#F0F0FF; border:1px solid #C7D2FE; border-left:4px solid #4338CA; border-radius:8px; padding:10px 14px;";
                card.innerHTML = `
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                        <span style="font-weight:700; color:#4338CA; font-size:0.9rem;">👤 ${userLabel}</span>
                        <span style="font-size:0.78rem; color:#9CA3AF;">${ts}</span>
                    </div>
                    <p style="margin:0; color:#374151; font-size:0.92rem; line-height:1.5;">${noteText}</p>
                `;
                notlarListesi.appendChild(card);
                notlarContainer.classList.remove("hidden");
                notlarListesi.scrollTop = notlarListesi.scrollHeight;
            }

            // Textarea'yı temizle ve kısa başarı mesajı göster
            document.getElementById("operasyonNotInput").value = "";
            const btn = document.getElementById("btnNotKaydet");
            const origHtml = btn.innerHTML;
            btn.innerHTML = "✅ Kaydedildi!";
            btn.style.background = "#D1FAE5";
            btn.style.color = "#065F46";
            btn.style.borderColor = "#6EE7B7";
            setTimeout(() => {
                btn.innerHTML = origHtml;
                btn.style.background = "";
                btn.style.color = "";
                btn.style.borderColor = "";
            }, 2000);
        });
    }

    // Supplier Select Modal Events
    document.getElementById('btnTedarikciSec').addEventListener('click', (e) => {
        try {
            e.preventDefault();
            document.getElementById('atamaModal').classList.add("hidden");
            document.getElementById('tSecDosyaNo').textContent = currentDosyaNo;
            
            let rowData = pendingData.find(r => r['Dosya No'] === currentDosyaNo);
            const assignments = JSON.parse(localStorage.getItem('crosslink_assignments') || "{}");
            if (!rowData && assignments[currentDosyaNo]) {
                rowData = assignments[currentDosyaNo].fullData;
            }
            if(!rowData) {
                alert("Dosya verileri okunamadı! (Kayıt bulunamadı)");
                return;
            }
        
        const il = rowData['İl'];
        const elTsecIl = document.getElementById('tSecIl');
        if (elTsecIl) elTsecIl.textContent = il || "Bilinmiyor";
        
        // Populate new info fields (Wrapped defensively mapping against browser Cache locks)
        const elTsecM = document.getElementById('tSecMusteri');
        if (elTsecM) elTsecM.textContent = rowData['Müşteri'] || "-";
        
        const elTsecS = document.getElementById('tSecSegment');
        if (elTsecS) elTsecS.textContent = rowData['Talep Edilen Araç Segmenti'] || "-";

        const pData = supplierPriorityData[il];
        const container = document.getElementById('tedarikciKartlari');
        container.innerHTML = "";

        if(!pData || pData.suppliersEligible.length === 0) {
            container.innerHTML = "<p style='color:var(--text-muted); padding:10px;'>Bu il için tanımlı tedarikçi verisi bulunamadı.</p>";
        } else {
            let sortedSuppliers = [];
            let unassignedEligible = [...pData.suppliersEligible];

            // QCAR MOBILITE Özel İstisnai Kural (Quick Sigorta veya Corpus Sigorta ise daima Öncelik 1)
            const musteriAdi = (rowData['Müşteri'] || "").toLocaleLowerCase('tr-TR');
            const isQcarOverride = musteriAdi.includes("quick") || musteriAdi.includes("corpus");

            if (isQcarOverride) {
                // Eğer exceldeki olası tedarikçiler listesinde varsa çıkart, çünkü manuel olarak 1. sıraya yazacağız.
                const qcarIdx = unassignedEligible.findIndex(f => f.toLocaleLowerCase('tr-TR').includes("qcar") || f.toLocaleLowerCase('tr-TR').includes("q-car"));
                if (qcarIdx !== -1) unassignedEligible.splice(qcarIdx, 1);
                
                // Daima en üste (Sıra 1) ekle
                sortedSuppliers.push({ name: "QCAR MOBILITE", isPriority: true });
            }

            // Resolve priorities (fuzzy matching if strictly abbreviated e.g. "Gri" -> "GRİ RENT ARAÇ KİRALAMA")
            pData.priorities.forEach(shortName => {
                if (!shortName || shortName.toLowerCase() === "null" || shortName.trim() === "") return; // Filter out null/empty strings
                
                const lowerShort = shortName.toLocaleLowerCase('tr-TR').trim();

                // Eğer QCAR Override devredeyse ve sıradaki öncelik de QCAR ise pas geç (Çünkü zaten 1. sıraya ekledik)
                if (isQcarOverride && (lowerShort.includes("qcar") || lowerShort.includes("q-car"))) return;

                let matchedIndex = unassignedEligible.findIndex(fullName => fullName.toLocaleLowerCase('tr-TR').includes(lowerShort));
                if(matchedIndex !== -1) {
                    sortedSuppliers.push({ name: unassignedEligible[matchedIndex], isPriority: true });
                    unassignedEligible.splice(matchedIndex, 1);
                } else {
                    sortedSuppliers.push({ name: shortName, isPriority: true });
                }
            });

            // Append remaining eligible suppliers at the bottom
            unassignedEligible.forEach(fullName => {
                sortedSuppliers.push({ name: fullName, isPriority: false });
            });

            // Render DOM Cards
            const isteneSegment = (rowData['Talep Edilen Araç Segmenti'] || "").trim();

            sortedSuppliers.forEach((sup, index) => {
                const isTopPriority = index === 0;
                
                const card = document.createElement('div');
                card.style.border = isTopPriority ? "2px solid var(--primary-color)" : "1px solid #E5E7EB";
                card.style.borderRadius = "8px";
                card.style.padding = "16px";
                card.style.display = "flex";
                card.style.justifyContent = "space-between";
                card.style.alignItems = "start";
                card.style.background = isTopPriority ? "rgba(240, 247, 255, 0.4)" : "#fff";
                
                const rankCircle = `
                    <div style="min-width: 28px; width: 28px; height: 28px; border-radius: 50%; background: ${isTopPriority ? '#fef3c7' : '#f3f4f6'}; color: ${isTopPriority ? '#d97706' : '#6b7280'}; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.95rem; margin-right: 14px; border: 1px solid ${isTopPriority ? '#fcd34d' : '#e5e7eb'}; margin-top: 2px;">
                        ${index + 1}
                    </div>
                `;

                // Calculate KPI metrics explicitly for this iteration
                const suppNorm = normalizeForSearch(sup.name);
                const tData = supplierTargetsData[suppNorm] || {};

                const hedefDosya = tData['Hedef Dosya'] !== undefined && tData['Hedef Dosya'] !== "Yok" && tData['Hedef Dosya'] !== null ? tData['Hedef Dosya'] : "-";
                const hedefGun = tData['Hedef Gün'] !== undefined && tData['Hedef Gün'] !== "Yok" && tData['Hedef Gün'] !== null ? tData['Hedef Gün'] : "-";
                
                let targetSegmentBudget = "-";
                if (isteneSegment) {
                    const segKey = Object.keys(tData).find(k => k.startsWith(isteneSegment + " Segment"));
                    if (segKey && tData[segKey] !== "Yok" && tData[segKey] !== null && tData[segKey] !== undefined) {
                        targetSegmentBudget = tData[segKey] + " ₺";
                    }
                }

                // Binlik (Thousand) separator formatlayıcısı
                function formatNumTr(val) {
                    if (val === "-" || val === "Yok" || val === null || val === undefined || val === "") return "-";
                    const n = Number(String(val).replace(/,/g, ''));
                    if (isNaN(n)) return val;
                    return new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }).format(Math.round(n));
                }

                // Safe number extractor for GViz formatting ("5", "1.200,50", "1200" vs)
                function extractNumberSafely(str) {
                    if (str === null || str === undefined || str === "") return NaN;
                    let s = String(str).replace(/\s/g, '').replace('₺', '').replace('TL', '').replace('+', '');
                    if (s.includes('.') && s.includes(',')) { s = s.replace(/\./g, '').replace(',', '.'); }
                    else if (s.includes(',')) { s = s.replace(',', '.'); }
                    return Number(s);
                }

                // Tarih bazlı ayrıştırma işlemleri (Bu ay vs Geçen Ay)
                function isSameMonthAs(dateString, targetDateObj) {
                    if (!dateString) return false;
                    try {
                        const dParts = String(dateString).split(" ")[0].split(".");
                        if (dParts.length !== 3) return false;
                        const year = parseInt(dParts[2], 10);
                        const month = parseInt(dParts[1], 10) - 1;
                        return year === targetDateObj.getFullYear() && month === targetDateObj.getMonth();
                    } catch(e) { return false; }
                }

                const today = new Date();
                const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);

                let gecenDosyaTop = 0, gecenGunTop = 0, gecenTutarTop = 0, gecenTutarAdet = 0;
                let gercekDosyaTop = 0, gercekGunTop = 0, gercekTutarTop = 0, gercekTutarAdet = 0;

                // A) Kullanımı Biten Hizmetler Havuzu
                completedData.forEach(cRow => {
                    const cTedarik = normalizeForSearch(cRow['Tedarikçi'] || cRow['Tedarikci'] || "");
                    if (cTedarik === suppNorm || cTedarik.includes(suppNorm) || suppNorm.includes(cTedarik)) {
                        
                        const acilis = cRow['Dosya Açılış Tarihi']; 
                        const gunVal = extractNumberSafely(cRow['Gün']);
                        const tutarVal = extractNumberSafely(cRow['Günlük Tutar']);
                        const cSeg = (cRow['Talep Edilen Araç Segmenti'] || cRow['Araç Segmenti'] || cRow['İkame Araç Segmenti'] || "").trim();
                        const matchesSeg = (cSeg && isteneSegment && cSeg.toLowerCase() === isteneSegment.toLowerCase());

                        if (isSameMonthAs(acilis, lastMonth)) {
                            gecenDosyaTop++;
                            if (!isNaN(gunVal)) gecenGunTop += gunVal;
                            if (matchesSeg && !isNaN(tutarVal) && tutarVal > 0) { 
                                gecenTutarTop += tutarVal;
                                gecenTutarAdet++;
                            }
                        } else if (isSameMonthAs(acilis, today)) {
                            gercekDosyaTop++;
                            if (!isNaN(gunVal)) gercekGunTop += gunVal;
                            if (matchesSeg && !isNaN(tutarVal) && tutarVal > 0) { 
                                gercekTutarTop += tutarVal;
                                gercekTutarAdet++;
                            }
                        }
                    }
                });

                // B) Kullanımı Devam Eden Hizmetler Havuzu
                const activeRentalsObj = JSON.parse(localStorage.getItem('crosslink_active_rentals') || "{}");
                Object.values(activeRentalsObj).forEach(item => {
                    const cTedarik = normalizeForSearch(item.supplier || "");
                    if (cTedarik === suppNorm || cTedarik.includes(suppNorm) || suppNorm.includes(cTedarik)) {
                        const fullData = item.fullData || {};
                        const acilis = fullData['Dosya Açılış Tarihi'];
                        
                        // Açık Gün Hesaplaması (Bugün - Araç Teslim Tarihi)
                        let acikGun = 0;
                        if (item.teslimTarihiStr) {
                             const p = item.teslimTarihiStr.split(' ')[0].split('.');
                             if (p.length === 3) {
                                 const dObj = new Date(p[2], p[1]-1, p[0]);
                                 dObj.setHours(0,0,0,0);
                                 const cObj = new Date();
                                 cObj.setHours(0,0,0,0);
                                 const diff = Math.abs(cObj - dObj);
                                 acikGun = Math.floor(diff / (1000 * 60 * 60 * 24));
                             }
                        }

                        const tutarVal = extractNumberSafely(fullData['Günlük Tutar']);
                        const cSeg = (fullData['Talep Edilen Araç Segmenti'] || fullData['Araç Segmenti'] || "").trim();
                        const matchesSeg = (cSeg && isteneSegment && cSeg.toLowerCase() === isteneSegment.toLowerCase());

                        if (isSameMonthAs(acilis, lastMonth)) {
                            gecenDosyaTop++;
                            gecenGunTop += acikGun;
                            if (matchesSeg && !isNaN(tutarVal) && tutarVal > 0) { 
                                gecenTutarTop += tutarVal;
                                gecenTutarAdet++;
                            }
                        } else if (isSameMonthAs(acilis, today)) {
                            gercekDosyaTop++;
                            gercekGunTop += acikGun;
                            if (matchesSeg && !isNaN(tutarVal) && tutarVal > 0) { 
                                gercekTutarTop += tutarVal;
                                gercekTutarAdet++;
                            }
                        }
                    }
                });

                // Temel Hesaplananlar
                const gecenAveraj = gecenTutarAdet > 0 ? (gecenTutarTop / gecenTutarAdet) : 0;
                const gercekAveraj = gercekTutarAdet > 0 ? (gercekTutarTop / gercekTutarAdet) : 0;

                const hDosyaNum = extractNumberSafely(hedefDosya);
                const hGunNum = extractNumberSafely(hedefGun);
                const hTutarNum = targetSegmentBudget !== "-" ? extractNumberSafely(targetSegmentBudget) : NaN;

                // --- Geçen Aydan Devir Eden --- (Hedef - Geçen Ay Verilen)
                const devirDosya = !isNaN(hDosyaNum) ? (hDosyaNum - gecenDosyaTop) : "-";
                const devirGun = !isNaN(hGunNum) ? (hGunNum - gecenGunTop) : "-";
                // Tutar direkt devir ediyor.
                const devirOrtTutar = gecenTutarAdet > 0 ? gecenAveraj : "-";

                // --- Hedefe Uzaklık --- (Gerçekleşen / (Hedef + Devredeg) * 100)
                const dynamicHedefDosya = (!isNaN(hDosyaNum) && !isNaN(devirDosya) && devirDosya !== "-") ? (hDosyaNum + devirDosya) : hDosyaNum;
                const dynamicHedefGun = (!isNaN(hGunNum) && !isNaN(devirGun) && devirGun !== "-") ? (hGunNum + devirGun) : hGunNum;

                let uzaklikDosya = !isNaN(dynamicHedefDosya) && dynamicHedefDosya > 0 ? (gercekDosyaTop / dynamicHedefDosya) * 100 : "-";
                let uzaklikGun = !isNaN(dynamicHedefGun) && dynamicHedefGun > 0 ? (gercekGunTop / dynamicHedefGun) * 100 : "-";
                let uzaklikTutar = !isNaN(hTutarNum) && hTutarNum > 0 ? (gercekAveraj / hTutarNum) * 100 : "-";

                function formatUzaklik(val, isTutar = false) {
                    if (val === "-") return "-";
                    return "%" + Number(val).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                }

                // GÖRSEL Formatlayıcılar
                const displayDosya = formatNumTr(hedefDosya);
                const displayGun = formatNumTr(hedefGun);
                const displayBudget = targetSegmentBudget !== "-" ? formatNumTr(targetSegmentBudget.replace(' ₺', '')) + " ₺" : "-";

                const dispGecenDosya = gecenDosyaTop > 0 ? formatNumTr(gecenDosyaTop) : "-";
                const dispGecenGun = gecenGunTop > 0 ? formatNumTr(gecenGunTop) : "-";
                const dispGecenTutar = gecenAveraj > 0 ? formatNumTr(gecenAveraj) + " ₺" : "-";

                const dispDevirDosya = devirDosya !== "-" ? (devirDosya > 0 ? "+" + formatNumTr(devirDosya) : formatNumTr(devirDosya)) : "-";
                const dispDevirGun = devirGun !== "-" ? (devirGun > 0 ? "+" + formatNumTr(devirGun) : formatNumTr(devirGun)) : "-";
                const dispDevirBudget = devirOrtTutar !== "-" ? formatNumTr(devirOrtTutar) + " ₺" : "-";

                let dtCol = '#0f172a';
                if (devirOrtTutar !== "-" && devirOrtTutar !== undefined && !isNaN(hTutarNum) && hTutarNum > 0) {
                    dtCol = devirOrtTutar < hTutarNum ? '#dc2626' : '#16a34a';
                }

                const dispGercekDosya = gercekDosyaTop > 0 ? formatNumTr(gercekDosyaTop) : "-";
                const dispGercekGun = gercekGunTop > 0 ? formatNumTr(gercekGunTop) : "-";
                const dispGercekTutar = gercekAveraj > 0 ? formatNumTr(gercekAveraj) + " ₺" : "-";

                const dispUzDosya = formatUzaklik(uzaklikDosya);
                const dispUzGun = formatUzaklik(uzaklikGun);
                const dispUzTutar = formatUzaklik(uzaklikTutar);
                // --- DYNAMIC PRICING ENGINE ---
                let sysGunlukTutar = "Bilinmiyor";
                let sysDoviz = "TL";
                
                if (supplierPricingData && supplierPricingData.length > 0) {
                    const normSupName = normalizeForSearch(sup.name);
                    const isteneSegQuery = (isteneSegment || "").toLowerCase().trim();
                    const musteriQuery = (rowData['Müşteri'] || "").toLowerCase().trim();
                    
                    // 1. Try Exact Match (Supplier + Customer)
                    let matchedPricing = supplierPricingData.find(p => 
                        normalizeForSearch(p['Tedarikçi']) === normSupName && 
                        (p['Müşteri'] || "").toLowerCase().trim() === musteriQuery
                    );
                    
                    // 2. Fallback to 'Varsayılan'
                    if (!matchedPricing) {
                         matchedPricing = supplierPricingData.find(p => 
                            normalizeForSearch(p['Tedarikçi']) === normSupName && 
                            (p['Müşteri'] || "").toLowerCase().includes("varsay")
                        );
                    }
                    
                    if (matchedPricing) {
                        // Find the exact segment column matching requested Segment
                        const segCol = Object.keys(matchedPricing).find(k => k.toLowerCase().trim() === isteneSegQuery);
                        if (segCol && matchedPricing[segCol]) {
                            // Fetch raw formatted value from Google Sheets directly preserving '1.200' strings
                            sysGunlukTutar = matchedPricing[segCol];
                            if (matchedPricing['Döviz Cinsi']) sysDoviz = matchedPricing['Döviz Cinsi'].trim();
                        }
                    }
                }
                const formattedGunlukTutar = sysGunlukTutar !== "Bilinmiyor" ? sysGunlukTutar + " " + (sysDoviz === "TL" ? "₺" : sysDoviz) : "Fiyat Listede Yok";

                function getPctColor(valStr) {
                    if (!valStr || valStr === "-") return "#0f172a";
                    const n = Number(valStr.replace('%', '').replace(',', '.'));
                    if (isNaN(n)) return "#0f172a";
                    if (n < 50) return "#dc2626"; // Kırmızı
                    if (n < 100) return "#d97706"; // Sarı / Turuncu
                    return "#16a34a"; // Yeşil
                }

                card.innerHTML = `
                    <div style="display: flex; align-items: flex-start; flex: 1;">
                        ${rankCircle}
                        <div style="flex: 1; padding-right: 16px;">
                            <div style="margin:0; color:#1F2937; font-size:1.05rem; display:flex; align-items:center; justify-content:space-between; width:100%; border-bottom:1px solid #E5E7EB; padding-bottom:8px; margin-bottom:12px;">
                                <h4 style="margin:0; display:flex; align-items:center;">
                                    ${isTopPriority ? '<span style="color:#d97706; margin-right:6px;">⭐</span> ' : ''}
                                    ${sup.name}
                                </h4>
                                <span style="font-size:0.85rem; padding:4px 10px; background:#f0fdf4; color:#166534; border:1px solid #bbf7d0; border-radius:20px; font-weight:600;">
                                    Günlük Tutar: ${formattedGunlukTutar}
                                </span>
                            </div>
                            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:12px;">
                                
                                <!-- 1. Satır: Hedefler -->
                                <div style="display:grid; grid-template-columns:1fr 1fr 1.2fr; gap:12px; margin-bottom:10px;">
                                    <div><span style="font-size:0.7rem; color:#64748b; font-weight:600; line-height:1.2; display:block; margin-bottom:4px;">Hedef Dosya</span><strong style="color:#0f172a; font-size:0.95rem;">${displayDosya}</strong></div>
                                    <div><span style="font-size:0.7rem; color:#64748b; font-weight:600; line-height:1.2; display:block; margin-bottom:4px;">Hedef Gün</span><strong style="color:#0f172a; font-size:0.95rem;">${displayGun}</strong></div>
                                    <div><span style="font-size:0.7rem; color:#64748b; font-weight:600; line-height:1.2; display:block; margin-bottom:4px;">Hedef Ort. Tutar</span><strong style="color:#0f172a; font-size:0.95rem; white-space: nowrap;">${displayBudget}</strong></div>
                                </div>
                                
                                <!-- 2. Satır: Geçen Ay Verilen -->
                                <div style="display:grid; grid-template-columns:1fr 1fr 1.2fr; gap:12px; border-top:1px dashed #cbd5e1; padding-top:10px; margin-bottom:10px;">
                                    <div><span style="font-size:0.7rem; color:#64748b; font-weight:600; line-height:1.2; display:block; margin-bottom:4px;">Geçen Ay Verilen Dosya</span><strong style="color:#0f172a; font-size:0.95rem;">${dispGecenDosya}</strong></div>
                                    <div><span style="font-size:0.7rem; color:#64748b; font-weight:600; line-height:1.2; display:block; margin-bottom:4px;">Geçen Ay Harcanan Gün</span><strong style="color:#0f172a; font-size:0.95rem;">${dispGecenGun}</strong></div>
                                    <div><span style="font-size:0.7rem; color:#64748b; font-weight:600; line-height:1.2; display:block; margin-bottom:4px;">Geçen Ay Segment Ort. Tutar</span><strong style="color:#0f172a; font-size:0.95rem;">${dispGecenTutar}</strong></div>
                                </div>

                                <!-- 3. Satır: Geçen Aydan Devir Eden -->
                                <div style="display:grid; grid-template-columns:1fr 1fr 1.2fr; gap:12px; border-top:1px dashed #cbd5e1; padding-top:10px; margin-bottom:10px;">
                                    <div><span style="font-size:0.7rem; color:#64748b; font-weight:600; line-height:1.2; display:block; margin-bottom:4px;">Geçen Aydan Devir Eden Dosya</span><strong style="color:${devirDosya > 0 ? '#dc2626' : (devirDosya < 0 ? '#16a34a' : '#0f172a')}; font-size:0.95rem;">${dispDevirDosya}</strong></div>
                                    <div><span style="font-size:0.7rem; color:#64748b; font-weight:600; line-height:1.2; display:block; margin-bottom:4px;">Geçen Aydan Devir Eden Gün</span><strong style="color:${devirGun > 0 ? '#dc2626' : (devirGun < 0 ? '#16a34a' : '#0f172a')}; font-size:0.95rem;">${dispDevirGun}</strong></div>
                                    <div><span style="font-size:0.7rem; color:#64748b; font-weight:600; line-height:1.2; display:block; margin-bottom:4px;">Geçen Aydan Devir Eden Ort. Tutar</span><strong style="color:${dtCol}; font-size:0.95rem;">${dispDevirBudget}</strong></div>
                                </div>

                                <!-- 4. Satır: Gerçekleşen (Bu Ay) -->
                                <div style="display:grid; grid-template-columns:1fr 1fr 1.2fr; gap:12px; border-top:1px dashed #cbd5e1; padding-top:10px; margin-bottom:10px;">
                                    <div><span style="font-size:0.7rem; color:#64748b; font-weight:600; line-height:1.2; display:block; margin-bottom:4px;">Gerçekleşen Dosya</span><strong style="color:#0f172a; font-size:0.95rem;">${dispGercekDosya}</strong></div>
                                    <div><span style="font-size:0.7rem; color:#64748b; font-weight:600; line-height:1.2; display:block; margin-bottom:4px;">Gerçekleşen Harcanan Gün</span><strong style="color:#0f172a; font-size:0.95rem;">${dispGercekGun}</strong></div>
                                    <div><span style="font-size:0.7rem; color:#64748b; font-weight:600; line-height:1.2; display:block; margin-bottom:4px;">Gerçekleşen Ort. Tutar</span><strong style="color:#0f172a; font-size:0.95rem;">${dispGercekTutar}</strong></div>
                                </div>

                                <!-- 5. Satır: Uzaklıklar -->
                                <div style="display:grid; grid-template-columns:1fr 1fr 1.2fr; gap:12px; border-top:1px dashed #cbd5e1; padding-top:10px;">
                                    <div><span style="font-size:0.7rem; color:#1e3a8a; font-weight:600; line-height:1.2; display:block; margin-bottom:4px;">Hedefi Tamamlama (Dosya)</span><strong style="color:${getPctColor(dispUzDosya)}; font-size:0.95rem;">${dispUzDosya}</strong></div>
                                    <div><span style="font-size:0.7rem; color:#1e3a8a; font-weight:600; line-height:1.2; display:block; margin-bottom:4px;">Hedefi Tamamlama (Gün)</span><strong style="color:${getPctColor(dispUzGun)}; font-size:0.95rem;">${dispUzGun}</strong></div>
                                    <div><span style="font-size:0.7rem; color:#1e3a8a; font-weight:600; line-height:1.2; display:block; margin-bottom:4px;">Hedefi Tamamlama (Tutar)</span><strong style="color:${getPctColor(dispUzTutar)}; font-size:0.95rem;">${dispUzTutar}</strong></div>
                                </div>
                                
                            </div>
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; justify-content: center; align-self: center; min-width: 140px;">
                        <button class="action-btn atama-yap-btn" onclick="openConfirmModal('${currentDosyaNo}', '${sup.name.replace(/'/g, "\\'")}', '${sysGunlukTutar !== "Bilinmiyor" ? sysGunlukTutar : "-"}', '${sysDoviz}')" style="background:var(--primary-color); color:#fff; border:none; padding:0; width: 140px; height: 44px; display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 0.95rem; border-radius: 8px; box-shadow: 0 4px 6px rgba(248, 140, 66, 0.2); transition: all 0.2s;">
                            Dosyayı Ata
                        </button>
                    </div>
                `;
                container.appendChild(card);
            });
        }
        
        document.getElementById('tedarikciSecModal').classList.remove("hidden");
        } catch (error) {
            console.error("Tedarikci Modal JS Hata:", error);
            alert("Tedarikçi kartları yüklenirken bir sistem hatası oluştu!\n\nHata Özeti: " + error.message + "\n\nLütfen sayfayı yenileyip tekrar deneyin veya bu hatayı iletin.");
            document.getElementById('tedarikciSecModal').classList.remove("hidden"); // Force it open anyway!
        }
    });
    
    document.getElementById('closeTedarikciModal').addEventListener('click', () => {
        document.getElementById('tedarikciSecModal').classList.add("hidden");
    });

    window.openConfirmModal = function(dosyaNo, supplierName, gunlukTutar, dovizCinsi) {
        document.getElementById('confirmAtamaText').innerHTML = `Dosyayı <strong>"${supplierName}"</strong> tedarikçisine atamak istediğinize emin misiniz?`;
        document.getElementById('confirmAtamaModal').classList.remove("hidden");
        
        const btnEvet = document.getElementById('btnConfirmEvet');
        const btnHayir = document.getElementById('btnConfirmHayir');
        
        const newBtnEvet = btnEvet.cloneNode(true);
        const newBtnHayir = btnHayir.cloneNode(true);
        btnEvet.parentNode.replaceChild(newBtnEvet, btnEvet);
        btnHayir.parentNode.replaceChild(newBtnHayir, btnHayir);
        
        newBtnHayir.addEventListener('click', () => {
            document.getElementById('confirmAtamaModal').classList.add("hidden");
        });
        
        newBtnEvet.addEventListener('click', () => {
            document.getElementById('confirmAtamaModal').classList.add("hidden");
            executeAssignSupplier(dosyaNo, supplierName, gunlukTutar, dovizCinsi);
        });
    };

    function executeAssignSupplier(dosyaNo, supplierName, gunlukTutar, dovizCinsi) {
        
        const noteEl = document.getElementById("operasyonNotInput");
        const opNote = noteEl ? noteEl.value.trim() : "";

        let assignments = JSON.parse(localStorage.getItem('crosslink_assignments') || "{}");
        const now = new Date();
        const ts = now.toLocaleDateString('tr-TR') + " " + now.toLocaleTimeString('tr-TR');
        
        let rowData = pendingData.find(r => r['Dosya No'] === dosyaNo);
        const isReassign = !!assignments[dosyaNo];

        if (!rowData && isReassign) {
            rowData = assignments[dosyaNo].fullData;
        }

        const atamaYetkilisi = localStorage.getItem("atama_" + dosyaNo) || user.adSoyad;

        let logs = [];
        if (isReassign && assignments[dosyaNo].logs) {
            logs = assignments[dosyaNo].logs;
            logs.push({ time: ts, user: atamaYetkilisi, message: `Tedarikçi Değiştirildi. Yeni Tedarikçi: ${supplierName}` });
        } else {
            logs = [
                { time: rowData && rowData['Dosya Açılış Tarihi'] ? rowData['Dosya Açılış Tarihi'] : ts, user: 'Sistem', message: 'Dosya Açıldı' }
            ];
            
            const manualClaimStamp = localStorage.getItem("atama_time_" + dosyaNo);
            if (manualClaimStamp) {
                 logs.push({ time: manualClaimStamp, user: atamaYetkilisi, message: 'Operatör Dosyayı Atama Sırasına Aldı' });
            }
            logs.push({ time: ts, user: atamaYetkilisi, message: `Tedarikçi Atandı: ${supplierName}` });
        }
        
        if (opNote) {
            logs.push({ time: ts, user: atamaYetkilisi, message: `Operasyon Notu: ${opNote}` });
            localStorage.setItem('crosslink_op_not_' + dosyaNo, opNote);
        }

        assignments[dosyaNo] = {
            ...assignments[dosyaNo],
            dosyaNo: dosyaNo,
            supplier: supplierName,
            atamaci: atamaYetkilisi,
            assignedAt: ts,
            gunlukTutar: gunlukTutar || '-',
            doviz: dovizCinsi || 'TL',
            fullData: rowData,
            logs: logs
        };
        
        localStorage.setItem('crosslink_assignments', JSON.stringify(assignments));
        
        alert("Tedarikçi başarıyla atandı. Dosya artık Teslimatı Beklenenler aşamasındadır.");
        document.getElementById('tedarikciSecModal').classList.add("hidden");
        
        // Hide from current pending table natively and re-render
        applyFiltersAndSort();
        
        // As well as sync the Delivery Data table if the supplier was changed there!
        if (typeof window.loadDeliveryData === "function") window.loadDeliveryData();
    };

    // 8. Sorting and Filtering Logic
    let sortCol = "tarih";
    let sortDesc = true;

    document.querySelectorAll("th[data-sort]").forEach(th => {
        th.style.cursor = "pointer";
        th.addEventListener("click", () => {
            const col = th.getAttribute("data-sort");
            if (sortCol === col) {
                sortDesc = !sortDesc;
            } else {
                sortCol = col;
                sortDesc = false;
            }
            applyFiltersAndSort();
        });
    });

    function populateFilters(data) {
        // Initial population, later handled by cascading logic
        const musteriSet = new Set();
        const ilSet = new Set();
        const teminatSet = new Set();
        const segmentSet = new Set();

        data.forEach(r => {
            if (r['Müşteri']) musteriSet.add(r['Müşteri']);
            if (r['İl']) ilSet.add(r['İl']);
            if (r['Teminat']) teminatSet.add(r['Teminat']);
            if (r['Talep Edilen Araç Segmenti']) segmentSet.add(r['Talep Edilen Araç Segmenti']);
        });

        const fillSelect = (id, set) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.innerHTML = '<option value="">Tümü</option>';
            Array.from(set).sort((a,b)=>a.localeCompare(b,'tr')).forEach(val => {
                const opt = document.createElement("option");
                opt.value = val;
                opt.textContent = val;
                el.appendChild(opt);
            });
        };

        fillSelect("filter-musteri", musteriSet);
        fillSelect("filter-il", ilSet);
        fillSelect("filter-teminat", teminatSet);
        fillSelect("filter-segment", segmentSet);
    }
    
    // Reset Filters Button
    const btnResetFilters = document.getElementById("btnResetFilters");
    if(btnResetFilters) {
        btnResetFilters.addEventListener("click", () => {
            document.querySelectorAll(".filter-input").forEach(el => el.value = "");
            applyFiltersAndSort();
        });
    }

    document.querySelectorAll(".filter-input").forEach(el => {
        if (el.tagName === 'SELECT') {
            el.addEventListener("change", applyFiltersAndSort);
        } else {
            el.addEventListener("input", applyFiltersAndSort);
        }
    });

    function normalizeText(str) {
        if (!str) return "";
        return str.toLocaleLowerCase("tr-TR").trim();
    }

    function applyFiltersAndSort() {
        const fhizmet = normalizeText(document.getElementById("filter-hizmet").value);
        const fdosya = normalizeText(document.getElementById("filter-dosya").value);
        const fpolice = normalizeText(document.getElementById("filter-police").value);
        const fisim = normalizeText(document.getElementById("filter-isim").value);
        const fsoyisim = normalizeText(document.getElementById("filter-soyisim").value);
        
        const fmusteri = document.getElementById("filter-musteri").value;
        const fil = document.getElementById("filter-il").value;
        const fteminat = document.getElementById("filter-teminat").value;
        const fsegment = document.getElementById("filter-segment").value;
        
        const assignments = JSON.parse(localStorage.getItem('crosslink_assignments') || "{}");
        // Cascading Dropdowns Logic
        const getFilteredFor = (skipField) => {
            return pendingData.filter(r => {
                if (r['Dosya No'] && assignments[r['Dosya No']]) return false;
                if (fhizmet && !(r['Hizmet No']||"").toLocaleLowerCase("tr-TR").includes(fhizmet)) return false;
                if (fdosya && !(r['Dosya No']||"").toLocaleLowerCase("tr-TR").includes(fdosya)) return false;
                if (fpolice && !(r['Poliçe No']||"").toLocaleLowerCase("tr-TR").includes(fpolice)) return false;
                if (fisim && !(r['İsim']||"").toLocaleLowerCase("tr-TR").includes(fisim)) return false;
                if (fsoyisim && !(r['Soyisim']||"").toLocaleLowerCase("tr-TR").includes(fsoyisim)) return false;

                if (skipField !== 'musteri' && fmusteri && r['Müşteri'] !== fmusteri) return false;
                if (skipField !== 'il' && fil && r['İl'] !== fil) return false;
                if (skipField !== 'teminat' && fteminat && r['Teminat'] !== fteminat) return false;
                if (skipField !== 'segment' && fsegment && r['Talep Edilen Araç Segmenti'] !== fsegment) return false;

                return true;
            });
        };

        const musteriData = getFilteredFor('musteri');
        const ilData = getFilteredFor('il');
        const teminatData = getFilteredFor('teminat');
        const segmentData = getFilteredFor('segment');

        const fillCascadedSelect = (id, dataSet, field, currentVal) => {
            const set = new Set(dataSet.map(d => d[field]).filter(Boolean));
            const el = document.getElementById(id);
            if (!el) return;
            el.innerHTML = '<option value="">Tümü</option>';
            Array.from(set).sort((a,b)=>a.localeCompare(b,'tr')).forEach(val => {
                const opt = document.createElement("option");
                opt.value = val;
                opt.textContent = val;
                if (val === currentVal) opt.selected = true;
                el.appendChild(opt);
            });
        };

        fillCascadedSelect("filter-musteri", musteriData, 'Müşteri', fmusteri);
        fillCascadedSelect("filter-il", ilData, 'İl', fil);
        fillCascadedSelect("filter-teminat", teminatData, 'Teminat', fteminat);
        fillCascadedSelect("filter-segment", segmentData, 'Talep Edilen Araç Segmenti', fsegment);

        let filtered = getFilteredFor('none'); // Uses all filters

        // Sorting
        filtered.sort((a, b) => {
            let va = ""; let vb = "";
            switch (sortCol) {
                case "sla": 
                    // To sort SLA properly, compare their raw time values instead of strings
                    const parseSLA = (dStr) => {
                        const d = calculateSLA(dStr);
                        if(d === "Bilinmiyor") return 0;
                        const match = d.match(/(\d+) Saat (\d+)/);
                        if(match) return parseInt(match[1])*60 + parseInt(match[2]);
                        return 0;
                    };
                    return sortDesc ? parseSLA(b['Dosya Açılış Tarihi']) - parseSLA(a['Dosya Açılış Tarihi']) : parseSLA(a['Dosya Açılış Tarihi']) - parseSLA(b['Dosya Açılış Tarihi']);
                case "hizmet": va = a['Hizmet No']||""; vb = b['Hizmet No']||""; break;
                case "dosya": va = a['Dosya No']||""; vb = b['Dosya No']||""; break;
                case "tarih": 
                    const da = a['Dosya Açılış Tarihi'] || "";
                    const db = b['Dosya Açılış Tarihi'] || "";
                    va = da.split(' ')[0].split('.').reverse().join('') + (da.split(' ')[1]||''); 
                    vb = db.split(' ')[0].split('.').reverse().join('') + (db.split(' ')[1]||'');
                    break;
                case "musteri": va = a['Müşteri']||""; vb = b['Müşteri']||""; break;
                case "police": va = a['Poliçe No']||""; vb = b['Poliçe No']||""; break;
                case "isim": va = a['İsim']||""; vb = b['İsim']||""; break;
                case "soyisim": va = a['Soyisim']||""; vb = b['Soyisim']||""; break;
                case "telefon": va = a['Telefon']||""; vb = b['Telefon']||""; break;
                case "il": va = a['İl']||""; vb = b['İl']||""; break;
                case "teminat": va = a['Teminat']||""; vb = b['Teminat']||""; break;
                case "segment": va = a['Talep Edilen Araç Segmenti']||""; vb = b['Talep Edilen Araç Segmenti']||""; break;
            }
            
            if (typeof va === "string" && typeof vb === "string") {
                return sortDesc ? vb.localeCompare(va, "tr") : va.localeCompare(vb, "tr");
            }
            return 0; // fallback
        });

        // Update headers to show sort icon
        document.querySelectorAll("th[data-sort]").forEach(th => {
            const text = th.textContent.replace(" ⬇", "").replace(" ⬆", "").replace(" ↕", "");
            if (th.getAttribute("data-sort") === sortCol) {
                th.textContent = text + (sortDesc ? " ⬇" : " ⬆");
            } else {
                th.textContent = text + " ↕";
            }
        });

        renderPendingTable(filtered);
    }

    // 9. Excel Export Handler
    document.getElementById("btnExportAtamasiBeklenen").addEventListener("click", () => {
        // Find visible rows from the rendered table instead of rebuilding to ensure we match exactly what user sees
        const thead = document.querySelector("#atamasiBeklenenTable thead");
        const tbody = document.querySelector("#atamasiBeklenenTable tbody");
        
        let csvContent = "";
        
        // Headers
        const headerCols = Array.from(thead.querySelectorAll("th")).map(th => `"${th.textContent.replace(" ⬇", "").replace(" ⬆", "").replace(" ↕", "")}"`);
        headerCols.pop(); // Remove "İşlemler"
        csvContent += headerCols.join(";") + "\n";
        
        // Rows
        Array.from(tbody.querySelectorAll("tr")).forEach(tr => {
            const rowCols = Array.from(tr.querySelectorAll("td")).map(td => `"${td.textContent.trim()}"`);
            rowCols.pop(); // Remove Atama Yap column
            csvContent += rowCols.join(";") + "\n";
        });
        
        // Explicit BOM for Excel UTF-8
        csvContent = "\uFEFF" + csvContent;
        const fn = "Atamasi_Beklenen_Hizmetler_" + new Date().toISOString().slice(0,10) + ".csv";
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", fn);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });

    // 10. Completed Services Logic
    let completedSortCol = "completed-tarih";
    let completedSortDesc = true;

    document.querySelectorAll("#completedTable th[data-sort]").forEach(th => {
        th.style.cursor = "pointer";
        th.addEventListener("click", () => {
            const col = th.getAttribute("data-sort");
            if (completedSortCol === col) {
                completedSortDesc = !completedSortDesc;
            } else {
                completedSortCol = col;
                completedSortDesc = false;
            }
            applyCompletedFiltersAndSort();
        });
    });

    // 11. Teslimatı Beklenen Hizmetler Logic
    let deliveryData = [];
    let deliverySortCol = "teslimat-tarih";
    let deliverySortDesc = true;

    window.loadDeliveryData = function() {
        const assignments = JSON.parse(localStorage.getItem('crosslink_assignments') || "{}");
        deliveryData = Object.values(assignments).filter(a => {
            const dn = a.fullData ? a.fullData['Dosya No'] : null;
            if(!dn) return false;
            const isTeslimat = localStorage.getItem("crosslink_teslimat_" + dn) === "true";
            const isIade = localStorage.getItem("crosslink_iade_date_" + dn) ? true : false;
            return !isTeslimat && !isIade;
        }).map(a => {
            if (a.fullData) {
                a.fullData['Tedarikçi Adı'] = a.supplier;
                a.fullData['Tedarikçi'] = a.supplier;
                if (a.gunlukTutar) a.fullData['Günlük Tutar'] = a.gunlukTutar;
            }
            return {
                ...a.fullData,
                'Tedarikçi': a.supplier,
                'Atanma Tarihi': a.assignedAt,
                'logs': a.logs
            };
        });
        
        populateDeliveryFilters(deliveryData);
        applyDeliveryFiltersAndSort();
    };

    document.querySelectorAll("#teslimatiBeklenenTable th[data-sort]").forEach(th => {
        th.style.cursor = "pointer";
        th.addEventListener("click", () => {
            const col = th.getAttribute("data-sort");
            if (deliverySortCol === col) {
                deliverySortDesc = !deliverySortDesc;
            } else {
                deliverySortCol = col;
                deliverySortDesc = false;
            }
            applyDeliveryFiltersAndSort();
        });
    });

    function populateDeliveryFilters(data) {
        const fillCascadedSelect = (id, set, currentVal) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.innerHTML = '<option value="">Tümü</option>';
            Array.from(set).sort((a,b)=>a.localeCompare(b,'tr')).forEach(val => {
                const opt = document.createElement("option");
                opt.value = val;
                opt.textContent = val;
                if (val === currentVal) opt.selected = true;
                el.appendChild(opt);
            });
        };

        const musteriSet = new Set(data.map(d => d['Müşteri']).filter(Boolean));
        const ilSet = new Set(data.map(d => d['İl']).filter(Boolean));
        const teminatSet = new Set(data.map(d => d['Teminat']).filter(Boolean));
        const tedarikciSet = new Set(data.map(d => d['Tedarikçi']).filter(Boolean));
        const segmentSet = new Set(data.map(d => d['Talep Edilen Araç Segmenti']).filter(Boolean)); // Changed from 'Talep Edilen Segment'

        const cm = (document.getElementById("filter-delivery-musteri") || {}).value;
        const ci = (document.getElementById("filter-delivery-il") || {}).value;
        const ct = (document.getElementById("filter-delivery-teminat") || {}).value;
        const cted = (document.getElementById("filter-delivery-tedarikci") || {}).value;
        const cseg = (document.getElementById("filter-delivery-segment") || {}).value;

        fillCascadedSelect("filter-delivery-musteri", musteriSet, cm);
        fillCascadedSelect("filter-delivery-il", ilSet, ci);
        fillCascadedSelect("filter-delivery-teminat", teminatSet, ct);
        fillCascadedSelect("filter-delivery-tedarikci", tedarikciSet, cted);
        fillCascadedSelect("filter-delivery-segment", segmentSet, cseg);
    }

    const btnResetDeliveryFilters = document.getElementById("btnResetDeliveryFilters");
    if(btnResetDeliveryFilters) {
        btnResetDeliveryFilters.addEventListener("click", () => {
            document.querySelectorAll("#teslimati-beklenen-section .filter-input").forEach(el => el.value = "");
            applyDeliveryFiltersAndSort();
        });
    }

    document.querySelectorAll("#teslimati-beklenen-section .filter-input").forEach(el => {
        el.addEventListener(el.tagName === 'SELECT' ? "change" : "input", applyDeliveryFiltersAndSort);
    });

    function applyDeliveryFiltersAndSort() {
        const fhizmet = normalizeText(document.getElementById("filter-delivery-hizmet").value || "");
        const fdosya = normalizeText(document.getElementById("filter-delivery-dosya").value || "");
        const fmusteri = (document.getElementById("filter-delivery-musteri") || {}).value;
        const fil = (document.getElementById("filter-delivery-il") || {}).value;
        const fteminat = (document.getElementById("filter-delivery-teminat") || {}).value;
        const ftedarikci = (document.getElementById("filter-delivery-tedarikci") || {}).value;
        const fpolice = normalizeText((document.getElementById("filter-delivery-police") || {}).value || "");
        const fisim = normalizeText((document.getElementById("filter-delivery-isim") || {}).value || "");
        const fsoyisim = normalizeText((document.getElementById("filter-delivery-soyisim") || {}).value || "");
        const fsegment = (document.getElementById("filter-delivery-segment") || {}).value;

        let filtered = deliveryData.filter(r => {
            if (fhizmet && !(r['Hizmet No']||"").toLocaleLowerCase("tr-TR").includes(fhizmet)) return false;
            if (fdosya && !(r['Dosya No']||"").toLocaleLowerCase("tr-TR").includes(fdosya)) return false;
            if (fpolice && !(r['Poliçe No']||"").toLocaleLowerCase("tr-TR").includes(fpolice)) return false;
            if (fisim && !(r['İsim']||"").toLocaleLowerCase("tr-TR").includes(fisim)) return false;
            if (fsoyisim && !(r['Soyisim']||"").toLocaleLowerCase("tr-TR").includes(fsoyisim)) return false;
            if (fmusteri && r['Müşteri'] !== fmusteri) return false;
            if (fil && r['İl'] !== fil) return false;
            if (fteminat && r['Teminat'] !== fteminat) return false;
            if (ftedarikci && r['Tedarikçi'] !== ftedarikci) return false;
            if (fsegment && r['Talep Edilen Araç Segmenti'] !== fsegment) return false; // Changed from 'Talep Edilen Segment'
            return true;
        });

        // Sorting
        filtered.sort((a, b) => {
            let valA = "", valB = "";
            if (deliverySortCol === "teslimat-tedarikci") { valA = a['Tedarikçi']; valB = b['Tedarikçi']; }
            else if (deliverySortCol === "teslimat-hizmet") { valA = a['Hizmet No']; valB = b['Hizmet No']; }
            else if (deliverySortCol === "teslimat-dosya") { valA = a['Dosya No']; valB = b['Dosya No']; }
            else if (deliverySortCol === "teslimat-musteri") { valA = a['Müşteri']; valB = b['Müşteri']; }
            else if (deliverySortCol === "teslimat-il") { valA = a['İl']; valB = b['İl']; }
            else if (deliverySortCol === "teslimat-teminat") { valA = a['Teminat']; valB = b['Teminat']; }
            else if (deliverySortCol === "teslimat-tarih") {
                const parseD = ds => {
                    if(!ds) return 0;
                    const p = ds.split(' ');
                    if(p.length<2) return 0;
                    const d = p[0].split('.');
                    const t = p[1].split(':');
                    return new Date(d[2], d[1]-1, d[0], t[0], t[1] || 0).getTime();
                };
                valA = parseD(a['Dosya Açılış Tarihi']);
                valB = parseD(b['Dosya Açılış Tarihi']);
                return deliverySortDesc ? valB - valA : valA - valB;
            }

            if(typeof valA === "string") {
                valA = valA || ""; valB = valB || "";
                return deliverySortDesc ? valB.localeCompare(valA, 'tr') : valA.localeCompare(valB, 'tr');
            }
            return 0;
        });

        document.querySelectorAll("#teslimatiBeklenenTable th[data-sort]").forEach(th => {
            const text = th.textContent.replace(" ⬇", "").replace(" ⬆", "").replace(" ↕", "");
            if (th.getAttribute("data-sort") === deliverySortCol) {
                th.textContent = text + (deliverySortDesc ? " ⬇" : " ⬆");
            } else {
                th.textContent = text + " ↕";
            }
        });

        renderDeliveryTable(filtered);
    }

    function renderDeliveryTable(data) {
        const badge = document.getElementById("badge-teslimati");
        if (badge) {
            badge.textContent = data.length;
            badge.classList.remove("hidden");
            badge.style.background = data.length > 0 ? '#F59E0B' : '#9CA3AF';
        }
        
        const tbody = document.querySelector("#teslimatiBeklenenTable tbody");
        if(!tbody) return;
        tbody.innerHTML = "";
        if (data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="12" style="text-align:center; padding:24px; color:var(--text-muted);">Teslimatı beklenen hizmet bulunamadı.</td></tr>`;
            return;
        }

        window.currentDeliveryFiltered = data; // Export için dışarıya alıyoruz
        
        data.forEach(r => {
            const slaText = calculateSLA(r['Dosya Açılış Tarihi']);
            const match = slaText.match(/(\d+) Saat/);
            const hours = match ? parseInt(match[1], 10) : 0;
            const slaColor = hours > 24 ? '#EF4444' : '#10B981';

            const tr = document.createElement("tr");
            
            tr.innerHTML = `
                <td style="white-space:nowrap">
                    <span class="sla-badge" style="background-color:rgba(217, 119, 6, 0.05); color:${slaColor}; padding:6px 12px; border-radius:20px; font-weight:600; font-size:0.85rem;">
                        <span style="margin-right:4px;">⏱️</span> ${slaText}
                    </span>
                    <br><span style="font-size:0.75rem; color:var(--text-muted); opacity:0.8; margin-top:4px; display:block;">Açılış: ${r['Dosya Açılış Tarihi'] || '-'}</span>
                </td>
                <td>${r['Tedarikçi'] || '-'}</td>
                <td>${r['Hizmet No'] || '-'}</td>
                <td>${r['Dosya No'] || '-'}</td>
                <td>${r['Müşteri'] || '-'}</td>
                <td>${r['İl'] || '-'}</td>
                <td>${r['Teminat'] || '-'}</td>
                <td>${r['Poliçe No'] || '-'}</td>
                <td>${r['İsim'] || '-'}</td>
                <td>${r['Soyisim'] || '-'}</td>
                <td>${r['Talep Edilen Araç Segmenti'] || '-'}</td>
                <td>
                    <button class="action-btn btn-teslimat-incele" data-dosya="${r['Dosya No']}" style="background-color:#E3F2FD; color:#1976D2; border-color:#BBDEFB; padding:6px 12px; font-size:0.9rem;">
                        <span style="margin-right:4px;">👁️</span> İncele
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
        
        document.querySelectorAll('.btn-teslimat-incele').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const dosyaNo = e.currentTarget.getAttribute('data-dosya');
                openTeslimatModal(dosyaNo);
            });
        });
    }

    // Teslimatı Beklenenler Export
    if(document.getElementById("btnExportDelivery")) {
        document.getElementById("btnExportDelivery").addEventListener("click", () => {
            if (!window.currentDeliveryFiltered || window.currentDeliveryFiltered.length === 0) {
                alert("Dışa aktarılacak kayıt bulunamadı.");
                return;
            }
            
            const excludedKeys = ['Drop Çarpan', 'Drop Toplam'];
            let csvContent = "";
            let allKeys = Object.keys(window.currentDeliveryFiltered[0]);
            
            if (!allKeys.includes("Günlük Tutar")) allKeys.push("Günlük Tutar");
            if (!allKeys.includes("Gün")) allKeys.push("Gün");
            if (!allKeys.includes("Toplam Tutarı") && !allKeys.includes("Toplam Tutar")) allKeys.push("Toplam Tutar");

            const headerKeys = allKeys.filter(key => !excludedKeys.some(ex => key.includes(ex)));
            
            csvContent += headerKeys.map(h => `"${h}"`).join(";") + "\n";
            window.currentDeliveryFiltered.forEach(r => {
                let tutarObj = { gunlukTutar: '-', gunBilgisi: '-', toplamTutar: '-' };
                if (typeof window.computeTutarsal === "function") {
                    tutarObj = window.computeTutarsal(r['Dosya No'], r);
                }
                const rGunluk = (tutarObj.gunlukTutar !== '-' && !tutarObj.gunlukTutar.toString().includes('₺') && !tutarObj.gunlukTutar.toString().includes('€')) ? tutarObj.gunlukTutar + ' ' + tutarObj.doviz : tutarObj.gunlukTutar || '-';
                const rToplam = (tutarObj.toplamTutar !== '-' && !tutarObj.toplamTutar.toString().includes('₺') && !tutarObj.toplamTutar.toString().includes('€')) ? tutarObj.toplamTutar + ' ' + tutarObj.doviz : tutarObj.toplamTutar || '-';
                
                r['Günlük Tutar'] = rGunluk;
                r['Gün'] = tutarObj.gunBilgisi;
                if(r.hasOwnProperty('Toplam Tutarı')) r['Toplam Tutarı'] = rToplam;
                else r['Toplam Tutar'] = rToplam;

                const rowData = headerKeys.map(key => {
                    let text = (r[key] || "").toString().trim().replace(/"/g, '""');
                    return `"${text}"`;
                });
                csvContent += rowData.join(";") + "\n";
            });
            
            csvContent = "\uFEFF" + csvContent;
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.setAttribute("href", url);
            link.setAttribute("download", `teslimati_beklenenler_${new Date().toISOString().split('T')[0]}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        });
    }

    if(document.getElementById("btnExportOngoing")) {
        document.getElementById("btnExportOngoing").addEventListener("click", () => {
            if (!activeRentalsData || activeRentalsData.length === 0) {
                alert("Dışa aktarılacak kayıt bulunamadı.");
                return;
            }
            const excludedKeys = ['Drop Çarpan', 'Drop Toplam', 'logs', '_acikGun'];
            let csvContent = "";
            let allKeys = Object.keys(activeRentalsData[0]);
            
            if (!allKeys.includes("Günlük Tutar")) allKeys.push("Günlük Tutar");
            if (!allKeys.includes("Gün")) allKeys.push("Gün");
            if (!allKeys.includes("Toplam Tutarı") && !allKeys.includes("Toplam Tutar")) allKeys.push("Toplam Tutar");

            const headerKeys = allKeys.filter(key => !excludedKeys.some(ex => key.includes(ex)));
            
            csvContent += headerKeys.map(h => `"${h}"`).join(";") + "\n";
            const currentOngoingFiltered = window.currentOngoingFiltered || activeRentalsData;
            
            currentOngoingFiltered.forEach(r => {
                let tutarObj = { gunlukTutar: '-', gunBilgisi: '-', toplamTutar: '-' };
                if (typeof window.computeTutarsal === "function") {
                    tutarObj = window.computeTutarsal(r['Dosya No'], r);
                }
                const rGunluk = (tutarObj.gunlukTutar !== '-' && !tutarObj.gunlukTutar.toString().includes('₺') && !tutarObj.gunlukTutar.toString().includes('€')) ? tutarObj.gunlukTutar + ' ' + tutarObj.doviz : tutarObj.gunlukTutar || '-';
                const rToplam = (tutarObj.toplamTutar !== '-' && !tutarObj.toplamTutar.toString().includes('₺') && !tutarObj.toplamTutar.toString().includes('€')) ? tutarObj.toplamTutar + ' ' + tutarObj.doviz : tutarObj.toplamTutar || '-';
                
                r['Günlük Tutar'] = rGunluk;
                r['Gün'] = tutarObj.gunBilgisi;
                if(r.hasOwnProperty('Toplam Tutarı')) r['Toplam Tutarı'] = rToplam;
                else r['Toplam Tutar'] = rToplam;

                const rowData = headerKeys.map(key => {
                    let text = (r[key] || "").toString().trim().replace(/"/g, '""');
                    return `"${text}"`;
                });
                csvContent += rowData.join(";") + "\n";
            });
            
            csvContent = "\uFEFF" + csvContent;
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.setAttribute("href", url);
            link.setAttribute("download", `kullanimi_devam_edenler_${new Date().toISOString().split('T')[0]}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        });
    }

    window.openTeslimatModal = function(dosyaNo) {
        const rowData = deliveryData.find(r => r['Dosya No'] === dosyaNo);
        if (!rowData) return;

        document.getElementById('inceleDosyaHeader').textContent = dosyaNo;
        const grid = document.getElementById('inceleGridContainer');
        grid.innerHTML = "";
        const logsContainer = document.getElementById('inceleLogsContainer');
        if (logsContainer) logsContainer.innerHTML = "";

        const excludedKeys = ['Drop Çarpan', 'Drop Toplam', 'Günlük Tutar', 'Toplam Tutar', 'logs'];

        Object.keys(rowData).forEach(key => {
            if (excludedKeys.some(ex => key.includes(ex))) return;
            
            const div = document.createElement('div');
            div.className = "modal-field";
            div.innerHTML = `
                <span class="modal-label">${key}</span>
                <div class="modal-value-box">${rowData[key] || '-'}</div>
            `;
            grid.appendChild(div);
        });

        // Inject Logs Box
        if(rowData.logs) {
            const logsBox = document.createElement('div');
            logsBox.className = "modal-field";
            logsBox.style.gridColumn = "1 / -1";
            logsBox.style.marginTop = "16px";
            
            let logsHtml = `<h3 style="margin-bottom:8px; color:var(--text-dark); border-bottom:1px solid #E5E7EB; padding-bottom:4px;">📜 Tarihçe ve Loglar</h3>`;
            if(rowData.logs && rowData.logs.length > 0) {
                logsHtml += `<ul style="list-style:none; padding:0; margin:0;">`;
                rowData.logs.forEach(log => {
                    const cleanMsg = (log.message || "").replace(" (Hasar)", "");
                    logsHtml += `<li style="padding:6px 0; border-bottom:1px dashed #F3F4F6; font-size:0.9rem;">
                        <strong style="color:var(--primary-color)">[${log.time}]</strong> 
                        <span style="font-weight:600; color:#374151;">${log.user}:</span> 
                        <span style="color:var(--text-muted)">${cleanMsg}</span>
                    </li>`;
                });
                logsHtml += `</ul>`;
            } else {
                logsHtml += `<p style="color:var(--text-muted); font-size:0.9rem;">Henüz bir eylem kaydedilmedi.</p>`;
            }
            logsBox.innerHTML = logsHtml;
            if (document.getElementById('inceleLogsContainer')) document.getElementById('inceleLogsContainer').appendChild(logsBox);
        }
        
        if (typeof populateTutarsalVeriler === "function") populateTutarsalVeriler(dosyaNo, rowData, grid);
        
        currentDosyaNo = dosyaNo;
        const footer = document.getElementById('inceleModalFooter');
        if (footer) {
            if (user && user.atamaYetkisi && user.atamaYetkisi.trim().toLowerCase() === "evet") {
                footer.classList.remove("hidden");
            } else {
                footer.classList.add("hidden");
            }
        }
        
        document.getElementById('inceleModal').classList.remove("hidden");
    };

    // 11.5 Kullanımı Devam Eden Hizmetler Logic
    let activeRentalsData = [];
    let activeSortCol = "ongoing-tarih";
    let activeSortDesc = true;

    window.loadActiveRentalsData = function() {
        const assignments = JSON.parse(localStorage.getItem('crosslink_assignments') || "{}");
        activeRentalsData = Object.values(assignments).filter(a => {
            const dn = a.fullData ? a.fullData['Dosya No'] : null;
            if(!dn) return false;
            const isTeslimat = localStorage.getItem("crosslink_teslimat_" + dn) === "true";
            const isIade = localStorage.getItem("crosslink_iade_date_" + dn) ? true : false;
            return isTeslimat && !isIade;
        }).map(a => {
            const dn = a.fullData ? a.fullData['Dosya No'] : null;
            if(!dn) return a;
            const teslimStr = localStorage.getItem("crosslink_teslimat_date_" + dn) || "";
            const iadeStr = localStorage.getItem("crosslink_iade_date_" + dn) || "";
            const hakedisStr = localStorage.getItem("crosslink_hakedis_date_" + dn) || "";
            
            const plaka = localStorage.getItem("crosslink_plaka_" + dn) || "-";
            const marka = localStorage.getItem("crosslink_marka_" + dn) || "-";
            const model = localStorage.getItem("crosslink_model_" + dn) || "-";
            const km = localStorage.getItem("crosslink_km_" + dn) || "-";
            const yil = localStorage.getItem("crosslink_yil_" + dn) || "-";
            const segment = localStorage.getItem("crosslink_segment_" + dn) || "-";

            if (a.fullData) {
                a.fullData['Tedarikçi Adı'] = a.supplier;
                a.fullData['Tedarikçi'] = a.supplier;
                
                // Dynamic Pricing Calculation: Decrease price if provided segment is cheaper than requested segment
                const isteneSegment = a.fullData['Talep Edilen Araç Segmenti'] || "";
                if (segment && segment !== "-" && isteneSegment && segment !== isteneSegment && typeof supplierPricingData !== 'undefined') {
                    const normSupName = normalizeForSearch(a.supplier);
                    const musteriQuery = (a.fullData['Müşteri'] || "").toLowerCase().trim();
                    let matchedPricing = supplierPricingData.find(p => normalizeForSearch(p['Tedarikçi']) === normSupName && (p['Müşteri'] || "").toLowerCase().trim() === musteriQuery);
                    if (!matchedPricing) {
                        matchedPricing = supplierPricingData.find(p => normalizeForSearch(p['Tedarikçi']) === normSupName && (p['Müşteri'] || "").toLowerCase().includes("varsay"));
                    }
                    if (matchedPricing) {
                        const isteneCol = Object.keys(matchedPricing).find(k => k.toLowerCase().trim() === isteneSegment.toLowerCase().trim());
                        const givenCol = Object.keys(matchedPricing).find(k => k.toLowerCase().trim() === segment.toLowerCase().trim());
                        
                        if (isteneCol && givenCol && matchedPricing[isteneCol] && matchedPricing[givenCol]) {
                            const reqPriceRaw = parseFloat(String(matchedPricing[isteneCol]).replace(/\./g, "").replace(/,/g, "."));
                            const givenPriceRaw = parseFloat(String(matchedPricing[givenCol]).replace(/\./g, "").replace(/,/g, "."));
                            
                            if (!isNaN(reqPriceRaw) && !isNaN(givenPriceRaw) && givenPriceRaw < reqPriceRaw) {
                                a.gunlukTutar = String(matchedPricing[givenCol]); // Re-assign natively to cheaper given segment price
                            }
                        }
                    }
                }
                
                if (a.gunlukTutar) a.fullData['Günlük Tutar'] = a.gunlukTutar;
                
                a.fullData['Teslimat Tarihi'] = teslimStr || "-"; // Binds logically to the expected modal box
                a.fullData['İade Tarihi'] = iadeStr || "-";
                a.fullData['Hakediş Tarihi'] = hakedisStr || "-";
                
                a.fullData['Araç Teslim Tarihi'] = teslimStr;
                a.fullData['Plaka'] = plaka;
                a.fullData['Marka'] = marka;
                a.fullData['Model'] = model;
                a.fullData['Kilometre'] = km;
                a.fullData['Araç Yılı'] = yil;
                a.fullData['İkame Araç Segmenti'] = segment; // Assured fallback mapping
            }

            return {
                ...a.fullData,
                'Tedarikçi': a.supplier,
                'Araç Teslim Tarihi': teslimStr,
                'logs': a.logs
            };
        });
        
        populateOngoingFilters(activeRentalsData);
        applyOngoingFiltersAndSort();
    };

    document.querySelectorAll("#kullanimiDevamEdenTable th[data-sort]").forEach(th => {
        th.style.cursor = "pointer";
        th.addEventListener("click", () => {
            const col = th.getAttribute("data-sort");
            if (activeSortCol === col) {
                activeSortDesc = !activeSortDesc;
            } else {
                activeSortCol = col;
                activeSortDesc = false;
            }
            applyOngoingFiltersAndSort();
        });
    });

    function populateOngoingFilters(data) {
        const fillSelect = (id, fieldName) => {
            const set = new Set(data.map(d => d[fieldName]).filter(Boolean));
            const el = document.getElementById(id);
            if (!el) return;
            const currentVal = el.value;
            el.innerHTML = '<option value="">Tümü</option>';
            Array.from(set).sort((a,b)=>a.localeCompare(b,'tr')).forEach(val => {
                const opt = document.createElement("option");
                opt.value = val;
                opt.textContent = val;
                if (val === currentVal) opt.selected = true;
                el.appendChild(opt);
            });
        };

        fillSelect("filter-ongoing-tedarikci", "Tedarikçi");
        fillSelect("filter-ongoing-il", "İl");
        fillSelect("filter-ongoing-segment", "Talep Edilen Araç Segmenti");
        fillSelect("filter-ongoing-musteri", "Müşteri");
        fillSelect("filter-ongoing-teminat", "Teminat");
    }

    const btnResetOngoingFilters = document.getElementById("btnResetOngoingFilters");
    if(btnResetOngoingFilters) {
        btnResetOngoingFilters.addEventListener("click", () => {
            document.querySelectorAll("#kullanimi-devam-eden-section .filter-input").forEach(el => el.value = "");
            applyOngoingFiltersAndSort();
        });
    }

    document.querySelectorAll("#kullanimi-devam-eden-section .filter-input").forEach(el => {
        el.addEventListener(el.tagName === 'SELECT' ? "change" : "input", applyOngoingFiltersAndSort);
    });

    function applyOngoingFiltersAndSort() {
        const fdosya = normalizeText(document.getElementById("filter-ongoing-dosya")?.value || "");
        const fhizmet = normalizeText(document.getElementById("filter-ongoing-hizmet")?.value || "");
        const ftedarikci = (document.getElementById("filter-ongoing-tedarikci") || {}).value;
        const fil = (document.getElementById("filter-ongoing-il") || {}).value;
        const fseg = (document.getElementById("filter-ongoing-segment") || {}).value;

        const fmusteri = (document.getElementById("filter-ongoing-musteri") || {}).value;
        const fpolice = normalizeText(document.getElementById("filter-ongoing-police")?.value || "");
        const fisim = normalizeText(document.getElementById("filter-ongoing-isim")?.value || "");
        const fsoyisim = normalizeText(document.getElementById("filter-ongoing-soyisim")?.value || "");
        const fteminat = (document.getElementById("filter-ongoing-teminat") || {}).value;

        let filtered = activeRentalsData.filter(r => {
            if (fdosya && !(r['Dosya No']||"").toLocaleLowerCase("tr-TR").includes(fdosya)) return false;
            if (fhizmet && !(r['Hizmet No']||"").toLocaleLowerCase("tr-TR").includes(fhizmet)) return false;
            if (fpolice && !(r['Poliçe No']||"").toLocaleLowerCase("tr-TR").includes(fpolice)) return false;
            if (fisim && !(r['İsim']||"").toLocaleLowerCase("tr-TR").includes(fisim)) return false;
            if (fsoyisim && !(r['Soyisim']||"").toLocaleLowerCase("tr-TR").includes(fsoyisim)) return false;

            if (ftedarikci && r['Tedarikçi'] !== ftedarikci) return false;
            if (fil && r['İl'] !== fil) return false;
            if (fseg && r['Talep Edilen Araç Segmenti'] !== fseg) return false;
            if (fmusteri && r['Müşteri'] !== fmusteri) return false;
            if (fteminat && r['Teminat'] !== fteminat) return false;
            
            return true;
        });

        // Evaluate Açık Kullanım Günü dynamically
        filtered.forEach(r => {
            let acikGun = 0;
            if (r['Araç Teslim Tarihi']) {
                 try {
                     const p = r['Araç Teslim Tarihi'].split(' ')[0].split('.');
                     if (p.length === 3) {
                         const d = new Date(p[2], p[1]-1, p[0]);
                         d.setHours(0,0,0,0);
                         const cur = new Date();
                         cur.setHours(0,0,0,0);
                         const diffHours = Math.abs(cur - d) / (1000 * 60 * 60);
                         
                         if (diffHours <= 27) {
                             acikGun = 1;
                         } else {
                             acikGun = Math.ceil((diffHours - 27) / 24) + 1;
                         }
                     }
                 } catch(e) {}
            }
            r._acikGun = acikGun;
        });

        filtered.sort((a, b) => {
            let valA = "", valB = "";
            if (activeSortCol === "ongoing-tedarikci") { valA = a['Tedarikçi']; valB = b['Tedarikçi']; }
            else if (activeSortCol === "ongoing-dosya") { valA = a['Dosya No']; valB = b['Dosya No']; }
            else if (activeSortCol === "ongoing-tarih") {
                const parseD = ds => {
                    if(!ds) return 0;
                    const p = ds.split(' ');
                    if(p.length<2) return 0;
                    const d = p[0].split('.');
                    const t = p[1].split(':');
                    return new Date(d[2], d[1]-1, d[0], t[0], t[1] || 0).getTime();
                };
                valA = parseD(a['Dosya Açılış Tarihi']);
                valB = parseD(b['Dosya Açılış Tarihi']);
                return activeSortDesc ? valB - valA : valA - valB;
            }
            else if (activeSortCol === "ongoing-teslimat") {
                const parseD = ds => {
                    if(!ds) return 0;
                    const p = ds.split(' ');
                    const d = p[0].split('.');
                    return new Date(d[2], d[1]-1, d[0]).getTime();
                };
                valA = parseD(a['Araç Teslim Tarihi']);
                valB = parseD(b['Araç Teslim Tarihi']);
                return activeSortDesc ? valB - valA : valA - valB;
            }
            else if (activeSortCol === "ongoing-gun") {
                return activeSortDesc ? b._acikGun - a._acikGun : a._acikGun - b._acikGun;
            }
            else if (activeSortCol === "ongoing-musteri") { valA = a['Müşteri']; valB = b['Müşteri']; }
            else if (activeSortCol === "ongoing-il") { valA = a['İl']; valB = b['İl']; }
            else if (activeSortCol === "ongoing-segment") { valA = a['Talep Edilen Araç Segmenti']; valB = b['Talep Edilen Araç Segmenti']; }

            if(typeof valA === "string") {
                valA = valA || ""; valB = valB || "";
                return activeSortDesc ? valB.localeCompare(valA, 'tr') : valA.localeCompare(valB, 'tr');
            }
            return 0;
        });

        document.querySelectorAll("#kullanimiDevamEdenTable th[data-sort]").forEach(th => {
            const text = th.textContent.replace(" ⬇", "").replace(" ⬆", "").replace(" ↕", "");
            if (th.getAttribute("data-sort") === activeSortCol) {
                th.textContent = text + (activeSortDesc ? " ⬇" : " ⬆");
            } else {
                th.textContent = text + " ↕";
            }
        });

        renderOngoingTable(filtered);
    }

    function renderOngoingTable(data) {
        const badge = document.getElementById("badge-devam");
        if (badge) {
            badge.textContent = data.length;
            badge.classList.remove("hidden");
            badge.style.background = data.length > 0 ? '#3B82F6' : '#9CA3AF';
        }

        const tbody = document.querySelector("#kullanimiDevamEdenTable tbody");
        if(!tbody) return;
        tbody.innerHTML = "";

        if (data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding:24px; color:var(--text-muted);">Kullanımı devam eden hizmet bulunamadı.</td></tr>`;
            return;
        }

        data.forEach(r => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td style="white-space:nowrap">
                    <span class="sla-badge" style="background-color:rgba(59, 130, 246, 0.08); color:#3B82F6; padding:6px 12px; border-radius:20px; font-weight:600; font-size:0.85rem;">
                        <span style="margin-right:4px;">🚗</span> ${r['Tedarikçi'] || '-'}
                    </span>
                </td>
                <td>${r['Hizmet No'] || '-'}</td>
                <td>${r['Dosya No'] || '-'}</td>
                <td>${r['Müşteri'] || '-'}</td>
                <td>${r['İsim'] || '-'}</td>
                <td>${r['Soyisim'] || '-'}</td>
                <td>${r['İl'] || '-'}</td>
                <td>${r['Araç Teslim Tarihi'] || '-'}</td>
                <td>${r._acikGun > 0 ? r._acikGun : '1'} Gün</td>
                <td>${r['Teminat'] || '-'}</td>
                <td>${r['Talep Edilen Araç Segmenti'] || '-'}</td>
                <td>
                    <button class="action-btn btn-ongoing-incele" data-dosya="${r['Dosya No']}" style="background-color:#FFFBEB; color:#D97706; border-color:#FDE68A; padding:6px 12px; font-size:0.9rem;">
                        <span style="margin-right:4px;">👁️</span> İncele
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        document.querySelectorAll('.btn-ongoing-incele').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                openOngoingModal(e.currentTarget.getAttribute('data-dosya'));
            });
        });
    }

    window.openOngoingModal = function(dosyaNo) {
        const rowData = activeRentalsData.find(r => r['Dosya No'] === dosyaNo);
        if (!rowData) return;

        // Merge localStorage supplier-entered values into display data
        const lsMerge = {
            'Drop KM':         localStorage.getItem('crosslink_drop_km_' + dosyaNo) || rowData['Drop Kilometre'] || rowData['Drop KM'],
            'Plaka':           localStorage.getItem('crosslink_plaka_' + dosyaNo),
            'Marka':           localStorage.getItem('crosslink_marka_' + dosyaNo),
            'Model':           localStorage.getItem('crosslink_model_' + dosyaNo),
            'Segment':         localStorage.getItem('crosslink_segment_' + dosyaNo),
            'Kilometre':       localStorage.getItem('crosslink_km_' + dosyaNo),
            'Araç Yılı':       localStorage.getItem('crosslink_yil_' + dosyaNo),
            'Teslimat Tarihi': localStorage.getItem('crosslink_teslimat_date_' + dosyaNo),
            'İade Tarihi':     localStorage.getItem('crosslink_iade_date_' + dosyaNo),
        };
        const mergedData = { ...rowData };
        Object.entries(lsMerge).forEach(([k, v]) => { if (v) mergedData[k] = v; });

        document.getElementById('inceleDosyaHeader').textContent = dosyaNo;
        const grid = document.getElementById('inceleGridContainer');
        grid.innerHTML = "";
        const logsContainer = document.getElementById('inceleLogsContainer');
        if (logsContainer) logsContainer.innerHTML = "";

        const excludedKeys = ['Drop Çarpan', 'Drop Toplam', 'Günlük Tutar', 'Toplam Tutar', 'logs', '_acikGun', 'Araç Teslim Tarihi', 'Tedarikçi Adı', 'Tedarikçi'];

        Object.keys(mergedData).forEach(key => {
            if (excludedKeys.some(ex => key.includes(ex))) return;
            const div = document.createElement('div');
            div.className = "modal-field";
            div.innerHTML = `<span class="modal-label">${key}</span><div class="modal-value-box">${mergedData[key] || '-'}</div>`;
            grid.appendChild(div);
        });


        if(rowData.logs) {
            const logsBox = document.createElement('div');
            logsBox.className = "modal-field";
            logsBox.style.gridColumn = "1 / -1";
            logsBox.style.marginTop = "16px";
            
            let logsHtml = `<h3 style="margin-bottom:8px; color:var(--text-dark); border-bottom:1px solid #E5E7EB; padding-bottom:4px;">📜 Tarihçe ve Loglar</h3>`;
            if(rowData.logs && rowData.logs.length > 0) {
                logsHtml += `<ul style="list-style:none; padding:0; margin:0;">`;
                rowData.logs.forEach(log => {
                    const cleanMsg = (log.message || "").replace(" (Hasar)", "");
                    logsHtml += `<li style="padding:6px 0; border-bottom:1px dashed #F3F4F6; font-size:0.9rem;">
                        <strong style="color:var(--primary-color)">[${log.time}]</strong> 
                        <span style="font-weight:600; color:#374151;">${log.user}:</span> 
                        <span style="color:var(--text-muted)">${cleanMsg}</span>
                    </li>`;
                });
                logsHtml += `</ul>`;
            } else {
                logsHtml += `<p style="color:var(--text-muted); font-size:0.9rem;">Henüz bir eylem kaydedilmedi.</p>`;
            }
            logsBox.innerHTML = logsHtml;
            if (document.getElementById('inceleLogsContainer')) document.getElementById('inceleLogsContainer').appendChild(logsBox);
        }

        if (typeof populateTutarsalVeriler === "function") populateTutarsalVeriler(dosyaNo, rowData, grid);
        if (document.getElementById('inceleModalFooter')) document.getElementById('inceleModalFooter').classList.add("hidden");
        document.getElementById('inceleModal').classList.remove("hidden");
    };

    function populateCompletedFilters(data) {
        const tedarikciSet = new Set();
        const yilSet = new Set();
        const musteriSet = new Set();
        const ilSet = new Set();
        const teminatSet = new Set();

        data.forEach(r => {
            if (r['Tedarikçi']) tedarikciSet.add(r['Tedarikçi']);
            if (r['Müşteri']) musteriSet.add(r['Müşteri']);
            if (r['İl']) ilSet.add(r['İl']);
            if (r['Teminat']) teminatSet.add(r['Teminat']);
            if (r['Dosya Açılış Tarihi']) {
                const parts = r['Dosya Açılış Tarihi'].split(" ");
                if (parts[0]) {
                    const dateParts = parts[0].split(".");
                    if (dateParts.length === 3) {
                        yilSet.add(dateParts[2]);
                    }
                }
            }
        });

        const fillSelect = (id, set) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.innerHTML = '<option value="">Tümü</option>';
            Array.from(set).sort((a,b)=>a.localeCompare(b,'tr')).forEach(val => {
                const opt = document.createElement("option");
                opt.value = val;
                opt.textContent = val;
                el.appendChild(opt);
            });
        };

        fillSelect("filter-completed-tedarikci", tedarikciSet);
        fillSelect("filter-completed-yil", yilSet);
        fillSelect("filter-completed-musteri", musteriSet);
        fillSelect("filter-completed-il", ilSet);
        fillSelect("filter-completed-teminat", teminatSet);
    }

    const btnResetCompletedFilters = document.getElementById("btnResetCompletedFilters");
    if(btnResetCompletedFilters) {
        btnResetCompletedFilters.addEventListener("click", () => {
            document.querySelectorAll("#kullanimi-biten-section .filter-input").forEach(el => el.value = "");
            applyCompletedFiltersAndSort();
        });
    }

    document.querySelectorAll("#kullanimi-biten-section .filter-input").forEach(el => {
        if (el.tagName === 'SELECT') {
            el.addEventListener("change", applyCompletedFiltersAndSort);
        } else {
            el.addEventListener("input", applyCompletedFiltersAndSort);
        }
    });

    function applyCompletedFiltersAndSort() {
        const fhizmet = normalizeText(document.getElementById("filter-completed-hizmet").value);
        const fdosya = normalizeText(document.getElementById("filter-completed-dosya").value);
        const fyil = document.getElementById("filter-completed-yil").value;
        const fay = document.getElementById("filter-completed-ay").value;
        const fpolice = normalizeText(document.getElementById("filter-completed-police").value);

        const fmusteri = document.getElementById("filter-completed-musteri").value;
        const fil = document.getElementById("filter-completed-il").value;
        const fteminat = document.getElementById("filter-completed-teminat").value;
        const ftedarikci = document.getElementById("filter-completed-tedarikci").value;

        const getCompletedFilteredFor = (skipField) => {
            return completedData.filter(r => {
                if (fhizmet && !(r['Hizmet No']||"").toLocaleLowerCase("tr-TR").includes(fhizmet)) return false;
                if (fdosya && !(r['Dosya No']||"").toLocaleLowerCase("tr-TR").includes(fdosya)) return false;
                if (fpolice && !(r['Poliçe No']||"").toLocaleLowerCase("tr-TR").includes(fpolice)) return false;

                if (fyil || fay) {
                    if (!r['Dosya Açılış Tarihi']) return false;
                    const parts = r['Dosya Açılış Tarihi'].split(" ");
                    if (!parts[0]) return false;
                    const dateParts = parts[0].split(".");
                    if (dateParts.length !== 3) return false;

                    if (fyil && dateParts[2] !== fyil) return false;
                    const parsedAy = parseInt(dateParts[1], 10).toString().padStart(2, '0');
                    if (fay && parsedAy !== fay) return false;
                }

                if (skipField !== 'musteri' && fmusteri && r['Müşteri'] !== fmusteri) return false;
                if (skipField !== 'il' && fil && r['İl'] !== fil) return false;
                if (skipField !== 'teminat' && fteminat && r['Teminat'] !== fteminat) return false;
                if (skipField !== 'tedarikci' && ftedarikci && r['Tedarikçi'] !== ftedarikci) return false;

                return true;
            });
        };

        const musteriData = getCompletedFilteredFor('musteri');
        const ilData = getCompletedFilteredFor('il');
        const teminatData = getCompletedFilteredFor('teminat');
        const tedarikciData = getCompletedFilteredFor('tedarikci');

        const fillCascadedSelect = (id, dataSet, field, currentVal) => {
            const set = new Set(dataSet.map(d => d[field]).filter(Boolean));
            const el = document.getElementById(id);
            if (!el) return;
            el.innerHTML = '<option value="">Tümü</option>';
            Array.from(set).sort((a,b)=>a.localeCompare(b,'tr')).forEach(val => {
                const opt = document.createElement("option");
                opt.value = val;
                opt.textContent = val;
                if (val === currentVal) opt.selected = true;
                el.appendChild(opt);
            });
        };

        fillCascadedSelect("filter-completed-musteri", musteriData, 'Müşteri', fmusteri);
        fillCascadedSelect("filter-completed-il", ilData, 'İl', fil);
        fillCascadedSelect("filter-completed-teminat", teminatData, 'Teminat', fteminat);
        fillCascadedSelect("filter-completed-tedarikci", tedarikciData, 'Tedarikçi', ftedarikci);

        let filtered = getCompletedFilteredFor('none');
        window.currentCompletedFiltered = filtered;

        // Sort
        filtered.sort((a, b) => {
            let va = ""; let vb = "";
            switch (completedSortCol) {
                case "completed-sla":
                    const parseSLA = (acilis, teslim) => {
                         const d = calculateCompletedSLA(acilis, teslim);
                         if(d === "Bilinmiyor" || d === "Okunamadı" || d === "Hatalı Veri") return 0;
                         const match = d.match(/(\d+) Saat (\d+)/);
                         if(match) return parseInt(match[1])*60 + parseInt(match[2]);
                         return 0;
                    };
                    const slaA = parseSLA(a['Dosya Açılış Tarihi'], a['CG Teslimat Tarihi']);
                    const slaB = parseSLA(b['Dosya Açılış Tarihi'], b['CG Teslimat Tarihi']);
                    return completedSortDesc ? slaB - slaA : slaA - slaB;
                case "completed-hizmet": va = a['Hizmet No']||""; vb = b['Hizmet No']||""; break;
                case "completed-tedarikci": va = a['Tedarikçi']||""; vb = b['Tedarikçi']||""; break;
                case "completed-dosya": va = a['Dosya No']||""; vb = b['Dosya No']||""; break;
                case "completed-tarih": 
                    const da = a['Dosya Açılış Tarihi'] || "";
                    const db = b['Dosya Açılış Tarihi'] || "";
                    va = da.split(' ')[0].split('.').reverse().join('') + (da.split(' ')[1]||''); 
                    vb = db.split(' ')[0].split('.').reverse().join('') + (db.split(' ')[1]||'');
                    break;
                case "completed-musteri": va = a['Müşteri']||""; vb = b['Müşteri']||""; break;
                case "completed-il": va = a['İl']||""; vb = b['İl']||""; break;
                case "completed-teminat": va = a['Teminat']||""; vb = b['Teminat']||""; break;
                case "completed-segment": va = a['İkame Araç Segmenti']||""; vb = b['İkame Araç Segmenti']||""; break;
                case "completed-gun": va = (a['Gün']||"").toString().padStart(5, '0'); vb = (b['Gün']||"").toString().padStart(5, '0'); break;
                case "completed-police": va = a['Poliçe No']||""; vb = b['Poliçe No']||""; break;
                case "completed-isim": va = a['İsim']||""; vb = b['İsim']||""; break;
                case "completed-soyisim": va = a['Soyisim']||""; vb = b['Soyisim']||""; break;
            }

            if (typeof va === "string" && typeof vb === "string") {
                return completedSortDesc ? vb.localeCompare(va, "tr") : va.localeCompare(vb, "tr");
            }
            return 0; 
        });

        // Headers
        document.querySelectorAll("#completedTable th[data-sort]").forEach(th => {
            const text = th.textContent.replace(" ⬆", "").replace(" ⬇", "").replace(" ↕", "");
            if (th.getAttribute("data-sort") === completedSortCol) {
                th.textContent = text + (completedSortDesc ? " ⬇" : " ⬆");
            } else {
                th.textContent = text + " ↕";
            }
        });

        renderCompletedTable(filtered);
    }

    function renderCompletedTable(data) {
        const badge = document.getElementById("badge-biten");
        if (badge) {
            badge.textContent = data.length;
            badge.classList.remove("hidden");
            badge.style.background = data.length > 0 ? '#10B981' : '#9CA3AF';
        }

        const tbody = document.querySelector("#completedTable tbody");
        tbody.innerHTML = "";

        if (data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding:24px; color:var(--text-muted);">Kritere uygun kayıt bulunamadı.</td></tr>`;
            return;
        }

        data.forEach(r => {
            const slaText = calculateCompletedSLA(r['Dosya Açılış Tarihi'], r['CG Teslimat Tarihi']);
            const match = slaText.match(/(\d+) Saat/);
            const hours = match ? parseInt(match[1], 10) : 0;
            const slaColor = hours > 24 ? '#EF4444' : '#10B981';

            const tr = document.createElement("tr");

            tr.innerHTML = `
                <td style="white-space:nowrap"><span class="sla-badge" style="background-color:rgba(248, 140, 66, 0.05); color:${slaColor}; padding:6px 12px; border-radius:20px; font-weight:600; font-size:0.85rem;"><span style="margin-right:4px;">⏱️</span> ${slaText}</span></td>
                <td><span class="status-badge status-closed">${r['Tedarikçi'] || '-'}</span></td>
                <td>${r['Hizmet No'] || '-'}</td>
                <td>${r['Dosya No'] || '-'}</td>
                <td style="white-space:nowrap">${r['Dosya Açılış Tarihi'] || '-'}</td>
                <td>${r['Müşteri'] || '-'}</td>
                <td>${r['İl'] || '-'}</td>
                <td>${r['Teminat'] || '-'}</td>
                <td>${r['İkame Araç Segmenti'] || '-'}</td>
                <td>${r['Gün'] || '-'}</td>
                <td>${r['Poliçe No'] || '-'}</td>
                <td>${r['İsim'] || '-'}</td>
                <td>${r['Soyisim'] || '-'}</td>
                <td>
                    <button class="action-btn btn-incele" data-dosya="${r['Dosya No']}" style="background-color:#E3F2FD; color:#1976D2; border-color:#BBDEFB; padding:6px 12px; font-size:0.9rem;">
                        <span style="margin-right:4px;">👁️</span> İncele
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        document.querySelectorAll('.btn-incele').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const dosyaNo = e.currentTarget.getAttribute('data-dosya');
                openInceleModal(dosyaNo);
            });
        });
    }

    // Modal Events Completed
    window.openInceleModal = function(dosyaNo) {
        const rowData = completedData.find(r => r['Dosya No'] === dosyaNo);
        if (!rowData) return;

        document.getElementById('inceleDosyaHeader').textContent = dosyaNo;
        const grid = document.getElementById('inceleGridContainer');
        grid.innerHTML = "";
        const logsContainer = document.getElementById('inceleLogsContainer');
        if (logsContainer) logsContainer.innerHTML = "";

        const excludedKeys = ['Drop Çarpan', 'Drop Toplam', 'Günlük Tutar', 'Toplam Tutar'];

        Object.keys(rowData).forEach(key => {
            if (excludedKeys.some(ex => key.includes(ex))) return;
            
            const div = document.createElement('div');
            div.className = "modal-field";
            div.innerHTML = `
                <span class="modal-label">${key}</span>
                <div class="modal-value-box">${rowData[key] || '-'}</div>
            `;
            grid.appendChild(div);
        });

        if (typeof populateTutarsalVeriler === "function") populateTutarsalVeriler(dosyaNo, rowData, grid);
        if (document.getElementById('inceleModalFooter')) document.getElementById('inceleModalFooter').classList.add("hidden");
        document.getElementById('inceleModal').classList.remove("hidden");
    };

    document.getElementById('closeInceleModal').addEventListener('click', () => {
        document.getElementById('inceleModal').classList.add("hidden");
    });
    
    if (document.getElementById('btnInceleTedarikciDegistir')) {
        document.getElementById('btnInceleTedarikciDegistir').addEventListener('click', () => {
            document.getElementById('inceleModal').classList.add("hidden");
            // Reuse the existing populated supplier selection logic!
            document.getElementById('btnTedarikciSec').click();
        });
    }

    document.getElementById("btnExportCompleted").addEventListener("click", () => {
        if (!window.currentCompletedFiltered || window.currentCompletedFiltered.length === 0) {
            alert("Dışa aktarılacak kayıt bulunamadı.");
            return;
        }

        const excludedKeys = ['Drop Çarpan', 'Drop Toplam'];
        let csvContent = "";
        
        let allKeys = Object.keys(window.currentCompletedFiltered[0]);
        if (!allKeys.includes("Günlük Tutar")) allKeys.push("Günlük Tutar");
        if (!allKeys.includes("Gün")) allKeys.push("Gün");
        if (!allKeys.includes("Toplam Tutarı") && !allKeys.includes("Toplam Tutar")) allKeys.push("Toplam Tutar");

        const headerKeys = allKeys.filter(key => !excludedKeys.some(ex => key.includes(ex)));
        
        csvContent += headerKeys.map(h => `"${h}"`).join(";") + "\n";

        window.currentCompletedFiltered.forEach(r => {
            let tutarObj = { gunlukTutar: '-', gunBilgisi: '-', toplamTutar: '-' };
            if (typeof window.computeTutarsal === "function") {
                tutarObj = window.computeTutarsal(r['Dosya No'], r);
            }
            const rGunluk = (tutarObj.gunlukTutar !== '-' && !tutarObj.gunlukTutar.toString().includes('₺') && !tutarObj.gunlukTutar.toString().includes('€')) ? tutarObj.gunlukTutar + ' ' + tutarObj.doviz : tutarObj.gunlukTutar || '-';
            const rToplam = (tutarObj.toplamTutar !== '-' && !tutarObj.toplamTutar.toString().includes('₺') && !tutarObj.toplamTutar.toString().includes('€')) ? tutarObj.toplamTutar + ' ' + tutarObj.doviz : tutarObj.toplamTutar || '-';
            
            r['Günlük Tutar'] = rGunluk;
            r['Gün'] = tutarObj.gunBilgisi;
            if(r.hasOwnProperty('Toplam Tutarı')) r['Toplam Tutarı'] = rToplam;
            else r['Toplam Tutar'] = rToplam;

            const rowData = headerKeys.map(key => {
                let text = (r[key] || "").toString().trim().replace(/"/g, '""');
                return `"${text}"`;
            });
            csvContent += rowData.join(";") + "\n";
        });

        const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `Kullanimi_Biten_Hizmetler_Detayli_${new Date().toLocaleDateString('tr-TR')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });

});

// ==========================================
// Tutarsal Veriler Popülasyon ve Hesaplama Modülü
// ==========================================
window.computeTutarsal = function(dosyaNo, rowData) {
    let gunlukTutarText = '-';
    let gunBilgisiText = '-';
    let toplamTutarText = '-';
    let dovizText = '₺'; // default TL

    // 1. Excel'den Direkt Çekmeyi Dene
    if (rowData && rowData['Günlük Tutar']) {
        gunlukTutarText = rowData['Günlük Tutar'];
    }
    if (rowData && rowData['Gün']) {
        gunBilgisiText = rowData['Gün'] + ' Gün';
    }
    if (rowData && (rowData['Toplam Tutarı'] || rowData['Toplam Tutar'] || rowData['Toplam Hizmet Tutarı'])) {
        toplamTutarText = rowData['Toplam Tutarı'] || rowData['Toplam Tutar'] || rowData['Toplam Hizmet Tutarı'];
    }

    // 2. Günlük Tutar yoksa Assignment'dan al
    let assignments = JSON.parse(localStorage.getItem('crosslink_assignments') || '{}');
    let assigned = assignments[dosyaNo];
    if ((gunlukTutarText === '-' || !gunlukTutarText) && assigned && assigned.gunlukTutar && assigned.gunlukTutar !== '-') {
        gunlukTutarText = assigned.gunlukTutar;
        if (assigned.doviz) dovizText = assigned.doviz === 'TL' ? '₺' : assigned.doviz;
    }

    // 3. Gün Bilgisi yoksa (Devam Eden/Beklenen süreçler), Hakediş/İade vs Teslimat üzerinden hesapla
    if (gunBilgisiText === '-' || !gunBilgisiText || gunBilgisiText === ' Gün') {
        let tesDateStr = rowData ? rowData['Teslimat Tarihi'] : null;
        let hakedisDateStr = rowData ? rowData['Hakediş Tarihi'] : null;
        let iadeDateStr = rowData ? rowData['İade Tarihi'] : null;

        const localTes = localStorage.getItem("crosslink_teslimat_date_" + dosyaNo);
        if (localTes) tesDateStr = localTes;
        const localIade = localStorage.getItem("crosslink_iade_date_" + dosyaNo);
        if (localIade) iadeDateStr = localIade;

        let endDateStr = null;
        if (hakedisDateStr && hakedisDateStr !== '-' && hakedisDateStr.trim() !== '') {
            endDateStr = hakedisDateStr;
        } else if (iadeDateStr && iadeDateStr !== '-' && iadeDateStr.trim() !== '') {
            endDateStr = iadeDateStr;
        }

        if (tesDateStr && tesDateStr !== '-' && endDateStr) {
            const parseTurkishDateObj = (dateStr) => {
                if (!dateStr || typeof dateStr !== 'string') return null;
                const parts = dateStr.trim().split(' ')[0].split('.');
                if (parts.length === 3) return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
                return null;
            };

            const pTes = parseTurkishDateObj(tesDateStr);
            const pEnd = parseTurkishDateObj(endDateStr);
            
            if (pTes && pEnd) {
                const diffTime = Math.abs(pEnd - pTes);
                let diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                if(diffDays === 0) diffDays = 1;

                if (!isNaN(diffDays)) {
                    gunBilgisiText = diffDays + ' Gün';
                    
                    if (gunlukTutarText !== '-' && (toplamTutarText === '-' || !toplamTutarText)) {
                        let parsedTutar = parseFloat(gunlukTutarText.toString().replace(/\./g, '').replace(',', '.'));
                        if (!isNaN(parsedTutar)) {
                            let top = parsedTutar * diffDays;
                            toplamTutarText = new Intl.NumberFormat('tr-TR').format(top);
                        }
                    }
                }
            }
        }
    }

    return { 
        gunlukTutar: gunlukTutarText, 
        gunBilgisi: gunBilgisiText, 
        toplamTutar: toplamTutarText, 
        doviz: dovizText 
    };
};

window.populateTutarsalVeriler = function(dosyaNo, rowData, gridContainer) {
    if (!gridContainer) return;
    const vals = window.computeTutarsal(dosyaNo, rowData);

    const fGunluk = (vals.gunlukTutar !== '-' && !vals.gunlukTutar.toString().includes('₺') && !vals.gunlukTutar.toString().includes('€')) ? vals.gunlukTutar + ' ' + vals.doviz : vals.gunlukTutar || '-';
    const fToplam = (vals.toplamTutar !== '-' && !vals.toplamTutar.toString().includes('₺') && !vals.toplamTutar.toString().includes('€')) ? vals.toplamTutar + ' ' + vals.doviz : vals.toplamTutar || '-';

    const tutarBox = document.createElement('div');
    tutarBox.className = "modal-data-group";
    tutarBox.style.gridColumn = "1 / -1";
    tutarBox.style.marginTop = "16px";
    tutarBox.style.paddingTop = "16px";
    tutarBox.style.borderTop = "1px solid #E5E7EB";
    
    tutarBox.innerHTML = `
        <h4 class="modal-data-title" style="margin-bottom: 12px; font-size:1.1rem;">Tutarsal Veriler</h4>
        <div class="modal-grid" style="grid-template-columns: 1fr 1fr 1fr;">
            <div class="modal-field">
                <span class="modal-label">Günlük Tutar</span>
                <div class="modal-value-box" style="color:#d97706; font-weight:700; font-size:1.1rem;">${fGunluk}</div>
            </div>
            <div class="modal-field">
                <span class="modal-label">Gün Bilgisi</span>
                <div class="modal-value-box" style="font-weight:700; font-size:1.1rem;">${vals.gunBilgisi || '-'}</div>
            </div>
            <div class="modal-field">
                <span class="modal-label">Toplam İkame Tutarı</span>
                <div class="modal-value-box" style="color:#16a34a; font-weight:700; font-size:1.1rem;">${fToplam}</div>
            </div>
        </div>
    `;
    
    gridContainer.appendChild(tutarBox);
};

// Klavyeden ESC ile modalları kapatma mantığı
document.addEventListener('keydown', (e) => {
    if (e.key === "Escape") {
        const activeModals = document.querySelectorAll('.modal-overlay:not(.hidden)');
        activeModals.forEach(modal => {
            modal.classList.add('hidden');
        });
    }
});
