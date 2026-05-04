import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence, useScroll, useTransform, useSpring, useInView, useAnimation } from 'framer-motion';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import {
  ChevronLeft,
  Info,
  MapPin,
  ShieldCheck,
  Users,
  Zap,
  Globe,
  MessageSquare,
  ArrowRight,
  Sparkles,
  Target,
  History,
  Lightbulb,
  CheckCircle,
  Lock,
  Globe2,
  BarChart3
} from 'lucide-react';
import DonationWidget from '@/components/ui/DonationWidget';

// --- LOCAL ICON SYSTEM ---
// Maps key features to our local SVG stash in /public/icons
const LocalIcon = ({ name, className = "", size = 24 }) => (
  <img
    src={`/icons/${name}`}
    className={`${className} pointer-events-none`}
    style={{ width: size, height: size }}
    alt=""
    onError={(e) => {
      // Fallback for missing/broken icons
      e.target.src = "/icons/location-pin-svgrepo-com.svg";
    }}
  />
);

// --- PREMIUM DEVICE MOCKUPS ---
// High-fidelity iOS/Android wrappers for screenshots

const IPhoneMockup = ({ children, className = "" }) => (
  <div className={`relative mx-auto border-[8px] border-[#1c1c1e] rounded-[3.5rem] h-[640px] w-[300px] shadow-2xl overflow-hidden bg-black ${className}`}>
    {/* Dynamic Island */}
    <div className="absolute top-2 left-1/2 -translate-x-1/2 w-28 h-7 bg-black rounded-full z-50 flex items-center justify-center">
      <div className="w-2 h-2 bg-[#1c1c1e] rounded-full mr-1" />
    </div>
    {/* Screen Content */}
    <div className="h-full w-full bg-white dark:bg-black rounded-[2.8rem] overflow-hidden relative">
      {children}
    </div>
    {/* Side Buttons */}
    <div className="absolute -left-[10px] top-24 w-[2px] h-12 bg-[#3a3a3c] rounded-r-lg" />
    <div className="absolute -right-[10px] top-32 w-[2px] h-20 bg-[#3a3a3c] rounded-l-lg" />
  </div>
);

const AndroidMockup = ({ children, className = "" }) => (
  <div className={`relative mx-auto border-[6px] border-[#2c2c2e] rounded-[2.5rem] h-[640px] w-[300px] shadow-2xl overflow-hidden bg-black ${className}`}>
    {/* Punch Hole Camera */}
    <div className="absolute top-3 left-1/2 -translate-x-1/2 w-4 h-4 bg-black rounded-full z-50 border-2 border-[#1c1c1e]" />
    {/* Screen Content */}
    <div className="h-full w-full bg-white dark:bg-black rounded-[2.1rem] overflow-hidden relative">
      {children}
    </div>
  </div>
);

// --- SHARED COMPONENTS ---

const GlassCard = ({ children, className = "", hoverEffect = true }) => {
  const { theme } = useTheme();
  return (
    <motion.div
      whileHover={hoverEffect ? { y: -8, scale: 1.01, translateZ: 0 } : {}}
      transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
      className={`
        relative overflow-hidden rounded-[2.5rem] border transition-all duration-500
        ${theme === 'dark'
          ? 'bg-[#0B101E]/60 border-[#1E6BFF]/30 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.1)]'
          : 'bg-white/95 border-[#1E6BFF]/15 shadow-[0_20px_45px_rgba(0,10,40,0.08),inset_0_1px_0_rgba(255,255,255,0.8)]'
        }
        backdrop-blur-3xl saturate-150 will-change-[backdrop-filter,transform]
        ${className}
      `}
    >
      {/* Premium Bevel Edge */}
      <div className={`absolute inset-x-0 top-0 h-[1px] ${theme === 'dark' ? 'bg-gradient-to-r from-transparent via-[#1E6BFF]/30 to-transparent' : 'bg-gradient-to-r from-transparent via-white/50 to-transparent'}`} />
      {children}
    </motion.div>
  );
};

