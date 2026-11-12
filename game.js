const setupScreen = document.getElementById('setupScreen');
const battleScreen = document.getElementById('battleScreen');
const resultScreen = document.getElementById('resultScreen');

const runnerNameInput = document.getElementById('runnerName');
const styleSelect = document.getElementById('styleSelect');
const difficultySelect = document.getElementById('difficultySelect');
const startButton = document.getElementById('startButton');
const nextBattleButton = document.getElementById('nextBattleButton');
const restartButton = document.getElementById('restartButton');

const dayLabel = document.getElementById('dayLabel');
const rankLabel = document.getElementById('rankLabel');

const playerNameEl = document.getElementById('playerName');
const enemyNameEl = document.getElementById('enemyName');
const playerMoodEl = document.getElementById('playerMood');
const enemyMoodEl = document.getElementById('enemyMood');
const playerHpBar = document.getElementById('playerHpBar');
const enemyHpBar = document.getElementById('enemyHpBar');
const playerChargeBar = document.getElementById('playerChargeBar');
const enemyChargeBar = document.getElementById('enemyChargeBar');
const playerHpReadout = document.getElementById('playerHpReadout');
const enemyHpReadout = document.getElementById('enemyHpReadout');
const playerChargeReadout = document.getElementById('playerChargeReadout');
const enemyChargeReadout = document.getElementById('enemyChargeReadout');
const battleLog = document.getElementById('battleLog');
const resultTitle = document.getElementById('resultTitle');
const resultSummary = document.getElementById('resultSummary');

const actionButtons = [...document.querySelectorAll('[data-action]')];

const state = {
  day: 1,
  player: null,
  enemy: null,
  battleOver: false,
  actionLock: false,
  result: null,
  previousOpponent: null,
};

const opponentPool = [
  { name: 'Neon Vex', style: 'burst' },
  { name: 'Mira Flux', style: 'balanced' },
  { name: 'Cinder Pike', style: 'guard' },
  { name: 'Velora Rune', style: 'burst' },
  { name: 'Talon Rook', style: 'balanced' },
  { name: 'Sable Hex', style: 'guard' },
];

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function pickOpponent() {
  const available = opponentPool.filter((opp) => opp.name !== state.previousOpponent);
  const next = available[Math.floor(Math.random() * available.length)] || opponentPool[0];
  state.previousOpponent = next.name;
  return { ...next };
}

function buildPlayerFromSetup() {
  const name = (runnerNameInput.value || 'Aster Nova').trim() || 'Aster Nova';
  const style = styleSelect.value;
  const difficulty = difficultySelect.value;

  const difficultyMap = {
    rookie: { hp: 110, power: 12, guard: 10, chargeRate: 18 },
    pro: { hp: 100, power: 14, guard: 12, chargeRate: 22 },
    legend: { hp: 95, power: 17, guard: 14, chargeRate: 26 },
  };

  const styleMap = {
    burst: { name: 'Burst', bonus: { power: 4, chargeRate: 8 } },
    balanced: { name: 'Balanced', bonus: { power: 2, damageTaken: 0.95, chargeRate: 4 } },
    guard: { name: 'Guard', bonus: { guard: 5, chargeRate: 3 } },
  };

  const config = difficultyMap[difficulty];
  const bonus = styleMap[style];

  return {
    name,
    style: style,
    styleName: bonus.name,
    hp: config.hp,
    maxHp: config.hp,
    charge: 0,
    maxCharge: 100,
    power: config.power + (bonus.bonus.power || 0),
    guard: config.guard + (bonus.bonus.guard || 0),
    chargeRate: config.chargeRate + (bonus.bonus.chargeRate || 0),
    lastAction: 'readied',
    mood: 'Ready',
    ai: false,
  };
}

