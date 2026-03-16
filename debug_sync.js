const axios = require("axios");

async function debugSync() {
    const schoolId = 'debug-abcde-9999';
    const schoolName = 'DEBUG ABCDE SCHOOL';

    try {
        const response = await axios.post(
            "https://edu-ai-backend-vl7s.onrender.com/admin/sync-school",
            {
                schoolId: schoolId,
                schoolName: schoolName,
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': 'b256f7241feee8f2626d617e4875ca385c47c9fc97b99bd3a6469a84064eff7c',
                },
            }
        );
        console.log('✅ Success:', response.status, response.data);
    } catch (err) {
        console.log('❌ Error:', err.response?.status, err.response?.data || err.message);
    }
}

debugSync();
