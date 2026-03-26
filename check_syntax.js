const fs=require('fs'); try { const src=fs.readFileSync(process.argv[2],'utf8'); new Function(src); console.log('OK - No syntax errors'); } catch(e) { console.error('SYNTAX ERROR:', e.message); }
