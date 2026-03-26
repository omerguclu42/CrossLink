// detail.js
// URLs from Dashboard
const DELIVERED_JSONP_URL = "https://docs.google.com/spreadsheets/d/1d-IUF5slokrV36jc5oOZcfK0v-lUz0JoC2fjEAm6CLo/gviz/tq?tqx=out:json";
const PENDING_JSONP_URL = "https://docs.google.com/spreadsheets/d/1McoRE5bx0IWdnbqv-__gtn3ywY0U13zWnMPaArtuCxQ/gviz/tq?tqx=out:json";
const CAR_MODELS_URL = "https://docs.google.com/spreadsheets/d/18fNdL8OUYfbu-X7Tbg3ZcKZtW3_5bwfY_eUs5WFesIc/gviz/tq?tqx=out:json";

let currentFile = null;
let carData = []; // Will hold { marka: [], models: { "Acura": [{"model": "RSX", "segment": "B"}] } }

// Helper for fetching JSONP safely
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

function getQueryParam(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
}

// Convert Google Viz table to Array of Objects
function parseGoogleVizData(data) {
    if (!data || !data.table || !data.table.rows) return [];
    const cols = data.table.cols.map(c => c ? c.label : "");
    const rows = [];
    data.table.rows.forEach(row => {
        const rowData = {};
        row.c.forEach((cell, i) => {
            if (cols[i]) {
                rowData[cols[i]] = cell ? (cell.f || cell.v) : null;
            }
        });
        rows.push(rowData);
    });
    return rows;
}

async function initDetail() {
    const dosyaNo = getQueryParam("dosyaNo");
    const supplier = sessionStorage.getItem("crosslink_supplier");

    document.getElementById("supplierNameDisplay").textContent = supplier || "Bilinmiyor";

    if (!dosyaNo) {
        showError("Geçerli bir dosya numarası bulunamadı.");
        return;
    }

    try {
        // Fetch both delivered and pending
        const [delRes, penRes] = await Promise.all([
            fetchJSONP(DELIVERED_JSONP_URL),
            fetchJSONP(PENDING_JSONP_URL)
        ]);

        const delRows = parseGoogleVizData(delRes).map(r => ({ ...r, 'Teslimat Durumu': 'Teslim Edildi' }));
        const penRows = parseGoogleVizData(penRes).map(r => ({ ...r, 'Teslimat Durumu': 'Teslim Edilmedi' }));

        const allRows = [...delRows, ...penRows];

        // Find the specific file and match supplier
        currentFile = allRows.find(r => r['Dosya No'] === dosyaNo);

        if (!currentFile) {
            showError("Belirtilen Dosya No'ya ait kayıt bulunamadı.");
            return;
        }

        // Cross-Link LocalStorage Injection - Inherit Assignments globally mirroring dashboard logic
        const assignments = JSON.parse(localStorage.getItem('crosslink_assignments') || "{}");
        if (assignments[dosyaNo] && assignments[dosyaNo].supplier) {
            currentFile['Tedarikçi'] = assignments[dosyaNo].supplier;
            currentFile['Teslimat Durumu'] = 'Teslim Edilmedi'; // Force explicit active state for locally assigned payloads
        }

        // Extremely robust character normalization identically paired natively with dashboard search protocols
        function normalizeText(str) {
            if (!str) return "";
            let s = String(str).replace(/İ/g, 'i').replace(/I/g, 'i').replace(/ı/g, 'i').replace(/i̇/g, 'i');
            s = s.replace(/Ş/g, 's').replace(/ş/g, 's').replace(/Ğ/g, 'g').replace(/ğ/g, 'g');
            s = s.replace(/Ü/g, 'u').replace(/ü/g, 'u').replace(/Ö/g, 'o').replace(/ö/g, 'o');
            s = s.replace(/Ç/g, 'c').replace(/ç/g, 'c').toLowerCase();
            return s.replace(/[^a-z0-9]/g, ""); 
        }

        // Apply visual supplier check mapped thoroughly bypassing uppercase/lowercase mismatch failures
        if (supplier && currentFile['Tedarikçi']) {
            const rowSupplierNorm = normalizeText(currentFile['Tedarikçi']);
            const currentSupplierNorm = normalizeText(supplier);
            
            if (rowSupplierNorm !== currentSupplierNorm && 
                !rowSupplierNorm.includes(currentSupplierNorm) && 
                !currentSupplierNorm.includes(rowSupplierNorm)) {
                
                showError("Bu dosya sizin erişim yetkiniz dahilinde değil.");
                return;
            }
        }

        await renderDetail(currentFile);

    } catch (err) {
        console.error("Error fetching detail data:", err);
        showError("Hata: " + err.message);
    }
}

function showError(msg) {
    document.getElementById("loadingOverlay").classList.add("hidden");
    document.getElementById("detailContent").classList.add("hidden");
    const errDiv = document.getElementById("errorOverlay");
    errDiv.classList.remove("hidden");
    document.getElementById("errorMessage").textContent = msg;
}

async function fetchCarModels() {
    try {
        const res = await fetchJSONP(CAR_MODELS_URL);
        const rows = parseGoogleVizData(res);
        // Assumes columns: Marka (A), Model (B), IKAME ARAC SEGMENTI (C) or similar
        // Let's deduce column names dynamically or assume standard
        const cols = res.table.cols.map(c => c.label);
        const markaCol = cols[0];
        const modelCol = cols[1];
        const segmentCol = cols[2];

        const grouped = {};
        rows.forEach(r => {
            const marka = String(r[markaCol] || "").trim().toUpperCase();
            const model = String(r[modelCol] || "").trim();
            const segment = String(r[segmentCol] || "").trim();

            if (!marka) return;

            if (!grouped[marka]) grouped[marka] = [];
            grouped[marka].push({ model, segment });
        });
        carData = grouped;
        return true;
    } catch (e) {
        console.error("Error fetching car models:", e);
        return false;
    }
}

