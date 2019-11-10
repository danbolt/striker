let InGameUI = function () {
  this.keyboard = null;
  this.gameplayScene = null;

  this.debugHealthText = null;
};
InGameUI.prototype.preload = function () {
    this.load.bitmapFont('newsgeek', 'asset/font/newsgeek.png', 'asset/font/newsgeek.fnt');
};
InGameUI.prototype.returnPlayerHealth = function(health, maxHealth) {
  let returnValue = '';

  for (var i = 0; i < maxHealth; i++) {
    if (i < health) {
      returnValue += '/';
    } else {
      returnValue += '=';
    }
  }

  return returnValue;
}
InGameUI.prototype.refreshUI = function(playerHealth) {
  this.debugHealthText.text = 'BARRIER\n  ' + this.returnPlayerHealth(playerHealth, PLAYER_MAX_HEALTH)  + '\n\n\nSHIELD\n  <> <> <>';
};
InGameUI.prototype.refreshMap = function(worldSize, playerPosition, squads) {
  worldSize = (worldSize === undefined) ? new Phaser.Math.Vector2(1000, 1000) : worldSize;

  this.mapSprite.clear();
  this.mapSprite.draw(this.mapGeom, GAME_WIDTH * 0.5,  GAME_HEIGHT * 0.5, 1, 0xff0000);

  if (playerPosition !== undefined) {
    this.triangleGeom.setTo(-8, 0, 8, 0, 0, 16);
    this.mapSprite.draw(this.triangleGeom, MAP_ORIGIN_X + ((playerPosition.x / worldSize.x) * MAP_WIDTH), MAP_ORIGIN_Y + ((playerPosition.y / worldSize.y) * MAP_HEIGHT), 1, 0xff0000);
  }

  if (squads !== undefined) {
    squads.forEach((squad) => {
      this.triangleGeom.tint = 0xFF000;
      this.triangleGeom.setTo(-8, 0, 8, 0, 0, 16);
      this.mapSprite.draw(this.enemyGeom, MAP_ORIGIN_X + ((squad.x / worldSize.x) * MAP_WIDTH), MAP_ORIGIN_Y + ((squad.y / worldSize.y) * MAP_HEIGHT), 1, 0xff0000);
    });
  }
};
InGameUI.prototype.create = function () {
  this.keyboard = this.scene.scene.input.keyboard;
  this.showMapKey = this.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Z);

  this.debugHealthText = this.add.bitmapText(16, 16, 'newsgeek', '');
  this.refreshUI();

  this.gameplayScene = this.scene.get('Gameplay');

  this.mapGeom = new Phaser.GameObjects.Polygon(this, 0, 0, [0, 0, MAP_WIDTH, 0, MAP_WIDTH, MAP_HEIGHT, 0, MAP_HEIGHT], 0x2266DD, 0.25);

  this.enemyGeom = new Phaser.GameObjects.Polygon(this, 0, 0, [0, 10, 4, -8, -8, 4, 8, 4, -4, -8], 0xFF0000, 1.0);
  this.enemyGeom.isFilled = false;
  this.enemyGeom.isStroked = true;
  this.enemyGeom.visible = false;

  this.triangleGeom = new Phaser.GameObjects.Triangle(this, 0, 0, 0, 0, 16, 0, 8, 16, 0xff0000);
  this.triangleGeom.isFilled = false;
  this.triangleGeom.isStroked = true;
  this.triangleGeom.visible = false;

  this.mapSprite = this.add.renderTexture(0, 0, GAME_WIDTH, GAME_HEIGHT);
};
InGameUI.prototype.update = function () {
  if (this.showMapKey.isDown) {
    this.mapSprite.scaleY = Math.min(this.mapSprite.scaleY + 0.1, 1.0);
  } else {
    this.mapSprite.scaleY = 0;
  }
};
InGameUI.prototype.shutdown = function () {
  this.keyboard = null;
  this.gameplayScene = null;

  this.debugHealthText = null;
};
