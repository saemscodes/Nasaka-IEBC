
"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
  useRef,
  useLayoutEffect,
} from "react";
import { motion, AnimatePresence } from "framer-motion";

function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(" ");
}

interface RotatingTextProps {
  texts: string[];
  transition?: any;
  initial?: any;
  animate?: any;
  exit?: any;
  animatePresenceMode?: "wait" | "sync" | "popLayout";
  animatePresenceInitial?: boolean;
  rotationInterval?: number;
  durations?: number[];
  staggerDuration?: number;
  staggerFrom?: "first" | "last" | "center" | "random" | number;
  loop?: boolean;
  auto?: boolean;
  splitBy?: "characters" | "words" | "lines" | string;
  onNext?: (index: number) => void;
  mainClassName?: string;
  splitLevelClassName?: string;
  elementLevelClassName?: string;
  fixedHeight?: number | string;
}

const RotatingText = forwardRef<any, RotatingTextProps>((props, ref) => {
  const {
    texts,
    transition = { 
      type: "spring", 
      damping: 28, 
      stiffness: 120,
      mass: 0.5,
      restDelta: 0.001
    },
    initial = { y: "100%", opacity: 0 },
    animate = { y: 0, opacity: 1 },
    exit = { y: "-120%", opacity: 0 },
    animatePresenceMode = "wait",
    animatePresenceInitial = false,
    rotationInterval = 2000,
    durations,
    staggerDuration = 0,
    staggerFrom = "first",
    loop = true,
    auto = true,
    splitBy = "characters",
    onNext,
    mainClassName,
    splitLevelClassName,
    elementLevelClassName,
    fixedHeight = "1.2em",
    ...rest
  } = props;

  const [currentTextIndex, setCurrentTextIndex] = useState(0);
  const [width, setWidth] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!measureRef.current) return;
    
    const measureWidth = () => {
      if (!measureRef.current) return;
      
      measureRef.current.textContent = texts[currentTextIndex];
      const newWidth = measureRef.current.getBoundingClientRect().width;
      setWidth(newWidth);
    };
    
    measureWidth();
    window.addEventListener("resize", measureWidth);
    return () => window.removeEventListener("resize", measureWidth);
  }, [texts, currentTextIndex]);

  useEffect(() => {
    if (!auto) return;
    
    const currentDuration = durations?.[currentTextIndex] ?? rotationInterval;
    const timerId = setTimeout(() => {
      next();
    }, currentDuration);

    return () => clearTimeout(timerId);
  }, [auto, currentTextIndex, rotationInterval, durations]);

  const splitIntoCharacters = (text: string) => {
    return Array.from(text);
  };

  const elements = useMemo(() => {
    const currentText = texts[currentTextIndex];
    if (splitBy === "characters") {
      const words = currentText.split(" ");
      return words.map((word, i) => ({
        characters: splitIntoCharacters(word),
        needsSpace: i !== words.length - 1,
      }));
    }
    if (splitBy === "words") {
      return currentText.split(" ").map((word, i, arr) => ({
        characters: [word],
        needsSpace: i !== arr.length - 1,
      }));
    }
    if (splitBy === "lines") {
      return currentText.split("\n").map((line, i, arr) => ({
        characters: [line],
        needsSpace: i !== arr.length - 1,
      }));
    }
    return currentText.split(splitBy).map((part, i, arr) => ({
      characters: [part],
      needsSpace: i !== arr.length - 1,
    }));
  }, [texts, currentTextIndex, splitBy]);

  const getStaggerDelay = useCallback(
    (index: number, totalChars: number) => {
      const total = totalChars;
      if (staggerFrom === "first") return index * staggerDuration;
      if (staggerFrom === "last") return (total - 1 - index) * staggerDuration;
      if (staggerFrom === "center") {
        const center = Math.floor(total / 2);
        return Math.abs(center - index) * staggerDuration;
      }
      if (staggerFrom === "random") {
        const randomIndex = Math.floor(Math.random() * total);
        return Math.abs(randomIndex - index) * staggerDuration;
      }
      if (typeof staggerFrom === "number") {
        return Math.abs(staggerFrom - index) * staggerDuration;
      }
      return 0;
    },
    [staggerFrom, staggerDuration]
  );

  const handleIndexChange = useCallback(
    (newIndex: number) => {
      setCurrentTextIndex(newIndex);
      if (onNext) onNext(newIndex);
    },
    [onNext]
  );

  const next = useCallback(() => {
    const nextIndex =
      currentTextIndex === texts.length - 1
        ? loop
          ? 0
          : currentTextIndex
        : currentTextIndex + 1;
    if (nextIndex !== currentTextIndex) {
      handleIndexChange(nextIndex);
    }
  }, [currentTextIndex, texts.length, loop, handleIndexChange]);

  const previous = useCallback(() => {
    const prevIndex =
      currentTextIndex === 0
        ? loop
          ? texts.length - 1
          : currentTextIndex
        : currentTextIndex - 1;
    if (prevIndex !== currentTextIndex) {
      handleIndexChange(prevIndex);
    }
  }, [currentTextIndex, texts.length, loop, handleIndexChange]);

  const jumpTo = useCallback(
    (index: number) => {
      const validIndex = Math.max(0, Math.min(index, texts.length - 1));
      if (validIndex !== currentTextIndex) {
        handleIndexChange(validIndex);
      }
    },
    [texts.length, currentTextIndex, handleIndexChange]
  );

  const reset = useCallback(() => {
    if (currentTextIndex !== 0) {
      handleIndexChange(0);
    }
  }, [currentTextIndex, handleIndexChange]);

  useImperativeHandle(
    ref,
    () => ({
      next,
      previous,
      jumpTo,
      reset,
    }),
    [next, previous, jumpTo, reset]
  );

  return (
    <div 
      ref={containerRef}
      className="inline-flex relative overflow-hidden"
      style={{ 
        height: fixedHeight,
        display: 'inline-flex',
        position: 'relative',
      }}
    >
      <div 
        ref={measureRef}
        style={{
          position: 'absolute',
          visibility: 'hidden',
          whiteSpace: 'nowrap',
          fontSize: 'inherit',
          fontFamily: 'inherit',
          fontWeight: 'inherit',
          pointerEvents: 'none',
          height: fixedHeight,
          lineHeight: fixedHeight,
        }}
      />
      
      <motion.div
        animate={{ width }}
        transition={{ 
          type: "spring", 
          damping: 30, 
          stiffness: 100,
          mass: 0.5,
          restDelta: 0.001
        }}
        style={{
          height: fixedHeight,
          minWidth: 0,
          overflow: 'hidden',
          display: 'inline-flex',
          justifyContent: 'center',
        }}
      >
        <motion.span
          className={cn("relative", mainClassName)}
          {...rest}
          layout
          style={{
            height: fixedHeight,
            lineHeight: fixedHeight,
          }}
        >
          <span className="sr-only">{texts[currentTextIndex]}</span>
          <AnimatePresence mode={animatePresenceMode} initial={animatePresenceInitial}>
            <motion.div
              key={currentTextIndex}
              className={cn(
                splitBy === "lines" ? "flex flex-col w-full" : "flex"
              )}
              layout="position"
              aria-hidden="true"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              style={{
                height: fixedHeight,
                lineHeight: fixedHeight,
              }}
            >
              {elements.map((wordObj, wordIndex, array) => {
                const previousCharsCount = array
                  .slice(0, wordIndex)
                  .reduce((sum, word) => sum + word.characters.length, 0);
                return (
                  <motion.span
                    key={wordIndex}
                    className={cn("inline-flex relative items-center", splitLevelClassName)}
                    layout
                    transition={transition}
                    style={{
                      height: fixedHeight,
                      lineHeight: fixedHeight,
                    }}
                  >
                    {wordObj.characters.map((char, charIndex) => (
                      <motion.span
                        key={charIndex}
                        initial={initial}
                        animate={animate}
                        exit={exit}
                        transition={{
                          ...transition,
                          delay: getStaggerDelay(
                            previousCharsCount + charIndex,
                            array.reduce(
                              (sum, word) => sum + word.characters.length,
                              0
                            )
                          ),
                        }}
                        className={cn("inline-block", elementLevelClassName)}
                      >
                        {char}
                      </motion.span>
                    ))}
                    {wordObj.needsSpace && <span className="whitespace-pre"> </span>}
                  </motion.span>
                );
              })}
            </motion.div>
          </AnimatePresence>
        </motion.span>
      </motion.div>
    </div>
  );
});

RotatingText.displayName = "RotatingText";
export default RotatingText;
