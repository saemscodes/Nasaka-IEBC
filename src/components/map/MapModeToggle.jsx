// src/components/map/MapModeToggle.jsx
// Domestic vs Diaspora map mode switch — Glassmorphism + Claymorphism upgrade

import React from 'react';
import { motion } from 'framer-motion';
import { useTheme } from '@/contexts/ThemeContext';

const MapModeToggle = ({ mode = 'domestic', onChange }) => {
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    return (
        <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
            className="relative flex items-center p-1 rounded-full"
            style={{
                background: isDark
                    ? 'linear-gradient(135deg, rgba(28, 28, 30, 0.85), rgba(44, 44, 46, 0.9))'
                    : 'linear-gradient(135deg, rgba(255, 255, 255, 0.88), rgba(240, 245, 255, 0.92))',
                backdropFilter: 'blur(24px) saturate(180%)',
                WebkitBackdropFilter: 'blur(24px) saturate(180%)',
                border: isDark
                    ? '1px solid rgba(120, 120, 128, 0.3)'
                    : '1px solid rgba(200, 210, 230, 0.6)',
                boxShadow: isDark
                    ? '0 4px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)'
                    : '0 4px 20px rgba(30, 107, 255, 0.12), 0 2px 8px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.8)',
            }}
        >
            {/* Sliding indicator */}
            <motion.div
                layout
                className="absolute rounded-full"
                style={{
                    width: 'calc(50% - 4px)',
                    height: 'calc(100% - 8px)',
                    top: '4px',
                    background: 'linear-gradient(135deg, #1E6BFF, #0050DD)',
                    boxShadow: '0 2px 12px rgba(30, 107, 255, 0.4), inset 0 1px 0 rgba(255,255,255,0.2)',
                }}
                animate={{
                    left: mode === 'domestic' ? '4px' : 'calc(50%)',
                }}
                transition={{ type: 'spring', stiffness: 500, damping: 32, mass: 0.8 }}
            />

            <button
                onClick={() => onChange('domestic')}
                className="relative z-10 flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition-colors duration-200"
                style={{
                    color: mode === 'domestic'
                        ? '#FFFFFF'
                        : isDark ? 'rgba(235, 235, 245, 0.5)' : 'rgba(60, 60, 67, 0.5)',
                    minWidth: '88px',
                    justifyContent: 'center',
                }}
            >
                <img
                    src="/icons/flag-kenya.svg"
                    alt=""
                    className="w-4 h-4"
                    style={{
                        filter: mode === 'domestic' ? 'brightness(1.8) saturate(0.5)' : 'none',
                    }}
                />
                <span>Kenya</span>
            </button>
            <button
                onClick={() => onChange('diaspora')}
                className="relative z-10 flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition-colors duration-200"
                style={{
                    color: mode === 'diaspora'
                        ? '#FFFFFF'
                        : isDark ? 'rgba(235, 235, 245, 0.5)' : 'rgba(60, 60, 67, 0.5)',
                    minWidth: '100px',
                    justifyContent: 'center',
                }}
            >
                <img
                    src="/icons/earth-africa.svg"
                    alt=""
                    className="w-4 h-4"
                    style={{
                        filter: mode === 'diaspora' ? 'brightness(10) saturate(0)' : 'none',
                    }}
                />
                <span>Diaspora</span>
            </button>
        </motion.div>
    );
};

export default MapModeToggle;
