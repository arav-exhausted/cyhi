const ML_API_URL = "http://127.0.0.1:8000/predict";

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type !== "ML_PREDICT") {
        return;
    }

    fetch(ML_API_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            text: message.text
        })
    })
        .then(response => {
            if (!response.ok) {
                throw new Error(
                    `ML API returned ${response.status}`
                );
            }

            return response.json();
        })
        .then(result => {
            sendResponse({
                success: true,
                result: result
            });
        })
        .catch(error => {
            console.error(
                "[ScrollShield Background] ML API error:",
                error
            );

            sendResponse({
                success: false,
                error: error.message
            });
        });

    return true;
});