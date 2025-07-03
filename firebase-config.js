// Firebase 설정 및 초기화 (CDN Compat 버전)

// Firebase 설정 객체
const firebaseConfig = {
    apiKey: "AIzaSyDMPjmjZ5ZdPzHwu7W2aA7qDs9e4d8ucq0",
    authDomain: "bible-verse-game-9912e.firebaseapp.com",
    databaseURL: "https://bible-verse-game-9912e-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "bible-verse-game-9912e",
    storageBucket: "bible-verse-game-9912e.firebasestorage.app",
    messagingSenderId: "972610058035",
    appId: "1:972610058035:web:91d674105ab13dd88df046",
    measurementId: "G-GW033K588W"
};

// Firebase 초기화
let app, database;
let firebaseInitialized = false;

try {
    app = firebase.initializeApp(firebaseConfig);
    database = firebase.database();
    firebaseInitialized = true;
    console.log('✅ Firebase 연결 성공!');
} catch (error) {
    console.log('❌ Firebase 연결 실패:', error);
    console.log('로컬 스토리지 모드로 실행됩니다.');
    firebaseInitialized = false;
}

// Firebase 데이터베이스 헬퍼 함수들
const FirebaseDB = {
    // Firebase 초기화 상태 확인
    isConnected() {
        return firebaseInitialized;
    },

    // 교회 초기화
    async initializeChurch(churchName, adminPassword) {
        if (!this.isConnected()) {
            return { success: false, error: 'Firebase 연결이 필요합니다.' };
        }

        try {
            const churchRef = database.ref(`churches/${churchName}`);
            const snapshot = await churchRef.once('value');
            
            if (snapshot.exists()) {
                const church = snapshot.val();
                if (church.admin_password === adminPassword) {
                    return { success: true, isNew: false };
                } else {
                    return { success: false, error: '비밀번호가 올바르지 않습니다.' };
                }
            } else {
                // 새 교회 생성
                await churchRef.set({
                    admin_password: adminPassword,
                    verses: {},
                    students: {},
                    rankings: {},
                    createdAt: Date.now()
                });
                return { success: true, isNew: true };
            }
        } catch (error) {
            console.error('교회 초기화 오류:', error);
            return { success: false, error: '서버 오류가 발생했습니다.' };
        }
    },

    // 교회 존재 확인
    async churchExists(churchName) {
        if (!this.isConnected()) return false;
        
        try {
            const churchRef = database.ref(`churches/${churchName}`);
            const snapshot = await churchRef.once('value');
            return snapshot.exists();
        } catch (error) {
            console.error('교회 확인 오류:', error);
            return false;
        }
    },

    // 말씀 추가
    async addVerse(churchName, verseData) {
        if (!this.isConnected()) {
            return { success: false, error: 'Firebase 연결이 필요합니다.' };
        }

        try {
            const versesRef = database.ref(`churches/${churchName}/verses`);
            const newVerseRef = versesRef.push();
            
            await newVerseRef.set({
                ...verseData,
                id: newVerseRef.key,
                createdAt: Date.now()
            });
            
            return { success: true, id: newVerseRef.key };
        } catch (error) {
            console.error('말씀 추가 오류:', error);
            return { success: false, error: '말씀 추가에 실패했습니다.' };
        }
    },

    // 말씀 목록 가져오기
    async getVerses(churchName) {
        if (!this.isConnected()) return [];
        
        try {
            const versesRef = database.ref(`churches/${churchName}/verses`);
            const snapshot = await versesRef.once('value');
            
            if (snapshot.exists()) {
                const versesData = snapshot.val();
                return Object.values(versesData);
            }
            return [];
        } catch (error) {
            console.error('말씀 조회 오류:', error);
            return [];
        }
    },

    // 말씀 삭제
    async deleteVerse(churchName, verseId) {
        if (!this.isConnected()) {
            return { success: false, error: 'Firebase 연결이 필요합니다.' };
        }

        try {
            const verseRef = database.ref(`churches/${churchName}/verses/${verseId}`);
            await verseRef.remove();
            return { success: true };
        } catch (error) {
            console.error('말씀 삭제 오류:', error);
            return { success: false, error: '말씀 삭제에 실패했습니다.' };
        }
    },

    // 학생 점수 저장
    async saveStudentScore(churchName, studentName, verseId, level, score) {
        if (!this.isConnected()) {
            return { success: false, error: 'Firebase 연결이 필요합니다.' };
        }

        try {
            const studentRef = database.ref(`churches/${churchName}/students/${studentName}`);
            const snapshot = await studentRef.once('value');
            
            let studentData;
            if (snapshot.exists()) {
                studentData = snapshot.val();
            } else {
                studentData = {
                    name: studentName,
                    scores: {},
                    totalScore: 0,
                    gamesPlayed: 0,
                    lastPlayed: Date.now()
                };
            }

            // 말씀별 점수 저장
            if (!studentData.scores[verseId]) {
                studentData.scores[verseId] = {
                    level1: 0,
                    level2: 0,
                    level3: 0,
                    completed: false
                };
            }

            studentData.scores[verseId][`level${level}`] = score;
            studentData.gamesPlayed += 1;
            studentData.lastPlayed = Date.now();

            // 레벨 3까지 완료했는지 확인
            if (level === 3) {
                studentData.scores[verseId].completed = true;
            }

            // 총점 계산
            studentData.totalScore = 0;
            Object.values(studentData.scores).forEach(verseScores => {
                if (typeof verseScores === 'object' && verseScores.level1 !== undefined) {
                    studentData.totalScore += verseScores.level1 + verseScores.level2 + verseScores.level3;
                }
            });

            // 학생 데이터 업데이트
            await studentRef.set(studentData);

            // 랭킹 업데이트
            const averageScore = studentData.totalScore / studentData.gamesPlayed;
            const rankingRef = database.ref(`churches/${churchName}/rankings/${studentName}`);
            await rankingRef.set({
                name: studentName,
                totalScore: studentData.totalScore,
                gamesPlayed: studentData.gamesPlayed,
                averageScore: Math.round(averageScore * 10) / 10,
                lastPlayed: studentData.lastPlayed
            });

            return { success: true };
        } catch (error) {
            console.error('점수 저장 오류:', error);
            return { success: false, error: '점수 저장에 실패했습니다.' };
        }
    },

    // 학생 목록 가져오기
    async getStudents(churchName) {
        if (!this.isConnected()) return [];
        
        try {
            const studentsRef = database.ref(`churches/${churchName}/students`);
            const snapshot = await studentsRef.once('value');
            
            if (snapshot.exists()) {
                const studentsData = snapshot.val();
                return Object.values(studentsData);
            }
            return [];
        } catch (error) {
            console.error('학생 조회 오류:', error);
            return [];
        }
    },

    // 랭킹 가져오기
    async getRankings(churchName) {
        if (!this.isConnected()) return [];
        
        try {
            const rankingsRef = database.ref(`churches/${churchName}/rankings`);
            const snapshot = await rankingsRef.once('value');
            
            if (snapshot.exists()) {
                const rankingsData = snapshot.val();
                const rankings = Object.values(rankingsData);
                return rankings.sort((a, b) => b.totalScore - a.totalScore);
            }
            return [];
        } catch (error) {
            console.error('랭킹 조회 오류:', error);
            return [];
        }
    },

    // 말씀별 랭킹 가져오기 (말씀 목록과 통계)
    async getVerseRankings(churchName) {
        if (!this.isConnected()) return [];
        
        try {
            const versesRef = database.ref(`churches/${churchName}/verses`);
            const studentsRef = database.ref(`churches/${churchName}/students`);
            
            const [versesSnapshot, studentsSnapshot] = await Promise.all([
                versesRef.once('value'),
                studentsRef.once('value')
            ]);
            
            if (!versesSnapshot.exists()) return [];
            
            const verses = Object.values(versesSnapshot.val());
            const students = studentsSnapshot.exists() ? Object.values(studentsSnapshot.val()) : [];
            
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
        } catch (error) {
            console.error('말씀별 랭킹 조회 오류:', error);
            return [];
        }
    },

    // 특정 말씀의 학생 점수 가져오기
    async getVerseStudentScores(churchName, verseId) {
        if (!this.isConnected()) return [];
        
        try {
            const studentsRef = database.ref(`churches/${churchName}/students`);
            const verseRef = database.ref(`churches/${churchName}/verses/${verseId}`);
            
            const [studentsSnapshot, verseSnapshot] = await Promise.all([
                studentsRef.once('value'),
                verseRef.once('value')
            ]);
            
            if (!studentsSnapshot.exists() || !verseSnapshot.exists()) return [];
            
            const students = Object.values(studentsSnapshot.val());
            
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
        } catch (error) {
            console.error('말씀별 학생 점수 조회 오류:', error);
            return [];
        }
    }
};

// 전역으로 내보내기
window.FirebaseDB = FirebaseDB;
window.firebaseInitialized = firebaseInitialized;

// 연결 상태 알림
if (firebaseInitialized) {
    console.log('🔥 Firebase 실시간 동기화 활성화됨');
} else {
    console.log('💾 로컬 스토리지 모드로 실행됨');
}

// 데이터베이스 구조 예시
/*
{
  "churches": {
    "church_name": {
      "admin_password": "encrypted_password",
      "verses": {
        "verse_id": {
          "reference": "요한복음 3:16",
          "text": "하나님이 세상을 이처럼 사랑하사...",
          "level": 1,
          "createdAt": "timestamp"
        }
      },
      "students": {
        "student_id": {
          "name": "김학생",
          "scores": {
            "level1": [85, 92, 78],
            "level2": [75, 88],
            "level3": [90]
          },
          "totalScore": 508,
          "gamesPlayed": 6,
          "lastPlayed": "timestamp"
        }
      },
      "rankings": {
        "student_id": {
          "name": "김학생",
          "totalScore": 508,
          "gamesPlayed": 6,
          "averageScore": 84.7
        }
      }
    }
  }
}
*/ 