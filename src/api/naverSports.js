const axios = require('axios');

const naverSportsAPI = {
  // 1. 특정 일자 경기 일정 및 결과 가져오기 (gameId 추출용)
  async getSchedule(dateStr) { // dateStr format: YYYY-MM-DD
    try {
      const url = `https://api-gw.sports.naver.com/schedule/games?fields=basic&upperCategoryId=kbaseball&categoryId=kbo&fromDate=${dateStr}&toDate=${dateStr}`;
      const response = await axios.get(url, {
        headers: {
          'Origin': 'https://sports.news.naver.com',
          'Referer': 'https://sports.news.naver.com/',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });
      return response.data.result.games || [];
    } catch (error) {
      console.error(`Error fetching schedule for ${dateStr}:`, error.message);
      return [];
    }
  },

  // 2. 특정 경기 박스스코어(기록) 가져오기
  async getBoxscore(gameId) {
    try {
      const url = `https://api-gw.sports.naver.com/schedule/games/${gameId}/record`;
      const response = await axios.get(url, {
         headers: {
          'Origin': 'https://sports.news.naver.com',
          'Referer': 'https://sports.news.naver.com/',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
        }
      });
      return response.data.result.recordData || null;
    } catch (error) {
      console.error(`Error fetching boxscore for ${gameId}:`, error.message);
      return null;
    }
  },

  // 3. 시즌 누적 타율 순위 가져오기 (2026 정규시즌)
  async getHitterRanking(season = '2026') {
    try {
      const url = `https://api-gw.sports.naver.com/statistics/categories/kbo/seasons/${season}/players?sortField=hitterHra&sortDirection=desc&playerType=HITTER&gameType=REGULAR_SEASON`;
      const response = await axios.get(url, {
        headers: {
          'Origin': 'https://sports.news.naver.com',
          'Referer': 'https://sports.news.naver.com/',
          'User-Agent': 'Mozilla/5.0'
        }
      });
      return response.data.result.seasonPlayerStats || [];
    } catch (error) {
       console.error(`Error fetching hitter ranking:`, error.message);
       return [];
    }
  },

  // 4. 특정 일자 핫뉴스 가져오기
  async getNews(dateStrCompact) { // dateStrCompact format: YYYYMMDD
     try {
        const url = `https://api-gw.sports.naver.com/news/articles/kbaseball?sort=latest&date=${dateStrCompact}&page=1&pageSize=40&isPhoto=N`;
        const response = await axios.get(url, {
            headers: {
            'Origin': 'https://sports.news.naver.com',
            'Referer': 'https://sports.news.naver.com/',
            'User-Agent': 'Mozilla/5.0'
          }
        });
        return response.data.result.newsList || [];
     } catch (error) {
         console.error(`Error fetching news for ${dateStrCompact}:`, error.message);
         return [];
     }
  },

  // 5. 시즌 누적 평균자책점 순위 가져오기 (투수 ERA)
  async getPitcherRanking(season = '2026') {
    try {
      const url = `https://api-gw.sports.naver.com/statistics/categories/kbo/seasons/${season}/players?sortField=pitcherEra&sortDirection=asc&playerType=PITCHER&gameType=REGULAR_SEASON`;
      const response = await axios.get(url, {
        headers: {
          'Origin': 'https://sports.news.naver.com',
          'Referer': 'https://sports.news.naver.com/',
          'User-Agent': 'Mozilla/5.0'
        }
      });
      return response.data.result.seasonPlayerStats || [];
    } catch (error) {
       console.error(`Error fetching pitcher ranking:`, error.message);
       return [];
    }
  }
};

module.exports = naverSportsAPI;
