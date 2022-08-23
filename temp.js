let a = ['LOSE', 'LOSE', 'WIN', 'WIN', 'LOSE']

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
                console.log(consecutive)
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

    console.log(consecutive)
}

showConsecutiveTrade(a)