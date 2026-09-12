console.log(
    "%c[ScrollShield] Loaded",
    "color:#ff633b;font-weight:bold;"
);

let settings = {
    protection: true,
    sensitivity: 70,
    harmfulAction: "blur",
    attackAction: "blur",
    rageAction: "blur",
    negativeAction: "show"
};

let stats = {
    total: 0,
    protected: 0,
    visible: 0,
    filtered: 0
};

/* =========================
   TOXIC WORDS / PHRASES
   ========================= */

const harmfulWords = [
    "kill",
    "die",
    "death threat",
    "i will hurt",
    "hurt you",
    "go die"
];

const attackWords = [
    "idiot",
    "stupid",
    "loser",
    "moron",
    "dumb",
    "pathetic",
    "shut up"
];

const rageWords = [
    "everyone knows",
    "worst ever",
    "destroyed",
    "you people",
    "disgusting"
];

function escapeRegex(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getToxicPatterns() {
    const items = [];

    harmfulWords.forEach(word => {
        items.push({
            word,
            category: "harmful",
            confidence: 0.95,
            toxicity: 50
        });
    });

    attackWords.forEach(word => {
        items.push({
            word,
            category: "personal_attack",
            confidence: 0.90,
            toxicity: 50
        });
    });

    rageWords.forEach(word => {
        items.push({
            word,
            category: "rage_bait",
            confidence: 0.80,
            toxicity: 50
        });
    });

    items.sort((a, b) => b.word.length - a.word.length);

    return items;
}

const toxicPatterns = getToxicPatterns();

function getPatternRegex() {
    const pattern = toxicPatterns
        .map(item => escapeRegex(item.word))
        .join("|");

    return new RegExp("\\b(" + pattern + ")\\b", "gi");
}

/* =========================
   DETECTION
   ========================= */

function detectContent(text) {
    const lower = text.toLowerCase();

    for (const word of harmfulWords) {
        if (lower.includes(word)) {
            return {
                category: "harmful",
                confidence: 0.95,
                toxicity: 50
            };
        }
    }

    for (const word of attackWords) {
        if (lower.includes(word)) {
            return {
                category: "personal_attack",
                confidence: 0.90,
                toxicity: 50
            };
        }
    }

    for (const word of rageWords) {
        if (lower.includes(word)) {
            return {
                category: "rage_bait",
                confidence: 0.80,
                toxicity: 50
            };
        }
    }

    return {
        category: "neutral",
        confidence: 0
    };
}

/* =========================
   FIND CONTENT
   ========================= */

function getPosts() {
    const hostname = window.location.hostname;
    let selector;

    if (hostname.includes("reddit.com")) {

        selector = "shreddit-post, article";

    } else if (hostname.includes("youtube.com")) {

        selector =
            "ytd-rich-item-renderer, " +
            "ytd-video-renderer, " +
            "ytd-comment-thread-renderer";

    } else if (
        hostname.includes("x.com") ||
        hostname.includes("twitter.com")
    ) {

        selector = "article";

    } else if (hostname.includes("instagram.com")) {

        selector = "article";

    } else if (hostname.includes("wikipedia.org")) {

        selector =
            "#mw-content-text p, " +
            "#mw-content-text li, " +
            "#mw-content-text h1, " +
            "#mw-content-text h2, " +
            "#mw-content-text h3, " +
            "#mw-content-text h4";

    } else {

        selector =
            "article, [role='article'], [data-testid='post']";
    }

    return document.querySelectorAll(selector);
}

/* =========================
   CHOOSE ACTION
   ========================= */

function getAction(category) {

    if (category === "harmful") {
        return settings.harmfulAction;
    }

    if (category === "personal_attack") {
        return settings.attackAction;
    }

    if (category === "rage_bait") {
        return settings.rageAction;
    }

    return "show";
}

/* =========================
   BLUR ONLY TOXIC WORDS
   ========================= */

function wrapToxicWords(element) {

    const walker = document.createTreeWalker(
        element,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode(node) {

                const parent = node.parentElement;

                if (!parent) {
                    return NodeFilter.FILTER_REJECT;
                }

                if (
                    parent.closest(".scrollshield-toxic-word") ||
                    parent.closest(
                        "script, style, noscript, textarea, input"
                    )
                ) {
                    return NodeFilter.FILTER_REJECT;
                }

                return NodeFilter.FILTER_ACCEPT;
            }
        }
    );

    const textNodes = [];
    let node;

    while ((node = walker.nextNode())) {
        textNodes.push(node);
    }

    const regex = getPatternRegex();

    textNodes.forEach(textNode => {

        const text = textNode.nodeValue;

        regex.lastIndex = 0;

        if (!regex.test(text)) {
            return;
        }

        regex.lastIndex = 0;

        const fragment = document.createDocumentFragment();

        let lastIndex = 0;
        let match;

        while ((match = regex.exec(text)) !== null) {

            if (match.index > lastIndex) {

                fragment.appendChild(
                    document.createTextNode(
                        text.slice(lastIndex, match.index)
                    )
                );
            }

            const matchedWord = match[0];

            const toxicInfo = toxicPatterns.find(
                item =>
                    item.word.toLowerCase() ===
                    matchedWord.toLowerCase()
            );

            const span = document.createElement("span");

            span.className = "scrollshield-toxic-word";

            span.textContent = matchedWord;

            span.dataset.scrollshieldCategory =
                toxicInfo
                    ? toxicInfo.category
                    : "personal_attack";

            span.dataset.scrollshieldConfidence =
                toxicInfo
                    ? toxicInfo.confidence
                    : "0.90";

            span.dataset.scrollshieldToxicity =
                toxicInfo
                    ? toxicInfo.toxicity
                    : "50";

            span.setAttribute("tabindex", "0");

            span.setAttribute("role", "button");

            span.setAttribute(
                "aria-label",
                "Toxic word. Click to request permission to reveal."
            );

            fragment.appendChild(span);

            lastIndex =
                match.index + matchedWord.length;
        }

        if (lastIndex < text.length) {

            fragment.appendChild(
                document.createTextNode(
                    text.slice(lastIndex)
                )
            );
        }

        textNode.parentNode.replaceChild(
            fragment,
            textNode
        );
    });
}

