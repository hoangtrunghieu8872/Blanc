// ============ API CACHE SYSTEM ============
// Cache data in memory với expiration time

// Storage versioning (invalidate cache across deploys/builds)
// Vite injects __APP_VERSION__ via vite.config.ts; fallback to env/mode for dev.
declare const __APP_VERSION__: string | undefined;
const STORAGE_VERSION =
    (typeof __APP_VERSION__ !== 'undefined' && __APP_VERSION__) ||
    (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.MODE) ||
    'dev';

interface CacheEntry<T> {
    data: T;
    timestamp: number;
    expiresAt: number;
}

class APICache {
    private cache: Map<string, CacheEntry<unknown>> = new Map();
    private defaultTTL: number = 5 * 60 * 1000; // 5 minutes default

    // Get cached data
    get<T>(key: string): T | null {
        const entry = this.cache.get(key) as CacheEntry<T> | undefined;

        if (!entry) return null;

        // Check if expired
        if (Date.now() > entry.expiresAt) {
            this.cache.delete(key);
            return null;
        }

        return entry.data;
    }

    // Set cache data
    set<T>(key: string, data: T, ttl?: number): void {
        const now = Date.now();
        this.cache.set(key, {
            data,
            timestamp: now,
            expiresAt: now + (ttl || this.defaultTTL),
        });
    }

    // Check if cache exists and is valid
    has(key: string): boolean {
        const entry = this.cache.get(key);
        if (!entry) return false;
        if (Date.now() > entry.expiresAt) {
            this.cache.delete(key);
            return false;
        }
        return true;
    }

    // Invalidate specific cache
    invalidate(key: string): void {
        this.cache.delete(key);
    }

    // Invalidate all caches matching a pattern
    invalidatePattern(pattern: string): void {
        const regex = new RegExp(pattern);
        for (const key of this.cache.keys()) {
            if (regex.test(key)) {
                this.cache.delete(key);
            }
        }
    }

    // Clear all cache
    clear(): void {
        this.cache.clear();
    }

    // Get cache stats
    stats(): { size: number; keys: string[] } {
        return {
            size: this.cache.size,
            keys: Array.from(this.cache.keys()),
        };
    }
}

// Singleton instance
export const apiCache = new APICache();

// Cache TTL constants (in milliseconds)
export const CACHE_TTL = {
    STATS: 10 * 60 * 1000,      // 10 minutes - stats don't change often
    CONTESTS: 2 * 60 * 1000,    // 2 minutes - may have updates
    COURSES: 2 * 60 * 1000,     // 2 minutes
    DOCUMENTS: 2 * 60 * 1000,   // 2 minutes
    COURSE_DETAIL: 5 * 60 * 1000, // 5 minutes - individual course
    USER_PROFILE: 1 * 60 * 1000,  // 1 minute - user data
    SEARCH: 30 * 1000,          // 30 seconds - search results
    ENROLLMENT: 1 * 60 * 1000,   // 1 minute
    MEMBERSHIP_PLANS: 24 * 60 * 60 * 1000, // 24 hours - rarely changes
    DRAFT: 7 * 24 * 60 * 60 * 1000, // 7 days
};

// ============ IMAGE CACHE SYSTEM ============
// Preload and cache images in browser

class ImageCache {
    private loadedImages: Set<string> = new Set();
    private loadingImages: Map<string, Promise<void>> = new Map();

    // Preload an image
    preload(src: string): Promise<void> {
        if (!src || this.loadedImages.has(src)) {
            return Promise.resolve();
        }

        // Check if already loading
        const existing = this.loadingImages.get(src);
        if (existing) return existing;

        const promise = new Promise<void>((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                this.loadedImages.add(src);
                this.loadingImages.delete(src);
                resolve();
            };
            img.onerror = () => {
                this.loadingImages.delete(src);
                reject(new Error(`Failed to load image: ${src}`));
            };
            img.src = src;
        });

        this.loadingImages.set(src, promise);
        return promise;
    }

    // Preload multiple images
    preloadMany(sources: string[]): Promise<void[]> {
        return Promise.all(
            sources.filter(Boolean).map(src => this.preload(src).catch(() => { }))
        );
    }

    // Check if image is loaded
    isLoaded(src: string): boolean {
        return this.loadedImages.has(src);
    }

    // Clear cache
    clear(): void {
        this.loadedImages.clear();
        this.loadingImages.clear();
    }
}

export const imageCache = new ImageCache();

// ============ SESSION STORAGE HELPERS ============
// For persisting cache across page reloads

function buildStorageKey(namespace: string, key: string): string {
    return `${namespace}_${STORAGE_VERSION}:${key}`;
}

function buildLegacyKey(namespace: string, key: string): string {
    return `${namespace}_${key}`;
}

