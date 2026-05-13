document.addEventListener('DOMContentLoaded', () => {
    const zoneSelect = document.getElementById('zone-select');
    const slotInput = document.getElementById('slot-input');
    const saveLocationBtn = document.getElementById('save-location-btn');
    const cameraInput = document.getElementById('camera-input');
    const cameraLabel = document.querySelector('.camera-btn span');

    const savedLocationDisplay = document.getElementById('saved-location');
    const savedTimeDisplay = document.getElementById('saved-time');
    const gpsInfoContainer = document.getElementById('gps-info');
    const savedAddressDisplay = document.getElementById('saved-address');
    const photoContainer = document.getElementById('photo-container');
    const savedPhoto = document.getElementById('saved-photo');

    let map = null;
    let marker = null;

    // Populate A-Z
    for (let i = 65; i <= 90; i++) {
        const option = document.createElement('option');
        option.value = String.fromCharCode(i);
        option.textContent = String.fromCharCode(i);
        zoneSelect.appendChild(option);
    }

    // Format Number Input (always 2 digits eventually)
    slotInput.addEventListener('input', (e) => {
        let val = e.target.value;
        if (val.length > 2) {
            e.target.value = val.slice(0, 2);
        }
    });

    // Load saved data on startup
    loadSavedData();

    function loadSavedData() {
        const savedData = JSON.parse(localStorage.getItem('parkingData'));
        if (savedData) {
            if (savedData.zone && savedData.slot) {
                savedLocationDisplay.textContent = `${savedData.zone} - ${savedData.slot}`;
            } else {
                savedLocationDisplay.textContent = '- -';
            }
            if (savedData.gps) {
                savedAddressDisplay.textContent = savedData.gps.address || '주소 정보 없음';
                gpsInfoContainer.style.display = 'block';

                const mapEl = document.getElementById('map');
                mapEl.style.display = 'block';

                if (!map) {
                    map = L.map('map').setView([savedData.gps.lat, savedData.gps.lng], 16);
                    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                        maxZoom: 19,
                        attribution: '© OpenStreetMap'
                    }).addTo(map);

                    marker = L.marker([savedData.gps.lat, savedData.gps.lng]).addTo(map);
                } else {
                    map.setView([savedData.gps.lat, savedData.gps.lng], 16);
                    marker.setLatLng([savedData.gps.lat, savedData.gps.lng]);
                }

                setTimeout(() => { map.invalidateSize(); }, 100);
            } else {
                gpsInfoContainer.style.display = 'none';
                const mapEl = document.getElementById('map');
                if (mapEl) mapEl.style.display = 'none';
            }

            savedTimeDisplay.textContent = savedData.timestamp ? `마지막 저장: ${savedData.timestamp}` : '기록이 없습니다.';

            if (savedData.photo) {
                savedPhoto.src = savedData.photo;
                photoContainer.style.display = 'block';
            } else {
                photoContainer.style.display = 'none';
                savedPhoto.src = '';
            }
        }
    }

    function getFormattedTime() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        return `${year}년 ${month}월 ${day}일 ${hours}:${minutes}`;
    }

    async function fetchAddress(lat, lng) {
        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
            const data = await response.json();
            return data.display_name;
        } catch (error) {
            console.error('주소 변환 실패:', error);
            return null;
        }
    }

    function saveAllData(newData, btnElement, originalText, successText) {
        const currentData = JSON.parse(localStorage.getItem('parkingData')) || {};
        
        // 새로운 주차 위치를 저장할 때 새 사진이 없다면 이전 사진 데이터 삭제 (용량 확보 및 갱신)
        if (newData.zone && !newData.photo) {
            delete currentData.photo;
        }

        const mergedData = { ...currentData, ...newData, timestamp: getFormattedTime() };
        
        try {
            localStorage.removeItem('parkingData'); // 공간 선확보
            localStorage.setItem('parkingData', JSON.stringify(mergedData));
            loadSavedData();
            
            btnElement.textContent = successText;
            btnElement.style.background = '#10b981';
            btnElement.style.borderColor = '#10b981';
            setTimeout(() => {
                btnElement.textContent = originalText;
                btnElement.style.background = '';
                btnElement.style.borderColor = '';
            }, 1500);
        } catch (err) {
            alert('저장 공간이 부족합니다. 이전 데이터를 지워주세요.');
            btnElement.textContent = originalText;
            btnElement.style.background = '';
            btnElement.style.borderColor = '';
        }
    }

    function handleSaveWithGPS(newData, btnElement, originalText, successText) {
        btnElement.textContent = '위치 확인 중...';
        
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    const lat = position.coords.latitude;
                    const lng = position.coords.longitude;
                    const address = await fetchAddress(lat, lng);
                    
                    newData.gps = {
                        lat: lat,
                        lng: lng,
                        address: address
                    };
                    
                    saveAllData(newData, btnElement, originalText, successText);
                },
                (error) => {
                    console.warn('GPS 권한이 없거나 가져올 수 없습니다.', error);
                    
                    // 로컬 테스트(file://) 환경을 위한 임시 데이터 제공
                    newData.gps = {
                        lat: 37.4979,
                        lng: 127.0276,
                        address: "테스트 임시 주소 (브라우저 보안으로 인해 실제 위치를 가져올 수 없음)"
                    };
                    saveAllData(newData, btnElement, originalText, successText);
                    
                    alert("⚠️ 브라우저 보안 정책(file://)으로 인해 실제 위치를 가져오지 못했습니다. 디자인 확인을 위해 임시 주소로 표시됩니다.");
                },
                { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
            );
        } else {
            saveAllData(newData, btnElement, originalText, successText);
        }
    }

    // Save Location Event
    saveLocationBtn.addEventListener('click', () => {
        const zone = zoneSelect.value;
        let slot = slotInput.value;

        if (!slot) {
            alert('숫자 2자리를 입력해주세요.');
            return;
        }

        if (slot.length === 1) {
            slot = '0' + slot;
        }

        const originalText = saveLocationBtn.textContent;
        handleSaveWithGPS({ zone, slot }, saveLocationBtn, originalText, '저장 완료!');
    });

    // Camera/File Event with image compression
    cameraInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();

            // Visual feedback for processing
            const originalCameraText = cameraLabel.textContent;
            cameraLabel.textContent = '사진 처리 중...';

            reader.onload = function (event) {
                const img = new Image();
                img.onload = function () {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 600;
                    const MAX_HEIGHT = 600;
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > MAX_WIDTH) {
                            height *= MAX_WIDTH / width;
                            width = MAX_WIDTH;
                        }
                    } else {
                        if (height > MAX_HEIGHT) {
                            width *= MAX_HEIGHT / height;
                            height = MAX_HEIGHT;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    const compressedBase64 = canvas.toDataURL('image/jpeg', 0.5);

                    handleSaveWithGPS({ photo: compressedBase64 }, cameraLabel, originalCameraText, '사진 저장 완료!');
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        }
    });
});



