import { useState, useEffect, useMemo, useRef } from "react";
import { RAW, TYPE_ORDER, EFF, GROWTH_RATES, EGG_GROUPS, POKE_COLORS, POKE_SHAPES, PRESET_GROUPS } from "./data.js";
import * as api from "./api.js";
import { formatListValidationError, generateListId, normalizeLists, validateLists } from "./listValidation.js";

const DEX = RAW.map((r, i) => ({
  id: i + 1, name: r[0], gen: r[1], habitat: r[2], stats: r[3], evoFrom: r[4],
  legend: r[5], // 0 regular, 1 legendary, 2 mythical
  abilities: r[6], // hidden abilities marked with trailing *
  // extra: [genus, height(dm), weight(hg), captureRate, baseHappiness, growthRateId, genderRate(eighths female, -1 none), eggGroupIds, colorId, shapeId]
  genus: r[7][0], height: r[7][1], weight: r[7][2], capture: r[7][3], happiness: r[7][4],
  growth: r[7][5], gender: r[7][6], eggGroups: r[7][7], color: r[7][8], shape: r[7][9],
  evoHow: r[7][10], // human-readable method for evolving FROM its pre-evolution
  types: r.slice(8),
}));
const LEGEND_BADGE = [null, { sym: "★", label: "Legendary", color: "#ffd23e" }, { sym: "✦", label: "Mythical", color: "#f085c8" }];
const CHILDREN = {};
DEX.forEach((p) => { if (p.evoFrom) (CHILDREN[p.evoFrom] = CHILDREN[p.evoFrom] || []).push(p.id); });
// Full evolutionary family (handles branches like Eevee): walk to the root, then collect all descendants
const familyOf = (id) => {
  let root = id;
  while (DEX[root - 1].evoFrom) root = DEX[root - 1].evoFrom;
  const out = [];
  const walk = (i) => { out.push(i); (CHILDREN[i] || []).forEach(walk); };
  walk(root);
  return out.sort((a, b) => a - b);
};
const STAT_NAMES = ["HP", "Atk", "Def", "SpA", "SpD", "Spe"];
const bst = (p) => p.stats.reduce((a, b) => a + b, 0);
// Damage multiplier of an attacking type against a defender's type combo
const defMult = (attackType, defTypes) =>
  defTypes.reduce((m, t) => m * EFF[TYPE_ORDER.indexOf(attackType)][TYPE_ORDER.indexOf(t)], 1);
// Habitat data comes from FireRed/LeafGreen and only exists for Gens I-III (#1-386).
const HABITATS = ["Unknown","Cave","Forest","Grassland","Mountain","Rare","Rough terrain","Sea","Urban","Water's edge"];
const GENS = ["I","II","III","IV","V","VI","VII","VIII","IX"];
const GEN_REGIONS = ["Kanto","Johto","Hoenn","Sinnoh","Unova","Kalos","Alola","Galar","Paldea"];

const TYPE_COLORS = {
  Normal: "#A8A878", Fire: "#F08030", Water: "#6890F0", Electric: "#F8D030",
  Grass: "#78C850", Ice: "#98D8D8", Fighting: "#C03028", Poison: "#A040A0",
  Ground: "#E0C068", Flying: "#A890F0", Psychic: "#F85888", Bug: "#A8B820",
  Rock: "#B8A038", Ghost: "#705898", Dragon: "#7038F8", Dark: "#705848",
  Steel: "#B8B8D0", Fairy: "#EE99AC",
};
const ALL_TYPES = Object.keys(TYPE_COLORS);

