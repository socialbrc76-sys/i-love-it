const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');
const path = require('path');

// 대기 시간 유틸리티 (Rate Limit 방지용)
const delay = ms => new Promise(res => setTimeout(res, ms));

/**
 * 1. 로컬 이미지를 Freeimage.host에 업로드하여 임시 퍼블릭 URL을 받아옵니다.
 * (Instagram Graph API는 퍼블릭 URL 형태의 이미지만 처리할 수 있기 때문)
 */
async function uploadToFreeImageHost(imagePath) {
    const form = new FormData();
    form.append('action', 'upload');
    form.append('key', '6d207e02198a847aa98d0a2a901485a5'); // Public API Key
    form.append('format', 'json');
    form.append('source', fs.createReadStream(imagePath));

    try {
        const response = await axios.post('https://freeimage.host/api/1/upload', form, {
            headers: form.getHeaders()
        });
        return response.data.image.url;
    } catch (error) {
        console.error(`❌ 외부 이미지 호스팅 업로드 실패 (${path.basename(imagePath)}):`, error.response?.data || error.message);
        throw error;
    }
}

/**
 * 2. Instagram Graph API (Creator) - 캐러셀 개별 아이템(자식 컨테이너) 생성
 */
async function createCarouselItem(imageUrl, token) {
    try {
        const response = await axios.post('https://graph.instagram.com/me/media', null, {
            params: {
                image_url: imageUrl,
                is_carousel_item: true,
                access_token: token
            }
        });
        return response.data.id;
    } catch (error) {
        console.error('❌ 캐러셀 아이템 생성 실패:', error.response?.data || error.message);
        throw error;
    }
}

/**
 * 3. 개별 아이템들을 묶어 하나의 캐러셀 컨테이너 생성 (캡션 포함)
 */
async function createCarouselContainer(childrenIds, caption, token) {
    try {
        const response = await axios.post('https://graph.instagram.com/me/media', null, {
            params: {
                media_type: 'CAROUSEL',
                children: childrenIds.join(','),
                caption: caption,
                access_token: token
            }
        });
        return response.data.id;
    } catch (error) {
        console.error('❌ 캐러셀 묶음 컨테이너 생성 실패:', error.response?.data || error.message);
        throw error;
    }
}

/**
 * 4. 생성된 캐러셀 컨테이너를 피드에 최종 발행
 */
async function publishMedia(creationId, token) {
    try {
        const response = await axios.post('https://graph.instagram.com/me/media_publish', null, {
            params: {
                creation_id: creationId,
                access_token: token
            }
        });
        return response.data.id;
    } catch (error) {
        console.error('❌ 인스타그램 최종 발행 실패:', error.response?.data || error.message);
        throw error;
    }
}

/**
 * 5. 생성된 미디어(게시물)에 첫 번째 댓글(해시태그) 달기
 */
async function postComment(mediaId, commentText, token) {
    try {
        const response = await axios.post(`https://graph.instagram.com/v19.0/${mediaId}/comments`, null, {
            params: {
                message: commentText,
                access_token: token
            }
        });
        return response.data.id;
    } catch (error) {
        console.error('❌ 인스타그램 댓글 달기 실패:', error.response?.data || error.message);
        // 댓글 달기 실패는 치명적 파이프라인 에러로 간주하지 않음
        return null;
    }
}

/**
 * [메인 발행 파이프라인] 이미지를 차례대로 업로드하고 Instagram에 최종 포스팅 및 댓글 작성합니다. 
 */
async function publishToInstagram(imagePaths, caption, commentText) {
    const token = process.env.IG_ACCESS_TOKEN;
    if (!token) {
        console.log('⚠️ IG_ACCESS_TOKEN이 설정되지 않아 인스타그램 자동 업로드를 건너뜁니다.');
        return null;
    }

    console.log(`\n📸 [Instagram] 인스타그램 자동 업로드 파이프라인을 시작합니다...`);
    
    // 1단계: 모든 이미지를 퍼블릭 호스팅에 올려서 퍼블릭 URL 확보 (Rate Limit 우회 명목으로 1초 간격)
    const imageUrls = [];
    console.log(`[Instagram-1] ${imagePaths.length}장의 이미지를 업로드 호스팅 서버로 임시 전송 중...`);
    for (let i = 0; i < imagePaths.length; i++) {
        const url = await uploadToFreeImageHost(imagePaths[i]);
        imageUrls.push(url);
        // console.log(`  └ 업로드 성공: ${url}`);
        await delay(1000); 
    }

    // 2단계: 각각의 URL을 인스타그램 캐러셀 아이템으로 등록
    const childrenIds = [];
    console.log(`[Instagram-2] 개별 이미지 카드를 인스타그램 서버에 아이템으로 등록 중...`);
    for (let i = 0; i < imageUrls.length; i++) {
        const itemId = await createCarouselItem(imageUrls[i], token);
        childrenIds.push(itemId);
        await delay(1000); 
    }

    // 3단계: 아이템들을 하나로 묶기
    console.log(`[Instagram-3] 9장의 카드를 하나의 캐러셀 피드 게시물로 취합 중...`);
    const carouselContainerId = await createCarouselContainer(childrenIds, caption, token);
    await delay(3000); // 묶는 작업 직후 딜레이를 주어 서버 동기화 기다림

    // 4단계: 최종 발행
    console.log(`[Instagram-4] 캐러셀 피드를 최종 발행합니다!`);
    const publishedMediaId = await publishMedia(carouselContainerId, token);
    console.log(`  └ 본문 게시 완료 (Media ID: ${publishedMediaId})`);

    // 5단계: 해시태그 댓글 작성
    if (commentText) {
        console.log(`[Instagram-5] 첫 번째 댓글(해시태그) 작성 중...`);
        await delay(3000); // 게시물이 서버에 완전히 반영될 때까지 약간 대기
        await postComment(publishedMediaId, commentText, token);
        console.log(`  └ 댓글 달기 완료!`);
    }

    console.log(`✅ [Instagram SUCCESS] 성공적으로 전체 업로드되었습니다!`);
    return `https://www.instagram.com/p/${publishedMediaId}`; 
}

module.exports = {
    publishToInstagram
};
