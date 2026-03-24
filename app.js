// Authentication Logic & UI Interactions

// Valid Credentials mapping based on Google Sheet Data
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

    loginForm.addEventListener("submit", (e) => {
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
        } else if (enteredCompany.trim().toLowerCase() === 'admin' && enteredPassword === 'admin123') {
            // Admin Login
            loadingOverlay.classList.remove("hidden");
            loadingOverlay.classList.add("active");
            sessionStorage.setItem("crosslink_admin", "true");
            setTimeout(() => { window.location.href = "admin.html"; }, 2000);
        } else {
            showError("Hatalı firma adı veya şifre kayıtlı değil.");
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
