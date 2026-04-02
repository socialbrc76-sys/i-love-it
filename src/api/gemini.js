const { GoogleGenAI } = require('@google/genai');

// NOTE: Initialize with api_key from environment variable
// Ensure process.env.GEMINI_API_KEY is set
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }); 

const geminiAPI = {
    /**
     * 오늘의 KBO 뉴스 헤드라인들을 바탕으로 가장 핫한 뉴스 3개를 선정하고 요약합니다.
     * @param {Array} newsArticles - 네이버 스포츠 API에서 가져온 뉴스 객체 배열
     * @param {string} dateStr - 오늘 날짜 문자열
     */
    async pickTop3News(newsArticles, dateStr) {
        if (!process.env.GEMINI_API_KEY) {
            console.warn("GEMINI_API_KEY is not set.");
            return [];
        }

        const newsTextList = newsArticles.slice(0, 20).map(n => `- [${n.oid}] ${n.title} : ${n.subContent || ''}`).join('\n');
        
        const prompt = `
당신은 KBO 프로야구 뉴스를 큐레이션하는 에디터입니다.
아래는 ${dateStr} 기준 KBO 최신 뉴스 20개입니다.

[뉴스 목록]
${newsTextList}

야구 팬이 가장 흥미로워할 핵심 뉴스 3가지를 선정해서 인스타그램 카드뉴스 용으로 가공해주세요.
각 뉴스마다 흥미를 유발하는 헤드라인(1줄)과 2줄 요약을 반환하세요.

[출력 형식 제한 (반드시 JSON 배열로만 반환, 마크다운 코드블록 생략)]
[
  { "headline": "헤드라인1", "summary1": "요약 첫 줄", "summary2": "요약 두 번째 줄" },
  { "headline": "헤드라인2", "summary1": "요약 첫 줄", "summary2": "요약 두 번째 줄" },
  { "headline": "헤드라인3", "summary1": "요약 첫 줄", "summary2": "요약 두 번째 줄" }
]
`;

        try {
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                }
            });
            const textRaw = response.text;
            return JSON.parse(textRaw);
        } catch(error) {
            console.error("Gemini API Error (News):", error.message);
            return [];
        }
    },

    /**
     * AI 선발 타자 예측 (내일 터질 타자)
     */
    async predictTomorrowHitter(todayPlayerStats, tomorrowSchedule, dateStr, nextDateStr, headToHeadStats = null) {
        if (!process.env.GEMINI_API_KEY) {
            console.warn("GEMINI_API_KEY is not set.");
            return null;
        }

        // 환각 방지: 데이터가 들어오지 않으면 프롬프트에서 원천 차단
        const h2hText = headToHeadStats 
            ? `[선택된 타자와 내일 선발 투수 간의 상대 전적]\n${headToHeadStats}` 
            : `[상대 전적 데이터 없음 — 이 항목은 분석 근거에서 절대 제외할 것]`;

        const statTextList = todayPlayerStats.slice(0, 15).map(p => `- ${p.teamName} ${p.playerName}: MVP Score ${p.mvpScore}, 안타 ${p.hit}, 홈런 ${p.hr}, 타점 ${p.rbi}`).join('\n');
        const scheduleText = tomorrowSchedule.map(g => `- ${g.homeTeamName} vs ${g.awayTeamName} (${g.stadium})`).join('\n');

        const prompt = `
당신은 KBO 프로야구 데이터 분석가이자 위트 있는 야구팬입니다.

[오늘(${dateStr})의 주요 타자 데이터 (MVP 스코어순 Top 15)]
${statTextList}

[내일(${nextDateStr}) 매치업]
${scheduleText}

⚠️ 중요: 아래 데이터가 제공된 경우에만 상대 전적을 근거로 언급하세요.
제공되지 않은 데이터를 추측하거나 지어내지 마세요. 
${h2hText}

위 데이터를 바탕으로 "내일 경기에서 가장 기대되는 타자 1명"을 선정해주세요.

[출력 형식 제한 (반드시 JSON 객체로만 반환, 마크다운 코드블록 생략)]
{
  "playerName": "오스틴",
  "teamName": "LG 트윈스",
  "expectedProbability": 82, // 1~100 사이 정수
  "reason1": "오늘 경기 4타수 3안타 3타점으로 타격감 절정",
  "reason2": "시즌 초반이지만 벌써 MVP 스코어 상위권 랭크",
  "reason3": "홈/원정, 상대투수 전적 등 데이터가 있다면 반영, 없다면 최근 폼 기반 서술",
  "fanComment": "어제 날아다니던 오스틴 봤어? 내일도 무조건 터진다 ㅋㅋㅋ 🔥"
}
`;

        try {
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: {
                    responseMimeType: "application/json"
                }
            });
            const textRaw = response.text;
             return JSON.parse(textRaw);
        } catch(error) {
             console.error("Gemini API Error (Predict):", error.message);
             return null;
        }
    }
};

module.exports = geminiAPI;
