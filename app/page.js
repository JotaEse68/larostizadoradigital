'use client';

import Image from 'next/image';
import { useMemo, useState } from 'react';

const examples = [
  'vercel/next.js',
  'supabase/supabase',
  'facebook/react',
  'sveltejs/svelte'
];

function isLikelyRepo(value) {
  const clean = value.trim();
  return /^https?:\/\/github\.com\/[^\s/]+\/[^\s/]+/i.test(clean) || /^[\w.-]+\/[\w.-]+$/.test(clean);
}

function ScoreBadge({ score }) {
  if (typeof score !== 'number') return null;

  let label = 'README con dignidad';
  if (score >= 85) label = 'Casi no me das trabajo';
  else if (score >= 70) label = 'Prometedor, criatura';
  else if (score >= 50) label = 'Necesita disciplina';
  else if (score >= 30) label = 'Esto pide camilla';
  else label = 'Documentación en terapia';

  return (
    <div className="scoreBadge" aria-label={`Puntuación ${score} sobre 100`}>
      <span>{score}</span>
      <small>/100 · {label}</small>
    </div>
  );
}

function SectionCard({ title, children, eyebrow, wide = false }) {
  return (
    <section className={wide ? 'resultCard resultCardWide' : 'resultCard'}>
      {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
      <h3>{title}</h3>
      {children}
    </section>
  );
}

function formatSeconds(seconds) {
  if (!seconds) return 'mañana';
  const hours = Math.ceil(seconds / 3600);
  if (hours <= 1) return 'en menos de 1 hora';
  return `en unas ${hours} horas`;
}

function buildMarkdown(result) {
  if (!result?.analysis) return '';
  const a = result.analysis;
  const repo = result.repo?.fullName || 'Repositorio analizado';

  return `# Roast README — ${repo}

**Puntuación:** ${typeof a.score === 'number' ? `${a.score}/100` : 'N/D'}

## Veredicto
${a.verdict || ''}

## Línea Jottarina
${a.personalityLine || ''}

## El roast
${a.roast || ''}

## Lo salvable
${a.salvable || ''}

## Red flags
${(a.redFlags || []).map((item) => `- ${item}`).join('\n')}

## Acciones prioritarias
${(a.actionItems || []).map((item, index) => `${index + 1}. ${item}`).join('\n')}

## Estructura recomendada
${(a.improvedStructure || []).map((item) => `- ${item}`).join('\n')}

## Bloque inicial sugerido
${a.rewriteStarter || ''}

## Remate
${a.finalPunchline || ''}
`;
}

export default function HomePage() {
  const [repo, setRepo] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);

  const canSubmit = useMemo(() => isLikelyRepo(repo) && !loading, [repo, loading]);

  async function roastRepo(event) {
    event.preventDefault();
    setError('');
    setResult(null);
    setCopied(false);

    if (!isLikelyRepo(repo)) {
      setError('Pega una URL pública de GitHub o el formato usuario/repositorio. No estamos invocando espíritus, criatura.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/roast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo })
      });

      const data = await response.json();

      if (!response.ok) {
        const suffix = data?.rate?.resetInSeconds ? ` Prueba de nuevo ${formatSeconds(data.rate.resetInSeconds)}.` : '';
        throw new Error(`${data?.error || 'No se pudo analizar el repositorio.'}${suffix}`);
      }

      setResult(data);
    } catch (err) {
      setError(err.message || 'Error inesperado al analizar el README. El caos hizo abdominales.');
    } finally {
      setLoading(false);
    }
  }

  function useExample(example) {
    setRepo(example);
    setError('');
    setResult(null);
    setCopied(false);
  }

  async function copyMarkdown() {
    const markdown = buildMarkdown(result);
    if (!markdown) return;

    await navigator.clipboard.writeText(markdown);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  const remaining = result?.rate?.remaining;
  const model = result?.limits?.model || 'gpt-4.1-nano';

  return (
    <main className="shell">
      <div className="noise" />

      <section className="hero">
        <div className="heroCopy">
          <div className="warning">3 análisis/IP/día · README máximo 30k · sin login · {model}</div>
          <h1><span>Jottarina</span> README Roaster</h1>
          <p className="subtitle">
            Pega un repositorio público de GitHub y deja que Jottarina revise el README con sarcasmo útil, diagnóstico claro y acciones concretas. Porque “ya lo mejoraré luego” es como nacen los cementerios de proyectos.
          </p>

          <form className="inputPanel" onSubmit={roastRepo}>
            <label htmlFor="repo">Repositorio público de GitHub</label>
            <div className="inputRow">
              <input
                id="repo"
                value={repo}
                onChange={(event) => setRepo(event.target.value)}
                placeholder="https://github.com/usuario/repositorio o usuario/repositorio"
                autoComplete="off"
              />
              <button disabled={!canSubmit} type="submit">
                {loading ? 'Juzgando…' : 'Roastear'}
              </button>
            </div>
            <div className="examples" aria-label="Ejemplos de repositorios">
              {examples.map((example) => (
                <button key={example} type="button" onClick={() => useExample(example)}>
                  {example}
                </button>
              ))}
            </div>
          </form>

          {error ? <div className="errorBox" role="alert">{error}</div> : null}
        </div>

        <aside className="mascotPanel" aria-label="Jottarina Coach">
          <div className="speechBubble">
            <strong>Jottarina Coach</strong>
            <span>“Trae ese README. Si está criando polvo, lo sabremos.”</span>
          </div>
          <Image
            src="/jottarina-coach.png"
            width={760}
            height={760}
            priority
            alt="Jottarina Coach, mascota sarcástica con gafas, auriculares y clipboard"
            className="mascotImage"
          />
        </aside>
      </section>

      <section className="controlStrip" aria-label="Controles de coste">
        <article>
          <strong>Coste protegido</strong>
          <span>gpt-4.1-nano por defecto, caché por repositorio y límite diario.</span>
        </article>
        <article>
          <strong>Sin login</strong>
          <span>Control inicial por IP. Suficiente para validar sin montar un castillo.</span>
        </article>
        <article>
          <strong>No lee código</strong>
          <span>Solo descarga el README público. Nada de dramas con repos privados.</span>
        </article>
      </section>

      {loading ? (
        <section className="loadingPanel" aria-live="polite">
          <div className="spinner" />
          <div>
            <p className="eyebrow">Juicio en curso</p>
            <h2>Jottarina está leyendo el README…</h2>
            <p>No cierres la página. Está separando documentación real de humo con purpurina.</p>
          </div>
        </section>
      ) : null}

      {result ? (
        <section className="results">
          <div className="resultHeader">
            <div>
              <p className="eyebrow">Resultado del juicio</p>
              <h2>{result.repo?.fullName || 'Repositorio analizado'}</h2>
              <p>{result.analysis?.verdict}</p>
            </div>
            <ScoreBadge score={result.analysis?.score} />
          </div>

          <div className="jottarinaLine">
            <Image
              src="/jottarina-coach.png"
              width={120}
              height={120}
              alt="Avatar de Jottarina"
            />
            <div>
              <p className="eyebrow">Jottarina dice</p>
              <strong>{result.analysis?.personalityLine || 'Vamos a poner orden, criatura.'}</strong>
            </div>
          </div>

          <div className="resultGrid">
            <SectionCard title="El roast" eyebrow="Lo que duele, pero arregla">
              <p>{result.analysis?.roast}</p>
            </SectionCard>

            <SectionCard title="Lo salvable" eyebrow="No todo está perdido">
              <p>{result.analysis?.salvable}</p>
            </SectionCard>

            <SectionCard title="Red flags" eyebrow="Señales de que el README necesita adulto responsable">
              <ul className="dangerList">
                {(result.analysis?.redFlags || []).map((item, index) => (
                  <li key={`${item}-${index}`}>{item}</li>
                ))}
              </ul>
            </SectionCard>

            <SectionCard title="Acciones prioritarias" eyebrow="Para arreglarlo sin terapia grupal">
              <ol className="actionList">
                {(result.analysis?.actionItems || []).map((item, index) => (
                  <li key={`${item}-${index}`}>{item}</li>
                ))}
              </ol>
            </SectionCard>

            <SectionCard title="Estructura recomendada" eyebrow="README que explica y convierte" wide>
              <ul className="structureList">
                {(result.analysis?.improvedStructure || []).map((item, index) => (
                  <li key={`${item}-${index}`}>{item}</li>
                ))}
              </ul>
            </SectionCard>

            <SectionCard title="Primer bloque sugerido" eyebrow="Empieza por aquí, genio" wide>
              <p>{result.analysis?.rewriteStarter}</p>
            </SectionCard>
          </div>

          {result.analysis?.finalPunchline ? (
            <blockquote className="punchline">“{result.analysis.finalPunchline}”</blockquote>
          ) : null}

          <div className="metaBox">
            <span>README: {result.repo?.readmePath || 'README detectado'}</span>
            <span>Analizados: {result.repo?.charactersAnalyzed?.toLocaleString('es-ES')} caracteres</span>
            {result.repo?.wasTrimmed ? <span>README recortado por coste</span> : null}
            {result.cached ? <span>Resultado desde caché</span> : <span>Resultado nuevo</span>}
            {typeof remaining === 'number' ? <span>Te quedan hoy: {remaining}</span> : null}
          </div>

          <button className="copyButton" type="button" onClick={copyMarkdown}>
            {copied ? 'Copiado. Milagro productivo.' : 'Copiar informe en Markdown'}
          </button>
        </section>
      ) : null}

      <footer className="footer">
        <p>Versión MVP para Vercel Hobby: sin login, rate limit inicial, README público, coste controlado y personalidad Jottarina. Terminado gana a perfecto, criatura.</p>
      </footer>
    </main>
  );
}