function buildEnemyFromStyle(difficultyValue) {
  const difficulty = difficultyValue || difficultySelect.value;
  const difficultyMap = {
    rookie: { hp: 95, power: 13, guard: 11, chargeRate: 16 },
    pro: { hp: 105, power: 15, guard: 12, chargeRate: 18 },
    legend: { hp: 112, power: 18, guard: 14, chargeRate: 20 },
  };

  const styleBias = {
    burst: { power: 4, chargeRate: 7 },
    balanced: { power: 2, chargeRate: 4 },
    guard: { guard: 5, chargeRate: 2 },
  };

  const opponent = pickOpponent();
  const bias = styleBias[opponent.style] || styleBias.balanced;

  return {
    name: opponent.name,
    style: opponent.style,
    hp: difficultyMap[difficulty].hp,
    maxHp: difficultyMap[difficulty].hp,
    charge: 0,
    maxCharge: 100,
    power: difficultyMap[difficulty].power + (bias.power || 0),
    guard: difficultyMap[difficulty].guard + (bias.guard || 0),
    chargeRate: difficultyMap[difficulty].chargeRate + (bias.chargeRate || 0),
    lastAction: 'charging',
    mood: 'Fierce',
    ai: true,
  };
}

function writeLog(message) {
  const line = document.createElement('div');
  line.className = 'log-entry';
  line.innerHTML = message;
  battleLog.prepend(line);
  while (battleLog.children.length > 8) {
    battleLog.removeChild(battleLog.lastChild);
  }
}

function updateHud() {
  const player = state.player;
  const enemy = state.enemy;

  dayLabel.textContent = String(state.day);
  rankLabel.textContent = getRankLabel();

  if (!player || !enemy) return;

  playerNameEl.textContent = player.name;
  enemyNameEl.textContent = enemy.name;
  playerMoodEl.textContent = player.mood;
  enemyMoodEl.textContent = enemy.mood;

  playerHpBar.style.width = `${(player.hp / player.maxHp) * 100}%`;
  enemyHpBar.style.width = `${(enemy.hp / enemy.maxHp) * 100}%`;
  playerChargeBar.style.width = `${(player.charge / player.maxCharge) * 100}%`;
  enemyChargeBar.style.width = `${(enemy.charge / enemy.maxCharge) * 100}%`;

  playerHpReadout.textContent = `${Math.round(Math.max(0, player.hp))} / ${player.maxHp}`;
  enemyHpReadout.textContent = `${Math.round(Math.max(0, enemy.hp))} / ${enemy.maxHp}`;
  playerChargeReadout.textContent = `${Math.round(player.charge)} / ${player.maxCharge}`;
  enemyChargeReadout.textContent = `${Math.round(enemy.charge)} / ${enemy.maxCharge}`;
}

function getRankLabel() {
  if (state.day >= 6) return 'Star';
  if (state.day >= 4) return 'Elite';
  if (state.day >= 2) return 'Rising';
  return 'Rookie';
}

function commitDamage(target, amount) {
  target.hp = clamp(target.hp - amount, 0, target.maxHp);
  return target.hp <= 0;
}

function addCharge(unit, amount) {
  unit.charge = clamp(unit.charge + amount, 0, unit.maxCharge);
}

function triggerReaction(actor, reactionText) {
  actor.mood = reactionText;
  if (actor.ai) {
    enemyMoodEl.textContent = actor.mood;
  } else {
    playerMoodEl.textContent = actor.mood;
  }
}

