function App() {
  return (
    <div className="min-h-screen bg-[#0B1020] text-[#F5F1E8]">
      <aside className="fixed left-0 top-0 h-full w-64 border-r border-[#C8A96A]/20 bg-[#080D1A] p-6">
        <h1 className="font-serif text-3xl tracking-wide text-[#C8A96A]">
          Conviction
        </h1>
        <p className="mt-2 text-sm text-[#A7A08F]">
          Investment Intelligence
        </p>

        <nav className="mt-10 space-y-4 text-sm">
          <a className="block text-[#F5F1E8]" href="#">Dashboard</a>
          <a className="block text-[#A7A08F]" href="#">Portfolio</a>
          <a className="block text-[#A7A08F]" href="#">Transactions</a>
          <a className="block text-[#A7A08F]" href="#">Research</a>
          <a className="block text-[#A7A08F]" href="#">Settings</a>
        </nav>
      </aside>

      <main className="ml-64 p-10">
        <div className="mb-10">
          <p className="text-sm uppercase tracking-[0.3em] text-[#C8A96A]">
            Portfolio Dashboard
          </p>
          <h2 className="mt-3 font-serif text-5xl">
            Long-Term Compounders
          </h2>
          <p className="mt-3 text-[#A7A08F]">
            A refined view of capital, conviction, and performance.
          </p>
        </div>

        <section className="grid grid-cols-4 gap-6">
          <div className="rounded-2xl border border-[#C8A96A]/20 bg-[#11182A] p-6">
            <p className="text-sm text-[#A7A08F]">Portfolio Value</p>
            <h3 className="mt-3 text-3xl font-semibold">$5,805</h3>
          </div>

          <div className="rounded-2xl border border-[#C8A96A]/20 bg-[#11182A] p-6">
            <p className="text-sm text-[#A7A08F]">Unrealized Gain</p>
            <h3 className="mt-3 text-3xl font-semibold">$0</h3>
          </div>

          <div className="rounded-2xl border border-[#C8A96A]/20 bg-[#11182A] p-6">
            <p className="text-sm text-[#A7A08F]">Top Holding</p>
            <h3 className="mt-3 text-3xl font-semibold">AAPL</h3>
          </div>

          <div className="rounded-2xl border border-[#C8A96A]/20 bg-[#11182A] p-6">
            <p className="text-sm text-[#A7A08F]">Health Score</p>
            <h3 className="mt-3 text-3xl font-semibold">WEAK</h3>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;