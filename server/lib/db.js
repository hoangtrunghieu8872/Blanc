import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Pool } from 'pg';
import { ObjectId, normalizeId } from './objectId.js';

let pool;
let connecting;

const collectionCache = new Map();

function formatDatabaseTarget(databaseUrl) {
    try {
        const parsed = new URL(databaseUrl);
        const host = parsed.hostname || 'unknown-host';
        const port = parsed.port || '5432';
        const dbName = (parsed.pathname || '').replace(/^\//, '') || 'unknown-db';
        return `${host}:${port}/${dbName}`;
    } catch {
        return 'unknown-target';
    }
}

function getDefaultRootCertPath() {
    if (process.platform === 'win32') {
        // CockroachDB client cert location on Windows when following their docs.
        // The user already downloaded root.crt to %APPDATA%\postgresql\root.crt
        const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
        return path.join(appData, 'postgresql', 'root.crt');
    }

    // Standard Postgres location on Unix-like systems.
    return path.join(os.homedir(), '.postgresql', 'root.crt');
}

function getDatabaseUrl() {
    return (
        process.env.DATABASE_URL ||
        process.env.POSTGRES_URL ||
        process.env.COCKROACH_DATABASE_URL ||
        process.env.COCKROACHDB_URL ||
        ''
    );
}

function normalizePem(value) {
    return String(value).replace(/\\n/g, '\n').trim();
}

function looksLikePem(value) {
    return typeof value === 'string' && value.includes('BEGIN CERTIFICATE');
}

function getSslMode(databaseUrl) {
    try {
        const parsed = new URL(databaseUrl);
        const mode = parsed.searchParams.get('sslmode');
        return mode ? mode.toLowerCase() : null;
    } catch {
        const match = String(databaseUrl).match(/[?&]sslmode=([^&]+)/i);
        return match ? decodeURIComponent(match[1]).toLowerCase() : null;
    }
}

function readRootCaCert() {
    const base64 = process.env.PGSSLROOTCERT_BASE64;
    if (base64) {
        try {
            return Buffer.from(base64, 'base64').toString('utf8').trim();
        } catch {
            // ignore invalid base64
        }
    }

    const pemEnv = process.env.PGSSLROOTCERT_PEM;
    if (pemEnv) {
        const normalized = normalizePem(pemEnv);
        if (normalized) return normalized;
    }

    const rootCertEnv = process.env.PGSSLROOTCERT;
    if (rootCertEnv) {
        // Treat as a file path if it exists; otherwise accept a PEM string (useful for serverless env vars).
        if (fs.existsSync(rootCertEnv)) {
            return fs.readFileSync(rootCertEnv, 'utf8');
        }
        if (looksLikePem(rootCertEnv)) {
            return normalizePem(rootCertEnv);
        }
    }

    const sslCertFile = process.env.SSL_CERT_FILE;
    if (sslCertFile && fs.existsSync(sslCertFile)) {
        return fs.readFileSync(sslCertFile, 'utf8');
    }

    const defaultPath = getDefaultRootCertPath();
    if (defaultPath && fs.existsSync(defaultPath)) {
        return fs.readFileSync(defaultPath, 'utf8');
    }

    return null;
}

function getSslConfigFromEnv() {
    const url = getDatabaseUrl();
    const sslMode = getSslMode(url);

    if (sslMode === 'verify-full' || sslMode === 'verify-ca') {
        const ca = readRootCaCert();
        if (!ca) {
            const hint =
                process.env.PGSSLROOTCERT ||
                process.env.SSL_CERT_FILE ||
                getDefaultRootCertPath();
            throw new Error(
                `sslmode=${sslMode} requested but CA cert not found. Set PGSSLROOTCERT to a root.crt path, or set PGSSLROOTCERT_PEM/PGSSLROOTCERT_BASE64 (tried: ${hint}).`
            );
        }

        return {
            rejectUnauthorized: true,
            ca,
        };
    }

    if (sslMode === 'require' || sslMode === 'no-verify') {
        return {
            rejectUnauthorized: false,
        };
    }

    // Default: no custom SSL config. CockroachDB URLs commonly include sslmode.
    return undefined;
}

async function ensureSchema(db) {
    await db.query(`CREATE TABLE IF NOT EXISTS documents (
        collection TEXT NOT NULL,
        id TEXT NOT NULL,
        doc JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (collection, id)
    )`);
    await db.query(`CREATE INDEX IF NOT EXISTS documents_collection_idx ON documents (collection)`);
    try {
        await db.query(`CREATE INVERTED INDEX IF NOT EXISTS documents_doc_inverted_idx ON documents (doc)`);
    } catch {
        // best-effort
    }

    await db.query(`CREATE TABLE IF NOT EXISTS media (
        id TEXT PRIMARY KEY,
        owner_id TEXT,
        folder TEXT NOT NULL,
        file_name TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        size_bytes BIGINT NOT NULL,
        sha256 TEXT NOT NULL,
        is_public BOOL NOT NULL DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        content BYTEA NOT NULL
    )`);
    await db.query(`CREATE INDEX IF NOT EXISTS media_owner_idx ON media (owner_id)`);
    await db.query(`CREATE INDEX IF NOT EXISTS media_public_created_idx ON media (is_public, created_at DESC)`);
}

export async function connectToDatabase() {
    if (pool) return pool;
    if (connecting) return connecting;

    const databaseUrl = getDatabaseUrl();
    if (!databaseUrl) {
        throw new Error(
            'DATABASE_URL is not set. Please set DATABASE_URL to your PostgreSQL/CockroachDB connection string.'
        );
    }

    connecting = (async () => {
        const ssl = getSslConfigFromEnv();
        const target = formatDatabaseTarget(databaseUrl);

        const candidatePool = new Pool({
            connectionString: databaseUrl,
            ssl,
            max: Number(process.env.PGPOOL_MAX || 10),
            idleTimeoutMillis: Number(process.env.PGPOOL_IDLE_MS || 30_000),
            connectionTimeoutMillis: Number(process.env.PGPOOL_CONNECT_TIMEOUT_MS || 30_000),
            allowExitOnIdle: process.env.NODE_ENV !== 'production',
        });

        try {
            await candidatePool.query('SELECT 1');
            await ensureSchema(candidatePool);

            pool = candidatePool;

            if (process.env.NODE_ENV !== 'production') {
                // eslint-disable-next-line no-console
                console.log(`✅ Connected to PostgreSQL/CockroachDB (${target})`);
            }

            return pool;
        } catch (err) {
            try {
                await candidatePool.end();
            } catch {
                // ignore
            }

            // Ensure future attempts can retry.
            pool = undefined;

            const code = err?.code;
            if (code === 'ETIMEDOUT') {
                throw new Error(
                    `Database connect timed out to ${target}. If using CockroachDB Cloud, check the cluster is running and your public IP is allowed (Allowed IP Ranges). Also verify outbound access to port 26257 isn't blocked by firewall/VPN.`,
                    { cause: err }
                );
            }
            if (code === 'ECONNREFUSED' || code === 'ENOTFOUND' || code === 'EHOSTUNREACH') {
                throw new Error(
                    `Database connection failed to ${target} (${code}). Verify hostname/port, network access, and that the database is reachable.`,
                    { cause: err }
                );
            }

            throw err;
        }
    })();

    try {
        return await connecting;
    } finally {
        connecting = undefined;
    }
}

export function getDb() {
    if (!pool) {
        throw new Error('Database has not been initialized. Call connectToDatabase() first.');
    }
    return pool;
}

function deepCloneJson(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function getByPath(obj, pathStr) {
    if (!pathStr) return undefined;
    const parts = pathStr.split('.');
    let cursor = obj;
    for (const part of parts) {
        if (cursor == null) return undefined;
        cursor = cursor[part];
    }
    return cursor;
}

function setByPath(obj, pathStr, value) {
    const parts = pathStr.split('.');
    let cursor = obj;
    for (let i = 0; i < parts.length - 1; i++) {
        const key = parts[i];
        if (cursor[key] == null || typeof cursor[key] !== 'object') cursor[key] = {};
        cursor = cursor[key];
    }
    cursor[parts[parts.length - 1]] = value;
}

function unsetByPath(obj, pathStr) {
    const parts = pathStr.split('.');
    let cursor = obj;
    for (let i = 0; i < parts.length - 1; i++) {
        const key = parts[i];
        if (cursor == null) return;
        cursor = cursor[key];
    }
    if (cursor && typeof cursor === 'object') {
        delete cursor[parts[parts.length - 1]];
    }
}

function normalizeQueryValue(value) {
    if (value instanceof ObjectId) return value.toString();
    if (Array.isArray(value)) return value.map(normalizeQueryValue);
    return value;
}

function equalsMongoLike(a, b) {
    const left = normalizeQueryValue(a);
    const right = normalizeQueryValue(b);

    // Array equality semantics: {tags: 'x'} matches tags: ['x','y']
    if (Array.isArray(left) && !Array.isArray(right)) {
        return left.some((item) => equalsMongoLike(item, right));
    }
    if (!Array.isArray(left) && Array.isArray(right)) {
        return right.some((item) => equalsMongoLike(left, item));
    }

    if (left instanceof Date && right instanceof Date) return left.getTime() === right.getTime();
    if (left && typeof left === 'object' && right && typeof right === 'object') {
        return JSON.stringify(left) === JSON.stringify(right);
    }
    return left === right;
}

function matchesCondition(fieldValue, condition) {
    if (condition && typeof condition === 'object' && !Array.isArray(condition) && !(condition instanceof RegExp) && !(condition instanceof Date) && !(condition instanceof ObjectId)) {
        const ops = condition;

        if ('$exists' in ops) {
            const exists = fieldValue !== undefined;
            return Boolean(ops.$exists) ? exists : !exists;
        }

        if ('$in' in ops) {
            const list = (ops.$in || []).map(normalizeQueryValue);
            if (Array.isArray(fieldValue)) {
                return fieldValue.some((v) => list.some((x) => equalsMongoLike(v, x)));
            }
            return list.some((x) => equalsMongoLike(fieldValue, x));
        }

        if ('$nin' in ops) {
            const list = (ops.$nin || []).map(normalizeQueryValue);
            if (Array.isArray(fieldValue)) {
                return !fieldValue.some((v) => list.some((x) => equalsMongoLike(v, x)));
            }
            return !list.some((x) => equalsMongoLike(fieldValue, x));
        }

        if ('$ne' in ops) {
            return !equalsMongoLike(fieldValue, ops.$ne);
        }

        if ('$gte' in ops || '$gt' in ops || '$lte' in ops || '$lt' in ops) {
            const v = fieldValue;
            const gte = ops.$gte;
            const gt = ops.$gt;
            const lte = ops.$lte;
            const lt = ops.$lt;

            const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;
            const isIsoDateString = (value) => typeof value === 'string' && ISO_DATE_RE.test(value);
            const isDateLike = (value) => value instanceof Date || isIsoDateString(value);
            const toEpochMs = (value) => {
                if (value instanceof Date) return value.getTime();
                if (isIsoDateString(value)) return Date.parse(value);
                return null;
            };

            // If either side is date-like, compare using epoch milliseconds.
            if (isDateLike(v) || isDateLike(gte) || isDateLike(gt) || isDateLike(lte) || isDateLike(lt)) {
                const left = toEpochMs(v);
                if (!Number.isFinite(left)) return false;

                const gteMs = gte !== undefined ? toEpochMs(gte) : null;
                const gtMs = gt !== undefined ? toEpochMs(gt) : null;
                const lteMs = lte !== undefined ? toEpochMs(lte) : null;
                const ltMs = lt !== undefined ? toEpochMs(lt) : null;

                if (gte !== undefined && !Number.isFinite(gteMs)) return false;
                if (gt !== undefined && !Number.isFinite(gtMs)) return false;
                if (lte !== undefined && !Number.isFinite(lteMs)) return false;
                if (lt !== undefined && !Number.isFinite(ltMs)) return false;

                if (gte !== undefined && !(left >= gteMs)) return false;
                if (gt !== undefined && !(left > gtMs)) return false;
                if (lte !== undefined && !(left <= lteMs)) return false;
                if (lt !== undefined && !(left < ltMs)) return false;
                return true;
            }

            // Default: numeric-or-raw comparison.
            const n = typeof v === 'string' && !Number.isNaN(Number(v)) ? Number(v) : v;
            if (gte !== undefined && !(n >= gte)) return false;
            if (gt !== undefined && !(n > gt)) return false;
            if (lte !== undefined && !(n <= lte)) return false;
            if (lt !== undefined && !(n < lt)) return false;
            return true;
        }

        if ('$regex' in ops) {
            const pattern = ops.$regex;
            const flags = typeof ops.$options === 'string' ? ops.$options : '';
            const re = pattern instanceof RegExp ? pattern : new RegExp(String(pattern), flags);
            return re.test(String(fieldValue ?? ''));
        }

        if ('$size' in ops) {
            if (!Array.isArray(fieldValue)) return false;
            return fieldValue.length === ops.$size;
        }

        if ('$elemMatch' in ops) {
            if (!Array.isArray(fieldValue)) return false;
            return fieldValue.some((item) => matchesQuery(item, ops.$elemMatch));
        }
    }

    // Primitive equality
    return equalsMongoLike(fieldValue, condition);
}

function matchesQuery(doc, query) {
    if (!query || Object.keys(query).length === 0) return true;

    for (const [key, rawCondition] of Object.entries(query)) {
        if (key === '$and') {
            const parts = Array.isArray(rawCondition) ? rawCondition : [];
            if (!parts.every((q) => matchesQuery(doc, q))) return false;
            continue;
        }
        if (key === '$or') {
            const parts = Array.isArray(rawCondition) ? rawCondition : [];
            if (!parts.some((q) => matchesQuery(doc, q))) return false;
            continue;
        }
        if (key === '$nor') {
            const parts = Array.isArray(rawCondition) ? rawCondition : [];
            if (parts.some((q) => matchesQuery(doc, q))) return false;
            continue;
        }

        const condition = normalizeQueryValue(rawCondition);
        const fieldValue = key === '_id' ? doc?._id : getByPath(doc, key);
        if (!matchesCondition(fieldValue, condition)) return false;
    }

    return true;
}

function applyProjection(doc, projection) {
    if (!projection) return doc;
    const keys = Object.keys(projection);
    if (keys.length === 0) return doc;

    const includeKeys = keys.filter((k) => projection[k]);
    const excludeKeys = keys.filter((k) => projection[k] === 0);

    if (includeKeys.length > 0) {
        const out = {};
        // Mongo includes _id by default unless explicitly excluded.
        if (projection._id !== 0 && doc._id !== undefined) out._id = doc._id;
        for (const key of includeKeys) {
            if (key === '_id') continue;
            const value = getByPath(doc, key);
            if (value !== undefined) setByPath(out, key, value);
        }
        return out;
    }

    if (excludeKeys.length > 0) {
        const out = deepCloneJson(doc);
        for (const key of excludeKeys) {
            unsetByPath(out, key);
        }
        return out;
    }

    return doc;
}

function compareBySort(a, b, sortSpec) {
    for (const [field, dir] of Object.entries(sortSpec || {})) {
        const av = field === '_id' ? a?._id : getByPath(a, field);
        const bv = field === '_id' ? b?._id : getByPath(b, field);
        if (av === bv) continue;
        const order = (dir || 1) >= 0 ? 1 : -1;
        if (av == null) return -1 * order;
        if (bv == null) return 1 * order;
        if (av > bv) return 1 * order;
        if (av < bv) return -1 * order;
    }
    return 0;
}

class Cursor {
    constructor(collection, query, projection) {
        this.collection = collection;
        this.query = query || {};
        this.projection = projection;
        this.sortSpec = undefined;
        this.limitCount = undefined;
        this.skipCount = 0;
    }

    sort(spec) {
        this.sortSpec = spec;
        return this;
    }

    limit(n) {
        this.limitCount = n;
        return this;
    }

    skip(n) {
        this.skipCount = n;
        return this;
    }

    project(spec) {
        this.projection = spec;
        return this;
    }

    async toArray() {
        const docs = await this.collection._loadAll();
        let result = docs.filter((d) => matchesQuery(d, this.query));

        if (this.sortSpec) {
            result = result.sort((a, b) => compareBySort(a, b, this.sortSpec));
        }

        if (this.skipCount) result = result.slice(this.skipCount);
        if (this.limitCount !== undefined) result = result.slice(0, this.limitCount);

        if (this.projection) {
            result = result.map((d) => applyProjection(d, this.projection));
        }

        return result;
    }
}

function evalExpr(doc, expr, vars = {}) {
    if (expr == null) return expr;

    if (typeof expr === 'string') {
        if (expr.startsWith('$$')) return vars[expr.slice(2)];
        if (expr.startsWith('$')) return getByPath(doc, expr.slice(1));
        return expr;
    }

    if (typeof expr !== 'object' || expr instanceof Date || expr instanceof RegExp) {
        return expr;
    }

    if (Array.isArray(expr)) {
        return expr.map((e) => evalExpr(doc, e, vars));
    }

    const [op] = Object.keys(expr);
    if (!op || !op.startsWith('$')) {
        // plain object
        const out = {};
        for (const [k, v] of Object.entries(expr)) out[k] = evalExpr(doc, v, vars);
        return out;
    }

    switch (op) {
        case '$and': {
            const parts = Array.isArray(expr.$and) ? expr.$and : [];
            return parts.every((p) => Boolean(evalExpr(doc, p, vars)));
        }
        case '$or': {
            const parts = Array.isArray(expr.$or) ? expr.$or : [];
            return parts.some((p) => Boolean(evalExpr(doc, p, vars)));
        }
        case '$eq': {
            const [a, b] = Array.isArray(expr.$eq) ? expr.$eq : [];
            return equalsMongoLike(evalExpr(doc, a, vars), evalExpr(doc, b, vars));
        }
        case '$ne': {
            const [a, b] = Array.isArray(expr.$ne) ? expr.$ne : [];
            return !equalsMongoLike(evalExpr(doc, a, vars), evalExpr(doc, b, vars));
        }
        case '$gte': {
            const [a, b] = Array.isArray(expr.$gte) ? expr.$gte : [];
            return evalExpr(doc, a, vars) >= evalExpr(doc, b, vars);
        }
        case '$gt': {
            const [a, b] = Array.isArray(expr.$gt) ? expr.$gt : [];
            return evalExpr(doc, a, vars) > evalExpr(doc, b, vars);
        }
        case '$lte': {
            const [a, b] = Array.isArray(expr.$lte) ? expr.$lte : [];
            return evalExpr(doc, a, vars) <= evalExpr(doc, b, vars);
        }
        case '$lt': {
            const [a, b] = Array.isArray(expr.$lt) ? expr.$lt : [];
            return evalExpr(doc, a, vars) < evalExpr(doc, b, vars);
        }
        case '$add': {
            const parts = Array.isArray(expr.$add) ? expr.$add : [];
            return parts.reduce((sum, p) => sum + Number(evalExpr(doc, p, vars) || 0), 0);
        }
        case '$max': {
            const parts = Array.isArray(expr.$max) ? expr.$max : [];
            const values = parts.map((p) => evalExpr(doc, p, vars));
            return values.reduce((m, v) => (m === undefined || v > m ? v : m), undefined);
        }
        case '$cond': {
            // Support array form: [if, then, else]
            const arr = Array.isArray(expr.$cond) ? expr.$cond : null;
            if (arr) {
                const [ifExpr, thenExpr, elseExpr] = arr;
                return Boolean(evalExpr(doc, ifExpr, vars))
                    ? evalExpr(doc, thenExpr, vars)
                    : evalExpr(doc, elseExpr, vars);
            }
            // Support object form: { if, then, else }
            const ifExpr = expr.$cond?.if;
            const thenExpr = expr.$cond?.then;
            const elseExpr = expr.$cond?.else;
            return Boolean(evalExpr(doc, ifExpr, vars))
                ? evalExpr(doc, thenExpr, vars)
                : evalExpr(doc, elseExpr, vars);
        }
        case '$concatArrays': {
            const parts = Array.isArray(expr.$concatArrays) ? expr.$concatArrays : [];
            const arrays = parts.map((p) => evalExpr(doc, p, vars)).filter(Array.isArray);
            return arrays.flat();
        }
        case '$let': {
            const varsSpec = expr.$let?.vars || {};
            const inExpr = expr.$let?.in;
            const nextVars = { ...vars };
            for (const [k, v] of Object.entries(varsSpec)) {
                nextVars[k] = evalExpr(doc, v, nextVars);
            }
            return evalExpr(doc, inExpr, nextVars);
        }
        case '$toString': {
            const v = evalExpr(doc, expr.$toString, vars);
            return v == null ? '' : String(v);
        }
        case '$ifNull': {
            const [a, b] = Array.isArray(expr.$ifNull) ? expr.$ifNull : [];
            const av = evalExpr(doc, a, vars);
            return av == null ? evalExpr(doc, b, vars) : av;
        }
        case '$size': {
            const v = evalExpr(doc, expr.$size, vars);
            return Array.isArray(v) ? v.length : 0;
        }
        case '$split': {
            const [input, delim] = Array.isArray(expr.$split) ? expr.$split : [];
            const s = String(evalExpr(doc, input, vars) ?? '');
            const d = String(evalExpr(doc, delim, vars) ?? ',');
            return s.split(d);
        }
        case '$in': {
            const [needle, haystack] = Array.isArray(expr.$in) ? expr.$in : [];
            const n = evalExpr(doc, needle, vars);
            const h = evalExpr(doc, haystack, vars);
            return Array.isArray(h) ? h.some((x) => equalsMongoLike(x, n)) : false;
        }
        case '$filter': {
            const input = evalExpr(doc, expr.$filter?.input, vars);
            const asVar = expr.$filter?.as || 'this';
            const cond = expr.$filter?.cond;
            if (!Array.isArray(input)) return [];
            return input.filter((item) => {
                const nextVars = { ...vars, [asVar]: item };
                const result = evalExpr(doc, cond, nextVars);
                return Boolean(result);
            });
        }
        default:
            return undefined;
    }
}

class AggCursor {
    constructor(collection, pipeline) {
        this.collection = collection;
        this.pipeline = pipeline || [];
    }

    async toArray() {
        let docs = await this.collection._loadAll();

        for (const stage of this.pipeline) {
            const [op, spec] = Object.entries(stage)[0] || [];
            if (!op) continue;

            if (op === '$match') {
                docs = docs.filter((d) => matchesQuery(d, spec));
                continue;
            }

            if (op === '$project') {
                docs = docs.map((d) => {
                    const out = {};
                    for (const [k, v] of Object.entries(spec || {})) {
                        if (v === 1) {
                            const val = getByPath(d, k);
                            if (val !== undefined) setByPath(out, k, val);
                            continue;
                        }
                        if (v === 0) continue;
                        if (typeof v === 'string' && v.startsWith('$')) {
                            out[k] = getByPath(d, v.slice(1));
                            continue;
                        }
                        out[k] = evalExpr(d, v);
                    }
                    return out;
                });
                continue;
            }

            if (op === '$addFields') {
                docs = docs.map((d) => {
                    const out = deepCloneJson(d);
                    for (const [k, v] of Object.entries(spec || {})) {
                        out[k] = evalExpr(d, v);
                    }
                    return out;
                });
                continue;
            }

            if (op === '$limit') {
                docs = docs.slice(0, Number(spec) || 0);
                continue;
            }

            if (op === '$sort') {
                docs = docs.sort((a, b) => compareBySort(a, b, spec));
                continue;
            }

            if (op === '$unwind') {
                const pathExpr = typeof spec === 'string' ? spec : spec?.path;
                const fieldPath = String(pathExpr || '').replace(/^\$/, '').replace(/^\./, '').replace(/^\$/, '');
                const unwindPath = fieldPath.startsWith('$') ? fieldPath.slice(1) : fieldPath;
                const next = [];
                for (const d of docs) {
                    const arr = getByPath(d, unwindPath);
                    if (!Array.isArray(arr)) continue;
                    for (const item of arr) {
                        const out = deepCloneJson(d);
                        setByPath(out, unwindPath, item);
                        next.push(out);
                    }
                }
                docs = next;
                continue;
            }

            if (op === '$group') {
                const idExpr = spec?._id;
                const accumulators = Object.entries(spec || {}).filter(([k]) => k !== '_id');
                const map = new Map();
                for (const d of docs) {
                    const keyValue = evalExpr(d, idExpr);
                    const key = JSON.stringify(keyValue);
                    if (!map.has(key)) {
                        const seed = { _id: keyValue };
                        for (const [field, acc] of accumulators) {
                            if (acc && typeof acc === 'object' && '$sum' in acc) seed[field] = 0;
                        }
                        map.set(key, seed);
                    }
                    const target = map.get(key);
                    for (const [field, acc] of accumulators) {
                        if (acc && typeof acc === 'object' && '$sum' in acc) {
                            const sumSpec = acc.$sum;
                            const inc = typeof sumSpec === 'number' ? sumSpec : Number(evalExpr(d, sumSpec) || 0);
                            target[field] += inc;
                        }
                    }
                }
                docs = Array.from(map.values());
                continue;
            }
        }

        return docs;
    }
}

class Collection {
    constructor(name) {
        this.name = name;
    }

    _applyUpdateOperators(doc, update) {
        const operators = update && typeof update === 'object' ? update : {};
        if ('$set' in operators) {
            for (const [k, v] of Object.entries(operators.$set || {})) setByPath(doc, k, v);
        }
        if ('$unset' in operators) {
            for (const k of Object.keys(operators.$unset || {})) unsetByPath(doc, k);
        }
        if ('$inc' in operators) {
            for (const [k, v] of Object.entries(operators.$inc || {})) {
                const current = getByPath(doc, k);
                const next = (Number(current) || 0) + Number(v || 0);
                setByPath(doc, k, next);
            }
        }
        if ('$push' in operators) {
            for (const [k, v] of Object.entries(operators.$push || {})) {
                const current = getByPath(doc, k);
                const arr = Array.isArray(current) ? current : [];
                arr.push(v);
                setByPath(doc, k, arr);
            }
        }
        if ('$addToSet' in operators) {
            for (const [k, v] of Object.entries(operators.$addToSet || {})) {
                const current = getByPath(doc, k);
                const arr = Array.isArray(current) ? current : [];
                if (!arr.some((x) => equalsMongoLike(x, v))) arr.push(v);
                setByPath(doc, k, arr);
            }
        }
        if ('$pull' in operators) {
            for (const [k, v] of Object.entries(operators.$pull || {})) {
                const current = getByPath(doc, k);
                const arr = Array.isArray(current) ? current : [];
                setByPath(
                    doc,
                    k,
                    arr.filter((x) => !equalsMongoLike(x, v))
                );
            }
        }
    }

    _applyUpdatePipeline(doc, pipeline) {
        let current = doc;

        for (const stage of pipeline || []) {
            const [op, spec] = Object.entries(stage || {})[0] || [];
            if (!op) continue;

            if (op === '$set') {
                const stageInput = deepCloneJson(current);
                const values = {};
                for (const [k, v] of Object.entries(spec || {})) {
                    values[k] = evalExpr(stageInput, v);
                }
                for (const [k, v] of Object.entries(values)) setByPath(current, k, v);
                continue;
            }

            if (op === '$unset') {
                const fields = Array.isArray(spec)
                    ? spec
                    : typeof spec === 'string'
                        ? [spec]
                        : Object.keys(spec || {});
                for (const field of fields) unsetByPath(current, field);
                continue;
            }
        }

        return current;
    }

    async _loadAll() {
        await connectToDatabase();
        const result = await pool.query('SELECT doc FROM documents WHERE collection = $1', [this.name]);
        return result.rows.map((r) => r.doc);
    }

    find(query = {}, options = {}) {
        return new Cursor(this, query, options?.projection);
    }

    async findOne(query = {}, options = {}) {
        const docs = await this.find(query, options).limit(1).toArray();
        return docs[0] || null;
    }

    async countDocuments(query = {}) {
        const docs = await this._loadAll();
        return docs.filter((d) => matchesQuery(d, query)).length;
    }

    async insertOne(doc) {
        await connectToDatabase();
        const out = deepCloneJson(doc || {});
        if (!out._id) out._id = new ObjectId().toString();
        const id = normalizeId(out._id);
        out._id = id;

        await pool.query(
            'INSERT INTO documents(collection, id, doc) VALUES ($1, $2, $3)',
            [this.name, id, out]
        );
        return { insertedId: id, acknowledged: true };
    }

    async insertMany(docs = []) {
        await connectToDatabase();

        const list = Array.isArray(docs) ? docs : [];
        const insertedIds = {};
        let insertedCount = 0;

        const chunkSize = 100;
        for (let start = 0; start < list.length; start += chunkSize) {
            const chunk = list.slice(start, start + chunkSize).map((d) => {
                const out = deepCloneJson(d || {});
                if (!out._id) out._id = new ObjectId().toString();
                const id = normalizeId(out._id);
                out._id = id;
                return { id, doc: out };
            });

            const values = [];
            const params = [];
            let p = 1;
            for (const item of chunk) {
                params.push(this.name, item.id, item.doc);
                values.push(`($${p++}, $${p++}, $${p++})`);
            }

            if (values.length > 0) {
                await pool.query(
                    `INSERT INTO documents(collection, id, doc)
                     VALUES ${values.join(', ')}
                     ON CONFLICT (collection, id)
                     DO UPDATE SET doc = EXCLUDED.doc, updated_at = now()`,
                    params
                );
            }

            for (let i = 0; i < chunk.length; i++) {
                insertedIds[start + i] = chunk[i].id;
            }
            insertedCount += chunk.length;
        }

        return { insertedCount, insertedIds, acknowledged: true };
    }

    async updateOne(filter, update, options = {}) {
        await connectToDatabase();
        const docs = await this.find(filter).limit(1).toArray();
        let doc = docs[0];

        if (!doc) {
            if (!options?.upsert) {
                return { matchedCount: 0, modifiedCount: 0, upsertedCount: 0, acknowledged: true };
            }
            doc = { ...deepCloneJson(filter) };
            if (!doc._id) doc._id = new ObjectId().toString();
        } else {
            doc = deepCloneJson(doc);
        }

        if (Array.isArray(update)) {
            doc = this._applyUpdatePipeline(doc, update);
        } else {
            this._applyUpdateOperators(doc, update);
        }

        const id = normalizeId(doc._id);
        doc._id = id;

        await pool.query(
            `INSERT INTO documents(collection, id, doc, updated_at)
             VALUES ($1, $2, $3, now())
             ON CONFLICT (collection, id)
             DO UPDATE SET doc = EXCLUDED.doc, updated_at = now()`,
            [this.name, id, doc]
        );

        return {
            matchedCount: docs[0] ? 1 : 0,
            modifiedCount: 1,
            upsertedCount: docs[0] ? 0 : 1,
            upsertedId: docs[0] ? undefined : id,
            acknowledged: true,
        };
    }

    async updateMany(filter, update, options = {}) {
        await connectToDatabase();
        const docs = await this.find(filter).toArray();
        const matchedCount = docs.length;
        if (matchedCount === 0 && !options?.upsert) {
            return { matchedCount: 0, modifiedCount: 0, acknowledged: true };
        }

        const targets = matchedCount > 0 ? docs : [deepCloneJson(filter || {})];
        let modifiedCount = 0;

        for (const original of targets) {
            let doc = deepCloneJson(original);
            if (!doc._id) doc._id = new ObjectId().toString();

            if (Array.isArray(update)) {
                doc = this._applyUpdatePipeline(doc, update);
            } else {
                this._applyUpdateOperators(doc, update);
            }

            const id = normalizeId(doc._id);
            doc._id = id;

            await pool.query(
                `INSERT INTO documents(collection, id, doc, updated_at)
                 VALUES ($1, $2, $3, now())
                 ON CONFLICT (collection, id)
                 DO UPDATE SET doc = EXCLUDED.doc, updated_at = now()`,
                [this.name, id, doc]
            );
            modifiedCount++;
        }

        return { matchedCount, modifiedCount, acknowledged: true };
    }

    async deleteOne(filter) {
        await connectToDatabase();
        const docs = await this.find(filter).limit(1).toArray();
        const doc = docs[0];
        if (!doc) return { deletedCount: 0, acknowledged: true };
        const id = normalizeId(doc._id);
        const result = await pool.query('DELETE FROM documents WHERE collection=$1 AND id=$2', [this.name, id]);
        return { deletedCount: result.rowCount || 0, acknowledged: true };
    }

    async deleteMany(filter = {}) {
        await connectToDatabase();
        const docs = await this.find(filter).toArray();
        const ids = docs.map((d) => normalizeId(d._id)).filter(Boolean);
        if (ids.length === 0) return { deletedCount: 0, acknowledged: true };
        const result = await pool.query(
            'DELETE FROM documents WHERE collection=$1 AND id = ANY($2)',
            [this.name, ids]
        );
        return { deletedCount: result.rowCount || 0, acknowledged: true };
    }

    async findOneAndUpdate(filter, update, options = {}) {
        await connectToDatabase();

        const docs = await this.find(filter).limit(1).toArray();
        const existing = docs[0] || null;
        const before = existing ? deepCloneJson(existing) : null;

        if (!existing && !options?.upsert) {
            return { value: null, ok: 1, lastErrorObject: { updatedExisting: false } };
        }

        let doc = existing ? deepCloneJson(existing) : deepCloneJson(filter || {});
        if (!doc._id) doc._id = new ObjectId().toString();

        if (Array.isArray(update)) {
            doc = this._applyUpdatePipeline(doc, update);
        } else {
            this._applyUpdateOperators(doc, update);
        }

        const id = normalizeId(doc._id);
        doc._id = id;

        await pool.query(
            `INSERT INTO documents(collection, id, doc, updated_at)
             VALUES ($1, $2, $3, now())
             ON CONFLICT (collection, id)
             DO UPDATE SET doc = EXCLUDED.doc, updated_at = now()`,
            [this.name, id, doc]
        );

        const returnAfter = String(options?.returnDocument || 'before').toLowerCase() === 'after';
        return {
            value: returnAfter ? doc : before,
            ok: 1,
            lastErrorObject: {
                updatedExisting: Boolean(existing),
                upserted: existing ? undefined : id,
            },
        };
    }

    aggregate(pipeline = []) {
        return new AggCursor(this, pipeline);
    }

    async distinct(field, query = {}) {
        const docs = await this.find(query).toArray();
        const set = new Set();
        for (const d of docs) {
            const v = getByPath(d, field);
            if (Array.isArray(v)) v.forEach((x) => set.add(JSON.stringify(x)));
            else if (v !== undefined) set.add(JSON.stringify(v));
        }
        return Array.from(set).map((s) => JSON.parse(s));
    }

    // No-op compatibility with legacy code paths.
    async createIndex() {
        return undefined;
    }
}

export function getCollection(name) {
    if (!pool) {
        // allow constructing wrappers before connect
    }
    if (!collectionCache.has(name)) {
        collectionCache.set(name, new Collection(name));
    }
    return collectionCache.get(name);
}

export async function disconnectFromDatabase() {
    if (pool) {
        await pool.end();
        pool = undefined;
        collectionCache.clear();
        // eslint-disable-next-line no-console
        console.log('📤 Disconnected from PostgreSQL/CockroachDB');
    }
}

// Backward-compat export (some legacy code may still call getClient())
export function getClient() {
    return getDb();
}
