const fs = require('fs');

const filepath = 'operasyon.js';
let content = fs.readFileSync(filepath, 'utf8');

const target = /let atanmaMs = r\[\'Atanma Tarihi\'\] \? parseRaporDate\(r\[\'Atanma Tarihi\'\]\)\.getTime\(\) : 0;/g;

const replacement = `let dNo = r['Dosya No'] || (a ? a.dosyaNo : null);
            let atamaLocal = localStorage.getItem("atama_time_" + dNo);
            let atanmaStr = r['Atanma Tarihi'] || r['Atama Tarihi'] || atamaLocal;
            let atanmaMs = atanmaStr ? parseRaporDate(atanmaStr).getTime() : 0;`;

if (target.test(content)) {
    content = content.replace(target, replacement);
    fs.writeFileSync(filepath, content, 'utf8');
    console.log("processRow patched successfully.");
} else {
    console.log("Could not find the target line to patch.");
}
