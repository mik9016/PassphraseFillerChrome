let cardIndex = 0;

function debounce(func, delay) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), delay);
    };
}

function saveLocal(index, key, value) {
    chrome.storage.local.get(['test_' + index], (intermediateCard) => {
        let entry = intermediateCard['test_' + index] || { env: ENV_OPTIONS[0], user: '', pass: '' };
        entry[key] = value;
        chrome.storage.local.set({ ['test_' + index]: entry }, () => {
            if (chrome.runtime.lastError) {
                console.error(`Failed to save ${key} for test_${index}`, chrome.runtime.lastError);
            }
        });
    });
}

async function tryCloudSyncAndRemoveIfNeeded(index) {
    chrome.storage.local.get(['test_' + index], async (intermediateCard) => {
        let entry = intermediateCard['test_' + index] || {};
        const user = entry.user?.trim();
        const env = entry.env;
        const pass = entry.pass;
        if (user && pass && env && env !== "Prod") {
            const url = await getCloudUrlFromStorage();
            if (!url) return;
            let data = {};
            try {
                const response = await fetch(url);
                data = await response.json();
            } catch (e) {
                console.error("Could not fetch team accounts for sync", e);
                return;
            }
            let cloudArr = (data.team_accounts || []).filter(card => ALLOWED_CLOUD_ENVS.includes(card.env));
            let found = false;
            for (let cloudCard of cloudArr) {
                if (cloudCard.user?.toLowerCase() === user.toLowerCase() && cloudCard.env === env) {
                    cloudCard.pass = pass;
                    found = true;
                    break;
                }
            }
            if (!found) {
                cloudArr.push({ env, user, pass });
            }
            try {
                await fetch(url, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ team_accounts: cloudArr })
                });
            } catch (e) {
                console.error("Failed to update cloud accounts", e);
                return;
            }
            chrome.storage.local.remove(['test_' + index], () => {
                renderAllCards();
            });
        }
    });
}

const getAllStorageKeys = async () => {
    return new Promise((resolve, reject) => {
        chrome.storage.local.get(null, (items) => {
            if (chrome.runtime.lastError) {
                console.error('chrome.storage.local.get failed', chrome.runtime.lastError);
                return reject(chrome.runtime.lastError);
            }
            resolve(items);
        });
    });
};

async function fetchTeamAccounts() {
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
}

function createEnvDropdown(id, value, onChange) {
    const select = document.createElement('select');
    select.id = id;
    ENV_OPTIONS.forEach(opt => {
        const option = document.createElement('option');
        option.value = opt;
        option.textContent = opt;
        if (opt === value) option.selected = true;
        select.appendChild(option);
    });
    select.addEventListener('change', onChange);
    select.style.width = '73%';
    return select;
}

function createCloudCard(card) {
    const accountCart = document.createElement('div');
    accountCart.className = 'accountCart cloudCard';
    const form = document.createElement('form');
    form.className = 'cloudForm';

    const envWrapper = document.createElement('div');
    envWrapper.className = 'inputWrapper';
    const envLabel = document.createElement('label');
    envLabel.textContent = 'Environment';
    const envInput = document.createElement('input');
    envInput.type = 'text';
    envInput.readOnly = true;
    envInput.value = card.env || '';
    envInput.style.background = "#eef6fa";
    envInput.style.color = "#555";
    envInput.title = "Managed by Team (Cloud)";
    envWrapper.appendChild(envLabel);
    envWrapper.appendChild(envInput);
    form.appendChild(envWrapper);

    const fields = [
        { label: 'User', value: card.user || '' },
        { label: 'Passphrase', value: card.pass || '' }
    ];
    fields.forEach(field => {
        const inputWrapper = document.createElement('div');
        inputWrapper.className = 'inputWrapper';
        const label = document.createElement('label');
        label.textContent = field.label;
        const inputElement = document.createElement('input');
        inputElement.type = 'text';
        inputElement.value = field.value;
        inputElement.readOnly = true;
        inputElement.style.background = "#eef6fa";
        inputElement.style.color = "#555";
        inputElement.title = "Managed by Team (Cloud)";
        inputWrapper.appendChild(label);
        inputWrapper.appendChild(inputElement);
        form.appendChild(inputWrapper);
    });

    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Fill';
    button.className = 'fill-btn';
    button.title = "Fill from Team (Cloud)";
    button.addEventListener('click', (e) => {
        e.preventDefault();
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            if (tabs.length > 0) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    action: "fillDropdowns",
                    passphrase: card.pass
                }, (response) => {
                    if (chrome.runtime.lastError) {
                        console.error('Error sending message:', chrome.runtime.lastError.message);
                    }
                });
            } else {
                console.error("No active tab found.");
            }
        });
    });
    form.appendChild(button);

    const note = document.createElement('div');
    note.textContent = "Read-only: managed by your team (cloud)";
    note.style.fontSize = "10px";
    note.style.color = "#7a8aad";
    note.style.marginTop = "4px";
    note.style.textAlign = "center";
    note.style.opacity = "0.77";
    form.appendChild(note);

    accountCart.appendChild(form);

    document.getElementById('wrapper').appendChild(accountCart);
}

