import * as THREE from 'three';
// ★ポストプロセッシング（光らせるエフェクト）の読み込み
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

// ===== 1. 通信設定（あなたのRender URLに書き換えてください） =====
const SERVER_URL = 'https://threederea.onrender.com';
const socket = io(SERVER_URL);

// ===== 2. UI要素の取得 =====
const canvas = document.querySelector('#webgl-canvas');
const lobbyScreen = document.getElementById('lobby-screen');
const battleScreen = document.getElementById('battle-screen');
const lobbyMsg = document.getElementById('lobby-msg');
const log = document.getElementById('log');
const myHpDisplay = document.getElementById('my-hp');
const enemyHpDisplay = document.getElementById('enemy-hp');
const handArea = document.getElementById('hand-area');
const judgementPanel = document.getElementById('judgement-panel');

// バトル画面のカード画像
const myCardVisual = document.getElementById('my-card');
const enemyCardVisual = document.getElementById('enemy-card');

// カード画像URLの定義
const cardImages = {
  0: 'https://i.imgur.com/39wF4uG.png', // Bluff (Neon Mask)
  1: 'https://i.imgur.com/QeN8I9N.png'  // Attack (Neon Blue Sword)
};


// ===== 3. Three.jsの空間作り (かっこよくアップデート) =====
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000); // 完全に真っ黒（ネオンを際立たせる）

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 10, 15); // ちょっと遠くから見下ろす感じ
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

// ★ポストプロセッシングの設定 (Bloom = 光があふれ出すエフェクト)
const renderScene = new RenderPass(scene, camera);
const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
bloomPass.threshold = 0; // すべての光に対して
bloomPass.strength = 1.0; // 光の強さ
bloomPass.radius = 0.5; // 光の広がり

const composer = new EffectComposer(renderer);
composer.addPass(renderScene);
composer.addPass(bloomPass);


// 光源の設定 (ネオンっぽい光源を追加)
const ambientLight = new THREE.AmbientLight(0xff007a, 0.1); // ベースにピンクっぽい光
scene.add(ambientLight);

// 青色のネオン点光源
const pointLight = new THREE.PointLight(0x00ddff, 1, 30);
pointLight.position.set(0, 5, 0);
scene.add(pointLight);


// とりあえずの地面（ネオンのグリッド）
const gridHelper = new THREE.GridHelper(100, 50, 0x111111, 0xff007a);
gridHelper.position.y = -1;
scene.add(gridHelper);

// 自分の仮アバター（光るピンクのトーラス）
const geometry = new THREE.TorusKnotGeometry(2, 0.5, 100, 16);
const material = new THREE.MeshStandardMaterial({ color: 0xff007a, emissive: 0x550022, metalness: 0.9, roughness: 0.1 });
const playerMesh = new THREE.Mesh(geometry, material);
playerMesh.position.set(0, 3, 0);
scene.add(playerMesh);


// ===== 4. 画面サイズ変更時の対応 =====
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
});


// ===== 5. 毎フレームの描画ループ =====
function tick() {
  requestAnimationFrame(tick);
  playerMesh.rotation.x += 0.005;
  playerMesh.rotation.y += 0.005; // アバターをクルクル回す
  
  // renderer.render ではなく composer.render を使う
  composer.render();
}
tick(); // ここで描画スタート！


// ===== 6. カードゲームのロジック =====
let currentRoomId = null;
let isPlayer1 = false;

window.createRoom = () => {
  socket.emit('createRoom');
  isPlayer1 = true;
};

window.joinRoom = () => {
  const roomId = document.getElementById('room-input').value;
  if(roomId) {
    socket.emit('joinRoom', roomId);
    currentRoomId = roomId;
    isPlayer1 = false;
  }
};

window.playCPU = () => {
  socket.emit('playCPU');
  isPlayer1 = true;
};

// --- ① フェーズ1: カードを伏せる操作 ---
window.faceDownCard = (cardNumber) => {
  // 手札エリアを隠す
  handArea.classList.add('hidden');
  log.innerText = 'カードを伏せました。相手を待っています...';
  
  // バトルボードの自分の伏せ札を「裏面」画像にする
  myCardVisual.style.backgroundImage = "url('https://i.imgur.com/L4LqXfI.png')";
  myCardVisual.classList.add('facedown'); // 裏面用のCSS

  socket.emit('faceDownCard', { roomId: currentRoomId, card: cardNumber });
};

