import React, { useState, useEffect, useRef, FormEvent } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ShoppingCart, MapPin, Star, Zap, ChevronRight, Package, X, Menu, LogIn, Search, User as UserIcon, Save, CheckCircle2, AlertCircle, Truck, Clock, ShieldCheck, Ticket, ExternalLink, Navigation, Send, MessageSquare, Bird, Flame, Car, Bike, DollarSign, BarChart3, List, Check, Camera, Image as ImageIcon, Heart, Gift, Sparkles, Wand2, Cloud, Target } from 'lucide-react';
import { auth, db } from './lib/firebase';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, onSnapshot, collection, query, orderBy, addDoc, serverTimestamp, where, arrayUnion } from 'firebase/firestore';
import { generateAIOverview, startAIChat } from './services/geminiService';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for Leaflet marker icons
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// --- Types ---
interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  role: string;
  address?: string;
  createdAt: string;
}

interface Rating {
  userId: string;
  userName: string;
  score: number;
  comment: string;
  createdAt: string;
}

interface MenuItem {
  id: string;
  name: string;
  price: number;
  description: string;
  image: string;
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

interface CartItem extends MenuItem {
  quantity: number;
  merchantId: string;
}

const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

const calculateDeliveryFee = (distance: number) => {
  const baseRate = 2.99;
  const perKmRate = 0.50;
  return Math.round((baseRate + (distance * perKmRate)) * 100) / 100;
};

interface Merchant {
  id: string;
  name: string;
  category: string;
  rating: number;
  deliveryTime: string;
  image: string;
  description: string;
  ratings?: Rating[];
  menu?: MenuItem[];
  coords?: { lat: number; lng: number };
}

interface Order {
  id: string;
  status: 'pending' | 'confirmed' | 'preparing' | 'out-for-delivery' | 'delivered' | 'cancelled';
  merchantId: string;
  customerId: string;
  driverId?: string;
  total: number;
  currentLocation?: { lat: number; lng: number };
  items: any[];
}

interface ChatMessage {
  id?: string;
  senderId: string;
  senderName: string;
  text: string;
  createdAt: any;
}

const RatingStars = ({ rating, size = 16 }: { rating: number; size?: number }) => {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star 
          key={s} 
          size={size} 
          className={s <= Math.round(rating) ? "text-emerald-500 fill-current" : "text-gray-200 fill-current"} 
        />
      ))}
    </div>
  );
};

const MerchantCard: React.FC<{ merchant: Merchant; idx: number }> = ({ merchant, idx }) => {
  const distance = merchant.coords ? getDistance(44.0521, -123.0868, merchant.coords.lat, merchant.coords.lng).toFixed(1) : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.1 }}
      className="group bg-white rounded-3xl overflow-hidden border border-gray-100 hover:border-emerald-100 hover:shadow-2xl hover:shadow-emerald-100 hover:-translate-y-1 transition-all cursor-pointer"
    >
      <Link to={`/merchant/${merchant.id}`} className="block">
        <div className="relative aspect-[4/3] overflow-hidden">
          <img 
            src={merchant.image} 
            alt={merchant.name} 
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          />
          <div className="absolute top-3 right-3 px-2 py-1 bg-white/90 backdrop-blur rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm">
            <Star size={12} className="text-emerald-500 fill-current" />
            <span>{merchant.rating ? merchant.rating.toFixed(1) : 'New'}</span>
          </div>
          <div className="absolute bottom-3 left-3 px-2 py-1 bg-gray-900/80 backdrop-blur rounded-lg text-[10px] text-white font-bold tracking-wider uppercase">
            {merchant.deliveryTime}
          </div>
        </div>
        <div className="p-5">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-bold text-gray-900 group-hover:text-emerald-600 transition-colors uppercase tracking-tight">{merchant.name}</h3>
          </div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-gray-500">{merchant.category} {distance ? `• ${distance} km` : ''}</p>
            {merchant.ratings && merchant.ratings.length > 0 && (
              <span className="text-[10px] text-gray-400 font-medium">({merchant.ratings.length} reviews)</span>
            )}
          </div>
          <div className="w-full py-2 bg-gray-50 group-hover:bg-emerald-500 group-hover:text-white text-gray-600 text-xs font-bold rounded-xl flex items-center justify-center gap-1 transition-all">
            View Menu
          </div>
        </div>
      </Link>
    </motion.div>
  );
};

const Logo = () => (
  <div className="w-12 h-12 bg-gray-950 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 shadow-xl overflow-hidden relative">
    <div className="absolute inset-0">
      <img 
        src="https://images.unsplash.com/photo-1557683316-973673baf926?auto=format&fit=crop&q=80&w=100" 
        alt="Logo Glow" 
        className="w-full h-full object-cover opacity-60"
        referrerPolicy="no-referrer"
      />
    </div>
    <div className="relative flex items-center justify-center">
      {/* majestic phoenix wings representation */}
      <motion.div
        animate={{ 
          scale: [1, 1.1, 1],
          rotate: [0, 5, 0, -5, 0]
        }}
        transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
        className="absolute"
      >
        <Bird className="text-emerald-400 opacity-40 blur-[1px]" size={36} />
      </motion.div>
      <Bird className="text-emerald-500 relative z-10" size={28} />
      <motion.div
        animate={{ 
          opacity: [0.3, 0.6, 0.3],
          scale: [0.8, 1, 0.8],
          y: [0, -4, 0]
        }}
        transition={{ repeat: Infinity, duration: 1.5 }}
        className="absolute -top-1"
      >
        <Flame className="text-emerald-400" size={24} />
      </motion.div>
      {/* Crown/Tiers for majesty */}
      <div className="absolute -top-2 w-1 h-1 bg-emerald-300 rounded-full shadow-[0_0_8px_rgba(52,211,153,0.8)]"></div>
    </div>
  </div>
);

// Types for the new interactivity system
interface Activity {
  id: string;
  user: string;
  action: string;
  time: string;
  type: 'vote' | 'order' | 'moment' | 'nomination';
}

