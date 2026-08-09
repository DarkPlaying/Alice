// =========================================================
// JOKER GAME 7x7 LABYRINTH MAP DATA & ROTATION ENGINE
// =========================================================
import type { MapCell, DoorData, SpecialDoorCardType } from './jokerTypes';
// Base 7x7 Grid Matrix Template
// Entry Points: Red 1 (0,6), Red 2 (5,5), Red 3 (6,3)
// Exit Points: Green 1 (0,1), Green 2 (1,2), Green 3 (2,4)
// Walls: Black cells
export const BASE_7X7_MAP: MapCell[][] = (() => {
    const grid: MapCell[][] = [];

    // Walls coordinates (Black cells in Image 25)
    const wallCoords = new Set([
        '0,5', '1,1', '1,3', '2,1', '4,0', '4,3', '4,4', '5,0', '5,1', '5,6', '6,4'
    ]);

    for (let r = 0; r < 7; r++) {
        const row: MapCell[] = [];
        for (let c = 0; c < 7; c++) {
            const key = `${r},${c}`;
            let type: 'empty' | 'wall' | 'entry' | 'exit' | 'path' = 'path';
            let entryIndex: number | undefined = undefined;
            let exitIndex: number | undefined = undefined;

            if (r === 0 && c === 6) { type = 'entry'; entryIndex = 1; }
            else if (r === 5 && c === 5) { type = 'entry'; entryIndex = 2; }
            else if (r === 6 && c === 3) { type = 'entry'; entryIndex = 3; }
            else if (r === 0 && c === 1) { type = 'exit'; exitIndex = 1; }
            else if (r === 1 && c === 2) { type = 'exit'; exitIndex = 2; }
            else if (r === 2 && c === 4) { type = 'exit'; exitIndex = 3; }
            else if (wallCoords.has(key)) { type = 'wall'; }

            // Generate Doors for this cell (ONLY if not a wall)
            const doors: DoorData[] = [];
            if (type !== 'wall') {
                const dirs: Array<'up' | 'down' | 'left' | 'right'> = ['up', 'down', 'left', 'right'];
                dirs.forEach(dir => {
                    let nr = r;
                    let nc = c;
                    if (dir === 'up') nr--;
                    if (dir === 'down') nr++;
                    if (dir === 'left') nc--;
                    if (dir === 'right') nc++;
                    // Check bounds & wall
                    if (nr >= 0 && nr < 7 && nc >= 0 && nc < 7) {
                        const targetKey = `${nr},${nc}`;
                        const isTargetWall = wallCoords.has(targetKey);
                        if (!isTargetWall) {
                            const dirIdx = dirs.indexOf(dir);
                            const cardVal = 10 + ((r * 7 + c * 3 + dirIdx * 2) % 5); // Stable values strictly from 10 to 14
                            doors.push({
                                direction: dir,
                                cost: cardVal,
                                cardType: 'standard',
                                label: `${cardVal} CR`,
                                isBlocked: false
                            });
                        }
                    }
                });
            }

            row.push({
                r,
                c,
                type,
                entryIndex,
                exitIndex,
                doors,
                isBlockedCell: type === 'wall'
            });
        }
        grid.push(row);
    }
    // Populate random special cards
    return ensureTwentyFourSpecialCards(grid);
})();

export function spawnCardsToNewLocation(matrix: MapCell[][], claimR: number, claimC: number, claimedCards: string[]): MapCell[][] {
    const newMatrix = matrix.map(row => row.map(cell => ({ ...cell, doors: [...cell.doors], specialCards: cell.specialCards ? [...cell.specialCards] : undefined })));
    
    // Clear claimed cell special cards
    if (newMatrix[claimR]?.[claimC]) {
        newMatrix[claimR][claimC].specialCards = undefined;
    }

    // Respawn claimed cards into random path cells
    const emptyPathCells: MapCell[] = [];
    for (let r = 0; r < 7; r++) {
        for (let c = 0; c < 7; c++) {
            if (r === claimR && c === claimC) continue;
            const cell = newMatrix[r][c];
            if (cell.type === 'path' && (!cell.specialCards || cell.specialCards.length < 3)) {
                emptyPathCells.push(cell);
            }
        }
    }

    if (emptyPathCells.length > 0 && claimedCards && claimedCards.length > 0) {
        claimedCards.forEach(card => {
            if (!card || card === 'none') return;
            const randomCell = emptyPathCells[Math.floor(Math.random() * emptyPathCells.length)];
            if (randomCell) {
                const currentSpecs = newMatrix[randomCell.r][randomCell.c].specialCards || [];
                newMatrix[randomCell.r][randomCell.c].specialCards = [...currentSpecs, card as any];
            }
        });
    }
    return newMatrix;
}

