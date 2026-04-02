const fs = require('fs');
const path = require('path');

const tplDir = path.join(__dirname, 'src', 'templates');
const files = fs.readdirSync(tplDir).filter(f => f.endsWith('.html'));

files.forEach(file => {
    const fullPath = path.join(tplDir, file);
    let html = fs.readFileSync(fullPath, 'utf8');

    // 1. 대부분의 페이지: KBO TODAY -> @kbo_data_lab
    html = html.replace(/<div class="logo">.*?(KBO.*TODAY).*?<\/div>/gi, '<div class="logo">@kbo_data_<span class="highlight">lab</span></div>');
    // 컬러 클래스 변경 (기존에 #e53e3e 사용하던 것을 분홍/보라색 톤으로 변경)
    html = html.replace(/\.logo span\s*\{\s*color:[^}]+\}/gi, '.logo { font-family: \'Archivo Black\', sans-serif; font-style: italic; }\n.logo span.highlight { color: #c084fc; }');

    // 2. cover.html: SPOTV NOW KBO -> @kbo_data_lab
    if (file === 'cover.html') {
        html = html.replace(/<span class="footer-text">SPOTV.*?<\/span>/i, '<span class="footer-text">@kbo_data_<span class="neon">lab</span></span>');
        html = html.replace(/\.footer-text \.neon\s*\{[^}]+\}/i, '.footer-text .neon { color: #c084fc; text-shadow: 0 0 10px rgba(192,132,252,0.6); font-style: italic; }');
    }

    fs.writeFileSync(fullPath, html, 'utf8');
    console.log(`Updated ${file}`);
});
