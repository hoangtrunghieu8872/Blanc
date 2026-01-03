/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_API_URL: string;
    readonly VITE_CHAT_ENABLED?: string;
    readonly VITE_GEMINI_API_KEY: string;
    // thêm các biến môi trường khác nếu cần
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
