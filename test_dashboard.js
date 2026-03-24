const https = require('https');

function fetchCSV(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                return fetchCSV(res.headers.location).then(resolve).catch(reject);
            }
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        }).on('error', reject);
    });
}

function parseCSV(csvText, status) {
    const lines = csvText.split('\n').filter(line => line.trim() !== "");
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim());
    const data = [];

    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',');
        if (values.length > 5) {
            let rowObj = {};
            headers.forEach((header, index) => {
                rowObj[header] = values[index] ? values[index].trim() : "";
            });
            rowObj['Teslimat Durumu'] = status;
            data.push(rowObj);
        }
    }
    return data;
}

function toLowerTr(str) {
    if (!str) return "";
    return str.replace(/İ/g, 'i').replace(/I/g, 'ı').toLowerCase();
}

const DELIVERED_CSV_URL = "https://docs.google.com/spreadsheets/d/1d-IUF5slokrV36jc5oOZcfK0v-lUz0JoC2fjEAm6CLo/export?format=csv";
const PENDING_CSV_URL = "https://docs.google.com/spreadsheets/d/1McoRE5bx0IWdnbqv-__gtn3ywY0U13zWnMPaArtuCxQ/export?format=csv";

async function test() {
    console.log("Fetching...");
    const deliveredText = await fetchCSV(DELIVERED_CSV_URL);
    const pendingText = await fetchCSV(PENDING_CSV_URL);

    const deliveredRows = parseCSV(deliveredText, "Teslim Edildi");
    const pendingRows = parseCSV(pendingText, "Teslim Edilmedi");

    let allData = [...deliveredRows, ...pendingRows];
    console.log("Total rows: ", allData.length);

    // Check what Tedarikci is in row 20
    const row20Tedarikci = allData[20]['Tedarikçi'] || "";
    console.log("Sample Row 20 Tedarikçi raw: [" + row20Tedarikci + "], len: " + row20Tedarikci.length);
    let hex = "";
    for (let i = 0; i < row20Tedarikci.length; i++) {
        hex += row20Tedarikci.charCodeAt(i).toString(16) + " ";
    }
    console.log("Sample Row 20 Hex:", hex);

    const currentSupplier = "AKTİF FİLO";
    console.log("currentSupplier toMatch: [" + currentSupplier + "]");
    let hex2 = "";
    for (let i = 0; i < currentSupplier.length; i++) {
        hex2 += currentSupplier.charCodeAt(i).toString(16) + " ";
    }
    console.log("CurrentSupplier Hex:", hex2);

    const supplierLower = toLowerTr(currentSupplier).trim();

    console.log("Supplier Lower To Find: [" + supplierLower + "]");

    let combinedData = allData.filter(row => {
        const rowSupplier = toLowerTr(row['Tedarikçi']).trim();
        return rowSupplier === supplierLower || rowSupplier.includes(supplierLower) || supplierLower.includes(rowSupplier);
    });

    console.log("Filtered count default:", combinedData.length);

    // Compare exact row20 with supplier
    const row20Lower = toLowerTr(row20Tedarikci).trim();
    console.log("row20 lower: [" + row20Lower + "]");
    console.log("is equal?", row20Lower === supplierLower);
    console.log("row20 includes supplierLower?", row20Lower.includes(supplierLower));
    console.log("supplierLower includes row20?", supplierLower.includes(row20Lower));
}

test();
