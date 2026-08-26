import type { JokerGameState, JokerPlayer, MapCell, DoorData, SpecialDoorCardType } from './jokerTypes';
import { ensureTwentySpecialCards, syncTwinDoors, balanceSpecialCardsCount } from './jokerMapData';
import { calculateRedCostMultiplier } from './jokerInventoryConfig';

// Evaluate Player Round Door Purchase
export function processDoorPurchase(
    player: JokerPlayer,
    door: DoorData,
    finalCost: number,
    isSkip: boolean,
    gridMatrix: MapCell[][]
): { updatedPlayer: JokerPlayer; logMsg: string } {
    const baseR = Number(player.currentR ?? 0);
    const baseC = Number(player.currentC ?? 0);

    let nextR = baseR;
    let nextC = baseC;
    const step = isSkip ? 2 : 1;

    if (door.direction === 'up') {
        nextR = Math.max(0, baseR - step);
    } else if (door.direction === 'down') {
        nextR = Math.min(6, baseR + step);
    } else if (door.direction === 'left') {
        nextC = Math.max(0, baseC - step);
    } else if (door.direction === 'right') {
        nextC = Math.min(6, baseC + step);
    }

    const targetCell = gridMatrix[nextR]?.[nextC];
    const isTargetWallOrBlocked = !targetCell || targetCell.type === 'wall' || targetCell.type === 'empty' || Boolean(targetCell.isBlockedCell);

    if (isTargetWallOrBlocked) {
        // Target cell is a wall or invalid/blocked cell: Keep player safely in current room cell!
        nextR = baseR;
        nextC = baseC;
    }

    const finalCell = gridMatrix[nextR]?.[nextC];
    const reachedExit = finalCell?.type === 'exit' && finalCell?.exitIndex === player.entryIndex;
    const actualCost = isSkip ? 0 : (finalCost || 0);
    const newScore = Math.max(0, (player.score || 0) - actualCost);

    const isGreenUsed = player.hasUsedGreenCard;
    const updatedMult = isGreenUsed ? 1 : (player.nextRoundCostMultiplier || 1);

    const updatedPlayer: JokerPlayer = {
        ...player,
        inventory: player.inventory || [],
        currentR: nextR,
        currentC: nextC,
        score: newScore,
        hasUsedGreenCard: false,
        hasUsedSkipCard: false,
        nextRoundCostMultiplier: updatedMult,
        frozenBy: undefined,
        frozenByPlayerId: undefined,
        blockedDoorsByRed: [],
        blockedByPlayerName: undefined,
        blockedByPlayerId: undefined,
        trumpSwappedBy: undefined,
        hasReachedExit: reachedExit,
        status: reachedExit ? 'escaped' : player.status
    } as any;

    const logMsg = `Player ${player.username} bought ${door.direction.toUpperCase()} door for ${finalCost} CR. Position: (${nextR}, ${nextC}).`;
    return { updatedPlayer, logMsg };
}

// Evaluate Penalty for No Door Purchase (0 Points for Round 1 starting round, -100 for subsequent rounds)
export function processNoPurchasePenalty(player: JokerPlayer, currentRound: number = 1): JokerPlayer {
    // If player was frozen by Freeze Card, they are immune to penalty
    if (player.frozenByPlayerId) {
        return {
            ...player,
            frozenByPlayerId: undefined
        };
    }

    // Starting first round penalty is 0 points
    const penaltyAmount = (currentRound === 1) ? 0 : 100;

    return {
        ...player,
        score: Math.max(0, player.score - penaltyAmount)
    };
}
