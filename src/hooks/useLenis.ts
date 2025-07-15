
import { useEffect, useRef } from 'react';

declare global {
  interface Window {
    Lenis: any;
  }
}

export const useLenis = () => {
  const lenisRef = useRef<any>(null);

  useEffect(() => {
    // Check if Lenis is available and user hasn't disabled animations
    if (typeof window !== 'undefined' && window.Lenis) {
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      
      if (prefersReducedMotion) {
        return; // Don't initialize if user prefers reduced motion
      }

      // Detect mobile devices
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const isTablet = /iPad|Android/i.test(navigator.userAgent) && window.innerWidth >= 768;

      // Initialize Lenis with device-specific settings
      lenisRef.current = new window.Lenis({
        lerp: isMobile ? 0.05 : 0.1, // Lighter smoothing on mobile
        duration: isMobile ? 0.8 : 1.2, // Faster on mobile
        easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel: true,
        smoothTouch: false, // Disable smooth touch for better mobile performance
        infinite: false,
        touchMultiplier: 2,
        wheelMultiplier: 1,
      });

      // Animation loop
      function raf(time: number) {
        lenisRef.current?.raf(time);
        requestAnimationFrame(raf);
      }
      requestAnimationFrame(raf);

      // Handle window resize
      const handleResize = () => {
        lenisRef.current?.resize();
      };
      window.addEventListener('resize', handleResize);

      // Cleanup function
      return () => {
        window.removeEventListener('resize', handleResize);
        lenisRef.current?.destroy();
      };
    }
  }, []);

  // Return methods for programmatic scrolling
  return {
    lenis: lenisRef.current,
    scrollTo: (target: string | number, options?: any) => {
      lenisRef.current?.scrollTo(target, options);
    },
    scrollToTop: () => {
      lenisRef.current?.scrollTo(0, { duration: 2 });
    }
  };
};
