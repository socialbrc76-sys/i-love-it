// rankings.js
// 타율왕 레이스 및 루키 분석 모듈

/**
 * 시즌 누적 타율 Top N 명을 반환 (기본값 4명)
 */
function getTopBatters(playerRankingData, topN = 4) {
    if(!playerRankingData || playerRankingData.length === 0) return [];
    const topPlayers = playerRankingData.slice(0, Math.min(topN, playerRankingData.length));
    
    return topPlayers.map((p, index) => ({
        rank: index + 1,
        playerName: p.playerName,
        teamName: p.teamName,
        avg: p.hitterHra !== undefined ? p.hitterHra.toFixed(3) : (p.hra || '-'),
        hit: p.hitterHit || p.hit || 0,
        ab: p.hitterAb || p.ab || 0,
        hr: p.hitterHr || p.hr || 0,
        rbi: p.hitterRbi || p.rbi || 0,
        imageUrl: p.playerImageUrl || `https://sports-phinf.pstatic.net/player/kbo/default/${p.playerId}.png`,
    }));
}

/**
 * 시즌 누적 평균자책점 Top N 투수를 반환 (기본값 4명)
 * 선발/불펜/마무리 구분 없이 ERA 순으로 정렬된 데이터에서 추출
 * isQualified: true인 투수(규정이닝 충족)만 우선 선별
 */
function getTopPitchers(pitcherRankingData, topN = 4) {
    if(!pitcherRankingData || pitcherRankingData.length === 0) return [];

    // 규정이닝 충족 투수 우선, 이후 미충족 투수로 보충
    const qualified = pitcherRankingData.filter(p => p.isQualified === true);
    const pool = qualified.length >= topN ? qualified : pitcherRankingData;
    const topPlayers = pool.slice(0, Math.min(topN, pool.length));

    return topPlayers.map((p, index) => ({
        rank: index + 1,
        playerName: p.playerName,
        teamName: p.teamName,
        era: p.pitcherEra !== undefined ? p.pitcherEra.toFixed(2) : '-',
        win: p.pitcherWin || 0,
        lose: p.pitcherLose || 0,
        save: p.pitcherSave || 0,
        hold: p.pitcherHold || 0,
        kk: p.pitcherKk || 0,
        inning: p.pitcherInning || '0',
        whip: p.pitcherWhip !== undefined ? p.pitcherWhip.toFixed(2) : '-',
        gameCount: p.pitcherGameCount || 0,
        imageUrl: p.playerImageUrl || `https://sports-phinf.pstatic.net/player/kbo/default/${p.playerId}.png`,
    }));
}

module.exports = { getTopBatters, getTopPitchers };
