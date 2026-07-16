let gameSongs = [];
let currentSong = null;
let playedSongsCount = 0;
let totalSongsCount = 0;

let correctAnswersCount = 0;
let wrongAnswersCount = 0;

// Status Game Progresif Sesuai Konsep Koreksi
let currentLife = 10;
let durationIndex = 0;
const durationStages = [1, 3, 5, 10, 30];

// Elemen DOM
const setupSection = document.getElementById('setup-section');
const gameSection = document.getElementById('game-section');
const csvFileInput = document.getElementById('csv-file');
const csvTextarea = document.getElementById('csv-textarea');
const btnStart = document.getElementById('btn-start');
const txtTotalSongs = document.getElementById('total-songs');
const txtRemainingSongs = document.getElementById('remaining-songs');
const txtLivesCounter = document.getElementById('lives-counter');
const txtCurrentDuration = document.getElementById('current-duration');
const txtCorrectCounter = document.getElementById('correct-counter');
const txtWrongCounter = document.getElementById('wrong-counter');
const btnPlay = document.getElementById('btn-play');
const audioPlayer = document.getElementById('audio-player');
const guessInput = document.getElementById('guess-input');
const btnSubmit = document.getElementById('btn-submit');
const btnSkip = document.getElementById('btn-skip');
const songDetail = document.getElementById('song-detail');
const albumCover = document.getElementById('album-cover');
const songTitle = document.getElementById('song-title');
const songArtist = document.getElementById('song-artist');
const btnNext = document.getElementById('btn-next');

// --- 1. PARSER FILE CSV MANUAL (AMAN DESKTOP & MOBILE) ---
function parseCSV(text) {
    const lines = text.split(/\r?\n/);
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
    const trackIdx = headers.indexOf('Track Name');
    const artistIdx = headers.indexOf('Artist Name(s)');

    if (trackIdx === -1 || artistIdx === -1) {
        alert("Format CSV tidak valid! Pastikan teks/file memiliki kolom 'Track Name' dan 'Artist Name(s)'.");
        return [];
    }

    const songs = [];
    
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const matches = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || line.split(',');
        
        let title = matches[trackIdx] ? matches[trackIdx].trim() : "";
        let artist = matches[artistIdx] ? matches[artistIdx].trim() : "";

        title = title.replace(/^["']|["']$/g, '').replace(/\\'/g, "'");
        artist = artist.replace(/^["']|["']$/g, '').replace(/\\'/g, "'");

        if (title) {
            songs.push({ title: title, artist: artist });
        }
    }
    return songs;
}

// --- 2. CLEAN UP TEKS JUDUL ---
function cleanTitle(title) {
    if (!title) return "";
    return title
        .toLowerCase()
        .split(' - ')[0]
        .split('//')[0]
        .replace(/\(prod.*\)/g, '')
        .replace(/\(feat.*\)/g, '')
        .replace(/explicit/g, '')
        .replace(/\(.*\)/g, '')
        .replace(/\[.*\]/g, '')
        .trim();
}

// --- 3. CARI AUDIO DARI ITUNES ---
async function getAppleAudio(title, artist) {
    try {
        const query = encodeURIComponent(`${title} ${artist}`);
        const response = await fetch(`https://itunes.apple.com/search?term=${query}&limit=1&entity=musicTrack`);
        
        if (!response.ok) return null;
        const data = await response.json();
        
        if (data.results && data.results.length > 0 && data.results[0].previewUrl) {
            return {
                audioUrl: data.results[0].previewUrl,
                realCover: data.results[0].artworkUrl100 || ""
            };
        }
    } catch (e) {
        console.error("Gagal memuat audio dari iTunes:", e);
    }
    return null;
}

// --- 4. LOGIKA TOMBOL START GAME (DUA JALUR INPUT) ---
btnStart.addEventListener('click', () => {
    const file = csvFileInput.files[0];
    const rawText = csvTextarea.value.trim();

    btnStart.innerText = "Memproses...";
    btnStart.disabled = true;

    // JALUR 1: Jika ada teks di kolom Textarea (Prioritas Utama untuk Mobile)
    if (rawText.length > 0) {
        processCSVText(rawText);
    } 
    // JALUR 2: Jika menggunakan upload file (Untuk Desktop)
    else if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            processCSVText(e.target.result);
        };
        reader.onerror = function() {
            alert("Gagal membaca file lokal.");
            resetStartButton();
        };
        reader.readAsText(file);
    } 
    // Jika dua-duanya kosong
    else {
        alert("Silakan pilih file CSV atau tempel isi teks CSV terlebih dahulu!");
        resetStartButton();
    }
});

function processCSVText(text) {
    const parsedSongs = parseCSV(text);

    if (parsedSongs.length === 0) {
        resetStartButton();
        return;
    }

    gameSongs = parsedSongs.slice(0, 300);
    totalSongsCount = gameSongs.length;
    playedSongsCount = 0;

    // Reset Skor Statistik
    correctAnswersCount = 0;
    wrongAnswersCount = 0;
    txtCorrectCounter.innerText = "0";
    txtWrongCounter.innerText = "0";

    txtTotalSongs.innerText = `Total Lagu: ${totalSongsCount}`;
    
    setupSection.classList.add('hidden');
    gameSection.classList.remove('hidden');

    startNewRound();
}

function resetStartButton() {
    btnStart.innerText = "Mulai Game";
    btnStart.disabled = false;
}

