// src/components/map/MapModeToggle.jsx
// Domestic vs Diaspora map mode switch

import React from 'react';
import { motion } from 'framer-motion';
import { useTheme } from '@/contexts/ThemeContext';

const MapModeToggle = ({ mode = 'domestic', onChange }) => {
    const { theme } = useTheme();

    return (
        <div
            className="flex items-center p-1 rounded-full shadow-lg border"
            style={{
                background: theme === 'dark' ? 'rgba(28, 28, 30, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                borderColor: theme === 'dark' ? 'rgba(84, 84, 88, 0.65)' : 'rgba(216, 216, 220, 0.8)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
            }}
        >
            <button
                onClick={() => onChange('domestic')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200"
                style={{
                    background: mode === 'domestic' ? '#007AFF' : 'transparent',
                    color: mode === 'domestic'
                        ? '#FFFFFF'
                        : theme === 'dark' ? 'rgba(235, 235, 245, 0.6)' : 'rgba(60, 60, 67, 0.6)',
                }}
            >
                <span>🇰🇪</span>
                <span>Kenya</span>
            </button>
            <button
                onClick={() => onChange('diaspora')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200"
                style={{
                    background: mode === 'diaspora' ? '#007AFF' : 'transparent',
                    color: mode === 'diaspora'
                        ? '#FFFFFF'
                        : theme === 'dark' ? 'rgba(235, 235, 245, 0.6)' : 'rgba(60, 60, 67, 0.6)',
                }}
            >
                <span>🌍</span>
                <span>Diaspora</span>
            </button>
        </div>
    );
};

export default MapModeToggle;
