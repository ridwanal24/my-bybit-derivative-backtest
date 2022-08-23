const { default: axios } = require("axios");

async function main() {
    const pairList = await getPairList()
}

async function getPairList() {
    let symbolData = await (await axios.get('https://api.bybit.com/v2/public/symbols')).data.result
    symbolData = symbolData.filter(item => item.quote_currency == 'USDT')
        .map(item => ({ symbol: item.name, min_trading_qty: item.lot_size_filter.min_trading_qty, max_leverage: item.leverage_filter.max_leverage }))
        .sort((a, b) => a.symbol - b.symbol)
    let priceData = await (await axios.get('https://api.bybit.com/v2/public/tickers')).data.result
    priceData = priceData.filter(item => item.symbol.includes('USDT'))
        .map(item => ({ symbol: item.symbol, last_price: item.last_price }))
        .sort((a, b) => a.symbol - b.symbol)

    for (let i = 0; i < symbolData.length; i++) {
        symbolData[i]['price'] = priceData[i].last_price
        symbolData[i]['min_trading_usdt'] = priceData[i].last_price * symbolData[i].min_trading_qty
    }

    symbolData = symbolData.sort((a, b) => a.min_trading_usdt - b.min_trading_usdt)
    symbolData.map(item => {
        console.log(`${item.symbol} (${item.price}) $${item.min_trading_usdt} ${item.max_leverage}`)
    })
    return symbolData // GALUSDT
}

main()