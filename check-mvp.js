const fs = require('fs');
const d = JSON.parse(fs.readFileSync('output/data_20260328.json', 'utf8'));
const m = d.mvpTop5[0];
console.log('MVP:', m.playerName, '| playerCode:', m.playerCode, '| team:', m.teamName);
console.log('Keys:', Object.keys(m).join(', '));
