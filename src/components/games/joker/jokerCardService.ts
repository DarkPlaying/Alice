import { supabaseUrl, supabaseKey, getAccessToken } from '../../../supabaseClient';
import type { JokerPlayer, JokerGameState, SpecialDoorCardType } from './jokerTypes';
import { parseMapMatrix, buildMapMatrixPayload, spawnCardsToNewLocation, generateRotatedMap } from './jokerMapData';
import { calculateRedCostMultiplier } from './jokerInventoryConfig';

const GAME_ID = 'joker_main';

export const isSamePlayer = (p1?: JokerPlayer | null, p2?: JokerPlayer | null): boolean => {
    if (!p1 || !p2) return false;
    if (p1.id && p2.id && p1.id === p2.id) return true;
    if (p1.username && p2.username && String(p1.username).toLowerCase() === String(p2.username).toLowerCase()) return true;
    return false;
};

// Count frequencies of each card type in an inventory array
export const getInventoryCardCounts = (inventory: SpecialDoorCardType[] = []): Record<string, number> => {
    const counts: Record<string, number> = {};
    for (const card of inventory) {
        if (!card || (card as string) === 'none') continue;
        counts[card] = (counts[card] || 0) + 1;
    }
    return counts;
};

// Merges DB inventory with local player inventory so newly claimed cards are NEVER wiped out by stale Realtime updates.
export const mergePlayerInventories = (
    dbInventory: SpecialDoorCardType[] = [],
    localInventory: SpecialDoorCardType[] = [],
    playerFlags?: { hasUsedSkipCard?: boolean; hasUsedGreenCard?: boolean }
): SpecialDoorCardType[] => {
    const dbCounts = getInventoryCardCounts(dbInventory);
    const localCounts = getInventoryCardCounts(localInventory);

    const allCardTypes = Array.from(new Set([...Object.keys(dbCounts), ...Object.keys(localCounts)])) as SpecialDoorCardType[];
    const mergedResult: SpecialDoorCardType[] = [];

    for (const cardType of allCardTypes) {
        const dbC = dbCounts[cardType] || 0;
        const localC = localCounts[cardType] || 0;

        let finalCount = Math.max(dbC, localC);

        // If card was explicitly used locally in this phase, local count is authoritative for that card
        if (cardType === 'skip' && playerFlags?.hasUsedSkipCard) {
            finalCount = localC;
        } else if (cardType === 'green' && playerFlags?.hasUsedGreenCard) {
            finalCount = localC;
        }

        for (let i = 0; i < finalCount; i++) {
            mergedResult.push(cardType);
        }
    }

    return mergedResult;
};

export interface ClaimResult {
    success: boolean;
    claimedCards: SpecialDoorCardType[];
    updatedPlayer: JokerPlayer;
    payloadMatrix: any;
}

// Atomic Card Claim Service Function
export async function claimSpecialCardsForPlayer(
    myPlayer: JokerPlayer,
    gameState: JokerGameState,
    claimR: number,
    claimC: number
): Promise<ClaimResult | null> {
    try {
        const token = await getAccessToken();
        const res = await fetch(`${supabaseUrl}/rest/v1/joker_game_state?id=eq.${GAME_ID}&select=map_matrix,participants`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'apikey': supabaseKey
            },
            cache: 'no-store'
        });

        if (!res.ok) return null;
        const dbData = await res.json();
        if (!dbData || !dbData[0]) return null;

        const liveParsed = parseMapMatrix(dbData[0].map_matrix);
        const liveNewMap = liveParsed.new_map && liveParsed.new_map.length === 7 ? liveParsed.new_map : generateRotatedMap(gameState.map_rotation || 0);
        const liveOldMap = liveParsed.old_map && liveParsed.old_map.length === 7 ? liveParsed.old_map : liveNewMap;

        // Read special cards at claim room cell: check live new_map FIRST.
        // If new_map cell specialCards has been cleared ([]), the card in this room was already claimed!
        const oldMapCell = liveOldMap[claimR]?.[claimC];
        const newMapCell = liveNewMap[claimR]?.[claimC];

        const availableCards: SpecialDoorCardType[] = (newMapCell?.specialCards && newMapCell.specialCards.length > 0)
            ? newMapCell.specialCards
            : (Array.isArray(newMapCell?.specialCards) && newMapCell.specialCards.length === 0)
                ? [] // Already claimed & cleared from new_map!
                : (oldMapCell?.specialCards && oldMapCell.specialCards.length > 0)
                    ? oldMapCell.specialCards
                    : [];

        const cardsToClaim = availableCards.filter(c => c && (c as string) !== 'none');
        if (cardsToClaim.length === 0) {
            console.log(`[JOKER_CARD_SERVICE] Room (${claimR}, ${claimC}) has no special cards available or already claimed.`);
            return null;
        }

        // Live participants from DB
        const liveParticipants: JokerPlayer[] = dbData[0].participants || [];
        const dbMe = liveParticipants.find(p => isSamePlayer(p, myPlayer));
        const baseInv: SpecialDoorCardType[] = dbMe?.inventory || myPlayer.inventory || [];
        const newInventory: SpecialDoorCardType[] = [...baseInv, ...cardsToClaim];

        const nextRoundCostMultiplier = calculateRedCostMultiplier(newInventory, 0, Boolean(myPlayer.frozenBy || myPlayer.frozenByPlayerId));

        const newMapHasCard = newMapCell?.specialCards && newMapCell.specialCards.filter(c => c && (c as string) !== 'none').length > 0;

        let payloadMatrix: any;
        if (newMapHasCard) {
            // First claimant: clear cell in new_map and respawn card to another unoccupied path cell
            const occupiedPositions = liveParticipants
                .filter(p => typeof p.currentR === 'number' && typeof p.currentC === 'number')
                .map(p => ({ r: p.currentR, c: p.currentC }));
            const updatedNewMatrix = spawnCardsToNewLocation(liveNewMap, claimR, claimC, cardsToClaim, occupiedPositions);
            payloadMatrix = buildMapMatrixPayload(liveOldMap, liveOldMap, updatedNewMatrix);
            console.log(`[JOKER_CARD_SERVICE] First claimant — cards [${cardsToClaim.join(', ')}] claimed & respawned.`);
        } else {
            // Subsequent claimant: card already respawned, receive copy from old_map
            payloadMatrix = buildMapMatrixPayload(liveOldMap, liveOldMap, liveNewMap);
            console.log(`[JOKER_CARD_SERVICE] Subsequent claimant — cards [${cardsToClaim.join(', ')}] claimed from old_map.`);
        }

        const updatedPlayer: JokerPlayer = {
            ...myPlayer,
            inventory: newInventory,
            nextRoundCostMultiplier
        };

        // Atomically update DB with live participants list
        const updatedParticipants = liveParticipants.map(p => isSamePlayer(p, updatedPlayer) ? updatedPlayer : p);

        const patchRes = await fetch(`${supabaseUrl}/rest/v1/joker_game_state?id=eq.${GAME_ID}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'apikey': supabaseKey
            },
            body: JSON.stringify({
                map_matrix: payloadMatrix,
                participants: updatedParticipants
            })
        });

        if (!patchRes.ok) {
            console.warn(`[JOKER_CARD_SERVICE] DB PATCH status ${patchRes.status}`);
        }

        return {
            success: true,
            claimedCards: cardsToClaim,
            updatedPlayer,
            payloadMatrix
        };

    } catch (err) {
        console.error('[JOKER_CARD_SERVICE] Claim exception:', err);
        return null;
    }
}
