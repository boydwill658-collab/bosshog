import React, { useState, useEffect, useRef, FormEvent } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ShoppingCart, MapPin, Star, Zap, ChevronRight, Package, X, Menu, LogIn, Search, User as UserIcon, Save, CheckCircle2, AlertCircle, Truck, Clock, ShieldCheck, Ticket, ExternalLink, Navigation, Send, MessageSquare, Bird, Flame, Car, Bike, DollarSign, BarChart3, List, Check, Camera, Image as ImageIcon, Heart } from 'lucide-react';
import { auth, db } from './lib/firebase';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, onSnapshot, collection, query, orderBy, addDoc, serverTimestamp, where, arrayUnion } from 'firebase/firestore';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';

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

interface Merchant {
  id: string;
  name: string;
  category: string;
  rating: number;
  deliveryTime: string;
  image: string;
  description: string;
  ratings?: Rating[];
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
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.1 }}
      className="group bg-white rounded-3xl overflow-hidden border border-gray-100 hover:border-emerald-100 hover:shadow-2xl hover:shadow-emerald-100 transition-all cursor-pointer"
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
            <p className="text-xs text-gray-500">{merchant.category} • Free Delivery</p>
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
  <div className="w-12 h-12 bg-black rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 shadow-xl overflow-hidden relative">
    <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/30 via-emerald-500/10 to-transparent"></div>
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

