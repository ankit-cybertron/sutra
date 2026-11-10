const fs = require('fs');
const path = require('path');
const { chromium } = require('../apps/web/node_modules/@playwright/test');

const assetsDir = path.join(__dirname, '..', 'docs', 'assets');
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

// 1. Architecture SVG
const architectureSvg = `
<svg width="1200" height="700" viewBox="0 0 1200 700" xmlns="http://www.w3.org/2000/svg" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#070a13"/>
      <stop offset="100%" stop-color="#0f172a"/>
    </linearGradient>
    <linearGradient id="blueCard" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1e293b"/>
      <stop offset="100%" stop-color="#0f172a"/>
    </linearGradient>
    <linearGradient id="accentGnani" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#3b82f6"/>
      <stop offset="100%" stop-color="#1d4ed8"/>
    </linearGradient>
    <linearGradient id="accentGroq" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#f97316"/>
      <stop offset="100%" stop-color="#c2410c"/>
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="6" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>

  <!-- Background -->
  <rect width="1200" height="700" fill="url(#bg)"/>
  
  <!-- Subtle Grid Lines -->
  <g stroke="#ffffff" stroke-opacity="0.04" stroke-width="1">
    ${Array.from({length: 25}, (_, i) => `<line x1="${i*50}" y1="0" x2="${i*50}" y2="700"/>`).join('')}
    ${Array.from({length: 15}, (_, i) => `<line x1="0" y1="${i*50}" x2="1200" y2="${i*50}"/>`).join('')}
  </g>

  <!-- Title Header -->
  <text x="50" y="55" font-size="24" font-weight="700" fill="#f8fafc" letter-spacing="0.5">Sutra · System Architecture</text>
  <text x="50" y="80" font-size="13" font-weight="400" fill="#94a3b8">Voice-First Idea Intake, Real-Time Indic STT, Dual-Engine Failover, and Schema-Constrained LLM Synthesis</text>

  <!-- COLUMN 1: CLIENT LAYER -->
  <rect x="50" y="110" width="310" height="540" rx="14" fill="url(#blueCard)" stroke="#334155" stroke-width="1.5"/>
  <rect x="50" y="110" width="310" height="42" rx="14" fill="#1e293b"/>
  <text x="70" y="137" font-size="14" font-weight="600" fill="#38bdf8">CLIENT LAYER (Vite · React 19)</text>

  <!-- Client Box 1: AudioWorklet -->
  <rect x="70" y="170" width="270" height="100" rx="10" fill="#0f172a" stroke="#1e293b" stroke-width="1"/>
  <text x="85" y="195" font-size="13" font-weight="600" fill="#e2e8f0">AudioWorklet (pcm-worklet.js)</text>
  <text x="85" y="215" font-size="11" fill="#94a3b8">• 16kHz mono PCM linear streaming</text>
  <text x="85" y="232" font-size="11" fill="#94a3b8">• Sub-second frame chunks (2048 pts)</text>
  <text x="85" y="249" font-size="11" fill="#94a3b8">• Live voice meter calculation</text>

  <!-- Client Box 2: Voice Orchestration -->
  <rect x="70" y="285" width="270" height="120" rx="10" fill="#0f172a" stroke="#1e293b" stroke-width="1"/>
  <text x="85" y="310" font-size="13" font-weight="600" fill="#e2e8f0">Dual-Engine Voice Hook</text>
  <text x="85" y="330" font-size="11" fill="#38bdf8">Primary: Gnani WebSocket Engine</text>
  <text x="85" y="347" font-size="11" fill="#94a3b8">Fallback: Browser WebSpeech API</text>
  <text x="85" y="364" font-size="11" fill="#94a3b8">• Voice Barge-In / auto echo mute</text>
  <text x="85" y="381" font-size="11" fill="#94a3b8">• Real-time interim transcript display</text>

  <!-- Client Box 3: UI Views -->
  <rect x="70" y="420" width="270" height="110" rx="10" fill="#0f172a" stroke="#1e293b" stroke-width="1"/>
  <text x="85" y="445" font-size="13" font-weight="600" fill="#e2e8f0">Responsive State Engine</text>
  <text x="85" y="465" font-size="11" fill="#94a3b8">• Hero Idea Box + Live Streaming</text>
  <text x="85" y="482" font-size="11" fill="#94a3b8">• Dynamic Clarification Panel</text>
  <text x="85" y="499" font-size="11" fill="#94a3b8">• Blueprint Card + Multi-turn Chat</text>

  <!-- Client Box 4: Audio Player -->
  <rect x="70" y="545" width="270" height="85" rx="10" fill="#0f172a" stroke="#1e293b" stroke-width="1"/>
  <text x="85" y="570" font-size="13" font-weight="600" fill="#e2e8f0">Audio Player &amp; TTS Cache</text>
  <text x="85" y="590" font-size="11" fill="#94a3b8">• new Audio(blobUrl) playback</text>
  <text x="85" y="607" font-size="11" fill="#94a3b8">• Seamless speech loop with safety timeout</text>

  <!-- COLUMN 2: API & BACKEND (FASTAPI) -->
  <rect x="420" y="110" width="360" height="540" rx="14" fill="url(#blueCard)" stroke="#334155" stroke-width="1.5"/>
  <rect x="420" y="110" width="360" height="42" rx="14" fill="#1e293b"/>
  <text x="440" y="137" font-size="14" font-weight="600" fill="#a855f7">FASTAPI BACKEND (Python 3.11)</text>

  <!-- Backend Box 1: Reverse Proxy & Health -->
  <rect x="440" y="170" width="320" height="85" rx="10" fill="#0f172a" stroke="#1e293b" stroke-width="1"/>
  <text x="455" y="195" font-size="13" font-weight="600" fill="#e2e8f0">Nginx &amp; ProxyHeadersMiddleware</text>
  <text x="455" y="215" font-size="11" fill="#94a3b8">• Trusted forward proxy (X-Forwarded-Proto)</text>
  <text x="455" y="232" font-size="11" fill="#94a3b8">• CORS handling (CloudFront / Render / Local)</text>

  <!-- Backend Box 2: Guardrails & Rate Limits -->
  <rect x="440" y="270" width="320" height="95" rx="10" fill="#0f172a" stroke="#1e293b" stroke-width="1"/>
  <text x="455" y="295" font-size="13" font-weight="600" fill="#e2e8f0">Guardrails &amp; Security Layer</text>
  <text x="455" y="315" font-size="11" fill="#f43f5e">• Prompt injection filter (422 INPUT_BLOCKED)</text>
  <text x="455" y="332" font-size="11" fill="#eab308">• Sliding window IP rate limiter (429 Retry-After)</text>
  <text x="455" y="349" font-size="11" fill="#94a3b8">• Input length enforcement (max 1500 chars)</text>

  <!-- Backend Box 3: Real-time STT WebSocket Relay -->
  <rect x="440" y="380" width="320" height="110" rx="10" fill="#0f172a" stroke="#2563eb" stroke-width="1.5"/>
  <text x="455" y="405" font-size="13" font-weight="600" fill="#60a5fa">Real-Time STT WebSocket (/ws/stt)</text>
  <text x="455" y="425" font-size="11" fill="#94a3b8">• Streams binary audio to Gnani Prisma API</text>
  <text x="455" y="442" font-size="11" fill="#94a3b8">• Receives interim &amp; final JSON transcripts</text>
  <text x="455" y="459" font-size="11" fill="#94a3b8">• Multi-origin WebSocket proxy protection</text>
  <text x="455" y="476" font-size="11" fill="#4ade80">• Indic Auto (Hindi, English, Hinglish)</text>

  <!-- Backend Box 4: Document Storage -->
  <rect x="440" y="505" width="320" height="125" rx="10" fill="#0f172a" stroke="#1e293b" stroke-width="1"/>
  <text x="455" y="530" font-size="13" font-weight="600" fill="#e2e8f0">Atomic Document Store</text>
  <text x="455" y="550" font-size="11" fill="#94a3b8">• Sessions &amp; Plans storage with device isolation</text>
  <text x="455" y="567" font-size="11" fill="#94a3b8">• Thread-safe asyncio file locking (tmp + atomic rename)</text>
  <text x="455" y="584" font-size="11" fill="#94a3b8">• SHA-256 disk cache for TTS speech audio</text>
  <text x="455" y="601" font-size="11" fill="#94a3b8">• Ephemeral EBS / persistent EFS architecture</text>

  <!-- COLUMN 3: AI PLATFORMS (GNANI AI & GROQ) -->
  <rect x="840" y="110" width="310" height="540" rx="14" fill="url(#blueCard)" stroke="#334155" stroke-width="1.5"/>
  <rect x="840" y="110" width="310" height="42" rx="14" fill="#1e293b"/>
  <text x="860" y="137" font-size="14" font-weight="600" fill="#4ade80">AI PLATFORMS (Gnani AI · Groq)</text>

  <!-- Platform Box 1: Gnani STT -->
  <rect x="860" y="170" width="270" height="110" rx="10" fill="#0f172a" stroke="#3b82f6" stroke-width="1.5"/>
  <text x="875" y="195" font-size="13" font-weight="600" fill="#60a5fa">Gnani AI Prisma STT</text>
  <text x="875" y="215" font-size="11" fill="#94a3b8">• Endpoint: wss://api.vachana.ai/stt/v3</text>
  <text x="875" y="232" font-size="11" fill="#94a3b8">• Real-time WebSocket streaming</text>
  <text x="875" y="249" font-size="11" fill="#94a3b8">• Code-mixed Indic speech engine</text>
  <text x="875" y="266" font-size="11" fill="#4ade80">• Sub-second low-latency response</text>

  <!-- Platform Box 2: Gnani TTS -->
  <rect x="860" y="295" width="270" height="115" rx="10" fill="#0f172a" stroke="#3b82f6" stroke-width="1.5"/>
  <text x="875" y="320" font-size="13" font-weight="600" fill="#60a5fa">Gnani AI Timbre TTS</text>
  <text x="875" y="340" font-size="11" fill="#94a3b8">• Model: timbre-v2.5 / v3.0</text>
  <text x="875" y="357" font-size="11" fill="#94a3b8">• Voice: Nalini (Natural Indic inflection)</text>
  <text x="875" y="374" font-size="11" fill="#94a3b8">• 24kHz MP3 high-fidelity audio stream</text>
  <text x="875" y="391" font-size="11" fill="#94a3b8">• SHA-256 disk cache (0 token waste)</text>

  <!-- Platform Box 3: Groq LLM -->
  <rect x="860" y="425" width="270" height="205" rx="10" fill="#0f172a" stroke="#f97316" stroke-width="1.5"/>
  <text x="875" y="450" font-size="13" font-weight="600" fill="#fb923c">Groq Inference Engine</text>
  <text x="875" y="470" font-size="11" fill="#94a3b8">• Ultra-fast LPU inference (500+ tok/s)</text>
  <text x="875" y="487" font-size="11" fill="#94a3b8">• Resilient model rotation:</text>
  <text x="890" y="504" font-size="10" fill="#cbd5e1">- openai/gpt-oss-20b</text>
  <text x="890" y="519" font-size="10" fill="#cbd5e1">- qwen/qwen3.8-27b</text>
  <text x="890" y="534" font-size="10" fill="#cbd5e1">- llama-3.1-8b-instant</text>
  <text x="875" y="555" font-size="11" fill="#94a3b8">• Pydantic V2 schema repair loop</text>
  <text x="875" y="572" font-size="11" fill="#94a3b8">• Multi-language prompt formatting</text>
  <text x="875" y="589" font-size="11" fill="#94a3b8">• Scoped markdown blueprint outputs</text>
  <text x="875" y="606" font-size="11" fill="#4ade80">• Multi-turn conversational diffs</text>

  <!-- CONNECTING ARROWS -->
  <!-- Client to Backend WS -->
  <path d="M360 435 L440 435" stroke="#38bdf8" stroke-width="2" stroke-dasharray="4,4" fill="none"/>
  <!-- Backend WS to Gnani STT -->
  <path d="M760 435 L860 225" stroke="#38bdf8" stroke-width="2" fill="none"/>
  <!-- Backend to Groq -->
  <path d="M760 520 L860 520" stroke="#f97316" stroke-width="2" fill="none"/>
  <!-- Backend to Gnani TTS -->
  <path d="M760 350 L860 350" stroke="#3b82f6" stroke-width="2" fill="none"/>
</svg>
`;

