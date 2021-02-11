/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

const {BotkitConversation} = require("botkit");
const csv = require('csv-parser');
const fs = require('fs')

currencies = []
predictions = []

function getCurrencies() {
    fs.createReadStream('D:\\skryptowe\\Scraper2\\currencies.csv')
        .pipe(csv())
        .on('data', (row) => {
            currencies.push(row)
        })
        .on('end', () => {
            console.log('CSV file successfully processed');
        });
}

function getPredictions() {
    fs.createReadStream('D:\\skryptowe\\Scraper2\\feelings.csv')
        .pipe(csv())
        .on('data', (row) => {
            predictions.push(row)
        })
        .on('end', () => {
            console.log('CSV file successfully processed');
        });
}

function getPredictionForCoin(coin, convo) {
    let isFound = false;
    predictions.forEach(prediction => {
        if (prediction["Coin"].toLowerCase() === coin.toLowerCase()) {
            convo.setVar("predictionMessage",
                "Prawdopodbieństwo sukcesu dla " + coin + " oceniam na: " + prediction["Success"]);
            isFound = true;
        }
    })
    if (!isFound) {
        convo.setVar("predictionMessage",
            "Niestety nie posiadam danych o walucie: " + coin + ".");
    }
}

function getCurrencyDataForCoin(coin, convo) {
    let isFound = false;
    currencies.forEach(currency => {
        if (currency["Name"].toLowerCase() === coin.toLowerCase()) {
            setCurrencyDataToConvoVars(currency, convo)
            isFound = true;
        }
    })
    if (!isFound) {
        setNotFoundMessagesConvoVars(coin, convo)
    }
}

function setCurrencyDataToConvoVars(currency, convo) {
    convo.setVar("symbolMessage",
        "Symbol: " + currency["Symbol"]);
    convo.setVar("priceMessage",
        "Kurs: " + currency["Price"]);
    convo.setVar("changeMessage",
        "Zmiana 1h: " + currency["Price"] + "\n" +
    "Zmiana 24h: " + currency["Change 24h"] + "\n" +
    "Zmiana 7d: " + currency["Change 7d"]);
    convo.setVar("volumeMessage",
        "Wolumen: " + currency["Volume"]);
    convo.setVar("mktCapMessage",
        "Kapitalizacja: " + currency["Mkt Cap"]);
}

function setNotFoundMessagesConvoVars(coin, convo) {
    convo.setVar("symbolMessage",
        "Niestety nie posiadam danych o symbolu waluty: " + coin + ".");
    convo.setVar("priceMessage",
        "Niestety nie posiadam danych o kursie waluty: " + coin + ".");
    convo.setVar("changeMessage",
        "Niestety nie posiadam danych o wahaniach waluty : " + coin + ".");
    convo.setVar("volumeMessage",
        "Niestety nie posiadam danych o wolumenie waluty: " + coin + ".");
    convo.setVar("mktCapMessage",
        "Niestety nie posiadam danych o kapitalizacji waluty: " + coin + ".");
}

