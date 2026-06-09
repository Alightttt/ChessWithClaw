import React, { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useNavigate } from "react-router-dom";
import { useToast } from "../components/Toast";
import { ChevronDown, Zap, Terminal, Globe, Copy, Check, MessageSquare, Swords } from "lucide-react";

const LobsterEmoji = () => (
<span style={{ fontFamily: "\"Apple Color Emoji\",\"Segoe UI Emoji\",\"Noto Color Emoji\",sans-serif", fontStyle: "normal" }}>
🦞
</span>
);

export default function GameCreated({ gameId, agentToken: initialAgentToken }) {
const [copied, setCopied] = useState(false);
const [agentToken, setAgentToken] = useState(initialAgentToken || "");
const [boardOpening, setBoardOpening] = useState(false);
const [loading, setLoading] = useState(true);
const [agentConnected, setAgentConnected] = useState(false);
const [agentName, setAgentName] = useState("Your OpenClaw");
const [quickSetupExpanded, setQuickSetupExpanded] = useState(false);
const [copiedRow1, setCopiedRow1] = useState(false);
const [copiedRow2, setCopiedRow2] = useState(false);
const [copiedRow2b, setCopiedRow2b] = useState(false);
const [copiedRow3, setCopiedRow3] = useState(false);
const navigate = useNavigate();
const { toast } = useToast();

useEffect(() => {
if (!gameId || gameId === "new") {
window.location.href = "/api/new";
return;
}

const cookieName = `game_owner_${gameId}`;
const cookieMatch = document.cookie.match(new RegExp("(^| )" + cookieName + "=([^;]+)"));
const localOwner = localStorage.getItem(`game_owner_${gameId}`);

if (cookieMatch) {
localStorage.setItem(`game_owner_${gameId}`, cookieMatch[2]);
document.cookie = `${cookieName}=; Path=/; Max-Age=0; SameSite=Lax`;
}

if (!cookieMatch && !localOwner) {
window.location.href = "/api/new";
return;
}

const fetchGame = async () => {
setLoading(true);
try {
const { data, error } = await supabase
.from("games")
.select("agent_connected, agent_name, agent_token")
.eq("id", gameId)
.single();

if (data) {
if (data.agent_name) setAgentName(data.agent_name);
if (data.agent_connected !== undefined) setAgentConnected(!!data.agent_connected);
if (!agentToken && data.agent_token) setAgentToken(data.agent_token);
}
} catch (err) {
toast.error("Error loading game: " + err.message);
} finally {
setLoading(false);
}
};
fetchGame();

const subscription = supabase
.channel(`game-${gameId}-created`)
.on("postgres_changes", {
event: "UPDATE",
schema: "public",
table: "games",
filter: `id=eq.${gameId}`
}, (payload) => {
if (payload.new.agent_name) setAgentName(payload.new.agent_name);
if (payload.new.agent_connected !== undefined) {
const isConnected = !!payload.new.agent_connected;
setAgentConnected(prev => {
if (!prev && isConnected) {
toast.success(<>{payload.new.agent_name || "Your OpenClaw"} has joined! <LobsterEmoji /></>);
} else if (prev && !isConnected) {
toast.error(`${payload.new.agent_name || "Your OpenClaw"} disconnected.`);
}
return isConnected;
});
}
})
.subscribe();

return () => {
supabase.removeChannel(subscription);
};
}, [gameId]); // eslint-disable-line react-hooks/exhaustive-deps

const inviteMessage = `🦞 ChessWithClaw Invite

Your rival is waiting. Join as Black.

GAME ID: ${gameId}
TOKEN: ${agentToken}
BOARD: https://chesswithclaw.vercel.app/Agent?id=${gameId}&token=${agentToken}

To join and play:
npx clawhub install play-chess
(then send me this invite message)

Save these — you need them to join:
export GAME_ID="${gameId}"
export AGENT_TOKEN="${agentToken}"

Then poll: curl "https://chesswithclaw.vercel.app/api/poll?gameId=${gameId}&last_move_count=0" -H "x-agent-token: ${agentToken}" -H "x-agent-name: YOUR_NAME"`;

const handleCopyInvite = () => {
navigator.clipboard.writeText(inviteMessage).then(() => {
setCopied(true);
setTimeout(() => setCopied(false), 2000);
});
};

const handleOpenBoard = () => {
if (boardOpening) return;
setBoardOpening(true);
navigate(`/game/${gameId}`);
};

if (loading) {
return (
<div style={{
minHeight: "100vh",
background: "#0a0a0a",
display: "flex",
flexDirection: "column",
alignItems: "center",
justifyContent: "center",
gap: "16px"
}}>
<div style={{
width: "32px", height: "32px",
border: "3px solid #333",
borderTop: "3px solid #e63946",
borderRadius: "50%",
animation: "spin 1s linear infinite"
}} />
<style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
<p style={{
color: "rgba(242,242,242,0.5)",
fontFamily: "Inter, sans-serif",
fontSize: "14px"
}}>
Setting up your arena...
</p>
</div>
);
}

return (
<div className="min-h-[100dvh] bg-[#0a0a0a] text-white font-sans selection:bg-red-500/30" style={{ boxSizing: "border-box" }}>
<style>{`
@keyframes statusPulse {
0%, 100% { transform: scale(1); opacity: 0.6; box-shadow: 0 0 0 0 rgba(57, 211, 83, 0.4); }
50% { transform: scale(1.15); opacity: 1; box-shadow: 0 0 0 6px rgba(57, 211, 83, 0); }
}
@keyframes subtleFadeUp {
from { opacity: 0; transform: translateY(8px); }
to { opacity: 1; transform: translateY(0); }
}
.animate-fade-up {
animation: subtleFadeUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
`}</style>

{/* HEADER ROW */}
<header className="h-[56px] border-b border-neutral-900 flex items-center justify-between px-6 bg-[#0a0a0a] sticky top-0 z-50">
<div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate("/")}>
<img 
src="https://jkawzziklwoxfxicbtvf.supabase.co/storage/v1/object/public/assets/logo-v2.png" 
alt="ChessWithClaw Logo" 
draggable={false}
className="w-[115px] h-auto object-contain block hover:opacity-90 transition-opacity"
/>
</div>
<div className="bg-red-500/10 border border-red-500/25 text-red-500 font-mono rounded-md px-3 py-1 text-xs font-semibold tracking-wider">
ARENA #{String(gameId || '').slice(0, 6).toUpperCase()}
</div>
</header>

{/* Hero Header Area */}
<div className="text-center pt-10 px-4 animate-fade-up" style={{ animationDelay: "0.05s" }}>
<h1 className="text-2xl sm:text-3xl font-bold text-neutral-100 tracking-tight mb-2">
Summon Your OpenClaw <LobsterEmoji />
</h1>
<p className="text-sm text-neutral-500 max-w-sm mx-auto">
Your digital battlefield is prepared. Command your agent to enter the arena.
</p>

{/* Modular Progress Hub */}
<div className="flex flex-col items-center mt-8 gap-3">
<div className="flex items-center gap-3">
{/* Step 1: Init */}
<div className="w-[10px] h-[10px] rounded-full bg-red-500 shadow-[0_0_8px_rgba(230,57,70,0.5)]" />
{/* Divider */}
<div className={`h-[1px] w-12 transition-colors duration-500 ${agentConnected ? "bg-red-500" : "bg-neutral-800"}`} />
{/* Step 2: Connection */}
<div className={`w-[10px] h-[10px] rounded-full border transition-all duration-500 ${agentConnected ? "bg-red-500 border-transparent shadow-[0_0_8px_rgba(230,57,70,0.5)]" : "border-neutral-700 bg-transparent"}`} />
{/* Divider */}
<div className={`h-[1px] w-12 transition-colors duration-500 ${agentConnected ? "bg-red-500" : "bg-neutral-800"}`} />
{/* Step 3: Match */}
<div className={`w-[10px] h-[10px] rounded-full border transition-all duration-500 ${agentConnected ? "bg-red-500 border-transparent shadow-[0_0_8px_rgba(230,57,70,0.5)]" : "border-neutral-800 bg-transparent"}`} />
</div>
<div className="flex gap-8 text-[11px] font-medium tracking-wide text-neutral-500 font-sans">
<span className="text-neutral-400">Setup</span>
<span className={agentConnected ? "text-neutral-400 font-normal" : "text-white font-semibold"}>Invite Agent</span>
<span className={agentConnected ? "text-white font-semibold" : "text-neutral-600 font-normal"}>Enter Battle</span>
</div>
</div>
</div>

{/* Main Layout Card Grid */}
<div className="max-w-[500px] mx-auto px-4 py-8 flex flex-col gap-5 animate-fade-up" style={{ animationDelay: "0.15s" }}>

{/* CARD 1: Setup Invitation */}
<div className="bg-[#111111] border border-neutral-900 rounded-xl p-6 shadow-xl transition-all hover:border-neutral-800/80">
<div className="flex items-center gap-2.5 mb-4">
<div className="w-6 h-6 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center font-mono">
1
</div>
<h3 className="font-semibold text-[16px] text-neutral-200 flex items-center gap-2">
<MessageSquare size={16} className="text-red-500" />
<span>Invite {agentName || "OpenClaw"}</span>
</h3>
</div>

<p className="text-[13px] text-neutral-400 mb-4 leading-relaxed">
Send this invite payload to your OpenClaw to establish a live secure bridge:
</p>

<div className="bg-[#070707] border border-neutral-900/60 rounded-lg p-3.5 font-mono text-[11px] text-neutral-400 leading-relaxed max-h-[120px] overflow-y-auto w-full box-border whitespace-pre-wrap select-all">
{inviteMessage}
</div>

<button 
onClick={handleCopyInvite}
className="w-full mt-4 h-11 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-400 hover:to-red-500 text-white rounded-lg font-medium text-xs tracking-wider uppercase shadow-lg shadow-red-500/10 cursor-pointer flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
>
{copied ? (
<>
<Check size={14} className="text-white" />
<span>Copied to Clipboard!</span>
</>
) : (
<>
<Copy size={13} />
<span>Copy Invite Payload</span>
</>
)}
</button>
</div>

{/* CARD 2: Quick Developer Instructions */}
<div className="bg-[#111111] border border-neutral-900 rounded-xl p-5 shadow-xl hover:border-neutral-800/80 transition-all">
<div 
className="flex items-center justify-between cursor-pointer user-select-none" 
onClick={() => setQuickSetupExpanded(!quickSetupExpanded)}
>
<div className="flex items-center gap-2.5 font-semibold text-sm text-neutral-200">
<Zap size={15} className="text-amber-500" />
<span>⚡ Terminal Quick Setup</span>
</div>
<ChevronDown 
size={16} 
className="text-neutral-500 transition-transform duration-300"
style={{ transform: quickSetupExpanded ? "rotate(180deg)" : "rotate(0deg)" }}
/>
</div>

{quickSetupExpanded && (
<div className="mt-4 flex flex-col gap-4 animate-fade-up" onClick={(e) => e.stopPropagation()}>

{/* Row 1 */}
<div className="flex flex-col gap-1.5">
<span className="text-[11px] text-neutral-500 font-medium ml-1">Step A: Install Play Skill</span>
<div className="bg-[#070707] rounded-lg p-3 flex justify-between items-center font-mono text-xs text-neutral-400 leading-none">
<div className="flex items-center gap-2 overflow-hidden mr-2">
<Terminal size={13} className="text-red-500 flex-shrink-0" />
<span className="truncate">openclaw skills install play-chess</span>
</div>
<button
onClick={() => {
navigator.clipboard.writeText("openclaw skills install play-chess");
setCopiedRow1(true);
setTimeout(() => setCopiedRow1(false), 1500);
}}
className="text-[11px] text-red-500 hover:text-red-400 font-mono font-semibold uppercase bg-transparent border-none cursor-pointer flex-shrink-0 px-2 py-0.5"
>
{copiedRow1 ? "✓" : "COPY"}
</button>
</div>
</div>

{/* Row 2 */}
<div className="flex flex-col gap-1.5">
<span className="text-[11px] text-neutral-500 font-medium ml-1">Step B: Browser Agent Tool (Clawdbot)</span>
<div className="bg-[#070707] rounded-lg p-3 flex justify-between items-center font-mono text-xs text-neutral-400 leading-none">
<div className="flex items-center gap-2 overflow-hidden mr-2">
<Globe size={13} className="text-red-500 flex-shrink-0" />
<span className="truncate">openclaw skills install agent-browser-clawdbot</span>
</div>
<button
onClick={() => {
navigator.clipboard.writeText("openclaw skills install agent-browser-clawdbot");
setCopiedRow2(true);
setTimeout(() => setCopiedRow2(false), 1500);
}}
className="text-[11px] text-red-500 hover:text-red-400 font-mono font-semibold uppercase bg-transparent border-none cursor-pointer flex-shrink-0 px-2 py-0.5"
>
{copiedRow2 ? "✓" : "COPY"}
</button>
</div>
</div>

{/* Row 3 */}
<div className="flex flex-col gap-1.5">
<span className="text-[11px] text-neutral-500 font-medium ml-1">Alternative: Browser Harness Support</span>
<div className="bg-[#070707] rounded-lg p-3 flex justify-between items-center font-mono text-xs text-neutral-400 leading-none">
<div className="flex items-center gap-2 overflow-hidden mr-2">
<Zap size={13} className="text-amber-500 flex-shrink-0" />
<span className="truncate">npx skills add https://github.com/browser-use/browser-harness-js --skill cdp</span>
</div>
<button
onClick={() => {
navigator.clipboard.writeText("npx skills add https://github.com/browser-use/browser-harness-js --skill cdp");
setCopiedRow2b(true);
setTimeout(() => setCopiedRow2b(false), 1500);
}}
className="text-[11px] text-red-500 hover:text-red-400 font-mono font-semibold uppercase bg-transparent border-none cursor-pointer flex-shrink-0 px-2 py-0.5"
>
{copiedRow2b ? "✓" : "COPY"}
</button>
</div>
</div>

{/* Row 4 */}
<div className="flex flex-col gap-1.5">
<span className="text-[11px] text-neutral-500 font-medium ml-1">Disable Bot Idle Timeout</span>
<div className="bg-[#070707] rounded-lg p-3 flex justify-between items-center font-mono text-xs text-neutral-400 leading-none">
<div className={`flex items-center gap-2 overflow-hidden mr-2`}>
<Zap size={13} className="text-red-500 flex-shrink-0" />
<span className="truncate">agents.defaults.llm.idleTimeoutSeconds = 0</span>
</div>
<button
onClick={() => {
navigator.clipboard.writeText("agents.defaults.llm.idleTimeoutSeconds = 0");
setCopiedRow3(true);
setTimeout(() => setCopiedRow3(false), 1500);
}}
className="text-[11px] text-red-500 hover:text-red-400 font-mono font-semibold uppercase bg-transparent border-none cursor-pointer flex-shrink-0 px-2 py-0.5"
>
{copiedRow3 ? "✓" : "COPY"}
</button>
</div>
</div>

<div className="text-[11px] text-neutral-500 text-center mt-1">
Run once. OpenClaw registers and persists these skills locally.
</div>
</div>
)}
</div>

{/* CARD 3: Open Arena and Launch */}
<div className="bg-[#111111] border border-neutral-900 rounded-xl p-6 shadow-xl hover:border-neutral-800/80 transition-all">
<div className="flex items-center gap-2.5 mb-4">
<div className={`w-6 h-6 rounded-full border text-xs font-bold flex items-center justify-center font-mono transition-colors duration-500 ${agentConnected ? "bg-[#222] border-neutral-700 text-neutral-300" : "bg-red-500 border-transparent text-white"}`}>
2
</div>
<h3 className="font-semibold text-[16px] text-neutral-200 flex items-center gap-2">
<Swords size={16} className="text-red-500" />
<span>Enter Battlefield</span>
</h3>
</div>

{/* Connection Status Banner */}
<div className="flex items-center gap-3 bg-[#070707] border border-neutral-950 rounded-lg px-4 py-3 mb-5">
<div className={`w-[9px] h-[9px] rounded-full transition-all duration-300 ${agentConnected ? "bg-emerald-500" : "bg-neutral-600"}`} style={{ animation: agentConnected ? "statusPulse 2s infinite ease-in-out" : "none" }} />
<span className={`text-xs font-medium ${agentConnected ? "text-emerald-400" : "text-neutral-500"}`}>
{agentConnected 
? `${agentName || "OpenClaw"} successfully connected!`
: "Awaiting incoming OpenClaw secure connection..."
}
</span>
</div>

<button
onClick={handleOpenBoard}
disabled={boardOpening}
className="w-full h-12 bg-transparent text-white font-semibold text-sm hover:bg-neutral-800/40 border border-neutral-800 rounded-xl cursor-pointer flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
>
{boardOpening ? (
<div className="w-4 h-4 border-2 border-neutral-500 border-t-red-500 rounded-full animate-spin" />
) : (
<>
<span>Launch Client Arena</span>
<span className="text-red-500 ml-1">→</span>
</>
)}
</button>
</div>

</div>
</div>
);
}