function createCard(index, card) {
    const accountCart = document.createElement('div');
    accountCart.className = 'accountCart';
    accountCart.setAttribute('data-cardindex', index);
    const form = document.createElement('form');
    form.id = 'dropdownForm' + index;

    const envWrapper = document.createElement('div');
    envWrapper.className = 'inputWrapper';
    const envLabel = document.createElement('label');
    envLabel.htmlFor = 'env_' + index;
    envLabel.textContent = 'Environment';

    let envValue = (card && typeof card.env === 'string') ? card.env : ENV_OPTIONS[0];
    const envDropdown = createEnvDropdown('env_' + index, envValue, (e) => {
        saveLocal(index, 'env', e.target.value);
        setTimeout(() => tryCloudSyncAndRemoveIfNeeded(index), 60);
    });

    envWrapper.appendChild(envLabel);
    envWrapper.appendChild(envDropdown);
    form.appendChild(envWrapper);

    const userValue = (card && typeof card.user === 'string') ? card.user : '';
    const passValue = (card && typeof card.pass === 'string') ? card.pass : '';

    const inputs = [
        { label: 'Username', id: 'user_' + index, placeholder: 'Username', value: userValue },
        { label: 'Passphrase', id: 'pass_' + index, placeholder: 'Paste Passphrase', value: passValue }
    ];

    inputs.forEach(input => {
        const inputWrapper = document.createElement('div');
        inputWrapper.className = 'inputWrapper';
        const label = document.createElement('label');
        label.htmlFor = input.id;
        label.textContent = input.label;
        const inputElement = document.createElement('input');
        inputElement.type = 'text';
        inputElement.id = input.id;
        inputElement.placeholder = input.placeholder;
        inputElement.value = input.value;

        inputElement.addEventListener('input', (e) => {
            const innerKey = input.id.split('_')[0];
            saveLocal(index, innerKey, e.target.value);
        });

        inputElement.addEventListener('blur', () => {
            setTimeout(() => tryCloudSyncAndRemoveIfNeeded(index), 60);
        });

        inputWrapper.appendChild(label);
        inputWrapper.appendChild(inputElement);
        form.appendChild(inputWrapper);
    });

    const button = document.createElement('button');
    button.type = 'button';
    button.id = 'fillButton' + index;
    button.textContent = 'Fill';
    button.className = 'fill-btn';
    button.addEventListener('click', (e) => {
        e.preventDefault();
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            if (tabs.length > 0) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    action: "fillDropdowns",
                    passphrase: passValue
                }, (response) => {
                    if (chrome.runtime.lastError) {
                        console.error('Error sending message:', chrome.runtime.lastError.message);
                    }
                });
            } else {
                console.error("No active tab found.");
            }
        });
    });

    const removeButton = document.createElement('button');
    removeButton.setAttribute('type', 'button');
    removeButton.setAttribute('id', `removeButton${index}`);
    removeButton.setAttribute('class', `removeButton`);
    removeButton.addEventListener('click', async () => {
        const wrapperDiv = document.getElementById('wrapper');
        wrapperDiv.removeChild(accountCart);
        await chrome.storage.local.remove(`test_${index}`);
        renderAllCards();
    });

    const svgElement = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svgElement.setAttribute('width', '30');
    svgElement.setAttribute('height', '20');
    svgElement.setAttribute('viewBox', '0 0 256 256');
    const pathElement = document.createElementNS("http://www.w3.org/2000/svg", "path");
    pathElement.setAttribute('fill', 'currentColor');
    pathElement.setAttribute('d', 'M216 48h-40v-8a24 24 0 0 0-24-24h-48a24 24 0 0 0-24 24v8H40a8 8 0 0 0 0 16h8v144a16 16 0 0 0 16 16h128a16 16 0 0 0 16-16V64h8a8 8 0 0 0 0-16M96 40a8 8 0 0 1 8-8h48a8 8 0 0 1 8 8v8H96Zm96 168H64V64h128Zm-80-104v64a8 8 0 0 1-16 0v-64a8 8 0 0 1 16 0m48 0v64a8 8 0 0 1-16 0v-64a8 8 0 0 1 16 0');
    svgElement.appendChild(pathElement);
    removeButton.appendChild(svgElement);

    form.appendChild(removeButton);
    form.appendChild(button);

    accountCart.appendChild(form);

    return accountCart;
}

