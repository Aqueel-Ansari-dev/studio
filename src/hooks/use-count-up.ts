
"use client";

import { useState, useEffect } from 'react';

/**
 * A custom hook to animate a number counting up from 0 to a target value.
 * @param end - The final number to count up to.
 * @param duration - The duration of the animation in milliseconds.
 * @returns The current value of the count during the animation.
 */
export function useCountUp(end: number, duration: number = 1500): number {
  const [count, setCount] = useState(0);
  const frameRate = 1000 / 60; // 60fps
  const totalFrames = Math.round(duration / frameRate);

  useEffect(() => {
    let frame = 0;
    const counter = setInterval(() => {
      frame++;
      const progress = frame / totalFrames;
      const currentCount = Math.round(end * progress);
      setCount(currentCount);

      if (frame === totalFrames) {
        clearInterval(counter);
        setCount(end); // Ensure it ends on the exact value
      }
    }, frameRate);

    return () => {
      clearInterval(counter);
    };
  }, [end, duration, totalFrames, frameRate]);

  return count;
}