/* =========================
   REVEAL PERMISSION UI
   ========================= */

let revealBox = null;
let revealTimer = null;

function closeRevealBox() {

    if (revealBox) {
        revealBox.remove();
        revealBox = null;
    }

    if (revealTimer) {
        clearTimeout(revealTimer);
        revealTimer = null;
    }
}

function showRevealPermission(word) {

    closeRevealBox();

    const toxicity =
        Number(
            word.dataset.scrollshieldToxicity || 0
        );

    revealBox = document.createElement("div");

    revealBox.className =
        "scrollshield-reveal-box";

    revealBox.innerHTML = `
        <div class="scrollshield-reveal-title">
            Toxic content detected
        </div>

        <div class="scrollshield-reveal-score">
            Toxicity: <strong>${toxicity}%</strong>
        </div>

        <div class="scrollshield-reveal-question">
            Do you want to reveal this word?
        </div>

        <div class="scrollshield-reveal-actions">

            <button
                type="button"
                class="scrollshield-reveal-yes"
            >
                Reveal
            </button>

            <button
                type="button"
                class="scrollshield-reveal-no"
            >
                Keep blurred
            </button>

        </div>
    `;

    document.body.appendChild(revealBox);

    const rect =
        word.getBoundingClientRect();

    const boxRect =
        revealBox.getBoundingClientRect();

    let top = rect.bottom + 8;
    let left = rect.left;

    if (
        top + boxRect.height >
        window.innerHeight - 8
    ) {
        top =
            rect.top -
            boxRect.height -
            8;
    }

    if (
        left + boxRect.width >
        window.innerWidth - 8
    ) {
        left =
            window.innerWidth -
            boxRect.width -
            8;
    }

    if (left < 8) {
        left = 8;
    }

    if (top < 8) {
        top = 8;
    }

    revealBox.style.top =
        `${top}px`;

    revealBox.style.left =
        `${left}px`;

    revealBox
        .querySelector(
            ".scrollshield-reveal-yes"
        )
        .addEventListener(
            "click",
            event => {

                event.stopPropagation();

                word.classList.remove(
                    "scrollshield-word-blur"
                );

                word.classList.add(
                    "scrollshield-word-revealed"
                );

                closeRevealBox();

                revealTimer =
                    setTimeout(() => {

                        if (
                            word.isConnected &&
                            settings.protection
                        ) {

                            word.classList.remove(
                                "scrollshield-word-revealed"
                            );

                            const action =
                                getAction(
                                    word.dataset
                                        .scrollshieldCategory
                                );

                            if (action === "blur") {

                                word.classList.add(
                                    "scrollshield-word-blur"
                                );
                            }
                        }

                    }, 5000);
            }
        );

    revealBox
        .querySelector(
            ".scrollshield-reveal-no"
        )
        .addEventListener(
            "click",
            event => {

                event.stopPropagation();

                closeRevealBox();
            }
        );
}