function resolvePlayerAction(action) {
  if (state.battleOver || state.actionLock) return;

  const player = state.player;
  const enemy = state.enemy;
  state.actionLock = true;

  let playerLog = '';
  let enemyReply = null;
  window.arena3D?.act('player', action);

  switch (action) {
    case 'dash': {
      const chargeGain = 18 + player.chargeRate * 0.4;
      addCharge(player, chargeGain);
      const hit = 6 + player.power + Math.random() * 6;
      const enemyGuard = enemy.guard * (enemy.lastAction === 'guard' ? 1.25 : 1);
      const finalDamage = Math.max(4, hit - enemyGuard * 0.45);
      const defeated = commitDamage(enemy, finalDamage);
      triggerReaction(player, 'Bursting');
      playerLog = `<strong>${player.name}</strong> launches a dash for <strong>${finalDamage.toFixed(0)}</strong> damage and gains charge.`;
      if (defeated) {
        writeLog(playerLog);
        endBattle(true);
        return;
      }
      break;
    }

    case 'guard': {
      addCharge(player, 12 + player.chargeRate * 0.25);
      player.guard += 2;
      triggerReaction(player, 'Guarding');
      playerLog = `<strong>${player.name}</strong> sets a guard stance and stabilizes the lane.`;
      break;
    }

    case 'focus': {
      addCharge(player, 22 + player.chargeRate * 0.6);
      const heal = 8 + player.guard * 0.8;
      player.hp = clamp(player.hp + heal, 0, player.maxHp);
      triggerReaction(player, 'Focused');
      playerLog = `<strong>${player.name}</strong> focuses on rhythm and recovers <strong>${heal.toFixed(0)}</strong> HP.`;
      break;
    }

    case 'finisher': {
      const finisherDamage = player.charge >= 70 ? 26 + player.power * 1.6 : 9 + player.power * 0.8;
      const damage = player.charge >= 70 ? finisherDamage : finisherDamage * 0.7;
      const enemyGuard = enemy.guard * (enemy.lastAction === 'guard' ? 1.35 : 1);
      const finalDamage = Math.max(4, damage - enemyGuard * 0.3);
      const defeated = commitDamage(enemy, finalDamage);
      player.charge = clamp(player.charge - 45, 0, player.maxCharge);
      triggerReaction(player, player.charge >= 25 ? 'Finishing' : 'Unstable');
      playerLog = `<strong>${player.name}</strong> unleashes a finisher for <strong>${finalDamage.toFixed(0)}</strong> damage.`;
      if (defeated) {
        writeLog(playerLog);
        endBattle(true);
        return;
      }
      break;
    }

    case 'recover': {
      const recovered = 12 + player.guard * 0.9;
      player.hp = clamp(player.hp + recovered, 0, player.maxHp);
      addCharge(player, 10);
      triggerReaction(player, 'Recovering');
      playerLog = `<strong>${player.name}</strong> regains footing and recovers <strong>${recovered.toFixed(0)}</strong> HP.`;
      break;
    }

    default:
      state.actionLock = false;
      return;
  }

  player.lastAction = action;
  writeLog(playerLog);

  enemyReply = enemyTurn();

  setTimeout(() => {
    state.actionLock = false;
    updateHud();
    if (state.battleOver) return;
  }, 260);
}

function enemyTurn() {
  const player = state.player;
  const enemy = state.enemy;
  const chosen = chooseEnemyAction();
  window.arena3D?.act('enemy', chosen);

  if (chosen === 'strike') {
    const hit = 7 + enemy.power + Math.random() * 5;
    const guardMitigation = player.guard * (player.lastAction === 'guard' ? 1.25 : 1);
    const finalDamage = Math.max(3, hit - guardMitigation * 0.5);
    const defeated = commitDamage(player, finalDamage);
    enemy.lastAction = 'strike';
    triggerReaction(enemy, 'Attacking');
    writeLog(`<strong>${enemy.name}</strong> counters with a strike for <strong>${finalDamage.toFixed(0)}</strong> damage.`);
    if (defeated) {
      endBattle(false);
      return;
    }
  }

  if (chosen === 'guard') {
    addCharge(enemy, 14 + enemy.chargeRate * 0.35);
    enemy.guard += 2;
    enemy.lastAction = 'guard';
    triggerReaction(enemy, 'Bracing');
    writeLog(`<strong>${enemy.name}</strong> braces and reduces incoming damage next turn.`);
  }

  if (chosen === 'charge') {
    const boost = 18 + enemy.chargeRate * 0.8;
    addCharge(enemy, boost);
    enemy.lastAction = 'charge';
    triggerReaction(enemy, 'Charging');
    writeLog(`<strong>${enemy.name}</strong> surges rhythm and gains <strong>${boost.toFixed(0)}</strong> charge.`);
  }

  if (chosen === 'heal') {
    const healAmount = 10 + enemy.guard * 0.7;
    enemy.hp = clamp(enemy.hp + healAmount, 0, enemy.maxHp);
    enemy.lastAction = 'heal';
    triggerReaction(enemy, 'Recovering');
    writeLog(`<strong>${enemy.name}</strong> slips back into form and recovers <strong>${healAmount.toFixed(0)}</strong> HP.`);
  }

  enemy.charge = clamp(enemy.charge + enemy.chargeRate * 0.2, 0, enemy.maxCharge);
  if (enemy.charge >= 80 && Math.random() < 0.7) {
    const burstDamage = 16 + enemy.power * 1.2;
    const playerGuard = player.guard * (player.lastAction === 'guard' ? 1.25 : 1);
    const final = Math.max(5, burstDamage - playerGuard * 0.45);
    const defeated = commitDamage(player, final);
    triggerReaction(enemy, 'Exploding');
    writeLog(`<strong>${enemy.name}</strong> bursts with a power spike for <strong>${final.toFixed(0)}</strong> damage.`);
    if (defeated) {
      endBattle(false);
    }
  }

  updateHud();
}

