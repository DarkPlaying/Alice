import * as React from "react";
import { cn } from "../../lib/utils";
import { Button } from "./button";
import { ArrowRight } from "lucide-react";

interface TravelCardProps extends React.HTMLAttributes<HTMLDivElement> {
  imageUrl: string;
  imageAlt: string;
  logo?: React.ReactNode;
  title: string;
  location: string;
  overview: string;
  price: number | string;
  pricePeriod: string;
  onBookNow: () => void;
}

const TravelCard = React.forwardRef<HTMLDivElement, TravelCardProps>(
  (
    {
      className,
      imageUrl,
      imageAlt,
      logo,
      title,
      location,
      overview,
      price,
      pricePeriod,
      onBookNow,
      ...props
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={cn(
          "group relative w-full overflow-hidden rounded-xl border border-white/10 bg-black/60 shadow-lg",
          "transition-all duration-300 ease-in-out hover:shadow-2xl hover:-translate-y-2",
          className
        )}
        {...props}
      >
        {/* Background Image with Zoom Effect on Hover */}
        <img
          src={imageUrl}
          alt={imageAlt}
          className="absolute inset-0 h-full w-full object-cover opacity-60 transition-transform duration-500 ease-in-out group-hover:scale-110"
        />

        {/* Gradient Overlay for Text Readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent"></div>

        {/* Content Container */}
        <div className="relative flex h-80 flex-col justify-between p-6 text-white">
          {/* Top Section: Logo */}
          <div className="flex items-start">
            {logo && (
              <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/30 bg-black/40 backdrop-blur-sm">
                {logo}
              </div>
            )}
          </div>

          {/* Middle Section: Details (slides up on hover) */}
          <div className="space-y-2 transition-transform duration-500 ease-in-out group-hover:-translate-y-12">
            <div>
              <h3 className="text-xl font-bold text-white tracking-wider">{title}</h3>
              <p className="text-xs text-white/70">{location}</p>
            </div>
            <div>
              <h4 className="text-[10px] font-semibold text-[#ff0050] tracking-widest">OVERVIEW</h4>
              <p className="text-xs text-white/60 leading-relaxed line-clamp-2 group-hover:line-clamp-none">
                {overview}
              </p>
            </div>
          </div>

          {/* Bottom Section: Price and Button (revealed on hover) */}
          <div className="absolute -bottom-20 left-0 w-full p-6 opacity-0 transition-all duration-500 ease-in-out group-hover:bottom-0 group-hover:opacity-100 bg-black/80 backdrop-blur-sm border-t border-white/10">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-2xl font-bold text-white">{price}</span>
                <span className="text-[10px] text-white/60 block"> {pricePeriod}</span>
              </div>
              <Button onClick={onBookNow} size="sm" className="bg-[#ff0050] hover:bg-[#ff0050]/90 text-white border-0 font-mono">
                ENTER <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }
);
TravelCard.displayName = "TravelCard";

export { TravelCard };
