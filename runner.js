require('dotenv').config();
const path = require('path');
const fs = require('fs');

const naverSportsAPI = require('./src/api/naverSports');
const geminiAPI = require('./src/api/gemini');
const { getDailyMVP } = require('./src/analysis/mvpScore');
const { getTopBatters, getTopPitchers } = require('./src/analysis/rankings');
const { updateSeasonMvpRace, saveSeasonMvpRace } = require('./src/analysis/seasonMvpRace');
const { saveDailyBatters, getHotColdPlayers, loadDailyScores } = require('./src/analysis/hotCold');
const { getWeeklyMvpLeaders } = require('./src/analysis/weeklyMvp');
const { detectMilestones } = require('./src/analysis/milestone');
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

    console.log(`[7] Uploading ${images.length} images to Discord...`);
    const form = new FormData();
    form.append('payload_json', JSON.stringify({
        content: `🏆 **${dateStr} KBO 투데이 캐러셀 v2 생성 완료!**\n자동화 봇이 ${images.length}장의 인스타그램용 카드를 성공적으로 생성했습니다. 🚀`
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

    console.log(`🚀 [START] KBO Carousel v2 Pipeline for Date: ${dateDash}`);

    try {
        // ── 1단계: 일정 & 박스스코어 수집 ──
        console.log(`[1] Fetching Schedule & Boxscores for ${dateDash}...`);
        const games = await naverSportsAPI.getSchedule(dateDash);
        
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

        // ── 2단계: 시즌 누적 스탯 로드 및 팀명 매핑 테이블 빌드 ──
        console.log(`[2] Fetching Season Rankings & Building Team Map...`);
        const seasonYear = dateDash.substring(0, 4);
        const seasonHitters = await naverSportsAPI.getHitterRanking(seasonYear);
        const topBatters = getTopBatters(seasonHitters);

        const seasonPitchers = await naverSportsAPI.getPitcherRanking(seasonYear);
        const topPitchers = getTopPitchers(seasonPitchers);

        // KBO 전체 선수 공식 소속팀명 매핑 테이블 구축 (홈/어웨이 API 꼬임 대응)
        const playerTeamMap = {};
        for (const p of seasonHitters) {
            if (p.playerName) {
                playerTeamMap[p.playerId] = p.teamName;
                playerTeamMap[p.playerName] = p.teamName;
            }
        }
        for (const p of seasonPitchers) {
            if (p.playerName) {
                playerTeamMap[p.playerId] = p.teamName;
                playerTeamMap[p.playerName] = p.teamName;
            }
        }

        console.log(`[2-1] Analyzing MVP Data...`);
        const mvpData = getDailyMVP(gamesRecordData, playerTeamMap);

        // ── 3단계: 시즌 MVP 레이스 갱신 ──
        console.log(`[3] Updating Season MVP Race & Daily Scores...`);
        const { top10: seasonMvpTop10, newEntries: seasonMvpNewEntries } = updateSeasonMvpRace(mvpData.top5, dateDash, gamesRecordData);
        saveSeasonMvpRace(seasonMvpTop10);

        // 일별 타자 성적 저장 (핫/콜드 & 주간 MVP용)
        // 전 경기 타자 기록 추출
        const allBatters = [];
        for (const game of gamesRecordData) {
            const { gameInfo, recordData } = game;
            for (const teamType of ['away', 'home']) {
                const batters = (recordData.battersBoxscore && recordData.battersBoxscore[teamType]) || [];
                for (const batter of batters) {
                    if (batter.ab > 0 || batter.bb > 0) {
                        const lookupKey1 = `${batter.playerCode || batter.playerId}`;
                        const lookupKey2 = `${batter.name}`;
                        const realTeamName = playerTeamMap[lookupKey1] || playerTeamMap[lookupKey2] || gameInfo[`${teamType}TeamName`];

                        allBatters.push({
                            ...batter,
                            playerName: batter.name,
                            teamName: realTeamName,
                            mvpScore: mvpData.top5.find(p => p.playerName === batter.name)?.mvpScore || 0,
                        });
                    }
                }
            }
        }
        const dailyData = saveDailyBatters(allBatters, dateDash);

        // ── 4단계: 니치 분석 (핫/콜드, 주간 MVP, 마일스톤) ──
        console.log(`[4] Running Niche Analytics (Hot/Cold, Weekly MVP, Milestones)...`);
        const hotCold = getHotColdPlayers(dailyData, seasonHitters);
        const weeklyMvpLeaders = getWeeklyMvpLeaders();
        const milestones = detectMilestones(seasonHitters, seasonPitchers);

        // ── 5단계: Gemini AI 분석 (뉴스 큐레이션 + 경기별 승률) ──
        console.log(`[5] Fetching News & Gemini AI Analysis...`);
        const recentNews = await naverSportsAPI.getNews(dateStr);
        const nextDaySchedule = await naverSportsAPI.getSchedule(nextDateDash);
        
        const [hotNewsList, aiWinRates] = await Promise.all([
            geminiAPI.pickTop3News(recentNews, dateDash),
            geminiAPI.predictMatchWinRates(nextDaySchedule, dateDash, nextDateDash)
        ]);

        // ── 6단계: 최종 데이터 조립 & 렌더링 ──
        console.log(`[6] Rendering 10 HTML templates to PNG via Puppeteer...`);
        const finalData = {
            date: dateDash,
            mvpData,
            battingRace: topBatters,
            pitcherRace: topPitchers,
            seasonMvpTop10,
            seasonMvpNewEntries,
            hotCold,
            weeklyMvpLeaders,
            milestones,
            hotNews: hotNewsList,
            aiWinRates,
            nextDaySchedule,
        };
        fs.writeFileSync(path.join(outputDir, `data_${dateStr}.json`), JSON.stringify(finalData, null, 2));

        const generatedImages = await renderCarousel(finalData, outputDir);
        
        console.log(`✅ [SUCCESS] ${generatedImages.length} Cards generated!`);
        generatedImages.forEach((img, idx) => {
            console.log(`  ${idx + 1}. ${img}`);
        });

        // Discord로 전송
        await notifyDiscord(generatedImages, dateDash);

        // Instagram 동적 캡션 + 해시태그 댓글 생성
        console.log(`[8] Gemini 기반 인스타그램 캡션/해시태그 생성...`);
        const igData = await geminiAPI.generateInstagramCaption(finalData);

        const imagePaths = generatedImages.map(imgRelPath => {
            const filename = imgRelPath.split('?')[0].replace('/output/', '');
            return path.join(outputDir, filename);
        });
        
        try {
            await publishToInstagram(imagePaths, igData.caption, igData.comment);
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
