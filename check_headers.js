const https = require('https');

https.get('https://docs.google.com/spreadsheets/d/1d-IUF5slokrV36jc5oOZcfK0v-lUz0JoC2fjEAm6CLo/gviz/tq?tqx=out:json', (res) => {
    let raw = '';
    res.on('data', c => raw += c);
    res.on('end', () => {
        const jsonStr = raw.substring(raw.indexOf('{'), raw.lastIndexOf('}') + 1);
        const data = JSON.parse(jsonStr);
        const headers = data.table.cols.map(c => c.label);
        console.log("Completed Headers:", headers);
    });
});