export interface MapMatrixObject {
    grid: MapCell[][];
    old_map: MapCell[][];
    new_map: MapCell[][];
}

export function parseMapMatrix(raw: any): MapMatrixObject {
    if (!raw) {
        const emptyGrid: MapCell[][] = [];
        return { grid: emptyGrid, old_map: emptyGrid, new_map: emptyGrid };
    }
    if (typeof raw === 'object' && !Array.isArray(raw)) {
        const rawGrid = Array.isArray(raw.grid) && raw.grid.length === 7 ? raw.grid : undefined;
        const rawOld = Array.isArray(raw.old_map) && raw.old_map.length === 7 ? raw.old_map : undefined;
        const rawNew = Array.isArray(raw.new_map) && raw.new_map.length === 7 ? raw.new_map : undefined;

        const old_map = rawOld || rawGrid || [];
        const new_map = rawNew || old_map;
        const grid = rawGrid || old_map;
        return { grid, old_map, new_map };
    }
    if (Array.isArray(raw)) {
        const oldMap = (raw as any)._old_map && (raw as any)._old_map.length === 7 ? (raw as any)._old_map : raw;
        const newMap = (raw as any)._new_map && (raw as any)._new_map.length === 7 ? (raw as any)._new_map : oldMap;
        return { grid: raw, old_map: oldMap, new_map: newMap };
    }
    return { grid: [], old_map: [], new_map: [] };
}

export function buildMapMatrixPayload(grid: MapCell[][], oldMap?: MapCell[][], newMap?: MapCell[][]): MapMatrixObject {
    const validGrid = (grid && grid.length === 7) ? grid : [];
    const validOld = (oldMap && oldMap.length === 7) ? oldMap : validGrid;
    const validNew = (newMap && newMap.length === 7) ? newMap : validOld;
    return {
        grid: validGrid,
        old_map: validOld,
        new_map: validNew
    };
}