function chooseEnemyAction() {
  const enemy = state.enemy;
  const rng = Math.random();

  if (enemy.charge >= 70 && rng > 0.55) return 'strike';
  if (enemy.hp < enemy.maxHp * 0.45 && rng > 0.75) return 'heal';
  if (rng > 0.7) return 'charge';
  if (rng > 0.3) return 'guard';
  return 'strike';
}

function startBattle() {
  state.player = buildPlayerFromSetup();
  state.enemy = buildEnemyFromStyle(difficultySelect.value);
  state.battleOver = false;
  state.actionLock = false;
  state.result = null;
  window.arena3D?.setNames(state.player.name, state.enemy.name);

  battleLog.innerHTML = '';
  writeLog(`<strong>${state.player.name}</strong> enters the lane against <strong>${state.enemy.name}</strong>.`);
  writeLog('The crowd roars as both racers lock in for the first exchange.');

  setupScreen.classList.add('hidden');
  resultScreen.classList.add('hidden');
  battleScreen.classList.remove('hidden');
  updateHud();
}

function endBattle(playerWon) {
  state.battleOver = true;
  const player = state.player;
  const enemy = state.enemy;

  if (playerWon) {
    state.result = { title: 'Victory', text: `${player.name} wins the day and earns a place among the circuit elite.` };
    resultTitle.textContent = 'Victory';
    resultSummary.innerHTML = `You beat <strong>${enemy.name}</strong> with <strong>${Math.max(0, player.hp)}</strong> HP remaining. The crowd is chanting your name as the circuit rises to day <strong>${state.day + 1}</strong>.`;
    state.day += 1;
  } else {
    state.result = { title: 'Defeat', text: `${enemy.name} outmaneuvers ${player.name} in the final sprint.` };
    resultTitle.textContent = 'Defeat';
    resultSummary.innerHTML = `You were overtaken by <strong>${enemy.name}</strong>. The academy resets the lane for another attempt. ` +
      `You still keep your training data for the next run.`;
  }

  battleScreen.classList.add('hidden');
  resultScreen.classList.remove('hidden');
  updateHud();
}

startButton.addEventListener('click', startBattle);
nextBattleButton.addEventListener('click', () => {
  if (state.result && state.result.title === 'Victory') {
    startBattle();
  } else {
    startBattle();
  }
});
restartButton.addEventListener('click', () => {
  state.day = 1;
  setupScreen.classList.remove('hidden');
  resultScreen.classList.add('hidden');
  battleScreen.classList.add('hidden');
  updateHud();
});

actionButtons.forEach((button) => {
  button.addEventListener('click', () => resolvePlayerAction(button.dataset.action));
});

updateHud();
