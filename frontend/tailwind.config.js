export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Manrope', 'system-ui', 'sans-serif']
      },
      colors: {
        brand: {
          50: '#f3f8ff',
          100: '#e2f0ff',
          200: '#b9dbff',
          300: '#83beff',
          400: '#4a98ff',
          500: '#1d72ff',
          600: '#0c56db',
          700: '#0a43ac',
          800: '#0d3a8a',
          900: '#0f326f'
        },
        surface: '#f5f7fb',
        ink: '#0a1027'
      },
      boxShadow: {
        card: '0 20px 35px -20px rgba(15, 50, 111, 0.35)',
        glow: '0 0 50px rgba(74, 152, 255, 0.25)'
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(circle at top, rgba(29,114,255,0.15), transparent)',
        'gradient-card': 'linear-gradient(135deg, rgba(29,114,255,0.12), rgba(12,86,219,0.05))'
      },
      animation: {
        float: 'float 8s ease-in-out infinite',
        pulseGlow: 'pulseGlow 3s ease-in-out infinite'
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(-2px)' },
          '50%': { transform: 'translateY(4px)' }
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 0 rgba(29,114,255,0.0)' },
          '50%': { boxShadow: '0 0 0 16px rgba(29,114,255,0.08)' }
        }
      }
    }
  },
  plugins: [require('@tailwindcss/forms'), require('@tailwindcss/typography')]
};