// 2. Deployment SVG
const deploymentSvg = `
<svg width="1200" height="600" viewBox="0 0 1200 600" xmlns="http://www.w3.org/2000/svg" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif">
  <defs>
    <linearGradient id="dbg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#070a13"/>
      <stop offset="100%" stop-color="#0f172a"/>
    </linearGradient>
    <linearGradient id="cardBg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1e293b"/>
      <stop offset="100%" stop-color="#0f172a"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="1200" height="600" fill="url(#dbg)"/>
  
  <!-- Subtle Grid Lines -->
  <g stroke="#ffffff" stroke-opacity="0.04" stroke-width="1">
    ${Array.from({length: 25}, (_, i) => `<line x1="${i*50}" y1="0" x2="${i*50}" y2="600"/>`).join('')}
    ${Array.from({length: 13}, (_, i) => `<line x1="0" y1="${i*50}" x2="1200" y2="${i*50}"/>`).join('')}
  </g>

  <!-- Title Header -->
  <text x="50" y="55" font-size="24" font-weight="700" fill="#f8fafc" letter-spacing="0.5">Sutra · CI/CD &amp; Multi-Cloud Deployment</text>
  <text x="50" y="80" font-size="13" font-weight="400" fill="#94a3b8">Docker-Free AWS Elastic Beanstalk (Python 3.11), CloudFront CDN, and Dual-Cloud Render Deployment</text>

  <!-- STEP 1: GITHUB -->
  <rect x="50" y="120" width="220" height="420" rx="12" fill="url(#cardBg)" stroke="#334155" stroke-width="1.5"/>
  <rect x="50" y="120" width="220" height="40" rx="12" fill="#1e293b"/>
  <text x="70" y="145" font-size="14" font-weight="600" fill="#f8fafc">1. SOURCE REPO</text>
  <text x="70" y="185" font-size="13" font-weight="600" fill="#38bdf8">GitHub Repository</text>
  <text x="70" y="205" font-size="11" fill="#94a3b8">ankit-cybertron/sutra</text>
  <text x="70" y="235" font-size="12" fill="#e2e8f0">• Push to main</text>
  <text x="70" y="255" font-size="12" fill="#e2e8f0">• Pull requests</text>
  <text x="70" y="275" font-size="12" fill="#e2e8f0">• workflow_dispatch</text>
  
  <rect x="68" y="320" width="184" height="190" rx="8" fill="#0f172a" stroke="#1e293b"/>
  <text x="80" y="345" font-size="12" font-weight="600" fill="#94a3b8">Artifact Structure:</text>
  <text x="80" y="370" font-size="11" fill="#cbd5e1">├── Procfile</text>
  <text x="80" y="390" font-size="11" fill="#cbd5e1">├── requirements.txt</text>
  <text x="80" y="410" font-size="11" fill="#cbd5e1">├── application.py</text>
  <text x="80" y="430" font-size="11" fill="#cbd5e1">├── .ebextensions/</text>
  <text x="80" y="450" font-size="11" fill="#cbd5e1">└── apps/</text>

  <!-- STEP 2: GITHUB ACTIONS -->
  <rect x="310" y="120" width="250" height="420" rx="12" fill="url(#cardBg)" stroke="#334155" stroke-width="1.5"/>
  <rect x="310" y="120" width="250" height="40" rx="12" fill="#1e293b"/>
  <text x="330" y="145" font-size="14" font-weight="600" fill="#a855f7">2. GITHUB ACTIONS</text>

  <rect x="328" y="180" width="214" height="150" rx="8" fill="#0f172a" stroke="#1e293b"/>
  <text x="340" y="205" font-size="12" font-weight="600" fill="#c084fc">Pipeline (.github/workflows)</text>
  <text x="340" y="230" font-size="11" fill="#94a3b8">1. Setup Python 3.11</text>
  <text x="340" y="250" font-size="11" fill="#94a3b8">2. Install dependencies</text>
  <text x="340" y="270" font-size="11" fill="#94a3b8">3. Run Pytest test suite</text>
  <text x="340" y="290" font-size="11" fill="#94a3b8">4. Build zip artifact</text>
  <text x="340" y="310" font-size="11" fill="#4ade80">5. AWS OIDC Auth (Keyless)</text>

  <rect x="328" y="345" width="214" height="165" rx="8" fill="#0f172a" stroke="#1e293b"/>
  <text x="340" y="370" font-size="12" font-weight="600" fill="#38bdf8">Zero-Docker Guarantee:</text>
  <text x="340" y="395" font-size="11" fill="#94a3b8">• No Docker daemon build</text>
  <text x="340" y="415" font-size="11" fill="#94a3b8">• No ECR registry push</text>
  <text x="340" y="435" font-size="11" fill="#94a3b8">• Native zip deployment</text>
  <text x="340" y="455" font-size="11" fill="#94a3b8">• Fast &lt; 90s build time</text>
  <text x="340" y="475" font-size="11" fill="#4ade80">• OIDC Role: ap-south-1</text>

  <!-- STEP 3: AWS PRODUCTION CLOUD -->
  <rect x="600" y="120" width="310" height="420" rx="12" fill="url(#cardBg)" stroke="#f59e0b" stroke-width="1.5"/>
  <rect x="600" y="120" width="310" height="40" rx="12" fill="#1e293b"/>
  <text x="620" y="145" font-size="14" font-weight="600" fill="#fbbf24">3. AWS CLOUD (ap-south-1)</text>

  <!-- Elastic Beanstalk Box -->
  <rect x="620" y="180" width="270" height="150" rx="8" fill="#0f172a" stroke="#1e293b"/>
  <text x="635" y="205" font-size="13" font-weight="600" fill="#f8fafc">AWS Elastic Beanstalk</text>
  <text x="635" y="225" font-size="11" fill="#fbbf24">App: sutra · Env: sutra-pod</text>
  <text x="635" y="245" font-size="11" fill="#94a3b8">• Platform: Python 3.11 on AL2023</text>
  <text x="635" y="265" font-size="11" fill="#94a3b8">• Gunicorn + UvicornWorker</text>
  <text x="635" y="285" font-size="11" fill="#94a3b8">• Proxy: Nginx on EC2</text>
  <text x="635" y="305" font-size="11" fill="#4ade80">• Health Check: /api/health</text>

  <!-- CloudFront & Edge -->
  <rect x="620" y="345" width="270" height="165" rx="8" fill="#0f172a" stroke="#1e293b"/>
  <text x="635" y="370" font-size="13" font-weight="600" fill="#38bdf8">CloudFront &amp; Edge CDN</text>
  <text x="635" y="390" font-size="11" fill="#38bdf8">d3dv21umcveu3t.cloudfront.net</text>
  <text x="635" y="415" font-size="11" fill="#94a3b8">• Global SSL edge caching</text>
  <text x="635" y="435" font-size="11" fill="#94a3b8">• ACM automated certificate</text>
  <text x="635" y="455" font-size="11" fill="#94a3b8">• Application Load Balancer (ALB)</text>
  <text x="635" y="475" font-size="11" fill="#94a3b8">• Forwarded proto / IP preservation</text>

  <!-- STEP 4: MULTI-CLOUD (RENDER) -->
  <rect x="940" y="120" width="210" height="420" rx="12" fill="url(#cardBg)" stroke="#334155" stroke-width="1.5"/>
  <rect x="940" y="120" width="210" height="40" rx="12" fill="#1e293b"/>
  <text x="960" y="145" font-size="14" font-weight="600" fill="#22c55e">4. MULTI-CLOUD</text>

  <rect x="958" y="180" width="174" height="330" rx="8" fill="#0f172a" stroke="#1e293b"/>
  <text x="970" y="205" font-size="13" font-weight="600" fill="#4ade80">Render PaaS Cloud</text>
  <text x="970" y="225" font-size="11" fill="#38bdf8">sutra-x3ws.onrender.com</text>
  
  <text x="970" y="260" font-size="11" fill="#94a3b8">• Direct git webhook push</text>
  <text x="970" y="280" font-size="11" fill="#94a3b8">• Zero-downtime rollouts</text>
  <text x="970" y="300" font-size="11" fill="#94a3b8">• WebSocket sticky session</text>
  <text x="970" y="320" font-size="11" fill="#94a3b8">• Automated Let's Encrypt</text>
  <text x="970" y="340" font-size="11" fill="#94a3b8">• Multi-region redundancy</text>
  <text x="970" y="375" font-size="11" fill="#4ade80">Active Fallback &amp; Live Mirror</text>

  <!-- CONNECTIONS -->
  <path d="M270 240 L310 240" stroke="#38bdf8" stroke-width="2" fill="none"/>
  <path d="M560 240 L600 240" stroke="#f59e0b" stroke-width="2" fill="none"/>
  <path d="M270 290 L940 290" stroke="#22c55e" stroke-width="1.5" stroke-dasharray="4,4" fill="none"/>
</svg>
`;