async function renderDetail(file) {
    const dosyaNo = file['Dosya No'];
    let isDelivered = file['Teslimat Durumu'] === 'Teslim Edildi';

    // Demo Modu Overrides
    const localStatus = localStorage.getItem("crosslink_status_" + dosyaNo);
    if (localStatus === "Teslim Edildi") {
        isDelivered = true;
        file['Teslimat Durumu'] = 'Teslim Edildi';
    }
    const isTeslimatMaked = localStorage.getItem("crosslink_teslimat_" + dosyaNo) === "true";

    // Top Header
    document.getElementById("pageTitleHizmetNo").textContent = "Hizmet No: " + file['Hizmet No'];
    document.getElementById("pageTitleDosyaNo").textContent = "Dosya No: " + file['Dosya No'];

    const badge = document.getElementById("badgeStatus");
    badge.textContent = file['Teslimat Durumu'];
    badge.className = "status-badge " + (isDelivered ? "status-delivered" : "status-pending");

    // 1. Müşteri Bilgileri
    document.getElementById("valIsim").textContent = file['İsim'] || "-";
    document.getElementById("valSoyisim").textContent = file['Soyisim'] || "-";
    document.getElementById("valTelefon").textContent = file['Telefon'] || "-";
    document.getElementById("valTeminat").textContent = file['Teminat'] || "-";

    // 2 & 3. Araç Bilgileri ve Tarihler setup
    setupVehicleAndDateFields(file, isDelivered, isTeslimatMaked);

    // Add a 3-second delay to show the car gif loading animation
    setTimeout(() => {
        document.getElementById("loadingOverlay").classList.remove("active");
        document.getElementById("loadingOverlay").classList.add("hidden");
        document.getElementById("detailContent").classList.remove("hidden");
    }, 3000);

    // Connect file upload button
    const btnUpload = document.getElementById("btnUploadForm");
    const fileInput = document.getElementById("hiddenFileInput");
    if (btnUpload && fileInput) {
        btnUpload.addEventListener("click", () => {
            fileInput.click();
        });
    }

    // Connect Reset Demo Button
    const btnResetDemo = document.getElementById("btnResetDemo");
    if (btnResetDemo) {
        btnResetDemo.addEventListener("click", () => {
            const conf = confirm("Demo süreci sıfırlanacak ve sayfa yenilecek. Emin misiniz?");
            if (!conf) return;
            const dn = file['Dosya No'];
            localStorage.removeItem("crosslink_status_" + dn);
            localStorage.removeItem("crosslink_teslimat_" + dn);
            localStorage.removeItem("crosslink_teslimat_date_" + dn);
            localStorage.removeItem("crosslink_iade_date_" + dn);
            localStorage.removeItem("crosslink_hakedis_" + dn);
            localStorage.removeItem("crosslink_marka_" + dn);
            localStorage.removeItem("crosslink_model_" + dn);
            localStorage.removeItem("crosslink_yil_" + dn);
            localStorage.removeItem("crosslink_plaka_" + dn);
            localStorage.removeItem("crosslink_segment_" + dn);
            localStorage.removeItem("crosslink_km_" + dn);
            localStorage.removeItem("crosslink_ekler_" + dn);
            localStorage.removeItem("crosslink_log_" + dn);
            localStorage.removeItem("crosslink_notes_" + dn);
            window.location.reload();
        });
    }

    // Modal Logic
    setupModalLogic(isDelivered);
    setupEvrakAndSmsLogic(isDelivered, file);
    setupNotesLogic(file);
    renderActivityLog(file);
}

