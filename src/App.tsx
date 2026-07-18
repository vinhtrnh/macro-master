/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { useSpeechToText } from './useSpeechToText';
import { parseVoiceFoodInput } from './utils';
import { 
  User, 
  Plus, 
  Trash2, 
  Flame, 
  Sparkles, 
  AlertTriangle, 
  CheckCircle2, 
  Calculator, 
  Apple, 
  RotateCcw, 
  Edit2, 
  Scale, 
  Dumbbell, 
  TrendingUp, 
  Heart, 
  Info,
  Activity,
  Award,
  ChevronRight,
  ShieldAlert,
  Moon,
  Calendar,
  Footprints,
  ChevronLeft,
  Check,
  Mic, 
  MicOff,
  Volume2, 
  Loader2,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Profile, FoodItem, LoggedMeal, Goal, ActivityLevel, Gender, FoodCategory } from './types';
import { useTextToSpeech } from './useTextToSpeech';
import { DEFAULT_FOOD_ITEMS, DEFAULT_PROFILES } from './data';
import { 
  calculateQuickMealPlan,
  findFoodByNameInCategory,
  calculateBMR, 
  calculateTDEE, 
  calculateMacros, 
  getAssessment, 
  generateSmartSuggestions,
  ACTIVITY_MULTIPLIERS,
  calculateStepsCalories
} from './utils';

// --- SYNC DATA LÊN SERVER (Upstash Redis qua /api/sync) ---
// Cho phép nhiều thiết bị dùng chung 1 nguồn data, không cần nhập lại tay.
const SYNC_SECRET = (import.meta as any).env?.VITE_SYNC_SECRET || '';

function syncHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (SYNC_SECRET) headers['x-sync-secret'] = SYNC_SECRET;
  return headers;
}

async function fetchCloudData(): Promise<any | null> {
  try {
    const res = await fetch('/api/sync', { headers: syncHeaders() });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.data || null;
  } catch (e) {
    console.warn('[SYNC] Không tải được data từ server, dùng data local.', e);
    return null;
  }
}

async function pushCloudData(payload: any): Promise<void> {
  try {
    await fetch('/api/sync', {
      method: 'POST',
      headers: syncHeaders(),
      body: JSON.stringify(payload),
    });
  } catch (e) {
    console.warn('[SYNC] Không lưu được data lên server, data vẫn an toàn ở localStorage.', e);
  }
}
// -----------------------------------------------------------

// Khai báo cho AI gọi thẳng vào giao diện
declare global {
  interface Window {
    updateWeight?: (weight: number) => string;
    getMacroSummary?: () => string;
    getWorkoutSchedule?: () => string;
    addFoodDirectly?: (name: string, amount: number, protein: number, carbs: number, fat: number) => string;
    suggestQuickMeal?: (proteinName: string, carbName: string, fatName: string) => string; 
  }
}

export default function App() {
  const [profiles, setProfiles] = useState<Profile[]>(() => {
    const saved = localStorage.getItem('gym_nutri_profiles');
    return saved ? JSON.parse(saved) : DEFAULT_PROFILES;
  });

  const { 
    startRecording, 
    stopRecording, 
    cancelAudio, 
    isRecording, 
    recognizedText, 
    error 
  } = useSpeechToText();

  const [activeProfileId, setActiveProfileId] = useState<number>(1);
  const activeProfile = profiles.find(p => p.id === activeProfileId) || profiles[0];

  const [foodDatabase, setFoodDatabase] = useState<FoodItem[]>(() => {
    const saved = localStorage.getItem('gym_nutri_foods');
    return saved ? JSON.parse(saved) : DEFAULT_FOOD_ITEMS;
  });

  const getTodayDateString = () => {
    const today = new Date();
    const offset = today.getTimezoneOffset();
    const localToday = new Date(today.getTime() - (offset * 60 * 1000));
    return localToday.toISOString().split('T')[0];
  };

  const [selectedDate, setSelectedDate] = useState<string>(getTodayDateString);

// --- STATE LỊCH TẬP NOTION ---
  const [gymLog, setGymLog] = useState<{ found: boolean; title?: string; lines?: string[] } | null>(null);
  const [isWorkoutExpanded, setIsWorkoutExpanded] = useState(true); // State đóng mở lịch tập

  useEffect(() => {
    setGymLog(null); 
    fetch(`/api/gym-log-today?profileId=${activeProfileId}&date=${selectedDate}`)
      .then(res => res.json())
      .then(data => {
        // LỌC RÁC: Nếu tìm thấy page trên Notion NHƯNG tiêu đề chứa chữ "Báo cáo" -> Đánh dấu là ngày nghỉ
        if (data.found && data.title && data.title.toUpperCase().includes('BÁO CÁO')) {
          setGymLog({ found: false });
        } else {
          setGymLog(data);
        }
      })
      .catch(() => setGymLog({ found: false }));
  }, [activeProfileId, selectedDate]);
  // -----------------------------

  const { speak, isLoading: ttsLoading, isPlaying: ttsPlaying } = useTextToSpeech();
  
  const [loggedMealsByProfile, setLoggedMealsByProfile] = useState<Record<number, Record<string, LoggedMeal[]>>>(() => {
    const saved = localStorage.getItem('gym_nutri_logged_meals_v2');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    const oldSaved = localStorage.getItem('gym_nutri_logged_meals');
    if (oldSaved) {
      try {
        const oldData = JSON.parse(oldSaved);
        const newData: Record<number, Record<string, LoggedMeal[]>> = {};
        const todayStr = new Date().toISOString().split('T')[0];
        Object.keys(oldData).forEach((profId) => {
          const id = Number(profId);
          newData[id] = { [todayStr]: oldData[id] || [] };
        });
        return newData;
      } catch (e) {}
    }
    return { 1: {}, 2: {} };
  });

  const activeProfileMeals = loggedMealsByProfile[activeProfileId] || {};
  const activeLogs = activeProfileMeals[selectedDate] || [];

  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editForm, setEditForm] = useState<Profile>({ ...activeProfile });

  const [customFoodForm, setCustomFoodForm] = useState({
    name: '', category: 'protein' as FoodCategory, protein: '', carbs: '', fat: '', calories: '', unit: '100g'
  });
  const [showCustomFoodModal, setShowCustomFoodModal] = useState(false);
  const [showQuickMealModal, setShowQuickMealModal] = useState(false);
