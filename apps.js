/*
 * アプリの追加・編集はこのファイルだけで完結します。
 * category は CATEGORIES の id、order はカテゴリ内の表示順です。
 */
window.GALLERY_DATA = {
  categories: [
    { id: "history", label: "HISTORY", order: 1 },
    { id: "certification", label: "CERTIFICATION", order: 2 },
    { id: "game", label: "GAME", order: 3 }
  ],

  apps: [
    {
      id: "history-1st-grade",
      category: "history",
      order: 1,
      icon: "🛕",
      title: "歴史能力検定1級日本史過去問",
      description: "歴史能力検定日本史1級の過去問にトライ",
      url: "https://eikoeigoenglish-star.github.io/rin-japanese-history-1st-grade/"
    },
    {
      id: "history-2nd-grade",
      category: "history",
      order: 2,
      icon: "⛩️",
      title: "歴史能力検定2級日本史過去問",
      description: "歴史能力検定日本史2級の過去問にトライ",
      url: "https://eikoeigoenglish-star.github.io/rin-japanese-history-2nd-grade/"
    },
    {
      id: "history-four-choice",
      category: "history",
      order: 3,
      icon: "4️⃣",
      title: "日本史4択",
      description: "歴史能力検定日本史に出そうな語句の4択にトライ",
      url: "https://eikoeigoenglish-star.github.io/rin-japanese-history-quiz/"
    },
    {
      id: "history-mock-exam",
      category: "history",
      order: 4,
      icon: "✏️",
      title: "歴史能力検定1級日本史模試",
      description: "歴史能力検定日本史1級の模試にトライ",
      url: "https://eikoeigoenglish-star.github.io/rin-japanese-history-1st-grade-mock-exam/index.html"
    },
    {
      id: "travel-supervisor",
      category: "certification",
      order: 1,
      icon: "🚆",
      title: "国内旅行業務取扱管理者過去問",
      description: "国内旅行業務取扱管理者の過去問にトライ",
      url: "https://eikoeigoenglish-star.github.io/certified-travel-supervisor-qa/"
    },
    {
      id: "kyoto-kentei",
      category: "certification",
      order: 2,
      icon: "📿",
      title: "京都検定2級過去問",
      description: "京都検定2級の過去問にトライ",
      url: "https://eikoeigoenglish-star.github.io/kyoto-kentei/"
    },
    {
      id: "chain-burst",
      category: "game",
      order: 1,
      icon: "🔵",
      title: "Chain Burst",
      description: "爆発をチェインさせろ",
      url: "https://eikoeigoenglish-star.github.io/chainburst/"
    },
    {
      id: "forest-school",
      category: "game",
      order: 2,
      icon: "🐵",
      title: "森の学校",
      description: "森の学校の動物たちと触れ合おう",
      url: "https://eikoeigoenglish-star.github.io/forest-school/"
    }
  ]
};