// Ensure EXACTLY 20 SPECIAL CARDS across 16 DISTINCT CELLS (spaced apart):
// 7 Red, 7 Green, 3 Skip, 3 Freeze (Jump)
// Distribution: 1 cell with 3 cards, 2 cells with 2 cards, 13 cells with 1 card (Total = 3 + 4 + 13 = 20)
export function ensureTwentyFourSpecialCards(grid: MapCell[][]): MapCell[][] {
    const cardPool: Array<'red' | 'green' | 'skip' | 'freeze'> = [
        'red', 'red', 'red', 'red', 'red', 'red', 'red',
        'green', 'green', 'green', 'green', 'green', 'green', 'green',
        'skip', 'skip', 'skip',
        'freeze', 'freeze', 'freeze'
    ];

    const shuffledPool = [...cardPool].sort(() => Math.random() - 0.5);

    // 1. Assign door card values to entry/exit gates and reset path doors
    for (let r = 0; r < 7; r++) {
        for (let c = 0; c < 7; c++) {
            const cell = grid[r][c];
            if (cell.type === 'wall') {
                cell.doors = [];
            } else {
                cell.doors.forEach(d => {
                    d.cardType = 'standard';
                    d.specialType = undefined;
                    d.cost = d.cost || (Math.floor(Math.random() * 5) + 10);
                    d.label = `${d.cost} CR`;
                });
            }
        }
    }

    // 2. Synchronize twin door costs first so both sides match
    syncTwinDoors(grid);

    // Reset old special cards first
    for (let r = 0; r < 7; r++) {
        for (let c = 0; c < 7; c++) {
            grid[r][c].specialCards = undefined;
            grid[r][c].doors?.forEach(d => {
                d.cardType = 'standard';
                d.specialType = undefined;
                d.specialCards = undefined;
            });
        }
    }

    // 3. Gather eligible inner path cells (excluding entry row r=0, exit row r=6, and walls)
    const eligiblePathCells: MapCell[] = [];
    for (let r = 1; r <= 5; r++) {
        for (let c = 0; c < 7; c++) {
            const cell = grid[r][c];
            if (cell.type === 'path' && cell.doors && cell.doors.length > 0) {
                eligiblePathCells.push(cell);
            }
        }
    }

    const manhattanDist = (c1: MapCell, c2: MapCell) => Math.abs(c1.r - c2.r) + Math.abs(c1.c - c2.c);

    // 4. Select cells with spatial separation rules:
    // Cell for 3 cards
    const cellFor3Cards = eligiblePathCells[Math.floor(Math.random() * eligiblePathCells.length)];

    // Cells for 2 cards (2 distinct cells), spacing them out from the 3-card cell
    const candidatesFor2 = eligiblePathCells.filter(c => c !== cellFor3Cards);
    const shuffledFor2 = [...candidatesFor2].sort(() => Math.random() - 0.5);
    const selectedCellsFor2: MapCell[] = [];

    for (const cand of shuffledFor2) {
        if (selectedCellsFor2.length >= 2) break;
        if (selectedCellsFor2.every(sel => manhattanDist(sel, cand) >= 2) && manhattanDist(cellFor3Cards, cand) >= 2) {
            selectedCellsFor2.push(cand);
        }
    }
    if (selectedCellsFor2.length < 2) {
        for (const cand of shuffledFor2) {
            if (selectedCellsFor2.length >= 2) break;
            if (!selectedCellsFor2.includes(cand)) selectedCellsFor2.push(cand);
        }
    }

    // Remaining 13 cells for 1-card each, keeping them spaced out from existing selected cells
    const existingSelected = [cellFor3Cards, ...selectedCellsFor2];
    const candidatesFor1 = eligiblePathCells.filter(c => !existingSelected.includes(c));
    const shuffledFor1 = [...candidatesFor1].sort(() => Math.random() - 0.5);
    const selectedCellsFor1: MapCell[] = [];

    for (const cand of shuffledFor1) {
        if (selectedCellsFor1.length >= 13) break;
        const allSelectedSoFar = [...existingSelected, ...selectedCellsFor1];
        if (allSelectedSoFar.every(sel => manhattanDist(sel, cand) >= 2)) {
            selectedCellsFor1.push(cand);
        }
    }
    if (selectedCellsFor1.length < 13) {
        for (const cand of shuffledFor1) {
            if (selectedCellsFor1.length >= 13) break;
            if (!selectedCellsFor1.includes(cand)) selectedCellsFor1.push(cand);
        }
    }

    const selectedCells = [cellFor3Cards, ...selectedCellsFor2, ...selectedCellsFor1];

    // 5. Distribute EXACTLY 20 cards into the 16 selected cells:
    // Cell 0: 3 cards
    // Cell 1 & 2: 2 cards each
    // Cells 3..15 (13 cells): 1 card each
    const cardCountsPerCell: number[] = [3, 2, 2, ...Array(13).fill(1)];
    let poolIdx = 0;

    selectedCells.forEach((cell, cellIdx) => {
        const countNeeded = cardCountsPerCell[cellIdx] || 1;
        cell.specialCards = [];
        for (let i = 0; i < countNeeded; i++) {
            if (poolIdx >= shuffledPool.length) break;
            cell.specialCards.push(shuffledPool[poolIdx++]);
        }
    });

    placeTrumpCardInRandomCell(grid);
    return grid;
}

