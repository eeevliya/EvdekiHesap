function getTefasPrice(fundCode) {
    if (!fundCode) {
        return "No fund code provided";
    }

    try {
        // Get today's date in Turkish format (DD.MM.YYYY)
        var today = new Date();
        var day = ("0" + today.getDate()).slice(-2);
        var month = ("0" + (today.getMonth() + 1)).slice(-2);
        var year = today.getFullYear();
        var dateStr = day + "." + month + "." + year;

        // Prepare the POST data
        var payload = {
            "fontip": "YAT",
            "sfontur": "",
            "fonkod": fundCode,
            "fongrup": "",
            "bastarih": dateStr,
            "bittarih": dateStr,
            "fonturkod": "",
            "fonunvantip": ""
        };

        // Set up the request options
        var options = {
            "method": "post",
            "contentType": "application/x-www-form-urlencoded; charset=UTF-8",
            "headers": {
                "Accept": "application/json, text/javascript, */*; q=0.01",
                "Accept-Language": "en-US,en;q=0.8",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            },
            "payload": payload,
            "muteHttpExceptions": true
        };

        // Make the API request
        var url = "https://www.tefas.gov.tr/api/DB/BindHistoryInfo";
        var response = UrlFetchApp.fetch(url, options);
        var responseCode = response.getResponseCode();

        if (responseCode !== 200) {
            return "Error: HTTP " + responseCode;
        }

        var json = JSON.parse(response.getContentText());

        // Check if data exists
        if (json.data && json.data.length > 0) {
            // Get the price from the first (most recent) entry
            var price = json.data[0].FIYAT;

            // Handle if price is a string with comma (Turkish format)
            if (typeof price === "string") {
                return parseFloat(price.replace(',', '.'));
            } else {
                // Price is already a number
                return price;
            }
        } else {
            throw EvalError("No data found");
        }

    } catch (error) {
        throw error;
    }
}