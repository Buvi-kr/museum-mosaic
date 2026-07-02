// gridTemplates.js
// 관리자 모드에서 사용할 세 가지(12, 14, 28) 그리드 템플릿의 하드코딩 데이터

function generateGrid(cols, rows) {
    const grid = [];
    let id = 0;
    const w = 1 / cols;
    const h = 1 / rows;
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            grid.push({
                id: id++,
                row: r,
                col: c,
                x: c / cols,
                y: r / rows,
                w: 1 / cols,
                h: 1 / rows,
                active: true
            });
        }
    }
    return grid;
}

const gridTemplates = {
    '6-slot': generateGrid(3, 2),  // 6칸 (가로 3 x 세로 2)
    '12-slot': generateGrid(4, 3), // 12칸 (가로 4 x 세로 3)
    '20-slot': generateGrid(5, 4), // 20칸 (가로 5 x 세로 4)
    '28-slot': generateGrid(7, 4)  // 28칸 (가로 7 x 세로 4)
};

module.exports = gridTemplates;
