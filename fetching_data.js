const { default: axios } = require("axios")
const mysql = require('mysql')


const baseUrl = 'https://api.bybit.com'
const timestamp = parseInt(Date.now() / 1000)
// const timestamp = 1634559426
const pair = 'ETHUSDT'
const interval = 5 // in minutes
let from = timestamp - (200 * interval * 60)


const result = []

async function fetchFromAPI() {
    for (let i = 0; i < 50; i++) {
        let url = `${baseUrl}/public/linear/kline?symbol=${pair}&interval=${interval}&from=${from}`
        let res = await axios.get(url)
        res.data.result.forEach(item => result.push(item))
        from -= 200 * interval * 60
    }

    insertToDatabase(result)
}

async function insertToDatabase(data) {
    let con = mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'backtest_data'
    })

    con.connect(error => {
        if (error) throw error

        console.log('DB connected!')
        let sql = "INSERT INTO history (symbol, period, start_at, volume, open, high, low, close) VALUES ?"
        let values = data.map(item => [item.symbol, item.period, item.start_at, item.volume, item.open, item.high, item.low, item.close])
        con.query(sql, [values], (error, result) => {
            if (error) throw error

            console.log("Number of record : " + result.affectedRows)
            con.destroy()
        })
    })
}


fetchFromAPI()