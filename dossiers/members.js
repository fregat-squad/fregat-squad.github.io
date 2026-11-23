// Demo folders. For real members place images in dossiers/<id>/ and set
// portrait, optional profile (second angle), and photos[].src relative to index.html.
window.fregatDossiers = [
  {
    id: "echo", name: "Эхо", code: "FS—001", reward: 85000,
    demo: true, role: "Музыка", portrait: "",
    description: "Появляется вместе с первым басом.\nЗнает, кто пропустил вступление. Даже если это был он сам.\nХарактер ровный. Громкость — по настроению.",
    photos: [
      { src: "media/fregat-cafe.jpg", caption: "Кафе «Фрегат»" },
      { src: "media/pitabaik1.gif", caption: "Питбайк на закате" },
      { src: "media/logo.jpg", caption: "Знак сквада" }
    ]
  },
  {
    id: "kontur", name: "Контур", code: "FS—002", reward: 145000,
    demo: true, role: "Фото", portrait: "",
    description: "В кадр попадает редко. Обычно держит камеру.\nПросит повторить трюк, когда все уже разошлись.\nУтверждает, что горизонт был именно такой.",
    photos: [
      { src: "media/pitbaik2.gif", caption: "Покатушки · второй кадр" },
      { src: "media/pitbaik3.gif", caption: "Покатушки · третий кадр" },
      { src: "media/pitabaik1.gif", caption: "Вечерний свет" }
    ]
  },
  {
    id: "signal", name: "Сигнал", code: "FS—003", reward: 275000,
    demo: true, role: "Аркада", portrait: "",
    description: "Первым занимает место за столом.\nКаждое поражение считает разминкой.\nНа вопрос о реванше уже раздаёт карты.",
    photos: [
      { src: "media/steersman.png", caption: "Steersman" },
      { src: "media/durak/hearts-A.png", caption: "Туз червей" }
    ]
  }
];

// Twelve side posters, in reading order on each side, plus the reserved centre.
const reservedRewards = [42000, 310000, 73000, 96000, 220000, 54000, 185000, 112000, 390000];
reservedRewards.forEach((reward, index) => {
  const number = String(index + 4).padStart(2, "0");
  window.fregatDossiers.push({
    id: "crew-" + number, name: "Участник " + number, code: "FS—0" + number,
    reserved: true, portrait: "dossiers/unknown.png", reward
  });
});
window.fregatDossiers.push({
  id: "boss", name: "DJ FREGAT", code: "FS—000", chief: true, reserved: true,
  role: "Глава сквада", portrait: "dossiers/unknown.png", reward: 1000000
});
