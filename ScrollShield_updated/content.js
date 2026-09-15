// ============================================================
// ScrollShield - ML + Individual Word ML Detection
// ============================================================

console.log(
    "%c[ScrollShield] ML + WORD ML Version Loaded",
    "color:#ff633b;font-weight:bold;"
);


// ============================================================
// SETTINGS
// ============================================================

let settings = {
    protection: true,
    sensitivity: 70,

    harmfulAction: "blur",
    attackAction: "blur",
    rageAction: "blur",
    negativeAction: "show"
};


let stats = {
    scanned: 0,
    protected: 0,
    visible: 0
};


let scanTimer = null;
let scanning = false;


// ============================================================
// CACHE
// ============================================================

// Word -> ML result
// Prevents repeated API calls for the same word.
const wordPredictionCache = new Map();


// Maximum unique words checked from one content block.
const MAX_WORDS_PER_BLOCK = 25;


// Minimum word length.
const MIN_WORD_LENGTH = 3;


// ============================================================
// WORDS TO IGNORE
// ============================================================

// These are NOT toxic words.
// They are only common words that are not useful to send
// individually to the toxicity classifier.

const ignoredCommonWords = new Set([
    "the",
    "and",
    "for",
    "that",
    "this",
    "with",
    "from",
    "have",
    "has",
    "had",
    "will",
    "would",
    "could",
    "should",
    "there",
    "their",
    "they",
    "them",
    "then",
    "than",
    "what",
    "when",
    "where",
    "which",
    "while",
    "about",
    "after",
    "before",
    "because",
    "being",
    "been",
    "into",
    "your",
    "you",
    "yours",
    "ours",
    "our",
    "are",
    "was",
    "were",
    "is",
    "am",
    "not",
    "but",
    "can",
    "may",
    "also",
    "just",
    "very",
    "more",
    "most",
    "some",
    "such",
    "only",
    "other",
    "another",
    "these",
    "those",
    "people",
    "person",
    "they",
    "their",
    "here",
    "there",
    "from",
    "over",
    "under",
    "again",
    "once",
    "many",
    "much",
    "more",
    "less",
    "like",
    "know",
    "think",
    "want",
    "need",
    "make",
    "made",
    "does",
    "did",
    "doing",
    "get",
    "got",
    "getting",
    "give",
    "gave",
    "take",
    "took",
    "come",
    "came",
    "going",
    "go",
    "see",
    "saw",
    "look",
    "looks",
    "use",
    "used",
    "using",
    "good",
    "great",
    "well",
    "really",
    "still",
    "even",
    "much",
    "back",
    "down",
    "very",
    "yourself",
    "themselves"
]);


// ============================================================
// HELPERS
// ============================================================

function getAction(category) {

    switch (category) {

        case "harmful":
            return settings.harmfulAction;

        case "personal_attack":
            return settings.attackAction;

        case "rage_bait":
            return settings.rageAction;

        case "negative":
            return settings.negativeAction;

        default:
            return "show";
    }
}


function passesSensitivity(confidence) {

    const sensitivity =
        Number(settings.sensitivity ?? 70);

    const value =
        Number(confidence || 0);

    const threshold =
        1 - sensitivity / 100;

    return value >= threshold;
}


function normalizeWord(word) {

    return String(word || "")
        .toLowerCase()
        .replace(/^[^a-zA-Z]+|[^a-zA-Z]+$/g, "")
        .trim();
}


// ============================================================
// ML REQUEST
// ============================================================

function predictWithML(text) {

    return new Promise(resolve => {

        if (!text || !text.trim()) {

            resolve(null);

            return;
        }


        chrome.runtime.sendMessage(
            {
                type: "ML_PREDICT",
                text: text
            },

            response => {

                if (chrome.runtime.lastError) {

                    console.error(
                        "[ScrollShield] ML connection error:",
                        chrome.runtime.lastError.message
                    );

                    resolve(null);

                    return;
                }


                if (
                    !response ||
                    !response.success
                ) {

                    console.error(
                        "[ScrollShield] ML prediction failed:",
                        response?.error
                    );

                    resolve(null);

                    return;
                }


                resolve(response.result);
            }
        );
    });
}


// ============================================================
// ML CLASSIFICATION
// ============================================================

