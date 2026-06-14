'use client';

export default function HomePage() {
  async function test() {
    const r = await fetch('/api/roast');
    console.log(await r.text());
  }
  return <button onClick={test}>La Rostizadora Digital</button>;
}
