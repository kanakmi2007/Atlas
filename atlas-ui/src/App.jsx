import React, { useState, useEffect, useRef } from 'react';
import {
  Compass, ArrowRight, Zap, UploadCloud, ShieldAlert, Globe, FileCheck2,
  Send, ArrowLeft, Play, CheckCircle2, AlertTriangle, TrendingDown,
  Ship, Package, Sparkles, X, Copy, Check, Sliders, BarChart3,
  Search, Mail, Plane
} from 'lucide-react';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, ArcElement,
  Title, Tooltip, Legend
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend);

function WelcomeScreen({ onSelectPreset }) {
  const presets = [
    {
      icon: Search,
      iconBg: 'bg-sky-50 text-sky-600 border border-sky-100',
      title: 'Audit supply_chain_manifest.csv for top risk exposure',
      cmd: 'Audit supply_chain_manifest.csv for top risk exposure'
    },
    {
      icon: Mail,
      iconBg: 'bg-rose-50 text-rose-600 border border-rose-100',
      title: 'Draft an SLA escalation email for SHP-2004',
      cmd: 'Draft an SLA escalation email for SHP-2004'
    },
    {
      icon: Plane,
      iconBg: 'bg-indigo-50 text-indigo-600 border border-indigo-100',
      title: 'Simulate a 14-day delay with 35% air freight reroute',
      cmd: 'Simulate a 14-day delay with 35% air freight reroute'
    },
    {
      icon: Package,
      iconBg: 'bg-amber-50 text-amber-600 border border-amber-100',
      title: 'Which items are under 14 days of warehouse stock cover?',
      cmd: 'Which items are under 14 days of warehouse stock cover?'
    }
  ];

  return (
    <div className="h-full min-h-[340px] flex flex-col items-center justify-center p-4 text-center">
      <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-2xs mb-3">
        <Sparkles className="w-6 h-6 text-indigo-600" />
      </div>
      <h3 className="text-base font-bold text-slate-900">Welcome to Atlas Co-Pilot</h3>
      <p className="text-xs text-slate-500 max-w-xs mt-1 mb-5">
        Your autonomous supply chain agent. Spot delayed suppliers, reroute ships, and prevent stockouts.
      </p>

      <div className="w-full max-w-sm space-y-2">
        <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider text-left mb-1.5 px-1">
          Try asking Atlas:
        </div>
        {presets.map((card, idx) => (
          <button
            key={idx}
            onClick={() => onSelectPreset(card.cmd)}
            className="w-full text-left p-3 rounded-xl bg-white border border-slate-200 hover:border-indigo-300 hover:shadow-xs transition-all flex items-center gap-3 cursor-pointer group"
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${card.iconBg}`}>
              <card.icon className="w-4 h-4" />
            </div>
            <span className="text-xs font-medium text-slate-700 group-hover:text-indigo-600 transition-colors flex-1 leading-snug">
              {card.title}
            </span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const [view, setView] = useState('hero'); // 'hero' | 'workspace'
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'actions' | 'simulator' | 'schedule'
  const [activeFile, setActiveFile] = useState('supply_chain_manifest.csv');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  // Live Supply Chain State
  const [metrics, setMetrics] = useState({
    money_at_risk: '$3.29M',
    ships_rerouted: '4 Ships',
    items_running_low: '5 Items'
  });
  const [liveActions, setLiveActions] = useState({ escalations: [], purchase_orders: [], scorecard: [] });
  const [scheduleRows, setScheduleRows] = useState([]);
  const [issuedPOs, setIssuedPOs] = useState({});
  const [autopilotDone, setAutopilotDone] = useState(false);

  // Simulator Sliders
  const [simDelay, setSimDelay] = useState(8);
  const [simAir, setSimAir] = useState(20);
  const [simBuf, setSimBuf] = useState(15);

  // Email Modal
  const [emailModal, setEmailModal] = useState(null);
  const [copied, setCopied] = useState(false);

  const fileInputRef = useRef(null);
  const chatEndRef = useRef(null);

  // Robust API Fetcher (respects VITE_API_BASE_URL, relative proxy, and local fallback)
  const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

  const fetchApi = async (endpoint, options = {}) => {
    const fullUrl = endpoint.startsWith('http')
      ? endpoint
      : API_BASE
      ? `${API_BASE}${endpoint}`
      : endpoint;

    try {
      const res = await fetch(fullUrl, options);
      if (res.ok) return await res.json();
      throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      if (!endpoint.startsWith('http')) {
        for (const port of [8080, 8001]) {
          try {
            const res2 = await fetch(`http://127.0.0.1:${port}${endpoint}`, options);
            if (res2.ok) return await res2.json();
          } catch {}
        }
      }
      throw err;
    }
  };

  useEffect(() => {
    fetchApi('/initial-state')
      .then(d => {
        if (d.active_csv) setActiveFile(d.active_csv);
        if (d.metrics) setMetrics(d.metrics);
        if (d.live_actions) setLiveActions(d.live_actions);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const loadScheduleCsv = async (url) => {
    try {
      let res;
      const targetUrl = url.startsWith('http') ? url : (API_BASE ? `${API_BASE}${url}` : url);
      try {
        res = await fetch(targetUrl);
        if (!res.ok) throw new Error('Not ok');
      } catch {
        const direct = url.startsWith('http') ? url : `http://127.0.0.1:8080${url}`;
        try {
          res = await fetch(direct);
        } catch {
          res = await fetch(`http://127.0.0.1:8001${url}`);
        }
      }
      const text = await res.text();
      const lines = text.trim().split('\n');
      if (lines.length < 2) return;
      const headers = lines[0].split(',');
      const rows = lines.slice(1).map(line => {
        const cols = line.split(',');
        const obj = {};
        headers.forEach((h, i) => (obj[h.trim()] = cols[i]?.trim() || ''));
        return obj;
      });
      setScheduleRows(rows);
    } catch {}
  };

  const executeUiAction = (action) => {
    if (!action) return;
    if (action.type === 'switch_tab') {
      setActiveTab(action.tab);
    } else if (action.type === 'open_email') {
      openEmailFor(action.supplier, action.shipment_id, action.value, action.lead_time);
    } else if (action.type === 'run_sim') {
      setActiveTab('simulator');
      setSimDelay(action.delay ?? 8);
      setSimAir(action.air ?? 20);
      setSimBuf(action.buffer ?? 15);
    } else if (action.type === 'autopilot_resolve') {
      setActiveTab('actions');
      triggerAutopilot();
    }
  };

  const handleClearChat = () => {
    setMessages([]);
    setInput('');
    setLoading(false);
  };

  const sendMessage = async (textToSend) => {
    const query = (textToSend ?? input).trim();
    if (!query) return;
    if (!textToSend) setInput('');

    setMessages(prev => [...prev, { role: 'user', text: query }]);
    setLoading(true);

    try {
      let data;
      try {
        data = await fetchApi('/api/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: query, query })
        });
      } catch {
        data = await fetchApi('/webhook', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: query })
        });
      }

      const reply = data.reply || data.response || data.answer || 'Audit complete.';
      setMessages(prev => [...prev, { role: 'ai', text: reply }]);
      if (data.metrics) setMetrics(data.metrics);
      if (data.live_actions) setLiveActions(data.live_actions);
      if (data.ui_action) executeUiAction(data.ui_action);
      if (data.artifacts?.csv) loadScheduleCsv(data.artifacts.csv + '?t=' + Date.now());
    } catch (err) {
      setMessages(prev => [...prev, { role: 'ai', text: 'Backend server is unreachable. Make sure uvicorn is running on port 8080.' }]);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setView('workspace');
    setActiveFile(file.name);
    setMessages(prev => [...prev, { role: 'user', text: `Uploaded ${file.name}` }]);
    setLoading(true);

    const formData = new FormData();
    formData.append('file', file);
    try {
      const data = await fetchApi('/upload-csv', { method: 'POST', body: formData });
      setMessages(prev => [...prev, { role: 'ai', text: data.reply }]);
      if (data.metrics) setMetrics(data.metrics);
      if (data.live_actions) setLiveActions(data.live_actions);
      if (data.artifacts?.csv) loadScheduleCsv(data.artifacts.csv + '?t=' + Date.now());
    } catch {
      setMessages(prev => [...prev, { role: 'ai', text: 'Failed to upload CSV. Check backend server on port 8080.' }]);
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  const openEmailFor = (supplier, shpId, value, leadTime) => {
    setEmailModal({
      supplier,
      shpId,
      body: `Subject: URGENT SLA Escalation & Expedited Air-Split Request — ${shpId}\n\nDear ${supplier} Operations Team,\n\nShipment ${shpId} (Cargo Value: ${value}) is currently tracking at ${leadTime}, exceeding our 14-day contractual SLA threshold.\n\nDue to Red Sea / Suez disruptions, please confirm within 24 hours:\n1. Current ex-works readiness status for ${shpId}.\n2. Feasibility of splitting 20% onto priority air freight to prevent line stoppage.\n\nRegards,\nSupply Chain Operations — Atlas AI`
    });
    setCopied(false);
  };

  const triggerAutopilot = () => {
    setAutopilotDone(true);
    const all = {};
    liveActions.purchase_orders?.forEach(po => (all[po.po_id] = true));
    setIssuedPOs(all);
  };

  // Simulator Math
  const simLoss = Math.max(0.15, simDelay * 0.24 - simAir * 0.025 - simBuf * 0.015).toFixed(2);
  const simCost = Math.round(simAir * 19000 + simBuf * 4500).toLocaleString();
  const simSaved = Math.max(1.1, 6.4 - parseFloat(simLoss) - simAir * 0.01).toFixed(2);

  // Soft Pastel Interactive Chart Data
  const barData = {
    labels: (liveActions.scorecard || []).slice(0, 6).map(s => s.supplier.split(' ')[0]),
    datasets: [
      {
        label: 'Vendor Reliability Score',
        data: (liveActions.scorecard || []).slice(0, 6).map(s => s.score),
        backgroundColor: (liveActions.scorecard || []).slice(0, 6).map(s =>
          s.score < 60 ? '#FB7185' : s.score < 80 ? '#FBBF24' : '#6366F1'
        ),
        borderRadius: 8
      }
    ]
  };

  const doughnutData = {
    labels: ['Red Sea / Suez (Rerouted)', 'Trans-Pacific (Clear)', 'Regional Short-Sea'],
    datasets: [
      {
        data: [58, 25, 17],
        backgroundColor: ['#FB7185', '#60A5FA', '#34D399'],
        borderWidth: 0
      }
    ]
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 font-sans selection:bg-indigo-100 overflow-x-hidden">
      <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />

      {/* ==================== HERO VIEW (Modern Clean SaaS) ==================== */}
      {view === 'hero' && (
        <div className="min-h-screen flex flex-col justify-between bg-gradient-to-b from-slate-50 via-white to-slate-50 relative overflow-hidden">
          {/* Subtle warm ambient glow in background */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[450px] bg-gradient-to-b from-indigo-100/50 via-sky-50/40 to-transparent rounded-full blur-3xl pointer-events-none -z-10" />

          {/* Top Navbar */}
          <header className="max-w-7xl w-full mx-auto px-6 sm:px-8 py-6 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-sm shrink-0">
                <Compass className="w-5 h-5 text-white stroke-[2.5]" />
              </div>
              <span className="text-xl font-bold tracking-tight text-slate-900">
                Atlas<span className="text-indigo-600">AI</span>
              </span>
            </div>

            <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
              <button onClick={() => { setView('workspace'); setActiveTab('overview'); }} className="hover:text-indigo-600 transition-colors cursor-pointer">Live Analytics</button>
              <button onClick={() => { setView('workspace'); setActiveTab('simulator'); }} className="hover:text-indigo-600 transition-colors cursor-pointer">What-If Simulator</button>
              <button onClick={() => { setView('workspace'); setActiveTab('actions'); }} className="hover:text-indigo-600 transition-colors cursor-pointer">Action Center</button>
            </div>

            <button
              onClick={() => { setView('workspace'); sendMessage('Audit supply_chain_manifest.csv'); }}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-all flex items-center gap-2 shadow-sm hover:shadow cursor-pointer whitespace-nowrap shrink-0"
            >
              Launch Command Center <ArrowRight className="w-4 h-4" />
            </button>
          </header>

          {/* Hero Main */}
          <main className="max-w-7xl w-full mx-auto px-6 sm:px-8 py-8 sm:py-16 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-50 border border-indigo-200/60 text-indigo-700 text-xs font-semibold shadow-2xs">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" /> Autonomous Supply Chain Decision Engine
              </div>
              <h1 className="text-4xl sm:text-6xl font-bold tracking-tight leading-[1.12] text-slate-900">
                Resilient <span className="bg-gradient-to-r from-indigo-600 to-sky-600 bg-clip-text text-transparent">Logistics</span> Designed for Real Operations.
              </h1>
              <p className="text-slate-600 text-base sm:text-lg max-w-xl leading-relaxed">
                Detect delayed suppliers, simulate geopolitical sea detours, generate emergency purchase orders, and execute vendor SLA escalations in seconds.
              </p>
              <div className="flex flex-wrap gap-4 pt-2">
                <button
                  onClick={() => { setView('workspace'); sendMessage('Audit supply_chain_manifest.csv'); }}
                  className="px-7 py-3.5 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm hover:shadow transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap"
                >
                  Run Live Supply Audit <Zap className="w-4 h-4 text-indigo-200" />
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-7 py-3.5 rounded-xl text-sm font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-sm hover:shadow transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap"
                >
                  <UploadCloud className="w-4 h-4 text-indigo-600" /> Upload Shipment CSV
                </button>
              </div>
            </div>

            {/* Feature Cards in Soft Pastel Surfaces */}
            <div className="lg:col-span-5 space-y-4">
              {[
                {
                  icon: ShieldAlert,
                  iconBg: 'bg-rose-50 text-rose-600 border border-rose-100',
                  hoverBorder: 'hover:border-rose-300',
                  title: 'Autonomous Vendor Risk Audit',
                  desc: 'Grade suppliers A–D and quantify financial exposure',
                  action: () => { setView('workspace'); sendMessage('Audit supply_chain_manifest.csv'); }
                },
                {
                  icon: Globe,
                  iconBg: 'bg-sky-50 text-sky-600 border border-sky-100',
                  hoverBorder: 'hover:border-sky-300',
                  title: 'Live Disruption & Air-Freight Simulator',
                  desc: 'Model Cape detours vs. priority airlift costs',
                  action: () => { setView('workspace'); setActiveTab('simulator'); }
                },
                {
                  icon: FileCheck2,
                  iconBg: 'bg-amber-50 text-amber-600 border border-amber-100',
                  hoverBorder: 'hover:border-amber-300',
                  title: '1-Click PO & SLA Escalation Engine',
                  desc: 'Auto-draft supplier notices & buffer restocks',
                  action: () => { setView('workspace'); setActiveTab('actions'); }
                }
              ].map((card, i) => (
                <button
                  key={i}
                  onClick={card.action}
                  className={`w-full text-left p-5 rounded-2xl bg-white border border-slate-200 shadow-sm hover:shadow-md ${card.hoverBorder} transition-all flex items-center justify-between group cursor-pointer`}
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${card.iconBg}`}>
                      <card.icon className="w-6 h-6" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-base text-slate-900 truncate">{card.title}</div>
                      <div className="text-xs text-slate-500 mt-0.5 truncate">{card.desc}</div>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all shrink-0 ml-2" />
                </button>
              ))}
            </div>
          </main>

          <footer className="max-w-7xl w-full mx-auto px-6 sm:px-8 py-6 border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
            <span>Atlas AI • Autonomous Supply Chain Command</span>
            <span>Powered by Gemini 3.8 + Antigravity Engine</span>
          </footer>
        </div>
      )}

      {/* ==================== WORKSPACE VIEW (Clean SaaS Layout) ==================== */}
      {view === 'workspace' && (
        <div className="h-screen flex flex-col overflow-hidden bg-[#F8FAFC]">
          {/* Top Navigation */}
          <header className="h-14 shrink-0 px-4 sm:px-6 border-b border-slate-200 bg-white flex items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={() => setView('hero')}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5 text-slate-500" /> Home
              </button>
              <span className="font-bold text-sm text-slate-900 hidden sm:inline whitespace-nowrap">
                Atlas<span className="text-indigo-600">AI</span> Workspace
              </span>
              <span className="font-mono text-xs text-indigo-700 bg-indigo-50 border border-indigo-200/60 px-2.5 py-0.5 rounded-md truncate max-w-[160px] sm:max-w-[260px]">
                {activeFile}
              </span>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-2xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap transition-colors"
              >
                <UploadCloud className="w-3.5 h-3.5 text-indigo-600" /> Upload CSV
              </button>
              <button
                onClick={() => sendMessage('Audit supply_chain_manifest.csv')}
                className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap transition-all"
              >
                <Play className="w-3.5 h-3.5 fill-current" /> Run Full Audit
              </button>
            </div>
          </header>

          {/* Main 2-Pane Split */}
          <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
            {/* Left AI Co-Pilot (42%) */}
            <section className="w-full lg:w-[42%] lg:max-w-[480px] border-b lg:border-b-0 lg:border-r border-slate-200 flex flex-col bg-white shrink-0 h-1/2 lg:h-full">
              <div className="h-12 shrink-0 px-5 border-b border-slate-200 flex items-center justify-between bg-white">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Atlas Supply Chain Co-Pilot
                </div>
                <button
                  onClick={handleClearChat}
                  className="text-xs font-medium text-slate-400 hover:text-slate-700 cursor-pointer transition-colors"
                >
                  Clear Chat
                </button>
              </div>

              {/* Chat Message Bubble Rendering (CLEAN TEXT ONLY, NO DUPLICATE KPI CARDS) */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 bg-slate-50/60">
                {messages.length === 0 ? (
                  <WelcomeScreen onSelectPreset={cmd => sendMessage(cmd)} />
                ) : (
                  messages.map((m, idx) => (
                    <div key={idx} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                      <div
                        className={`max-w-[92%] rounded-2xl p-4 text-sm leading-relaxed ${
                          m.role === 'user'
                            ? 'bg-indigo-600 text-white rounded-tr-sm shadow-xs'
                            : 'bg-white border border-slate-200 text-slate-800 rounded-tl-sm shadow-sm'
                        }`}
                      >
                        <div className="whitespace-pre-line">{m.text}</div>
                      </div>
                    </div>
                  ))
                )}
                {loading && (
                  <div className="bg-white border border-slate-200 rounded-2xl p-4 text-xs text-indigo-600 shadow-sm flex items-center gap-2.5 animate-pulse">
                    <span className="w-2 h-2 rounded-full bg-indigo-600 animate-ping" />
                    Atlas is analyzing your supply chain data...
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Enhanced Quick-Action Pills Above Input Box */}
              <div className="px-4 py-2.5 flex flex-wrap gap-2 border-t border-slate-200 bg-white">
                {[
                  { label: 'Riskiest Supplier?', cmd: 'Which supplier has the highest financial risk?' },
                  { label: 'Draft SHP-2004 Email', cmd: 'Draft an SLA escalation email for SHP-2004' },
                  { label: 'Simulate 14d Delay', cmd: 'Simulate a 14 day delay with 35% air freight' },
                  { label: 'Autopilot Resolve', cmd: 'Auto-resolve all critical risks right now' }
                ].map((chip, i) => (
                  <button
                    key={i}
                    onClick={() => sendMessage(chip.cmd)}
                    className="text-xs px-3.5 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition-all cursor-pointer whitespace-nowrap border border-slate-200/80 shadow-2xs hover:shadow-xs"
                  >
                    {chip.label}
                  </button>
                ))}
              </div>

              {/* Scrollable / Auto-expanding Textarea Chat Input */}
              <div className="p-3 sm:p-4 bg-white border-t border-slate-200">
                <div className="flex items-end gap-2 bg-slate-50 border border-slate-200 rounded-2xl p-2 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-100 transition-all shadow-2xs">
                  <textarea
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                    placeholder="Ask Atlas anything (e.g. 'Which suppliers breached SLA this week?')..."
                    rows={1}
                    className="flex-1 min-w-0 bg-transparent text-slate-900 placeholder-slate-400 focus:outline-none resize-none text-sm leading-relaxed py-1 px-2 max-h-32 overflow-y-auto"
                    style={{ minHeight: '44px', maxHeight: '120px' }}
                  />
                  <button
                    onClick={() => sendMessage()}
                    disabled={!input.trim() || loading}
                    className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium text-xs flex items-center gap-1.5 cursor-pointer shrink-0 transition-all shadow-xs"
                  >
                    Send <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </section>

            {/* Right Interactive Command Canvas (58%) */}
            <section className="flex-1 flex flex-col min-w-0 bg-[#F8FAFC] h-1/2 lg:h-full overflow-hidden">
              {/* Canvas Tab Navigation */}
              <div className="h-12 shrink-0 px-4 sm:px-6 border-b border-slate-200 bg-white flex items-center justify-between gap-3 overflow-x-auto shadow-xs">
                <div className="flex items-center gap-2 shrink-0">
                  {[
                    { id: 'overview', label: 'Live Analytics', icon: BarChart3 },
                    { id: 'actions', label: 'Action Center', icon: Zap },
                    { id: 'simulator', label: 'What-If Simulator', icon: Sliders },
                    { id: 'schedule', label: 'Rerouted Schedule', icon: Ship }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                        activeTab === tab.id
                          ? 'bg-indigo-50 text-indigo-700 border border-indigo-200/80 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                      }`}
                    >
                      <tab.icon className="w-3.5 h-3.5" /> {tab.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <a href="/outputs/revised_logistics_schedule.csv" download className="px-3 py-1 rounded-lg text-xs font-medium bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 shadow-2xs whitespace-nowrap transition-colors">CSV</a>
                  <a href="/outputs/Executive_Supply_Chain_Audit.pdf" download className="px-3 py-1 rounded-lg text-xs font-medium bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 shadow-2xs whitespace-nowrap transition-colors">PDF</a>
                </div>
              </div>

              {/* Canvas Content Body */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
                {/* TAB 1: INTERACTIVE ANALYTICS & VENDOR GRADES */}
                {activeTab === 'overview' && (
                  <>
                    {/* Top Level Metric Cards with Soft Pastel Accents */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {/* At Risk Card (Pastel Coral/Blush) */}
                      <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
                        <div className="flex items-center justify-between text-xs text-slate-500">
                          <span className="font-semibold text-slate-700">Exposure at Risk</span>
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#FECDD3] text-[#E11D48] flex items-center gap-1">
                            <TrendingDown className="w-3 h-3" /> Late SLA
                          </span>
                        </div>
                        <div className="text-2xl font-bold font-mono text-rose-600 mt-2">{metrics.money_at_risk}</div>
                        <div className="text-[11px] text-slate-400 mt-1">Contractually breached suppliers</div>
                      </div>

                      {/* Ships Rerouted Card (Pastel Periwinkle/Sky) */}
                      <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
                        <div className="flex items-center justify-between text-xs text-slate-500">
                          <span className="font-semibold text-slate-700">Vessels Rerouted</span>
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#E0F2FE] text-[#0284C7] flex items-center gap-1">
                            <Ship className="w-3 h-3" /> Cape Detour
                          </span>
                        </div>
                        <div className="text-2xl font-bold font-mono text-sky-700 mt-2">{metrics.ships_rerouted}</div>
                        <div className="text-[11px] text-slate-400 mt-1">Bypassing Red Sea bottlenecks</div>
                      </div>

                      {/* Low-Stock SKUs Card (Warm Muted Amber/Sage) */}
                      <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
                        <div className="flex items-center justify-between text-xs text-slate-500">
                          <span className="font-semibold text-slate-700">Low-Stock SKUs</span>
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#FEF3C7] text-[#D97706] flex items-center gap-1">
                            <Package className="w-3 h-3" /> &lt;14d Cover
                          </span>
                        </div>
                        <div className="text-2xl font-bold font-mono text-amber-700 mt-2">{metrics.items_running_low}</div>
                        <div className="text-[11px] text-slate-400 mt-1">Pending emergency buffer POs</div>
                      </div>
                    </div>

                    {/* Visual Charts */}
                    <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
                      <div className="xl:col-span-7 p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
                        <h3 className="text-sm font-semibold text-slate-900 mb-4">Vendor Reliability Scores (Interactive)</h3>
                        <div className="h-56">
                          <Bar
                            data={barData}
                            options={{
                              responsive: true,
                              maintainAspectRatio: false,
                              plugins: { legend: { display: false } },
                              scales: {
                                y: { max: 100, grid: { color: 'rgba(226, 232, 240, 0.6)' }, ticks: { color: '#64748B' } },
                                x: { grid: { display: false }, ticks: { color: '#64748B' } }
                              }
                            }}
                          />
                        </div>
                      </div>
                      <div className="xl:col-span-5 p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
                        <h3 className="text-sm font-semibold text-slate-900 mb-4">Corridor Risk Split</h3>
                        <div className="h-56 flex items-center justify-center">
                          <Doughnut
                            data={doughnutData}
                            options={{
                              responsive: true,
                              maintainAspectRatio: false,
                              plugins: {
                                legend: {
                                  position: 'bottom',
                                  labels: { color: '#64748B', font: { size: 11, family: 'Plus Jakarta Sans' } }
                                }
                              }
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* TAB 2: 1-CLICK ACTION CENTER */}
                {activeTab === 'actions' && (
                  <div className="space-y-5">
                    {/* Autopilot Banner */}
                    <div className="p-5 rounded-2xl bg-gradient-to-r from-indigo-50/80 via-sky-50/60 to-indigo-50/80 border border-indigo-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
                      <div>
                        <h3 className="text-sm font-semibold text-indigo-950">Autonomous Autopilot Mitigation</h3>
                        <p className="text-xs text-indigo-800/80 mt-1">Authorize Cape of Good Hope detours & issue emergency buffer Purchase Orders in one click.</p>
                      </div>
                      <button
                        onClick={triggerAutopilot}
                        className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 shadow-xs ${
                          autopilotDone ? 'bg-emerald-600 text-white' : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                        }`}
                      >
                        {autopilotDone ? '✓ All Mitigations Executed' : 'Execute All Mitigations'}
                      </button>
                    </div>

                    {/* Supplier SLA Escalations */}
                    <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
                      <h3 className="text-sm font-semibold text-slate-900 mb-3">1. Supplier SLA Escalations</h3>
                      <div className="flex flex-wrap gap-2">
                        {liveActions.escalations?.map((item, i) => (
                          <button
                            key={i}
                            onClick={() => openEmailFor(item.supplier, item.shipment_id, item.value, item.lead_time)}
                            className="px-3.5 py-2 rounded-xl text-xs font-medium bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 transition-all cursor-pointer text-left shadow-2xs text-slate-700"
                          >
                            Draft Notice: <strong className="text-indigo-600">{item.supplier}</strong> ({item.shipment_id})
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Emergency Buffer Purchase Orders */}
                    <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
                      <h3 className="text-sm font-semibold text-slate-900 mb-3">2. Emergency Buffer Purchase Orders</h3>
                      <div className="overflow-x-auto w-full">
                        <table className="w-full min-w-[540px] text-left text-xs">
                          <thead>
                            <tr className="border-b border-slate-200 text-slate-500 font-semibold">
                              <th className="py-2.5">Shipment</th>
                              <th className="py-2.5">Supplier</th>
                              <th className="py-2.5">Cover</th>
                              <th className="py-2.5">Suggested Order</th>
                              <th className="py-2.5 text-right">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-slate-700">
                            {liveActions.purchase_orders?.map(po => (
                              <tr key={po.po_id} className="hover:bg-slate-50/70">
                                <td className="py-3 font-mono font-semibold text-indigo-600">{po.shipment_id}</td>
                                <td className="py-3 font-medium text-slate-900">{po.supplier}</td>
                                <td className="py-3 text-rose-600 font-semibold">{po.days_cover}</td>
                                <td className="py-3 text-slate-600">{po.suggested_units}</td>
                                <td className="py-3 text-right">
                                  <button
                                    onClick={() => setIssuedPOs(p => ({ ...p, [po.po_id]: true }))}
                                    disabled={issuedPOs[po.po_id]}
                                    className={`px-3 py-1 rounded-lg text-[11px] font-semibold cursor-pointer whitespace-nowrap transition-all ${
                                      issuedPOs[po.po_id]
                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                        : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-2xs'
                                    }`}
                                  >
                                    {issuedPOs[po.po_id] ? `✓ Issued (${po.po_id})` : 'Approve PO'}
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 3: WHAT-IF SIMULATOR */}
                {activeTab === 'simulator' && (
                  <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-6">
                    <div>
                      <h3 className="text-base font-semibold text-slate-900">Disruption & Air-Freight Trade-Off Simulator</h3>
                      <p className="text-xs text-slate-500 mt-1">Slide operational parameters to balance line-stoppage risk vs. airlift protection costs.</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                        <div className="flex justify-between text-xs mb-2 font-medium">
                          <span className="text-slate-600">Red Sea Delay</span>
                          <span className="font-mono text-indigo-600 font-bold">+{simDelay}d</span>
                        </div>
                        <input type="range" min="0" max="20" value={simDelay} onChange={e => setSimDelay(+e.target.value)} className="w-full accent-indigo-600 cursor-pointer" />
                      </div>
                      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                        <div className="flex justify-between text-xs mb-2 font-medium">
                          <span className="text-slate-600">Air-Freight Split</span>
                          <span className="font-mono text-indigo-600 font-bold">{simAir}%</span>
                        </div>
                        <input type="range" min="0" max="60" value={simAir} onChange={e => setSimAir(+e.target.value)} className="w-full accent-indigo-600 cursor-pointer" />
                      </div>
                      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                        <div className="flex justify-between text-xs mb-2 font-medium">
                          <span className="text-slate-600">Safety Buffer</span>
                          <span className="font-mono text-indigo-600 font-bold">+{simBuf}%</span>
                        </div>
                        <input type="range" min="0" max="50" value={simBuf} onChange={e => setSimBuf(+e.target.value)} className="w-full accent-indigo-600 cursor-pointer" />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="p-4 rounded-xl bg-rose-50 border border-rose-100">
                        <div className="text-xs font-semibold text-rose-700">Line-Stop Loss</div>
                        <div className="text-xl font-bold font-mono text-rose-800 mt-1">${simLoss}M</div>
                      </div>
                      <div className="p-4 rounded-xl bg-amber-50 border border-amber-100">
                        <div className="text-xs font-semibold text-amber-700">Air Freight Cost</div>
                        <div className="text-xl font-bold font-mono text-amber-800 mt-1">${simCost}</div>
                      </div>
                      <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100">
                        <div className="text-xs font-semibold text-emerald-700">Revenue Saved</div>
                        <div className="text-xl font-bold font-mono text-emerald-800 mt-1">${simSaved}M</div>
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <button
                        onClick={() => sendMessage(`We simulated a +${simDelay} day Red Sea delay with a ${simAir}% air-freight split, protecting $${simSaved}M. Summarize the action plan.`)}
                        className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer whitespace-nowrap shadow-xs transition-all"
                      >
                        Send Strategy to Co-Pilot
                      </button>
                    </div>
                  </div>
                )}

                {/* TAB 4: REROUTED SCHEDULE */}
                {activeTab === 'schedule' && (
                  <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm overflow-x-auto w-full">
                    {scheduleRows.length === 0 ? (
                      <div className="text-center py-8 text-xs text-slate-500">
                        Click <strong>Run Full Audit</strong> to generate the rerouted Cape of Good Hope schedule.
                      </div>
                    ) : (
                      <table className="w-full min-w-[700px] text-left text-xs whitespace-nowrap">
                        <thead>
                          <tr className="border-b border-slate-200 text-slate-500 font-semibold">
                            {Object.keys(scheduleRows[0]).map(h => <th key={h} className="py-2.5 px-3">{h}</th>)}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                          {scheduleRows.map((row, i) => (
                            <tr key={i} className="hover:bg-slate-50/70">
                              {Object.values(row).map((val, j) => <td key={j} className="py-2.5 px-3">{val}</td>)}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      )}

      {/* Email Escalation Modal */}
      {emailModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-base text-slate-900">Supplier SLA Escalation Notice</h3>
              <button onClick={() => setEmailModal(null)} className="text-slate-400 hover:text-slate-700 cursor-pointer p-1 rounded-lg hover:bg-slate-100 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <textarea
              value={emailModal.body}
              onChange={e => setEmailModal({ ...emailModal, body: e.target.value })}
              className="w-full h-52 bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs text-slate-800 leading-relaxed focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setEmailModal(null)} className="px-4 py-2 rounded-xl text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer transition-colors">Close</button>
              <button
                onClick={() => { navigator.clipboard.writeText(emailModal.body); setCopied(true); }}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-1.5 cursor-pointer whitespace-nowrap shadow-xs transition-all"
              >
                {copied ? <><Check className="w-3.5 h-3.5" /> Copied</> : <><Copy className="w-3.5 h-3.5" /> Copy Notice</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
