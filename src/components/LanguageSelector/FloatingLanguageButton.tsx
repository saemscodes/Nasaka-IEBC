import React, { useEffect, useRef } from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';
import { useTheme } from '@/contexts/ThemeContext';
import { 
  type LanguageConfig, 
  getLanguagePersonality,
  type LanguagePersonality 
} from '@/i18n/languageRegistry';

interface FloatingLanguageButtonProps {
  language: LanguageConfig;
  position: { x: number; y: number };
  index: number;
  isHoveringMain: boolean;
  onSelect: (code: string) => void;
  isSelected: boolean;
  physicsStatesRef: React.MutableRefObject<Map<string, any>>;
}

const FloatingLanguageButton: React.FC<FloatingLanguageButtonProps> = ({
  language,
  position,
  index,
  isHoveringMain,
  onSelect,
  isSelected,
  physicsStatesRef
}) => {
  const { theme } = useTheme();
  const personality = getLanguagePersonality(language.code);
  
  // Physics-based motion values
  const x = useMotionValue(position.x);
  const y = useMotionValue(position.y);
  const rotation = useMotionValue(0);
  
  // Spring physics for smooth movement
  const springX = useSpring(x, {
    stiffness: personality.stiffness,
    damping: personality.damping,
    mass: personality.mass
  });
  
  const springY = useSpring(y, {
    stiffness: personality.stiffness,
    damping: personality.damping,
    mass: personality.mass
  });
  
  const springRotation = useSpring(rotation, {
    stiffness: 60,
    damping: 15
  });

  const floatAnimationRef = useRef<number>();
  const lastTimeRef = useRef<number>(0);
  const currentPhaseRef = useRef<number>(personality.floatPhase);
  const velocityXRef = useRef<number>((Math.random() - 0.5) * 20);
  const velocityYRef = useRef<number>((Math.random() - 0.5) * 20);

  // Initialize or update physics state
  useEffect(() => {
    const stateId = `${language.code}-${index}`;
    
    if (!physicsStatesRef.current.has(stateId)) {
      physicsStatesRef.current.set(stateId, {
        x: position.x,
        y: position.y,
        velocityX: (Math.random() - 0.5) * 50,
        velocityY: (Math.random() - 0.5) * 50,
        rotation: 0
      });
    }

    // Set initial position
    x.set(position.x);
    y.set(position.y);
  }, [language.code, index, position.x, position.y, x, y, physicsStatesRef]);

  // Floating animation with individual personality
  useEffect(() => {
    if (isHoveringMain) {
      // When hovering main button, smoothly return to exact position
      if (floatAnimationRef.current) {
        cancelAnimationFrame(floatAnimationRef.current);
      }
      x.set(position.x);
      y.set(position.y);
      rotation.set(0);
      return;
    }

    const animateFloat = (time: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = time;
      const deltaTime = (time - lastTimeRef.current) / 1000;
      lastTimeRef.current = time;

      const stateId = `${language.code}-${index}`;
      const state = physicsStatesRef.current.get(stateId);
      
      if (state) {
        // Update phase for floating motion
        currentPhaseRef.current += deltaTime * personality.floatFrequency;
        
        // Calculate floating offset based on personality
        const floatX = Math.sin(currentPhaseRef.current + personality.floatPhase) * personality.floatAmplitude;
        const floatY = Math.cos(currentPhaseRef.current * 0.7 + personality.floatPhase) * personality.floatAmplitude;
        
        // Gentle rotation
        const targetRotation = Math.sin(currentPhaseRef.current * 0.5) * personality.rotationRange;
        
        // Update position with floating motion
        const targetX = position.x + floatX;
        const targetY = position.y + floatY;
        
        x.set(targetX);
        y.set(targetY);
        rotation.set(targetRotation);

        physicsStatesRef.current.set(stateId, {
          ...state,
          x: targetX,
          y: targetY,
          rotation: targetRotation
        });
      }

      floatAnimationRef.current = requestAnimationFrame(animateFloat);
    };

    floatAnimationRef.current = requestAnimationFrame(animateFloat);

    return () => {
      if (floatAnimationRef.current) {
        cancelAnimationFrame(floatAnimationRef.current);
      }
    };
  }, [
    isHoveringMain, 
    position.x, 
    position.y, 
    language.code, 
    index, 
    personality, 
    x, 
    y, 
    rotation,
    physicsStatesRef
  ]);

  const handleClick = () => {
    onSelect(language.code);
  };

  return (
    <motion.button
      className={`floating-language-button ${theme} ${isSelected ? 'selected' : ''}`}
      style={{
        x: springX,
        y: springY,
        rotate: springRotation
      }}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0, opacity: 0 }}
      transition={{
        type: "spring",
        stiffness: 300,
        damping: 20,
        delay: index * 0.1
      }}
      whileHover={{ 
        scale: 1.15,
        transition: { duration: 0.2 }
      }}
      whileTap={{ scale: 0.9 }}
      onClick={handleClick}
      aria-label={`Switch to ${language.name}`}
    >
      <span 
        className="language-code"
        style={{
          color: personality.color
        }}
      >
        {language.code.toUpperCase()}
      </span>
      
      {/* Personality indicator glow */}
      <motion.div
        className="personality-glow"
        style={{
          backgroundColor: personality.color
        }}
        animate={{
          opacity: [0.3, 0.6, 0.3],
          scale: [1, 1.1, 1]
        }}
        transition={{
          duration: personality.floatFrequency * 2,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />
    </motion.button>
  );
};

export default FloatingLanguageButton;