async function renderAllCards() {
    const wrapperDiv = document.getElementById('wrapper');
    wrapperDiv.innerHTML = "";

    const allCards = await getAllStorageKeys();
    const teamAccounts = await fetchTeamAccounts();
    const manualKeys = Object.keys(allCards).filter(key => key.startsWith('test_'));
    let highestIdx = 0;

    const cloudUserEnvSet = new Set(
        teamAccounts.map(c => `${(c.user||'').toLowerCase()}::${c.env}`)
    );

    let manualCards = [];
    manualKeys.forEach(idx => {
        const card = allCards[idx];
        const cardNumber = +idx.split('_')[1];
        const userEnvKey = `${(card.user||'').toLowerCase()}::${card.env}`;
        if (!cloudUserEnvSet.has(userEnvKey)) {
            manualCards.push({ cardNumber, card });
        }
        if (cardNumber > highestIdx) highestIdx = cardNumber;
    });
    cardIndex = highestIdx + 1;

    manualCards.sort((a, b) => b.cardNumber - a.cardNumber);

    if (manualCards.length === 0) {
        manualCards.push({ cardNumber: cardIndex, card: { env: ENV_OPTIONS[0], user: '', pass: '' } });
        cardIndex++;
    }

    manualCards.forEach(({ cardNumber, card }) => {
        const dom = createCard(cardNumber, card);
        wrapperDiv.appendChild(dom);
    });

    teamAccounts.forEach(card => {
        createCloudCard(card);
    });
}

(async () => {
    await renderAllCards();
})();

document.getElementById('plusBtn').addEventListener('click', () => {
    chrome.storage.local.set({ ['test_' + cardIndex]: { env: ENV_OPTIONS[0], user: '', pass: '' } }, () => {
        cardIndex++;
        renderAllCards();
        setTimeout(() => {
            const firstManual = document.querySelector('.accountCart:not(.cloudCard) input');
            if (firstManual) firstManual.focus();
        }, 50);
    });
});

document.getElementById('settingsIcon').addEventListener('click', function () {
    chrome.storage.local.get(['cloud_json_url'], function (data) {
        document.getElementById('cloudUrlInput').value = data['cloud_json_url'] || '';
        document.getElementById('settingsModal').style.display = 'block';
    });
});
document.getElementById('settingsSaveBtn').addEventListener('click', function () {
    const url = document.getElementById('cloudUrlInput').value.trim();
    if (url) {
        chrome.storage.local.set({ 'cloud_json_url': url }, () => {
            if (chrome.runtime.lastError) {
                console.error('Failed to save cloud URL', chrome.runtime.lastError);
            }
            document.getElementById('settingsModal').style.display = 'none';
            location.reload();
        });
    } else {
        chrome.storage.local.remove('cloud_json_url', () => {
            if (chrome.runtime.lastError) {
                console.error('Failed to remove cloud URL', chrome.runtime.lastError);
            }
            document.getElementById('settingsModal').style.display = 'none';
            location.reload();
        });
    }
});
document.getElementById('settingsCancelBtn').addEventListener('click', function () {
    document.getElementById('settingsModal').style.display = 'none';
});
document.getElementById('searchIcon').addEventListener('click', function () {
    const bar = document.getElementById('searchBar');
    bar.style.display = (bar.style.display === 'none' || !bar.style.display) ? 'flex' : 'none';
    if (bar.style.display === 'flex') {
        document.getElementById('searchInput').focus();
    }
});
document.getElementById('searchInput').addEventListener('blur', function () {
    setTimeout(() => {
        document.getElementById('searchBar').style.display = "none";
        document.getElementById('searchInput').value = "";
    }, 130);
});
document.getElementById('searchGoBtn').addEventListener('click', handleSearch);
document.getElementById('searchInput').addEventListener('keydown', function (e) {
    if (e.key === "Enter") handleSearch();
});
function handleSearch() {
    const searchValue = document.getElementById('searchInput').value.trim().toLowerCase();
    if (!searchValue) return;
    const cards = document.querySelectorAll('.accountCart, .cloudCard');
    let found = false;
    cards.forEach(card => {
        const labelNodes = card.querySelectorAll('label');
        let userInput = null;
        labelNodes.forEach((lbl) => {
            if (lbl.textContent.trim().toLowerCase() === 'user' || lbl.textContent.trim().toLowerCase() === 'username') {
                const nextInput = lbl.parentElement.querySelector('input');
                if (nextInput) userInput = nextInput;
            }
        });
        if (userInput && userInput.value.trim().toLowerCase() === searchValue) {
            card.scrollIntoView({ behavior: "smooth", block: "center" });
            card.style.outline = "2.5px solid #39d1ad";
            card.style.transition = "outline 0.15s";
            setTimeout(() => { card.style.outline = ""; }, 1200);
            found = true;
        }
    });
    if (!found) {
        document.getElementById('searchInput').style.background = "#fdb7c5";
        setTimeout(() => {
            document.getElementById('searchInput').style.background = "";
        }, 650);
    }
}