async function setupVehicleAndDateFields(file, isDelivered, isTeslimatMaked) {
    const btnUpdate = document.getElementById("btnUpdateGroup");

    function parseTurkishDate(dateStr) {
        if (!dateStr || dateStr === "-" || dateStr.trim() === "") return null;
        const parts = dateStr.trim().split(' ');
        if (parts.length !== 2) return null;
        const dParts = parts[0].split('.');
        const tParts = parts[1].split(':');
        if (dParts.length !== 3 || tParts.length < 2) return null;
        return new Date(dParts[2], dParts[1] - 1, dParts[0], tParts[0], tParts[1]);
    }

    const perfTextElem = document.getElementById("detailPerformanceText");
    let teslimatDateStr = localStorage.getItem("crosslink_teslimat_date_" + file['Dosya No']) || file['Teslimat Tarihi'];
    if (teslimatDateStr && teslimatDateStr !== "-") {
        let acilisDate = parseTurkishDate(file['Dosya Açılış Tarihi']);
        let teslimatDate = parseTurkishDate(teslimatDateStr);
        if (acilisDate && teslimatDate && teslimatDate >= acilisDate) {
            let diffMs = teslimatDate - acilisDate;
            let totalMin = Math.floor(diffMs / 60000);
            let hours = Math.floor(totalMin / 60);
            let minutes = totalMin % 60;
            if (perfTextElem) perfTextElem.textContent = `${hours} Saat ${minutes} Dakika`;
        } else {
            if (perfTextElem) perfTextElem.textContent = "Hesaplanamadı";
        }
    } else {
        if (perfTextElem) perfTextElem.textContent = "Henüz Teslim Edilmedi";
    }

    const inpPlaka = document.getElementById("inputPlaka");
    const inpSegment = document.getElementById("inputSegment");
    const inpKm = document.getElementById("inputKm");
    const inpDropKm = document.getElementById("inputDropKm");

    // Selects / Displays
    const inputMarka = document.getElementById("inputMarka");
    const dispMarka = document.getElementById("displayMarka");
    const inputModel = document.getElementById("inputModel");
    const dispModel = document.getElementById("displayModel");
    const inputYil = document.getElementById("inputYil");
    const dispYil = document.getElementById("displayYil");

    const inpTeslimat = document.getElementById("inputTeslimatTarihi");
    const inpIade = document.getElementById("inputIadeTarihi");
    const hakedisGunu = document.getElementById("inputHakedisTarihiGunu");
    const hakedisSaat = document.getElementById("inputHakedisSaat");
    const hakedisDakika = document.getElementById("inputHakedisDakika");

    // Populate Saat / Dakika
    hakedisSaat.innerHTML = '<option value="">Saat</option>';
    for (let i = 0; i < 24; i++) {
        const val = i.toString().padStart(2, '0');
        hakedisSaat.innerHTML += `<option value="${val}">${val}</option>`;
    }

    hakedisDakika.innerHTML = '<option value="">Dakika</option>';
    for (let i = 0; i < 60; i++) {
        const val = i.toString().padStart(2, '0');
        hakedisDakika.innerHTML += `<option value="${val}">${val}</option>`;
    }

    if (isDelivered) {
        // READ-ONLY MODE (Teslim Edildi)
        if (btnUpdate) btnUpdate.style.display = "none";

        // Hide Actions Completely? NO, we only hide Teslimat and Iade buttons so Upload remains.
        if (document.getElementById("btnStartTeslimat")) document.getElementById("btnStartTeslimat").style.display = "none";
        if (document.getElementById("btnStartIade")) document.getElementById("btnStartIade").style.display = "none";

        // Hide inputs/selects, show spans or make inputs readonly
        inputMarka.classList.add("hidden"); dispMarka.classList.remove("hidden");
        inputModel.classList.add("hidden"); dispModel.classList.remove("hidden");
        inputYil.classList.add("hidden"); dispYil.classList.remove("hidden");

        inpPlaka.readOnly = true;
        inpKm.readOnly = true;
        inpDropKm.readOnly = true;
        inpDropKm.disabled = true;
        inpTeslimat.readOnly = true;
        inpIade.readOnly = true;
        hakedisGunu.readOnly = true;
        hakedisGunu.disabled = true;
        hakedisSaat.disabled = true;
        hakedisDakika.disabled = true;

        // Fill from Excel
        inpPlaka.value = localStorage.getItem("crosslink_plaka_" + file['Dosya No']) || file['Plaka'] || "-";
        dispMarka.textContent = localStorage.getItem("crosslink_marka_" + file['Dosya No']) || file['Marka'] || "-";
        dispModel.textContent = localStorage.getItem("crosslink_model_" + file['Dosya No']) || file['Model'] || "-";
        inpSegment.value = localStorage.getItem("crosslink_segment_" + file['Dosya No']) || file['İkame Araç Segmenti'] || file['Segment'] || "-";
        inpKm.value = localStorage.getItem("crosslink_km_" + file['Dosya No']) || file['Kilometre'] || "-";
        inpDropKm.value = localStorage.getItem("crosslink_drop_km_" + file['Dosya No']) || file['Drop Kilometre'] || "-";
        dispYil.textContent = localStorage.getItem("crosslink_yil_" + file['Dosya No']) || file['Araç Yılı'] || file['Model Yılı'] || "-";

        inpTeslimat.value = file['Teslimat Tarihi'] || localStorage.getItem("crosslink_teslimat_date_" + file['Dosya No']) || "-";
        inpIade.value = file['İade Tarihi'] || localStorage.getItem("crosslink_iade_date_" + file['Dosya No']) || "-";

        if (file['Hakediş Tarihi'] || localStorage.getItem("crosslink_hakedis_" + file['Dosya No'])) {
            const val = file['Hakediş Tarihi'] || localStorage.getItem("crosslink_hakedis_" + file['Dosya No']);
            if (val) {
                // assume 'YYYY-MM-DD HH:MM' format if saved local, else string match
                const parts = val.split(' ');
                if (parts[0]) hakedisGunu.value = parts[0];
                if (parts[1]) {
                    const timeParts = parts[1].split(':');
                    if (timeParts[0]) hakedisSaat.value = timeParts[0];
                    if (timeParts[1]) hakedisDakika.value = timeParts[1];
                }
            }
        } else {
            document.getElementById("hakedisGroup").style.display = "none";
        }

    } else {
        // EDITABLE MODE (Teslim Edilmedi)
        if (btnUpdate) btnUpdate.style.display = "flex";

        document.getElementById("btnUploadForm").disabled = false;
        document.getElementById("btnStartTeslimat").disabled = false;

        // Disable Iade Button by default until Teslimat is marked
        document.getElementById("btnStartIade").disabled = true;

        // Disable Hakediş Button by default until Teslimat is marked
        document.getElementById("inputHakedisTarihiGunu").disabled = true;
        document.getElementById("inputHakedisSaat").disabled = true;
        document.getElementById("inputHakedisDakika").disabled = true;

        // PRE-FILL FROM EXCEL
        inpPlaka.value = localStorage.getItem("crosslink_plaka_" + file['Dosya No']) || file['Plaka'] || "";
        inpSegment.value = localStorage.getItem("crosslink_segment_" + file['Dosya No']) || file['İkame Araç Segmenti'] || file['Segment'] || "";
        inpKm.value = localStorage.getItem("crosslink_km_" + file['Dosya No']) || file['Kilometre'] || "";
        inpTeslimat.value = localStorage.getItem("crosslink_teslimat_date_" + file['Dosya No']) || file['Teslimat Tarihi'] || "";
        inpIade.value = file['İade Tarihi'] || "";

        // AUTO-SAVE DRAFTS ON TYPING (Prevents data loss on F5/Exit)
        inpPlaka.addEventListener("input", (e) => localStorage.setItem("crosslink_plaka_" + file['Dosya No'], e.target.value.trim()));
        inpKm.addEventListener("input", (e) => localStorage.setItem("crosslink_km_" + file['Dosya No'], e.target.value.trim()));
        inpDropKm.value = localStorage.getItem("crosslink_drop_km_" + file['Dosya No']) || file['Drop Kilometre'] || "";
        inpDropKm.disabled = false; // Tedarikçi her zaman drop km girebilir
        inpDropKm.addEventListener("input", (e) => localStorage.setItem("crosslink_drop_km_" + file['Dosya No'], e.target.value.trim()));

        let hakedisVal = localStorage.getItem("crosslink_hakedis_" + file['Dosya No']) || file['Hakediş Tarihi'];
        if (hakedisVal) {
            const parts = hakedisVal.split(' ');
            if (parts[0]) hakedisGunu.value = parts[0];
            if (parts[1]) {
                const timeParts = parts[1].split(':');
                if (timeParts[0]) hakedisSaat.value = timeParts[0];
                if (timeParts[1]) hakedisDakika.value = timeParts[1];
            }
        }

        // Apply Partial Lock if Teslimat is Maked
        if (isTeslimatMaked) {
            inputMarka.classList.add("hidden"); dispMarka.classList.remove("hidden");
            inputModel.classList.add("hidden"); dispModel.classList.remove("hidden");
            inputYil.classList.add("hidden"); dispYil.classList.remove("hidden");
            dispMarka.textContent = localStorage.getItem("crosslink_marka_" + file['Dosya No']) || file['Marka'] || "-";
            dispModel.textContent = localStorage.getItem("crosslink_model_" + file['Dosya No']) || file['Model'] || "-";
            dispYil.textContent = localStorage.getItem("crosslink_yil_" + file['Dosya No']) || file['Araç Yılı'] || file['Model Yılı'] || "-";
            inpPlaka.readOnly = true;
            inpSegment.readOnly = true;
            inpKm.readOnly = true;
            inpDropKm.disabled = false; // Teslimat sonrası drop km girilebilir
            // Drop KM her input'ta otomatik kaydet
            inpDropKm.addEventListener("input", (e) => {
                const val = e.target.value.replace(/[^0-9]/g, "");
                localStorage.setItem("crosslink_drop_km_" + file['Dosya No'], val);
            });
            document.getElementById("btnStartTeslimat").disabled = true;

            // Kaydet butonu bu aşamada da görünsün (sadece drop km için)
            const btnSV = document.getElementById('btnSaveVehicleInfo');
            if (btnSV) {
                btnSV.style.display = 'block';
                btnSV.textContent = '💾 Drop KM Kaydet';
            }

            // Enable Iade Button because Teslimat is marked
            document.getElementById("btnStartIade").disabled = false;
            
            // Enable Hakediş Fields because Teslimat is marked
            document.getElementById("inputHakedisTarihiGunu").disabled = false;
            document.getElementById("inputHakedisSaat").disabled = false;
            document.getElementById("inputHakedisDakika").disabled = false;
        }

        // Fetch Car Models
        await fetchCarModels();

        // Populate Yıl (2011 to 2026)
        inputYil.innerHTML = '<option value="">Seçiniz...</option>';
        for (let y = 2026; y >= 2011; y--) {
            inputYil.innerHTML += `<option value="${y}">${y}</option>`;
        }
        inputYil.addEventListener('change', (e) => localStorage.setItem("crosslink_yil_" + file['Dosya No'], e.target.value));
        if (file['Araç Yılı'] || file['Model Yılı']) {
            inputYil.value = file['Araç Yılı'] || file['Model Yılı'];
        }

        // Populate Marka
        inputMarka.innerHTML = '<option value="">Marka Seçiniz...</option>';
        Object.keys(carData).sort().forEach(marka => {
            inputMarka.innerHTML += `<option value="${marka}">${marka}</option>`;
        });

        // Marka Change Listener
        inputMarka.addEventListener('change', (e) => {
            const selectedMarka = e.target.value;
            localStorage.setItem("crosslink_marka_" + file['Dosya No'], selectedMarka);
            inputModel.innerHTML = '<option value="">Model Seçiniz...</option>';
            inpSegment.value = "";
            localStorage.removeItem("crosslink_model_" + file['Dosya No']);
            localStorage.removeItem("crosslink_segment_" + file['Dosya No']);

            if (selectedMarka && carData[selectedMarka]) {
                inputModel.disabled = false;
                carData[selectedMarka].forEach(c => {
                    inputModel.innerHTML += `<option value="${c.model}" data-seg="${c.segment}">${c.model}</option>`;
                });
            } else {
                inputModel.disabled = true;
            }
        });

        // Model Change Listener
        inputModel.addEventListener('change', (e) => {
            const selectedOption = e.target.options[e.target.selectedIndex];
            if (selectedOption && selectedOption.value) {
                localStorage.setItem("crosslink_model_" + file['Dosya No'], selectedOption.value);
                inpSegment.value = selectedOption.getAttribute('data-seg') || "";
                localStorage.setItem("crosslink_segment_" + file['Dosya No'], inpSegment.value);
            } else {
                localStorage.removeItem("crosslink_model_" + file['Dosya No']);
                inpSegment.value = "";
                localStorage.removeItem("crosslink_segment_" + file['Dosya No']);
            }
        });

        // Trigger selection if values exist
        if (file['Marka']) {
            inputMarka.value = file['Marka'];
            inputMarka.dispatchEvent(new Event('change'));
            if (file['Model']) {
                inputModel.value = file['Model'];
                inputModel.dispatchEvent(new Event('change'));
            }
        }

        // Thousands separator for KM
        inpKm.addEventListener('input', function (e) {
            let value = e.target.value.replace(/\D/g, ""); // strip non-digits
            if (value !== "") {
                e.target.value = new Intl.NumberFormat('tr-TR').format(value);
            }
        });

        // Live update Hakedis
        const saveHakedisFn = () => {
            const dn = file['Dosya No'];
            const hG = hakedisGunu.value;
            const hS = hakedisSaat.value || "00";
            const hD = hakedisDakika.value || "00";
            if (hG) {
                localStorage.setItem("crosslink_hakedis_" + dn, `${hG} ${hS}:${hD}`);
            }
        };
        hakedisGunu.addEventListener('change', saveHakedisFn);
        hakedisSaat.addEventListener('change', saveHakedisFn);
        hakedisDakika.addEventListener('change', saveHakedisFn);

        // === ARAÇ BİLGİLERİNİ KAYDET BUTONU ===
        const btnSaveVehicle = document.getElementById('btnSaveVehicleInfo');
        if (btnSaveVehicle) {
            btnSaveVehicle.addEventListener('click', () => {
                const dn = file['Dosya No'];
                const plaka = inpPlaka.value.trim();
                const marka = inputMarka.value.trim();
                const model = inputModel.value.trim();
                const yil = inputYil.value.trim();
                const segment = inpSegment.value.trim();
                const km = inpKm.value.trim();
                const dropKm = inpDropKm.value.trim();

                const missing = [];
                if (!plaka) missing.push('Plaka');
                if (!marka || marka === '' || marka.includes('Seçiniz')) missing.push('Marka');
                if (!model || model === '' || model.includes('Seçiniz')) missing.push('Model');
                if (!yil || yil.includes('Seçiniz')) missing.push('Araç Yılı');
                if (!km) missing.push('Kilometre');

                if (missing.length > 0) {
                    alert('Lütfen şu alanları doldurunuz: ' + missing.join(', '));
                    return;
                }

                if (plaka) localStorage.setItem('crosslink_plaka_' + dn, plaka);
                if (marka && !marka.includes('Seçiniz')) localStorage.setItem('crosslink_marka_' + dn, marka);
                if (model && !model.includes('Seçiniz')) localStorage.setItem('crosslink_model_' + dn, model);
                if (yil && !yil.includes('Seçiniz')) localStorage.setItem('crosslink_yil_' + dn, yil);
                if (segment) localStorage.setItem('crosslink_segment_' + dn, segment);
                if (km) localStorage.setItem('crosslink_km_' + dn, km.replace(/[^0-9]/g, ''));
                if (dropKm) localStorage.setItem('crosslink_drop_km_' + dn, dropKm.replace(/[^0-9]/g, ''));

                // Log
                logActivity(file, `💾 Araç bilgileri güncellendi — Plaka: ${plaka}, Marka: ${marka}, Model: ${model}, Yıl: ${yil}, KM: ${km}`);

                btnSaveVehicle.textContent = '✅ Kaydedildi!';
                btnSaveVehicle.style.background = '#16a34a';
                btnSaveVehicle.style.color = '#fff';
                setTimeout(() => {
                    btnSaveVehicle.textContent = '💾 Araç Bilgilerini Kaydet';
                    btnSaveVehicle.style.background = '';
                    btnSaveVehicle.style.color = '';
                }, 2500);
            });
        }
    }
}

