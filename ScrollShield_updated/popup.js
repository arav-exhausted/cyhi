document.addEventListener("DOMContentLoaded", async () => {

    const protectionToggle =
        document.getElementById("protectionToggle");

    const sensitivity =
        document.getElementById("sensitivity");

    const sensitivityValue =
        document.getElementById("sensitivityValue");

    const siteName =
        document.getElementById("siteName");

    const status =
        document.getElementById("status");

    const statusText =
        document.getElementById("statusText");

    const harmfulAction =
        document.getElementById("harmfulAction");

    const attackAction =
        document.getElementById("attackAction");

    const rageAction =
        document.getElementById("rageAction");

    const negativeAction =
        document.getElementById("negativeAction");


    let currentTab = null;


    const defaultSettings = {
        protection: true,
        sensitivity: 70,
        harmfulAction: "blur",
        attackAction: "blur",
        rageAction: "blur",
        negativeAction: "show"
    };


    /* GET CURRENT TAB */

    try {

        const tabs = await chrome.tabs.query({
            active: true,
            currentWindow: true
        });

        if (tabs.length > 0) {

            currentTab = tabs[0];

            try {

                const url =
                    new URL(currentTab.url);

                siteName.textContent =
                    url.hostname;

            } catch {

                siteName.textContent =
                    "Unsupported page";
            }
        }

    } catch (error) {

        console.error(error);

        siteName.textContent =
            "Unknown website";
    }


    /* LOAD SETTINGS */

    try {

        const settings =
            await chrome.storage.local.get(
                defaultSettings
            );

        protectionToggle.checked =
            settings.protection;

        sensitivity.value =
            settings.sensitivity;

        sensitivityValue.textContent =
            settings.sensitivity + "%";

        harmfulAction.value =
            settings.harmfulAction;

        attackAction.value =
            settings.attackAction;

        rageAction.value =
            settings.rageAction;

        negativeAction.value =
            settings.negativeAction;

        updateStatus(
            settings.protection
        );

    } catch (error) {

        console.error(
            "Storage error:",
            error
        );
    }


    /* PROTECTION ON / OFF */

    protectionToggle.addEventListener(
        "change",
        async () => {

            const settings = {

                protection:
                    protectionToggle.checked,

                sensitivity:
                    Number(sensitivity.value),

                harmfulAction:
                    harmfulAction.value,

                attackAction:
                    attackAction.value,

                rageAction:
                    rageAction.value,

                negativeAction:
                    negativeAction.value
            };

            await chrome.storage.local.set(
                settings
            );

            updateStatus(
                settings.protection
            );

            sendSettings(settings);
        }
    );


    /* SENSITIVITY */

    sensitivity.addEventListener(
        "input",
        async () => {

            sensitivityValue.textContent =
                sensitivity.value + "%";

            const settings =
                await chrome.storage.local.get(
                    defaultSettings
                );

            settings.sensitivity =
                Number(sensitivity.value);

            await chrome.storage.local.set(
                settings
            );

            sendSettings(settings);
        }
    );


    /* ACTION SETTINGS */

    harmfulAction.addEventListener(
        "change",
        () => saveAndSend()
    );

    attackAction.addEventListener(
        "change",
        () => saveAndSend()
    );

    rageAction.addEventListener(
        "change",
        () => saveAndSend()
    );

    negativeAction.addEventListener(
        "change",
        () => saveAndSend()
    );


    async function saveAndSend() {

        const settings = {

            protection:
                protectionToggle.checked,

            sensitivity:
                Number(sensitivity.value),

            harmfulAction:
                harmfulAction.value,

            attackAction:
                attackAction.value,

            rageAction:
                rageAction.value,

            negativeAction:
                negativeAction.value
        };

        await chrome.storage.local.set(
            settings
        );

        sendSettings(settings);
    }


    /* SEND TO CONTENT SCRIPT */

    function sendSettings(settings) {

        if (
            !currentTab ||
            !currentTab.id
        ) {
            return;
        }

        chrome.tabs.sendMessage(
            currentTab.id,
            {
                type: "SETTINGS_CHANGED",
                settings: settings
            }
        ).catch(() => {
            console.log(
                "Content script unavailable"
            );
        });
    }


    /* STATUS */

    function updateStatus(enabled) {

        if (enabled) {

            status.classList.remove("off");

            statusText.textContent =
                "Protection active";

        } else {

            status.classList.add("off");

            statusText.textContent =
                "Protection paused";
        }
    }


    /* TABS */

    const tabs =
        document.querySelectorAll(".tab");

    const panels = {

        protect:
            document.getElementById(
                "protectPanel"
            ),

        feed:
            document.getElementById(
                "feedPanel"
            ),

        insights:
            document.getElementById(
                "insightsPanel"
            )
    };


    tabs.forEach(tab => {

        tab.addEventListener(
            "click",
            () => {

                tabs.forEach(item =>
                    item.classList.remove(
                        "active"
                    )
                );

                tab.classList.add("active");

                Object.values(panels)
                    .forEach(panel =>
                        panel.classList.remove(
                            "active"
                        )
                    );

                panels[
                    tab.dataset.tab
                ].classList.add("active");

                if (
                    tab.dataset.tab === "feed"
                ) {

                    requestPageStats();
                }
            }
        );
    });


    /* PAGE STATS */

    function requestPageStats() {

        if (
            !currentTab ||
            !currentTab.id
        ) {
            return;
        }

        chrome.tabs.sendMessage(
            currentTab.id,
            {
                type: "GET_STATS"
            },
            response => {

                if (
                    chrome.runtime.lastError ||
                    !response
                ) {
                    return;
                }

                document.getElementById(
                    "contentCount"
                ).textContent =
                    response.total || 0;

                document.getElementById(
                    "protectedCount"
                ).textContent =
                    response.protected || 0;

                document.getElementById(
                    "visibleCount"
                ).textContent =
                    response.visible || 0;

                document.getElementById(
                    "filteredCount"
                ).textContent =
                    response.filtered || 0;
            }
        );
    }

});