// 커버 슬라이드 단독 테스트 (TEAM_COLORS 통일, 로컬 bg를 Base64 데이터 URI로 삽입)
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

function injectData(html, data) {
    let result = html;
    for (const key in data) {
        const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
        const val = data[key] !== undefined && data[key] !== null ? String(data[key]) : '';
        result = result.replace(regex, val);
    }
    return result;
}

// ── 10개 구단 공식 팀 컬러 (puppeteer.js TEAM_COLORS와 동일) ──
const TEAM_COLORS = {
    'KT':   { color: '#000000', accent: '#EC1C24' },
    'LG':   { color: '#C30037', accent: '#C30037' },
    'KIA':  { color: '#EA002C', accent: '#EA002C' },
    '한화':  { color: '#FF6600', accent: '#FF6600' },
    '삼성':  { color: '#074CA1', accent: '#074CA1' },
    '두산':  { color: '#131230', accent: '#1a1a4e' },
    'SSG':  { color: '#CE0E2D', accent: '#CE0E2D' },
    'NC':   { color: '#315288', accent: '#315288' },
    '롯데':  { color: '#D00F31', accent: '#041E42' },
    '키움':  { color: '#570514', accent: '#820924' },
};
function getTeamColor(teamName) {
    return TEAM_COLORS[teamName] || { color: '#6366f1', accent: '#6366f1' };
}
function getContrastText(hexColor) {
    const r = parseInt(hexColor.slice(1,3), 16);
    const g = parseInt(hexColor.slice(3,5), 16);
    const b = parseInt(hexColor.slice(5,7), 16);
    return (r * 0.299 + g * 0.587 + b * 0.114) > 150 ? '#000000' : '#FFFFFF';
}

// ── 로컬 야구 배경 이미지 → base64 데이터 URI ──
const bgDir = path.join(__dirname, 'src', 'assets', 'bg');
const BG_FILES = fs.existsSync(bgDir) ? fs.readdirSync(bgDir).filter(f => /\.(jpg|png|jpeg)$/i.test(f)).sort() : [];

function imgToDataUri(filePath) {
    if (!fs.existsSync(filePath)) return '';
    const buf = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase().replace('.', '');
    const mime = ext === 'png' ? 'image/png' : 'image/jpeg';
    return `data:${mime};base64,${buf.toString('base64')}`;
}

function getRandomBgDataUris(count) {
    if (BG_FILES.length === 0) return Array(count).fill('');
    const shuffled = [...BG_FILES].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(count, shuffled.length)).map(f =>
        imgToDataUri(path.join(bgDir, f))
    );
}

function getBodyBgDataUri() {
    if (BG_FILES.length === 0) return '';
    return imgToDataUri(path.join(bgDir, BG_FILES[0]));
}

async function testCover() {
    const samplePlayers = [
        { playerName: '심우준', teamName: '한화', playerCode: '50108', ab: 4, hit: 2, hr: 1, rbi: 3, run: 3 },
        { playerName: '힐리어드', teamName: 'KT', playerCode: '76232', ab: 4, hit: 3, hr: 1, rbi: 3, run: 2 },
        { playerName: '박동원', teamName: 'LG', playerCode: '67341', ab: 5, hit: 2, hr: 1, rbi: 5, run: 1 },
        { playerName: '박건우', teamName: 'NC', playerCode: '64007', ab: 3, hit: 3, hr: 1, rbi: 3, run: 1 },
    ];

    const tplPath = path.join(__dirname, 'src/templates/cover.html');
    let html = fs.readFileSync(tplPath, 'utf-8');

    function buildStats(p) {
        const parts = [];
        if (p.ab !== undefined && p.hit !== undefined) parts.push(`${p.ab}타수 ${p.hit}안타`);
        if (p.hr && Number(p.hr) > 0) parts.push(`${p.hr}홈런`);
        if (p.rbi && Number(p.rbi) > 0) parts.push(`${p.rbi}타점`);
        if (p.run && Number(p.run) > 0) parts.push(`${p.run}득점`);
        return parts.join(' ');
    }

    const bgDataUris = getRandomBgDataUris(4);
    const bodyBg = getBodyBgDataUri();

    const injectObj = {
        totalSlides: 10,
        hookBadge: '03/30 MVP',
        hookText: '오늘의 <span class="highlight">MVP Top4</span> 🔥',
        hookSubText: '누가 타율 1위로 치고 나갔을까? 👉 넘겨보기',
        bodyBgUrl: bodyBg
    };

    // 4명 데이터 주입
    samplePlayers.forEach((p, i) => {
        const n = i + 1;
        const tc = getTeamColor(p.teamName);
        injectObj[`p${n}Name`] = p.playerName;
        injectObj[`p${n}Team`] = p.teamName;
        injectObj[`p${n}Img`] = `https://sports-phinf.pstatic.net/player/kbo/default/${p.playerCode}.png`;
        injectObj[`p${n}Stats`] = buildStats(p);
        injectObj[`p${n}BgUrl`] = bgDataUris[i] || '';
        injectObj[`p${n}Accent`] = tc.accent;
        injectObj[`p${n}Text`] = getContrastText(tc.accent);
    });

    html = injectData(html, injectObj);

    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1080, height: 1350, deviceScaleFactor: 2 });
    
    // Base64 URI를 직접 템플릿에 문자열로 주입했으므로 파일 로딩 보안 이슈 없음.
    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(r => setTimeout(r, 2000));

    const outPath = path.join(__dirname, 'output/test_cover_v7.png');
    await page.screenshot({ path: outPath, type: 'png' });
    console.log('✅ 커버 테스트 렌더링 완료:', outPath);

    await browser.close();
}

testCover().catch(e => console.error('Error:', e));