async function detectContent(text) {

    const ml =
        await predictWithML(text);


    if (!ml) {

        return {
            category: "neutral",
            confidence: 0,
            toxicity: 0,
            label: "neutral",
            scores: {}
        };
    }


    const scores =
        ml.scores || {};


    const toxic =
        Number(scores.toxic || 0);

    const severeToxic =
        Number(scores.severe_toxic || 0);

    const obscene =
        Number(scores.obscene || 0);

    const threat =
        Number(scores.threat || 0);

    const insult =
        Number(scores.insult || 0);

    const identityHate =
        Number(scores.identity_hate || 0);


    const threshold =
        Number(ml.threshold || 0.5);


    // --------------------------------------------------------
    // HARMFUL
    // --------------------------------------------------------

    const harmful =
        Math.max(
            severeToxic,
            threat,
            identityHate
        );


    if (harmful >= threshold) {

        let label = "identity_hate";


        if (threat === harmful) {

            label = "threat";

        }
        else if (severeToxic === harmful) {

            label = "severe_toxic";
        }


        return {
            category: "harmful",
            confidence: harmful,
            toxicity: Math.round(harmful * 100),
            label: label,
            scores: scores
        };
    }


    // --------------------------------------------------------
    // PERSONAL ATTACK
    // --------------------------------------------------------

    const attack =
        Math.max(
            toxic,
            insult
        );


    if (attack >= threshold) {

        return {
            category: "personal_attack",
            confidence: attack,
            toxicity: Math.round(attack * 100),

            label:
                insult >= toxic
                    ? "insult"
                    : "toxic",

            scores: scores
        };
    }


    // --------------------------------------------------------
    // NEGATIVE / OBSCENE
    // --------------------------------------------------------

    if (obscene >= threshold) {

        return {
            category: "negative",
            confidence: obscene,
            toxicity: Math.round(obscene * 100),
            label: "obscene",
            scores: scores
        };
    }


    // --------------------------------------------------------
    // NEUTRAL
    // --------------------------------------------------------

    return {
        category: "neutral",
        confidence: 0,
        toxicity: 0,
        label: "neutral",
        scores: scores
    };
}


// ============================================================
// WORD ML CLASSIFICATION
// ============================================================

async function detectWord(word) {

    const normalized =
        normalizeWord(word);


    if (
        !normalized ||
        normalized.length < MIN_WORD_LENGTH
    ) {

        return null;
    }


    if (
        ignoredCommonWords.has(normalized)
    ) {

        return null;
    }


    // --------------------------------------------------------
    // CACHE
    // --------------------------------------------------------

    if (
        wordPredictionCache.has(normalized)
    ) {

        return wordPredictionCache.get(
            normalized
        );
    }


    // --------------------------------------------------------
    // SEND WORD TO ML
    // --------------------------------------------------------

    const result =
        await detectContent(normalized);


    if (result) {

        wordPredictionCache.set(
            normalized,
            result
        );
    }


    return result;
}


// ============================================================
// EXTRACT CANDIDATE WORDS
// ============================================================

function getCandidateWords(text) {

    const matches =
        String(text || "")
            .match(/[A-Za-z]{3,}/g) || [];


    const unique =
        new Set();


    for (
        const rawWord of matches
    ) {

        const word =
            normalizeWord(rawWord);


        if (!word) {
            continue;
        }


        if (
            word.length <
            MIN_WORD_LENGTH
        ) {
            continue;
        }


        if (
            ignoredCommonWords.has(word)
        ) {
            continue;
        }


        unique.add(word);


        if (
            unique.size >=
            MAX_WORDS_PER_BLOCK
        ) {
            break;
        }
    }


    return [...unique];
}


// ============================================================
// IGNORE ELEMENTS
// ============================================================

function isIgnoredElement(element) {

    if (!element) {
        return true;
    }


    if (
        element === document.body ||
        element === document.documentElement
    ) {

        return true;
    }


    const tag =
        element.tagName;


    if (
        [
            "SCRIPT",
            "STYLE",
            "NOSCRIPT",
            "TEMPLATE",
            "INPUT",
            "TEXTAREA",
            "SELECT",
            "OPTION"
        ].includes(tag)
    ) {

        return true;
    }


    // Never scan actual input/search controls.
    if (
        element.isContentEditable ||
        element.closest?.(
            "input, textarea, [contenteditable='true']"
        )
    ) {

        return true;
    }


    return false;
}


// ============================================================
// FIND POSTS / CONTENT
// ============================================================

