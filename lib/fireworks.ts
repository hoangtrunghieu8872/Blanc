type ConfettiFn = (options?: Record<string, unknown>) => void;

function randomInRange(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

export async function fireFireworks() {
  const mod = await import('canvas-confetti');
  const confetti: ConfettiFn = (mod as any).default || (mod as any);

  const durationMs = 1200;
  const animationEnd = Date.now() + durationMs;
  const defaults = {
    startVelocity: 30,
    spread: 360,
    ticks: 60,
    zIndex: 9999,
  };

  return new Promise<void>((resolve) => {
    const interval = window.setInterval(() => {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        window.clearInterval(interval);
        resolve();
        return;
      }

      const particleCount = Math.round(50 * (timeLeft / durationMs));

      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
      });
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
      });
    }, 200);
  });
}

