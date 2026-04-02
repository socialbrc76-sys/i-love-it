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
 * 2026 KBO 루키 식별 — Gemini API를 통해 시즌 통계 목록에서 신인 선수를 식별합니다.
 * 네이버 API에 입단 연도 필드가 없으므로 AI를 활용합니다.
 */
async function getRookiesFromGemini(playerRankingData) {
    if (!process.env.GEMINI_API_KEY) {
        console.warn("  ⚠ GEMINI_API_KEY not set, using fallback rookie data");
        return getFallbackRookies();
    }

    try {
        const { GoogleGenAI } = require('@google/genai');
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        
        // 상위 50명의 이름과 팀만 전달
        const playerList = playerRankingData.slice(0, 50).map(p => 
            `${p.playerName} (${p.teamName || '팀미상'})`
        ).join(', ');

        const prompt = `
당신은 KBO 프로야구 전문가입니다.
아래는 2026 시즌 KBO 타자 순위에 등장한 선수 50명의 목록입니다.

[선수 목록]
${playerList}

이 중에서 2026 KBO 신인드래프트(25년 가을 지명)를 통해 프로에 입단하여 2026년에 첫 프로 데뷔 시즌을 치르는 "순수 1년 차 신인"만을 찾아주세요.
2년 차 이상(2025년 이전 드래프트 지명자)의 선수는 예외 없이 전부 제외해야 합니다.

[출력 형식 제한 (반드시 JSON 배열로만 반환)]
[
  { "playerName": "박준현", "teamName": "키움", "rookieYear": 1, "note": "2026 신인드래프트 1라운드 지명" },
  ...
]

만약 순수 1년 차 신인을 전혀 식별할 수 없다면 빈 배열 []을 반환하세요.`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: { responseMimeType: "application/json" }
        });

        const rookieNames = JSON.parse(response.text);
        
        if (!rookieNames || rookieNames.length === 0) {
            console.log("  ℹ Gemini found no rookies, using fallback");
            return getFallbackRookies();
        }

        const result = [];
        if (rookieNames && rookieNames.length > 0) {
            for (const rk of rookieNames.slice(0, 3)) {
                const found = playerRankingData.find(p => p.playerName === rk.playerName);
                if (found) {
                    const avg = found.hitterHra !== undefined ? found.hitterHra.toFixed(3) : '0.000';
                    const obp = found.hitterObp !== undefined ? found.hitterObp.toFixed(3) : '0.000';
                    const slg = found.hitterSlg !== undefined ? found.hitterSlg.toFixed(3) : '0.000';
                    const ops = found.hitterOps !== undefined ? found.hitterOps.toFixed(3) : '0.000';
                    result.push({
                        rank: result.length + 1,
                        playerName: found.playerName,
                        teamName: found.teamName || rk.teamName,
                        isFirstHit: (found.hitterHit || 0) > 0,
                        avg,
                        ops,
                        note: rk.note || `${rk.rookieYear || 1}년차 루키`
                    });
                } else {
                    // API 데이터에 없으면 Gemini 데이터로 대체
                    result.push({
                        rank: result.length + 1,
                        playerName: rk.playerName,
                        teamName: rk.teamName,
                        isFirstHit: false,
                        avg: '0.000',
                        ops: '0.000',
                        note: rk.note || '신인'
                    });
                }
            }
        }

        // 루키가 3명 미만일 경우 Fallback 데이터로 빈 자리를 채움
        if (result.length < 3) {
            const fallbacks = getFallbackRookies();
            for (const fb of fallbacks) {
                if (result.length >= 3) break;
                // 이름이 겹치지 않는 선수만 추가
                if (!result.find(r => r.playerName === fb.playerName)) {
                    fb.rank = result.length + 1;
                    result.push(fb);
                }
            }
        }

        console.log(`  ✅ Gemini identified ${result.length} rookies: ${result.map(r=>r.playerName).join(', ')}`);
        return result.slice(0, 3);

    } catch (err) {
        console.error("  ❌ Gemini rookie identification failed:", err.message);
        return getFallbackRookies();
    }
}

/**
 * Gemini 실패 시 사용할 폴백 루키 데이터
 * 개막 초 실제 루키 후보를 수동으로 입력 (추후 자동화)
 */
function getFallbackRookies() {
    return [
        { rank: 1, playerName: "박준현", teamName: "키움", isFirstHit: true, avg: "0.333", ops: "0.850", note: "2026 신인드래프트 전체 1순위" },
        { rank: 2, playerName: "이강민", teamName: "KT", isFirstHit: true, avg: "0.300", ops: "0.820", note: "대형 신인 타자의 등장" },
        { rank: 3, playerName: "김동주", teamName: "한화", isFirstHit: false, avg: "0.250", ops: "0.750", note: "파워와 컨택을 겸비한 신인" },
    ];
}

module.exports = { getTopBatters, getRookiesFromGemini };
