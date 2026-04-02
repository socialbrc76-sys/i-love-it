document.addEventListener('DOMContentLoaded', () => {
    const btnGenerate = document.getElementById('btnGenerate');
    const targetDateInput = document.getElementById('targetDate');
    const statusBox = document.getElementById('statusBox');
    const statusText = document.getElementById('statusText');
    const sliderContainer = document.getElementById('sliderContainer');
    const downloadSection = document.getElementById('downloadSection');
    const btnPrev = document.getElementById('btnPrev');
    const btnNext = document.getElementById('btnNext');

    // Default target date to yesterday if before 14:00, or today
    const now = new Date();
    
    btnGenerate.addEventListener('click', async () => {
        const dateVal = targetDateInput.value;
        if (!dateVal) return alert('날짜를 선택해주세요.');

        // Update UI status
        btnGenerate.disabled = true;
        statusBox.classList.remove('hidden');
        downloadSection.classList.add('hidden');
        btnPrev.classList.add('hidden');
        btnNext.classList.add('hidden');
        sliderContainer.innerHTML = '';
        
        statusText.textContent = '크롤링 & AI 분석 중... (약 10~20초 소요)';

        try {
            // Call Backend Generation API
            const response = await fetch(`http://localhost:3000/api/generate?date=${dateVal}`);
            const result = await response.json();

            if (result.success && result.images && result.images.length > 0) {
                statusText.textContent = '렌더링 완료!';
                
                // 1. Clear container
                sliderContainer.innerHTML = '';
                
                // 2. Append slides
                result.images.forEach((imgUrl, idx) => {
                    const slide = document.createElement('div');
                    slide.className = 'carousel-slide';
                    const img = document.createElement('img');
                    img.src = `${imgUrl}?t=${new Date().getTime()}`;
                    slide.appendChild(img);
                    sliderContainer.appendChild(slide);
                });

                // Show action buttons
                downloadSection.classList.remove('hidden');
                
                // 슬라이드가 여러 장일 경우에만 화살표 노출
                if (result.images.length > 1) {
                    btnPrev.classList.remove('hidden');
                    btnNext.classList.remove('hidden');
                }
            } else {
                throw new Error(result.error || 'Failed to generate images');
            }
        } catch (error) {
            console.error(error);
            sliderContainer.innerHTML = `<div class="empty-state">
                <h3 style="color:#ef4444;">에러 발생</h3>
                <p>${error.message}</p>
            </div>`;
        } finally {
            btnGenerate.disabled = false;
            statusBox.classList.add('hidden');
        }
    });

    // 좌우 스크롤 화살표 버튼 클릭 이벤트
    btnPrev.addEventListener('click', () => {
        // 첫번째 슬라이드의 너비 측정하여 그만큼 스크롤 (gap 30px 포함)
        const slideWidth = sliderContainer.querySelector('.carousel-slide').offsetWidth;
        sliderContainer.scrollBy({ left: -(slideWidth + 30), behavior: 'smooth' });
    });

    btnNext.addEventListener('click', () => {
        const slideWidth = sliderContainer.querySelector('.carousel-slide').offsetWidth;
        sliderContainer.scrollBy({ left: slideWidth + 30, behavior: 'smooth' });
    });

    document.getElementById('btnDownloadZip').addEventListener('click', () => {
        alert("개별 이미지 우클릭 다운로드를 이용하시거나, Output 폴더에서 찾을 수 있습니다.");
    });
});