const Navbar = ({ user, profile, toggleCart }: { user: any; profile: UserProfile | null; toggleCart: () => void }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

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
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 group">
          <Logo />
          <span className="text-xl font-bold tracking-tight text-gray-900">Phoenix Express</span>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-8">
          <Link to="/search" className="p-2 text-gray-600 hover:text-emerald-500 transition-colors">
            <Search size={22} />
          </Link>
          <div className="flex items-center gap-2 text-gray-600 hover:text-emerald-500 cursor-pointer transition-colors text-sm font-medium">
            <MapPin size={18} />
            <span>Eugene, OR</span>
          </div>
          <div className="flex items-center gap-4">
            {user ? (
              <div className="flex items-center gap-4">
                {profile?.role === 'driver' && (
                  <Link 
                    to="/driver/dashboard" 
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-xl text-xs font-bold hover:bg-emerald-600 transition-all shadow-sm"
                  >
                    <BarChart3 size={16} />
                    Driver Hub
                  </Link>
                )}
                <button 
                  onClick={toggleCart}
                  className="p-2 text-gray-600 hover:text-emerald-500 transition-colors relative"
                >
                  <ShoppingCart size={22} />
                  <span className="absolute -top-1 -right-1 bg-emerald-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center border-2 border-white">
                    2
                  </span>
                </button>
                <Link to="/profile" className="flex items-center gap-2 p-1 pr-3 bg-gray-50 rounded-full hover:bg-gray-100 transition-colors">
                  <img src={user.photoURL} alt="Profile" className="w-8 h-8 rounded-full border border-gray-200" />
                  <span className="text-sm font-medium text-gray-700">{user.displayName?.split(' ')[0]}</span>
                </Link>
                <button onClick={handleLogout} className="text-sm text-gray-500 hover:text-red-500">Logout</button>
              </div>
            ) : (
              <button 
                onClick={handleLogin}
                className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white rounded-full font-medium hover:bg-gray-800 transition-all hover:shadow-lg active:scale-95"
              >
                <LogIn size={18} />
                Sign In
              </button>
            )}
          </div>
        </div>

        {/* Mobile Nav Toggle */}
        <div className="hidden md:flex gap-6 mr-8">
          <Link to="/community" className="text-sm font-bold text-gray-500 hover:text-emerald-600 transition-colors uppercase tracking-widest">Community Hub</Link>
          <Link to="/community" className="text-sm font-bold text-gray-500 hover:text-emerald-600 transition-colors uppercase tracking-widest">Band Giveaway</Link>
        </div>
        <button className="md:hidden p-2" onClick={() => setIsMenuOpen(!isMenuOpen)}>
          {isMenuOpen ? <X /> : <Menu />}
        </button>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-16 left-0 right-0 bg-white border-b border-gray-100 p-4 md:hidden shadow-xl"
          >
           <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2 text-gray-600 py-2 border-b border-gray-50">
                <MapPin size={18} />
                <span className="text-sm">Eugene, OR</span>
              </div>
              {user ? (
                <>
                  <Link to="/profile" onClick={() => setIsMenuOpen(false)} className="py-2 text-gray-900 font-medium tracking-tight">Profile</Link>
                  <button onClick={toggleCart} className="py-2 text-gray-900 font-medium tracking-tight text-left flex justify-between items-center">
                    <span>Your Cart</span>
                    <span className="bg-emerald-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">2 items</span>
                  </button>
                  <button onClick={handleLogout} className="py-2 text-red-500 font-medium tracking-tight text-left">Logout</button>
                </>
              ) : (
                <button onClick={handleLogin} className="w-full py-3 bg-gray-900 text-white rounded-xl font-medium">Sign In with Google</button>
              )}
           </div>
          </motion.div>
        )}
      </AnimatePresence>
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
                  className={`flex items-center gap-2 px-8 py-3.5 rounded-2xl font-bold transition-all active:scale-95 shadow-lg ${
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
                  className={`relative py-4 px-2 rounded-2xl border-2 font-bold capitalize transition-all flex flex-col items-center gap-2 group overflow-hidden ${
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
                  className="px-10 py-4 bg-emerald-600 text-white rounded-2xl font-bold text-lg hover:bg-emerald-500 transition-all shadow-xl shadow-emerald-900/40"
                >
                  Register Now
                </button>
                <button className="px-10 py-4 bg-white/10 hover:bg-white/20 transition-all rounded-2xl font-bold text-lg backdrop-blur">
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

const OrderTracking = ({ user }: { user: any }) => {
  const { id } = useParams();
  const [order, setOrder] = useState<Order | null>(null);
  const [eta, setEta] = useState(12);

  useEffect(() => {
    // Simulate real-time tracking
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
        return {
          ...prev,
          currentLocation: { lat: newLat, lng: newLng },
          status: eta < 5 ? 'out-for-delivery' : 'preparing'
        };
      });
    }, 3000);

    return () => clearInterval(interval);
  }, [id, eta]);

  if (!order) return null;

  return (
    <div className="pt-24 pb-12 px-4 max-w-7xl mx-auto min-h-screen">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-4xl font-bold tracking-tight mb-2">Live Tracking</h1>
          <p className="text-gray-500 font-medium">Order ID: <span className="text-emerald-600">#{order.id}</span></p>
        </div>
        <div className="bg-emerald-50 px-8 py-4 rounded-[32px] border border-emerald-100 flex items-center gap-6">
          <div className="text-right">
            <p className="text-[10px] font-bold text-emerald-600/60 uppercase tracking-widest mb-1">Estimated Arrival</p>
            <div className="text-3xl font-bold text-emerald-600 flex items-center gap-2">
              <Clock size={24} /> {eta} mins
            </div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          {/* Real Leaflet Map */}
          <div className="relative h-[500px] bg-gray-100 rounded-[40px] overflow-hidden border-4 border-white shadow-2xl">
            <MapContainer center={[44.0521, -123.0868]} zoom={15} scrollWheelZoom={false} className="h-full w-full">
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {order.currentLocation && (
                <>
                  <Marker position={[44.0521, -123.0868]} icon={merchantIcon}>
                    <Popup>
                      <div className="font-bold">Merchant Location</div>
                      <div className="text-xs text-gray-500">Pick-up Hub</div>
                    </Popup>
                  </Marker>
                  <Marker position={[44.0621, -123.0968]} icon={customerIcon}>
                    <Popup>
                      <div className="font-bold">Your Location</div>
                      <div className="text-xs text-gray-500">Delivery point</div>
                    </Popup>
                  </Marker>
                  <Marker position={[order.currentLocation.lat, order.currentLocation.lng]} icon={driverIcon}>
                    <Popup>
                      <div className="font-bold">Phoenix Driver</div>
                      <div className="text-xs text-gray-500">Approaching your location</div>
                    </Popup>
                  </Marker>
                  <RecenterMap lat={order.currentLocation.lat} lng={order.currentLocation.lng} />
                </>
              )}
            </MapContainer>

            {/* Floating Driver Info */}
            <div className="absolute bottom-6 left-6 right-6 z-[1000] bg-white/95 backdrop-blur p-5 rounded-[32px] flex items-center gap-4 shadow-2xl border border-white/40">
              <div className="w-14 h-14 bg-gray-900 rounded-2xl flex items-center justify-center text-emerald-500 shadow-lg">
                <Truck size={30} />
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">En Route</p>
                <p className="font-bold text-lg">Alex R. <span className="text-gray-400 font-normal text-sm ml-2">Toyota RAV4 (ZPH-922)</span></p>
              </div>
              <div className="ml-auto flex gap-2">
                <button className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center hover:bg-emerald-200 transition-colors">
                  <Navigation size={20} />
                </button>
                <button className="px-6 py-3 bg-gray-900 text-white rounded-2xl text-sm font-bold hover:bg-gray-800 transition-all active:scale-95">
                  Call
                </button>
              </div>
            </div>
          </div>

          {/* Steps */}
          <div className="bg-white p-8 rounded-[40px] border border-gray-100 shadow-xl">
            <div className="flex flex-col gap-8">
              {[
                { label: 'Order Confirmed', time: '12:05 PM', done: true },
                { label: 'Preparing Items', time: '12:15 PM', done: order.status !== 'pending' },
                { label: 'Out for Delivery', time: '--:--', done: order.status === 'out-for-delivery' },
                { label: 'Arrived', time: '--:--', done: order.status === 'delivered' }
              ].map((step, idx) => (
                <div key={idx} className="flex gap-4 items-start relative">
                  {idx !== 3 && (
                    <div className={`absolute top-8 left-4 w-0.5 h-full -ml-[1px] ${step.done ? 'bg-emerald-600' : 'bg-gray-100'}`}></div>
                  )}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center z-10 transition-colors ${step.done ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-300'}`}>
                    <CheckCircle2 size={16} />
                  </div>
                  <div className="flex-1 pb-4">
                    <p className={`font-bold ${step.done ? 'text-gray-900' : 'text-gray-300'}`}>{step.label}</p>
                    <p className="text-xs text-gray-400 font-medium tracking-wide">{step.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-1 space-y-8">
          <Chat orderId={order.id} user={user} />
          
          <div className="bg-gray-50 p-8 rounded-[40px] border border-gray-100 flex flex-col">
            <h3 className="text-xl font-bold mb-6 text-gray-900">Delivery Details</h3>
            <div className="space-y-4 mb-8">
               <div className="bg-white p-5 rounded-2xl shadow-sm border border-emerald-50">
                  <p className="text-[10px] font-bold text-emerald-600/60 uppercase tracking-widest mb-1">Destination</p>
                  <p className="text-sm font-semibold leading-relaxed text-gray-800">123 Pine St, Apt 4B<br />Eugene, OR 97401</p>
               </div>
               <div className="bg-white p-5 rounded-2xl shadow-sm">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Items</p>
                  <p className="text-xs font-bold text-gray-600">Urban Greens Bundle (x1)</p>
               </div>
            </div>
            <div className="mt-auto pt-6 border-t border-gray-200">
               <p className="text-xs text-gray-500 mb-4 italic">Need help with your order? Our Eugene logistics hub is standing by.</p>
               <button className="w-full py-4 bg-gray-900 text-white rounded-2xl font-bold hover:bg-gray-800 transition-colors shadow-lg active:scale-95">
                 Support Center
               </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
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
    <div className="pt-24 pb-12 px-4 max-w-7xl mx-auto min-h-screen">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-12 gap-4">
        <div>
          <h1 className="text-4xl font-bold tracking-tight mb-2">Driver Dashboard</h1>
          <p className="text-gray-500 flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full"></span> Active Session • {user.displayName}
          </p>
        </div>
        <div className="flex flex-wrap gap-4">
           <div className="bg-white px-6 py-3 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                <DollarSign size={20} />
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Lifetime Earnings</p>
                <p className="text-xl font-bold text-gray-900">${totalEarnings.toFixed(2)}</p>
              </div>
           </div>

           <div className="bg-gray-50 p-1 rounded-2xl border border-gray-200 flex">
              {(['daily', 'weekly', 'monthly'] as const).map((range) => (
                <button
                  key={range}
                  onClick={() => setEarningsRange(range)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${
                    earningsRange === range 
                      ? 'bg-white text-emerald-600 shadow-sm' 
                      : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  {range}
                </button>
              ))}
           </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-8 mb-12">
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-8 rounded-[40px] border border-gray-100 shadow-xl">
             <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
               <DollarSign className="text-emerald-500" size={24} /> Range Earnings
             </h3>
             <div className="space-y-2">
                <p className="text-4xl font-bold tracking-tight text-gray-900">${stats.earnings.toFixed(2)}</p>
                <p className="text-sm font-medium text-gray-500">{stats.count} completed deliveries</p>
             </div>
             <div className="mt-8 pt-8 border-t border-gray-50">
                <div className="flex justify-between items-center mb-4">
                   <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Payout Status</p>
                   <span className="px-2 py-1 bg-emerald-50 text-emerald-600 text-[10px] font-bold rounded-md">Pending</span>
                </div>
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                   <div className="h-full bg-emerald-500 w-2/3"></div>
                </div>
             </div>
          </div>

          <div className="bg-white p-8 rounded-[40px] border border-gray-100 shadow-xl">
             <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
               <BarChart3 className="text-emerald-500" size={24} /> Performance
             </h3>
             <div className="space-y-6">
                <div className="flex justify-between items-end border-b border-gray-50 pb-4">
                   <div>
                      <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-1">Total Deliveries</p>
                      <p className="text-3xl font-bold">{completedOrders.length}</p>
                   </div>
                   <div className="text-right">
                      <p className="text-emerald-500 text-xs font-bold">+12%</p>
                      <p className="text-[10px] text-gray-400 uppercase tracking-widest">Growth</p>
                   </div>
                </div>
                <div>
                   <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-3">Recent Activity</p>
                   <div className="space-y-4">
                      {completedOrders.slice(0, 3).map(order => (
                        <div key={order.id} className="flex items-center gap-3">
                           <div className="w-8 h-8 bg-gray-50 rounded-lg flex items-center justify-center text-gray-400">
                              <CheckCircle2 size={16} />
                           </div>
                           <div className="flex-1">
                              <p className="text-sm font-bold truncate">#{order.id}</p>
                              <p className="text-[10px] text-gray-400">Delivered successfully</p>
                           </div>
                           <p className="text-sm font-bold text-emerald-600">+${(order.total * 0.15).toFixed(2)}</p>
                        </div>
                      ))}
                   </div>
                </div>
             </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-8">
           <div className="flex items-center justify-between">
              <h3 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                Active Orders <span className="bg-emerald-500 text-white text-xs px-2 py-0.5 rounded-full">{activeOrders.length}</span>
              </h3>
              <button className="text-sm font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1">
                View History <ChevronRight size={16} />
              </button>
           </div>

           {activeOrders.length === 0 ? (
             <div className="bg-gray-50 border-2 border-dashed border-gray-100 rounded-[40px] p-20 text-center">
                <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
                   <Truck className="text-gray-300" size={40} />
                </div>
                <h4 className="text-xl font-bold text-gray-900 mb-2">No active deliveries</h4>
                <p className="text-gray-500 max-w-xs mx-auto">Toggle your status to online to start receiving regional aggregate and meal orders.</p>
                <button className="mt-8 px-10 py-4 bg-emerald-600 text-white rounded-2xl font-bold shadow-lg shadow-emerald-900/20 active:scale-95">
                  Go Online
                </button>
             </div>
           ) : (
             <div className="grid gap-6">
                {activeOrders.map(order => (
                  <motion.div 
                    layout
                    key={order.id}
                    className="bg-white p-8 rounded-[40px] border border-gray-100 shadow-xl flex flex-col md:flex-row md:items-center gap-8 relative overflow-hidden group"
                  >
                    <div className="absolute top-0 right-0 w-24 h-full bg-emerald-50 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <div className="relative z-10 flex-1">
                      <div className="flex items-center gap-3 mb-4">
                        <span className="px-3 py-1 bg-gray-900 text-white text-[10px] font-bold uppercase tracking-widest rounded-lg">Order #{order.id}</span>
                        <span className="px-3 py-1 bg-emerald-100 text-emerald-600 text-[10px] font-bold uppercase tracking-widest rounded-lg">{order.status}</span>
                      </div>
                      <h4 className="text-2xl font-bold mb-2">Regional Pickup</h4>
                      <div className="flex items-center gap-4 text-gray-500 text-sm">
                         <div className="flex items-center gap-1">
                            <MapPin size={16} className="text-emerald-500" />
                            <span>Santa Clara Hub</span>
                         </div>
                         <span>•</span>
                         <div className="flex items-center gap-1">
                            <Clock size={16} className="text-emerald-500" />
                            <span>12-15 mins</span>
                         </div>
                      </div>
                    </div>
                    <div className="relative z-10 flex gap-3">
                      <Link 
                        to={`/track/${order.id}`}
                        className="px-8 py-4 bg-gray-900 text-white rounded-2xl font-bold hover:bg-gray-800 transition-all flex items-center gap-2"
                      >
                        Navigate <Navigation size={18} />
                      </Link>
                      <button className="w-14 h-14 bg-gray-50 text-gray-900 rounded-2xl flex items-center justify-center hover:bg-emerald-50 hover:text-emerald-600 transition-all">
                        <MessageSquare size={22} />
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

const SearchPage = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async (e: FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    
    setIsSearching(true);
    // In a real app, this would call a backend API that searches Drive/Files
    // For now, we simulate finding the project they mentioned
    setTimeout(() => {
      if (query.toLowerCase().includes('phoenix')) {
        setResults([
          { 
            id: 'px-1', 
            name: "Phoenix Express V1 (Mobile)", 
            type: "Source Code", 
            location: "Google Drive / Projects", 
            description: "Initial prototype of the delivery logistics engine built for Eugene, OR region." 
          },
          { 
            id: 'px-2', 
            name: "Phoenix Express Assets", 
            type: "Folder", 
            location: "Google Drive / Design", 
            description: "High-resolution logos, brand guidelines, and UI mockups for the Phoenix Express mobile app." 
          }
        ]);
      } else {
        setResults([]);
      }
      setIsSearching(false);
    }, 1500);
  };

  return (
    <div className="pt-24 pb-12 px-4 max-w-4xl mx-auto min-h-screen">
      <h1 className="text-3xl font-bold mb-8">Asset Search</h1>
      <form onSubmit={handleSearch} className="mb-12">
        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-emerald-500 transition-colors" size={24} />
          <input 
            type="text" 
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your drive for projects (e.g. 'phoenix express')..." 
            className="w-full h-16 pl-14 pr-6 bg-white rounded-3xl text-lg text-gray-900 border-2 border-gray-100 focus:border-emerald-500 shadow-xl shadow-gray-100 outline-none transition-all"
          />
        </div>
      </form>

      {isSearching ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full"
          />
          <p className="text-gray-500 font-medium animate-pulse">Searching your connected accounts...</p>
        </div>
      ) : results.length > 0 ? (
        <div className="space-y-4">
          <p className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-6">Results from your Drive</p>
          {results.map((res, idx) => (
            <motion.div 
              key={res.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="bg-white p-6 rounded-3xl border border-gray-100 hover:border-emerald-200 transition-all shadow-sm hover:shadow-lg flex items-start gap-4 group"
            >
              <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                <Package size={24} />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-bold text-gray-900">{res.name}</h3>
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-gray-100 text-gray-600 px-2 py-1 rounded-md">{res.type}</span>
                </div>
                <p className="text-sm text-gray-500 mb-2">{res.description}</p>
                <div className="flex items-center gap-1 text-xs text-emerald-600 font-bold bg-emerald-50 w-fit px-2 py-1 rounded-full cursor-pointer hover:bg-emerald-100">
                  <MapPin size={12} />
                  {res.location}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      ) : query && !isSearching ? (
        <div className="text-center py-20 px-8 bg-gray-50 rounded-[40px] border-2 border-dashed border-gray-100">
          <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
            <Search className="text-gray-300" size={32} />
          </div>
          <h3 className="text-xl font-bold mb-2 text-gray-900">No projects found</h3>
          <p className="text-gray-500 text-sm max-w-xs mx-auto">We couldn't find any assets matching "{query}" in your connected drive.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 opacity-60 grayscale hover:grayscale-0 transition-all duration-700">
           <div className="p-8 bg-emerald-50 rounded-3xl border border-emerald-100">
              <h4 className="font-bold text-emerald-900 mb-2">Connected Drive</h4>
              <p className="text-sm text-emerald-800">Your Google Drive is linked. Searching for 'phoenix' will crawl your project folders.</p>
           </div>
           <div className="p-8 bg-gray-50 rounded-3xl border border-gray-100">
              <h4 className="font-bold text-gray-900 mb-2">Build History</h4>
              <p className="text-sm text-gray-600">Quickly find and import assets from your previous delivery app prototypes.</p>
           </div>
        </div>
      )}
    </div>
  );
};

const MerchantPage = ({ user }: { user: any }) => {
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
          <div className="bg-gray-50 p-8 rounded-3xl text-center border-2 border-dashed border-gray-200">
            <Package size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500">Menu for {merchant.name} has not been uploaded yet.</p>
          </div>

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
  { id: '1', name: "Urban Greens", category: "Groceries", rating: 4.8, deliveryTime: "15-25 min", image: "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=800", description: "Fresh organic produce delivered from local farms." },
  { id: '2', name: "Sushi Sensation", category: "Japanese", rating: 4.9, deliveryTime: "20-35 min", image: "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&q=80&w=800", description: "Premium handcrafted sushi and sashimi." },
  { id: '3', name: "The Burger Co.", category: "American", rating: 4.7, deliveryTime: "10-20 min", image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&q=80&w=800", description: "Gourmet wagyu burgers and artisanal fries." },
  { id: '4', name: "Aroma Cafe", category: "Coffee", rating: 4.6, deliveryTime: "5-15 min", image: "https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&q=80&w=800", description: "Single-origin coffee and freshly baked pastries." },
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
          className="flex items-center gap-2 px-8 py-4 bg-gray-900 text-white rounded-2xl font-bold hover:bg-gray-800 transition-all shadow-xl active:scale-95"
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
    <div className="mt-24 space-y-12">
      <div className="flex flex-col md:flex-row items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight mb-2">Neighborhood Makeover Election</h2>
          <p className="text-gray-500">Nominate a neighbor for a $1,000 full-service home cleanup (windows, landscaping, trash removal).</p>
        </div>
        <button 
          onClick={() => setIsNominating(true)}
          className="flex items-center gap-2 px-8 py-4 bg-orange-600 text-white rounded-2xl font-bold hover:bg-orange-700 transition-all shadow-xl active:scale-95"
        >
          <Star size={20} /> Nominate a Neighbor
        </button>
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
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center font-bold text-[10px]">
                  {nomination.nominatorName.charAt(0)}
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 tracking-widest uppercase">Nominated by</p>
                  <p className="text-xs font-bold text-gray-900">{nomination.nominatorName}</p>
                </div>
              </div>
              <button 
                onClick={() => handleVote(nomination.id, nomination.votes)}
                disabled={!user || nomination.votes.includes(user.uid)}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${
                  user && nomination.votes.includes(user.uid)
                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                    : 'bg-gray-900 text-white hover:bg-gray-800'
                } disabled:opacity-50`}
              >
                {user && nomination.votes.includes(user.uid) ? (
                  <> <CheckCircle2 size={16} /> Endorsed</>
                ) : (
                  <> <Heart size={16} /> Endorse</>
                )}
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

const CommunityImpactHub = ({ user }: { user: any }) => {
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
              className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-500 transition-all shadow-xl shadow-emerald-900/20 active:scale-95 disabled:opacity-50"
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

      <MomentsWall user={user} />

      {/* Band Giveaway Section */}
      <div className="mt-24 bg-gray-900 rounded-[48px] p-8 lg:p-16 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl -mr-48 -mt-48"></div>
        <div className="relative z-10 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 rounded-full text-[10px] font-bold uppercase tracking-widest mb-6">
              <Flame size={12} className="text-orange-400" /> Musicians Exclusive
            </div>
            <h2 className="text-3xl lg:text-5xl font-bold mb-6 tracking-tight">Trailer Giveaway for <span className="text-emerald-400">Local Bands.</span></h2>
            <p className="text-gray-400 text-lg mb-8 leading-relaxed">
              We know the struggle of hauling gear to gigs. We're giving away a free <b>5x8 enclosed trailer</b> to one lucky Eugene-area band. Register your band details today and stay tuned for the live drawing.
            </p>
            <div className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/10">
              <div className="w-12 h-12 bg-emerald-600 rounded-xl flex items-center justify-center font-bold">5x8</div>
              <div>
                <p className="font-bold">Heavy-Duty Cargo Trailer</p>
                <p className="text-xs text-gray-400">Custom Phoenix Wrap included</p>
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

const Home = () => {
  return (
    <div className="pt-20 pb-12">
      {/* Hero Section */}
      <section className="px-4 mb-12">
        <div className="max-w-7xl mx-auto bg-gradient-to-br from-emerald-600 to-teal-600 rounded-[32px] overflow-hidden relative shadow-2xl shadow-emerald-200">
          <div className="absolute top-0 right-0 w-1/2 h-full hidden lg:block overflow-hidden">
            {/* The "empty green space" phoenix silhouette */}
            <motion.div
              initial={{ opacity: 0, x: 100, rotate: 10, scale: 0.8 }}
              animate={{ opacity: 0.8, x: 0, rotate: 0, scale: 1 }}
              transition={{ duration: 1.2, delay: 0.3, ease: "easeOut" }}
              className="absolute right-0 top-1/2 -translate-y-1/2 w-[120%] h-full flex items-center justify-center"
            >
              <svg viewBox="0 0 24 24" className="w-[80%] h-[80%] text-gray-900 fill-current drop-shadow-[0_20px_50px_rgba(0,0,0,0.3)]" xmlns="http://www.w3.org/2000/svg">
                {/* Custom sharp phoenix silhouette path */}
                <path d="M12 2C12 2 11 4 10 5C9 6 7 6 6 6C5 6 3 5 2 5C2.5 7 4 8 6 9C7 10 9 10 10 11C10.5 11.5 11 12.5 11 13.5C11 15 10 16 9 17C8 18 7 18 6 18C7 19 8.5 20 10 20C12 20 13.5 19 14.5 17.5C15 16.5 15 15 15 13.5C15 11 16 9 18 8C20 7 22 7 23 7C22 6 20 5 18 5C17 5 15 5 14 6C13 7 12 2 12 2ZM12 8C12.5 8 13 8.5 13 9C13 9.5 12.5 10 12 10C11.5 10 11 9.5 11 9C11 8.5 11.5 8 12 8Z" />
                {/* Adding more detail for "sharpness" */}
                <path d="M14.5 17.5L16 22L18 19L20 21L21 16L14.5 17.5Z" />
                <path d="M2.5 7L1 12L4 10L5 13L7 9L2.5 7Z" />
              </svg>
            </motion.div>
            
            <div className="absolute -top-20 -right-20 w-80 h-80 bg-white/10 rounded-full blur-3xl"></div>
            <div className="absolute bottom-20 right-40 w-40 h-40 bg-white/10 rounded-full blur-2xl"></div>
          </div>
          
          <div className="relative z-10 px-8 py-16 lg:px-16 lg:py-24 max-w-2xl text-white">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 backdrop-blur rounded-full text-[10px] font-bold uppercase tracking-widest mb-6 border border-white/10">
                <Zap size={12} className="text-emerald-300 animate-pulse" /> Spur-of-the-moment Giveaways Live
              </div>
              <h1 className="text-4xl lg:text-7xl font-bold tracking-tight mb-6 leading-[1.1]">
                Phoenix <br /><span className="text-emerald-100 underline decoration-2 decoration-emerald-200 underline-offset-8">Precision.</span> Express delivery.
              </h1>
              <p className="text-lg text-emerald-50/90 mb-10 leading-relaxed max-w-lg">
                The most reliable logistics network in the Santa Clara & Eugene region. From local meals to professional aggregate hauling.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1 group">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                  <input 
                    type="text" 
                    placeholder="Search logistics or restaurants..." 
                    className="w-full h-14 pl-12 pr-6 bg-white rounded-2xl text-gray-900 shadow-lg outline-none focus:ring-2 focus:ring-emerald-300 transition-all"
                  />
                </div>
                <button className="h-14 px-8 bg-gray-900 text-white rounded-2xl font-bold hover:bg-gray-800 transition-all shadow-lg active:scale-95">
                  Order Now
                </button>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Concerts & Events Section */}
      <section className="px-4 max-w-7xl mx-auto mb-20">
        <div className="flex items-center justify-between mb-8">
          <div>
             <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2 mb-2">
               Tour Tracker & Local Events <Ticket className="text-emerald-600" size={32} />
             </h2>
             <p className="text-gray-500">Live logistics for Eugene's heavy hitters</p>
          </div>
          <div className="hidden sm:flex gap-2">
             <div className="px-4 py-2 bg-emerald-50 text-emerald-600 rounded-full text-xs font-bold border border-emerald-100">Metal Night</div>
             <div className="px-4 py-2 bg-emerald-50 text-emerald-600 rounded-full text-xs font-bold border border-emerald-100">Live Logistics</div>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
          <motion.div 
            whileHover={{ y: -8 }}
            className="p-8 bg-gray-900 text-white rounded-[40px] relative overflow-hidden group border border-gray-800"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-600/20 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-150"></div>
            <div className="relative z-10 flex flex-col h-full">
              <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 mb-4 block">August 20th • World Tour</span>
              <h3 className="text-2xl font-bold mb-2">Metallica: M72</h3>
              <p className="text-gray-400 text-sm mb-8">Eugene/Portland Regional Hub</p>
              <div className="mt-auto flex items-center justify-between">
                <a href="https://www.metallica.com/tour/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm font-bold text-emerald-500 hover:text-emerald-400 transition-colors">
                  Track Tickets <ExternalLink size={14} />
                </a>
                <div className="flex -space-x-2">
                   {[1,2,3].map(i => (
                     <div key={i} className="w-8 h-8 rounded-full border-2 border-gray-900 bg-gray-700 flex items-center justify-center text-[8px] font-bold">100k+</div>
                   ))}
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div 
            whileHover={{ y: -8 }}
            className="p-8 bg-emerald-50 border border-emerald-100 rounded-[40px] relative overflow-hidden group shadow-sm"
          >
            <div className="relative z-10 flex flex-col h-full">
              <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 mb-4 block">July 12th • McDonald Theatre</span>
              <h3 className="text-2xl font-bold mb-2 text-gray-900">Black Label Society</h3>
              <p className="text-emerald-700/60 text-sm mb-8">Eugene, OR Venue</p>
              <div className="mt-auto">
                <a href="https://blacklabelsociety.com/tour/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-6 py-2 bg-emerald-600 text-white rounded-full text-sm font-bold hover:bg-emerald-700 transition-colors">
                  Track Tour <ExternalLink size={14} />
                </a>
              </div>
            </div>
            <div className="absolute bottom-0 right-0 w-24 h-24 bg-emerald-200/30 rounded-full -mr-8 -mb-8"></div>
          </motion.div>

          <div className="p-8 bg-white border-2 border-dashed border-gray-100 rounded-[40px] flex flex-col items-center justify-center text-center">
             <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mb-4">
                <ShieldCheck className="text-emerald-600" size={32} />
             </div>
            <p className="text-gray-900 text-sm font-bold mb-1">Fan Protection</p>
            <p className="text-xs text-gray-400 font-medium leading-relaxed">Secure logistics for major tour stops in the Pacific Northwest.</p>
          </div>
        </div>
      </section>

      {/* Sweepstakes Section */}
      <section className="px-4 max-w-7xl mx-auto mb-20">
        <div className="relative rounded-[48px] overflow-hidden bg-gray-900 p-8 lg:p-16 text-white border border-white/5">
          <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-emerald-600/20 to-transparent"></div>
          <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl"></div>
          
          <div className="relative z-10 grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-emerald-600 text-white text-[10px] font-bold uppercase tracking-widest rounded-full mb-6">
                <Star size={12} className="fill-current" /> Grand Prize Event
              </div>
              <h2 className="text-4xl lg:text-6xl font-bold mb-6 leading-tight">
                Win a <span className="text-emerald-400">Mansion</span> in Eugene
              </h2>
              <p className="text-lg text-gray-400 mb-8 max-w-md">
                Every delivery you track or driver sign-up earns you an entry to win a premier estate in the Willamette Valley. Plus, stay alert for our <b>spur-of-the-moment surprise giveaways</b> throughout the season!
              </p>
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  alert("You've been entered! Good luck.");
                }}
                className="flex flex-col sm:flex-row gap-4"
              >
                <input 
                  type="email" 
                  required
                  placeholder="Enter your email to enter" 
                  className="flex-1 h-14 px-6 bg-white/5 border border-white/10 rounded-2xl outline-none focus:border-emerald-500 transition-colors"
                />
                <button type="submit" className="h-14 px-10 bg-emerald-500 text-white rounded-2xl font-bold hover:bg-emerald-400 transition-all shadow-lg active:scale-95">
                  Sign Up & Win
                </button>
              </form>
            </div>
            <div className="relative aspect-video lg:aspect-square">
              <img 
                src="https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&q=80&w=1200" 
                alt="Luxury Mansion" 
                className="w-full h-full object-cover rounded-[32px] shadow-2xl"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-gray-900/60 to-transparent rounded-[32px]"></div>
              <div className="absolute bottom-6 left-6 right-6 p-6 bg-white/10 backdrop-blur rounded-2xl border border-white/10">
                <p className="text-xs font-bold uppercase tracking-widest opacity-60 mb-1">Current Prize Value</p>
                <p className="text-2xl font-bold">$2,450,000.00</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Founder's Message Section */}
      <section className="mt-20 px-4 max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-12 items-center bg-emerald-50 rounded-[48px] p-8 lg:p-16 border border-emerald-100 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-100/50 rounded-full blur-3xl -mr-32 -mt-32"></div>
          <div className="relative z-10">
             <div className="w-16 h-16 bg-emerald-600 text-white rounded-2xl flex items-center justify-center mb-6 shadow-lg">
                <UserIcon size={32} />
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
                   <img src="https://images.unsplash.com/photo-1541888941259-7a1955d8c430?auto=format&fit=crop&q=80&w=600" alt="Construction" className="w-full h-full object-cover" />
                </div>
                <div className="p-6 bg-white rounded-3xl border border-emerald-100 shadow-sm">
                   <p className="text-2xl font-bold text-emerald-600 mb-1">12+</p>
                   <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Active Projects</p>
                </div>
             </div>
             <div className="space-y-4 pt-12">
                <div className="p-6 bg-emerald-600 text-white rounded-3xl shadow-xl shadow-emerald-900/20">
                   <p className="text-2xl font-bold mb-1">$2.4M</p>
                   <p className="text-[10px] font-bold text-emerald-100 uppercase tracking-widest">Est. Impact Value</p>
                </div>
                <div className="aspect-square rounded-3xl overflow-hidden shadow-xl">
                   <img src="https://images.unsplash.com/photo-1464931084227-28f7422f281e?auto=format&fit=crop&q=80&w=600" alt="Helping hand" className="w-full h-full object-cover" />
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
          <button className="text-sm font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 group">
            View All <ChevronRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
          </button>
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
        <Navbar user={user} profile={profile} toggleCart={() => setIsCartOpen(!isCartOpen)} />
        
        <main>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/driver" element={<DriverLanding user={user} />} />
            <Route path="/driver/dashboard" element={<DriverDashboard user={user} />} />
            <Route path="/community" element={<CommunityImpactHub user={user} />} />
            <Route path="/track/:id" element={<OrderTracking user={user} />} />
            <Route path="/profile" element={<Profile user={user} />} />
            <Route path="/merchant/:id" element={<MerchantPage user={user} />} />
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
                  <li><Link to="/" className="hover:text-emerald-600 transition-colors">Food & Dining</Link></li>
                  <li><Link to="/search" className="hover:text-emerald-600 transition-colors">Asset Search</Link></li>
                  <li><Link to="/about" className="hover:text-emerald-600 transition-colors">Hauling & Logistics</Link></li>
                </ul>
              </div>
              <div>
                <h4 className="font-bold mb-6 text-sm uppercase tracking-widest text-gray-400">Work with Us</h4>
                <ul className="space-y-4 text-sm text-gray-600 font-medium">
                  <li><Link to="/partner" className="hover:text-emerald-600 transition-colors">Business Partners</Link></li>
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
                  <h2 className="text-xl font-bold tracking-tight">Your Order</h2>
                  <button onClick={() => setIsCartOpen(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                    <X size={20} />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center justify-center text-center">
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
                <div className="p-6 border-t border-gray-100 bg-gray-50">
                  <div className="flex justify-between mb-4">
                    <span className="text-sm font-medium text-gray-500">Total</span>
                    <span className="text-lg font-bold">$0.00</span>
                  </div>
                  <button disabled className="w-full py-4 bg-gray-200 text-gray-400 rounded-2xl font-bold cursor-not-allowed">
                    Checkout
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </Router>
  );
}
