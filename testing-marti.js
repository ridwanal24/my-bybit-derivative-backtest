const mysql = require('mysql')
const indicator = require('technicalindicators')
const pair = 'ADAUSDT'
const interval = 5 // in minutes

const fee = 0.07 // in %
let balance = 500
let oldBalance = balance
const positionState = {
    buy: {
        qty: 0,
    },
    sell: {
        qty: 0,
    },
}
let stopLoss = null
let sellPrices = []
let maxProfit = 0
let maxLoss = 0


let con = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'backtest_data'
})

con.connect(err => {
    if (err) throw err

    let query = `SELECT DISTINCT symbol, period, start_at, volume, open, high, low, close FROM history WHERE symbol='${pair}' AND period='${interval}' ORDER BY start_at ASC `
    con.query(query, (err, result, fields) => {
        if (err) throw err
        // console.log(result[result.length - 1].close)
        startTesting(result)
        con.destroy()
    })
})



function startTesting(ohlc) {
    const currentOhlc = []
    let trades = 0

    ohlc.forEach((item, index) => {
        // ======== //
        // for sell
        // item.open = 1 / item.open
        // item.high = 1 / item.high
        // item.low = 1 / item.low
        // item.close = 1 / item.close

        // ======== //

        // for min qty under 1
        // item.open = item.open / 100
        // item.high = item.high / 100
        // item.low = item.low / 100
        // item.close = item.close / 100


        currentOhlc.push(item)
        if (currentOhlc.length > 205) currentOhlc.shift()
        const currentPrice = currentOhlc[currentOhlc.length - 1].close
        const atr = getATRValue(currentOhlc) == null ? 1 : getATRValue(currentOhlc)
        const atrMultipler = 3.5

        if (stopLoss != null) {
            if (currentOhlc[currentOhlc.length - 1].low <= stopLoss) {
                if (positionState.buy.qty > 0) {

                    closePosition(positionState.buy.qty, stopLoss, 'BUY')
                    console.log(`(${++trades})  ` + 'CLOSE with $' + balance.toFixed(3) + ` (${(balance - oldBalance).toFixed(4)}) (SL) `)
                    oldBalance = balance
                }
            }
        }

        switch (scanClosePosition(currentOhlc)) {
            case 'CLOSE BUY':
                // CLOSE
                // console.log(positionState.buy.qty)
                if (positionState.buy.qty > 0) {

                    closePosition(positionState.buy.qty, currentPrice, 'BUY')
                    console.log(`(${++trades})  ` + 'CLOSE with $' + balance.toFixed(3) + ` (${(balance - oldBalance).toFixed(4)})`)
                    maxLoss = balance - oldBalance < maxLoss ? balance - oldBalance : maxLoss
                    maxProfit = balance - oldBalance > maxProfit ? balance - oldBalance : maxProfit
                    oldBalance = balance
                }
                break
            case 'CLOSE SELL':
                // CLOSE
                if (positionState.sell.qty > 0) {
                    // closePosition(positionState.sell.qty, currentPrice, 'SELL')
                    // console.log('CLOSE with $' + balance)
                }
                break
            default:
                break
        }

        switch (scanOpenPosition(currentOhlc)) {
            case 'OPEN BUY':
                // OPEN
                if (positionState.buy.qty < 2 ** 100) {
                    // openPosition(positionState.buy.qty + 1, currentPrice, 'BUY')
                    // if (positionState.buy.qty == 0) {

                    openPosition(parseInt(balance / currentPrice * 0.01), currentPrice, 'BUY', currentPrice - (atrMultipler * atr))
                    // openPosition(1, currentPrice, 'BUY', currentPrice - (atrMultipler * atr))
                    // } else {
                    // openPosition(parseInt(balance / currentPrice * 0.01), currentPrice, 'BUY', 'exist')
                    // }

                }
                break
            case 'OPEN SELL':
                // OPEN
                // openPosition(positionState.sell.qty + 1, currentPrice, 'SELL')

                break
            default:
                break
        }
    });

    console.log(`Max Profit : ${maxProfit}`)
    console.log(`Max Loss : ${maxLoss}`)

}

function scanOpenPosition(ohlc) {
    const rsi6 = indicator.RSI.calculate({ values: ohlc.map(item => item.open), period: 2 })
    if (rsi6.length < 1) {
        return 'NO OPEN'
    } else {
        if (rsi6[rsi6.length - 1] <= 10) {
            return 'OPEN BUY'
        } else if (rsi6[rsi6.length - 1] >= 90) {
            return 'OPEN SELL'
        }
    }
}

function scanClosePosition(ohlc) {
    const rsi6 = indicator.RSI.calculate({ values: ohlc.map(item => item.open), period: 6 })
    if (rsi6.length < 1) {
        return 'NO CLOSE'
    } else {
        if (rsi6[rsi6.length - 1] >= 70) {
            return 'CLOSE BUY'
        } else if (rsi6[rsi6.length - 1] <= 30) {
            return 'CLOSE SELL'
        }
    }
}

function openPosition(qty, currentPrice, side, sl) {
    if (side == 'BUY') {
        if (balance - currentPrice * qty * (100 + fee / 100) / 100 >= 0) {
            if (sl != 'exist') {
                stopLoss = sl
            }
            positionState.buy.qty += qty
            balance -= currentPrice * qty * (100 + fee / 100) / 100
        }
    } else if (side == 'SELL') {
        if (balance - currentPrice * qty * (100 + fee / 100) / 100 >= 0) {
            positionState.sell.qty += qty
            balance -= currentPrice * qty * (100 + fee / 100) / 100
            sellPrices.push(currentPrice * qty)
        }
    }
}

function closePosition(qty, currentPrice, side) {
    if (side == 'BUY') {
        positionState.buy.qty -= qty
        balance += currentPrice * qty * (100 - fee / 100) / 100
    } else if (side == 'SELL') {
        let averageBuyPrice = sellPrices.reduce((a, b) => a + b) / positionState.sell.qty
        positionState.sell.qty -= qty
        let selisih = averageBuyPrice - currentPrice
        balance += (averageBuyPrice + selisih) * qty * (100 - fee / 100) / 100

    }
}

function getATRValue(ohlc) {
    let high = ohlc.map(item => item.high)
    let low = ohlc.map(item => item.low)
    let close = ohlc.map(item => item.close)
    let period = 14

    let atr = indicator.ATR.calculate({ high, low, close, period })
    if (atr.length == 0) {
        return null
    } else {
        return atr[atr.length - 1]
    }
}