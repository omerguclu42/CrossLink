const https = require('https');

https.get('https://docs.google.com/spreadsheets/d/1McoRE5bx0IWdnbqv-__gtn3ywY0U13zWnMPaArtuCxQ/gviz/tq?tqx=out:json', (res) => {
    let raw = '';
    res.on('data', c => raw += c);
    res.on('end', () => {
        const jsonStr = raw.substring(raw.indexOf('{'), raw.lastIndexOf('}') + 1);
        const data = JSON.parse(jsonStr);
        const headers = data.table.cols.map(c => c.label);
        console.log("Pending Headers:", headers);
    });
});