const PhoenixAI = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: 'user' | 'model', text: string }[]>([
    { role: 'model', text: 'Hi! I am the Phoenix AI. How can I help you with neighborhood logistics or community events today?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setIsLoading(true);

    try {
      const history = messages.map(m => ({
        role: m.role,
        parts: [{ text: m.text }]
      }));
      
      const chat = startAIChat(history);
      if (!chat) throw new Error("Chat service unavailable");

      const result = await chat.sendMessage(userMessage);
      const responseText = await result.response.text();
      setMessages(prev => [...prev, { role: 'model', text: responseText }]);
    } catch (error) {
      console.error("AI Chat Error:", error);
      setMessages(prev => [...prev, { role: 'model', text: "I'm sorry, I'm having trouble connecting right now. Please try again later." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="fixed bottom-8 right-8 z-50">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsOpen(!isOpen)}
          className="w-16 h-16 bg-emerald-600 text-white rounded-full flex items-center justify-center shadow-2xl shadow-emerald-200 relative overflow-hidden group"
        >
          <div className="absolute inset-0 bg-gradient-to-tr from-emerald-700 to-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity"></div>
          {isOpen ? <X size={28} className="relative z-10" /> : <Sparkles size={28} className="relative z-10" />}
        </motion.button>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-28 right-8 z-50 w-96 max-w-[calc(100vw-4rem)] bg-white/90 backdrop-blur-2xl rounded-[40px] shadow-2xl border border-white/50 flex flex-col overflow-hidden h-[600px] max-h-[calc(100vh-12rem)]"
          >
            <div className="p-6 bg-emerald-600 text-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md">
                  <Wand2 size={20} />
                </div>
                <div>
                  <h3 className="font-bold">Phoenix Assistant</h3>
                  <p className="text-[10px] text-emerald-100 uppercase tracking-widest font-bold">Always Online</p>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] p-4 rounded-2xl text-sm ${
                    m.role === 'user' 
                      ? 'bg-emerald-600 text-white rounded-tr-none' 
                      : 'bg-emerald-50 text-emerald-900 rounded-tl-none'
                  }`}>
                    {m.text}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-emerald-50 p-4 rounded-2xl rounded-tl-none flex gap-1">
                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce"></span>
                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce delay-75"></span>
                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce delay-150"></span>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <form onSubmit={handleSend} className="p-6 bg-white border-t border-gray-50 flex gap-2">
              <input 
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask anything..."
                className="flex-1 bg-gray-50 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
              />
              <button 
                type="submit"
                disabled={isLoading || !input.trim()}
                className="w-10 h-10 bg-gray-900 text-white rounded-xl flex items-center justify-center hover:bg-black transition-colors disabled:opacity-50"
              >
                <Send size={18} />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

const PhoenixPulse = ({ user }: { user: any }) => {
  const [points, setPoints] = useState(1240);
  const [isGifting, setIsGifting] = useState(false);
  const [activities, setActivities] = useState<Activity[]>([
    { id: '1', user: 'Sarah J.', action: 'endorsed a makeover', time: '2m ago', type: 'vote' },
    { id: '2', user: 'Mike R.', action: 'shared a moment', time: '5m ago', type: 'moment' },
    { id: '3', user: 'Delivery #42', action: 'heading to West Eugene', time: '8m ago', type: 'order' },
  ]);

  useEffect(() => {
    const interval = setInterval(() => {
      setPoints(prev => prev + 1);
    }, 10000); // Earn 1 point every 10 seconds of dwell time
    return () => clearInterval(interval);
  }, []);

  const handleGift = (amount: number) => {
    if (points >= amount) {
      setPoints(prev => prev - amount);
      setIsGifting(false);
      const newActivity: Activity = {
        id: Math.random().toString(),
        user: 'You',
        action: `gifted ${amount} XP to Sarah J.`,
        time: 'Just now',
        type: 'vote'
      };
      setActivities([newActivity, ...activities.slice(0, 2)]);
    }
  };

  return (
    <>
      <div className="fixed bottom-8 left-8 z-50 hidden lg:block">
        <motion.div 
          initial={{ x: -100, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          className="bg-white/80 backdrop-blur-2xl rounded-[32px] p-6 shadow-2xl border border-white/50 w-80"
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-emerald-200">
                <Zap size={20} className="fill-current" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Your Pulse</p>
                <p className="text-xl font-black text-gray-900">{points.toLocaleString()} <span className="text-xs font-bold text-emerald-500">XP</span></p>
              </div>
            </div>
            <div className="px-3 py-1 bg-emerald-50 rounded-full text-[10px] font-bold text-emerald-600 border border-emerald-100">
              RANK: LOCAL ELITE
            </div>
          </div>

          <div className="space-y-4">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 pb-2">Live Neighborhood Activity</p>
            {activities.map((activity, idx) => (
              <motion.div 
                key={activity.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="flex items-center gap-3 group cursor-pointer"
              >
                <div className={`w-2 h-2 rounded-full ${
                  activity.type === 'vote' ? 'bg-orange-500' :
                  activity.type === 'order' ? 'bg-emerald-500' : 'bg-blue-500'
                } animate-pulse`} />
                <div className="flex-1">
                  <p className="text-xs font-bold text-gray-800">
                    {activity.user} <span className="font-medium text-gray-500">{activity.action}</span>
                  </p>
                </div>
                <span className="text-[10px] font-medium text-gray-400 uppercase">{activity.time}</span>
              </motion.div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3 mt-6">
            <Link to="/community#rewards-section" className="py-3 bg-gray-900 text-white rounded-2xl text-[10px] font-bold hover:bg-gray-800 hover:scale-[1.05] transition-all shadow-xl active:scale-95 text-center flex items-center justify-center">
              Redeem
            </Link>
            <button 
              onClick={() => setIsGifting(true)}
              className="py-3 bg-emerald-500 text-white rounded-2xl text-[10px] font-bold hover:bg-emerald-400 hover:scale-[1.05] transition-all shadow-xl active:scale-95 flex items-center justify-center"
            >
              Give Points
            </button>
          </div>
        </motion.div>
      </div>

      <AnimatePresence>
        {isGifting && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-[40px] p-10 max-w-md w-full shadow-2xl text-center"
            >
              <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto mb-6">
                <Gift size={40} />
              </div>
              <h3 className="text-3xl font-bold mb-4">Gift Your XP</h3>
              <p className="text-gray-500 mb-8">Share your community activity points with a neighbor to help them unlock rewards faster.</p>
              
              <div className="space-y-4 mb-8">
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
                  <div className="flex items-center gap-3">
                    <img src="https://artifact.m68.us/api/v1/artifacts/42337775-69f8-41df-a55d-ea48a4da4599" className="w-10 h-10 rounded-full border border-gray-200" referrerPolicy="no-referrer" />
                    <p className="font-bold">Sarah J.</p>
                  </div>
                  <button 
                    onClick={() => handleGift(100)}
                    className="px-4 py-2 bg-emerald-500 text-white text-xs font-bold rounded-xl hover:bg-emerald-600 transition-colors"
                  >
                    Send 100 XP
                  </button>
                </div>
              </div>

              <button 
                onClick={() => setIsGifting(false)}
                className="text-sm font-bold text-gray-400 hover:text-gray-600 transition-colors"
              >
                Maybe later
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

const Navbar = ({ user, profile, cart, toggleCart }: { user: any; profile: UserProfile | null; cart: CartItem[]; toggleCart: () => void }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const cartCount = cart.reduce((acc, item) => acc + item.quantity, 0);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  const handleLogout = () => signOut(auth);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-gray-950/80 backdrop-blur-2xl border-b border-white/5 h-24">
      <div className="max-w-7xl mx-auto h-full px-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-4 group">
          <Logo />
          <div>
            <h1 className="text-xl font-black text-white tracking-tighter leading-none italic uppercase">PHOENIX</h1>
            <p className="text-[10px] font-bold text-emerald-400 tracking-[0.3em] uppercase">Logistics Core</p>
          </div>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden lg:flex items-center gap-12 text-[11px] font-black uppercase tracking-[0.2em] text-gray-400">
          <Link to="/merchants" className="hover:text-emerald-400 transition-colors">Retail Network</Link>
          <button className="hover:text-emerald-400 transition-colors">Fleet Status</button>
          <button className="hover:text-emerald-400 transition-colors flex items-center gap-2">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div>
            Hub Status
          </button>
        </div>

        <div className="flex items-center gap-6">
          <div className="hidden md:flex items-center gap-2 text-gray-400 hover:text-emerald-500 cursor-pointer transition-all hover:scale-105 text-[11px] font-black uppercase tracking-widest bg-white/5 px-4 py-2 rounded-xl border border-white/5">
            <MapPin size={16} className="text-emerald-500" />
            <span>Eugene, OR</span>
          </div>

          {user ? (
            <div className="flex items-center gap-4 bg-white/5 p-1.5 pr-5 rounded-2xl border border-white/10 group hover:border-emerald-500/30 transition-all">
              <div className="w-11 h-11 rounded-xl overflow-hidden shadow-lg border border-white/10">
                <img src={user.photoURL} alt="" className="w-full h-full object-cover" />
              </div>
              <div className="hidden sm:block">
                <p className="text-[10px] font-black text-white uppercase tracking-[0.15em] leading-none">{user.displayName?.split(' ')[0]}</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
                  <p className="text-[10px] font-bold text-emerald-400">Hub Ready</p>
                </div>
              </div>
              <button 
                onClick={handleLogout}
                className="ml-2 p-2 text-gray-500 hover:text-red-500 transition-colors"
                title="Disconnect"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <button 
              onClick={handleLogin}
              className="px-6 py-3 bg-white text-gray-950 rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-emerald-400 hover:text-white transition-all active:scale-95 shadow-xl shadow-white/5"
            >
              Initialize Node
            </button>
          )}
          <button onClick={toggleCart} className="w-13 h-13 bg-gray-900 border border-white/5 text-white rounded-2xl flex items-center justify-center relative hover:bg-black transition-all group active:scale-95">
            <ShoppingCart size={22} className="group-hover:scale-110 transition-transform" />
            {cartCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-6 h-6 bg-emerald-500 text-[11px] font-black rounded-full flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.5)] border-2 border-gray-950">
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </nav>
  );
};

const Profile = ({ user }: { user: any }) => {
  const [profileData, setProfileData] = useState<UserProfile | null>(null);
  const [address, setAddress] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (user) {
      const fetchProfile = async () => {
        try {
          const docRef = doc(db, 'users', user.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data() as UserProfile;
            setProfileData(data);
            setAddress(data.address || '');
          }
        } catch (err) {
          console.error("Error fetching profile:", err);
        }
      };
      fetchProfile();
    }
  }, [user]);

  const handleUpdateAddress = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    // Validation
    if (address.trim().length < 10) {
      setErrorMsg("Please enter a more detailed delivery address (min 10 chars).");
      setSaveStatus('error');
      return;
    }

    setIsSaving(true);
    setSaveStatus('idle');
    setErrorMsg('');

    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        address: address.trim(),
        updatedAt: new Date().toISOString()
      });
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (err) {
      console.error("Error updating address:", err);
      setErrorMsg("Failed to save address. Please try again.");
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  };

  if (!user) {
    return (
      <div className="pt-32 px-4 text-center min-h-[60vh] flex flex-col items-center justify-center">
        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
          <UserIcon className="text-gray-300" size={32} />
        </div>
        <h2 className="text-2xl font-bold mb-2">Sign in to see your profile</h2>
        <p className="text-gray-500 mb-8">You need to be logged in to manage your delivery addresses.</p>
        <button 
          onClick={() => signInWithPopup(auth, new GoogleAuthProvider())}
          className="px-8 py-3 bg-gray-900 text-white rounded-xl font-bold"
        >
          Sign In
        </button>
      </div>
    );
  }

  return (
    <div className="pt-24 pb-12 px-4 max-w-4xl mx-auto min-h-screen">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-[40px] border border-gray-100 shadow-2xl shadow-gray-100 overflow-hidden"
      >
        {/* Profile Header */}
        <div className="bg-gradient-to-r from-emerald-500 to-teal-500 p-8 lg:p-12 text-white">
          <div className="flex flex-col md:flex-row items-center gap-8">
            <div className="relative">
              <img 
                src={user.photoURL || ''} 
                alt={user.displayName || 'User'} 
                className="w-24 h-24 lg:w-32 lg:h-32 rounded-3xl border-4 border-white/20 shadow-xl"
              />
              <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-white rounded-2xl flex items-center justify-center text-emerald-600 shadow-lg">
                <Star size={20} className="fill-current" />
              </div>
            </div>
            <div className="text-center md:text-left">
              <h1 className="text-3xl lg:text-4xl font-bold mb-2">{user.displayName}</h1>
              <p className="text-emerald-100 mb-4">{user.email}</p>
              <div className="flex flex-wrap justify-center md:justify-start gap-4">
                <span className="px-4 py-1.5 bg-white/20 backdrop-blur rounded-full text-xs font-bold tracking-wider uppercase">
                  {profileData?.role || 'Customer'}
                </span>
                {profileData?.role === 'driver' && (
                  <Link 
                    to="/driver/dashboard"
                    className="px-4 py-1.5 bg-emerald-400 text-emerald-900 rounded-full text-xs font-bold tracking-wider uppercase flex items-center gap-1 hover:bg-emerald-300 transition-colors"
                  >
                    <BarChart3 size={12} />
                    Go to Dashboard
                  </Link>
                )}
                <span className="px-4 py-1.5 bg-white/20 backdrop-blur rounded-full text-xs font-bold tracking-wider uppercase flex items-center gap-1">
                  <Package size={12} />
                  12 Orders
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Profile Settings */}
        <div className="p-8 lg:p-12 grid grid-cols-1 md:grid-cols-3 gap-12">
          <div className="md:col-span-1">
            <h3 className="text-lg font-bold mb-4">Delivery Settings</h3>
            <p className="text-sm text-gray-500 leading-relaxed">
              Managing your address helps us provide more accurate delivery times and local restaurant recommendations.
            </p>
          </div>
          
          <div className="md:col-span-2">
            <form onSubmit={handleUpdateAddress} className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wider">
                  Delivery Address
                </label>
                <div className="relative">
                  <MapPin className={`absolute left-4 top-4 ${saveStatus === 'error' ? 'text-red-500' : 'text-gray-400'}`} size={20} />
                  <textarea 
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="E.g. 123 Pine St, Apt 4B, Eugene, OR 97401"
                    rows={3}
                    className={`w-full pl-12 pr-6 py-4 bg-gray-50 border-2 rounded-2xl outline-none transition-all resize-none text-gray-900 ${
                      saveStatus === 'error' ? 'border-red-100 focus:border-red-500' : 'border-transparent focus:border-emerald-500 focus:bg-white'
                    }`}
                  />
                </div>
                {saveStatus === 'error' && (
                  <p className="mt-2 text-xs font-bold text-red-500 flex items-center gap-1 animate-shake">
                    <AlertCircle size={14} />
                    {errorMsg}
                  </p>
                )}
                {saveStatus === 'success' && (
                  <p className="mt-2 text-xs font-bold text-green-600 flex items-center gap-1">
                    <CheckCircle2 size={14} />
                    Address updated successfully!
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between pt-4">
                <p className="text-xs text-gray-400 max-w-[240px]">
                  * This address will be stored securely and only used for your deliveries.
                </p>
                <button 
                  type="submit"
                  disabled={isSaving || address === profileData?.address}
                  className={`flex items-center gap-2 px-8 py-3.5 rounded-2xl font-bold transition-all active:scale-95 shadow-lg hover:scale-105 ${
                    isSaving || address === profileData?.address
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed shadow-none'
                      : 'bg-emerald-500 text-white hover:bg-emerald-400 shadow-emerald-100'
                  }`}
                >
                  {isSaving ? (
                    <motion.div 
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    >
                      <Zap size={18} />
                    </motion.div>
                  ) : (
                    <Save size={18} />
                  )}
                  {isSaving ? 'Saving...' : 'Save Address'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

const DriverRegistrationForm = ({ user, onCancel }: { user: any; onCancel: () => void }) => {
  const [formData, setFormData] = useState({
    fullName: user?.displayName || '',
    phoneNumber: '',
    isVeteran: false,
    vehicleType: 'car',
    vehicleDetails: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsSubmitting(true);
    try {
      await setDoc(doc(db, 'drivers', user.uid), {
        uid: user.uid,
        fullName: formData.fullName,
        phoneNumber: formData.phoneNumber,
        isVeteran: formData.isVeteran,
        vehicleType: formData.vehicleType,
        vehicleDetails: formData.vehicleDetails,
        status: 'pending',
        createdAt: new Date().toISOString()
      });
      setSubmitted(true);
    } catch (err) {
      console.error("Error submitting driver application:", err);
      alert("Failed to submit application. Please check your connection.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white p-12 rounded-[40px] text-center shadow-2xl border border-emerald-100"
      >
        <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 size={40} />
        </div>
        <h2 className="text-3xl font-bold mb-4">Application Received!</h2>
        <p className="text-gray-500 mb-8 leading-relaxed">
          Thank you for applying to Phoenix Express. Our team will review your details and get back to you within 48 hours. {formData.isVeteran && "We appreciate your service!"}
        </p>
        <button 
          onClick={onCancel}
          className="px-8 py-3 bg-gray-900 text-white rounded-2xl font-bold hover:bg-gray-800 transition-all"
        >
          Return to Hub
        </button>
      </motion.div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white p-8 lg:p-12 rounded-[40px] shadow-2xl border border-gray-100 max-w-2xl mx-auto"
    >
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-3xl font-bold">Driver Registration</h2>
        <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 p-2">
          <X size={24} />
        </button>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Full Name</label>
            <input 
              required
              type="text" 
              value={formData.fullName}
              onChange={(e) => setFormData({...formData, fullName: e.target.value})}
              className="w-full px-6 py-4 bg-gray-50 border-2 border-transparent focus:border-emerald-500 rounded-2xl outline-none transition-all"
              placeholder="Your legal name"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Phone Number</label>
            <input 
              required
              type="tel" 
              value={formData.phoneNumber}
              onChange={(e) => setFormData({...formData, phoneNumber: e.target.value})}
              className="w-full px-6 py-4 bg-gray-50 border-2 border-transparent focus:border-emerald-500 rounded-2xl outline-none transition-all"
              placeholder="541-XXX-XXXX"
            />
          </div>
        </div>

        <div className="p-6 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-center justify-between">
           <div>
              <p className="font-bold text-emerald-900">Are you a Veteran?</p>
              <p className="text-xs text-emerald-700">We prioritize veteran applications as part of our community mission.</p>
           </div>
           <button 
            type="button"
            onClick={() => setFormData({...formData, isVeteran: !formData.isVeteran})}
            className={`w-14 h-8 rounded-full relative transition-colors ${formData.isVeteran ? 'bg-emerald-600' : 'bg-gray-300'}`}
           >
              <motion.div 
                animate={{ x: formData.isVeteran ? 24 : 4 }}
                className="absolute top-1 w-6 h-6 bg-white rounded-full shadow-sm"
              />
           </button>
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Vehicle Type</label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { type: 'car', icon: <Car size={24} /> },
              { type: 'truck', icon: <Truck size={24} /> },
              { type: 'motorcycle', icon: <Zap size={24} /> },
              { type: 'bicycle', icon: <Bike size={24} /> }
            ].map(({ type, icon }) => {
              const isSelected = formData.vehicleType === type;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => setFormData({...formData, vehicleType: type})}
                  className={`relative py-4 px-2 rounded-2xl border-2 font-bold capitalize transition-all flex flex-col items-center gap-2 group overflow-hidden hover:scale-105 ${
                    isSelected 
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-600 shadow-md' 
                      : 'border-transparent bg-gray-50 hover:bg-gray-100 text-gray-500 hover:border-gray-200'
                  }`}
                >
                  <motion.div
                    animate={{ 
                      scale: isSelected ? 1.1 : 1,
                      y: isSelected ? -2 : 0
                    }}
                    className={`transition-colors ${isSelected ? 'text-emerald-600' : 'text-gray-400 group-hover:text-gray-600'}`}
                  >
                    {icon}
                  </motion.div>
                  <span className={`text-[10px] tracking-tight transition-colors ${isSelected ? 'text-emerald-700' : 'text-gray-500'}`}>
                    {type}
                  </span>
                  
                  {isSelected && (
                    <motion.div 
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute top-2 right-2 w-4 h-4 bg-emerald-600 text-white rounded-full flex items-center justify-center"
                    >
                      <Check size={10} strokeWidth={4} />
                    </motion.div>
                  )}
                  
                  <div className={`absolute bottom-0 left-0 h-1 bg-emerald-500 transition-all duration-300 ${isSelected ? 'w-full' : 'w-0'}`} />
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Vehicle Details</label>
          <textarea 
            required
            rows={3}
            value={formData.vehicleDetails}
            onChange={(e) => setFormData({...formData, vehicleDetails: e.target.value})}
            className="w-full px-6 py-4 bg-gray-50 border-2 border-transparent focus:border-emerald-500 rounded-2xl outline-none transition-all resize-none"
            placeholder="Year, Make, Model, and License Plate"
          />
        </div>

        <div className="pt-4">
          <button 
            type="submit"
            disabled={isSubmitting}
            className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold text-lg hover:bg-emerald-500 transition-all shadow-xl shadow-emerald-900/20 disabled:bg-gray-100 disabled:text-gray-400 disabled:shadow-none"
          >
            {isSubmitting ? "Processing Application..." : "Submit Application"}
          </button>
          <p className="text-[10px] text-gray-400 text-center mt-4 uppercase tracking-widest">
            By submitting, you agree to our driver terms and background check policy.
          </p>
        </div>
      </form>
    </motion.div>
  );
};

const DriverLanding = ({ user }: { user: any }) => {
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="pt-16">
      {/* Hero */}
      <section className={`bg-gray-900 text-white py-20 lg:py-32 overflow-hidden relative transition-all duration-700 ${showForm ? 'lg:py-16 blur-sm' : ''}`}>
        <div className="absolute top-0 right-0 w-1/3 h-full bg-emerald-600/10 skew-x-12 -mr-20"></div>
        <div className="max-w-7xl mx-auto px-4 relative z-10">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
            >
              <span className="inline-block px-4 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-full mb-6 tracking-widest uppercase">
                Be Your Own Boss
              </span>
              <h1 className="text-5xl lg:text-7xl font-bold mb-8 leading-[1.1]">
                Drive with <br /><span className="text-emerald-500">Phoenix Express</span>
              </h1>
              <p className="text-xl text-gray-400 mb-10 leading-relaxed max-w-lg">
                Deliver meals, essentials, and aggregate supplies. Earn top-tier competitive pay with flexible hours that fit your lifestyle.
              </p>
              <div className="flex gap-4">
                <button 
                  onClick={() => {
                    if (!user) {
                      signInWithPopup(auth, new GoogleAuthProvider());
                    } else {
                      setShowForm(true);
                    }
                  }}
                  className="px-10 py-4 bg-emerald-600 text-white rounded-2xl font-bold text-lg hover:bg-emerald-500 hover:scale-105 transition-all shadow-xl shadow-emerald-900/40"
                >
                  Register Now
                </button>
                <button className="px-10 py-4 bg-white/10 hover:bg-white/20 hover:scale-105 transition-all rounded-2xl font-bold text-lg backdrop-blur">
                  Learn More
                </button>
              </div>
            </motion.div>
            <div className="hidden lg:block relative">
              <div className="absolute inset-0 bg-gradient-to-tr from-emerald-600/30 to-transparent blur-3xl"></div>
              <img 
                src="https://images.unsplash.com/photo-1617347454431-f49d7ff5c3b1?auto=format&fit=crop&q=80&w=1200" 
                alt="Delivery Driver" 
                className="rounded-[40px] shadow-2xl relative z-10 border-4 border-white/5"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Registration Overlay */}
      <AnimatePresence>
        {showForm && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center px-4 py-8 overflow-y-auto bg-gray-900/80 backdrop-blur">
            <DriverRegistrationForm user={user} onCancel={() => setShowForm(false)} />
          </div>
        )}
      </AnimatePresence>

      {/* Benefits */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid lg:grid-cols-4 gap-8">
            <div className="lg:col-span-1">
              <h2 className="text-4xl font-bold mb-4 tracking-tight">Why drive for <br />Phoenix?</h2>
              <p className="text-gray-500 mb-8 leading-relaxed">More than just a gig. We build community logistics with a purpose.</p>
              <div className="bg-emerald-900 rounded-3xl p-6 text-white relative overflow-hidden">
                <div className="relative z-10">
                  <ShieldCheck className="text-emerald-400 mb-4" size={32} />
                  <h4 className="font-bold mb-2">Veterans First Initiative</h4>
                  <p className="text-xs text-emerald-100 opacity-80 leading-relaxed">
                    We offer priority onboarding and specialized support for veterans. Your service is honored here.
                  </p>
                </div>
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-400/10 rounded-full -mr-16 -mt-16"></div>
              </div>
            </div>
            
            <div className="lg:col-span-3 grid md:grid-cols-3 gap-8">
              {[
                { icon: <Clock className="text-emerald-600" />, title: "Flexible Schedule", desc: "Work when it suits you. Start and stop anytime you want." },
                { icon: <Zap className="text-emerald-600" />, title: "Earning Potential", desc: "Higher base pay per mile than any competitor in Eugene/Santa Clara." },
                { icon: <ShieldCheck className="text-emerald-600" />, title: "Full Support", desc: "24/7 dispatcher support and insurance for total transparency." }
              ].map((benefit, idx) => (
                <div key={idx} className="p-8 bg-gray-50 rounded-[32px] border border-gray-100 flex flex-col items-center text-center">
                  <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mb-6 shadow-sm border border-gray-100">
                    {benefit.icon}
                  </div>
                  <h3 className="text-xl font-bold mb-3">{benefit.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{benefit.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

const Chat = ({ orderId, user }: { orderId: string, user: any }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!orderId) return;

    const q = query(
      collection(db, 'chats', orderId, 'messages'),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ChatMessage[];
      setMessages(msgs);
    });

    return () => unsubscribe();
  }, [orderId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (e: FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user || isSending) return;

    setIsSending(true);
    try {
      await addDoc(collection(db, 'chats', orderId, 'messages'), {
        senderId: user.uid,
        senderName: user.displayName || 'User',
        text: newMessage.trim(),
        createdAt: serverTimestamp()
      });
      setNewMessage('');
    } catch (err) {
      console.error("Error sending message:", err);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-[32px] overflow-hidden border border-gray-100 shadow-xl min-h-[400px]">
      <div className="px-6 py-4 bg-gray-900 text-white flex items-center justify-between">
        <h3 className="font-bold flex items-center gap-2">
          <MessageSquare size={18} className="text-emerald-500" />
          Driver Chat
        </h3>
        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
      </div>

      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-6 space-y-4"
      >
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center opacity-40">
            <MessageSquare size={48} className="mb-2" />
            <p className="text-xs font-medium">No messages yet.<br />Start the conversation.</p>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <div 
              key={msg.id || idx} 
              className={`flex flex-col ${msg.senderId === user?.uid ? 'items-end' : 'items-start'}`}
            >
              <div 
                className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                  msg.senderId === user?.uid 
                    ? 'bg-emerald-600 text-white rounded-tr-none' 
                    : 'bg-gray-100 text-gray-800 rounded-tl-none'
                }`}
              >
                {msg.text}
              </div>
              <span className="text-[9px] font-bold text-gray-400 mt-1 uppercase tracking-tighter">
                {msg.senderName}
              </span>
            </div>
          ))
        )}
      </div>

      <form onSubmit={handleSend} className="p-4 border-t border-gray-100 flex gap-2">
        <input 
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type your message..."
          className="flex-1 px-4 py-2 bg-gray-50 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-200 transition-all"
        />
        <button 
          type="submit"
          disabled={!newMessage.trim() || isSending}
          className="w-10 h-10 bg-emerald-600 text-white rounded-xl flex items-center justify-center hover:bg-emerald-500 transition-colors disabled:opacity-50"
        >
          <Send size={18} />
        </button>
      </form>
    </div>
  );
};

// Custom Leaflet Icons
const merchantIcon = L.divIcon({
  html: `<div class="w-10 h-10 bg-emerald-600 rounded-full border-4 border-white shadow-lg flex items-center justify-center text-white">
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>
  </div>`,
  className: '',
  iconSize: [40, 40],
  iconAnchor: [20, 20],
});

const customerIcon = L.divIcon({
  html: `<div class="w-10 h-10 bg-gray-900 rounded-full border-4 border-white shadow-lg flex items-center justify-center text-white">
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
  </div>`,
  className: '',
  iconSize: [40, 40],
  iconAnchor: [20, 20],
});

const driverIcon = L.divIcon({
  html: `<div class="w-12 h-12 bg-white rounded-2xl border-4 border-emerald-500 shadow-xl flex items-center justify-center text-emerald-600">
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-2.18-2.725A1 1 0 0 0 18 9.5H15"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg>
  </div>`,
  className: '',
  iconSize: [48, 48],
  iconAnchor: [24, 24],
});

