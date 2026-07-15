/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                bg: '#050508',
                primary: '#f000ff',
                secondary: '#00f0ff',
                'squid-pink': '#ff0050',
            },
            fontFamily: {
                display: ['Orbitron', 'Impact', 'sans-serif'],
                sans: ['Inter', 'system-ui', 'sans-serif'],
                mono: ['Courier Prime', 'monospace'],
                cinzel: ['Cinzel', 'serif'],
                oswald: ['Oswald', 'sans-serif'],
            },
            backgroundImage: {
                'grid-pattern': "linear-gradient(to right, #1a1a1a 1px, transparent 1px), linear-gradient(to bottom, #1a1a1a 1px, transparent 1px)",
            },
            animation: {
                "meteor-effect": "meteor 5s linear infinite",
                "glitch": "glitch 0.3s cubic-bezier(.25, .46, .45, .94) both infinite",
                "scanline": "scanline 6s linear infinite",
            },
            keyframes: {
                meteor: {
                    "0%": { transform: "rotate(215deg) translateX(0)", opacity: "1" },
                    "70%": { opacity: "1" },
                    "100%": {
                        transform: "rotate(215deg) translateX(-500px)",
                        opacity: "0",
                    },
                },
                glitch: {
                    '0%': { transform: 'translate(0)' },
                    '20%': { transform: 'translate(-2px, 2px)' },
                    '40%': { transform: 'translate(-2px, -2px)' },
                    '60%': { transform: 'translate(2px, 2px)' },
                    '80%': { transform: 'translate(2px, -2px)' },
                    '100%': { transform: 'translate(0)' },
                },
                scanline: {
                    '0%': { transform: 'translateY(-10px)' },
                    '100%': { transform: 'translateY(510px)' }
                },
            },
        },
    },
    plugins: [],
}
