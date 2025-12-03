import React, { useState, useEffect, useRef, memo } from 'react';
import { cn } from './ui/Common';

interface OptimizedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
    src: string;
    alt: string;
    fallback?: string;
    placeholderColor?: string;
    aspectRatio?: 'video' | 'square' | 'portrait' | 'auto';
    lazy?: boolean;
    onLoadComplete?: () => void;
}

// Default placeholder - small base64 gray image
const DEFAULT_PLACEHOLDER = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZTJlOGYwIi8+PC9zdmc+';

// Generate fallback URL from seed
const generateFallback = (seed: string, width = 400, height = 300): string => {
    return `https://picsum.photos/seed/${seed}/${width}/${height}`;
};

const OptimizedImage: React.FC<OptimizedImageProps> = memo(({
    src,
    alt,
    fallback,
    placeholderColor = 'bg-slate-200',
    aspectRatio = 'auto',
    lazy = true,
    className,
    onLoadComplete,
    ...props
}) => {
    const [isLoaded, setIsLoaded] = useState(false);
    const [isError, setIsError] = useState(false);
    const [isInView, setIsInView] = useState(!lazy);
    const imgRef = useRef<HTMLImageElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Intersection Observer for lazy loading
    useEffect(() => {
        if (!lazy || isInView) return;

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        setIsInView(true);
                        observer.disconnect();
                    }
                });
            },
            {
                rootMargin: '100px', // Start loading 100px before entering viewport
                threshold: 0.01,
            }
        );

        if (containerRef.current) {
            observer.observe(containerRef.current);
        }

        return () => observer.disconnect();
    }, [lazy, isInView]);

    // Handle image load
    const handleLoad = () => {
        setIsLoaded(true);
        setIsError(false);
        onLoadComplete?.();
    };

    // Handle image error
    const handleError = () => {
        setIsError(true);
        setIsLoaded(true);
    };

    // Determine the actual source to use
    const actualSrc = isError && fallback ? fallback : src;
    const displaySrc = isInView ? actualSrc : DEFAULT_PLACEHOLDER;

    // Aspect ratio classes
    const aspectClasses = {
        video: 'aspect-video',
        square: 'aspect-square',
        portrait: 'aspect-[3/4]',
        auto: '',
    };

    return (
        <div
            ref={containerRef}
            className={cn(
                'relative overflow-hidden',
                aspectClasses[aspectRatio],
                !isLoaded && placeholderColor,
                className
            )}
        >
            {/* Placeholder shimmer effect */}
            {!isLoaded && (
                <div className="absolute inset-0 bg-linear-to-r from-slate-200 via-slate-100 to-slate-200 animate-pulse" />
            )}

            {/* Actual image */}
            <img
                ref={imgRef}
                src={displaySrc}
                alt={alt}
                loading={lazy ? 'lazy' : 'eager'}
                decoding="async"
                onLoad={handleLoad}
                onError={handleError}
                className={cn(
                    'w-full h-full object-cover transition-opacity duration-300',
                    isLoaded ? 'opacity-100' : 'opacity-0'
                )}
                {...props}
            />
        </div>
    );
});

OptimizedImage.displayName = 'OptimizedImage';

// ============ AVATAR IMAGE ============
interface AvatarImageProps {
    src?: string;
    name?: string;
    size?: 'sm' | 'md' | 'lg' | 'xl';
    className?: string;
}

export const AvatarImage: React.FC<AvatarImageProps> = memo(({
    src,
    name = 'User',
    size = 'md',
    className,
}) => {
    const [isError, setIsError] = useState(false);

    const sizeClasses = {
        sm: 'w-8 h-8 text-xs',
        md: 'w-10 h-10 text-sm',
        lg: 'w-12 h-12 text-base',
        xl: 'w-16 h-16 text-lg',
    };

    // Generate initials from name
    const initials = name
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);

    // Generate consistent color from name
    const colors = [
        'bg-primary-500',
        'bg-emerald-500',
        'bg-blue-500',
        'bg-purple-500',
        'bg-orange-500',
        'bg-pink-500',
    ];
    const colorIndex = name.charCodeAt(0) % colors.length;

    if (!src || isError) {
        return (
            <div
                className={cn(
                    'flex items-center justify-center rounded-full text-white font-medium',
                    sizeClasses[size],
                    colors[colorIndex],
                    className
                )}
            >
                {initials}
            </div>
        );
    }

    return (
        <img
            src={src}
            alt={name}
            onError={() => setIsError(true)}
            className={cn(
                'rounded-full object-cover',
                sizeClasses[size],
                className
            )}
            loading="lazy"
        />
    );
});

AvatarImage.displayName = 'AvatarImage';

// ============ THUMBNAIL IMAGE ============
interface ThumbnailProps {
    src?: string;
    alt: string;
    seed?: string;
    className?: string;
}

export const Thumbnail: React.FC<ThumbnailProps> = memo(({
    src,
    alt,
    seed,
    className,
}) => {
    const fallbackSrc = seed ? generateFallback(seed, 600, 400) : DEFAULT_PLACEHOLDER;

    return (
        <OptimizedImage
            src={src || fallbackSrc}
            alt={alt}
            fallback={fallbackSrc}
            aspectRatio="video"
            className={cn('w-full', className)}
        />
    );
});

Thumbnail.displayName = 'Thumbnail';

export default OptimizedImage;
