const fetchTeamAccounts = async () => {
    try {
        const url = await getCloudUrlFromStorage();
        if (!url) return [];
        const response = await fetch(url);
        const data = await response.json();
        return (data.team_accounts || []).filter(card =>
            ALLOWED_CLOUD_ENVS.includes(card.env)
        );
    } catch (e) {
        console.error("Could not fetch team accounts:", e);
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
    try {
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
    } catch (e) {
        console.error('Error filling passphrase (fillPassphrase)', e);
    }
};

const getEnvForCurrentSession = () => {
    try {
        const hsServer = localStorage.getItem('otherHsServer');
        return detectEnvFromHsServer(hsServer);
    } catch (e) {
        console.error('Error detecting env from hsServer', e);
        return 'Prod';
    }
};

const getPassphraseForMatrixId = async (matrixId) => {
    try {
        const userOnly = extractUsername(matrixId);
        const envNow = getEnvForCurrentSession();

        const teamAccounts = await fetchTeamAccounts();
        const cloudAcc = teamAccounts.find(acc =>
            acc.user?.toLowerCase() === userOnly?.toLowerCase() &&
            acc.env === envNow
        );
        if (cloudAcc && cloudAcc.pass) {
            return { response: true, passphrase: cloudAcc.pass, source: "cloud" };
        }

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
    } catch (e) {
        console.error('Error getting passphrase for matrix id', e);
        return { response: false };
    }
};

chrome.runtime.onMessage.addListener((request) => {
  if (request.action === "fillDropdowns" && request.passphrase) {
    try {
      fillPassphrase(request.passphrase);
    } catch (e) {
      console.error('Error in onMessage fillPassphrase', e);
    }
  }
});

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
                    await saveNewPassphrase(matrixId, clipboardText);
                });
            }, 10);
        });
    }
}).catch(() => {});

async function saveNewPassphrase(matrixId, newPassphrase) {
    try {
        const userOnly = extractUsername(matrixId);
        const envNow = getEnvForCurrentSession();
        const cards = await chrome.storage.local.get();

        for (const card in cards) {
            if (
                cards[card].user?.toLowerCase() === userOnly?.toLowerCase() &&
                cards[card].env === envNow
            ) {
                const updatedCard = { ...cards[card] };
                updatedCard.pass = newPassphrase;
                chrome.storage.local.set({ [card]: updatedCard });
                break;
            }
        }
        if (!Object.values(cards).some(card => card.user === userOnly && card.env === envNow)) {
            const idx = Date.now();
            const newCard = { env: envNow, user: userOnly, pass: newPassphrase };
            chrome.storage.local.set({ ['test_' + idx]: newCard });
        }

        if (ALLOWED_CLOUD_ENVS.includes(envNow)) {
            let accounts = [];
            try {
                const url = await getCloudUrlFromStorage();
                const resp = await fetch(url);
                const data = await resp.json();
                accounts = (data.team_accounts || []).filter(card =>
                    ALLOWED_CLOUD_ENVS.includes(card.env)
                );
            } catch (e) {
                console.error('Error fetching cloud accounts before update', e);
                accounts = [];
            }
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
            await updateTeamAccountInCloud(accounts);
        }
        return { response: true, passphrase: newPassphrase };
    } catch (e) {
        console.error('Failed to save new passphrase', e);
        return { response: false };
    }
}

async function updateTeamAccountInCloud(updatedAccounts) {
    try {
        const url = await getCloudUrlFromStorage();
        await fetch(url, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ team_accounts: updatedAccounts })
        });
        return true;
    } catch (err) {
        console.error('Failed to update team accounts in cloud', err);
        return false;
    }
}
