import { motion } from "motion/react";
import { Upload, Image as ImageIcon, Sparkles, Layout, User, History, LogOut, ChevronRight, CheckCircle2, Loader2, Wand2, Home } from "lucide-react";
import { useState, useRef, useEffect, ChangeEvent } from "react";
import { analyzeRoom, redesignRoom, RoomAnalysis } from "./services/geminiService";

declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

// --- Types ---
interface Project {
  id: string;
  original_image: string;
  redesigned_image: string;
  style: string;
  room_type: string;
  analysis: string;
  created_at: string;
}

interface UserData {
  id: string;
  email: string;
  name: string;
  credits: number;
}

const STYLES = [
  { id: "modern", name: "Modern", description: "Clean lines, neutral palette", icon: "🏙️" },
  { id: "minimalist", name: "Minimalist", description: "Less is more, functional", icon: "⚪" },
  { id: "scandinavian", name: "Scandinavian", description: "Light, airy, wood textures", icon: "🌲" },
  { id: "industrial", name: "Industrial", description: "Raw materials, exposed brick", icon: "🏭" },
  { id: "luxury", name: "Luxury", description: "Opulent, rich textures, gold", icon: "💎" },
  { id: "bohemian", name: "Bohemian", description: "Eclectic, colorful, natural", icon: "🌿" },
  { id: "japandi", name: "Japandi", description: "Japanese zen meets Scandi", icon: "🎋" },
];

