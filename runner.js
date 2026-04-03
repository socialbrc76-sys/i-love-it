require('dotenv').config();
const path = require('path');
const fs = require('fs');

const naverSportsAPI = require('./src/api/naverSports');
const geminiAPI = require('./src/api/gemini');
const { getDailyMVP } = require('./src/analysis/mvpScore');
const { getTopBatters, getTopPitchers } = require('./src/analysis/rankings');
const { renderCarousel } = require('./src/render/puppeteer');
const { publishToInstagram } = require('./src/api/instagram');

const outputDir = path.join(__dirname, 'output');
if (!fs.existsSync(outputDir)){
    fs.mkdirSync(outputDir);
}

// 어제 날짜 구하기 함수 (KBO 경기는 주로 어제 결과를 바탕으로 발행)
function getYesterdayDateStr() {
    const today = new Date();
    // 한국 시간(KST, UTC+9) 기준으로 맞추기
    today.setHours(today.getHours() + 9);
    today.setDate(today.getDate() - 1); // 하루 전
    return today.toISOString().split('T')[0];
}

const axios = require('axios');
const FormData = require('form-data');

async function notifyDiscord(images, dateStr) {
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    if (!webhookUrl) {
        console.log('⚠️ DISCORD_WEBHOOK_URL is not set. Skipping Discord notification.');
        return;
    }

    console.log(`[6] Uploading ${images.length} images to Discord...`);
    const form = new FormData();
    form.append('payload_json', JSON.stringify({
        content: `🏆 **${dateStr} KBO 투데이 캐러셀 생성 완료!**\n자동화 봇이 ${images.length}장의 인스타그램용 카드를 성공적으로 생성했습니다.\n폰에서 사진을 길게 눌러 바로 저장 후 인스타에 업로드해보세요! 🚀`
    }));

    images.forEach((imgRelPath, idx) => {
        const filename = imgRelPath.split('?')[0].replace('/output/', '');
        const absPath = path.join(outputDir, filename);
        form.append(`file${idx}`, fs.createReadStream(absPath));
    });

    try {
        await axios.post(webhookUrl, form, {
            headers: form.getHeaders(),
        });
        console.log('✅ Discord notification sent successfully.');
    } catch (err) {
        console.error('❌ Failed to send Discord notification:', err.message);
        if(err.response) console.error(err.response.data);
    }
}

async function runPipeline() {
    const dateDash = process.argv[2] || getYesterdayDateStr();
    const dateStr = dateDash.replace(/-/g, '');

    const todayObj = new Date(dateDash);
    const tomorrow = new Date(todayObj);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const nextDateDash = tomorrow.toISOString().split('T')[0];

    console.log(`🚀 [START] KBO Carousel Pipeline for Date: ${dateDash}`);

    try {
        console.log(`[1] Fetching Schedule & Boxscores for ${dateDash}...`);
        const games = await naverSportsAPI.getSchedule(dateDash);
        
        // 경기가 없는 날 예외 처리
        if (!games || games.length === 0) {
            console.log(`⚠️ ${dateDash} 일자에 예정된 경기 일정이 없습니다. 작업을 종료합니다.`);
            process.exit(0);
        }

        const gamesRecordData = [];
        for (const game of games) {
            const gameId = game.gameId;
            const record = await naverSportsAPI.getBoxscore(gameId);
            if(record) {
                gamesRecordData.push({ gameInfo: game, recordData: record });
            }
        }

        if (gamesRecordData.length === 0) {
            console.log(`⚠️ ${dateDash} 일자에 종료된 경기(박스스코어)가 없습니다. (우천 취소 등)`);
            process.exit(0);
        }

        console.log(`[2] Analyzing Data (MVP, Rankings)...`);
        const mvpData = getDailyMVP(gamesRecordData);
        
        const seasonYear = dateDash.substring(0, 4);
        const seasonHitters = await naverSportsAPI.getHitterRanking(seasonYear);
        const topBatters = getTopBatters(seasonHitters);

        const seasonPitchers = await naverSportsAPI.getPitcherRanking(seasonYear);
        const topPitchers = getTopPitchers(seasonPitchers);

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
            pitcherRace: topPitchers,
            hotNews: hotNewsList,
            aiPrediction
        };
        fs.writeFileSync(path.join(outputDir, `data_${dateStr}.json`), JSON.stringify(finalData, null, 2));

        console.log(`[5] Rendering HTML templates to PNG via Puppeteer...`);
        const generatedImages = await renderCarousel(finalData, outputDir);
        
        console.log(`✅ [SUCCESS] 10 Cards generated!`);
        generatedImages.forEach((img, idx) => {
            console.log(`  ${idx + 1}. ${img}`);
        });

        // Discord로 전송
        await notifyDiscord(generatedImages, dateDash);

        // Instagram 자동 업로드
        const imagePaths = generatedImages.map(imgRelPath => {
            const filename = imgRelPath.split('?')[0].replace('/output/', '');
            return path.join(outputDir, filename);
        });
        
        const caption = `🏆 ${dateDash} KBO 데일리 리포트\n\n오늘의 KBO 경기 요약과 선수 랭킹, 그리고 AI의 내일 경기 예측까지!\n매일 아침 업데이트되는 생생한 야구 소식을 확인하세요. ⚾🔥\n\n#KBO #프로야구 #야구 #KBO리그 #오늘의MVP #타율왕 #ERA #야구팬`;
        try {
            await publishToInstagram(imagePaths, caption);
        } catch (igError) {
            console.error('⚠️ 인스타그램 업로드 파이프라인 중 오류가 발생했습니다. (Discord 전송은 완료됨)', igError.message);
        }

        process.exit(0);
    } catch(err) {
        console.error("❌ Pipeline Error:", err);
        process.exit(1);
    }
}

runPipeline();
