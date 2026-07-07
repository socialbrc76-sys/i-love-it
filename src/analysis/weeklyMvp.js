// weeklyMvp.js
// 최근 7일간 누적 MVP 스코어 기반 주간 리더 분석

const { loadDailyScores } = require('./hotCold');

/**
 * 최근 7일간 MVP 스코어를 누적하여 주간 MVP Top 4를 산출합니다.
 * @returns {Array} Top 4 선수 배열 [{ playerName, teamName, playerCode, weeklyScore, games, imageUrl }]
 */
function getWeeklyMvpLeaders() {
    const dailyData = loadDailyScores();
    const dates = Object.keys(dailyData).sort();

    if (dates.length === 0) {
        console.warn('⚠️ 주간 MVP 분석에 필요한 데이터가 없습니다.');
        return [];
    }

    // 선수별 주간 누적 MVP 스코어 집계
    const playerMap = {};

    for (const date of dates) {
        for (const p of dailyData[date]) {
            const key = `${p.playerName}_${p.teamName}`;
            if (!playerMap[key]) {
                playerMap[key] = {
                    playerName: p.playerName,
                    teamName: p.teamName,
                    playerCode: p.playerCode || '',
                    weeklyScore: 0,
                    games: 0,
                };
            }
            playerMap[key].weeklyScore += (p.mvpScore || 0);
            playerMap[key].games++;
        }
    }

    // 스코어 내림차순 정렬 → Top 4
    const sorted = Object.values(playerMap)
        .filter(p => p.weeklyScore > 0 && p.games >= 2) // 최소 2경기 이상 출전
        .sort((a, b) => b.weeklyScore - a.weeklyScore)
        .slice(0, 4);

    return sorted.map((p, i) => ({
        ...p,
        rank: i + 1,
        weeklyScore: Math.round(p.weeklyScore * 10) / 10,
        imageUrl: p.playerCode
            ? `https://sports-phinf.pstatic.net/player/kbo/default/${p.playerCode}.png`
            : '',
    }));
}

module.exports = { getWeeklyMvpLeaders };
