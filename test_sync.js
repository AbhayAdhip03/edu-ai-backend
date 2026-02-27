const axios = require("axios");

async function testSync() {
    const schoolId = '51f29b5b-e408-4be0-9a36-d95c863d81ac'; // example testing school
    const validKey = 'sk-or-v1-testingsync'; // dummy key

    const keys = {
        chat: validKey,
        helpbot: validKey,
        image: validKey,
        audio: null,
        translate: validKey,
        emmiLite: validKey,
        blockly: validKey,
    };

    try {
        const response = await axios.post(
            "https://edu-ai-backend-vl7s.onrender.com/admin/school-keys",
            {
                schoolId: schoolId,
                keys: keys,
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': 'b256f7241feee8f2626d617e4875ca385c47c9fc97b99bd3a6469a84064eff7c',
                },
            }
        );
        console.log('Success:', response.status, response.data);
    } catch (err) {
        console.log('Error:', err.response?.status, err.response?.data);
    }
}

testSync();
