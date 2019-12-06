let InGameUI = function () {
  this.keyboard = null;
  this.gameplayScene = null;

  this.aimDirection = new Phaser.Math.Vector2(1.0, 0.0);

  this.debugHealthText = null;

  this.showingMap = false;
};
InGameUI.prototype.preload = function () {
    this.load.bitmapFont('newsgeek', 'asset/font/newsgeek.png', 'asset/font/newsgeek.fnt');
    this.load.bitmapFont('century', 'asset/font/century_0.png', 'asset/font/century.fnt');

    this.load.image('test_map_1', 'asset/map_topology/test_map_1.png');

    this.load.glsl('scanlines', 'asset/shader/scanlines.frag');
};
const filled = ['▓', '▒', '▓', '▒', '▓', '▒', '▓', '▒', '▓', '▒', '▓', '▒'];
InGameUI.prototype.returnPlayerHealth = function(health, maxHealth) {
  let returnValue = '';

  for (var i = 0; i < maxHealth; i++) {
    if (i < health) {
      returnValue += filled[~~(Math.random() * filled.length)];
    } else {
      returnValue += '░';
    }
  }

  return returnValue;
}
InGameUI.prototype.refreshUI = function(playerHealth) {
  this.debugHealthText.text =  'BARRIER\n  ' + this.returnPlayerHealth(playerHealth, PLAYER_MAX_HEALTH);
};
InGameUI.prototype.refreshMap = function(worldSize, playerPosition, squads) {
  if (this.mapSprite === undefined) {
    return;
  }
  
  worldSize = (worldSize === undefined) ? new Phaser.Math.Vector2(1000, 1000) : worldSize;

  this.mapSprite.clear();
  this.mapSprite.draw(this.mapGeom, GAME_WIDTH * 0.5,  GAME_HEIGHT * 0.5, 1, 0xff0000);

  if ((~~(this.time.now * 0.1) % 2 === 0)) {
    return;
  }

  if (playerPosition !== undefined && (~~(this.time.now * 0.0423) % 2 === 0)) {
    const flightPath = this.gameplayScene.getFlightPath();
    this.chevronGeom.rotation = Math.atan2(flightPath.x, -flightPath.y);
    this.mapSprite.draw(this.chevronGeom, MAP_ORIGIN_X + ((playerPosition.x / worldSize.x) * MAP_WIDTH), MAP_ORIGIN_Y + ((playerPosition.y / worldSize.y) * MAP_HEIGHT), 1);

    if (this.aimDirection.lengthSq() > 0.1) {
      this.lineGeom.rotation = Math.atan2(this.aimDirection.x, -this.aimDirection.y) + (Math.PI * 1.5);
      this.mapSprite.draw(this.lineGeom, MAP_ORIGIN_X + ((playerPosition.x / worldSize.x) * MAP_WIDTH), MAP_ORIGIN_Y + ((playerPosition.y / worldSize.y) * MAP_HEIGHT), 1)
    }
  }

  if (squads !== undefined && (~~(this.time.now * 0.05716) % 2 === 0)) {
    this.mapSprite.globalTint = 0xFF0000;
    squads.forEach((squad) => {
      if (squad === null) {
        return;
      }

      let squadPosX = MAP_ORIGIN_X + ((squad.x / worldSize.x) * MAP_WIDTH);
      let squadPosY = MAP_ORIGIN_Y + ((squad.y / worldSize.y) * MAP_HEIGHT);

      const miniRadius = 10;
      const t = this.time.now / 100
      if (squad.in_battle === true) {
        squadPosX += Math.cos(t) * miniRadius;
        squadPosY += Math.sin(t) * miniRadius;
      }

      this.mapSprite.draw(this.triangleGeom, squadPosX, squadPosY, 0.7, 0xFF0000);
    });
    this.mapSprite.globalTint = 0xFFFFFF;
  }
};
InGameUI.prototype.create = function () {
  this.keyboard = this.scene.scene.input.keyboard;
  this.rightKey = this.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
  this.leftKey = this.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
  this.downKey = this.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);
  this.upKey = this.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
  this.showMapKey = this.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Z);
  this.commitDirectionKey = this.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.X);

  this.debugHealthText = this.add.bitmapText(16, 16, 'century', '');
  this.debugHealthText.scaleX = 0.89;
  this.refreshUI(PLAYER_MAX_HEALTH);

  this.gameplayScene = this.scene.get('Gameplay');

  this.input.gamepad.on('down', (pad, button, value) => {
    if (button.index === 2) {
      this.showingMap = !this.showingMap;
    }
  });

  this.lineGeom = new Phaser.GameObjects.Line(this, 0, 0, 0, 0, 100, 0, 0x55daade, 1.0);
  this.lineGeom.setOrigin(0, 0);

  this.mapGeom = new Phaser.GameObjects.Polygon(this, 0, 0, [0, 0, MAP_WIDTH, 0, MAP_WIDTH, MAP_HEIGHT, 0, MAP_HEIGHT], 0x2266DD, 0.25);

  this.chevronGeom = new Phaser.GameObjects.Polygon(this, 4, 4, [0, 0, 8, 4, 8, -4, 0, -8, -8, -4, -8, 4], 0xFF0000, 1.0);
  this.chevronGeom.isFilled = false;
  this.chevronGeom.isStroked = true;
  this.chevronGeom.visible = false;
  this.chevronGeom.setOrigin(0, 0);

  this.triangleGeom = new Phaser.GameObjects.Triangle(this, 0, 0, -4, 0, 4, 0, 0, 8, 0xFF0000, 1.0);
  this.triangleGeom.isFilled = false;
  this.triangleGeom.isStroked = true;
  this.triangleGeom.visible = false;

  this.mapSprite = this.add.renderTexture(GAME_WIDTH * 0.5, GAME_HEIGHT * 0.5, GAME_WIDTH, GAME_HEIGHT);
  this.mapSprite.setOrigin(0.5);

  this.compassGroup = this.add.container(GAME_WIDTH * 0.5, GAME_HEIGHT * 0.5);
  this.compassGroup.alpha = 0.25;
  this.cachedCompassRotation = 0.0;
  const dirs = ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'];
  for (let i = 0; i < 32; i++) {
    const angle = (i / 32) * Math.PI * 2;
    const dist = 94;
    const length = (i % 4 == 0) ? 32 : 16;
    const cosAngle = Math.cos(angle);
    const sinAngle = Math.sin(angle);
    let l = this.add.line(cosAngle * dist, sinAngle * dist, cosAngle * dist, sinAngle * dist, cosAngle * (dist + length), sinAngle * (dist + length), 0xFFFFFF, 1.0);
    this.compassGroup.add(l);

    if (i % 4 === 0) {
      let text = this.add.bitmapText(cosAngle * (dist * 2) + 6, sinAngle * (dist * 2) + 6, 'newsgeek', dirs[~~(i / 4)]);
      text.rotation = ((i / 32) * Math.PI * 2) + (Math.PI * 0.5);
      this.compassGroup.add(text);
    } else if (i % 2 === 0) {
      let text = this.add.bitmapText(cosAngle * (dist * 2) + 6, sinAngle * (dist * 2) + 6, 'newsgeek', ~~((angle) * Phaser.Math.RAD_TO_DEG));
      text.rotation = ((i / 32) * Math.PI * 2) + (Math.PI * 0.5);
      text.scaleX = 0.4321;
      text.scaleY = 0.4321;
      this.compassGroup.add(text);
    }
  }

  this.aimDirection.x = 0.0;
  this.aimDirection.y = 0.0;

  let sceneShader = this.add.shader('scanlines', GAME_WIDTH * 0.5, GAME_HEIGHT * 0.5, GAME_WIDTH, GAME_HEIGHT);
};
InGameUI.prototype.update = function () {
  let pad = null;
  if (this.input.gamepad && (this.input.gamepad.total > 0)) {
    pad = this.input.gamepad.getPad(0);
  }

  if (this.rightKey.isDown) {
    this.aimDirection.x = 1;
  } else if (this.leftKey.isDown) {
    this.aimDirection.x = -1;
  } else {
    this.aimDirection.x = 0;
  }
  if (this.downKey.isDown) {
    this.aimDirection.y = 1;
  } else if (this.upKey.isDown) {
    this.aimDirection.y = -1;
  } else {
    this.aimDirection.y = 0;
  }
  if (pad !== null) {
    if (pad.leftStick.lengthSq() > 0.1) {
      this.aimDirection.x = pad.leftStick.x;
      this.aimDirection.y = pad.leftStick.y;
    }
  }
  this.aimDirection.normalize();


  if (Phaser.Input.Keyboard.JustDown(this.showMapKey)) {
    this.showingMap = !(this.showingMap);
  }

  if (this.showingMap && (this.aimDirection.lengthSq() > 0.1) && (this.commitDirectionKey.isDown || ((pad !== null) && (pad.Y || pad.R1)))) {
    this.gameplayScene.updateFlightPath(this.aimDirection);
  }

  const flightPath = this.gameplayScene.getFlightPath();
  this.cachedCompassRotation = Phaser.Math.Interpolation.Linear([this.cachedCompassRotation, Math.atan2(flightPath.x, flightPath.y) + Math.PI], 0.035);
  this.compassGroup.rotation = this.cachedCompassRotation + (Math.sin(Math.cos(this.time.now / 500) * Math.sin(this.time.now / 500)) * 0.1);
  this.compassGroup.alpha = 0.1412 + (Math.sin(this.time.now * 0.00121) * 0.0421)

  if (this.showingMap ) {
    this.mapSprite.scaleY = Math.min(this.mapSprite.scaleY + 0.12, 1.0);
  } else {
    this.mapSprite.scaleY = Math.max(this.mapSprite.scaleY - 0.09, 0.7);
  }
  this.mapSprite.scaleX = this.mapSprite.scaleY;
  this.mapSprite.x = Phaser.Math.Interpolation.Linear([0, GAME_WIDTH * 0.35], Phaser.Math.Easing.Quartic.In(this.mapSprite.scaleY));
  this.mapSprite.y = Phaser.Math.Interpolation.Linear([GAME_HEIGHT, GAME_HEIGHT * 0.65], Phaser.Math.Easing.Quartic.In(this.mapSprite.scaleY));
};
InGameUI.prototype.shutdown = function () {
  this.keyboard = null;
  this.gameplayScene = null;

  this.debugHealthText = null;
};