function getPosts() {

    const posts =
        new Set();


    const hostname =
        location.hostname.toLowerCase();


    // --------------------------------------------------------
    // REDDIT
    // --------------------------------------------------------

    if (
        hostname.includes(
            "reddit.com"
        )
    ) {

        document
            .querySelectorAll(
                [
                    "shreddit-post",
                    "article[data-testid='post-container']",
                    "[data-testid='comment']",
                    "article"
                ].join(",")
            )
            .forEach(element => {

                if (
                    !isIgnoredElement(element)
                ) {

                    posts.add(element);
                }
            });
    }


    // --------------------------------------------------------
    // YOUTUBE
    // --------------------------------------------------------

    if (
        hostname.includes(
            "youtube.com"
        )
    ) {

        document
            .querySelectorAll(
                [
                    "ytd-comment-thread-renderer",
                    "ytd-comment-view-model",
                    "ytd-comment-renderer",
                    "ytd-video-renderer",
                    "ytd-rich-item-renderer"
                ].join(",")
            )
            .forEach(element => {

                if (
                    !isIgnoredElement(element)
                ) {

                    posts.add(element);
                }
            });
    }


    // --------------------------------------------------------
    // X / TWITTER
    // --------------------------------------------------------

    if (
        hostname.includes(
            "twitter.com"
        ) ||
        hostname.includes(
            "x.com"
        )
    ) {

        document
            .querySelectorAll(
                "article[data-testid='tweet']"
            )
            .forEach(element => {

                if (
                    !isIgnoredElement(element)
                ) {

                    posts.add(element);
                }
            });
    }


    // --------------------------------------------------------
    // INSTAGRAM
    // --------------------------------------------------------

    if (
        hostname.includes(
            "instagram.com"
        )
    ) {

        document
            .querySelectorAll(
                "article"
            )
            .forEach(element => {

                if (
                    !isIgnoredElement(element)
                ) {

                    posts.add(element);
                }
            });
    }


    // --------------------------------------------------------
    // GOOGLE / GENERIC WEB
    // --------------------------------------------------------

    document
        .querySelectorAll(
            [
                "article",
                "section",
                "main p",
                "main li",
                "main blockquote",
                "[role='article']",
                "[data-testid*='result']",
                "[data-testid*='comment']"
            ].join(",")
        )
        .forEach(element => {

            if (
                isIgnoredElement(element)
            ) {

                return;
            }


            const text =
                (
                    element.innerText ||
                    element.textContent ||
                    ""
                ).trim();


            if (
                text.length < 3
            ) {

                return;
            }


            if (
                text.length > 5000
            ) {

                return;
            }


            posts.add(element);
        });


    return [...posts];
}


// ============================================================
// TEXT EXTRACTION
// ============================================================

function getPostText(post) {

    if (!post) {
        return "";
    }


    return (
        post.innerText ||
        post.textContent ||
        ""
    ).trim();
}


// ============================================================
// CLEAR WHOLE-POST PROTECTION
// ============================================================

function clearPostProtection(post) {

    if (!post) {
        return;
    }


    post.classList.remove(
        "scrollshield-ml-blur"
    );


    post.style.filter = "";

    post.style.userSelect = "";

    post.style.cursor = "";


    if (
        post.dataset
            .scrollshieldHidden ===
        "true"
    ) {

        post.style.display = "";

        delete post.dataset
            .scrollshieldHidden;
    }
}


// ============================================================
// CREATE WORD BLUR
// ============================================================

function blurToxicWord(
    textNode,
    word,
    result
) {

    if (
        !textNode ||
        !textNode.parentNode
    ) {

        return;
    }


    if (
        textNode.parentElement?.closest(
            ".scrollshield-toxic-word"
        )
    ) {

        return;
    }


    const text =
        textNode.nodeValue || "";


    if (!text.trim()) {
        return;
    }


    const normalizedTarget =
        normalizeWord(word);


    if (!normalizedTarget) {
        return;
    }


    const regex =
        new RegExp(
            `\\b${normalizedTarget.replace(
                /[.*+?^${}()|[\]\\]/g,
                "\\$&"
            )}\\b`,
            "gi"
        );


    if (!regex.test(text)) {
        return;
    }


    regex.lastIndex = 0;


    const fragment =
        document.createDocumentFragment();


    let lastIndex = 0;

    let match;


    while (
        (match = regex.exec(text))
        !== null
    ) {

        const before =
            text.slice(
                lastIndex,
                match.index
            );


        if (before) {

            fragment.appendChild(
                document.createTextNode(
                    before
                )
            );
        }


        const span =
            document.createElement(
                "span"
            );


        span.className =
            "scrollshield-toxic-word";


        span.dataset
            .scrollshieldWord =
            normalizedTarget;


        span.dataset
            .scrollshieldToxicity =
            String(
                result.toxicity || 0
            );


        span.dataset
            .scrollshieldConfidence =
            String(
                result.confidence || 0
            );


        span.dataset
            .scrollshieldCategory =
            result.category || "personal_attack";


        span.textContent =
            match[0];


        Object.assign(
            span.style,
            {
                filter: "blur(7px)",
                userSelect: "none",
                cursor: "pointer",
                borderRadius: "3px",
                transition: "filter 0.15s ease"
            }
        );


        fragment.appendChild(span);


        lastIndex =
            match.index +
            match[0].length;
    }


    const after =
        text.slice(lastIndex);


    if (after) {

        fragment.appendChild(
            document.createTextNode(
                after
            )
        );
    }


    textNode.parentNode.replaceChild(
        fragment,
        textNode
    );
}


