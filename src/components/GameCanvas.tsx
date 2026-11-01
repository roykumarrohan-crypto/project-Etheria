import React, { useEffect, useRef } from 'react';
import { PLAYABLE_CLASSES } from '../data/classes';
import { ENEMY_TEMPLATES, REGIONS } from '../data/regions';
import { audio } from '../systems/audio';
import { calculateCombatDamage } from '../systems/rules';
import {
  CharacterStats,
  EnemyPolicy,
  GameState,
  RegionId,
  SaveSlotData,
} from '../types/game';

interface LiveEnemy {
  uid: number;
  templateId: string;
  name: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  moveSpeed: number;
  detectionRange: number;
  attackRange: number;
  policy: EnemyPolicy;
  color: string;
  accentColor: string;
  radius: number;
  isBoss: boolean;
  hitFlash: number;
  windupTimer: number;
  windupMax: number;
  windupTargetX: number;
  windupTargetY: number;
  attackCooldown: number;
  koTimer: number; // > 0 when dying topple/dissolve animation is playing
  orbitAngle: number;
  phaseIndex: number;
}

interface LiveProjectile {
  active: boolean;
  fromPlayer: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  damage: number;
  aoeRadius: number;
  color: string;
  life: number;
}

interface PooledParticle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
}

interface FloatingNumber {
  active: boolean;
  x: number;
  y: number;
  vy: number;
  text: string;
  color: string;
  isCrit: boolean;
  life: number;
}

export interface GameCanvasCommandRef {
  triggerAbility: (abilityIdx: number) => void;
  triggerDodge: () => void;
  interactNearby: () => void;
  spawnDungeonBoss: (regionId: RegionId) => void;
  warpToRegionCenter: (regionId: RegionId) => void;
}

interface GameCanvasProps {
  gameState: GameState;
  isModalOpen?: boolean;
  saveData: SaveSlotData;
  computedStats: CharacterStats;
  minimapCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  commandRef: React.MutableRefObject<GameCanvasCommandRef | null>;
  onPlayerSync: (hp: number, mana: number, x: number, y: number) => void;
  onEnemyDefeated: (
    templateId: string,
    isBoss: boolean,
    xp: number,
    gold: number,
    lootItemIds: string[]
  ) => void;
  onResourceGathered: (
    nodeId: string,
    profession: 'Mining' | 'Herbalism' | 'Fishing',
    itemId: string,
    xp: number
  ) => void;
  onHiddenChestClaimed: (hiddenId: string, itemId: string, gold: number, name: string) => void;
  onOpenNpcDialogue: (npcId: string) => void;
  onRegionPortalCrossed: (targetRegionId: RegionId) => void;
  onNearbyPromptChange: (prompt: string | null) => void;
  onBossStatusChange: (
    status: { name: string; hp: number; maxHp: number; phaseName?: string } | null
  ) => void;
  onAbilityCooldownsUpdate: (cds: number[], dodgeCd: number) => void;
  onPlayerDefeated: (progressSummary: { regionName: string; enemiesSlain: number }) => void;
}

const WORLD_WIDTH = 2200;
const WORLD_HEIGHT = 1400;
const MAX_PARTICLES = 220;
const MAX_PROJECTILES = 40;
const MAX_FLOATING = 32;

