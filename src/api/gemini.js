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
     * AI 경기별 승률 예측 (내일 전 경기)
     */
    async predictMatchWinRates(tomorrowSchedule, dateStr, nextDateStr) {
        if (!process.env.GEMINI_API_KEY) {
            console.warn("GEMINI_API_KEY is not set.");
            return [];
        }

        if (!tomorrowSchedule || tomorrowSchedule.length === 0) {
            return [];
        }

        const scheduleText = tomorrowSchedule.map(g => `- ${g.homeTeamName}(홈) vs ${g.awayTeamName}(원정)`).join('\n');

        const prompt = `
당신은 KBO 프로야구 데이터 분석가입니다.

[내일(${nextDateStr}) 예정 경기]
${scheduleText}

각 경기에 대해 홈팀 승률과 원정팀 승률을 예측해주세요.
홈 어드밴티지, 최근 팀 폼, 시즌 성적을 종합적으로 고려하되,
반드시 homeRate + awayRate = 100이 되어야 합니다.

[출력 형식 제한 (반드시 JSON 배열로만 반환, 마크다운 코드블록 생략)]
[
  { "home": "KT", "away": "삼성", "homeRate": 55, "awayRate": 45 }
]
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
            console.error("Gemini API Error (WinRate):", error.message);
            return [];
        }
    },

    /**
     * 최종 수집된 데이터를 바탕으로 Instagram 캐러셀 포스트 전용 캡션과 해시태그(댓글용)를 생성합니다.
     */
    async generateInstagramCaption(finalData) {
        if (!process.env.GEMINI_API_KEY) {
            console.warn("GEMINI_API_KEY is not set.");
            return {
                caption: `🏆 ${finalData.date} KBO 데일리 리포트\n\n오늘의 KBO 경기 요약과 선수 랭킹, 그리고 AI의 내일 경기 예측까지!\n매일 아침 업데이트되는 생생한 야구 소식을 확인하세요. ⚾🔥`,
                comment: `#KBO #프로야구 #야구 #KBO리그 #오늘의MVP #타율왕 #ERA #야구팬`
            };
        }

        const prompt = `
당신은 팔로워들과 친근하게 소통하는 'KBO 데이터 랩' 인스타그램 채널의 운영자(30년 차 야구팬 개발자)입니다.

아래는 오늘(${finalData.date}) 생성된 10장짜리 KBO 프로야구 카드뉴스(캐러셀)의 핵심 데이터입니다:
- 오늘의 MVP 1위: ${finalData.mvpData?.top5?.[0]?.teamName || ''} ${finalData.mvpData?.top5?.[0]?.playerName || ''} (MVP 스코어: ${finalData.mvpData?.top5?.[0]?.mvpScore || ''})
- 오늘의 핫뉴스 1번: ${finalData.hotNews?.[0]?.headline || ''}
- 시즌 MVP 스코어 Top 10 레이스, 핫/콜드 트래커, 주간 MVP 리더, 마일스톤 알림, AI 경기별 승률 예측 등 데이터 덕후 전용 심층 분석 포함

이 데이터를 바탕으로 인스타그램 게시물 본문(Caption)과 첫 번째 댓글로 달릴 해시태그(Comment)를 작성해주세요.

[작성 가이드]
1. 본문(caption)은 유쾌하고 친근한 톤(이모지 적극 활용)으로 구성하고, 오늘 경기의 핵심 이슈 1~2개와 내일 예측 타자를 언급하며 오른쪽으로 넘겨(스와이프) 보라는 안내를 포함하세요.
2. 본문 마지막에는 아래 두 블록을 순서대로 넣어주세요:
   - "👇 숫자가 알려주는 진짜 KBO 이야기 \n@kbo_data_lab 팔로우하고 매일 야구 200% 즐기기 📬"
   - "🎸 운영자의 음악 채널도 놀러오세요!\n🌌 AI 밴드 Cosmic Void의 감성 커버\n▶ YouTube에서 'Cosmic Void' 검색! 🔎"
3. 댓글(comment)은 본문과 분리하여 해시태그만 15~20개 정도 꽉꽉 채워넣어 주세요 (ex. #KBO #KBO리그 #프로야구 등 팀명, 선수이름 포함). 마지막에 #CosmicVoid #AI밴드 #Kpop커버 해시태그도 반드시 포함하세요.

[출력 형식 제한 (반드시 JSON 객체로만 반환, 마크다운 코드블록 생략)]
{
  "caption": "본문 내용 텍스트...",
  "comment": "#해시태그1 #해시태그2 ..."
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
             console.error("Gemini API Error (Caption):", error.message);
             return {
                 caption: `🏆 ${finalData.date} KBO 데일리 리포트\n\n오늘의 KBO 경기 요약과 선수 랭킹, 그리고 AI의 내일 경기 예측까지!\n매일 아침 업데이트되는 생생한 야구 소식을 확인하세요. ⚾🔥`,
                 comment: `#KBO #프로야구 #야구 #KBO리그 #오늘의MVP #타율왕 #ERA #야구팬`
             };
        }
    }
};

module.exports = geminiAPI;