// Recenter helper component
const RecenterMap = ({ lat, lng }: { lat: number; lng: number }) => {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], map.getZoom());
  }, [lat, lng, map]);
  return null;
};

const DriverRating = ({ driverId, orderId, onComplete }: { driverId: string; orderId: string; onComplete: () => void }) => {
  const [score, setScore] = useState(5);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const ratingPath = `users/${driverId}/driver_ratings`;
      await addDoc(collection(db, ratingPath), {
        score,
        comment,
        orderId,
        customerId: auth.currentUser?.uid,
        customerName: auth.currentUser?.displayName || 'Anonymous Fan',
        createdAt: serverTimestamp()
      });
      onComplete();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `users/${driverId}/driver_ratings`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-gray-900/60 backdrop-blur-3xl p-10 rounded-[56px] border border-white/5 shadow-2xl space-y-8">
      <div className="text-center">
        <p className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.3em] mb-4">Verification Successful</p>
        <h3 className="text-3xl font-black text-white italic uppercase tracking-tighter leading-none mb-2">RATE YOUR OPERATOR</h3>
        <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">Efficiency & Protocol Feedback</p>
      </div>

      <div className="flex justify-center gap-3">
        {[1, 2, 3, 4, 5].map((s) => (
          <button
            key={s}
            onClick={() => setScore(s)}
            className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${
              score >= s ? 'bg-emerald-500 text-gray-950 shadow-[0_0_20px_rgba(16,185,129,0.4)]' : 'bg-white/5 text-gray-500 border border-white/5'
            }`}
          >
            <Star size={24} fill={score >= s ? 'currentColor' : 'none'} />
          </button>
        ))}
      </div>

      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="ADD OPTIONAL PROTOCOL NOTES..."
        className="w-full bg-white/5 border border-white/5 rounded-3xl p-6 text-white text-xs font-bold uppercase tracking-widest placeholder:text-gray-700 focus:outline-none focus:border-emerald-500/50 min-h-[120px] transition-all"
      />

      <button
        onClick={handleSubmit}
        disabled={isSubmitting}
        className="w-full h-18 bg-white text-gray-950 rounded-[32px] font-black text-[11px] uppercase tracking-[0.2em] hover:bg-emerald-400 hover:text-white transition-all shadow-2xl disabled:opacity-50"
      >
        {isSubmitting ? 'TRANSMITTING...' : 'SUBMIT FEEDBACK'}
      </button>
    </div>
  );
};

const OrderTracking = ({ user }: { user: any }) => {
  const { id } = useParams();
  const [order, setOrder] = useState<Order | null>(null);
  const [eta, setEta] = useState(12);
  const [hasRated, setHasRated] = useState(false);

  useEffect(() => {
    if (!id || id === 'ORD-8822') {
      // Simulate real-time tracking for demo/mock
      const initialPos = { lat: 44.0521, lng: -123.0868 };
      setOrder({
        id: id || 'ORD-8822',
        status: 'preparing',
        merchantId: '1',
        customerId: 'current-user',
        total: 42.50,
        currentLocation: initialPos,
        items: [{ name: 'Urban Greens Bundle', price: 42.50 }]
      });

      const interval = setInterval(() => {
        setOrder(prev => {
          if (!prev) return null;
          const newLat = prev.currentLocation!.lat + 0.0001;
          const newLng = prev.currentLocation!.lng + 0.00015;
          setEta(e => Math.max(0, e - (Math.random() > 0.8 ? 1 : 0)));
          let newStatus = prev.status;
          if (eta === 0) newStatus = 'delivered';
          else if (eta < 5) newStatus = 'out-for-delivery';
          
          return {
            ...prev,
            currentLocation: { lat: newLat, lng: newLng },
            status: newStatus,
            driverId: prev.driverId || 'ALEX-PHX-922'
          };
        });
      }, 3000);

      return () => clearInterval(interval);
    }

    const unsub = onSnapshot(doc(db, 'orders', id), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as Order;
        setOrder({ ...data, id: snap.id });
        if (data.currentLocation) {
          // Mocking ETA reduction if data doesn't have it
          setEta(prev => Math.max(1, prev - 1));
        }
      }
    });

    return () => unsub();
  }, [id, eta]);

  if (!order) return null;

  return (
    <div className="pt-24 pb-12 px-4 max-w-7xl mx-auto min-h-screen bg-gray-950">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-12 gap-6 pb-8 border-b border-white/5">
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
            <p className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.3em]">Live Matrix Stream</p>
          </div>
          <h1 className="text-5xl lg:text-7xl font-black tracking-tighter text-white italic uppercase leading-none">TRACKING.</h1>
          <p className="text-gray-500 font-bold mt-2 uppercase tracking-widest text-[10px]">Signal Hash: <span className="text-emerald-500">{order.id}</span></p>
        </div>
        <div className="bg-white/5 backdrop-blur-3xl px-10 py-6 rounded-[48px] border border-white/10 flex items-center gap-10 shadow-2xl">
          <div className="text-right">
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-2">Tactical ETA</p>
            <div className="text-4xl font-black text-white italic tracking-tighter flex items-center gap-3">
              <Clock size={28} className="text-emerald-500" /> {eta} MINS
            </div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-12">
        <div className="lg:col-span-2 space-y-8">
          {/* Real Leaflet Map - Obsidian Edition */}
          <div className="relative h-[650px] bg-gray-900 rounded-[64px] overflow-hidden border border-white/10 shadow-2xl group">
            <MapContainer center={[44.0521, -123.0868]} zoom={15} scrollWheelZoom={false} className="h-full w-full grayscale opacity-80 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-700">
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              />
              {order.currentLocation && (
                <>
                  <Marker position={[44.0521, -123.0868]} icon={merchantIcon}>
                    <Popup>
                      <div className="font-black italic uppercase tracking-tight">Pickup Node</div>
                    </Popup>
                  </Marker>
                  <Marker position={[44.0621, -123.0968]} icon={customerIcon}>
                    <Popup>
                      <div className="font-black italic uppercase tracking-tight">Drop Point</div>
                    </Popup>
                  </Marker>
                  <Marker position={[order.currentLocation.lat, order.currentLocation.lng]} icon={driverIcon}>
                    <Popup>
                      <div className="font-black italic uppercase tracking-tight">Phoenix Asset</div>
                    </Popup>
                  </Marker>
                  <RecenterMap lat={order.currentLocation.lat} lng={order.currentLocation.lng} />
                </>
              )}
            </MapContainer>

            {/* Tactical HUD Overlay Elements */}
            <div className="absolute top-8 left-8 z-[1000] space-y-3">
              <div className="bg-gray-950/80 backdrop-blur-3xl px-4 py-2 rounded-xl border border-white/10 flex items-center gap-3">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                <p className="text-[9px] font-black text-white uppercase tracking-widest">Link Active</p>
              </div>
              <div className="bg-gray-950/80 backdrop-blur-3xl px-4 py-2 rounded-xl border border-white/10">
                <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1">Coordinates</p>
                <p className="text-[10px] font-mono text-emerald-400">
                  {order.currentLocation?.lat.toFixed(4)}, {order.currentLocation?.lng.toFixed(4)}
                </p>
              </div>
            </div>

            {/* Floating Driver Info - Command Card */}
            <div className="absolute bottom-8 left-8 right-8 z-[1000] bg-gray-950/80 backdrop-blur-3xl p-8 rounded-[48px] flex items-center gap-6 shadow-2xl border border-white/10 group/card transition-all hover:bg-gray-900/90 hover:border-emerald-500/30">
              <div className="w-18 h-18 bg-emerald-500/20 rounded-3xl flex items-center justify-center text-emerald-400 shadow-xl border border-emerald-500/30 group-hover/card:scale-110 transition-transform">
                <Truck size={36} />
              </div>
              <div>
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em] mb-2">Fleet Operator</p>
                <p className="font-black text-2xl text-white italic tracking-tighter uppercase">Alex R. <span className="text-gray-500 font-bold text-sm ml-4 not-italic tracking-normal">TOYOTA RAV4 • PHX-922</span></p>
              </div>
              <div className="ml-auto flex gap-4">
                <button className="w-16 h-16 bg-white/5 text-emerald-400 rounded-3xl flex items-center justify-center hover:bg-emerald-500 hover:text-white transition-all shadow-xl active:scale-95 border border-white/5">
                  <Navigation size={24} />
                </button>
                <button className="px-10 py-5 bg-white text-gray-950 rounded-3xl font-black text-[11px] uppercase tracking-widest hover:bg-emerald-400 hover:text-white transition-all active:scale-95 shadow-2xl">
                  SIGNAL
                </button>
              </div>
            </div>
          </div>

          {/* Tactical Progress Steps */}
          <div className="bg-white/5 backdrop-blur-3xl p-12 rounded-[64px] border border-white/5 shadow-2xl">
            <div className="grid sm:grid-cols-4 gap-8">
              {[
                { label: 'Signal Locked', icon: <Zap size={18} />, done: true },
                { label: 'Cargo Secured', icon: <Package size={18} />, done: order.status !== 'pending' },
                { label: 'In Transit', icon: <Navigation size={18} />, done: order.status === 'out-for-delivery' },
                { label: 'Destination', icon: <CheckCircle2 size={18} />, done: order.status === 'delivered' }
              ].map((step, idx) => (
                <div key={idx} className="flex flex-col items-center text-center group/step">
                  <div className={`w-16 h-16 rounded-[24px] flex items-center justify-center mb-4 transition-all duration-500 shadow-2xl border ${step.done ? 'bg-emerald-500 text-gray-950 border-emerald-400 scale-110' : 'bg-gray-900 text-gray-600 border-white/5'}`}>
                    {step.icon}
                  </div>
                  <p className={`text-[10px] font-black uppercase tracking-[0.15em] ${step.done ? 'text-white' : 'text-gray-600'}`}>{step.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-1 space-y-12">
          {order.status === 'delivered' && !hasRated && (
             <DriverRating 
               driverId={order.driverId || 'ALEX-PHX-922'} 
               orderId={order.id} 
               onComplete={() => setHasRated(true)} 
             />
          )}
          <Chat orderId={order.id} user={user} />
          
          <div className="bg-gray-900/40 backdrop-blur-3xl p-10 rounded-[56px] border border-white/5 flex flex-col shadow-2xl">
            <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter mb-8 leading-none">MANIFEST</h3>
            <div className="space-y-6 mb-10">
               <div className="bg-white/5 p-8 rounded-[32px] border border-white/5">
                  <p className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.3em] mb-4">TARGET NODE</p>
                  <p className="text-lg font-black italic text-white tracking-tight leading-relaxed uppercase">123 Pine St, Apt 4B<br />Eugene, OR 97401</p>
               </div>
               <div className="bg-white/5 p-8 rounded-[32px] border border-white/10">
                  <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em] mb-4">CARGO DATA</p>
                  <p className="text-sm font-black text-white uppercase italic tracking-widest">Urban Greens Bundle <span className="text-emerald-500 ml-2">x1</span></p>
               </div>
            </div>
            <div className="mt-auto pt-10 border-t border-white/5">
               <p className="text-xs text-gray-500 font-medium mb-8 leading-relaxed italic uppercase tracking-wider">Phoenix Response Teams active in your sector.</p>
               <button className="w-full h-18 bg-emerald-500/10 text-emerald-400 rounded-[32px] font-black text-[12px] uppercase tracking-[0.3em] hover:bg-emerald-500 hover:text-white transition-all shadow-2xl active:scale-95 border border-emerald-500/20">
                 Request Intel
               </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const DriverTrackingButton = ({ orderId }: { orderId: string }) => {
  const [isTracking, setIsTracking] = useState(false);
  const watchId = useRef<number | null>(null);

  const toggleTracking = () => {
    if (isTracking) {
      if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
      setIsTracking(false);
    } else {
      if (!navigator.geolocation) {
        alert("Geolocation is not supported by your browser");
        return;
      }
      setIsTracking(true);
      watchId.current = navigator.geolocation.watchPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          try {
            await updateDoc(doc(db, 'orders', orderId), {
              currentLocation: { lat: latitude, lng: longitude }
            });
          } catch (error) {
            console.error("Error updating location:", error);
          }
        },
        (error) => console.error(error),
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    }
  };

  useEffect(() => {
    return () => {
      if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    };
  }, []);

  return (
    <button 
      onClick={toggleTracking}
      className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center gap-2 border ${
        isTracking 
          ? 'bg-red-500/10 text-red-500 border-red-500/30' 
          : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30 hover:bg-emerald-500 hover:text-white'
      }`}
    >
      <div className={`w-2 h-2 rounded-full ${isTracking ? 'bg-red-500 animate-ping' : 'bg-emerald-500'}`}></div>
      {isTracking ? 'Transmitting Signal' : 'Broadcast Location'}
    </button>
  );
};

