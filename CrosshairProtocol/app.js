// CROSSHAIR PROTOCOL — Full React Application
const { useState, useEffect, useRef } = React;

function App() {
  // Load saved progress or initialize defaults
  const [saveData, setSaveData] = useState(() => {
    try {
      const saved = localStorage.getItem("CROSSHAIR_PROTOCOL_SAVE");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (!parsed.unlockedGuns) parsed.unlockedGuns = ["w_viper_s1"];
        if (!parsed.equippedGunId) parsed.equippedGunId = parsed.selectedWeaponId || "w_viper_s1";
        if (!parsed.outfit) {
          parsed.outfit = {
            colorId: "pal_tan",
            colorHex: "#d4a373",
            accentHex: "#38bdf8",
            headgear: "hg_none",
            facewear: "fw_none",
            jacket: "jk_vest",
            trousers: "tr_cargo",
            gloves: "gl_standard",
            boots: "bt_desert"
          };
        }
        if (!parsed.unlockedOutfitItems) {
          parsed.unlockedOutfitItems = ["hg_none", "fw_none", "jk_vest", "tr_cargo", "gl_standard", "bt_desert", "pal_tan", "pal_green", "pal_blue", "pal_red", "pal_black"];
        }
        if (typeof parsed.credits !== 'number') parsed.credits = 500;
        return parsed;
      }
    } catch (e) {
      console.warn("Storage read error:", e);
    }
    return {
      unlockedLevels: [1],
      completedLevels: [],
      highScores: {},
      unlockedGuns: ["w_viper_s1"],
      equippedGunId: "w_viper_s1",
      outfit: {
        colorId: "pal_tan",
        colorHex: "#d4a373",
        accentHex: "#38bdf8",
        headgear: "hg_none",
        facewear: "fw_none",
        jacket: "jk_vest",
        trousers: "tr_cargo",
        gloves: "gl_standard",
        boots: "bt_desert"
      },
      unlockedOutfitItems: ["hg_none", "fw_none", "jk_vest", "tr_cargo", "gl_standard", "bt_desert", "pal_tan", "pal_green", "pal_blue", "pal_red", "pal_black"],
      credits: 500,
      soundVolume: 0.8,
      mouseSensitivity: 1.0,
      isMuted: false
    };
  });

  // Navigation states: 'HOME', 'PLAYING', 'VICTORY', 'GAMEOVER', 'CAMPAIGN_COMPLETE'
  const [gameState, setGameState] = useState('HOME');
  const [currentLevelNum, setCurrentLevelNum] = useState(1);
  const [isPaused, setIsPaused] = useState(false);

  // Modals on Homepage: null, 'LEVELS', 'GUNS', 'OUTFITS', 'SETTINGS', 'BRIEFING', 'TUTORIAL'
  const [activeModal, setActiveModal] = useState(null);

  // Armory Preview Gun
  const [previewGunId, setPreviewGunId] = useState("w_viper_s1");

  // Outfit customization active tab
  const [outfitTab, setOutfitTab] = useState('COLORS');

  // Combat States
  const [ammoRemainingTotal, setAmmoRemainingTotal] = useState(8);
  const [currentMag, setCurrentMag] = useState(5);
  const [isReloading, setIsReloading] = useState(false);
  const [isScoped, setIsScoped] = useState(false);
  const [breathStamina, setBreathStamina] = useState(100);
  const [isHoldingBreath, setIsHoldingBreath] = useState(false);
  const [targetsRemaining, setTargetsRemaining] = useState(3);
  const [totalLevelTargets, setTotalLevelTargets] = useState(3);
  const [levelTimer, setLevelTimer] = useState(90);
  const [currentScore, setCurrentScore] = useState(0);

  // Detailed round stats for results breakdown
  const [shotsFired, setShotsFired] = useState(0);
  const [shotsHit, setShotsHit] = useState(0);
  const [roundStartTime, setRoundStartTime] = useState(0);
  const [completionTimeSec, setCompletionTimeSec] = useState(0);
  const [defeatReason, setDefeatReason] = useState("");
  const [scoreBreakdown, setScoreBreakdown] = useState(null);

  // Live crosshair & visual hit marker
  const [mousePos, setMousePos] = useState({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const [isMuzzleFlashing, setIsMuzzleFlashing] = useState(false);
  const [hitFeedback, setHitFeedback] = useState(null);
  const [screenHitMarker, setScreenHitMarker] = useState(false);

  const viewportRef = useRef(null);
  const worldRef = useRef(null);
  const aimAnglesRef = useRef({ yaw: 0, pitch: 0 });

  // Save to localStorage when state updates
  useEffect(() => {
    try {
      localStorage.setItem("CROSSHAIR_PROTOCOL_SAVE", JSON.stringify(saveData));
    } catch (e) {
      console.warn("Storage write error:", e);
    }
  }, [saveData]);

  // Sync Audio Settings
  useEffect(() => {
    if (window.tacticalAudio) {
      window.tacticalAudio.setVolume(saveData.soundVolume);
      window.tacticalAudio.setMuted(saveData.isMuted);
    }
  }, [saveData.soundVolume, saveData.isMuted]);

  // Current Equipped Weapon & Level Config
  const equippedGun = window.GAME_DATA.WEAPONS.find(w => w.id === saveData.equippedGunId) || window.GAME_DATA.WEAPONS[0];
  const previewGun = window.GAME_DATA.WEAPONS.find(w => w.id === previewGunId) || equippedGun;
  const currentLevelConfig = window.GAME_DATA.LEVELS.find(l => l.level === currentLevelNum) || window.GAME_DATA.LEVELS[0];

  const currentAccuracy = shotsFired > 0 ? Math.round((shotsHit / shotsFired) * 100) : 100;

  // Initialize or Reset 3D World depending on Game State
  useEffect(() => {
    if (!viewportRef.current) return;

    if (worldRef.current) {
      worldRef.current.destroy();
      worldRef.current = null;
    }

    const isMenu = gameState === 'HOME';
    const world = new window.DesertSniperWorld(viewportRef.current, {
      isMenuMode: isMenu,
      onHit: (data) => handleTargetHit(data),
      onMiss: () => handleTargetMiss()
    });

    worldRef.current = world;
    world.updateRifleAppearance(equippedGun);

    if (isMenu) {
      world.updateCharacterAppearance(saveData.outfit);
    } else if (gameState === 'PLAYING') {
      world.spawnTargetsForLevel(currentLevelConfig);
      setTargetsRemaining(currentLevelConfig.targetCount);
      setTotalLevelTargets(currentLevelConfig.targetCount);
      setLevelTimer(currentLevelConfig.timeLimit);
      
      const startingAmmo = currentLevelConfig.ammoLimit || (equippedGun.magSize * 2);
      setAmmoRemainingTotal(startingAmmo);
      setCurrentMag(Math.min(equippedGun.magSize, startingAmmo));

      setShotsFired(0);
      setShotsHit(0);
      setRoundStartTime(Date.now());
      setIsReloading(false);
      setIsScoped(false);
      setIsPaused(false);
    }

    return () => {
      if (worldRef.current) {
        worldRef.current.destroy();
        worldRef.current = null;
      }
    };
  }, [gameState, currentLevelNum, saveData.equippedGunId, saveData.outfit]);

  // Level Countdown Timer (freezes if game is paused)
  useEffect(() => {
    if (gameState !== 'PLAYING' || isPaused) return;

    const timer = setInterval(() => {
      setLevelTimer(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          triggerMissionDefeat("TIME EXPIRED — HOSTILES ESCAPED");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gameState, isPaused, currentLevelNum]);

  // Steady breath stamina recovery & depletion
  useEffect(() => {
    if (gameState !== 'PLAYING' || isPaused) return;

    const interval = setInterval(() => {
      if (isHoldingBreath) {
        setBreathStamina(prev => {
          const next = Math.max(0, prev - 3.5);
          if (next === 0 && worldRef.current) {
            worldRef.current.isHoldingBreath = false;
            setIsHoldingBreath(false);
          }
          return next;
        });
      } else {
        setBreathStamina(prev => Math.min(100, prev + 2.0));
      }
    }, 100);

    return () => clearInterval(interval);
  }, [gameState, isPaused, isHoldingBreath]);

  // Pointer Lock and Mouse Controls for Aiming and Firing
  useEffect(() => {
    if (gameState !== 'PLAYING') {
      if (document.pointerLockElement) {
        document.exitPointerLock?.();
      }
      return;
    }

    if (isPaused) {
      if (document.pointerLockElement) {
        document.exitPointerLock?.();
      }
      return;
    }

    // Attempt to lock pointer to viewport for true 360 FPS-style sniper aim
    const requestLock = () => {
      if (viewportRef.current && document.pointerLockElement !== viewportRef.current) {
        viewportRef.current.requestPointerLock?.();
      }
    };

    // Auto-request pointer lock upon entering gameplay
    requestLock();

    const handleMouseMove = (e) => {
      const sens = 0.0016 * saveData.mouseSensitivity * (equippedGun.handling ? equippedGun.handling / 90 : 1.0);
      const dx = e.movementX !== undefined ? e.movementX : (e.clientX - mousePos.x);
      const dy = e.movementY !== undefined ? e.movementY : (e.clientY - mousePos.y);

      // Keep crosshair anchored to center of screen in pointer-locked mode
      if (document.pointerLockElement) {
        setMousePos({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
      } else {
        setMousePos({ x: e.clientX, y: e.clientY });
      }

      const zoomFactor = isScoped ? 0.35 : 1.0;
      aimAnglesRef.current.yaw -= dx * sens * zoomFactor;
      aimAnglesRef.current.pitch -= dy * sens * zoomFactor;

      aimAnglesRef.current.pitch = Math.max(-0.65, Math.min(0.5, aimAnglesRef.current.pitch));
      aimAnglesRef.current.yaw = Math.max(-1.5, Math.min(1.5, aimAnglesRef.current.yaw));

      if (worldRef.current) {
        worldRef.current.setAimAngles(aimAnglesRef.current.yaw, aimAnglesRef.current.pitch);
      }
    };

    const handleMouseDown = (e) => {
      // If clicking inside viewport while unlocked and unpaused, regain lock
      if (!document.pointerLockElement && !isPaused) {
        requestLock();
      }

      if (e.button === 0) {
        fireRifle();
      } else if (e.button === 2) {
        toggleScope();
      }
    };

    const handleKeyDown = (e) => {
      if (e.code === 'Escape' || e.code === 'KeyP') {
        setIsPaused(true);
        if (document.pointerLockElement) {
          document.exitPointerLock?.();
        }
        window.tacticalAudio.playUiBeep(700);
      } else if (e.code === 'KeyR') {
        reloadRifle();
      } else if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        // Shift = Scope Zoom Toggle
        toggleScope();
      } else if (e.code === 'Space') {
        e.preventDefault();
        // Space = Hold Breath (Steady Aim)
        if (!isHoldingBreath && breathStamina > 20) {
          setIsHoldingBreath(true);
          if (worldRef.current) worldRef.current.isHoldingBreath = true;
          window.tacticalAudio.playHeartbeat();
        }
      }
    };

    const handleKeyUp = (e) => {
      if (e.code === 'Space') {
        setIsHoldingBreath(false);
        if (worldRef.current) worldRef.current.isHoldingBreath = false;
      }
    };

    const handlePointerLockChange = () => {
      // If player presses Escape to exit pointer lock natively, pause game to show settings/cursor
      if (!document.pointerLockElement && gameState === 'PLAYING') {
        setIsPaused(true);
      }
    };

    const handleContextMenu = (e) => e.preventDefault();

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('pointerlockchange', handlePointerLockChange);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('pointerlockchange', handlePointerLockChange);
    };
  }, [gameState, isPaused, isScoped, currentMag, ammoRemainingTotal, isReloading, isHoldingBreath, breathStamina, saveData.mouseSensitivity, targetsRemaining, equippedGun]);

  // Fire Weapon Trigger
  const fireRifle = () => {
    if (isReloading || isPaused) return;

    if (currentMag <= 0) {
      if (ammoRemainingTotal > 0) {
        window.tacticalAudio.playBoltCycle();
        reloadRifle();
      } else {
        window.tacticalAudio.playBoltCycle();
        if (targetsRemaining > 0) {
          triggerMissionDefeat("OUT OF AMMUNITION — MISSION FAILED");
        }
      }
      return;
    }

    const nextMag = currentMag - 1;
    const nextTotalAmmo = ammoRemainingTotal - 1;
    setCurrentMag(nextMag);
    setAmmoRemainingTotal(nextTotalAmmo);
    setShotsFired(prev => prev + 1);

    // Audio & Screen Muzzle Flash FX
    window.tacticalAudio.playSniperShot(equippedGun.soundProfile || "STANDARD", equippedGun.recoil);
    setIsMuzzleFlashing(true);
    setTimeout(() => setIsMuzzleFlashing(false), 70);

    const windEffect = {
      x: (currentLevelConfig.windSpeed || 0) * (currentLevelConfig.windDir.includes('W') ? -0.12 : 0.12),
      y: (currentLevelConfig.windSpeed || 0) * 0.04
    };

    if (worldRef.current) {
      worldRef.current.fireShot(windEffect, equippedGun.damage);
    }

    if (nextTotalAmmo === 0 && nextMag === 0) {
      setTimeout(() => {
        setTargetsRemaining(latestTargets => {
          if (latestTargets > 0) {
            triggerMissionDefeat("OUT OF AMMUNITION — UNABLE TO COMPLETE PROTOCOL");
          }
          return latestTargets;
        });
      }, 700);
    }
  };

  // Toggle Scoped View
  const toggleScope = () => {
    if (isPaused) return;
    const nextScoped = !isScoped;
    setIsScoped(nextScoped);
    window.tacticalAudio.playScopeZoom(nextScoped);
    if (worldRef.current) {
      worldRef.current.setZoom(nextScoped, equippedGun.zoom);
    }
  };

  // Reload Action
  const reloadRifle = () => {
    if (isReloading || currentMag === equippedGun.magSize || ammoRemainingTotal <= 0 || isPaused) return;
    setIsReloading(true);
    window.tacticalAudio.playBoltCycle();

    setTimeout(() => {
      const needed = equippedGun.magSize - currentMag;
      const toLoad = Math.min(needed, ammoRemainingTotal);
      setCurrentMag(prev => prev + toLoad);
      setIsReloading(false);
      window.tacticalAudio.playBoltCycle();
    }, equippedGun.reloadTime * 1000);
  };

  // Target Hit Handler
  const handleTargetHit = ({ target, isCritical, damageDealt, isEliminated, remainingHp, distance }) => {
    setShotsHit(prev => prev + 1);

    setScreenHitMarker(true);
    setTimeout(() => setScreenHitMarker(false), 140);

    const bonus = isCritical ? 250 : 100;
    const distanceBonus = Math.round(distance * 1.5);
    const totalGained = bonus + distanceBonus;

    setCurrentScore(prev => prev + totalGained);
    window.tacticalAudio.playHitConfirm(isCritical);

    setHitFeedback({
      type: isCritical ? 'HEADSHOT' : 'HIT',
      text: isEliminated 
        ? (isCritical ? `CRITICAL HIT! (-${damageDealt} HP) — TARGET ELIMINATED` : `TARGET DESTROYED! (-${damageDealt} HP)`) 
        : `HIT CONFIRMED! (-${damageDealt} HP)`,
      score: isEliminated ? `+${totalGained} PTS (${distance}m)` : `REMAINING HEALTH: ${remainingHp} HP`
    });

    setTimeout(() => setHitFeedback(null), 1200);

    if (isEliminated) {
      setTargetsRemaining(prev => {
        const nextCount = prev - 1;
        if (nextCount <= 0) {
          handleMissionVictory();
        }
        return Math.max(0, nextCount);
      });
    }
  };

  // Target Miss Handler
  const handleTargetMiss = () => {
    window.tacticalAudio.playMissRicochet();
    setHitFeedback({
      type: 'MISS',
      text: 'MISS / RICOCHET',
      score: 'ADJUST SIGHTLINE OR WINDAGE'
    });
    setTimeout(() => setHitFeedback(null), 800);
  };

  // Comprehensive Multi-Factor Scoring Calculation
  const handleMissionVictory = () => {
    const duration = Math.max(1, Math.round((Date.now() - roundStartTime) / 1000));
    setCompletionTimeSec(duration);

    // Multi-factor Scoring Formula:
    // 1. Elimination Score (Base target points)
    const baseTargetScore = currentScore;
    // 2. Accuracy Bonus (up to 1,000 pts for 100% precision)
    const accuracyBonusScore = Math.round((currentAccuracy / 100) * 1000);
    // 3. Ammo Conservation Bonus (150 pts per bullet remaining)
    const ammoBonusScore = ammoRemainingTotal * 150;
    // 4. Time Speed Bonus (Faster completion awards up to 800 pts)
    const timeBonusScore = Math.max(0, Math.round((currentLevelConfig.timeLimit - duration) * 15));
    // 5. Total Combined Score
    const finalCalculatedScore = baseTargetScore + accuracyBonusScore + ammoBonusScore + timeBonusScore;

    // Credits reward
    const totalCreditsWon = currentLevelConfig.rewardCredits + Math.round((currentAccuracy / 100) * 300);

    setScoreBreakdown({
      baseTargetScore,
      accuracyBonusScore,
      ammoBonusScore,
      timeBonusScore,
      finalCalculatedScore,
      creditsWon: totalCreditsWon
    });

    const nextLevel = currentLevelNum + 1;

    setSaveData(prev => {
      const newUnlocked = prev.unlockedLevels.includes(nextLevel) || nextLevel > 20
        ? prev.unlockedLevels
        : [...prev.unlockedLevels, nextLevel];

      const newCompleted = prev.completedLevels.includes(currentLevelNum)
        ? prev.completedLevels
        : [...prev.completedLevels, currentLevelNum];

      const prevHigh = prev.highScores[currentLevelNum] || 0;
      const updatedHigh = Math.max(prevHigh, finalCalculatedScore);

      return {
        ...prev,
        unlockedLevels: newUnlocked,
        completedLevels: newCompleted,
        highScores: { ...prev.highScores, [currentLevelNum]: updatedHigh },
        credits: prev.credits + totalCreditsWon
      };
    });

    setTimeout(() => {
      if (currentLevelNum === 20) {
        window.tacticalAudio.playCampaignComplete();
        setGameState('CAMPAIGN_COMPLETE');
      } else {
        window.tacticalAudio.playVictory();
        setGameState('VICTORY');
      }
    }, 700);
  };

  // Mission Defeat
  const triggerMissionDefeat = (reason) => {
    window.tacticalAudio.playDefeat();
    setDefeatReason(reason);
    const duration = Math.round((Date.now() - roundStartTime) / 1000);
    setCompletionTimeSec(duration);
    setGameState('GAMEOVER');
  };

  // Launch Level - opens Briefing modal for player confirmation
  const startLevel = (lvlNum) => {
    // Strictly enforce unlocked levels
    if (!saveData.unlockedLevels.includes(lvlNum)) {
      return;
    }
    window.tacticalAudio.playUiBeep(1100);
    setCurrentLevelNum(lvlNum);
    setActiveModal('BRIEFING');
  };

  // Launch Next Level directly without redundant briefing modal loop
  const launchNextLevelDirectly = (lvlNum) => {
    const validLevel = Math.min(20, Math.max(1, lvlNum));
    // Verify level is actually unlocked
    if (!saveData.unlockedLevels.includes(validLevel)) {
      setGameState('HOME');
      return;
    }
    window.tacticalAudio.playUiBeep(1400);
    setActiveModal(null);
    setCurrentScore(0);
    setCurrentLevelNum(validLevel);
    setGameState('PLAYING');
  };

  const confirmLaunchMission = () => {
    window.tacticalAudio.playUiBeep(1400);
    setActiveModal(null);
    setCurrentScore(0);
    setGameState('PLAYING');
  };

  const abortMissionBriefing = () => {
    setActiveModal(null);
    // If we aborted from victory/gameover flow, return cleanly to home
    if (gameState !== 'HOME') {
      setGameState('HOME');
    }
  };

  // Gun Purchase / Equip logic
  const handleEquipGun = (gun) => {
    window.tacticalAudio.playUiBeep(1200);
    setSaveData(prev => ({ ...prev, equippedGunId: gun.id }));
    if (worldRef.current) worldRef.current.updateRifleAppearance(gun);
  };

  const handlePurchaseGun = (gun) => {
    if (saveData.credits < gun.creditCost) {
      alert("Insufficient credits! Complete missions to earn credits.");
      return;
    }
    window.tacticalAudio.playPurchase();
    setSaveData(prev => ({
      ...prev,
      credits: prev.credits - gun.creditCost,
      unlockedGuns: [...prev.unlockedGuns, gun.id],
      equippedGunId: gun.id
    }));
    if (worldRef.current) worldRef.current.updateRifleAppearance(gun);
  };

  // Outfit item purchase / equip
  const handleEquipOutfitItem = (category, item) => {
    window.tacticalAudio.playUiBeep(950);
    const updatedOutfit = { ...saveData.outfit, [category]: item.id };
    setSaveData(prev => ({ ...prev, outfit: updatedOutfit }));
    if (worldRef.current) worldRef.current.updateCharacterAppearance(updatedOutfit);
  };

  const handlePurchaseOutfitItem = (category, item) => {
    if (saveData.credits < item.cost) {
      alert("Insufficient credits! Complete missions to earn credits.");
      return;
    }
    window.tacticalAudio.playPurchase();
    const updatedOutfit = { ...saveData.outfit, [category]: item.id };
    setSaveData(prev => ({
      ...prev,
      credits: prev.credits - item.cost,
      unlockedOutfitItems: [...prev.unlockedOutfitItems, item.id],
      outfit: updatedOutfit
    }));
    if (worldRef.current) worldRef.current.updateCharacterAppearance(updatedOutfit);
  };

  const handleSelectPalette = (palette) => {
    window.tacticalAudio.playUiBeep(950);
    const updatedOutfit = {
      ...saveData.outfit,
      colorId: palette.id,
      colorHex: palette.hex,
      accentHex: palette.id === "pal_red" ? "#ef4444" : (palette.id === "pal_green" ? "#22c55e" : "#38bdf8")
    };
    setSaveData(prev => ({ ...prev, outfit: updatedOutfit }));
    if (worldRef.current) worldRef.current.updateCharacterAppearance(updatedOutfit);
  };

  return (
    <div className="w-full h-full relative select-none">
      {/* 3D WebGL Canvas Layer */}
      <div ref={viewportRef} className="three-viewport" />

      {/* Screen scanlines & tactical atmosphere */}
      <div className="tactical-scanlines" />

      {/* Muzzle Flash Overlay */}
      {isMuzzleFlashing && (
        <div style={{
          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
          background: 'rgba(255, 237, 213, 0.25)', pointerEvents: 'none', zIndex: 18
        }} />
      )}

      {/* Tactical Corner Accents */}
      <div className="corner-bracket corner-tl" />
      <div className="corner-bracket corner-tr" />
      <div className="corner-bracket corner-bl" />
      <div className="corner-bracket corner-br" />

      {/* Top HUD Header */}
      <header className="hud-header">
        <div className="brand-badge">
          <div className="brand-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="22" y1="12" x2="18" y2="12" />
              <line x1="6" y1="12" x2="2" y2="12" />
              <line x1="12" y1="6" x2="12" y2="2" />
              <line x1="12" y1="22" x2="12" y2="18" />
            </svg>
          </div>
          <div>
            <h1 className="brand-title">CROSSHAIR PROTOCOL</h1>
            <div className="brand-subtitle">SECTOR 7 • DESERT VILLAGE OPERATIONS</div>
          </div>
        </div>

        <div className="hud-stats-bar">
          <div className="hud-stat-pill">
            <span className="stat-label">OPERATIVE CREDITS:</span>
            <span className="stat-value">{saveData.credits.toLocaleString()} CR</span>
          </div>
          <div className="hud-stat-pill">
            <span className="stat-label">PROTOCOL PROGRESS:</span>
            <span className="stat-value blue">{saveData.completedLevels.length} / 20</span>
          </div>
          <button 
            className="btn-tactical" 
            style={{ padding: '8px 16px', fontSize: '12px' }}
            onClick={() => {
              window.tacticalAudio.playUiBeep();
              setActiveModal('TUTORIAL');
            }}
          >
            📖 HOW TO PLAY
          </button>
          <button 
            className="btn-tactical" 
            style={{ padding: '8px 16px', fontSize: '12px' }}
            onClick={() => {
              window.tacticalAudio.playUiBeep();
              setActiveModal('SETTINGS');
            }}
          >
            ⚙ SETTINGS
          </button>
        </div>
      </header>

      {/* HOMEPAGE VIEW */}
      {gameState === 'HOME' && (
        <div className="homepage-container">
          <div className="hero-banner">
            <div className="hero-tag">HIGH VALUE TARGET INTERDICTION</div>
            <h2 className="hero-title">LONG RANGE OVERWATCH</h2>
            <p className="hero-desc">
              Stationed in a fortified desert vantage point, neutralize hostiles across 20 escalating tactical levels. Arm yourself with five custom sniper rifles, customize your combat gear, and eliminate moving star reconnaissance targets.
            </p>

            <div className="equipped-summary-cards">
              <div className="summary-card">
                <div className="summary-card-label">EQUIPPED RIFLE</div>
                <div className="summary-card-value" style={{ color: equippedGun.color }}>
                  {equippedGun.name} ({equippedGun.damage} DMG)
                </div>
              </div>
              <div className="summary-card">
                <div className="summary-card-label">CAMO & LOADOUT</div>
                <div className="summary-card-value" style={{ color: saveData.outfit.accentHex || 'var(--color-blue)' }}>
                  {saveData.outfit.colorId ? saveData.outfit.colorId.replace('pal_', '').toUpperCase() : 'DESERT'} PATTERN
                </div>
              </div>
            </div>

            <div className="homepage-actions">
              <button 
                className="btn-tactical primary-play"
                onClick={() => {
                  const targetLvl = saveData.unlockedLevels.includes(currentLevelNum) 
                    ? currentLevelNum 
                    : Math.max(...saveData.unlockedLevels, 1);
                  startLevel(targetLvl);
                }}
              >
                ▶ PLAY LEVEL {saveData.unlockedLevels.includes(currentLevelNum) ? currentLevelNum : Math.max(...saveData.unlockedLevels, 1)}
              </button>
              <button 
                className="btn-tactical accent-green"
                onClick={() => {
                  window.tacticalAudio.playUiBeep();
                  setActiveModal('LEVELS');
                }}
              >
                🎯 LEVEL SELECT (20)
              </button>
              <button 
                className="btn-tactical"
                onClick={() => {
                  window.tacticalAudio.playUiBeep();
                  setPreviewGunId(saveData.equippedGunId);
                  setActiveModal('GUNS');
                }}
              >
                🔫 ARMORY (5 GUNS)
              </button>
              <button 
                className="btn-tactical"
                onClick={() => {
                  window.tacticalAudio.playUiBeep();
                  setActiveModal('OUTFITS');
                }}
              >
                👤 OUTFIT CUSTOMIZATION
              </button>
            </div>
          </div>

          {/* 3D Character Showcase Live Badge */}
          <div className="character-showcase-badge">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <span style={{ fontSize: '26px' }}>👤</span>
              <div>
                <div className="showcase-char-name">SNIPER OPERATIVE</div>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>OVERWATCH LOADOUT</div>
              </div>
            </div>
            <div className="showcase-char-bonus" style={{ color: saveData.outfit.accentHex }}>
              GUN: {equippedGun.name} • {equippedGun.damage} DMG
            </div>
            <div style={{ fontSize: '11px', color: '#cbd5e1', marginTop: '6px', fontFamily: 'var(--font-mono)' }}>
              LIVE PREVIEW • REAL-TIME 3D SHOWCASE
            </div>
          </div>

          {/* Footer Level Progress Tracker */}
          <div className="homepage-footer">
            <div className="progress-group">
              <span className="progress-title">TACTICAL COMPLETION:</span>
              <div className="progress-bar-track">
                <div 
                  className="progress-bar-fill" 
                  style={{ width: `${(saveData.completedLevels.length / 20) * 100}%` }}
                />
              </div>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-green)' }}>
                {Math.round((saveData.completedLevels.length / 20) * 100)}%
              </span>
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: '#94a3b8' }}>
              CREDITS: {saveData.credits.toLocaleString()} CR • 5 CUSTOM RIFLES • MODULAR OUTFITS
            </div>
          </div>
        </div>
      )}

      {/* GAMEPLAY HUD OVERLAY */}
      {gameState === 'PLAYING' && (
        <div className="gameplay-hud-root">
          {/* Pause Button in Top Right */}
          <button
            className="btn-tactical"
            style={{
              position: 'absolute', top: '75px', right: '30px', zIndex: 25,
              padding: '8px 16px', fontSize: '12px', pointerEvents: 'auto',
              background: 'rgba(15, 23, 42, 0.85)'
            }}
            onClick={() => {
              setIsPaused(true);
              window.tacticalAudio.playUiBeep(750);
            }}
          >
            ⏸ PAUSE [ESC]
          </button>

          {/* Dynamic Crosshair following mouse movement */}
          <div 
            style={{
              position: 'absolute',
              left: `${mousePos.x}px`,
              top: `${mousePos.y}px`,
              transform: 'translate(-50%, -50%)',
              pointerEvents: 'none',
              zIndex: 22,
              transition: 'transform 0.04s ease'
            }}
          >
            <div style={{ width: '32px', height: '32px', position: 'relative' }}>
              <div style={{ position: 'absolute', top: 0, left: '15px', width: '2px', height: '8px', background: 'var(--color-blue)', boxShadow: '0 0 5px var(--color-blue)' }} />
              <div style={{ position: 'absolute', bottom: 0, left: '15px', width: '2px', height: '8px', background: 'var(--color-blue)', boxShadow: '0 0 5px var(--color-blue)' }} />
              <div style={{ position: 'absolute', top: '15px', left: 0, width: '8px', height: '2px', background: 'var(--color-blue)', boxShadow: '0 0 5px var(--color-blue)' }} />
              <div style={{ position: 'absolute', top: '15px', right: 0, width: '8px', height: '2px', background: 'var(--color-blue)', boxShadow: '0 0 5px var(--color-blue)' }} />
              <div style={{ position: 'absolute', top: '14px', left: '14px', width: '4px', height: '4px', borderRadius: '50%', background: 'var(--color-green)', boxShadow: '0 0 6px var(--color-green)' }} />
              
              {/* Screen Hit Marker */}
              {screenHitMarker && (
                <div style={{
                  position: 'absolute', top: '4px', left: '4px', width: '24px', height: '24px',
                  border: '2px solid var(--color-red)', transform: 'rotate(45deg)',
                  boxShadow: '0 0 10px var(--color-red)'
                }} />
              )}
            </div>
          </div>

          {/* Scoped View Reticle */}
          {isScoped ? (
            <div className="scope-overlay">
              <div className="scope-reticle-circle">
                <div className="reticle-hair-h" />
                <div className="reticle-hair-v" />
                {[-120, -60, 60, 120].map((offset, i) => (
                  <React.Fragment key={i}>
                    <div className="mil-dot" style={{ top: '50%', left: `calc(50% + ${offset}px)` }} />
                    <div className="mil-dot" style={{ left: '50%', top: `calc(50% + ${offset}px)` }} />
                  </React.Fragment>
                ))}
                <div className="crosshair-center-chevron" />
              </div>
            </div>
          ) : (
            <div className="hipfire-reticle">
              <div className="hip-bar hip-top" />
              <div className="hip-bar hip-bottom" />
              <div className="hip-bar hip-left" />
              <div className="hip-bar hip-right" />
              <div className="hip-dot" />
            </div>
          )}

          {/* Mission Status Top Left */}
          <div className="mission-hud-panel">
            <div className="mission-level-title">
              LEVEL {currentLevelNum}: {currentLevelConfig.title}
            </div>
            <div className="mission-target-tracker">
              <span>TARGETS REMAINING:</span>
              <strong style={{ fontSize: '20px', color: targetsRemaining === 0 ? 'var(--color-green)' : '#ffffff' }}>
                {targetsRemaining} / {totalLevelTargets}
              </strong>
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--color-blue)', marginTop: '4px' }}>
              ACCURACY: <strong style={{ color: currentAccuracy > 70 ? 'var(--color-green)' : 'var(--color-red)' }}>{currentAccuracy}%</strong> • SHOTS: {shotsFired} (HITS: {shotsHit})
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
              TIME: <span style={{ color: levelTimer < 20 ? 'var(--color-red)' : 'var(--color-blue)', fontWeight: 700 }}>{levelTimer}s</span> • WIND: {currentLevelConfig.windDir}
            </div>
          </div>

          {/* Breath Stamina Bar */}
          <div className="breath-bar-container">
            <div className="breath-label">
              {isHoldingBreath ? 'BREATH HELD (STEADY AIM)' : 'HOLD SPACE: STEADY AIM'}
            </div>
            <div className="breath-track">
              <div 
                className="breath-fill" 
                style={{ 
                  width: `${breathStamina}%`,
                  background: breathStamina < 25 ? 'var(--color-red)' : 'var(--color-blue)' 
                }} 
              />
            </div>
          </div>

          {/* Ammo & Weapon Status Bottom Right */}
          <div className="ammo-hud-panel">
            <div className={`ammo-counter-huge ${currentMag === 0 ? 'empty' : ''}`}>
              {isReloading ? "CYCLING..." : `${currentMag} / ${ammoRemainingTotal}`}
            </div>
            <div className="gun-name-tag">
              <span style={{ color: equippedGun.color }}>{equippedGun.name}</span> • {equippedGun.damage} DMG • {ammoRemainingTotal} RDS
            </div>
            <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: '#64748b', marginTop: '4px' }}>
              [MOUSE] AIM • [L-CLICK] FIRE • [SHIFT / R-CLICK] SCOPE • [R] RELOAD • [SPACE] STEADY • [ESC] PAUSE / SETTINGS (SHOW MOUSE)
            </div>
          </div>

          {/* Hit / Miss Feedback Flash Banner */}
          {hitFeedback && (
            <div className="hit-feedback-popup">
              <div className={`hit-text-banner ${hitFeedback.type.toLowerCase()}`}>
                {hitFeedback.text}
              </div>
              <div className="hit-sub-score">{hitFeedback.score}</div>
            </div>
          )}

          {/* IN-GAME PAUSE MENU MODAL */}
          {isPaused && (
            <div className="modal-backdrop" style={{ pointerEvents: 'auto', zIndex: 60 }}>
              <div className="briefing-modal" style={{ textAlign: 'center', maxWidth: '480px' }}>
                <div style={{ fontSize: '36px', marginBottom: '6px' }}>⏸</div>
                <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '26px', color: 'var(--color-blue)', marginBottom: '8px' }}>
                  GAME PAUSED
                </h2>
                <div style={{ fontFamily: 'var(--font-mono)', color: '#94a3b8', fontSize: '13px', marginBottom: '24px' }}>
                  LEVEL {currentLevelNum}: {currentLevelConfig.title}
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <button
                    className="btn-tactical primary-play"
                    style={{ justifyContent: 'center' }}
                    onClick={() => {
                      setIsPaused(false);
                      window.tacticalAudio.playUiBeep(1100);
                    }}
                  >
                    ▶ RESUME MISSION
                  </button>
                  <button
                    className="btn-tactical"
                    style={{ justifyContent: 'center' }}
                    onClick={() => {
                      setIsPaused(false);
                      startLevel(currentLevelNum);
                    }}
                  >
                    🔄 RESTART LEVEL
                  </button>
                  <button
                    className="btn-tactical"
                    style={{ justifyContent: 'center' }}
                    onClick={() => setActiveModal('SETTINGS')}
                  >
                    ⚙ SETTINGS
                  </button>
                  <button
                    className="btn-tactical"
                    style={{ justifyContent: 'center', borderColor: 'rgba(239, 68, 68, 0.4)', color: '#ef4444' }}
                    onClick={() => {
                      setIsPaused(false);
                      setGameState('HOME');
                    }}
                  >
                    🏠 RETURN TO BASE (HOMEPAGE)
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SHORT TUTORIAL / HOW TO PLAY MODAL */}
      {activeModal === 'TUTORIAL' && (
        <div className="modal-backdrop">
          <div className="modal-window" style={{ maxWidth: '780px' }}>
            <div className="modal-header">
              <div className="modal-title">
                <span>📖</span>
                <span>TACTICAL SNIPER MANUAL & CONTROLS</span>
              </div>
              <button className="modal-close-btn" onClick={() => setActiveModal(null)}>✕</button>
            </div>

            <div className="modal-content">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '20px' }}>
                <div className="summary-card" style={{ padding: '14px' }}>
                  <div style={{ fontSize: '24px', marginBottom: '6px' }}>🎯</div>
                  <div className="summary-card-label">AIMING & CONTROLS</div>
                  <div style={{ fontSize: '13px', color: '#cbd5e1', marginTop: '6px', lineHeight: 1.4 }}>
                    Move your mouse to look and aim. The crosshair follows smoothly with customizable sensitivity in Settings.
                  </div>
                </div>

                <div className="summary-card" style={{ padding: '14px' }}>
                  <div style={{ fontSize: '24px', marginBottom: '6px' }}>🔭</div>
                  <div className="summary-card-label">OPTICAL SCOPE ZOOM</div>
                  <div style={{ fontSize: '13px', color: '#cbd5e1', marginTop: '6px', lineHeight: 1.4 }}>
                    Press <strong>Shift</strong> or <strong>Right-Click</strong> to look through the Mil-Dot scope for distant precision.
                  </div>
                </div>

                <div className="summary-card" style={{ padding: '14px' }}>
                  <div style={{ fontSize: '24px', marginBottom: '6px' }}>🫁</div>
                  <div className="summary-card-label">STEADY AIM (BREATH)</div>
                  <div style={{ fontSize: '13px', color: '#cbd5e1', marginTop: '6px', lineHeight: 1.4 }}>
                    Hold <strong>Space</strong> to hold your breath and eliminate weapon sway for critical shots.
                  </div>
                </div>

                <div className="summary-card" style={{ padding: '14px' }}>
                  <div style={{ fontSize: '24px', marginBottom: '6px' }}>💥</div>
                  <div className="summary-card-label">DAMAGE & TARGET HP</div>
                  <div style={{ fontSize: '13px', color: '#cbd5e1', marginTop: '6px', lineHeight: 1.4 }}>
                    Headshots and star bullseye cores deal <strong>2.5x critical damage</strong>. Better rifles drop tough targets in fewer rounds.
                  </div>
                </div>

                <div className="summary-card" style={{ padding: '14px' }}>
                  <div style={{ fontSize: '24px', marginBottom: '6px' }}>⭐</div>
                  <div className="summary-card-label">STAR RECON TARGETS</div>
                  <div style={{ fontSize: '13px', color: '#cbd5e1', marginTop: '6px', lineHeight: 1.4 }}>
                    Introduced at Level 5, moving star-shaped targets drift in flight. Lead your shots ahead of their movement!
                  </div>
                </div>

                <div className="summary-card" style={{ padding: '14px' }}>
                  <div style={{ fontSize: '24px', marginBottom: '6px' }}>🔄</div>
                  <div className="summary-card-label">RELOAD & AMMO MANAGEMENT</div>
                  <div style={{ fontSize: '13px', color: '#cbd5e1', marginTop: '6px', lineHeight: 1.4 }}>
                    Press <strong>R</strong> to chamber rounds. Running out of ammunition before eliminating all targets results in defeat.
                  </div>
                </div>
              </div>

              <div style={{ textAlign: 'center' }}>
                <button 
                  className="btn-tactical primary-play"
                  onClick={() => setActiveModal(null)}
                >
                  ACKNOWLEDGED • READY FOR DEPLOYMENT
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MISSION BRIEFING MODAL */}
      {activeModal === 'BRIEFING' && (
        <div className="modal-backdrop">
          <div className="briefing-modal">
            <div className="hero-tag">OPERATIONAL ORDER #{currentLevelNum}</div>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '24px', color: '#ffffff', margin: '8px 0' }}>
              {currentLevelConfig.title}
            </h2>
            <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-blue)', fontSize: '13px', marginBottom: '8px' }}>
              TARGET ENGAGEMENT: {currentLevelConfig.distance} • WIND: {currentLevelConfig.windDir}
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-green)', fontSize: '13px', marginBottom: '14px' }}>
              TARGETS: {currentLevelConfig.targetCount} ({currentLevelConfig.targetHealth} HP EACH) • AMMO: {currentLevelConfig.ammoLimit} BULLETS
            </div>
            <p style={{ color: '#cbd5e1', fontSize: '15px', lineHeight: 1.5, marginBottom: '20px' }}>
              {currentLevelConfig.briefing}
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                className="btn-tactical primary-play"
                style={{ flex: 1 }}
                onClick={confirmLaunchMission}
              >
                ENGAGE TARGETS
              </button>
              <button 
                className="btn-tactical"
                onClick={abortMissionBriefing}
              >
                ABORT
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 20 LEVEL SELECTION MODAL */}
      {activeModal === 'LEVELS' && (
        <div className="modal-backdrop">
          <div className="modal-window">
            <div className="modal-header">
              <div className="modal-title">
                <span>🎯</span>
                <span>DESERT VILLAGE CAMPAIGN — ALL 20 LEVELS</span>
              </div>
              <button className="modal-close-btn" onClick={() => setActiveModal(null)}>✕</button>
            </div>

            <div className="modal-content">
              <div className="levels-grid">
                {window.GAME_DATA.LEVELS.map(lvl => {
                  const isUnlocked = saveData.unlockedLevels.includes(lvl.level);
                  const isCompleted = saveData.completedLevels.includes(lvl.level);
                  const isSelected = currentLevelNum === lvl.level;

                  return (
                    <div 
                      key={lvl.level}
                      className={`level-card ${isUnlocked ? '' : 'locked'} ${isCompleted ? 'completed' : ''} ${isSelected ? 'selected' : ''}`}
                      onClick={() => {
                        if (isUnlocked) {
                          startLevel(lvl.level);
                        }
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span className="level-num-badge">#{lvl.level}</span>
                          {lvl.targetShape === 'STAR' && <span style={{ fontSize: '14px' }}>⭐</span>}
                        </div>
                        <div className="level-title-text">{lvl.title}</div>
                        <div className="level-targets-info">{lvl.subtitle}</div>
                      </div>

                      <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
                        <span style={{ color: '#94a3b8' }}>{lvl.targetCount} Targets • {lvl.targetHealth} HP</span>
                        <span style={{ color: 'var(--color-green)' }}>+{lvl.rewardCredits} CR</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DEDICATED ARMORY: 5 CUSTOM SNIPER GUNS */}
      {activeModal === 'GUNS' && (
        <div className="modal-backdrop">
          <div className="modal-window" style={{ maxWidth: '1100px' }}>
            <div className="modal-header">
              <div className="modal-title">
                <span>🔫</span>
                <span>TACTICAL ARMORY — FIVE CUSTOM SNIPER RIFLES</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', color: 'var(--color-green)' }}>
                  CREDITS: <strong>{saveData.credits.toLocaleString()} CR</strong>
                </div>
                <button className="modal-close-btn" onClick={() => setActiveModal(null)}>✕</button>
              </div>
            </div>

            <div className="modal-content">
              <div className="custom-grid">
                {window.GAME_DATA.WEAPONS.map(wpn => {
                  const isUnlocked = saveData.unlockedGuns.includes(wpn.id);
                  const isEquipped = saveData.equippedGunId === wpn.id;
                  const canAfford = saveData.credits >= wpn.creditCost;
                  const meetsLevel = saveData.unlockedLevels.length >= wpn.unlockedAtLevel || saveData.completedLevels.length >= (wpn.unlockedAtLevel - 1);

                  return (
                    <div 
                      key={wpn.id} 
                      className={`custom-card ${isEquipped ? 'equipped' : ''}`}
                      style={{ borderColor: isEquipped ? 'var(--color-green)' : (isUnlocked ? 'var(--color-blue)' : 'rgba(56, 189, 248, 0.2)') }}
                    >
                      <div>
                        <div className="card-top-tag">
                          <span>{wpn.type}</span>
                          <span style={{ color: wpn.color }}>{wpn.scopeType}</span>
                        </div>
                        <div className="card-item-title" style={{ color: wpn.color }}>{wpn.name}</div>
                        <div className="card-desc">{wpn.desc}</div>

                        <div className="stat-bars-container">
                          <div className="stat-row">
                            <span>DAMAGE:</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div className="stat-bar-bg">
                                <div className="stat-bar-fill" style={{ width: `${(wpn.damage / 300) * 100}%`, background: wpn.color }} />
                              </div>
                              <span style={{ color: '#ffffff', fontWeight: 700 }}>{wpn.damage}</span>
                            </div>
                          </div>
                          <div className="stat-row">
                            <span>OPTICAL ZOOM:</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div className="stat-bar-bg">
                                <div className="stat-bar-fill" style={{ width: `${(wpn.zoom / 7.0) * 100}%`, background: wpn.color }} />
                              </div>
                              <span style={{ color: '#ffffff' }}>{wpn.zoom}x</span>
                            </div>
                          </div>
                          <div className="stat-row">
                            <span>RELOAD SPEED:</span>
                            <span style={{ color: '#ffffff' }}>{wpn.reloadTime}s</span>
                          </div>
                          <div className="stat-row">
                            <span>MAGAZINE CAPACITY:</span>
                            <span style={{ color: '#ffffff' }}>{wpn.magSize} ROUNDS</span>
                          </div>
                          <div className="stat-row">
                            <span>HANDLING:</span>
                            <span style={{ color: 'var(--color-blue)' }}>{wpn.handling} / 100</span>
                          </div>
                        </div>
                      </div>

                      <div style={{ marginTop: '16px' }}>
                        {isEquipped ? (
                          <button className="btn-tactical accent-green" style={{ width: '100%', justifyContent: 'center' }} disabled>
                            ✓ CURRENTLY EQUIPPED
                          </button>
                        ) : isUnlocked ? (
                          <button 
                            className="btn-tactical" 
                            style={{ width: '100%', justifyContent: 'center' }}
                            onClick={() => handleEquipGun(wpn)}
                          >
                            EQUIP RIFLE
                          </button>
                        ) : meetsLevel ? (
                          <button 
                            className="btn-tactical primary-play" 
                            style={{ width: '100%', justifyContent: 'center', fontSize: '13px' }}
                            onClick={() => handlePurchaseGun(wpn)}
                            disabled={!canAfford}
                          >
                            UNLOCK FOR {wpn.creditCost.toLocaleString()} CR
                          </button>
                        ) : (
                          <button className="btn-tactical" style={{ width: '100%', justifyContent: 'center', opacity: 0.5 }} disabled>
                            🔒 UNLOCKS AT LEVEL {wpn.unlockedAtLevel} ({wpn.creditCost.toLocaleString()} CR)
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CHARACTER OUTFIT CUSTOMIZATION MODAL */}
      {activeModal === 'OUTFITS' && (
        <div className="modal-backdrop">
          <div className="modal-window" style={{ maxWidth: '1050px' }}>
            <div className="modal-header">
              <div className="modal-title">
                <span>👤</span>
                <span>OPERATIVE OUTFIT & GEAR CUSTOMIZATION</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', color: 'var(--color-green)' }}>
                  CREDITS: <strong>{saveData.credits.toLocaleString()} CR</strong>
                </div>
                <button className="modal-close-btn" onClick={() => setActiveModal(null)}>✕</button>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', padding: '12px 28px', background: 'rgba(10, 14, 23, 0.75)', borderBottom: '1px solid var(--border-tactical)', overflowX: 'auto' }}>
              {[
                { id: 'COLORS', label: '🎨 PALETTES' },
                { id: 'HEADGEAR', label: '🪖 HEADGEAR' },
                { id: 'FACEWEAR', label: '🧣 FACEWEAR' },
                { id: 'JACKETS', label: '🦺 JACKETS & VESTS' },
                { id: 'TROUSERS', label: '👖 TROUSERS' },
                { id: 'GLOVES', label: '🧤 GLOVES' },
                { id: 'BOOTS', label: '🥾 BOOTS' }
              ].map(tab => (
                <button
                  key={tab.id}
                  className="btn-tactical"
                  style={{
                    padding: '8px 16px', fontSize: '12px',
                    borderColor: outfitTab === tab.id ? 'var(--color-blue)' : 'var(--border-tactical)',
                    background: outfitTab === tab.id ? 'rgba(56, 189, 248, 0.15)' : 'transparent'
                  }}
                  onClick={() => setOutfitTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="modal-content">
              {outfitTab === 'COLORS' && (
                <div>
                  <div style={{ fontFamily: 'var(--font-mono)', color: '#94a3b8', fontSize: '13px', marginBottom: '14px' }}>
                    SELECT COMBAT CAMO THEME (GREEN, BLUE, RED, TAN, BLACK):
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '14px' }}>
                    {window.GAME_DATA.OUTFIT_SYSTEM.COLOR_PALETTES.map(pal => {
                      const isSelected = saveData.outfit.colorId === pal.id;
                      return (
                        <div 
                          key={pal.id}
                          className="custom-card"
                          style={{
                            borderColor: isSelected ? 'var(--color-green)' : 'var(--border-tactical)',
                            cursor: 'pointer',
                            background: isSelected ? 'rgba(34, 197, 94, 0.1)' : 'rgba(15, 23, 42, 0.8)'
                          }}
                          onClick={() => handleSelectPalette(pal)}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: pal.hex, border: '2px solid #ffffff' }} />
                            <div>
                              <div style={{ fontFamily: 'var(--font-heading)', fontSize: '14px', color: '#ffffff' }}>{pal.name}</div>
                              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#94a3b8' }}>{pal.hex}</div>
                            </div>
                          </div>
                          <div style={{ marginTop: '12px', textAlign: 'right' }}>
                            {isSelected ? (
                              <span style={{ color: 'var(--color-green)', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>✓ APPLIED</span>
                            ) : (
                              <span style={{ color: 'var(--color-blue)', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>EQUIP COLOR</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {outfitTab !== 'COLORS' && (
                <div className="custom-grid">
                  {(window.GAME_DATA.OUTFIT_SYSTEM[outfitTab] || []).map(item => {
                    const categoryMap = {
                      HEADGEAR: 'headgear',
                      FACEWEAR: 'facewear',
                      JACKETS: 'jacket',
                      TROUSERS: 'trousers',
                      GLOVES: 'gloves',
                      BOOTS: 'boots'
                    };
                    const categoryKey = categoryMap[outfitTab] || outfitTab.toLowerCase().slice(0, -1);
                    const isEquipped = saveData.outfit[categoryKey] === item.id;
                    const isUnlocked = saveData.unlockedOutfitItems.includes(item.id) || item.cost === 0;
                    const canAfford = saveData.credits >= item.cost;
                    const meetsLevel = saveData.unlockedLevels.length >= item.unlockLevel;

                    return (
                      <div key={item.id} className={`custom-card ${isEquipped ? 'equipped' : ''}`}>
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '28px' }}>{item.icon}</span>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#94a3b8' }}>
                              LVL {item.unlockLevel} REQUIRED
                            </span>
                          </div>
                          <div className="card-item-title">{item.name}</div>
                          <div className="card-desc">{item.desc}</div>
                        </div>

                        <div style={{ marginTop: '14px' }}>
                          {isEquipped ? (
                            <button className="btn-tactical accent-green" style={{ width: '100%', justifyContent: 'center' }} disabled>
                              ✓ EQUIPPED
                            </button>
                          ) : isUnlocked ? (
                            <button 
                              className="btn-tactical" 
                              style={{ width: '100%', justifyContent: 'center' }}
                              onClick={() => handleEquipOutfitItem(categoryKey, item)}
                            >
                              EQUIP ITEM
                            </button>
                          ) : meetsLevel ? (
                            <button 
                              className="btn-tactical primary-play" 
                              style={{ width: '100%', justifyContent: 'center', fontSize: '12px' }}
                              onClick={() => handlePurchaseOutfitItem(categoryKey, item)}
                              disabled={!canAfford}
                            >
                              PURCHASE ({item.cost} CR)
                            </button>
                          ) : (
                            <button className="btn-tactical" style={{ width: '100%', justifyContent: 'center', opacity: 0.5 }} disabled>
                              🔒 LEVEL {item.unlockLevel} ({item.cost} CR)
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SETTINGS MODAL */}
      {activeModal === 'SETTINGS' && (
        <div className="modal-backdrop">
          <div className="modal-window" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <div className="modal-title">
                <span>⚙</span>
                <span>SYSTEM SETTINGS & MOUSE SENSITIVITY</span>
              </div>
              <button className="modal-close-btn" onClick={() => setActiveModal(null)}>✕</button>
            </div>

            <div className="modal-content">
              <div className="settings-group">
                <div className="setting-row">
                  <div>
                    <span className="setting-label">MOUSE SENSITIVITY</span>
                    <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--color-blue)' }}>
                      VALUE: {saveData.mouseSensitivity.toFixed(1)}x
                    </div>
                  </div>
                  <input 
                    type="range" 
                    min="0.3" 
                    max="3.0" 
                    step="0.1"
                    className="slider-tactical"
                    value={saveData.mouseSensitivity}
                    onChange={(e) => setSaveData(prev => ({ ...prev, mouseSensitivity: parseFloat(e.target.value) }))}
                  />
                </div>

                <div className="setting-row">
                  <div>
                    <span className="setting-label">AUDIO SOUND EFFECTS</span>
                    <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--color-blue)' }}>
                      VOLUME: {Math.round(saveData.soundVolume * 100)}%
                    </div>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="1" 
                    step="0.05"
                    className="slider-tactical"
                    value={saveData.soundVolume}
                    onChange={(e) => setSaveData(prev => ({ ...prev, soundVolume: parseFloat(e.target.value) }))}
                  />
                </div>

                <div className="setting-row">
                  <span className="setting-label">MUTE AUDIO</span>
                  <button 
                    className="btn-tactical" 
                    style={{ padding: '6px 16px', fontSize: '12px' }}
                    onClick={() => setSaveData(prev => ({ ...prev, isMuted: !prev.isMuted }))}
                  >
                    {saveData.isMuted ? "UNMUTE" : "MUTE"}
                  </button>
                </div>

                <div className="setting-row">
                  <span className="setting-label">RESET SAVE DATA</span>
                  <button 
                    className="btn-tactical" 
                    style={{ padding: '6px 16px', fontSize: '12px', borderColor: 'var(--color-red)', color: 'var(--color-red)' }}
                    onClick={() => {
                      if (confirm("Reset all unlocked levels, weapons, and credits?")) {
                        localStorage.removeItem("CROSSHAIR_PROTOCOL_SAVE");
                        window.location.reload();
                      }
                    }}
                  >
                    RESET DATA
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VICTORY RESULTS SCREEN */}
      {gameState === 'VICTORY' && (
        <div className="modal-backdrop">
          <div className="briefing-modal" style={{ textAlign: 'center', borderColor: 'var(--color-green)', maxWidth: '640px' }}>
            <div style={{ fontSize: '42px', marginBottom: '8px' }}>🎯</div>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '28px', color: 'var(--color-green)' }}>
              MISSION ACCOMPLISHED
            </h2>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', color: '#94a3b8', margin: '4px 0 16px' }}>
              LEVEL {currentLevelNum}: {currentLevelConfig.title}
            </div>

            {/* Performance Metrics */}
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px',
              background: 'rgba(15, 23, 42, 0.75)', border: '1px solid var(--border-tactical)',
              padding: '16px', borderRadius: '6px', margin: '14px 0'
            }}>
              <div>
                <div style={{ fontSize: '10px', color: '#94a3b8', fontFamily: 'var(--font-mono)' }}>ACCURACY</div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--color-green)', fontFamily: 'var(--font-heading)' }}>
                  {currentAccuracy}%
                </div>
              </div>
              <div>
                <div style={{ fontSize: '10px', color: '#94a3b8', fontFamily: 'var(--font-mono)' }}>SHOTS FIRED</div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: '#ffffff', fontFamily: 'var(--font-heading)' }}>
                  {shotsFired}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '10px', color: '#94a3b8', fontFamily: 'var(--font-mono)' }}>HITS / MISSES</div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--color-blue)', fontFamily: 'var(--font-heading)' }}>
                  {shotsHit} / {Math.max(0, shotsFired - shotsHit)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '10px', color: '#94a3b8', fontFamily: 'var(--font-mono)' }}>TIME TAKEN</div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: '#ffffff', fontFamily: 'var(--font-heading)' }}>
                  {completionTimeSec}s
                </div>
              </div>
            </div>

            {/* Detailed Multi-Factor Score Breakdown */}
            {scoreBreakdown && (
              <div style={{
                background: 'rgba(10, 15, 29, 0.9)', border: '1px solid rgba(34, 197, 94, 0.3)',
                padding: '12px 18px', borderRadius: '4px', textAlign: 'left', margin: '14px 0 20px',
                fontFamily: 'var(--font-mono)', fontSize: '12px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ color: '#94a3b8' }}>ELIMINATION SCORE:</span>
                  <span style={{ color: '#ffffff' }}>+{scoreBreakdown.baseTargetScore} PTS</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ color: '#94a3b8' }}>ACCURACY BONUS ({currentAccuracy}%):</span>
                  <span style={{ color: 'var(--color-green)' }}>+{scoreBreakdown.accuracyBonusScore} PTS</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ color: '#94a3b8' }}>AMMO CONSERVED ({ammoRemainingTotal} RDS):</span>
                  <span style={{ color: 'var(--color-blue)' }}>+{scoreBreakdown.ammoBonusScore} PTS</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ color: '#94a3b8' }}>TIME SPEED BONUS:</span>
                  <span style={{ color: '#facc15' }}>+{scoreBreakdown.timeBonusScore} PTS</span>
                </div>
                <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.1)', paddingTop: '6px', display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: 700 }}>
                  <span style={{ color: '#ffffff' }}>TOTAL MISSION SCORE:</span>
                  <span style={{ color: 'var(--color-blue)' }}>{scoreBreakdown.finalCalculatedScore.toLocaleString()} PTS</span>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '14px', justifyContent: 'center' }}>
              <button 
                className="btn-tactical primary-play"
                onClick={() => launchNextLevelDirectly(currentLevelNum + 1)}
              >
                CONTINUE TO LEVEL #{currentLevelNum + 1} ▶
              </button>
              <button 
                className="btn-tactical"
                onClick={() => setGameState('HOME')}
              >
                RETURN TO BASE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FINAL CAMPAIGN COMPLETION SCREEN (AFTER LEVEL 20) */}
      {gameState === 'CAMPAIGN_COMPLETE' && (
        <div className="modal-backdrop">
          <div className="briefing-modal" style={{ textAlign: 'center', borderColor: '#facc15', maxWidth: '680px', boxShadow: '0 0 50px rgba(250, 204, 21, 0.4)' }}>
            <div style={{ fontSize: '50px', marginBottom: '10px' }}>🏆</div>
            <div className="hero-tag" style={{ color: '#facc15', justifyContent: 'center' }}>CROSSHAIR PROTOCOL FULFILLED</div>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '32px', color: '#facc15', margin: '6px 0 12px' }}>
              SECTOR 7 PACIFIED: SUPREME VICTORY!
            </h2>
            <p style={{ color: '#e2e8f0', fontSize: '15px', lineHeight: 1.6, marginBottom: '20px' }}>
              Outstanding performance, Marksman. You have neutralized every hostile sentry, mobile commander, and high-speed star-recon formation across all 20 tactical operations. The desert village sector is officially secure.
            </p>

            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px',
              background: 'rgba(15, 23, 42, 0.85)', border: '1px solid rgba(250, 204, 21, 0.4)',
              padding: '18px', borderRadius: '6px', margin: '14px 0 24px'
            }}>
              <div>
                <div style={{ fontSize: '11px', color: '#94a3b8', fontFamily: 'var(--font-mono)' }}>CAMPAIGN STATUS</div>
                <div style={{ fontSize: '20px', fontWeight: 900, color: 'var(--color-green)', fontFamily: 'var(--font-heading)' }}>20 / 20</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: '#94a3b8', fontFamily: 'var(--font-mono)' }}>TOTAL CREDITS</div>
                <div style={{ fontSize: '20px', fontWeight: 900, color: '#facc15', fontFamily: 'var(--font-heading)' }}>{saveData.credits.toLocaleString()} CR</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: '#94a3b8', fontFamily: 'var(--font-mono)' }}>FINAL ACCURACY</div>
                <div style={{ fontSize: '20px', fontWeight: 900, color: 'var(--color-blue)', fontFamily: 'var(--font-heading)' }}>{currentAccuracy}%</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '14px', justifyContent: 'center' }}>
              <button 
                className="btn-tactical primary-play"
                style={{ background: 'linear-gradient(135deg, #d97706, #facc15)', color: '#0f172a' }}
                onClick={() => {
                  setActiveModal('LEVELS');
                  setGameState('HOME');
                }}
              >
                REPLAY ANY MISSION
              </button>
              <button 
                className="btn-tactical"
                onClick={() => setGameState('HOME')}
              >
                HOMEPAGE BASE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GAMEOVER / DEFEAT SCREEN */}
      {gameState === 'GAMEOVER' && (
        <div className="modal-backdrop">
          <div className="briefing-modal" style={{ textAlign: 'center', borderColor: 'var(--color-red)', maxWidth: '620px' }}>
            <div style={{ fontSize: '42px', marginBottom: '8px' }}>⚠️</div>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '28px', color: 'var(--color-red)' }}>
              MISSION FAILED
            </h2>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', color: 'var(--color-red)', margin: '4px 0 16px' }}>
              {defeatReason || "AMMUNITION DEPLETED OR TARGETS ESCAPED"}
            </div>

            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px',
              background: 'rgba(15, 23, 42, 0.75)', border: '1px solid rgba(239, 68, 68, 0.3)',
              padding: '16px', borderRadius: '6px', margin: '14px 0 20px'
            }}>
              <div>
                <div style={{ fontSize: '10px', color: '#94a3b8', fontFamily: 'var(--font-mono)' }}>TARGETS LEFT</div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--color-red)', fontFamily: 'var(--font-heading)' }}>
                  {targetsRemaining}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '10px', color: '#94a3b8', fontFamily: 'var(--font-mono)' }}>ACCURACY</div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: '#ffffff', fontFamily: 'var(--font-heading)' }}>
                  {shotsFired > 0 ? Math.round((shotsHit / shotsFired) * 100) : 0}%
                </div>
              </div>
              <div>
                <div style={{ fontSize: '10px', color: '#94a3b8', fontFamily: 'var(--font-mono)' }}>SHOTS / HITS</div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--color-blue)', fontFamily: 'var(--font-heading)' }}>
                  {shotsFired} / {shotsHit}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '10px', color: '#94a3b8', fontFamily: 'var(--font-mono)' }}>TIME ELAPSED</div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: '#ffffff', fontFamily: 'var(--font-heading)' }}>
                  {completionTimeSec}s
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '14px', justifyContent: 'center' }}>
              <button 
                className="btn-tactical primary-play"
                style={{ borderColor: 'var(--color-red)', background: 'linear-gradient(135deg, #991b1b, #ef4444)' }}
                onClick={() => launchNextLevelDirectly(currentLevelNum)}
              >
                RETRY LEVEL #{currentLevelNum}
              </button>
              <button 
                className="btn-tactical"
                onClick={() => setGameState('HOME')}
              >
                ABORT TO MENU
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
