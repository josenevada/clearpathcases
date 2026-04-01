import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { supabase } from "./integrations/supabase/client";

// Ensure storage bucket exists
supabase.storage.getBucket('case-documents').then(({ error }) => {
  if (error?.message?.includes('not found')) {
    supabase.storage.createBucket('case-documents', { public: false });
  }
});

createRoot(document.getElementById("root")!).render(<App />);
