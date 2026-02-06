
import { assignGroups } from './src/game/hearts.js';

function testTotal(n: number) {
    const arr = Array.from({ length: n }, (_, i) => `id_${i + 1}`);
    const groups = assignGroups(arr);
    const sizes = Object.values(groups).map(g => g.length);
    const thirds = sizes.filter(s => s === 3).length;
    const twos = sizes.filter(s => s === 2).length;
    const total = sizes.reduce((a, b) => a + b, 0);
    console.log(`n=${n} -> groups=${sizes.length}, 3s=${thirds}, 2s=${twos}, total=${total}`);
    console.log('Result:', JSON.stringify(groups, null, 2));
}

testTotal(4);  // expect 2x2
testTotal(5);  // expect 1x3, 1x2
testTotal(3);  // expect 1x3
