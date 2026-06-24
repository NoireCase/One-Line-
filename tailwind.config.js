/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      boxShadow: {
        'crystal': '0 0 50px rgba(45,212,191,0.05), 0 20px 60px rgba(0,0,0,0.5), inset 0 1px 1px rgba(255,255,255,0.08)',
      },
      keyframes: {
        drawIn: {
          '0%': { opacity: '0', strokeDashoffset: '100%' },
          '100%': { opacity: '1', strokeDashoffset: '0%' }
        },
        ripple: {
          '0%': { transform: 'scale(1)' },
          '40%': { transform: 'scale(1.025)' },
          '100%': { transform: 'scale(1)' }
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '15%': { transform: 'translateX(-4px)' },
          '30%': { transform: 'translateX(4px)' },
          '45%': { transform: 'translateX(-2px)' },
          '60%': { transform: 'translateX(2px)' },
          '75%': { transform: 'translateX(-1px)' }
        },
        breath: {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.012)' }
        },
        flow: {
          '0%': { strokeDashoffset: '10' },
          '100%': { strokeDashoffset: '0' }
        },
        headPulse: {
          '0%, 100%': { boxShadow: '0 0 6px rgba(52,211,153,0.4)' },
          '50%': { boxShadow: '0 0 20px rgba(52,211,153,0.75)' }
        },
        headPulseStrong: {
          '0%, 100%': { boxShadow: '0 0 10px rgba(52,211,153,0.5)', transform: 'scale(1.05)' },
          '50%': { boxShadow: '0 0 28px rgba(52,211,153,0.9)', transform: 'scale(1.08)' }
        }
      },
      animation: {
        drawIn: 'drawIn 200ms ease-out forwards',
        ripple: 'ripple 120ms ease-out',
        shake: 'shake 350ms ease-out',
        breath: 'breath 2.5s ease-in-out infinite',
        flow: 'flow 1.2s linear infinite',
        headPulse: 'headPulse 1s ease-in-out infinite',
        headPulseStrong: 'headPulseStrong 0.8s ease-in-out infinite'
      }
    },
  },
  plugins: [],
}