function setupModalLogic(isDelivered) {
    if (isDelivered) return;

    const modal = document.getElementById("updateModal");
    const btnOpen = document.getElementById("btnOpenUpdateModal");
    const btnClose = document.getElementById("closeUpdateModal");
    const btnCancel = document.getElementById("btnCancelUpdate");
    const btnSave = document.getElementById("btnSaveUpdate");

    btnOpen.addEventListener("click", () => {
        // Pre-fill modal with current DOM values
        document.getElementById("modalIsim").value = document.getElementById("valIsim").textContent;
        document.getElementById("modalSoyisim").value = document.getElementById("valSoyisim").textContent;
        document.getElementById("modalTelefon").value = document.getElementById("valTelefon").textContent;
        document.getElementById("modalTeminat").value = document.getElementById("valTeminat").textContent;

        document.getElementById("modalSifre").value = "";
        document.getElementById("modalError").classList.add("hidden");

        modal.classList.remove("hidden");
    });

    const closeFn = () => { modal.classList.add("hidden"); };
    btnClose.addEventListener("click", closeFn);
    btnCancel.addEventListener("click", closeFn);

    btnSave.addEventListener("click", () => {
        const pass = document.getElementById("modalSifre").value;
        if (pass !== "1881") {
            document.getElementById("modalError").classList.remove("hidden");
            return;
        }

        // Apply changes to DOM
        document.getElementById("valIsim").textContent = document.getElementById("modalIsim").value;
        document.getElementById("valSoyisim").textContent = document.getElementById("modalSoyisim").value;
        document.getElementById("valTelefon").textContent = document.getElementById("modalTelefon").value;
        document.getElementById("valTeminat").textContent = document.getElementById("modalTeminat").value;

        // Briefly show success alert or just close
        closeFn();
        alert("Arayüzdeki veriler başarıyla değişti (1/2).\n\nBu değişikliğin Google Sheets'e de (Excel'e) otomatik yansıması için sistemin arka planına 'Google Apps Script' API'si kurmamız gerekiyor. Bir sonraki aşamada bunu yapacağız!");
    });
}

