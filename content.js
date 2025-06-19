const CLOUD_URL = "YOUR_URL_HERE"; //user your JSON BLOB raw URL here
const ENV_OPTIONS = ['Staging', 'Integration', 'Pre Prod', 'Prod'];
const ALLOWED_CLOUD_ENVS = ['Staging', 'Integration', 'Pre Prod']; // Prod is not allowed

function extractUsername(matrixId) {
    const match = typeof matrixId === "string" && matrixId.match(/^@([^:]+):/);
    return match ? match[1] : matrixId;
}

function detectEnvFromHsServer(hsServer) {
    if (!hsServer) return 'Prod';
    const url = hsServer.toLowerCase();
    if (url.includes('staging')) return 'Staging';
    if (url.includes('int')) return 'Integration';
    if (url.includes('vp')) return 'Pre Prod';
    return 'Prod';
}

const fetchTeamAccounts = async () => {
    try {
        const response = await fetch(CLOUD_URL);
        const data = await response.json();
        // Only strictly whitelisted envs, and exclude Prod
        return (data.team_accounts || []).filter(card =>
            ALLOWED_CLOUD_ENVS.includes(card.env)
        );
    } catch (e) {
        return [];
    }
};

const waitForElement = (selector) => {
    return new Promise((resolve) => {
        const observer = new MutationObserver(() => {
            const element = document.querySelector(selector);
            if (element) {
                observer.disconnect();
                resolve(element);
            }
        });
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        const element = document.querySelector(selector);
        if (element) {
            observer.disconnect();
            resolve(element);
        }
    });
};

const fillPassphrase = (passphrase) => {
    const wordsArr = passphrase?.split(" ");
    const dropdown0 = document.getElementById('0_value');
    const dropdown1 = document.getElementById('1_value');
    const dropdown2 = document.getElementById('2_value');
    const dropdown3 = document.getElementById('3_value');
    dropdown0.click();
    const menu0 = document.getElementById("0_listbox");
    menu0.children.namedItem("0__" + wordsArr[0]).click();
    dropdown1.click();
    const menu1 = document.getElementById("1_listbox");
    menu1.children.namedItem("1__" + wordsArr[1]).click();
    dropdown2.click();
    const menu2 = document.getElementById("2_listbox");
    menu2.children.namedItem("2__" + wordsArr[2]).click();
    dropdown3.click();
    const menu3 = document.getElementById("3_listbox");
    menu3.children.namedItem("3__" + wordsArr[3]).click();
};

const getEnvForCurrentSession = () => {
    try {
        const hsServer = localStorage.getItem('otherHsServer');
        return detectEnvFromHsServer(hsServer);
    } catch {
        return 'Prod';
    }
};

const getPassphraseForMatrixId = async (matrixId) => {
    const userOnly = extractUsername(matrixId);
    const envNow = getEnvForCurrentSession();

    // 1. Try cloud, matching both user and env
    const teamAccounts = await fetchTeamAccounts();
    const cloudAcc = teamAccounts.find(acc =>
        acc.user?.toLowerCase() === userOnly?.toLowerCase() &&
        acc.env === envNow
    );          
    if (cloudAcc && cloudAcc.pass) {
        return { response: true, passphrase: cloudAcc.pass, source: "cloud" };
    }

    // 2. Local storage, matching both user and env
    const cards = await chrome.storage.local.get();
    for (const card in cards) {
        if (
            cards[card].user === userOnly &&
            cards[card].env === envNow
        ) {
            return { response: true, passphrase: cards[card].pass, source: "local" };
        }
    }
    return { response: false };
};

// --- CLOUD UPDATE FUNCTION ---
async function updateTeamAccountInCloud(updatedAccounts) {
    try {
        await fetch(CLOUD_URL, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ team_accounts: updatedAccounts })
        });
        return true;
    } catch (err) {
        return false;
    }
}

// --- MAIN SAVE FUNCTION ---
const saveNewPassphrase = async (matrixId, newPassphrase) => {
    const userOnly = extractUsername(matrixId);
    const envNow = getEnvForCurrentSession();
    const cards = await chrome.storage.local.get();

    // 1. Save/update local
    for (const card in cards) {
        if (
            cards[card].user?.toLowerCase() === userOnly?.toLowerCase() &&
            cards[card].env === envNow
        ) {
            const updatedCard = { ...cards[card] };
            updatedCard.pass = newPassphrase;
            chrome.storage.local.set({ [card]: updatedCard });
            // Continue to possibly sync cloud...
            break;
        }
    }
    // If not found, create new entry with detected env
    if (!Object.values(cards).some(card => card.user === userOnly && card.env === envNow)) {
        const idx = Date.now();
        const newCard = { env: envNow, user: userOnly, pass: newPassphrase };
        chrome.storage.local.set({ ['test_' + idx]: newCard });
    }

    // 2. Update cloud only for non-Prod, allowed envs
    if (ALLOWED_CLOUD_ENVS.includes(envNow)) {
        // Fetch current cloud data
        let accounts = [];
        try {
            const resp = await fetch(CLOUD_URL);
            const data = await resp.json();
            accounts = (data.team_accounts || []).filter(card =>
                ALLOWED_CLOUD_ENVS.includes(card.env)
            );
        } catch {
            accounts = [];
        }
        // Update or add
        let updated = false;
        for (const acc of accounts) {
            if (acc.user === userOnly && acc.env === envNow) {
                acc.pass = newPassphrase;
                updated = true;
                break;
            }
        }
        if (!updated) {
            accounts.push({ env: envNow, user: userOnly, pass: newPassphrase });
        }
        // Write back to cloud
        await updateTeamAccountInCloud(accounts);
    }
    return { response: true, passphrase: newPassphrase };
};

// LOGIC

waitForElement('.mx_Dropdown_input').then(async () => {
    const matrixId = localStorage.getItem('mx_user_id');
    const checkObj = await getPassphraseForMatrixId(matrixId);
    if (checkObj?.response) {
        fillPassphrase(checkObj?.passphrase);
    }
}).catch(() => {});

waitForElement('.mx_CreateSecretStorageDialog_recoveryKeyButtons').then(async (element) => {
    const copyBtn = element.childNodes[element.childNodes.length - 1];
    const matrixId = localStorage.getItem('mx_user_id');
    if (copyBtn.innerText === 'Kopieren') {
        copyBtn.addEventListener('click', () => {
            setTimeout(() => {
                navigator.clipboard.readText().then(async (clipboardText) => {
                    const checkObj = await getPassphraseForMatrixId(matrixId);
                    // Always allow updating/creating local, and sync with cloud if allowed
                    await saveNewPassphrase(matrixId, clipboardText);
                });
            }, 10);
        });
    }
}).catch(() => {});

// EVENT HANDLING

chrome.runtime.onMessage.addListener(async (request) => {
    const passphrase = request.passphrase;
    fillPassphrase(passphrase);
});
