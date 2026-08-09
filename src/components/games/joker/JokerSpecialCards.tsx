import React from 'react';
import type { SpecialDoorCardType } from './jokerTypes';

export interface SpecialCardUsageResult {
    success: boolean;
    warningMessage?: string;
    targetCostMultiplier?: number;
    isFreeRound?: boolean;
    skipDistance?: number;
    freezeActive?: boolean;
}

export function evaluateSpecialCardUse(
    cardType: SpecialDoorCardType,
    direction?: 'up' | 'down' | 'left' | 'right',
    currentR: number = 0,
    currentC: number = 0,
    gridMatrix?: any[][]
): SpecialCardUsageResult {

    if (cardType === 'green') {
        return {
            success: true,
            isFreeRound: true
        };
    }

    if (cardType === 'red') {
        return {
            success: true,
            targetCostMultiplier: 2 // 2X next round
        };
    }

    if (cardType === 'freeze') {
        return {
            success: true,
            freezeActive: true
        };
    }

    if (cardType === 'skip') {
        if (!direction || !gridMatrix) {
            return {
                success: false,
                warningMessage: 'INVALID VECTOR: DIRECTION VECTOR NOT SPECIFIED FOR SKIP CARD.'
            };
        }

        // Calculate 2-step advancement
        let step1R = currentR;
        let step1C = currentC;
        let step2R = currentR;
        let step2C = currentC;

        if (direction === 'up') { step1R -= 1; step2R -= 2; }
        if (direction === 'down') { step1R += 1; step2R += 2; }
        if (direction === 'left') { step1C -= 1; step2C -= 2; }
        if (direction === 'right') { step1C += 1; step2C += 2; }

        // Check boundary limits and walls for 2nd step
        const isOutOfBounds = step2R < 0 || step2R >= 7 || step2C < 0 || step2C >= 7;
        const cell2 = !isOutOfBounds ? gridMatrix[step2R][step2C] : null;
        const isBlockedWall = cell2?.type === 'wall' || cell2?.isBlockedCell;

        if (isOutOfBounds || isBlockedWall) {
            return {
                success: false,
                warningMessage: 'BLOCKED VECTOR: CANNOT ADVANCE (PATH CONTAINS BLOCKED DOOR OR LABYRINTH WALL)'
            };
        }

        return {
            success: true,
            skipDistance: 2
        };
    }

    return { success: true };
}
