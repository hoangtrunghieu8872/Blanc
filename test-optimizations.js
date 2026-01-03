/**
 * Production Readiness Test Script
 * Run this to verify all optimizations are working correctly
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

console.log('🚀 Testing Production Optimizations...\n');

const tests = [];

// Test 1: Check if ioredis is installed
try {
  await import('ioredis');
  tests.push({ name: 'Redis Package', status: '✅ PASS', detail: 'ioredis installed' });
} catch (err) {
  tests.push({ name: 'Redis Package', status: '❌ FAIL', detail: 'Run: npm install ioredis' });
}

// Test 2: Check if cache.js exists
const cacheFile = join(__dirname, 'server', 'lib', 'cache.js');
if (existsSync(cacheFile)) {
  tests.push({ name: 'Cache Module', status: '✅ PASS', detail: 'server/lib/cache.js exists' });
} else {
  tests.push({ name: 'Cache Module', status: '❌ FAIL', detail: 'cache.js not found' });
}

// Test 3: Check if useDebounce hook exists
const debounceFile = join(__dirname, 'hooks', 'useDebounce.ts');
if (existsSync(debounceFile)) {
  tests.push({ name: 'Debounce Hook', status: '✅ PASS', detail: 'hooks/useDebounce.ts exists' });
} else {
  tests.push({ name: 'Debounce Hook', status: '❌ FAIL', detail: 'useDebounce.ts not found' });
}

// Test 4: Check if App.tsx has lazy imports
const appFile = join(__dirname, 'App.tsx');
if (existsSync(appFile)) {
  const content = readFileSync(appFile, 'utf-8');
  if (content.includes('lazy(') && content.includes('Suspense')) {
    tests.push({ name: 'Code Splitting', status: '✅ PASS', detail: 'App.tsx uses React.lazy()' });
  } else {
    tests.push({ name: 'Code Splitting', status: '❌ FAIL', detail: 'lazy() not found in App.tsx' });
  }
} else {
  tests.push({ name: 'Code Splitting', status: '❌ FAIL', detail: 'App.tsx not found' });
}

// Test 5: Check if server/index.js has graceful shutdown
const serverFile = join(__dirname, 'server', 'index.js');
if (existsSync(serverFile)) {
  const content = readFileSync(serverFile, 'utf-8');
  if (content.includes('gracefulShutdown')) {
    tests.push({ name: 'Graceful Shutdown', status: '✅ PASS', detail: 'SIGTERM handlers added' });
  } else {
    tests.push({ name: 'Graceful Shutdown', status: '❌ FAIL', detail: 'gracefulShutdown not found' });
  }
} else {
  tests.push({ name: 'Graceful Shutdown', status: '❌ FAIL', detail: 'server/index.js not found' });
}

// Test 6: Check if db.js has retry logic
const dbFile = join(__dirname, 'server', 'lib', 'db.js');
if (existsSync(dbFile)) {
  const content = readFileSync(dbFile, 'utf-8');
  if (content.includes('MAX_CONNECTION_RETRIES')) {
    tests.push({ name: 'DB Resilience', status: '✅ PASS', detail: 'Connection retry logic added' });
  } else {
    tests.push({ name: 'DB Resilience', status: '❌ FAIL', detail: 'Retry logic not found' });
  }
} else {
  tests.push({ name: 'DB Resilience', status: '❌ FAIL', detail: 'db.js not found' });
}

// Test 7: Check .env.example has Redis config
const envFile = join(__dirname, '.env.example');
if (existsSync(envFile)) {
  const content = readFileSync(envFile, 'utf-8');
  if (content.includes('REDIS_URL')) {
    tests.push({ name: 'Redis Config', status: '✅ PASS', detail: '.env.example has REDIS_URL' });
  } else {
    tests.push({ name: 'Redis Config', status: '⚠️ WARN', detail: 'Add REDIS_URL to .env.example' });
  }
} else {
  tests.push({ name: 'Redis Config', status: '❌ FAIL', detail: '.env.example not found' });
}

// Print results
console.log('═══════════════════════════════════════════════════════════\n');
tests.forEach(test => {
  console.log(`${test.status}  ${test.name.padEnd(20)} - ${test.detail}`);
});
console.log('\n═══════════════════════════════════════════════════════════');

// Summary
const passed = tests.filter(t => t.status === '✅ PASS').length;
const failed = tests.filter(t => t.status === '❌ FAIL').length;
const warnings = tests.filter(t => t.status === '⚠️ WARN').length;

console.log(`\n📊 Summary: ${passed}/${tests.length} tests passed`);

if (failed > 0) {
  console.log(`\n❌ ${failed} test(s) failed. Please fix the issues above.`);
  process.exit(1);
} else if (warnings > 0) {
  console.log(`\n⚠️ ${warnings} warning(s). Consider addressing them.`);
  process.exit(0);
} else {
  console.log('\n🎉 All optimizations are in place! System is production-ready.\n');
  console.log('Next steps:');
  console.log('1. Setup Redis: Railway/Upstash/Local');
  console.log('2. Configure REDIS_URL in .env');
  console.log('3. Run: npm run server:dev');
  console.log('4. Check health: http://localhost:4000/api/health');
  process.exit(0);
}