function clearStorageNamespace(storage: Storage, namespace: string): void {
    const prefix = `${namespace}_`;
    Object.keys(storage).forEach((k) => {
        if (k.startsWith(prefix)) storage.removeItem(k);
    });
}

export const sessionCache = {
    get<T>(key: string): T | null {
        try {
            const versionedKey = buildStorageKey('cache', key);
            const legacyKey = buildLegacyKey('cache', key);
            const item = sessionStorage.getItem(versionedKey) || sessionStorage.getItem(legacyKey);
            if (!item) return null;

            const { data, expiresAt } = JSON.parse(item);
            if (Date.now() > expiresAt) {
                sessionStorage.removeItem(versionedKey);
                sessionStorage.removeItem(legacyKey);
                return null;
            }

            // Migrate legacy cache key to versioned format
            if (!sessionStorage.getItem(versionedKey)) {
                try {
                    sessionStorage.setItem(versionedKey, item);
                    sessionStorage.removeItem(legacyKey);
                } catch {
                    // Ignore storage failures
                }
            }

            return data;
        } catch {
            return null;
        }
    },

    set<T>(key: string, data: T, ttl: number): void {
        try {
            sessionStorage.setItem(buildStorageKey('cache', key), JSON.stringify({
                data,
                expiresAt: Date.now() + ttl,
            }));
        } catch {
            // Storage full or disabled
        }
    },

    remove(key: string): void {
        sessionStorage.removeItem(buildStorageKey('cache', key));
        sessionStorage.removeItem(buildLegacyKey('cache', key));
    },

    clear(): void {
        clearStorageNamespace(sessionStorage, 'cache');
    },
};

// ============ LOCAL STORAGE HELPERS ============
// For persisting cache across browser restarts (use with care; localStorage is readable by JS)

export const localCache = {
    get<T>(key: string): T | null {
        try {
            const versionedKey = buildStorageKey('cache', key);
            const legacyKey = buildLegacyKey('cache', key);
            const item = localStorage.getItem(versionedKey) || localStorage.getItem(legacyKey);
            if (!item) return null;

            const { data, expiresAt } = JSON.parse(item);
            if (Date.now() > expiresAt) {
                localStorage.removeItem(versionedKey);
                localStorage.removeItem(legacyKey);
                return null;
            }

            // Migrate legacy cache key to versioned format
            if (!localStorage.getItem(versionedKey)) {
                try {
                    localStorage.setItem(versionedKey, item);
                    localStorage.removeItem(legacyKey);
                } catch {
                    // Ignore storage failures
                }
            }

            return data;
        } catch {
            return null;
        }
    },

    set<T>(key: string, data: T, ttl: number): void {
        try {
            localStorage.setItem(buildStorageKey('cache', key), JSON.stringify({
                data,
                expiresAt: Date.now() + ttl,
            }));
        } catch {
            // Storage full or disabled
        }
    },

    remove(key: string): void {
        localStorage.removeItem(buildStorageKey('cache', key));
        localStorage.removeItem(buildLegacyKey('cache', key));
    },

    clear(): void {
        clearStorageNamespace(localStorage, 'cache');
    },
};

// ============ DRAFT STORAGE (LOCAL) ============
// Drafts are stored in localStorage with TTL and should be cleared on logout.

export const localDrafts = {
    get<T>(key: string): T | null {
        try {
            const versionedKey = buildStorageKey('draft', key);
            const legacyKey = buildLegacyKey('draft', key);
            const item = localStorage.getItem(versionedKey) || localStorage.getItem(legacyKey);
            if (!item) return null;

            const { data, expiresAt } = JSON.parse(item);
            if (Date.now() > expiresAt) {
                localStorage.removeItem(versionedKey);
                localStorage.removeItem(legacyKey);
                return null;
            }

            if (!localStorage.getItem(versionedKey)) {
                try {
                    localStorage.setItem(versionedKey, item);
                    localStorage.removeItem(legacyKey);
                } catch {
                    // Ignore storage failures
                }
            }

            return data;
        } catch {
            return null;
        }
    },

    set<T>(key: string, data: T, ttl: number): void {
        try {
            localStorage.setItem(buildStorageKey('draft', key), JSON.stringify({
                data,
                expiresAt: Date.now() + ttl,
            }));
        } catch {
            // Storage full or disabled
        }
    },

    remove(key: string): void {
        localStorage.removeItem(buildStorageKey('draft', key));
        localStorage.removeItem(buildLegacyKey('draft', key));
    },

    clear(): void {
        clearStorageNamespace(localStorage, 'draft');
    },
};

export const clientStorage = {
    version: STORAGE_VERSION,
    buildKey: buildStorageKey,
    clearNamespace: clearStorageNamespace,
};