// ============================================================
// WALK TEXT NODES
// ============================================================

function getTextNodes(element) {

    const nodes = [];


    if (!element) {
        return nodes;
    }


    const walker =
        document.createTreeWalker(
            element,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode(node) {

                    const parent =
                        node.parentElement;


                    if (!parent) {

                        return NodeFilter.FILTER_REJECT;
                    }


                    const tag =
                        parent.tagName;


                    if (
                        [
                            "SCRIPT",
                            "STYLE",
                            "NOSCRIPT",
                            "TEXTAREA",
                            "INPUT",
                            "BUTTON",
                            "SELECT"
                        ].includes(tag)
                    ) {

                        return NodeFilter.FILTER_REJECT;
                    }


                    if (
                        parent.closest(
                            [
                                ".scrollshield-toxic-word",
                                ".scrollshield-toxicity-popup",
                                "input",
                                "textarea",
                                "[contenteditable='true']"
                            ].join(",")
                        )
                    ) {

                        return NodeFilter.FILTER_REJECT;
                    }


                    if (
                        !node.nodeValue ||
                        !node.nodeValue.trim()
                    ) {

                        return NodeFilter.FILTER_REJECT;
                    }


                    return NodeFilter.FILTER_ACCEPT;
                }
            }
        );


    let node;


    while (
        (node = walker.nextNode())
    ) {

        nodes.push(node);
    }


    return nodes;
}


// ============================================================
// WORD SCAN
// ============================================================

async function scanIndividualWords(
    post,
    originalText
) {

    if (!post) {
        return;
    }


    // Don't individually scan a post
    // that is already whole-post blurred.
    if (
        post.classList.contains(
            "scrollshield-ml-blur"
        )
    ) {

        return;
    }


    const candidates =
        getCandidateWords(
            originalText
        );


    if (!candidates.length) {
        return;
    }


    const toxicWords = [];


    // --------------------------------------------------------
    // ML CHECK EACH CANDIDATE
    // --------------------------------------------------------

    for (
        const word of candidates
    ) {

        const result =
            await detectWord(word);


        if (!result) {
            continue;
        }


        if (
            result.category ===
            "neutral"
        ) {

            continue;
        }


        if (
            !passesSensitivity(
                result.confidence
            )
        ) {

            continue;
        }


        const action =
            getAction(
                result.category
            );


        // If the setting says show,
        // don't blur the word.
        if (
            action === "show"
        ) {

            continue;
        }


        if (
            action === "blur" ||
            action === "hide"
        ) {

            toxicWords.push({
                word: word,
                result: result
            });
        }
    }


    if (!toxicWords.length) {
        return;
    }


    // --------------------------------------------------------
    // APPLY WORD BLUR
    // --------------------------------------------------------

    const nodes =
        getTextNodes(post);


    for (
        const item of toxicWords
    ) {

        const currentNodes =
            [...nodes];


        for (
            const node of currentNodes
        ) {

            if (
                !node.parentNode
            ) {

                continue;
            }


            if (
                node.parentElement?.closest(
                    ".scrollshield-toxic-word"
                )
            ) {

                continue;
            }


            blurToxicWord(
                node,
                item.word,
                item.result
            );
        }
    }


    if (
        post.querySelector(
            ".scrollshield-toxic-word"
        )
    ) {

        post.dataset
            .scrollshieldWordProtected =
            "true";
    }
}


// ============================================================
// APPLY WHOLE ML RESULT
// ============================================================

function applyMLResult(
    post,
    result
) {

    if (
        !post ||
        !result
    ) {

        return;
    }


    clearPostProtection(post);


    const category =
        result.category ||
        "neutral";


    const confidence =
        Number(
            result.confidence || 0
        );


    post.dataset
        .scrollshieldCategory =
        category;


    post.dataset
        .scrollshieldConfidence =
        String(confidence);


    post.dataset
        .scrollshieldLabel =
        result.label ||
        category;


    post.dataset
        .scrollshieldToxicity =
        String(
            result.toxicity || 0
        );


    post.dataset
        .scrollshieldScores =
        JSON.stringify(
            result.scores || {}
        );


    if (
        !settings.protection
    ) {

        return;
    }


    if (
        category === "neutral"
    ) {

        return;
    }


    if (
        !passesSensitivity(
            confidence
        )
    ) {

        return;
    }


    const action =
        getAction(category);


    // --------------------------------------------------------
    // SHOW
    // --------------------------------------------------------

    if (
        action === "show"
    ) {

        return;
    }


    // --------------------------------------------------------
    // HIDE
    // --------------------------------------------------------

    if (
        action === "hide"
    ) {

        post.style.display =
            "none";


        post.dataset
            .scrollshieldHidden =
            "true";


        return;
    }


    // --------------------------------------------------------
    // BLUR
    // --------------------------------------------------------

    if (
        action === "blur"
    ) {

        post.style.filter =
            "blur(10px)";


        post.style.userSelect =
            "none";


        post.style.cursor =
            "pointer";


        post.classList.add(
            "scrollshield-ml-blur"
        );
    }
}


