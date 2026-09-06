import type { CharacterEmoteTracks } from '../types';

/**
 * Joker (Arkham Origins) Animation Keyframe Emote Tracks
 * Includes Idle, Walk, Door Reach & Pull, Biometric Scanner, and Jump
 */
export const JOKER_EMOTES: CharacterEmoteTracks = {
    idle: [
        {
            percentage: 0,
            name: '0% Idle Rest Pose',
            la: { x: 0, y: 0, z: 0 },
            ra: { x: 0, y: 0, z: 0 },
            le: { x: 0, y: 0, z: 0 },
            re: { x: 0, y: 0, z: 0 },
            ll: { x: 0, y: 0, z: 0 },
            rl: { x: 0, y: 0, z: 0 },
            lk: { x: 0, y: 0, z: 0 },
            rk: { x: 0, y: 0, z: 0 }
        },
        {
            percentage: 50,
            name: '50% Idle Subtle Breathing & Sway',
            la: { x: 1, y: 0, z: 1 },
            ra: { x: 1, y: 0, z: -1 },
            le: { x: 0, y: 0, z: 0 },
            re: { x: 0, y: 0, z: 0 },
            ll: { x: 0, y: 0, z: 0 },
            rl: { x: 0, y: 0, z: 0 },
            lk: { x: 0, y: 0, z: 0 },
            rk: { x: 0, y: 0, z: 0 }
        },
        {
            percentage: 100,
            name: '100% Idle Loop Return',
            la: { x: 0, y: 0, z: 0 },
            ra: { x: 0, y: 0, z: 0 },
            le: { x: 0, y: 0, z: 0 },
            re: { x: 0, y: 0, z: 0 },
            ll: { x: 0, y: 0, z: 0 },
            rl: { x: 0, y: 0, z: 0 },
            lk: { x: 0, y: 0, z: 0 },
            rk: { x: 0, y: 0, z: 0 }
        }
    ],
    walk: [
        {
            percentage: 0,
            name: '0% Left Stride Plant',
            la: { x: 0, y: 0, z: 24 },
            le: { x: 0, y: 0, z: -5 },
            ra: { x: 0, y: 0, z: 24 },
            re: { x: 0, y: 0, z: -16 },
            ll: { x: 0, y: 0, z: -1 },
            lk: { x: 0, y: 0, z: -41 },
            rl: { x: 0, y: 0, z: -39 },
            rk: { x: 0, y: 0, z: -34 }
        },
        {
            percentage: 10,
            name: '10% Mid Stride Pass',
            la: { x: 0, y: 0, z: 16 },
            le: { x: 0, y: 0, z: -5 },
            ra: { x: 0, y: 0, z: 16 },
            re: { x: 0, y: 0, z: -12 },
            ll: { x: 0, y: 0, z: -18 },
            lk: { x: 0, y: 0, z: -22 },
            rl: { x: 0, y: 0, z: -29 },
            rk: { x: 0, y: 0, z: -49 }
        },
        {
            percentage: 25,
            name: '25% Passing Center (Lift)',
            la: { x: 0, y: 0, z: 0 },
            le: { x: 0, y: 0, z: -5 },
            ra: { x: 0, y: 0, z: 0 },
            re: { x: 0, y: 0, z: -5 },
            ll: { x: 0, y: 0, z: -44 },
            lk: { x: 0, y: 0, z: -8 },
            rl: { x: 0, y: 0, z: -13 },
            rk: { x: 0, y: 0, z: -54 }
        },
        {
            percentage: 50,
            name: '50% Right Stride Peak (Plant)',
            la: { x: 0, y: 0, z: -24 },
            le: { x: 0, y: 0, z: -16 },
            ra: { x: 0, y: 0, z: -24 },
            re: { x: 0, y: 0, z: -5 },
            ll: { x: 0, y: 0, z: -52 },
            lk: { x: 0, y: 0, z: -30 },
            rl: { x: 0, y: 0, z: 12 },
            rk: { x: 0, y: 0, z: -45 }
        },
        {
            percentage: 75,
            name: '75% Passing Center (Lift)',
            la: { x: 0, y: 0, z: 0 },
            le: { x: 0, y: 0, z: -5 },
            ra: { x: 0, y: 0, z: 0 },
            re: { x: 0, y: 0, z: -5 },
            ll: { x: 0, y: 0, z: -26 },
            lk: { x: 0, y: 0, z: -50 },
            rl: { x: 0, y: 0, z: -31 },
            rk: { x: 0, y: 0, z: -12 }
        },
        {
            percentage: 100,
            name: '100% Left Stride End (Seamless Loop)',
            la: { x: 0, y: 0, z: 24 },
            le: { x: 0, y: 0, z: -5 },
            ra: { x: 0, y: 0, z: 24 },
            re: { x: 0, y: 0, z: -16 },
            ll: { x: 0, y: 0, z: -1 },
            lk: { x: 0, y: 0, z: -41 },
            rl: { x: 0, y: 0, z: -39 },
            rk: { x: 0, y: 0, z: -34 }
        }
    ],
    door: [
        { percentage: 0, name: '0% Idle Ready', la: { x: 0, y: 0, z: 0 }, ra: { x: 0, y: 0, z: 0 }, le: { x: 0, y: 0, z: 0 }, re: { x: 0, y: 0, z: 0 }, ll: { x: 0, y: 0, z: 0 }, rl: { x: 0, y: 0, z: 0 }, lk: { x: 0, y: 0, z: 0 }, rk: { x: 0, y: 0, z: 0 } },
        { percentage: 10, name: '10% Arm Raise Start', la: { x: 0, y: 0, z: 0 }, ra: { x: -25, y: 0, z: 2 }, le: { x: 0, y: 0, z: 0 }, re: { x: 0, y: 0, z: 0 }, ll: { x: 0, y: 0, z: 0 }, rl: { x: 0, y: 0, z: 0 }, lk: { x: 0, y: 0, z: 0 }, rk: { x: 0, y: 0, z: 0 } },
        { percentage: 35, name: '35% Reach Door Handle', la: { x: 0, y: 0, z: 0 }, ra: { x: -83, y: 0, z: 5 }, le: { x: 0, y: 0, z: 0 }, re: { x: 0, y: 0, z: 0 }, ll: { x: 0, y: 0, z: 0 }, rl: { x: 0, y: 0, z: 0 }, lk: { x: 0, y: 0, z: 0 }, rk: { x: 0, y: 0, z: 0 } },
        { percentage: 65, name: '65% Pull Door Leverage', la: { x: 0, y: 0, z: 0 }, ra: { x: -18, y: 20, z: 10 }, le: { x: 0, y: 0, z: 0 }, re: { x: 0, y: 0, z: 0 }, ll: { x: -5, y: 0, z: 0 }, rl: { x: 5, y: 0, z: 0 }, lk: { x: 0, y: 0, z: 0 }, rk: { x: 0, y: 0, z: 0 } },
        { percentage: 85, name: '85% Release Handle', la: { x: 0, y: 0, z: 0 }, ra: { x: -5, y: 5, z: 2 }, le: { x: 0, y: 0, z: 0 }, re: { x: 0, y: 0, z: 0 }, ll: { x: 0, y: 0, z: 0 }, rl: { x: 0, y: 0, z: 0 }, lk: { x: 0, y: 0, z: 0 }, rk: { x: 0, y: 0, z: 0 } },
        { percentage: 100, name: '100% Settle to Idle', la: { x: 0, y: 0, z: 0 }, ra: { x: 0, y: 0, z: 0 }, le: { x: 0, y: 0, z: 0 }, re: { x: 0, y: 0, z: 0 }, ll: { x: 0, y: 0, z: 0 }, rl: { x: 0, y: 0, z: 0 }, lk: { x: 0, y: 0, z: 0 }, rk: { x: 0, y: 0, z: 0 } }
    ],
    scanner: [
        { percentage: 0, name: '0% Idle Ready', la: { x: 0, y: 0, z: 0 }, ra: { x: 0, y: 0, z: 0 }, le: { x: 0, y: 0, z: 0 }, re: { x: 0, y: 0, z: 0 }, ll: { x: 0, y: 0, z: 0 }, rl: { x: 0, y: 0, z: 0 }, lk: { x: 0, y: 0, z: 0 }, rk: { x: 0, y: 0, z: 0 } },
        { percentage: 20, name: '20% Raise Hand', la: { x: 0, y: 0, z: 0 }, ra: { x: -30, y: 0, z: 0 }, le: { x: 0, y: 0, z: 0 }, re: { x: 0, y: 0, z: 0 }, ll: { x: 0, y: 0, z: 0 }, rl: { x: 0, y: 0, z: 0 }, lk: { x: 0, y: 0, z: 0 }, rk: { x: 0, y: 0, z: 0 } },
        { percentage: 50, name: '50% Touch Sensor Terminal', la: { x: 0, y: 0, z: 0 }, ra: { x: -70, y: 0, z: 0 }, le: { x: 0, y: 0, z: 0 }, re: { x: 0, y: 0, z: 0 }, ll: { x: 0, y: 0, z: 0 }, rl: { x: 0, y: 0, z: 0 }, lk: { x: 0, y: 0, z: 0 }, rk: { x: 0, y: 0, z: 0 } },
        { percentage: 80, name: '80% Lower Hand', la: { x: 0, y: 0, z: 0 }, ra: { x: -20, y: 0, z: 0 }, le: { x: 0, y: 0, z: 0 }, re: { x: 0, y: 0, z: 0 }, ll: { x: 0, y: 0, z: 0 }, rl: { x: 0, y: 0, z: 0 }, lk: { x: 0, y: 0, z: 0 }, rk: { x: 0, y: 0, z: 0 } },
        { percentage: 100, name: '100% Idle Reset', la: { x: 0, y: 0, z: 0 }, ra: { x: 0, y: 0, z: 0 }, le: { x: 0, y: 0, z: 0 }, re: { x: 0, y: 0, z: 0 }, ll: { x: 0, y: 0, z: 0 }, rl: { x: 0, y: 0, z: 0 }, lk: { x: 0, y: 0, z: 0 }, rk: { x: 0, y: 0, z: 0 } }
    ],
    jump: [
        { percentage: 0, name: '0% Crouch Prep', la: { x: 10, y: 0, z: 0 }, ra: { x: 10, y: 0, z: 0 }, le: { x: 0, y: 0, z: 0 }, re: { x: 0, y: 0, z: 0 }, ll: { x: -20, y: 0, z: 0 }, rl: { x: -20, y: 0, z: 0 }, lk: { x: 0, y: 0, z: 0 }, rk: { x: 0, y: 0, z: 0 } },
        { percentage: 30, name: '30% Launch Upwards', la: { x: -25, y: 0, z: 0 }, ra: { x: -25, y: 0, z: 0 }, le: { x: 0, y: 0, z: 0 }, re: { x: 0, y: 0, z: 0 }, ll: { x: 10, y: 0, z: 0 }, rl: { x: 10, y: 0, z: 0 }, lk: { x: 0, y: 0, z: 0 }, rk: { x: 0, y: 0, z: 0 } },
        { percentage: 50, name: '50% Airborne Peak', la: { x: -30, y: 0, z: 0 }, ra: { x: -30, y: 0, z: 0 }, le: { x: 0, y: 0, z: 0 }, re: { x: 0, y: 0, z: 0 }, ll: { x: 35, y: 0, z: 0 }, rl: { x: 35, y: 0, z: 0 }, lk: { x: 0, y: 0, z: 0 }, rk: { x: 0, y: 0, z: 0 } },
        { percentage: 80, name: '80% Landing Impact', la: { x: 15, y: 0, z: 0 }, ra: { x: 15, y: 0, z: 0 }, le: { x: 0, y: 0, z: 0 }, re: { x: 0, y: 0, z: 0 }, ll: { x: -15, y: 0, z: 0 }, rl: { x: -15, y: 0, z: 0 }, lk: { x: 0, y: 0, z: 0 }, rk: { x: 0, y: 0, z: 0 } },
        { percentage: 100, name: '100% Stand Up', la: { x: 0, y: 0, z: 0 }, ra: { x: 0, y: 0, z: 0 }, le: { x: 0, y: 0, z: 0 }, re: { x: 0, y: 0, z: 0 }, ll: { x: 0, y: 0, z: 0 }, rl: { x: 0, y: 0, z: 0 }, lk: { x: 0, y: 0, z: 0 }, rk: { x: 0, y: 0, z: 0 } }
    ]
};
