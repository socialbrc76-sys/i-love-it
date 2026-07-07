// milestone.js
// 기록 임박 선수 감지 모듈

/**
 * 시즌 누적 스탯에서 라운드 넘버 임박 선수를 감지합니다.
 * @param {Array} hitterStats - 네이버 시즌 타자 스탯 배열
 * @param {Array} pitcherStats - 네이버 시즌 투수 스탯 배열
 * @returns {Array} 마일스톤 임박 선수 배열 (최대 4명)
 */
function detectMilestones(hitterStats, pitcherStats) {
    const milestones = [];

    // 타자 마일스톤 기준
    const HITTER_MILESTONES = [
        { field: 'hitterHit', label: '안타', targets: [50, 100, 150, 200] },
        { field: 'hitterHr', label: '홈런', targets: [10, 20, 30, 40] },
        { field: 'hitterRbi', label: '타점', targets: [30, 50, 80, 100] },
        { field: 'hitterRun', label: '득점', targets: [30, 50, 80, 100] },
        { field: 'hitterSb', label: '도루', targets: [10, 20, 30, 40] },
    ];

    // 투수 마일스톤 기준
    const PITCHER_MILESTONES = [
        { field: 'pitcherWin', label: '승', targets: [5, 10, 15, 20] },
        { field: 'pitcherSave', label: '세이브', targets: [10, 20, 30, 40] },
        { field: 'pitcherKk', label: '탈삼진', targets: [50, 100, 150, 200] },
        { field: 'pitcherHold', label: '홀드', targets: [10, 20, 30] },
    ];

    // 타자 마일스톤 체크
    for (const player of (hitterStats || []).slice(0, 50)) {
        for (const ms of HITTER_MILESTONES) {
            const current = Number(player[ms.field]) || 0;
            for (const target of ms.targets) {
                const remaining = target - current;
                // 남은 개수가 1~5개 사이일 때만 "임박"으로 판단
                if (remaining > 0 && remaining <= 5) {
                    milestones.push({
                        playerName: player.playerName,
                        teamName: player.teamName,
                        playerCode: player.playerId || '',
                        imageUrl: player.playerImageUrl || `https://sports-phinf.pstatic.net/player/kbo/default/${player.playerId}.png`,
                        label: `시즌 ${target}${ms.label}`,
                        current,
                        target,
                        remaining,
                        progress: Math.round((current / target) * 100),
                        priority: remaining, // 낮을수록 긴급
                    });
                }
            }
        }
    }

    // 투수 마일스톤 체크
    for (const player of (pitcherStats || []).slice(0, 30)) {
        for (const ms of PITCHER_MILESTONES) {
            const current = Number(player[ms.field]) || 0;
            for (const target of ms.targets) {
                const remaining = target - current;
                if (remaining > 0 && remaining <= 5) {
                    milestones.push({
                        playerName: player.playerName,
                        teamName: player.teamName,
                        playerCode: player.playerId || '',
                        imageUrl: player.playerImageUrl || `https://sports-phinf.pstatic.net/player/kbo/default/${player.playerId}.png`,
                        label: `시즌 ${target}${ms.label}`,
                        current,
                        target,
                        remaining,
                        progress: Math.round((current / target) * 100),
                        priority: remaining,
                    });
                }
            }
        }
    }

    // 긴급도(remaining 낮은 순) → 같으면 target 높은 순으로 정렬
    milestones.sort((a, b) => a.priority - b.priority || b.target - a.target);

    // 같은 선수가 여러 마일스톤에 등장할 경우 가장 긴급한 것 1개만 유지
    const seen = new Set();
    const unique = [];
    for (const m of milestones) {
        if (!seen.has(m.playerName)) {
            seen.add(m.playerName);
            unique.push(m);
        }
    }

    return unique.slice(0, 4);
}

module.exports = { detectMilestones };
