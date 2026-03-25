// Authentication Logic & UI Interactions

const OPERASYON_URL = 'https://docs.google.com/spreadsheets/d/1BE4vW3NsyqpIUCQtQTnptMdK3xR25Q3rVp0cWAim3ok/gviz/tq?tqx=out:json';

function fetchJSONP(baseUrl) {
    return new Promise((resolve, reject) => {
        const callbackName = 'loginGviz_' + Math.round(1000000 * Math.random()) + '_' + Date.now();
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
            reject(new Error('Kullanıcı verisi yüklenemedi.'));
        };
        document.head.appendChild(script);
    });
}

function parseLoginJSON(data) {
    const rows = [];
    if (!data || !data.table || !data.table.cols) return rows;
    const cols = data.table.cols;
    const headers = cols.map(c => (c.label || c.id || '').trim());
    (data.table.rows || []).forEach(row => {
        const obj = {};
        headers.forEach((h, i) => {
            const cell = row.c ? row.c[i] : null;
            const val = cell ? (cell.f != null ? cell.f : (cell.v != null ? String(cell.v) : '')) : '';
            obj[h] = String(val).trim();
        });
        rows.push(obj);
    });
    return rows;
}

// Firma Adı , Sifre
const validCredentials = [
    { company: "AKTİF FİLO", password: "aktif123" },
    { company: "ARAÇ YEDEKLE", password: "yedekle123" },
    { company: "BYG FİLO", password: "byg123" },
    { company: "CARLOVE", password: "carlove123" },
    { company: "FORRENT KİRALAMA", password: "forrent123" },
    { company: "GRİ RENT ARAÇ KİRALAMA SANAYİ VE TİCARET LTD.ŞTİ.", password: "gri123" },
    { company: "HARA FİLO", password: "hara123" },
    { company: "QCAR MOBILITE", password: "qcar123" },
    { company: "ZEPLİN TURİZM ARAÇ KİRALAMA", password: "zeplin123" }
];

document.addEventListener("DOMContentLoaded", () => {
    const loginForm = document.getElementById("loginForm");
    const companyInput = document.getElementById("companyName");
    const passwordInput = document.getElementById("password");
    const errorMessage = document.getElementById("errorMessage");
    const loadingOverlay = document.getElementById("loadingOverlay");

    // Dynamic icon color adjustment on input focus/blur (handled mostly in CSS, but js adds robust class tracking if needed)

    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault(); // Prevent classic form submission

        // Reset error state
        errorMessage.style.display = "none";

        const enteredCompany = companyInput.value.trim();
        const enteredPassword = passwordInput.value.trim();

        // Basic Validation
        if (!enteredCompany || !enteredPassword) {
            showError("Lütfen tüm alanları doldurunuz.");
            return;
        }

        // Authenticate
        // Convert to lowercase for case-insensitive match using Turkish locale
        const searchCompany = enteredCompany.toLocaleLowerCase('tr-TR');
        const userFound = validCredentials.find(
            (cred) => {
                const credCompany = cred.company.toLocaleLowerCase('tr-TR');
                return (credCompany === searchCompany || credCompany.includes(searchCompany)) &&
                    cred.password === enteredPassword;
            }
        );

        if (userFound) {
            handleSuccessfulLogin(userFound);
            return;
        } 
        
        if (enteredCompany.trim().toLowerCase() === 'admin' && enteredPassword === 'admin123') {
            // Admin Login
            loadingOverlay.classList.remove("hidden");
            loadingOverlay.classList.add("active");
            sessionStorage.setItem("crosslink_admin", "true");
            setTimeout(() => { window.location.href = "admin.html"; }, 2000);
            return;
        }

        // Check Remote Operasyon Credentials
        loadingOverlay.classList.remove("hidden");
        loadingOverlay.classList.add("active");
        try {
            const rawData = await fetchJSONP(OPERASYON_URL);
            const opUsers = parseLoginJSON(rawData);
            
            const opUser = opUsers.find(u => {
                // Find keys relying EXCLUSIVELY on ASCII strings immune to GitHub Pages Encoding Corruptions
                const kKey = Object.keys(u).find(k => k.toLowerCase().includes("kullanici") || k.toLowerCase().includes("ullanici"));
                const sKey = Object.keys(u).find(k => k.toLowerCase().includes("ifre"));
                
                if(!kKey || !sKey) return false;
                
                return u[kKey].toLowerCase() === enteredCompany.toLowerCase() && u[sKey] === enteredPassword;
            });

            if (opUser) {
                // Define keys dynamically via ASCII substrings
                const nameKey = Object.keys(opUser).find(k => k.toLowerCase().includes("ad soyad")) || Object.keys(opUser)[2] || "";
                const depKey = Object.keys(opUser).find(k => k.toLowerCase().includes("departman")) || "";
                const pozKey = Object.keys(opUser).find(k => k.toLowerCase().includes("pozisyon")) || "";
                const roleKey = Object.keys(opUser).find(k => k.toLowerCase().includes("admin")) || "";
                const atamaKey = Object.keys(opUser).find(k => k.toLowerCase().includes("atama")) || "";

                // Login Operasyon
                sessionStorage.setItem("crosslink_operasyon", JSON.stringify({
                    adSoyad: opUser[nameKey] || enteredCompany,
                    departman: opUser[depKey] || "-",
                    pozisyon: opUser[pozKey] || "-",
                    admin: opUser[roleKey] || "Hayır",
                    atamaYetkisi: opUser[atamaKey] || "Hayır"
                }));
                // Wait briefly for UX
                setTimeout(() => { window.location.href = "operasyon.html"; }, 1500);
            } else {
                loadingOverlay.classList.add("hidden");
                loadingOverlay.classList.remove("active");
                showError("Hatalı kullanıcı adı veya şifre.");
            }
        } catch (error) {
            loadingOverlay.classList.add("hidden");
            loadingOverlay.classList.remove("active");
            showError("Bağlantı hatası: " + error.message);
        }
    });

    function showError(msg) {
        errorMessage.textContent = msg;
        errorMessage.style.display = "block";
        errorMessage.style.animation = "none"; // Reset animation
        // Trigger reflow to restart animation
        void errorMessage.offsetWidth;
        errorMessage.style.animation = "shake 0.4s ease-in-out";

        // Add subtle error effect to inputs
        companyInput.style.borderColor = "var(--error)";
        passwordInput.style.borderColor = "var(--error)";

        setTimeout(() => {
            companyInput.style.borderColor = "var(--input-border)";
            passwordInput.style.borderColor = "var(--input-border)";
        }, 2000);
    }

    function handleSuccessfulLogin(user) {
        // Show loading overlay
        loadingOverlay.classList.remove("hidden");
        loadingOverlay.classList.add("active");

        // Save supplier name in session storage
        sessionStorage.setItem("crosslink_supplier", user.company);

        // Redirect to dashboard page
        setTimeout(() => {
            window.location.href = "dashboard.html";
        }, 2000); // Shorter wait so it feels snappier
    }
});
