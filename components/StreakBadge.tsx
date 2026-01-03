import React, { useEffect, useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { cn } from './ui/Common';
import { useStreak } from '../lib/hooks';

interface StreakBadgeProps {
  userId?: string;
  autoCheckin?: boolean;
}

const StreakBadge: React.FC<StreakBadgeProps> = ({ userId, autoCheckin = true }) => {
  const { currentStreak, todayCheckedIn, isLoading, message } = useStreak({ autoCheckin, userId });

  const prevStreakRef = useRef<number | null>(null);
  const [isCelebrating, setIsCelebrating] = useState(false);

  useEffect(() => {
    const prev = prevStreakRef.current;
    prevStreakRef.current = currentStreak;
    if (todayCheckedIn && prev !== null && currentStreak > prev) {
      setIsCelebrating(true);
      const timer = window.setTimeout(() => setIsCelebrating(false), 650);
      return () => window.clearTimeout(timer);
    }
  }, [currentStreak, todayCheckedIn]);

  useEffect(() => {
    if (!message) return;
    setIsCelebrating(true);
    const timer = window.setTimeout(() => setIsCelebrating(false), 650);
    return () => window.clearTimeout(timer);
  }, [message]);

  if (isLoading) {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 rounded-full ring-1 ring-slate-200/60">
        <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
      </div>
    );
  }

  const getStreakStyle = () => {
    if (!todayCheckedIn) {
      return {
        containerClass: 'bg-slate-100 text-slate-500',
        glow: ''
      };
    }

    if (currentStreak >= 100) {
      return {
        containerClass: 'bg-linear-to-r from-violet-500 via-purple-500 to-fuchsia-500 text-white shadow-lg shadow-purple-300',
        glow: 'ring-2 ring-purple-300 ring-offset-1'
      };
    }

    if (currentStreak >= 30) {
      return {
        containerClass: 'bg-linear-to-r from-amber-400 via-orange-500 to-red-500 text-white shadow-md shadow-orange-200',
        glow: 'ring-2 ring-orange-200 ring-offset-1'
      };
    }

    if (currentStreak >= 14) {
      return {
        containerClass: 'bg-linear-to-r from-orange-400 to-red-500 text-white shadow-md shadow-red-100',
        glow: ''
      };
    }

    if (currentStreak >= 7) {
      return {
        containerClass: 'bg-linear-to-r from-yellow-400 to-orange-500 text-white shadow-sm',
        glow: ''
      };
    }

    if (currentStreak >= 3) {
      return {
        containerClass: 'bg-linear-to-r from-emerald-400 to-teal-500 text-white',
        glow: ''
      };
    }

    return {
      containerClass: 'bg-linear-to-r from-green-400 to-emerald-500 text-white',
      glow: ''
    };
  };

  const style = getStreakStyle();

  return (
    <NavLink
      to="/profile"
      className={cn(
        'group relative inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold tabular-nums',
        'ring-1 ring-inset transition-all duration-200',
        'hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 active:shadow-sm',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
        todayCheckedIn ? 'ring-white/25 overflow-hidden' : 'ring-slate-200/70',
        style.containerClass,
        style.glow,
      )}
      title={`Chuỗi học tập: ${currentStreak} ngày${todayCheckedIn ? ' ✓' : ''}`}
    >
      {todayCheckedIn && currentStreak >= 3 && (
        <span
          className="pointer-events-none absolute inset-y-0 left-0 w-[42%] bg-linear-to-r from-white/0 via-white/45 to-white/0 opacity-35 animate-streak-shine"
          aria-hidden="true"
        />
      )}

      <span className={cn('relative grid place-items-center w-6 h-6 overflow-visible')} aria-hidden="true">
        {todayCheckedIn ? (
          <>
            <img
              src="/streak/flame-tight.gif"
              className="streak-motion w-[150%] h-[150%] -translate-y-[18%] object-contain mix-blend-screen brightness-110 saturate-150 contrast-125 drop-shadow-[0_3px_10px_rgba(0,0,0,0.25)]"
              alt=""
              aria-hidden="true"
            />
            <img
              src="/streak/flame-tight.png"
              className="streak-reduce-motion w-[150%] h-[150%] -translate-y-[18%] object-contain mix-blend-screen brightness-110 saturate-150 contrast-125 drop-shadow-[0_3px_10px_rgba(0,0,0,0.25)]"
              alt=""
              aria-hidden="true"
            />
          </>
        ) : (
          <img
            src="/streak/flame-tight.png"
            className="w-[150%] h-[150%] -translate-y-[18%] object-contain mix-blend-screen opacity-60 grayscale"
            alt=""
            aria-hidden="true"
          />
        )}
      </span>

      <span className={cn('relative font-extrabold leading-none', isCelebrating ? 'animate-streak-pop' : '')}>
        {currentStreak}
      </span>

      {currentStreak >= 30 && todayCheckedIn && (
        <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5" aria-hidden="true">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white/80 opacity-50"></span>
          <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-white/70"></span>
        </span>
      )}
    </NavLink>
  );
};

export default StreakBadge;