// ============================================================
// SCAN ONE POST
// ============================================================

async function scanPost(post) {

    if (
        !post ||
        isIgnoredElement(post)
    ) {

        return;
    }


    const text =
        getPostText(post);


    if (
        !text ||
        text.length < 2
    ) {

        return;
    }


    const currentText =
        text.substring(
            0,
            10000
        );


    // Don't scan unchanged content.
    if (
        post.dataset
            .scrollshieldLastText ===
        currentText
    ) {

        return;
    }


    post.dataset
        .scrollshieldLastText =
        currentText;


    stats.scanned++;


    try {

        // ----------------------------------------------------
        // STEP 1: WHOLE CONTENT ML
        // ----------------------------------------------------

        const result =
            await detectContent(text);


        console.log(
            "[ScrollShield] ML JSON:",
            {
                text:
                    text.substring(
                        0,
                        150
                    ),

                ...result
            }
        );


        // ----------------------------------------------------
        // STEP 2: APPLY WHOLE CONTENT RESULT
        // ----------------------------------------------------

        applyMLResult(
            post,
            result
        );


        // ----------------------------------------------------
        // STEP 3: IF WHOLE CONTENT IS NEUTRAL,
        // CHECK INDIVIDUAL WORDS WITH ML
        // ----------------------------------------------------

        if (
            result.category ===
            "neutral"
        ) {

            await scanIndividualWords(
                post,
                text
            );
        }

    }
    catch (error) {

        console.error(
            "[ScrollShield] Scan error:",
            error
        );
    }
}


// ============================================================
// SCAN PAGE
// ============================================================

async function scanPage() {

    if (
        scanning ||
        !settings.protection
    ) {

        return;
    }


    scanning = true;


    try {

        const posts =
            getPosts();


        console.log(
            "[ScrollShield] Found",
            posts.length,
            "posts"
        );


        for (
            const post of posts
        ) {

            await scanPost(
                post
            );
        }


        updateFilteredCount();

    }
    catch (error) {

        console.error(
            "[ScrollShield] Page scan error:",
            error
        );

    }
    finally {

        scanning = false;
    }
}


// ============================================================
// SCHEDULE SCAN
// ============================================================

function scheduleScan() {

    clearTimeout(
        scanTimer
    );


    scanTimer =
        setTimeout(
            () => {

                scanPage();

            },
            700
        );
}


// ============================================================
// COUNT PROTECTED
// ============================================================

function updateFilteredCount() {

    const wholePosts =
        document.querySelectorAll(
            ".scrollshield-ml-blur"
        ).length;


    const toxicWords =
        document.querySelectorAll(
            ".scrollshield-toxic-word"
        ).length;


    stats.protected =
        wholePosts +
        toxicWords;


    console.log(
        "[ScrollShield] ML-protected elements:",
        stats.protected
    );


    chrome.runtime.sendMessage(
        {
            type:
                "SCROLLSHIELD_STATS",

            stats: {
                scanned:
                    stats.scanned,

                protected:
                    stats.protected
            }
        },

        () => {

            void chrome.runtime.lastError;
        }
    );
}


// ============================================================
// REMOVE WORD BLUR
// ============================================================

function revealToxicWord(
    wordElement
) {

    if (!wordElement) {
        return;
    }


    const text =
        wordElement.textContent || "";


    const textNode =
        document.createTextNode(
            text
        );


    wordElement.replaceWith(
        textNode
    );
}


// ============================================================
// CLEAR WHOLE + WORD FILTERS
// ============================================================

function clearFilters() {

    document
        .querySelectorAll(
            ".scrollshield-ml-blur"
        )
        .forEach(post => {

            clearPostProtection(
                post
            );
        });


    document
        .querySelectorAll(
            ".scrollshield-toxic-word"
        )
        .forEach(word => {

            revealToxicWord(
                word
            );
        });


    document
        .querySelectorAll(
            "[data-scrollshield-last-text]"
        )
        .forEach(post => {

            delete post.dataset
                .scrollshieldLastText;
        });


    stats = {
        scanned: 0,
        protected: 0,
        visible: 0
    };


    updateFilteredCount();
}


// ============================================================
// APPLY SETTINGS
// ============================================================

