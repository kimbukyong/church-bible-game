// 게임 상태 관리
let currentUser = null;
let currentChurch = null;
let isAdmin = false;
let currentLevel = 1;
let currentScore = 0;
let currentQuestionIndex = 0;
let currentVerses = [];
let currentVerse = null; // 현재 진행 중인 말씀
let selectedAnswers = [];
let gameInProgress = false;
let soundEnabled = true;

// 음성 인식 관련 변수
let speechRecognition = null;
let isRecording = false;
let recognizedText = '';
let speechTimeout = null;
let speechRestartCount = 0;  // 재시작 횟수 추적
let isMobileDevice = false;  // 모바일 기기 감지
let speechKeepAliveInterval = null;  // 음성 인식 유지 인터벌
let lastSpeechActivity = 0;  // 마지막 음성 활동 시간
let isTabActive = true;  // 탭 활성화 상태

// DOM 요소 참조
const screens = {
    welcome: document.getElementById('welcome-screen'),
    adminLogin: document.getElementById('admin-login-screen'),
    studentLogin: document.getElementById('student-login-screen'),
    adminDashboard: document.getElementById('admin-dashboard'),
    game: document.getElementById('game-screen')
};

// 화면 전환 함수
function showScreen(screenName) {
    Object.values(screens).forEach(screen => {
        screen.classList.remove('active');
    });
    screens[screenName].classList.add('active');
}

// 알림 표시 함수
function showNotification(message, type = 'info') {
    // 기존 알림들 제거
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(notification => notification.remove());
    
    // 새로운 알림 생성
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    // 강제로 z-index 최상단 설정
    notification.style.zIndex = '99999';
    notification.style.position = 'fixed';
    notification.style.top = '20px';
    notification.style.right = '20px';
    
    // body 대신 html 요소에 직접 추가 (z-index 문제 방지)
    document.documentElement.appendChild(notification);
    
    // 3초 후 자동 제거
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 3000);
}

// 로딩 표시 함수
function showLoading(container) {
    container.innerHTML = `
        <div class="loading">
            <div class="spinner"></div>
        </div>
    `;
}

// Web Audio API를 이용한 기본 효과음 생성
const AudioGenerator = {
    audioContext: null,
    
    // AudioContext 초기화
    init() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.log('Web Audio API not supported:', e);
            return false;
        }
        return true;
    },
    
    // 정답 효과음 (높은 톤의 벨소리)
    playCorrectSound() {
        if (!this.audioContext) return;
        
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.frequency.setValueAtTime(800, this.audioContext.currentTime);
        oscillator.frequency.setValueAtTime(1000, this.audioContext.currentTime + 0.1);
        
        gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.3);
        
        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + 0.3);
    },
    
    // 오답 효과음 (낮은 톤의 부저소리)
    playWrongSound() {
        if (!this.audioContext) return;
        
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.frequency.setValueAtTime(200, this.audioContext.currentTime);
        oscillator.type = 'sawtooth';
        
        gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.5);
        
        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + 0.5);
    },
    
    // 레벨 완료 효과음 (승리 멜로디)
    playLevelCompleteSound() {
        if (!this.audioContext) return;
        
        const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
        
        notes.forEach((freq, index) => {
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            oscillator.frequency.setValueAtTime(freq, this.audioContext.currentTime + index * 0.2);
            oscillator.type = 'sine';
            
            gainNode.gain.setValueAtTime(0.2, this.audioContext.currentTime + index * 0.2);
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + index * 0.2 + 0.4);
            
            oscillator.start(this.audioContext.currentTime + index * 0.2);
            oscillator.stop(this.audioContext.currentTime + index * 0.2 + 0.4);
        });
    }
};

// 음성 재생 함수 (개선)
function playSound(soundType) {
    if (!soundEnabled) return;
    
    try {
        const audio = document.getElementById(soundType + 'Sound');
        if (audio && audio.src && !audio.src.includes('undefined')) {
            audio.currentTime = 0;
            audio.play().catch(e => {
                console.log(`Audio file failed, using generated sound (${soundType}):`, e);
                playGeneratedSound(soundType);
            });
        } else {
            // 오디오 파일이 없으면 생성된 소리 사용
            playGeneratedSound(soundType);
        }
    } catch (error) {
        console.log(`Sound error (${soundType}):`, error);
        playGeneratedSound(soundType);
    }
}

// 생성된 효과음 재생
function playGeneratedSound(soundType) {
    // Web Audio API 초기화 (한 번만)
    if (!AudioGenerator.audioContext) {
        if (!AudioGenerator.init()) {
            // Web Audio API도 지원하지 않으면 시각적 피드백만
            showVisualFeedback(soundType);
            return;
        }
    }
    
    // AudioContext가 suspended 상태일 때 resume
    if (AudioGenerator.audioContext.state === 'suspended') {
        AudioGenerator.audioContext.resume();
    }
    
    switch(soundType) {
        case 'correct':
            AudioGenerator.playCorrectSound();
            break;
        case 'wrong':
            AudioGenerator.playWrongSound();
            break;
        case 'levelComplete':
            AudioGenerator.playLevelCompleteSound();
            break;
    }
    
    // 시각적 피드백도 함께 제공
    showVisualFeedback(soundType);
}

// 시각적 피드백 함수 (음성이 없을 때 대체)
function showVisualFeedback(soundType) {
    const body = document.body;
    
    switch(soundType) {
        case 'correct':
            body.style.backgroundColor = '#10b981';
            setTimeout(() => body.style.backgroundColor = '', 200);
            break;
        case 'wrong':
            body.style.backgroundColor = '#f56565';
            setTimeout(() => body.style.backgroundColor = '', 200);
            break;
        case 'levelComplete':
            // 축하 효과
            createConfetti();
            break;
    }
}

// 축하 효과 (음성 대신)
function createConfetti() {
    const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24', '#f0932b'];
    
    for (let i = 0; i < 50; i++) {
        setTimeout(() => {
            const confetti = document.createElement('div');
            confetti.style.cssText = `
                position: fixed;
                width: 10px;
                height: 10px;
                background: ${colors[Math.floor(Math.random() * colors.length)]};
                left: ${Math.random() * 100}vw;
                top: -10px;
                border-radius: 50%;
                pointer-events: none;
                z-index: 9999;
                animation: confettiFall 3s linear forwards;
            `;
            
            document.body.appendChild(confetti);
            
            setTimeout(() => confetti.remove(), 3000);
        }, i * 50);
    }
}

