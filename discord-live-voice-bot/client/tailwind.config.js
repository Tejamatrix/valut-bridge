/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        discord: {
          dark: '#1e1f22',
          darker: '#141518',
          card: '#2b2d31',
          hover: '#35373c',
          brand: '#5865F2',
          green: '#57F287',
          yellow: '#FEE75C',
          red: '#ED4245',
          blurple: '#5865F2',
        }
      },
      keyframes: {
        pulseRing: {
          '0%': { transform: 'scale(0.95)', boxShadow: '0 0 0 0 rgba(88, 101, 242, 0.7)' },
          '70%': { transform: 'scale(1)', boxShadow: '0 0 0 25px rgba(88, 101, 242, 0)' },
          '100%': { transform: 'scale(0.95)', boxShadow: '0 0 0 0 rgba(88, 101, 242, 0)' },
        },
        speakingPulse: {
          '0%, 100%': { transform: 'scale(1)', opacity: '1' },
          '50%': { transform: 'scale(1.06)', opacity: '0.85' },
        }
      },
      animation: {
        pulseRing: 'pulseRing 1.8s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        speaking: 'speakingPulse 1s ease-in-out infinite',
      }
    },
  },
  plugins: [],
}