function applySettings() {

    if (
        !settings.protection
    ) {

        clearFilters();

        return;
    }


    // --------------------------------------------------------
    // WHOLE POSTS
    // --------------------------------------------------------

    document
        .querySelectorAll(
            "[data-scrollshield-category]"
        )
        .forEach(post => {

            const category =
                post.dataset
                    .scrollshieldCategory;


            const confidence =
                Number(
                    post.dataset
                        .scrollshieldConfidence ||
                    0
                );


            if (
                category === "neutral" ||
                !passesSensitivity(
                    confidence
                )
            ) {

                clearPostProtection(
                    post
                );

                return;
            }


            const action =
                getAction(
                    category
                );


            if (
                action === "show"
            ) {

                clearPostProtection(
                    post
                );

            }
            else if (
                action === "hide"
            ) {

                clearPostProtection(
                    post
                );


                post.style.display =
                    "none";


                post.dataset
                    .scrollshieldHidden =
                    "true";

            }
            else if (
                action === "blur"
            ) {

                post.style.filter =
                    "blur(10px)";


                post.style.userSelect =
                    "none";


                post.style.cursor =
                    "pointer";


                post.classList.add(
                    "scrollshield-ml-blur"
                );
            }
        });


    // --------------------------------------------------------
    // INDIVIDUAL WORDS
    // --------------------------------------------------------

    document
        .querySelectorAll(
            ".scrollshield-toxic-word"
        )
        .forEach(word => {

            const category =
                word.dataset
                    .scrollshieldCategory ||
                "personal_attack";


            const confidence =
                Number(
                    word.dataset
                        .scrollshieldConfidence ||
                    0
                );


            if (
                !passesSensitivity(
                    confidence
                )
            ) {

                revealToxicWord(
                    word
                );

                return;
            }


            const action =
                getAction(
                    category
                );


            if (
                action === "show"
            ) {

                revealToxicWord(
                    word
                );

            }
            else if (
                action === "blur"
            ) {

                word.style.filter =
                    "blur(7px)";


                word.style.userSelect =
                    "none";


                word.style.cursor =
                    "pointer";
            }
        });


    updateFilteredCount();
}


// ============================================================
// TOXICITY POPUP
// ============================================================

let scrollShieldPopup =
    null;


function removeToxicityPopup() {

    if (
        scrollShieldPopup
    ) {

        scrollShieldPopup.remove();

        scrollShieldPopup =
            null;
    }
}


// ============================================================
// CREATE TOXICITY POPUP
// ============================================================

function createToxicityPopup(
    target,
    toxicity,
    onReveal
) {

    removeToxicityPopup();


    toxicity =
        Math.max(
            0,
            Math.min(
                100,
                Number(
                    toxicity || 0
                )
            )
        );


    const popup =
        document.createElement(
            "div"
        );


    popup.className =
        "scrollshield-toxicity-popup";


    popup.innerHTML = `
        <div class="scrollshield-toxicity-title">
            Toxicity detected
        </div>

        <div class="scrollshield-toxicity-percent">
            ${toxicity}%
        </div>

        <button
            type="button"
            class="scrollshield-reveal-btn"
        >
            Reveal
        </button>
    `;


    Object.assign(
        popup.style,
        {
            position: "fixed",
            zIndex: "2147483647",

            padding: "12px 14px",

            minWidth: "150px",

            background: "#171717",
            color: "#ffffff",

            border:
                "1px solid #444444",

            borderRadius: "10px",

            boxShadow:
                "0 8px 30px rgba(0,0,0,0.45)",

            fontFamily:
                "Arial, sans-serif",

            textAlign: "center",

            lineHeight: "1.3"
        }
    );


    const title =
        popup.querySelector(
            ".scrollshield-toxicity-title"
        );


    Object.assign(
        title.style,
        {
            fontSize: "12px",
            opacity: "0.75",
            marginBottom: "4px"
        }
    );


    const percentage =
        popup.querySelector(
            ".scrollshield-toxicity-percent"
        );


    Object.assign(
        percentage.style,
        {
            fontSize: "24px",
            fontWeight: "700",
            marginBottom: "10px"
        }
    );


    const revealButton =
        popup.querySelector(
            ".scrollshield-reveal-btn"
        );


    Object.assign(
        revealButton.style,
        {
            border: "none",
            borderRadius: "6px",

            padding:
                "7px 16px",

            background: "#ffffff",
            color: "#111111",

            fontSize: "13px",

            fontWeight: "700",

            cursor: "pointer"
        }
    );


    document.body.appendChild(
        popup
    );


    scrollShieldPopup =
        popup;


    const rect =
        target.getBoundingClientRect();


    const popupRect =
        popup.getBoundingClientRect();


    let left =
        rect.left +
        (
            rect.width / 2
        ) -
        (
            popupRect.width / 2
        );


    let top =
        rect.bottom + 8;


    left =
        Math.max(
            8,
            Math.min(
                left,
                window.innerWidth -
                popupRect.width -
                8
            )
        );


    if (
        top +
        popupRect.height >
        window.innerHeight - 8
    ) {

        top =
            rect.top -
            popupRect.height -
            8;
    }


    if (top < 8) {
        top = 8;
    }


    popup.style.left =
        `${left}px`;


    popup.style.top =
        `${top}px`;


    revealButton.addEventListener(
        "click",

        event => {

            event.preventDefault();
            event.stopPropagation();


            onReveal();


            removeToxicityPopup();
        },

        true
    );
}