function setupEvrakAndSmsLogic(isDelivered, file) {
    if (isDelivered) {
        document.getElementById("eklerSection").classList.add("hidden");
        return;
    }

    // --- Ekler (File Upload) Logic ---
    const fileInput = document.getElementById("hiddenFileInput");
    const eklerListesi = document.getElementById("eklerListesi");
    let eklerData = [];

    // Load from LocalStorage
    const savedEkler = localStorage.getItem("crosslink_ekler_" + file['Dosya No']);
    if (savedEkler) {
        try { eklerData = JSON.parse(savedEkler); } catch (e) { }
    }

    function saveEklerToLocal() {
        localStorage.setItem("crosslink_ekler_" + file['Dosya No'], JSON.stringify(eklerData));
    }

    if (fileInput) {
        fileInput.addEventListener("change", (e) => {
            if (e.target.files && e.target.files.length > 0) {
                const uploadedFile = e.target.files[0];
                const fileId = "ek_" + Date.now();

                // Convert to Base64 to save in localStorage demo
                const reader = new FileReader();
                reader.onload = (ev) => {
                    eklerData.push({ id: fileId, name: uploadedFile.name, dataUrl: ev.target.result });
                    saveEklerToLocal();
                    renderEklerList();
                    logActivity(file, `📎 Evrak yüklendi: ${uploadedFile.name}`);
                };
                reader.readAsDataURL(uploadedFile);

                fileInput.value = ""; // Reset for next upload
            }
        });
    }

    const deleteModal = document.getElementById("deleteModal");
    const btnCancelDelete = document.getElementById("btnCancelDelete");
    const btnConfirmDelete = document.getElementById("btnConfirmDelete");
    const closeDeleteModal = document.getElementById("closeDeleteModal");
    let currentDeleteId = null;

    const closeDelModalFn = () => {
        deleteModal.classList.add("hidden");
        document.getElementById("modalDeleteSifre").value = "";
        document.getElementById("modalDeleteError").classList.add("hidden");
    };
    if (closeDeleteModal) closeDeleteModal.addEventListener("click", closeDelModalFn);
    if (btnCancelDelete) btnCancelDelete.addEventListener("click", closeDelModalFn);

    if (btnConfirmDelete) {
        btnConfirmDelete.addEventListener("click", () => {
            const pass = document.getElementById("modalDeleteSifre").value;
            if (pass !== "1881") {
                document.getElementById("modalDeleteError").classList.remove("hidden");
                return;
            }

            // Success
            eklerData = eklerData.filter(e => e.id !== currentDeleteId);
            saveEklerToLocal();
            renderEklerList();
            closeDelModalFn();
        });
    }

    function renderEklerList() {
        if (eklerData.length === 0) {
            eklerListesi.innerHTML = '<p class="text-muted" id="noEklerMessage">Henüz eklenmiş bir evrak bulunmuyor.</p>';
            return;
        }

        eklerListesi.innerHTML = "";
        eklerData.forEach(item => {
            const div = document.createElement("div");
            div.className = "ekler-item";
            div.innerHTML = `
                <div class="ekler-actions">
                    <button class="ekler-btn btn-download" title="İndir" data-id="${item.id}">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="7 10 12 15 17 10"></polyline>
                            <line x1="12" y1="15" x2="12" y2="3"></line>
                        </svg>
                    </button>
                    <button class="ekler-btn btn-delete" title="Sil" data-id="${item.id}">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            <line x1="10" y1="11" x2="10" y2="17"></line>
                            <line x1="14" y1="11" x2="14" y2="17"></line>
                        </svg>
                    </button>
                </div>
                <div class="ekler-info" style="flex:1; margin-left:12px;">
                    <span class="ekler-filename">${item.name}</span>
                </div>
            `;

            div.querySelector(".btn-delete").addEventListener("click", () => {
                currentDeleteId = item.id;
                deleteModal.classList.remove("hidden");
            });

            div.querySelector(".btn-download").addEventListener("click", () => {
                const a = document.createElement("a");
                a.style.display = "none";
                a.href = item.dataUrl || "";
                a.download = item.name;
                document.body.appendChild(a);
                a.click();
            });

            eklerListesi.appendChild(div);
        });
    }

    // --- Validation & SMS OTP Logic ---
    const btnStartTeslimat = document.getElementById("btnStartTeslimat");
    const btnStartIade = document.getElementById("btnStartIade");

    // Configure inputs to be readonly
    const inputTeslimatTarihi = document.getElementById("inputTeslimatTarihi");
    const inputIadeTarihi = document.getElementById("inputIadeTarihi");
    inputTeslimatTarihi.readOnly = true;
    inputIadeTarihi.readOnly = true;

    const smsModal = document.getElementById("smsModal");
    const btnCancelSms = document.getElementById("btnCancelSms");
    const btnConfirmSms = document.getElementById("btnConfirmSms");
    const closeSmsModal = document.getElementById("closeSmsModal");
    let currentOtp = null;
    let currentOtpContext = null; // 'TESLIMAT' or 'IADE'
    let currentOtpDate = null;

    if (btnStartTeslimat) {
        btnStartTeslimat.addEventListener("click", () => {
            // Collect Field Values
            const plaka = document.getElementById("inputPlaka").value.trim();
            const marka = document.getElementById("inputMarka").value.trim();
            const model = document.getElementById("inputModel").value.trim();
            const segment = document.getElementById("inputSegment").value.trim();
            const km = document.getElementById("inputKm").value.trim();
            const yil = document.getElementById("inputYil").value.trim();

            const errors = [];

            if (!plaka || plaka.includes("Örn")) errors.push("Plaka");
            if (!marka || marka.includes("Seçiniz")) errors.push("Marka");
            if (!model || model.includes("Seçiniz")) errors.push("Model");
            if (!segment || segment === "-") errors.push("Segment");
            if (!km) errors.push("Kilometre");
            if (!yil || yil.includes("Seçiniz")) errors.push("Araç Yılı");

            if (errors.length > 0) {
                alert("Şu veriler henüz doldurulmadığı için bu adıma geçilememektedir:\n\n\"" + errors.join("\", \"") + "\"");
                return;
            }

            const confirmStart = confirm("Sigortalıyla araç teslimatı şu anda fiziksel olarak yapılacaksa bu adıma geçilmelidir. Devam etmek istiyor musunuz?");
            if (!confirmStart) return;

            // SMS Flow Initialization
            const dateObj = new Date();
            const formattedDate = dateObj.toLocaleDateString("tr-TR") + " " + dateObj.toLocaleTimeString("tr-TR", { hour: '2-digit', minute: '2-digit' });
            currentOtp = Math.floor(100000 + Math.random() * 900000).toString(); // 6 digit random
            currentOtpContext = 'TESLIMAT';
            currentOtpDate = formattedDate;

            let phoneNumber = file['Telefon'] || "";
            if (phoneNumber.length === 10 && !phoneNumber.startsWith("0")) {
                phoneNumber = "0" + phoneNumber;
            }

            const smsText = `Sayın Sigortalı,\n\nİkame araç hizmeti talebiniz için tedarikçi firmamız tarafınıza aşağıda bilgileri bulunan aracın teslimatını sağlamak istemektedir.\nPlaka : ${plaka}\nMarka : ${marka}\nModel : ${model}\nKilometre : ${km}\nYıl : ${yil}\nTeslimat Tarihi : ${formattedDate}\n\nİletilen bilgiler doğruysa tedarikçimize aşağıda ki onay kodunun iletilmesini rica ederiz.\nOnay Kodu : ${currentOtp}\nİyi günler dileriz.\nB002`;

            console.log(`--- SMS TO: ${phoneNumber} ---`);
            console.log(smsText);
            console.log(`------------------------------`);

            alert("Test (Mock) SMS'i " + phoneNumber + " Numarasına İletildi!\n\n(Lütfen Test için OTP'yi not ediniz)\n\n" + smsText);

            // Open OTP Modal
            document.getElementById("modalSmsKod").value = "";
            document.getElementById("modalSmsError").classList.add("hidden");
            smsModal.classList.remove("hidden");
        });
    }

    const confirmIadeModal = document.getElementById("confirmIadeModal");
    const btnCancelIade = document.getElementById("btnCancelIade");
    const btnYesIade = document.getElementById("btnYesIade");
    const closeConfirmIadeModal = document.getElementById("closeConfirmIadeModal");

    if (btnStartIade) {
        btnStartIade.addEventListener("click", () => {
            const hG = document.getElementById("inputHakedisTarihiGunu").value;
            const hS = document.getElementById("inputHakedisSaat").value;
            const hD = document.getElementById("inputHakedisDakika").value;
            
            if (!hG || !hS || !hD) {
                alert("Lütfen araç iade sürecini başlatmadan önce 'Hakediş Tarihi' (Gün, Saat ve Dakika) bilgisini eksiksiz doldurunuz.");
                return;
            }
            confirmIadeModal.classList.remove("hidden");
        });
    }

    const closeIadeFn = () => { confirmIadeModal.classList.add("hidden"); };
    if (closeConfirmIadeModal) closeConfirmIadeModal.addEventListener("click", closeIadeFn);
    if (btnCancelIade) btnCancelIade.addEventListener("click", closeIadeFn);

    if (btnYesIade) {
        btnYesIade.addEventListener("click", () => {
            closeIadeFn();

            // SMS Flow Initialization
            const dateObj = new Date();
            const formattedDate = dateObj.toLocaleDateString("tr-TR") + " " + dateObj.toLocaleTimeString("tr-TR", { hour: '2-digit', minute: '2-digit' });
            currentOtp = Math.floor(100000 + Math.random() * 900000).toString(); // 6 digit random
            currentOtpContext = 'IADE';
            currentOtpDate = formattedDate;

            let phoneNumber = file['Telefon'] || "";
            if (phoneNumber.length === 10 && !phoneNumber.startsWith("0")) {
                phoneNumber = "0" + phoneNumber;
            }

            const teslimatB = inputTeslimatTarihi.value || "-";
            const hakedisGunu = document.getElementById("inputHakedisTarihiGunu").value || "-";
            const hakedisSaat = document.getElementById("inputHakedisSaat").value || "00";
            const hakedisDak = document.getElementById("inputHakedisDakika").value || "00";
            let hakedisB = "-";

            if (hakedisGunu !== "-") {
                const hParts = hakedisGunu.split("-");
                if (hParts.length === 3) {
                    hakedisB = `${hParts[2]}.${hParts[1]}.${hParts[0]} ${hakedisSaat}:${hakedisDak}`;
                } else {
                    hakedisB = `${hakedisGunu} ${hakedisSaat}:${hakedisDak}`;
                }
            }

            const smsText = `Sayın Sigortalı,\n\nTarafınıza teslim edilen ikame aracın iadesi için tedarikçi firmamız süreci başlatmak istemektedir.\nTeslimat Tarihi : ${teslimatB}\nİade Tarihi : ${formattedDate}\nHakediş Tarihi : ${hakedisB}\n\nİletilen bilgiler doğruysa tedarikçimize aşağıda ki onay kodunun iletilmesini rica ederiz.\nOnay Kodu : ${currentOtp}\nİyi günler dileriz.\nB002`;

            console.log(`--- İADE SMS TO: ${phoneNumber} ---`);
            console.log(smsText);
            console.log(`------------------------------`);

            alert("Test (Mock) İade SMS'i " + phoneNumber + " Numarasına İletildi!\n\n(Lütfen Test için OTP'yi not ediniz)\n\n" + smsText);

            // Open OTP Modal
            document.getElementById("modalSmsKod").value = "";
            document.getElementById("modalSmsError").classList.add("hidden");
            smsModal.classList.remove("hidden");
        });
    }

    const closeSmsFn = () => { smsModal.classList.add("hidden"); };
    if (closeSmsModal) closeSmsModal.addEventListener("click", closeSmsFn);
    if (btnCancelSms) btnCancelSms.addEventListener("click", closeSmsFn);

    if (btnConfirmSms) {
        btnConfirmSms.addEventListener("click", () => {
            const enteredOtp = document.getElementById("modalSmsKod").value.trim();
            if (enteredOtp !== currentOtp) {
                document.getElementById("modalSmsError").classList.remove("hidden");
                return;
            }

            document.getElementById("modalSmsError").classList.add("hidden");
            closeSmsFn();

            const dosyaNo = file['Dosya No'];

            if (currentOtpContext === 'TESLIMAT') {
                inputTeslimatTarihi.value = currentOtpDate;

                // Save Local Storage States
                localStorage.setItem("crosslink_teslimat_date_" + dosyaNo, currentOtpDate);
                localStorage.setItem("crosslink_teslimat_" + dosyaNo, "true");

                // Enable Iade process dynamically
                document.getElementById("btnStartIade").disabled = false;
                document.getElementById("btnStartTeslimat").disabled = true;

                // Unlock Hakediş Fields instantly in DOM since Teslimat is now confirmed
                document.getElementById("inputHakedisTarihiGunu").disabled = false;
                document.getElementById("inputHakedisSaat").disabled = false;
                document.getElementById("inputHakedisDakika").disabled = false;

                // Get the saved values from select boxes. Since the `value` attributes hold the exact strings, we can use `.value`
                const mMarka = document.getElementById("inputMarka").value || "";
                const mModel = document.getElementById("inputModel").value || "";
                const mYil = document.getElementById("inputYil").value || "";

                if (mMarka && !mMarka.includes("Seçiniz")) {
                    localStorage.setItem("crosslink_marka_" + dosyaNo, mMarka);
                    document.getElementById("displayMarka").textContent = mMarka;
                }
                if (mModel && !mModel.includes("Seçiniz")) {
                    localStorage.setItem("crosslink_model_" + dosyaNo, mModel);
                    document.getElementById("displayModel").textContent = mModel;
                }
                if (mYil && !mYil.includes("Seçiniz")) {
                    localStorage.setItem("crosslink_yil_" + dosyaNo, mYil);
                    document.getElementById("displayYil").textContent = mYil;
                }


                // Get and save all final field values BEFORE logging
                const finalPlaka = document.getElementById("inputPlaka").value.trim();
                const finalSegment = document.getElementById("inputSegment").value.trim();
                const finalKm = document.getElementById("inputKm").value.replace(/[^0-9]/g, "");
                const finalMarka = document.getElementById("displayMarka").textContent || document.getElementById("inputMarka").value.trim();
                const finalModel = document.getElementById("displayModel").textContent || document.getElementById("inputModel").value.trim();
                const finalYil = document.getElementById("displayYil").textContent || document.getElementById("inputYil").value.trim();

                if (finalPlaka) localStorage.setItem("crosslink_plaka_" + dosyaNo, finalPlaka);
                if (finalSegment) localStorage.setItem("crosslink_segment_" + dosyaNo, finalSegment);
                if (finalKm) localStorage.setItem("crosslink_km_" + dosyaNo, finalKm);
                if (finalMarka && !finalMarka.includes("-")) localStorage.setItem("crosslink_marka_" + dosyaNo, finalMarka);
                if (finalModel && !finalModel.includes("-")) localStorage.setItem("crosslink_model_" + dosyaNo, finalModel);
                if (finalYil && !finalYil.includes("-")) localStorage.setItem("crosslink_yil_" + dosyaNo, finalYil);

                alert("Dosya teslimat süreci başarıyla tamamlanmıştır.\n(Demo: Araç bilgileri artık değiştirilemez.)");
                logActivity(file, `🚗 İkame araç tedarikçi tarafından teslim edildi. Plaka: ${finalPlaka}, Segment: ${finalSegment}, Teslimat Tarihi: ${currentOtpDate}`);
                if (btnStartTeslimat) btnStartTeslimat.disabled = true;

                // Lock fields immediately
                document.getElementById("inputMarka").classList.add("hidden"); document.getElementById("displayMarka").classList.remove("hidden");
                document.getElementById("inputModel").classList.add("hidden"); document.getElementById("displayModel").classList.remove("hidden");
                document.getElementById("inputYil").classList.add("hidden"); document.getElementById("displayYil").classList.remove("hidden");

                document.getElementById("inputPlaka").readOnly = true;
                document.getElementById("inputSegment").readOnly = true;
                document.getElementById("inputKm").readOnly = true;
                if(document.getElementById("inputDropKm")) document.getElementById("inputDropKm").disabled = false;

                // Do NOT lock Hakedis yet, keep it open until Iade!
                if (btnStartIade) btnStartIade.disabled = false;

            } else if (currentOtpContext === 'IADE') {
                inputIadeTarihi.value = currentOtpDate;

                // Save Local Storage States
                localStorage.setItem("crosslink_iade_date_" + dosyaNo, currentOtpDate);
                localStorage.setItem("crosslink_status_" + dosyaNo, "Teslim Edildi");

                alert("Dosya iade süreci başarıyla tamamlanmıştır.\n(Demo: Statü Teslim Edildi olarak güncellendi ve dosya kilitlendi.)");
                logActivity(file, `✅ İade Süreci tamamlandı. Statü: Teslim Edildi. İade Tarihi: ${currentOtpDate}`);

                // Apply final UI locks immediately
                if (btnStartIade) btnStartIade.style.display = "none";
                if (btnStartTeslimat) btnStartTeslimat.style.display = "none";
                const btnUpdateGroup = document.getElementById("btnUpdateGroup");
                if (btnUpdateGroup) btnUpdateGroup.style.display = "none";

                // Lock Hakedis
                document.getElementById("inputHakedisTarihiGunu").readOnly = true;
                document.getElementById("inputHakedisTarihiGunu").disabled = true;
                document.getElementById("inputHakedisSaat").disabled = true;
                document.getElementById("inputHakedisDakika").disabled = true;

                // Update badge
                const badge = document.getElementById("badgeStatus");
                if (badge) {
                    badge.textContent = "Teslim Edildi";
                    badge.className = "status-badge status-delivered";
                }
            }
        });
    }

}