const sprite = (id) =>
  `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;
const shinySprite = (id) =>
  `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/shiny/${id}.png`;

function migrate(lists) {
  const result = normalizeLists(lists || []);
  if (!result.ok) throw new Error(formatListValidationError(result));
  return result.lists;
}
async function loadLists() {
  return migrate(await api.fetchLists());
}
async function saveLists(lists) {
  const result = validateLists(lists);
  if (!result.ok) throw new Error(formatListValidationError(result));
  await api.saveLists(result.lists);
}

// ---------- Small components ----------
function TypeBadge({ t }) {
  return (
    <span style={{
      background: TYPE_COLORS[t], color: "#10121e", fontSize: 10, fontWeight: 700,
      padding: "2px 8px", borderRadius: 3, letterSpacing: ".06em", textTransform: "uppercase",
    }}>{t}</span>
  );
}

function StatBars({ stats, height = 4, max = 255 }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {stats.map((v, i) => (
        <div key={i} title={`${STAT_NAMES[i]}: ${Math.round(v)}`}
          style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 9, color: "#5d6076", width: 22, flexShrink: 0 }}>{STAT_NAMES[i]}</span>
          <div style={{ flex: 1, height, background: "#0e0f1a", borderRadius: 2, overflow: "hidden" }}>
            <div style={{
              width: `${Math.min(100, (v / max) * 100)}%`, height: "100%", borderRadius: 2,
              background: v >= 110 ? "#54d66a" : v >= 75 ? "#ffd23e" : "#DC2430",
            }} />
          </div>
          <span style={{ fontSize: 9, color: "#8b8fa3", width: 24, textAlign: "right", flexShrink: 0 }}>{Math.round(v)}</span>
        </div>
      ))}
    </div>
  );
}

function Sprite({ p, size = 56 }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    const c = TYPE_COLORS[p.types[0]] || "#888";
    return (
      <div style={{
        width: size, height: size, borderRadius: "50%", display: "flex", flexShrink: 0,
        alignItems: "center", justifyContent: "center", fontFamily: "'Press Start 2P', monospace",
        fontSize: size / 4, color: "#10121e",
        background: `radial-gradient(circle at 35% 30%, ${c}, ${c}88)`,
      }}>{p.name[0]}</div>
    );
  }
  return (
    <img src={sprite(p.id)} alt={p.name} width={size} height={size} loading="lazy"
      style={{ imageRendering: "pixelated", flexShrink: 0 }} onError={() => setFailed(true)} />
  );
}

const inputStyle = {
  display: "block", width: "100%", marginTop: 6, padding: "10px 12px", borderRadius: 8,
  border: "1px solid #2a2d40", background: "#0e0f1a", color: "#e8e9f0",
  fontSize: 14, outline: "none", boxSizing: "border-box",
};

const panelTitle = {
  fontFamily: "'Press Start 2P', monospace", fontSize: 11, color: "#8b8fa3",
  margin: "0 0 12px", letterSpacing: ".04em",
};

const miniActionBtn = {
  background: "#171927", border: "1px solid #2a2d40", color: "#8b8fa3",
  borderRadius: 6, padding: "5px 10px", cursor: "pointer", fontSize: 11,
};

// ---------- Auth screen ----------
function AuthScreen({ onLogin }) {
  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError("");
    const u = username.trim();
    if (!u || !password) { setError("Enter a trainer name and a password."); return; }
    setBusy(true);
    try {
      if (mode === "signup") {
        const { username } = await api.signup(u, password);
        await onLogin(username);
      } else {
        const { username } = await api.login(u, password);
        await onLogin(username);
      }
    } catch (err) {
      setError(err.message || "Server isn't responding. Try again.");
      setBusy(false);
    }
  };

  const tab = (m, label) => (
    <button onClick={() => { setMode(m); setError(""); }} style={{
      flex: 1, padding: "10px 0", cursor: "pointer", border: "none",
      fontFamily: "'Press Start 2P', monospace", fontSize: 10,
      background: mode === m ? "#DC2430" : "transparent",
      color: mode === m ? "#fff" : "#8b8fa3",
      borderBottom: mode === m ? "3px solid #ff5a64" : "3px solid #2a2d40",
    }}>{label}</button>
  );

  return (
    <div style={{ maxWidth: 380, margin: "48px auto", padding: "0 16px" }}>
      <div style={{ background: "#171927", border: "1px solid #2a2d40", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ display: "flex" }}>{tab("login", "LOG IN")}{tab("signup", "SIGN UP")}</div>
        <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 14 }}>
          <label style={{ fontSize: 12, color: "#8b8fa3" }}>Trainer name
            <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="off"
              onKeyDown={(e) => e.key === "Enter" && submit()}
              style={inputStyle} placeholder="e.g. Red" />
          </label>
          <label style={{ fontSize: 12, color: "#8b8fa3" }}>Password
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              style={inputStyle} placeholder="••••••••" />
          </label>
          {error && <div style={{ color: "#ff7b84", fontSize: 12 }}>{error}</div>}
          <button onClick={submit} disabled={busy} style={{
            marginTop: 4, padding: "12px 0", borderRadius: 8, border: "none", cursor: "pointer",
            background: "#DC2430", color: "#fff", fontFamily: "'Press Start 2P', monospace",
            fontSize: 11, opacity: busy ? 0.6 : 1,
          }}>{busy ? "..." : mode === "signup" ? "CREATE ACCOUNT" : "ENTER"}</button>
          <p style={{ fontSize: 11, color: "#5d6076", margin: 0 }}>
            Accounts are stored on the server — pick a fun made-up password, not a real one.
          </p>
        </div>
      </div>
    </div>
  );
}

// ---------- Roster entry (in active list) ----------
function RosterEntry({ entry, index, total, onMove, onRemove, onEdit, onEvolve, onDragStart, onDragOver, onDrop, isDragTarget }) {
  const p = DEX[entry.id - 1];
  const [editing, setEditing] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const [nick, setNick] = useState(entry.nick || "");
  const [note, setNote] = useState(entry.note || "");
  const evos = CHILDREN[entry.id] || [];

  useEffect(() => { setChoosing(false); }, [entry.id]);

  const save = () => { onEdit({ ...entry, nick: nick.trim(), note: note.trim() }); setEditing(false); };
  const evolveClick = () => {
    if (evos.length === 1) onEvolve(evos[0]);
    else setChoosing(!choosing);
  };

  return (
    <div
      draggable={!editing}
      onDragStart={(e) => onDragStart(e, index)}
      onDragOver={(e) => onDragOver(e, index)}
      onDrop={(e) => onDrop(e, index)}
      style={{
        background: "#171927", borderRadius: 10, padding: "8px 10px",
        border: isDragTarget ? "1px dashed #ff5a64" : "1px solid #2a2d40",
        cursor: editing ? "default" : "grab",
      }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span aria-hidden style={{ color: "#5d6076", fontSize: 14, letterSpacing: 2, userSelect: "none" }}>⠿</span>
        <Sprite p={p} size={36} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {entry.nick ? <>{entry.nick} <span style={{ color: "#8b8fa3", fontWeight: 400 }}>({p.name})</span></> : p.name}
          </div>
          {entry.note && !editing && (
            <div style={{ fontSize: 11, color: "#8b8fa3", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{entry.note}</div>
          )}
        </div>
        <div style={{ display: "flex", gap: 2 }}>
          {evos.length > 0 && (
            <button onClick={evolveClick} aria-label={`Evolve ${entry.nick || p.name}`}
              title={evos.length === 1
                ? `Evolve into ${DEX[evos[0] - 1].name}${DEX[evos[0] - 1].evoHow ? ` (${DEX[evos[0] - 1].evoHow})` : ""}`
                : "Evolve (choose form)"}
              style={{ ...miniBtn(false), color: choosing ? "#ffd23e" : "#8b8fa3" }}>⤴</button>
          )}
          <button onClick={() => onMove(index, -1)} disabled={index === 0} aria-label="Move up" style={miniBtn(index === 0)}>▲</button>
          <button onClick={() => onMove(index, 1)} disabled={index === total - 1} aria-label="Move down" style={miniBtn(index === total - 1)}>▼</button>
          <button onClick={() => { setEditing(!editing); setNick(entry.nick || ""); setNote(entry.note || ""); }} aria-label="Edit nickname and note" style={miniBtn(false)}>✎</button>
          <button onClick={onRemove} aria-label={`Remove ${p.name}`} style={miniBtn(false)}>✕</button>
        </div>
      </div>
      {choosing && (
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, marginTop: 8 }}>
          <span style={{ fontSize: 11, color: "#8b8fa3" }}>Evolve into:</span>
          {evos.map((id) => {
            const f = DEX[id - 1];
            return (
              <button key={id} onClick={() => { onEvolve(id); setChoosing(false); }}
                title={DEX[id - 1].evoHow || undefined} style={{
                display: "flex", alignItems: "center", gap: 4, fontSize: 12, cursor: "pointer",
                background: "#0e0f1a", border: "1px solid #2a2d40", color: "#e8e9f0",
                borderRadius: 20, padding: "3px 10px 3px 4px",
              }}>
                <Sprite p={f} size={24} />{f.name}
              </button>
            );
          })}
        </div>
      )}
      {editing && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
          <input value={nick} onChange={(e) => setNick(e.target.value)} placeholder="Nickname (e.g. Sparky)"
            maxLength={20} style={{ ...inputStyle, marginTop: 0, padding: "7px 10px", fontSize: 13 }} />
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (e.g. lead, holds Leftovers)"
            maxLength={120} style={{ ...inputStyle, marginTop: 0, padding: "7px 10px", fontSize: 13 }}
            onKeyDown={(e) => e.key === "Enter" && save()} />
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={save} style={{
              background: "#DC2430", border: "none", color: "#fff", borderRadius: 6,
              padding: "6px 14px", cursor: "pointer", fontSize: 12,
            }}>Save</button>
            <button onClick={() => setEditing(false)} style={{
              background: "transparent", border: "1px solid #2a2d40", color: "#8b8fa3",
              borderRadius: 6, padding: "6px 14px", cursor: "pointer", fontSize: 12,
            }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

const miniBtn = (disabled) => ({
  background: "transparent", border: "none", color: disabled ? "#33364a" : "#8b8fa3",
  cursor: disabled ? "default" : "pointer", fontSize: 12, padding: "4px 5px",
});

// ---------- Boss team presets ----------
function PresetsModal({ onClose, onAdd, existingNames }) {
  const [groupIdx, setGroupIdx] = useState(0);
  const [added, setAdded] = useState(new Set());

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const group = PRESET_GROUPS[groupIdx];
  const region = group.label.split("—")[1].split("(")[0].trim();
  const listName = (t) => `${t[0]} (${region})`;

  const addOne = (t) => {
    onAdd([{ name: listName(t), pokemon: t[1] }]);
    setAdded((prev) => new Set(prev).add(group.label + t[0]));
  };
  const addAll = () => {
    const fresh = group.trainers.filter((t) => !added.has(group.label + t[0]) && !existingNames.has(listName(t)));
    if (fresh.length === 0) return;
    onAdd(fresh.map((t) => ({ name: listName(t), pokemon: t[1] })));
    setAdded((prev) => { const n = new Set(prev); fresh.forEach((t) => n.add(group.label + t[0])); return n; });
  };

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(5,6,12,.8)", zIndex: 50,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Boss team presets" style={{
        background: "#171927", border: "1px solid #2a2d40", borderRadius: 14,
        width: "100%", maxWidth: 560, maxHeight: "88vh", overflowY: "auto", padding: 20,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 10, color: "#8b8fa3" }}>⚑ BOSS TEAMS</span>
          <button onClick={onClose} aria-label="Close" style={{ background: "transparent", border: "none", color: "#8b8fa3", cursor: "pointer", fontSize: 18 }}>✕</button>
        </div>
        <p style={{ fontSize: 12, color: "#8b8fa3", margin: "0 0 10px" }}>
          Add gym leader, Elite Four, and champion teams as opponent lists, then use ⚔ Compare to plan your run.
        </p>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <select value={groupIdx} onChange={(e) => setGroupIdx(Number(e.target.value))}
            style={{ ...inputStyle, marginTop: 0, flex: 1, cursor: "pointer" }}>
            {PRESET_GROUPS.map((g, i) => <option key={i} value={i}>{g.label}</option>)}
          </select>
          <button onClick={addAll} style={{ ...ioBtn, fontSize: 9, padding: "8px 12px" }}>ADD ALL</button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {group.trainers.map((t) => {
            const done = added.has(group.label + t[0]) || existingNames.has(listName(t));
            return (
              <div key={t[0]} style={{
                display: "flex", alignItems: "center", gap: 8, background: "#0e0f1a",
                border: "1px solid #2a2d40", borderRadius: 8, padding: "6px 10px",
              }}>
                <span style={{ width: 130, fontSize: 12, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t[0]}</span>
                <div style={{ flex: 1, display: "flex", gap: 2, flexWrap: "wrap" }}>
                  {t[1].map((id) => <span key={id} title={DEX[id - 1].name}><Sprite p={DEX[id - 1]} size={28} /></span>)}
                </div>
                <button onClick={() => addOne(t)} disabled={done} style={{
                  ...miniActionBtn, flexShrink: 0,
                  color: done ? "#54d66a" : "#8b8fa3", opacity: done ? 0.8 : 1,
                  cursor: done ? "default" : "pointer",
                }}>{done ? "✓ Added" : "+ Add"}</button>
              </div>
            );
          })}
        </div>
        <p style={{ fontSize: 10, color: "#5d6076", marginTop: 12, marginBottom: 0 }}>
          Rosters follow the named game versions; regional forms are shown as their base species, and a few rosters are condensed (duplicate species merged).
        </p>
      </div>
    </div>
  );
}

// ---------- List vs list battle comparison ----------
const fmtMult = (x) => x === 0.25 ? "¼" : x === 0.5 ? "½" : x === 0 ? "0" : String(x);

// Best STAB multiplier attacker can land on defender (type-based)
const bestStab = (att, def) => Math.max(...att.types.map((t) => defMult(t, def.types)));

function CompareModal({ lists, initialA, onClose }) {
  const [aId, setAId] = useState(initialA ?? lists[0]?.id);
  const [bId, setBId] = useState((lists.find((l) => l.id !== (initialA ?? lists[0]?.id)) || lists[0]).id);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const A = lists.find((l) => String(l.id) === String(aId));
  const B = lists.find((l) => String(l.id) === String(bId));
  const CAP = 12;
  const mine = (A?.pokemon || []).slice(0, CAP).map((e) => ({ ...DEX[e.id - 1], nick: e.nick }));
  const opps = (B?.pokemon || []).slice(0, CAP).map((e) => ({ ...DEX[e.id - 1], nick: e.nick }));

  const cell = (m, o) => ({ off: bestStab(m, o), def: bestStab(o, m) });
  const cellColor = (c) => {
    if (c.off > c.def) return c.off / Math.max(c.def, 0.25) >= 4 ? "#1f4d2a" : "#1a3322";
    if (c.off < c.def) return c.def / Math.max(c.off, 0.25) >= 4 ? "#56141c" : "#3a1a20";
    return "#1c1e2e";
  };

  // Per-opponent best answer
  const answers = opps.map((o) => {
    let best = null;
    mine.forEach((m) => {
      const c = cell(m, o);
      const score = c.off / Math.max(c.def, 0.125);
      if (!best || score > best.score || (score === best.score && c.off > best.c.off)) best = { m, c, score };
    });
    return { o, best, safe: best && best.c.off > best.c.def };
  });
  const unanswered = answers.filter((a) => !a.safe);

  // My members in danger (unfavorable vs half+ of opponents)
  const endangered = mine.filter((m) =>
    opps.length > 0 && opps.filter((o) => { const c = cell(m, o); return c.def > c.off; }).length >= Math.ceil(opps.length / 2)
  );

  const avg = (mons) => mons.length ? Math.round(mons.reduce((s2, p) => s2 + bst(p), 0) / mons.length) : 0;
  const selStyle = { ...inputStyle, marginTop: 0, flex: 1, cursor: "pointer" };
  const nameOf = (p) => p.nick || p.name;

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(5,6,12,.8)", zIndex: 50,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Battle comparison" style={{
        background: "#171927", border: "1px solid #2a2d40", borderRadius: 14,
        width: "100%", maxWidth: 760, maxHeight: "90vh", overflowY: "auto", padding: 20,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 10, color: "#8b8fa3" }}>⚔ BATTLE PREP</span>
          <button onClick={onClose} aria-label="Close" style={{ background: "transparent", border: "none", color: "#8b8fa3", cursor: "pointer", fontSize: 18 }}>✕</button>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <select value={aId} onChange={(e) => setAId(Number(e.target.value))} style={selStyle}>
            {lists.map((l) => <option key={l.id} value={l.id}>Your side: {l.name}</option>)}
          </select>
          <span style={{ color: "#8b8fa3", fontSize: 12 }}>vs</span>
          <select value={bId} onChange={(e) => setBId(Number(e.target.value))} style={selStyle}>
            {lists.map((l) => <option key={l.id} value={l.id}>Opponent: {l.name}</option>)}
          </select>
        </div>

        {mine.length === 0 || opps.length === 0 ? (
          <p style={{ color: "#8b8fa3", fontSize: 13, marginTop: 16 }}>Both lists need at least one Pokémon to compare.</p>
        ) : (
          <>
            <div style={{ display: "flex", gap: 16, margin: "12px 0", fontSize: 12, color: "#8b8fa3" }}>
              <span>Avg BST — you: <strong style={{ color: avg(mine) >= avg(opps) ? "#7ee08a" : "#ff8a91" }}>{avg(mine)}</strong></span>
              <span>opponent: <strong>{avg(opps)}</strong></span>
              {(A.pokemon.length > CAP || B.pokemon.length > CAP) && <span>(first {CAP} per side shown)</span>}
            </div>

            {/* Matchup matrix */}
            <div style={{ fontSize: 11, color: "#8b8fa3", marginBottom: 6 }}>
              Matchup matrix — each cell shows your best STAB hit × / their best STAB hit ×. Green = you win the type matchup.
            </div>
            <div style={{ overflowX: "auto", border: "1px solid #2a2d40", borderRadius: 8 }}>
              <table style={{ borderCollapse: "collapse", fontSize: 10 }}>
                <thead>
                  <tr>
                    <th style={{ padding: 4 }}></th>
                    {opps.map((o, i) => (
                      <th key={i} style={{ padding: 4 }} title={`${nameOf(o)} (${o.types.join("/")})`}>
                        <Sprite p={o} size={30} />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {mine.map((m, i) => (
                    <tr key={i}>
                      <th style={{ padding: 4, textAlign: "right" }} title={`${nameOf(m)} (${m.types.join("/")})`}>
                        <Sprite p={m} size={30} />
                      </th>
                      {opps.map((o, j) => {
                        const c = cell(m, o);
                        return (
                          <td key={j} title={`${nameOf(m)} vs ${nameOf(o)}: your best STAB ${fmtMult(c.off)}× · theirs ${fmtMult(c.def)}×`}
                            style={{
                              background: cellColor(c), border: "1px solid #0e0f1a", textAlign: "center",
                              minWidth: 38, padding: "6px 2px",
                              color: c.off > c.def ? "#7ee08a" : c.off < c.def ? "#ff8a91" : "#8b8fa3",
                            }}>
                            {fmtMult(c.off)}/{fmtMult(c.def)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Best answers */}
            <div style={{ fontSize: 11, color: "#8b8fa3", margin: "14px 0 6px" }}>Recommended answers</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {answers.map(({ o, best, safe }, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                  <Sprite p={o} size={26} />
                  <span style={{ width: 110, color: "#e8e9f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nameOf(o)}</span>
                  {safe ? (
                    <span style={{ color: "#8b8fa3" }}>
                      → lead with <strong style={{ color: "#7ee08a" }}>{nameOf(best.m)}</strong>
                      <span style={{ color: "#5d6076" }}> (hits {fmtMult(best.c.off)}×, takes {fmtMult(best.c.def)}×)</span>
                    </span>
                  ) : (
                    <span style={{ color: "#ff8a91" }}>⚠ no favorable matchup — best is {nameOf(best.m)} ({fmtMult(best.c.off)}×/{fmtMult(best.c.def)}×)</span>
                  )}
                </div>
              ))}
            </div>

            {(unanswered.length > 0 || endangered.length > 0) && (
              <div style={{ background: "#0e0f1a", border: "1px solid #2a2d40", borderRadius: 8, padding: 10, marginTop: 12, fontSize: 12, color: "#8b8fa3" }}>
                {unanswered.length > 0 && (
                  <div>⚠ <strong style={{ color: "#ff8a91" }}>{unanswered.map((a) => nameOf(a.o)).join(", ")}</strong> {unanswered.length === 1 ? "has" : "have"} no favorable answer on your side — consider adding coverage.</div>
                )}
                {endangered.length > 0 && (
                  <div style={{ marginTop: unanswered.length ? 6 : 0 }}>
                    🛡 <strong style={{ color: "#ffd23e" }}>{endangered.map(nameOf).join(", ")}</strong> {endangered.length === 1 ? "loses" : "lose"} the type matchup against half or more of this team — keep {endangered.length === 1 ? "it" : "them"} away from bad leads.
                  </div>
                )}
              </div>
            )}

            <p style={{ fontSize: 10, color: "#5d6076", marginTop: 12, marginBottom: 0 }}>
              Type-based STAB analysis only — movesets, abilities, items, and levels aren't factored in.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

// ---------- Import / Export ----------
function IOModal({ mode, lists, onClose, onImport }) {
  const [text, setText] = useState(mode === "export" ? JSON.stringify(lists, null, 2) : "");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setMsg("Copied to clipboard"); }
    catch {
      const ta = document.getElementById("io-textarea");
      ta.select();
      setMsg(document.execCommand("copy") ? "Copied to clipboard" : "Copy failed — select the text and copy manually");
    }
  };

  const doImport = () => {
    setMsg("");
    let data;
    try { data = JSON.parse(text); } catch { setMsg("That isn't valid JSON."); return; }
    if (!Array.isArray(data)) data = data && Array.isArray(data.lists) ? data.lists : [data];
    const imported = normalizeLists(data, {
      regenerateListIds: true,
      existingListIds: new Set(lists.map((l) => l.id)),
      skipInvalidPokemon: true,
      dedupePokemon: true,
    });
    if (!imported.ok) { setMsg(formatListValidationError(imported)); return; }
    const clean = imported.lists.filter((l) => l.pokemon.length > 0);
    if (clean.length === 0) { setMsg("Nothing importable found."); return; }
    onImport(clean);
  };

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(5,6,12,.75)", zIndex: 50,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" style={{
        background: "#171927", border: "1px solid #2a2d40", borderRadius: 14,
        width: "100%", maxWidth: 520, padding: 20,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 10, color: "#8b8fa3" }}>
            {mode === "export" ? "EXPORT LISTS" : "IMPORT LISTS"}
          </span>
          <button onClick={onClose} aria-label="Close" style={{ background: "transparent", border: "none", color: "#8b8fa3", cursor: "pointer", fontSize: 18 }}>✕</button>
        </div>
        <p style={{ fontSize: 12, color: "#8b8fa3", margin: "0 0 10px" }}>
          {mode === "export"
            ? "Copy this JSON to back up your lists or share them with another trainer."
            : "Paste exported JSON below. Imported lists are added alongside your existing ones."}
        </p>
        <textarea id="io-textarea" value={text} readOnly={mode === "export"}
          onChange={(e) => setText(e.target.value)}
          spellCheck={false}
          placeholder={mode === "import" ? '[{"name":"My Team","pokemon":[{"id":25,"nick":"Sparky"}]}]' : ""}
          style={{ ...inputStyle, marginTop: 0, height: 220, resize: "vertical", fontFamily: "monospace", fontSize: 12 }} />
        {msg && <div style={{ fontSize: 12, color: msg.startsWith("Copied") ? "#7ee08a" : "#ff8a91", marginTop: 8 }}>{msg}</div>}
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          {mode === "export" ? (
            <button onClick={copy} style={ioBtn}>COPY JSON</button>
          ) : (
            <button onClick={doImport} style={ioBtn}>IMPORT</button>
          )}
        </div>
      </div>
    </div>
  );
}

const ioBtn = {
  background: "#DC2430", border: "none", color: "#fff", borderRadius: 8,
  padding: "10px 18px", cursor: "pointer", fontFamily: "'Press Start 2P', monospace", fontSize: 10,
};

// ---------- Detail panel ----------
function InfoCell({ label, value }) {
  return (
    <div style={{ background: "#0e0f1a", border: "1px solid #2a2d40", borderRadius: 8, padding: "8px 10px" }}>
      <div style={{ fontSize: 9, color: "#5d6076", textTransform: "uppercase", letterSpacing: ".06em" }}>{label}</div>
      <div style={{ fontSize: 13, marginTop: 2 }}>{value}</div>
    </div>
  );
}

function DetailPanel({ pokemonId, onClose, onSelect, inList, onToggle, activeListName }) {
  const p = DEX[pokemonId - 1];
  const [shiny, setShiny] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => { setShiny(false); setImgFailed(false); }, [pokemonId]);
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const fam = familyOf(p.id);
  const female = p.gender === -1 ? null : (p.gender / 8) * 100;
  const badge = LEGEND_BADGE[p.legend];

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(5,6,12,.75)", zIndex: 50,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-label={`${p.name} details`} style={{
        background: "#171927", border: "1px solid #2a2d40", borderRadius: 14,
        width: "100%", maxWidth: 480, maxHeight: "88vh", overflowY: "auto", padding: 20,
      }}>
        {/* Header */}
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <div style={{ textAlign: "center" }}>
            {imgFailed ? <Sprite p={p} size={96} /> : (
              <img src={shiny ? shinySprite(p.id) : sprite(p.id)} alt={p.name} width={96} height={96}
                style={{ imageRendering: "pixelated", background: "#0e0f1a", borderRadius: 12 }}
                onError={() => (shiny ? setShiny(false) : setImgFailed(true))} />
            )}
            <button onClick={() => setShiny(!shiny)} disabled={imgFailed} style={{
              display: "block", margin: "6px auto 0", background: shiny ? "#3a2f10" : "#0e0f1a",
              border: shiny ? "1px solid #ffd23e" : "1px solid #2a2d40",
              color: shiny ? "#ffd23e" : "#8b8fa3", borderRadius: 6, padding: "4px 10px",
              cursor: imgFailed ? "default" : "pointer", fontSize: 11,
            }}>✨ {shiny ? "Shiny" : "Normal"}</button>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, color: "#5d6076" }}>
              #{String(p.id).padStart(4, "0")} · Gen {GENS[p.gen - 1]} ({GEN_REGIONS[p.gen - 1]})
              {badge && <span title={badge.label} style={{ color: badge.color, marginLeft: 6 }}>{badge.sym} {badge.label}</span>}
            </div>
            <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 14, margin: "6px 0 2px" }}>{p.name}</div>
            <div style={{ fontSize: 12, color: "#8b8fa3", marginBottom: 8 }}>{p.genus}</div>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {p.types.map((t) => <TypeBadge key={t} t={t} />)}
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" style={{
            alignSelf: "flex-start", background: "transparent", border: "none",
            color: "#8b8fa3", cursor: "pointer", fontSize: 18,
          }}>✕</button>
        </div>

        {/* Stats */}
        <div style={{ margin: "16px 0 4px", fontSize: 11, color: "#8b8fa3" }}>
          Base stats <span style={{ color: "#5d6076" }}>(BST {bst(p)})</span>
        </div>
        <StatBars stats={p.stats} height={7} max={200} />

        {/* Abilities */}
        <div style={{ margin: "14px 0 6px", fontSize: 11, color: "#8b8fa3" }}>Abilities</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {p.abilities.map((a, i) => {
            const hidden = a.endsWith("*");
            return (
              <span key={i} style={{
                background: "#0e0f1a", border: hidden ? "1px solid #a890f0" : "1px solid #2a2d40",
                color: hidden ? "#a890f0" : "#e8e9f0", borderRadius: 6, padding: "4px 10px", fontSize: 12,
              }}>{hidden ? a.slice(0, -1) : a}{hidden && <span style={{ fontSize: 9, marginLeft: 4, opacity: .8 }}>HIDDEN</span>}</span>
            );
          })}
        </div>

        {/* Info grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 14 }}>
          <InfoCell label="Height" value={`${(p.height / 10).toFixed(1)} m`} />
          <InfoCell label="Weight" value={`${(p.weight / 10).toFixed(1)} kg`} />
          <InfoCell label="Color" value={POKE_COLORS[p.color - 1] || "—"} />
          <InfoCell label="Shape" value={POKE_SHAPES[p.shape - 1] || "—"} />
          <InfoCell label="Habitat" value={HABITATS[p.habitat] + (p.habitat ? "" : " (Gen IV+)")} />
          <InfoCell label="Growth rate" value={GROWTH_RATES[p.growth - 1] || "—"} />
          <InfoCell label="Capture rate" value={`${p.capture} / 255`} />
          <InfoCell label="Base happiness" value={`${p.happiness} / 255`} />
          <InfoCell label="Egg groups" value={p.eggGroups.map((g) => EGG_GROUPS[g - 1]).join(", ") || "—"} />
          <InfoCell label="Gender" value={female === null ? "Genderless" : `${100 - female}% ♂ / ${female}% ♀`} />
        </div>

        {/* Evolution family */}
        {fam.length > 1 && (
          <>
            <div style={{ margin: "14px 0 6px", fontSize: 11, color: "#8b8fa3" }}>Evolution family</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {fam.map((id) => {
                const f = DEX[id - 1];
                return (
                  <button key={id} onClick={() => onSelect(id)} style={{
                    display: "flex", alignItems: "center", gap: 4, fontSize: 12, cursor: "pointer",
                    background: id === p.id ? "#26182a" : "#0e0f1a",
                    border: id === p.id ? "1px solid #DC2430" : "1px solid #2a2d40",
                    color: "#e8e9f0", borderRadius: 20, padding: "3px 10px 3px 4px",
                  }}>
                    <Sprite p={f} size={24} />{f.name}
                  </button>
                );
              })}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 8 }}>
              {fam.filter((id) => DEX[id - 1].evoFrom).map((id) => {
                const f = DEX[id - 1];
                return (
                  <div key={id} style={{ fontSize: 11 }}>
                    <span style={{ color: f.id === p.id || f.evoFrom === p.id ? "#e8e9f0" : "#8b8fa3" }}>
                      {DEX[f.evoFrom - 1].name} → {f.name}:
                    </span>{" "}
                    <span style={{ color: "#a890f0" }}>{f.evoHow || "Method unknown"}</span>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Action */}
        <button onClick={() => onToggle(p.id)} style={{
          width: "100%", marginTop: 16, padding: "12px 0", borderRadius: 8, border: "none",
          cursor: "pointer", fontFamily: "'Press Start 2P', monospace", fontSize: 10,
          background: inList ? "#2a2d40" : "#DC2430", color: "#fff",
        }}>
          {activeListName
            ? (inList ? `REMOVE FROM ${activeListName.toUpperCase()}` : `ADD TO ${activeListName.toUpperCase()}`)
            : "CREATE A LIST TO ADD"}
        </button>
      </div>
    </div>
  );
}

// ---------- Team analysis ----------
function TeamAnalysis({ entries }) {
  const team = entries.map((e) => DEX[e.id - 1]);
  const avg = STAT_NAMES.map((_, i) =>
    team.reduce((a, p) => a + p.stats[i], 0) / team.length
  );
  const avgBst = Math.round(team.reduce((a, p) => a + bst(p), 0) / team.length);

  // For each attacking type: who takes super-effective damage, who resists/is immune
  const coverage = TYPE_ORDER.map((atk) => {
    let weak = 0, resist = 0;
    team.forEach((p) => {
      const m = defMult(atk, p.types);
      if (m > 1) weak++;
      else if (m < 1) resist++;
    });
    return { atk, weak, resist };
  });
  const threats = coverage.filter((c) => c.weak > 0).sort((a, b) => b.weak - a.weak);
  const uncovered = coverage.filter((c) => c.weak > 0 && c.resist === 0);
  const walls = coverage.filter((c) => c.resist > 0 && c.weak === 0).sort((a, b) => b.resist - a.resist);

  const chip = (c, mode) => (
    <span key={c.atk} style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      background: "#0e0f1a", border: "1px solid #2a2d40", borderRadius: 4, padding: "3px 6px",
    }}>
      <TypeBadge t={c.atk} />
      <span style={{ fontSize: 10, color: mode === "weak" ? "#ff8a91" : "#7ee08a" }}>
        ×{mode === "weak" ? c.weak : c.resist}
      </span>
    </span>
  );

  return (
    <div style={{ background: "#171927", border: "1px solid #2a2d40", borderRadius: 10, padding: 14, marginTop: 12 }}>
      <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 9, color: "#8b8fa3", marginBottom: 10 }}>
        TEAM ANALYSIS — {team.length} POKÉMON
      </div>

      <div style={{ fontSize: 11, color: "#8b8fa3", marginBottom: 6 }}>
        Average stats <span style={{ color: "#5d6076" }}>(avg BST {avgBst})</span>
      </div>
      <StatBars stats={avg} height={6} max={150} />

      {uncovered.length > 0 && (
        <>
          <div style={{ fontSize: 11, color: "#ff8a91", margin: "12px 0 6px" }}>
            ⚠ Unanswered — these hit someone super-effectively and nobody resists them
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {uncovered.map((c) => chip(c, "weak"))}
          </div>
        </>
      )}

      {threats.length > 0 && (
        <>
          <div style={{ fontSize: 11, color: "#8b8fa3", margin: "12px 0 6px" }}>
            Weak to <span style={{ color: "#5d6076" }}>(members hit super-effectively)</span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {threats.map((c) => chip(c, "weak"))}
          </div>
        </>
      )}

      {walls.length > 0 && (
        <>
          <div style={{ fontSize: 11, color: "#8b8fa3", margin: "12px 0 6px" }}>
            Safely resisted <span style={{ color: "#5d6076" }}>(resisted by some, super-effective on none)</span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {walls.map((c) => chip(c, "resist"))}
          </div>
        </>
      )}
    </div>
  );
}

// ---------- Main app ----------
export default function App() {
  const [user, setUser] = useState(null);
  const [lists, setLists] = useState([]);
  const [activeListId, setActiveListId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [genFilter, setGenFilter] = useState(0);
  const [habitatFilter, setHabitatFilter] = useState(-1);
  const [rarityFilter, setRarityFilter] = useState(-1);
  const [selectedId, setSelectedId] = useState(null);
  const [colorFilter, setColorFilter] = useState(0);
  const [shapeFilter, setShapeFilter] = useState(0);
  const [moreFilters, setMoreFilters] = useState(false);
  const [ioMode, setIoMode] = useState(null);
  const [compareOpen, setCompareOpen] = useState(false);
  const [presetsOpen, setPresetsOpen] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [toast, setToast] = useState("");
  const [dragIndex, setDragIndex] = useState(null);
  const [dragTarget, setDragTarget] = useState(null);
  const [visibleCount, setVisibleCount] = useState(120);
  const saveSeq = useRef(0);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 1800);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => { setVisibleCount(120); }, [search, typeFilter, genFilter, habitatFilter, rarityFilter, colorFilter, shapeFilter]);

  useEffect(() => {
    const session = api.getStoredSession();
    if (!session) return;
    (async () => {
      setLoading(true);
      try {
        const ls = await loadLists();
        setUser(session.username);
        setLists(ls);
        setActiveListId(ls[0]?.id ?? null);
      } catch (err) {
        if (err.status === 401) {
          api.clearSession();
          setToast("Session expired — log in again");
        } else {
          api.clearSession();
          setToast("Could not load saved lists — try logging in again");
        }
        setUser(null);
        setLists([]);
        setActiveListId(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = async (u) => {
    setLoading(true);
    try {
      const ls = await loadLists();
      setUser(u);
      setLists(ls);
      setActiveListId(ls[0]?.id ?? null);
    } catch (err) {
      api.clearSession();
      setUser(null);
      setLists([]);
      setActiveListId(null);
      throw new Error(err.status === 401 ? "Session expired — log in again." : "Could not load saved lists. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    api.clearSession();
    setUser(null);
    setLists([]);
    setActiveListId(null);
  };

  const persist = async (next, options = {}) => {
    const validation = validateLists(next);
    if (!validation.ok) {
      setToast(formatListValidationError(validation));
      return;
    }
    const safeNext = validation.lists;
    const previousLists = lists;
    const previousActiveListId = activeListId;
    const nextActiveListId = Object.prototype.hasOwnProperty.call(options, "activeListId")
      ? options.activeListId
      : activeListId;
    const seq = saveSeq.current + 1;
    saveSeq.current = seq;
    setLists(safeNext);
    setActiveListId(nextActiveListId);
    try {
      await saveLists(safeNext);
    } catch (err) {
      if (seq !== saveSeq.current) return;
      if (err.status === 401) {
        api.clearSession();
        setUser(null);
        setLists([]);
        setActiveListId(null);
        setToast("Session expired — log in again");
        return;
      }
      setLists(previousLists);
      setActiveListId(previousActiveListId);
      setToast("Save failed — changes were rolled back");
    }
  };

  const createList = () => {
    const name = newListName.trim();
    if (!name) return;
    const l = { id: generateListId(new Set(lists.map((list) => list.id))), name, pokemon: [] };
    persist([...lists, l], { activeListId: l.id });
    setNewListName("");
    setToast(`Created "${name}"`);
  };

  const deleteList = (id) => {
    const next = lists.filter((l) => l.id !== id);
    persist(next, { activeListId: activeListId === id ? next[0]?.id ?? null : activeListId });
  };

  const activeList = lists.find((l) => l.id === activeListId) || null;

  const updateActive = (fn) => {
    persist(lists.map((l) => (l.id === activeListId ? fn(l) : l)));
  };

  const toggleInList = (pid) => {
    if (!activeList) { setToast("Create a list first"); return; }
    const has = activeList.pokemon.some((e) => e.id === pid);
    if (!has && activeList.team && activeList.pokemon.length >= 6) {
      setToast("Team is full (6/6) — remove someone first"); return;
    }
    updateActive((l) => ({
      ...l,
      pokemon: has ? l.pokemon.filter((e) => e.id !== pid) : [...l.pokemon, { id: pid, nick: "", note: "" }],
    }));
    const p = DEX[pid - 1];
    setToast(has ? `${p.name} removed` : `${p.name} → ${activeList.name}`);
  };

  const addFamily = (pid) => {
    if (!activeList) { setToast("Create a list first"); return; }
    const fam = familyOf(pid);
    const have = new Set(activeList.pokemon.map((e) => e.id));
    let add = fam.filter((id) => !have.has(id));
    if (add.length === 0) { setToast("Whole line is already in the list"); return; }
    if (activeList.team) {
      const space = 6 - activeList.pokemon.length;
      if (space <= 0) { setToast("Team is full (6/6)"); return; }
      if (add.length > space) { add = add.slice(0, space); }
    }
    updateActive((l) => ({
      ...l,
      pokemon: [...l.pokemon, ...add.map((id) => ({ id, nick: "", note: "" }))],
    }));
    const root = DEX[fam[0] - 1];
    setToast(`Added ${root.name} line (+${add.length})`);
  };

  const evolveEntry = (fromId, toId) => {
    if (activeList.pokemon.some((e) => e.id === toId)) {
      setToast(`${DEX[toId - 1].name} is already in this list`); return;
    }
    const old = activeList.pokemon.find((e) => e.id === fromId);
    updateActive((l) => ({
      ...l,
      pokemon: l.pokemon.map((e) => (e.id === fromId ? { ...e, id: toId } : e)),
    }));
    const who = old?.nick || DEX[fromId - 1].name;
    setToast(`${who} evolved into ${DEX[toId - 1].name}!`);
  };

  const moveEntry = (index, dir) => {
    updateActive((l) => {
      const arr = [...l.pokemon];
      const j = index + dir;
      if (j < 0 || j >= arr.length) return l;
      [arr[index], arr[j]] = [arr[j], arr[index]];
      return { ...l, pokemon: arr };
    });
  };

  const reorder = (from, to) => {
    if (from === to || from == null || to == null) return;
    updateActive((l) => {
      const arr = [...l.pokemon];
      const [moved] = arr.splice(from, 1);
      arr.splice(to, 0, moved);
      return { ...l, pokemon: arr };
    });
  };

  const filtered = useMemo(() => DEX.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) &&
    (!typeFilter || p.types.includes(typeFilter)) &&
    (!genFilter || p.gen === genFilter) &&
    (habitatFilter === -1 || p.habitat === habitatFilter) &&
    (rarityFilter === -1 || p.legend === rarityFilter) &&
    (!colorFilter || p.color === colorFilter) &&
    (!shapeFilter || p.shape === shapeFilter)
  ), [search, typeFilter, genFilter, habitatFilter, rarityFilter, colorFilter, shapeFilter]);

  const extraActive = (habitatFilter !== -1) + (rarityFilter !== -1) + (colorFilter !== 0) + (shapeFilter !== 0);
  const shown = filtered.slice(0, visibleCount);
  const inActive = new Set(activeList?.pokemon.map((e) => e.id));

  return (
    <div style={{ minHeight: "100vh", background: "#0e0f1a", color: "#e8e9f0", fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&family=IBM+Plex+Sans:wght@400;600&display=swap');
        button:focus-visible, input:focus-visible, select:focus-visible { outline: 2px solid #ff5a64; outline-offset: 2px; }
        ::placeholder { color: #5d6076; }
      `}</style>

      {/* Pokédex top bar */}
      <header style={{
        background: "linear-gradient(180deg,#E62A36,#B5121F)",
        padding: "14px 20px 16px", display: "flex", alignItems: "center", gap: 16,
        borderBottom: "4px solid #7d0c15", flexWrap: "wrap",
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: "50%", flexShrink: 0,
          background: "radial-gradient(circle at 32% 30%, #bfe5ff, #2e8fe0 55%, #14467e)",
          border: "3px solid #f3f4fa", boxShadow: "0 2px 6px rgba(0,0,0,.4)",
        }} />
        <div style={{ display: "flex", gap: 6, alignSelf: "flex-start" }}>
          {["#ff4d4d", "#ffd23e", "#54d66a"].map((c) => (
            <span key={c} style={{ width: 10, height: 10, borderRadius: "50%", background: c, border: "1px solid rgba(0,0,0,.3)" }} />
          ))}
        </div>
        <h1 style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 14, margin: 0, flex: 1, color: "#fff", textShadow: "2px 2px 0 #7d0c15" }}>
          DEX KEEPER
        </h1>
        {user && (
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 13, color: "#ffd9dc" }}>Trainer {user}</span>
            <button onClick={logout} style={{
              background: "#7d0c15", color: "#fff", border: "1px solid #ffb3b8", borderRadius: 6,
              padding: "6px 12px", cursor: "pointer", fontSize: 12,
            }}>Log out</button>
          </div>
        )}
      </header>

      {!user ? (
        <AuthScreen onLogin={login} />
      ) : loading ? (
        <p style={{ textAlign: "center", marginTop: 60, fontFamily: "'Press Start 2P', monospace", fontSize: 10, color: "#8b8fa3" }}>LOADING...</p>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 20, padding: 20, maxWidth: 1150, margin: "0 auto" }}>

          {/* Lists panel */}
          <aside style={{ flex: "1 1 280px", minWidth: 280, maxWidth: 380 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h2 style={panelTitle}>MY LISTS</h2>
              <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                <button onClick={() => setPresetsOpen(true)} title="Add gym leader and Elite Four teams"
                  style={miniActionBtn}>⚑ Bosses</button>
                <button onClick={() => setCompareOpen(true)} disabled={lists.length < 2}
                  title="Compare two lists for battle prep"
                  style={{ ...miniActionBtn, opacity: lists.length < 2 ? 0.4 : 1 }}>⚔ Compare</button>
                <button onClick={() => setIoMode("export")} disabled={lists.length === 0} title="Export lists as JSON"
                  style={{ ...miniActionBtn, opacity: lists.length === 0 ? 0.4 : 1 }}>⇪ Export</button>
                <button onClick={() => setIoMode("import")} title="Import lists from JSON" style={miniActionBtn}>⇩ Import</button>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <input value={newListName} onChange={(e) => setNewListName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && createList()}
                placeholder="New list name…" style={{ ...inputStyle, marginTop: 0, flex: 1 }} />
              <button onClick={createList} style={{
                background: "#DC2430", border: "none", color: "#fff", borderRadius: 8,
                padding: "0 14px", cursor: "pointer", fontSize: 18, fontWeight: 700,
              }} aria-label="Create list">+</button>
            </div>
            {lists.length === 0 && (
              <p style={{ fontSize: 13, color: "#5d6076" }}>No lists yet. Create one — "Dream Team", "Shiny Wishlist", anything.</p>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {lists.map((l) => (
                <div key={l.id} onClick={() => setActiveListId(l.id)} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "10px 12px", borderRadius: 8, cursor: "pointer",
                  background: l.id === activeListId ? "#26182a" : "#171927",
                  border: l.id === activeListId ? "1px solid #DC2430" : "1px solid #2a2d40",
                }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{l.name}</div>
                    <div style={{ fontSize: 11, color: "#8b8fa3" }}>
                      {l.team
                        ? <span style={{ color: l.pokemon.length > 6 ? "#ff8a91" : "#8b8fa3" }}>⚔ Team · {l.pokemon.length}/6</span>
                        : `${l.pokemon.length} Pokémon`}
                    </div>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); deleteList(l.id); }} aria-label={`Delete ${l.name}`} style={{
                    background: "transparent", border: "none", color: "#5d6076", cursor: "pointer", fontSize: 16,
                  }}>✕</button>
                </div>
              ))}
            </div>

            {activeList && activeList.pokemon.length > 0 && (
              <>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 24 }}>
                  <h2 style={{ ...panelTitle, margin: 0 }}>ROSTER — {activeList.name.toUpperCase()}</h2>
                  <button onClick={() => updateActive((l) => ({ ...l, team: !l.team }))}
                    title="Battle team mode caps this list at 6 Pokémon"
                    style={{
                      ...miniActionBtn,
                      border: activeList.team ? "1px solid #DC2430" : "1px solid #2a2d40",
                      color: activeList.team ? "#ff8a91" : "#8b8fa3",
                    }}>
                    ⚔ 6-slot {activeList.team ? "ON" : "OFF"}
                  </button>
                </div>
                {activeList.team && activeList.pokemon.length > 6 && (
                  <p style={{ fontSize: 11, color: "#ff8a91", margin: "6px 0 0" }}>
                    Over the limit ({activeList.pokemon.length}/6) — remove {activeList.pokemon.length - 6} to make this a legal team.
                  </p>
                )}
                <p style={{ fontSize: 11, color: "#5d6076", margin: "0 0 10px" }}>
                  Drag (or use ▲▼) to reorder. ✎ to add a nickname or note.
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}
                  onDragLeave={() => setDragTarget(null)}>
                  {activeList.pokemon.map((entry, i) => (
                    <RosterEntry
                      key={entry.id}
                      entry={entry}
                      index={i}
                      total={activeList.pokemon.length}
                      isDragTarget={dragTarget === i && dragIndex !== i}
                      onMove={moveEntry}
                      onRemove={() => toggleInList(entry.id)}
                      onEvolve={(toId) => evolveEntry(entry.id, toId)}
                      onEdit={(updated) => updateActive((l) => ({
                        ...l, pokemon: l.pokemon.map((e) => (e.id === updated.id ? updated : e)),
                      }))}
                      onDragStart={(e, idx) => { setDragIndex(idx); e.dataTransfer.effectAllowed = "move"; }}
                      onDragOver={(e, idx) => { e.preventDefault(); setDragTarget(idx); }}
                      onDrop={(e, idx) => { e.preventDefault(); reorder(dragIndex, idx); setDragIndex(null); setDragTarget(null); }}
                    />
                  ))}
                </div>
                <TeamAnalysis entries={activeList.pokemon} />
              </>
            )}
          </aside>

          {/* Dex browser */}
          <main style={{ flex: "3 1 480px", minWidth: 300 }}>
            <h2 style={panelTitle}>POKÉDEX — {filtered.length} OF {DEX.length}</h2>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name…"
                style={{ ...inputStyle, marginTop: 0, flex: "2 1 160px" }} />
              <select value={genFilter} onChange={(e) => setGenFilter(Number(e.target.value))}
                style={{ ...inputStyle, marginTop: 0, flex: "1 1 140px", cursor: "pointer" }}>
                <option value={0}>All generations</option>
                {GENS.map((g, i) => (
                  <option key={g} value={i + 1}>Gen {g} — {GEN_REGIONS[i]}</option>
                ))}
              </select>
              <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
                style={{ ...inputStyle, marginTop: 0, flex: "1 1 110px", cursor: "pointer" }}>
                <option value="">All types</option>
                {ALL_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <button onClick={() => setMoreFilters(!moreFilters)} style={{
                ...miniActionBtn, flex: "0 0 auto",
                border: extraActive ? "1px solid #DC2430" : "1px solid #2a2d40",
                color: extraActive ? "#ff8a91" : "#8b8fa3",
              }}>
                {moreFilters ? "▾" : "▸"} More filters{extraActive ? ` (${extraActive})` : ""}
              </button>
            </div>
            {moreFilters && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
                <select value={habitatFilter} onChange={(e) => setHabitatFilter(Number(e.target.value))}
                  style={{ ...inputStyle, marginTop: 0, flex: "1 1 130px", cursor: "pointer" }}>
                  <option value={-1}>All habitats</option>
                  {HABITATS.slice(1).map((h, i) => <option key={h} value={i + 1}>{h}</option>)}
                  <option value={0}>Unknown (Gen IV+)</option>
                </select>
                <select value={rarityFilter} onChange={(e) => setRarityFilter(Number(e.target.value))}
                  style={{ ...inputStyle, marginTop: 0, flex: "1 1 110px", cursor: "pointer" }}>
                  <option value={-1}>All rarities</option>
                  <option value={0}>Regular</option>
                  <option value={1}>★ Legendary</option>
                  <option value={2}>✦ Mythical</option>
                </select>
                <select value={colorFilter} onChange={(e) => setColorFilter(Number(e.target.value))}
                  style={{ ...inputStyle, marginTop: 0, flex: "1 1 100px", cursor: "pointer" }}>
                  <option value={0}>All colors</option>
                  {POKE_COLORS.map((c, i) => <option key={c} value={i + 1}>{c}</option>)}
                </select>
                <select value={shapeFilter} onChange={(e) => setShapeFilter(Number(e.target.value))}
                  style={{ ...inputStyle, marginTop: 0, flex: "1 1 100px", cursor: "pointer" }}>
                  <option value={0}>All shapes</option>
                  {POKE_SHAPES.map((c, i) => <option key={c} value={i + 1}>{c}</option>)}
                </select>
                {extraActive > 0 && (
                  <button onClick={() => { setHabitatFilter(-1); setRarityFilter(-1); setColorFilter(0); setShapeFilter(0); }}
                    style={miniActionBtn}>Clear</button>
                )}
              </div>
            )}
            {activeList ? (
              <p style={{ fontSize: 12, color: "#8b8fa3", margin: "0 0 12px" }}>
                Tap a Pokémon to add it to <strong style={{ color: "#ff8a91" }}>{activeList.name}</strong>.
              </p>
            ) : (
              <p style={{ fontSize: 12, color: "#8b8fa3", margin: "0 0 12px" }}>Create a list to start collecting.</p>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10 }}>
              {shown.map((p) => {
                const inList = inActive.has(p.id);
                const from = p.evoFrom ? DEX[p.evoFrom - 1].name : null;
                const intoMons = (CHILDREN[p.id] || []).map((i) => DEX[i - 1]);
                const evoStr = [from && `from ${from}`, intoMons.length > 0 && `into ${intoMons.map((m) => m.name).join(", ")}`].filter(Boolean).join(" · ");
                const evoTip = [
                  from && `From ${from}${p.evoHow ? ` — ${p.evoHow}` : ""}`,
                  ...intoMons.map((m) => `Into ${m.name}${m.evoHow ? ` — ${m.evoHow}` : ""}`),
                ].filter(Boolean).join("\n");
                return (
                  <div key={p.id} role="button" tabIndex={0}
                    onClick={() => toggleInList(p.id)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleInList(p.id); } }}
                    style={{
                    textAlign: "left", background: inList ? "#26182a" : "#171927",
                    border: inList ? "1px solid #DC2430" : "1px solid #2a2d40",
                    borderRadius: 10, padding: 10, cursor: "pointer", color: "#e8e9f0",
                    display: "flex", flexDirection: "column", gap: 6, position: "relative",
                  }}>
                    {inList && <span style={{
                      position: "absolute", top: 8, right: 8, fontSize: 10, color: "#ff8a91",
                      fontFamily: "'Press Start 2P', monospace",
                    }}>✓</span>}
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Sprite p={p} size={48} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 10, color: "#5d6076" }}>
                          #{String(p.id).padStart(4, "0")} · Gen {GENS[p.gen - 1]}
                          {LEGEND_BADGE[p.legend] && (
                            <span title={LEGEND_BADGE[p.legend].label}
                              style={{ color: LEGEND_BADGE[p.legend].color, marginLeft: 4 }}>
                              {LEGEND_BADGE[p.legend].sym}
                            </span>
                          )}
                        </div>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{p.name}</div>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {p.types.map((t) => <TypeBadge key={t} t={t} />)}
                    </div>
                    <div style={{ fontSize: 10, color: p.habitat ? "#8b8fa3" : "#5d6076", display: "flex", justifyContent: "space-between" }}>
                      <span>⌖ {HABITATS[p.habitat]}{!p.habitat && " habitat"}</span>
                      <span title={p.stats.map((v, i) => `${STAT_NAMES[i]} ${v}`).join(" · ")}
                        style={{ color: "#8b8fa3" }}>BST {bst(p)}</span>
                    </div>
                    <div style={{ fontSize: 9, color: "#5d6076", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                      title={"Abilities: " + p.abilities.map((a) => a.endsWith("*") ? a.slice(0, -1) + " (hidden)" : a).join(", ")}>
                      ◈ {p.abilities.map((a, i) => (
                        <span key={i}>
                          {i > 0 && " · "}
                          <span style={a.endsWith("*") ? { color: "#a890f0", fontStyle: "italic" } : undefined}>
                            {a.endsWith("*") ? a.slice(0, -1) : a}
                          </span>
                        </span>
                      ))}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span title={evoTip} style={{
                        fontSize: 9, color: "#5d6076", flex: 1, minWidth: 0,
                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                      }}>{evoStr ? `⤳ ${evoStr}` : ""}</span>
                      {evoStr && (
                        <button onClick={(e) => { e.stopPropagation(); addFamily(p.id); }}
                          title="Add the whole evolution line to the active list"
                          aria-label={`Add ${p.name}'s evolution line`}
                          style={{
                            background: "#0e0f1a", border: "1px solid #2a2d40", color: "#8b8fa3",
                            borderRadius: 4, padding: "2px 7px", cursor: "pointer", fontSize: 10, flexShrink: 0,
                          }}>+line</button>
                      )}
                      <button onClick={(e) => { e.stopPropagation(); setSelectedId(p.id); }}
                        title="Full details" aria-label={`${p.name} details`}
                        style={{
                          background: "#0e0f1a", border: "1px solid #2a2d40", color: "#8b8fa3",
                          borderRadius: 4, padding: "2px 7px", cursor: "pointer", fontSize: 10, flexShrink: 0,
                        }}>ⓘ</button>
                    </div>
                  </div>
                );
              })}
            </div>
            {filtered.length === 0 && <p style={{ color: "#5d6076" }}>No Pokémon match that search.</p>}
            {visibleCount < filtered.length && (
              <div style={{ textAlign: "center", marginTop: 16 }}>
                <button onClick={() => setVisibleCount((c) => c + 240)} style={{
                  background: "#171927", border: "1px solid #2a2d40", color: "#e8e9f0",
                  borderRadius: 8, padding: "10px 20px", cursor: "pointer",
                  fontFamily: "'Press Start 2P', monospace", fontSize: 10,
                }}>SHOW MORE ({filtered.length - visibleCount} LEFT)</button>
              </div>
            )}
          </main>
        </div>
      )}

      {presetsOpen && (
        <PresetsModal
          onClose={() => setPresetsOpen(false)}
          existingNames={new Set(lists.map((l) => l.name))}
          onAdd={(teams) => {
            const usedIds = new Set(lists.map((l) => l.id));
            const newLists = teams.map((t) => ({
              id: generateListId(usedIds), name: t.name, team: false,
              pokemon: t.pokemon.map((id) => ({ id, nick: "", note: "" })),
            }));
            persist([...lists, ...newLists]);
            setToast(`Added ${teams.length === 1 ? teams[0].name : teams.length + " boss teams"}`);
          }}
        />
      )}

      {compareOpen && (
        <CompareModal lists={lists} initialA={activeListId} onClose={() => setCompareOpen(false)} />
      )}

      {ioMode && (
        <IOModal mode={ioMode} lists={lists} onClose={() => setIoMode(null)}
          onImport={(incoming) => {
            persist([...lists, ...incoming]);
            setIoMode(null);
            setToast(`Imported ${incoming.length} list${incoming.length > 1 ? "s" : ""}`);
          }} />
      )}

      {selectedId && (
        <DetailPanel
          pokemonId={selectedId}
          onClose={() => setSelectedId(null)}
          onSelect={setSelectedId}
          inList={!!activeList && activeList.pokemon.some((e) => e.id === selectedId)}
          onToggle={toggleInList}
          activeListName={activeList?.name || null}
        />
      )}

      {toast && (
        <div style={{
          position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)",
          background: "#DC2430", color: "#fff", padding: "10px 18px", borderRadius: 8,
          fontSize: 13, boxShadow: "0 4px 14px rgba(0,0,0,.5)", zIndex: 10,
        }}>{toast}</div>
      )}
    </div>
  );
}
