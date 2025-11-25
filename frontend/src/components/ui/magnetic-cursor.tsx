import React, { useRef, useEffect, FC, ReactNode, useState } from 'react';

import gsap from 'gsap';

import { vec2 } from 'vecteur';

// Animation constants

const ANIMATION_CONSTANTS = {

  SPEED_MULTIPLIER: 0.04,

  MAX_SCALE_X: 1,

  MAX_SCALE_Y: 0.3,

  ATTACH_DURATION: 0.6,

  DETACH_DURATION: 0.5,

  CURSOR_DEFAULT_SIZE: 24,

};

interface MagneticCursorProps {

  children: ReactNode;

  lerpAmount?: number;

  magneticFactor?: number;

  hoverPadding?: number;

  hoverAttribute?: string;

  cursorSize?: number;

  cursorColor?: string;

  blendMode?: string;

  cursorClassName?: string;

  shape?: 'circle' | 'square' | 'rounded-square';

  disableOnTouch?: boolean;

}

type Vec2Instance = ReturnType<typeof vec2>;

interface CursorState {

  el: HTMLDivElement | null;

  pos: {

    current: Vec2Instance;

    target: Vec2Instance;

    previous: Vec2Instance;

  };

  hover: { isHovered: boolean };

}

export const MagneticCursor: FC<MagneticCursorProps> = ({

  children,

  lerpAmount = 0.1,

  magneticFactor = 0.2,

  hoverPadding = 8,

  hoverAttribute = 'data-magnetic',

  cursorSize = ANIMATION_CONSTANTS.CURSOR_DEFAULT_SIZE,

  cursorColor = 'white',

  blendMode = 'difference',

  cursorClassName = '',

  shape = 'circle',

  disableOnTouch = true,

}) => {

  const cursorRef = useRef<HTMLDivElement>(null);

  const cursorStateRef = useRef<CursorState | null>(null);

  const [isTouchDevice, setIsTouchDevice] = useState(false);

  // Check for touch device

  useEffect(() => {

    const checkTouch = () => {

      setIsTouchDevice('ontouchstart' in window || navigator.maxTouchPoints > 0);

    };

    checkTouch();

  }, []);

  // Early return if touch device

  if (disableOnTouch && isTouchDevice) {

    return <>{children}</>;

  }

  useEffect(() => {

    const cursorEl = cursorRef.current;

    if (!cursorEl) return;

    // Check for reduced motion preference

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const effectiveLerpAmount = prefersReducedMotion ? 1 : lerpAmount;

    const animationDuration = prefersReducedMotion ? 0.1 : 0.4;

    const detachDuration = prefersReducedMotion ? 0.1 : 0.4;

    if (!cursorStateRef.current) {

      cursorStateRef.current = {

        el: cursorEl,

        pos: {

          current: vec2(-100, -100),

          target: vec2(-100, -100),

          previous: vec2(-100, -100),

        },

        hover: { isHovered: false },

      };

    }

    const update = () => {

      const state = cursorStateRef.current;

      if (!state || state.hover.isHovered) return;

      state.pos.current.lerp(state.pos.target, effectiveLerpAmount);

      const delta = state.pos.current.clone().sub(state.pos.previous);

      state.pos.previous.copy(state.pos.current);

      const speed = Math.sqrt(delta.x * delta.x + delta.y * delta.y) * ANIMATION_CONSTANTS.SPEED_MULTIPLIER;

      gsap.set(state.el, {

        x: state.pos.current.x,

        y: state.pos.current.y,

        rotate: Math.atan2(delta.y, delta.x) * (180 / Math.PI),

        scaleX: 1 + Math.min(speed, ANIMATION_CONSTANTS.MAX_SCALE_X),

        scaleY: 1 - Math.min(speed, ANIMATION_CONSTANTS.MAX_SCALE_Y),

      });

    };

    // Initialize position on first mouse move

    const initializePosition = (event: MouseEvent) => {

      const state = cursorStateRef.current;

      if (!state) return;

      const x = event.clientX - cursorSize / 2;

      const y = event.clientY - cursorSize / 2;

      state.pos.current.x = x;

      state.pos.current.y = y;

      state.pos.target.x = x;

      state.pos.target.y = y;

      state.pos.previous.x = x;

      state.pos.previous.y = y;

      gsap.set(cursorEl, { x, y, opacity: 1 });

    };

    const onMouseMove = (event: PointerEvent) => {

      const state = cursorStateRef.current;

      if (!state) return;

      // Check if cursor is within viewport

      const isInViewport =

        event.clientX >= 0 &&

        event.clientX <= window.innerWidth &&

        event.clientY >= 0 &&

        event.clientY <= window.innerHeight;

      if (isInViewport) {

        state.pos.target.x = event.clientX - cursorSize / 2;

        state.pos.target.y = event.clientY - cursorSize / 2;

        gsap.to(cursorEl, { opacity: 1, duration: 0.2 });

      } else {

        gsap.to(cursorEl, { opacity: 0, duration: 0.2 });

      }

      // Text selection feedback

      const target = event.target as HTMLElement;

      const isTextContent =

        target.tagName === 'P' ||

        target.tagName === 'SPAN' ||

        target.tagName === 'H1' ||

        target.tagName === 'H2' ||

        target.tagName === 'H3' ||

        target.tagName === 'H4' ||

        target.tagName === 'H5' ||

        target.tagName === 'H6' ||

        window.getComputedStyle(target).cursor === 'text';

      if (isTextContent && !state.hover.isHovered) {

        gsap.to(cursorEl, {

          scaleX: 0.5,

          scaleY: 1.5,

          duration: 0.3,

        });

      }

    };

    // Hide cursor when mouse leaves window

    const handleMouseLeave = () => {

      gsap.to(cursorEl, { opacity: 0, duration: 0.3 });

    };

    const handleMouseEnter = () => {

      gsap.to(cursorEl, { opacity: 1, duration: 0.3 });

    };

    // Particle effect on click

    const createParticles = (x: number, y: number) => {

      const particleCount = 8;

      for (let i = 0; i < particleCount; i++) {

        const particle = document.createElement('div');

        particle.className = 'cursor-particle';

        particle.style.cssText = `

          position: fixed;

          width: 4px;

          height: 4px;

          background: ${cursorColor};

          border-radius: 50%;

          pointer-events: none;

          z-index: 9998;

        `;

        document.body.appendChild(particle);

        const angle = (Math.PI * 2 * i) / particleCount;

        const velocity = 50 + Math.random() * 50;

        gsap.fromTo(

          particle,

          { x, y, opacity: 1 },

          {

            x: x + Math.cos(angle) * velocity,

            y: y + Math.sin(angle) * velocity,

            opacity: 0,

            duration: 0.6,

            ease: 'power2.out',

            onComplete: () => particle.remove(),

          }

        );

      }

    };

    const handleClick = (event: MouseEvent) => {

      createParticles(event.clientX, event.clientY);

    };

    gsap.ticker.add(update);

    window.addEventListener('pointermove', onMouseMove);

    window.addEventListener('pointermove', initializePosition, { once: true });

    document.addEventListener('mouseleave', handleMouseLeave);

    document.addEventListener('mouseenter', handleMouseEnter);

    window.addEventListener('click', handleClick);

    // Cleanup functions array

    const cleanupFunctions: (() => void)[] = [];

    const magneticElements = gsap.utils.toArray<HTMLElement>(`[${hoverAttribute}]`);

    magneticElements.forEach((el) => {

      const xTo = gsap.quickTo(el, 'x', { duration: 1, ease: 'elastic.out(1, 0.3)' });

      const yTo = gsap.quickTo(el, 'y', { duration: 1, ease: 'elastic.out(1, 0.3)' });

      const handlePointerEnter = () => {

        const state = cursorStateRef.current;

        if (!state) return;

        state.hover.isHovered = true;

        const bounds = el.getBoundingClientRect();

        const computedStyle = window.getComputedStyle(el);

        // Get custom color if specified

        const magneticColor = el.getAttribute('data-magnetic-color') || cursorColor;

        gsap.killTweensOf(cursorEl);

        gsap.to(cursorEl, {

          x: bounds.left - hoverPadding,

          y: bounds.top - hoverPadding,

          width: bounds.width + hoverPadding * 2,

          height: bounds.height + hoverPadding * 2,

          borderRadius: computedStyle.borderRadius,

          backgroundColor: magneticColor,

          scaleX: 1,

          scaleY: 1,

          rotate: 0,

          duration: animationDuration,

          ease: 'power3.out',

        });

      };

      const handlePointerLeave = () => {

        const state = cursorStateRef.current;

        if (!state) return;

        state.hover.isHovered = false;

        const shapeBorderRadius =

          shape === 'circle' ? '50%' : shape === 'square' ? '0' : '8px';

        gsap.killTweensOf(cursorEl);

        gsap.to(cursorEl, {

          x: state.pos.target.x,

          y: state.pos.target.y,

          width: cursorSize,

          height: cursorSize,

          borderRadius: shapeBorderRadius,

          backgroundColor: cursorColor,

          duration: detachDuration,

          ease: 'power3.out',

        });

      };

      let rafId: number | null = null;

      const handlePointerMove = (event: PointerEvent) => {

        if (rafId) return;

        rafId = requestAnimationFrame(() => {

          const { clientX, clientY } = event;

          const { height, width, left, top } = el.getBoundingClientRect();

          xTo((clientX - (left + width / 2)) * magneticFactor);

          yTo((clientY - (top + height / 2)) * magneticFactor);

          rafId = null;

        });

      };

      const handlePointerOut = () => {

        xTo(0);

        yTo(0);

      };

      el.addEventListener('pointerenter', handlePointerEnter);

      el.addEventListener('pointerleave', handlePointerLeave);

      el.addEventListener('pointermove', handlePointerMove);

      el.addEventListener('pointerout', handlePointerOut);

      cleanupFunctions.push(() => {

        el.removeEventListener('pointerenter', handlePointerEnter);

        el.removeEventListener('pointerleave', handlePointerLeave);

        el.removeEventListener('pointermove', handlePointerMove);

        el.removeEventListener('pointerout', handlePointerOut);

      });

    });

    return () => {

      gsap.ticker.remove(update);

      window.removeEventListener('pointermove', onMouseMove);

      document.removeEventListener('mouseleave', handleMouseLeave);

      document.removeEventListener('mouseenter', handleMouseEnter);

      window.removeEventListener('click', handleClick);

      cleanupFunctions.forEach((cleanup) => cleanup());

    };

  }, [lerpAmount, magneticFactor, hoverPadding, hoverAttribute, cursorSize, cursorColor, shape]);

  return (

    <>

      <div

        ref={cursorRef}

        className={`magnetic-cursor ${cursorClassName}`}

        style={{

          backgroundColor: cursorColor,

          mixBlendMode: blendMode as any,

          width: cursorSize,

          height: cursorSize,

        }}

      />

      {children}

    </>

  );

};
