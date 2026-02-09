import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trophy, AlertCircle } from 'lucide-react';

interface ClubsPointsTableProps {
    isOpen: boolean;
    onClose: () => void;
    currentRound: number;
}

export const ClubsPointsTable: React.FC<ClubsPointsTableProps> = ({
    isOpen,
    onClose,
    currentRound,
}) => {
    // Scoring Rules Data
    const angelPoints = 300 - (50 * (Math.max(1, currentRound) - 1));

    // Scoring Rules Table Data
    const rules = [
        { condition: "Find Angel (Round 1)", points: "+300", note: "Decreases by 50 each round" },
        { condition: `Find Angel (Current R${currentRound})`, points: `+${Math.max(0, angelPoints)}`, note: "Current Round Value" },
        { condition: "Find Demon", points: "-50", note: "Immediate penalty" },
        { condition: "Vote 'None' (Empty)", points: "0", note: "Safe vote, no points" },
        { condition: "No Vote Cast", points: "-30", note: "Penalty for inactivity" },
    ];

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="w-full max-w-2xl bg-[#09090b] border border-white/10 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[80vh]"
                    >
                        {/* Header */}
                        <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
                            <div className="flex items-center gap-3">
                                <Trophy className="w-5 h-5 text-yellow-500" />
                                <h2 className="text-lg font-bold text-white uppercase tracking-wider">Scoring Rules</h2>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-white/10 rounded-full transition-colors group"
                            >
                                <X className="w-5 h-5 text-white/40 group-hover:text-white transition-colors" />
                            </button>
                        </div>

                        <div className="p-6 space-y-8 overflow-y-auto">

                            {/* Rules Table */}
                            <div className="space-y-4">
                                <div className="rounded-xl border border-white/5 overflow-hidden bg-white/[0.02]">
                                    <table className="w-full text-sm">
                                        <thead className="bg-white/5 text-white/40 font-mono text-xs uppercase tracking-wider">
                                            <tr>
                                                <th className="p-4 text-left font-medium">Action</th>
                                                <th className="p-4 text-right font-medium">Points</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5 text-gray-300">
                                            {rules.map((rule, idx) => (
                                                <tr key={idx} className="hover:bg-white/[0.02]">
                                                    <td className="p-4">
                                                        <div className="font-medium text-white">{rule.condition}</div>
                                                        <div className="text-xs text-white/40 mt-0.5">{rule.note}</div>
                                                    </td>
                                                    <td className={`p-4 text-right font-mono font-bold ${rule.points.startsWith('-') ? 'text-red-400' : 'text-green-400'}`}>
                                                        {rule.points}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* End Game Conditions */}
                            <div className="bg-gradient-to-br from-purple-900/10 to-transparent border border-purple-500/20 rounded-xl p-5 space-y-4">
                                <h4 className="text-purple-400 font-bold uppercase text-xs tracking-widest flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4" />
                                    End Game Logic
                                </h4>
                                <div className="space-y-3 text-sm">
                                    <div className="flex items-start gap-4 p-3 bg-red-500/5 rounded-lg border border-red-500/10">
                                        <span className="text-red-400 font-black uppercase text-xs tracking-wider min-w-[40px] mt-0.5">LOSE</span>
                                        <div className="space-y-1">
                                            <p className="text-gray-300">If Master Score &gt; Player Score</p>
                                            <p className="text-xs text-red-400/50">Player loses earned points.</p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-4 p-3 bg-green-500/5 rounded-lg border border-green-500/10">
                                        <span className="text-green-500 font-black uppercase text-xs tracking-wider min-w-[40px] mt-0.5">WIN</span>
                                        <div className="space-y-1">
                                            <p className="text-gray-300">If Player Score &gt; Master Score</p>
                                            <p className="text-xs text-green-500/50">Player adds points to Visa Balance.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer / Close Action */}
                        <div className="p-4 border-t border-white/5 bg-white/[0.02] flex justify-end">
                            <button
                                onClick={onClose}
                                className="px-6 py-2 bg-white text-black font-bold uppercase text-xs tracking-widest rounded hover:bg-white/90 transition-colors"
                            >
                                Close Rules
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};
