import { useEffect, useRef, useState, type ReactNode } from 'react';

interface GlowCardProps {
    children: ReactNode;
    className?: string;
    glowColor?: 'blue' | 'purple' | 'green' | 'red' | 'orange';
    size?: 'sm' | 'md' | 'lg';
    width?: string | number;
    height?: string | number;
    customSize?: boolean; // When true, ignores size prop and uses width/height or className
}

const glowColorMap = {
    blue: { base: 220, spread: 200 },
    purple: { base: 280, spread: 300 },
    green: { base: 120, spread: 200 },
    red: { base: 0, spread: 200 },
    orange: { base: 30, spread: 200 }
};

const sizeMap = {
    sm: 'w-48 h-64',
    md: 'w-64 h-80',
    lg: 'w-80 h-96'
};

const GlowCard = ({
    children,
    className = '',
    glowColor = 'blue',
    size = 'md',
    width,
    height,
    customSize = false
}: GlowCardProps) => {
    const cardRef = useRef<HTMLDivElement>(null);
    const innerRef = useRef<HTMLDivElement>(null);

    const [isHovering, setIsHovering] = useState(false);
    const animationRef = useRef<number | undefined>(undefined);
    const startTimeRef = useRef<number>(0);

    // Sync variables for smooth animation
    useEffect(() => {
        // Simple mobile detection
        const isMobile = window.matchMedia('(max-width: 768px)').matches;
        if (isMobile) return;

        const updatePos = (x: number, y: number) => {
            if (cardRef.current) {
                cardRef.current.style.setProperty('--x', x.toFixed(2));
                cardRef.current.style.setProperty('--xp', (x / window.innerWidth).toFixed(2));
                cardRef.current.style.setProperty('--y', y.toFixed(2));
                cardRef.current.style.setProperty('--yp', (y / window.innerHeight).toFixed(2));
            }
        };

        const syncPointer = (e: PointerEvent) => {
            if (isHovering) {
                updatePos(e.clientX, e.clientY);
            }
        };

        // Cache dimensions to avoid layout thrashing
        let cachedRect: { left: number; top: number; width: number; height: number } | null = null;

        const updateCachedRect = () => {
            if (cardRef.current) {
                const rect = cardRef.current.getBoundingClientRect();
                cachedRect = {
                    left: rect.left,
                    top: rect.top,
                    width: rect.width,
                    height: rect.height
                };
            }
        };

        // Initial cache
        updateCachedRect();

        // Update cache on resize
        const handleResize = () => {
            updateCachedRect();
        };
        window.addEventListener('resize', handleResize);

        // Infinite loop animation around the border
        const animate = (time: number) => {
            if (!startTimeRef.current) startTimeRef.current = time;
            const elapsed = time - startTimeRef.current;

            if (!isHovering && cachedRect) {
                const { left, top, width, height } = cachedRect;
                const perimeter = 2 * (width + height);
                // Speed: pixels per ms. 0.1 means 100px per second.
                const speed = 0.3;
                const distance = (elapsed * speed) % perimeter;

                let x = 0, y = 0;

                // Move along top edge
                if (distance < width) {
                    x = distance;
                    y = 0;
                }
                // Move along right edge
                else if (distance < width + height) {
                    x = width;
                    y = distance - width;
                }
                // Move along bottom edge
                else if (distance < 2 * width + height) {
                    x = width - (distance - (width + height));
                    y = height;
                }
                // Move along left edge
                else {
                    x = 0;
                    y = height - (distance - (2 * width + height));
                }

                // Convert local coords to global (client) coords for consistency with mouse logic
                updatePos(left + x, top + y);
            }

            animationRef.current = requestAnimationFrame(animate);
        };

        document.addEventListener('pointermove', syncPointer);
        animationRef.current = requestAnimationFrame(animate);

        return () => {
            document.removeEventListener('pointermove', syncPointer);
            window.removeEventListener('resize', handleResize);
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
        };
    }, [isHovering]);

    const { base, spread } = glowColorMap[glowColor];

    // Determine sizing
    const getSizeClasses = () => {
        if (customSize) {
            return ''; // Let className or inline styles handle sizing
        }
        return sizeMap[size];
    };

    const getInlineStyles = () => {
        const baseStyles: any = {
            '--base': base,
            '--spread': spread,
            '--radius': '14',
            '--border': '1',
            '--backdrop': 'rgba(0, 0, 0, 0.4)',
            '--backup-border': 'var(--backdrop)',
            '--size': '300',
            '--outer': '1',
            '--border-size': 'calc(var(--border, 2) * 1px)',
            '--spotlight-size': 'calc(var(--size, 150) * 1px)',
            '--hue': 'calc(var(--base) + (var(--xp, 0) * var(--spread, 0)))',
            backgroundImage: `radial-gradient(
        var(--spotlight-size) var(--spotlight-size) at
        calc(var(--x, 0) * 1px)
        calc(var(--y, 0) * 1px),
        hsl(var(--hue, 210) 100% 70% / 0.1), transparent
      )`,
            backgroundColor: 'var(--backdrop, transparent)',
            backgroundSize: 'calc(100% + (2 * var(--border-size))) calc(100% + (2 * var(--border-size)))',
            backgroundPosition: '50% 50%',
            backgroundAttachment: 'fixed',
            border: 'var(--border-size) solid var(--backup-border)',
            position: 'relative' as const,
            touchAction: 'none' as const,
        };

        // Add width and height if provided
        if (width !== undefined) {
            baseStyles.width = typeof width === 'number' ? `${width}px` : width;
        }
        if (height !== undefined) {
            baseStyles.height = typeof height === 'number' ? `${height}px` : height;
        }

        return baseStyles;
    };

    const beforeAfterStyles = `
    [data-glow]::before,
    [data-glow]::after {
      pointer-events: none;
      content: "";
      position: absolute;
      inset: calc(var(--border-size) * -1);
      border: var(--border-size) solid transparent;
      border-radius: calc(var(--radius) * 1px);
      background-attachment: fixed;
      background-size: calc(100% + (2 * var(--border-size))) calc(100% + (2 * var(--border-size)));
      background-repeat: no-repeat;
      background-position: 50% 50%;
      mask: linear-gradient(transparent, transparent), linear-gradient(white, white);
      mask-clip: padding-box, border-box;
      mask-composite: intersect;
      -webkit-mask: linear-gradient(transparent, transparent), linear-gradient(white, white);
      -webkit-mask-clip: padding-box, border-box;
      -webkit-mask-composite: source-in, source-over;
      -webkit-mask-composite: intersect;
    }
    
    [data-glow]::before {
      background-image: radial-gradient(
        calc(var(--spotlight-size) * 0.75) calc(var(--spotlight-size) * 0.75) at
        calc(var(--x, 0) * 1px)
        calc(var(--y, 0) * 1px),
        hsl(var(--hue, 210) 100% 50% / 1), transparent 100%
      );
      filter: brightness(6);
    }
    
    [data-glow]::after {
      background-image: radial-gradient(
        calc(var(--spotlight-size) * 0.5) calc(var(--spotlight-size) * 0.5) at
        calc(var(--x, 0) * 1px)
        calc(var(--y, 0) * 1px),
        hsl(0 100% 100% / 1), transparent 100%
      );
    }
    
    [data-glow] [data-glow] {
      position: absolute;
      inset: 0;
      will-change: filter;
      opacity: var(--outer, 1);
      border-radius: calc(var(--radius) * 1px);
      border-width: calc(var(--border-size) * 20);
      filter: blur(calc(var(--border-size) * 10));
      background: none;
      pointer-events: none;
      border: none;
    }
    
    [data-glow] > [data-glow]::before {
      inset: -10px;
      border-width: 10px;
    }
  `;

    return (
        <>
            <style dangerouslySetInnerHTML={{ __html: beforeAfterStyles }} />
            <div
                ref={cardRef}
                data-glow
                style={getInlineStyles()}
                onPointerEnter={() => setIsHovering(true)}
                onPointerLeave={() => setIsHovering(false)}
                className={`
          ${getSizeClasses()}
          ${!customSize ? 'aspect-[3/4]' : ''}
          rounded-2xl 
          relative 
          grid 
          shadow-[0_1rem_2rem_-1rem_black] 
          p-2 
          backdrop-blur-[5px]
          sm:backdrop-blur-[5px]
          max-sm:backdrop-blur-none
          ${className}
        `}
            >
                <div ref={innerRef} data-glow></div>
                {children}
            </div>
        </>
    );
};

export { GlowCard }
