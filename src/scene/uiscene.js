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
InGameUI.prototype.create = function () {
  this.keyboard = this.scene.scene.input.keyboard;

  this.debugHealthText = this.add.bitmapText(16, 16, 'newsgeek', '');
  this.refreshUI();

  this.gameplayScene = this.scene.get('Gameplay');
};
InGameUI.prototype.shutdown = function () {
  this.keyboard = null;
  this.gameplayScene = null;

  this.debugHealthText = null;
};
