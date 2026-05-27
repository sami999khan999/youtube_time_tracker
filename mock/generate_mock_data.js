const fs = require('fs');
const path = require('path');

const channels = [
    "Comedy Central", "MKBHD", "Veritasium", "Vsauce", "Mark Rober", 
    "Linus Tech Tips", "Kurzgesagt", "3Blue1Brown", "Computerphile", "Tom Scott"
];

const videosTitles = [
    "Key & Peele - Sex Detective - Uncensored",
    "The World’s Worst Translator | Alternatino",
    "Key & Peele - Turbulence - Uncensored",
    "The TRUTH about Apple's new chips",
    "How to build a particle accelerator",
    "Why you should never trust your brain",
    "I built a giant laser to cut squirrels",
    "The math of bubbles",
    "Why 1/log(x) is actually interesting",
    "The history of everything, I guess",
    "I tried the weirdest gadgets in Japan",
    "My secret to productivity",
    "Inside the most expensive house in the world",
    "Cooking a 100 layer lasagna",
    "Is this the future of gaming?"
];

function generateMockData(daysToGenerate = 730) {
    const today = new Date();
    const allHistory = {};

    for (let i = 0; i < daysToGenerate; i++) {
        const currentDate = new Date();
        currentDate.setDate(today.getDate() - i);
        
        const year = currentDate.getFullYear();
        const month = String(currentDate.getMonth() + 1).padStart(2, '0');
        const day = String(currentDate.getDate()).padStart(2, '0');
        const dateKey = `${year}-${month}-${day}`;

        const videoCount = Math.floor(Math.random() * 6) + 10; // 10 to 15 videos
        const videos = [];
        let dayWatchTime = 0;

        for (let j = 0; j < videoCount; j++) {
            const videoId = `vid_${i}_${j}_` + Math.random().toString(36).substring(7);
            const duration = Math.floor(Math.random() * 600) + 120; // 2 to 12 minutes
            const watched = Math.floor(Math.random() * (duration - 10)) + 10;
            const startTime = new Date(currentDate);
            startTime.setHours(Math.floor(Math.random() * 24), Math.floor(Math.random() * 60));

            videos.push({
                channelName: channels[Math.floor(Math.random() * channels.length)],
                currentPosition: watched,
                id: videoId,
                lastUpdated: Date.now() - (i * 86400000),
                startTime: startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
                thumbnail: `https://i.ytimg.com/vi/foT9rsHmS24/hqdefault.jpg`,
                title: videosTitles[Math.floor(Math.random() * videosTitles.length)],
                totalDuration: duration,
                uid: `${dateKey}_${videoId}`,
                watchedDuration: watched
            });
            dayWatchTime += watched;
        }

        allHistory[dateKey] = {
            activeTime: dayWatchTime + (Math.random() * 1000),
            sessionStart: Date.now() - (i * 86400000),
            videos: videos,
            watchTime: dayWatchTime
        };
    }

    const fullData = {
        allHistory,
        shortsBlockerSettings: { enabled: true },
        breakSettings: {
            enabled: true,
            intervalMinutes: 15,
            workUrl: "https://www.google.com"
        },
        backupSettings: {
            enabled: true,
            intervalHours: 24,
            backupOnClose: true,
            maxBackups: 10
        },
        retentionSettings: {
            duration: -1
        },
        dislikeCountSettings: {
            enabled: true
        }
    };

    return JSON.stringify(fullData, null, 2);
}

const outputPath = path.join(__dirname, 'mock_history_2_years.json');
console.log('Generating data...');
const mockData = generateMockData(730);
fs.writeFileSync(outputPath, mockData);
console.log(`✅ Success! Data created at: ${outputPath}`);
