import codecs

with codecs.open('dashboard.js', 'r', 'utf-8') as f:
    text = f.read()

anchor_start = "    const iadeStr = localStorage.getItem('crosslink_iade_date_' + dosyaNo) || rowData['İade Tarihi'];"
anchor_end = "    ['Plaka', 'Marka', 'Segment', 'Yil', 'Km', 'DropKm'].forEach(key => {"

start_idx = text.find(anchor_start)
end_idx = text.find(anchor_end)

if start_idx == -1 or end_idx == -1:
    print("Boundaries not found")
    exit(1)

start_idx += len(anchor_start)

replacement = """
    let isIadeMaked = false;
    if (iadeStr && iadeStr !== "-") isIadeMaked = true;

    const badge = document.getElementById("supModBadge");
    if (isIadeMaked) {
        badge.textContent = "Kullanımı Biten";
        badge.className = "status-badge status-closed";
    } else if (isTeslimatMaked) {
        badge.textContent = "Kullanımı Devam Eden";
        badge.className = "status-badge status-progress";
    } else {
        badge.textContent = "Teslimatı Beklenen";
        badge.className = "status-badge status-open";
    }

    // Inputs population from localStorage or Excel
    document.getElementById("supInputPlaka").value = localStorage.getItem('crosslink_plaka_' + dosyaNo) || rowData['Plaka'] || "";
    document.getElementById("supInputMarka").value = localStorage.getItem('crosslink_marka_' + dosyaNo) || rowData['Marka'] || "";
    document.getElementById("supInputSegment").value = localStorage.getItem('crosslink_segment_' + dosyaNo) || rowData['Segment'] || "";
    document.getElementById("supInputYil").value = localStorage.getItem('crosslink_yil_' + dosyaNo) || rowData['Araç Yılı'] || "";
    document.getElementById("supInputKm").value = localStorage.getItem('crosslink_km_' + dosyaNo) || rowData['Kilometre'] || "";
    document.getElementById("supInputDropKm").value = localStorage.getItem('crosslink_drop_km_' + dosyaNo) || "";
    
    document.getElementById("supInputTeslimatTarihi").value = localStorage.getItem('crosslink_teslimat_date_' + dosyaNo) ? convertToDatetimeLocal(localStorage.getItem('crosslink_teslimat_date_' + dosyaNo)) : "";
    document.getElementById("supInputIadeTarihi").value = localStorage.getItem('crosslink_iade_date_' + dosyaNo) ? convertToDatetimeLocal(localStorage.getItem('crosslink_iade_date_' + dosyaNo)) : "";

    // Button states
    const btnTeslimat = document.getElementById('btnSupTeslimat');
    const btnIade = document.getElementById('btnSupIade');
    const dropKmInput = document.getElementById("supInputDropKm");

    if (isIadeMaked) {
        btnTeslimat.classList.add("hidden");
        btnIade.classList.add("hidden");
        dropKmInput.disabled = true;
    } else if (isTeslimatMaked) {
        btnTeslimat.classList.add("hidden");
        btnIade.classList.remove("hidden");
        dropKmInput.disabled = false; // teslimattan sonra drop girilebilir
    } else {
        btnTeslimat.classList.remove("hidden");
        btnIade.classList.add("hidden");
        dropKmInput.disabled = true; // henüz teslimat yok
    }

    // Load Logs
    const logList = document.getElementById('supLogList');
    logList.innerHTML = "";
    let assignments = JSON.parse(localStorage.getItem('crosslink_assignments') || "{}");
    let logs = [];
    if (assignments[dosyaNo] && assignments[dosyaNo].logs) logs = assignments[dosyaNo].logs;
    
    if (logs.length === 0) {
        logList.innerHTML = "<li style='color:#9ca3af; font-style:italic;'>Bu dosyaya ait sistemsel not bulunamadı.</li>";
    } else {
        logs.forEach(l => {
            const li = document.createElement("li");
            li.style.cssText = "padding:6px 0; border-bottom:1px dashed #e0f2fe; font-size:0.9rem;";
            li.innerHTML = `<strong style="color:#0284c7">#</strong> <span style="font-weight:600; color:#374151;">${l.user}:</span> <span style="color:#475569">${l.message}</span> <span style="font-size:0.75rem; color:#9ca3af; margin-left:8px;">(${l.time})</span>`;
            logList.appendChild(li);
        });
    }

"""

new_text = text[:start_idx] + "\n" + replacement + "\n" + text[end_idx:]

with codecs.open('dashboard.js', 'w', 'utf-8') as f:
    f.write(new_text)

print("Fixed successfully!")