// Maintains EXACTLY 1 TRUMP CARD in the entire labyrinth at any time.
// When claimed by a player, regenerates 1 new Trump Card on a random path cell.
export function placeTrumpCardInRandomCell(grid: MapCell[][], excludeR: number = -1, excludeC: number = -1): MapCell[][] {
    // 1. Remove any existing 'trump' card from all cells first to guarantee strictly 1
    for (let r = 0; r < 7; r++) {
        for (let c = 0; c < 7; c++) {
            if (grid[r]?.[c]?.specialCards) {
                grid[r][c].specialCards = grid[r][c].specialCards!.filter(s => s !== 'trump');
            }
        }
    }

    // 2. Gather eligible inner path cells (excluding entry row r=0, exit row r=6, and walls)
    const eligiblePathCells: MapCell[] = [];
    for (let r = 1; r <= 5; r++) {
        for (let c = 0; c < 7; c++) {
            const cell = grid[r]?.[c];
            if (cell && cell.type === 'path' && cell.doors && cell.doors.length > 0) {
                if (r !== excludeR || c !== excludeC) {
                    eligiblePathCells.push(cell);
                }
            }
        }
    }

    if (eligiblePathCells.length > 0) {
        const randomCell = eligiblePathCells[Math.floor(Math.random() * eligiblePathCells.length)];
        if (!randomCell.specialCards) randomCell.specialCards = [];
        randomCell.specialCards.push('trump');
    }

    return grid;
}

// Balancer: Maintains exactly 24 Special Cards across the map.
// When a player claims a special card, this places a new random special card on an available empty path cell.
export function balanceSpecialCardsCount(grid: MapCell[][], targetCount: number = 24, currentR: number = -1, currentC: number = -1): MapCell[][] {
    let currentCount = 0;
    const availableCells: MapCell[] = [];

    for (let r = 1; r <= 5; r++) {
        for (let c = 0; c < 7; c++) {
            const cell = grid[r][c];
            if (!cell || cell.type === 'wall') continue;

            if (cell.specialCards && cell.specialCards.length > 0) {
                currentCount += cell.specialCards.length;
            } else if (cell.type === 'path') {
                if (r !== currentR || c !== currentC) {
                    availableCells.push(cell);
                }
            }
        }
    }

    const missing = targetCount - currentCount;
    if (missing > 0 && availableCells.length > 0) {
        const specialTypes: SpecialDoorCardType[] = ['red', 'green', 'skip', 'freeze'];
        const shuffledCells = [...availableCells].sort(() => Math.random() - 0.5);

        for (let i = 0; i < Math.min(missing, shuffledCells.length); i++) {
            const cell = shuffledCells[i];
            const randomSpec = specialTypes[Math.floor(Math.random() * specialTypes.length)];
            cell.specialCards = [randomSpec];
        }
    }

    return grid;
}

// Alias for backwards compatibility
export const ensureTwentySpecialCards = ensureTwentyFourSpecialCards;

export function getOppositeDirection(dir: 'up' | 'down' | 'left' | 'right'): 'up' | 'down' | 'left' | 'right' {
    if (dir === 'up') return 'down';
    if (dir === 'down') return 'up';
    if (dir === 'left') return 'right';
    return 'left';
}

// Synchronize twin doors across adjacent cells so each door passage has ONE SINGLE CONSTANT PRICE & CARD VALUE
export function syncTwinDoors(grid: MapCell[][]): MapCell[][] {
    for (let r = 0; r < 7; r++) {
        for (let c = 0; c < 7; c++) {
            const cell = grid[r][c];
            if (cell.type === 'wall' || !cell.doors) continue;

            cell.doors.forEach(d => {
                let nr = r, nc = c;
                if (d.direction === 'up') nr--;
                if (d.direction === 'down') nr++;
                if (d.direction === 'left') nc--;
                if (d.direction === 'right') nc++;

                if (nr >= 0 && nr < 7 && nc >= 0 && nc < 7 && grid[nr][nc] && grid[nr][nc].type !== 'wall') {
                    const oppDir = getOppositeDirection(d.direction);
                    const twinDoor = grid[nr][nc].doors?.find(td => td.direction === oppDir);

                    if (twinDoor) {
                        const key1 = `${r},${c}:${d.direction}`;
                        const key2 = `${nr},${nc}:${oppDir}`;
                        if (key1 < key2) {
                            twinDoor.cost = d.cost;
                            twinDoor.cardType = d.cardType;
                            twinDoor.specialType = d.specialType;
                            twinDoor.specialCards = d.specialCards ? [...d.specialCards] : undefined;
                            twinDoor.label = d.label;
                        } else {
                            d.cost = twinDoor.cost;
                            d.cardType = twinDoor.cardType;
                            d.specialType = twinDoor.specialType;
                            d.specialCards = twinDoor.specialCards ? [...twinDoor.specialCards] : undefined;
                            d.label = twinDoor.label;
                        }
                    }
                }
            });
        }
    }
    return grid;
}