module.exports = async function (controller) {

    controller.ready(async () => {
        if (process.env.MYTEAM) {
            let bot = await controller.spawn(process.env.MYTEAM);
            await bot.startConversationInChannel(process.env.MYCHAN, process.env.MYUSER);
            bot.say('I AM AWOKEN.');
        }
    });

    controller.hears('!refresh', 'message,direct_message', async (bot, message) => {
        getCurrencies()
        getPredictions()
        await bot.reply(message, 'Dane dotyczące walut zostały ponownie załadowane!');
    });

    controller.hears('!help', 'message,direct_message', async (bot, message) => {
        await bot.reply(message,
            'Witaj! Będę Twoim osobistym doradcą od kryptowalut!\n\n' +
            '!refresh - na początku zacznij od załadowania najnowszych danych!\n\n' +
            'Potem możesz mnie zapytać o ogólne tematy związane z kryptowalutami lub też o doładniejsze statystyki na temat konkretnej waluty.\n' +
            'Chętnie też pomogę Ci w decyzji, czy w daną walutę warto w tym momencie inwestować!');
    });

    controller.hears(['kryptowaluty', 'czym', 'co to', 'ogólnie'], 'message,direct_message', async (bot, message) => {
        await bot.reply(message,
            'Kryptowaluta to w najprostszym tłumaczeniu waluta wirtualna. ' +
            'Wirtualne pieniądze należą do rozproszonego systemu księgowego, który opiera się na kryptografii.' +
            ' Kryptowaluty uznawane są przez większość państw za środek płatniczy');
    });

    controller.hears(['gdzie', 'kupić', 'rynek', 'giełda', 'jak'], 'message,direct_message', async (bot, message) => {
        await bot.reply(message,
            'Na początek najlepszym wyborem będzie giełda Bitbay -> https://bitbay.net/pl\n\n' +
            'Giełda cyfrowych walut BitBay powstała w Polsce w 2014 roku. ' +
            'Jest ona największą tego typu giełdą w naszym kraju i w Europie Środkowo-Wschodniej.');
    });


    // dialog - prawdopodobieństwo sukcesu
    const PREDICTION_ID = 'prediction-dialog';
    let predictionConvo = new BotkitConversation(PREDICTION_ID, controller);

    predictionConvo.say('Chętnie pomogę!');
    predictionConvo.ask('O jaką walutę Ci chodzi?', async (response, convo, bot) => {
        getPredictionForCoin(response, convo)
    }, 'coin');
    predictionConvo.addAction('prediction-thread');
    predictionConvo.addMessage("{{vars.predictionMessage}}", 'prediction-thread');
    controller.addDialog(predictionConvo)

    controller.hears(['czy warto', 'inwestycja', 'co myślisz o', 'opłaca się', 'zainwestować', 'inwestycji'], 'message,direct_message', async (bot, message) => {
        await bot.beginDialog(PREDICTION_ID);
    });

    // dialog - dane o walutach
    const CURRENCIES_ID = 'currencies-dialog';
    let convoCurrencies = new BotkitConversation(CURRENCIES_ID, controller);

    convoCurrencies.say('Chętnie pomogę!');
    convoCurrencies.ask('O jaką walutę Ci chodzi?', async (response, convo, bot) => {
        getCurrencyDataForCoin(response, convo)
    }, 'coin');


    // odpowiedzi na poszczególne pola waluty
    convoCurrencies.addMessage({
        text: '{{vars.symbolMessage}}',
    },'symbol_thread');
    convoCurrencies.addMessage({
        text: '{{vars.priceMessage}}',
    },'price_thread');
    convoCurrencies.addMessage({
        text: '{{vars.changeMessage}}',
    },'change_thread');
    convoCurrencies.addMessage({
        text: '{{vars.volumeMessage}}',
    },'volume_thread');
    convoCurrencies.addMessage({
        text: '{{vars.mktCapMessage}}',
    },'mkt_cap_thread');
    convoCurrencies.addMessage({
        text: '{{vars.symbolMessage}}\n\n' +
            '{{vars.priceMessage}}\n\n' +
            '{{vars.changeMessage}}\n\n' +
            '{{vars.volumeMessage}}\n\n' +
            '{{vars.mktCapMessage}}'
    },'all_thread');

    // wiadomośc w przypadku błędnego wyboru pola waluty
    convoCurrencies.addMessage({
        text: 'Nie zrozumiałem Cię. Spróbuj jeszcze raz.',
        action: 'default',
    },'bad_response');

    // pytanie o pole waluty
    convoCurrencies.addQuestion('Co chcesz wiedzieć?\n Dostępne opcje: symbol, kurs, wahania, wolumen, kapitalizacja lub wszystko', [
        {
            pattern: 'symbol',
            handler: async function(response, convo, bot) {
                await convo.gotoThread('symbol_thread');
            },
        },
        {
            pattern: 'kurs',
            handler: async function(response, convo, bot) {
                await convo.gotoThread('price_thread');
            },
        },
        {
            pattern: 'wahania',
            handler: async function(response, convo, bot) {
                await convo.gotoThread('change_thread');
            },
        },
        {
            pattern: 'wolumen',
            handler: async function(response, convo, bot) {
                await convo.gotoThread('volume_thread');
            },
        },
        {
            pattern: 'kapitalizacja',
            handler: async function(response, convo, bot) {
                await convo.gotoThread('mkt_cap_thread');
            },
        },
        {
            pattern: 'wszystko',
            handler: async function(response, convo, bot) {
                await convo.gotoThread('all_thread');
            },
        },
        {
            default: true,
            handler: async function(response, convo, bot) {
                await convo.gotoThread('bad_response');
            },
        }
    ],'currency_field','default');
    controller.addDialog(convoCurrencies);

    controller.hears(['informacje', 'walucie', 'waluta', 'info', 'podaj'], 'message,direct_message', async (bot, message) => {
        await bot.beginDialog(CURRENCIES_ID);
    });

    controller.hears(new RegExp(/^(?=[\S\s]{10,8000})[\S\s]*$/), 'message', async (bot, message) => {
        await bot.reply(message, 'Nie zrozumiałem Cię.\n' +
            'Wpisz !help aby uzyskać pomoc.');
    });
}