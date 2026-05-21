import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./components/Home";
import Dashboard from "./components/Dashboard";
import Survey from "./components/Survey";
import Builder from "./components/Builder";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/builder" element={<Builder />} />
        <Route path="/builder/:id" element={<Builder />} />
        <Route path="/dashboard/:id" element={<Dashboard />} />
        <Route path="/q/:id" element={<Survey />} />
      </Routes>
    </BrowserRouter>
  );
}
