'use client';

import { useState } from 'react';

export default function HomePage() {
  const [repo, setRepo] = useState('');
  return (
    <main className="shell">
      <section className="hero">
        <div className="pill"><span /> Parrilla IA encendida</div>
        <div className="heroGrid">
          <div>
            <p className="kicker">README al fuego, soluciones al plato</p>
            <h1>La <em>Rostizadora</em> Digital</h1>
            <p className="lead">Pega un repositorio y recibe una crítica útil con soluciones concretas.</p>
            <form className="form">
              <label htmlFor="repo">Repositorio</label>
              <div className="inputRow">
                <input id="repo" value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="usuario/repositorio" />
                <button type="button">Rostizar proyecto</button>
              </div>
            </form>
          </div>
          <aside className="stage">
            <div className="bubble"><b>La Parrillera Cínica</b><span>Trae ese README. Lo revisamos con lupa.</span></div>
            <div className="grill"><i/><i/><i/><b/></div>
            <img className="mascot" src="/rostizadora-coach.svg" alt="Mascota" />
          </aside>
        </div>
      </section>
    </main>
  );
}