// --- 5. RONDE BARU ---
async function startNewRound() {
    if (gameSongs.length === 0 || playedSongsCount >= totalSongsCount) {
        alert("Hebat! Semua lagu di playlist sudah selesai dimainkan.");
        location.reload();
        return;
    }

    lockControls();
    btnPlay.innerText = "⏳ Mencari Audio...";

    let foundAudioData = null;
    let randomIndex = -1;

    while (!foundAudioData && gameSongs.length > 0) {
        randomIndex = Math.floor(Math.random() * gameSongs.length);
        currentSong = gameSongs[randomIndex];
        
        foundAudioData = await getAppleAudio(currentSong.title, currentSong.artist);
        
        if (!foundAudioData) {
            gameSongs.splice(randomIndex, 1);
        }
    }

    if (!foundAudioData) {
        alert("Kehabisan lagu yang dapat diputar!");
        location.reload();
        return;
    }

    gameSongs.splice(randomIndex, 1);
    playedSongsCount++;
    txtRemainingSongs.innerText = `Sisa Lagu: ${totalSongsCount - playedSongsCount}/${totalSongsCount}`;

    currentLife = 10;
    durationIndex = 0;

    txtLivesCounter.innerText = `Kesempatan: ${currentLife}/10`;
    txtCurrentDuration.innerText = durationStages[durationIndex];

    audioPlayer.src = foundAudioData.audioUrl;
    audioPlayer.load();

    currentSong.cover = foundAudioData.realCover;

    // Blokir riwayat autocomplete Chrome & Edge dengan merandom nama input
    guessInput.setAttribute('name', 'guess_' + Math.random().toString(36).substring(7));

    guessInput.value = "";
    guessInput.disabled = false;
    btnSubmit.disabled = false;
    btnSkip.disabled = false;
    btnPlay.disabled = false;
    btnPlay.innerText = `▶️ Dengarkan (${durationStages[durationIndex]}s)`;

    songDetail.classList.add('hidden');
}

// --- 6. TOMBOL PLAY AUDIO ---
btnPlay.addEventListener('click', () => {
    const maxDuration = durationStages[durationIndex];
    
    audioPlayer.currentTime = 0;
    audioPlayer.play();
    
    btnPlay.disabled = true;
    btnPlay.innerText = "🔊 Memutar...";

    const checkDuration = setInterval(() => {
        if (audioPlayer.currentTime >= maxDuration) {
            audioPlayer.pause();
            clearInterval(checkDuration);
            btnPlay.disabled = false;
            btnPlay.innerText = `▶️ Dengarkan (${durationStages[durationIndex]}s)`;
        }
    }, 50);
});

// --- 7. LOGIKA VALIDASI TEBAKAN SUBMIT (ANTI-CURANG KARAKTER PENDEK) ---
btnSubmit.addEventListener('click', () => {
    const userGuess = cleanTitle(guessInput.value);
    const actualTitle = cleanTitle(currentSong.title);

    if (userGuess === "") return;

    // PROTEKSI: Jika tebakan kurang dari 3 huruf, langsung anggap salah agar tidak bisa curang 1 huruf
    if (userGuess.length < 3) {
        alert("Tebakan terlalu pendek! Ketik minimal 3 karakter judul lagu.");
        currentLife--;
        guessInput.value = "";
        if (currentLife > 0) {
            txtLivesCounter.innerText = `Kesempatan: ${currentLife}/10`;
        } else {
            handleGameOver();
        }
        return;
    }

    // Validasi Kecocokan Judul
    if (userGuess === actualTitle || actualTitle.includes(userGuess)) {
        handleSuccess();
    } else {
        currentLife--;
        guessInput.value = "";
        
        if (currentLife > 0) {
            txtLivesCounter.innerText = `Kesempatan: ${currentLife}/10`;
        } else {
            handleGameOver();
        }
    }
});

// --- 8. TOMBOL SKIP ---
btnSkip.addEventListener('click', () => {
    if (durationIndex < durationStages.length - 1) {
        durationIndex++;
        currentLife--;
        
        if (currentLife > 0) {
            txtLivesCounter.innerText = `Kesempatan: ${currentLife}/10`;
            txtCurrentDuration.innerText = durationStages[durationIndex];
            btnPlay.innerText = `▶️ Dengarkan (${durationStages[durationIndex]}s)`;
        } else {
            handleGameOver();
        }
    } else {
        currentLife--;
        if (currentLife > 0) {
            txtLivesCounter.innerText = `Kesempatan: ${currentLife}/10`;
        } else {
            handleGameOver();
        }
    }
});

function handleSuccess() {
    audioPlayer.pause();
    lockControls();
    
    correctAnswersCount++;
    txtCorrectCounter.innerText = correctAnswersCount;
    
    albumCover.src = currentSong.cover;
    songTitle.innerText = currentSong.title;
    songArtist.innerText = currentSong.artist;
    songDetail.classList.remove('hidden');
}

function handleGameOver() {
    lockControls();
    txtLivesCounter.innerText = `Kesempatan: 0/10`;
    
    wrongAnswersCount++;
    txtWrongCounter.innerText = wrongAnswersCount;
    
    albumCover.src = currentSong.cover;
    songTitle.innerText = currentSong.title;
    songArtist.innerText = currentSong.artist;
    songDetail.classList.remove('hidden');
}

function lockControls() {
    guessInput.disabled = true;
    btnSubmit.disabled = true;
    btnSkip.disabled = true;
    btnPlay.disabled = true;
}

btnNext.addEventListener('click', async () => {
    await startNewRound();
});