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

async function renderCarousel(finalData, outputDir) {
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--force-device-scale-factor=2']
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1080, height: 1350, deviceScaleFactor: 2 });

    const generatedFiles = [];
    const dateStr = finalData.date.replace(/-/g, '');
    const totalSlides = 10;
    const dateDisplay = `${finalData.date.substring(5,7)}/${finalData.date.substring(8,10)}`;

    async function captureSlide(templateName, injectObj, filename) {
        const tplPath = path.join(__dirname, `../templates/${templateName}`);
        if (!fs.existsSync(tplPath)) {
            console.warn(`  ⚠ Template not found: ${templateName}`);
            return false;
        }
        let html = fs.readFileSync(tplPath, 'utf-8');
        html = injectData(html, { totalSlides, dateDisplay, ...injectObj });

        try {
            await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 5000 });
            await new Promise(r => setTimeout(r, 1200));
            const outPath = path.join(outputDir, filename);
            await page.screenshot({ path: outPath, type: 'png' });
            generatedFiles.push(`/output/${filename}?v=${Date.now()}`);
            console.log(`  ✅ [${generatedFiles.length}/${totalSlides}] ${filename}`);
            return true;
        } catch (err) {
            console.error(`  ❌ Failed: ${filename} — ${err.message}`);
            return false;
        }
    }

    const top5 = (finalData.mvpData && finalData.mvpData.top5) || [];
    const mvp = (finalData.mvpData && finalData.mvpData.topMVP) || null;
    const br = finalData.battingRace || [];
    const rookies = finalData.rookies || [];
    const news = finalData.hotNews || [];
    const ai = finalData.aiPrediction || null;

    // ── KBO 10개 구단 공식 팀 컬러 ──
    const TEAM_COLORS = {
        'KT':   { color: '#000000', accent: '#EC1C24', short: 'KT' },
        'LG':   { color: '#C30037', accent: '#C30037', short: 'LG' },
        'KIA':  { color: '#EA002C', accent: '#EA002C', short: 'KIA' },
        '한화':  { color: '#FF6600', accent: '#FF6600', short: 'HWE' },
        '삼성':  { color: '#074CA1', accent: '#074CA1', short: 'SS' },
        '두산':  { color: '#131230', accent: '#1a1a4e', short: 'OB' },
        'SSG':  { color: '#CE0E2D', accent: '#CE0E2D', short: 'SSG' },
        'NC':   { color: '#315288', accent: '#315288', short: 'NC' },
        '롯데':  { color: '#D00F31', accent: '#041E42', short: 'LT' },
        '키움':  { color: '#570514', accent: '#820924', short: 'KW' },
    };
    function getTeamColor(teamName) {
        return TEAM_COLORS[teamName] || { color: '#6366f1', accent: '#6366f1', short: teamName.substring(0,2) };
    }

    // 뉴스 폴백 데이터
    const n1 = news[0] || { headline: '개막전 열기 뜨겁다!', summary1: 'KBO 2026 시즌 첫 주말', summary2: '5경기 역대급 타자 퍼레이드' };
    const n2 = news[1] || { headline: '홈런 3방 쏟아진 경기', summary1: '개막 주말 파워 히터들', summary2: '시즌 초반 장타 경쟁 점화' };
    const n3 = news[2] || { headline: '에이스들 돌아왔다', summary1: '선발 투수들의 개막전 성적', summary2: '시즌 기대를 높이는 호투' };

    // ── 로컬 야구 배경 이미지 → base64 데이터 URI (확실한 로딩 보장) ──
    const bgDir = path.join(__dirname, '..', 'assets', 'bg');
    const BG_FILES = fs.readdirSync(bgDir).filter(f => /\.(jpg|png|jpeg)$/i.test(f)).sort();

    function imgToDataUri(filePath) {
        const buf = fs.readFileSync(filePath);
        const ext = path.extname(filePath).toLowerCase().replace('.', '');
        const mime = ext === 'png' ? 'image/png' : 'image/jpeg';
        return `data:${mime};base64,${buf.toString('base64')}`;
    }

    function getRandomBgDataUris(count) {
        const shuffled = [...BG_FILES].sort(() => Math.random() - 0.5);
        return shuffled.slice(0, Math.min(count, shuffled.length)).map(f =>
            imgToDataUri(path.join(bgDir, f))
        );
    }

    // 전체 배경용 (첫 번째 이미지 고정)
    function getBodyBgDataUri() {
        if (BG_FILES.length === 0) return '';
        return imgToDataUri(path.join(bgDir, BG_FILES[0]));
    }
    // 커버용 팀 컬러 텍스트 대비 계산
    function getContrastText(hexColor) {
        const r = parseInt(hexColor.slice(1,3), 16);
        const g = parseInt(hexColor.slice(3,5), 16);
        const b = parseInt(hexColor.slice(5,7), 16);
        return (r * 0.299 + g * 0.587 + b * 0.114) > 150 ? '#000000' : '#FFFFFF';
    }

    // 커버 성적바 (한 줄 텍스트)
    function buildStatsLine(p) {
        if (!p) return '';
        const parts = [];
        if (p.ab !== undefined && p.hit !== undefined) parts.push(`${p.ab}타수 ${p.hit}안타`);
        if (p.hr && Number(p.hr) > 0) parts.push(`${p.hr}홈런`);
        if (p.rbi && Number(p.rbi) > 0) parts.push(`${p.rbi}타점`);
        if (p.run && Number(p.run) > 0) parts.push(`${p.run}득점`);
        if (p.sb && Number(p.sb) > 0) parts.push(`${p.sb}도루`);
        return parts.join(' ');
    }

    // 선수 프로필 이미지 URL 생성
    function getPlayerImgUrl(p) {
        return p && p.playerCode ? `https://sports-phinf.pstatic.net/player/kbo/default/${p.playerCode}.png` : '';
    }

    try {
        // ── 1. 커버 (SPOTV KBO 인풋이미지 완벽 매칭 2x2) ──
        const p1 = top5[0] || {}; const c1 = getTeamColor(p1.teamName);
        const p2 = top5[1] || {}; const c2 = getTeamColor(p2.teamName);
        const p3 = top5[2] || {}; const c3 = getTeamColor(p3.teamName);
        const p4 = top5[3] || {}; const c4 = getTeamColor(p4.teamName);

        const bgDataUris = getRandomBgDataUris(4);
        const bodyBg = getBodyBgDataUri();
        
        await captureSlide('cover.html', {
            hookBadge: `${dateDisplay} MVP`,
            hookText: `오늘의 <span class="highlight">MVP Top4</span> 🔥`,
            hookSubText: '누가 타율 1위로 치고 나갔을까? 👉 넘겨보기',
            bodyBgUrl: bodyBg,

            p1Name: p1.playerName || '-', p1Team: p1.teamName || '-', p1Img: getPlayerImgUrl(p1), p1Stats: buildStatsLine(p1), p1BgUrl: bgDataUris[0] || '',
            p1Accent: c1.accent, p1Text: getContrastText(c1.accent),

            p2Name: p2.playerName || '-', p2Team: p2.teamName || '-', p2Img: getPlayerImgUrl(p2), p2Stats: buildStatsLine(p2), p2BgUrl: bgDataUris[1] || '',
            p2Accent: c2.accent, p2Text: getContrastText(c2.accent),

            p3Name: p3.playerName || '-', p3Team: p3.teamName || '-', p3Img: getPlayerImgUrl(p3), p3Stats: buildStatsLine(p3), p3BgUrl: bgDataUris[2] || '',
            p3Accent: c3.accent, p3Text: getContrastText(c3.accent),

            p4Name: p4.playerName || '-', p4Team: p4.teamName || '-', p4Img: getPlayerImgUrl(p4), p4Stats: buildStatsLine(p4), p4BgUrl: bgDataUris[3] || '',
            p4Accent: c4.accent, p4Text: getContrastText(c4.accent),
        }, `${dateStr}_01_cover.png`);

        // ── 2. 타율왕 레이스 (F1 스타일 팀 컬러 + 순위 변동) ──
        if (br.length >= 4) {
            // 전날 데이터 로드 (순위 변동 비교용)
            const prevDate = new Date(finalData.date);
            prevDate.setDate(prevDate.getDate() - 1);
            const prevStr = prevDate.toISOString().split('T')[0].replace(/-/g, '');
            const prevPath = path.join(outputDir, `data_${prevStr}.json`);
            let prevRanks = {};
            if (fs.existsSync(prevPath)) {
                try {
                    const prev = JSON.parse(fs.readFileSync(prevPath, 'utf-8'));
                    (prev.battingRace || []).forEach((p, i) => { prevRanks[p.playerName] = i + 1; });
                } catch(e) { /* ignore */ }
            }

            function getRankChange(name, currentRank) {
                if (!prevRanks[name]) return { text: 'NEW', cls: 'new' };
                const diff = prevRanks[name] - currentRank;
                if (diff > 0) return { text: `▲${diff}`, cls: 'up' };
                if (diff < 0) return { text: `▼${Math.abs(diff)}`, cls: 'down' };
                return { text: '—', cls: 'same' };
            }

            const c1 = getRankChange(br[0].playerName, 1), c2 = getRankChange(br[1].playerName, 2);
            const c3 = getRankChange(br[2].playerName, 3), c4 = getRankChange(br[3].playerName, 4);
            const tc1 = getTeamColor(br[0].teamName), tc2 = getTeamColor(br[1].teamName);
            const tc3 = getTeamColor(br[2].teamName), tc4 = getTeamColor(br[3].teamName);
            await captureSlide('batting-race.html', {
                slideNum: 2,
                t1Name: br[0].playerName, t1Team: br[0].teamName, t1Avg: br[0].avg, t1Ab: br[0].ab, t1Hit: br[0].hit, t1Color: tc1.color, t1TeamShort: tc1.short, t1Change: c1.text, t1ChangeClass: c1.cls, t1Img: br[0].imageUrl,
                t2Name: br[1].playerName, t2Team: br[1].teamName, t2Avg: br[1].avg, t2Ab: br[1].ab, t2Hit: br[1].hit, t2Color: tc2.color, t2TeamShort: tc2.short, t2Change: c2.text, t2ChangeClass: c2.cls, t2Img: br[1].imageUrl,
                t3Name: br[2].playerName, t3Team: br[2].teamName, t3Avg: br[2].avg, t3Ab: br[2].ab, t3Hit: br[2].hit, t3Color: tc3.color, t3TeamShort: tc3.short, t3Change: c3.text, t3ChangeClass: c3.cls, t3Img: br[2].imageUrl,
                t4Name: br[3].playerName, t4Team: br[3].teamName, t4Avg: br[3].avg, t4Ab: br[3].ab, t4Hit: br[3].hit, t4Color: tc4.color, t4TeamShort: tc4.short, t4Change: c4.text, t4ChangeClass: c4.cls, t4Img: br[3].imageUrl,
            }, `${dateStr}_02_batting.png`);
        }

        // ── 3. 타율왕 상세 2×2 카드 (팀 컬러 + 선수 사진) ──
        if (br.length >= 4) {
            const tc1 = getTeamColor(br[0].teamName), tc2 = getTeamColor(br[1].teamName);
            const tc3 = getTeamColor(br[2].teamName), tc4 = getTeamColor(br[3].teamName);
            await captureSlide('batting-detail.html', {
                slideNum: 3,
                t1Name: br[0].playerName, t1Team: br[0].teamName, t1Avg: br[0].avg, t1Hit: br[0].hit, t1Hr: br[0].hr, t1Color: tc1.color, t1TeamShort: tc1.short, t1Img: br[0].imageUrl,
                t2Name: br[1].playerName, t2Team: br[1].teamName, t2Avg: br[1].avg, t2Hit: br[1].hit, t2Hr: br[1].hr, t2Color: tc2.color, t2TeamShort: tc2.short, t2Img: br[1].imageUrl,
                t3Name: br[2].playerName, t3Team: br[2].teamName, t3Avg: br[2].avg, t3Hit: br[2].hit, t3Hr: br[2].hr, t3Color: tc3.color, t3TeamShort: tc3.short, t3Img: br[2].imageUrl,
                t4Name: br[3].playerName, t4Team: br[3].teamName, t4Avg: br[3].avg, t4Hit: br[3].hit, t4Hr: br[3].hr, t4Color: tc4.color, t4TeamShort: tc4.short, t4Img: br[3].imageUrl,
            }, `${dateStr}_03_batting_detail.png`);
        }

        // ── 4. 오늘의 MVP (팀 컬러 + 선수 사진) ──
        if (mvp) {
            const mvpTc = getTeamColor(mvp.teamName);
            const mvpImgUrl = `https://sports-phinf.pstatic.net/player/kbo/default/${mvp.playerCode}.png`;
            function getTop5Img(p) { return p ? `https://sports-phinf.pstatic.net/player/kbo/default/${p.playerCode}.png` : ''; }
            function getTop5Color(p) { return p ? getTeamColor(p.teamName).color : '#6366f1'; }
            await captureSlide('mvp.html', {
                slideNum: 4,
                teamName: mvp.teamName, playerName: mvp.playerName,
                ab: mvp.ab, hit: mvp.hit, hr: mvp.hr, rbi: mvp.rbi, run: mvp.run, mvpScore: mvp.mvpScore,
                mvpColor: mvpTc.color, mvpImg: mvpImgUrl,
                r2Name: top5[1] ? top5[1].playerName : '-', r2Score: top5[1] ? top5[1].mvpScore : '-', r2Img: getTop5Img(top5[1]), r2Color: getTop5Color(top5[1]),
                r3Name: top5[2] ? top5[2].playerName : '-', r3Score: top5[2] ? top5[2].mvpScore : '-', r3Img: getTop5Img(top5[2]), r3Color: getTop5Color(top5[2]),
                r4Name: top5[3] ? top5[3].playerName : '-', r4Score: top5[3] ? top5[3].mvpScore : '-', r4Img: getTop5Img(top5[3]), r4Color: getTop5Color(top5[3]),
                r5Name: top5[4] ? top5[4].playerName : '-', r5Score: top5[4] ? top5[4].mvpScore : '-', r5Img: getTop5Img(top5[4]), r5Color: getTop5Color(top5[4]),
            }, `${dateStr}_04_mvp.png`);
        }

        // ── 5. MVP 상세 (히어로 스타일 대형 이미지) ──
        if (mvp) {
            const mvpTc = getTeamColor(mvp.teamName);
            const mvpImgUrl = `https://sports-phinf.pstatic.net/player/kbo/default/${mvp.playerCode}.png`;
            // 팀 컬러 알파값 (배경 글로우용)
            const hexToRgba = (hex, a) => { const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16); return `rgba(${r},${g},${b},${a})`; };
            let inningItems = '';
            for (let i = 1; i <= 12; i++) {
                const key = `inn${i}`;
                const val = mvp[key];
                if (val && val.trim() !== '') {
                    const isHit = val.includes('안') || val.includes('적시');
                    const isHr = val.includes('홈');
                    const isBb = val.includes('4구');
                    const cls = isHr ? 'hr' : isHit ? 'hit' : isBb ? 'bb' : 'out';
                    inningItems += `<div class="inning-item"><div class="inn">${i}회</div><div class="result ${cls}">${val}</div></div>`;
                }
            }
            if (!inningItems) inningItems = '<div class="inning-item"><div class="inn">-</div><div class="result out">기록 없음</div></div>';

            await captureSlide('mvp-detail.html', {
                slideNum: 5,
                playerName: mvp.playerName, teamName: mvp.teamName, mvpScore: mvp.mvpScore,
                hra: mvp.hra || '-', ab: mvp.ab, hit: mvp.hit, hr: mvp.hr, rbi: mvp.rbi, run: mvp.run,
                mvpColor: mvpTc.color, mvpColorAlpha: hexToRgba(mvpTc.color, 0.15), mvpImg: mvpImgUrl,
                inningItems,
            }, `${dateStr}_05_mvp_detail.png`);
        }

        // ── 6. 루키 스포트라이트 ──
        if (rookies.length >= 3) {
            await captureSlide('rookie.html', {
                slideNum: 6,
                r1Name: rookies[0].playerName, r1Team: rookies[0].teamName, r1Avg: rookies[0].avg, r1Ops: rookies[0].ops, r1Note: rookies[0].isFirstHit ? '🎉 프로 첫 안타 달성!' : '프로 적응 중',
                r2Name: rookies[1].playerName, r2Team: rookies[1].teamName, r2Avg: rookies[1].avg, r2Ops: rookies[1].ops, r2Note: rookies[1].isFirstHit ? '🎉 프로 첫 안타 달성!' : '프로 적응 중',
                r3Name: rookies[2].playerName, r3Team: rookies[2].teamName, r3Avg: rookies[2].avg, r3Ops: rookies[2].ops, r3Note: rookies[2].isFirstHit ? '🎉 프로 첫 안타 달성!' : '프로 적응 중',
            }, `${dateStr}_06_rookie.png`);
        }

        // ── 7. 루키 상세 (재활용: 루키 1위 선수 MVP 스코어 비교) ──
        if (rookies.length >= 3) {
            await captureSlide('rookie.html', {
                slideNum: 7,
                r1Name: rookies[0].playerName, r1Team: rookies[0].teamName, r1Avg: rookies[0].avg, r1Ops: rookies[0].ops, r1Note: `타율 ${rookies[0].avg} · 프로 데뷔전`,
                r2Name: rookies[1].playerName, r2Team: rookies[1].teamName, r2Avg: rookies[1].avg, r2Ops: rookies[1].ops, r2Note: `타율 ${rookies[1].avg} · 기대주`,
                r3Name: rookies[2].playerName, r3Team: rookies[2].teamName, r3Avg: rookies[2].avg, r3Ops: rookies[2].ops, r3Note: `타율 ${rookies[2].avg} · 적응 중`,
            }, `${dateStr}_07_rookie_detail.png`);
        }

        // ── 8. 핫뉴스 Top3 ──
        await captureSlide('hot-news.html', {
            slideNum: 8,
            n1Headline: n1.headline, n1Summary: `${n1.summary1 || ''} ${n1.summary2 || ''}`,
            n2Headline: n2.headline, n2Summary: `${n2.summary1 || ''} ${n2.summary2 || ''}`,
            n3Headline: n3.headline, n3Summary: `${n3.summary1 || ''} ${n3.summary2 || ''}`,
        }, `${dateStr}_08_hotnews.png`);

        // ── 9. 핫뉴스 상세 ──
        await captureSlide('hot-news-detail.html', {
            slideNum: 9,
            n1Headline: n1.headline, n1Summary: `${n1.summary1 || ''} ${n1.summary2 || ''}`,
            n2Headline: n2.headline, n2Summary: `${n2.summary1 || ''} ${n2.summary2 || ''}`,
            n3Headline: n3.headline, n3Summary: `${n3.summary1 || ''} ${n3.summary2 || ''}`,
        }, `${dateStr}_09_hotnews_detail.png`);

        // ── 10. AI 예측 + CTA ──
        const d = new Date(finalData.date);
        d.setDate(d.getDate() + 1);
        const nextDayStr = `${d.getMonth()+1}/${d.getDate()}(${['일','월','화','수','목','금','토'][d.getDay()]})`;

        await captureSlide('ai-predict.html', {
            slideNum: 10,
            nextDate: nextDayStr,
            teamName: ai ? ai.teamName : '분석 대기',
            playerName: ai ? ai.playerName : 'Gemini 연동 후 활성화',
            probPercent: ai ? ai.expectedProbability : 0,
            reason1: ai ? ai.reason1 : 'Gemini API 키 설정 후 활성화됩니다',
            reason2: ai ? ai.reason2 : '환경변수 GEMINI_API_KEY를 설정해주세요',
            reason3: ai ? ai.reason3 : '.env 파일에 키를 추가해주세요',
            fanComment: ai ? ai.fanComment : '다음 경기도 기대해주세요! ⚾🔥',
        }, `${dateStr}_10_ai_predict.png`);

    } catch (e) {
        console.error("Puppeteer Render Error:", e);
    } finally {
        await browser.close();
    }

    console.log(`\n✅ Total ${generatedFiles.length}/${totalSlides} slides rendered.\n`);
    return generatedFiles;
}

module.exports = { renderCarousel };
