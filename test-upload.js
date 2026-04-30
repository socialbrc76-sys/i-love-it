const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');
const path = require('path');

async function testUpload() {
    const imagePath = path.join(__dirname, 'output', '20260422_01_cover.png');
    const form = new FormData();
    form.append('key', '6d207e02198a847aa98d0a2a901485a5'); // Public API Key
    form.append('image', fs.createReadStream(imagePath));

    try {
        console.log('Testing ImgBB...');
        const response = await axios.post('https://api.imgbb.com/1/upload', form, {
            headers: form.getHeaders(),
        });
        console.log('Success:', response.data.data.url);
    } catch(e) {
        console.log('ImgBB Error:', e.response?.status, e.response?.data);
    }
}
testUpload();
