/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./**/*.{js,ts,jsx,tsx}",
        "./components/**/*.{js,ts,jsx,tsx}",
        "./pages/**/*.{js,ts,jsx,tsx}",
        "./services/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ['Manrope', 'sans-serif'],
            },
            colors: {
                primary: {
                    50: '#f0fdfa',
                    100: '#ccfbf1',
                    200: '#99f6e4',
                    300: '#5eead4',
                    400: '#2dd4bf',
                    500: '#14b8a6',
                    600: '#0d9488',
                    700: '#0f766e',
                    800: '#115e59',
                    900: '#134e4a',
                },
                slate: {
                    850: '#1e293b',
                }
            },
            animation: {
                'wiggle': 'wiggle 1s ease-in-out infinite',
                'glow': 'glow 2s ease-in-out infinite',
                'sparkle': 'sparkle 1.5s ease-in-out infinite',
                'fire': 'fire 0.5s ease-in-out infinite alternate',
            },
            keyframes: {
                wiggle: {
                    '0%, 100%': { transform: 'rotate(-5deg)' },
                    '50%': { transform: 'rotate(5deg)' },
                },
                glow: {
                    '0%, 100%': { boxShadow: '0 0 5px rgba(251, 191, 36, 0.5)' },
                    '50%': { boxShadow: '0 0 20px rgba(251, 191, 36, 0.8), 0 0 30px rgba(251, 191, 36, 0.6)' },
                },
                sparkle: {
                    '0%, 100%': { opacity: '1', transform: 'scale(1)' },
                    '50%': { opacity: '0.5', transform: 'scale(1.2)' },
                },
                fire: {
                    '0%': { transform: 'scaleY(1) translateY(0)' },
                    '100%': { transform: 'scaleY(1.1) translateY(-2px)' },
                },
            },
        }
    },
    plugins: [],
}
