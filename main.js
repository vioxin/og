import * as THREE from 'three';

// ===== 1. 通信設定（最初から繋いでおく） =====
const SERVER_URL = 'https://threederea.onrender.com';
const socket = io(SERVER_URL);

// ===== 2. UI要素の取得 =====
// 3D側のUI
const canvas = document.querySelector('#webgl-canvas');
const startScreen = document.querySelector('#start-screen');
const startButton = document.querySelector('#start-button');
const mainUi = document.querySelector('#main-ui'); // もし使わなければ後で消してOK

// ゲーム側のUI
const lobbyScreen = document.getElementById('lobby-screen');
const battleScreen = document.getElementById('battle-screen');
const lobbyMsg = document.getElementById('lobby-msg');
const log = document.getElementById('log');
const myHpDisplay = document.getElementById('my-hp');
const enemyHpDisplay = document.getElementById('enemy-hp');


// ===== 3. Three.jsの空間作り =====
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111122); // 暗い夜空のような色

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 5, 10);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 1);
dirLight.position.set(10, 20, 10);
scene.add(dirLight);

const gridHelper = new THREE.GridHelper(50, 50, 0x444455, 0x222233);
scene.add(gridHelper);

const geometry = new THREE.BoxGeometry(1, 2, 1);
const material = new THREE.MeshStandardMaterial({ color: 0x00ff88, emissive: 0x005522 });
const player = new THREE.Mesh(geometry, material);
player.position.y = 1;
scene.add(player);


// ===== 4. 画面サイズ変更時の対応 =====
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});


// ===== 5. 毎フレームの描画ループ =====
function tick() {
  requestAnimationFrame(tick);
  player.rotation.y += 0.01; // アバターをクルクル回す
  renderer.render(scene, camera);
}


// ===== 6. スタートボタンを押した時の処理 =====
// （※最初のスタート画面を入れている場合）
if (startButton) {
  startButton.addEventListener('click', () => {
    startScreen.classList.add('hidden');
    setTimeout(() => {
      startScreen.style.display = 'none';
      // もしゲームのロビー画面を最初隠しているなら、ここで表示する
      if (lobbyScreen) lobbyScreen.classList.remove('hidden');
    }, 1000);
    tick(); // ここで3Dの描画をスタート
  });
} else {
  // スタート画面がない場合は最初から3Dを動かす
  tick();
}


// ===== 7. カードゲーム（MIND-0）のロジック =====
let currentRoomId = null;
let isPlayer1 = false;

// ----- ロビーの操作 -----
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

// ----- サーバーからの受信 -----
socket.on('connect', () => {
  console.log('サーバーに接続しました！ ID:', socket.id);
});

socket.on('roomCreated', (roomId) => {
  currentRoomId = roomId;
  if (lobbyMsg) lobbyMsg.innerText = `部屋番号【 ${roomId} 】を友達に教えてください！待機中...`;
});

socket.on('gameStart', (msg) => {
  if (lobbyScreen) lobbyScreen.classList.add('hidden');
  if (battleScreen) battleScreen.classList.remove('hidden');
  if (log) log.innerText = msg + ' カードを選んでください。';
});

socket.on('errorMsg', (msg) => {
  if (lobbyMsg) lobbyMsg.innerText = msg;
});

// ----- バトルの操作 -----
window.playCard = (cardNumber) => {
  document.getElementById('hand').style.display = 'none';
  if (log) log.innerText = '相手の選択を待っています...';
  socket.emit('playCard', { roomId: currentRoomId, card: cardNumber });
};

socket.on('turnResult', (data) => {
  let myHp, enemyHp, myCard, enemyCard;
  if (isPlayer1) {
    myHp = data.p1Hp; enemyHp = data.p2Hp;
    myCard = data.p1Card; enemyCard = data.p2Card;
  } else {
    myHp = data.p2Hp; enemyHp = data.p1Hp;
    myCard = data.p2Card; enemyCard = data.p1Card;
  }

  if (myHpDisplay) myHpDisplay.innerText = myHp;
  if (enemyHpDisplay) enemyHpDisplay.innerText = enemyHp;
  if (log) log.innerHTML = `あなた: [${myCard}] vs 敵: [${enemyCard}]<br>👉 ${data.message}`;

  setTimeout(() => {
    document.getElementById('hand').style.display = 'block';
  }, 2000);
});

socket.on('gameOver', (winner) => {
  document.getElementById('hand').style.display = 'none';
  let resultText = '';
  
  if (winner === 'Draw') resultText = '引き分け！！';
  else if ((isPlayer1 && winner === 'P1') || (!isPlayer1 && winner === 'P2')) resultText = '🎉 あなたの勝ち！！';
  else resultText = '💀 あなたの負け...';

  if (log) log.innerHTML = `<span style="color:yellow; font-size:30px;">${resultText}</span><br><br><button onclick="location.reload()" class="card-btn">トップに戻る</button>`;
});