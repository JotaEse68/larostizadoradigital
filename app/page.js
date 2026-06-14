'use client';

import { useState } from 'react';

const examples = ['vercel/next.js', 'supabase/supabase', 'facebook/react'];

function validRepo(value) {
  const v = value.trim();
  return /^[\w.-]+\/[\w.-]+$/.test(v) || /^https?:\/\/github\.com\/[^\s/]+\/[^\s/]+/i.test(v);
}

export default function HomePage() {
  const [repo, setRepo] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  async function submit(event) {
    event.preventDefault();
    setError('');
    setResult(null);
    if (!validRepo(repo)) {
      setError('Pega usuario/repositorio. La parrilla no cocina humo.');
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`/api/roast?repo=${encodeURIComponent(repo)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || 'No se pudo completar el análisis.');
      setResult(data);
    } catch (err) {
      setError(err.message || 'Error inesperado.');
    } finally {
      setLoading(false);
    }
  }

  const a = result?.analysis;

  return (
    <main className="shell">
      <div className="glow one" />
      <div className="glow two" />

      <section className="hero">
        <div className="pill"><span /> Parrilla IA encendida · 3 análisis/IP/día · 30k chars · sin login · gpt-4.1-nano</div>
        <div className="heroGrid">
          <div>
            <p className="kicker">README al fuego, soluciones al plato</p>
            <h1>La <em>Rostizadora</em> Digital</h1>
            <p className="lead">Pega un repositorio público. Primero lo tostamos con cinismo. Luego te damos un plan para que deje de parecer un proyecto abandonado en un descampado.</p>
            <form className="form" onSubmit={submit}>
              <label htmlFor="repo">Repositorio público</label>
              <div className="inputRow">
                <input id="repo" value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="usuario/repositorio" />
                <button disabled={loading || !repo.trim()}>{loading ? 'Avivando brasas…' : 'Rostizar proyecto'}</button>
              </div>
              <div className="examples">{examples.map((x) => <button key={x} type="button" onClick={() => setRepo(x)}>{x}</button>)}</div>
            </form>
            {error && <div className="error">{error}</div>}
          </div>
          <aside className="stage">
            <div className="bubble"><b>La Parrillera Cínica</b><span>Trae ese README. Si huele a humo, lo sabremos.</span></div>
            <div className="grill"><i/><i/><i/><b/></div>
            <img className="mascot" src="/rostizadora-coach.svg" alt="Mascota de La Rostizadora Digital" />
          </aside>
        </div>
      </section>

      <section className="strip">
        <article><span>🔥</span><b>Roast en 3 cortes</b><p>Claridad, confianza y uso real. Nada de aplausos vacíos.</p></article>
        <article><span>🧯</span><b>Rescate después del incendio</b><p>Acciones concretas para arreglarlo sin montar una tesis.</p></article>
        <article><span>💸</span><b>Coste vigilado</b><p>Nano, caché, rate limit y máximo de caracteres.</p></article>
      </section>

      {loading && <section className="loading"><div className="loader"><i/><i/><i/><b/></div><div><p className="eyebrow">Parrilla encendida</p><h2>Estamos tostando ese README…</h2><p>No cierres la página. Primero lo quemamos con criterio, luego lo salvamos con tareas claras.</p></div></section>}

      {a && <section className="results">
        <div className="top"><div><p className="eyebrow">Resultado de la parrilla</p><h2>{result.repo?.fullName}</h2><p>{a.verdict}</p></div><div className="score"><b>{a.score ?? '?'}</b><span>/100</span><small>{a.heatLevel}</small></div></div>
        <div className="burn"><img src="/rostizadora-coach.svg" alt="Avatar"/><strong>{a.openingBurn}</strong></div>
        <div className="cuts">
          <article className="card"><p className="eyebrow">Corte 1</p><h3>Claridad</h3><p>{a.roast?.claridad}</p></article>
          <article className="card"><p className="eyebrow">Corte 2</p><h3>Confianza</h3><p>{a.roast?.confianza}</p></article>
          <article className="card"><p className="eyebrow">Corte 3</p><h3>Uso real</h3><p>{a.roast?.uso}</p></article>
        </div>
        <div className="grid">
          <article className="card"><p className="eyebrow">No todo ardió</p><h3>Lo salvable</h3><p>{a.salvable}</p></article>
          <article className="card"><p className="eyebrow">Humo detectado</p><h3>Red flags</h3><ul>{(a.redFlags || []).map((x, i) => <li key={i}>{x}</li>)}</ul></article>
          <article className="card wide"><p className="eyebrow">Soluciones</p><h3>Plan de rescate</h3><ol>{(a.rescuePlan || []).map((x, i) => <li key={i}>{x}</li>)}</ol></article>
          <article className="card wide"><p className="eyebrow">Nuevo orden</p><h3>Estructura recomendada</h3><ul>{(a.fixedStructure || []).map((x, i) => <li key={i}>{x}</li>)}</ul></article>
          <article className="card wide"><p className="eyebrow">Empieza por aquí</p><h3>Primer bloque reescrito</h3><p>{a.rewriteStarter}</p></article>
        </div>
        <blockquote>{a.finalSizzle}</blockquote>
      </section>}

      <footer>La Rostizadora Digital · MVP Vercel Hobby · cinismo con utilidad, no humo con botones.</footer>
    </main>
  );
}
