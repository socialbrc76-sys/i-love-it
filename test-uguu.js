const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');
const path = require('path');

async function testUguu() {
    const imagePath = path.join(__dirname, 'output', '20260422_01_cover.png');
    const form = new FormData();
    form.append('files[]', fs.createReadStream(imagePath));

    try {
        console.log('Testing Uguu...');
        const response = await axios.post('https://uguu.se/upload.php', form, {
            headers: form.getHeaders(),
        });
        console.log('Success:', response.data.files[0].url);
    } catch(e) {
        console.log('Uguu Error:', e.response?.status, e.response?.data || e.message);
    }
}
testUguu();