// ============================================================
// CLICK HANDLER
// ============================================================

document.addEventListener(
    "click",

    event => {

        // ----------------------------------------------------
        // INDIVIDUAL TOXIC WORD
        // ----------------------------------------------------

        const word =
            event.target.closest?.(
                ".scrollshield-toxic-word"
            );


        if (word) {

            event.preventDefault();
            event.stopPropagation();


            const toxicity =
                Number(
                    word.dataset
                        .scrollshieldToxicity ||
                    0
                );


            createToxicityPopup(
                word,
                toxicity,

                () => {

                    revealToxicWord(
                        word
                    );


                    // Re-blur after 5 seconds.
                    setTimeout(
                        () => {

                            if (
                                !document.body
                                    .contains(word)
                            ) {

                                return;
                            }


                            // The original span was
                            // replaced by a text node,
                            // so recreate the span.
                            const parent =
                                word.parentNode;


                            if (!parent) {
                                return;
                            }


                            const span =
                                document.createElement(
                                    "span"
                                );


                            span.className =
                                "scrollshield-toxic-word";


                            span.textContent =
                                word.textContent;


                            span.dataset
                                .scrollshieldWord =
                                word.dataset
                                    .scrollshieldWord;


                            span.dataset
                                .scrollshieldToxicity =
                                word.dataset
                                    .scrollshieldToxicity;


                            span.dataset
                                .scrollshieldConfidence =
                                word.dataset
                                    .scrollshieldConfidence;


                            span.dataset
                                .scrollshieldCategory =
                                word.dataset
                                    .scrollshieldCategory;


                            Object.assign(
                                span.style,
                                {
                                    filter:
                                        "blur(7px)",

                                    userSelect:
                                        "none",

                                    cursor:
                                        "pointer",

                                    borderRadius:
                                        "3px"
                                }
                            );


                            parent.replaceChild(
                                span,
                                word
                            );


                            updateFilteredCount();

                        },
                        5000
                    );
                }
            );


            return;
        }


        // ----------------------------------------------------
        // WHOLE POST
        // ----------------------------------------------------

        const post =
            event.target.closest?.(
                ".scrollshield-ml-blur"
            );


        if (!post) {
            return;
        }


        event.preventDefault();
        event.stopPropagation();


        const toxicity =
            Number(
                post.dataset
                    .scrollshieldToxicity ||
                0
            );


        createToxicityPopup(
            post,
            toxicity,

            () => {

                post.classList.remove(
                    "scrollshield-ml-blur"
                );


                post.style.filter =
                    "none";


                post.style.userSelect =
                    "";


                post.style.cursor =
                    "default";


                post.dataset
                    .scrollshieldRevealed =
                    "true";


                // Re-blur whole post after 5 sec.
                setTimeout(
                    () => {

                        if (
                            !document.body
                                .contains(post)
                        ) {

                            return;
                        }


                        if (
                            post.dataset
                                .scrollshieldRevealed !==
                            "true"
                        ) {

                            return;
                        }


                        post.style.filter =
                            "blur(10px)";


                        post.style.userSelect =
                            "none";


                        post.style.cursor =
                            "pointer";


                        post.classList.add(
                            "scrollshield-ml-blur"
                        );


                        delete post.dataset
                            .scrollshieldRevealed;


                        updateFilteredCount();

                    },
                    5000
                );
            }
        );
    },

    true
);


// ============================================================
// CLOSE POPUP WHEN CLICKING OUTSIDE
// ============================================================

document.addEventListener(
    "click",

    event => {

        if (
            !scrollShieldPopup
        ) {

            return;
        }


        if (
            scrollShieldPopup.contains(
                event.target
            )
        ) {

            return;
        }


        const word =
            event.target.closest?.(
                ".scrollshield-toxic-word"
            );


        const post =
            event.target.closest?.(
                ".scrollshield-ml-blur"
            );


        if (
            !word &&
            !post
        ) {

            removeToxicityPopup();
        }
    }
);


