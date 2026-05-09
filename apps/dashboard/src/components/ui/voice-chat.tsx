"use client";

import { Mic, Volume2, Sparkles, Loader2 } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface VoiceChatProps {
  className?: string;
  demoMode?: boolean;
}

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  opacity: number;
  velocity: { x: number; y: number };
}

export function VoiceChat({ className, demoMode = true }: VoiceChatProps) {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [duration, setDuration] = useState(0);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [waveformData, setWaveformData] = useState<number[]>(
    Array(28).fill(0)
  );
  const intervalRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const animationRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const newParticles: Particle[] = Array.from({ length: 16 }, (_, i) => ({
      id: i,
      x: Math.random() * 360,
      y: Math.random() * 360,
      size: Math.random() * 3 + 1,
      opacity: Math.random() * 0.3 + 0.15,
      velocity: {
        x: (Math.random() - 0.5) * 0.4,
        y: (Math.random() - 0.5) * 0.4,
      },
    }));
    setParticles(newParticles);
  }, []);

  useEffect(() => {
    const animateParticles = () => {
      setParticles((prev) =>
        prev.map((p) => ({
          ...p,
          x: (p.x + p.velocity.x + 360) % 360,
          y: (p.y + p.velocity.y + 360) % 360,
        }))
      );
      animationRef.current = requestAnimationFrame(animateParticles);
    };
    animationRef.current = requestAnimationFrame(animateParticles);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  useEffect(() => {
    const active = isListening || isSpeaking;
    if (active) {
      intervalRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
        const intensity = isListening ? 100 : 75;
        setWaveformData(
          Array(28)
            .fill(0)
            .map(() => Math.random() * intensity)
        );
      }, 100);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setWaveformData(Array(28).fill(0));
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isListening, isSpeaking]);

  useEffect(() => {
    if (!demoMode) return;
    let cancelled = false;

    const sleep = (ms: number) =>
      new Promise<void>((resolve) => setTimeout(resolve, ms));

    const demoSequence = async () => {
      while (!cancelled) {
        setIsListening(true);
        setIsProcessing(false);
        setIsSpeaking(false);
        await sleep(3000);
        if (cancelled) return;

        setIsListening(false);
        setIsProcessing(true);
        await sleep(1800);
        if (cancelled) return;

        setIsProcessing(false);
        setIsSpeaking(true);
        await sleep(4000);
        if (cancelled) return;

        setIsSpeaking(false);
        setDuration(0);
        await sleep(1500);
      }
    };

    void demoSequence();
    return () => {
      cancelled = true;
    };
  }, [demoMode]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 10 / 60);
    const secs = Math.floor(seconds / 10) % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const getStatusText = () => {
    if (isListening) return "お話を聞いています…";
    if (isProcessing) return "考えています…";
    if (isSpeaking) return "お返事しています…";
    return "タップして話す";
  };

  const getStatusColor = () => {
    if (isListening) return "text-coral";
    if (isProcessing) return "text-warm-orange";
    if (isSpeaking) return "text-rose-500";
    return "text-warm-gray";
  };

  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center overflow-hidden rounded-3xl py-10",
        className
      )}
      aria-live="polite"
    >
      {/* Ambient particles */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {particles.map((particle) => (
          <motion.div
            key={particle.id}
            className="absolute rounded-full bg-coral/30"
            style={{
              left: particle.x,
              top: particle.y,
              width: particle.size,
              height: particle.size,
              opacity: particle.opacity,
            }}
            animate={{ scale: [1, 1.5, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          />
        ))}
      </div>

      {/* Background glow */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <motion.div
          className="h-72 w-72 rounded-full bg-gradient-to-br from-coral/30 via-rose-300/30 to-warm-orange/30 blur-3xl"
          animate={{
            scale: isListening ? [1, 1.25, 1] : [1, 1.1, 1],
            opacity: isListening || isSpeaking ? [0.5, 0.8, 0.5] : [0.3, 0.45, 0.3],
          }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      <div className="relative z-10 flex flex-col items-center space-y-7 px-6">
        {/* Main voice button */}
        <motion.div className="relative" whileTap={{ scale: 0.95 }}>
          <motion.button
            type="button"
            aria-label={getStatusText()}
            className={cn(
              "relative flex h-28 w-28 items-center justify-center rounded-full border-2 transition-colors duration-300",
              "bg-gradient-to-br from-white/80 to-white/40 backdrop-blur-sm",
              isListening &&
                "border-coral shadow-[0_0_40px_-5px_rgba(232,93,93,0.6)]",
              isProcessing &&
                "border-warm-orange shadow-[0_0_40px_-5px_rgba(255,138,101,0.6)]",
              isSpeaking &&
                "border-rose-400 shadow-[0_0_40px_-5px_rgba(245,163,163,0.7)]",
              !isListening &&
                !isProcessing &&
                !isSpeaking &&
                "border-rose-300/60"
            )}
            animate={{
              boxShadow: isListening
                ? [
                    "0 0 0 0 rgba(232,93,93,0.4)",
                    "0 0 0 18px rgba(232,93,93,0)",
                  ]
                : undefined,
            }}
            transition={{ duration: 1.5, repeat: isListening ? Infinity : 0 }}
          >
            <AnimatePresence mode="wait">
              {isProcessing ? (
                <motion.div
                  key="processing"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                >
                  <Loader2 className="h-10 w-10 animate-spin text-warm-orange" />
                </motion.div>
              ) : isSpeaking ? (
                <motion.div
                  key="speaking"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                >
                  <Volume2 className="h-10 w-10 text-rose-500" />
                </motion.div>
              ) : isListening ? (
                <motion.div
                  key="listening"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                >
                  <Mic className="h-10 w-10 text-coral" />
                </motion.div>
              ) : (
                <motion.div
                  key="idle"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                >
                  <Mic className="h-10 w-10 text-warm-gray" />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.button>

          <AnimatePresence>
            {isListening && (
              <>
                <motion.div
                  className="absolute inset-0 rounded-full border-2 border-coral/40"
                  initial={{ scale: 1, opacity: 0.6 }}
                  animate={{ scale: 1.5, opacity: 0 }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut" }}
                />
                <motion.div
                  className="absolute inset-0 rounded-full border-2 border-coral/25"
                  initial={{ scale: 1, opacity: 0.4 }}
                  animate={{ scale: 2, opacity: 0 }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    ease: "easeOut",
                    delay: 0.5,
                  }}
                />
              </>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Waveform */}
        <div className="flex h-14 items-center justify-center space-x-1">
          {waveformData.map((height, index) => (
            <motion.div
              key={index}
              className={cn(
                "w-1 rounded-full transition-colors duration-300",
                isListening && "bg-coral",
                isProcessing && "bg-warm-orange",
                isSpeaking && "bg-rose-400",
                !isListening &&
                  !isProcessing &&
                  !isSpeaking &&
                  "bg-rose-200"
              )}
              animate={{
                height: `${Math.max(4, height * 0.5)}px`,
                opacity: isListening || isSpeaking ? 1 : 0.4,
              }}
              transition={{ duration: 0.1, ease: "easeOut" }}
            />
          ))}
        </div>

        {/* Status + timer */}
        <div className="space-y-1.5 text-center">
          <motion.p
            className={cn(
              "text-base font-medium transition-colors",
              getStatusColor()
            )}
            animate={{ opacity: [1, 0.75, 1] }}
            transition={{
              duration: 2,
              repeat: isListening || isProcessing || isSpeaking ? Infinity : 0,
            }}
          >
            {getStatusText()}
          </motion.p>
          <p className="font-mono text-xs text-warm-gray/70">
            {formatTime(duration)}
          </p>
        </div>

        {/* AI badge */}
        <motion.div
          className="flex items-center space-x-1.5 text-xs text-warm-gray"
          animate={{ opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        >
          <Sparkles className="h-3.5 w-3.5 text-coral" />
          <span className="tracking-wider">カヨの声</span>
        </motion.div>
      </div>
    </div>
  );
}
