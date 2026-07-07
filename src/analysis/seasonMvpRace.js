// seasonMvpRace.js
// 시즌 역대 최고 단일 경기 MVP 스코어 Top 10 관리

const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '../../data/season_mvp_top10.json');
const MAX_ENTRIES = 10;

/**
 * 현재 저장된 시즌 MVP Top 10 데이터를 로드합니다.
 */
function loadSeasonMvpRace() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
        }
    } catch (e) {
        console.warn('⚠️ season_mvp_top10.json 로드 실패, 빈 배열로 초기화:', e.message);
    }
    return [];
}

/**
 * 오늘의 MVP 스코어들을 기존 Top 10과 비교하여 갱신합니다.
 * @param {Array} todayTop5 - 오늘의 상위 5명 (mvpScore, playerName, teamName 포함)
 * @param {string} dateStr - 오늘 날짜 (YYYY-MM-DD)
 * @param {Array} gamesRecordData - 경기 정보 (상대팀 추출용)
 * @returns {Object} { top10: 갱신된 Top 10 배열, newEntries: 신규 진입 인덱스 배열 }
 */
function updateSeasonMvpRace(todayTop5, dateStr, gamesRecordData = []) {
    const current = loadSeasonMvpRace();
    const newEntries = [];

    for (const player of todayTop5) {
        if (!player || !player.mvpScore) continue;

        const entry = {
            playerName: player.playerName,
            teamName: player.teamName,
            mvpScore: player.mvpScore,
            date: dateStr,
            playerCode: player.playerCode || '',
        };

        // 이미 같은 선수가 같은 날짜로 존재하면 스킵 (중복 방지)
        const duplicate = current.find(e =>
            e.playerName === entry.playerName &&
            e.date === entry.date &&
            e.mvpScore === entry.mvpScore
        );
        if (duplicate) continue;

        // Top 10에 들어갈 수 있는지 확인
        if (current.length < MAX_ENTRIES || entry.mvpScore > current[current.length - 1].mvpScore) {
            current.push(entry);
            current.sort((a, b) => b.mvpScore - a.mvpScore);
            
            // 10개 초과 시 하위 제거
            if (current.length > MAX_ENTRIES) {
                current.splice(MAX_ENTRIES);
            }

            // 신규 진입 인덱스 기록
            const idx = current.findIndex(e =>
                e.playerName === entry.playerName &&
                e.date === entry.date &&
                e.mvpScore === entry.mvpScore
            );
            if (idx !== -1) newEntries.push(idx);
        }
    }

    return { top10: current, newEntries };
}

/**
 * 갱신된 Top 10 데이터를 파일에 저장합니다.
 */
function saveSeasonMvpRace(top10) {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(top10, null, 2), 'utf-8');
        console.log(`  └ 시즌 MVP Top 10 데이터 저장 완료 (${top10.length}건)`);
    } catch (e) {
        console.error('❌ season_mvp_top10.json 저장 실패:', e.message);
    }
}

module.exports = { loadSeasonMvpRace, updateSeasonMvpRace, saveSeasonMvpRace };