// 음성 인식 매니저
const SpeechRecognitionManager = {
    init() {
        // 모바일 기기 감지
        detectMobileDevice();
        
        // 브라우저 호환성 확인
        try {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (!SpeechRecognition) {
                console.log('음성 인식을 지원하지 않는 브라우저입니다.');
                showNotification('이 브라우저는 음성 인식을 지원하지 않습니다. Chrome 또는 Edge를 사용해주세요.', 'error');
                return false;
            }
            
            // HTTPS 연결 확인
            if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
                console.log('음성 인식은 HTTPS 연결에서만 작동합니다.');
                showNotification('음성 인식은 보안 연결(HTTPS)에서만 작동합니다. 로컬 서버를 사용하거나 HTTPS 사이트에서 접속해주세요.', 'error');
                return false;
            }
            
            console.log('음성 인식 API 초기화 중...');
            speechRecognition = new SpeechRecognition();
            speechRecognition.lang = 'ko-KR';
            
            // 모바일 환경에 맞는 설정
            if (isMobileDevice) {
                speechRecognition.continuous = true;  // 모바일에서도 연속 모드로 변경
                speechRecognition.interimResults = true;
                console.log('모바일 환경 감지 - 연속 음성 인식 모드');
            } else {
                speechRecognition.continuous = true;
                speechRecognition.interimResults = true;
                console.log('데스크톱 환경 감지 - 연속 음성 인식 모드');
            }
            
            speechRecognition.maxAlternatives = 1;
            
            console.log('음성 인식 설정:', {
                lang: speechRecognition.lang,
                continuous: speechRecognition.continuous,
                interimResults: speechRecognition.interimResults
            });
            
            // 음성 인식 이벤트 리스너
            speechRecognition.onstart = () => {
                console.log('음성 인식 시작됨');
                
                // 녹음 상태 설정
                isRecording = true;
                
                // UI 업데이트 및 알림 표시
                this.updateRecordingUI(true);
                showNotification('🎤 음성 녹음이 시작되었습니다!', 'info');
            };
            
            speechRecognition.onend = () => {
                console.log('음성 인식 종료됨 - isRecording:', isRecording, 'speechRestartCount:', speechRestartCount);
                
                // 사용자가 중지 버튼을 눌렀거나 이미 중지된 상태면 자동 재시작하지 않음
                if (!isRecording) {
                    console.log('사용자가 중지함 - 자동 재시작 건너뛰기');
                    return;
                }
                
                // 자동 재시작 로직 (최대 1번으로 더 제한)
                if (speechRestartCount < 1) {
                    console.log(`음성 인식 자동 재시작 시도 (${speechRestartCount + 1}/1)`);
                    speechRestartCount++;
                    
                    // 안전한 재시작을 위해 더 긴 대기 시간
                    setTimeout(() => {
                        if (isRecording) {
                            try {
                                console.log('자동 재시작 실행');
                                speechRecognition.start();
                                showNotification(`🔄 음성 인식 재시작`, 'info');
                            } catch (error) {
                                console.error('음성 인식 재시작 실패:', error);
                                if (error.message.includes('already started')) {
                                    console.log('이미 시작됨 - 재시작 건너뛰기');
                                    // 이미 시작된 경우 재시작 카운터만 줄이기
                                    speechRestartCount--;
                                } else {
                                    console.log('재시작 불가능 - 종료 처리');
                                    this.handleRecordingEnd();
                                    showNotification('음성 인식 재시작에 실패했습니다. 다시 시도해주세요.', 'error');
                                }
                            }
                        } else {
                            console.log('녹음 취소됨 - 자동 재시작 중단');
                        }
                    }, 1000); // 1초 대기
                } else {
                    console.log('자동 재시작 한도 초과 - 종료 처리');
                    this.handleRecordingEnd();
                }
            };
            
            speechRecognition.onresult = (event) => {
                let finalText = '';
                let interimText = '';
                
                // 음성 활동 시간 업데이트
                lastSpeechActivity = Date.now();
                console.log('음성 인식 결과 수신 - 활동 시간 업데이트');
                
                console.log('음성 인식 결과:', event.results);
                
                if (event.results && event.results.length > 0) {
                    for (let i = event.resultIndex; i < event.results.length; i++) {
                        const result = event.results[i];
                        if (result && result[0] && result[0].transcript) {
                            const transcript = result[0].transcript;
                            console.log(`결과 ${i}: "${transcript}" (final: ${result.isFinal})`);
                            
                            if (result.isFinal) {
                                finalText += transcript;
                            } else {
                                interimText += transcript;
                            }
                        }
                    }
                }
                
                // 텍스트 누적 처리
                if (finalText && finalText.trim()) {
                    recognizedText += finalText;
                    console.log('누적된 텍스트:', recognizedText);
                }
                
                // 실시간으로 인식된 텍스트 업데이트
                this.updateRecognizedText(recognizedText || '', interimText || '');
            };
            
            speechRecognition.onerror = (event) => {
                console.error('음성 인식 오류:', event.error, event);
                isRecording = false;
                this.updateRecordingUI(false);
                
                let errorMessage = '음성 인식 중 오류가 발생했습니다.';
                switch(event.error) {
                    case 'not-allowed':
                        errorMessage = '마이크 권한이 거부되었습니다. 브라우저 설정에서 마이크 권한을 허용해주세요.';
                        break;
                    case 'no-speech':
                        errorMessage = '음성이 감지되지 않았습니다. 더 크게 또는 마이크에 가까이 말해주세요.';
                        break;
                    case 'network':
                        errorMessage = '네트워크 연결을 확인해주세요.';
                        break;
                    case 'audio-capture':
                        errorMessage = '마이크에 접근할 수 없습니다. 마이크가 연결되어 있는지 확인해주세요.';
                        break;
                    case 'service-not-allowed':
                        errorMessage = '음성 인식 서비스가 허용되지 않았습니다. HTTPS 연결을 확인해주세요.';
                        break;
                    case 'bad-grammar':
                        errorMessage = '음성 인식 설정에 오류가 있습니다.';
                        break;
                    case 'language-not-supported':
                        errorMessage = '한국어 음성 인식이 지원되지 않습니다.';
                        break;
                    default:
                        errorMessage = `음성 인식 오류: ${event.error}`;
                }
                showNotification(errorMessage, 'error');
            };
            
            // 마이크 권한은 startRecording()에서만 요청하도록 변경
            console.log('음성 인식 초기화 완료 - 마이크 권한은 녹음 시작 시 요청');
            
            return true;
        } catch (error) {
            console.error('음성 인식 초기화 실패:', error);
            showNotification('음성 인식 초기화에 실패했습니다: ' + error.message, 'error');
            return false;
        }
    },
    
    // 음성 인식 종료 처리
    handleRecordingEnd() {
        isRecording = false;
        speechRestartCount = 0;  // 재시작 카운터 초기화
        this.updateRecordingUI(false);
        
        // Keep-alive 중지
        stopSpeechKeepAlive();
        
        // 자동 중지 타이머 해제
        if (speechTimeout) {
            clearTimeout(speechTimeout);
            speechTimeout = null;
        }
        
        console.log('음성 인식 완전 종료');
    },

    // 음성 인식 시작
    async startRecording() {
        if (!speechRecognition) {
            showNotification('음성 인식이 지원되지 않습니다.', 'error');
            return false;
        }
        
        // 이미 녹음 중이면 중지하고 새로 시작
        if (isRecording) {
            console.log('이미 녹음 중 - 중지 후 재시작');
            this.forceStopRecording();
            // 잠시 기다린 후 재시작
            setTimeout(() => {
                this.startRecording();
            }, 200);
            return true;
        }
        
        try {
            // 이전 결과 완전 초기화
            recognizedText = '';
            speechRestartCount = 0;  // 재시작 카운터 초기화
            console.log('음성 인식 데이터 초기화 완료');
            this.updateRecognizedText('', '');
            
            // 모바일 환경에서 화면 잠금 방지
            if (isMobileDevice) {
                preventScreenLock();
            }
            
            console.log('음성 인식 시작 시도...');
            
            // 마이크 권한 요청 (한 번만)
            try {
                await navigator.mediaDevices.getUserMedia({ audio: true });
                console.log('마이크 권한 확인됨');
            } catch (err) {
                console.error('마이크 권한 거부:', err);
                showNotification('마이크 권한이 필요합니다. 브라우저 설정에서 마이크 권한을 허용해주세요.', 'error');
                return false;
            }
            
            // 이미 시작된 경우를 대비한 안전장치
            try {
                speechRecognition.stop();
            } catch (e) {
                // 이미 중지된 상태면 무시
                console.log('이미 중지된 상태:', e.message);
            }
            
            // 잠시 기다린 후 시작
            setTimeout(() => {
                try {
                    speechRecognition.start();
                    lastSpeechActivity = Date.now(); // 활동 시간 초기화
                    
                    // Keep-alive 메커니즘 시작
                    if (isMobileDevice) {
                        startSpeechKeepAlive();
                    }
                    
                    // 모바일 환경에서는 더 긴 타임아웃 (60초)
                    const timeoutDuration = isMobileDevice ? 60000 : 30000;
                    speechTimeout = setTimeout(() => {
                        this.stopRecording();
                        showNotification(`${timeoutDuration/1000}초가 지나 자동으로 녹음이 중지되었습니다.`, 'info');
                    }, timeoutDuration);
                } catch (startError) {
                    console.error('음성 인식 시작 실패:', startError);
                    isRecording = false;
                    this.updateRecordingUI(false);
                    if (startError.message.includes('already started')) {
                        showNotification('음성 인식이 이미 실행 중입니다. 잠시 후 다시 시도해주세요.', 'warning');
                    } else {
                        showNotification('음성 인식을 시작할 수 없습니다: ' + startError.message, 'error');
                    }
                }
            }, 100);
            
            return true;
        } catch (error) {
            console.error('음성 인식 시작 오류:', error);
            showNotification('음성 인식을 시작할 수 없습니다. 오류: ' + error.message, 'error');
            return false;
        }
    },
    
    // 음성 인식 중지
    stopRecording() {
        console.log('음성 인식 중지 요청');
        
        // 즉시 녹음 상태를 false로 설정하여 자동 재시작 방지
        isRecording = false;
        speechRestartCount = 0;
        
        // Keep-alive 중지
        stopSpeechKeepAlive();
        
        if (speechRecognition) {
            try {
                speechRecognition.stop();
            } catch (e) {
                console.log('중지 중 오류 (무시):', e.message);
            }
        }
        
        // 타임아웃 해제
        if (speechTimeout) {
            clearTimeout(speechTimeout);
            speechTimeout = null;
        }
        
        // UI 즉시 업데이트
        this.updateRecordingUI(false);
        
        console.log('음성 인식 중지 완료');
    },
    
    // 강제 음성 인식 중지 (중복 실행 방지용)
    forceStopRecording() {
        console.log('음성 인식 강제 중지');
        
        isRecording = false;
        speechRestartCount = 0;
        
        // Keep-alive 중지
        stopSpeechKeepAlive();
        
        if (speechRecognition) {
            try {
                speechRecognition.stop();
            } catch (e) {
                console.log('강제 중지 중 오류 (무시):', e.message);
            }
        }
        
        if (speechTimeout) {
            clearTimeout(speechTimeout);
            speechTimeout = null;
        }
        
        this.updateRecordingUI(false);
    },
    
    // 녹음 UI 업데이트
    updateRecordingUI(recording) {
        const recordBtn = document.getElementById('record-btn');
        const recordingIndicator = document.getElementById('recording-indicator');
        
        if (recordBtn) {
            if (recording) {
                recordBtn.textContent = '🛑 녹음 중지';
                recordBtn.style.background = '#f56565';
                recordBtn.style.color = 'white';
            } else {
                recordBtn.textContent = '🎤 음성 녹음 시작';
                recordBtn.style.background = '';
                recordBtn.style.color = '';
            }
        }
        
        if (recordingIndicator) {
            recordingIndicator.style.display = recording ? 'block' : 'none';
        }
    },
    
    // 인식된 텍스트 UI 업데이트
    updateRecognizedText(finalText, interimText) {
        const recognizedDisplay = document.getElementById('recognized-text');
        
        if (!recognizedDisplay) {
            console.error('recognized-text 요소를 찾을 수 없습니다.');
            return;
        }
        
        // 안전한 문자열 변환 및 기본값 설정
        const safeFinalText = (finalText && typeof finalText === 'string') ? finalText : '';
        const safeInterimText = (interimText && typeof interimText === 'string') ? interimText : '';
        
        let displayText = safeFinalText;
        if (safeInterimText && safeInterimText.trim()) {
            displayText += `<span style="color: #999; font-style: italic;">${safeInterimText}</span>`;
        }
        
        if (displayText && displayText.trim()) {
            recognizedDisplay.innerHTML = displayText;
            recognizedDisplay.style.color = '#333';
        } else {
            recognizedDisplay.innerHTML = '<span style="color: #ccc;">인식된 텍스트가 여기에 표시됩니다...</span>';
        }
        
        console.log('텍스트 업데이트:', { 
            originalFinalText: finalText, 
            originalInterimText: interimText,
            safeFinalText, 
            safeInterimText, 
            displayText 
        });
    },
    
    // 마이크 테스트 기능
    testMicrophone() {
        navigator.mediaDevices.getUserMedia({ audio: true })
            .then(stream => {
                console.log('마이크 테스트 성공');
                showNotification('마이크가 정상적으로 작동합니다!', 'success');
                
                // 간단한 오디오 레벨 테스트
                const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                const analyser = audioContext.createAnalyser();
                const microphone = audioContext.createMediaStreamSource(stream);
                
                microphone.connect(analyser);
                analyser.fftSize = 256;
                
                const bufferLength = analyser.frequencyBinCount;
                const dataArray = new Uint8Array(bufferLength);
                
                const checkAudioLevel = () => {
                    analyser.getByteFrequencyData(dataArray);
                    const average = dataArray.reduce((sum, value) => sum + value, 0) / bufferLength;
                    
                    if (average > 10) {
                        console.log('음성 입력 감지됨:', average);
                        showNotification('음성 입력이 감지되었습니다!', 'success');
                        stream.getTracks().forEach(track => track.stop());
                        return;
                    }
                };
                
                // 3초 동안 테스트
                const testInterval = setInterval(checkAudioLevel, 100);
                setTimeout(() => {
                    clearInterval(testInterval);
                    stream.getTracks().forEach(track => track.stop());
                    showNotification('마이크 테스트가 완료되었습니다.', 'info');
                }, 3000);
            })
            .catch(err => {
                console.error('마이크 테스트 실패:', err);
                showNotification('마이크 테스트 실패: ' + err.message, 'error');
            });
    },
    
    // 음성 인식 상태 확인 및 재시작
    checkAndRestartIfNeeded() {
        console.log('음성 인식 상태 확인 중...');
        
        if (!isRecording) {
            console.log('녹음 중이 아님 - 확인 완료');
            return;
        }
        
        // 음성 인식이 실제로 작동하는지 확인하기 어려우므로
        // 일정 시간 후 예방적 재시작
        const now = Date.now();
        const timeSinceLastActivity = now - lastSpeechActivity;
        
        if (timeSinceLastActivity > 60000) { // 60초 이상 활동 없음 (매우 관대한 조건)
            console.log('매우 장시간 비활성 감지 - 예방적 재시작');
            this.restartSpeechRecognition();
        }
    },
    
    // 음성 인식 강제 재시작
    restartSpeechRecognition() {
        if (!isRecording) {
            console.log('녹음 중이 아님 - 재시작 건너뛰기');
            return;
        }
        
        console.log('음성 인식 강제 재시작 시작');
        
        // 현재 인식 중지
        if (speechRecognition) {
            try {
                speechRecognition.stop();
            } catch (e) {
                console.log('재시작을 위한 중지 중 오류 (무시):', e.message);
            }
        }
        
        // 잠시 후 재시작
        setTimeout(() => {
            if (isRecording) {
                try {
                    console.log('강제 재시작 실행');
                    speechRecognition.start();
                    lastSpeechActivity = Date.now(); // 활동 시간 리셋
                    showNotification('🔄 음성 인식이 재시작되었습니다', 'info');
                } catch (error) {
                    console.error('강제 재시작 실패:', error);
                    if (!error.message.includes('already started')) {
                        showNotification('음성 인식 재시작에 실패했습니다. 다시 시도해주세요.', 'error');
                    }
                }
            }
        }, 500);
    }
};