function setupRevealEvents() {

    document.addEventListener(
        "click",
        event => {

            const word =
                event.target.closest?.(
                    ".scrollshield-toxic-word." +
                    "scrollshield-word-blur"
                );

            if (word) {

                event.preventDefault();
                event.stopPropagation();

                showRevealPermission(word);

                return;
            }

            if (
                revealBox &&
                !event.target.closest(
                    ".scrollshield-reveal-box"
                )
            ) {

                closeRevealBox();
            }
        },
        true
    );

    document.addEventListener(
        "keydown",
        event => {

            if (
                event.key !== "Enter" &&
                event.key !== " "
            ) {
                return;
            }

            const word =
                document.activeElement?.closest?.(
                    ".scrollshield-toxic-word." +
                    "scrollshield-word-blur"
                );

            if (word) {

                event.preventDefault();

                showRevealPermission(word);
            }
        }
    );
}

setupRevealEvents();

/* =========================
   APPLY WORD-LEVEL SETTINGS
   ========================= */

function applySettings() {

    document
        .querySelectorAll(
            ".scrollshield-toxic-word"
        )
        .forEach(word => {

            word.classList.remove(
                "scrollshield-word-blur",
                "scrollshield-word-hidden"
            );

            word.style.display = "";

            if (!settings.protection) {
                return;
            }

            const category =
                word.dataset.scrollshieldCategory;

            const confidence =
                Number(
                    word.dataset
                        .scrollshieldConfidence
                );

            if (
                confidence <
                settings.sensitivity / 100
            ) {
                return;
            }

            const action =
                getAction(category);

            if (action === "blur") {

                word.classList.add(
                    "scrollshield-word-blur"
                );

            } else if (action === "hide") {

                word.classList.add(
                    "scrollshield-word-hidden"
                );
            }
        });

    updateFilteredCount();
}

/* =========================
   STATS
   ========================= */

function updateFilteredCount() {

    stats.filtered =
        document.querySelectorAll(
            ".scrollshield-word-blur, " +
            ".scrollshield-word-hidden"
        ).length;
}

/* =========================
   SCAN PAGE
   ========================= */
async function predictWithModel(text) {
    try {
        const response = await fetch("http://127.0.0.1:8000/predict", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                text: text
            })
        });

        if (!response.ok) {
            throw new Error("Prediction request failed");
        }

        const result = await response.json();

        console.log("[ScrollShield] ML Result:", result);

        return result;

    } catch (error) {
        console.error("[ScrollShield] ML Error:", error);
        return null;
    }
}
function scanPage() {

    const posts = getPosts();

    posts.forEach(post => {

        if (
            post.dataset.scrollshieldChecked ===
            "true"
        ) {
            return;
        }

        const text =
            post.innerText || "";

        if (
            text.trim().length < 1 ||
            text.length > 10000
        ) {
            return;
        }

        post.dataset.scrollshieldChecked =
            "true";

        stats.total++;

        const result =
            detectContent(text);

        const payload = {

            source:
                window.location.hostname,

            url:
                window.location.href,

            content:
                text,

            timestamp:
                new Date().toISOString(),

            sensitivity:
                settings.sensitivity,

            prediction:
                result
        };

        console.log(
            "[ScrollShield] JSON:",
            payload
        );

        if (
            result.category !== "neutral"
        ) {

            post.dataset.scrollshieldCategory =
                result.category;

            post.dataset.scrollshieldConfidence =
                result.confidence;

            stats.protected++;

            wrapToxicWords(post);

        } else {

            stats.visible++;
        }
    });

    applySettings();
}

