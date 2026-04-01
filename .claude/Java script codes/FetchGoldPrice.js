function FetchGoldPrice() {
    const API_KEY = "apikey 3S1ksLKTwJhxN1I54sdd4J:1XmAY9KLu6COWpWGPXd16L";
    const URL = "https://api.collectapi.com/economy/goldPrice";

    const options = {
        method: "GET",
        headers: {
            "content-type": "application/json",
            "authorization": API_KEY
        },
        muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(URL, options);
    const json = JSON.parse(response.getContentText());

    if (!json.success) {
        throw new Error("CollectAPI request failed: " + response.getContentText());
    }

    const results = json.result;

    const gram = results.find(r => r.name === "Gram Altın");
    const tam = results.find(r => r.name === "Tam Altın");

    if (!gram) throw new Error("Gram Altın not found in API response.");
    if (!tam) throw new Error("Tam Altın not found in API response.");

    function bestPrice(item) {
        const buy = item.buying;
        const sell = item.selling;
        if (sell == null || isNaN(sell)) return buy;
        return Math.min(buy, sell);
    }

    function assertPrice(value, label) {
        if (value == null || isNaN(value) || value <= 0) {
            throw new Error("Invalid price for " + label + ": " + value);
        }
        return value;
    }

    const gramPrice = assertPrice(bestPrice(gram), "Gram Altın");
    const tamPrice = assertPrice(bestPrice(tam), "Tam Altın");

    Logger.log("Gram Altın: " + gramPrice);
    Logger.log("Tam Altın:  " + tamPrice);

    const ss = SpreadsheetApp.getActiveSpreadsheet();

    try {
        ss.getRangeByName("grau").setValue(gramPrice);
        ss.getRangeByName("tamau").setValue(tamPrice);
        Logger.log("Written via named ranges.");
    } catch (e) {
        const sheet = ss.getSheetByName("Data");
        sheet.getRange("C16").setValue(gramPrice);
        sheet.getRange("C17").setValue(tamPrice);
        Logger.log("Written via fixed cells.");
    }

    Logger.log("Done.");
}