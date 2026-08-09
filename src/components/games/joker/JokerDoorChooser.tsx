import React from 'react';
import type { DoorData, JokerPlayer, MapCell, SpecialDoorCardType } from './jokerTypes';
import { Joker3DWorldCanvas } from './door3d/Joker3DWorldCanvas';

interface JokerDoorChooserProps {
    timeLeft: number;
    player: JokerPlayer;
    currentCell: MapCell;
    gridMatrix: MapCell[][];
    allPlayers: JokerPlayer[];
    onSelectDoor: (door: DoorData, finalCost: number, isSkip: boolean) => void;
    onUseInventoryCard: (card: SpecialDoorCardType) => void;
}

export const JokerDoorChooser: React.FC<JokerDoorChooserProps> = ({
    timeLeft,
    player,
    currentCell,
    gridMatrix,
    allPlayers,
    onSelectDoor,
    onUseInventoryCard
}) => {
    return (
        <div className="w-full flex flex-col items-center font-mono text-slate-100 relative">
            {/* 3D INTERACTIVE WORLD VIEWPORT (Matching User Screenshots 2 & 3!) */}
            <Joker3DWorldCanvas
                currentCell={currentCell}
                player={player}
                allPlayers={allPlayers}
                gridMatrix={gridMatrix}
                phase="choosing"
                timeLeft={timeLeft}
                onSelectDoor={onSelectDoor}
            />
        </div>
    );
};
