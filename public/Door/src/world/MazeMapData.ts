export interface CellData {
  x: number;
  y: number;
  label: string; // e.g. "R1", "12", "G1", etc.
  type?: 'entry' | 'exit' | 'normal';
  northDoor: boolean;
  southDoor: boolean;
  eastDoor: boolean;
  westDoor: boolean;
}

export class MazeMapData {
  public static readonly GRID_COLS = 7;
  public static readonly GRID_ROWS = 7;

  // Base 7x7 Grid Definitions (raw layout)
  private static readonly rawGrid: (Omit<CellData, 'northDoor' | 'southDoor' | 'eastDoor' | 'westDoor'> | null)[][] = [
    // Row 0
    [
      { x: 0, y: 0, label: '11' },
      { x: 1, y: 0, label: '12' },
      null,
      { x: 3, y: 0, label: 'R3', type: 'entry' },
      { x: 4, y: 0, label: '11' },
      { x: 5, y: 0, label: '14' },
      { x: 6, y: 0, label: '13' }
    ],
    // Row 1
    [
      null,
      { x: 1, y: 1, label: 'R2', type: 'entry' },
      { x: 2, y: 1, label: '11' },
      { x: 3, y: 1, label: '10' },
      { x: 4, y: 1, label: '11' },
      null,
      null
    ],
    // Row 2
    [
      { x: 0, y: 2, label: '14' },
      { x: 1, y: 2, label: '14' },
      null,
      null,
      { x: 4, y: 2, label: '14' },
      { x: 5, y: 2, label: '14' },
      { x: 6, y: 2, label: '10' }
    ],
    // Row 3
    [
      { x: 0, y: 3, label: '14' },
      { x: 1, y: 3, label: '14' },
      { x: 2, y: 3, label: '11' },
      { x: 3, y: 3, label: '12' },
      { x: 4, y: 3, label: '10' },
      { x: 5, y: 3, label: '14' },
      { x: 6, y: 3, label: '14' }
    ],
    // Row 4
    [
      { x: 0, y: 4, label: '14' },
      { x: 1, y: 4, label: '14' },
      { x: 2, y: 4, label: 'G3', type: 'exit' },
      { x: 3, y: 4, label: '12' },
      { x: 4, y: 4, label: '12' },
      null,
      { x: 6, y: 4, label: '14' }
    ],
    // Row 5
    [
      { x: 0, y: 5, label: '12' },
      { x: 1, y: 5, label: '12' },
      { x: 2, y: 5, label: '12' },
      { x: 3, y: 5, label: '10' },
      { x: 4, y: 5, label: 'G2', type: 'exit' },
      null,
      { x: 6, y: 5, label: '14' }
    ],
    // Row 6
    [
      { x: 0, y: 6, label: 'R1', type: 'entry' },
      { x: 1, y: 6, label: '11' },
      { x: 2, y: 6, label: '11' },
      { x: 3, y: 6, label: '10' },
      { x: 4, y: 6, label: '10' },
      { x: 5, y: 6, label: 'G1', type: 'exit' },
      { x: 6, y: 6, label: '10' }
    ]
  ];

  private static processedGrid: (CellData | null)[][] | null = null;

  /**
   * Initializes and connects all adjacent rooms with matching reciprocal doors.
   */
  public static getGrid(): (CellData | null)[][] {
    if (!this.processedGrid) {
      this.processedGrid = [];
      for (let r = 0; r < this.GRID_ROWS; r++) {
        const row: (CellData | null)[] = [];
        for (let c = 0; c < this.GRID_COLS; c++) {
          const raw = this.rawGrid[r][c];
          if (!raw) {
            row.push(null);
          } else {
            // Check adjacent cells to automatically enable connected doors
            const hasNorth = r > 0 && this.rawGrid[r - 1][c] !== null;
            const hasSouth = r < this.GRID_ROWS - 1 && this.rawGrid[r + 1][c] !== null;
            const hasEast = c < this.GRID_COLS - 1 && this.rawGrid[r][c + 1] !== null;
            const hasWest = c > 0 && this.rawGrid[r][c - 1] !== null;

            row.push({
              ...raw,
              northDoor: hasNorth,
              southDoor: hasSouth,
              eastDoor: hasEast,
              westDoor: hasWest
            });
          }
        }
        this.processedGrid.push(row);
      }
    }
    return this.processedGrid;
  }

  public static getCell(x: number, y: number): CellData | null {
    if (y < 0 || y >= this.GRID_ROWS || x < 0 || x >= this.GRID_COLS) return null;
    const grid = this.getGrid();
    return grid[y][x];
  }

  /**
   * Resolves adjacent room coordinates (nx, ny) for direction `dir`.
   */
  public static getTargetRoom(x: number, y: number, dir: 'north' | 'south' | 'east' | 'west'): { x: number; y: number } | null {
    let nx = x;
    let ny = y;

    switch (dir) {
      case 'north': ny -= 1; break;
      case 'south': ny += 1; break;
      case 'east': nx += 1; break;
      case 'west': nx -= 1; break;
    }

    const cell = this.getCell(nx, ny);
    if (cell !== null) {
      return { x: nx, y: ny };
    }
    return null;
  }
}
