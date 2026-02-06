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
            },
        },
    },
    plugins: [],
}
