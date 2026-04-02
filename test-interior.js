const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// puppeteer.js 에서 이미지 Base64 변환 함수 가져오기
function imgToDataUri(imgPath) {
    if (!fs.existsSync(imgPath)) return "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
    const bodyBase64 = fs.readFileSync(imgPath, 'base64');
    const ext = path.extname(imgPath).toLowerCase() === '.jpg' ? 'jpeg' : 'png';
    return `data:image/${ext};base64,${bodyBase64}`;
}

async function testInterior() {
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--force-device-scale-factor=2']
    });
    
    // 1080x1350 사이즈!
    const page = await browser.newPage();
    await page.setViewport({ width: 1080, height: 1350, deviceScaleFactor: 2 });

    const tplPath = path.join(__dirname, 'src', 'templates', 'batting-race.html');
    let html = fs.readFileSync(tplPath, 'utf-8');

    // 하드코딩된 테스트 데이터! 
    const mockData = {
        slideNum: 2,
        totalSlides: 10,
        dateDisplay: "03/28",
        // Top 4 
        t1Team: "KT", t1Name: "심우준", t1Avg: "0.750", t1Ab: 8, t1Hit: 6, t1Color: "#000000", t1Change: "NEW", t1ChangeClass: "new", 
        t1Img: imgToDataUri(path.join(__dirname, 'src', 'assets', 'players', 'sim_woojun.png')),
        
        t2Team: "LG", t2Name: "오스틴", t2Avg: "0.667", t2Ab: 9, t2Hit: 6, t2Color: "#C30037", t2Change: "NEW", t2ChangeClass: "new", 
        t2Img: imgToDataUri(path.join(__dirname, 'src', 'assets', 'players', 'austin.png')),
        
        t3Team: "KIA", t3Name: "김도영", t3Avg: "0.556", t3Ab: 9, t3Hit: 5, t3Color: "#EA0029", t3Change: "NEW", t3ChangeClass: "new", 
        t3Img: imgToDataUri(path.join(__dirname, 'src', 'assets', 'players', 'kim_doyoung.png')),
        
        t4Team: "한화", t4Name: "페라자", t4Avg: "0.545", t4Ab: 11, t4Hit: 6, t4Color: "#FF6600", t4Change: "NEW", t4ChangeClass: "new", 
        t4Img: imgToDataUri(path.join(__dirname, 'src', 'assets', 'players', 'feraza.png'))
    };

    // html 변수 치환
    for (const key in mockData) {
        html = html.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), mockData[key]);
    }

    try {
        await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 5000 });
        await new Promise(r => setTimeout(r, 1200));

        const outDir = path.join(__dirname, 'output');
        if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);
        
        const outPath = path.join(outDir, 'test_interior_v1.png');
        await page.screenshot({ path: outPath, type: 'png' });
        console.log(`✅ 타율왕 레이스 테스트 렌더링 완료: ${outPath}`);
    } catch (err) {
        console.error(`❌ 에러: ${err.message}`);
    } finally {
        await browser.close();
    }
}

testInterior();