export default function App() {
  const [user, setUser] = useState<UserData | null>(null);
  const [view, setView] = useState<"landing" | "design" | "dashboard">("landing");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [hasApiKey, setHasApiKey] = useState(true);

  // Design State
  const [image, setImage] = useState<string | null>(null);
  const [selectedStyle, setSelectedStyle] = useState(STYLES[0].id);
  const [analysis, setAnalysis] = useState<RoomAnalysis | null>(null);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchUser();
    checkApiKey();
  }, []);

  const checkApiKey = async () => {
    if (window.aistudio) {
      const selected = await window.aistudio.hasSelectedApiKey();
      setHasApiKey(selected);
    }
  };

  const handleSelectKey = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      setHasApiKey(true);
    }
  };

  const fetchUser = async () => {
    try {
      const res = await fetch("/api/user");
      if (res.ok) {
        const data = await res.json();
        setUser(data);
        fetchProjects();
      }
    } catch (e) {
      console.error("Failed to fetch user", e);
    }
  };

  const fetchProjects = async () => {
    try {
      const res = await fetch("/api/projects");
      if (res.ok) {
        const data = await res.json();
        setProjects(data);
      }
    } catch (e) {
      console.error("Failed to fetch projects", e);
    }
  };

  const handleLogin = async () => {
    // Mock login for demo
    const mockUser = {
      id: "user_" + Math.random().toString(36).substr(2, 9),
      email: "demo@example.com",
      name: "Demo User"
    };

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(mockUser)
    });

    if (res.ok) {
      const data = await res.json();
      setUser(data);
      setView("design");
    }
  };

  const handleImageUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
        setAnalysis(null);
        setResultImage(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleStartRedesign = async () => {
    if (!image || !user) return;

    // Check if key is needed
    if (!hasApiKey) {
      await handleSelectKey();
      // Proceed immediately after triggering selection as per guidelines
    }

    if (user.credits <= 0) {
      alert("No credits left!");
      return;
    }

    setLoading(true);
    try {
      setStatus("Analyzing room structure...");
      const roomAnalysis = await analyzeRoom(image, selectedStyle);
      setAnalysis(roomAnalysis);

      setStatus("Generating redesigned concept...");
      const redesigned = await redesignRoom(image, selectedStyle, roomAnalysis);
      setResultImage(redesigned);

      setStatus("Saving project...");
      await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: "proj_" + Date.now(),
          original_image: image,
          redesigned_image: redesigned,
          style: selectedStyle,
          room_type: roomAnalysis.roomType,
          analysis: JSON.stringify(roomAnalysis)
        })
      });

      await fetchUser();
      await fetchProjects();
    } catch (e: any) {
      console.error(e);
      const errorMessage = e.message || "";
      const isPermissionError = errorMessage.includes("403") ||
        errorMessage.includes("permission") ||
        errorMessage.includes("PERMISSION_DENIED");

      if (errorMessage.includes("room") || errorMessage.includes("interior")) {
        // Invalid image error - show friendly message
        alert("Invalid Image\n\n" + errorMessage + "\n\nPlease upload a photo of a room (bedroom, living room, kitchen, etc.)");
      } else if (isPermissionError) {
        setHasApiKey(false);
        alert("Permission Denied (403). This usually means:\n1. The Gemini API is not enabled for your project.\n2. You are using a free-tier project with a model that requires billing.\n3. Your API key is invalid.\n\nPlease ensure billing is enabled for project 'gen-lang-client-0347378735' or select a different key.");
        await handleSelectKey();
      } else if (errorMessage.includes("Requested entity was not found") || errorMessage.includes("API_KEY_INVALID")) {
        setHasApiKey(false);
        alert("API Key issue. Please select a valid API key.");
        await handleSelectKey();
      } else {
        alert("Something went wrong: " + errorMessage);
      }
    } finally {
      setLoading(false);
      setStatus("");
    }
  };

  if (!user && view === "landing") {
    return (
      <div className="min-h-screen flex flex-col">
        {/* Navigation */}
        <nav className="p-6 flex justify-between items-center max-w-7xl mx-auto w-full">
          <div className="flex items-center gap-2">
            <a href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-cyan-500 rounded-xl flex items-center justify-center text-white">
                <Sparkles size={20} />
              </div>
              <span className="font-serif text-2xl font-bold tracking-tight text-white">GruhaBuddy</span>
            </a>
          </div>
          <button
            onClick={handleLogin}
            className="px-6 py-2.5 bg-gradient-to-r from-emerald-400 to-cyan-500 text-black rounded-full font-medium hover:opacity-90 transition-opacity"
          >
            Get Started
          </button>
        </nav>

        {/* Hero */}
        <main className="flex-1 flex flex-col items-center justify-center px-6 text-center max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-6xl md:text-8xl font-serif font-bold leading-tight mb-6 text-white">
              Reimagine Your <span className="italic text-emerald-400 underline decoration-emerald-400/30 underline-offset-8">Living Space</span>
            </h1>
            <p className="text-xl text-gray-300 mb-10 max-w-2xl mx-auto leading-relaxed">
              Upload a photo of any room and let our advanced AI transform it into a professional interior design concept in seconds.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={handleLogin}
                className="px-8 py-4 bg-gradient-to-r from-emerald-400 to-cyan-500 text-black rounded-2xl font-semibold text-lg hover:scale-105 transition-transform neo-shadow flex items-center gap-2"
              >
                Start Designing Free <ChevronRight size={20} />
              </button>
              <button className="px-8 py-4 bg-white/10 border border-white/20 text-white rounded-2xl font-semibold text-lg hover:bg-white/20 transition-colors backdrop-blur-sm">
                View Gallery
              </button>
            </div>
          </motion.div>

          {/* Preview Grid */}
          <div className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-4 w-full">
            {[1, 2, 3, 4].map((i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 + i * 0.1 }}
                className="aspect-[3/4] rounded-3xl overflow-hidden bg-white/10 relative group"
              >
                <img
                  src={`https://picsum.photos/seed/interior${i}/600/800`}
                  alt="Interior"
                  className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
                  <span className="text-white text-sm font-medium">Modern Scandinavian</span>
                </div>
              </motion.div>
            ))}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-20 md:w-64 border-r border-white/10 bg-black/30 backdrop-blur-md flex flex-col">
        <div className="p-6 flex items-center gap-3">
          <a href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-cyan-500 rounded-xl flex items-center justify-center text-white shrink-0">
              <Sparkles size={20} />
            </div>
            <span className="font-serif text-xl font-bold hidden md:block text-white">GruhaBuddy</span>
          </a>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-2">
          <a
            href="/"
            className="w-full flex items-center gap-3 p-3 rounded-xl transition-colors text-gray-300 hover:bg-white/10"
          >
            <Home size={20} />
            <span className="font-medium hidden md:block">Home</span>
          </a>
          <button
            onClick={() => setView("design")}
            className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors ${view === "design" ? "bg-gradient-to-r from-emerald-400 to-cyan-500 text-black" : "text-gray-300 hover:bg-white/10"}`}
          >
            <Wand2 size={20} />
            <span className="font-medium hidden md:block">New Design</span>
          </button>
          <button
            onClick={() => setView("dashboard")}
            className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors ${view === "dashboard" ? "bg-gradient-to-r from-emerald-400 to-cyan-500 text-black" : "text-gray-300 hover:bg-white/10"}`}
          >
            <History size={20} />
            <span className="font-medium hidden md:block">My Projects</span>
          </button>
        </nav>

        <div className="p-4 border-t border-white/10">
          <div className="bg-white/5 rounded-2xl p-4 hidden md:block mb-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Credits</span>
              <span className="text-emerald-400 font-bold">{user?.credits}</span>
            </div>
            <div className="w-full bg-white/20 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-gradient-to-r from-emerald-400 to-cyan-500 h-full transition-all duration-500"
                style={{ width: `${(user?.credits || 0) * 20}%` }}
              />
            </div>
          </div>
          <button className="w-full flex items-center gap-3 p-3 text-gray-400 hover:bg-red-500/20 hover:text-red-400 rounded-xl transition-colors">
            <LogOut size={20} />
            <span className="font-medium hidden md:block">Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-6 md:p-10">
        {view === "design" ? (
          <div className="max-w-6xl mx-auto">
            <header className="mb-10">
              <h2 className="text-4xl font-serif font-bold mb-2 text-white">Create New Concept</h2>
              <p className="text-gray-400">Upload a room photo and select your preferred style.</p>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
              {/* Left: Upload & Style */}
              <div className="lg:col-span-1 space-y-8">
                <section>
                  <h3 className="text-sm font-bold text-emerald-400 uppercase tracking-widest mb-4">1. Upload Room</h3>
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className={`aspect-video rounded-3xl border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center p-6 text-center ${image ? "border-emerald-400 bg-black/30" : "border-white/20 hover:border-emerald-400/50 bg-white/5"}`}
                  >
                    {image ? (
                      <img src={image} alt="Upload" className="w-full h-full object-cover rounded-2xl" />
                    ) : (
                      <>
                        <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center mb-4 backdrop-blur-sm">
                          <Upload className="text-emerald-400" />
                        </div>
                        <p className="text-white font-medium">Click to upload photo</p>
                        <p className="text-gray-400 text-sm mt-1">JPG, PNG up to 10MB</p>
                      </>
                    )}
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleImageUpload}
                      className="hidden"
                      accept="image/*"
                    />
                  </div>
                </section>

                <section>
                  <h3 className="text-sm font-bold text-emerald-400 uppercase tracking-widest mb-4">2. Choose Style</h3>
                  <div className="grid grid-cols-1 gap-3">
                    {STYLES.map((style) => (
                      <button
                        key={style.id}
                        onClick={() => setSelectedStyle(style.id)}
                        className={`flex items-center gap-4 p-4 rounded-2xl border transition-all text-left ${selectedStyle === style.id ? "border-emerald-400 bg-emerald-400/10 ring-2 ring-emerald-400/20" : "border-white/10 bg-white/5 hover:bg-white/10"}`}
                      >
                        <span className="text-2xl">{style.icon}</span>
                        <div>
                          <p className="font-bold text-white">{style.name}</p>
                          <p className="text-xs text-gray-400">{style.description}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </section>

                <button
                  disabled={!image || loading}
                  onClick={handleStartRedesign}
                  className="w-full py-5 bg-gradient-to-r from-emerald-400 to-cyan-500 text-black rounded-2xl font-bold text-lg hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                >
                  {loading ? (
                    <>
                      <Loader2 className="animate-spin" />
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={20} />
                      <span>Generate Design</span>
                    </>
                  )}
                </button>
              </div>

              {/* Right: Results */}
              <div className="lg:col-span-2">
                <div className="bg-black/30 backdrop-blur-md rounded-[40px] border border-white/10 p-8 min-h-[600px] flex flex-col">
                  {!loading && !resultImage && (
                    <div className="flex-1 flex flex-col items-center justify-center text-center text-gray-500">
                      <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6">
                        <ImageIcon size={40} className="text-gray-500" />
                      </div>
                      <h3 className="text-2xl font-serif font-medium text-gray-400">Your redesign will appear here</h3>
                      <p className="max-w-xs mt-2 text-gray-500">Upload a photo and click generate to see the magic happen.</p>
                    </div>
                  )}

                  {loading && (
                    <div className="flex-1 flex flex-col items-center justify-center text-center">
                      <div className="relative w-32 h-32 mb-10">
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                          className="absolute inset-0 border-4 border-white/10 border-t-emerald-400 rounded-full"
                        />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Sparkles className="text-emerald-400 animate-pulse" size={40} />
                        </div>
                      </div>
                      <h3 className="text-2xl font-serif font-bold text-white mb-2">{status}</h3>
                      <p className="text-gray-400">Our AI is reimagining your space. This usually takes 15-30 seconds.</p>
                    </div>
                  )}

                  {resultImage && !loading && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex-1 flex flex-col"
                    >
                      <div className="flex justify-between items-center mb-6">
                        <h3 className="text-2xl font-serif font-bold text-white">Redesign Result</h3>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              if (resultImage) {
                                const link = document.createElement('a');
                                link.href = resultImage;
                                link.download = `redesign-${selectedStyle}-${Date.now()}.jpg`;
                                link.target = '_blank';
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                              }
                            }}
                            className="px-4 py-2 bg-white/10 text-white rounded-xl font-medium hover:bg-white/20 transition-colors"
                          >
                            Download
                          </button>
                          <button
                            onClick={async () => {
                              if (navigator.share && resultImage) {
                                try {
                                  await navigator.share({
                                    title: 'My Room Redesign',
                                    text: `Check out my ${selectedStyle} room redesign!`,
                                    url: resultImage
                                  });
                                } catch (e) {
                                  // User cancelled or share failed
                                  navigator.clipboard.writeText(resultImage);
                                  alert('Link copied to clipboard!');
                                }
                              } else if (resultImage) {
                                navigator.clipboard.writeText(resultImage);
                                alert('Link copied to clipboard!');
                              }
                            }}
                            className="px-4 py-2 bg-gradient-to-r from-emerald-400 to-cyan-500 text-black rounded-xl font-medium hover:opacity-90 transition-opacity"
                          >
                            Share
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                        <div className="space-y-2">
                          <p className="text-xs font-bold text-emerald-400 uppercase tracking-widest">Before</p>
                          <div className="aspect-video rounded-3xl overflow-hidden border border-white/10">
                            <img src={image!} alt="Before" className="w-full h-full object-cover" />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <p className="text-xs font-bold text-emerald-400 uppercase tracking-widest">After</p>
                          <div className="aspect-video rounded-3xl overflow-hidden border-4 border-emerald-400 shadow-2xl">
                            <img src={resultImage} alt="After" className="w-full h-full object-cover" />
                          </div>
                        </div>
                      </div>

                      {analysis && (
                        <div className="bg-white/5 backdrop-blur-sm rounded-3xl p-6 border border-white/10">
                          <div className="flex items-center gap-2 mb-4">
                            <CheckCircle2 className="text-emerald-400" size={20} />
                            <h4 className="font-bold text-white">AI Analysis & Concepts</h4>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                              <p className="text-xs font-bold text-gray-400 uppercase mb-2">Room Type</p>
                              <p className="text-white font-medium capitalize">{analysis.roomType}</p>
                              <p className="text-xs font-bold text-gray-400 uppercase mt-4 mb-2">Lighting</p>
                              <p className="text-white font-medium">{analysis.lighting}</p>
                            </div>
                            <div>
                              <p className="text-xs font-bold text-gray-400 uppercase mb-2">Key Improvements</p>
                              <ul className="space-y-1">
                                {analysis.potentialImprovements.map((imp, i) => (
                                  <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full mt-1.5 shrink-0" />
                                    {imp}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="max-w-6xl mx-auto">
            <header className="mb-10 flex justify-between items-end">
              <div>
                <h2 className="text-4xl font-serif font-bold mb-2 text-white">My Projects</h2>
                <p className="text-gray-400">Your history of AI-transformed spaces.</p>
              </div>
              <button
                onClick={() => setView("design")}
                className="px-6 py-3 bg-gradient-to-r from-emerald-400 to-cyan-500 text-black rounded-2xl font-bold flex items-center gap-2 hover:scale-105 transition-transform"
              >
                <Wand2 size={18} /> New Design
              </button>
            </header>

            {projects.length === 0 ? (
              <div className="bg-black/30 backdrop-blur-md rounded-[40px] border border-white/10 p-20 text-center">
                <div className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-6">
                  <History size={40} className="text-gray-500" />
                </div>
                <h3 className="text-2xl font-serif font-medium text-gray-400">No projects yet</h3>
                <p className="mt-2 text-gray-400">Start your first redesign to see it here.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {projects.map((project) => (
                  <motion.div
                    key={project.id}
                    layoutId={project.id}
                    className="bg-black/30 backdrop-blur-md rounded-[32px] overflow-hidden border border-white/10 group hover:border-emerald-400/30 transition-all duration-500"
                  >
                    <div className="aspect-[4/3] relative overflow-hidden">
                      <img
                        src={project.redesigned_image}
                        alt="Redesign"
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                      />
                      <div className="absolute top-4 left-4">
                        <span className="px-3 py-1 bg-black/70 backdrop-blur-sm rounded-full text-[10px] font-bold uppercase tracking-widest text-emerald-400">
                          {project.style}
                        </span>
                      </div>
                    </div>
                    <div className="p-6">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h4 className="font-bold text-white capitalize">{project.room_type} Redesign</h4>
                          <p className="text-xs text-gray-400">{new Date(project.created_at).toLocaleDateString()}</p>
                        </div>
                        <button className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-gray-400 hover:bg-emerald-400 hover:text-black transition-colors">
                          <ChevronRight size={16} />
                        </button>
                      </div>
                      <div className="flex gap-2">
                        <div className="w-12 h-12 rounded-lg overflow-hidden border border-white/10 opacity-50">
                          <img src={project.original_image} alt="Original" className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1 bg-white/5 rounded-lg p-2 flex items-center">
                          <div className="w-full bg-white/20 h-1 rounded-full overflow-hidden">
                            <div className="bg-emerald-400 h-full w-full" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
