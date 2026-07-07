// hotCold.js
// 최근 7일간 타율 급등/급락 선수 트래커

const fs = require('fs');
const path = require('path');

const DAILY_SCORES_FILE = path.join(__dirname, '../../data/daily_scores.json');

/**
 * 일별 타자 성적 데이터를 로드합니다.
 * 구조: { "2026-07-01": [{ playerName, teamName, playerCode, ab, hit, avg, ... }], ... }
 */
function loadDailyScores() {
    try {
        if (fs.existsSync(DAILY_SCORES_FILE)) {
            return JSON.parse(fs.readFileSync(DAILY_SCORES_FILE, 'utf-8'));
        }
    } catch (e) {
        console.warn('⚠️ daily_scores.json 로드 실패:', e.message);
    }
    return {};
}

/**
 * 오늘의 타자 성적을 daily_scores에 추가하고, 7일 초과 데이터를 제거합니다.
 * @param {Array} todayBatters - 오늘 전 경기 타자 기록 배열
 * @param {string} dateStr - 오늘 날짜 (YYYY-MM-DD)
 */
function saveDailyBatters(todayBatters, dateStr) {
    const data = loadDailyScores();

    // 오늘 데이터 저장
    data[dateStr] = todayBatters.map(p => ({
        playerName: p.playerName || p.name,
        teamName: p.teamName,
        playerCode: p.playerCode || '',
        ab: Number(p.ab) || 0,
        hit: Number(p.hit) || 0,
        hr: Number(p.hr) || 0,
        rbi: Number(p.rbi) || 0,
        bb: Number(p.bb) || 0,
        mvpScore: p.mvpScore || 0,
    }));

    // 7일 초과 데이터 제거 (롤링 윈도우)
    const dates = Object.keys(data).sort();
    while (dates.length > 7) {
        const oldest = dates.shift();
        delete data[oldest];
    }

    fs.writeFileSync(DAILY_SCORES_FILE, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`  └ 일별 성적 데이터 저장 완료 (${Object.keys(data).length}일치)`);
    return data;
}

/**
 * 최근 7일간 타율 변동을 분석하여 HOT/COLD 선수를 추출합니다.
 * @param {Object} dailyData - loadDailyScores()의 반환값
 * @returns {{ hot: Array, cold: Array }} 각 Top 3
 */
function getHotColdPlayers(dailyData, seasonHitters = []) {
    const dates = Object.keys(dailyData).sort();
    if (dates.length < 2) {
        console.warn('⚠️ 핫/콜드 분석에 최소 2일 이상의 데이터가 필요합니다.');
        return { hot: [], cold: [] };
    }

    // 시즌 타율 맵 생성
    const seasonAvgMap = {};
    for (const p of seasonHitters) {
        if (p.playerName) {
            // hitterHra가 보통 0.325 같은 숫자 포맷
            seasonAvgMap[`${p.playerName}_${p.teamName}`] = Number(p.hitterHra) || 0;
        }
    }

    // 선수별 7일 누적 타수/안타 집계
    const playerMap = {};

    for (const date of dates) {
        for (const p of dailyData[date]) {
            const key = `${p.playerName}_${p.teamName}`;
            if (!playerMap[key]) {
                playerMap[key] = {
                    playerName: p.playerName,
                    teamName: p.teamName,
                    playerCode: p.playerCode,
                    totalAb: 0,
                    totalHit: 0,
                    games: 0,
                };
            }
            playerMap[key].totalAb += p.ab;
            playerMap[key].totalHit += p.hit;
            playerMap[key].games++;
        }
    }

    // 타율 변동 계산 (최근 7일 최소 8타수 이상 기준)
    const players = Object.values(playerMap)
        .filter(p => p.totalAb >= 8) 
        .map(p => {
            const key = `${p.playerName}_${p.teamName}`;
            const weeklyAvg = p.totalHit / p.totalAb;
            const seasonAvg = seasonAvgMap[key] !== undefined ? seasonAvgMap[key] : weeklyAvg; // 폴백
            const delta = weeklyAvg - seasonAvg;
            
            return {
                ...p,
                avg: weeklyAvg.toFixed(3),
                recentAvg: weeklyAvg.toFixed(3), // 템플릿의 x1Avg 변수에 매핑됨
                delta: delta,
                deltaStr: delta >= 0 ? `▲${Math.abs(delta).toFixed(3)}` : `▼${Math.abs(delta).toFixed(3)}`,
                imageUrl: p.playerCode
                    ? `https://sports-phinf.pstatic.net/player/kbo/default/${p.playerCode}.png`
                    : '',
            };
        });

    // HOT: 최근 7일 타율이 높은 순 정렬
    const hot = [...players]
        .sort((a, b) => {
            // 타율 높은 순 -> 같으면 delta 큰 순
            const avgDiff = Number(b.recentAvg) - Number(a.recentAvg);
            if (Math.abs(avgDiff) > 0.0001) return avgDiff;
            return b.delta - a.delta;
        })
        .slice(0, 3);

    // COLD: 최근 7일 타율이 낮은 순 정렬
    const cold = [...players]
        .sort((a, b) => {
            // 타율 낮은 순 -> 같으면 delta 작은 순 (더 많이 떨어진 순)
            const avgDiff = Number(a.recentAvg) - Number(b.recentAvg);
            if (Math.abs(avgDiff) > 0.0001) return avgDiff;
            return a.delta - b.delta;
        })
        .slice(0, 3);

    return { hot, cold };
}

module.exports = { loadDailyScores, saveDailyBatters, getHotColdPlayers };
