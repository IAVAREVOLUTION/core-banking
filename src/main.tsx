
  // Debe ir primero: envuelve fetch antes de que se cree el cliente de Supabase.
  import "./app/lib/guardaAcciones";
  import "./app/lib/cacheLecturas";
  import { createRoot } from "react-dom/client";
  import App from "./app/App.tsx";
  import "./styles/index.css";

  createRoot(document.getElementById("root")!).render(<App />);
  