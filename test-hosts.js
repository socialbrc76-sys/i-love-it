const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');
const path = require('path');

async function test0x0() {
    const imagePath = path.join(__dirname, 'output', '20260423_01_cover.png');
    const form = new FormData();
    form.append('file', fs.createReadStream(imagePath));

    try {
        console.log('Testing 0x0.st...');
        const response = await axios.post('https://0x0.st', form, {
            headers: form.getHeaders(),
        });
        console.log('0x0 Success:', response.data.trim());
    } catch(e) {
        console.log('0x0 Error:', e.response?.status, e.response?.data || e.message);
    }
}

async function testTmpFiles() {
    const imagePath = path.join(__dirname, 'output', '20260423_01_cover.png');
    const form = new FormData();
    form.append('file', fs.createReadStream(imagePath));

    try {
        console.log('Testing tmpfiles.org...');
        const response = await axios.post('https://tmpfiles.org/api/v1/upload', form, {
            headers: form.getHeaders(),
        });
        // tmpfiles returns JSON with data.url, need to convert to direct link
        const url = response.data.data.url.replace('tmpfiles.org/', 'tmpfiles.org/dl/');
        console.log('tmpfiles Success:', url);
    } catch(e) {
        console.log('tmpfiles Error:', e.response?.status, e.response?.data || e.message);
    }
}

async function testAll() {
    await test0x0();
    await testTmpFiles();
}
testAll();
