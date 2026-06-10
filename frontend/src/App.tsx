import { HashRouter, Routes, Route } from "react-router-dom";
import Sidebar    from "./components/Sidebar";
import Dashboard  from "./pages/Dashboard";
import Holdings   from "./pages/Holdings";
import Research   from "./pages/Research";
import Tax        from "./pages/Tax";
import Import        from "./pages/Import";
import Benchmarking from "./pages/Benchmarking";

import { C }      from "./theme";

export default function App() {
  return (
    <HashRouter>
      <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: C.font }}>
        <Sidebar />
        <main style={{ marginLeft: "240px", padding: "48px", minHeight: "100vh", boxSizing: "border-box" }}>
          <Routes>
            <Route path="/"          element={<Dashboard />} />
            <Route path="/holdings"  element={<Holdings />}  />
            <Route path="/research"  element={<Research />}  />
            <Route path="/tax"       element={<Tax />}       />
            <Route path="/import"         element={<Import />}        />
            <Route path="/benchmarking"   element={<Benchmarking />}  />

          </Routes>
        </main>
      </div>
    </HashRouter>
  );
}
