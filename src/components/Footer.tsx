"use client";

import { Link } from "react-router-dom";
import { motion } from "framer-motion";

export const Footer = () => {
  return (
    <footer className="w-full bg-black text-white border-t border-red-950/40 relative overflow-hidden">
      {/* Horizontal glowing laser pulse line at the very top */}
      <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-[#ff0050] to-transparent shadow-[0_0_10px_#ff0050] animate-pulse" />

      {/* Atmospheric digital red scanner line moving slowly up and down */}
      <motion.div
        animate={{
          y: [-10, 300, -10],
          opacity: [0.05, 0.25, 0.05],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="absolute inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-[#ff0050] to-transparent shadow-[0_0_8px_#ff0050] pointer-events-none"
      />

      <div className="max-w-7xl mx-auto px-6 py-16 flex flex-col items-center relative z-10">
        <div className="flex items-center space-x-3 mb-6">
          <span className="text-2xl sm:text-3xl font-cinzel font-black tracking-[0.25em] text-white hover:text-[#ff0050] transition-colors duration-300 select-none">
            BORDERLAND <span className="text-[#ff0050]">♦♥♣♠</span>
          </span>
        </div>
        <p className="text-center max-w-xl text-sm font-normal leading-relaxed text-gray-400 font-mono text-xs sm:text-sm">
          The ultimate survival trial arena. Clear dangerous game arenas, secure card tricks, vote on secret roles, and navigate the psychological boundaries of trust and strategy to extend your Visa. Survival is your only option.
        </p>
      </div>
      <div className="border-t border-red-950/30 bg-black/40 relative z-10">
        <div className="max-w-7xl mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-center text-sm font-normal text-gray-400 font-mono text-xs">
          <div>
            BORDERLAND PROTOCOL © {new Date().getFullYear()}. All rights reserved.
          </div>
          <div className="flex items-center gap-4">
            <Link
              to="/admin"
              className="text-[#ff0050] hover:text-white transition-colors uppercase tracking-widest text-[10px] font-bold"
            >
              ACCESS ADMIN TERMINAL
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};