// CSS 애니메이션을 동적으로 추가
if (!document.querySelector('#confetti-style')) {
    const style = document.createElement('style');
    style.id = 'confetti-style';
    style.textContent = `
        @keyframes confettiFall {
            to {
                transform: translateY(100vh) rotate(360deg);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);
}

// 배경 음악 제어 (개선)
function toggleBackgroundMusic() {
    try {
        const bgMusic = document.getElementById('bgMusic');
        if (bgMusic) {
            if (bgMusic.paused) {
                bgMusic.play().catch(e => {
                    console.log('Background music play failed:', e);
                    showNotification('배경음악 파일을 찾을 수 없습니다', 'info');
                });
            } else {
                bgMusic.pause();
            }
        } else {
            showNotification('배경음악이 설정되지 않았습니다', 'info');
        }
    } catch (error) {
        console.log('Background music error:', error);
        showNotification('배경음악 재생 중 오류가 발생했습니다', 'error');
    }
}

// 하이브리드 데이터베이스 관리자 (Firebase + LocalDB 자동 전환)
const HybridDB = {
    // 사용할 데이터베이스 결정
    getActiveDB() {
        return window.firebaseInitialized && window.FirebaseDB ? window.FirebaseDB : LocalDB;
    },

    // 연결 상태 확인
    isFirebaseActive() {
        return window.firebaseInitialized && window.FirebaseDB;
    },

    // 교회 초기화
    async initializeChurch(churchName, adminPassword) {
        showNotification('서버에 연결 중...', 'info');
        
        if (this.isFirebaseActive()) {
            console.log('🔥 Firebase로 교회 초기화 시도');
            return await window.FirebaseDB.initializeChurch(churchName, adminPassword);
        } else {
            console.log('💾 로컬 스토리지로 교회 초기화');
            return LocalDB.initializeChurch(churchName, adminPassword);
        }
    },

    // 교회 존재 확인
    async churchExists(churchName) {
        if (this.isFirebaseActive()) {
            return await window.FirebaseDB.churchExists(churchName);
        } else {
            return LocalDB.churchExists(churchName);
        }
    },

    // 말씀 추가
    async addVerse(churchName, verseData) {
        showNotification('말씀을 저장하는 중...', 'info');
        
        if (this.isFirebaseActive()) {
            console.log('🔥 Firebase에 말씀 저장');
            return await window.FirebaseDB.addVerse(churchName, verseData);
        } else {
            console.log('💾 로컬 스토리지에 말씀 저장');
            return LocalDB.addVerse(churchName, verseData);
        }
    },

    // 말씀 목록 가져오기
    async getVerses(churchName) {
        if (this.isFirebaseActive()) {
            console.log('🔥 Firebase에서 말씀 조회');
            return await window.FirebaseDB.getVerses(churchName);
        } else {
            console.log('💾 로컬 스토리지에서 말씀 조회');
            return LocalDB.getVerses(churchName);
        }
    },

    // 말씀 삭제
    async deleteVerse(churchName, verseId) {
        showNotification('말씀을 삭제하는 중...', 'info');
        
        if (this.isFirebaseActive()) {
            console.log('🔥 Firebase에서 말씀 삭제');
            return await window.FirebaseDB.deleteVerse(churchName, verseId);
        } else {
            console.log('💾 로컬 스토리지에서 말씀 삭제');
            const data = LocalDB.getData();
            delete data.churches[churchName].verses[verseId];
            LocalDB.saveData(data);
            return { success: true };
        }
    },

    // 학생 점수 저장
    async saveStudentScore(churchName, studentName, verseId, level, score) {
        if (this.isFirebaseActive()) {
            console.log('🔥 Firebase에 점수 저장');
            return await window.FirebaseDB.saveStudentScore(churchName, studentName, verseId, level, score);
        } else {
            console.log('💾 로컬 스토리지에 점수 저장');
            return LocalDB.saveStudentScore(churchName, studentName, verseId, level, score);
        }
    },

    // 학생 목록 가져오기
    async getStudents(churchName) {
        if (this.isFirebaseActive()) {
            return await window.FirebaseDB.getStudents(churchName);
        } else {
            return LocalDB.getStudents(churchName);
        }
    },

    // 랭킹 가져오기
    async getRankings(churchName) {
        if (this.isFirebaseActive()) {
            return await window.FirebaseDB.getRankings(churchName);
        } else {
            return LocalDB.getRankings(churchName);
        }
    },

    // 말씀별 랭킹 가져오기
    async getVerseRankings(churchName) {
        if (this.isFirebaseActive()) {
            return await window.FirebaseDB.getVerseRankings(churchName);
        } else {
            return LocalDB.getVerseRankings(churchName);
        }
    },

    // 특정 말씀의 학생 점수 가져오기
    async getVerseStudentScores(churchName, verseId) {
        if (this.isFirebaseActive()) {
            return await window.FirebaseDB.getVerseStudentScores(churchName, verseId);
        } else {
            return LocalDB.getVerseStudentScores(churchName, verseId);
        }
    }
};

// 로컬 데이터베이스 시뮬레이션 (폴백용)
const LocalDB = {
    // 로컬 스토리지 키
    CHURCHES_KEY: 'bible_game_churches',
    
    // 데이터 가져오기
    getData() {
        const data = localStorage.getItem(this.CHURCHES_KEY);
        return data ? JSON.parse(data) : { churches: {} };
    },
    
    // 데이터 저장
    saveData(data) {
        localStorage.setItem(this.CHURCHES_KEY, JSON.stringify(data));
    },
    
    // 교회 초기화
    initializeChurch(churchName, adminPassword) {
        const data = this.getData();
        
        if (!data.churches[churchName]) {
            data.churches[churchName] = {
                admin_password: adminPassword,
                verses: {},
                students: {},
                rankings: {},
                createdAt: Date.now()
            };
            this.saveData(data);
            return { success: true, isNew: true };
        } else {
            const church = data.churches[churchName];
            if (church.admin_password === adminPassword) {
                return { success: true, isNew: false };
            } else {
                return { success: false, error: '비밀번호가 올바르지 않습니다.' };
            }
        }
    },
    
    // 교회 존재 확인
    churchExists(churchName) {
        const data = this.getData();
        return !!data.churches[churchName];
    },
    
    // 말씀 추가 (레벨 구분 없이 하나의 말씀으로)
    addVerse(churchName, verseData) {
        const data = this.getData();
        const verseId = Date.now().toString();
        
        data.churches[churchName].verses[verseId] = {
            ...verseData,
            id: verseId,
            createdAt: Date.now()
        };
        
        this.saveData(data);
        return { success: true, id: verseId };
    },
    
    // 말씀 목록 가져오기 (모든 말씀)
    getVerses(churchName) {
        const data = this.getData();
        const church = data.churches[churchName];
        
        if (!church) return [];
        
        return Object.values(church.verses);
    },
    
    // 학생 점수 저장
    saveStudentScore(churchName, studentName, verseId, level, score) {
        const data = this.getData();
        const church = data.churches[churchName];
        
        if (!church.students[studentName]) {
            church.students[studentName] = {
                name: studentName,
                scores: {},
                totalScore: 0,
                gamesPlayed: 0,
                lastPlayed: Date.now()
            };
        }
        
        const student = church.students[studentName];
        
        // 말씀별 점수 저장
        if (!student.scores[verseId]) {
            student.scores[verseId] = {
                level1: 0,
                level2: 0,
                level3: 0,
                completed: false
            };
        }
        
        student.scores[verseId][`level${level}`] = score;
        student.gamesPlayed += 1;
        student.lastPlayed = Date.now();
        
        // 레벨 3까지 완료했는지 확인
        if (level === 3) {
            student.scores[verseId].completed = true;
        }
        
        // 총점 계산
        student.totalScore = 0;
        Object.values(student.scores).forEach(verseScores => {
            if (typeof verseScores === 'object' && verseScores.level1 !== undefined) {
                student.totalScore += verseScores.level1 + verseScores.level2 + verseScores.level3;
            }
        });
        
        // 랭킹 업데이트
        const averageScore = student.totalScore / student.gamesPlayed;
        church.rankings[studentName] = {
            name: studentName,
            totalScore: student.totalScore,
            gamesPlayed: student.gamesPlayed,
            averageScore: Math.round(averageScore * 10) / 10,
            lastPlayed: student.lastPlayed
        };
        
        this.saveData(data);
        return { success: true };
    },
    
    // 학생 목록 가져오기
    getStudents(churchName) {
        const data = this.getData();
        const church = data.churches[churchName];
        return church ? Object.values(church.students) : [];
    },
    
    // 랭킹 가져오기
    getRankings(churchName) {
        const data = this.getData();
        const church = data.churches[churchName];
        
        if (!church) return [];
        
        const rankings = Object.values(church.rankings);
        return rankings.sort((a, b) => b.totalScore - a.totalScore);
    },

    // 말씀별 랭킹 가져오기 (말씀 목록과 통계)
    getVerseRankings(churchName) {
        const data = this.getData();
        const church = data.churches[churchName];
        
        if (!church) return [];
        
        const verses = Object.values(church.verses);
        const students = Object.values(church.students);
        
        return verses.map(verse => {
            // 이 말씀을 플레이한 학생들의 점수 수집
            const playedStudents = students.filter(student => 
                student.scores && student.scores[verse.id]
            );
            
            const totalScores = playedStudents.map(student => {
                const verseScores = student.scores[verse.id];
                return (verseScores.level1 || 0) + (verseScores.level2 || 0) + (verseScores.level3 || 0);
            });
            
            const averageScore = totalScores.length > 0 ? 
                Math.round(totalScores.reduce((sum, score) => sum + score, 0) / totalScores.length) : 0;
            
            return {
                verseId: verse.id,
                verseReference: verse.reference,
                verseText: verse.text,
                playersCount: playedStudents.length,
                averageScore: averageScore,
                maxScore: totalScores.length > 0 ? Math.max(...totalScores) : 0
            };
        });
    },

    // 특정 말씀의 학생 점수 가져오기
    getVerseStudentScores(churchName, verseId) {
        const data = this.getData();
        const church = data.churches[churchName];
        
        if (!church) return [];
        
        const students = Object.values(church.students);
        const verse = church.verses[verseId];
        
        if (!verse) return [];
        
        const studentScores = students
            .filter(student => student.scores && student.scores[verseId])
            .map(student => {
                const verseScores = student.scores[verseId];
                const level1 = verseScores.level1 || 0;
                const level2 = verseScores.level2 || 0;
                const level3 = verseScores.level3 || 0;
                const totalScore = level1 + level2 + level3;
                
                return {
                    studentName: student.name,
                    level1Score: level1,
                    level2Score: level2,
                    level3Score: level3,
                    totalScore: totalScore,
                    completed: verseScores.completed || false
                };
            })
            .sort((a, b) => b.totalScore - a.totalScore);
        
        return studentScores;
    }
};

// 게임 로직
const GameLogic = {
    // 말씀에서 레벨별 빈칸 생성
    createBlanks(text, level) {
        const words = text.split(' ');
        console.log(`\n=== 레벨 ${level} 빈칸 생성 시작 ===`);
        console.log(`전체 단어 수: ${words.length}`);
        console.log(`전체 말씀: "${text}"`);
        
        // 레벨별 빈칸 비율 (매우 극명한 차이)
        const blankRatios = {
            1: 0.08,  // 8% 빈칸 (매우 쉬움 - 거의 모두 보임)
            2: 0.35,  // 35% 빈칸 (보통 - 1/3 빈칸)
            3: 0.65   // 65% 빈칸 (매우 어려움 - 대부분 빈칸)
        };
        
        // 레벨별 빈칸 수 계산 (최대 개수 제한 추가)
        let blanksCount;
        if (level === 1) {
            blanksCount = Math.max(1, Math.floor(words.length * blankRatios[level]));
            // 레벨 1: 최대 3개 빈칸으로 제한 (초보자용)
            blanksCount = Math.min(blanksCount, 3);
        } else if (level === 2) {
            blanksCount = Math.max(2, Math.ceil(words.length * blankRatios[level]));
            // 레벨 2: 최대 5개 빈칸으로 제한
            blanksCount = Math.min(blanksCount, 5);
        } else {
            blanksCount = Math.max(3, Math.ceil(words.length * blankRatios[level]));
            // 레벨 3: 최대 10개 빈칸으로 제한
            blanksCount = Math.min(blanksCount, 10);
        }
        
        // 전체 단어 수를 넘지 않도록 제한
        blanksCount = Math.min(blanksCount, words.length);
        
        console.log(`목표 빈칸 수: ${blanksCount} (${Math.round(blankRatios[level] * 100)}%)`);
        
        const blankIndices = [];
        
        if (level === 1) {
            // 레벨 1: 초보자 - 가장 핵심적인 단어만 1-2개 빈칸
            console.log("레벨 1: 핵심 단어 1-2개만 빈칸으로 선택");
            
            const veryImportantWords = ['하나님', '예수', '그리스도', '사랑', '독생자', '영생', '구원', '믿음', '은혜', '십자가'];
            
            // 가장 중요한 단어들만 선택 (최대 2개)
            const maxBlanks = Math.min(2, blanksCount);
            let selectedCount = 0;
            
            for (let i = 0; i < words.length && selectedCount < maxBlanks; i++) {
                const word = words[i];
                if (veryImportantWords.some(important => word.includes(important))) {
                    blankIndices.push(i);
                    selectedCount++;
                    console.log(`✓ 핵심단어 선택: "${word}" (위치: ${i})`);
                }
            }
            
            // 부족하면 가장 긴 단어 1개 추가
            if (selectedCount < maxBlanks) {
                const longWords = words.map((word, index) => ({ word, index, length: word.length }))
                    .filter(item => item.length >= 4 && !blankIndices.includes(item.index))
                    .sort((a, b) => b.length - a.length);
                
                if (longWords.length > 0) {
                    blankIndices.push(longWords[0].index);
                    console.log(`✓ 긴단어 추가: "${longWords[0].word}" (위치: ${longWords[0].index})`);
                }
            }
            
        } else if (level === 2) {
            // 레벨 2: 중급자 - 적당한 수의 다양한 단어들
            console.log("레벨 2: 다양한 단어들을 적당히 선택");
            
            const eligibleWords = words.map((word, index) => ({ word, index }))
                .filter(item => item.word.length >= 2 && !['이', '을', '를', '가', '는', '에', '의', '와', '과', '로'].includes(item.word));
            
            console.log(`적격 단어들: ${eligibleWords.map(w => w.word).join(', ')}`);
            
            // 간단한 방법: 적격 단어들을 셔플해서 필요한 만큼 선택
            const shuffledWords = eligibleWords.sort(() => Math.random() - 0.5);
            const selectedWords = shuffledWords.slice(0, Math.min(blanksCount, eligibleWords.length));
            
            console.log(`선택된 단어들: ${selectedWords.map(w => w.word).join(', ')}`);
            
            selectedWords.forEach(item => {
                blankIndices.push(item.index);
                console.log(`✓ 선택: "${item.word}" (길이: ${item.word.length}, 위치: ${item.index})`);
            });
            
        } else {
            // 레벨 3: 고급자 - 많은 단어를 빈칸으로 (최대 10개 제한)
            console.log("레벨 3: 많은 단어를 빈칸으로 선택 (최대 10개)");
            
            const excludeWords = ['이', '을', '를', '가', '는', '에', '의', '와', '과', '로', '에서', '으로', '도', '만', '까지', '부터'];
            
            // 조사가 아닌 단어들 수집
            const eligibleWords = [];
            for (let i = 0; i < words.length; i++) {
                const word = words[i];
                if (!excludeWords.includes(word) && word.length >= 1) {
                    eligibleWords.push({ word, index: i });
                }
            }
            
            console.log(`적격 단어들: ${eligibleWords.map(w => w.word).join(', ')}`);
            
            // 설정된 빈칸 수만큼만 랜덤 선택
            const shuffledWords = eligibleWords.sort(() => Math.random() - 0.5);
            const selectedWords = shuffledWords.slice(0, Math.min(blanksCount, eligibleWords.length));
            
            console.log(`선택된 단어들: ${selectedWords.map(w => w.word).join(', ')}`);
            
            selectedWords.forEach(item => {
                blankIndices.push(item.index);
                console.log(`✓ 선택: "${item.word}" (위치: ${item.index})`);
            });
        }
        
        console.log(`최종 빈칸 개수: ${blankIndices.length}`);
        console.log(`빈칸 비율: ${Math.round((blankIndices.length / words.length) * 100)}%`);
        
        const blanks = [];
        const wordsWithBlanks = words.map((word, index) => {
            if (blankIndices.includes(index)) {
                blanks.push({
                    word: word,
                    index: index,
                    filled: false
                });
                return `<span class="blank" data-index="${index}" data-answer="${word}"></span>`;
            }
            return word;
        });
        
        console.log(`결과 미리보기: ${wordsWithBlanks.join(' ')}`);
        console.log("=== 빈칸 생성 완료 ===\n");
        
        return {
            textWithBlanks: wordsWithBlanks.join(' '),
            blanks: blanks,
            correctAnswers: blanks.map(b => b.word),
            level: level,
            totalWords: words.length,
            blankCount: blankIndices.length
        };
    },

    // 선택지 생성 (정답 + 오답) - 레벨별 차이 강화
    generateOptions(correctAnswers, allVerses, level) {
        const options = [...correctAnswers];
        const distractors = [];
        
        // 다른 말씀에서 오답 생성
        allVerses.forEach(verse => {
            const words = verse.text.split(' ');
            words.forEach(word => {
                if (word.length > 1 && !options.includes(word) && !distractors.includes(word)) {
                    distractors.push(word);
                }
            });
        });
        
        // 레벨별 선택지 개수 (매우 극명한 차이)
        const optionCounts = {
            1: Math.min(6, correctAnswers.length + 3),   // 레벨 1: 6개 선택지 (쉬움)
            2: Math.min(12, correctAnswers.length + 6),  // 레벨 2: 12개 선택지 (보통)
            3: Math.min(20, correctAnswers.length + 10), // 레벨 3: 20개 선택지 (어려움)
            4: 0  // 레벨 4: 음성 암송 (선택지 없음)
        };
        
        const targetCount = optionCounts[level];
        const distractorCount = targetCount - correctAnswers.length;
        
        console.log(`레벨 ${level} 선택지: 정답 ${correctAnswers.length}개 + 오답 ${distractorCount}개 = 총 ${targetCount}개`);
        
        // 레벨별 오답 선택 전략
        if (level === 1) {
            // 레벨 1: 길이가 비슷한 쉬운 오답들
            const easyDistractors = distractors.filter(word => 
                correctAnswers.some(correct => Math.abs(word.length - correct.length) <= 1)
            );
            for (let i = 0; i < Math.min(distractorCount, easyDistractors.length); i++) {
                const randomIndex = Math.floor(Math.random() * easyDistractors.length);
                options.push(easyDistractors.splice(randomIndex, 1)[0]);
            }
        } else if (level === 2) {
            // 레벨 2: 다양한 길이의 오답들
            const shuffledDistractors = [...distractors].sort(() => Math.random() - 0.5);
            for (let i = 0; i < Math.min(distractorCount, shuffledDistractors.length); i++) {
                options.push(shuffledDistractors[i]);
            }
        } else {
            // 레벨 3: 모든 오답 포함 (매우 어려움)
            const allDistractors = [...distractors].sort(() => Math.random() - 0.5);
            for (let i = 0; i < Math.min(distractorCount, allDistractors.length); i++) {
                options.push(allDistractors[i]);
            }
        }
        
        // 옵션 섞기
        const shuffledOptions = options.sort(() => Math.random() - 0.5);
        console.log(`최종 선택지: [${shuffledOptions.join(', ')}]`);
        
        return shuffledOptions;
    },

    // 점수 계산 (레벨별 가중치 강화)
    calculateScore(correctCount, totalCount, level) {
        const baseScore = Math.round((correctCount / totalCount) * 100);
        const levelMultiplier = {
            1: 1.0,  // 레벨 1: 기본 점수
            2: 1.5,  // 레벨 2: 1.5배
            3: 2.0,  // 레벨 3: 2배
            4: 3.0   // 레벨 4: 3배 (음성 암송 최고 배율)
        };
        
        const finalScore = Math.round(baseScore * levelMultiplier[level]);
        console.log(`점수 계산: ${correctCount}/${totalCount} = ${baseScore}점 × ${levelMultiplier[level]} = ${finalScore}점`);
        
        return Math.max(0, finalScore);
    },

    // 음성 인식 정확도 계산
    calculateSpeechAccuracy(originalText, recognizedText) {
        // 텍스트 정규화 (공백, 문장부호 제거, 소문자 변환)
        const normalize = (text) => {
            return text.replace(/[^\w\s가-힣]/g, '')  // 특수문자 제거
                      .replace(/\s+/g, ' ')           // 연속 공백을 하나로
                      .trim()                         // 앞뒤 공백 제거
                      .toLowerCase();                 // 소문자 변환
        };
        
        const original = normalize(originalText);
        const recognized = normalize(recognizedText);
        
        // Levenshtein Distance 계산
        const distance = this.levenshteinDistance(original, recognized);
        const maxLength = Math.max(original.length, recognized.length);
        
        // 정확도 계산 (0-100%)
        const accuracy = maxLength === 0 ? 100 : Math.round((1 - distance / maxLength) * 100);
        
        console.log('음성 인식 정확도 계산:', {
            original: original,
            recognized: recognized,
            distance: distance,
            accuracy: accuracy
        });
        
        return Math.max(0, Math.min(100, accuracy));
    },

    // Levenshtein Distance 계산 (문자열 유사도)
    levenshteinDistance(str1, str2) {
        const matrix = [];
        
        for (let i = 0; i <= str2.length; i++) {
            matrix[i] = [i];
        }
        
        for (let j = 0; j <= str1.length; j++) {
            matrix[0][j] = j;
        }
        
        for (let i = 1; i <= str2.length; i++) {
            for (let j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1, // substitution
                        matrix[i][j - 1] + 1,     // insertion
                        matrix[i - 1][j] + 1      // deletion
                    );
                }
            }
        }
        
        return matrix[str2.length][str1.length];
    }
};

// UI 관리자
const UIManager = {
    // 관리자 대시보드 렌더링
    renderAdminDashboard() {
        document.getElementById('admin-church-name').textContent = `${currentChurch} 교회`;
        
        // 초기 탭 활성화
        this.showTab('verses');
        this.loadVerses();
    },

    // 탭 전환
    showTab(tabName) {
        // 탭 버튼 활성화
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        
        // 탭 내용 표시
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`${tabName}-tab`).classList.add('active');
        
        // 탭별 데이터 로드
        switch(tabName) {
            case 'verses':
                this.loadVerses();
                break;
            case 'students':
                this.loadStudents();
                break;
            case 'rankings':
                // 랭킹 탭 기본 상태 설정
                document.getElementById('overall-ranking-btn').classList.add('active');
                document.getElementById('verse-ranking-btn').classList.remove('active');
                document.getElementById('overall-rankings').classList.add('active');
                document.getElementById('verse-rankings').classList.remove('active');
                
                // 말씀별 랭킹 상세 화면 초기화
                document.getElementById('verse-ranking-details').style.display = 'none';
                document.getElementById('verse-ranking-selector').style.display = 'block';
                
                this.loadRankings();
                break;
        }
    },

    // 말씀 목록 로드
    async loadVerses() {
        const container = document.getElementById('verses-list');
        showLoading(container);
        
        try {
            const verses = await HybridDB.getVerses(currentChurch);
            
            if (verses.length === 0) {
                container.innerHTML = `
                    <div style="text-align: center; padding: 40px; color: #666;">
                        <p>아직 등록된 말씀이 없습니다.</p>
                        <p>새 말씀을 추가해보세요!</p>
                    </div>
                `;
                return;
            }
            
            container.innerHTML = verses.map(verse => `
                <div class="verse-card">
                    <div class="verse-header">
                        <span class="verse-reference">${verse.reference}</span>
                        <span class="verse-level">3단계 게임</span>
                    </div>
                    <div class="verse-text">${verse.text}</div>
                    <div class="verse-actions">
                        <button class="btn btn-small btn-secondary" onclick="UIManager.deleteVerse('${verse.id}')">삭제</button>
                    </div>
                </div>
            `).join('');
        } catch (error) {
            console.error('말씀 로드 오류:', error);
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #e74c3c;">
                    <p>말씀 목록을 불러오는 중 오류가 발생했습니다.</p>
                </div>
            `;
        }
    },

    // 말씀 삭제
    async deleteVerse(verseId) {
        if (confirm('정말로 이 말씀을 삭제하시겠습니까?')) {
            try {
                const result = await HybridDB.deleteVerse(currentChurch, verseId);
                if (result.success) {
                    this.loadVerses();
                    showNotification('말씀이 삭제되었습니다.', 'success');
                } else {
                    showNotification(result.error || '말씀 삭제에 실패했습니다.', 'error');
                }
            } catch (error) {
                console.error('말씀 삭제 오류:', error);
                showNotification('말씀 삭제 중 오류가 발생했습니다.', 'error');
            }
        }
    },

    // 학생 목록 로드
    async loadStudents() {
        const container = document.getElementById('students-list');
        showLoading(container);
        
        try {
            const students = await HybridDB.getStudents(currentChurch);
            
            if (students.length === 0) {
                container.innerHTML = `
                    <div style="text-align: center; padding: 40px; color: #666;">
                        <p>아직 게임을 한 학생이 없습니다.</p>
                    </div>
                `;
                return;
            }
            
            container.innerHTML = students.map(student => {
                const avgScore = student.gamesPlayed > 0 ? Math.round((student.totalScore / student.gamesPlayed) * 10) / 10 : 0;
                
                // 완료한 말씀 개수 계산
                const completedVerses = Object.values(student.scores).filter(score => 
                    typeof score === 'object' && score.completed
                ).length;
                
                return `
                    <div class="student-card">
                        <div class="student-header">
                            <span class="student-name">${student.name}</span>
                            <span class="stat-item">총 ${student.gamesPlayed}게임</span>
                        </div>
                        <div class="student-stats">
                            <div class="stat-item">총점: ${student.totalScore}점</div>
                            <div class="stat-item">평균: ${avgScore}점</div>
                            <div class="stat-item">완료한 말씀: ${completedVerses}개</div>
                            <div class="stat-item">최근: ${new Date(student.lastPlayed).toLocaleDateString()}</div>
                        </div>
                    </div>
                `;
            }).join('');
        } catch (error) {
            console.error('학생 로드 오류:', error);
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #e74c3c;">
                    <p>학생 목록을 불러오는 중 오류가 발생했습니다.</p>
                </div>
            `;
        }
    },

    // 랭킹 로드
    async loadRankings() {
        const container = document.getElementById('rankings-list');
        showLoading(container);
        
        try {
            const rankings = await HybridDB.getRankings(currentChurch);
            
            if (rankings.length === 0) {
                container.innerHTML = `
                    <div style="text-align: center; padding: 40px; color: #666;">
                        <p>아직 랭킹 데이터가 없습니다.</p>
                    </div>
                `;
                return;
            }
            
            container.innerHTML = rankings.map((student, index) => {
                let positionClass = '';
                if (index === 0) positionClass = 'first';
                else if (index === 1) positionClass = 'second';
                else if (index === 2) positionClass = 'third';
                
                return `
                    <div class="ranking-card">
                        <div class="ranking-header">
                            <span class="ranking-name">${student.name}</span>
                            <span class="ranking-position ${positionClass}">${index + 1}위</span>
                        </div>
                        <div class="ranking-stats">
                            <div class="stat-item">총점: ${student.totalScore}점</div>
                            <div class="stat-item">평균: ${student.averageScore}점</div>
                            <div class="stat-item">게임 횟수: ${student.gamesPlayed}회</div>
                        </div>
                    </div>
                `;
            }).join('');
        } catch (error) {
            console.error('랭킹 로드 오류:', error);
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #e74c3c;">
                    <p>랭킹을 불러오는 중 오류가 발생했습니다.</p>
                </div>
            `;
        }
    },

    // 말씀별 랭킹 로드
    async loadVerseRankings() {
        const container = document.getElementById('verse-ranking-list');
        showLoading(container);
        
        try {
            const verseRankings = await HybridDB.getVerseRankings(currentChurch);
            
            if (verseRankings.length === 0) {
                container.innerHTML = `
                    <div class="empty-verse-ranking">
                        <h5>등록된 말씀이 없습니다</h5>
                        <p>먼저 말씀을 등록해주세요.</p>
                    </div>
                `;
                return;
            }
            
            container.innerHTML = verseRankings.map(verse => {
                return `
                    <div class="verse-ranking-item" data-verse-id="${verse.verseId}">
                        <div class="verse-ranking-item-content">
                            <h5>${verse.verseReference}</h5>
                            <p>${verse.verseText.substring(0, 100)}${verse.verseText.length > 100 ? '...' : ''}</p>
                        </div>
                        <div class="verse-ranking-stats">
                            <div class="verse-stat-item players">
                                👥 ${verse.playersCount}명
                            </div>
                            <div class="verse-stat-item average">
                                📊 평균 ${verse.averageScore}점
                            </div>
                            ${verse.maxScore > 0 ? `<div class="verse-stat-item">🏆 최고 ${verse.maxScore}점</div>` : ''}
                        </div>
                    </div>
                `;
            }).join('');
        } catch (error) {
            console.error('말씀별 랭킹 로드 오류:', error);
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #e74c3c;">
                    <p>말씀별 랭킹을 불러오는 중 오류가 발생했습니다.</p>
                </div>
            `;
        }
    },

    // 특정 말씀의 학생 점수 로드
    async loadVerseStudentScores(verseId, verseReference) {
        const container = document.getElementById('verse-ranking-content');
        showLoading(container);
        
        try {
            const studentScores = await HybridDB.getVerseStudentScores(currentChurch, verseId);
            
            if (studentScores.length === 0) {
                container.innerHTML = `
                    <div class="empty-verse-ranking">
                        <h5>아직 이 말씀을 플레이한 학생이 없습니다</h5>
                        <p>학생들이 게임을 플레이하면 랭킹이 표시됩니다.</p>
                    </div>
                `;
                return;
            }
            
            container.innerHTML = studentScores.map((student, index) => {
                let cardClass = '';
                if (index === 0) cardClass = 'top-performer';
                else if (student.totalScore >= 200) cardClass = 'high-performer';
                else if (student.totalScore < 100) cardClass = 'needs-improvement';
                
                const completionRate = student.completed ? '완료' : '진행중';
                const level1Class = student.level1Score > 0 ? 'completed' : 'not-attempted';
                const level2Class = student.level2Score > 0 ? 'completed' : (student.level1Score > 0 ? 'incomplete' : 'not-attempted');
                const level3Class = student.level3Score > 0 ? 'completed' : (student.level2Score > 0 ? 'incomplete' : 'not-attempted');
                
                return `
                    <div class="verse-student-card ${cardClass}">
                        <div class="verse-student-header">
                            <span class="verse-student-name">${student.studentName}</span>
                            <span class="verse-total-score">${student.totalScore}점</span>
                        </div>
                        <div class="verse-level-scores">
                            <div class="verse-level-score ${level1Class}">
                                레벨1: ${student.level1Score || 0}점
                            </div>
                            <div class="verse-level-score ${level2Class}">
                                레벨2: ${student.level2Score || 0}점
                            </div>
                            <div class="verse-level-score ${level3Class}">
                                레벨3: ${student.level3Score || 0}점
                            </div>
                            <div class="verse-level-score ${student.completed ? 'completed' : 'incomplete'}">
                                상태: ${completionRate}
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        } catch (error) {
            console.error('말씀별 학생 점수 로드 오류:', error);
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #e74c3c;">
                    <p>학생 점수를 불러오는 중 오류가 발생했습니다.</p>
                </div>
            `;
        }
    },

    // 게임 화면 초기화
    initGameScreen() {
        document.getElementById('player-name').textContent = currentUser;
        document.getElementById('player-church').textContent = currentChurch + ' 교회';
        
        // 말씀 선택 화면 표시
        this.showVerseSelection();
    },

    // 말씀 선택 화면 표시
    async showVerseSelection() {
        try {
            const verses = await HybridDB.getVerses(currentChurch);
            
            if (verses.length === 0) {
                showNotification('등록된 말씀이 없습니다.', 'error');
                return;
            }
            
            const levelSelector = document.querySelector('.level-selector');
            levelSelector.innerHTML = `
                <h3>암송할 말씀을 선택하세요</h3>
                <div class="verse-selection">
                    ${verses.map(verse => `
                        <div class="verse-option" data-verse-id="${verse.id}">
                            <h4>${verse.reference}</h4>
                            <p>${verse.text.substring(0, 100)}${verse.text.length > 100 ? '...' : ''}</p>
                            <div class="level-progress">
                                <span class="level-indicator" data-level="1">1단계</span>
                                <span class="level-indicator" data-level="2">2단계</span>
                                <span class="level-indicator" data-level="3">3단계</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
            
            // 말씀 선택 이벤트 리스너
            document.querySelectorAll('.verse-option').forEach(option => {
                option.addEventListener('click', (e) => {
                    const verseId = e.currentTarget.dataset.verseId;
                    const verse = verses.find(v => v.id === verseId);
                    if (verse) {
                        currentVerse = verse;
                        this.showLevelSelection();
                    }
                });
            });
            
            levelSelector.style.display = 'block';
            document.getElementById('game-content').style.display = 'none';
            document.getElementById('level-complete').style.display = 'none';
        } catch (error) {
            console.error('말씀 선택 화면 오류:', error);
            showNotification('말씀 목록을 불러오는 중 오류가 발생했습니다.', 'error');
        }
    },

    // 레벨 선택 화면 표시
    showLevelSelection() {
        const levelSelector = document.querySelector('.level-selector');
        
        // 각 레벨의 예상 난이도 계산 (최대 개수 제한 반영)
        const wordCount = currentVerse.text.split(' ').length;
        const levelPreviews = {
            1: {
                blanks: Math.min(Math.max(1, Math.floor(wordCount * 0.08)), 3),
                percentage: Math.round((Math.min(Math.max(1, Math.floor(wordCount * 0.08)), 3) / wordCount) * 100),
                options: 6,
                description: '핵심 단어만 빈칸 (최대 3개)'
            },
            2: {
                blanks: Math.min(Math.max(2, Math.ceil(wordCount * 0.35)), 5),
                percentage: Math.round((Math.min(Math.max(2, Math.ceil(wordCount * 0.35)), 5) / wordCount) * 100),
                options: 12,
                description: '다양한 단어들이 빈칸 (최대 5개)'
            },
            3: {
                blanks: Math.min(Math.max(3, Math.ceil(wordCount * 0.65)), 10),
                percentage: Math.round((Math.min(Math.max(3, Math.ceil(wordCount * 0.65)), 10) / wordCount) * 100),
                options: 20,
                description: '많은 단어가 빈칸 (최대 10개)'
            },
            4: {
                blanks: 0,
                percentage: 0,
                options: 0,
                description: '음성으로 전체 암송하기 🎤'
            }
        };
        
        levelSelector.innerHTML = `
            <h3>${currentVerse.reference}</h3>
            <p style="margin-bottom: 20px; color: #666; font-size: 1.1rem; border: 2px solid #e2e8f0; padding: 15px; border-radius: 10px; background: #f8fafc;">
                📖 <strong>전체 말씀</strong> (${wordCount}개 단어)<br>
                "${currentVerse.text}"
            </p>
            <h4>📊 레벨별 난이도 미리보기</h4>
            <div class="level-buttons">
                <button class="level-btn level-preview" data-level="1">
                    <span class="level-number">1</span>
                    <span class="level-name">쉬움</span>
                    <div class="difficulty-preview">
                        <div class="blank-info">빈칸: ${levelPreviews[1].blanks}개 (${levelPreviews[1].percentage}%)</div>
                        <div class="option-info">선택지: ${levelPreviews[1].options}개</div>
                        <small>${levelPreviews[1].description}</small>
                    </div>
                    <div class="score-multiplier">점수 × 1.0</div>
                </button>
                <button class="level-btn level-preview" data-level="2">
                    <span class="level-number">2</span>
                    <span class="level-name">보통</span>
                    <div class="difficulty-preview">
                        <div class="blank-info">빈칸: ${levelPreviews[2].blanks}개 (${levelPreviews[2].percentage}%)</div>
                        <div class="option-info">선택지: ${levelPreviews[2].options}개</div>
                        <small>${levelPreviews[2].description}</small>
                    </div>
                    <div class="score-multiplier">점수 × 1.5</div>
                </button>
                <button class="level-btn level-preview" data-level="3">
                    <span class="level-number">3</span>
                    <span class="level-name">어려움</span>
                    <div class="difficulty-preview">
                        <div class="blank-info">빈칸: ${levelPreviews[3].blanks}개 (${levelPreviews[3].percentage}%)</div>
                        <div class="option-info">선택지: ${levelPreviews[3].options}개</div>
                        <small>${levelPreviews[3].description}</small>
                    </div>
                    <div class="score-multiplier">점수 × 2.0</div>
                </button>
                <button class="level-btn level-preview" data-level="4" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; border-color: #f093fb;">
                    <span class="level-number">🎤</span>
                    <span class="level-name">음성 암송</span>
                    <div class="difficulty-preview">
                        <div class="blank-info" style="color: white;">음성 인식 기능</div>
                        <div class="option-info" style="color: white;">말씀 전체 암송</div>
                        <small style="color: rgba(255,255,255,0.9);">${levelPreviews[4].description}</small>
                    </div>
                    <div class="score-multiplier" style="background: rgba(255,255,255,0.3);">점수 × 3.0</div>
                </button>
            </div>
            <div class="difficulty-legend" style="margin-top: 20px; padding: 15px; background: #fff3cd; border-radius: 10px; border: 1px solid #ffeaa7;">
                <h5 style="margin-bottom: 10px; color: #8c7800;">💡 난이도 차이 설명</h5>
                <div style="font-size: 0.9rem; color: #666; line-height: 1.6;">
                    <div><strong>레벨 1:</strong> 초보자용 - '하나님', '사랑' 같은 핵심 단어만 빈칸</div>
                    <div><strong>레벨 2:</strong> 중급자용 - 다양한 길이의 단어들이 고르게 빈칸</div>
                    <div><strong>레벨 3:</strong> 고급자용 - 조사를 제외한 대부분 단어가 빈칸</div>
                    <div><strong>레벨 4:</strong> 최고수용 - 음성으로 말씀 전체를 정확히 암송 🎤</div>
                </div>
            </div>
            <button class="btn btn-outline" onclick="UIManager.showVerseSelection()" style="margin-top: 20px;">
                📖 다른 말씀 선택
            </button>
        `;

        // 레벨 선택 이벤트 리스너
        document.querySelectorAll('.level-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const level = parseInt(e.currentTarget.dataset.level);
                
                // 선택된 레벨 강조
                document.querySelectorAll('.level-btn').forEach(b => b.classList.remove('selected'));
                e.currentTarget.classList.add('selected');
                
                // 바로 게임 시작
                this.startGame(level);
            });
        });
    },

    // 게임 시작
    startGame(level) {
        if (!currentVerse) {
            showNotification('말씀을 먼저 선택해주세요.', 'error');
            return;
        }
        
        currentLevel = level;
        currentScore = 0;
        
        // 힌트 초기화
        this.hintsUsed = 0;
        this.hintProcessing = false;
        const hintBtn = document.getElementById('hint-btn');
        
        if (level === 4) {
            // 레벨 4에서는 힌트 버튼 숨기기
            hintBtn.style.display = 'none';
        } else {
            hintBtn.style.display = 'block';
            const maxHints = level === 1 ? 2 : 1;
            hintBtn.textContent = `힌트 💡 (${maxHints}회)`;
            hintBtn.disabled = false;
            hintBtn.style.opacity = '1';
        }
        
        // UI 업데이트
        document.querySelector('.level-selector').style.display = 'none';
        document.getElementById('game-content').style.display = 'block';
        document.getElementById('current-level').textContent = `레벨 ${level}`;
        document.getElementById('current-score').textContent = `점수: ${currentScore}`;
        
        gameInProgress = true;
        this.showQuestion();
    },

    // 문제 표시
    async showQuestion() {
        try {
            // UI 업데이트
            document.getElementById('verse-reference').textContent = currentVerse.reference;
            document.getElementById('question-counter').textContent = `레벨 ${currentLevel}`;
            
            // 진행도 업데이트 (레벨 기준)
            const progress = (currentLevel / 4) * 100;
            document.getElementById('progress-fill').style.width = `${progress}%`;
            
            if (currentLevel === 4) {
                // 레벨 4: 음성 암송 모드
                this.showSpeechRecognitionGame();
            } else {
                // 레벨 1-3: 기존 빈칸 채우기 모드
                const allVerses = await HybridDB.getVerses(currentChurch);
                
                // 빈칸 생성
                const gameData = GameLogic.createBlanks(currentVerse.text, currentLevel);
                const options = GameLogic.generateOptions(gameData.correctAnswers, allVerses, currentLevel);
                
                document.getElementById('verse-with-blanks').innerHTML = gameData.textWithBlanks;
                
                // 선택지 표시
                const optionsContainer = document.getElementById('word-options');
                optionsContainer.innerHTML = options.map(option => `
                    <div class="word-option" data-word="${option}">${option}</div>
                `).join('');
                
                // 빈칸과 선택지에 이벤트 리스너 추가
                this.attachGameEventListeners(gameData);
            }
        } catch (error) {
            console.error('문제 표시 오류:', error);
            showNotification('게임 문제를 불러오는 중 오류가 발생했습니다.', 'error');
        }
    },

    // 게임 이벤트 리스너 추가
    attachGameEventListeners(gameData) {
        // 기존 이벤트 리스너 제거를 위해 새로운 요소들로 교체
        const hintBtn = document.getElementById('hint-btn');
        const newHintBtn = hintBtn.cloneNode(true);
        hintBtn.parentNode.replaceChild(newHintBtn, hintBtn);
        
        // 빈칸 클릭 이벤트
        document.querySelectorAll('.blank').forEach(blank => {
            blank.addEventListener('click', (e) => {
                if (e.target.classList.contains('filled')) {
                    // 이미 채워진 빈칸을 클릭하면 선택 취소
                    const word = e.target.textContent;
                    e.target.textContent = '';
                    e.target.classList.remove('filled');
                    
                    // 해당 단어 선택지 다시 활성화
                    const option = document.querySelector(`[data-word="${word}"]`);
                    if (option) {
                        option.classList.remove('used');
                    }
                }
            });
        });
        
        // 선택지 클릭 이벤트
        document.querySelectorAll('.word-option').forEach(option => {
            option.addEventListener('click', (e) => {
                if (e.target.classList.contains('used')) return;
                
                const word = e.target.dataset.word;
                const emptyBlank = document.querySelector('.blank:not(.filled)');
                
                if (emptyBlank) {
                    emptyBlank.textContent = word;
                    emptyBlank.classList.add('filled');
                    e.target.classList.add('used');
                    
                    // 모든 빈칸이 채워졌는지 확인
                    this.checkAnswers(gameData);
                }
            });
        });
        
        // 힌트 버튼 이벤트 (새로운 요소에 추가)
        document.getElementById('hint-btn').addEventListener('click', () => {
            this.showHint(gameData);
        });
    },

    // 답안 확인
    checkAnswers(gameData) {
        const blanks = document.querySelectorAll('.blank');
        const allFilled = Array.from(blanks).every(blank => blank.classList.contains('filled'));
        
        if (!allFilled) return;
        
        let correctCount = 0;
        blanks.forEach((blank) => {
            const userAnswer = blank.textContent;
            const correctAnswer = blank.dataset.answer;
            
            if (userAnswer === correctAnswer) {
                blank.classList.add('correct');
                correctCount++;
                playSound('correct');
            } else {
                blank.classList.add('incorrect');
                playSound('wrong');
            }
        });
        
        // 점수 계산
        const questionScore = GameLogic.calculateScore(correctCount, gameData.correctAnswers.length, currentLevel);
        currentScore = questionScore;
        
        document.getElementById('current-score').textContent = `점수: ${currentScore}`;
        
        // 선택지 비활성화
        document.querySelectorAll('.word-option').forEach(option => {
            option.style.pointerEvents = 'none';
        });
        
        // 레벨 완료 처리
        setTimeout(() => {
            this.completeLevel();
        }, 1500);
    },

    // 힌트 기능
    showHint(gameData) {
        // 힌트 처리 중인지 확인 (중복 실행 방지)
        if (this.hintProcessing) {
            console.log('힌트 처리 중이므로 중복 실행 방지');
            return;
        }
        
        const hintBtn = document.getElementById('hint-btn');
        
        // 힌트 사용 횟수 확인
        if (!this.hintsUsed) this.hintsUsed = 0;
        
        const maxHints = currentLevel === 1 ? 2 : currentLevel === 2 ? 1 : 1;
        if (this.hintsUsed >= maxHints) {
            showNotification(`레벨 ${currentLevel}에서는 힌트를 ${maxHints}번만 사용할 수 있습니다.`, 'warning');
            return;
        }
        
        // 힌트 처리 시작
        this.hintProcessing = true;
        
        const emptyBlanks = document.querySelectorAll('.blank:not(.filled)');
        const wrongOptions = document.querySelectorAll('.word-option:not(.used)');
        
        if (emptyBlanks.length === 0) {
            showNotification('모든 빈칸이 채워져 있습니다!', 'info');
            return;
        }
        
        this.hintsUsed++;
        
        // 먼저 전체 정답을 잠깐 보여주는 플래시 효과
        this.showFlashHint(gameData).then(() => {
            // 점수 감점 (힌트 사용 패널티)
            const penalty = currentLevel === 1 ? 5 : currentLevel === 2 ? 10 : 15;
            currentScore = Math.max(0, currentScore - penalty);
            document.getElementById('current-score').textContent = `점수: ${currentScore}`;
            
            // 플래시 효과 후 레벨별 힌트 적용
            if (currentLevel === 1) {
                // 레벨 1: 빈칸 하나의 정답 보여주기
                this.showAnswerHint(emptyBlanks, gameData);
                showNotification(`💡 레벨 ${currentLevel} 힌트: 빈칸 하나를 채웠습니다! (${penalty}점 감점)`, 'info');
            } else if (currentLevel === 2) {
                // 레벨 2: 잘못된 선택지 절반 제거
                console.log('레벨 2 힌트 실행 - 디버깅 정보:', {
                    wrongOptions: Array.from(wrongOptions).map(opt => opt.dataset.word),
                    correctAnswers: gameData.correctAnswers,
                    currentLevel: currentLevel
                });
                const removedCount = this.removeWrongOptions(wrongOptions, gameData, 0.5);
                if (removedCount > 0) {
                    showNotification(`💡 레벨 ${currentLevel} 힌트: 잘못된 선택지 ${removedCount}개 제거! (${penalty}점 감점)`, 'info');
                } else {
                    showNotification(`💡 레벨 ${currentLevel} 힌트: 제거할 잘못된 선택지가 없습니다! (${penalty}점 감점)`, 'warning');
                }
            } else {
                // 레벨 3: 잘못된 선택지 1/3 제거
                const removedCount = this.removeWrongOptions(wrongOptions, gameData, 0.3);
                if (removedCount > 0) {
                    showNotification(`💡 레벨 ${currentLevel} 힌트: 잘못된 선택지 ${removedCount}개 제거! (${penalty}점 감점)`, 'info');
                } else {
                    showNotification(`💡 레벨 ${currentLevel} 힌트: 제거할 잘못된 선택지가 없습니다! (${penalty}점 감점)`, 'warning');
                }
            }
            
            // 힌트 버튼 업데이트
            const remainingHints = maxHints - this.hintsUsed;
            if (remainingHints <= 0) {
                hintBtn.textContent = '힌트 사용 완료';
                hintBtn.disabled = true;
                hintBtn.style.opacity = '0.5';
            } else {
                hintBtn.textContent = `힌트 💡 (${remainingHints}회 남음)`;
            }
            
            playSound('correct'); // 힌트 사용 효과음 (정답음과 같음)
            
            // 힌트 처리 완료
            this.hintProcessing = false;
        });
    },

    // 플래시 힌트 (전체 정답을 잠깐 보여주기)
    showFlashHint(gameData) {
        return new Promise((resolve) => {
            const allBlanks = document.querySelectorAll('.blank');
            const originalContents = [];
            
            // 현재 빈칸 상태 저장
            allBlanks.forEach(blank => {
                originalContents.push({
                    element: blank,
                    content: blank.textContent,
                    classList: Array.from(blank.classList)
                });
            });
            
            // 모든 빈칸에 정답 채우기
            allBlanks.forEach(blank => {
                const correctAnswer = blank.dataset.answer;
                blank.textContent = correctAnswer;
                blank.classList.add('flash-hint');
                
                // 플래시 효과 스타일
                blank.style.background = 'linear-gradient(45deg, #fbbf24, #f59e0b)';
                blank.style.color = '#92400e';
                blank.style.border = '2px solid #f59e0b';
                blank.style.animation = 'flashHint 1.5s ease-in-out';
            });
            
            showNotification('💡 정답을 잠깐 보여드립니다!', 'info');
            
            // 1.5초 후 원래 상태로 되돌리기
            setTimeout(() => {
                originalContents.forEach(item => {
                    item.element.textContent = item.content;
                    item.element.className = item.classList.join(' ');
                    
                    // 스타일 초기화
                    item.element.style.background = '';
                    item.element.style.color = '';
                    item.element.style.border = '';
                    item.element.style.animation = '';
                });
                
                // 잠깐 기다린 후 resolve (알림 정리 시간)
                setTimeout(() => resolve(), 200);
            }, 1500);
        });
    },

    // 정답 힌트 (빈칸 하나 채우기)
    showAnswerHint(emptyBlanks, gameData) {
        const randomBlank = emptyBlanks[Math.floor(Math.random() * emptyBlanks.length)];
        const correctAnswer = randomBlank.dataset.answer;
        
        // 빈칸 채우기
        randomBlank.textContent = correctAnswer;
        randomBlank.classList.add('filled', 'hint-filled');
        
        // 해당 선택지 사용됨으로 표시
        const usedOption = document.querySelector(`[data-word="${correctAnswer}"]`);
        if (usedOption) {
            usedOption.classList.add('used', 'hint-used');
        }
        
        // 스타일 추가
        randomBlank.style.background = '#fbbf24';
        randomBlank.style.color = '#92400e';
        randomBlank.style.border = '2px solid #f59e0b';
        
        // 알림은 상위에서 처리하므로 여기서는 제거
        
        // 모든 빈칸이 채워졌는지 확인
        setTimeout(() => {
            this.checkAnswers(gameData);
        }, 1000);
    },

    // 잘못된 선택지 제거
    removeWrongOptions(wrongOptions, gameData, ratio) {
        const correctAnswers = gameData.correctAnswers;
        
        // 모든 선택지에서 정답이 아닌 것들만 필터링 (사용되지 않은 것들 중에서)
        const allUnusedOptions = document.querySelectorAll('.word-option:not(.used):not(.hint-removed)');
        const wrongOptionsArray = Array.from(allUnusedOptions).filter(option => {
            const optionWord = option.dataset.word;
            
            // 정답 배열에 포함되지 않은 선택지만 제거 대상으로 선택
            const isCorrectAnswer = correctAnswers.some(answer => 
                answer.toString().trim() === optionWord.toString().trim()
            );
            
            return !isCorrectAnswer;
        });
        
        console.log('힌트 제거 대상 분석:', {
            correctAnswers: correctAnswers,
            allUnusedOptions: Array.from(allUnusedOptions).map(opt => opt.dataset.word),
            filteredWrongOptions: wrongOptionsArray.length,
            wrongOptionsText: wrongOptionsArray.map(opt => opt.dataset.word)
        });
        
        const removeCount = Math.floor(wrongOptionsArray.length * ratio);
        
        if (removeCount === 0) {
            console.log('제거할 잘못된 선택지가 없습니다.');
            return 0;
        }
        
        // 랜덤하게 잘못된 선택지 제거
        const shuffled = wrongOptionsArray.sort(() => Math.random() - 0.5);
        const toRemove = shuffled.slice(0, removeCount);
        
        console.log('제거할 선택지들:', toRemove.map(opt => opt.dataset.word));
        
        toRemove.forEach(option => {
            // 마지막 안전 체크: 정답 선택지인지 다시 한 번 확인
            const isCorrectAnswer = correctAnswers.some(answer => 
                answer.toString().trim() === option.dataset.word.toString().trim()
            );
            
            if (!isCorrectAnswer) {
                option.style.transition = 'all 0.5s ease';
                option.style.opacity = '0.3';
                option.style.transform = 'scale(0.8)';
                option.style.pointerEvents = 'none';
                option.classList.add('hint-removed');
                
                // 흐린 텍스트 추가
                option.style.textDecoration = 'line-through';
                option.style.color = '#94a3b8';
                
                console.log('선택지 제거됨:', option.dataset.word);
            } else {
                console.error('❌ 정답 선택지 제거 시도 방지:', option.dataset.word);
            }
        });
        
        // 제거 후 상태 확인
        const remainingOptions = document.querySelectorAll('.word-option:not(.used):not(.hint-removed)');
        console.log('제거 후 남은 활성 선택지들:', Array.from(remainingOptions).map(opt => opt.dataset.word));
        
        return removeCount;
    },

    // 음성 인식 게임 화면 표시 (레벨 4)
    showSpeechRecognitionGame() {
        // 음성 인식 데이터 초기화
        recognizedText = '';
        console.log('음성 인식 게임 시작 - 데이터 초기화');
        
        // 음성 인식 초기화
        if (!SpeechRecognitionManager.init()) {
            showNotification('이 브라우저는 음성 인식을 지원하지 않습니다. Chrome, Edge 브라우저를 사용해주세요.', 'error');
            return;
        }
        
        // 기존 게임 컨텐츠 숨기기
        document.getElementById('word-options').style.display = 'none';
        document.getElementById('hint-btn').style.display = 'none';
        
        // 음성 인식 전용 UI 생성
        const verseDisplay = document.getElementById('verse-with-blanks');
        verseDisplay.innerHTML = `
            <div class="speech-recognition-container">
                <div class="original-verse">
                    <h5 style="color: #5a67d8; margin-bottom: 15px;">📖 암송할 말씀</h5>
                    <div style="font-size: 1.1rem; line-height: 1.8; padding: 20px; background: #f8fafc; border-radius: 10px; border: 2px solid #e2e8f0;">
                        "${currentVerse.text}"
                    </div>
                    ${isMobileDevice ? `
                        <div style="margin-top: 15px; padding: 15px; background: #e8f4fd; border: 2px solid #3b82f6; border-radius: 10px; font-size: 0.9rem;">
                            📱 <strong style="color: #1d4ed8;">모바일 환경 중요 안내:</strong><br>
                            <div style="margin-top: 8px; line-height: 1.6;">
                                🔴 <strong>화면을 계속 켜두세요!</strong> (화면이 꺼지면 녹음 중단)<br>
                                📵 다른 앱으로 이동하지 마세요<br>
                                🔄 음성 인식이 중단되면 자동으로 재시작됩니다<br>
                                ⏱️ 녹음 시간이 60초로 연장됩니다<br>
                                🎤 5초마다 음성 상태를 자동 확인합니다
                            </div>
                        </div>
                    ` : ''}
                </div>
                
                <div class="speech-controls" style="margin: 30px 0; text-align: center;">
                    <button id="test-mic-btn" class="btn btn-outline" style="font-size: 1rem; padding: 10px 20px; margin-bottom: 15px;">
                        🎤 마이크 테스트
                    </button>
                    
                    <div style="margin-bottom: 20px;">
                        <button id="record-btn" class="btn btn-primary" style="font-size: 1.2rem; padding: 15px 30px;">
                            🎤 음성 녹음 시작
                        </button>
                    </div>
                    
                    <div id="recording-indicator" style="display: none; color: #f56565; font-weight: bold; animation: pulse 1s infinite;">
                        🎙️ 녹음 중... 말씀을 또렷하게 읽어주세요
                        ${isMobileDevice ? `<br><small style="color: #666;">
                            📱 화면을 계속 켜두세요! 자동 재시작 기능 활성화됨
                        </small>` : ''}
                    </div>
                    
                    <div style="margin-top: 20px;">
                        <button id="check-speech-btn" class="btn btn-secondary" style="display: none;">
                            ✅ 음성 인식 완료 및 채점
                        </button>
                        <button id="retry-speech-btn" class="btn btn-outline" style="display: none; margin-left: 10px;">
                            🔄 다시 녹음
                        </button>
                    </div>
                </div>
                
                <div class="recognized-text-container">
                    <h5 style="color: #5a67d8; margin-bottom: 15px;">🗣️ 인식된 음성</h5>
                    <div id="recognized-text" style="min-height: 80px; padding: 20px; background: #fff; border: 2px solid #e2e8f0; border-radius: 10px; font-size: 1.1rem; line-height: 1.8;">
                        <span style="color: #ccc;">인식된 텍스트가 여기에 표시됩니다...</span>
                    </div>
                </div>
                
                <div class="speech-instructions" style="margin-top: 20px; padding: 15px; background: #e3f2fd; border-radius: 10px; border: 1px solid #90caf9;">
                    <h6 style="color: #1976d2; margin-bottom: 10px;">📋 음성 암송 가이드</h6>
                    <ul style="margin: 0; color: #333; font-size: 0.9rem;">
                        <li>🎤 녹음 버튼을 클릭하고 말씀을 천천히, 또렷하게 읽어주세요</li>
                        <li>📝 실시간으로 인식되는 텍스트를 확인할 수 있습니다</li>
                        <li>✅ 완료 버튼으로 최종 채점을 받을 수 있습니다</li>
                        <li>🏆 70% 이상 정확도면 합격, 90% 이상이면 완벽!</li>
                    </ul>
                </div>
            </div>
        `;
        
        // 이벤트 리스너 추가
        this.attachSpeechEventListeners();
    },
    
    // 음성 인식 이벤트 리스너
    attachSpeechEventListeners() {
        // 마이크 테스트 버튼
        document.getElementById('test-mic-btn').addEventListener('click', () => {
            SpeechRecognitionManager.testMicrophone();
        });
        
        // 녹음 버튼
        document.getElementById('record-btn').addEventListener('click', () => {
            if (isRecording) {
                SpeechRecognitionManager.stopRecording();
                this.showSpeechButtons();
            } else {
                if (SpeechRecognitionManager.startRecording()) {
                    showNotification('🎤 음성 녹음이 시작되었습니다. 말씀을 읽어주세요!', 'info');
                }
            }
        });
        
        // 채점 버튼
        document.getElementById('check-speech-btn').addEventListener('click', () => {
            this.checkSpeechResult();
        });
        
        // 다시 녹음 버튼
        document.getElementById('retry-speech-btn').addEventListener('click', () => {
            recognizedText = '';
            console.log('다시 녹음 버튼 클릭 - 데이터 초기화');
            SpeechRecognitionManager.updateRecognizedText('', '');
            this.hideSpeechButtons();
        });
    },
    
    // 음성 인식 후 버튼들 표시
    showSpeechButtons() {
        document.getElementById('check-speech-btn').style.display = 'inline-block';
        document.getElementById('retry-speech-btn').style.display = 'inline-block';
    },
    
    // 음성 인식 버튼들 숨기기
    hideSpeechButtons() {
        document.getElementById('check-speech-btn').style.display = 'none';
        document.getElementById('retry-speech-btn').style.display = 'none';
    },
    
    // 음성 인식 결과 채점
    checkSpeechResult() {
        if (!recognizedText.trim()) {
            showNotification('인식된 음성이 없습니다. 다시 녹음해주세요.', 'warning');
            return;
        }
        
        // 정확도 계산
        const accuracy = GameLogic.calculateSpeechAccuracy(currentVerse.text, recognizedText);
        const score = GameLogic.calculateScore(accuracy, 100, currentLevel);
        
        currentScore = score;
        document.getElementById('current-score').textContent = `점수: ${currentScore}`;
        
        // 결과 표시
        this.showSpeechResult(accuracy, score);
        
        // 채점 후 잠시 기다린 후 레벨 완료
        setTimeout(() => {
            this.completeLevel();
        }, 3000);
    },
    
    // 음성 인식 결과 표시
    showSpeechResult(accuracy, score) {
        let resultMessage = '';
        let resultColor = '';
        
        if (accuracy >= 90) {
            resultMessage = '🌟 완벽해요! 말씀 암송의 달인이에요!';
            resultColor = '#10b981';
            playSound('levelComplete');
        } else if (accuracy >= 70) {
            resultMessage = '👏 잘했어요! 말씀을 잘 외우고 있어요!';
            resultColor = '#3b82f6';
            playSound('correct');
        } else if (accuracy >= 50) {
            resultMessage = '💪 좋아요! 조금만 더 연습하면 완벽해질 거예요!';
            resultColor = '#f59e0b';
            playSound('correct');
        } else {
            resultMessage = '📖 괜찮아요! 말씀을 더 읽고 다시 도전해보세요!';
            resultColor = '#ef4444';
            playSound('wrong');
        }
        
        // 결과 표시
        const resultDiv = document.createElement('div');
        resultDiv.style.cssText = `
            margin-top: 20px;
            padding: 20px;
            background: ${resultColor};
            color: white;
            border-radius: 15px;
            text-align: center;
            font-size: 1.2rem;
            font-weight: bold;
            animation: celebration 0.8s ease-in-out;
        `;
        resultDiv.innerHTML = `
            <div style="margin-bottom: 10px;">${resultMessage}</div>
            <div style="font-size: 1.5rem;">정확도: ${accuracy}% | 최종 점수: ${score}점</div>
        `;
        
        document.querySelector('.speech-recognition-container').appendChild(resultDiv);
        
        // 버튼들 숨기기
        document.getElementById('record-btn').style.display = 'none';
        this.hideSpeechButtons();
        
        showNotification(`음성 암송 완료! 정확도 ${accuracy}%, 점수 ${score}점`, 'success');
    },

    // 레벨 완료
    async completeLevel() {
        gameInProgress = false;
        
        try {
            // 점수 저장
            const result = await HybridDB.saveStudentScore(currentChurch, currentUser, currentVerse.id, currentLevel, currentScore);
            
            if (!result.success) {
                console.error('점수 저장 실패:', result.error);
                showNotification('점수 저장에 실패했지만 게임은 계속됩니다.', 'warning');
            }
            
            // 레벨 완료 화면 표시
            document.getElementById('game-content').style.display = 'none';
            document.getElementById('level-complete').style.display = 'block';
            document.getElementById('final-score').textContent = currentScore;
            
            // 성능 메시지
            let message = '';
            if (currentScore >= 90) message = '🌟 완벽해요! 말씀 암송 챔피언이에요!';
            else if (currentScore >= 70) message = '👏 잘했어요! 조금만 더 연습하면 완벽해요!';
            else if (currentScore >= 50) message = '💪 좋아요! 계속 연습해서 실력을 늘려보세요!';
            else message = '📖 괜찮아요! 말씀을 더 읽고 다시 도전해보세요!';
            
            document.getElementById('performance-message').textContent = message;
            
            // 다음 레벨 버튼 업데이트
            const nextLevelBtn = document.getElementById('next-level');
            if (currentLevel < 4) {
                if (currentLevel === 3) {
                    nextLevelBtn.textContent = '🎤 레벨 4 (음성 암송) 도전';
                    nextLevelBtn.style.background = 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)';
                } else {
                    nextLevelBtn.textContent = `레벨 ${currentLevel + 1} 도전`;
                    nextLevelBtn.style.background = '';
                }
                nextLevelBtn.style.display = 'inline-block';
            } else {
                nextLevelBtn.textContent = '🏆 다른 말씀 도전';
                nextLevelBtn.style.background = '';
                nextLevelBtn.style.display = 'inline-block';
            }
            
            playSound('levelComplete');
            showNotification(`레벨 ${currentLevel} 완료! ${currentScore}점`, 'success');
        } catch (error) {
            console.error('레벨 완료 처리 오류:', error);
            showNotification('게임 완료 처리 중 오류가 발생했습니다.', 'error');
        }
    }
};

// 이벤트 리스너 등록
document.addEventListener('DOMContentLoaded', function() {
    // 시작 화면 버튼
    document.getElementById('admin-btn').addEventListener('click', () => {
        showScreen('adminLogin');
    });
    
    document.getElementById('student-btn').addEventListener('click', () => {
        showScreen('studentLogin');
    });
    
    // 뒤로가기 버튼들
    document.getElementById('back-to-welcome').addEventListener('click', () => {
        showScreen('welcome');
    });
    
    document.getElementById('back-to-welcome-student').addEventListener('click', () => {
        showScreen('welcome');
    });
    
    // 관리자 로그인
    document.getElementById('admin-login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const churchName = document.getElementById('church-name').value.trim();
        const password = document.getElementById('admin-password').value;
        
        if (!churchName || !password) {
            showNotification('모든 필드를 입력해주세요.', 'error');
            return;
        }
        
        try {
            const result = await HybridDB.initializeChurch(churchName, password);
            if (result.success) {
                currentChurch = churchName;
                isAdmin = true;
                showScreen('adminDashboard');
                UIManager.renderAdminDashboard();
                
                if (result.isNew) {
                    showNotification('새 교회가 등록되었습니다!', 'success');
                } else {
                    showNotification('로그인 성공!', 'success');
                }
                
                // Firebase 연결 상태 알림
                if (HybridDB.isFirebaseActive()) {
                    showNotification('🔥 Firebase 실시간 동기화 활성화됨', 'info');
                }
            } else {
                showNotification(result.error, 'error');
            }
        } catch (error) {
            console.error('로그인 오류:', error);
            showNotification('로그인 중 오류가 발생했습니다.', 'error');
        }
    });
    
    // 학생 로그인
    document.getElementById('student-login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const churchName = document.getElementById('student-church').value.trim();
        const studentName = document.getElementById('student-name').value.trim();
        
        if (!churchName || !studentName) {
            showNotification('모든 필드를 입력해주세요.', 'error');
            return;
        }
        
        try {
            const exists = await HybridDB.churchExists(churchName);
            if (!exists) {
                showNotification('등록되지 않은 교회입니다.', 'error');
                return;
            }
            
            currentChurch = churchName;
            currentUser = studentName;
            isAdmin = false;
            showScreen('game');
            UIManager.initGameScreen();
            
            showNotification(`${studentName}님, 환영합니다!`, 'success');
            
            // Firebase 연결 상태 알림
            if (HybridDB.isFirebaseActive()) {
                showNotification('🔥 실시간 동기화 활성화됨', 'info');
            }
        } catch (error) {
            console.error('학생 로그인 오류:', error);
            showNotification('로그인 중 오류가 발생했습니다.', 'error');
        }
    });
    
    // 관리자 대시보드 탭
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tabName = e.target.dataset.tab;
            UIManager.showTab(tabName);
        });
    });
    
    // 말씀 추가 버튼
    document.getElementById('add-verse-btn').addEventListener('click', () => {
        document.getElementById('add-verse-form').style.display = 'block';
    });
    
    document.getElementById('cancel-add-verse').addEventListener('click', () => {
        document.getElementById('add-verse-form').style.display = 'none';
        document.getElementById('verse-form').reset();
    });
    
    // 말씀 추가 폼 (레벨 선택 제거)
    document.getElementById('verse-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const reference = document.getElementById('verse-reference').value.trim();
        const text = document.getElementById('verse-text').value.trim();
        
        if (!reference || !text) {
            showNotification('모든 필드를 입력해주세요.', 'error');
            return;
        }
        
        try {
            const result = await HybridDB.addVerse(currentChurch, {
                reference,
                text
            });
            
            if (result.success) {
                document.getElementById('add-verse-form').style.display = 'none';
                document.getElementById('verse-form').reset();
                UIManager.loadVerses();
                showNotification('말씀이 추가되었습니다!', 'success');
            } else {
                showNotification(result.error || '말씀 추가에 실패했습니다.', 'error');
            }
        } catch (error) {
            console.error('말씀 추가 오류:', error);
            showNotification('말씀 추가 중 오류가 발생했습니다.', 'error');
        }
    });
    
    // 게임 컨트롤 버튼
    document.getElementById('next-level').addEventListener('click', () => {
        if (currentLevel < 3) {
            UIManager.startGame(currentLevel + 1);
        } else {
            UIManager.showVerseSelection();
        }
    });
    
    document.getElementById('retry-level').addEventListener('click', () => {
        UIManager.startGame(currentLevel);
    });
    

    
    // 로그아웃 버튼들
    document.getElementById('admin-logout').addEventListener('click', () => {
        currentChurch = null;
        isAdmin = false;
        showScreen('welcome');
        showNotification('로그아웃되었습니다.', 'info');
    });
    
    document.getElementById('game-logout').addEventListener('click', () => {
        currentUser = null;
        currentChurch = null;
        isAdmin = false;
        gameInProgress = false;
        currentVerse = null;
        showScreen('welcome');
        showNotification('게임을 종료합니다.', 'info');
    });

    // 랭킹 토글 버튼 이벤트 리스너
    document.getElementById('overall-ranking-btn').addEventListener('click', () => {
        // 버튼 상태 업데이트
        document.getElementById('overall-ranking-btn').classList.add('active');
        document.getElementById('verse-ranking-btn').classList.remove('active');
        
        // 뷰 전환
        document.getElementById('overall-rankings').classList.add('active');
        document.getElementById('verse-rankings').classList.remove('active');
        
        // 전체 랭킹 로드
        UIManager.loadRankings();
    });

    document.getElementById('verse-ranking-btn').addEventListener('click', () => {
        // 버튼 상태 업데이트
        document.getElementById('verse-ranking-btn').classList.add('active');
        document.getElementById('overall-ranking-btn').classList.remove('active');
        
        // 뷰 전환
        document.getElementById('verse-rankings').classList.add('active');
        document.getElementById('overall-rankings').classList.remove('active');
        
        // 말씀별 랭킹 로드
        UIManager.loadVerseRankings();
    });

    // 말씀별 랭킹 아이템 클릭 이벤트 (이벤트 위임)
    document.getElementById('verse-ranking-list').addEventListener('click', (e) => {
        const verseItem = e.target.closest('.verse-ranking-item');
        if (verseItem) {
            const verseId = verseItem.dataset.verseId;
            const verseReference = verseItem.querySelector('h5').textContent;
            
            // 말씀 선택 화면 숨기기
            document.getElementById('verse-ranking-selector').style.display = 'none';
            
            // 상세 랭킹 화면 표시
            document.getElementById('verse-ranking-details').style.display = 'block';
            document.getElementById('selected-verse-title').textContent = verseReference;
            
            // 해당 말씀의 학생 점수 로드
            UIManager.loadVerseStudentScores(verseId, verseReference);
        }
    });

    // 말씀별 랭킹에서 목록으로 돌아가기 버튼
    document.getElementById('back-to-verse-list').addEventListener('click', () => {
        // 상세 랭킹 화면 숨기기
        document.getElementById('verse-ranking-details').style.display = 'none';
        
        // 말씀 선택 화면 표시
        document.getElementById('verse-ranking-selector').style.display = 'block';
    });
});

// 음성 제어 버튼 추가
document.addEventListener('DOMContentLoaded', function() {
    // 모바일 기기 감지 실행
    detectMobileDevice();
    
    // 탭 활성화 상태 모니터링 설정
    setupTabVisibilityMonitoring();
    
    const volumeBtn = document.createElement('button');
    volumeBtn.className = 'volume-control';
    volumeBtn.innerHTML = '🔊';
    volumeBtn.addEventListener('click', () => {
        soundEnabled = !soundEnabled;
        volumeBtn.innerHTML = soundEnabled ? '🔊' : '🔇';
        volumeBtn.classList.toggle('muted', !soundEnabled);
        
        if (soundEnabled) {
            showNotification('소리가 켜졌습니다.', 'info');
        } else {
            showNotification('소리가 꺼졌습니다.', 'info');
        }
    });
    
    document.body.appendChild(volumeBtn);
    
    // Firebase 연결 상태 표시기 추가
    const connectionStatus = document.createElement('div');
    connectionStatus.className = 'connection-status';
    connectionStatus.style.cssText = `
        position: fixed;
        top: 20px;
        left: 20px;
        padding: 8px 12px;
        border-radius: 20px;
        font-size: 0.8rem;
        font-weight: 500;
        z-index: 1000;
        transition: all 0.3s ease;
    `;
    
    function updateConnectionStatus() {
        if (HybridDB.isFirebaseActive()) {
            connectionStatus.innerHTML = '🔥 실시간 동기화';
            connectionStatus.style.background = '#10b981';
            connectionStatus.style.color = 'white';
            connectionStatus.title = 'Firebase에 연결됨 - 실시간 동기화 활성화';
        } else {
            connectionStatus.innerHTML = '💾 로컬 모드';
            connectionStatus.style.background = '#f59e0b';
            connectionStatus.style.color = 'white';
            connectionStatus.title = '로컬 스토리지 사용 - Firebase 설정 필요';
        }
    }
    
    updateConnectionStatus();
    document.body.appendChild(connectionStatus);
    
    // 주기적으로 연결 상태 확인
    setInterval(updateConnectionStatus, 5000);
});

// 전역 함수들 (HTML에서 호출)
window.UIManager = UIManager;
window.showNotification = showNotification;

// 모바일 기기 감지 함수
function detectMobileDevice() {
    const userAgent = navigator.userAgent.toLowerCase();
    const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile/.test(userAgent);
    const isSmallScreen = window.innerWidth <= 768;
    
    isMobileDevice = isMobile || isSmallScreen;
    console.log('모바일 기기 감지:', isMobileDevice);
    return isMobileDevice;
}

// 화면 잠금 방지 (모바일)
function preventScreenLock() {
    if ('wakeLock' in navigator) {
        navigator.wakeLock.request('screen').then(wakeLock => {
            console.log('화면 잠금 방지 활성화');
        }).catch(err => {
            console.log('화면 잠금 방지 실패:', err);
        });
    }
}

// 탭 활성화 상태 모니터링
function setupTabVisibilityMonitoring() {
    document.addEventListener('visibilitychange', () => {
        isTabActive = !document.hidden;
        console.log('탭 활성화 상태 변경:', isTabActive);
        
        if (isRecording) {
            if (!isTabActive) {
                console.log('탭 비활성화 - 음성 인식 유지 모드 활성화');
                showNotification('📱 화면을 계속 켜두세요. 백그라운드에서 녹음이 중단될 수 있습니다.', 'warning');
            } else {
                console.log('탭 다시 활성화 - 음성 인식 상태 확인');
                // 탭이 다시 활성화되었을 때 음성 인식이 여전히 작동하는지 확인
                setTimeout(() => {
                    if (isRecording && speechRecognition) {
                        SpeechRecognitionManager.checkAndRestartIfNeeded();
                    }
                }, 500);
            }
        }
    });
}

// 음성 인식 keep-alive 메커니즘
function startSpeechKeepAlive() {
    if (speechKeepAliveInterval) {
        clearInterval(speechKeepAliveInterval);
    }
    
    speechKeepAliveInterval = setInterval(() => {
        if (isRecording && isMobileDevice) {
            const now = Date.now();
            const timeSinceLastActivity = now - lastSpeechActivity;
            
            console.log('Keep-alive 체크 - 마지막 활동:', timeSinceLastActivity + 'ms 전');
            
            // 60초 이상 활동이 없으면 재시작 시도 (매우 관대한 조건)
            if (timeSinceLastActivity > 60000) {
                console.log('매우 장시간 음성 활동 없음 - 재시작 시도');
                SpeechRecognitionManager.restartSpeechRecognition();
            }
        }
    }, 15000); // 15초마다 체크 (더 긴 간격)
}

function stopSpeechKeepAlive() {
    if (speechKeepAliveInterval) {
        clearInterval(speechKeepAliveInterval);
        speechKeepAliveInterval = null;
        console.log('Keep-alive 중지');
    }
}


