const axios = require("axios");

async function testOpenRouter() {
    // Replace this with the actual key from the user's dashboard if they shared it,
    // or use a placeholder to see what error it throws.
    const apiKey = "sk-or-v1-invalid-test-key"; // INTENTIONAL BAD KEY
    const model = "meta-llama/llama-3.1-8b-instruct";

    const messages = [
        { role: "system", content: "You are a helpful educational tutor." },
        { role: "user", content: "Hello" },
    ];

    try {
        const res = await axios.post(
            "https://openrouter.ai/api/v1/chat/completions",
            {
                model,
                messages,
            },
            {
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    "Content-Type": "application/json",
                    "HTTP-Referer": "https://qubiq.ai",
                    "X-Title": "QubiQ Edu AI",
                },
                timeout: 60000,
            }
        );
        console.log("Success:", res.data);
    } catch (err) {
        console.error("Error Status:", err.response?.status);
        console.error("Error Data:", JSON.stringify(err.response?.data));
    }
}

testOpenRouter();
