"use client";

import { Link } from "react-router-dom";
import { DIcons } from "dicons";
import ThemeToogle from "./ui/footer";

const navigation = {
  categories: [
    {
      id: "women",
      name: "Women",

      sections: [
        {
          id: "about",
          name: "About",
          items: [
            { name: "About", href: "/about" },
            { name: "Works", href: "/agency/works" },
            { name: "Pricing", href: "/pricing" },
          ],
        },
        {
          id: "features",
          name: "Features",
          items: [
            { name: "Products", href: "/products" },
            { name: "Agency", href: "/agency" },
            { name: "Dashboard", href: "/dashboard" },
          ],
        },
        {
          id: "products",
          name: "Products",
          items: [
            { name: "DIcons", href: "/products/dicons" },
            { name: "DShapes", href: "/products/dshapes" },
            { name: "Graaadients", href: "/products/graaadients" },
          ],
        },
        {
          id: "designs",
          name: "Designs",
          items: [
            { name: "Design", href: "/designs" },
            { name: "Components", href: "/components" },
            { name: "Blogs", href: "/blogs" },
          ],
        },
        {
          id: "other",
          name: "Others",
          items: [
            { name: "Graphic", href: "/graphic" },
            { name: "3D Icons", href: "/products/3dicons" },
            { name: "Colors", href: "/products/colors/generate" },
          ],
        },
        {
          id: "company",
          name: "Company",
          items: [
            { name: "Contact", href: "/contact" },
            { name: "Terms", href: "/terms" },
            { name: "Privacy", href: "/privacy" },
          ],
        },
      ],
    },
  ],
};

const Underline = `hover:-translate-y-1 border border-dotted rounded-xl p-2.5 transition-transform `;

export const Footer = () => {
  return (
    <footer className="border-t border-white/10 bg-black text-gray-400 font-sans text-xs relative z-10 py-12 px-6">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
        {/* Column 1: Brand & Desc */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-xl font-cinzel font-bold tracking-widest text-white">BORDERLAND</span>
            <span className="px-1.5 py-0.5 bg-red-950 text-red-500 border border-red-500/20 text-[9px] rounded uppercase font-semibold tracking-wider">
              System Active
            </span>
          </div>
          <p className="leading-relaxed text-gray-500 text-[11px]">
            The ultimate trial arena. Survival is not guaranteed. Clear game arenas, secure card tricks, vote on secret roles, and navigate the psychological boundaries of trust and strategy to earn visa extensions.
          </p>
        </div>

        {/* Column 2: Navigation */}
        <div className="space-y-4">
          <h3 className="text-white font-semibold tracking-wider uppercase text-[11px]">Arena Links</h3>
          <ul className="space-y-2 text-[11px]">
            <li>
              <Link to="/home" className="hover:text-white transition-colors">
                &gt; SYSTEM HOME
              </Link>
            </li>
            <li>
              <Link to="/home/card" className="hover:text-white transition-colors">
                &gt; CARD SELECTION
              </Link>
            </li>
            <li>
              <Link to="/home/leaderboard" className="hover:text-white transition-colors">
                &gt; PLAYER LEADERBOARD
              </Link>
            </li>
            <li>
              <Link to="/home/survival" className="hover:text-white transition-colors">
                &gt; SURVIVAL PROTOCOL
              </Link>
            </li>
          </ul>
        </div>

        {/* Column 3: Overseer Status */}
        <div className="space-y-4">
          <h3 className="text-white font-semibold tracking-wider uppercase text-[11px]">System Monitor</h3>
          <div className="space-y-1 text-gray-500 text-[11px]">
            <div className="flex justify-between border-b border-white/5 pb-1">
              <span>OVERSEER CORE:</span>
              <span className="text-cyan-400">BORDER_SYS_v4.2.0</span>
            </div>
            <div className="flex justify-between border-b border-white/5 pb-1">
              <span>VISA TRACKER:</span>
              <span className="text-green-500">ONLINE</span>
            </div>
            <div className="flex justify-between border-b border-white/5 pb-1">
              <span>LASER UPLINK:</span>
              <span className="text-red-500">ARMED</span>
            </div>
            <div className="flex justify-between pb-1">
              <span>INTEGRITY:</span>
              <span className="text-white">98.2% NOMINAL</span>
            </div>
          </div>
        </div>

        {/* Column 4: Danger Alert */}
        <div className="space-y-4">
          <h3 className="text-red-500 font-bold tracking-wider uppercase text-[11px] flex items-center gap-1.5 animate-pulse">
            ⚠️ SYSTEM WARNING
          </h3>
          <p className="leading-relaxed text-[11px] text-red-400/80">
            Failing to clear the game arenas and extend your Visa before expiration results in instant laser termination from the upper atmospheric satellite grid. Monitor your countdown constantly.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto border-t border-white/5 pt-6 flex flex-col md:flex-row items-center justify-between gap-4 text-[10px] text-gray-600">
        <div>
          © {new Date().getFullYear()} BORDERLAND PROTOCOL. ALL RIGHTS RESERVED.
        </div>
        <div className="flex items-center gap-4">
          <Link
            to="/admin"
            className="px-3 py-1 bg-red-950/20 hover:bg-[#ff0050]/20 border border-red-500/20 hover:border-[#ff0050]/50 text-[#ff0050] font-mono text-[9px] uppercase tracking-wider rounded transition-all cursor-pointer"
          >
            ACCESS ADMIN TERMINAL
          </Link>
          <ThemeToogle />
        </div>
      </div>
    </footer>
  );
};
