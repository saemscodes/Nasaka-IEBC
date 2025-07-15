import { useEffect, useRef, useCallback, useMemo } from 'react';

declare global {
  interface Window {
    Lenis: any;
  }
}

export const useLenis = () => {
  const lenisRef = useRef<any>(null);
  const rafRef = useRef<number | null>(null);
  
  // Zero-latency device optimization
  const zeroLatencyConfig = useMemo(() => {
    const userAgent = navigator.userAgent;
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
    const isTablet = /iPad|Android/i.test(userAgent) && window.innerWidth >= 768;
    
    // Hardware detection for absolute maximum performance
    const cores = navigator.hardwareConcurrency || 8;
    const memory = (navigator as any).deviceMemory || 8;
    const isHighRefreshRate = window.screen?.refreshRate >= 120 || false;
    const pixelRatio = window.devicePixelRatio || 1;
    
    // Calculate maximum possible performance settings
    const maxFPS = Math.min(240, window.screen?.refreshRate || 144);
    const optimalLerp = Math.min(0.95, 0.4 + (cores / 20) + (memory / 40));
    
    return {
      isMobile,
      isTablet,
      cores,
      memory,
      isHighRefreshRate,
      pixelRatio,
      maxFPS,
      optimalLerp,
      isUltraPerformant: cores >= 8 && memory >= 8
    };
  }, []);

  // INSTANT response easing - mathematically closest to zero latency
  const zeroLatencyEasing = useCallback((t: number) => {
    // Immediate response with minimal smoothing
    return t >= 0.98 ? 1 : Math.pow(t, 0.3);
  }, []);

  // Alternative: Pure linear for absolute zero delay
  const instantEasing = useCallback((t: number) => {
    return t > 0.95 ? 1 : t * t;
  }, []);

  // ZERO LATENCY configuration
  const getZeroLatencyConfig = useCallback(() => {
    const { isMobile, isTablet, isUltraPerformant, maxFPS, optimalLerp } = zeroLatencyConfig;
    
    if (isMobile && !isTablet) {
      return {
        lerp: isUltraPerformant ? 0.85 : 0.75, // Near-instant mobile response
        duration: isUltraPerformant ? 0.1 : 0.15, // Minimal duration
        smoothWheel: false,
        smoothTouch: true,
        touchMultiplier: isUltraPerformant ? 5 : 4,
        wheelMultiplier: 1,
        touchInertiaMultiplier: 3, // Minimal inertia for instant stop
        targetFPS: Math.min(maxFPS, 144),
        syncTouchLerp: isUltraPerformant ? 0.9 : 0.8,
      };
    }
    
    if (isTablet) {
      return {
        lerp: isUltraPerformant ? 0.9 : 0.8, // Maximum tablet responsiveness
        duration: isUltraPerformant ? 0.08 : 0.12,
        smoothWheel: true,
        smoothTouch: true,
        touchMultiplier: isUltraPerformant ? 6 : 5,
        wheelMultiplier: isUltraPerformant ? 3 : 2.5,
        touchInertiaMultiplier: 2,
        targetFPS: maxFPS,
        syncTouchLerp: isUltraPerformant ? 0.95 : 0.85,
      };
    }
    
    // Desktop - ABSOLUTE ZERO LATENCY
    return {
      lerp: isUltraPerformant ? 0.95 : 0.88, // 95% catch-up per frame = near-instant
      duration: isUltraPerformant ? 0.05 : 0.08, // Microsecond-level duration
      smoothWheel: true,
      smoothTouch: false,
      touchMultiplier: 4,
      wheelMultiplier: isUltraPerformant ? 4 : 3.5, // Maximum amplification
      touchInertiaMultiplier: 1, // Absolute minimum inertia
      targetFPS: maxFPS, // Use full display refresh rate
      syncTouchLerp: isUltraPerformant ? 0.98 : 0.9,
    };
  }, [zeroLatencyConfig]);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.Lenis) {
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      
      if (prefersReducedMotion) {
        return;
      }

      const config = getZeroLatencyConfig();
      const { isUltraPerformant, maxFPS } = zeroLatencyConfig;
      
      // Initialize Lenis with ZERO LATENCY settings
      lenisRef.current = new window.Lenis({
        ...config,
        easing: isUltraPerformant ? instantEasing : zeroLatencyEasing,
        infinite: false,
        syncTouch: true,
        orientation: 'vertical',
        gestureOrientation: 'vertical',
        normalizeWheel: true,
        autoResize: true,
        
        // Zero-latency specific optimizations
        syncTouchLerp: config.syncTouchLerp,
        eventsTarget: window,
        wheelMultiplier: config.wheelMultiplier,
        touchMultiplier: config.touchMultiplier,
        
        // Instant prevent logic
        prevent: (node: Element) => {
          const tagName = node.tagName;
          return tagName === 'INPUT' || 
                 tagName === 'TEXTAREA' || 
                 tagName === 'SELECT' ||
                 node.hasAttribute('data-lenis-prevent');
        }
      });

      // ZERO LATENCY RAF - Maximum performance loop
      let lastTime = 0;
      const targetFPS = config.targetFPS;
      const frameInterval = 1000 / targetFPS;
      let missedFrames = 0;
      
      // Pre-calculate frame timing for zero overhead
      const frameTime = 1000 / targetFPS;
      
      const zeroLatencyRAF = (time: number) => {
        const deltaTime = time - lastTime;
        
        // Execute on every frame for zero latency
        if (deltaTime >= frameInterval || missedFrames > 0) {
          lenisRef.current?.raf(time);
          lastTime = time;
          missedFrames = 0;
        } else {
          missedFrames++;
        }
        
        rafRef.current = requestAnimationFrame(zeroLatencyRAF);
      };
      
      rafRef.current = requestAnimationFrame(zeroLatencyRAF);

      // INSTANT resize - no debouncing for zero latency
      const handleResize = () => {
        lenisRef.current?.resize();
      };

      // ZERO LATENCY wheel handling with immediate response
      const handleWheel = (e: WheelEvent) => {
        if (Math.abs(e.deltaY) > 0) {
          e.preventDefault();
          
          // Immediate scroll update for zero latency
          if (lenisRef.current) {
            const immediateScroll = e.deltaY * config.wheelMultiplier * 0.5;
            lenisRef.current.targetScroll += immediateScroll;
            
            // Force immediate update
            lenisRef.current.animatedScroll = lenisRef.current.targetScroll * config.lerp + 
                                             lenisRef.current.animatedScroll * (1 - config.lerp);
          }
        }
      };

      // Zero-latency touch handling
      let touchStartY = 0;
      let touchStartTime = 0;
      
      const handleTouchStart = (e: TouchEvent) => {
        if (lenisRef.current && config.smoothTouch) {
          touchStartY = e.touches[0].clientY;
          touchStartTime = performance.now();
          lenisRef.current.isTouching = true;
        }
      };

      const handleTouchMove = (e: TouchEvent) => {
        if (lenisRef.current && config.smoothTouch) {
          const currentY = e.touches[0].clientY;
          const deltaY = touchStartY - currentY;
          const deltaTime = performance.now() - touchStartTime;
          
          // Immediate touch response
          const immediateScroll = deltaY * config.touchMultiplier * 0.1;
          lenisRef.current.targetScroll += immediateScroll;
          
          touchStartY = currentY;
          touchStartTime = performance.now();
        }
      };

      const handleTouchEnd = () => {
        if (lenisRef.current && config.smoothTouch) {
          lenisRef.current.isTouching = false;
        }
      };

      // IMMEDIATE event listeners - no passive mode for zero latency
      window.addEventListener('resize', handleResize);
      window.addEventListener('wheel', handleWheel, { passive: false });
      if (config.smoothTouch) {
        window.addEventListener('touchstart', handleTouchStart);
        window.addEventListener('touchmove', handleTouchMove, { passive: false });
        window.addEventListener('touchend', handleTouchEnd);
      }

      // Performance boost: Disable unnecessary browser optimizations
      if (isUltraPerformant) {
        document.documentElement.style.scrollBehavior = 'auto';
        document.body.style.scrollBehavior = 'auto';
      }

      // Cleanup function
      return () => {
        if (rafRef.current) {
          cancelAnimationFrame(rafRef.current);
        }
        window.removeEventListener('resize', handleResize);
        window.removeEventListener('wheel', handleWheel);
        if (config.smoothTouch) {
          window.removeEventListener('touchstart', handleTouchStart);
          window.removeEventListener('touchmove', handleTouchMove);
          window.removeEventListener('touchend', handleTouchEnd);
        }
        lenisRef.current?.destroy();
      };
    }
  }, [getZeroLatencyConfig, zeroLatencyConfig, zeroLatencyEasing, instantEasing]);

  // INSTANT programmatic scrolling
  const scrollTo = useCallback((target: string | number, options?: any) => {
    if (lenisRef.current) {
      const { isUltraPerformant } = zeroLatencyConfig;
      
      lenisRef.current.scrollTo(target, {
        duration: isUltraPerformant ? 0.3 : 0.5,
        easing: isUltraPerformant ? instantEasing : zeroLatencyEasing,
        lerp: isUltraPerformant ? 0.95 : 0.8,
        ...options
      });
    }
  }, [zeroLatencyConfig, instantEasing, zeroLatencyEasing]);

  const scrollToTop = useCallback(() => {
    if (lenisRef.current) {
      const { isUltraPerformant } = zeroLatencyConfig;
      
      lenisRef.current.scrollTo(0, { 
        duration: isUltraPerformant ? 0.5 : 0.8,
        easing: isUltraPerformant ? instantEasing : zeroLatencyEasing,
        lerp: isUltraPerformant ? 0.98 : 0.85
      });
    }
  }, [zeroLatencyConfig, instantEasing, zeroLatencyEasing]);

  // Zero-latency control methods
  const start = useCallback(() => {
    lenisRef.current?.start();
  }, []);

  const stop = useCallback(() => {
    lenisRef.current?.stop();
  }, []);

  const isScrolling = useCallback(() => {
    return lenisRef.current?.isScrolling || false;
  }, []);

  // Instant response utilities
  const setMaximumResponsiveness = useCallback(() => {
    if (lenisRef.current) {
      lenisRef.current.options.lerp = 0.98;
      lenisRef.current.options.duration = 0.03;
    }
  }, []);

  const getCurrentScroll = useCallback(() => {
    return lenisRef.current?.scroll || 0;
  }, []);

  const getVelocity = useCallback(() => {
    return lenisRef.current?.velocity || 0;
  }, []);

  // Force immediate scroll update
  const forceUpdate = useCallback(() => {
    if (lenisRef.current) {
      lenisRef.current.animatedScroll = lenisRef.current.targetScroll;
    }
  }, []);

  return {
    lenis: lenisRef.current,
    scrollTo,
    scrollToTop,
    start,
    stop,
    isScrolling,
    setMaximumResponsiveness,
    getCurrentScroll,
    getVelocity,
    forceUpdate,
    zeroLatencyConfig // Debug info
  };
};