// ============================================================
// Log & Notes Global Helpers
// ============================================================

function logActivity(file, message) {
    if (!file) return;
    const dn = file['Dosya No'];
    const key = 'crosslink_log_' + dn;
    let logs = [];
    try { logs = JSON.parse(localStorage.getItem(key) || '[]'); } catch (e) { }
    const now = new Date();
    const ts = now.toLocaleDateString('tr-TR') + ' ' + now.toLocaleTimeString('tr-TR');
    logs.unshift({ ts, msg: message });
    localStorage.setItem(key, JSON.stringify(logs));
    renderActivityLog(file);
}

function renderActivityLog(file) {
    const logDiv = document.getElementById('activityLog');
    if (!logDiv || !file) return;
    const dn = file['Dosya No'];
    let logs = [];
    try { logs = JSON.parse(localStorage.getItem('crosslink_log_' + dn) || '[]'); } catch (e) { }
    if (logs.length === 0) {
        logDiv.innerHTML = '<p style="color:#999; text-align:center; margin:0;">Henüz bir aksiyon gerçekleşmedi.</p>';
        return;
    }
    logDiv.innerHTML = logs.map(l => `
        <div style="display:flex; gap:10px; padding:6px 0; border-bottom:1px solid #eee; align-items:flex-start;">
            <span style="white-space:nowrap; color:#888; font-size:0.75rem; min-width:130px;">${l.ts}</span>
            <span style="color:#333;">${l.msg}</span>
        </div>
    `).join('');
}