// 3. YouTube Thumbnail SVG
const youtubeThumbnailSvg = `
<svg width="1280" height="720" viewBox="0 0 1280 720" xmlns="http://www.w3.org/2000/svg" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif">
  <defs>
    <linearGradient id="ytBg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#050811"/>
      <stop offset="50%" stop-color="#0a0f1d"/>
      <stop offset="100%" stop-color="#020408"/>
    </linearGradient>
    <radialGradient id="glowCenter" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.25"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="redAccent" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ef4444"/>
      <stop offset="100%" stop-color="#b91c1c"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="1280" height="720" fill="url(#ytBg)"/>
  <circle cx="640" cy="360" r="450" fill="url(#glowCenter)"/>

  <!-- Subtle Blueprint Grid -->
  <g stroke="#ffffff" stroke-opacity="0.05" stroke-width="1.5">
    ${Array.from({length: 26}, (_, i) => `<line x1="${i*50}" y1="0" x2="${i*50}" y2="720"/>`).join('')}
    ${Array.from({length: 15}, (_, i) => `<line x1="0" y1="${i*50}" x2="1280" y2="${i*50}"/>`).join('')}
  </g>

  <!-- Top Badges -->
  <g transform="translate(80, 80)">
    <rect x="0" y="0" width="160" height="36" rx="6" fill="#1e293b" stroke="#334155"/>
    <text x="20" y="23" font-size="13" font-weight="700" fill="#38bdf8" letter-spacing="1">PRODUCT DEMO</text>

    <rect x="180" y="0" width="220" height="36" rx="6" fill="#1e293b" stroke="#334155"/>
    <text x="200" y="23" font-size="13" font-weight="600" fill="#94a3b8">GNANI AI · GROQ LLM</text>

    <rect x="420" y="0" width="190" height="36" rx="6" fill="url(#redAccent)"/>
    <text x="440" y="23" font-size="13" font-weight="700" fill="#ffffff" letter-spacing="0.5">FULL 4K WALKTHROUGH</text>
  </g>

  <!-- Giant Title -->
  <text x="80" y="220" font-size="76" font-weight="900" fill="#ffffff" letter-spacing="-1">SUTRA</text>
  <text x="80" y="280" font-size="34" font-weight="700" fill="#38bdf8">Say the idea. Skip the rambling.</text>
  
  <text x="80" y="340" font-size="20" font-weight="400" fill="#94a3b8" max-width="600">
    Voice-first architecture scoper for builders who brainstorm out loud in Hindi, Hinglish, &amp; English.
  </text>

  <!-- Feature Pills -->
  <g transform="translate(80, 390)">
    <rect x="0" y="0" width="290" height="50" rx="8" fill="#0f172a" stroke="#1e293b"/>
    <text x="24" y="31" font-size="15" font-weight="600" fill="#f8fafc">🎙️ Gnani AI Prisma Realtime STT</text>

    <rect x="310" y="0" width="280" height="50" rx="8" fill="#0f172a" stroke="#1e293b"/>
    <text x="334" y="31" font-size="15" font-weight="600" fill="#f8fafc">🔊 Gnani AI Timbre v2.5 TTS</text>

    <rect x="610" y="0" width="280" height="50" rx="8" fill="#0f172a" stroke="#1e293b"/>
    <text x="634" y="31" font-size="15" font-weight="600" fill="#f8fafc">⚡ Groq LPU Schema Synthesis</text>
  </g>

  <!-- Giant Center Play Button -->
  <g transform="translate(980, 360)">
    <circle cx="0" cy="0" r="75" fill="#ffffff" filter="drop-shadow(0 0 30px rgba(59,130,246,0.6))"/>
    <polygon points="-18,-30 32,0 -18,30" fill="#090d16"/>
  </g>

  <!-- Bottom Timeline / Meta -->
  <g transform="translate(80, 600)">
    <rect x="0" y="0" width="1120" height="60" rx="10" fill="#0b1120" stroke="#1e293b"/>
    <text x="30" y="36" font-size="15" font-weight="600" fill="#cbd5e1">00:00 Hinglish Voice Intake</text>
    <text x="280" y="36" font-size="15" font-weight="600" fill="#cbd5e1">01:05 Realtime STT Stream</text>
    <text x="540" y="36" font-size="15" font-weight="600" fill="#cbd5e1">02:10 Scoped Blueprint</text>
    <text x="780" y="36" font-size="15" font-weight="600" fill="#cbd5e1">02:50 Live Voice Refinements</text>
    <text x="1030" y="36" font-size="15" font-weight="700" fill="#38bdf8">03:12</text>
  </g>
</svg>
`;