const [quickMealPick, setQuickMealPick] = useState<{ protein?: string; carbs?: string; fats?: string }>({});

  const [selectedFoodId, setSelectedFoodId] = useState<string>('');
  const [logAmount, setLogAmount] = useState<string>('100');
  const [foodSearch, setFoodSearch] = useState<string>('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');

  useEffect(() => {
    localStorage.setItem('gym_nutri_profiles', JSON.stringify(profiles));
  }, [profiles]);

  useEffect(() => {
    localStorage.setItem('gym_nutri_foods', JSON.stringify(foodDatabase));
  }, [foodDatabase]);

  useEffect(() => {
    localStorage.setItem('gym_nutri_logged_meals_v2', JSON.stringify(loggedMealsByProfile));
  }, [loggedMealsByProfile]);

  // --- SYNC: tải data từ server khi mở app (server là nguồn chuẩn giữa các thiết bị) ---
  const isCloudLoaded = useRef(false);
  const [cloudStatus, setCloudStatus] = useState<'loading' | 'synced' | 'offline'>('loading');

  useEffect(() => {
    let cancelled = false;
    fetchCloudData().then((cloud) => {
      if (cancelled) return;
      if (cloud) {
        if (cloud.profiles) setProfiles(cloud.profiles);
        if (cloud.foodDatabase) setFoodDatabase(cloud.foodDatabase);
        if (cloud.loggedMealsByProfile) setLoggedMealsByProfile(cloud.loggedMealsByProfile);
        setCloudStatus('synced');
      } else {
        setCloudStatus('offline');
      }
      isCloudLoaded.current = true;
    });
    return () => { cancelled = true; };
  }, []);

  // --- SYNC: đẩy data lên server mỗi khi có thay đổi (debounce 1.2s) ---
  const syncDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!isCloudLoaded.current) return; // Chưa load xong từ cloud thì đừng ghi đè
    if (syncDebounceRef.current) clearTimeout(syncDebounceRef.current);
    syncDebounceRef.current = setTimeout(() => {
      pushCloudData({ profiles, foodDatabase, loggedMealsByProfile }).then(() => setCloudStatus('synced'));
    }, 1200);
    return () => {
      if (syncDebounceRef.current) clearTimeout(syncDebounceRef.current);
    };
  }, [profiles, foodDatabase, loggedMealsByProfile]);

  useEffect(() => {
    setEditForm({ ...activeProfile });
  }, [activeProfileId, activeProfile]);

  const bmr = Math.round(calculateBMR(activeProfile));
  
  // 1. Chốt cứng hệ số nền 1.2 (Sedentary) cho sinh hoạt
  const baseTdee = Math.round(bmr * 1.2); 
  
  // 2. Tính Calo từ bước chân (NEAT)
  const stepsBurn = Math.round(calculateStepsCalories(activeProfile.dailySteps || 0, activeProfile.weight));
  
  // 3. Tính Calo từ tập tạ (EAT) - Chốt 300 kcal trung bình/ngày
  const trainingBurn = 300;
  
  // 4. Tổng TDEE thực tế
  const tdee = baseTdee + stepsBurn + trainingBurn;
  
  const targetMacros = calculateMacros(activeProfile, tdee);

  const consumedProtein = Math.round(activeLogs.reduce((sum, item) => sum + item.protein, 0));
  const consumedCarbs = Math.round(activeLogs.reduce((sum, item) => sum + item.carbs, 0));
  const consumedFat = Math.round(activeLogs.reduce((sum, item) => sum + item.fat, 0));
  const consumedCalories = Math.round(activeLogs.reduce((sum, item) => sum + item.calories, 0));

  const proteinGap = Math.max(0, targetMacros.protein - consumedProtein);
  const carbsGap = Math.max(0, targetMacros.carbs - consumedCarbs);
  const fatGap = Math.max(0, targetMacros.fat - consumedFat);
  const caloriesGap = Math.max(0, targetMacros.calories - consumedCalories);

  useEffect(() => {





    const handleEditProfile = () => setIsEditingProfile(true);
    const handleAddFood = () => setShowCustomFoodModal(true);
    document.addEventListener('macro-master:edit-profile', handleEditProfile);
    document.addEventListener('macro-master:add-food', handleAddFood);



window.suggestQuickMeal = (proteinName: string, carbName: string, fatName: string) => {
      const p = findFoodByNameInCategory(foodDatabase, proteinName, 'protein');
      const c = findFoodByNameInCategory(foodDatabase, carbName, 'carbs');
      const f = findFoodByNameInCategory(foodDatabase, fatName, 'fats');

      if (!p || !c || !f) {
        return "Mình không tìm thấy đủ 3 loại thực phẩm bạn nói, bạn thử nói lại tên món khác nhé.";
      }

      const remainingMacros = { protein: proteinGap, carbs: carbsGap, fat: fatGap };
      
      // Thêm caloriesGap vào đầu
      const plan = calculateQuickMealPlan(caloriesGap, remainingMacros, p, c, f);
      
      plan.forEach(item => handleApplySuggestion(item.food, item.grams));

      return `Đã tính toán chuẩn Calo! Tôi vừa thêm ${plan.map(x => `${x.grams} gram ${x.food.name}`).join(', ')} vào thực đơn. Tổng calo hoàn toàn không bị lố.`;
    };


    window.updateWeight = (newWeight: number) => {
      setProfiles(prev => prev.map(p => p.id === activeProfileId ? { ...p, weight: newWeight } : p));
      return `Đã cập nhật cân nặng của bạn thành ${newWeight} kg. Chúc mừng sự nỗ lực của bạn!`;
    };

    window.getMacroSummary = () => {
      return `Tiến độ hôm nay: Nạp ${consumedCalories} trên tổng ${targetMacros.calories} calo. Đạm: ${consumedProtein}/${targetMacros.protein} gam, Tinh bột: ${consumedCarbs}/${targetMacros.carbs} gam, Béo: ${consumedFat}/${targetMacros.fat} gam.`;
    };

    window.getWorkoutSchedule = () => {
      if (!gymLog) return "Hệ thống đang tải dữ liệu lịch tập, vui lòng chờ một lát.";
      if (!gymLog.found) return "Hôm nay bạn không có lịch tập nào. Hãy dành thời gian nghỉ ngơi và phục hồi cơ bắp nhé!";
      return `Lịch tập hôm nay là: ${gymLog.title}. Chi tiết các bài gồm có: ${(gymLog.lines || []).join(', ')}`;
    };

    window.addFoodDirectly = (name: string, amount: number, protein: number, carbs: number, fat: number) => {
      const calculatedCal = Math.round(protein * 4 + carbs * 4 + fat * 9);
      const newFood: FoodItem = { 
        id: `custom_${Date.now()}`, name, category: 'custom', protein, carbs, fat, calories: calculatedCal, unit: `${amount}g`, isCustom: true 
      };
      setFoodDatabase(prev => [newFood, ...prev]);

      const newLog: LoggedMeal = { 
        id: `l_${Date.now()}`, foodId: newFood.id, name, amount, protein, carbs, fat, calories: calculatedCal 
      };
      setLoggedMealsByProfile(prev => {
        const profileMeals = prev[activeProfileId] || {};
        const dateMeals = profileMeals[selectedDate] || [];
        return { ...prev, [activeProfileId]: { ...profileMeals, [selectedDate]: [...dateMeals, newLog] } };
      });
      return `Đã xử lý xong. Thêm thành công ${amount} gam ${name} vào thực đơn hôm nay, cung cấp khoảng ${calculatedCal} calo.`;
    };

    return () => {
      document.removeEventListener('macro-master:edit-profile', handleEditProfile);
      document.removeEventListener('macro-master:add-food', handleAddFood);
      delete window.updateWeight;
      delete window.getMacroSummary;
      delete window.getWorkoutSchedule;
      delete window.addFoodDirectly;
    };
  }, [activeProfileId, consumedCalories, consumedProtein, consumedCarbs, consumedFat, targetMacros, gymLog, selectedDate]);

  const smartSuggestions = generateSmartSuggestions(
    targetMacros,
    { protein: consumedProtein, carbs: consumedCarbs, fat: consumedFat },
    foodDatabase
  );

  const assessment = getAssessment(activeProfile, targetMacros.calories, bmr, consumedProtein);

  const getWeekDays = (currentDateStr: string) => {
    const date = new Date(currentDateStr);
    const day = date.getDay();
    const diffToMonday = date.getDate() - (day === 0 ? 6 : day - 1);
    const monday = new Date(date.setDate(diffToMonday));
    const days = [];
    const dayNames = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'C.Nhật'];
    for (let i = 0; i < 7; i++) {
      const nextDay = new Date(monday);
      nextDay.setDate(monday.getDate() + i);
      const dateStr = nextDay.toISOString().split('T')[0];
      days.push({ dateStr, dayLabel: dayNames[i], dayNum: nextDay.getDate(), isToday: dateStr === getTodayDateString() });
    }
    return days;
  };

  const weekDays = getWeekDays(selectedDate);

  const handleProfileSwap = (id: number) => {
    setActiveProfileId(id);
    setIsEditingProfile(false);
    setSelectedFoodId('');
    setLogAmount('100');
    setFoodSearch('');
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const updatedProfiles = profiles.map(p => p.id === activeProfileId ? { ...editForm } : p);
    setProfiles(updatedProfiles);
    setIsEditingProfile(false);
  };

  const handleAddLog = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFoodId) return;
    const food = foodDatabase.find(f => f.id === selectedFoodId);
    if (!food) return;
    const amount = parseFloat(logAmount);
    if (isNaN(amount) || amount <= 0) return;

    const multiplier = amount / 100;
    const newLog: LoggedMeal = {
      id: `l_${Date.now()}`, foodId: food.id, name: food.name, amount,
      protein: parseFloat((food.protein * multiplier).toFixed(1)),
      carbs: parseFloat((food.carbs * multiplier).toFixed(1)),
      fat: parseFloat((food.fat * multiplier).toFixed(1)),
      calories: Math.round(food.calories * multiplier)
    };

    setLoggedMealsByProfile(prev => {
      const profileMeals = prev[activeProfileId] || {};
      const dateMeals = profileMeals[selectedDate] || [];
      return { ...prev, [activeProfileId]: { ...profileMeals, [selectedDate]: [...dateMeals, newLog] } };
    });
    setLogAmount('100');
  };

const handleApplySuggestion = (food: FoodItem, amount: number) => {
    const multiplier = amount / 100;
    const newLog: LoggedMeal = {
      // Sửa dòng id này: Thêm đuôi random để chống trùng lặp tuyệt đối
      id: `l_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`, 
      foodId: food.id, name: food.name, amount,
      protein: parseFloat((food.protein * multiplier).toFixed(1)),
      carbs: parseFloat((food.carbs * multiplier).toFixed(1)),
      fat: parseFloat((food.fat * multiplier).toFixed(1)),
      calories: Math.round(food.calories * multiplier)
    };

    setLoggedMealsByProfile(prev => {
      const profileMeals = prev[activeProfileId] || {};
      const dateMeals = profileMeals[selectedDate] || [];
      return { ...prev, [activeProfileId]: { ...profileMeals, [selectedDate]: [...dateMeals, newLog] } };
    });
  };
