/**
 * KIA 타이거즈 응원가 오케스트라 메들리 - 프로모션 캐러셀 렌더링 & 업로드
 */
require('dotenv').config();
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const instagramAPI = require('./src/api/instagram');

const PROMO_DIR = path.join(__dirname, 'promo');
const OUTPUT_DIR = path.join(__dirname, 'output', 'promo');

const SLIDES = [
    'slide1-cover.html',
    'slide2-tracklist.html',
    'slide3-cta.html'
];

async function renderSlides() {
    // output/promo 디렉토리 생성
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    console.log('🎨 [렌더링] Puppeteer로 프로모션 캐러셀 슬라이드 렌더링 시작...\n');
    
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
    });

    const outputPaths = [];
    
    for (let i = 0; i < SLIDES.length; i++) {
        const page = await browser.newPage();
        await page.setViewport({ width: 1080, height: 1350, deviceScaleFactor: 1 });
        
        const htmlPath = path.join(PROMO_DIR, SLIDES[i]);
        await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle0', timeout: 15000 });
        
        // 폰트 로딩 대기
        await page.evaluate(() => document.fonts.ready);
        await new Promise(r => setTimeout(r, 1000));
        
        const outputPath = path.join(OUTPUT_DIR, `promo_${String(i + 1).padStart(2, '0')}_${SLIDES[i].replace('.html', '.png')}`);
        await page.screenshot({ path: outputPath, type: 'png' });
        outputPaths.push(outputPath);
        
        console.log(`  ✅ [${i + 1}/${SLIDES.length}] ${path.basename(outputPath)}`);
        await page.close();
    }

    await browser.close();
    console.log(`\n✅ Total ${SLIDES.length}/${SLIDES.length} slides rendered.\n`);
    return outputPaths;
}

async function uploadToInstagram(imagePaths) {
    const caption = `🐯⚾ KIA 타이거즈 팬이라면 이 영상 꼭 봐야 합니다!

🎬 KIA 타이거즈 응원가 오케스트라 메들리
"한 명의 선수를 향한 함성이 거대한 교향곡이 되는 순간."

챔피언스 필드의 뜨거운 함성들이 웅장한 시네마틱 오케스트라 사운드로 다시 태어났습니다! 🎻🎺

🎵 수록곡:
01. KIA 타이거즈 구단가
02. 이창진 응원가
03. 김도영 응원가
04. 나성범 응원가
05. 최형우 응원가
06. 승리의 노래 (Grand Finale)

👉 YouTube에서 "Cosmic Void" 검색하고
"KIA 타이거즈 응원가 오케스트라 메들리" 감상하세요! 🔎

🌌 Cosmic Void - AI 5인조 K-pop 비주얼 밴드
구독 + 좋아요 + 알림설정 🔔

👇 숫자가 알려주는 진짜 KBO 이야기
@kbo_data_lab 팔로우하고 매일 야구 200% 즐기기 📬`;

    const comment = `#KIA타이거즈 #기아타이거즈 #KIA #타이거즈 #광주 #챔피언스필드 #응원가 #KBO #프로야구 #야구 #오케스트라 #메들리 #김도영 #나성범 #최형우 #이창진 #V13 #CosmicVoid #AI밴드 #Kpop커버 #시네마틱 #오케스트라편곡`;

    console.log('📸 [Instagram] 프로모션 캐러셀 업로드 시작...');
    await instagramAPI.publishToInstagram(imagePaths, caption, comment);
    console.log('✅ [Instagram SUCCESS] 프로모션 캐러셀 업로드 완료!');
}

async function main() {
    console.log('🚀 KIA 타이거즈 응원가 오케스트라 메들리 - 프로모션 파이프라인\n');
    
    // 1. 렌더링
    const imagePaths = await renderSlides();
    
    // 2. 렌더링 결과 확인
    console.log('📋 렌더링된 슬라이드:');
    imagePaths.forEach((p, i) => console.log(`  ${i + 1}. ${path.basename(p)}`));
    
    // 3. 인스타그램 업로드
    const doUpload = process.argv.includes('--upload');
    if (doUpload) {
        await uploadToInstagram(imagePaths);
    } else {
        console.log('\n⚠️ 업로드를 하려면 --upload 플래그를 추가해주세요.');
        console.log('   예: node promo-runner.js --upload');
        console.log('\n🖼️ 먼저 output/promo/ 폴더에서 렌더링 결과를 확인해보세요!');
    }
}

main().catch(err => {
    console.error('❌ 에러 발생:', err.message);
    process.exit(1);
});