const SectionTitle = ({ title, subtitle, icon: iconName }) => {
  const { theme } = useTheme();
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.3 });

  return (
    <div ref={ref} className="mb-12 md:mb-20 text-center px-4">
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={isInView ? { scale: 1, opacity: 1 } : {}}
        transition={{ type: "spring", stiffness: 200, damping: 15 }}
        className={`w-16 h-16 md:w-24 md:h-24 rounded-2xl md:rounded-[2rem] mx-auto mb-6 md:mb-10 flex items-center justify-center border border-[#1E6BFF]/30 shadow-[0_25px_50px_rgba(0,10,40,0.4)] bg-gradient-to-br from-[#1E6BFF] to-[#0A4BBF]`}
      >
        <LocalIcon name={iconName} size={theme === 'dark' ? 56 : 56} className="brightness-0 invert opacity-100 hidden md:block" />
        <LocalIcon name={iconName} size={40} className="brightness-0 invert opacity-100 md:hidden" />
      </motion.div>
      <motion.h2
        initial={{ opacity: 0, y: 30 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        className={`text-4xl md:text-6xl lg:text-8xl font-black mb-4 md:mb-8 tracking-tighter leading-tight ${theme === 'dark' ? 'text-white' : 'text-[#1C1C1E]'}`}
      >
        {title}
      </motion.h2>
      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ delay: 0.1 }}
        className={`text-lg md:text-2xl lg:text-3xl max-w-5xl mx-auto leading-relaxed font-bold ${theme === 'dark' ? 'text-white/70' : 'text-[#1C1C1E]/70'}`}
      >
        {subtitle}
      </motion.p>
    </div>
  );
};

const FeedbackCarousel = () => {
  const { theme } = useTheme();
  const controls = useAnimation();
  const [isPaused, setIsPaused] = useState(false);
  
  const feedbacks = [
    { name: "judy (@judepatwang)", role: "X User (Agri/AI/Digital User)", text: "Good progress..." },
    { name: "Bernard Wanjohi ™ (@9_bendiehard)", role: "X User", text: "Wacha tusambaze injili💯" },
    { name: "Living_Clerk2236", role: "Reddit User (r/nairobitechies)", text: "This seems like a very cool idea." },
    { name: "AlertCalligrapher146", role: "Reddit User (r/nairobitechies)", text: "Have always had it installed on my devices" },
    { name: "Instagram User (on @civiceducationke post)", role: "Instagram Commenter", text: "👏👏very good" },
    { name: "Instagram User (on @civiceducationke post)", role: "Instagram Commenter", text: "NICE ONE🔥" },
    { name: "Instagram User (on @civiceducationke post)", role: "Instagram Commenter", text: "Amazing!! 🙌🏾👌🏾" },
    { name: "Njeri 🇰🇪 (@rtunguru)", role: "X User (Civic Tech Activist)", text: "Ni Kama Google Maps ya registration centers." },
    { name: "METRO [💣-ING] (@__DannyB__)", role: "X User", text: "Wonderful! 💪🏾" },
    { name: "Instagram User", role: "Commenter", text: "👏👏👏brilliant idea" },
    { name: "Instagram User", role: "Commenter", text: "Just brilliant! 👏🏾" },
    { name: "Instagram User", role: "Commenter", text: "Amazing 👏👏👏👏" },
    { name: "Instagram User", role: "Commenter", text: "👏👏👏🙌" },
    { name: "Instagram User", role: "Commenter", text: "Yes ✊🇰🇪" },
    { name: "Instagram User", role: "Commenter", text: "NICE ONE🔥" },
    { name: "Instagram User", role: "Commenter", text: "👏fully live recording 👏" },
    { name: "Instagram User", role: "Commenter", text: "Thank you!" },
    { name: "Instagram User", role: "Commenter", text: "❤️❤️❤️💯" },
    { name: "Instagram User", role: "Commenter", text: "👏👏very good" },
    { name: "Instagram User", role: "Commenter", text: "Amazing!! 🙌🏾👌🏾" },
    { name: "Instagram User", role: "Commenter", text: "Wow! What a dope idea 🔥🔥🔥" },
    { name: "Instagram User", role: "Commenter", text: "innovation" },
    { name: "Instagram User", role: "Commenter", text: "YES!!" },
    { name: "Instagram User", role: "Commenter", text: "Now more than ever 🙌" },
    { name: "Instagram User", role: "Commenter", text: "Real-life solutions👏👏👏" },
    { name: "Instagram User", role: "Commenter", text: "Maaan thank you for this!!!!" },
    { name: "Instagram User", role: "Commenter", text: "This is amazing! You’re doing really great work❤️🇰🇪" },
    { name: "Instagram User", role: "Commenter", text: "🔥🔥" },
    { name: "Instagram User", role: "Commenter", text: "I love this!!🔥" },
    { name: "Instagram User", role: "Commenter", text: "Kazi Safii!🔥" }
  ];
  
  const displayItems = [...feedbacks, ...feedbacks, ...feedbacks];

  const marqueeVariants = {
    animate: {
      x: [0, -2000],
      transition: {
        x: {
          repeat: Infinity,
          repeatType: "loop",
          duration: 60,
          ease: "linear",
        },
      },
    },
  };

  useEffect(() => {
    if (!isPaused) {
      controls.start("animate");
    } else {
      controls.stop();
    }
  }, [isPaused, controls]);

  return (
    <div className="relative overflow-hidden py-16 w-full px-4 group !cursor-grab active:!cursor-grabbing">
      <div className={`absolute left-0 top-0 bottom-0 w-32 md:w-64 z-10 pointer-events-none bg-gradient-to-r ${theme === 'dark' ? 'from-[#02040A] via-[#02040A]/60 to-transparent' : 'from-[#F2F2F7] via-[#F2F2F7]/60 to-transparent'}`} />
      <div className={`absolute right-0 top-0 bottom-0 w-32 md:w-64 z-10 pointer-events-none bg-gradient-to-l ${theme === 'dark' ? 'from-[#02040A] via-[#02040A]/60 to-transparent' : 'from-[#F2F2F7] via-[#F2F2F7]/60 to-transparent'}`} />
      
      <motion.div
        drag="x"
        dragConstraints={{ left: -4000, right: 0 }}
        onDragStart={() => setIsPaused(true)}
        onDragEnd={() => setIsPaused(false)}
        whileInView={{ opacity: 1 }}
        viewport={{ margin: "200px" }}
        animate={controls}
        variants={marqueeVariants}
        className="flex gap-8 whitespace-nowrap will-change-transform"
      >
        {displayItems.map((f, i) => (
          <GlassCard key={i} className="inline-flex flex-col min-w-[350px] md:min-w-[450px] px-8 md:px-10 py-10 md:py-12 border-[#1E6BFF]/15" hoverEffect={false}>
            <div className="flex items-center gap-6 mb-8">
              <div className="w-16 h-16 flex-shrink-0 aspect-square rounded-full bg-gradient-to-br from-[#1E6BFF] to-[#0A4BBF] flex items-center justify-center text-white font-black text-2xl shadow-lg border-2 border-white/20">
                {f.name[0]}
              </div>
              <div>
                <h4 className="font-black text-xl md:text-2xl tracking-tight leading-none mb-1">{f.name}</h4>
                <p className="text-sm md:text-base font-bold opacity-60 tracking-wide uppercase">{f.role}</p>
              </div>
            </div>
            <p className="text-lg md:text-xl font-bold leading-relaxed italic opacity-90 whitespace-normal">"{f.text}"</p>
          </GlassCard>
        ))}
      </motion.div>
    </div>
  );
};