const useDriverRatings = (driverId: string) => {
  const [ratings, setRatings] = useState<any[]>([]);
  useEffect(() => {
    if (!driverId) return;
    const q = query(
      collection(db, `users/${driverId}/driver_ratings`),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(q, (snap) => {
      setRatings(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${driverId}/driver_ratings`);
    });
    return () => unsub();
  }, [driverId]);
  return ratings;
};

const DriverDashboard = ({ user }: { user: any }) => {
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [completedOrders, setCompletedOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDriver, setIsDriver] = useState(false);
  const [earningsRange, setEarningsRange] = useState<'daily' | 'weekly' | 'monthly'>('weekly');

  useEffect(() => {
    if (!user) return;

    const checkRole = async () => {
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists() && userSnap.data().role === 'driver') {
        setIsDriver(true);
      } else {
        setIsDriver(false);
      }
    };
    checkRole();
  }, [user]);

  useEffect(() => {
    if (!user || !isDriver) return;

    const qActive = query(
      collection(db, 'orders'),
      where('driverId', '==', user.uid),
      where('status', 'in', ['confirmed', 'preparing', 'out-for-delivery'])
    );

    const qCompleted = query(
      collection(db, 'orders'),
      where('driverId', '==', user.uid),
      where('status', '==', 'delivered')
    );

    const unsubActive = onSnapshot(qActive, (snap) => {
      setActiveOrders(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Order[]);
      setLoading(false);
    });

    const unsubCompleted = onSnapshot(qCompleted, (snap) => {
      setCompletedOrders(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Order[]);
    });

    return () => {
      unsubActive();
      unsubCompleted();
    };
  }, [user, isDriver]);

  const stats = React.useMemo(() => {
    const now = new Date();
    const threshold = new Date();
    
    if (earningsRange === 'daily') {
      threshold.setHours(0, 0, 0, 0);
    } else if (earningsRange === 'weekly') {
      threshold.setDate(now.getDate() - 7);
    } else if (earningsRange === 'monthly') {
      threshold.setMonth(now.getMonth() - 1);
    }

    const filtered = completedOrders.filter(order => {
      // @ts-ignore - assuming createdAt or deliveredAt exists in doc data
      const dateStr = order.deliveredAt || order.createdAt || new Date().toISOString();
      return new Date(dateStr) >= threshold;
    });

    const earnings = filtered.reduce((acc, order) => acc + (order.total * 0.15), 0);
    return { earnings, count: filtered.length };
  }, [completedOrders, earningsRange]);

  const ratings = useDriverRatings(user.uid);

  if (!user || (!loading && !isDriver)) {
    return (
      <div className="pt-32 px-4 text-center">
        <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
        <p className="text-gray-500">You must be a registered driver to view this dashboard.</p>
        <Link to="/" className="inline-block mt-8 px-8 py-3 bg-gray-900 text-white rounded-xl font-bold">Return Home</Link>
      </div>
    );
  }

  const totalEarnings = completedOrders.reduce((acc, order) => acc + (order.total * 0.15), 0); // 15% commission base example

  return (
    <div className="pt-24 pb-12 px-4 max-w-7xl mx-auto min-h-screen bg-gray-950">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-16 gap-6 pb-8 border-b border-white/5">
        <div>
          <div className="flex items-center gap-3 mb-4">
             <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
             <p className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.3em]">Fleet Status: Active</p>
          </div>
          <h1 className="text-5xl lg:text-7xl font-black tracking-tighter text-white italic uppercase leading-none">DRIVER CORE.</h1>
          <p className="text-gray-500 font-bold mt-2 uppercase tracking-widest text-[10px]">Session Operator: <span className="text-white">{user.displayName}</span></p>
        </div>
        <div className="flex flex-wrap gap-4">
           <div className="bg-white/5 backdrop-blur-3xl px-8 py-4 rounded-[32px] border border-white/10 shadow-2xl flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-500/20 text-emerald-400 rounded-2xl flex items-center justify-center border border-emerald-500/30">
                <DollarSign size={24} />
              </div>
              <div>
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest leading-none mb-1">Lifetime Yield</p>
                <p className="text-2xl font-black text-white italic tracking-tighter">${totalEarnings.toFixed(2)}</p>
              </div>
           </div>

           <div className="bg-white/5 p-1 rounded-2xl border border-white/5 flex backdrop-blur-md">
              {(['daily', 'weekly', 'monthly'] as const).map((range) => (
                <button
                  key={range}
                  onClick={() => setEarningsRange(range)}
                  className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                    earningsRange === range 
                      ? 'bg-white text-gray-950 shadow-xl scale-105' 
                      : 'text-gray-500 hover:text-white'
                  }`}
                >
                  {range}
                </button>
              ))}
           </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-12 mb-16">
        <div className="lg:col-span-1 space-y-8">
          <div className="bg-gray-900/40 backdrop-blur-3xl p-10 rounded-[56px] border border-white/5 shadow-2xl">
             <p className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.3em] mb-6 flex items-center gap-2">
               <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span> Range Performance
             </p>
             <div className="space-y-4">
                <p className="text-6xl font-black tracking-tighter text-white italic leading-none">${stats.earnings.toFixed(2)}</p>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-[0.2em]">{stats.count} Operations Verified</p>
             </div>
             <div className="mt-10 pt-10 border-t border-white/5">
                <div className="flex justify-between items-center mb-4">
                   <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Payout Sequence</p>
                   <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 text-[10px] font-black uppercase tracking-widest rounded-lg border border-emerald-500/20">Authorized</span>
                </div>
                <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden border border-white/5">
                   <div className="h-full bg-emerald-500 w-2/3 shadow-[0_0_15px_rgba(16,185,129,0.5)]"></div>
                </div>
             </div>
          </div>

          <div className="bg-gray-900/40 backdrop-blur-3xl p-10 rounded-[56px] border border-white/5 shadow-2xl">
             <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em] mb-8">Network Status</p>
             <div className="space-y-10">
                <div className="flex justify-between items-end border-b border-white/5 pb-8">
                   <div>
                      <p className="text-gray-600 text-[10px] font-black uppercase tracking-widest mb-2">Total Node Drops</p>
                      <p className="text-4xl font-black text-white italic tracking-tighter">{completedOrders.length}</p>
                   </div>
                   <div className="text-right">
                      <p className="text-emerald-400 text-sm font-black">+12.4%</p>
                      <p className="text-[9px] text-gray-600 uppercase font-black tracking-widest">Efficiency</p>
                   </div>
                </div>

                <div className="pt-8 border-t border-white/5">
                   <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-6">Recent Operator Feedback</p>
                   <div className="space-y-6">
                      {ratings.length === 0 ? (
                        <p className="text-xs text-gray-700 font-bold uppercase tracking-widest italic">No Intel Recorded</p>
                      ) : (
                        ratings.slice(0, 3).map(rating => (
                          <div key={rating.id} className="bg-white/5 p-5 rounded-2xl border border-white/5">
                             <div className="flex items-center justify-between mb-3">
                                <div className="flex gap-1">
                                   {[1,2,3,4,5].map(s => (
                                     <Star key={s} size={10} className={s <= rating.score ? 'text-emerald-500 fill-emerald-500' : 'text-gray-700'} />
                                   ))}
                                </div>
                                <span className="text-[8px] font-black text-gray-600 uppercase tracking-widest">{new Date(rating.createdAt?.seconds * 1000).toLocaleDateString()}</span>
                             </div>
                             <p className="text-[10px] text-gray-400 font-medium italic line-clamp-2">"{rating.comment || 'No specific notes recorded.'}"</p>
                          </div>
                        ))
                      )}
                   </div>
                </div>

                <div>
                   <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-6">Recent Signal History</p>
                   <div className="space-y-6">
                      {completedOrders.slice(0, 3).map(order => (
                        <div key={order.id} className="flex items-center gap-4 group/item">
                           <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-gray-600 border border-white/5 group-hover/item:border-emerald-500/30 transition-all">
                              <CheckCircle2 size={18} />
                           </div>
                           <div className="flex-1">
                              <p className="text-[11px] font-black text-white uppercase tracking-wider">#{order.id}</p>
                              <p className="text-[9px] text-gray-600 uppercase font-bold tracking-widest">Verified Completion</p>
                           </div>
                           <p className="text-sm font-black text-emerald-400 italic font-mono">+${(order.total * 0.15).toFixed(2)}</p>
                        </div>
                      ))}
                   </div>
                </div>
             </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-10">
           <div className="flex items-center justify-between mb-2">
              <h3 className="text-3xl font-black text-white italic uppercase tracking-tighter flex items-center gap-4">
                ACTIVE DEPLOYS <span className="w-10 h-10 bg-emerald-500 text-gray-950 text-sm italic font-black rounded-2xl flex items-center justify-center shadow-2xl">{activeOrders.length}</span>
              </h3>
              <button className="text-[10px] font-black text-gray-500 uppercase tracking-widest hover:text-emerald-400 transition-colors flex items-center gap-2">
                FULL ARCHIVE <ChevronRight size={14} />
              </button>
           </div>

           {activeOrders.length === 0 ? (
             <div className="bg-white/5 border border-dashed border-white/10 rounded-[64px] p-24 text-center backdrop-blur-sm">
                <div className="w-24 h-24 bg-gray-900 rounded-full flex items-center justify-center mx-auto mb-8 shadow-2xl border border-white/5">
                   <Truck className="text-gray-700" size={48} />
                </div>
                <h4 className="text-2xl font-black text-white italic uppercase tracking-tighter mb-4 leading-none">NO PAYLOADS ASSIGNED</h4>
                <p className="text-gray-500 text-sm font-bold uppercase tracking-widest max-w-xs mx-auto mb-10 leading-relaxed">System standby. Toggle regional beacon to initiate signal intercept.</p>
                <button className="px-12 py-5 bg-white text-gray-950 rounded-3xl font-black text-[11px] uppercase tracking-widest hover:bg-emerald-400 hover:text-white transition-all shadow-2xl active:scale-95">
                  INITIALIZE BEACON
                </button>
             </div>
           ) : (
             <div className="grid gap-8">
                {activeOrders.map(order => (
                  <motion.div 
                    layout
                    key={order.id}
                    className="bg-gray-900/60 backdrop-blur-3xl p-10 rounded-[56px] border border-white/5 shadow-2xl flex flex-col md:flex-row md:items-center gap-10 relative overflow-hidden group hover:border-emerald-500/20 transition-all duration-500"
                  >
                    <div className="absolute top-0 right-0 w-32 h-full bg-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <div className="relative z-10 flex-1">
                      <div className="flex items-center gap-4 mb-6">
                        <span className="px-4 py-1.5 bg-white text-gray-950 text-[10px] font-black uppercase tracking-[0.2em] rounded-xl">NODE #{order.id}</span>
                        <span className="px-4 py-1.5 bg-emerald-500/10 text-emerald-400 text-[10px] font-black uppercase tracking-[0.2em] rounded-xl border border-emerald-500/20">{order.status}</span>
                      </div>
                      <h4 className="text-4xl font-black text-white italic uppercase tracking-tighter mb-4 leading-none">REGIONAL PICKUP</h4>
                      <div className="flex items-center gap-6 text-gray-500 text-[10px] font-black uppercase tracking-widest">
                         <div className="flex items-center gap-2">
                            <MapPin size={16} className="text-emerald-500" />
                            <span>Santa Clara Hub</span>
                         </div>
                         <div className="flex items-center gap-2">
                            <Clock size={16} className="text-emerald-500" />
                            <span>12-15 MINS</span>
                         </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-4 mt-10">
                        <DriverTrackingButton orderId={order.id} />
                        <Link 
                          to={`/track/${order.id}`}
                          className="px-10 py-4 bg-gray-950 text-white rounded-[24px] font-black text-[10px] uppercase tracking-[0.2em] hover:bg-black transition-all flex items-center gap-3 border border-white/5"
                        >
                          HUD INTERFACE <Navigation size={14} />
                        </Link>
                      </div>
                    </div>
                    <div className="relative z-10">
                      <button className="w-16 h-16 bg-gray-950 border border-white/10 text-gray-600 rounded-[28px] flex items-center justify-center hover:bg-emerald-500 hover:text-white transition-all shadow-2xl group/msg">
                        <MessageSquare size={26} className="group-hover/msg:scale-110 transition-transform" />
                      </button>
                    </div>
                  </motion.div>
                ))}
             </div>
           )}
        </div>
      </div>
    </div>

  );
};

