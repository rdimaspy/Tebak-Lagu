let gameSongs = [];
let currentSong = null;
let playedSongsCount = 0;
let totalSongsCount = 0;

// Tambahkan pencatat skor benar & salah di sini:
let correctAnswersCount = 0;
let wrongAnswersCount = 0;

// Status Game Progresif Sesuai Konsep Koreksi
let currentLife = 10;
let durationIndex = 0;
const durationStages = [1, 3, 5, 10, 30]; // 5 Tahap Durasi Utama

// Elemen DOM
const setupSection = document.getElementById('setup-section');
const gameSection = document.getElementById('game-section');
const csvFileInput = document.getElementById('csv-file');
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

// --- 1. PARSER FILE CSV MANUAL (MEMBACA TRACK & ARTIST) ---
// --- 1. PARSER FILE CSV MANUAL (VERSI AMAN MOBILE & DESKTOP) ---
function parseCSV(text) {
    // Memotong baris dengan regex agar mendukung \n maupun \r\n bawaan HP
    const lines = text.split(/\r?\n/);
    if (lines.length < 2) return [];

    // Ambil header untuk mencari indeks kolom
    const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
    const trackIdx = headers.indexOf('Track Name');
    const artistIdx = headers.indexOf('Artist Name(s)');

    if (trackIdx === -1 || artistIdx === -1) {
        alert("Format CSV tidak cocok! Pastikan file adalah hasil ekspor Spotify asli.");
        return [];
    }

    const songs = [];
    
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Regex yang lebih aman untuk memisahkan koma di dalam tanda kutip
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

// --- 2. CLEAN UP TEKS JUDUL UNTUK VALIDASI TEBAKAN ---
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

// --- 3. CARI AUDIO DARI ITUNES (SUPER INSTAN & BEBAS CORS) ---
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

// --- 4. LOGIKA TOMBOL START GAME (READ FILE) ---
btnStart.addEventListener('click', () => {
    const file = csvFileInput.files[0];
    
    if (!file) {
        alert("Silakan pilih file playlist terlebih dahulu!");
        return;
    }

    // Validasi manual ekstensi file secara internal
    if (!file.name.endsWith('.csv')) {
        alert("File yang kamu pilih bukan .csv! Pastikan mengunggah file playlist berformat .csv hasil ekspor Spotify.");
        // Otomatis reset tombol agar bisa diklik lagi tanpa perlu refresh
        resetStartButton();
        return;
    }

    btnStart.innerText = "Membaca CSV...";
    btnStart.disabled = true;

    const reader = new FileReader();
    
    reader.onload = async function(e) {
        try {
            const text = e.target.result;
            const parsedSongs = parseCSV(text);

            if (parsedSongs.length === 0) {
                alert("Tidak ada lagu yang berhasil dibaca. Pastikan isi kolom CSV sudah benar.");
                resetStartButton();
                return;
            }

            gameSongs = parsedSongs.slice(0, 300);
            totalSongsCount = gameSongs.length;
            playedSongsCount = 0;

            txtTotalSongs.innerText = `Total Lagu: ${totalSongsCount}`;
            
            setupSection.classList.add('hidden');
            gameSection.classList.remove('hidden');

            await startNewRound();
        } catch (error) {
            console.error(error);
            alert("Gagal memproses file pada perangkat ini.");
            resetStartButton();
        }
    };

    reader.onerror = function() {
        alert("Gagal membaca file secara total. Coba pakai browser utama seperti Chrome/Safari.");
        resetStartButton();
    };

    reader.readAsText(file);
});

function resetStartButton() {
    btnStart.innerText = "Mulai Game";
    btnStart.disabled = false;
}

// --- 5. MEMULAI RONDE BARU ---
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

    // Cari lagu acak dari data CSV yang cuplikan mp3-nya tersedia di iTunes
    while (!foundAudioData && gameSongs.length > 0) {
        randomIndex = Math.floor(Math.random() * gameSongs.length);
        currentSong = gameSongs[randomIndex];
        
        foundAudioData = await getAppleAudio(currentSong.title, currentSong.artist);
        
        if (!foundAudioData) {
            // Jika audio tidak ketemu di iTunes, lewati dan buang lagu ini
            gameSongs.splice(randomIndex, 1);
        }
    }

    if (!foundAudioData) {
        alert("Kehabisan lagu yang dapat diputar dari file ini!");
        location.reload();
        return;
    }

    // Hapus dari antrean babak game agar tidak duplikat keluar lagi
    gameSongs.splice(randomIndex, 1);
    playedSongsCount++;
    txtRemainingSongs.innerText = `Sisa Lagu: ${totalSongsCount - playedSongsCount}/${totalSongsCount}`;

    // Reset Nyawa dan Index Durasi ke Awal (1 Detik)
    currentLife = 10;
    durationIndex = 0;

    txtLivesCounter.innerText = `Kesempatan: ${currentLife}/10`;
    txtCurrentDuration.innerText = durationStages[durationIndex];

    // Hubungkan link audio pratinjau mp3 ke elemen audio
    audioPlayer.src = foundAudioData.audioUrl;
    audioPlayer.load();

    currentSong.cover = foundAudioData.realCover;

    // Buka kembali kontrol interaksi game
    guessInput.setAttribute('name', 'guess_' + Math.random().toString(36).substring(7));

    guessInput.value = "";
    guessInput.disabled = false;
    btnSubmit.disabled = false;
    btnSkip.disabled = false;
    btnPlay.disabled = false;
    btnPlay.innerText = `▶️ Dengarkan (${durationStages[durationIndex]}s)`;
    
    songDetail.classList.add('hidden');
}

// --- 6. LOGIKA TOMBOL PLAY AUDIO INSTAN ---
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

// --- 7. LOGIKA TOMBOL SUBMIT ---
btnSubmit.addEventListener('click', () => {
    const userGuess = cleanTitle(guessInput.value);
    const actualTitle = cleanTitle(currentSong.title);

    if (userGuess === "") return;

    if (userGuess === actualTitle || actualTitle.includes(userGuess)) {
        handleSuccess();
    } else {
        currentLife--;
        guessInput.value = ""; // Bersihkan kolom input otomatis kalau tebakan salah
        
        if (currentLife > 0) {
            txtLivesCounter.innerText = `Kesempatan: ${currentLife}/10`;
        } else {
            handleGameOver();
        }
    }
});

// --- 8. LOGIKA TOMBOL SKIP ---
btnSkip.addEventListener('click', () => {
    if (durationIndex < durationStages.length - 1) {
        durationIndex++;
        currentLife--; // Mengurangi nyawa murni karena skip durasi
        
        if (currentLife > 0) {
            txtLivesCounter.innerText = `Kesempatan: ${currentLife}/10`;
            txtCurrentDuration.innerText = durationStages[durationIndex];
            btnPlay.innerText = `▶️ Dengarkan (${durationStages[durationIndex]}s)`;
        } else {
            handleGameOver();
        }
    } else {
        // Jika durasi sudah mentok 30 detik tapi skip lagi, kurangi nyawa murni
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
    
    // Tambah skor BENAR dan perbarui tampilannya
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
    
    // Tambah skor SALAH dan perbarui tampilannya
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