/* =========================
   REMOVE WORD FILTERS
   ========================= */

function clearWordFilters() {

    document
        .querySelectorAll(
            ".scrollshield-toxic-word"
        )
        .forEach(span => {

            const text =
                document.createTextNode(
                    span.textContent
                );

            span.parentNode.replaceChild(
                text,
                span
            );
        });

    document
        .querySelectorAll(
            "[data-scrollshield-checked]"
        )
        .forEach(element => {

            delete element.dataset
                .scrollshieldChecked;
        });

    document
        .querySelectorAll(
            "[data-scrollshield-category]"
        )
        .forEach(element => {

            delete element.dataset
                .scrollshieldCategory;

            delete element.dataset
                .scrollshieldConfidence;
        });
}

/* =========================
   SETTINGS
   ========================= */

function refreshFromSettings() {

    if (!settings.protection) {

        applySettings();

        return;
    }

    applySettings();
}

/* =========================
   LOAD SETTINGS
   ========================= */

chrome.storage.local.get(
    settings,
    data => {

        settings = data;

        scanPage();
    }
);

/* =========================
   MESSAGE FROM POPUP
   ========================= */

chrome.runtime.onMessage.addListener(
    (message, sender, sendResponse) => {

        if (
            message.type ===
            "SETTINGS_CHANGED"
        ) {

            settings =
                message.settings;

            console.log(
                "[ScrollShield] Settings changed:",
                settings
            );

            refreshFromSettings();
        }

        if (
            message.type ===
            "GET_STATS"
        ) {

            updateFilteredCount();

            sendResponse(stats);
        }
    }
);

/* =========================
   WATCH FOR DYNAMIC CONTENT
   ========================= */

let scanTimer = null;

const observer =
    new MutationObserver(
        mutations => {

            let shouldScan = false;

            for (
                const mutation of mutations
            ) {

                if (
                    mutation.type !==
                    "childList"
                ) {
                    continue;
                }

                for (
                    const node of
                    mutation.addedNodes
                ) {

                    if (
                        node.nodeType !==
                        Node.ELEMENT_NODE
                    ) {
                        continue;
                    }

                    /*
                     * Ignore elements created
                     * by ScrollShield itself.
                     */

                    if (
                        node.classList?.contains(
                            "scrollshield-toxic-word"
                        ) ||
                        node.classList?.contains(
                            "scrollshield-reveal-box"
                        )
                    ) {
                        continue;
                    }

                    if (
                        node.closest?.(
                            ".scrollshield-toxic-word, " +
                            ".scrollshield-reveal-box"
                        )
                    ) {
                        continue;
                    }

                    shouldScan = true;

                    break;
                }

                if (shouldScan) {
                    break;
                }
            }

            if (!shouldScan) {
                return;
            }

            /*
             * Debounce scanning.
             *
             * Dynamic websites can add many
             * elements very quickly.
             */

            clearTimeout(scanTimer);

            scanTimer =
                setTimeout(
                    () => {
                        scanPage();
                    },
                    300
                );
        }
    );

/* =========================
   START OBSERVER
   ========================= */

function startObserver() {

    if (!document.body) {

        setTimeout(
            startObserver,
            100
        );

        return;
    }

    observer.observe(
        document.body,
        {
            childList: true,
            subtree: true
        }
    );

    console.log(
        "[ScrollShield] Dynamic content observer started"
    );
}
startObserver();
/* =========================
   INITIAL SCAN
   ========================= */
setTimeout(
    scanPage,
    1000
);