const About = () => {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const heroRef = useRef(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const smoothProgress = useSpring(scrollYProgress, { stiffness: 100, damping: 30, restDelta: 0.001 });

  const bgScale = useTransform(smoothProgress, [0, 1], [1, 1.15]);
  const contentY = useTransform(smoothProgress, [0, 1], [0, 80]);
  const contentOpacity = useTransform(smoothProgress, [0, 0.8, 1], [1, 1, 0]);

  const { location: geoLoc, loading: geoLoading, error: geoError, requestLocation } = useGeolocation();
  
  const handleFindOffice = () => {
    requestLocation();
  };

  // Effect to handle navigation once location is acquired
  useEffect(() => {
    if (geoLoc && !geoLoading) {
      navigate(`/map?lat=${geoLoc.latitude}&lng=${geoLoc.longitude}&search=nearest`);
    } else if (geoError && !geoLoading) {
      // If error (denied/unavailable), go to map anyway but without coordinates
      navigate('/map');
    }
  }, [geoLoc, geoLoading, geoError, navigate]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className={`min-h-screen relative overflow-x-hidden w-full selection:bg-[#1E6BFF] selection:text-white transition-colors duration-1000 ${theme === 'dark' ? 'bg-[#02040A] text-white' : 'bg-[#F2F2F7] text-[#1C1C1E]'}`}>
      {/* 1. SCALING BACKGROUND - DECOUPLED FROM LAYOUT FLOW */}
      <motion.div
        style={{ scale: bgScale }}
        className="fixed inset-0 topo-bg pointer-events-none z-0 transform-gpu"
      />

      {/* ATMOSPHERIC GLOWS FOR DARK MODE */}
      {theme === 'dark' && (
        <div className="fixed inset-0 pointer-events-none z-0">
          <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-[#1E6BFF]/10 blur-[150px] rounded-full" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-[#1E6BFF]/5 blur-[120px] rounded-full" />
        </div>
      )}

      <style>{`
        .topo-bg {
          background-image: url('/topo-bg.svg');
          background-size: cover;
          background-position: center;
          opacity: 0.15;
          filter: contrast(1.1);
        }
        .dark .topo-bg {
          filter: invert(1) hue-rotate(185deg) brightness(1.2) saturate(1.8);
          opacity: 0.12;
          mix-blend-mode: color-dodge;
        }
        .skeuo-button {
          box-shadow: 
            inset 0 1px 1px rgba(255,255,255,0.4),
            inset 0 -2px 4px rgba(0,0,0,0.1),
            0 10px 30px rgba(30,107,255,0.3);
          border: 1px solid rgba(255,255,255,0.2);
          background: linear-gradient(180deg, #1E6BFF, #0A4BBF);
        }
        .skeuo-button-light {
          box-shadow: 
            inset 0 1px 1px rgba(255,255,255,0.8),
            0 8px 24px rgba(0,0,0,0.06);
          border: 1px solid rgba(0,0,0,0.08);
          background: linear-gradient(180deg, #FFFFFF, #F8F9FF);
        }
      `}</style>

      {/* TOPOGRAPHIC BACKGROUND LAYER */}


      {/* NAVIGATION BAR */}
      <nav className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] w-[95%] max-w-7xl rounded-[2.5rem] border border-white/20 backdrop-blur-3xl bg-white/60 dark:bg-black/60 shadow-2xl overflow-hidden px-4 md:px-10 py-4">
        <div className="flex items-center justify-between">
          <motion.button
            whileHover={{ x: -2, scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate('/')}
            className="flex items-center space-x-2 md:space-x-3 px-3 md:px-5 py-2 md:py-2.5 rounded-2xl skeuo-button-light dark:bg-white/5 transition-all group overflow-hidden"
          >
            <ChevronLeft size={16} className="text-[#1E6BFF] group-hover:-translate-x-1 transition-transform" />
            <span className="font-black text-[10px] md:text-xs uppercase tracking-[0.1em] md:tracking-[0.15em] text-[#1E6BFF]">Back</span>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05, translateZ: 0 }}
            whileTap={{ scale: 0.95 }}
            transition={{ duration: 0.3 }}
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="flex items-center gap-3 md:gap-4 focus:outline-none"
          >
            <div className="overflow-hidden flex items-center justify-center will-change-transform">
              <img 
                src="/assets/nasaka-cut-nobg.png" 
                alt="NASAKA" 
                className="h-6 md:h-12 w-auto object-contain scale-[1.15] transform-gpu -ml-1 md:-ml-2" 
              />
            </div>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05, y: -1 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate('/map')}
            className="px-4 md:px-10 py-2.5 md:py-3.5 skeuo-button text-white font-black rounded-2xl text-[10px] md:text-sm tracking-widest uppercase shadow-xl transition-all"
          >
            Launch Map
          </motion.button>
        </div>
      </nav>

      {/* HERO SECTION */}
      <header ref={heroRef} className="relative pt-12 md:pt-24 pb-32 md:pb-48 overflow-visible z-10 px-4 md:px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 md:gap-24 items-center">
          <motion.div style={{ y: contentY, opacity: contentOpacity }}>
            <div className="inline-block px-5 md:px-6 py-2 md:py-2.5 bg-[#1E6BFF]/10 text-[#1E6BFF] rounded-full text-[10px] md:text-xs font-black tracking-[0.2em] uppercase mb-8 md:mb-10 border border-[#1E6BFF]/20 backdrop-blur-xl">
              Civic Education Kenya presents
            </div>
            <h1 className="text-6xl md:text-8xl lg:text-9xl font-black tracking-tighter leading-tight md:leading-[1.1] mb-8 md:mb-12">
              Tap.<br />Search.<br /><span className="text-[#1E6BFF]">Go.</span>
            </h1>
            <p className="text-xl md:text-2xl lg:text-3xl font-bold leading-relaxed opacity-80 max-w-xl mb-12 md:mb-16 tracking-tight">
              The simplest way to get your nearest IEBC Office, loved by Kenyans & fans across the globe.
            </p>
            <div className="flex flex-wrap gap-4 md:gap-8">
              <motion.button
                whileHover={{ scale: 1.02, y: -4, translateZ: 0 }}
                whileTap={{ scale: 0.98 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                onClick={handleFindOffice}
                disabled={geoLoading}
                className={`px-8 md:px-12 py-5 md:py-7 skeuo-button text-white rounded-[2rem] md:rounded-[3rem] font-black text-lg md:text-2xl shadow-3xl flex items-center gap-4 md:gap-6 will-change-transform ${geoLoading ? 'opacity-80 cursor-wait' : ''}`}
              >
                {geoLoading ? 'Locating...' : 'Find My Office'}
                <ArrowRight size={22} strokeWidth={3} className={geoLoading ? 'animate-pulse' : ''} />
              </motion.button>
              <button
                onClick={() => {
                  const el = document.getElementById('vision-section');
                  if (el) {
                    const offset = el.getBoundingClientRect().top + window.scrollY - 100;
                    window.scrollTo({ top: offset, behavior: 'smooth' });
                  }
                }}
                className="px-8 md:px-12 py-5 md:py-7 rounded-[2rem] md:rounded-[3rem] border-2 md:border-4 border-[#1E6BFF]/20 font-black text-lg md:text-2xl hover:bg-[#1E6BFF]/5 transition-all backdrop-blur-lg hover:border-[#1E6BFF]/40 shadow-[0_20px_40px_rgba(30,107,255,0.2)]"
              >
                Our Reach
              </button>
            </div>
          </motion.div>

          <motion.div
            initial={{ scale: 0.8, opacity: 0, rotate: 5 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            transition={{ delay: 0.3, type: "spring", stiffness: 100 }}
            className="relative"
          >
            <IPhoneMockup className="rotate-2 scale-90 md:scale-100">
              <img src="/assets/map-ss.png" alt="" className="w-full h-full object-cover" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 md:w-24 md:h-24 bg-gradient-to-br from-[#1E6BFF] to-[#0A4BBF] rounded-full flex items-center justify-center shadow-3xl border-2 md:border-4 border-white/30">
                <LocalIcon name="location-tick-svgrepo-com.svg" size={40} className="invert" />
              </div>
            </IPhoneMockup>
            <motion.div
              animate={{ y: [0, -10, 0] }}
              transition={{ repeat: Infinity, duration: 5, ease: "easeInOut" }}
              className="absolute right-2 md:right-0 top-12 md:top-24 px-6 md:px-8 py-3 md:py-5 bg-white/90 dark:bg-[#1C1C1E]/90 backdrop-blur-2xl rounded-2xl md:rounded-[2.5rem] shadow-4xl border-2 border-[#1E6BFF]/20 flex items-center gap-4 md:gap-6 z-50 whitespace-nowrap"
            >
              <div className="w-3 h-3 md:w-5 md:h-5 rounded-full bg-green-500 animate-pulse shadow-[0_0_15px_rgba(34,197,94,0.6)]" />
              <span className="font-black text-[10px] md:text-sm uppercase tracking-widest text-[#1E6BFF]">290 Constituencies Active</span>
            </motion.div>
          </motion.div>
        </div>
      </header>

      {/* FACTUAL BREAKDOWN */}
      <section id="vision-section" className={`py-24 md:py-48 ${theme === 'dark' ? 'bg-[#051A40]' : 'bg-gradient-to-br from-[#1E6BFF] to-[#0A4BBF]'} text-white z-20 relative rounded-[4rem] md:rounded-[6rem] overflow-hidden shadow-[0_40px_100px_rgba(0,10,40,0.5)] mx-2 md:mx-10 border-2 md:border-4 border-white/10`}>
        <div className="max-w-7xl mx-auto px-4 md:px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-16 md:gap-20 lg:gap-32 text-center">
            <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
              <div className="text-6xl md:text-6xl lg:text-9xl font-black mb-1 md:mb-2 tracking-tighter leading-none">47</div>
              <div className="text-2xl md:text-4xl font-black uppercase tracking-tighter opacity-90 mt-2">Counties</div>
              <p className="mt-6 md:mt-10 text-lg md:text-xl font-bold opacity-90 leading-relaxed px-4 md:px-6">
                Full coverage from Turkana to Kwale. Every county headquarter & sub offices mapped with verified coordinates.
              </p>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }}>
              <div className="text-6xl md:text-7xl lg:text-9xl font-black mb-1 md:mb-2 tracking-tighter leading-none">30K+</div>
              <div className="text-2xl md:text-4xl font-black uppercase tracking-tighter opacity-90 mt-2">Centres</div>
              <p className="mt-6 md:mt-10 text-lg md:text-xl font-bold opacity-90 leading-relaxed px-4 md:px-6">
                Precise tracking of registration centres as gazetted is underway. Zoom into precision view (Lvl 12+) to see them all.
              </p>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.2 }}>
              <div className="text-6xl md:text-7xl lg:text-9xl font-black mb-1 md:mb-2 tracking-tighter leading-none">2.3M</div>
              <div className="text-2xl md:text-4xl font-black uppercase tracking-tighter opacity-90 mt-2">Reach</div>
              <p className="mt-6 md:mt-10 text-lg md:text-xl font-bold opacity-90 leading-relaxed px-4 md:px-6">
                From table-top discussions to interviews to international articles. Trusted by Kenyans and fans across the globe.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* CORE FEATURES - SHADES OF BLUE */}
      <section className="py-32 md:py-64 z-10 relative px-4 md:px-6">
        <div className="max-w-7xl mx-auto">
          <SectionTitle
            title="Feature Stack"
            subtitle="Engineered for reliability, speed, and absolute clarity in electoral navigation."
            icon="map-search-svgrepo-com.svg"
          />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 md:gap-12">
            {[
              { title: "Instant Smart Location", icon: "map-arrow-up-svgrepo-com.svg", desc: "Instantly detect nearest offices, plus a smart search bar that can search any location, for accuracy & the best experience." },
              { title: "Live Verification", icon: "live-svgrepo-com.svg", desc: "Community-driven approval system. Check and confirm a location for verified status on an office." },
              { title: "Let's Get You There", icon: "car-svgrepo-com (5).svg", desc: "Breaking it all down: distance, pricing estimates, weather, difficulty of terrain - summarized for you. No more excuses!" },
              { title: "Global Reach", icon: "hand-svgrepo-com (1).svg", desc: "Whether you are in Dubai or Dallas, we've got you covered. Trusted by Kenyans and fans across the globe." }
            ].map((f, i) => (
              <GlassCard key={i} className="px-6 md:px-8 py-10 md:py-12 flex flex-col h-full border-[#1E6BFF]/30 shadow-2xl transition-all duration-500 hover:border-[#1E6BFF]/60 will-change-transform">
                <div className={`w-20 h-20 md:w-24 md:h-24 rounded-2xl md:rounded-[2rem] flex items-center justify-center mb-8 md:mb-10 shadow-[0_20px_40px_rgba(30,107,255,0.25)] border border-[#1E6BFF]/30 backdrop-blur-xl ${theme === 'dark' ? 'bg-[#1E6BFF]/30 ring-8 ring-[#1E6BFF]/5' : 'bg-[#1E6BFF]/10'} will-change-[backdrop-filter]`}>
                  <LocalIcon name={f.icon} size={56} className={theme === 'dark' ? 'brightness-0 invert opacity-100' : ''} style={theme === 'light' ? { filter: 'invert(20%) sepia(85%) saturate(3959%) hue-rotate(215deg) brightness(90%) contrast(101%)' } : {}} />
                </div>
                <h3 className="text-2xl md:text-4xl font-black mb-6 md:mb-8 tracking-tighter leading-none">{f.title}</h3>
                <p className="text-lg md:text-xl font-bold opacity-70 leading-relaxed">{f.desc}</p>
              </GlassCard>
            ))}
          </div>
        </div>
      </section>

      {/* SHOWCASE - MOCKUPS */}
      <section className={`py-32 md:py-64 ${theme === 'dark' ? 'bg-[#1E6BFF]/5' : 'bg-[#1E6BFF]/10'} rounded-[4rem] md:rounded-[6rem] overflow-hidden px-4 md:px-8 relative mx-2 md:mx-10 border-t border-b border-[#1E6BFF]/20`}>
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-20 md:gap-32 items-center">
          <div>
            <SectionTitle
              title="Android & iOS Support"
              subtitle="Optimized for every screen. From high-end iPhones to entry-level Android devices - we don't judge."
              icon="apple-173-svgrepo-com.svg"
            />
            <div className="space-y-10 md:space-y-16 mb-12 md:mb-20">
              {[
                "Adaptive dark mode support",
                "Beautiful UI interface design",
                "Location as only permission needed",
                "Efficient bandwidth utilization"
              ].map((text, i) => (
                <div key={i} className="flex items-center gap-6 md:gap-8">
                  <div className="w-12 h-12 md:w-16 md:h-16 flex-shrink-0 rounded-xl md:rounded-2xl bg-[#1E6BFF] flex items-center justify-center shadow-2xl border border-white/40">
                    <LocalIcon name="tick-svgrepo-com.svg" size={24} className="invert" />
                  </div>
                  <span className="text-xl md:text-3xl font-black tracking-tight opacity-90">{text}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="relative h-[600px] md:h-[800px] flex items-center justify-center mt-20 lg:mt-0">
            {/* Apple-style Overlapping Mockup Stack */}
            <motion.div
              initial={{ x: -100, rotate: -5, opacity: 0 }}
              whileInView={{ x: -60, rotate: -12, opacity: 1 }}
              viewport={{ once: true }}
              className="absolute z-10 scale-75 md:scale-90 rounded-[2.5rem] overflow-hidden"
            >
              <AndroidMockup className="blur-[1px] opacity-80">
                <img src="/assets/office-detail-ss.png" alt="" className="w-full h-full object-cover" />
              </AndroidMockup>
            </motion.div>

            <motion.div
              initial={{ y: 100, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              viewport={{ once: true }}
              className="absolute z-30 scale-90 md:scale-105 shadow-[0_50px_100px_rgba(0,10,40,0.5)] rounded-[3.5rem]"
            >
              <IPhoneMockup>
                <img src="/assets/splashpage-ss.png" alt="" className="w-full h-full object-cover" />
              </IPhoneMockup>
            </motion.div>

            <motion.div
              initial={{ x: 100, rotate: 5, opacity: 0 }}
              whileInView={{ x: 60, rotate: 12, opacity: 1 }}
              viewport={{ once: true }}
              className="absolute z-20 scale-75 md:scale-95 rounded-[3.5rem] overflow-hidden shadow-[0_30px_60px_rgba(0,10,40,0.3)]"
            >
              <IPhoneMockup className="blur-[1.5px] opacity-60">
                <img src="/assets/map-ss.png" alt="" className="w-full h-full object-cover" />
              </IPhoneMockup>
            </motion.div>
          </div>
        </div>
      </section>

      {/* FEEDBACK CAROUSEL - FULL WIDTH */}
      <section className="py-32 md:py-64 w-full">
        <div className="max-w-full overflow-visible">
          <SectionTitle
            title="What Others Are Saying"
            subtitle="Nasaka is built on the feedback and needs of Kenyans from every walk of life."
            icon="happy-happiness-celebrate-excited-svgrepo-com.svg"
          />
          <FeedbackCarousel />
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-24 md:py-32 px-6 md:px-10 border-t-4 border-[#1E6BFF]/20 z-10 relative bg-white/50 dark:bg-black/50 backdrop-blur-3xl rounded-t-[3rem] md:rounded-t-[5rem]">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-16 md:gap-24">
          <div className="col-span-1 md:col-span-2 flex flex-col items-start">
            <motion.div
              whileHover={{ scale: 1.02, x: 5, translateZ: 0 }}
              whileTap={{ scale: 0.98 }}
              transition={{ duration: 0.3 }}
              onClick={() => navigate('/')}
              className="inline-block cursor-pointer mb-8 md:mb-10"
            >
              <img 
                src="/assets/nasaka-cut-nobg.png" 
                alt="NASAKA" 
                className="h-10 md:h-16 w-auto object-contain scale-[1.1] transform-gpu origin-left will-change-transform -ml-2 md:-ml-3" 
              />
            </motion.div>
            <p className="text-xl md:text-2xl font-bold opacity-80 mb-10 md:mb-12 max-w-md leading-relaxed">
              Advancing civic transparency through open data and community-led mapping across Kenya.
            </p>
            <div className="flex gap-6 md:gap-10">
              {[
                { name: 'location-pin-svgrepo-com.svg', link: 'https://nasakaiebc.civiceducationkenya.com' },
                { name: 'compass-svgrepo-com.svg', link: 'https://status.nasakaiebc.civiceducationkenya.com' },
                { name: 'earth-africa.svg', link: 'https://civiceducationkenya.com' }
              ].map((icon, i) => (
                <motion.a
                  key={i}
                  href={icon.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  whileHover={{ y: -3, scale: 1.1 }}
                  className={`w-12 h-12 md:w-16 md:h-16 rounded-2xl md:rounded-[1.5rem] flex items-center justify-center border-2 shadow-xl transition-all duration-300 ${
                    theme === 'dark'
                      ? 'bg-gradient-to-br from-[#1E6BFF]/20 to-[#0A1128] border-[#1E6BFF]/40 hover:border-[#1E6BFF]/70 hover:shadow-[0_8px_30px_rgba(30,107,255,0.35)]'
                      : 'bg-gradient-to-br from-white to-[#F2F2F7] border-[#1E6BFF]/20 hover:shadow-xl'
                  }`}
                >
                  <LocalIcon
                    name={icon.name}
                    size={24}
                    className={theme === 'dark' ? 'brightness-0 invert' : ''}
                  />
                </motion.a>
              ))}
            </div>
          </div>
          <div>
            <h4 className="font-black text-xs md:text-sm uppercase tracking-[0.2em] md:tracking-[0.4em] text-[#1E6BFF] mb-8 md:mb-12">Project</h4>
            <ul className="space-y-6 md:space-y-8 font-black text-lg md:text-xl opacity-90">
              <li><a href="https://nasakaiebc.civiceducationkenya.com/docs" target="_blank" rel="noreferrer" className="hover:text-[#1E6BFF] transition-all">API Documentation</a></li>
              <li><a href="https://nasakaiebc.civiceducationkenya.com/about" target="_blank" rel="noreferrer" className="hover:text-[#1E6BFF] transition-all">About Nasaka</a></li>
              <li><a href="https://nasakaiebc.civiceducationkenya.com/map" className="hover:text-[#1E6BFF] transition-all">Map</a></li>
              <li><a href="https://civiceducationkenya.com/join-community" className="hover:text-[#1E6BFF] transition-all">Join Community</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-black text-xs md:text-sm uppercase tracking-[0.2em] md:tracking-[0.4em] text-[#1E6BFF] mb-8 md:mb-12">Legal</h4>
            <ul className="space-y-6 md:space-y-8 font-black text-lg md:text-xl opacity-90">
              <li><a href="https://civiceducationkenya.com/" target="_blank" rel="noreferrer" className="hover:text-[#1E6BFF] transition-all">Civic Education Kenya (CEKA)</a></li>
              <li><a href="https://civiceducationkenya.com/privacy" target="_blank" rel="noreferrer" className="hover:text-[#1E6BFF] transition-all">Privacy</a></li>
              <li><a href="https://civiceducationkenya.com/terms" target="_blank" rel="noreferrer" className="hover:text-[#1E6BFF] transition-all">Terms of Use</a></li>
            </ul>
          </div>
        </div>
        <div className="max-w-7xl mx-auto mt-20 md:mt-32 pt-16 md:pt-20 border-t-2 border-[#1E6BFF]/10 flex flex-col md:flex-row justify-between items-center gap-10 md:gap-12">
          <p className="text-sm md:text-base font-black opacity-50 uppercase tracking-[0.2em] md:tracking-[0.3em] text-center md:text-left">© 2026 CEKA • NASAKA V17.2.2</p>
          <motion.a
            href="https://status.nasakaiebc.civiceducationkenya.com"
            target="_blank"
            whileHover={{ scale: 1.05 }}
            className="flex items-center gap-4 md:gap-6 px-6 md:px-10 py-3 md:py-4 bg-gradient-to-br from-[#1E6BFF]/10 to-transparent rounded-[1.5rem] md:rounded-[2rem] border-2 border-[#1E6BFF]/20 shadow-lg backdrop-blur-xl"
          >
            <div className="relative">
              <div className="w-2 h-2 md:w-3 md:h-3 rounded-full bg-green-500 animate-ping absolute" />
              <div className="w-2 h-2 md:w-3 md:h-3 rounded-full bg-green-500 relative" />
            </div>
            <span className="text-[10px] md:text-sm font-black uppercase tracking-widest text-[#1E6BFF]">Nasaka IEBC Prod Status</span>
          </motion.a>
        </div>
      </footer>

      <DonationWidget offsetY={80} />
    </div>
  );
};

export default About;