function setupNotesLogic(file) {
    const notlarListesi = document.getElementById('notlarListesi');
    const notInput = document.getElementById('notInput');
    const btnAddNot = document.getElementById('btnAddNot');
    if (!notlarListesi || !notInput || !btnAddNot) return;

    const dn = file['Dosya No'];
    const key = 'crosslink_notes_' + dn;

    function loadNotes() {
        let notes = [];
        try { notes = JSON.parse(localStorage.getItem(key) || '[]'); } catch (e) { }
        if (notes.length === 0) {
            notlarListesi.innerHTML = '<p style="color:#999;font-size:0.85rem;margin:0;">Henüz not eklenmemiş.</p>';
            return;
        }
        notlarListesi.innerHTML = notes.map(n => `
            <div style="background:#fff7ed; border-left:3px solid var(--primary-color); padding:8px 12px; margin-bottom:8px; border-radius:0 6px 6px 0;">
                <div style="font-size:0.72rem; color:#888; margin-bottom:3px;">${n.ts} — ${n.author}</div>
                <div style="font-size:0.88rem; color:#333; white-space:pre-wrap;">${n.text}</div>
            </div>
        `).join('');
    }

    loadNotes();

    btnAddNot.addEventListener('click', () => {
        const text = notInput.value.trim();
        if (!text) return;
        let notes = [];
        try { notes = JSON.parse(localStorage.getItem(key) || '[]'); } catch (e) { }
        const now = new Date();
        const ts = now.toLocaleDateString('tr-TR') + ' ' + now.toLocaleTimeString('tr-TR');
        const author = sessionStorage.getItem('crosslink_supplier') || 'Tedarikçi';
        notes.push({ ts, text, author });
        localStorage.setItem(key, JSON.stringify(notes));
        notInput.value = '';
        loadNotes();
        logActivity(file, 'Not eklendi.');
    });
}

// Start
document.addEventListener("DOMContentLoaded", initDetail);
