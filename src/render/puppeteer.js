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
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1080, height: 1350, deviceScaleFactor: 1 });

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
            await page.screenshot({ path: outPath, type: 'jpeg', quality: 90 });
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
    const pr = finalData.pitcherRace || [];
    const news = finalData.hotNews || [];
    const seasonTop10 = finalData.seasonMvpTop10 || [];
    const seasonNewEntries = finalData.seasonMvpNewEntries || [];
    const hotCold = finalData.hotCold || { hot: [], cold: [] };
    const weeklyMvp = finalData.weeklyMvpLeaders || [];
    const milestones = finalData.milestones || [];
    const aiWinRates = finalData.aiWinRates || [];
    const nextDaySchedule = finalData.nextDaySchedule || [];

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
        return TEAM_COLORS[teamName] || { color: '#6366f1', accent: '#6366f1', short: (teamName || '??').substring(0,2) };
    }

    // 뉴스 폴백 데이터
    const n1 = news[0] || { headline: '오늘의 경기 하이라이트', summary1: 'KBO 시즌 중반', summary2: '뜨거운 경쟁이 이어지고 있습니다' };
    const n2 = news[1] || { headline: '주목할 만한 기록', summary1: '시즌 마일스톤', summary2: '기록 경쟁이 치열합니다' };
    const n3 = news[2] || { headline: '팀 순위 변동', summary1: '치열한 순위 경쟁', summary2: '후반기 판도가 바뀌고 있습니다' };

    // ── 로컬 야구 배경 이미지 → base64 데이터 URI ──
    const bgDir = path.join(__dirname, '..', 'assets', 'bg');
    const BG_FILES = fs.existsSync(bgDir) ? fs.readdirSync(bgDir).filter(f => /\.(jpg|png|jpeg)$/i.test(f)).sort() : [];

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

    function getBodyBgDataUri() {
        if (BG_FILES.length === 0) return '';
        return imgToDataUri(path.join(bgDir, BG_FILES[0]));
    }

    function getContrastText(hexColor) {
        if (!hexColor || hexColor.length < 7) return '#FFFFFF';
        const r = parseInt(hexColor.slice(1,3), 16);
        const g = parseInt(hexColor.slice(3,5), 16);
        const b = parseInt(hexColor.slice(5,7), 16);
        return (r * 0.299 + g * 0.587 + b * 0.114) > 150 ? '#000000' : '#FFFFFF';
    }

    function buildStatsLine(p) {
        if (!p) return '';
        const parts = [];
        if (p.ab !== undefined && p.hit !== undefined) parts.push(`${p.ab}타수 ${p.hit}안타`);
        if (p.hr && Number(p.hr) > 0) parts.push(`${p.hr}홈런`);
        if (p.rbi && Number(p.rbi) > 0) parts.push(`${p.rbi}타점`);
        if (p.run && Number(p.run) > 0) parts.push(`${p.run}득점`);
        return parts.join(' ');
    }

    function getPlayerImgUrl(p) {
        return p && p.playerCode ? `https://sports-phinf.pstatic.net/player/kbo/default/${p.playerCode}.png` : '';
    }

    const hexToRgba = (hex, a) => {
        if (!hex || hex.length < 7) return `rgba(99,102,241,${a})`;
        const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
        return `rgba(${r},${g},${b},${a})`;
    };

    try {
        // ═══════════════════════════════════════════════
        // 슬라이드 1: 커버 (MVP Top 4) — 기존 유지
        // ═══════════════════════════════════════════════
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
        }, `${dateStr}_01_cover.jpg`);

        // ═══════════════════════════════════════════════
        // 슬라이드 2: 오늘의 MVP + 상세 (합본) ⭐ NEW
        // ═══════════════════════════════════════════════
        if (mvp) {
            const mvpTc = getTeamColor(mvp.teamName);
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

            await captureSlide('mvp-combined.html', {
                slideNum: 2,
                playerName: mvp.playerName, teamName: mvp.teamName, mvpScore: mvp.mvpScore,
                ab: mvp.ab, hit: mvp.hit, hr: mvp.hr, rbi: mvp.rbi, run: mvp.run,
                mvpColor: mvpTc.color, mvpColorAlpha: hexToRgba(mvpTc.color, 0.15),
                mvpImg: getPlayerImgUrl(mvp),
                inningItems,
            }, `${dateStr}_02_mvp_combined.jpg`);
        }

        // ═══════════════════════════════════════════════
        // 슬라이드 3: 시즌 MVP 스코어 Top 10 ⭐ NEW
        // ═══════════════════════════════════════════════
        const raceData = {};
        const maxScore = seasonTop10.length > 0 ? seasonTop10[0].mvpScore : 1;
        for (let i = 0; i < 10; i++) {
            const entry = seasonTop10[i];
            const prefix = `r${i + 1}`;
            if (entry) {
                const tc = getTeamColor(entry.teamName);
                raceData[`${prefix}Name`] = entry.playerName;
                raceData[`${prefix}Team`] = entry.teamName;
                raceData[`${prefix}Score`] = entry.mvpScore;
                raceData[`${prefix}Date`] = entry.date ? entry.date.substring(5) : '';
                raceData[`${prefix}Width`] = Math.round((entry.mvpScore / maxScore) * 100);
                raceData[`${prefix}Color`] = tc.color;
                raceData[`${prefix}New`] = seasonNewEntries.includes(i) ? 'show' : '';
            } else {
                raceData[`${prefix}Name`] = '-';
                raceData[`${prefix}Team`] = '-';
                raceData[`${prefix}Score`] = '-';
                raceData[`${prefix}Date`] = '';
                raceData[`${prefix}Width`] = 0;
                raceData[`${prefix}Color`] = '#333';
                raceData[`${prefix}New`] = '';
            }
        }
        await captureSlide('season-mvp-race.html', { slideNum: 3, ...raceData }, `${dateStr}_03_season_mvp.jpg`);

        // ═══════════════════════════════════════════════
        // 슬라이드 4: 타율왕 레이스 (F1 스타일) — 기존 유지 + 스탯 보강
        // ═══════════════════════════════════════════════
        if (br.length >= 4) {
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

            const rc1 = getRankChange(br[0].playerName, 1), rc2 = getRankChange(br[1].playerName, 2);
            const rc3 = getRankChange(br[2].playerName, 3), rc4 = getRankChange(br[3].playerName, 4);
            const tc1 = getTeamColor(br[0].teamName), tc2 = getTeamColor(br[1].teamName);
            const tc3 = getTeamColor(br[2].teamName), tc4 = getTeamColor(br[3].teamName);
            await captureSlide('batting-race.html', {
                slideNum: 4,
                t1Name: br[0].playerName, t1Team: br[0].teamName, t1Avg: br[0].avg, t1Ab: br[0].ab, t1Hit: br[0].hit, t1Color: tc1.color, t1TeamShort: tc1.short, t1Change: rc1.text, t1ChangeClass: rc1.cls, t1Img: br[0].imageUrl,
                t2Name: br[1].playerName, t2Team: br[1].teamName, t2Avg: br[1].avg, t2Ab: br[1].ab, t2Hit: br[1].hit, t2Color: tc2.color, t2TeamShort: tc2.short, t2Change: rc2.text, t2ChangeClass: rc2.cls, t2Img: br[1].imageUrl,
                t3Name: br[2].playerName, t3Team: br[2].teamName, t3Avg: br[2].avg, t3Ab: br[2].ab, t3Hit: br[2].hit, t3Color: tc3.color, t3TeamShort: tc3.short, t3Change: rc3.text, t3ChangeClass: rc3.cls, t3Img: br[2].imageUrl,
                t4Name: br[3].playerName, t4Team: br[3].teamName, t4Avg: br[3].avg, t4Ab: br[3].ab, t4Hit: br[3].hit, t4Color: tc4.color, t4TeamShort: tc4.short, t4Change: rc4.text, t4ChangeClass: rc4.cls, t4Img: br[3].imageUrl,
            }, `${dateStr}_04_batting.jpg`);
        }

        // ═══════════════════════════════════════════════
        // 슬라이드 5: ERA 레이스 — 기존 유지
        // ═══════════════════════════════════════════════
        if (pr.length >= 4) {
            const prevDate = new Date(finalData.date);
            prevDate.setDate(prevDate.getDate() - 1);
            const prevStr = prevDate.toISOString().split('T')[0].replace(/-/g, '');
            const prevPath = path.join(outputDir, `data_${prevStr}.json`);
            let prevPitcherRanks = {};
            if (fs.existsSync(prevPath)) {
                try {
                    const prev = JSON.parse(fs.readFileSync(prevPath, 'utf-8'));
                    (prev.pitcherRace || []).forEach((p, i) => { prevPitcherRanks[p.playerName] = i + 1; });
                } catch(e) { /* ignore */ }
            }

            function getPitcherRankChange(name, currentRank) {
                if (!prevPitcherRanks[name]) return { text: 'NEW', cls: 'new' };
                const diff = prevPitcherRanks[name] - currentRank;
                if (diff > 0) return { text: `▲${diff}`, cls: 'up' };
                if (diff < 0) return { text: `▼${Math.abs(diff)}`, cls: 'down' };
                return { text: '—', cls: 'same' };
            }

            const pc1 = getPitcherRankChange(pr[0].playerName, 1), pc2 = getPitcherRankChange(pr[1].playerName, 2);
            const pc3 = getPitcherRankChange(pr[2].playerName, 3), pc4 = getPitcherRankChange(pr[3].playerName, 4);
            const ptc1 = getTeamColor(pr[0].teamName), ptc2 = getTeamColor(pr[1].teamName);
            const ptc3 = getTeamColor(pr[2].teamName), ptc4 = getTeamColor(pr[3].teamName);
            await captureSlide('era-race.html', {
                slideNum: 5,
                t1Name: pr[0].playerName, t1Team: pr[0].teamName, t1Era: pr[0].era, t1Inning: pr[0].inning, t1Kk: pr[0].kk, t1Color: ptc1.color, t1Change: pc1.text, t1ChangeClass: pc1.cls, t1Img: pr[0].imageUrl,
                t2Name: pr[1].playerName, t2Team: pr[1].teamName, t2Era: pr[1].era, t2Inning: pr[1].inning, t2Kk: pr[1].kk, t2Color: ptc2.color, t2Change: pc2.text, t2ChangeClass: pc2.cls, t2Img: pr[1].imageUrl,
                t3Name: pr[2].playerName, t3Team: pr[2].teamName, t3Era: pr[2].era, t3Inning: pr[2].inning, t3Kk: pr[2].kk, t3Color: ptc3.color, t3Change: pc3.text, t3ChangeClass: pc3.cls, t3Img: pr[2].imageUrl,
                t4Name: pr[3].playerName, t4Team: pr[3].teamName, t4Era: pr[3].era, t4Inning: pr[3].inning, t4Kk: pr[3].kk, t4Color: ptc4.color, t4Change: pc4.text, t4ChangeClass: pc4.cls, t4Img: pr[3].imageUrl,
            }, `${dateStr}_05_era.jpg`);
        }

        // ═══════════════════════════════════════════════
        // 슬라이드 6: 핫/콜드 트래커 ⭐ NEW
        // ═══════════════════════════════════════════════
        const hot = hotCold.hot || [];
        const cold = hotCold.cold || [];
        await captureSlide('hot-cold.html', {
            slideNum: 6,
            h1Img: hot[0]?.imageUrl || '', h1Name: hot[0]?.playerName || '-', h1Team: hot[0]?.teamName || '-', h1Avg: hot[0]?.recentAvg || '-', h1Delta: hot[0]?.deltaStr || '-',
            h2Img: hot[1]?.imageUrl || '', h2Name: hot[1]?.playerName || '-', h2Team: hot[1]?.teamName || '-', h2Avg: hot[1]?.recentAvg || '-', h2Delta: hot[1]?.deltaStr || '-',
            h3Img: hot[2]?.imageUrl || '', h3Name: hot[2]?.playerName || '-', h3Team: hot[2]?.teamName || '-', h3Avg: hot[2]?.recentAvg || '-', h3Delta: hot[2]?.deltaStr || '-',
            c1Img: cold[0]?.imageUrl || '', c1Name: cold[0]?.playerName || '-', c1Team: cold[0]?.teamName || '-', c1Avg: cold[0]?.recentAvg || '-', c1Delta: cold[0]?.deltaStr || '-',
            c2Img: cold[1]?.imageUrl || '', c2Name: cold[1]?.playerName || '-', c2Team: cold[1]?.teamName || '-', c2Avg: cold[1]?.recentAvg || '-', c2Delta: cold[1]?.deltaStr || '-',
            c3Img: cold[2]?.imageUrl || '', c3Name: cold[2]?.playerName || '-', c3Team: cold[2]?.teamName || '-', c3Avg: cold[2]?.recentAvg || '-', c3Delta: cold[2]?.deltaStr || '-',
        }, `${dateStr}_06_hotcold.jpg`);

        // ═══════════════════════════════════════════════
        // 슬라이드 7: 주간 MVP 리더 ⭐ NEW
        // ═══════════════════════════════════════════════
        const wm = weeklyMvp;
        await captureSlide('weekly-mvp.html', {
            slideNum: 7,
            w1Img: wm[0]?.imageUrl || '', w1Name: wm[0]?.playerName || '-', w1Team: wm[0]?.teamName || '-', w1Score: wm[0]?.weeklyScore || '-', w1Games: wm[0]?.games || 0, w1Color: getTeamColor(wm[0]?.teamName).color,
            w2Img: wm[1]?.imageUrl || '', w2Name: wm[1]?.playerName || '-', w2Team: wm[1]?.teamName || '-', w2Score: wm[1]?.weeklyScore || '-', w2Games: wm[1]?.games || 0, w2Color: getTeamColor(wm[1]?.teamName).color,
            w3Img: wm[2]?.imageUrl || '', w3Name: wm[2]?.playerName || '-', w3Team: wm[2]?.teamName || '-', w3Score: wm[2]?.weeklyScore || '-', w3Games: wm[2]?.games || 0, w3Color: getTeamColor(wm[2]?.teamName).color,
            w4Img: wm[3]?.imageUrl || '', w4Name: wm[3]?.playerName || '-', w4Team: wm[3]?.teamName || '-', w4Score: wm[3]?.weeklyScore || '-', w4Games: wm[3]?.games || 0, w4Color: getTeamColor(wm[3]?.teamName).color,
        }, `${dateStr}_07_weekly_mvp.jpg`);

        // ═══════════════════════════════════════════════
        // 슬라이드 8: 마일스톤 알림 ⭐ NEW
        // ═══════════════════════════════════════════════
        const msCount = milestones.length;
        await captureSlide('milestone.html', {
            slideNum: 8,
            milestoneCount: msCount,
            m1Img: milestones[0]?.imageUrl || '', m1Name: milestones[0]?.playerName || '-', m1Team: milestones[0]?.teamName || '-',
            m1Label: milestones[0]?.label || '', m1Current: milestones[0]?.current || 0, m1Target: milestones[0]?.target || 0,
            m1Remaining: milestones[0]?.remaining || 0, m1Progress: milestones[0]?.progress || 0, m1Display: msCount >= 1 ? 'flex' : 'none',
            m2Img: milestones[1]?.imageUrl || '', m2Name: milestones[1]?.playerName || '-', m2Team: milestones[1]?.teamName || '-',
            m2Label: milestones[1]?.label || '', m2Current: milestones[1]?.current || 0, m2Target: milestones[1]?.target || 0,
            m2Remaining: milestones[1]?.remaining || 0, m2Progress: milestones[1]?.progress || 0, m2Display: msCount >= 2 ? 'flex' : 'none',
            m3Img: milestones[2]?.imageUrl || '', m3Name: milestones[2]?.playerName || '-', m3Team: milestones[2]?.teamName || '-',
            m3Label: milestones[2]?.label || '', m3Current: milestones[2]?.current || 0, m3Target: milestones[2]?.target || 0,
            m3Remaining: milestones[2]?.remaining || 0, m3Progress: milestones[2]?.progress || 0, m3Display: msCount >= 3 ? 'flex' : 'none',
            m4Img: milestones[3]?.imageUrl || '', m4Name: milestones[3]?.playerName || '-', m4Team: milestones[3]?.teamName || '-',
            m4Label: milestones[3]?.label || '', m4Current: milestones[3]?.current || 0, m4Target: milestones[3]?.target || 0,
            m4Remaining: milestones[3]?.remaining || 0, m4Progress: milestones[3]?.progress || 0, m4Display: msCount >= 4 ? 'flex' : 'none',
        }, `${dateStr}_08_milestone.jpg`);

        // ═══════════════════════════════════════════════
        // 슬라이드 9: 핫뉴스 Top3 — 기존 유지
        // ═══════════════════════════════════════════════
        await captureSlide('hot-news.html', {
            slideNum: 9,
            n1Headline: n1.headline, n1Summary: `${n1.summary1 || ''} ${n1.summary2 || ''}`,
            n2Headline: n2.headline, n2Summary: `${n2.summary1 || ''} ${n2.summary2 || ''}`,
            n3Headline: n3.headline, n3Summary: `${n3.summary1 || ''} ${n3.summary2 || ''}`,
        }, `${dateStr}_09_hotnews.jpg`);

        // ═══════════════════════════════════════════════
        // 슬라이드 10: AI 경기별 승률 예측 ⭐ NEW
        // ═══════════════════════════════════════════════
        const d = new Date(finalData.date);
        d.setDate(d.getDate() + 1);
        const nextDayStr = `${d.getMonth()+1}/${d.getDate()}(${['일','월','화','수','목','금','토'][d.getDay()]})`;

        const matchCount = Math.min(aiWinRates.length, 5);
        const winrateData = { slideNum: 10, nextDate: nextDayStr, matchCount };
        
        for (let i = 0; i < 5; i++) {
            const prefix = `g${i + 1}`;
            const wr = aiWinRates[i];
            const sched = nextDaySchedule[i];
            if (wr && sched) {
                const homeColor = getTeamColor(sched.homeTeamName).color;
                const awayColor = getTeamColor(sched.awayTeamName).color;
                winrateData[`${prefix}Home`] = sched.homeTeamName;
                winrateData[`${prefix}Away`] = sched.awayTeamName;
                winrateData[`${prefix}HomeColor`] = homeColor;
                winrateData[`${prefix}AwayColor`] = awayColor;
                winrateData[`${prefix}HomeRate`] = wr.homeRate;
                winrateData[`${prefix}AwayRate`] = wr.awayRate;
                winrateData[`${prefix}Display`] = 'flex';
            } else {
                winrateData[`${prefix}Home`] = '';
                winrateData[`${prefix}Away`] = '';
                winrateData[`${prefix}HomeColor`] = '#333';
                winrateData[`${prefix}AwayColor`] = '#333';
                winrateData[`${prefix}HomeRate`] = 0;
                winrateData[`${prefix}AwayRate`] = 0;
                winrateData[`${prefix}Display`] = 'none';
            }
        }

        await captureSlide('ai-winrate.html', winrateData, `${dateStr}_10_ai_winrate.jpg`);

    } catch (e) {
        console.error("Puppeteer Render Error:", e);
    } finally {
        await browser.close();
    }

    console.log(`\n✅ Total ${generatedFiles.length}/${totalSlides} slides rendered.\n`);
    return generatedFiles;
}

module.exports = { renderCarousel };