export const GameCanvas: React.FC<GameCanvasProps> = (props) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Store latest React props in ref so the 60Hz loop never tears down on HUD re-renders
  const propsRef = useRef(props);
  propsRef.current = props;

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let canvasRect = canvas.getBoundingClientRect();
    const updateSize = () => {
      const rect = container.getBoundingClientRect();
      canvas.width = Math.max(640, Math.floor(rect.width));
      canvas.height = Math.max(360, Math.floor(rect.height));
      canvasRect = canvas.getBoundingClientRect();
    };
    updateSize();

    const resizeObserver = new ResizeObserver(() => {
      updateSize();
    });
    resizeObserver.observe(container);

    // Pre-allocate Zero-GC Particle Ring Buffer, Projectiles & Floating Numbers
    const particles: PooledParticle[] = Array.from({ length: MAX_PARTICLES }, () => ({
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      size: 3,
      color: '#fbbf24',
      alpha: 1,
      life: 0,
      maxLife: 1,
    }));
    let particleHead = 0;

    const spawnParticles = (
      x: number,
      y: number,
      count: number,
      color: string,
      speed = 110,
      size = 4,
      maxLife = 0.45
    ) => {
      for (let i = 0; i < count; i++) {
        const p = particles[particleHead];
        particleHead = (particleHead + 1) % MAX_PARTICLES;
        const angle = Math.random() * Math.PI * 2;
        const spd = speed * (0.35 + Math.random() * 0.85);
        p.active = true;
        p.x = x;
        p.y = y;
        p.vx = Math.cos(angle) * spd;
        p.vy = Math.sin(angle) * spd;
        p.size = size * (0.7 + Math.random() * 0.6);
        p.color = color;
        p.alpha = 1;
        p.life = maxLife;
        p.maxLife = maxLife;
      }
    };

    const projectiles: LiveProjectile[] = Array.from({ length: MAX_PROJECTILES }, () => ({
      active: false,
      fromPlayer: true,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      radius: 8,
      damage: 20,
      aoeRadius: 0,
      color: '#38bdf8',
      life: 0,
    }));

    const floatingNumbers: FloatingNumber[] = Array.from({ length: MAX_FLOATING }, () => ({
      active: false,
      x: 0,
      y: 0,
      vy: -45,
      text: '',
      color: '#ffffff',
      isCrit: false,
      life: 0,
    }));
    let floatHead = 0;

    const spawnFloatingText = (x: number, y: number, text: string, color: string, isCrit = false) => {
      const fn = floatingNumbers[floatHead];
      floatHead = (floatHead + 1) % MAX_FLOATING;
      fn.active = true;
      fn.x = x + (Math.random() * 18 - 9);
      fn.y = y - 24;
      fn.vy = isCrit ? -68 : -48;
      fn.text = text;
      fn.color = color;
      fn.isCrit = isCrit;
      fn.life = 0.85;
    };

    // Player & Camera Simulation State
    const player = {
      x: propsRef.current.saveData.character.x || 560,
      y: propsRef.current.saveData.character.y || 660,
      vx: 0,
      vy: 0,
      facingAngle: 0,
      walkDist: 0,
      scaleX: 1,
      scaleY: 1,
      hp: propsRef.current.saveData.character.hp,
      mana: propsRef.current.saveData.character.mana,
      hitFlash: 0,
      attackAnimTimer: 0,
      attackCooldown: 0,
      dodgeTimer: 0,
      dodgeCooldown: 0,
      abilityCooldowns: [0, 0, 0, 0],
      buffTimer: 0,
      footstepAccum: 0,
      enemiesSlain: 0,
    };

    const camera = {
      x: player.x,
      y: player.y,
      trauma: 0,
      tourTime: 0,
    };

    let hitstopTimer = 0;
    let currentPopulatedRegion: RegionId = propsRef.current.saveData.character.regionId;
    let enemies: LiveEnemy[] = [];
    let enemyUidCounter = 1;
    let resourceCooldowns: Record<string, number> = {};

    const populateRegionEntities = (regionId: RegionId, spawnBossImmediate = false) => {
      currentPopulatedRegion = regionId;
      enemies = [];
      const region = REGIONS[regionId];

      // Spawn 7 roaming regional enemies at safe distance from the sanctuary spawn
      const spawnPoints = [
        { x: 1020, y: 420 },
        { x: 1280, y: 540 },
        { x: 1460, y: 780 },
        { x: 1180, y: 1040 },
        { x: 1580, y: 980 },
        { x: 1420, y: 360 },
        { x: 1750, y: 720 },
      ];

      spawnPoints.forEach((pt, idx) => {
        const tmplId = region.enemyTemplateIds[idx % region.enemyTemplateIds.length];
        const tmpl = ENEMY_TEMPLATES[tmplId];
        if (!tmpl) return;
        enemies.push({
          uid: enemyUidCounter++,
          templateId: tmpl.id,
          name: tmpl.name,
          x: pt.x,
          y: pt.y,
          vx: 0,
          vy: 0,
          hp: tmpl.maxHp,
          maxHp: tmpl.maxHp,
          attack: tmpl.attack,
          defense: tmpl.defense,
          moveSpeed: tmpl.moveSpeed,
          detectionRange: tmpl.detectionRange,
          attackRange: tmpl.attackRange,
          policy: tmpl.policy,
          color: tmpl.color,
          accentColor: tmpl.accentColor,
          radius: tmpl.radius,
          isBoss: false,
          hitFlash: 0,
          windupTimer: 0,
          windupMax: 0.45,
          windupTargetX: pt.x,
          windupTargetY: pt.y,
          attackCooldown: 0.5,
          koTimer: 0,
          orbitAngle: (idx * Math.PI) / 3,
          phaseIndex: 0,
        });
      });

      // Spawn Regional Dungeon Boss near Dungeon Gate
      const bossTmpl = ENEMY_TEMPLATES[region.dungeon.bossTemplateId];
      if (bossTmpl) {
        const bx = spawnBossImmediate ? player.x + 170 : region.dungeon.x;
        const by = spawnBossImmediate ? player.y : region.dungeon.y + 70;
        enemies.push({
          uid: enemyUidCounter++,
          templateId: bossTmpl.id,
          name: bossTmpl.name,
          x: bx,
          y: by,
          vx: 0,
          vy: 0,
          hp: bossTmpl.maxHp,
          maxHp: bossTmpl.maxHp,
          attack: bossTmpl.attack,
          defense: bossTmpl.defense,
          moveSpeed: bossTmpl.moveSpeed,
          detectionRange: bossTmpl.detectionRange,
          attackRange: bossTmpl.attackRange,
          policy: bossTmpl.policy,
          color: bossTmpl.color,
          accentColor: bossTmpl.accentColor,
          radius: bossTmpl.radius,
          isBoss: true,
          hitFlash: 0,
          windupTimer: 0,
          windupMax: 0.65,
          windupTargetX: bx,
          windupTargetY: by,
          attackCooldown: 1.0,
          koTimer: 0,
          orbitAngle: 0,
          phaseIndex: 0,
        });
      }
    };

    populateRegionEntities(currentPopulatedRegion, false);

    // Unified Input Hub (held vs edge-triggered justPressed)
    const keysHeld = new Set<string>();
    const keysJustPressed = new Set<string>();
    let mouseWorldX = player.x + 100;
    let mouseWorldY = player.y;
    let mouseClientX = 640;
    let mouseClientY = 360;
    let mouseDownHeld = false;
    let mouseJustPressed = false;

    const screenToWorld = (clientX: number, clientY: number) => {
      canvasRect = canvas.getBoundingClientRect();
      const relX = clientX - canvasRect.left - canvas.width * 0.5;
      const relY = clientY - canvasRect.top - canvas.height * 0.5;
      return {
        wx: camera.x + relX,
        wy: camera.y + relY,
      };
    };

    const clearInputs = () => {
      keysHeld.clear();
      keysJustPressed.clear();
      mouseDownHeld = false;
      mouseJustPressed = false;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      const code = e.code;
      if (!keysHeld.has(code)) {
        keysJustPressed.add(code);
      }
      keysHeld.add(code);
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keysHeld.delete(e.code);
    };

    const onMouseMove = (e: MouseEvent) => {
      mouseClientX = e.clientX;
      mouseClientY = e.clientY;
      const pt = screenToWorld(e.clientX, e.clientY);
      mouseWorldX = pt.wx;
      mouseWorldY = pt.wy;
    };

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      if ((e.target as HTMLElement) !== canvas) return;
      mouseClientX = e.clientX;
      mouseClientY = e.clientY;
      const pt = screenToWorld(e.clientX, e.clientY);
      mouseWorldX = pt.wx;
      mouseWorldY = pt.wy;
      mouseDownHeld = true;
      mouseJustPressed = true;
    };

    const onMouseUp = () => {
      mouseDownHeld = false;
    };

    const onVisibilityChange = () => {
      if (document.hidden) clearInputs();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('blur', clearInputs);
    document.addEventListener('visibilitychange', onVisibilityChange);

    // Combat Damage Application Helper
    const applyDamageToEnemy = (
      en: LiveEnemy,
      damageMultiplier: number,
      isSpell: boolean,
      knockbackForce = 18
    ) => {
      if (en.koTimer > 0) return;
      const stats = propsRef.current.computedStats;
      const basePower = isSpell
        ? Math.max(stats.spellPower, stats.attack * 0.85)
        : Math.max(stats.attack, stats.spellPower * 0.75);
      const buffMult = player.buffTimer > 0 ? 1.25 : 1.0;

      const { damage, isCrit } = calculateCombatDamage({
        attackerPower: basePower * buffMult,
        defenderDefense: en.defense,
        damageMultiplier,
        critChance: stats.critChance,
      });

      en.hp = Math.max(0, en.hp - damage);
      en.hitFlash = 0.08;

      const dx = en.x - player.x;
      const dy = en.y - player.y;
      const dist = Math.hypot(dx, dy) || 1;
      en.x += (dx / dist) * knockbackForce;
      en.y += (dy / dist) * knockbackForce;

      spawnFloatingText(
        en.x,
        en.y,
        isCrit ? `${damage}!` : `${damage}`,
        isCrit ? '#fbbf24' : '#f8fafc',
        isCrit
      );

      if (en.hp <= 0) {
        en.koTimer = 0.35; // KO topple transition
        hitstopTimer = 0.055;
        camera.trauma = Math.min(1, camera.trauma + (en.isBoss ? 0.65 : 0.32));
        spawnParticles(en.x, en.y, en.isBoss ? 26 : 16, en.accentColor, 165, 5, 0.55);
        audio.playHitEnemy(true);
        player.enemiesSlain += 1;

        const tmpl = ENEMY_TEMPLATES[en.templateId];
        if (tmpl) {
          const gold =
            Math.floor(
              tmpl.goldReward[0] +
                Math.random() * (tmpl.goldReward[1] - tmpl.goldReward[0] + 1)
            );
          const drops: string[] = [];
          for (const entry of tmpl.lootTable) {
            if (Math.random() <= entry.chance) {
              drops.push(entry.itemId);
            }
          }
          propsRef.current.onEnemyDefeated(
            tmpl.id,
            Boolean(tmpl.isBoss),
            tmpl.xpReward,
            gold,
            drops
          );
        }
      } else {
        if (isCrit || damageMultiplier >= 1.8) {
          hitstopTimer = 0.04;
          camera.trauma = Math.min(1, camera.trauma + 0.22);
          spawnParticles(en.x, en.y, 12, '#fef08a', 130, 4, 0.38);
          audio.playHitEnemy(true);
        } else {
          spawnParticles(en.x, en.y, 5, '#e2e8f0', 95, 3, 0.28);
          audio.playHitEnemy(false);
        }
      }
    };

    const executeBasicAttack = () => {
      if (player.attackCooldown > 0) return;
      const cls = PLAYABLE_CLASSES[propsRef.current.saveData.character.classId];
      player.attackCooldown = 0.38;
      player.attackAnimTimer = 0.22;
      player.scaleX = 1.18;
      player.scaleY = 0.86;
      audio.playAttackSwing();

      const pt = screenToWorld(mouseClientX, mouseClientY);
      player.facingAngle = Math.atan2(pt.wy - player.y, pt.wx - player.x);

      const isRangedClass = cls.id === 'mage' || cls.id === 'archer';
      if (isRangedClass) {
        const slot = projectiles.find((p) => !p.active);
        if (slot) {
          slot.active = true;
          slot.fromPlayer = true;
          slot.x = player.x + Math.cos(player.facingAngle) * 22;
          slot.y = player.y + Math.sin(player.facingAngle) * 22;
          slot.vx = Math.cos(player.facingAngle) * 520;
          slot.vy = Math.sin(player.facingAngle) * 520;
          slot.radius = 8;
          slot.damage = 1.15;
          slot.aoeRadius = 0;
          slot.color = cls.primaryColor;
          slot.life = 0.72;
        }
      } else {
        // Melee cleave in front of player (and auto-aims at closest enemy within 115px)
        const swingX = player.x + Math.cos(player.facingAngle) * 48;
        const swingY = player.y + Math.sin(player.facingAngle) * 48;
        spawnParticles(swingX, swingY, 5, cls.primaryColor, 85, 3.5, 0.22);
        for (const en of enemies) {
          if (en.koTimer > 0) continue;
          const d = Math.hypot(en.x - player.x, en.y - player.y);
          if (d <= 115 + en.radius) {
            applyDamageToEnemy(en, 1.15, false, 16);
          }
        }
      }
    };

    const executeClassAbility = (idx: number) => {
      const cls = PLAYABLE_CLASSES[propsRef.current.saveData.character.classId];
      const ab = cls.abilities[idx];
      if (!ab) return;
      if (player.abilityCooldowns[idx] > 0.05) return;
      if (player.mana < ab.manaCost) {
        spawnFloatingText(player.x, player.y, 'Low Mana', '#38bdf8');
        return;
      }

      player.mana = Math.max(0, player.mana - ab.manaCost);
      player.abilityCooldowns[idx] = ab.cooldown;
      player.attackAnimTimer = 0.28;
      player.scaleX = 1.22;
      player.scaleY = 0.82;

      if (ab.healAmount) {
        const maxHp = propsRef.current.computedStats.maxHp;
        player.hp = Math.min(maxHp, player.hp + ab.healAmount);
        if (ab.buffDuration) player.buffTimer = ab.buffDuration;
        spawnParticles(player.x, player.y, 18, ab.color, 120, 4.5, 0.55);
        spawnFloatingText(player.x, player.y, `+${ab.healAmount} HP`, '#4ade80', true);
        audio.playPotion();
        propsRef.current.onPlayerSync(player.hp, player.mana, player.x, player.y);
        return;
      }

      audio.playSpellCast();

      if (ab.isProjectile) {
        // Aim toward nearest enemy if cursor hasn't moved, or cursor direction
        let targetAngle = player.facingAngle;
        let closestDist = 9999;
        for (const en of enemies) {
          if (en.koTimer > 0) continue;
          const d = Math.hypot(en.x - player.x, en.y - player.y);
          if (d < closestDist && d <= ab.range + 80) {
            closestDist = d;
            targetAngle = Math.atan2(en.y - player.y, en.x - player.x);
          }
        }
        const slot = projectiles.find((p) => !p.active);
        if (slot) {
          slot.active = true;
          slot.fromPlayer = true;
          slot.x = player.x + Math.cos(targetAngle) * 24;
          slot.y = player.y + Math.sin(targetAngle) * 24;
          slot.vx = Math.cos(targetAngle) * 540;
          slot.vy = Math.sin(targetAngle) * 540;
          slot.radius = 12;
          slot.damage = ab.damageMultiplier;
          slot.aoeRadius = ab.aoeRadius ?? 60;
          slot.color = ab.color;
          slot.life = 0.78;
        }
      } else {
        // Instant AoE / Slam around player
        const radius = ab.aoeRadius ?? ab.range;
        spawnParticles(player.x, player.y, 22, ab.color, 185, 5, 0.48);
        camera.trauma = Math.min(1, camera.trauma + 0.28);
        const isSpell = cls.id === 'mage' || cls.id === 'paladin';
        for (const en of enemies) {
          if (en.koTimer > 0) continue;
          const d = Math.hypot(en.x - player.x, en.y - player.y);
          if (d <= radius + en.radius) {
            applyDamageToEnemy(en, ab.damageMultiplier, isSpell, 28);
          }
        }
      }
      propsRef.current.onPlayerSync(player.hp, player.mana, player.x, player.y);
    };

    const executeDodge = () => {
      if (player.dodgeCooldown > 0.05) return;
      player.dodgeCooldown = 1.8;
      player.dodgeTimer = 0.26;
      player.scaleX = 0.84;
      player.scaleY = 1.2;
      audio.playDodge();
      spawnParticles(player.x, player.y, 8, '#e2e8f0', 90, 3.5, 0.3);
    };

    const executeInteractNearby = () => {
      const region = REGIONS[currentPopulatedRegion];

      // 1. Check NPCs
      for (const npc of region.npcs) {
        if (Math.hypot(npc.x - player.x, npc.y - player.y) <= 110) {
          audio.playUiClick();
          propsRef.current.onOpenNpcDialogue(npc.id);
          return;
        }
      }

      // 2. Check Resource Nodes
      for (const node of region.resources) {
        if ((resourceCooldowns[node.id] ?? 0) > 0) continue;
        if (Math.hypot(node.x - player.x, node.y - player.y) <= 105) {
          resourceCooldowns[node.id] = 6.0;
          audio.playPickupOrGather();
          spawnParticles(node.x, node.y, 14, node.color, 110, 4, 0.45);
          spawnFloatingText(node.x, node.y, `+1 ${node.name}`, node.color, true);
          propsRef.current.onResourceGathered(node.id, node.profession, node.itemId, node.xpReward);
          return;
        }
      }

      // 3. Check Hidden Treasure Chest
      const hid = region.hiddenLocation;
      if (
        !propsRef.current.saveData.discoveredHiddenLocations.includes(hid.id) &&
        Math.hypot(hid.x - player.x, hid.y - player.y) <= 115
      ) {
        audio.playLevelUpOrQuest();
        spawnParticles(hid.x, hid.y, 24, '#fbbf24', 150, 5, 0.6);
        spawnFloatingText(hid.x, hid.y, `Treasure Found!`, '#fbbf24', true);
        propsRef.current.onHiddenChestClaimed(
          hid.id,
          hid.treasureItemId,
          hid.goldReward,
          hid.name
        );
        return;
      }

      // 4. Check Connected Region Portals
      for (const portal of region.connectedRegions) {
        if (Math.hypot(portal.x - player.x, portal.y - player.y) <= 115) {
          audio.playLevelUpOrQuest();
          propsRef.current.onRegionPortalCrossed(portal.regionId);
          return;
        }
      }
    };

    // Expose imperative commands to HUD buttons
    propsRef.current.commandRef.current = {
      triggerAbility: executeClassAbility,
      triggerDodge: executeDodge,
      interactNearby: executeInteractNearby,
      spawnDungeonBoss: (regionId: RegionId) => {
        player.x = 1480;
        player.y = 420;
        populateRegionEntities(regionId, true);
      },
      warpToRegionCenter: (regionId: RegionId) => {
        player.x = 560;
        player.y = 660;
        populateRegionEntities(regionId, false);
      },
    };

    // Main 60Hz Simulation & Rendering Loop (with afterDraw pacing for low-spec & headless Chromium)
    let lastTime = performance.now();
    let syncAccum = 0;
    let rafId = 0;
    let timerId = 0;
    let isDisposed = false;

    const step = (now: number) => {
      if (isDisposed) return;
      const rawDt = (now - lastTime) / 1000;
      lastTime = now;
      const dt = Math.min(Math.max(rawDt, 0.001), 0.05);

      const { gameState, isModalOpen, saveData, computedStats } = propsRef.current;
      if (isModalOpen) {
        timerId = window.setTimeout(() => {
          if (!isDisposed) {
            rafId = requestAnimationFrame(step);
          }
        }, 80);
        return;
      }
      const isTitle = gameState === 'title';

      // Sync region switch if triggered externally
      if (saveData.character.regionId !== currentPopulatedRegion) {
        player.x = saveData.character.x || 560;
        player.y = saveData.character.y || 660;
        populateRegionEntities(saveData.character.regionId, false);
      }

      // Keep HP/Mana synced if potion or level-up changed them externally
      if (Math.abs(saveData.character.hp - player.hp) > 15) {
        player.hp = saveData.character.hp;
      }
      if (Math.abs(saveData.character.mana - player.mana) > 15) {
        player.mana = saveData.character.mana;
      }

      // Decay camera trauma & scale squash-and-stretch in real dt
      camera.trauma = Math.max(0, camera.trauma - dt * 1.8);
      player.scaleX += (1 - player.scaleX) * Math.min(1, dt * 14);
      player.scaleY += (1 - player.scaleY) * Math.min(1, dt * 14);

      if (isTitle) {
        // Live World Camera Tour / Parallax Pan on Title Screen
        camera.tourTime += dt * 0.35;
        camera.x = 760 + Math.cos(camera.tourTime) * 200;
        camera.y = 640 + Math.sin(camera.tourTime * 0.8) * 120;
      } else if (gameState === 'playing') {
        // Decrement hitstop
        if (hitstopTimer > 0) {
          hitstopTimer = Math.max(0, hitstopTimer - dt);
        }

        const simDt = hitstopTimer > 0 ? 0 : dt;

        if (simDt > 0) {
          // Cooldowns & Passive Mana Regeneration
          player.attackCooldown = Math.max(0, player.attackCooldown - simDt);
          player.attackAnimTimer = Math.max(0, player.attackAnimTimer - simDt);
          player.dodgeTimer = Math.max(0, player.dodgeTimer - simDt);
          player.dodgeCooldown = Math.max(0, player.dodgeCooldown - simDt);
          player.buffTimer = Math.max(0, player.buffTimer - simDt);
          player.hitFlash = Math.max(0, player.hitFlash - simDt);

          for (let i = 0; i < 4; i++) {
            player.abilityCooldowns[i] = Math.max(0, player.abilityCooldowns[i] - simDt);
          }

          for (const k of Object.keys(resourceCooldowns)) {
            resourceCooldowns[k] = Math.max(0, resourceCooldowns[k] - simDt);
          }

          player.mana = Math.min(computedStats.maxMana, player.mana + 5.5 * simDt);
          player.hp = Math.min(computedStats.maxHp, player.hp + 1.8 * simDt);

          // WASD / Arrow Movement
          let mx = 0;
          let my = 0;
          if (keysHeld.has('KeyW') || keysHeld.has('ArrowUp')) my -= 1;
          if (keysHeld.has('KeyS') || keysHeld.has('ArrowDown')) my += 1;
          if (keysHeld.has('KeyA') || keysHeld.has('ArrowLeft')) mx -= 1;
          if (keysHeld.has('KeyD') || keysHeld.has('ArrowRight')) mx += 1;

          if (mx !== 0 || my !== 0) {
            const len = Math.hypot(mx, my);
            mx /= len;
            my /= len;
            player.facingAngle = Math.atan2(my, mx);
          }

          const dodgeMult = player.dodgeTimer > 0 ? 2.15 : 1.0;
          const speed = computedStats.moveSpeed * dodgeMult;
          player.vx = mx * speed;
          player.vy = my * speed;
          player.x = Math.max(80, Math.min(WORLD_WIDTH - 80, player.x + player.vx * simDt));
          player.y = Math.max(80, Math.min(WORLD_HEIGHT - 80, player.y + player.vy * simDt));

          const stepDist = Math.hypot(player.vx, player.vy) * simDt;
          player.walkDist += stepDist;
          player.footstepAccum += stepDist;
          if (player.footstepAccum > 78) {
            player.footstepAccum = 0;
            audio.playFootstep();
          }

          // Edge-triggered one-shot inputs
          if (keysJustPressed.has('Space')) executeDodge();
          if (keysJustPressed.has('Digit1')) executeClassAbility(0);
          if (keysJustPressed.has('Digit2')) executeClassAbility(1);
          if (keysJustPressed.has('Digit3')) executeClassAbility(2);
          if (keysJustPressed.has('Digit4')) executeClassAbility(3);
          if (keysJustPressed.has('KeyE')) executeInteractNearby();
          if (mouseJustPressed || mouseDownHeld) {
            executeBasicAttack();
          }

          // Update Projectiles
          for (const proj of projectiles) {
            if (!proj.active) continue;
            proj.x += proj.vx * simDt;
            proj.y += proj.vy * simDt;
            proj.life -= simDt;
            if (proj.life <= 0) {
              proj.active = false;
              continue;
            }

            if (proj.fromPlayer) {
              for (const en of enemies) {
                if (en.koTimer > 0) continue;
                if (Math.hypot(en.x - proj.x, en.y - proj.y) <= en.radius + proj.radius) {
                  if (proj.aoeRadius > 0) {
                    spawnParticles(proj.x, proj.y, 16, proj.color, 145, 4.5, 0.42);
                    for (const sub of enemies) {
                      if (sub.koTimer > 0) continue;
                      if (Math.hypot(sub.x - proj.x, sub.y - proj.y) <= proj.aoeRadius) {
                        applyDamageToEnemy(sub, proj.damage, true, 20);
                      }
                    }
                  } else {
                    applyDamageToEnemy(en, proj.damage, true, 14);
                  }
                  proj.active = false;
                  break;
                }
              }
            } else {
              // Enemy projectile hitting player
              if (
                player.dodgeTimer <= 0 &&
                Math.hypot(player.x - proj.x, player.y - proj.y) <= 20 + proj.radius
              ) {
                const { damage } = calculateCombatDamage({
                  attackerPower: proj.damage,
                  defenderDefense: computedStats.defense,
                  damageMultiplier: 1.0,
                  critChance: 5,
                });
                player.hp = Math.max(0, player.hp - damage);
                player.hitFlash = 0.1;
                camera.trauma = Math.min(1, camera.trauma + 0.35);
                audio.playPlayerHurt();
                spawnFloatingText(player.x, player.y, `-${damage}`, '#ef4444');
                proj.active = false;
              }
            }
          }

          // Update Enemies with Crowd Attack Token Pool (max 3 simultaneous windups)
          let activeWindups = enemies.filter((e) => e.windupTimer > 0).length;
          let activeBossInfo: {
            name: string;
            hp: number;
            maxHp: number;
            phaseName?: string;
          } | null = null;

          for (let i = enemies.length - 1; i >= 0; i--) {
            const en = enemies[i];
            if (en.koTimer > 0) {
              en.koTimer -= simDt;
              if (en.koTimer <= 0) {
                enemies.splice(i, 1);
              }
              continue;
            }

            en.hitFlash = Math.max(0, en.hitFlash - simDt);
            en.attackCooldown = Math.max(0, en.attackCooldown - simDt);

            const dx = player.x - en.x;
            const dy = player.y - en.y;
            const dist = Math.hypot(dx, dy) || 1;

            if (en.isBoss && dist <= 480) {
              const tmpl = ENEMY_TEMPLATES[en.templateId];
              let phaseName = 'Phase I: Sovereign Vigil';
              if (tmpl?.bossPhases) {
                const hpRatio = en.hp / en.maxHp;
                for (const bp of tmpl.bossPhases) {
                  if (hpRatio <= bp.hpThreshold) {
                    phaseName = bp.phaseName;
                  }
                }
              }
              activeBossInfo = {
                name: en.name,
                hp: en.hp,
                maxHp: en.maxHp,
                phaseName,
              };
            }

            // Handle active windup telegraph
            if (en.windupTimer > 0) {
              en.windupTimer -= simDt;
              if (en.windupTimer <= 0) {
                // Execute telegraphed attack
                en.attackCooldown = en.isBoss ? 1.8 : 2.1;
                if (en.policy === 'kiter') {
                  // Fire ranged energy bolt toward windup target
                  const slot = projectiles.find((p) => !p.active);
                  if (slot) {
                    const ang = Math.atan2(
                      en.windupTargetY - en.y,
                      en.windupTargetX - en.x
                    );
                    slot.active = true;
                    slot.fromPlayer = false;
                    slot.x = en.x;
                    slot.y = en.y;
                    slot.vx = Math.cos(ang) * 340;
                    slot.vy = Math.sin(ang) * 340;
                    slot.radius = 9;
                    slot.damage = en.attack;
                    slot.aoeRadius = 0;
                    slot.color = en.accentColor;
                    slot.life = 1.1;
                  }
                } else {
                  // Strike ground target ring
                  const hitRadius = en.isBoss ? 105 : 68;
                  spawnParticles(
                    en.windupTargetX,
                    en.windupTargetY,
                    12,
                    en.accentColor,
                    110,
                    4,
                    0.35
                  );
                  if (
                    player.dodgeTimer <= 0 &&
                    Math.hypot(
                      player.x - en.windupTargetX,
                      player.y - en.windupTargetY
                    ) <= hitRadius
                  ) {
                    const { damage } = calculateCombatDamage({
                      attackerPower: en.attack,
                      defenderDefense: computedStats.defense,
                      damageMultiplier: 1.0,
                      critChance: 5,
                    });
                    player.hp = Math.max(0, player.hp - damage);
                    player.hitFlash = 0.12;
                    hitstopTimer = 0.04;
                    camera.trauma = Math.min(1, camera.trauma + 0.38);
                    audio.playPlayerHurt();
                    spawnFloatingText(player.x, player.y, `-${damage}`, '#ef4444');
                  }
                }
              }
              continue;
            }

            // 4 Distinct AI Movement & Decision Policies
            if (dist <= en.detectionRange) {
              const dirX = dx / dist;
              const dirY = dy / dist;

              if (en.policy === 'chaser') {
                if (dist > en.attackRange * 0.85) {
                  en.x += dirX * en.moveSpeed * simDt;
                  en.y += dirY * en.moveSpeed * simDt;
                }
              } else if (en.policy === 'kiter') {
                if (dist < 130) {
                  en.x -= dirX * en.moveSpeed * 0.85 * simDt;
                  en.y -= dirY * en.moveSpeed * 0.85 * simDt;
                } else if (dist > en.attackRange * 0.9) {
                  en.x += dirX * en.moveSpeed * simDt;
                  en.y += dirY * en.moveSpeed * simDt;
                }
              } else if (en.policy === 'charger') {
                if (dist > en.attackRange) {
                  en.x += dirX * en.moveSpeed * 1.18 * simDt;
                  en.y += dirY * en.moveSpeed * 1.18 * simDt;
                }
              } else if (en.policy === 'orbiter') {
                en.orbitAngle += simDt * 1.6;
                const desiredDist = Math.max(52, en.attackRange * 0.85);
                const targetX = player.x + Math.cos(en.orbitAngle) * desiredDist;
                const targetY = player.y + Math.sin(en.orbitAngle) * desiredDist;
                const odx = targetX - en.x;
                const ody = targetY - en.y;
                const odist = Math.hypot(odx, ody) || 1;
                en.x += (odx / odist) * en.moveSpeed * simDt;
                en.y += (ody / odist) * en.moveSpeed * simDt;
              }

              // Initiate visible windup telegraph if in range and token available
              if (
                dist <= en.attackRange + 16 &&
                en.attackCooldown <= 0 &&
                activeWindups < 3
              ) {
                activeWindups += 1;
                en.windupMax = en.isBoss ? 0.65 : 0.48;
                en.windupTimer = en.windupMax;
                en.windupTargetX = player.x;
                en.windupTargetY = player.y;
              }
            }
          }

          // Respawn roaming enemies if region cleared so player never runs out of targets
          if (enemies.filter((e) => !e.isBoss).length === 0) {
            populateRegionEntities(currentPopulatedRegion, false);
          }

          // Check Player Defeat
          if (player.hp <= 0) {
            player.hp = computedStats.maxHp;
            player.mana = computedStats.maxMana;
            propsRef.current.onPlayerDefeated({
              regionName: REGIONS[currentPopulatedRegion].name,
              enemiesSlain: player.enemiesSlain,
            });
          }

          // Smooth Camera Damping
          camera.x += (player.x - camera.x) * Math.min(1, simDt * 9);
          camera.y += (player.y - camera.y) * Math.min(1, simDt * 9);

          // Check nearby interactive prompts
          const reg = REGIONS[currentPopulatedRegion];
          let prompt: string | null = null;
          for (const npc of reg.npcs) {
            if (Math.hypot(npc.x - player.x, npc.y - player.y) <= 110) {
              prompt = `Talk to ${npc.name}`;
              break;
            }
          }
          if (!prompt) {
            for (const res of reg.resources) {
              if (
                (resourceCooldowns[res.id] ?? 0) <= 0 &&
                Math.hypot(res.x - player.x, res.y - player.y) <= 105
              ) {
                prompt = `${res.profession}: ${res.name}`;
                break;
              }
            }
          }
          if (
            !prompt &&
            !saveData.discoveredHiddenLocations.includes(reg.hiddenLocation.id) &&
            Math.hypot(reg.hiddenLocation.x - player.x, reg.hiddenLocation.y - player.y) <= 115
          ) {
            prompt = `Open ${reg.hiddenLocation.name}`;
          }
          if (!prompt) {
            for (const portal of reg.connectedRegions) {
              if (Math.hypot(portal.x - player.x, portal.y - player.y) <= 115) {
                prompt = `Travel to ${REGIONS[portal.regionId].name}`;
                break;
              }
            }
          }

          // Throttle React HUD state sync to 4Hz (250ms)
          syncAccum += simDt;
          if (syncAccum >= 0.25) {
            syncAccum = 0;
            propsRef.current.onNearbyPromptChange(prompt);
            propsRef.current.onBossStatusChange(activeBossInfo);
            propsRef.current.onAbilityCooldownsUpdate(
              [...player.abilityCooldowns],
              player.dodgeCooldown
            );
            propsRef.current.onPlayerSync(player.hp, player.mana, player.x, player.y);
          }
        }
      }

      // Clear single-frame edge triggers
      keysJustPressed.clear();
      mouseJustPressed = false;

      // Update Particles & Floating Numbers in real dt
      for (const p of particles) {
        if (!p.active) continue;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt;
        p.alpha = Math.max(0, p.life / p.maxLife);
        if (p.life <= 0) p.active = false;
      }

      for (const fn of floatingNumbers) {
        if (!fn.active) continue;
        fn.y += fn.vy * dt;
        fn.life -= dt;
        if (fn.life <= 0) fn.active = false;
      }

      // ========================================================================
      // RENDERING (Non-Pixelated Stylized 2D Fantasy Illustrations)
      // ========================================================================
      const region = REGIONS[currentPopulatedRegion];
      const shakeMag = camera.trauma * camera.trauma * 14;
      const shakeX = (Math.random() * 2 - 1) * shakeMag;
      const shakeY = (Math.random() * 2 - 1) * shakeMag;

      ctx.save();
      ctx.fillStyle = region.groundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const viewLeft = camera.x - canvas.width * 0.5 + shakeX;
      const viewTop = camera.y - canvas.height * 0.5 + shakeY;
      ctx.translate(-viewLeft, -viewTop);

      // 1. Stylized Organic Ground Biome Contours & Cobblestone Roads
      ctx.fillStyle = region.secondaryGroundColor;
      for (let gx = 200; gx < WORLD_WIDTH; gx += 380) {
        for (let gy = 180; gy < WORLD_HEIGHT; gy += 340) {
          if (
            gx + 220 < viewLeft ||
            gx - 220 > viewLeft + canvas.width ||
            gy + 220 < viewTop ||
            gy - 220 > viewTop + canvas.height
          )
            continue;
          ctx.beginPath();
          ctx.ellipse(gx, gy, 155, 95, 0.3, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Painted Ancient Road connecting Sanctuary to River Bridge and East Gate
      ctx.save();
      ctx.strokeStyle = 'rgba(168, 162, 158, 0.25)';
      ctx.lineWidth = 54;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(580, 600);
      ctx.quadraticCurveTo(960, 650, 1480, 660);
      ctx.stroke();
      ctx.restore();

      // Sanctuary Plaza Stone Circle & Glowing Rune Obelisks at (580, 600)
      ctx.fillStyle = 'rgba(148, 163, 184, 0.16)';
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.42)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(580, 600, 210, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      for (let r = 0; r < 6; r++) {
        const ang = (r * Math.PI) / 3;
        const rx = 580 + Math.cos(ang) * 210;
        const ry = 600 + Math.sin(ang) * 210;
        ctx.fillStyle = '#334155';
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(rx, ry, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }

      // 2. Animated River / Lagoon Stream & Arched Stone Bridge
      ctx.save();
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.22)';
      ctx.lineWidth = 82;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(1080, 1400);
      ctx.bezierCurveTo(1160, 1050, 1040, 820, 1260, 580);
      ctx.stroke();

      ctx.strokeStyle = region.waterColor;
      ctx.lineWidth = 66;
      ctx.stroke();

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
      ctx.lineWidth = 3;
      const rippleOffset = (now * 0.04) % 40;
      ctx.setLineDash([18, 22]);
      ctx.lineDashOffset = -rippleOffset;
      ctx.stroke();
      ctx.restore();

      // Stone Bridge over the river
      ctx.save();
      ctx.fillStyle = '#57534e';
      ctx.strokeStyle = '#d6d3d1';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(1085, 635, 130, 52, 8);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // Stylized Layered Fantasy Trees across the region
      const treeCoords = [
        { x: 340, y: 380 },
        { x: 420, y: 880 },
        { x: 820, y: 340 },
        { x: 960, y: 510 },
        { x: 1360, y: 880 },
        { x: 1620, y: 580 },
      ];
      for (const tc of treeCoords) {
        const sway = Math.sin(now * 0.002 + tc.x) * 3;
        ctx.save();
        ctx.translate(tc.x, tc.y);
        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.38)';
        ctx.beginPath();
        ctx.ellipse(6, 24, 34, 14, 0, 0, Math.PI * 2);
        ctx.fill();
        // Trunk
        ctx.fillStyle = '#451a03';
        ctx.fillRect(-7, -4, 14, 28);
        // Canopy Layers
        ctx.fillStyle = region.foliageColor;
        ctx.strokeStyle = '#090d16';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(sway, -18, 30, 0, Math.PI * 2);
        ctx.arc(sway - 18, -8, 22, 0, Math.PI * 2);
        ctx.arc(sway + 18, -8, 22, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }

      // 3. Connected Region Portals (Glowing Astral Waygates)
      for (const portal of region.connectedRegions) {
        const pulse = 1 + Math.sin(now * 0.005) * 0.08;
        const grad = ctx.createRadialGradient(
          portal.x,
          portal.y,
          8,
          portal.x,
          portal.y,
          48 * pulse
        );
        grad.addColorStop(0, '#fef08a');
        grad.addColorStop(0.5, '#f59e0b');
        grad.addColorStop(1, 'rgba(245, 158, 11, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(portal.x, portal.y, 48 * pulse, 0, Math.PI * 2);
        ctx.fill();

        if (!isTitle) {
          ctx.fillStyle = '#fef3c7';
          ctx.font = '600 12px "Plus Jakarta Sans", sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(`→ ${REGIONS[portal.regionId].name}`, portal.x, portal.y - 52);
        }
      }

      // 4. Dungeon Entrance Citadel Arch
      const dng = region.dungeon;
      ctx.save();
      ctx.fillStyle = '#1e1b4b';
      ctx.strokeStyle = '#f87171';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(dng.x, dng.y, 46, Math.PI, 0, false);
      ctx.lineTo(dng.x + 46, dng.y + 32);
      ctx.lineTo(dng.x - 46, dng.y + 32);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      if (!isTitle) {
        ctx.fillStyle = '#fca5a5';
        ctx.font = '700 12px "Cinzel", serif';
        ctx.textAlign = 'center';
        ctx.fillText(`Dungeon: ${dng.name}`, dng.x, dng.y - 54);
      }
      ctx.restore();

      // 5. Resource Gathering Nodes
      for (const node of region.resources) {
        const onCd = (resourceCooldowns[node.id] ?? 0) > 0;
        ctx.save();
        ctx.globalAlpha = onCd ? 0.3 : 1.0;
        ctx.fillStyle = node.color;
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(node.x, node.y, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        if (!isTitle) {
          ctx.fillStyle = '#f8fafc';
          ctx.font = '600 11px "Plus Jakarta Sans", sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(`[E] ${node.name}`, node.x, node.y - 24);
        }
        ctx.restore();
      }

      // 6. Hidden Treasure Reliquary
      const hid = region.hiddenLocation;
      const isClaimed = saveData.discoveredHiddenLocations.includes(hid.id);
      ctx.save();
      ctx.globalAlpha = isClaimed ? 0.35 : 1.0;
      ctx.fillStyle = '#d97706';
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(hid.x - 20, hid.y - 14, 40, 28, 6);
      ctx.fill();
      ctx.stroke();
      if (!isTitle) {
        ctx.fillStyle = '#fde047';
        ctx.font = '600 11px "Plus Jakarta Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(
          isClaimed ? `${hid.name} (Claimed)` : `[E] ${hid.name}`,
          hid.x,
          hid.y - 22
        );
      }
      ctx.restore();

      // 7. Illustrated NPCs
      for (const npc of region.npcs) {
        const bob = Math.sin(now * 0.004) * 2.5;
        ctx.save();
        ctx.translate(npc.x, npc.y + bob);
        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.beginPath();
        ctx.ellipse(0, 18, 16, 7, 0, 0, Math.PI * 2);
        ctx.fill();

        // Cloak & Body
        ctx.fillStyle = npc.color;
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, 2, 16, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Head
        ctx.fillStyle = '#f3d8c7';
        ctx.beginPath();
        ctx.arc(0, -10, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        if (!isTitle) {
          ctx.fillStyle = '#facc15';
          ctx.font = '700 15px "Cinzel", serif';
          ctx.textAlign = 'center';
          ctx.fillText('!', 0, -28);

          ctx.fillStyle = '#fef08a';
          ctx.font = '600 11.5px "Plus Jakarta Sans", sans-serif';
          ctx.fillText(`[E] ${npc.name}`, 0, 34);
        }
        ctx.restore();
      }

      // 8. Enemies & Windup Telegraph Rings
      for (const en of enemies) {
        if (en.windupTimer > 0 && en.koTimer <= 0 && !isTitle) {
          const progress = 1 - en.windupTimer / en.windupMax;
          const ringRadius = en.isBoss ? 105 : 68;
          ctx.save();
          ctx.strokeStyle = 'rgba(239, 68, 68, 0.85)';
          ctx.fillStyle = 'rgba(239, 68, 68, 0.18)';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(en.windupTargetX, en.windupTargetY, ringRadius, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = 'rgba(251, 191, 36, 0.35)';
          ctx.beginPath();
          ctx.arc(
            en.windupTargetX,
            en.windupTargetY,
            ringRadius * progress,
            0,
            Math.PI * 2
          );
          ctx.fill();
          ctx.restore();
        }

        ctx.save();
        ctx.translate(en.x, en.y);
        if (en.koTimer > 0) {
          ctx.globalAlpha = Math.max(0, en.koTimer / 0.35);
          ctx.rotate((1 - en.koTimer / 0.35) * 1.4);
          ctx.scale(1.15, 0.65);
        }

        // Ground shadow
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.beginPath();
        ctx.ellipse(0, en.radius * 0.85, en.radius * 0.9, en.radius * 0.4, 0, 0, Math.PI * 2);
        ctx.fill();

        // Body silhouette
        ctx.fillStyle = en.hitFlash > 0 ? '#ffffff' : en.color;
        ctx.strokeStyle = en.isBoss ? '#fbbf24' : '#090d16';
        ctx.lineWidth = en.isBoss ? 3.5 : 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, en.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Inner crest / eyes
        ctx.fillStyle = en.accentColor;
        ctx.beginPath();
        ctx.arc(-en.radius * 0.3, -3, 3.5, 0, Math.PI * 2);
        ctx.arc(en.radius * 0.3, -3, 3.5, 0, Math.PI * 2);
        ctx.fill();

        // Enemy Health Bar & Name (hidden during Title Tour)
        if (en.koTimer <= 0 && !isTitle) {
          const bw = en.isBoss ? 76 : 46;
          const pct = Math.max(0, en.hp / en.maxHp);
          ctx.fillStyle = 'rgba(9, 13, 22, 0.85)';
          ctx.fillRect(-bw / 2, -en.radius - 16, bw, 6);
          ctx.fillStyle = en.isBoss ? '#f59e0b' : '#ef4444';
          ctx.fillRect(-bw / 2, -en.radius - 16, bw * pct, 6);

          ctx.fillStyle = '#e2e8f0';
          ctx.font = '600 10.5px "Plus Jakarta Sans", sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(en.name, 0, -en.radius - 21);
        }
        ctx.restore();
      }

      // 9. Smooth Non-Pixelated Playable Hero Character
      const cls = PLAYABLE_CLASSES[saveData.character.classId];
      const walkBob = Math.sin(player.walkDist * 0.08) * 3;
      ctx.save();
      ctx.translate(player.x, player.y + walkBob);
      ctx.scale(player.scaleX, player.scaleY);

      // Ground shadow
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.beginPath();
      ctx.ellipse(0, 20, 18, 8, 0, 0, Math.PI * 2);
      ctx.fill();

      // Aura ring when buffed or dodging
      if (player.buffTimer > 0 || player.dodgeTimer > 0) {
        ctx.strokeStyle = player.dodgeTimer > 0 ? '#e0f2fe' : '#fbbf24';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, 26, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Flowing Cloak
      ctx.fillStyle =
        player.hitFlash > 0 ? '#ffffff' : saveData.character.customization.cloakColor;
      ctx.strokeStyle = '#090d16';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 4, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Armor Shoulders
      ctx.fillStyle = player.hitFlash > 0 ? '#ffffff' : cls.primaryColor;
      ctx.beginPath();
      ctx.ellipse(0, 1, 16, 12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Articulated Weapon Swing Arc
      ctx.save();
      const swingRot =
        player.facingAngle +
        (player.attackAnimTimer > 0 ? Math.sin(player.attackAnimTimer * 25) * 0.9 : 0.35);
      ctx.rotate(swingRot);
      ctx.strokeStyle = '#f8fafc';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(12, 0);
      ctx.lineTo(36, 0);
      ctx.stroke();
      ctx.restore();

      // Hero Head & Hair
      ctx.fillStyle = saveData.character.customization.skinTone || '#e6bea5';
      ctx.beginPath();
      ctx.arc(0, -10, 10.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = saveData.character.customization.hairColor || '#f59e0b';
      ctx.beginPath();
      ctx.arc(0, -13, 10.5, Math.PI, 0, false);
      ctx.fill();
      ctx.restore();

      // 10. Projectiles, Pooled Particles & Floating Combat Numbers
      for (const proj of projectiles) {
        if (!proj.active) continue;
        ctx.fillStyle = proj.color;
        ctx.beginPath();
        ctx.arc(proj.x, proj.y, proj.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      for (const p of particles) {
        if (!p.active) continue;
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      for (const fn of floatingNumbers) {
        if (!fn.active) continue;
        ctx.save();
        ctx.fillStyle = fn.color;
        ctx.strokeStyle = '#090d16';
        ctx.lineWidth = 3;
        ctx.font = fn.isCrit
          ? '700 16px "JetBrains Mono", monospace'
          : '600 13px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.strokeText(fn.text, fn.x, fn.y);
        ctx.fillText(fn.text, fn.x, fn.y);
        ctx.restore();
      }

      // 11. Atmospheric Weather Motes
      if (!saveData.settings.lowSpecMode && saveData.settings.weatherEnabled) {
        ctx.fillStyle = 'rgba(253, 224, 71, 0.35)';
        for (let i = 0; i < 18; i++) {
          const wx = ((i * 217 + now * 0.03) % canvas.width) + viewLeft;
          const wy = ((i * 163 + Math.sin(now * 0.002 + i) * 30) % canvas.height) + viewTop;
          ctx.beginPath();
          ctx.arc(wx, wy, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.restore();

      // ========================================================================
      // MINIMAP PROJECTION (Real navigable region geometry)
      // ========================================================================
      const mini = propsRef.current.minimapCanvasRef.current;
      if (mini && gameState === 'playing') {
        const mctx = mini.getContext('2d');
        if (mctx) {
          const mw = mini.width;
          const mh = mini.height;
          const sx = mw / WORLD_WIDTH;
          const sy = mh / WORLD_HEIGHT;

          mctx.fillStyle = region.groundColor;
          mctx.fillRect(0, 0, mw, mh);

          // Portals (Gold)
          mctx.fillStyle = '#facc15';
          for (const pt of region.connectedRegions) {
            mctx.fillRect(pt.x * sx - 3, pt.y * sy - 3, 6, 6);
          }

          // NPCs (Emerald)
          mctx.fillStyle = '#34d399';
          for (const npc of region.npcs) {
            mctx.beginPath();
            mctx.arc(npc.x * sx, npc.y * sy, 3, 0, Math.PI * 2);
            mctx.fill();
          }

          // Enemies (Red)
          for (const en of enemies) {
            if (en.koTimer > 0) continue;
            mctx.fillStyle = en.isBoss ? '#f97316' : '#ef4444';
            mctx.beginPath();
            mctx.arc(en.x * sx, en.y * sy, en.isBoss ? 4 : 2.5, 0, Math.PI * 2);
            mctx.fill();
          }

          // Player (White/Cyan Dot)
          mctx.fillStyle = '#38bdf8';
          mctx.strokeStyle = '#ffffff';
          mctx.lineWidth = 1.5;
          mctx.beginPath();
          mctx.arc(player.x * sx, player.y * sy, 4, 0, Math.PI * 2);
          mctx.fill();
          mctx.stroke();
        }
      }

      // Schedule next frame after draw completes so main thread yields cleanly
      const frameDelay = saveData.settings.lowSpecMode ? 32 : 16;
      timerId = window.setTimeout(() => {
        if (!isDisposed) {
          rafId = requestAnimationFrame(step);
        }
      }, frameDelay);
    };

    rafId = requestAnimationFrame(step);

    return () => {
      isDisposed = true;
      window.clearTimeout(timerId);
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('blur', clearInputs);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  return (
    <div ref={containerRef} className="fixed inset-0 z-0 overflow-hidden bg-[#0b0e14]">
      <canvas
        ref={canvasRef}
        data-testid="etheria-canvas"
        tabIndex={0}
        className="w-full h-full block focus:outline-none cursor-crosshair"
      />
    </div>
  );
};
