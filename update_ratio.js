const fs = require('fs');
const path = require('path');

const tplDir = path.join(__dirname, 'src', 'templates');
const files = fs.readdirSync(tplDir).filter(f => f.endsWith('.html') || f === 'shared.css');

files.forEach(file => {
    const fullPath = path.join(tplDir, file);
    let content = fs.readFileSync(fullPath, 'utf8');

    // 1080x1080 비율에서 1080x1350 (4:5) 비율로 높이 변경
    content = content.replace(/height\s*:\s*1080px/gi, 'height:1350px');
    
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`Updated height to 1350px in ${file}`);
});