// ============================================================
// STORAGE CHANGES
// ============================================================

chrome.storage.onChanged.addListener(
    (
        changes,
        area
    ) => {

        if (
            area !== "sync" &&
            area !== "local"
        ) {

            return;
        }


        let changed =
            false;


        Object.keys(
            changes
        ).forEach(
            key => {

                if (
                    Object.prototype
                        .hasOwnProperty
                        .call(
                            settings,
                            key
                        )
                ) {

                    settings[key] =
                        changes[key]
                            .newValue;


                    changed =
                        true;
                }
            }
        );


        if (
            changed
        ) {

            console.log(
                "[ScrollShield] Settings changed:",
                settings
            );


            applySettings();


            document
                .querySelectorAll(
                    "[data-scrollshield-category]"
                )
                .forEach(post => {

                    delete post.dataset
                        .scrollshieldLastText;
                });


            scheduleScan();
        }
    }
);


// ============================================================
// POPUP / EXTENSION MESSAGES
// ============================================================

chrome.runtime.onMessage.addListener(
    (
        message,
        sender,
        sendResponse
    ) => {

        if (!message) {
            return;
        }


        // ----------------------------------------------------
        // UPDATE SETTINGS
        // ----------------------------------------------------

        if (
            message.type ===
            "SCROLLSHIELD_UPDATE_SETTINGS"
        ) {

            settings = {
                ...settings,
                ...(message.settings || {})
            };


            applySettings();


            document
                .querySelectorAll(
                    "[data-scrollshield-category]"
                )
                .forEach(post => {

                    delete post.dataset
                        .scrollshieldLastText;
                });


            scheduleScan();


            sendResponse({
                success: true
            });


            return true;
        }


        // ----------------------------------------------------
        // SETTINGS CHANGED
        // ----------------------------------------------------

        if (
            message.type ===
            "SETTINGS_CHANGED"
        ) {

            settings = {
                ...settings,
                ...(message.settings || {})
            };


            applySettings();


            document
                .querySelectorAll(
                    "[data-scrollshield-category]"
                )
                .forEach(post => {

                    delete post.dataset
                        .scrollshieldLastText;
                });


            scheduleScan();


            sendResponse({
                success: true
            });


            return true;
        }


        // ----------------------------------------------------
        // SCAN
        // ----------------------------------------------------

        if (
            message.type ===
            "SCROLLSHIELD_SCAN"
        ) {

            scheduleScan();


            sendResponse({
                success: true
            });


            return true;
        }


        // ----------------------------------------------------
        // GET STATS
        // ----------------------------------------------------

        if (
            message.type ===
            "GET_STATS"
        ) {

            updateFilteredCount();


            sendResponse({

                total:
                    stats.scanned,

                protected:
                    stats.protected,

                visible:
                    stats.visible

            });


            return true;
        }


        // ----------------------------------------------------
        // CLEAR
        // ----------------------------------------------------

        if (
            message.type ===
            "SCROLLSHIELD_CLEAR" ||

            message.type ===
            "CLEAR_FILTERS"
        ) {

            clearFilters();


            sendResponse({
                success: true
            });


            return true;
        }
    }
);


// ============================================================
// MUTATION OBSERVER
// ============================================================

const observer =
    new MutationObserver(
        mutations => {

            let shouldScan =
                false;


            for (
                const mutation of mutations
            ) {

                if (
                    mutation.type !==
                    "childList"
                ) {

                    continue;
                }


                if (
                    !mutation.addedNodes ||
                    !mutation.addedNodes.length
                ) {

                    continue;
                }


                shouldScan =
                    true;


                break;
            }


            if (
                shouldScan &&
                settings.protection
            ) {

                scheduleScan();
            }
        }
    );


// ============================================================
// START OBSERVER
// ============================================================

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
        "[ScrollShield] Mutation observer started"
    );
}


startObserver();


// ============================================================
// LOAD SETTINGS
// ============================================================

function loadSettings() {

    chrome.storage.sync.get(
        settings,

        saved => {

            if (
                chrome.runtime.lastError
            ) {

                console.error(
                    "[ScrollShield] Settings load error:",
                    chrome.runtime.lastError.message
                );


                scheduleScan();


                return;
            }


            settings = {
                ...settings,
                ...saved
            };


            console.log(
                "[ScrollShield] Settings loaded:",
                settings
            );


            scheduleScan();
        }
    );
}


// ============================================================
// INITIALIZE
// ============================================================

if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",

        () => {

            loadSettings();
        }
    );

}
else {

    loadSettings();
}


console.log(
    "%c[ScrollShield] Ready - ML whole content + ML words",
    "color:#00a86b;font-weight:bold;"
);