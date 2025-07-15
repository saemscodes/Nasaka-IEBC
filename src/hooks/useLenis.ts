import { useEffect, useRef, useCallback, useMemo } from 'react';

declare global {
  interface Window {
    Lenis: any;
  }
}

export const useLenis = () => {
  const lenisRef = useRef<any>(null);
  const rafRef = useRef<number | null>(null);
  
  // Ultra high-end device detection and capabilities
  const deviceCapabilities = useMemo(() => {
    const userAgent = navigator.userAgent;
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
    const isTablet = /iPad|Android/i.test(userAgent) && window.innerWidth >= 768;
    
    // Advanced hardware detection for high-end optimization
    const cores = navigator.hardwareConcurrency || 4;
    const memory = (navigator as any).deviceMemory || 4;
    const isHighRefreshRate = window.screen?.refreshRate >= 90 || false;
    const supportsHardwareAcceleration = 'GPU' in window || 'webkitOfflineAudioContext' in window;
    
    // Calculate device performance score (0-10)
    const performanceScore = Math.min(10, 
      (cores / 2) + 
      (memory / 2) + 
      (isHighRefreshRate ? 2 : 0) + 
      (supportsHardwareAcceleration ? 1 : 0)
    );
    
    return {
      isMobile,
      isTablet,
      cores,
      memory,
      isHighRefreshRate,
      performanceScore,
      isUltraHighEnd: performanceScore >= 8
    };
  }, []);

  // Ultra-smooth easing functions optimized for high-end devices
  const ultraSmoothEasing = useCallback((t: number) => {
    // Custom easing inspired by Apple's interface animations
    // Combines ease-out with subtle bounce for premium feel
    if (t < 0.5) {
      return 4 * t * t * t;
    } else {
      const p = 2 * t - 2;
      return 1 + p * p * p;
    }
  }, []);

  // Alternative ultra-responsive easing for instant feel
  const hyperResponsiveEasing = useCallback((t: number) => {
    // Exponential ease-out for ultra-snappy response
    return 1 - Math.pow(2, -12 * t);
  }, []);

  // Premium configuration for maximum smoothness
  const getUltraConfig = useCallback(() => {
    const { isMobile, isTablet, performanceScore, isUltraHighEnd, isHighRefreshRate } = deviceCapabilities;
    
    if (isMobile && !isTablet) {
      return {
        lerp: isUltraHighEnd ? 0.4 : 0.3, // Ultra-high lerp for instant response
        duration: isUltraHighEnd ? 0.3 : 0.4, // Lightning fast duration
        smoothWheel: false, // Native mobile feel
        smoothTouch: true, // Enable for premium mobile experience
        touchMultiplier: isUltraHighEnd ? 3.5 : 2.5,
        wheelMultiplier: 1,
        touchInertiaMultiplier: isUltraHighEnd ? 15 : 20, // Reduced inertia for precision
        targetFPS: isHighRefreshRate ? 120 : 60,
      };
    }
    
    if (isTablet) {
      return {
        lerp: isUltraHighEnd ? 0.5 : 0.4, // Maximum responsiveness
        duration: isUltraHighEnd ? 0.25 : 0.35,
        smoothWheel: true,
        smoothTouch: true,
        touchMultiplier: isUltraHighEnd ? 4 : 3,
        wheelMultiplier: isUltraHighEnd ? 1.8 : 1.5,
        touchInertiaMultiplier: isUltraHighEnd ? 12 : 18,
        targetFPS: isHighRefreshRate ? 120 : 90,
      };
    }
    
    // Desktop - THE ABSOLUTE BEST configuration
    return {
      lerp: isUltraHighEnd ? 0.65 : 0.5, // MAXIMUM lerp for zero-delay feel
      duration: isUltraHighEnd ? 0.2 : 0.3, // Ultra-short duration
      smoothWheel: true,
      smoothTouch: false,
      touchMultiplier: 3,
      wheelMultiplier: isUltraHighEnd ? 2.2 : 1.8, // Amplified for high-end
      touchInertiaMultiplier: isUltraHighEnd ? 8 : 12, // Minimal inertia for precision
      targetFPS: isUltraHighEnd ? 120 : 90, // Target high refresh rates
    };
  }, [deviceCapabilities]);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.Lenis) {
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      
      if (prefersReducedMotion) {
        return;
      }

      const config = getUltraConfig();
      const { isUltraHighEnd, performanceScore } = deviceCapabilities;
      
      // Initialize Lenis with MAXIMUM smoothness settings
      lenisRef.current = new window.Lenis({
        ...config,
        easing: isUltraHighEnd ? hyperResponsiveEasing : ultraSmoothEasing,
        infinite: false,
        syncTouch: true,
        orientation: 'vertical',
        gestureOrientation: 'vertical',
        normalizeWheel: true,
        autoResize: true,
        
        // Ultra-premium optimizations
        syncTouchLerp: config.lerp * 1.2, // Even higher lerp for touch sync
        eventsTarget: window,
        
        // Advanced prevent logic for maximum performance
        prevent: (node: Element) => {
          return node.tagName === 'INPUT' || 
                 node.tagName === 'TEXTAREA' || 
                 node.tagName === 'SELECT' ||
                 node.closest('pre') !== null ||
                 node.closest('[data-lenis-prevent]') !== null ||
                 node.closest('.no-smooth-scroll') !== null;
        }
      });

      // ULTRA-OPTIMIZED RAF loop for high refresh rates
      let lastTime = 0;
      const targetFPS = config.targetFPS;
      const frameInterval = 1000 / targetFPS;
      let frameCount = 0;
      
      // Adaptive frame skipping based on performance
      const adaptiveFrameSkip = performanceScore < 8 ? 1 : 0;
      
      const ultraRAF = (time: number) => {
        // Skip frames on lower-end devices for consistency
        if (frameCount % (adaptiveFrameSkip + 1) === 0) {
          if (time - lastTime >= frameInterval) {
            lenisRef.current?.raf(time);
            lastTime = time;
          }
        }
        frameCount++;
        rafRef.current = requestAnimationFrame(ultraRAF);
      };
      
      rafRef.current = requestAnimationFrame(ultraRAF);

      // Ultra-responsive resize handler with immediate execution
      let resizeTimeout: NodeJS.Timeout;
      const handleResize = () => {
        // Immediate resize for high-end devices
        if (isUltraHighEnd) {
          lenisRef.current?.resize();
        }
        
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
          lenisRef.current?.resize();
        }, isUltraHighEnd ? 50 : 100);
      };

      // Premium wheel event handling with predictive scrolling
      const handleWheel = (e: WheelEvent) => {
        if (Math.abs(e.deltaY) > 0) {
          e.preventDefault();
          
          // Predictive scroll enhancement for ultra-smooth feel
          if (isUltraHighEnd && lenisRef.current) {
            const prediction = e.deltaY * 0.01; // Subtle prediction
            lenisRef.current.targetScroll += prediction;
          }
        }
      };

      // Touch optimization for premium mobile experience
      const handleTouchStart = (e: TouchEvent) => {
        if (lenisRef.current && config.smoothTouch) {
          lenisRef.current.isTouching = true;
        }
      };

      const handleTouchEnd = () => {
        if (lenisRef.current && config.smoothTouch) {
          lenisRef.current.isTouching = false;
        }
      };

      // Event listeners with ultra-optimized options
      window.addEventListener('resize', handleResize, { passive: true });
      window.addEventListener('wheel', handleWheel, { passive: false });
      window.addEventListener('touchstart', handleTouchStart, { passive: true });
      window.addEventListener('touchend', handleTouchEnd, { passive: true });

      // Performance monitoring and auto-adjustment
      let performanceMonitor: NodeJS.Timeout;
      if (isUltraHighEnd) {
        performanceMonitor = setInterval(() => {
          const now = performance.now();
          const frameTime = now - lastTime;
          
          // Auto-adjust lerp based on performance
          if (frameTime > 16.67 && lenisRef.current) { // Dropping below 60fps
            lenisRef.current.options.lerp = Math.max(0.1, lenisRef.current.options.lerp * 0.9);
          } else if (frameTime < 8.33 && lenisRef.current) { // Running above 120fps
            lenisRef.current.options.lerp = Math.min(0.8, lenisRef.current.options.lerp * 1.05);
          }
        }, 1000);
      }

      // Cleanup function
      return () => {
        if (rafRef.current) {
          cancelAnimationFrame(rafRef.current);
        }
        clearTimeout(resizeTimeout);
        clearInterval(performanceMonitor);
        window.removeEventListener('resize', handleResize);
        window.removeEventListener('wheel', handleWheel);
        window.removeEventListener('touchstart', handleTouchStart);
        window.removeEventListener('touchend', handleTouchEnd);
        lenisRef.current?.destroy();
      };
    }
  }, [getUltraConfig, deviceCapabilities, ultraSmoothEasing, hyperResponsiveEasing]);

  // Premium programmatic scrolling with predictive enhancement
  const scrollTo = useCallback((target: string | number, options?: any) => {
    if (lenisRef.current) {
      const { isUltraHighEnd } = deviceCapabilities;
      
      lenisRef.current.scrollTo(target, {
        duration: isUltraHighEnd ? 0.8 : 1,
        easing: isUltraHighEnd ? hyperResponsiveEasing : ultraSmoothEasing,
        lerp: isUltraHighEnd ? 0.6 : 0.4,
        ...options
      });
    }
  }, [deviceCapabilities, hyperResponsiveEasing, ultraSmoothEasing]);

  const scrollToTop = useCallback(() => {
    if (lenisRef.current) {
      const { isUltraHighEnd } = deviceCapabilities;
      
      lenisRef.current.scrollTo(0, { 
        duration: isUltraHighEnd ? 1.0 : 1.5,
        easing: isUltraHighEnd ? hyperResponsiveEasing : ultraSmoothEasing,
        lerp: isUltraHighEnd ? 0.7 : 0.5
      });
    }
  }, [deviceCapabilities, hyperResponsiveEasing, ultraSmoothEasing]);

  // Advanced control methods for premium experience
  const start = useCallback(() => {
    lenisRef.current?.start();
  }, []);

  const stop = useCallback(() => {
    lenisRef.current?.stop();
  }, []);

  const isScrolling = useCallback(() => {
    return lenisRef.current?.isScrolling || false;
  }, []);

  // Premium utility methods
  const setLerp = useCallback((newLerp: number) => {
    if (lenisRef.current) {
      lenisRef.current.options.lerp = Math.max(0.01, Math.min(1, newLerp));
    }
  }, []);

  const getCurrentScroll = useCallback(() => {
    return lenisRef.current?.scroll || 0;
  }, []);

  const getVelocity = useCallback(() => {
    return lenisRef.current?.velocity || 0;
  }, []);

  return {
    lenis: lenisRef.current,
    scrollTo,
    scrollToTop,
    start,
    stop,
    isScrolling,
    setLerp,
    getCurrentScroll,
    getVelocity,
    deviceCapabilities // Expose for debugging/optimization
  };
};
