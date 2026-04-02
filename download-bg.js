// 야구장 배경 이미지 다운로드 스크립트
const https = require('https');
const fs = require('fs');
const path = require('path');

const BG_DIR = path.join(__dirname, 'src/assets/bg');

// 실제 로딩 확인된 Unsplash 야구/스포츠 스타디움 사진 URL
const URLS = [
    { name: 'bg_01.jpg', url: 'https://images.unsplash.com/photo-1529768167801-9173d94c2a42?w=800&q=75' },
    { name: 'bg_02.jpg', url: 'https://images.unsplash.com/photo-1508344928928-7165b67de128?w=800&q=75' },
    { name: 'bg_03.jpg', url: 'https://images.unsplash.com/photo-1578432156115-4aef23d2cb38?w=800&q=75' },
    { name: 'bg_04.jpg', url: 'https://images.unsplash.com/photo-1527066236128-2ff79f7b3e75?w=800&q=75' },
    { name: 'bg_05.jpg', url: 'https://images.unsplash.com/photo-1562077772-3bd90f7a8ab5?w=800&q=75' },
    { name: 'bg_06.jpg', url: 'https://images.unsplash.com/photo-1541746972996-4e0b0f43e02a?w=800&q=75' },
    { name: 'bg_07.jpg', url: 'https://images.unsplash.com/photo-1563299796-17596ed6b017?w=800&q=75' },
    { name: 'bg_08.jpg', url: 'https://images.unsplash.com/photo-1471295253337-3ceaaedca402?w=800&q=75' },
    { name: 'bg_09.jpg', url: 'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=800&q=75' },
    { name: 'bg_10.jpg', url: 'https://images.unsplash.com/photo-1461896836934-bd45ba8a0a07?w=800&q=75' },
];

function download(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        https.get(url, (res) => {
            // Unsplash 리다이렉트 처리
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                file.close();
                fs.unlinkSync(dest);
                download(res.headers.location, dest).then(resolve).catch(reject);
                return;
            }
            if (res.statusCode !== 200) {
                file.close();
                fs.unlinkSync(dest);
                reject(new Error(`${url} -> ${res.statusCode}`));
                return;
            }
            res.pipe(file);
            file.on('finish', () => { file.close(); resolve(); });
        }).on('error', (e) => { file.close(); reject(e); });
    });
}

async function main() {
    if (!fs.existsSync(BG_DIR)) fs.mkdirSync(BG_DIR, { recursive: true });

    let success = 0;
    for (const item of URLS) {
        const dest = path.join(BG_DIR, item.name);
        try {
            await download(item.url, dest);
            const stat = fs.statSync(dest);
            if (stat.size > 5000) {
                console.log(`✅ ${item.name} (${Math.round(stat.size/1024)}KB)`);
                success++;
            } else {
                console.log(`⚠️  ${item.name} 너무 작음 (${stat.size}B), 삭제`);
                fs.unlinkSync(dest);
            }
        } catch (e) {
            console.log(`❌ ${item.name}: ${e.message}`);
        }
    }
    console.log(`\n완료: ${success}/${URLS.length} 다운로드 성공`);
}

main();
