// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const puppeteer = require('puppeteer');
const fs = require('fs');

const naverSportsAPI = require('./src/api/naverSports');
const geminiAPI = require('./src/api/gemini');
const { getDailyMVP } = require('./src/analysis/mvpScore');
const { getTopBatters, getRookiesFromGemini } = require('./src/analysis/rankings');
const { renderCarousel } = require('./src/render/puppeteer');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.static('public'));
app.use('/output', express.static(path.join(__dirname, 'output'))); // output 폴더 정적 파일 서빙

// 출력 디렉토리 확인 및 생성
const outputDir = path.join(__dirname, 'output');
if (!fs.existsSync(outputDir)){
    fs.mkdirSync(outputDir);
}

// 전체 파이프라인 실행 API
app.get('/api/generate', async (req, res) => {
    const { date } = req.query; // format: YYYYMMDD or YYYY-MM-DD
    if(!date) return res.status(400).json({ error: 'Date is required' });

    const dateStr = date.replace(/-/g, ''); // Compact
    const dateDash = `${dateStr.substring(0,4)}-${dateStr.substring(4,6)}-${dateStr.substring(6,8)}`;

    // 내일 날짜 계산 (임시 로직)
    const today = new Date(dateDash);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const nextDateDash = tomorrow.toISOString().split('T')[0];

    try {
        console.log(`[1] Fetching Schedule & Boxscores for ${dateDash}...`);
        const games = await naverSportsAPI.getSchedule(dateDash);
        
        const gamesRecordData = [];
        for (const game of games) {
            const gameId = game.gameId;
            const record = await naverSportsAPI.getBoxscore(gameId);
            if(record) {
                gamesRecordData.push({ gameInfo: game, recordData: record });
            }
        }

        console.log(`[2] Analyzing Data (MVP, Rankings)...`);
        const mvpData = getDailyMVP(gamesRecordData);
        
        const seasonHitters = await naverSportsAPI.getHitterRanking('2026');
        const topBatters = getTopBatters(seasonHitters);
        const rookies = await getRookiesFromGemini(seasonHitters);

        console.log(`[3] Fetching News & Gemini Analysis...`);
        const recentNews = await naverSportsAPI.getNews(dateStr);
        const nextDaySchedule = await naverSportsAPI.getSchedule(nextDateDash);
        
        // Gemini API 호출 (병렬)
        const [hotNewsList, aiPrediction] = await Promise.all([
            geminiAPI.pickTop3News(recentNews, dateDash),
            geminiAPI.predictTomorrowHitter(mvpData.top5, nextDaySchedule, dateDash, nextDateDash, null)
        ]);

        console.log(`[4] Data Pipeline Complete! Saving intermediate JSON...`);
        const finalData = {
            date: dateDash,
            mvpData,
            battingRace: topBatters,
            rookies,
            hotNews: hotNewsList,
            aiPrediction
        };
        fs.writeFileSync(path.join(outputDir, `data_${dateStr}.json`), JSON.stringify(finalData, null, 2));

        console.log(`[5] Rendering HTML templates to PNG via Puppeteer...`);
        const generatedImages = await renderCarousel(finalData, outputDir);
        
        res.json({ 
            success: true, 
            message: '10 Cards generated successfully.',
            images: generatedImages, 
            data: finalData 
        });

    } catch(err) {
        console.error("Pipeline Error:", err);
        res.status(500).json({ error: 'Pipeline failed', details: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`KBO Carousel Server running on http://localhost:${PORT}`);
});
