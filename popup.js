const CLOUD_URL = "YOUR_URL_HERE"; //user your JSON BLOB raw URL here
const ENV_OPTIONS = ['Staging', 'Integration', 'Pre Prod', 'Prod'];
const plusBtn = document.getElementById('plusBtn');
let cardIndex = 0;

async function fetchTeamAccounts() {
    try {
        const response = await fetch(CLOUD_URL);
        const data = await response.json();
        // Only allow strictly whitelisted environments except 'Prod'
        const allowedEnvs = ["Pre Prod", "Integration", "Staging"];
        return (data.team_accounts || []).filter(card =>
            allowedEnvs.includes(card.env)
        );
    } catch (e) {
        return [];
    }
}

const getAllStorageKeys = async () => {
    return new Promise((resolve, reject) => {
        chrome.storage.local.get(null, (items) => {
            if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
            resolve(items);
        });
    });
};

// ----------- NEW: Remove local duplicates of cloud cards -----------
async function cleanUpLocalDuplicates(teamAccounts) {
    const localCards = await chrome.storage.local.get();
    const removeKeys = [];
    for (const [key, card] of Object.entries(localCards)) {
        if (!card || !card.user || !card.env) continue;
        if (
            teamAccounts.some(
              acc =>
                acc.user?.toLowerCase() === card.user?.toLowerCase() &&
                acc.env === card.env
            )
        ){
            removeKeys.push(key);
        }
    }
    if (removeKeys.length > 0) {
        await chrome.storage.local.remove(removeKeys);
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

const createCard = (index, card, additionalCard) => {
    const accountCart = document.createElement('div');
    accountCart.className = 'accountCart';
    const form = document.createElement('form');
    form.id = 'dropdownForm' + index;

    // ENVIRONMENT DROPDOWN
    const envWrapper = document.createElement('div');
    envWrapper.className = 'inputWrapper';
    const envLabel = document.createElement('label');
    envLabel.htmlFor = 'env_' + index;
    envLabel.textContent = 'Environment';

    let envValue = card ? card.env : ENV_OPTIONS[0];
    const envDropdown = createEnvDropdown('env_' + index, envValue, (e) => {
        const newEnv = e.target.value;
        if (card) {
            const x = { ...card, env: newEnv };
            chrome.storage.local.set({ ['test_' + index]: x });
        } else {
            chrome.storage.local.get(['test_' + index], (intermediateCard) => {
                const test = { ...intermediateCard };
                test['test_' + index].env = newEnv;
                chrome.storage.local.set({ ['test_' + index]: test['test_' + index] });
            });
        }
    });

    envWrapper.appendChild(envLabel);
    envWrapper.appendChild(envDropdown);
    form.appendChild(envWrapper);

    // USER and PASSPHRASE INPUTS
    const inputs = [
        { label: 'User', id: 'user_' + index, placeholder: 'Username', value: card ? card?.user : '' },
        { label: 'Passphrase', id: 'pass_' + index, placeholder: 'Paste Passphrase', value: card ? card?.pass : '' }
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

        inputElement.addEventListener('keyup', async (e) => {
            const innerKey = input.id.split('_')[0];
            if (card) {
                const x = { ...card };
                x[innerKey] = e.target.value;
                chrome.storage.local.set({ ['test_' + index]: x });
            } else {
                chrome.storage.local.get(['test_' + index], (intermediateCard) => {
                    const test = { ...intermediateCard };
                    test['test_' + index][innerKey] = e.target.value;
                    chrome.storage.local.set({ ['test_' + index]: test['test_' + index] });
                });
            }
        });
        inputWrapper.appendChild(label);
        inputWrapper.appendChild(inputElement);
        form.appendChild(inputWrapper);
    });

    // Fill button
    const button = document.createElement('button');
    button.type = 'button';
    button.id = 'fillButton' + index;
    button.textContent = 'Fill';
    button.className = 'fill-btn';
    button.addEventListener('click', () => {
        const passphrase = card.pass;
        chrome.runtime.sendMessage({
            action: "fillDropdowns",
            passphrase: passphrase
        });
    });

    // Remove button
    const removeButton = document.createElement('button');
    removeButton.setAttribute('type', 'button');
    removeButton.setAttribute('id', `removeButton${index}`);
    removeButton.setAttribute('class', `removeButton`);
    removeButton.addEventListener('click', async () => {
        wrapperDiv.removeChild(accountCart);
        await chrome.storage.local.remove(`test_${index}`);
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
    const wrapperDiv = document.getElementById('wrapper');
    wrapperDiv.appendChild(accountCart);
};

const createCloudCard = (card) => {
    const accountCart = document.createElement('div');
    accountCart.className = 'accountCart cloudCard';

    const form = document.createElement('form');
    form.className = 'cloudForm';

    // ENVIRONMENT
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

    // USER, PASS
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
    button.addEventListener('click', () => {
        const passphrase = card.pass;
        chrome.runtime.sendMessage({
            action: "fillDropdowns",
            passphrase: passphrase
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
    const wrapperDiv = document.getElementById('wrapper');
    wrapperDiv.appendChild(accountCart);
};

(async () => {
    try {
        const wrapperDiv = document.getElementById('wrapper');
        wrapperDiv.innerHTML = "";

        // --- CLEANUP DUPLICATES BEFORE RENDER ---
        const teamAccounts = await fetchTeamAccounts();
        await cleanUpLocalDuplicates(teamAccounts);

        // 1. Render cloud cards
        teamAccounts.forEach(card => {
            createCloudCard(card);
        });

        // 2. Load and render remaining local cards
        const allCards = await getAllStorageKeys();
        const allCardsKeys = Object.keys(allCards);
        if (allCardsKeys.length < 1) {
            createCard(0, false, true);
            cardIndex++;
        } else {
            for (const idx in allCards) {
                const card = allCards[idx];
                const cardNumber = +idx.split('_')[1];
                createCard(cardNumber, card, false);
                cardIndex++;
            }
        }
    } catch (error) {}
})();

plusBtn.addEventListener('click', () => {
    createCard(cardIndex, false, true);
    cardIndex++;
});