const AIOverview = ({ query, results }: { query: string; results: Merchant[] }) => {
  const [overview, setOverview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchOverview = async () => {
      if (!query.trim()) return;
      setIsLoading(true);
      const text = await generateAIOverview(`Provide an overview for search: "${query}". We found ${results.length} results.`);
      setOverview(text);
      setIsLoading(false);
    };
    fetchOverview();
  }, [query]);

  if (!overview && !isLoading) return null;

  return (
    <motion.div 
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      className="max-w-4xl mx-auto mb-16 overflow-hidden"
    >
      <div className="bg-gradient-to-br from-emerald-50 to-white rounded-[40px] p-8 border border-emerald-100 shadow-xl shadow-emerald-900/5 relative">
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <Sparkles size={120} className="text-emerald-600" />
        </div>
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-emerald-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-emerald-200">
              <Wand2 size={20} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">AI Overview</p>
              <h3 className="text-xl font-bold text-gray-900">Phoenix Logistics Insight</h3>
            </div>
          </div>
          
          {isLoading ? (
            <div className="space-y-3">
              <div className="h-4 bg-emerald-100/50 rounded-full w-full animate-pulse"></div>
              <div className="h-4 bg-emerald-100/50 rounded-full w-5/6 animate-pulse"></div>
              <div className="h-4 bg-emerald-100/50 rounded-full w-4/6 animate-pulse"></div>
            </div>
          ) : (
            <div className="text-gray-700 leading-relaxed prose prose-emerald max-w-none prose-sm">
              <p className="whitespace-pre-wrap">{overview}</p>
            </div>
          )}
          
          <div className="mt-6 pt-6 border-t border-emerald-100/50 flex items-center justify-between">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
              <Zap size={12} className="text-emerald-500 fill-current" /> Powered by Gemini
            </p>
            <div className="flex items-center gap-4">
              <button className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest hover:text-emerald-700 transition-colors">Feedback</button>
              <button className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest hover:text-emerald-700 transition-colors underline underline-offset-4">Learn More</button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

const SearchPage = () => {
  const [queryText, setQueryText] = useState('');
  const [lastSearch, setLastSearch] = useState('');
  const [results, setResults] = useState<Merchant[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [minRating, setMinRating] = useState<number>(0);
  const [maxDeliveryTime, setMaxDeliveryTime] = useState<number>(120);

  const categories = ['All', ...new Set(demoMerchants.map(m => m.category))];

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    performSearch();
  };

  const performSearch = (overrideQuery?: string) => {
    const activeQuery = overrideQuery !== undefined ? overrideQuery : queryText;
    setIsSearching(true);
    setLastSearch(activeQuery);
    
    setTimeout(() => {
      const filtered = demoMerchants.filter(merchant => {
        const matchesQuery = !activeQuery.trim() || 
          merchant.name.toLowerCase().includes(activeQuery.toLowerCase()) ||
          merchant.category.toLowerCase().includes(activeQuery.toLowerCase()) ||
          merchant.description.toLowerCase().includes(activeQuery.toLowerCase());
        
        const matchesCategory = selectedCategory === 'All' || merchant.category === selectedCategory;
        const matchesRating = (merchant.rating || 0) >= minRating;
        
        // Parse "15-20 min" to get 20
        const timeValue = parseInt(merchant.deliveryTime.split('-').pop() || '0');
        const matchesTime = timeValue <= maxDeliveryTime;

        return matchesQuery && matchesCategory && matchesRating && matchesTime;
      });
      setResults(filtered);
      setIsSearching(false);
    }, 600);
  };

  useEffect(() => {
    if (lastSearch || selectedCategory !== 'All' || minRating > 0 || maxDeliveryTime < 120) {
      performSearch();
    } else {
      setResults([]);
    }
  }, [selectedCategory, minRating, maxDeliveryTime]);

  return (
    <div className="pt-24 pb-12 px-4 max-w-7xl mx-auto min-h-screen">
      <div className="max-w-3xl mx-auto mb-16 text-center">
        <h1 className="text-4xl lg:text-5xl font-bold mb-6 tracking-tight">Marketplace Search</h1>
        <p className="text-gray-500 text-lg">Find the best local restaurants and specialized logistics services in Eugene.</p>
      </div>

      <form onSubmit={handleSearch} className="max-w-2xl mx-auto mb-8">
        <div className="relative group">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-emerald-500 transition-colors" size={24} />
          <input 
            type="text" 
            value={queryText}
            onChange={(e) => setQueryText(e.target.value)}
            placeholder="Search for 'sushi', 'logistics', 'heavy hauling'..." 
            className="w-full h-18 pl-18 pr-6 bg-white rounded-3xl text-lg text-gray-900 border-2 border-gray-100 focus:border-emerald-500 shadow-2xl shadow-emerald-900/5 outline-none transition-all"
          />
          <button type="submit" className="absolute right-3 top-2.5 bottom-2.5 px-8 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-500 transition-all shadow-lg active:scale-95">
            Search
          </button>
        </div>
      </form>

      <div className="max-w-4xl mx-auto mb-16 space-y-6">
        <div className="flex flex-wrap items-center gap-4 py-6 px-8 bg-white/50 backdrop-blur-md rounded-[32px] border border-gray-100 shadow-xl shadow-gray-200/20">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-1">Category Hub</label>
            <div className="flex flex-wrap gap-2">
              {categories.slice(0, 6).map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all border ${
                    selectedCategory === cat 
                      ? 'bg-emerald-500 text-white border-emerald-400 shadow-lg shadow-emerald-200' 
                      : 'bg-white text-gray-500 border-gray-100 hover:border-emerald-200 hover:bg-emerald-50'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="w-px h-12 bg-gray-100 hidden lg:block"></div>

          <div className="w-full sm:w-48">
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-1 flex items-center gap-2">
              Min Rating <Star size={10} className="text-amber-400 fill-amber-400" />
            </label>
            <select 
              value={minRating}
              onChange={(e) => setMinRating(Number(e.target.value))}
              className="w-full h-11 bg-white border border-gray-100 rounded-xl px-4 text-xs font-bold text-gray-700 focus:outline-none focus:border-emerald-500 transition-all cursor-pointer shadow-sm"
            >
              <option value={0}>Any Rating</option>
              <option value={4}>4.0+ Stars</option>
              <option value={4.5}>4.5+ Stars</option>
              <option value={4.8}>Elite (4.8+)</option>
            </select>
          </div>

          <div className="w-px h-12 bg-gray-100 hidden lg:block"></div>

          <div className="w-full sm:w-48">
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-1 flex items-center gap-2">
              Max Transit <Clock size={10} className="text-emerald-500" />
            </label>
            <select 
              value={maxDeliveryTime}
              onChange={(e) => setMaxDeliveryTime(Number(e.target.value))}
              className="w-full h-11 bg-white border border-gray-100 rounded-xl px-4 text-xs font-bold text-gray-700 focus:outline-none focus:border-emerald-500 transition-all cursor-pointer shadow-sm"
            >
              <option value={120}>Any Time</option>
              <option value={20}>Hyper Speed (20m)</option>
              <option value={30}>Under 30m</option>
              <option value={45}>Standard (45m)</option>
              <option value={60}>Bulk (60m+)</option>
            </select>
          </div>
        </div>
      </div>

      {isSearching ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full"
          />
          <p className="text-gray-500 font-medium animate-pulse">Scanning the Phoenix Network...</p>
        </div>
      ) : results.length > 0 ? (
        <>
          <AIOverview query={lastSearch} results={results} />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {results.map((merchant, idx) => (
              <MerchantCard key={merchant.id} merchant={merchant} idx={idx} />
            ))}
          </div>
        </>
      ) : queryText && !isSearching ? (
        <div className="text-center py-20 px-8 bg-gray-50 rounded-[48px] border-2 border-dashed border-gray-100 max-w-2xl mx-auto">
          <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
            <Search className="text-gray-300" size={40} />
          </div>
          <h3 className="text-2xl font-bold mb-4 text-gray-900">No matches found</h3>
          <p className="text-gray-500 text-lg leading-relaxed">
            We couldn't find any partners matching "{queryText}". Try searching for categories like "Food", "Logistics", or "Aggregate".
          </p>
        </div>
      ) : (
        <div>
          <h2 className="text-xl font-bold mb-8 text-gray-900 flex items-center gap-2">
            Suggested Categories <Zap size={20} className="text-emerald-500 fill-current" />
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {['Logistics', 'Food', 'Sushi', 'Construction', 'Heavy Hauling', 'Delivery'].map((cat) => (
              <button 
                key={cat}
                onClick={() => {
                  setQueryText(cat);
                  performSearch(cat);
                }}
                className="p-6 bg-white border border-gray-100 rounded-3xl text-sm font-bold text-gray-600 hover:border-emerald-500 hover:text-emerald-600 transition-all text-center shadow-sm hover:shadow-lg"
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="mt-20">
            <h2 className="text-xl font-bold mb-8 text-gray-900">All Partners</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
              {demoMerchants.map((merchant, idx) => (
                <MerchantCard key={merchant.id} merchant={merchant} idx={idx} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const MerchantPage = ({ user, addToCart }: { user: any, addToCart: (item: MenuItem, merchantId: string) => void }) => {
  const { id } = useParams();
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [userRating, setUserRating] = useState(0);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchMerchant = async () => {
      if (!id) return;
      setIsLoading(true);
      try {
        const docRef = doc(db, 'merchants', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setMerchant({ id: docSnap.id, ...docSnap.data() } as Merchant);
        } else {
          // Fallback for hardcoded merchants in the demo if not in DB yet
          const hardcoded = demoMerchants.find(m => m.id === id);
          if (hardcoded) setMerchant(hardcoded);
        }
      } catch (err) {
        console.error("Error fetching merchant:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchMerchant();
  }, [id]);

  const handleRatingSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !merchant || userRating === 0) return;

    setIsSubmitting(true);
    try {
      const newRating: Rating = {
        userId: user.uid,
        userName: user.displayName || 'Anonymous',
        score: userRating,
        comment: comment.trim(),
        createdAt: new Date().toISOString()
      };

      const merchantRef = doc(db, 'merchants', merchant.id);
      
      // Atomic update (for the demo, we update the list and recalc average)
      // In production, use a Cloud Function or complex rules
      const currentRatings = merchant.ratings || [];
      const newRatingsList = [...currentRatings, newRating];
      const newAverage = newRatingsList.reduce((acc, curr) => acc + curr.score, 0) / newRatingsList.length;

      await updateDoc(merchantRef, {
        ratings: arrayUnion(newRating),
        rating: newAverage
      });

      setMerchant({
        ...merchant,
        ratings: newRatingsList,
        rating: newAverage
      });
      setUserRating(0);
      setComment('');
      alert("Rating submitted!");
    } catch (err) {
      console.error("Error submitting rating:", err);
      alert("Failed to submit rating.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) return <div className="pt-32 text-center">Loading restaurant...</div>;
  if (!merchant) return <div className="pt-32 text-center">Restaurant not found</div>;

  return (
    <div className="pt-20 pb-12">
      <div className="relative h-64 lg:h-96 w-full">
        <img src={merchant.image} alt={merchant.name} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end">
          <div className="max-w-7xl mx-auto px-4 pb-8 w-full">
            <h1 className="text-4xl lg:text-5xl font-bold text-white mb-2">{merchant.name}</h1>
            <div className="flex items-center gap-4 text-white/90">
              <div className="flex items-center gap-1 bg-emerald-500 px-2 py-1 rounded-lg font-bold">
                <Star size={16} className="fill-current" />
                <span>{merchant.rating ? merchant.rating.toFixed(1) : 'N/A'}</span>
              </div>
              <span>{merchant.category}</span>
              <span>•</span>
              <span>{merchant.deliveryTime}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 mt-12 grid grid-cols-1 lg:grid-cols-3 gap-12">
        <div className="lg:col-span-2">
          <h2 className="text-2xl font-bold mb-6">Menu Items</h2>
          {merchant.menu && merchant.menu.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {merchant.menu.map((item) => (
                <motion.div 
                  key={item.id}
                  whileHover={{ y: -4 }}
                  className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex gap-4 items-center group cursor-pointer"
                >
                  <div className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0">
                    <img src={item.image} alt={item.name} className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-gray-900 truncate">{item.name}</h4>
                    <p className="text-[10px] text-gray-500 line-clamp-1 mb-2">{item.description}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-black text-emerald-600">${item.price.toFixed(2)}</span>
                      <button 
                        onClick={() => addToCart(item, merchant.id)}
                        className="p-1.5 bg-gray-50 rounded-lg text-gray-400 group-hover:bg-emerald-500 group-hover:text-white transition-all active:scale-95"
                      >
                        <ShoppingCart size={14} />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="bg-gray-50 p-8 rounded-3xl text-center border-2 border-dashed border-gray-200">
              <Package size={48} className="mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500">Menu for {merchant.name} has not been uploaded yet.</p>
            </div>
          )}

          <div className="mt-16">
            <h2 className="text-2xl font-bold mb-8">Customer Reviews</h2>
            <div className="space-y-6">
              {merchant.ratings && merchant.ratings.length > 0 ? (
                merchant.ratings.map((r, i) => (
                  <div key={i} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-bold">{r.userName}</h4>
                      <RatingStars rating={r.score} size={14} />
                    </div>
                    <p className="text-gray-600 text-sm leading-relaxed">{r.comment}</p>
                    <p className="text-[10px] text-gray-400 mt-3 uppercase tracking-widest">{new Date(r.createdAt).toLocaleDateString()}</p>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 italic">No reviews yet. Be the first!</p>
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-xl sticky top-24">
            <h3 className="text-xl font-bold mb-6">Rate this Place</h3>
            {user ? (
              <form onSubmit={handleRatingSubmit} className="space-y-4">
                <div className="flex justify-center gap-2 mb-4">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setUserRating(s)}
                      className="transition-transform active:scale-90"
                    >
                      <Star 
                        size={32} 
                        className={s <= userRating ? "text-emerald-500 fill-current" : "text-gray-200 fill-current"} 
                      />
                    </button>
                  ))}
                </div>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Share your experience..."
                  rows={4}
                  className="w-full p-4 bg-gray-50 border-2 border-transparent focus:border-emerald-500 focus:bg-white rounded-2xl outline-none transition-all resize-none text-sm"
                />
                <button
                  type="submit"
                  disabled={isSubmitting || userRating === 0}
                  className="w-full py-4 bg-emerald-500 text-white rounded-2xl font-bold shadow-lg shadow-emerald-100 disabled:bg-gray-100 disabled:text-gray-400 disabled:shadow-none transition-all"
                >
                  {isSubmitting ? "Submitting..." : "Submit Review"}
                </button>
              </form>
            ) : (
              <div className="text-center p-4">
                <p className="text-sm text-gray-500 mb-4">You must be signed in to leave a review.</p>
                <button 
                  onClick={() => signInWithPopup(auth, new GoogleAuthProvider())}
                  className="w-full py-3 bg-gray-900 text-white rounded-xl font-bold"
                >
                  Sign In
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const demoMerchants: Merchant[] = [
  { 
    id: '1', 
    name: "Market of Choice", 
    category: "Groceries", 
    rating: 4.9, 
    deliveryTime: "15-20 min", 
    image: "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=800", 
    description: "Eugene's premier local grocery. Organic, fresh, and community-driven.",
    coords: { lat: 44.0255, lng: -123.0911 },
    menu: [
      { id: 'm1', name: "Local Wagyu Ribeye", price: 28.50, description: "Grass-fed beef from Willamette Valley farms.", image: "https://images.unsplash.com/photo-1546248136-3d29cb94697c?auto=format&fit=crop&q=80&w=400" },
      { id: 'm2', name: "Artisanal Sourdough", price: 8.00, description: "Baked fresh daily in the Market bakery.", image: "https://images.unsplash.com/photo-1585478259715-876a6a81fc08?auto=format&fit=crop&q=80&w=400" }
    ]
  },
  { 
    id: '2', 
    name: "Jerry's Home Improvement", 
    category: "DIY & Hardware", 
    rating: 4.8, 
    deliveryTime: "30-45 min", 
    image: "https://images.unsplash.com/photo-1581141849291-1125c7b692b5?auto=format&fit=crop&q=80&w=800", 
    description: "Eugene & Springfield's building material giant.",
    coords: { lat: 44.1167, lng: -123.1611 },
    menu: [
      { id: 'm3', name: "Contractor Toolkit", price: 189.00, description: "Essential tools for any home project.", image: "https://images.unsplash.com/photo-1530124560676-4ce52bc0325d?auto=format&fit=crop&q=80&w=400" }
    ]
  },
  { 
    id: '3', 
    name: "Sherm's Thunderbird", 
    category: "Groceries", 
    rating: 4.7, 
    deliveryTime: "25-40 min", 
    image: "https://images.unsplash.com/photo-1534723452862-4c874018d66d?auto=format&fit=crop&q=80&w=800", 
    description: "Roseburg's trusted location for massive selection and savings.",
    coords: { lat: 43.1979, lng: -123.3639 },
    menu: [
      { id: 'm4', name: "Family Pack Poultry", price: 22.00, description: "Fresh cuts for Roseburg families.", image: "https://images.unsplash.com/photo-1587593810167-a84920ea0781?auto=format&fit=crop&q=80&w=400" }
    ]
  },
  { 
    id: '4', 
    name: "Bi-Mart", 
    category: "Membership Discount", 
    rating: 4.6, 
    deliveryTime: "20-30 min", 
    image: "https://images.unsplash.com/photo-1604719312563-8912e9223c6a?auto=format&fit=crop&q=80&w=800", 
    description: "Northwest membership discount stores. Eugene founded.",
    coords: { lat: 44.0888, lng: -123.1259 },
    menu: [
      { id: 'm5', name: "Northwest Camping Set", price: 145.00, description: "Durable gear for the Oregon wilderness.", image: "https://images.unsplash.com/photo-1536431311719-398b6704d4cc?auto=format&fit=crop&q=80&w=400" }
    ]
  },
  { 
    id: '5', 
    name: "Coastal Farm & Ranch", 
    category: "Farm Supplies", 
    rating: 4.8, 
    deliveryTime: "40-60 min", 
    image: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&q=80&w=800", 
    description: "Roseburg's destination for the northwest lifestyle.",
    coords: { lat: 43.2173, lng: -123.3417 },
    menu: [
      { id: 'm6', name: "Winter Fleece Jacket", price: 89.00, description: "Classic Oregon outdoor wear.", image: "https://images.unsplash.com/photo-1544022613-e87ef7557424?auto=format&fit=crop&q=80&w=400" }
    ]
  }
];

interface BusinessPledge {
  id: string;
  businessName: string;
  pledgeType: 'money' | 'materials' | 'labor';
  details: string;
  verified: boolean;
  createdAt: string;
}

interface CommunityMoment {
  id: string;
  userId: string;
  userName: string;
  userPhoto?: string;
  image: string;
  caption: string;
  location?: string;
  type: 'place' | 'concert';
  createdAt: string;
}

const MomentsWall = ({ user }: { user: any }) => {
  const [moments, setMoments] = useState<CommunityMoment[]>([]);
  const [isCapturing, setIsCapturing] = useState(false);
  const [caption, setCaption] = useState('');
  const [type, setType] = useState<'place' | 'concert'>('place');
  const [image, setImage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const q = query(collection(db, 'moments'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snap) => {
      setMoments(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as CommunityMoment[]);
    });
    return () => unsubscribe();
  }, []);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 800;
          const MAX_HEIGHT = 600;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
          setImage(dataUrl);
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !image || !caption.trim()) return;

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'moments'), {
        userId: user.uid,
        userName: user.displayName || 'Anonymous Player',
        userPhoto: user.photoURL || '',
        image,
        caption,
        type,
        createdAt: new Date().toISOString()
      });
      setImage(null);
      setCaption('');
      setIsCapturing(false);
    } catch (err) {
      console.error("Error saving moment:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mt-24 space-y-12">
      <div className="flex flex-col md:flex-row items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight mb-2">Community Spotlights</h2>
          <p className="text-gray-500">Capture and share your favorite Eugene moments—from hidden gems to epic concerts.</p>
        </div>
        <button 
          onClick={() => setIsCapturing(true)}
          className="flex items-center gap-2 px-8 py-4 bg-gray-900 text-white rounded-2xl font-bold hover:bg-gray-800 hover:scale-105 transition-all shadow-xl active:scale-95"
        >
          <Camera size={20} /> Share a Moment
        </button>
      </div>

      <AnimatePresence>
        {isCapturing && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-md"
          >
            <div className="bg-white rounded-[40px] w-full max-w-xl p-8 lg:p-12 shadow-2xl relative overflow-hidden">
               <button 
                 onClick={() => setIsCapturing(false)}
                 className="absolute top-6 right-6 p-2 hover:bg-gray-100 rounded-full transition-colors"
               >
                 <X size={24} />
               </button>

               <h3 className="text-2xl font-bold mb-8">Post a Community Moment</h3>
               
               <form onSubmit={handleSubmit} className="space-y-6">
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="aspect-video bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-100 transition-all relative overflow-hidden group"
                  >
                    {image ? (
                      <img src={image} className="w-full h-full object-cover" alt="Preview" />
                    ) : (
                      <>
                        <ImageIcon size={48} className="text-gray-300 mb-4 group-hover:scale-110 transition-transform" />
                        <p className="text-gray-400 font-bold">Snap or Upload Photo</p>
                      </>
                    )}
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handleImageChange} 
                      accept="image/*" 
                      capture="environment"
                      className="hidden" 
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <button 
                      type="button"
                      onClick={() => setType('place')}
                      className={`py-3 rounded-xl border-2 font-bold transition-all ${type === 'place' ? 'border-emerald-500 bg-emerald-50 text-emerald-600' : 'border-gray-100 text-gray-500'}`}
                    >
                      Favorite Place
                    </button>
                    <button 
                      type="button"
                      onClick={() => setType('concert')}
                      className={`py-3 rounded-xl border-2 font-bold transition-all ${type === 'concert' ? 'border-emerald-500 bg-emerald-50 text-emerald-600' : 'border-gray-100 text-gray-500'}`}
                    >
                      Epic Concert
                    </button>
                  </div>

                  <textarea 
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    placeholder="Tell us what makes this special..."
                    className="w-full p-6 bg-gray-50 border-2 border-transparent focus:border-emerald-500 rounded-2xl outline-none transition-all resize-none h-32"
                    required
                  />

                  <button 
                    type="submit"
                    disabled={isSubmitting || !image}
                    className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold disabled:opacity-50 shadow-xl shadow-emerald-200"
                  >
                    {isSubmitting ? "Posting..." : "Post to the Hub"}
                  </button>
               </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
        {moments.map((moment, idx) => (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            key={moment.id}
            className="group bg-white rounded-[40px] overflow-hidden border border-gray-100 shadow-sm hover:shadow-2xl transition-all"
          >
            <div className="relative aspect-[4/5] overflow-hidden">
               <img src={moment.image} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" alt="Moment" />
               <div className="absolute top-4 left-4 flex items-center gap-2">
                 <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest backdrop-blur-md ${moment.type === 'place' ? 'bg-emerald-500/80 text-white' : 'bg-orange-500/80 text-white'}`}>
                   {moment.type === 'place' ? 'Local Gem' : 'Live Show'}
                 </span>
               </div>
            </div>
            <div className="p-6">
              <p className="text-gray-900 font-medium leading-relaxed mb-6">"{moment.caption}"</p>
              <div className="flex items-center justify-between border-t border-gray-50 pt-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gray-100 rounded-full overflow-hidden">
                    {moment.userPhoto ? <img src={moment.userPhoto} alt={moment.userName} /> : <UserIcon size={16} className="m-auto text-gray-400 mt-2" />}
                  </div>
                  <p className="text-xs font-bold text-gray-900">{moment.userName}</p>
                </div>
                <div className="flex items-center gap-1 text-gray-400">
                  <Heart size={14} className="hover:text-red-500 cursor-pointer transition-colors" />
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

interface NeighborNomination {
  id: string;
  nominatorId: string;
  nominatorName: string;
  nomineeName: string;
  nomineeAddress?: string;
  reason: string;
  votes: string[];
  status: 'nominated' | 'selected' | 'completed';
  createdAt: string;
}

const NeighborhoodMakeover = ({ user }: { user: any }) => {
  const [nominations, setNominations] = useState<NeighborNomination[]>([]);
  const [isNominating, setIsNominating] = useState(false);
  const [form, setForm] = useState({ nomineeName: '', nomineeAddress: '', reason: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'nominations'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snap) => {
      setNominations(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as NeighborNomination[]);
    });
    return () => unsubscribe();
  }, []);

  const handleNominate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !form.nomineeName || !form.reason) return;

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'nominations'), {
        nominatorId: user.uid,
        nominatorName: user.displayName || 'Anonymous',
        ...form,
        votes: [user.uid],
        status: 'nominated',
        createdAt: new Date().toISOString()
      });
      setForm({ nomineeName: '', nomineeAddress: '', reason: '' });
      setIsNominating(false);
    } catch (err) {
      console.error("Error nominating:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVote = async (nominationId: string, currentVotes: string[]) => {
    if (!user || currentVotes.includes(user.uid)) return;

    try {
      const docRef = doc(db, 'nominations', nominationId);
      await updateDoc(docRef, {
        votes: arrayUnion(user.uid)
      });
    } catch (err) {
      console.error("Error voting:", err);
    }
  };

  return (
    <div className="mt-32 space-y-12">
      <div className="relative rounded-[48px] overflow-hidden p-8 lg:p-12 mb-12">
        <div className="absolute inset-0">
          <img 
            src="https://artifact.m68.us/api/v1/artifacts/2074e508-30cd-498c-8f1e-f3f8864ad19e" 
            alt="Community Service" 
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-white via-white/80 to-white/20"></div>
        </div>
        
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="max-w-2xl">
            <div className="flex items-center gap-4 mb-4">
              <div className="flex -space-x-3">
                 <img src="https://artifact.m68.us/api/v1/artifacts/42337775-69f8-41df-a55d-ea48a4da4599" className="w-10 h-10 rounded-full border-2 border-white object-cover" referrerPolicy="no-referrer" />
                 <div className="w-10 h-10 rounded-full border-2 border-white bg-orange-100 flex items-center justify-center text-[10px] font-bold text-orange-600">+12</div>
              </div>
              <p className="text-xs font-bold text-orange-600 uppercase tracking-widest">Recent Community Impact</p>
            </div>
            <h2 className="text-4xl lg:text-5xl font-bold tracking-tight mb-4 text-gray-900">Neighborhood Makeover Election</h2>
            <p className="text-gray-600 text-lg font-medium">Nominate a neighbor for a $1,000 full-service home cleanup (windows, landscaping, trash removal).</p>
          </div>
          <button 
            onClick={() => setIsNominating(true)}
            className="flex items-center gap-3 px-10 py-5 bg-orange-600 text-white rounded-3xl font-bold hover:bg-orange-700 hover:scale-105 transition-all shadow-2xl shadow-orange-200 active:scale-95 whitespace-nowrap"
          >
            <Star size={24} className="fill-current" /> Nominate a Neighbor
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isNominating && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-md"
          >
            <div className="bg-white rounded-[40px] w-full max-w-xl p-8 lg:p-12 shadow-2xl relative overflow-hidden">
               <button 
                 onClick={() => setIsNominating(false)}
                 className="absolute top-6 right-6 p-2 hover:bg-gray-100 rounded-full transition-colors"
               >
                 <X size={24} />
               </button>

               <h3 className="text-2xl font-bold mb-8">Nominate for Home Cleanup</h3>
               
               <form onSubmit={handleNominate} className="space-y-6">
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Neighbor's Name</label>
                    <input 
                      required
                      type="text" 
                      value={form.nomineeName}
                      onChange={(e) => setForm({...form, nomineeName: e.target.value})}
                      className="w-full px-6 py-4 bg-gray-50 border-2 border-transparent focus:border-orange-500 rounded-2xl outline-none transition-all"
                      placeholder="Who deserves this?"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Location / Address (Optional)</label>
                    <input 
                      type="text" 
                      value={form.nomineeAddress}
                      onChange={(e) => setForm({...form, nomineeAddress: e.target.value})}
                      className="w-full px-6 py-4 bg-gray-50 border-2 border-transparent focus:border-orange-500 rounded-2xl outline-none transition-all"
                      placeholder="General area or address"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Why do they need this?</label>
                    <textarea 
                      required
                      value={form.reason}
                      onChange={(e) => setForm({...form, reason: e.target.value})}
                      className="w-full p-6 bg-gray-50 border-2 border-transparent focus:border-orange-500 rounded-2xl outline-none transition-all resize-none h-32"
                      placeholder="Tell the community their story..."
                    />
                  </div>

                  <button 
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-4 bg-orange-600 text-white rounded-2xl font-bold disabled:opacity-50 shadow-xl shadow-orange-200"
                  >
                    {isSubmitting ? "Submitting..." : "Submit Nomination"}
                  </button>
               </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid md:grid-cols-2 gap-8">
        {nominations.map((nomination, idx) => (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            key={nomination.id}
            className="bg-white rounded-[40px] p-8 border border-gray-100 shadow-sm hover:shadow-xl transition-all relative overflow-hidden"
          >
            {nomination.status === 'selected' && (
              <div className="absolute top-0 right-0 bg-emerald-500 text-white px-6 py-2 rounded-bl-3xl font-bold text-xs uppercase tracking-widest">
                Winner
              </div>
            )}
            
            <div className="flex items-start justify-between gap-4 mb-6">
              <div>
                <h3 className="text-2xl font-bold text-gray-900 mb-1">{nomination.nomineeName}</h3>
                <p className="text-sm font-medium text-emerald-600 flex items-center gap-1">
                  <MapPin size={14} /> {nomination.nomineeAddress || 'Local Resident'}
                </p>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-gray-900">{nomination.votes.length}</div>
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Endorsements</div>
              </div>
            </div>

            <p className="text-gray-600 leading-relaxed italic mb-8">"{nomination.reason}"</p>

            <div className="flex items-center justify-between border-t border-gray-50 pt-6">
              <div className="flex items-center gap-3">
                <div className="group relative">
                  <div className="absolute -inset-1 bg-emerald-500 rounded-full blur opacity-25 group-hover:opacity-100 transition duration-1000 group-hover:duration-200"></div>
                  <div className="relative w-10 h-10 bg-white border border-gray-100 text-emerald-600 rounded-full flex items-center justify-center font-black text-xs shadow-sm">
                    {nomination.nominatorName.charAt(0)}
                  </div>
                </div>
                <div>
                  <p className="text-[9px] font-black text-emerald-500 tracking-[0.2em] uppercase">Fleet Entry By</p>
                  <p className="text-sm font-bold text-gray-900">{nomination.nominatorName}</p>
                </div>
              </div>
              <button 
                onClick={() => handleVote(nomination.id, nomination.votes)}
                disabled={!user || nomination.votes.includes(user.uid)}
                className={`flex items-center gap-2 px-7 py-3 rounded-2xl font-bold transition-all hover:scale-105 active:scale-95 shadow-lg ${
                  user && nomination.votes.includes(user.uid)
                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-100 shadow-none'
                    : 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-emerald-200'
                } disabled:opacity-50`}
              >
                {user && nomination.votes.includes(user.uid) ? (
                  <> <CheckCircle2 size={16} /> Endorsed</>
                ) : (
                  <> <Zap size={16} className="fill-current" /> Endorse</>
                )}
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

interface RewardItem {
  id: string;
  title: string;
  description: string;
  cost: number;
  icon: React.ReactNode;
  category: 'fleet' | 'merchant' | 'status';
}

const MusicPlayer = ({ startSignal, user }: { startSignal: boolean; user: any }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.5);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // If user interacts or logs in, we can try to start
    if ((startSignal || user) && !isPlaying) {
      setIsPlaying(true);
    }
  }, [startSignal, user]);

  useEffect(() => {
    if (isPlaying && audioRef.current) {
      audioRef.current.play().catch(err => {
        console.log("Autoplay blocked, waiting for interaction", err);
        setIsPlaying(false);
      });
    } else if (audioRef.current) {
      audioRef.current.pause();
    }
  }, [isPlaying]);

  return (
    <div className="fixed bottom-6 left-6 z-[60] flex items-center gap-4 bg-gray-950/90 backdrop-blur-2xl px-5 py-3 rounded-2xl border border-white/10 shadow-2xl ring-1 ring-white/5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center relative overflow-hidden group">
          <div className="absolute inset-0 bg-emerald-500 opacity-20 animate-pulse"></div>
          <Zap size={20} className="text-emerald-400 relative z-10" />
        </div>
        <div className="flex flex-col">
          <p className="text-[8px] font-black text-emerald-400 uppercase tracking-widest">LIVE BAND SIGNAL</p>
          <div className="flex items-center gap-1.5">
            <div className="flex gap-0.5">
              {[1,2,3].map(i => <div key={i} className={`w-0.5 h-2 bg-emerald-500/50 rounded-full animate-bounce`} style={{ animationDelay: `${i*0.1}s` }} />)}
            </div>
            <p className="text-[10px] font-bold text-white truncate max-w-[120px]">FRANK AND BEANS</p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4 border-l border-white/10 pl-6">
        <button 
          onClick={() => setIsPlaying(!isPlaying)}
          className="w-12 h-12 bg-white text-gray-900 rounded-full flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-xl shadow-white/5"
        >
          {isPlaying ? <X size={24} /> : <Zap size={24} className="fill-current" />}
        </button>
        <div className="flex items-center gap-2">
          <Flame size={14} className="text-orange-500" />
          <input 
            type="range" 
            min="0" 
            max="1" 
            step="0.1" 
            value={volume} 
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              setVolume(val);
              if (audioRef.current) audioRef.current.volume = val;
            }}
            className="w-16 accent-emerald-500"
          />
        </div>
      </div>
      {/* Name In Blood - Black Label Society (Official high energy stream) */}
      <audio 
        ref={audioRef} 
        src="https://www.soundhelix.com/examples/mp3/SoundHelix-Song-12.mp3" // Replacing with fastest metal-style placeholder
        loop 
      />
      {/* Hidden YouTube player for the real Name In Blood experience if possible */}
      <div className="hidden">
        {isPlaying && (
          <iframe 
            width="1" 
            height="1" 
            src={`https://www.youtube.com/embed/5m_hR186hK8?autoplay=1&mute=0`} 
            allow="autoplay"
          ></iframe>
        )}
      </div>
    </div>
  );
};

const PhoenixArcade = ({ onEarnPoints }: { onEarnPoints: (amount: number) => void }) => {
  const [activeGame, setActiveGame] = useState<string | null>(null);

  const games = [
    { 
      id: 'god-logistics', 
      title: 'God of Logistics', 
      icon: <Target size={32} />, 
      color: 'bg-red-700', 
      payout: 250, 
      img: 'https://images.unsplash.com/photo-1612287230202-1ff1d85d1bdf?auto=format&fit=crop&q=80&w=600' 
    },
    { 
      id: 'gt-courier', 
      title: 'GT Courier Pro', 
      icon: <Car size={32} />, 
      color: 'bg-blue-700', 
      payout: 200, 
      img: 'https://images.unsplash.com/photo-1594739433321-2f7411a003fd?auto=format&fit=crop&q=80&w=600'
    },
    { 
      id: 'horizon-cargo', 
      title: 'Horizon Cargo', 
      icon: <Bird size={32} />, 
      color: 'bg-orange-600', 
      payout: 300, 
      isPremium: true,
      img: 'https://images.unsplash.com/photo-1627389981847-cf4fca168748?auto=format&fit=crop&q=80&w=600' 
    },
  ];

  const handlePlay = (id: string) => {
    setActiveGame(id);
    setTimeout(() => {
      const payout = games.find(g => g.id === id)?.payout || 0;
      onEarnPoints(payout);
      setActiveGame(null);
      alert(`Session Complete! ${payout} XP added to your community pulse.`);
    }, 4000);
  };

  return (
    <div className="mt-32 max-w-7xl mx-auto px-4">
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-8">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-3 px-5 py-2 bg-emerald-500/10 rounded-full text-[10px] font-black text-emerald-400 uppercase tracking-[0.3em] border border-emerald-500/20 mb-8">
            <Zap size={14} className="fill-current" /> Operational Simulator
          </div>
          <h2 className="text-5xl lg:text-8xl font-black tracking-tighter mb-6 text-white italic leading-none">PLAY STATION.</h2>
          <p className="text-gray-400 text-lg font-medium leading-relaxed">Simulate critical load-out paths. High-performance operators earn direct Hub Credits convertible at local Eugene/Roseburg nodes.</p>
        </div>
        <div className="bg-white/5 backdrop-blur-3xl p-10 rounded-[48px] border border-white/10 shadow-2xl">
          <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Network Yield</p>
          <p className="text-3xl font-black text-white italic tracking-tighter">1000 XP = <span className="text-emerald-500">$10.00 REBATE</span></p>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-12">
        {games.map((game) => (
          <motion.div 
            key={game.id}
            whileHover={{ y: -16 }}
            className="group relative bg-gray-950 rounded-[64px] overflow-hidden border border-white/5 hover:border-emerald-500/30 transition-all flex flex-col"
          >
            <div className="relative aspect-[3/4] overflow-hidden">
              <img src={game.img} alt={game.title} className="w-full h-full object-cover transition-all duration-1000 group-hover:scale-110 opacity-40 group-hover:opacity-100" referrerPolicy="no-referrer" />
              <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-gray-950/20 to-transparent"></div>
              
              {game.isPremium && (
                <div className="absolute top-8 right-8 px-5 py-2 bg-emerald-500 text-gray-950 text-[10px] font-black rounded-full shadow-2xl">
                  ELITE GRADE
                </div>
              )}
              
              <div className="absolute bottom-10 left-10 flex items-center gap-5">
                <div className={`w-14 h-14 ${game.color} text-white rounded-2xl flex items-center justify-center shadow-2xl group-hover:rotate-6 transition-transform`}>
                  {React.cloneElement(game.icon as React.ReactElement, { size: 28 })}
                </div>
                <p className="font-black text-white text-3xl italic tracking-tighter uppercase">{game.title}</p>
              </div>
            </div>
            
            <div className="p-12 flex-1 flex flex-col bg-gray-950/80 backdrop-blur-3xl border-t border-white/5">
              <div className="flex items-center justify-between mb-10">
                <div>
                  <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Operational Yield</p>
                  <p className="text-3xl font-black text-white italic tracking-tighter">{game.payout} XP</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1">Hub Value</p>
                  <p className="text-lg font-black text-gray-400 tracking-tighter">~ ${(game.payout/100).toFixed(2)}</p>
                </div>
              </div>
              
              <button 
                onClick={() => handlePlay(game.id)}
                disabled={!!activeGame}
                className="w-full h-18 bg-white text-gray-950 rounded-[32px] font-black text-[12px] uppercase tracking-[0.3em] hover:bg-emerald-500 hover:text-white transition-all flex items-center justify-center gap-3 active:scale-95 disabled:opacity-30 mt-auto shadow-2xl shadow-emerald-950/20"
              >
                {activeGame === game.id ? (
                  <div className="flex gap-1.5">
                    {[1,2,3].map(i => <div key={i} className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: `${i*0.1}s` }} />)}
                  </div>
                ) : (
                  <>INITIALIZE CORE <ChevronRight size={20} /></>
                )}
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};


const RewardsStore = ({ currentPoints, onRedeem }: { currentPoints: number; onRedeem: (cost: number) => void }) => {
  const rewards: RewardItem[] = [
    { id: '1', title: 'Priority Dispatch', description: 'Jump to the front of any delivery queue for 24 hours.', cost: 500, icon: <Zap className="text-emerald-500" />, category: 'fleet' },
    { id: '2', title: '$10 Local Voucher', description: 'Redeemable at Urban Greens or Sushi Sensation.', cost: 1000, icon: <Ticket className="text-orange-500" />, category: 'merchant' },
    { id: '3', title: 'Route Legend Badge', description: 'Permanent profile badge + unique map marker color.', cost: 2500, icon: <Star className="text-blue-500" />, category: 'status' },
    { id: '4', title: 'Zero Fee Week', description: 'Pay zero delivery fees on all orders for 7 days.', cost: 1500, icon: <DollarSign className="text-emerald-600" />, category: 'fleet' },
  ];

  return (
    <div id="rewards-section" className="mt-32 space-y-12 pb-24 border-t border-gray-50 pt-32">
      <div className="text-center max-w-2xl mx-auto">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-100/50 rounded-full text-xs font-bold text-emerald-600 uppercase tracking-widest border border-emerald-200 mb-6">
          <Zap size={14} className="fill-current" /> Rewards Hub
        </div>
        <h2 className="text-4xl font-bold tracking-tight mb-4">Redeem Your XP</h2>
        <p className="text-gray-500">Your community activity translates into real impact and exclusive logistics perks.</p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
        {rewards.map((reward) => (
          <motion.div 
            key={reward.id}
            whileHover={{ y: -8 }}
            className="bg-white p-8 rounded-[40px] border border-gray-100 shadow-sm hover:shadow-2xl transition-all flex flex-col h-full"
          >
            <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center mb-6">
              {reward.icon}
            </div>
            <h3 className="text-xl font-bold mb-2">{reward.title}</h3>
            <p className="text-gray-500 text-sm mb-8 flex-1">{reward.description}</p>
            
            <div className="flex items-center justify-between pt-6 border-t border-gray-50">
              <div className="text-lg font-black text-gray-900">
                {reward.cost} <span className="text-xs font-bold text-emerald-500">XP</span>
              </div>
              <button 
                onClick={() => onRedeem(reward.cost)}
                disabled={currentPoints < reward.cost}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  currentPoints >= reward.cost 
                    ? 'bg-gray-900 text-white hover:bg-black active:scale-95 shadow-lg' 
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed shadow-none'
                }`}
              >
                {currentPoints >= reward.cost ? 'Redeem' : 'Insufficient'}
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

const CommunityImpactHub = ({ user }: { user: any }) => {
  const [points, setPoints] = useState(1240);
  const [pledges, setPledges] = useState<BusinessPledge[]>([]);
  const [formData, setFormData] = useState({
    businessName: '',
    pledgeType: 'money',
    details: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'pledges'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snap) => {
      setPledges(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as BusinessPledge[]);
    });
    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!formData.businessName.trim()) return;

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'pledges'), {
        ...formData,
        verified: false,
        createdAt: new Date().toISOString()
      });
      setSubmitted(true);
      setFormData({ businessName: '', pledgeType: 'money', details: '' });
      setTimeout(() => setSubmitted(false), 5000);
    } catch (err) {
      console.error("Error submitting pledge:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="pt-24 pb-12 px-4 max-w-7xl mx-auto min-h-screen">
      <div className="text-center mb-16">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-full text-xs font-bold border border-emerald-100 mb-6 uppercase tracking-widest">
          Patriotism & Loyalty
        </div>
        <h1 className="text-4xl lg:text-6xl font-bold tracking-tight mb-6">Community Impact Hub</h1>
        <p className="text-gray-500 max-w-2xl mx-auto text-lg">
          Support our mission with specialized <b>cash donations for the elderly</b> or material pledges. Local businesses standing together to build a better Eugene.
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-12 items-start mb-20">
        {/* Pledge Form */}
        <div className="bg-white p-8 lg:p-12 rounded-[40px] border border-gray-100 shadow-2xl">
          <h2 className="text-2xl font-bold mb-2">Pledge Your Support</h2>
          <p className="text-gray-500 text-sm mb-8">Contribute funds for the elderly or construction materials for local housing projects.</p>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Business Name</label>
              <input 
                required
                type="text" 
                value={formData.businessName}
                onChange={(e) => setFormData({...formData, businessName: e.target.value})}
                className="w-full px-6 py-4 bg-gray-50 border-2 border-transparent focus:border-emerald-500 rounded-2xl outline-none transition-all"
                placeholder="E.g. Eugene Concrete Solutions"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Contribution Type</label>
              <div className="grid grid-cols-3 gap-3">
                {['money', 'materials', 'labor'].map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setFormData({...formData, pledgeType: type as any})}
                    className={`py-3 rounded-xl border-2 font-bold capitalize transition-all ${
                      formData.pledgeType === type 
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-600' 
                        : 'border-gray-100 text-gray-500'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Details</label>
              <textarea 
                required
                rows={4}
                value={formData.details}
                onChange={(e) => setFormData({...formData, details: e.target.value})}
                className="w-full px-6 py-4 bg-gray-50 border-2 border-transparent focus:border-emerald-500 rounded-2xl outline-none transition-all resize-none"
                placeholder="Specify what you'd like to donate (e.g. 50 bags of concrete, $500, or 40 hours of electrical labor)"
              />
            </div>
            <button 
              type="submit"
              disabled={isSubmitting}
              className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-500 hover:scale-[1.02] transition-all shadow-xl shadow-emerald-900/20 active:scale-95 disabled:opacity-50"
            >
              {isSubmitting ? "Submitting..." : "Submit Pledge"}
            </button>
            {submitted && (
              <p className="text-center text-emerald-600 font-bold animate-bounce mt-4">
                Thank you! Your pledge has been recorded and is being verified.
              </p>
            )}
          </form>
        </div>

        {/* Wall of Honor */}
        <div className="space-y-8">
           <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <ShieldCheck className="text-emerald-500" /> Wall of Honor
              </h2>
              <span className="text-sm font-bold text-gray-400 uppercase tracking-widest">{pledges.length} Verified Partners</span>
           </div>
           
           <div className="grid gap-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
              {pledges.length === 0 ? (
                <div className="p-12 bg-gray-50 rounded-[32px] border-2 border-dashed border-gray-100 text-center">
                   <p className="text-gray-400 italic">Be the first business to pledge support!</p>
                </div>
              ) : (
                pledges.map((pledge, idx) => (
                  <motion.div 
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    key={pledge.id}
                    className="p-6 bg-white rounded-3xl border border-gray-100 shadow-sm flex items-center justify-between group hover:border-emerald-200 transition-all"
                  >
                    <div className="flex items-center gap-4">
                       <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center font-bold">
                          {pledge.businessName[0].toUpperCase()}
                       </div>
                       <div>
                          <p className="font-bold text-gray-900">{pledge.businessName}</p>
                          <p className="text-xs text-gray-500 capitalize">{pledge.pledgeType} • {new Date(pledge.createdAt).toLocaleDateString()}</p>
                       </div>
                    </div>
                    {pledge.verified && <CheckCircle2 className="text-emerald-500" size={20} />}
                  </motion.div>
                ))
              )}
           </div>
        </div>
      </div>

      <NeighborhoodMakeover user={user} />

      {/* Daily Community Challenge - Interaction retention loop */}
      <section className="px-4 max-w-7xl mx-auto my-24">
        <div className="bg-orange-50 rounded-[48px] p-8 lg:p-12 border border-orange-100 flex flex-col lg:flex-row items-center gap-12 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-orange-200/30 rounded-full blur-3xl -mr-32 -mt-32"></div>
          <div className="relative z-10 lg:w-1/2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-orange-600 text-white rounded-full text-[10px] font-bold uppercase tracking-widest mb-6">
              <Star size={12} className="fill-current" /> Daily Hero Challenge
            </div>
            <h2 className="text-3xl lg:text-5xl font-bold mb-6 tracking-tight text-gray-900">Endorse 3 Neighbors <span className="text-orange-600 italic">Today.</span></h2>
            <p className="text-gray-600 text-lg mb-8 leading-relaxed">
              Help us reach our weekly neighborhood goal. Complete your first 3 endorsements today to earn <b>500 bonus Phoenix Points</b> and a "Neighborhood Hero" badge.
            </p>
            <div className="flex items-center gap-4">
               <div className="flex-1 h-3 bg-white rounded-full overflow-hidden border border-orange-200">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: '66%' }}
                    className="h-full bg-orange-500"
                  />
               </div>
               <span className="text-sm font-bold text-orange-600">2/3 Done</span>
            </div>
          </div>
          <div className="lg:w-1/2 grid grid-cols-2 gap-4">
             <div className="bg-white p-6 rounded-3xl shadow-xl shadow-orange-900/5 border border-orange-50">
               <p className="text-3xl font-black text-gray-900 mb-1">+500</p>
               <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Points Reward</p>
             </div>
             <div className="bg-orange-600 p-6 rounded-3xl shadow-xl shadow-orange-900/20 text-white">
               <p className="text-3xl font-black mb-1">12h</p>
               <p className="text-[10px] font-bold text-orange-200 uppercase tracking-widest">Time Remaining</p>
             </div>
          </div>
        </div>
      </section>

      <MomentsWall user={user} />
      
      <PhoenixArcade onEarnPoints={(amount) => setPoints(prev => prev + amount)} />

      <RewardsStore 
        currentPoints={points} 
        onRedeem={(cost) => {
          if (points >= cost) {
            setPoints(prev => prev - cost);
            alert("Reward Redeemed! Check your email for verification.");
          }
        }} 
      />

      {/* Band Giveaway Section */}
      <div id="band-section" className="mt-24 bg-gray-900 rounded-[64px] p-8 lg:p-16 text-white relative overflow-hidden ring-1 ring-white/10">
        <div className="absolute inset-0">
          <img 
            src="https://artifact.m68.us/api/v1/artifacts/17b9bdfb-ba85-48b2-8f19-0be4061a52cd"
            alt="Phoenix Sessions"
            className="w-full h-full object-cover opacity-30"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-gray-900/80 to-emerald-900/40"></div>
        </div>
        <div className="relative z-10 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 rounded-full text-[10px] font-bold uppercase tracking-widest mb-6">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span> Live Check-in
            </div>
            <h2 className="text-4xl lg:text-6xl font-bold mb-6 tracking-tight leading-tight">Eugene Tour <span className="text-emerald-400 font-mono italic">Live Signal.</span></h2>
            <p className="text-gray-400 text-lg mb-8 leading-relaxed">
              We're tracking "Frank and Beans" and other local legends as they carry the signal across the valley. Enter your info below to stay updated on the next pop-up gig and community session.
            </p>
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px] p-6 bg-white/5 backdrop-blur-xl rounded-[32px] border border-white/10 flex items-center gap-4 transition-transform hover:scale-105">
                <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
                  <MapPin size={24} className="text-white" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Base Camp</p>
                  <p className="text-xl font-bold">Eugene, OR</p>
                </div>
              </div>
              <div className="flex-1 min-w-[200px] p-6 bg-white/5 backdrop-blur-xl rounded-[32px] border border-white/10 flex items-center gap-4 transition-transform hover:scale-105">
                <div className="w-12 h-12 bg-gray-900 rounded-2xl border border-white/10 flex items-center justify-center overflow-hidden">
                  <img src="https://artifact.m68.us/api/v1/artifacts/48902506-69d6-444a-9bd1-a9018424269e" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Stage Status</p>
                  <p className="text-xl font-bold">Frank and Beans</p>
                </div>
              </div>
            </div>

            {/* Phoenix Express Fleet Signal - Local Tracking */}
            <div className="mt-12 p-8 bg-emerald-950/20 backdrop-blur-3xl rounded-[40px] border border-white/10 relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent"></div>
              
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
                      <Navigation size={24} className="text-white animate-pulse" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em]">Signal Lock: Active</p>
                      <h4 className="text-xl font-bold">Frank and Beans Tracker</h4>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/20 rounded-full border border-emerald-500/30">
                    <div className="w-2 h-2 bg-emerald-400 rounded-full animate-ping"></div>
                    <span className="text-[10px] font-bold text-emerald-400 uppercase">Live Relays: Active</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                  <div className="h-48 rounded-2xl overflow-hidden border border-white/10 relative">
                    <MapContainer center={[44.0448, -123.0726]} zoom={14} className="w-full h-full z-10" zoomControl={false}>
                      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                      <Marker position={[44.0448, -123.0726]}>
                        <Popup>Frank and Beans - Near Hayward Field</Popup>
                      </Marker>
                    </MapContainer>
                  </div>
                  <div className="p-6 bg-white/5 rounded-3xl border border-white/10 backdrop-blur-md">
                    <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-2">Origin Point</p>
                    <p className="text-2xl font-black text-white flex items-center gap-2">
                       <MapPin className="text-emerald-500" /> Near Hayward Field
                    </p>
                    <div className="mt-6 flex gap-2">
                      {[1,2,3,4,5,6,7,8,9,10].map(i => (
                        <motion.div 
                          key={i}
                          animate={{ height: [8, 16, 8] }}
                          transition={{ repeat: Infinity, duration: 1, delay: i * 0.1 }}
                          className={`w-1 rounded-full ${i <= 7 ? 'bg-emerald-500' : 'bg-white/10'}`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-white text-gray-900 p-8 rounded-[32px]">
            <h3 className="text-xl font-bold mb-6">Band Registration</h3>
            <form 
              onSubmit={async (e) => {
                e.preventDefault();
                const form = e.target as HTMLFormElement;
                const bandName = (form.elements.namedItem('bandName') as HTMLInputElement).value;
                const genre = (form.elements.namedItem('genre') as HTMLInputElement).value;
                try {
                  await addDoc(collection(db, 'band_giveaway'), {
                     bandName,
                     genre,
                     createdAt: new Date().toISOString()
                  });
                  alert("Band registered successfully! Good luck!");
                  form.reset();
                } catch (err) {
                  console.error(err);
                }
              }} 
              className="space-y-4"
            >
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 ml-1">Band Name</label>
                <input required name="bandName" className="w-full px-5 py-3 bg-gray-50 border-2 border-transparent focus:border-emerald-500 rounded-xl outline-none" placeholder="E.g. The Eugene Echoes" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 ml-1">Music Genre</label>
                <input required name="genre" className="w-full px-5 py-3 bg-gray-50 border-2 border-transparent focus:border-emerald-500 rounded-xl outline-none" placeholder="E.g. Indie Rock / Jazz" />
              </div>
              <button type="submit" className="w-full py-4 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-500 transition-all shadow-lg active:scale-95">
                Enter Giveaway
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

const LiveTourTracker = () => {
  const tours = [
    { band: 'Metallica', location: 'Prague, CZ', status: 'En Route', eta: '3.5h', icon: <Bird className="text-emerald-400" /> },
    { band: 'Black Label Society', location: 'Portland, OR', status: 'Soundcheck', eta: 'LIVE', icon: <Target className="text-emerald-400" /> },
    { band: 'Tool', location: 'Eugene, OR', status: 'Arrived', eta: 'READY', icon: <Zap className="text-emerald-400" /> },
  ];

  return (
    <div className="bg-gray-900/40 backdrop-blur-3xl rounded-[48px] p-6 border border-white/5 relative overflow-hidden group shadow-2xl">
      <div className="flex items-center justify-between mb-8">
         <h3 className="text-lg font-black italic text-white flex items-center gap-2">
           NETWORK FEED <span className="flex h-2 w-2 rounded-full bg-red-500 animate-ping"></span>
         </h3>
         <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">Global Scan</p>
      </div>
      
      <div className="h-64 rounded-3xl overflow-hidden mb-8 border border-white/10 relative">
        <MapContainer center={[44.0521, -123.0868]} zoom={11} className="w-full h-full z-10" zoomControl={false}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {tours.map((tour, idx) => (
            <Marker key={idx} position={tour.band === 'Tool' ? [44.0521, -123.0868] : tour.band === 'Black Label Society' ? [45.5152, -122.6784] : [50.0755, 14.4378]}>
              <Popup>
                <div className="p-2">
                  <p className="font-bold">{tour.band}</p>
                  <p className="text-xs">{tour.status}</p>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
        <div className="absolute top-4 left-4 z-20 px-3 py-1.5 bg-gray-900/80 backdrop-blur text-[9px] font-black text-white rounded-full border border-white/10 uppercase tracking-widest">
           Band Live Location
        </div>
      </div>

      <div className="space-y-6">
        {tours.map((tour, i) => (
          <div key={i} className="flex items-center justify-between group/tour">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center border border-white/10 group-hover/tour:border-emerald-500/50 transition-all">
                {React.cloneElement(tour.icon as React.ReactElement, { size: 18 })}
              </div>
              <div>
                <p className="text-sm font-black text-white italic">{tour.band}</p>
                <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest">{tour.location}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[8px] font-black text-emerald-400 uppercase tracking-widest mb-0.5">{tour.status}</p>
              <p className={`text-sm font-black tracking-tighter ${tour.eta === 'LIVE' || tour.eta === 'READY' ? 'text-white italic' : 'text-gray-500'}`}>{tour.eta}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 p-4 bg-emerald-500/10 rounded-2xl border border-emerald-500/20">
        <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest text-center">
          Eugene Hub fully operational
        </p>
      </div>
    </div>
  );
};

const Home = ({ user }: { user: any }) => {
  return (
    <div className="pt-20 pb-12 bg-gray-950 min-h-screen">
      {/* Obsidian Hero Section */}
      <section className="px-4 mb-24 pt-12 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[600px] bg-emerald-500/10 blur-[120px] pointer-events-none"></div>
        
        <div className="max-w-7xl mx-auto rounded-[64px] overflow-hidden relative shadow-2xl shadow-black/50 min-h-[650px] flex items-center group border border-white/5">
          {/* Layered Background with Parallax Intent */}
          <div className="absolute inset-0">
            <img 
              src="https://images.unsplash.com/photo-1579412690850-bd41cd0af397?auto=format&fit=crop&q=80&w=2000" 
              alt="Logistics Tech" 
              className="w-full h-full object-cover opacity-60 transition-transform duration-[3s] group-hover:scale-105"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-gray-950 via-gray-950/80 to-transparent"></div>
            <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-transparent to-transparent"></div>
          </div>

          <div className="relative z-10 px-8 py-20 lg:px-20 lg:py-32 max-w-3xl">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            >
              <div className="flex flex-wrap items-center gap-4 mb-10">
                <div className="inline-flex items-center gap-3 px-5 py-2 bg-emerald-500/20 backdrop-blur-2xl text-emerald-400 rounded-full text-[10px] font-black uppercase tracking-[0.3em] border border-emerald-500/30">
                  <Zap size={14} className="fill-current animate-pulse" /> Active Network
                </div>
                <div className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em] pl-6 border-l border-white/10">
                  Eugene • Springfield • Roseburg
                </div>
              </div>
              
              <h1 className="text-5xl lg:text-9xl font-black tracking-tighter mb-8 leading-[0.85] text-white italic">
                SUPERIOR <br />
                <span className="text-emerald-500 drop-shadow-[0_0_40px_rgba(16,185,129,0.3)]">INTELLIGENCE.</span>
              </h1>
              
              <p className="text-gray-400 text-lg lg:text-2xl font-medium max-w-xl mb-12 leading-relaxed tracking-tight">
                Military-grade logistics for your daily essentials. 
                Everything from Local Artisan foods to Industrial Hauling—all in one command interface.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-6 p-2 bg-white/5 backdrop-blur-xl rounded-[32px] border border-white/10 max-w-xl">
                <div className="relative flex-1">
                  <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-emerald-500" size={20} />
                  <input 
                    type="text" 
                    placeholder="Registry Search..." 
                    className="w-full h-16 pl-14 pr-6 bg-transparent text-white font-bold placeholder:text-gray-600 outline-none"
                  />
                </div>
                <Link to="/merchants" className="h-16 px-12 bg-white text-gray-950 rounded-[24px] font-black text-[12px] uppercase tracking-widest hover:bg-emerald-400 hover:text-white transition-all shadow-xl active:scale-95 flex items-center justify-center">
                  Launch Dispatch
                </Link>
              </div>
            </motion.div>
          </div>
          
          {/* Decorative Command HUD Element */}
          <div className="absolute right-12 bottom-12 hidden xl:block">
            <div className="p-6 bg-gray-900/60 backdrop-blur-3xl rounded-[32px] border border-white/10 w-64 shadow-2xl">
              <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-4">Node Metrics</p>
              <div className="space-y-4">
                {[
                  { label: 'Latency', value: '42ms', color: 'bg-emerald-500' },
                  { label: 'Throughput', value: '1.2k/s', color: 'bg-blue-500' },
                  { label: 'Uptime', value: '99.98%', color: 'bg-emerald-400' }
                ].map((stat, i) => (
                  <div key={i}>
                    <div className="flex justify-between text-[10px] font-bold text-white mb-2">
                      <span>{stat.label}</span>
                      <span>{stat.value}</span>
                    </div>
                    <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: '80%' }}
                        transition={{ delay: 1, duration: 2 }}
                        className={`h-full ${stat.color}`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Live Tour Logistics Overlay */}
      <section className="px-4 max-w-7xl mx-auto mb-32">
        <div className="grid lg:grid-cols-3 gap-10 items-start">
          <div className="lg:col-span-1">
             <LiveTourTracker />
          </div>
          <div className="lg:col-span-2 space-y-8">
            <div className="flex items-center justify-between">
              <h3 className="text-3xl font-black italic text-white uppercase tracking-tighter">Event Shells Ready</h3>
              <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">3 Verified Hubs</p>
            </div>
            
            <div className="grid sm:grid-cols-2 gap-8">
              <motion.div 
                whileHover={{ y: -8 }}
                className="group p-8 bg-white/5 border border-white/5 rounded-[48px] relative overflow-hidden transition-all hover:border-emerald-500/30 shadow-2xl"
              >
                <div className="absolute inset-0 opacity-20 transition-opacity group-hover:opacity-40 grayscale group-hover:grayscale-0 transition-all duration-700">
                  <img 
                    src="https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?auto=format&fit=crop&q=80&w=800"
                    alt="Metallica Hub"
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="relative z-10">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400 mb-4 block">ACTIVE NODE • M72 TOUR</span>
                  <h3 className="text-3xl font-black italic text-white mb-2 leading-none">METALLICA</h3>
                  <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mb-10">Eugene/Portland Regional Hub</p>
                  <a href="https://www.metallica.com/tour/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-3 px-8 py-3 bg-white text-gray-950 rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-emerald-400 hover:text-white transition-all">
                    GET TICKETS <ChevronRight size={16} />
                  </a>
                </div>
              </motion.div>

              <motion.div 
                whileHover={{ y: -8 }}
                className="group p-8 bg-emerald-500 rounded-[48px] relative overflow-hidden transition-all shadow-2xl shadow-emerald-500/20"
              >
                <div className="absolute inset-0 opacity-30 mix-blend-overlay">
                  <img 
                    src="https://images.unsplash.com/photo-1493225255756-d9584f8606e9?auto=format&fit=crop&q=80&w=800"
                    alt="BLS Hub"
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="relative z-10">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-950 mb-4 block">LIVE STATUS • MCDONALD THEATRE</span>
                  <h3 className="text-3xl font-black italic text-gray-950 mb-2 leading-none">B.L.S.</h3>
                  <p className="text-emerald-950 text-xs font-bold uppercase tracking-widest mb-10 text-opacity-60">Eugene, OR Venue</p>
                  <a href="https://blacklabelsociety.com/tour/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-3 px-8 py-3 bg-gray-950 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-black transition-all">
                    TRACK HUB <ExternalLink size={16} />
                  </a>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 max-w-7xl mx-auto mb-20">
        <div className="p-8 bg-white/5 border border-white/5 rounded-[48px] flex flex-col items-center justify-center text-center backdrop-blur-3xl shadow-2xl">
           <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mb-6 border border-emerald-500/30">
              <ShieldCheck className="text-emerald-400" size={32} />
           </div>
          <p className="text-white text-lg font-black italic uppercase tracking-tighter mb-2">Fan Protection Core</p>
          <p className="text-gray-500 text-xs font-bold uppercase tracking-widest max-w-md mx-auto">Verified logistics authentication for all major regional tour intersections.</p>
        </div>
      </section>

      {/* Logistics & Community Mission Section */}
      <section className="px-4 max-w-7xl mx-auto mb-20 text-center">
        <div className="bg-emerald-600 rounded-[48px] p-12 lg:p-20 text-white relative overflow-hidden border-4 border-emerald-500 shadow-2xl">
          <div className="absolute inset-0 opacity-40">
            <img src="https://artifact.m68.us/api/v1/artifacts/2074e508-30cd-498c-8f1e-f3f8864ad19e" alt="Home Cleanup" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-emerald-800/60 via-emerald-700/20 to-transparent"></div>
          
          <div className="relative z-10 max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white text-emerald-900 text-[10px] font-bold uppercase tracking-widest rounded-full mb-8 shadow-xl">
              <Heart size={12} className="fill-current text-rose-500" /> $400,000 Neighborhood Grant
            </div>
            <h2 className="text-4xl lg:text-6xl font-bold mb-8 leading-tight">Building a Stronger Eugene Together</h2>
            <p className="text-xl text-emerald-50 mb-10 leading-relaxed font-medium">
              We have committed a <b>$400,000 Home Makeover Fund</b> to support our neighbors. Nominate someone for specialized assistance, eldercare support, or heavy-duty cleanup.
            </p>
            <p className="text-xs text-emerald-100/60 mb-12 italic uppercase tracking-widest">
              Eligible: All regional residents. Exclusion: Employees of PMA LLC are not eligible for this giveaway.
            </p>
            <div className="flex flex-wrap justify-center gap-6">
              <Link to="/community" className="px-12 py-5 bg-white text-emerald-900 rounded-3xl font-bold hover:bg-emerald-50 hover:scale-105 hover:shadow-xl hover:shadow-white/20 transition-all shadow-2xl shadow-emerald-950/20 active:scale-95">
                Explore Community Hub
              </Link>
              <Link to="/driver" className="px-12 py-5 bg-white/20 backdrop-blur-xl border border-white/30 text-white rounded-3xl font-bold hover:bg-white hover:text-emerald-900 transition-all active:scale-95">
                Join our Logistics Force
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Founder's Message Section */}
      <section className="mt-20 px-4 max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-12 items-center bg-emerald-50 rounded-[48px] p-8 lg:p-16 border border-emerald-100 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-100/50 rounded-full blur-3xl -mr-32 -mt-32"></div>
          <div className="relative z-10">
             <div className="w-16 h-16 bg-emerald-600 rounded-2xl overflow-hidden mb-6 shadow-lg">
                <img src="https://artifact.m68.us/api/v1/artifacts/093ebf4a-9775-430c-8d19-4cb5030460a8" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
             </div>
             <h2 className="text-3xl lg:text-4xl font-bold mb-6 tracking-tight text-emerald-900">The Founder's Resolve</h2>
             <p className="text-gray-700 text-lg leading-relaxed mb-6 italic">
               "I've spent a large portion of my life taking—taking opportunities, taking space, taking from others. But there comes a point where you realize that a life of accumulation is a life of emptiness. I've decided to dedicate the rest of my years to giving back. Phoenix Express isn't just a logistics company; it's the engine for the community projects I'm now committed to providing for the elderly, the poor, and the disabled in our region. We aren't just moving packages; we're moving resources to where they are needed most."
             </p>
             <p className="font-bold text-emerald-900">— Founder, Phoenix Express</p>
             <Link to="/community" className="mt-8 inline-flex items-center gap-2 text-emerald-600 font-bold hover:gap-3 transition-all">
               Visit the Community Hub <ChevronRight size={20} />
             </Link>
          </div>
          <div className="grid grid-cols-2 gap-4">
             <div className="space-y-4">
                <div className="aspect-square rounded-3xl overflow-hidden shadow-xl">
                   <img src="https://artifact.m68.us/api/v1/artifacts/093ebf4a-9775-430c-8d19-4cb5030460a8" alt="Founder Portrait" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                </div>
                <div className="p-6 bg-white rounded-3xl border border-emerald-100 shadow-sm">
                   <p className="text-2xl font-bold text-emerald-600 mb-1">12+</p>
                   <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Active Projects</p>
                </div>
             </div>
             <div className="space-y-4 pt-12">
                <div className="p-6 bg-emerald-600 text-white rounded-3xl shadow-xl shadow-emerald-900/20">
                   <p className="text-2xl font-bold mb-1">$400k</p>
                   <p className="text-[10px] font-bold text-emerald-100 uppercase tracking-widest font-mono">Neighborhood Fund</p>
                </div>
                <div className="aspect-square rounded-3xl overflow-hidden shadow-xl">
                   <img src="https://artifact.m68.us/api/v1/artifacts/6504a796-788c-4467-bc85-6bb9a4448554" alt="Community Support" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                </div>
             </div>
          </div>
        </div>
      </section>

      {/* Featured Merchants */}
      <section className="px-4 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
            Regional Logistics & Food <Bird size={24} className="text-emerald-600 fill-current" />
          </h2>
          <Link to="/search" className="text-sm font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 group">
            View All <ChevronRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {demoMerchants.map((merchant, idx) => (
            <MerchantCard key={merchant.id} merchant={merchant} idx={idx} />
          ))}
        </div>
      </section>

      {/* Phoenix Express Special Section */}
      <section className="mt-16 px-4 max-w-4xl mx-auto">
        <div className="bg-gray-900 rounded-3xl p-8 lg:p-12 text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-600 rounded-full -mr-12 -mt-12 opacity-20"></div>
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-emerald-600 rounded-full -ml-16 -mb-16 opacity-10"></div>
          
          <div className="relative z-10">
            <h2 className="text-2xl lg:text-3xl font-bold text-white mb-4">Master the Roads</h2>
            <p className="text-gray-400 mb-8 max-w-lg mx-auto">
              Join the Phoenix Express logistics network as a professional courier or aggregate hauler. 
            </p>
            <Link to="/driver" className="px-10 py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-500 transition-colors shadow-lg shadow-emerald-900/20 active:scale-95 inline-block">
              Become a Driver
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [hasInteracted, setHasInteracted] = useState(false);

  const addToCart = (item: MenuItem, merchantId: string) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { ...item, quantity: 1, merchantId }];
    });
    setIsCartOpen(true);
  };

  const removeFromCart = (itemId: string) => {
    setCart(prev => prev.filter(i => i.id !== itemId));
  };

  const updateQuantity = (itemId: string, delta: number) => {
    setCart(prev => prev.map(i => {
      if (i.id === itemId) {
        const newQty = Math.max(1, i.quantity + delta);
        return { ...i, quantity: newQty };
      }
      return i;
    }));
  };

  useEffect(() => {
    const handleInteraction = () => {
      setHasInteracted(true);
      window.removeEventListener('click', handleInteraction);
    };
    window.addEventListener('click', handleInteraction);
    return () => window.removeEventListener('click', handleInteraction);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) {
        const userRef = doc(db, 'users', u.uid);
        // Direct listener for profile changes
        const unsubProfile = onSnapshot(userRef, (docSnap) => {
          if (docSnap.exists()) {
            setProfile(docSnap.data() as UserProfile);
          } else {
            const newProfile = {
              uid: u.uid,
              email: u.email || '',
              displayName: u.displayName || '',
              photoURL: u.photoURL || '',
              role: 'customer',
              createdAt: new Date().toISOString()
            };
            setDoc(userRef, newProfile);
            setProfile(newProfile);
          }
        });
        return () => unsubProfile();
      } else {
        setProfile(null);
      }
    });
    return () => unsubscribe();
  }, []);

  return (
    <Router>
      <div className="min-h-screen bg-white font-sans text-gray-900 selection:bg-emerald-100 selection:text-emerald-900">
        <Navbar user={user} profile={profile} cart={cart} toggleCart={() => setIsCartOpen(!isCartOpen)} />
        <PhoenixPulse user={user} />
        <PhoenixAI />
        <MusicPlayer startSignal={hasInteracted} user={user} />
        
        <main>
          <Routes>
            <Route path="/" element={<Home user={user} />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/driver" element={<DriverLanding user={user} />} />
            <Route path="/driver/dashboard" element={<DriverDashboard user={user} />} />
            <Route path="/community" element={<CommunityImpactHub user={user} />} />
            <Route path="/track/:id" element={<OrderTracking user={user} />} />
            <Route path="/profile" element={<Profile user={user} />} />
            <Route path="/merchant/:id" element={<MerchantPage user={user} addToCart={addToCart} />} />
          </Routes>
        </main>

        {/* Footer */}
        <footer className="mt-20 border-t border-gray-100 pt-16 pb-8 px-4 bg-gray-50">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
              <div className="col-span-2">
                <Link to="/" className="flex items-center gap-2 mb-6">
                  <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
                    <Bird className="text-white fill-current" size={16} />
                  </div>
                  <span className="text-lg font-bold tracking-tight text-gray-900">Phoenix Express</span>
                </Link>
                <p className="text-gray-500 max-w-sm leading-relaxed text-sm">
                  Precision logistics and high-speed delivery in Eugene and Santa Clara. We bridge the gap between regional business and local needs.
                </p>
              </div>
              <div>
                <h4 className="font-bold mb-6 text-sm uppercase tracking-widest text-gray-400">Services</h4>
                <ul className="space-y-4 text-sm text-gray-600 font-medium">
                  <li><Link to="/search" className="hover:text-emerald-600 transition-colors">Marketplace</Link></li>
                  <li><Link to="/search" className="hover:text-emerald-600 transition-colors">Logistics</Link></li>
                  <li><Link to="/community" className="hover:text-emerald-600 transition-colors">Community Hub</Link></li>
                </ul>
              </div>
              <div>
                <h4 className="font-bold mb-6 text-sm uppercase tracking-widest text-gray-400">Work with Us</h4>
                <ul className="space-y-4 text-sm text-gray-600 font-medium">
                  <li><Link to="/community" className="hover:text-emerald-600 transition-colors">Business Partners</Link></li>
                  <li><Link to="/driver" className="hover:text-emerald-600 transition-colors">Become a Driver</Link></li>
                </ul>
              </div>
            </div>
            <div className="flex flex-col md:flex-row items-center justify-between pt-8 border-t border-gray-200 gap-4">
              <p className="text-xs text-gray-400">© 2026 Phoenix Express Logistics LLC. Eugene, OR.</p>
              <div className="flex gap-6 text-xs text-gray-400 font-medium">
                <Link to="/privacy" className="hover:text-gray-600">Privacy Policy</Link>
                <Link to="/terms" className="hover:text-gray-600">Terms of Service</Link>
              </div>
            </div>
          </div>
        </footer>

        {/* Global Cart Overlay */}
        <AnimatePresence>
          {isCartOpen && (
            <div className="fixed inset-0 z-[100] flex justify-end">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsCartOpen(false)}
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col"
              >
                <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-white shadow-lg">
                      <ShoppingCart size={20} />
                    </div>
                    <div>
                      <h2 className="text-lg font-black italic uppercase tracking-tighter">Your Manifest</h2>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none">Eugene Sector Hub</p>
                    </div>
                  </div>
                  <button onClick={() => setIsCartOpen(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                    <X size={20} />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                  {cart.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                      <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                        <Package size={32} className="text-gray-300" />
                      </div>
                      <h3 className="text-lg font-bold mb-2">Cart is empty</h3>
                      <p className="text-gray-500 text-sm mb-6">Looks like you haven't added anything yet.</p>
                      <button 
                        onClick={() => setIsCartOpen(false)}
                        className="px-8 py-3 bg-emerald-500 text-white rounded-xl font-bold shadow-lg shadow-emerald-100 active:scale-95"
                      >
                        Start Shopping
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {cart.map((item) => (
                        <div key={item.id} className="flex gap-4 group">
                          <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-gray-100">
                            <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-gray-900 truncate text-sm mb-1">{item.name}</h4>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3 bg-gray-50 rounded-lg p-1 px-2 border border-gray-100">
                                <button onClick={() => updateQuantity(item.id, -1)} className="text-gray-400 hover:text-emerald-500">
                                  <List size={14} />
                                </button>
                                <span className="text-xs font-bold w-4 text-center">{item.quantity}</span>
                                <button onClick={() => updateQuantity(item.id, 1)} className="text-gray-400 hover:text-emerald-500">
                                  <Zap size={14} />
                                </button>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-black text-gray-900">${(item.price * item.quantity).toFixed(2)}</p>
                                <button 
                                  onClick={() => removeFromCart(item.id)}
                                  className="text-[9px] font-bold text-red-400 uppercase tracking-widest hover:text-red-500"
                                >
                                  Remove
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {cart.length > 0 && (
                  <div className="p-6 border-t border-gray-100 bg-gray-50/50 space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Subtotal</span>
                        <span className="font-bold text-gray-900">
                          ${cart.reduce((acc, i) => acc + (i.price * i.quantity), 0).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm items-center">
                        <span className="text-gray-500 flex items-center gap-2">
                          Delivery Logistics
                          <div className="px-2 py-0.5 bg-emerald-50 text-[10px] font-bold text-emerald-600 rounded-full border border-emerald-100">
                            {(cart.length > 0 ? getDistance(44.0521, -123.0868, demoMerchants.find(m => m.id === cart[0].merchantId)?.coords?.lat || 44.0521, demoMerchants.find(m => m.id === cart[0].merchantId)?.coords?.lng || -123.0868).toFixed(1) : 0)} km
                          </div>
                        </span>
                        <span className="font-bold text-emerald-600">
                          ${calculateDeliveryFee(cart.length > 0 ? getDistance(44.0521, -123.0868, demoMerchants.find(m => m.id === cart[0].merchantId)?.coords?.lat || 44.0521, demoMerchants.find(m => m.id === cart[0].merchantId)?.coords?.lng || -123.0868) : 0).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Phoenix Service Fee</span>
                        <span className="font-bold text-gray-900">
                          ${(cart.reduce((acc, i) => acc + (i.price * i.quantity), 0) * 0.05).toFixed(2)}
                        </span>
                      </div>
                    </div>
                    <div className="pt-4 border-t border-gray-100 flex justify-between items-center mb-6">
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">TOTAL AUTHORIZATION</p>
                        <p className="text-2xl font-black italic text-gray-950 tracking-tighter">
                          ${(
                            cart.reduce((acc, i) => acc + (i.price * i.quantity), 0) + 
                            calculateDeliveryFee(getDistance(44.0521, -123.0868, demoMerchants.find(m => m.id === cart[0].merchantId)?.coords?.lat || 44.0521, demoMerchants.find(m => m.id === cart[0].merchantId)?.coords?.lng || -123.0868)) +
                            (cart.reduce((acc, i) => acc + (i.price * i.quantity), 0) * 0.05)
                          ).toFixed(2)}
                        </p>
                      </div>
                      <div className="bg-emerald-500/10 p-2 rounded-xl">
                        <Zap className="text-emerald-500 animate-pulse" size={24} />
                      </div>
                    </div>
                    <button 
                      onClick={async () => {
                        if (!user) {
                          signInWithPopup(auth, new GoogleAuthProvider());
                          return;
                        }
                        const firstMerchantId = cart[0].merchantId;
                        const firstMerchant = demoMerchants.find(m => m.id === firstMerchantId);
                        const orderData: Order = {
                          id: `ORD-${Math.floor(1000 + Math.random() * 9000)}`,
                          status: 'pending',
                          merchantId: firstMerchantId,
                          customerId: user.uid,
                          total: cart.reduce((acc, i) => acc + (i.price * i.quantity), 0) + 
                                calculateDeliveryFee(getDistance(44.0521, -123.0868, firstMerchant?.coords?.lat || 44.0521, firstMerchant?.coords?.lng || -123.0868)) +
                                (cart.reduce((acc, i) => acc + (i.price * i.quantity), 0) * 0.05),
                          items: cart,
                          currentLocation: firstMerchant?.coords
                        };
                        try {
                          await setDoc(doc(db, 'orders', orderData.id), orderData);
                          setCart([]);
                          setIsCartOpen(false);
                          window.location.href = `/track/${orderData.id}`;
                        } catch (e) {
                          console.error(e);
                        }
                      }}
                      className="w-full py-5 bg-gray-950 text-white rounded-3xl font-black text-xs uppercase tracking-[0.2em] hover:bg-emerald-500 transition-all shadow-2xl active:scale-95"
                    >
                      Initialize High-Speed Delivery
                    </button>
                  </div>
                )}
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </Router>
  );
}