// Rotate Matrix 90 degrees clockwise
export function rotateMatrix90(matrix: MapCell[][]): MapCell[][] {
    const N = matrix.length;
    const rotated: MapCell[][] = Array.from({ length: N }, () => Array(N).fill(null));

    for (let r = 0; r < N; r++) {
        for (let c = 0; c < N; c++) {
            const newR = c;
            const newC = N - 1 - r;
            const cell = matrix[r][c];

            // Adjust door directions for 90° clockwise rotation
            const newDoors = cell.doors.map(d => {
                let newDir: 'up' | 'down' | 'left' | 'right' = d.direction;
                if (d.direction === 'up') newDir = 'right';
                else if (d.direction === 'right') newDir = 'down';
                else if (d.direction === 'down') newDir = 'left';
                else if (d.direction === 'left') newDir = 'up';
                return { ...d, direction: newDir };
            });

            rotated[newR][newC] = {
                ...cell,
                r: newR,
                c: newC,
                doors: cell.type === 'wall' ? [] : newDoors
            };
        }
    }
    return rotated;
}

// Generate Rotated Map Grid for 0°, 90°, 180°, or 270° 
export function generateRotatedMap(rotationDeg: number = 0, baseGrid?: MapCell[][]): MapCell[][] {
    let rotatedGrid = JSON.parse(JSON.stringify(baseGrid && baseGrid.length === 7 ? baseGrid : BASE_7X7_MAP)) as MapCell[][];
    const normalizedDeg = ((rotationDeg % 360) + 360) % 360;
    const steps = Math.floor(normalizedDeg / 90) % 4;
    for (let i = 0; i < steps; i++) {
        rotatedGrid = rotateMatrix90(rotatedGrid);
    }
    return rotatedGrid;
}

// Fixed Red Entry Gate coordinates: R1 (0,6), R2 (5,5), R3 (6,3)
export const RED_ENTRY_GATES = [
    { r: 0, c: 6, entryIndex: 1 },
    { r: 5, c: 5, entryIndex: 2 },
    { r: 6, c: 3, entryIndex: 3 }
];

export function getEntryCell(grid?: any, entryIdx?: number): { r: number; c: number; entryIndex: number } {
    const matrix = parseMapMatrix(grid).grid;
    if (matrix && matrix.length > 0) {
        const found = matrix.flat().find(c => c && c.type === 'entry' && c.entryIndex === entryIdx);
        if (found) return { r: found.r, c: found.c, entryIndex: found.entryIndex! };
    }
    if (entryIdx) {
        const found = RED_ENTRY_GATES.find(e => e.entryIndex === entryIdx);
        if (found) return found;
    }
    const randomIndex = Math.floor(Math.random() * RED_ENTRY_GATES.length);
    return RED_ENTRY_GATES[randomIndex];
}

export function getRandomEntryCell(grid?: any): { r: number; c: number; entryIndex: number } {
    const matrix = parseMapMatrix(grid).grid;
    if (matrix && matrix.length > 0) {
        const entries = matrix.flat().filter(c => c && c.type === 'entry');
        if (entries.length > 0) {
            const randomCell = entries[Math.floor(Math.random() * entries.length)];
            return { r: randomCell.r, c: randomCell.c, entryIndex: randomCell.entryIndex! };
        }
    }
    const randomIndex = Math.floor(Math.random() * RED_ENTRY_GATES.length);
    return RED_ENTRY_GATES[randomIndex];
}

export function getRotationFromMatrix(matrix?: any): number {
    const grid = parseMapMatrix(matrix).grid;
    if (!grid || grid.length < 7) return 0;
    const entry1 = getEntryCell(grid, 1);
    if (entry1.r === 0 && entry1.c === 6) return 0;
    if (entry1.r === 6 && entry1.c === 6) return 90;
    if (entry1.r === 6 && entry1.c === 0) return 180;
    if (entry1.r === 0 && entry1.c === 0) return 270;
    return 0; // Fallback
}