// --- ③ フェーズ2: 判定を送る操作 ---
window.submitJudgement = (judgementNumber) => {
  // 判定パネルを隠す
  judgementPanel.style.display = 'none';
  log.innerText = '相手のカードを鑑定しています...';
  socket.emit('submitJudgement', { roomId: currentRoomId, judgement: judgementNumber });
};


// ----- サーバーからの受信（新しいフェーズに対応） -----
socket.on('connect', () => {
  console.log('🟢 サーバーに接続完了！ ID:', socket.id);
});

socket.on('roomCreated', (roomId) => {
  currentRoomId = roomId;
  lobbyMsg.innerText = `部屋番号【 ${roomId} 】待機中...`;
});

socket.on('gameStart', (msg) => {
  lobbyScreen.classList.add('hidden');
  battleScreen.classList.remove('hidden');
  log.innerText = msg;
  // ★重要: 初期HPを満タンに
  myHpDisplay.innerText = "❤️❤️❤️";
  enemyHpDisplay.innerText = "❤️❤️❤️";
});

socket.on('errorMsg', (msg) => {
  lobbyMsg.innerText = msg;
});

// ★判定フェーズに移行
socket.on('judgementPhase', () => {
  log.innerText = '【審判フェーズ】相手は真実(ATTACK)か嘘(BLUFF)か？';
  // 手前のUIパネルを表示
  judgementPanel.style.display = 'block';
});

// ★ターン結果の受信と解決フェーズ
socket.on('turnResult', (data) => {
  let myHp, enemyHp, myCard, enemyCard;
  if (isPlayer1) {
    myHp = data.p1Hp; enemyHp = data.p2Hp;
    myCard = data.p1Card; enemyCard = data.p2Card;
  } else {
    myHp = data.p2Hp; enemyHp = data.p1Hp;
    myCard = data.p2Card; enemyCard = data.p1Card;
  }

  // 1️⃣ 裏向きのカードを「オープン」画像にする
  myCardVisual.style.backgroundImage = `url('${cardImages[myCard]}')`;
  myCardVisual.classList.add('revealed'); // 光るエフェクトを追加
  enemyCardVisual.style.backgroundImage = `url('${cardImages[enemyCard]}')`;
  enemyCardVisual.classList.add('revealed');

  // 2️⃣ HPとメッセージを表示
  myHpDisplay.innerText = myHp;
  enemyHpDisplay.innerText = enemyHp;
  log.innerHTML = `＜結果発表＞<br>${data.message}`;

  // 3️⃣ 3秒後に次のターンへリセット
  setTimeout(() => {
    // UIを初期に戻す
    handArea.classList.remove('hidden'); // 手札を出す
    judgementPanel.style.display = 'none'; // 判定パネルを隠す
    log.innerText = '新しいターンが始まった。カードを伏せろ。';

    // バトルボードのカードを初期化（消す、または再び伏せる）
    myCardVisual.style.backgroundImage = 'none';
    myCardVisual.classList.remove('facedown', 'revealed');
    enemyCardVisual.style.backgroundImage = 'none';
    enemyCardVisual.classList.remove('facedown', 'revealed');

  }, 3000); // 結果発表を3秒間見せる
});

socket.on('gameOver', (winner) => {
  // 手札も判定パネルも隠す
  handArea.style.display = 'none';
  judgementPanel.style.display = 'none';
  let resultText = '';
  
  if (winner === 'Draw') resultText = '審判不能。引き分けだ...。';
  else if ((isPlayer1 && winner === 'P1') || (!isPlayer1 && winner === 'P2')) resultText = '🎉 あなたの勝利だ！！';
  else resultText = '💀 あなたの敗北...。';

  log.innerHTML = `<span style="color:yellow; font-size:30px; text-shadow:0 0 10px yellow;">${resultText}</span><br><br><button onclick="location.reload()" class="card-btn" style="pointer-events: auto;">トップに戻る</button>`;
});
