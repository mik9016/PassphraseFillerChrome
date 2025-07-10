function getCloudUrlFromStorage() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['cloud_json_url'], (data) => {
            resolve(data.cloud_json_url || undefined);
        });
    });
}

const ENV_OPTIONS = ['Staging', 'Integration', 'Pre Prod', 'Prod'];
const ALLOWED_CLOUD_ENVS = ['Staging', 'Integration', 'Pre Prod'];

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

window.getCloudUrlFromStorage = getCloudUrlFromStorage;
window.ENV_OPTIONS = ENV_OPTIONS;
window.ALLOWED_CLOUD_ENVS = ALLOWED_CLOUD_ENVS;
window.extractUsername = extractUsername;
window.detectEnvFromHsServer = detectEnvFromHsServer;
window.createCloudCard = createCloudCard;
