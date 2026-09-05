"use client";

import React, { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';

interface LoadingScreenProps {
  isAppReady: boolean;
  onFinished: () => void;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({
  isAppReady,
  onFinished,
}) => {
  const [progress, setProgress] = useState<number>(0);

  // References to animated elements
  const containerRef = useRef<HTMLDivElement>(null);
  const loadingUiRef = useRef<HTMLDivElement>(null);
  const heroContainerRef = useRef<HTMLDivElement>(null);
  const logoWrapperRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const baseTextRef = useRef<HTMLDivElement>(null);
  const shimmerTextRef = useRef<HTMLDivElement>(null);
  const lightStreakRef = useRef<HTMLDivElement>(null);
  const bloomOverlayRef = useRef<HTMLDivElement>(null);
  const ambientBlobsRef = useRef<HTMLDivElement>(null);
  const radialStreaksRef = useRef<HTMLDivElement>(null);

  // Animation & timing refs
  const startTimeRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const isCinematicStartedRef = useRef<boolean>(false);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);
  const isAppReadyRef = useRef<boolean>(isAppReady);

  // Keep isAppReadyRef in sync with latest prop
  useEffect(() => {
    isAppReadyRef.current = isAppReady;
  }, [isAppReady]);

  // Helper to instantly unlock user interactivity and scroll
  const unlockInteraction = () => {
    if (containerRef.current) {
      containerRef.current.style.pointerEvents = 'none';
    }
    document.body.style.overflow = '';
    document.body.style.touchAction = '';
  };

  // Lock body scroll while loader is visible, unlock on cleanup
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    const originalTouchAction = document.body.style.touchAction;
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.touchAction = originalTouchAction;
      timelineRef.current?.kill();
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // ── Cinematic 3D "Logo Rushing Toward Camera" Sequence ──
  const startCinematicSequence = () => {
    if (!containerRef.current) {
      unlockInteraction();
      onFinished();
      return;
    }

    timelineRef.current?.kill();

    const masterTl = gsap.timeline({
      onComplete: () => {
        unlockInteraction();
        onFinished();
      },
    });
    timelineRef.current = masterTl;

    // 1. Remove/fade the loading text and progress bar smoothly (~0.18s)
    masterTl.to(
      loadingUiRef.current,
      {
        opacity: 0,
        scale: 0.92,
        duration: 0.18,
        ease: 'power2.out',
      },
      0
    );

    // 2. Camera forward rush into the centered VRGC logo (0.65s flight)
    // 0.00s → logo centered and crisp
    // 0.15s → forward acceleration begins
    // 0.40s → noticeably closer and rapidly picking up speed
    // 0.60s → letters rush completely past the camera
    // GPU optimized: scale: 36 + z: 850 with power3.in gives an explosive streaming intro feel
    // without exceeding GL max texture dimensions or freezing GPU rasterizer threads.
    masterTl.to(
      logoWrapperRef.current,
      {
        scale: 36,
        z: 850,
        duration: 0.65,
        ease: 'power3.in',
        transformOrigin: '50% 50%',
        force3D: true,
      },
      0.15
    );

    // Subtle 3D optical separation of foreground shimmer stroke from base stroke
    if (shimmerTextRef.current) {
      masterTl.to(
        shimmerTextRef.current,
        {
          z: 32,
          duration: 0.45,
          ease: 'power2.in',
        },
        0.15
      );
    }

    // Purple neon glow expands and intensifies as the logo approaches, then cleanly dissolves
    if (glowRef.current) {
      masterTl.to(
        glowRef.current,
        {
          scale: 2.4,
          opacity: 0.8,
          duration: 0.42,
          ease: 'power2.in',
        },
        0.15
      );
      masterTl.to(
        glowRef.current,
        {
          opacity: 0,
          duration: 0.20,
          ease: 'power2.out',
        },
        0.55
      );
    }

    if (bloomOverlayRef.current) {
      masterTl.to(
        bloomOverlayRef.current,
        {
          opacity: 0.6,
          scale: 1.8,
          duration: 0.40,
          ease: 'power2.in',
        },
        0.18
      );
      masterTl.to(
        bloomOverlayRef.current,
        {
          opacity: 0,
          duration: 0.20,
          ease: 'power2.out',
        },
        0.55
      );
    }

    // High-speed radial light streaks toward the edges during final acceleration (0.42s to 0.70s)
    if (radialStreaksRef.current) {
      masterTl.to(
        radialStreaksRef.current,
        {
          opacity: 0.75,
          scale: 1.35,
          duration: 0.18,
          ease: 'power2.in',
        },
        0.42
      );

      masterTl.to(
        radialStreaksRef.current,
        {
          opacity: 0,
          scale: 1.85,
          duration: 0.15,
          ease: 'power2.out',
        },
        0.60
      );
    }

    // Fade out ambient background blobs as velocity peaks
    if (ambientBlobsRef.current) {
      masterTl.to(
        ambientBlobsRef.current,
        {
          opacity: 0,
          duration: 0.30,
          ease: 'power2.out',
        },
        0.35
      );
    }

    // Fade out logo wrapper at peak speed so it doesn't linger in GPU memory
    if (logoWrapperRef.current) {
      masterTl.to(
        logoWrapperRef.current,
        {
          opacity: 0,
          duration: 0.18,
          ease: 'power2.out',
        },
        0.58
      );
    }

    // INSTANT INTERACTION UNLOCK:
    // The very millisecond the container begins fading to reveal the page, immediately unlock
    // pointer-events and clear the scroll lock so there is ZERO click or scroll freeze!
    masterTl.call(unlockInteraction, [], 0.58);

    // Reveal the homepage naturally as the letters fly completely past the camera
    if (containerRef.current) {
      masterTl.to(
        containerRef.current,
        {
          opacity: 0,
          duration: 0.20,
          ease: 'power2.out',
        },
        0.58
      );
    }
  };

  // ── Phase 1: Smooth 0% → 100% Progress Loop with App Readiness Sync ──
  useEffect(() => {
    const TOTAL_LOAD_TIME = 1800; // 1.8 seconds smooth base progression
    const MAX_WAIT_TIME = 3500; // Safety timeout for slow connections

    const updateProgress = (currentTime: number) => {
      if (!startTimeRef.current) {
        startTimeRef.current = currentTime;
      }

      const elapsed = currentTime - startTimeRef.current;
      const isReady = isAppReadyRef.current || elapsed >= MAX_WAIT_TIME;

      let currentVal: number;

      if (!isReady && elapsed >= TOTAL_LOAD_TIME * 0.9) {
        // App is still fetching initial auth/data; smoothly glide between 90% and 98%
        const extraTime = elapsed - (TOTAL_LOAD_TIME * 0.9);
        const waitProgress = Math.min(8, (extraTime / 1500) * 8);
        currentVal = 90 + waitProgress;
      } else {
        const t = Math.min(1, elapsed / TOTAL_LOAD_TIME);
        const ease = 1 - Math.pow(1 - t, 2.4);
        currentVal = Math.min(100, ease * 100);
      }

      setProgress(currentVal);

      if (currentVal >= 99.5 && isReady) {
        setProgress(100);
        if (!isCinematicStartedRef.current) {
          isCinematicStartedRef.current = true;
          // Hold at 100% for 160ms before triggering cinematic forward camera rush
          setTimeout(() => {
            startCinematicSequence();
          }, 160);
        }
        return;
      }

      animationFrameRef.current = requestAnimationFrame(updateProgress);
    };

    animationFrameRef.current = requestAnimationFrame(updateProgress);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[9999] bg-[#03010A] flex flex-col items-center justify-center select-none overflow-hidden touch-none"
      style={{ willChange: 'opacity', perspective: '1000px', perspectiveOrigin: '50% 50%' }}
    >
      {/* Cinematic High-Speed Radial Warp Streaks */}
      <div
        ref={radialStreaksRef}
        className="absolute inset-0 pointer-events-none opacity-0 flex items-center justify-center overflow-hidden z-20"
        style={{ willChange: 'transform, opacity' }}
      >
        <div className="absolute w-[180vw] h-[180vh] bg-[radial-gradient(circle_at_center,transparent_35%,rgba(168,85,247,0.12)_65%,rgba(147,51,234,0.25)_85%,rgba(3,1,10,0.95)_100%)]" />
        <svg className="absolute w-full h-full" viewBox="0 0 1000 1000" preserveAspectRatio="none">
          <defs>
            <linearGradient id="warpStreakGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#c084fc" stopOpacity="0" />
              <stop offset="50%" stopColor="#e879f9" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0.8" />
            </linearGradient>
          </defs>
          {Array.from({ length: 32 }).map((_, i) => {
            const angle = (i * 360) / 32;
            const rad = (angle * Math.PI) / 180;
            return (
              <line
                key={i}
                x1={500 + Math.cos(rad) * 100}
                y1={500 + Math.sin(rad) * 100}
                x2={500 + Math.cos(rad) * 750}
                y2={500 + Math.sin(rad) * 750}
                stroke="url(#warpStreakGrad)"
                strokeWidth={i % 3 === 0 ? "2.5" : "1.2"}
                strokeDasharray="60 140"
                opacity="0.6"
              />
            );
          })}
        </svg>
      </div>
      {/* Ambient floating blurred purple abstract shapes & tech grid */}
      <div
        ref={ambientBlobsRef}
        className="absolute inset-0 pointer-events-none overflow-hidden"
        style={{ willChange: 'transform, opacity' }}
      >
        {/* Top-left deep purple ambient glow */}
        <div className="absolute -top-32 -left-32 w-96 sm:w-[500px] h-96 sm:h-[500px] rounded-full bg-purple-900/20 blur-[100px]" />
        {/* Bottom-right violet ambient glow */}
        <div className="absolute -bottom-32 -right-32 w-96 sm:w-[500px] h-96 sm:h-[500px] rounded-full bg-purple-600/15 blur-[120px]" />
        {/* Center ambient glow sphere */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[450px] sm:w-[650px] h-[450px] sm:h-[650px] rounded-full bg-purple-800/10 blur-[140px]" />
        {/* Tech Grid */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(147,51,234,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(147,51,234,0.03)_1px,transparent_1px)] bg-[size:32px_32px]" />
      </div>



      {/* Main Content Center — Perfectly Centered in Viewport */}
      <div className="relative z-10 flex flex-col items-center justify-center w-full h-full pointer-events-none" style={{ transformStyle: 'preserve-3d' }}>
        {/* 3D Perspective Hero Container for VRGC Logo (Positioned at exact center of screen) */}
        <div
          ref={heroContainerRef}
          className="relative flex items-center justify-center pointer-events-auto"
          style={{ transformStyle: 'preserve-3d', perspective: '1000px', perspectiveOrigin: '50% 50%' }}
        >
          {/* Ambient Solid Glow under logo */}
          <div
            ref={glowRef}
            className="absolute -inset-6 sm:-inset-8 bg-purple-600/20 rounded-full blur-2xl sm:blur-3xl pointer-events-none"
            style={{ willChange: 'transform, opacity' }}
          />

          {/* Central expanding purple bloom overlay */}
          <div
            ref={bloomOverlayRef}
            className="absolute -inset-32 sm:-inset-48 bg-[radial-gradient(circle_at_center,rgba(168,85,247,0.45)_0%,rgba(14,5,24,0.92)_55%,rgba(3,1,10,1)_85%)] rounded-full blur-2xl pointer-events-none opacity-0"
            style={{ willChange: 'transform, opacity' }}
          />

          {/* Scaling Logo Wrapper with 3D Depth Layers */}
          <div
            ref={logoWrapperRef}
            className="relative w-72 h-24 sm:w-88 sm:h-28 flex items-center justify-center"
            style={{ transformStyle: 'preserve-3d', willChange: 'transform, opacity' }}
          >
            {/* Layer 1: Base Dark Neon Outline */}
            <div
              ref={baseTextRef}
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
              style={{ transformStyle: 'preserve-3d', willChange: 'transform' }}
            >
              <svg viewBox="0 0 320 100" className="w-full h-full overflow-visible">
                <text
                  x="50%"
                  y="68%"
                  textAnchor="middle"
                  fill="none"
                  stroke="#3b0764"
                  strokeWidth="6"
                  strokeLinejoin="round"
                  fontFamily="system-ui, -apple-system, sans-serif"
                  fontWeight="900"
                  fontSize="78"
                  letterSpacing="10"
                >
                  VRGC
                </text>
              </svg>
            </div>

            {/* Layer 2: Shimmering Animated Foreground Stroke */}
            <div
              ref={shimmerTextRef}
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
              style={{ transformStyle: 'preserve-3d', willChange: 'transform' }}
            >
              <svg viewBox="0 0 320 100" className="w-full h-full overflow-visible">
                <defs>
                  {/* Laser Shimmer Gradient that sweeps across the letters */}
                  <linearGradient id="vrgcShimmer" x1="-100%" y1="0%" x2="200%" y2="0%">
                    <stop offset="0%" stopColor="#9333ea" stopOpacity="0.4" />
                    <stop offset="35%" stopColor="#a855f7" stopOpacity="0.8" />
                    <stop offset="50%" stopColor="#ffffff" stopOpacity="1" />
                    <stop offset="65%" stopColor="#a855f7" stopOpacity="0.8" />
                    <stop offset="100%" stopColor="#9333ea" stopOpacity="0.4" />
                    <animate
                      attributeName="x1"
                      from="-100%"
                      to="100%"
                      dur="2.2s"
                      repeatCount="indefinite"
                    />
                    <animate
                      attributeName="x2"
                      from="0%"
                      to="200%"
                      dur="2.2s"
                      repeatCount="indefinite"
                    />
                  </linearGradient>

                  {/* Outer Glow Filter */}
                  <filter id="neonGlow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#a855f7" floodOpacity="0.7" />
                  </filter>
                </defs>

                <text
                  x="50%"
                  y="68%"
                  textAnchor="middle"
                  fill="none"
                  stroke="url(#vrgcShimmer)"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  filter="url(#neonGlow)"
                  fontFamily="system-ui, -apple-system, sans-serif"
                  fontWeight="900"
                  fontSize="78"
                  letterSpacing="10"
                >
                  VRGC
                </text>
              </svg>
            </div>

            {/* Layer 3: Final Shimmer Light Pass Streak */}
            <div
              ref={lightStreakRef}
              className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-0"
              style={{ willChange: 'transform, opacity' }}
            >
              <div className="w-full h-[2px] bg-gradient-to-r from-transparent via-white to-transparent shadow-[0_0_15px_#ffffff] blur-[0.5px]" />
            </div>
          </div>
        </div>

        {/* Loading Track & Subtitle Details (Positioned comfortably below the centered logo) */}
        <div
          ref={loadingUiRef}
          className="absolute top-[calc(50%+68px)] sm:top-[calc(50%+78px)] left-1/2 -translate-x-1/2 w-56 sm:w-64 space-y-3 text-center transition-opacity duration-300 pointer-events-auto"
          style={{ willChange: 'transform, opacity' }}
        >
          {/* Smooth 0% -> 100% Progress Bar */}
          <div className="w-full h-1 bg-[#1a0f2b] rounded-full overflow-hidden relative border border-purple-900/50">
            <div
              className="h-full bg-gradient-to-r from-purple-600 via-purple-400 to-white rounded-full shadow-[0_0_12px_#a855f7] relative transition-none"
              style={{
                width: `${Math.min(100, Math.max(0, progress))}%`,
                willChange: 'width',
              }}
            >
              {/* Active inner laser sweep */}
              <div className="absolute inset-0 bg-white/40 animate-shimmer-laser rounded-full" />
            </div>
          </div>

          <div className="space-y-1">
            <span className="font-label-caps text-[11px] font-black text-white tracking-[0.25em] block">
              VIRTUAL REALITY &amp; GAMING CLUB
            </span>
            <span className="font-mono text-[9px] text-purple-400 font-semibold tracking-widest block uppercase animate-pulse">
              INITIALIZING PROTOCOLS...
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoadingScreen;
