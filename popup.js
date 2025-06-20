import { createCloudCard, getCloudUrlFromStorage, ENV_OPTIONS, ALLOWED_CLOUD_ENVS } from './utils.js';

let cardIndex = 0;

async function fetchTeamAccounts() {
    try {
        const url = await getCloudUrlFromStorage();
        if (!url) {
            const note = document.createElement('div');
            note.textContent = "Cloud sync not configured. Running in local-only mode.";
            note.style.color = "#999";
            note.style.fontSize = "12px";
            note.style.textAlign = "center";
            document.getElementById('wrapper').prepend(note);
            return [];
        }
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

async function cleanUpLocalDuplicates(teamAccounts) {
    try {
        const localCards = await chrome.storage.local.get();
        const removeKeys = [];
        for (const [key, card] of Object.entries(localCards)) {
            if (!card || !card.user || !card.env) continue;
            if (
                teamAccounts.some(
                    acc => acc.user?.toLowerCase() === card.user?.toLowerCase() &&
                    acc.env === card.env
                )
            ) {
                removeKeys.push(key);
            }
        }
        if (removeKeys.length > 0) {
            await chrome.storage.local.remove(removeKeys);
        }
    } catch (e) {
        console.error('Failed to clean up local duplicates', e);
    }
}

function robustSave(index, key, value) {
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

function createCard(index, card) {
    const accountCart = document.createElement('div');
    accountCart.className = 'accountCart';
    const form = document.createElement('form');
    form.id = 'dropdownForm' + index;

    const envWrapper = document.createElement('div');
    envWrapper.className = 'inputWrapper';
    const envLabel = document.createElement('label');
    envLabel.htmlFor = 'env_' + index;
    envLabel.textContent = 'Environment';

    let envValue = card ? card.env : ENV_OPTIONS[0];
    const envDropdown = createEnvDropdown('env_' + index, envValue, (e) => {
        robustSave(index, 'env', e.target.value);
    });

    envWrapper.appendChild(envLabel);
    envWrapper.appendChild(envDropdown);
    form.appendChild(envWrapper);

    const inputs = [
        { label: 'Username', id: 'user_' + index, placeholder: 'Username', value: card ? card?.user : '' },
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
        inputElement.addEventListener('input', (e) => {
            const innerKey = input.id.split('_')[0];
            robustSave(index, innerKey, e.target.value);
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
    button.addEventListener('click', () => {
        const passphrase = card && card.pass ? card.pass : '';
        chrome.runtime.sendMessage({
            action: "fillDropdowns",
            passphrase: passphrase
        });
    });

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
}

(async () => {
    try {
        const wrapperDiv = document.getElementById('wrapper');
        wrapperDiv.innerHTML = "";
        const teamAccounts = await fetchTeamAccounts();
        await cleanUpLocalDuplicates(teamAccounts);
        teamAccounts.forEach(card => {
            createCloudCard(card);
        });
        const allCards = await getAllStorageKeys();
        const allCardsKeys = Object.keys(allCards);
        if (allCardsKeys.length < 1) {
            createCard(0, false);
            cardIndex++;
        } else {
            for (const idx in allCards) {
                const card = allCards[idx];
                const cardNumber = +idx.split('_')[1];
                createCard(cardNumber, card);
                cardIndex++;
            }
        }
    } catch (error) {
        console.error('popup main render failed', error);
    }
})();

document.getElementById('plusBtn').addEventListener('click', () => {
    createCard(cardIndex, false);
    cardIndex++;
});

document.getElementById('settingsIcon').addEventListener('click', function() {
    chrome.storage.local.get(['cloud_json_url'], function(data) {
        document.getElementById('cloudUrlInput').value = data['cloud_json_url'] || '';
        document.getElementById('settingsModal').style.display = 'block';
    });
});

document.getElementById('settingsSaveBtn').addEventListener('click', function() {
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

document.getElementById('settingsCancelBtn').addEventListener('click', function() {
    document.getElementById('settingsModal').style.display = 'none';
});

document.getElementById('searchIcon').addEventListener('click', function() {
  const bar = document.getElementById('searchBar');
  bar.style.display = (bar.style.display === 'none' || !bar.style.display) ? 'flex' : 'none';
  if (bar.style.display === 'flex') {
    document.getElementById('searchInput').focus();
  }
});

document.getElementById('searchInput').addEventListener('blur', function() {
  setTimeout(() => {
    document.getElementById('searchBar').style.display = "none";
    document.getElementById('searchInput').value = "";
  }, 130);
});

document.getElementById('searchGoBtn').addEventListener('click', handleSearch);
document.getElementById('searchInput').addEventListener('keydown', function(e) {
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
      if (lbl.textContent.trim().toLowerCase() === 'user') {
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