fs.writeFileSync(path.join(assetsDir, 'architecture.svg'), architectureSvg.trim());
fs.writeFileSync(path.join(assetsDir, 'deployment.svg'), deploymentSvg.trim());
fs.writeFileSync(path.join(assetsDir, 'youtube-thumbnail.svg'), youtubeThumbnailSvg.trim());
console.log('SVGs generated successfully in docs/assets/');

// Render PNGs with Playwright
async function renderPngs() {
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  });
  const page = await browser.newPage();

  async function convert(svgPath, pngPath, width, height) {
    const svgContent = fs.readFileSync(svgPath, 'utf8');
    await page.setViewportSize({ width, height });
    const html = '<!DOCTYPE html><html><body style="margin:0;padding:0;overflow:hidden;">' + svgContent + '</body></html>';
    await page.setContent(html);
    await page.screenshot({ path: pngPath, omitBackground: false });
    console.log('Rendered ' + pngPath);
  }

  await convert(path.join(assetsDir, 'architecture.svg'), path.join(assetsDir, 'architecture.png'), 1200, 700);
  await convert(path.join(assetsDir, 'deployment.svg'), path.join(assetsDir, 'deployment.png'), 1200, 600);
  await convert(path.join(assetsDir, 'youtube-thumbnail.svg'), path.join(assetsDir, 'youtube-thumbnail.png'), 1280, 720);

  await browser.close();
  console.log('All PNGs successfully rendered!');
}

renderPngs().catch(console.error);
