const axios = require('axios');
const date = process.argv[2] || '2026-03-31';

console.log(`요청 날짜: ${date}`);

axios.get(`http://localhost:3000/api/generate?date=${date}`)
  .then(r => {
    console.log('Success:', r.data.success);
    console.log('Count:', r.data.images.length);
    r.data.images.forEach((img, i) => {
      const clean = img.split('?')[0];
      console.log('  ' + (i+1) + '. ' + clean);
    });
  })
  .catch(e => {
    console.error('ERROR:', e.message);
    if(e.response) console.error('Data:', e.response.data);
  });
