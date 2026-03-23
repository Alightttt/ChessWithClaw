import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

/* ─── BOARD DATA ─── */
const BOARD = [
  [" ","r"," ","q"," ","r","k"," "],
  ["p","p"," "," ","b","p","p","p"],
  [" "," ","p"," ","p","n"," "," "],
  [" "," "," ","p"," "," "," "," "],
  [" "," ","B","P","P"," "," "," "],
  [" "," ","N"," "," ","N"," "," "],
  ["P","P","P"," "," ","P","P","P"],
  ["R"," ","B","Q"," ","R","K"," "],
];
const G={K:"♔",Q:"♕",R:"♖",B:"♗",N:"♘",P:"♙",k:"♚",q:"♛",r:"♜",b:"♝",n:"♞",p:"♟"};
const LF=[4,3], LT=[4,2];
const LINES=["Analyzing d5 push...","Bishop c4 is strong.","Checking Nf4 response...","Rook d8 centralizes.","Yes. Rd8."];

/* ─── BOARD COMPONENT ─── */
function Board({ size }) {
  const sq = size / 8;
  return (
    <div style={{
      width: size, height: size,
      borderRadius: 6, overflow: "hidden",
      boxShadow: "0 0 0 1px rgba(255,255,255,0.07), 0 32px 80px rgba(0,0,0,0.85), 0 0 60px rgba(230,57,70,0.06)",
    }}>
      {BOARD.map((row,r) =>
        <div key={r} style={{display:"flex"}}>
          {row.map((p,c) => {
            const lt=(r+c)%2===0;
            const last=(r===LF[0]&&c===LF[1])||(r===LT[0]&&c===LT[1]);
            const isW=p&&p===p.toUpperCase()&&p!==" ";
            let bg=lt?"#739552":"#577047";
            if(last) bg=lt?"#cdd26a":"#aaa23a";
            return (
              <div key={c} style={{width:sq,height:sq,background:bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:sq*0.63}}>
                {p&&p!==" "&&(
                  <span style={{
                    color:isW?"#fff":"#111",
                    textShadow:isW?"0 2px 6px rgba(0,0,0,0.9)":"0 1px 3px rgba(255,255,255,0.1)",
                    userSelect:"none",lineHeight:1,
                    filter:isW?"drop-shadow(0 2px 4px rgba(0,0,0,0.75))":"none",
                  }}>{G[p]}</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─── TYPEWRITER ─── */
function Typewriter({lines}) {
  const [li,setLi]=useState(0);
  const [ci,setCi]=useState(0);
  const [txt,setTxt]=useState("");
  useEffect(()=>{
    const l=lines[li];
    if(ci<l.length){const t=setTimeout(()=>{setTxt(l.slice(0,ci+1));setCi(x=>x+1);},42);return()=>clearTimeout(t);}
    else{const t=setTimeout(()=>{setLi(x=>(x+1)%lines.length);setCi(0);setTxt("");},2200);return()=>clearTimeout(t);}
  },[li,ci,lines]);
  return(
    <span className="mono txt-sm" style={{color:"#bbb"}}>
      {txt}
      <span style={{display:"inline-block",width:2,height:"1em",background:"#e63946",marginLeft:2,verticalAlign:"middle",animation:"blink 1s step-end infinite"}}/>
    </span>
  );
}

/* ─── MAIN ─── */
export default function App() {
  const [loaded,setLoaded]=useState(false);
  const [faq,setFaq]=useState(null);
  const [sp,setSp]=useState(0);
  const [bsize,setBsize]=useState(360);
  const [creating, setCreating] = useState(false);
  const ref=useRef(null);
  const navigate = useNavigate();

  useEffect(()=>{
    setTimeout(()=>setLoaded(true),80);

    /* Responsive board size */
    const calcBoard=()=>{
      const vw=window.innerWidth;
      if(vw<420) setBsize(vw-48);
      else if(vw<640) setBsize(Math.min(vw-64,380));
      else if(vw<1024) setBsize(400);
      else setBsize(440);
    };
    calcBoard();
    window.addEventListener("resize",calcBoard);

    const el=ref.current;
    if(!el) return;
    const sc=()=>setSp(el.scrollTop/(el.scrollHeight-el.clientHeight)*100||0);
    el.addEventListener("scroll",sc);
    return()=>{el.removeEventListener("scroll",sc);window.removeEventListener("resize",calcBoard);};
  },[]);

  const handleStart = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const res = await fetch('/api/create', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to create game');
      const game = await res.json();
      localStorage.setItem(`game_owner_${game.id}`, game.secret_token);
      navigate(`/game/${game.id}`, { state: { agentToken: game.agent_token } });
    } catch (err) {
      console.error(err);
      alert('Error creating game');
    } finally {
      setCreating(false);
    }
  };

  const reasons=[
    {e:"⚡",t:"Real-time sync.",b:"Moves update in under 200ms. Every turn, both sides see the board instantly."},
    {e:"🦞",t:"Built for OpenClaw.",b:"Native API support. Your OpenClaw connects with one invite — no setup."},
    {e:"♟",t:"Full chess rules.",b:"Castling, en passant, promotion, check detection — all handled correctly."},
    {e:"📱",t:"Any device.",b:"Phone, tablet, desktop. No app to download. Open the link and play."},
    {e:"🔓",t:"Zero signup.",b:"No account. No email. No password. Create a game in 10 seconds."},
    {e:"💬",t:"Live chat.",b:"Talk to your OpenClaw while playing. It can respond, trash talk, or just say good game."},
    {e:"🎨",t:"Board themes.",b:"Green, brown, slate, or navy. Choose what feels right — saved automatically."},
    {e:"🆓",t:"Completely free.",b:"No subscriptions. No ads. No premium tier. Free for every OpenClaw user, forever."},
  ];

  const faqs=[
    {q:"Does my OpenClaw need special configuration?",a:"No. Just run: $ claw install play-chess — your OpenClaw gets the chess skill instantly. Send it the invite and it connects automatically."},
    {q:"What if my OpenClaw doesn't know chess moves?",a:"The SKILL.md teaches it everything — FEN notation, legal moves, UCI format, strategy. Most OpenClaws play well from move one."},
    {q:"Is ChessWithClaw actually free?",a:"Yes. No subscriptions, no premium tier, no ads. Free for every OpenClaw user, forever."},
    {q:"What if my OpenClaw disconnects mid-game?",a:"Games are persistent. Your OpenClaw reconnects and continues from exactly where it left off."},
    {q:"Does it work with any OpenClaw?",a:"Yes — all 4 connection methods work out of the box: browser automation, SSE, webhooks, and long-polling."},
  ];

  const css=`
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,800;0,900;1,400;1,700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    ::-webkit-scrollbar { display: none; }

    /* ── TOKENS ── */
    :root {
      --bg: #080808;
      --surface: #0e0e0e;
      --border: #1a1a1a;
      --red: #e63946;
      --text: #f0f0f0;
      --secondary: #999;
      --tertiary: #888;
      --muted: #666;
      --dim: #444;
      --invisible: #222;
      --green: #739552;
    }

    /* ── KEYFRAMES ── */
    @keyframes blink{0%,100%{opacity:1}50%{opacity:0}}
    @keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
    @keyframes fadeIn{from{opacity:0}to{opacity:1}}
    @keyframes boardIn{from{opacity:0;transform:translateY(28px)}to{opacity:1;transform:translateY(0)}}
    @keyframes glow{0%,100%{opacity:0.5}50%{opacity:1}}
    @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
    @keyframes pulse{0%,100%{box-shadow:0 0 0 0 rgba(230,57,70,0.5)}60%{box-shadow:0 0 0 7px rgba(230,57,70,0)}}
    @keyframes dot{0%,100%{transform:scale(1)}50%{transform:scale(1.7)}}

    /* ── TYPOGRAPHY ── */
    .serif { font-family: 'Playfair Display', serif; }
    .sans  { font-family: 'Inter', sans-serif; }
    .mono  { font-family: 'JetBrains Mono', monospace; }

    /* Fluid headline — scales from 36px (360px screen) to 62px (1200px screen) */
    .hero-h1 {
      font-family: 'Playfair Display', serif;
      font-weight: 900;
      line-height: 1.06;
      letter-spacing: -0.03em;
      color: var(--text);
      font-size: min(56px, 13.5vw);
    }
    @media (min-width: 640px)  { .hero-h1 { font-size: min(64px, 8vw); } }
    @media (min-width: 1024px) { .hero-h1 { font-size: 64px; } }

    .section-h2 {
      font-family: 'Playfair Display', serif;
      font-weight: 800;
      line-height: 1.1;
      letter-spacing: -0.03em;
      color: var(--text);
      font-size: min(36px, 9vw);
    }
    @media (min-width: 640px)  { .section-h2 { font-size: min(40px, 6vw); } }
    @media (min-width: 1024px) { .section-h2 { font-size: 42px; } }

    .step-h3 {
      font-family: 'Playfair Display', serif;
      font-weight: 700;
      color: var(--text);
      font-size: min(22px, 5.5vw);
    }
    @media (min-width: 640px) { .step-h3 { font-size: 24px; } }

    /* ── TEXT SIZES ── */
    .txt-xl  { font-size: 18px; }
    .txt-lg  { font-size: 16px; }
    .txt-md  { font-size: 15px; }
    .txt-base{ font-size: 14px; }
    .txt-sm  { font-size: 13px; }
    .txt-xs  { font-size: 12px; }
    .txt-2xs { font-size: 11px; }
    .txt-3xs { font-size: 10px; }

    /* ── CONTAINERS ── */
    .container {
      width: 100%;
      max-width: 720px;
      margin: 0 auto;
      padding: 0 20px;
    }
    @media (min-width: 640px)  { .container { padding: 0 32px; } }
    @media (min-width: 1024px) { .container { padding: 0 40px; } }

    .container-sm {
      width: 100%;
      max-width: 600px;
      margin: 0 auto;
      padding: 0 20px;
    }
    @media (min-width: 640px)  { .container-sm { padding: 0 32px; } }

    /* ── SECTION PADDING ── */
    .section-pad { padding: 72px 20px; }
    @media (min-width: 640px)  { .section-pad { padding: 88px 32px; } }
    @media (min-width: 1024px) { .section-pad { padding: 100px 40px; } }

    /* ── HERO PADDING ── */
    .hero-pad { padding: 56px 20px 48px; }
    @media (min-width: 640px)  { .hero-pad { padding: 64px 32px 56px; } }
    @media (min-width: 1024px) { .hero-pad { padding: 80px 40px 64px; } }

    /* ── BUTTONS ── */
    .btn-primary {
      display: inline-flex; align-items: center; justify-content: center;
      background: var(--red); color: #fff;
      border: none; border-radius: 7px;
      padding: 13px 24px;
      font-family: 'Inter', sans-serif;
      font-size: 14px; font-weight: 600;
      letter-spacing: -0.2px;
      cursor: pointer;
      transition: opacity 0.15s, transform 0.15s;
      white-space: nowrap;
    }
    .btn-primary:hover { opacity: 0.9; transform: translateY(-1px); }

    .btn-ghost {
      display: inline-flex; align-items: center; justify-content: center;
      background: transparent; color: var(--tertiary);
      border: 1px solid #252525; border-radius: 7px;
      padding: 13px 22px;
      font-family: 'Inter', sans-serif;
      font-size: 14px; font-weight: 500;
      cursor: pointer;
      transition: border-color 0.15s, color 0.15s;
      white-space: nowrap;
    }
    .btn-ghost:hover { border-color: #3a3a3a; color: var(--secondary); }

    /* ── NAV ── */
    .nav-link {
      font-family: 'Inter', sans-serif;
      font-size: 13px; color: var(--muted);
      text-decoration: none; font-weight: 500;
      transition: color 0.15s;
    }
    .nav-link:hover { color: var(--secondary); }

    /* Hide nav links on small screens */
    .nav-links { display: none; gap: 24px; align-items: center; }
    @media (min-width: 640px) { .nav-links { display: flex; } }

    /* ── BOARD CONTAINER ── */
    .board-wrap {
      display: flex; flex-direction: column;
      align-items: center;
      gap: 0;
      margin-top: 52px;
    }
    @media (min-width: 640px) { .board-wrap { margin-top: 64px; } }

    .board-bar {
      display: flex; align-items: center; justify-content: space-between;
      gap: 12px;
      padding: 0 2px;
    }

    /* ── STATS ── */
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      border-top: 1px solid #111;
      border-bottom: 1px solid #111;
      background: #060606;
    }
    @media (min-width: 640px) { .stats-grid { grid-template-columns: repeat(4, 1fr); } }

    .stat-cell {
      padding: 22px 12px;
      text-align: center;
      border-bottom: 1px solid #111;
    }
    @media (min-width: 640px) {
      .stat-cell { border-bottom: none; border-right: 1px solid #111; }
      .stat-cell:last-child { border-right: none; }
    }
    .stat-cell:nth-child(odd) { border-right: 1px solid #111; }
    @media (min-width: 640px) { .stat-cell:nth-child(odd) { border-right: 1px solid #111; } }

    /* ── REASONS GRID ── */
    .reasons-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 10px;
    }
    @media (min-width: 480px) { .reasons-grid { grid-template-columns: 1fr 1fr; } }

    .reason-card {
      background: #0c0c0c;
      border: 1px solid #1a1a1a;
      border-radius: 10px;
      padding: 20px 18px;
      transition: border-color 0.2s;
    }
    .reason-card:hover { border-color: #2a2a2a; }

    /* ── HOW IT WORKS STEPS ── */
    .step-row {
      display: flex; gap: 20px; position: relative;
    }
    @media (min-width: 480px) { .step-row { gap: 24px; } }

    /* ── FAQ ── */
    .faq-row {
      border-bottom: 1px solid #181818;
      transition: border-color 0.2s;
    }
    .faq-row:hover { border-color: #252525; }
    .faq-btn {
      width: 100%; display: flex; justify-content: space-between; align-items: flex-start;
      padding: 20px 0; background: none; border: none; cursor: pointer;
      color: var(--secondary); text-align: left;
      font-family: 'Inter', sans-serif; font-size: 15px; font-weight: 500;
      gap: 16px; transition: color 0.15s;
    }
    .faq-btn:hover { color: var(--text); }

    /* ── ANIMATIONS ── */
    .fade-up-1 { animation: fadeUp 0.5s ease 0.1s both; }
    .fade-up-2 { animation: fadeUp 0.5s ease 0.2s both; }
    .fade-up-3 { animation: fadeUp 0.5s ease 0.3s both; }
    .fade-up-4 { animation: fadeUp 0.5s ease 0.4s both; }
    .fade-up-5 { animation: fadeUp 0.5s ease 0.5s both; }
    .fade-up-6 { animation: fadeUp 0.5s ease 0.6s both; }
    .board-anim { animation: boardIn 0.8s cubic-bezier(0.16,1,0.3,1) 0.65s both; }
    .hidden { opacity: 0; }
  `;

  return (
    <div ref={ref} style={{background:"#080808",color:"#f0f0f0",fontFamily:"'Inter',sans-serif",minHeight:"100vh",overflowY:"auto",overflowX:"hidden"}}>
      <style>{css}</style>

      {/* ═══ SCROLL PROGRESS ═══ */}
      <div style={{position:"fixed",top:0,left:0,height:2,width:`${sp}%`,background:"#e63946",zIndex:9999,transition:"width 0.08s linear",pointerEvents:"none"}}/>

      {/* ═══ NAV ═══ */}
      <nav style={{
        position:"fixed",top:0,left:0,right:0,height:52,
        display:"flex",alignItems:"center",justifyContent:"space-between",
        padding:"0 20px",
        background:"rgba(8,8,8,0.95)",
        backdropFilter:"blur(20px)",
        WebkitBackdropFilter:"blur(20px)",
        borderBottom:"1px solid rgba(255,255,255,0.04)",
        zIndex:200,
      }}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <img src="/logo.png" alt="ChessWithClaw" style={{height:22, width:'auto'}} onError={e => { e.target.style.display='none' }} />
          <span className="serif" style={{fontSize:14,fontWeight:700,letterSpacing:"-0.3px",color:"#f0f0f0"}}>
            ChessWithClaw
          </span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:20}}>
          <div className="nav-links">
            <a className="nav-link" href="#how">How It Works</a>
            <a className="nav-link" href="#why">Why</a>
            <a className="nav-link" href="#faq">FAQ</a>
          </div>
          <button className="btn-primary" style={{padding:"8px 16px",fontSize:12}} onClick={handleStart} disabled={creating}>
            {creating ? "Creating..." : "Play Now →"}
          </button>
        </div>
      </nav>

      {/* ═══════════════════════════════
           HERO SECTION
      ═══════════════════════════════ */}
      <section style={{
        paddingTop:52,
        minHeight:"100vh",
        display:"flex",
        flexDirection:"column",
        position:"relative",
        overflow:"hidden",
      }}>
        {/* Top radial glow */}
        <div style={{
          position:"absolute",top:0,left:"50%",transform:"translateX(-50%)",
          width:"120%",maxWidth:900,height:500,
          background:"radial-gradient(ellipse at 50% -10%, rgba(230,57,70,0.07) 0%, transparent 65%)",
          pointerEvents:"none",animation:"glow 6s ease-in-out infinite",
        }}/>
        {/* Grain */}
        <div style={{
          position:"absolute",inset:0,
          backgroundImage:`url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.88' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.022'/%3E%3C/svg%3E")`,
          backgroundSize:"200px",pointerEvents:"none",
        }}/>

        {/* ── HEADLINE BLOCK ── */}
        <div className="hero-pad" style={{
          display:"flex",flexDirection:"column",
          alignItems:"center",textAlign:"center",
          zIndex:2,
        }}>
          {/* Live badge */}
          <div className={loaded?"fade-up-1":"hidden"} style={{marginBottom:20}}>
            <div style={{
              display:"inline-flex",alignItems:"center",gap:7,
              background:"rgba(230,57,70,0.08)",
              border:"1px solid rgba(230,57,70,0.2)",
              borderRadius:100,padding:"5px 13px",
            }}>
              <div style={{width:6,height:6,borderRadius:"50%",background:"#e63946",animation:"pulse 2s infinite",flexShrink:0}}/>
              <span className="sans txt-2xs" style={{color:"#e63946",fontWeight:600,letterSpacing:"0.08em"}}>
                LIVE · REAL-TIME CHESS
              </span>
            </div>
          </div>

          {/* Headline */}
          <h1 className={`hero-h1 ${loaded?"fade-up-2":"hidden"}`} style={{marginBottom:16,maxWidth:640}}>
            Play chess against your{" "}
            <em style={{color:"#e63946",fontStyle:"italic"}}>own OpenClaw.</em>
          </h1>

          {/* Sub */}
          <p className={`sans txt-md ${loaded?"fade-up-3":"hidden"}`} style={{
            color:"#888",lineHeight:1.7,maxWidth:380,marginBottom:32,
          }}>
            The same OpenClaw you use every day — now sitting across the board,
            making moves, showing its thinking, playing live.
          </p>

          {/* CTAs */}
          <div className={loaded?"fade-up-4":"hidden"} style={{display:"flex",gap:10,justifyContent:"center",flexWrap:"wrap"}}>
            <button className="btn-primary" onClick={handleStart} disabled={creating}>
              {creating ? "Creating..." : "Challenge Your OpenClaw →"}
            </button>
            <button className="btn-ghost">See how it works ↓</button>
          </div>

          {/* Trust signals */}
          <div className={loaded?"fade-up-5":"hidden"} style={{
            display:"flex",gap:18,justifyContent:"center",
            marginTop:18,flexWrap:"wrap",
          }}>
            {["No signup required","Free to play","Any OpenClaw works"].map(t=>(
              <span key={t} className="sans txt-sm" style={{
                color:"#666",display:"flex",alignItems:"center",gap:5,
              }}>
                <span style={{color:"#739552",fontSize:11}}>✓</span>{t}
              </span>
            ))}
          </div>
        </div>

        {/* ── LIVE BOARD SHOWCASE ── */}
        <div className={`board-wrap ${loaded?"board-anim":"hidden"}`} style={{
          paddingBottom:60,
          zIndex:2,
          padding:"0 20px 60px",
        }}>
          {/* Floor glow */}
          <div style={{
            position:"absolute",
            width:"min(460px, 80vw)",height:60,
            background:"radial-gradient(ellipse, rgba(230,57,70,0.1) 0%, transparent 70%)",
            filter:"blur(20px)",
            marginTop:`${bsize + 20}px`,
            pointerEvents:"none",
            left:"50%",transform:"translateX(-50%)",
          }}/>

          {/* OpenClaw bar */}
          <div className="board-bar" style={{width:bsize,marginBottom:10}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <div style={{
                width:28,height:28,borderRadius:7,
                background:"rgba(230,57,70,0.1)",
                border:"1px solid rgba(230,57,70,0.22)",
                display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,
                flexShrink:0,
              }}>🦞</div>
              <div>
                <div className="sans txt-xs" style={{fontWeight:600,color:"#ccc",lineHeight:1.3}}>Your OpenClaw</div>
                <div style={{display:"flex",alignItems:"center",gap:4,marginTop:1}}>
                  <div style={{width:4,height:4,borderRadius:"50%",background:"#e63946",animation:"dot 1.5s ease-in-out infinite",flexShrink:0}}/>
                  <span className="sans txt-3xs" style={{color:"#e63946",fontWeight:500}}>thinking</span>
                </div>
              </div>
            </div>
            <div style={{
              background:"#0d0d0d",border:"1px solid #1c1c1c",
              borderRadius:6,padding:"6px 10px",
              flex:"0 1 auto",minWidth:0,overflow:"hidden",
            }}>
              <Typewriter lines={LINES}/>
            </div>
          </div>

          {/* Board */}
          <Board size={bsize}/>

          {/* Human bar */}
          <div className="board-bar" style={{width:bsize,marginTop:10}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <div style={{
                width:28,height:28,borderRadius:7,
                background:"#111",border:"1px solid #222",
                display:"flex",alignItems:"center",justifyContent:"center",
                fontSize:14,color:"#555",flexShrink:0,
              }}>♙</div>
              <div>
                <div className="sans txt-xs" style={{fontWeight:600,color:"#888",lineHeight:1.3}}>You</div>
                <div className="sans txt-3xs" style={{color:"#555",marginTop:1}}>White · your turn next</div>
              </div>
            </div>
            <div style={{
              background:"#0d0d0d",border:"1px solid #1c1c1c",
              borderRadius:5,padding:"5px 10px",
            }}>
              <span className="mono txt-xs" style={{color:"#555"}}>d4 · Move 14</span>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ STATS ═══ */}
      <div className="stats-grid">
        {[
          {v:"<200ms",l:"Real-time latency"},
          {v:"4",l:"Connection methods"},
          {v:"0",l:"Signup required"},
          {v:"Free",l:"Always"},
        ].map((s,i)=>(
          <div key={i} className="stat-cell">
            <div className="serif" style={{fontSize:"min(28px,7vw)",fontWeight:800,color:"#efefef",letterSpacing:"-0.04em"}}>{s.v}</div>
            <div className="sans txt-3xs" style={{color:"#666",marginTop:5,letterSpacing:"0.1em",fontWeight:500,textTransform:"uppercase"}}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* ═══════════════════════════════
           HOW IT WORKS
      ═══════════════════════════════ */}
      <section id="how" className="section-pad" style={{background:"#080808"}}>
        <div className="container-sm">
          <div className="sans txt-3xs" style={{color:"#e63946",letterSpacing:"0.15em",fontWeight:700,marginBottom:12,textTransform:"uppercase"}}>
            Three Steps
          </div>
          <h2 className="section-h2" style={{marginBottom:8}}>
            Works with any<br/>OpenClaw agent.
          </h2>
          <p className="sans txt-base" style={{color:"#777",marginBottom:56,lineHeight:1.7}}>
            No configuration. No waiting.
          </p>

          {[
            {n:"01",t:"Create a board",badge:"10 seconds",
              b:"Hit 'Challenge Your OpenClaw'. Your game room is created instantly. No login, no signup, no credit card required."},
            {n:"02",t:"Invite your OpenClaw",badge:"send anywhere",
              b:"Copy the invite and send it to your OpenClaw on Telegram, Discord, wherever it lives. It joins automatically.",
              code:true},
            {n:"03",t:"Play together, live",badge:"real-time",
              b:"You move your pieces. Your OpenClaw thinks — you watch its reasoning appear live — then it moves. Until the game ends."},
          ].map((s,i)=>(
            <div key={i} className="step-row" style={{marginBottom:i<2?48:0}}>
              {i<2&&(
                <div style={{
                  position:"absolute",left:15,top:36,
                  width:1,height:"calc(100% + 12px)",
                  background:"linear-gradient(to bottom, #282828, #111)",
                  zIndex:0,
                }}/>
              )}
              {/* Step number */}
              <div style={{
                width:32,height:32,borderRadius:6,flexShrink:0,
                background:"rgba(230,57,70,0.08)",
                border:"1px solid rgba(230,57,70,0.18)",
                display:"flex",alignItems:"center",justifyContent:"center",
                zIndex:1,
              }}>
                <span className="mono txt-xs" style={{color:"#e63946",fontWeight:500}}>{s.n}</span>
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8,flexWrap:"wrap"}}>
                  <h3 className="step-h3">{s.t}</h3>
                  {/* All badges — same red style */}
                  <span className="sans txt-3xs" style={{
                    padding:"3px 9px",borderRadius:100,
                    background:"rgba(230,57,70,0.09)",
                    border:"1px solid rgba(230,57,70,0.18)",
                    color:"#e63946",letterSpacing:"0.05em",fontWeight:600,
                    whiteSpace:"nowrap",
                  }}>{s.badge}</span>
                </div>
                <p className="sans txt-base" style={{color:"#888",lineHeight:1.75,maxWidth:440}}>{s.b}</p>
                {s.code&&(
                  <div style={{
                    marginTop:14,display:"inline-flex",
                    background:"#090909",border:"1px solid #1c1c1c",
                    borderRadius:5,padding:"9px 14px",
                  }}>
                    {/* Correct spacing — $ and text are separate spans with space inside second span */}
                    <span className="mono txt-sm">
                      <span style={{color:"#e63946"}}>$</span>
                      <span style={{color:"#999"}}> claw install play-chess</span>
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════════════════════════════
           8 REASONS
      ═══════════════════════════════ */}
      <section id="why" className="section-pad" style={{background:"#050505",borderTop:"1px solid #0e0e0e"}}>
        <div className="container">
          <div className="sans txt-3xs" style={{color:"#e63946",letterSpacing:"0.15em",fontWeight:700,marginBottom:12,textTransform:"uppercase"}}>
            Why ChessWithClaw
          </div>
          <h2 className="section-h2" style={{marginBottom:44}}>
            8 reasons your OpenClaw<br/>belongs on this board.
          </h2>
          <div className="reasons-grid">
            {reasons.map((r,i)=>(
              <div key={i} className="reason-card">
                <div style={{fontSize:22,marginBottom:10,lineHeight:1}}>{r.e}</div>
                <div className="sans txt-sm" style={{fontWeight:600,color:"#ddd",marginBottom:7}}>{r.t}</div>
                <div className="sans txt-sm" style={{color:"#888",lineHeight:1.7}}>{r.b}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════
           FAQ
      ═══════════════════════════════ */}
      <section id="faq" className="section-pad" style={{background:"#080808",borderTop:"1px solid #0e0e0e"}}>
        <div className="container-sm">
          <div className="sans txt-3xs" style={{color:"#e63946",letterSpacing:"0.15em",fontWeight:700,marginBottom:12,textTransform:"uppercase"}}>FAQ</div>
          <h2 className="section-h2" style={{marginBottom:44}}>
            Questions you<br/>probably have.
          </h2>
          {faqs.map((f,i)=>(
            <div key={i} className="faq-row">
              <button className="faq-btn" onClick={()=>setFaq(faq===i?null:i)}>
                <span>{f.q}</span>
                <span style={{
                  color:"#888",fontSize:14,flexShrink:0,marginTop:2,
                  transform:faq===i?"rotate(180deg)":"none",
                  transition:"transform 0.2s",display:"inline-block",
                }}>↓</span>
              </button>
              {faq===i&&(
                <div className="sans txt-base" style={{
                  paddingBottom:20,color:"#888",lineHeight:1.75,
                  animation:"fadeIn 0.2s ease",
                }}>{f.a}</div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ═══════════════════════════════
           FINAL CTA
      ═══════════════════════════════ */}
      <section className="section-pad" style={{
        textAlign:"center",
        borderTop:"1px solid #0e0e0e",
        background:"#060606",
        position:"relative",overflow:"hidden",
      }}>
        {/* Center glow */}
        <div style={{
          position:"absolute",top:"50%",left:"50%",
          transform:"translate(-50%,-50%)",
          width:"min(600px,90vw)",height:300,
          background:"radial-gradient(ellipse,rgba(230,57,70,0.05) 0%,transparent 70%)",
          pointerEvents:"none",
        }}/>
        <div style={{position:"relative",zIndex:1}}>
          <div style={{fontSize:44,marginBottom:20,display:"inline-block",animation:"float 3s ease-in-out infinite"}}>
            🦞
          </div>
          <p className="sans txt-sm" style={{color:"#777",marginBottom:12}}>
            Your OpenClaw is on the other side.
          </p>
          {/* Overflow-safe headline */}
          <h2 className="section-h2" style={{marginBottom:12,padding:"0 16px"}}>
            Ready to make your move?
          </h2>
          <p className="sans txt-base" style={{color:"#777",marginBottom:32,padding:"0 16px"}}>
            Create a game. Send the invite. Play chess with your OpenClaw.
          </p>
          <button className="btn-primary" style={{padding:"14px 32px",fontSize:15,fontWeight:700}} onClick={handleStart} disabled={creating}>
            {creating ? "Creating..." : "Challenge Your OpenClaw →"}
          </button>
          <div style={{display:"flex",gap:18,justifyContent:"center",marginTop:20,flexWrap:"wrap"}}>
            {["No signup","Free to play","Any OpenClaw works"].map(t=>(
              <span key={t} className="sans txt-sm" style={{color:"#666",display:"flex",alignItems:"center",gap:5}}>
                <span style={{color:"#739552",fontSize:11}}>✓</span>{t}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ FOOTER — no GitHub, no Feedback ═══ */}
      <footer style={{
        padding:"18px 24px",
        borderTop:"1px solid #0e0e0e",
        display:"flex",alignItems:"center",justifyContent:"space-between",
        flexWrap:"wrap",gap:10,
      }}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <img src="/logo.png" alt="ChessWithClaw" style={{height:22, width:'auto'}} onError={e => { e.target.style.display='none' }} />
          <span className="serif" style={{fontSize:13,fontWeight:700,color:"#ccc"}}>ChessWithClaw</span>
          <span className="sans txt-sm" style={{color:"#444",marginLeft:4}}>— Play chess against your OpenClaw</span>
        </div>
        <span className="sans txt-xs" style={{color:"#333"}}>© 2025 ChessWithClaw</span>
      </footer>
    </div>
  );
}
