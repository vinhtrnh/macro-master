import { FoodItem, Profile } from './types';

export const DEFAULT_FOOD_ITEMS: FoodItem[] = [
  // Protein Rich
  {
    id: 'f1',
    name: 'Ức gà áp chảo',
    category: 'protein',
    protein: 31,
    carbs: 0,
    fat: 3.6,
    calories: 165,
    unit: '100g'
  },
  {
    id: 'f2',
    name: 'Thịt bò nạc nướng',
    category: 'protein',
    protein: 26,
    carbs: 0,
    fat: 7.0,
    calories: 170,
    unit: '100g'
  },
  {
    id: 'f3',
    name: 'Trứng gà luộc',
    category: 'protein',
    protein: 13,
    carbs: 1.1,
    fat: 11,
    calories: 155,
    unit: '100g'
  },
  {
    id: 'f4',
    name: 'Whey Protein Isolate',
    category: 'protein',
    protein: 80,
    carbs: 3,
    fat: 1,
    calories: 341,
    unit: '100g'
  },
  {
    id: 'f5',
    name: 'Đậu phụ (Tofu)',
    category: 'protein',
    protein: 8.0,
    carbs: 1.9,
    fat: 4.8,
    calories: 76,
    unit: '100g'
  },
  // Carbs Rich
  {
    id: 'f6',
    name: 'Khoai lang luộc',
    category: 'carbs',
    protein: 1.6,
    carbs: 20,
    fat: 0.1,
    calories: 86,
    unit: '100g'
  },
  {
    id: 'f7',
    name: 'Yến mạch ăn liền',
    category: 'carbs',
    protein: 16.9,
    carbs: 66,
    fat: 6.9,
    calories: 389,
    unit: '100g'
  },
  {
    id: 'f8',
    name: 'Cơm gạo lứt chín',
    category: 'carbs',
    protein: 2.6,
    carbs: 23,
    fat: 0.9,
    calories: 111,
    unit: '100g'
  },
  // Fats Rich
  {
    id: 'f9',
    name: 'Cá hồi áp chảo',
    category: 'fats',
    protein: 20,
    carbs: 0,
    fat: 13,
    calories: 208,
    unit: '100g'
  },
  {
    id: 'f10',
    name: 'Quả bơ tươi',
    category: 'fats',
    protein: 2.0,
    carbs: 8.5,
    fat: 15,
    calories: 160,
    unit: '100g'
  },
  {
    id: 'f11',
    name: 'Hạt lạc (Đậu phộng)',
    category: 'fats',
    protein: 26,
    carbs: 16,
    fat: 49,
    calories: 567,
    unit: '100g'
  }
];

export const DEFAULT_PROFILES: Profile[] = [
  {
    id: 1,
    name: 'Anh Tuấn (User 1)',
    age: 28,
    gender: 'male',
    weight: 75,
    height: 175,
    activityLevel: 'moderately_active',
    goal: 'cut_standard'
  },
  {
    id: 2,
    name: 'Mai Phương (User 2)',
    age: 26,
    gender: 'female',
    weight: 54,
    height: 158,
    activityLevel: 'lightly_active',
    goal: 'maintenance'
  }
];
