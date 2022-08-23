
const mysql = require('mysql')
const indicator = require('technicalindicators')
const pair = 'IOSTUSDT'
const interval = 5 // in minutes
let balance = 10

let winLoseHistory = []

let con = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'backtest_data'
})

con.connect(err => {
    if (err) throw err

    let query = `SELECT DISTINCT symbol, period, start_at, volume, open, high, low, close FROM history WHERE symbol='${pair}' AND period='${interval}' ORDER BY start_at ASC LIMIT 2500 OFFSET 50000 `
    con.query(query, (err, result, fields) => {
        if (err) throw err

        startTesting(result)
        showConsecutiveTrade(winLoseHistory)
        con.destroy()
    })
})

function showConsecutiveTrade(winLoseHistory) {
    let consecutive = {
        "WIN": 0,
        "LOSE": 0
    }

    let temp = {
        "WIN": 0,
        "LOSE": 0
    }

    winLoseHistory.forEach((item, index) => {
        if (index != 0) {
            if (item == winLoseHistory[index - 1]) {
                temp[item] += 1

            } else {
                temp[item] = 1
            }

            if (temp[item] > consecutive[item]) {
                consecutive[item] = temp[item]
            }
        } else {
            temp[item] += 1
        }
    })

    console.log('Consecutive Win/Lose')
    console.log(consecutive)
}

function startTesting(history) {
    const currentHistory = []
    let onTrade = false
    let onPosition = 'BUY'

    let atrMultipler = 2
    let riskMultipler = 1
    let rewardMultipler = 1

    let tpPrice = 0
    let slPrice = 0

    let win = 0
    let lose = 0

    history.forEach((item, index) => {
        currentHistory.push(item)
        if (currentHistory.length > 205) currentHistory.shift()
        let atr = getATRValue(currentHistory) * atrMultipler

        if (onTrade) {
            if (onPosition == 'BUY') {
                if (item.high > tpPrice) {
                    win++
                    winLoseHistory.push('WIN')
                    onTrade = false
                    balance += rewardMultipler / 100 * balance
                    showLog(win, lose, rewardMultipler, riskMultipler, balance, index, item)
                }

                if (item.low < slPrice) {
                    winLoseHistory.push('LOSE')
                    lose++
                    onTrade = false
                    balance -= riskMultipler / 100 * balance
                    showLog(win, lose, rewardMultipler, riskMultipler, balance, index, item)
                }

            }
            if (onPosition == 'SELL') {
                if (item.low < tpPrice) {
                    winLoseHistory.push('WIN')
                    win++
                    onTrade = false
                    balance += rewardMultipler / 100 * balance
                    showLog(win, lose, rewardMultipler, riskMultipler, balance, index, item)
                }

                if (item.high > slPrice) {
                    winLoseHistory.push('LOSE')
                    lose++
                    onTrade = false
                    balance -= riskMultipler / 100 * balance
                    showLog(win, lose, rewardMultipler, riskMultipler, balance, index, item)
                }
            }

        } else {
            if (atr != null) {
                switch (getSignal(currentHistory)) {
                    case 'BUY':
                        onTrade = true
                        onPosition = 'BUY'

                        tpPrice = item.close + rewardMultipler * atr
                        slPrice = item.close - riskMultipler * atr

                        // fixed percentage
                        tpPrice = item.close + rewardMultipler * (item.close * 1 / 100)
                        slPrice = item.close - riskMultipler * (item.close * 1 / 100)

                        break

                    case 'SELL':
                        onTrade = true
                        onPosition = 'SELL'

                        tpPrice = item.close - rewardMultipler * atr
                        slPrice = item.close + riskMultipler * atr

                        // fixed percentage
                        tpPrice = item.close - rewardMultipler * (item.close * 1 / 100)
                        slPrice = item.close + riskMultipler * (item.close * 1 / 100)
                        break

                    default:

                        break

                }
            }
        }
    })
}


function showLog(win, lose, rewardMultipler, riskMultipler, balance, index, item) {
    let date = new Date(item.start_at * 1000)
    console.log(`TOTAL TRADE: ${win + lose} | WINRATE: ${(win / (win + lose) * 100).toFixed(2)} | RR: ${win * rewardMultipler - lose * riskMultipler} | BALANCE: ${balance.toFixed(2)} | x${index + 1} | ${date.toLocaleString()}`)
}

function getSignal(currentHistory) {
    let rsi6 = indicator.RSI.calculate({ period: 2, values: currentHistory.map(item => item.open) })
    let macd = indicator.MACD.calculate({ fastPeriod: 12, slowPeriod: 26, signalPeriod: 9, SimpleMAOscillator: true, SimpleMASignal: true, values: currentHistory.map(item => item.close) })
    let ema200 = indicator.SMA.calculate({ period: 200, values: currentHistory.map(item => item.close) })

    // RSI
    // if (rsi6.length < 2) {
    //     return 'NO SIGNAL'
    // } else {
    //     if (rsi6[rsi6.length - 1] > 20 && rsi6[rsi6.length - 2] < 20) {

    //         return 'SELL'

    //     } else if (rsi6[rsi6.length - 1] < 80 && rsi6[rsi6.length - 2] > 80) {

    //         return 'BUY'
    //     } else {
    //         return 'NO SIGNAL'
    //     }
    // }

    // RSI LANGSUNG
    // if (rsi6.length < 2) {
    //     return 'NO SIGNAL'
    // } else {
    //     if (rsi6[rsi6.length - 1] <= 20) {

    //         return 'BUY'

    //     } else if (rsi6[rsi6.length - 1] >= 80) {

    //         return 'SELL'
    //     } else {
    //         return 'NO SIGNAL'
    //     }
    // }

    // MACD
    // if (macd.length < 2) {
    //     return 'NO SIGNAL'
    // } else {
    //     if (macd[macd.length - 1].histogram > 0 && macd[macd.length - 2].histogram < 0 && currentHistory[currentHistory.length - 1].close > ema200[ema200.length - 1]) {
    //         return 'BUY'
    //     } else if (macd[macd.length - 1].histogram < 0 && macd[macd.length - 2].histogram > 0 && currentHistory[currentHistory.length - 1].close < ema200[ema200.length - 1]) {
    //         return 'SELL'
    //     } else {
    //         return 'NO SIGNAL'
    //     }
    // }

    // RSI & EMA
    // if (ema200.length < 2) {
    //     return 'NO SIGNAL'
    // } else {
    //     if (rsi6[rsi6.length - 1] <= 10 && currentHistory[currentHistory.length - 1].close > ema200[ema200.length - 1]) {
    //         return 'BUY'
    //     } else if (rsi6[rsi6.length - 1] >= 90 && currentHistory[currentHistory.length - 1].close < ema200[ema200.length - 1]) {
    //         return 'SELL'
    //     } else {
    //         return 'NO SIGNAL'
    //     }
    // }

    // EMA ASAL BUY
    if (ema200.length < 1) {
        return "NO SIGNAL"
    } else {
        if (currentHistory[currentHistory.length - 1].close > ema200[ema200.length - 1]) {
            return "BUY"
        } else if (currentHistory[currentHistory.length - 1].close < ema200[ema200.length - 1]) {
            return "SELL"
        } else {
            return "NO SIGNAL"
        }
    }
}

function getATRValue(currentHistory) {
    let high = currentHistory.map(item => item.high)
    let low = currentHistory.map(item => item.low)
    let close = currentHistory.map(item => item.close)
    let period = 14

    let atr = indicator.ATR.calculate({ high, low, close, period })
    if (atr.length == 0) {
        return null
    } else {
        return atr[atr.length - 1]
    }
}