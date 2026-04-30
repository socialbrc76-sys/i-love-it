const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');
const path = require('path');

async function testCatbox() {
    const imagePath = path.join(__dirname, 'output', '20260422_01_cover.png');
    const form = new FormData();
    form.append('reqtype', 'fileupload');
    form.append('fileToUpload', fs.createReadStream(imagePath));

    try {
        console.log('Testing Catbox...');
        const response = await axios.post('https://catbox.moe/user/api.php', form, {
            headers: form.getHeaders(),
        });
        console.log('Success:', response.data);
    } catch(e) {
        console.log('Catbox Error:', e.response?.status, e.response?.data || e.message);
    }
}
testCatbox();
