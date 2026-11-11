import React, { useState, useEffect, useRef } from 'react';
import {
  Compass, ArrowRight, Zap, UploadCloud, ShieldAlert, Globe, FileCheck2,
  Send, ArrowLeft, Play, CheckCircle2, AlertTriangle, TrendingDown,
  Ship, Package, Sparkles, X, Copy, Check, Sliders, BarChart3
} from 'lucide-react';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, ArcElement,
  Title, Tooltip, Legend
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend);

export default function App() {
  const [view, setView] = useState('hero'); // 'hero' | 'workspace'
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'actions' | 'simulator' | 'schedule'
  const [activeFile, setActiveFile] = useState('supply_chain_manifest.csv');
  const [messages, setMessages] = useState([
    {
      role: 'ai',
      text: "Hi! I'm Atlas, your autonomous supply chain co-pilot. Run a live audit, ask me about delayed suppliers, or tell me to draft an escalation email or simulate a port delay."
    }
  ]);
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

  // Robust API Fetcher (tries Vite proxy relative path first, then falls back to direct port 8080 or 8001)
  const fetchApi = async (endpoint, options = {}) => {
    try {
      const res = await fetch(endpoint, options);
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
      try {
        res = await fetch(url);
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
      const mapTab = { actions: 'actions', simulator: 'simulator', schedule: 'schedule', charts: 'overview', scorecard: 'overview' };
      setActiveTab(mapTab[action.tab] || 'overview');
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

  const sendMessage = async (textToSend) => {
    const query = (textToSend ?? input).trim();
    if (!query) return;
    if (!textToSend) setInput('');

    setMessages(prev => [...prev, { role: 'user', text: query }]);
    setLoading(true);

    try {
      const data = await fetchApi('/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: query })
      });
      setMessages(prev => [...prev, { role: 'ai', text: data.reply, metrics: data.metrics }]);
      if (data.metrics) setMetrics(data.metrics);
      if (data.live_actions) setLiveActions(data.live_actions);
      if (data.ui_action) executeUiAction(data.ui_action);
      if (data.artifacts?.csv) loadScheduleCsv(data.artifacts.csv + '?t=' + Date.now());
    } catch (err) {
      setMessages(prev => [...prev, { role: 'ai', text: 'Backend server is unreachable. Make sure uvicorn is running (e.g. uvicorn main:app --reload --port 8080).' }]);
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
      setMessages(prev => [...prev, { role: 'ai', text: data.reply, metrics: data.metrics }]);
      if (data.metrics) setMetrics(data.metrics);
      if (data.live_actions) setLiveActions(data.live_actions);
      if (data.artifacts?.csv) loadScheduleCsv(data.artifacts.csv + '?t=' + Date.now());
    } catch {
      setMessages(prev => [...prev, { role: 'ai', text: 'Failed to upload CSV. Check backend server (port 8080/8001).' }]);
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

  // Interactive Chart Data
  const barData = {
    labels: (liveActions.scorecard || []).slice(0, 6).map(s => s.supplier.split(' ')[0]),
    datasets: [
      {
        label: 'Vendor Reliability Score',
        data: (liveActions.scorecard || []).slice(0, 6).map(s => s.score),
        backgroundColor: (liveActions.scorecard || []).slice(0, 6).map(s =>
          s.score < 60 ? 'rgba(244, 63, 94, 0.85)' : s.score < 80 ? 'rgba(245, 158, 11, 0.85)' : 'rgba(56, 189, 248, 0.85)'
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
        backgroundColor: ['#F43F5E', '#38BDF8', '#10B981'],
        borderWidth: 0
      }
    ]
  };

  return (
    <div className="min-h-screen bg-[#060913] text-slate-100 font-sans selection:bg-sky-500/30 overflow-x-hidden">
      <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />

      {/* ==================== HERO VIEW ==================== */}
      {view === 'hero' && (
        <div className="min-h-screen flex flex-col justify-between bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-sky-900/25 via-[#060913] to-[#04060D]">
          <header className="max-w-7xl w-full mx-auto px-6 sm:px-8 py-6 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-400 to-indigo-500 flex items-center justify-center shadow-lg shadow-sky-500/20 shrink-0">
                <Compass className="w-5 h-5 text-slate-950 stroke-[2.5]" />
              </div>
              <span className="text-xl font-bold tracking-tight">Atlas<span className="text-sky-400">AI</span></span>
            </div>

            <div className="hidden md:flex items-center gap-8 text-sm text-slate-400">
              <button onClick={() => { setView('workspace'); setActiveTab('overview'); }} className="hover:text-white transition cursor-pointer">Live Analytics</button>
              <button onClick={() => { setView('workspace'); setActiveTab('simulator'); }} className="hover:text-white transition cursor-pointer">What-If Simulator</button>
              <button onClick={() => { setView('workspace'); setActiveTab('actions'); }} className="hover:text-white transition cursor-pointer">Action Center</button>
            </div>

            <button
              onClick={() => { setView('workspace'); sendMessage('Audit supply_chain_manifest.csv'); }}
              className="px-5 py-2.5 rounded-full text-sm font-semibold bg-gradient-to-r from-sky-400 to-indigo-400 text-slate-950 hover:opacity-95 transition flex items-center gap-2 shadow-lg shadow-sky-500/20 cursor-pointer whitespace-nowrap shrink-0"
            >
              Launch Command Center <ArrowRight className="w-4 h-4" />
            </button>
          </header>

          <main className="max-w-7xl w-full mx-auto px-6 sm:px-8 py-8 sm:py-12 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-sky-500/10 border border-sky-400/20 text-sky-300 text-xs font-medium">
                <Sparkles className="w-3.5 h-3.5" /> Autonomous Supply Chain Decision Engine
              </div>
              <h1 className="text-4xl sm:text-6xl font-bold tracking-tight leading-[1.08]">
                Resilient <span className="bg-gradient-to-r from-sky-400 to-indigo-400 bg-clip-text text-transparent">Logistics</span> Powered by AI Agents.
              </h1>
              <p className="text-slate-400 text-base sm:text-lg max-w-xl leading-relaxed">
                Detect delayed suppliers, simulate geopolitical sea detours, generate emergency purchase orders, and execute supplier SLA escalations in seconds.
              </p>
              <div className="flex flex-wrap gap-4 pt-2">
                <button
                  onClick={() => { setView('workspace'); sendMessage('Audit supply_chain_manifest.csv'); }}
                  className="px-7 py-3.5 rounded-full text-sm font-semibold bg-gradient-to-r from-sky-400 to-indigo-400 text-slate-950 shadow-xl shadow-sky-500/20 hover:scale-[1.02] transition flex items-center gap-2 cursor-pointer whitespace-nowrap"
                >
                  Run Live Supply Audit <Zap className="w-4 h-4" />
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-7 py-3.5 rounded-full text-sm font-medium bg-white/5 border border-white/10 hover:bg-white/10 transition flex items-center gap-2 cursor-pointer whitespace-nowrap"
                >
                  <UploadCloud className="w-4 h-4 text-sky-400" /> Upload Shipment CSV
                </button>
              </div>
            </div>

            <div className="lg:col-span-5 space-y-4">
              {[
                {
                  icon: ShieldAlert, color: 'text-sky-400 bg-sky-500/15',
                  title: 'Autonomous Vendor Risk Audit',
                  desc: 'Grade suppliers A–D & quantify financial exposure',
                  action: () => { setView('workspace'); sendMessage('Audit supply_chain_manifest.csv'); }
                },
                {
                  icon: Globe, color: 'text-indigo-400 bg-indigo-500/15',
                  title: 'Live Disruption & Air-Freight Simulator',
                  desc: 'Model Cape detours vs. priority airlift costs',
                  action: () => { setView('workspace'); setActiveTab('simulator'); }
                },
                {
                  icon: FileCheck2, color: 'text-emerald-400 bg-emerald-500/15',
                  title: '1-Click PO & SLA Escalation Engine',
                  desc: 'Auto-draft supplier notices & buffer restocks',
                  action: () => { setView('workspace'); setActiveTab('actions'); }
                }
              ].map((card, i) => (
                <button
                  key={i}
                  onClick={card.action}
                  className="w-full text-left p-5 rounded-2xl bg-slate-900/60 border border-white/10 hover:border-sky-400/40 hover:bg-slate-900 transition flex items-center justify-between group cursor-pointer"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${card.color}`}>
                      <card.icon className="w-6 h-6" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-base text-white truncate">{card.title}</div>
                      <div className="text-xs text-slate-400 mt-0.5 truncate">{card.desc}</div>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-sky-400 group-hover:translate-x-1 transition shrink-0 ml-2" />
                </button>
              ))}
            </div>
          </main>

          <footer className="max-w-7xl w-full mx-auto px-6 sm:px-8 py-6 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
            <span>Atlas AI • Autonomous Supply Chain Command</span>
            <span>Powered by Gemini 3.8 + Python Geodesic Engine</span>
          </footer>
        </div>
      )}

      {/* ==================== WORKSPACE VIEW ==================== */}
      {view === 'workspace' && (
        <div className="h-screen flex flex-col overflow-hidden bg-[#060913]">
          {/* Top Navigation */}
          <header className="h-14 shrink-0 px-4 sm:px-6 border-b border-white/10 bg-slate-950 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <button onClick={() => setView('hero')} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 hover:bg-white/10 flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0">
                <ArrowLeft className="w-3.5 h-3.5" /> Home
              </button>
              <span className="font-bold text-sm hidden sm:inline whitespace-nowrap">Atlas<span className="text-sky-400">AI</span> Workspace</span>
              <span className="font-mono text-xs text-sky-400 bg-sky-500/10 border border-sky-400/20 px-2.5 py-0.5 rounded-md truncate max-w-[160px] sm:max-w-[260px]">
                {activeFile}
              </span>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <button onClick={() => fileInputRef.current?.click()} className="px-3.5 py-1.5 rounded-lg text-xs font-medium bg-white/5 hover:bg-white/10 flex items-center gap-1.5 cursor-pointer whitespace-nowrap">
                <UploadCloud className="w-3.5 h-3.5 text-sky-400" /> Upload CSV
              </button>
              <button onClick={() => sendMessage('Audit supply_chain_manifest.csv')} className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-sky-400 text-slate-950 hover:bg-sky-300 flex items-center gap-1.5 cursor-pointer whitespace-nowrap">
                <Play className="w-3.5 h-3.5" /> Run Full Audit
              </button>
            </div>
          </header>

          {/* Main 2-Pane Split */}
          <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
            {/* Left AI Co-Pilot (42%) */}
            <section className="w-full lg:w-[42%] lg:max-w-[500px] border-b lg:border-b-0 lg:border-r border-white/10 flex flex-col bg-slate-950/60 shrink-0 h-1/2 lg:h-full">
              <div className="h-12 shrink-0 px-5 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Atlas Co-Pilot
                </div>
                <button onClick={() => setMessages([{ role: 'ai', text: 'Chat cleared. How can I help with your supply chain?' }])} className="text-xs text-slate-400 hover:text-white cursor-pointer">
                  Clear
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
                {messages.map((m, idx) => (
                  <div key={idx} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                    <div className={`max-w-[92%] rounded-2xl p-4 text-sm leading-relaxed ${
                      m.role === 'user'
                        ? 'bg-sky-500/20 border border-sky-400/30 text-white rounded-tr-sm'
                        : 'bg-slate-900/90 border border-white/10 text-slate-200 rounded-tl-sm'
                    }`}>
                      {m.metrics && (
                        <div className="grid grid-cols-3 gap-2 mb-3">
                          <div className="bg-slate-950/80 p-2.5 rounded-xl border border-white/5">
                            <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">At Risk</div>
                            <div className="font-mono text-xs font-bold text-rose-400 mt-0.5">{m.metrics.money_at_risk}</div>
                          </div>
                          <div className="bg-slate-950/80 p-2.5 rounded-xl border border-white/5">
                            <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Rerouted</div>
                            <div className="font-mono text-xs font-bold text-sky-400 mt-0.5">{m.metrics.ships_rerouted}</div>
                          </div>
                          <div className="bg-slate-950/80 p-2.5 rounded-xl border border-white/5">
                            <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Low Stock</div>
                            <div className="font-mono text-xs font-bold text-amber-400 mt-0.5">{m.metrics.items_running_low}</div>
                          </div>
                        </div>
                      )}
                      <div className="whitespace-pre-line">{m.text}</div>
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="bg-slate-900/80 border border-white/10 rounded-2xl p-4 text-xs text-sky-400 animate-pulse flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-sky-400 animate-ping" />
                    Atlas is analyzing your manifest...
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Suggestion Chips */}
              <div className="px-4 py-2.5 flex flex-wrap gap-1.5 border-t border-white/5 bg-slate-950/40">
                {[
                  { label: 'Riskiest supplier?', cmd: 'Which supplier has the highest financial risk?' },
                  { label: 'Draft SHP-2004 email', cmd: 'Draft an SLA escalation email for SHP-2004' },
                  { label: 'Simulate 14d delay', cmd: 'Simulate a 14 day delay with 35% air freight' },
                  { label: 'Autopilot Resolve', cmd: 'Auto-resolve all critical risks right now' }
                ].map((chip, i) => (
                  <button
                    key={i}
                    onClick={() => sendMessage(chip.cmd)}
                    className="text-[11px] px-3 py-1 rounded-full bg-white/5 border border-white/10 text-slate-300 hover:border-sky-400/50 hover:text-white transition cursor-pointer whitespace-nowrap"
                  >
                    {chip.label}
                  </button>
                ))}
              </div>

              <div className="p-3 sm:p-4 flex gap-2 bg-slate-950 border-t border-white/10">
                <input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendMessage()}
                  placeholder="Ask Atlas anything or give a command..."
                  className="flex-1 min-w-0 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-400"
                />
                <button onClick={() => sendMessage()} className="px-4 py-2.5 rounded-xl bg-sky-400 text-slate-950 font-semibold text-sm hover:bg-sky-300 flex items-center gap-1.5 cursor-pointer shrink-0 whitespace-nowrap">
                  Send <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </section>

            {/* Right Interactive Command Canvas (58%) */}
            <section className="flex-1 flex flex-col min-w-0 bg-[#060913] h-1/2 lg:h-full overflow-hidden">
              <div className="h-12 shrink-0 px-4 sm:px-6 border-b border-white/10 bg-slate-950/60 flex items-center justify-between gap-3 overflow-x-auto">
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
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
                        activeTab === tab.id ? 'bg-sky-500/15 text-sky-400 border border-sky-400/30' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <tab.icon className="w-3.5 h-3.5" /> {tab.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <a href="/outputs/revised_logistics_schedule.csv" download className="px-3 py-1 rounded-md text-xs bg-white/5 border border-white/10 hover:bg-white/10 whitespace-nowrap">CSV</a>
                  <a href="/outputs/Executive_Supply_Chain_Audit.pdf" download className="px-3 py-1 rounded-md text-xs bg-white/5 border border-white/10 hover:bg-white/10 whitespace-nowrap">PDF</a>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
                {/* TAB 1: INTERACTIVE ANALYTICS & VENDOR GRADES */}
                {activeTab === 'overview' && (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="p-5 rounded-2xl bg-slate-900/70 border border-white/10">
                        <div className="flex items-center justify-between text-xs text-slate-400">
                          <span>Exposure at Risk</span>
                          <TrendingDown className="w-4 h-4 text-rose-400" />
                        </div>
                        <div className="text-2xl font-bold font-mono text-rose-400 mt-2">{metrics.money_at_risk}</div>
                      </div>
                      <div className="p-5 rounded-2xl bg-slate-900/70 border border-white/10">
                        <div className="flex items-center justify-between text-xs text-slate-400">
                          <span>Vessels Rerouted</span>
                          <Ship className="w-4 h-4 text-sky-400" />
                        </div>
                        <div className="text-2xl font-bold font-mono text-sky-400 mt-2">{metrics.ships_rerouted}</div>
                      </div>
                      <div className="p-5 rounded-2xl bg-slate-900/70 border border-white/10">
                        <div className="flex items-center justify-between text-xs text-slate-400">
                          <span>Low-Stock SKUs</span>
                          <Package className="w-4 h-4 text-amber-400" />
                        </div>
                        <div className="text-2xl font-bold font-mono text-amber-400 mt-2">{metrics.items_running_low}</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
                      <div className="xl:col-span-7 p-5 rounded-2xl bg-slate-900/70 border border-white/10">
                        <h3 className="text-sm font-semibold mb-4">Vendor Reliability Scores (Interactive)</h3>
                        <div className="h-56">
                          <Bar data={barData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { max: 100, grid: { color: 'rgba(255,255,255,0.05)' } }, x: { grid: { display: false } } } }} />
                        </div>
                      </div>
                      <div className="xl:col-span-5 p-5 rounded-2xl bg-slate-900/70 border border-white/10">
                        <h3 className="text-sm font-semibold mb-4">Corridor Risk Split</h3>
                        <div className="h-56 flex items-center justify-center">
                          <Doughnut data={doughnutData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: '#94A3B8', font: { size: 11 } } } } }} />
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* TAB 2: 1-CLICK ACTION CENTER */}
                {activeTab === 'actions' && (
                  <div className="space-y-5">
                    <div className="p-5 rounded-2xl bg-sky-500/10 border border-sky-400/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div>
                        <h3 className="text-sm font-semibold text-white">Autonomous Autopilot Mitigation</h3>
                        <p className="text-xs text-slate-300 mt-1">Authorize all Cape detours & issue buffer purchase orders in one click.</p>
                      </div>
                      <button
                        onClick={triggerAutopilot}
                        className={`px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer whitespace-nowrap shrink-0 ${
                          autopilotDone ? 'bg-emerald-400 text-slate-950' : 'bg-sky-400 text-slate-950 hover:bg-sky-300'
                        }`}
                      >
                        {autopilotDone ? '✓ All Mitigations Executed' : 'Execute All Mitigations'}
                      </button>
                    </div>

                    <div className="p-5 rounded-2xl bg-slate-900/70 border border-white/10">
                      <h3 className="text-sm font-semibold mb-3">1. Supplier SLA Escalations</h3>
                      <div className="flex flex-wrap gap-2">
                        {liveActions.escalations?.map((item, i) => (
                          <button
                            key={i}
                            onClick={() => openEmailFor(item.supplier, item.shipment_id, item.value, item.lead_time)}
                            className="px-3.5 py-2 rounded-xl text-xs font-medium bg-white/5 border border-white/10 hover:border-sky-400/50 transition cursor-pointer text-left"
                          >
                            Draft Notice: <strong className="text-sky-400">{item.supplier}</strong> ({item.shipment_id})
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="p-5 rounded-2xl bg-slate-900/70 border border-white/10">
                      <h3 className="text-sm font-semibold mb-3">2. Emergency Buffer Purchase Orders</h3>
                      <div className="overflow-x-auto w-full">
                        <table className="w-full min-w-[540px] text-left text-xs">
                          <thead>
                            <tr className="border-b border-white/10 text-slate-400">
                              <th className="py-2">Shipment</th>
                              <th className="py-2">Supplier</th>
                              <th className="py-2">Cover</th>
                              <th className="py-2">Suggested Order</th>
                              <th className="py-2 text-right">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                            {liveActions.purchase_orders?.map(po => (
                              <tr key={po.po_id}>
                                <td className="py-3 font-mono text-sky-400">{po.shipment_id}</td>
                                <td className="py-3 font-medium">{po.supplier}</td>
                                <td className="py-3 text-rose-400 font-semibold">{po.days_cover}</td>
                                <td className="py-3 text-slate-300">{po.suggested_units}</td>
                                <td className="py-3 text-right">
                                  <button
                                    onClick={() => setIssuedPOs(p => ({ ...p, [po.po_id]: true }))}
                                    disabled={issuedPOs[po.po_id]}
                                    className={`px-3 py-1 rounded-lg text-[11px] font-semibold cursor-pointer whitespace-nowrap ${
                                      issuedPOs[po.po_id] ? 'bg-emerald-500/20 text-emerald-300' : 'bg-emerald-400 text-slate-950'
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
                  <div className="p-6 rounded-2xl bg-slate-900/70 border border-white/10 space-y-6">
                    <div>
                      <h3 className="text-base font-semibold">Disruption & Air-Freight Trade-Off Simulator</h3>
                      <p className="text-xs text-slate-400 mt-1">Slide parameters to model line-stop losses vs. airlift protection.</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="p-4 rounded-xl bg-slate-950 border border-white/10">
                        <div className="flex justify-between text-xs mb-2">
                          <span className="text-slate-400">Red Sea Delay</span>
                          <span className="font-mono text-sky-400 font-bold">+{simDelay}d</span>
                        </div>
                        <input type="range" min="0" max="20" value={simDelay} onChange={e => setSimDelay(+e.target.value)} className="w-full accent-sky-400" />
                      </div>
                      <div className="p-4 rounded-xl bg-slate-950 border border-white/10">
                        <div className="flex justify-between text-xs mb-2">
                          <span className="text-slate-400">Air-Freight Split</span>
                          <span className="font-mono text-sky-400 font-bold">{simAir}%</span>
                        </div>
                        <input type="range" min="0" max="60" value={simAir} onChange={e => setSimAir(+e.target.value)} className="w-full accent-sky-400" />
                      </div>
                      <div className="p-4 rounded-xl bg-slate-950 border border-white/10">
                        <div className="flex justify-between text-xs mb-2">
                          <span className="text-slate-400">Safety Buffer</span>
                          <span className="font-mono text-sky-400 font-bold">+{simBuf}%</span>
                        </div>
                        <input type="range" min="0" max="50" value={simBuf} onChange={e => setSimBuf(+e.target.value)} className="w-full accent-sky-400" />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="p-4 rounded-xl bg-slate-950 border border-white/10">
                        <div className="text-xs text-slate-400">Line-Stop Loss</div>
                        <div className="text-xl font-bold font-mono text-rose-400 mt-1">${simLoss}M</div>
                      </div>
                      <div className="p-4 rounded-xl bg-slate-950 border border-white/10">
                        <div className="text-xs text-slate-400">Air Freight Cost</div>
                        <div className="text-xl font-bold font-mono text-amber-400 mt-1">${simCost}</div>
                      </div>
                      <div className="p-4 rounded-xl bg-slate-950 border border-white/10">
                        <div className="text-xs text-slate-400">Revenue Saved</div>
                        <div className="text-xl font-bold font-mono text-emerald-400 mt-1">${simSaved}M</div>
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <button
                        onClick={() => sendMessage(`We simulated a +${simDelay} day Red Sea delay with a ${simAir}% air-freight split, protecting $${simSaved}M. Summarize the action plan.`)}
                        className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-sky-400 text-slate-950 hover:bg-sky-300 cursor-pointer whitespace-nowrap"
                      >
                        Send Strategy to Co-Pilot
                      </button>
                    </div>
                  </div>
                )}

                {/* TAB 4: REROUTED SCHEDULE */}
                {activeTab === 'schedule' && (
                  <div className="p-5 rounded-2xl bg-slate-900/70 border border-white/10 overflow-x-auto w-full">
                    {scheduleRows.length === 0 ? (
                      <div className="text-center py-8 text-xs text-slate-400">Click <strong>Run Full Audit</strong> to generate the rerouted schedule.</div>
                    ) : (
                      <table className="w-full min-w-[700px] text-left text-xs whitespace-nowrap">
                        <thead>
                          <tr className="border-b border-white/10 text-slate-400">
                            {Object.keys(scheduleRows[0]).map(h => <th key={h} className="py-2.5 px-3 font-semibold">{h}</th>)}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {scheduleRows.map((row, i) => (
                            <tr key={i} className="hover:bg-white/[0.02]">
                              {Object.values(row).map((val, j) => <td key={j} className="py-2.5 px-3 text-slate-200">{val}</td>)}
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
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-white/10 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-base">Supplier SLA Escalation Notice</h3>
              <button onClick={() => setEmailModal(null)} className="text-slate-400 hover:text-white cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
            <textarea
              value={emailModal.body}
              onChange={e => setEmailModal({ ...emailModal, body: e.target.value })}
              className="w-full h-52 bg-slate-950 border border-white/10 rounded-xl p-3.5 text-xs text-slate-200 leading-relaxed focus:outline-none focus:border-sky-400"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setEmailModal(null)} className="px-4 py-2 rounded-xl text-xs bg-white/5 hover:bg-white/10 cursor-pointer">Close</button>
              <button
                onClick={() => { navigator.clipboard.writeText(emailModal.body); setCopied(true); }}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-sky-400 text-slate-950 flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
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
