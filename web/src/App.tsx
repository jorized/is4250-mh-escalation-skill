import { useState } from "react";
import { Chat } from "./components/Chat";
import { Gate, type Credentials } from "./components/Gate";

export default function App() {
  const [creds, setCreds] = useState<Credentials | null>(null);
  return creds ? <Chat creds={creds} onSignOut={() => setCreds(null)} /> : <Gate onReady={setCreds} />;
}
