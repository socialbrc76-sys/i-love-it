// mvpScore.js
// 판타지 베이스볼 스탠다드 MVP 스코어 계산 엔진

/**
 * 선수의 박스스코어 기록을 기반으로 MVP 스코어를 계산합니다.
 * 공식: (1B × 1) + (2B × 2) + (3B × 3) + (HR × 4) + (RBI × 1.5) + (R × 1) + (BB × 1) + (SB × 1) - (SO × 0.5) + (Win × 2)
 *
 * @param {Object} playerStats - 선수 기록 객체 (네이버 박스스코어 기반)
 * @param {boolean} isWinningTeam - 소속팀 승리 여부
 * @returns {number} MVP Score (소수점 1자리까지)
 */
function calculateScore(playerStats, isWinningTeam = false) {
    // 네이버 API 키 매핑 (추정치 - 실제 API 응답 구조에 맞춰 조정 필요)
    const hit = Number(playerStats.hit) || 0;
    const hr = Number(playerStats.hr) || 0;
    
    // 단타 (1B): 홈런 외 다른 장타 내역이 없으므로 일단 hit - hr
    const h1 = hit - hr;
    
    const rbi = Number(playerStats.rbi) || 0; // 타점
    const run = Number(playerStats.run) || 0; // 득점
    const bb = Number(playerStats.bb) || 0;   // 볼넷
    const sb = Number(playerStats.sb) || 0;   // 도루
    const so = Number(playerStats.kk) || 0;   // 삼진 (네이버 Boxscore 상 kk)
    
    let score = (h1 * 1) + (hr * 4) +
                (rbi * 1.5) + (run * 1) + (bb * 1) + (sb * 1) -
                (so * 0.5);
                
    if (isWinningTeam) {
        score += 2;
    }
    
    return Math.round(score * 10) / 10;
}

/**
 * 모든 경기의 타자 데이터를 받아 그날의 MVP(Top 1)와 순위를 반환합니다.
 * @param {Array} gamesRecordData - 일정 API와 박스스코어 API를 조합한 일일 게임 기록 배열
 * @returns {Object} 오늘의 MVP 선수 정보 및 스코어
 */
function getDailyMVP(gamesRecordData) {
    let allPlayers = [];
    
    for (const game of gamesRecordData) {
        const { gameInfo, recordData } = game;
        // 승리팀 판단
        const awayScore = Number(gameInfo.awayScore);
        const homeScore = Number(gameInfo.homeScore);
        const winningTeamParams = awayScore > homeScore ? gameInfo.awayTeamName : (homeScore > awayScore ? gameInfo.homeTeamName : null);

        // 양 팀 타자 기록 파싱
        for (const teamType of ['away', 'home']) {
             const batters = (recordData.battersBoxscore && recordData.battersBoxscore[teamType]) || [];
             const isWinningTeam = (winningTeamParams === gameInfo[`${teamType}TeamName`]);
             
             for (const batter of batters) {
                 if(batter.ab > 0 || batter.bb > 0) { // 타석에 선 경우
                    const score = calculateScore(batter, isWinningTeam);
                    allPlayers.push({
                         ...batter,
                         playerName: batter.name,
                         pa: (batter.ab || 0) + (batter.bb || 0),
                         teamName: gameInfo[`${teamType}TeamName`],
                         mvpScore: score
                     });
                 }
             }
        }
    }
    
    // 스코어 내림차순 정렬
    allPlayers.sort((a, b) => b.mvpScore - a.mvpScore);
    
    return {
        topMVP: allPlayers[0],
        top5: allPlayers.slice(0, 5)
    };
}

module.exports = { calculateScore, getDailyMVP };
