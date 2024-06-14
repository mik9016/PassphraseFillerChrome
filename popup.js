const plusBtn = document.getElementById('plusBtn')
let cardIndex = 0
const getAllStorageKeys = async () => {
    return new Promise((resolve, reject) => {
        chrome.storage.local.get(null, (items) => {
            if (chrome.runtime.lastError) {
                return reject(chrome.runtime.lastError);
            }
            resolve(items);
        });
    });
}
const createCard = (index,card,additionalCard) => {

    // Create the main div
    const accountCart = document.createElement('div');
    accountCart.className = 'accountCart';

    // Create the form
    const form = document.createElement('form');
    form.id = 'dropdownForm'+ index;

    // Create the input wrapper and input elements
    const inputs = [
        { label: 'Environment', id: 'env_'+ index, placeholder: 'Environment' ,value: card ? card?.env : ''},
        { label: 'User', id: 'user_'+ index, placeholder: 'Username' ,value: card ?  card?.user : ''},
        { label: 'Passphrase', id: 'pass_'+ index, placeholder: 'Paste Passphrase' ,value: card ? card?.pass : ''}
    ];

    if(additionalCard){
        chrome.storage.local.set({['test_' + index]:{
                env: '',
                user: '',
                pass: ''
            }})
    }

    inputs.forEach(async(input) => {
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
            if(card){
                const x = {...card}
                x[innerKey] = e.target.value
                chrome.storage.local.set({ ['test_' + index]: x });
            }
            else{
                const intermediateCard = await chrome.storage.local.get(['test_' + index])
                const test = {...intermediateCard}
                test['test_' + index][innerKey] = e.target.value
                chrome.storage.local.set({ ['test_' + index]:  test['test_' + index] });
            }
        })
        inputWrapper.appendChild(label);
        inputWrapper.appendChild(inputElement);
        form.appendChild(inputWrapper);
    });
    // Create the button
    const button = document.createElement('button');
    button.type = 'button';
    button.id = 'fillButton'+ index;
    button.textContent = 'Fill';

    button.addEventListener('click', () => {
        const passphrase = card.pass;
        chrome.runtime.sendMessage({
            action: "fillDropdowns",
            passphrase: passphrase
        });
    });

    // Create Remove Button
    const removeButton = document.createElement('button');
    removeButton.setAttribute('type', 'button');
    removeButton.setAttribute('id', `removeButton${index}`);
    removeButton.setAttribute('class', `removeButton`);
    removeButton.innerText = `test_${index}`

    removeButton.addEventListener('click', async () => {
        wrapperDiv.removeChild(accountCart)
        await chrome.storage.local.remove(`test_${index}`);

    });

    // Create SVG Element
    const svgElement = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svgElement.setAttribute('width', '30');
    svgElement.setAttribute('height', '20');
    svgElement.setAttribute('viewBox', '0 0 256 256');

    // Create Path Element
    const pathElement = document.createElementNS("http://www.w3.org/2000/svg", "path");
    pathElement.setAttribute('fill', 'currentColor');
    pathElement.setAttribute('d', 'M216 48h-40v-8a24 24 0 0 0-24-24h-48a24 24 0 0 0-24 24v8H40a8 8 0 0 0 0 16h8v144a16 16 0 0 0 16 16h128a16 16 0 0 0 16-16V64h8a8 8 0 0 0 0-16M96 40a8 8 0 0 1 8-8h48a8 8 0 0 1 8 8v8H96Zm96 168H64V64h128Zm-80-104v64a8 8 0 0 1-16 0v-64a8 8 0 0 1 16 0m48 0v64a8 8 0 0 1-16 0v-64a8 8 0 0 1 16 0');

    // Append Path Element to SVG Element
    svgElement.appendChild(pathElement);

    // Append SVG Element to Remove Button
    removeButton.appendChild(svgElement);

    // Append Buttons to Document Body or any other container
    form.appendChild(removeButton);


    // Append elements to the form
    form.appendChild(button);

    // Append form to the main div
    accountCart.appendChild(form);

    const wrapperDiv = document.getElementById('wrapper')
    wrapperDiv.appendChild(accountCart);
}

// Retrieve values stored in chrome storage on load
(async () => {
    try {
        const allCards = await getAllStorageKeys()
        const allCardsLength =  Object.keys(allCards)?.length
        //if there is no cards yet create one initial
        if (allCardsLength < 1) {
            createCard(0,false,true)
            cardIndex++

        }else{
            //If there are cards stored go and create them with values
            for (const idx in allCards) {
                const card = allCards[idx];
                const cardNumber = +idx.split('_')[1]

                createCard(cardNumber,card,false)
                cardIndex++
            }
        }

    } catch (error) {
        console.error('Error retrieving value:', error);
    }
})();

plusBtn.addEventListener('click', e => {
    createCard(cardIndex,false,true)
    cardIndex++
})






