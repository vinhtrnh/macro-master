import { FoodItem, Profile } from './types';

export const DEFAULT_FOOD_ITEMS: FoodItem[] = [
  // Protein Rich
  {
    id: 'f1',
    name: 'Ức gà (Sống)',
    category: 'protein',
    protein: 22.5,
    carbs: 0.0,
    fat: 2.6,
    calories: 120,
    unit: '100g'
  },
  {
    id: 'f2',
    name: 'Má đùi gà lột da (Sống)',
    category: 'protein',
    protein: 20.0,
    carbs: 0.0,
    fat: 4.0,
    calories: 120,
    unit: '100g'
  },
  {
    id: 'f3',
    name: 'Cá Basa phi lê (Đông lạnh)',
    category: 'protein',
    protein: 15.0,
    carbs: 0.0,
    fat: 7.0,
    calories: 130,
    unit: '100g'
  },
  {
    id: 'f4',
    name: 'Thịt bò (Thăn/Bắp) (Sống)',
    category: 'protein',
    protein: 21.0,
    carbs: 0.0,
    fat: 7.0,
    calories: 150,
    unit: '100g'
  },
  {
    id: 'f5',
    name: 'Thịt heo nạc (Thăn/Dăm)',
    category: 'protein',
    protein: 21.0,
    carbs: 0.0,
    fat: 6.0,
    calories: 143,
    unit: '100g'
  },
  {
    id: 'f6',
    name: 'Tôm sú / thẻ lột vỏ (Sống)',
    category: 'protein',
    protein: 20.0,
    carbs: 0.0,
    fat: 1.0,
    calories: 100,
    unit: '100g'
  },
  {
    id: 'f7',
    name: 'Lòng trắng trứng',
    category: 'protein',
    protein: 10.9,
    carbs: 0.7,
    fat: 0.2,
    calories: 52,
    unit: '100g'
  },
  // Carbs Rich (Trái cây)
  {
    id: 'f8',
    name: 'Chuối chín',
    category: 'carbs',
    protein: 1.1,
    carbs: 22.8,
    fat: 0.3,
    calories: 89,
    unit: '100g'
  },
  {
    id: 'f9',
    name: 'Thanh long ruột đỏ',
    category: 'carbs',
    protein: 1.2,
    carbs: 13.0,
    fat: 0.4,
    calories: 60,
    unit: '100g'
  },
  {
    id: 'f10',
    name: 'Dưa hấu ruột đỏ',
    category: 'carbs',
    protein: 0.6,
    carbs: 7.6,
    fat: 0.2,
    calories: 30,
    unit: '100g'
  },
  // Fats Rich
  {
    id: 'f11',
    name: 'Trứng gà nguyên',
    category: 'fats',
    protein: 12.6,
    carbs: 0.8,
    fat: 9.6,
    calories: 144,
    unit: '100g'
  },
  {
    id: 'f12',
    name: 'Sữa chua HL nhà làm',
    category: 'fats',
    protein: 6.0,
    carbs: 4.0,
    fat: 6.6,
    calories: 102.6,
    unit: '100g'
  },
  {
    id: 'f13',
    name: 'Dầu Olive / Dầu ăn',
    category: 'fats',
    protein: 0.0,
    carbs: 0.0,
    fat: 100.0,
    calories: 900,
    unit: '100g'
  },
  {
    id: 'f14',
    name: 'Cơm trắng nhà nấu (Chín)',
    category: 'carbs',
    protein: 2.68,
    carbs: 30.2,
    fat: 0.26,
    calories: 138,
    unit: '100g'
  },
  {
    id: 'f15',
    name: 'Xôi trắng (Chín)',
    category: 'carbs',
    protein: 6.0,
    carbs: 65.0,
    fat: 1.0,
    calories: 300,
    unit: '100g'
  },
  {
    id: 'f16',
    name: 'Bánh mì đen/nguyên cám',
    category: 'carbs',
    protein: 10,
    carbs: 45,
    fat: 4,
    calories: 250,
    unit: '100g'
  },
  {
    id: 'f17',
    name: 'Yến mạch cán dẹp (Sống)',
    category: 'carbs',
    protein: 13,
    carbs: 66,
    fat: 6,
    calories: 380,
    unit: '100g'
  }
];
export const DEFAULT_PROFILES: Profile[] = [
  {
    id: 1,
    name: 'Vinh Drake',
    age: 26,
    gender: 'male',
    weight: 70,
    height: 172,
    activityLevel: 'moderately_active',
    goal: 'cut_standard',
    dailySteps: 9000
  },
  {
    id: 2,
    name: 'Bé ni',
    age: 27,
    gender: 'female',
    weight: 52,
    height: 152,
    activityLevel: 'moderately_active',
    goal: 'maintenance',
    dailySteps: 9000
  }
];