const handleApplyQuickMealPlan = (proteinFood: FoodItem, carbFood: FoodItem, fatFood: FoodItem) => {
    const remainingMacros = { protein: proteinGap, carbs: carbsGap, fat: fatGap };
    
    // Thêm caloriesGap vào đầu
    const plan = calculateQuickMealPlan(caloriesGap, remainingMacros, proteinFood, carbFood, fatFood);
    
    plan.forEach(item => handleApplySuggestion(item.food, item.grams));
    setShowQuickMealModal(false);
    setQuickMealPick({});
  };
  const handleRemoveLog = (logId: string) => {
    setLoggedMealsByProfile(prev => {
      const profileMeals = prev[activeProfileId] || {};
      const dateMeals = profileMeals[selectedDate] || [];
      return { ...prev, [activeProfileId]: { ...profileMeals, [selectedDate]: dateMeals.filter(item => item.id !== logId) } };
    });
  };

  const handleResetLogs = () => {
    if (window.confirm('Bạn có chắc chắn muốn xóa toàn bộ nhật ký ăn uống ngày hôm nay không?')) {
      setLoggedMealsByProfile(prev => {
        const profileMeals = prev[activeProfileId] || {};
        return { ...prev, [activeProfileId]: { ...profileMeals, [selectedDate]: [] } };
      });
    }
  };

  const handleCreateCustomFood = (e: React.FormEvent) => {
    e.preventDefault();
    const { name, category, protein, carbs, fat, calories, unit } = customFoodForm;
    if (!name.trim()) return;

    const pVal = parseFloat(protein) || 0;
    const cVal = parseFloat(carbs) || 0;
    const fVal = parseFloat(fat) || 0;
    const calculatedCal = Math.round(pVal * 4 + cVal * 4 + fVal * 9);
    const calVal = parseFloat(calories) || calculatedCal;

    const newFood: FoodItem = {
      id: `custom_${Date.now()}`, name: name.trim(), category, protein: pVal, carbs: cVal, fat: fVal, calories: calVal, unit: unit || '100g', isCustom: true
    };

    setFoodDatabase(prev => [newFood, ...prev]);
    setSelectedFoodId(newFood.id);
    setShowCustomFoodModal(false);
    setCustomFoodForm({ name: '', category: 'protein', protein: '', carbs: '', fat: '', calories: '', unit: '100g' });
  };

  const handleDeleteCustomFood = (foodId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Xóa thực phẩm này khỏi danh sách cá nhân?')) {
      setFoodDatabase(prev => prev.filter(f => f.id !== foodId));
      if (selectedFoodId === foodId) setSelectedFoodId('');
    }
  };

  const getGoalLabel = (goal: Goal) => {
    switch (goal) {
      case 'cut_standard': return 'Siết mỡ chậm (-500 kcal)';
      case 'cut_aggressive': return 'Siết mỡ thần tốc (-800 kcal)';
      case 'maintenance': return 'Giữ cân ổn định (Bảo trì)';
      case 'bulk_standard': return 'Xả cơ nạc sạch (+300 kcal)';
      case 'bulk_aggressive': return 'Xả cơ nhanh (+500 kcal)';
    }
  };

  const getActivityLabel = (level: ActivityLevel) => {
    switch (level) {
      case 'sedentary': return 'Ít vận động (Nhân viên VP)';
      case 'lightly_active': return 'Vận động nhẹ (1-3 buổi/tuần)';
      case 'moderately_active': return 'Vận động vừa (3-5 buổi/tuần)';
      case 'very_active': return 'Vận động nhiều (6-7 buổi/tuần)';
      case 'extra_active': return 'Vận động cực nặng';
    }
  };

  const filteredFoods = foodDatabase.filter(food => {
    const matchesSearch = food.name.toLowerCase().includes(foodSearch.toLowerCase());
    const matchesCategory = selectedCategoryFilter === 'all' || food.category === selectedCategoryFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="min-h-screen bg-[#070b13] text-slate-100 font-sans antialiased pb-20">
      <header className="border-b border-slate-800/60 bg-slate-900/40 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 rounded-xl border border-emerald-500/20 text-emerald-400">
              <Dumbbell className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h1 className="text-xl font-bold font-display tracking-tight bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
                NutriFit Pro
              </h1>
              <p className="text-xs text-slate-400 font-mono">CHUYÊN GIA DINH DƯỠNG THỂ THAO</p>
            </div>
            <span
              title={cloudStatus === 'synced' ? 'Đã đồng bộ lên server' : cloudStatus === 'loading' ? 'Đang tải dữ liệu...' : 'Không kết nối được server, đang dùng dữ liệu local'}
              className={`ml-1 w-2 h-2 rounded-full ${
                cloudStatus === 'synced' ? 'bg-emerald-400' : cloudStatus === 'loading' ? 'bg-amber-400 animate-pulse' : 'bg-red-500'
              }`}
            />
          </div>
          <div className="flex items-center gap-2 bg-slate-950/80 p-1.5 rounded-2xl border border-slate-800">
            {profiles.map(p => (
              <button
                key={p.id}
                onClick={() => handleProfileSwap(p.id)}
                className={`relative px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 flex items-center gap-2 ${
                  activeProfileId === p.id 
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-semibold' 
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                <User className="w-4 h-4" />
                <span>{p.name}</span>
                {activeProfileId === p.id && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full border border-slate-950" />
                )}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 mt-6">
        
        {/* Profile Card Header */}
        <div className="bg-gradient-to-r from-slate-900 to-slate-950 p-6 rounded-3xl border border-slate-800/80 mb-6 relative overflow-hidden shadow-xl">
          <div className="absolute right-0 top-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute left-1/3 bottom-0 w-64 h-64 bg-teal-500/5 rounded-full blur-3xl pointer-events-none" />

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
            <div>
              <div className="flex items-center gap-3 mb-2 flex-wrap">
                <span className="text-xs uppercase tracking-wider bg-emerald-500/15 text-emerald-400 font-semibold px-2.5 py-1 rounded-md border border-emerald-500/20 font-mono">
                  {getGoalLabel(activeProfile.goal)}
                </span>
                <span className="text-xs uppercase tracking-wider bg-slate-800 text-slate-300 font-semibold px-2.5 py-1 rounded-md border border-slate-700/60 font-mono">
                  {activeProfile.gender === 'male' ? 'Nam giới' : 'Nữ giới'}
                </span>
                <span className="text-xs uppercase tracking-wider bg-slate-800 text-slate-300 font-semibold px-2.5 py-1 rounded-md border border-slate-700/60 font-mono">
                  {activeProfile.age} Tuổi
                </span>
              </div>
              <h2 className="text-2xl lg:text-3xl font-bold font-display tracking-tight text-white mb-1.5 flex items-center gap-2">
                <span>Chỉ số của {activeProfile.name.split(' ')[0]}</span>
                <button 
                  onClick={() => setIsEditingProfile(!isEditingProfile)} 
                  className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-emerald-400 transition-colors"
                  title="Chỉnh sửa chỉ số cơ thể"
                >
                  <Edit2 className="w-4.5 h-4.5" />
                </button>
              </h2>
              <p className="text-slate-400 text-sm max-w-2xl flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Hoạt động: {getActivityLabel(activeProfile.activityLevel)}</span>
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3 md:gap-6 bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80">
              <div className="text-center">
                <span className="block text-[10px] uppercase font-mono tracking-wider text-slate-500 mb-0.5">Cân nặng</span>
                <span className="text-lg md:text-xl font-bold font-display text-emerald-400">{activeProfile.weight} <span className="text-xs text-slate-500 font-normal">kg</span></span>
              </div>
              <div className="border-x border-slate-800/80 px-4 md:px-6 text-center">
                <span className="block text-[10px] uppercase font-mono tracking-wider text-slate-500 mb-0.5">Chiều cao</span>
                <span className="text-lg md:text-xl font-bold font-display text-emerald-400">{activeProfile.height} <span className="text-xs text-slate-500 font-normal">cm</span></span>
              </div>
              <div className="text-center">
                <span className="block text-[10px] uppercase font-mono tracking-wider text-slate-500 mb-0.5">BMI</span>
                <span className="text-lg md:text-xl font-bold font-display text-emerald-400">
                  {((activeProfile.weight) / Math.pow(activeProfile.height / 100, 2)).toFixed(1)}
                </span>
              </div>
            </div>
          </div>

          <AnimatePresence>
            {isEditingProfile && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden mt-6 pt-6 border-t border-slate-800"
              >
                <form onSubmit={handleSaveProfile} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Tên Hiển Thị</label>
                    <input type="text" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500" required />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">Tuổi</label>
                      <input type="number" value={editForm.age} min="1" max="120" onChange={e => setEditForm({ ...editForm, age: parseInt(e.target.value) || 0 })} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500" required />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">Giới tính</label>
                      <select value={editForm.gender} onChange={e => setEditForm({ ...editForm, gender: e.target.value as Gender })} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500">
                        <option value="male">Nam</option>
                        <option value="female">Nữ</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">Cân nặng (kg)</label>
                      <input type="number" value={editForm.weight} min="20" max="250" onChange={e => setEditForm({ ...editForm, weight: parseFloat(e.target.value) || 0 })} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500" required />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">Chiều cao (cm)</label>
                      <input type="number" value={editForm.height} min="50" max="250" onChange={e => setEditForm({ ...editForm, height: parseFloat(e.target.value) || 0 })} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500" required />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Cường độ vận động</label>
                    <select value={editForm.activityLevel} onChange={e => setEditForm({ ...editForm, activityLevel: e.target.value as ActivityLevel })} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500">
                      <option value="sedentary">Ít vận động</option>
                      <option value="lightly_active">Vận động nhẹ</option>
                      <option value="moderately_active">Vận động vừa</option>
                      <option value="very_active">Vận động nhiều</option>
                      <option value="extra_active">Cực kì nhiều</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Mục tiêu Thể Hình</label>
                    <select value={editForm.goal} onChange={e => setEditForm({ ...editForm, goal: e.target.value as Goal })} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500">
                      <option value="cut_standard">Thâm hụt vừa (Giảm mỡ chậm)</option>
                      <option value="cut_aggressive">Thâm hụt cao (Giảm mỡ nhanh)</option>
                      <option value="maintenance">Giữ cân (Tăng hiệu suất tập)</option>
                      <option value="bulk_standard">Dư thừa ít (Tăng cơ nạc sạch)</option>
                      <option value="bulk_aggressive">Dư thừa nhiều (Tăng cơ nhanh)</option>
                    </select>


<div className="grid grid-cols-3 gap-2 mt-3">
  {(['standard', 'low_carb', 'high_carb'] as const).map((dt) => {
    const labels = {
      standard: 'Phổ thông (20P/40C/40F)',
      low_carb: 'Ít tinh bột (30P/20C/50F)',
      high_carb: 'Nhiều tinh bột (20P/50C/30F)',
    };
    return (
      <button
        key={dt}
        type="button"
        onClick={() => setEditForm({ ...editForm, dietType: dt })}
        className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
          editForm.dietType === dt
            ? 'bg-red-600 border-red-500 text-white'
            : 'bg-slate-900 border-slate-700 text-slate-400'
        }`}
      >
        {labels[dt]}
      </button>
    );
  })}
</div>
                  </div>
                  
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Số bước chân mỗi ngày</label>
                    <div className="relative">
                      <input type="number" value={editForm.dailySteps || 0} min="0" max="50000" step="500" onChange={e => setEditForm({ ...editForm, dailySteps: parseInt(e.target.value) || 0 })} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500 font-mono" required />
                      <span className="absolute right-3 top-2 text-xs text-slate-500 font-mono">bước</span>
                    </div>
                  </div>
                  <div className="flex items-end gap-2 lg:col-span-2">
                    <button type="submit" className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold px-4 py-2.5 rounded-xl text-sm transition-colors cursor-pointer">
                      Cập Nhật
                    </button>
                    <button type="button" onClick={() => setIsEditingProfile(false)} className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium px-4 py-2.5 rounded-xl text-sm transition-colors cursor-pointer">
                      Hủy
                    </button>
                  </div>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Weekly Calendar & Nutrition Tracker Section */}
        <div className="bg-slate-900/40 backdrop-blur-md rounded-3xl border border-slate-800/80 p-5 mb-6 shadow-lg">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4">
            <div>
              <h3 className="text-lg font-bold font-display text-white flex items-center gap-2">
                <Calendar className="w-5 h-5 text-emerald-400" />
                <span>Nhật Ký & Theo Dõi Dinh Dưỡng Tuần</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Click chọn ngày bất kỳ trong tuần để đổi ngày xem/ghi chép nhật ký món ăn của ngày đó
              </p>
            </div>
            
            <div className="flex items-center gap-2 self-stretch md:self-auto justify-between">
              <button onClick={() => { const d = new Date(selectedDate); d.setDate(d.getDate() - 7); setSelectedDate(d.toISOString().split('T')[0]); }} className="p-2 bg-slate-950/60 hover:bg-slate-800 border border-slate-800 rounded-xl text-slate-400 hover:text-white transition-colors cursor-pointer" title="Tuần trước">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={() => setSelectedDate(getTodayDateString())} className="px-3.5 py-1.5 bg-slate-950/80 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs font-semibold text-slate-300 hover:text-emerald-400 transition-colors cursor-pointer font-mono">
                Hôm Nay
              </button>
              <button onClick={() => { const d = new Date(selectedDate); d.setDate(d.getDate() + 7); setSelectedDate(d.toISOString().split('T')[0]); }} className="p-2 bg-slate-950/60 hover:bg-slate-800 border border-slate-800 rounded-xl text-slate-400 hover:text-white transition-colors cursor-pointer" title="Tuần sau">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            {weekDays.map(day => {
              const dayMeals = activeProfileMeals[day.dateStr] || [];
              const dayConsumed = Math.round(dayMeals.reduce((sum, item) => sum + item.calories, 0));
              const isSelected = selectedDate === day.dateStr;
              const targetCal = targetMacros.calories;
              const percent = Math.min(100, Math.round((dayConsumed / targetCal) * 100));
              const diff = dayConsumed - targetCal;

              return (
                <button
                  key={day.dateStr}
                  onClick={() => setSelectedDate(day.dateStr)}
                  className={`p-3.5 rounded-2xl border transition-all duration-300 flex flex-col justify-between text-left relative cursor-pointer group ${
                    isSelected ? 'bg-emerald-500/10 border-emerald-500/40 shadow-emerald-500/5 shadow-lg' : 'bg-slate-950/30 border-slate-800 hover:border-slate-700/80 hover:bg-slate-950/60'
                  }`}
                >
                  {day.isToday && <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-emerald-400 rounded-full border border-slate-950" title="Hôm nay" />}
                  <div>
                    <span className="block text-[10px] font-mono tracking-wider text-slate-500 uppercase">{day.dayLabel}</span>
                    <span className="text-base font-black font-display text-white">{day.dayNum}</span>
                  </div>
                  <div className="my-3 h-1.5 bg-slate-800 rounded-full overflow-hidden w-full relative">
                    <div className={`h-full rounded-full transition-all duration-500 ${percent === 0 ? 'bg-transparent' : percent > 105 ? 'bg-amber-500' : percent >= 90 ? 'bg-emerald-400' : 'bg-teal-500'}`} style={{ width: `${percent}%` }} />
                  </div>
                  <div className="space-y-0.5">
                    <span className="block text-xs font-bold font-mono text-slate-300">{dayConsumed > 0 ? `${dayConsumed.toLocaleString()} kcal` : 'Trống'}</span>
                    {dayConsumed > 0 ? (
                      <span className={`text-[10px] font-mono font-bold block ${diff > 0 ? 'text-amber-400' : diff < 0 ? 'text-teal-400' : 'text-emerald-400'}`}>
                        {diff > 0 ? `Dư +${diff}` : diff < 0 ? `Hụt ${diff}` : 'Đạt chuẩn ✓'}
                      </span>
                    ) : <span className="text-[10px] text-slate-500 block">--</span>}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-4 pt-3.5 border-t border-slate-800/60 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-1.5 text-slate-400">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Đang xem nhật ký ngày:</span>
              <strong className="text-emerald-400 font-mono">
                {new Date(selectedDate).toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </strong>
            </div>
            <div className="text-slate-500 text-[11px] italic">
              *Tất cả thay đổi món ăn hằng ngày của bạn sẽ tự động lưu lại theo từng ngày đã chọn.
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* KHỐI ĐÁNH GIÁ TỔNG QUAN (DAILY OVERALL ASSESSMENT) */}
        {/* ========================================================= */}
        <div className="mb-6">
          <div className={`p-5 rounded-3xl border ${
            assessment.rating === 'warning_red' 
              ? 'bg-red-500/10 border-red-500/30 text-red-200' 
              : assessment.rating === 'warning_yellow'
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                : 'bg-emerald-500/5 border-emerald-500/20 text-emerald-200'
          }`}>
            <div className="flex items-start gap-4">
              <div className={`p-2 rounded-xl shrink-0 ${
                assessment.rating === 'warning_red' 
                  ? 'bg-red-500/20 text-red-400' 
                  : assessment.rating === 'warning_yellow'
                    ? 'bg-amber-500/20 text-amber-400'
                    : 'bg-emerald-500/20 text-emerald-400'
              }`}>
                {assessment.rating === 'warning_red' ? (
                  <ShieldAlert className="w-5 h-5" />
                ) : assessment.rating === 'warning_yellow' ? (
                  <AlertTriangle className="w-5 h-5" />
                ) : (
                  <Award className="w-5 h-5" />
                )}
              </div>
              <div className="space-y-2 w-full">
                <div className="flex items-center justify-between gap-4">
                  <h4 className="font-bold text-sm uppercase tracking-wide font-display">
                    Đánh giá tổng quan ngày
                  </h4>
                  {/* NÚT ĐỌC TEXT-TO-SPEECH (DÙNG WEB SPEECH API FREE) */}
                  <button
                    onClick={() => {
                      const workoutText = gymLog?.found ? `Hôm nay bạn có lịch tập ${gymLog.title}. ` : 'Hôm nay là ngày nghỉ ngơi phục hồi cơ bắp. ';
                      const evalText = assessment.warnings.length > 0
                        ? assessment.warnings.join('. ')
                        : 'Tuyệt vời, lượng đạm và calo hôm nay của bạn đang rất tối ưu. Hãy tiếp tục duy trì!';
                      speak(workoutText + evalText);
                    }}
                    disabled={ttsLoading}
                    className="shrink-0 p-2 rounded-xl bg-slate-800/60 hover:bg-slate-700 border border-slate-700 transition-all disabled:opacity-50"
                    title="Đọc đánh giá bằng AI miễn phí"
                  >
                    {ttsLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                    ) : (
                      <Volume2 className={`w-4 h-4 ${ttsPlaying ? 'text-emerald-400' : 'text-slate-400'}`} />
                    )}
                  </button>
                </div>
                
                <p className="text-sm font-semibold text-white">
                  {gymLog?.found ? `🏋️‍♂️ Hôm nay có bài tập: ${gymLog.title}. ` : '🛌 Hôm nay nghỉ ngơi phục hồi. '}
                  {assessment.message}
                </p>
                
                {assessment.warnings.length > 0 ? (
                  <ul className="space-y-1.5 text-xs bg-slate-950/40 p-3 rounded-xl border border-slate-800/50">
                    {assessment.warnings.map((warn, i) => (
                      <li key={i} className="flex gap-2 items-start text-slate-300">
                        <span className="text-amber-400 shrink-0 mt-0.5">●</span>
                        <span>{warn}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-slate-300 text-xs bg-slate-950/40 p-3 rounded-xl border border-slate-800/50">
                    Thực đơn và phân bổ calo của bạn đang rất lành mạnh và an toàn cho cơ thể. Lượng protein đã nạp đủ để duy trì và phát triển cơ bắp!
                  </p>
                )}

                <div className="pt-2 border-t border-slate-800 mt-2 text-[11px] text-slate-400 italic flex items-center gap-1.5">
                  <Heart className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span>Lời khuyên: Hãy uống đủ {Math.round(activeProfile.weight * 0.04 * 10) / 10} lít nước hôm nay ({Math.round(activeProfile.weight * 0.04 * 1000 / 250)} cốc nước 250ml) để hỗ trợ quá trình trao đổi chất.</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* ========================================================= */}

        {/* --- BẢNG LỊCH TẬP NOTION (CÓ NÚT THU GỌN) --- */}
        {gymLog && (
          <div className="mb-6 rounded-3xl border bg-slate-900/60 border-slate-800/80 shadow-lg relative overflow-hidden transition-all duration-300">
            <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
              <Dumbbell className="w-24 h-24 text-emerald-400" />
            </div>

            {/* HEADER LỊCH TẬP (BẤM ĐỂ ĐÓNG/MỞ) */}
            <div 
              className="p-5 flex items-center justify-between relative z-10 cursor-pointer hover:bg-slate-800/30 transition-colors"
              onClick={() => setIsWorkoutExpanded(!isWorkoutExpanded)}
            >
              <h4 className="font-bold text-sm uppercase tracking-wide font-display flex items-center gap-2">
                <div className={`p-1.5 rounded-lg ${gymLog.found ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-500'}`}>
                  <Dumbbell className="w-4 h-4" />
                </div>
                <span className={gymLog.found ? 'text-white' : 'text-slate-400'}>
                  {gymLog.found ? gymLog.title : 'Hôm nay nghỉ ngơi phục hồi cơ bắp 🎉'}
                </span>
              </h4>
              
              <div className="flex items-center gap-3">
                {gymLog.found && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation(); // Ngăn sự kiện bấm nhầm làm đóng/mở thẻ
                      speak(`Mục tiêu tập luyện hôm nay là ${gymLog.title}. ${(gymLog.lines || []).join('. ')}. Hãy giữ một cái đầu lạnh và tập trung cao độ nhé!`);
                    }}
                    disabled={ttsLoading}
                    className="shrink-0 p-2 rounded-xl bg-slate-800/60 hover:bg-slate-700 border border-slate-700 transition-colors disabled:opacity-50 cursor-pointer"
                    title="Đọc lịch tập"
                  >
                    {ttsLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                    ) : (
                      <Volume2 className={`w-4 h-4 ${ttsPlaying ? 'text-emerald-400' : 'text-slate-400'}`} />
                    )}
                  </button>
                )}
                {/* ICON MŨI TÊN ĐÓNG/MỞ */}
                <div className="p-1 text-slate-500 hover:text-slate-300">
                  {isWorkoutExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </div>
              </div>
            </div>

            {/* NỘI DUNG LỊCH TẬP (ANIMATION ĐÓNG MỞ MƯỢT MÀ) */}
            <AnimatePresence>
              {isWorkoutExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="px-5 pb-5 pt-0 relative z-10">
                    {gymLog.found ? (
                      <ul className="text-sm text-slate-300 space-y-2 bg-slate-950/40 p-4 rounded-2xl border border-slate-800/50">
                        {gymLog.lines?.map((line, i) => (
                          <li key={i} className="flex gap-2.5 items-start">
                            <span className="text-emerald-400 shrink-0 mt-0.5 font-bold">▹</span>
                            <span className="font-mono">{line}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-slate-500 italic mt-1 pl-11">
                        Hệ thống không tìm thấy lịch đẩy tạ nào trong Notion ngày hôm nay. Tranh thủ nạp thêm đạm nhé!
                      </p>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
        {/* ----------------------------- */}                 

        {/* Diagnostic Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          
          <div className="bg-slate-900/60 rounded-3xl border border-slate-800/80 p-6 flex flex-col justify-between shadow-lg">
            <div>
              <div className="flex items-center gap-2 text-slate-400 font-mono text-xs uppercase tracking-wider mb-3">
                <Calculator className="w-4 h-4 text-emerald-400" />
                <span>Hệ Thống Phân Tích Năng Lượng</span>
              </div>
              <h3 className="text-lg font-bold font-display text-white mb-4">Mức Tiêu Thụ Năng Lượng</h3>

              <div className="space-y-3">
                
                <div className="bg-slate-950/40 p-3.5 rounded-2xl border border-slate-800/50 flex items-center justify-between">
                  <div>
                    <span className="text-xs text-slate-300 block font-medium">BMR (Chuyển hóa cơ bản)</span>
                    <span className="text-slate-500 text-[10px]">Năng lượng sống tối thiểu</span>
                  </div>
                  <div className="text-right">
                    <span className="text-base font-bold font-mono text-teal-400">{bmr}</span>
                    <span className="text-[10px] text-slate-500 block">kcal</span>
                  </div>
                </div>

                <div className="bg-slate-950/40 p-3.5 rounded-2xl border border-slate-800/50 flex items-center justify-between">
                  <div>
                    <span className="text-xs text-slate-300 block font-medium">Luyện tập & Gym</span>
                    <span className="text-slate-500 text-[10px]">Theo mức vận động đã chọn</span>
                  </div>
                  <div className="text-right">
                    <span className="text-base font-bold font-mono text-indigo-400">+{trainingBurn}</span>
                    <span className="text-[10px] text-slate-500 block">kcal</span>
                  </div>
                </div>

                <div className="bg-slate-950/40 p-3.5 rounded-2xl border border-slate-800/50 flex items-center justify-between">
                  <div>
                    <span className="text-xs text-slate-300 block font-medium flex items-center gap-1">
                      <Footprints className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Vận động phụ (NEAT)</span>
                    </span>
                    <span className="text-emerald-500/70 text-[10px] font-mono">
                      {activeProfile.dailySteps?.toLocaleString() || 0} bước chân / ngày
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-base font-bold font-mono text-emerald-400">+{stepsBurn}</span>
                    <span className="text-[10px] text-slate-500 block">kcal</span>
                  </div>
                </div>

                <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-750 flex items-center justify-between">
                  <div>
                    <span className="text-xs text-amber-300 font-semibold block">Tổng TDEE Thực Tế</span>
                    <span className="text-slate-500 text-[10px]">Tổng năng lượng tiêu thụ/ngày</span>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-black font-mono text-amber-400">{tdee}</span>
                    <span className="text-[10px] text-slate-500 block">kcal</span>
                  </div>
                </div>

                <div className="bg-emerald-500/5 p-4 rounded-2xl border border-emerald-500/20 flex items-center justify-between mt-1">
                  <div>
                    <span className="text-xs text-emerald-400 font-bold block">Mục tiêu Calo đề xuất</span>
                    <span className="text-emerald-500/60 text-[10px]">Phù hợp với mục tiêu giảm/tăng cân</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xl font-black font-mono text-emerald-400">{targetMacros.calories}</span>
                    <span className="text-xs text-emerald-500 block font-semibold">kcal / ngày</span>
                  </div>
                </div>

              </div>
            </div>

            {targetMacros.isAdjustedForSafety && (
              <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-[11px] text-amber-300 flex gap-2">
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                <span>Lưu ý: Mục tiêu calo đã được tự động điều chỉnh tăng để đảm bảo lượng Carb tối thiểu cho hoạt động não bộ và cơ bắp.</span>
              </div>
            )}
          </div>

          <div className="bg-slate-900/60 rounded-3xl border border-slate-800/80 p-6 lg:col-span-2 shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
              <Apple className="w-32 h-32" />
            </div>

            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-slate-400 font-mono text-xs uppercase tracking-wider">
                <Flame className="w-4 h-4 text-emerald-400" />
                <span>Tiến Độ Bữa Ăn Hôm Nay</span>
              </div>
              <button 
                onClick={handleResetLogs}
                disabled={activeLogs.length === 0}
                className="text-xs flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700/50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Làm mới ngày</span>
              </button>
              <button
  onClick={() => setShowQuickMealModal(true)}
  className="text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 font-bold px-3 py-1.5 rounded-xl flex items-center gap-1"
>
  <Sparkles className="w-3.5 h-3.5" />
  <span>Gợi ý thực đơn</span>
</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              
              <div className="flex flex-col items-center justify-center p-4 bg-slate-950/40 rounded-2xl border border-slate-800/60 text-center">
                <span className="text-xs font-semibold text-slate-400 mb-2">Tổng Calo Nạp Vào</span>
                
                <div className="relative w-32 h-32 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="40" stroke="#1e293b" strokeWidth="8" fill="transparent" />
                    <circle 
                      cx="50" cy="50" r="40" stroke="#22c55e" strokeWidth="8" fill="transparent" strokeDasharray="251.2"
                      strokeDashoffset={251.2 - (251.2 * Math.min(100, (consumedCalories / targetMacros.calories) * 100)) / 100}
                      strokeLinecap="round" className="transition-all duration-1000 ease-out"
                    />
                  </svg>
                  
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-lg font-black font-mono tracking-tight text-white">{consumedCalories}</span>
                    <span className="text-[10px] text-slate-400 uppercase tracking-widest">/ {targetMacros.calories}</span>
                  </div>
                </div>

                <span className="text-xs font-mono font-bold text-emerald-400 mt-2">
                  {Math.round((consumedCalories / targetMacros.calories) * 100)}% mục tiêu
                </span>
              </div>

              <div className="md:col-span-3 flex flex-col justify-between space-y-4">
                
                <div className="bg-slate-950/30 p-3 rounded-2xl border border-slate-800/40">
                  <div className="flex justify-between items-center text-xs mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-pink-500" />
                      <span className="font-semibold text-slate-200">Protein (Chất đạm)</span>
                      <span className="text-[10px] text-slate-400 font-mono">Xây dựng cơ</span>
                    </div>
                    <span className="font-mono text-slate-300">
                      <strong>{consumedProtein}g</strong> / {targetMacros.protein}g ({targetMacros.proteinPercent}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                    <div className="bg-pink-500 h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(100, (consumedProtein / targetMacros.protein) * 100)}%` }} />
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                    <span>Đã nạp {Math.round((consumedProtein * 4))} kcal</span>
                    <span>{proteinGap > 0 ? `Còn thiếu ${proteinGap}g` : 'Đã đạt mục tiêu! ✓'}</span>
                  </div>
                </div>

                <div className="bg-slate-950/30 p-3 rounded-2xl border border-slate-800/40">
                  <div className="flex justify-between items-center text-xs mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                      <span className="font-semibold text-slate-200">Carbs (Tinh bột)</span>
                      <span className="text-[10px] text-slate-400 font-mono">Năng lượng tập</span>
                    </div>
                    <span className="font-mono text-slate-300">
                      <strong>{consumedCarbs}g</strong> / {targetMacros.carbs}g ({targetMacros.carbsPercent}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                    <div className="bg-amber-500 h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(100, (consumedCarbs / targetMacros.carbs) * 100)}%` }} />
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                    <span>Đã nạp {Math.round((consumedCarbs * 4))} kcal</span>
                    <span>{carbsGap > 0 ? `Còn thiếu ${carbsGap}g` : 'Đã đạt mục tiêu! ✓'}</span>
                  </div>
                </div>

                <div className="bg-slate-950/30 p-3 rounded-2xl border border-slate-800/40">
                  <div className="flex justify-between items-center text-xs mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                      <span className="font-semibold text-slate-200">Fat (Chất béo)</span>
                      <span className="text-[10px] text-slate-400 font-mono">Hormone & Sức khỏe</span>
                    </div>
                    <span className="font-mono text-slate-300">
                      <strong>{consumedFat}g</strong> / {targetMacros.fat}g ({targetMacros.fatPercent}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                    <div className="bg-blue-500 h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(100, (consumedFat / targetMacros.fat) * 100)}%` }} />
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                    <span>Đã nạp {Math.round((consumedFat * 9))} kcal</span>
                    <span>{fatGap > 0 ? `Còn thiếu ${fatGap}g` : 'Đã đạt mục tiêu! ✓'}</span>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>

        {/* Bento Grid: Meals Logger vs Smart Gap Suggestion */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-slate-900/60 rounded-3xl border border-slate-800/80 p-6 shadow-lg">
              <div className="flex justify-between items-center mb-5">
                <div className="flex items-center gap-2">
                  <Apple className="w-5 h-5 text-emerald-400" />
                  <h3 className="text-lg font-bold font-display text-white">Ghi Nhật Ký Ăn Uống</h3>
                </div>
                <button
                  onClick={() => setShowCustomFoodModal(true)}
                  className="text-xs bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 font-medium px-3 py-1.5 rounded-xl flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tự thêm món mới</span>
                </button>
              </div>

              <form onSubmit={handleAddLog} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1 font-semibold">Tìm thực phẩm sạch</label>
                    <input type="text" placeholder="Tìm ứng gà, yến mạch, cơm..." value={foodSearch} onChange={e => setFoodSearch(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500" />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1 font-semibold">Nhóm dinh dưỡng</label>
                    <div className="grid grid-cols-4 gap-1">
                      {['all', 'protein', 'carbs', 'fats'].map(cat => (
                        <button key={cat} type="button" onClick={() => setSelectedCategoryFilter(cat)} className={`py-1.5 rounded-lg text-xs font-semibold capitalize border transition-all ${selectedCategoryFilter === cat ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'}`}>
                          {cat === 'all' ? 'Tất cả' : cat === 'protein' ? 'Đạm' : cat === 'carbs' ? 'Carb' : 'Béo'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs text-slate-400 mb-1 font-semibold">Chọn món ăn</label>
                  <div className="flex gap-2">
                    <select value={selectedFoodId} onChange={e => setSelectedFoodId(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500" required>
                      <option value="">-- Click để chọn thực phẩm --</option>
                      {filteredFoods.map(food => (
                        <option key={food.id} value={food.id}>
                          {food.name} ({food.protein}P | {food.carbs}C | {food.fat}F / {food.unit})
                        </option>
                      ))}
                    </select>
                    {selectedFoodId && foodDatabase.find(f => f.id === selectedFoodId)?.isCustom && (
                      <button type="button" onClick={(e) => handleDeleteCustomFood(selectedFoodId, e)} className="px-3 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl transition-colors cursor-pointer shrink-0 flex items-center justify-center" title="Xóa món ăn này khỏi kho">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

               <div className="sm:col-span-2">
                  <label className="block text-xs text-slate-400 mb-1 font-semibold">Khối lượng đã ăn (gram)</label>
                  <div className="relative">
                    <input
                      type="number"
                      min="1"
                      step="1"
                      placeholder="100"
                      value={logAmount}
                      onChange={e => setLogAmount(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500 pr-10"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 font-mono">g</span>
                  </div>
                  {selectedFoodId && (() => {
                    const food = foodDatabase.find(f => f.id === selectedFoodId);
                    const amt = parseFloat(logAmount);
                    if (!food || isNaN(amt) || amt <= 0) return null;
                    const m = amt / 100;
                    return (
                      <p className="text-[11px] text-slate-500 mt-1 font-mono">
                        {Math.round(food.calories * m)} kcal · {(food.protein * m).toFixed(1)}P · {(food.carbs * m).toFixed(1)}C · {(food.fat * m).toFixed(1)}F
                      </p>
                    );
                  })()}
                </div>

                <button type="submit" disabled={!selectedFoodId} className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold py-3 px-4 rounded-xl text-sm transition-all shadow-md disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 cursor-pointer">
                  <Plus className="w-4 h-4" />
                  <span>Thêm Vào Thực Đơn Hôm Nay</span>
                </button>
              </form>
            </div>

            <div className="bg-slate-900/60 rounded-3xl border border-slate-800/80 p-6 shadow-lg">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold font-display text-white flex items-center gap-2">
                  <span>Nhật Ký Thực Đơn Đã Ăn</span>
                  <span className="bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full text-xs font-mono">{activeLogs.length}</span>
                </h3>
                <span className="text-xs font-mono text-slate-400">
                  Tổng: <strong className="text-emerald-400">{consumedCalories} kcal</strong>
                </span>
              </div>

              {activeLogs.length === 0 ? (
                <div className="text-center py-12 bg-slate-950/30 rounded-2xl border border-slate-800/40">
                  <Apple className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">Bạn chưa ghi chép món ăn nào hôm nay.</p>
                  <p className="text-xs text-slate-500 mt-1">Hãy chọn thực phẩm ở trên để bắt đầu theo dõi!</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                  <AnimatePresence initial={false}>
                    {activeLogs.map(log => (
                      <motion.div key={log.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -50 }} transition={{ duration: 0.2 }} className="p-3.5 bg-slate-950/60 hover:bg-slate-950/80 rounded-2xl border border-slate-800/80 flex items-center justify-between gap-4 transition-all">
                        <div className="min-w-0 flex-1">
                          <h4 className="text-sm font-semibold text-slate-200 truncate">{log.name}</h4>
                          <div className="flex items-center gap-3 text-slate-400 text-xs mt-1 flex-wrap">
                            <span className="font-mono bg-slate-900/80 px-2 py-0.5 rounded border border-slate-800/60">{log.amount}g</span>
                            <span className="text-pink-400 font-mono font-medium">{log.protein}g Đạm</span>
                            <span className="text-amber-400 font-mono font-medium">{log.carbs}g Carb</span>
                            <span className="text-blue-400 font-mono font-medium">{log.fat}g Béo</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <span className="font-mono font-bold text-slate-200 block text-sm">{log.calories}</span>
                            <span className="text-[9px] uppercase font-mono text-slate-500">kcal</span>
                          </div>
                          <button onClick={() => handleRemoveLog(log.id)} className="p-2 hover:bg-red-500/10 text-slate-500 hover:text-red-400 rounded-xl transition-colors cursor-pointer" title="Xóa nhật ký này">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-5 space-y-6">
            <div className="bg-slate-900/60 rounded-3xl border border-slate-800/80 p-6 shadow-lg relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                <Sparkles className="w-24 h-24 text-emerald-400" />
              </div>
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-5 h-5 text-emerald-400" />
                <h3 className="text-lg font-bold font-display text-white">Khoảng Trống Dinh Dưỡng</h3>
              </div>
              <p className="text-slate-400 text-xs mb-5">
                Lượng dinh dưỡng bạn cần nạp thêm từ bây giờ cho tới cuối ngày để đạt mục tiêu hoàn hảo.
              </p>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800/50">
                  <span className="text-slate-500 text-[10px] uppercase font-mono block">Năng Lượng Thiếu</span>
                  <span className={`text-xl font-bold font-mono ${caloriesGap > 0 ? 'text-emerald-400' : 'text-slate-400'}`}>{caloriesGap > 0 ? `+${caloriesGap}` : '0'} <span className="text-xs font-normal text-slate-500">kcal</span></span>
                </div>
                <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800/50">
                  <span className="text-slate-500 text-[10px] uppercase font-mono block">Chất Đạm Thiếu</span>
                  <span className={`text-xl font-bold font-mono ${proteinGap > 0 ? 'text-pink-400' : 'text-slate-400'}`}>{proteinGap > 0 ? `+${proteinGap}` : '0'} <span className="text-xs font-normal text-slate-500">g</span></span>
                </div>
                <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800/50">
                  <span className="text-slate-500 text-[10px] uppercase font-mono block">Tinh Bột Thiếu</span>
                  <span className={`text-xl font-bold font-mono ${carbsGap > 0 ? 'text-amber-400' : 'text-slate-400'}`}>{carbsGap > 0 ? `+${carbsGap}` : '0'} <span className="text-xs font-normal text-slate-500">g</span></span>
                </div>
                <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800/50">
                  <span className="text-slate-500 text-[10px] uppercase font-mono block">Chất Béo Thiếu</span>
                  <span className={`text-xl font-bold font-mono ${fatGap > 0 ? 'text-blue-400' : 'text-slate-400'}`}>{fatGap > 0 ? `+${fatGap}` : '0'} <span className="text-xs font-normal text-slate-500">g</span></span>
                </div>
              </div>

              {caloriesGap === 0 && proteinGap === 0 && carbsGap === 0 && fatGap === 0 && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-center text-xs text-emerald-400 font-semibold">
                  Chúc mừng! Bạn đã hoàn thành 100% mục tiêu dinh dưỡng hằng ngày! 🎉
                </div>
              )}
            </div>

            <div className="bg-slate-900/60 rounded-3xl border border-slate-800/80 p-6 shadow-lg">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-bold font-display text-white flex items-center gap-2">
                  <span>Gợi Ý Bù Đắp Macro</span>
                </h3>
                <span className="text-[10px] uppercase font-mono bg-emerald-500/15 text-emerald-400 px-2.5 py-0.5 rounded border border-emerald-500/20">
                  Thuật toán tối ưu
                </span>
              </div>
              <p className="text-slate-400 text-xs mb-5">
                Dưới đây là khối lượng thực phẩm sạch chính xác cần ăn thêm để lấp đầy khoảng trống dinh dưỡng ngày hôm nay:
              </p>

              {(proteinGap <= 2 && carbsGap <= 5 && fatGap <= 1) ? (
                <div className="text-center py-10 bg-slate-950/30 rounded-2xl border border-slate-800/40">
                  <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-emerald-400">Không cần bù đắp thêm!</p>
                  <p className="text-xs text-slate-500 mt-1">Cơ thể bạn đã nhận đủ lượng macro cần thiết ngày hôm nay.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {smartSuggestions.map((sug, i) => (
                    <div key={i} className="p-4 bg-slate-950/50 border border-slate-800/80 rounded-2xl flex flex-col justify-between hover:border-slate-700 transition-all relative group">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <span className="text-[10px] uppercase tracking-wider font-semibold font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/15">
                            {sug.foodItem.category === 'protein' ? '🍗 Bổ sung Đạm' : sug.foodItem.category === 'carbs' ? '🍠 Bổ sung Carb' : '🥑 Bổ sung Chất Béo'}
                          </span>
                          <h4 className="text-sm font-bold text-white mt-1.5 flex items-center gap-1">
                            <span>Thêm {sug.amountGrams}g {sug.foodItem.name}</span>
                          </h4>
                        </div>
                        <div className="text-right">
                          <span className="font-mono text-xs font-bold text-slate-300 block">+{sug.caloriesAdded}</span>
                          <span className="text-[9px] uppercase font-mono text-slate-500">kcal</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 py-2 border-y border-slate-850 my-1 text-[11px] font-mono text-slate-400">
                        <div>Đạm: <strong className="text-pink-400">+{sug.proteinAdded}g</strong></div>
                        <div>Carb: <strong className="text-amber-400">+{sug.carbsAdded}g</strong></div>
                        <div>Béo: <strong className="text-blue-400">+{sug.fatAdded}g</strong></div>
                      </div>
                      <div className="flex justify-end mt-3">
                        <button onClick={() => handleApplySuggestion(sug.foodItem, sug.amountGrams)} className="text-xs bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold px-4 py-2 rounded-xl flex items-center gap-1 shadow transition-all cursor-pointer">
                          <Plus className="w-3.5 h-3.5" />
                          <span>Áp dụng nhanh</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <AnimatePresence>
        {showCustomFoodModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl relative">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold font-display text-white flex items-center gap-2">
                  <Apple className="w-5 h-5 text-emerald-400" />
                  <span>Thêm Thực Phẩm Cá Nhân</span>
                </h3>
                <button onClick={() => setShowCustomFoodModal(false)} className="text-slate-400 hover:text-slate-200 text-sm p-1 hover:bg-slate-800 rounded-lg cursor-pointer">
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateCustomFood} className="space-y-4">
                <div className="flex flex-col gap-2 mb-4">
                  <div className="flex items-start gap-2">
                    {!recognizedText ? (
                      <button type="button" onClick={isRecording ? stopRecording : startRecording} className={`p-2.5 rounded-xl border transition-all flex items-center gap-2 ${isRecording ? 'bg-red-500/20 border-red-500 animate-pulse text-red-400' : 'bg-slate-800/60 border-slate-700 hover:bg-slate-700 text-slate-400'}`} title={isRecording ? 'Bấm để chốt câu' : 'Nói để điền món ăn'}>
                        {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                        <span className="text-xs font-semibold">{isRecording ? 'Đang nghe... (Bấm để chốt)' : 'Dùng Giọng Nói'}</span>
                      </button>
                    ) : (
                      <div className="flex flex-col gap-2 bg-slate-900 border border-emerald-500/30 p-3 rounded-xl w-full">
                        <span className="text-xs text-slate-300 font-mono italic">" {recognizedText} "</span>
                        <div className="flex gap-2 mt-1">
                          <button type="button" onClick={() => {
                            const parsed = parseVoiceFoodInput(recognizedText);
                            if (parsed) {
                              const calculatedCal = Math.round(parsed.protein * 4 + parsed.carbs * 4 + parsed.fat * 9);
                              const newFood = { id: `custom_${Date.now()}`, name: parsed.name, category: 'custom' as FoodCategory, protein: parsed.protein, carbs: parsed.carbs, fat: parsed.fat, calories: calculatedCal, unit: `${parsed.amount}g`, isCustom: true };
                              setFoodDatabase(prev => [newFood, ...prev]);
                              setSelectedFoodId(newFood.id);
                              cancelAudio();
                              setShowCustomFoodModal(false);
                            } else {
                              alert("❌ Không nhận ra đủ thông số Đạm/Carb/Béo. Fen nói lại nhé!");
                            }
                          }} className="px-3 py-1.5 bg-emerald-500 text-slate-950 text-xs font-bold rounded-lg hover:bg-emerald-600 transition">
                            Tạo món & Chọn luôn
                          </button>
                          <button type="button" onClick={cancelAudio} className="px-3 py-1.5 bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-400 text-xs font-semibold rounded-lg transition">
                            Nói lại
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  {error && <span className="text-xs text-red-400 bg-red-500/10 p-2 rounded-lg border border-red-500/20">{error}</span>}
                </div>
                   <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Tên món ăn</label>
                  <input
                    type="text"
                    placeholder="Ví dụ: Ức gà áp chảo"
                    value={customFoodForm.name}
                    onChange={e => setCustomFoodForm({ ...customFoodForm, name: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
                    required
                  />
                </div>    
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Nhóm dinh dưỡng</label>
                    <select value={customFoodForm.category} onChange={e => setCustomFoodForm({ ...customFoodForm, category: e.target.value as FoodCategory })} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500">
                      <option value="protein">Đạm (Protein-rich)</option>
                      <option value="carbs">Tinh bột (Carb-rich)</option>
                      <option value="fats">Chất béo (Fat-rich)</option>
                      <option value="custom">Hỗn hợp / Khác</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Đơn vị đo lường</label>
                    <input type="text" placeholder="100g, 1 muỗng, 1 hộp..." value={customFoodForm.unit} onChange={e => setCustomFoodForm({ ...customFoodForm, unit: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500" required />
                  </div>
                </div>

                <div className="p-3 bg-slate-950/40 rounded-2xl border border-slate-800/60">
                  <span className="block text-xs font-semibold text-slate-400 mb-2">Giá trị dinh dưỡng (Tính trên đơn vị đo lường đã nhập)</span>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[10px] text-pink-400 mb-1 font-mono">Đạm (g)</label>
                      <input type="number" step="0.1" min="0" placeholder="0" value={customFoodForm.protein} onChange={e => setCustomFoodForm({ ...customFoodForm, protein: e.target.value })} className="w-full bg-slate-900 border border-slate-850 rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 font-mono text-center" />
                    </div>
                    <div>
                      <label className="block text-[10px] text-amber-400 mb-1 font-mono">Tinh bột (g)</label>
                      <input type="number" step="0.1" min="0" placeholder="0" value={customFoodForm.carbs} onChange={e => setCustomFoodForm({ ...customFoodForm, carbs: e.target.value })} className="w-full bg-slate-900 border border-slate-850 rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 font-mono text-center" />
                    </div>
                    <div>
                      <label className="block text-[10px] text-blue-400 mb-1 font-mono">Chất béo (g)</label>
                      <input type="number" step="0.1" min="0" placeholder="0" value={customFoodForm.fat} onChange={e => setCustomFoodForm({ ...customFoodForm, fat: e.target.value })} className="w-full bg-slate-900 border border-slate-850 rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 font-mono text-center" />
                    </div>
                  </div>
                  <div className="mt-3">
                    <label className="block text-[10px] text-slate-400 mb-1 font-mono">Năng lượng (kcal) - Để trống để tự tính</label>
                    <input type="number" placeholder="Tự động tính toán" value={customFoodForm.calories} onChange={e => setCustomFoodForm({ ...customFoodForm, calories: e.target.value })} className="w-full bg-slate-900 border border-slate-850 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 font-mono" />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button type="submit" className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold py-2.5 rounded-xl text-sm transition-colors cursor-pointer">
                    Thêm Vào Kho Thực Phẩm
                  </button>
                  <button type="button" onClick={() => setShowCustomFoodModal(false)} className="bg-slate-850 hover:bg-slate-800 text-slate-300 font-semibold px-4 py-2.5 rounded-xl text-sm transition-colors cursor-pointer">
                    Hủy
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {showQuickMealModal && (
  <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full space-y-4">
      <h3 className="text-lg font-bold font-display text-white">Gợi ý thực đơn nhanh</h3>
      <p className="text-xs text-slate-400">Chọn 1 nguồn mỗi nhóm, hệ thống tự tính gram cần ăn để đủ macro còn lại hôm nay.</p>

      {(['protein', 'carbs', 'fats'] as const).map(cat => (
        <div key={cat}>
          <label className="text-xs font-bold text-slate-400 uppercase">{cat === 'protein' ? 'Đạm' : cat === 'carbs' ? 'Tinh bột' : 'Chất béo'}</label>
          <select
            value={quickMealPick[cat] || ''}
            onChange={e => setQuickMealPick({ ...quickMealPick, [cat]: e.target.value })}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 mt-1"
          >
            <option value="">-- Chọn --</option>
            {foodDatabase.filter(f => f.category === cat).map(f => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
        </div>
      ))}

      <div className="flex gap-2 pt-2">
        <button
          onClick={() => { setShowQuickMealModal(false); setQuickMealPick({}); }}
          className="flex-1 py-2 rounded-xl bg-slate-800 text-slate-300 text-sm font-bold"
        >
          Huỷ
        </button>
        <button
          disabled={!quickMealPick.protein || !quickMealPick.carbs || !quickMealPick.fats}
          onClick={() => {
            const p = foodDatabase.find(f => f.id === quickMealPick.protein);
            const c = foodDatabase.find(f => f.id === quickMealPick.carbs);
            const fat = foodDatabase.find(f => f.id === quickMealPick.fats);
            if (p && c && fat) handleApplyQuickMealPlan(p, c, fat);
          }}
          className="flex-1 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-bold disabled:opacity-40"
        >
          Áp dụng
        </button>
      </div>
    </div>
  </div>
)}
    </div>
  );
}