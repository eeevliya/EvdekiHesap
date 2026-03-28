/**
 * Fetches the current price of a cryptocurrency pair from Binance.US.
 * @param {string} symbol The trading pair symbol (e.g., "BTCUSD", "PAXGTRY")
 * @return {number|string} The current price of the trading pair or an error message
 * @customfunction
 */
function BINANCE_PRICE(symbol) {
    // Check if symbol is undefined or empty
    if (!symbol) {
        return "Error: No symbol provided. Please enter a valid trading pair symbol.";
    }

    // Check if symbol is not a string
    if (typeof symbol !== 'string') {
        return `Error: Invalid input type. Expected string, got ${typeof symbol}. Input: ${JSON.stringify(symbol)}`;
    }

    const baseUrl = "https://www.binance.us/api/v3/ticker/price";

    // Remove underscore and space from symbol if present
    const formattedSymbol = symbol.replace(/[_\s]/g, "").toUpperCase();

    const url = `${baseUrl}?symbol=${formattedSymbol}`;

    try {
        const response = UrlFetchApp.fetch(url, {
            'method': 'GET',
            'muteHttpExceptions': true
        });

        const responseCode = response.getResponseCode();
        const contentType = response.getHeaders()['Content-Type'];
        const responseBody = response.getContentText();

        // Log diagnostic information
        console.log(`Input symbol: ${symbol}`);
        console.log(`Formatted symbol: ${formattedSymbol}`);
        console.log(`URL: ${url}`);
        console.log(`Response Code: ${responseCode}`);
        console.log(`Content-Type: ${contentType}`);
        console.log(`Response Body: ${responseBody}`);

        if (responseCode === 200 && contentType.includes('application/json')) {
            const result = JSON.parse(responseBody);
            if (result && result.price) {
                return parseFloat(result.price);
            } else {
                throw new Error("Price data not found in the response");
            }
        } else if (responseCode === 400) {
            throw new Error(`Invalid symbol or pair not supported: ${formattedSymbol}`);
        } else {
            throw new Error(`Unexpected response: Code ${responseCode}, Type ${contentType}`);
        }
    } catch (error) {
        console.error("Error in Binance.US API request: " + error.message);
        return "Error: " + error.message + ". Check script logs for details.";
    }
}