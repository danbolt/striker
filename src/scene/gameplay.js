

let Gameplay = function (config) {
    Phaser.Scene.call(this, config);

    this.score = 0;

    this.player = null;
    this.playerHealth = PLAYER_MAX_HEALTH;
    this.playerAimDir = new Phaser.Math.Vector2(0, -1);
    this.canShoot = true;
    this.keyboard = null;
    this.keys = {};

    this.enemies = null;

    this.playerBullets = null;
    this.enemyBullets = null;

    this.three = null;
    this.camera = new THREE.PerspectiveCamera( 70, GAME_WIDTH / GAME_HEIGHT, 1, 500 );
    this.renderer = null;
    this.threeScene = new THREE.Scene();
    this.sceneMeshData = {};
    this.mixers = [];

    this.uiScene = null;

};
Gameplay.prototype.init = function () {
    this.renderer = new THREE.WebGLRenderer( { canvas: this.game.canvas, context: this.game.context, antialias: false } );
    this.renderer.autoClear = false;

    this.keyboard = this.input.keyboard;
    this.keys.rightArrow = this.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    this.keys.leftArrow = this.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.keys.downArrow = this.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);
    this.keys.upArrow = this.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.keys.rightAimArrow = this.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT);
    this.keys.leftAimArrow = this.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT);
    this.keys.downAimArrow = this.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN);
    this.keys.upAimArrow = this.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
    this.keys.aKey = this.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.keys.bKey = this.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.C);
    this.keys.rKey = this.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Q);
    this.keys.lKey = this.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);

    this.events.on('shutdown', this.shutdown, this);
};
Gameplay.prototype.preload = function () {
    this.load.spritesheet('test_sheet', 'asset/image/fromJesse.png', { frameWidth: 32, frameHeight: 32 });
    this.load.image('test_sheet_image', 'asset/image/fromJesse.png');
};
Gameplay.prototype.setupThreeBackground = function () {
    this.three = this.add.extern(); 
    let that = this;
    let threeRenderer = this.renderer;
    let threeScene = this.threeScene;
    let threeCam = this.camera;
    this.three.render = function (prenderer, pcamera, pcalcMatrix) {
        that.updateThreeScene();

        threeRenderer.state.reset();
        threeRenderer.sortObjects = true;
        threeRenderer.render(threeScene, threeCam);
    };
};
Gameplay.prototype.initializeThreeScene = function () {
    const loader = new THREE.GLTFLoader();

    // standard ambient lighting for principled BSDFs
    let l = new THREE.AmbientLight(0xFFFFFF);
    this.threeScene.add(l);

    let cubeGeom = new THREE.BoxBufferGeometry( 1, 1, 1 );
    let cubeMat = new THREE.MeshBasicMaterial( { color: 0x003330 } );
    let cubeMesh = new THREE.Mesh( cubeGeom, cubeMat );
    this.threeScene.add(cubeMesh);

    this.camera.position.set(0, 1, 0);
    this.camera.lookAt(0, 0, 0);
};

// TODO: remove this
let rRot = 0;

Gameplay.prototype.updateThreeScene = function () {
    // TODO: REMOVE THIS
    const DEBUG_SIXTY = 0.016;
    rRot += DEBUG_SIXTY;

    const dist = 5;
    this.camera.position.set(Math.sin(rRot) * dist, 1, Math.cos(rRot) * dist);
    this.camera.lookAt(0, 0, 0);
};
Gameplay.prototype.setupEvents = function () {
    //this.events.addListener('update', this.player.update, this.player);
};
Gameplay.prototype.removeEvents = function () {
    //this.events.removeListener('update', this.player.update, this.player);
};

Gameplay.prototype.create = function () {
    this.uiScene = this.scene.get('InGameUI');
    this.setupEvents();

    this.setupThreeBackground();
    this.initializeThreeScene();

    this.score = 0;

    this.player = this.add.sprite(GAME_WIDTH * 0.5, GAME_HEIGHT * 0.5, 'test_sheet', 0);
    this.playerHealth = PLAYER_MAX_HEALTH;
    this.canShoot = true;
    this.physics.add.existing(this.player);
    this.player.body.setSize(8, 8, true);
    this.time.addEvent({ delay: PLAYER_SHOT_DELAY_MS, callback: () => { this.canShoot = true; }, callbackScope: this, loop: true });

    // Initialize enemies
    this.enemies = this.add.group();
    for (var i = 0; i < ENEMY_POOL_SIZE; i++) {
        let enemy = this.add.sprite(-9999, -99999, 'test_sheet', 13);
        this.physics.add.existing(enemy);
        enemy.body.moves = false;
        enemy.tint = 0xFF6666;
        enemy.health = ENEMY_MAX_HEALTH;
        enemy.name = BULLET_NAME_KEY;
        enemy.timeToTextBullet = ENEMY_BULLET_PERIOD_MS;
        enemy.path = testPathA;
        enemy.startOffset = new Phaser.Math.Vector2(0, 0);
        enemy.pathPos = 0;
        enemy.entering = false;
        this.enemies.add(enemy);
        this.enemies.killAndHide(enemy);
    }

    // some test enemies
    this.time.addEvent({ delay: 1000, callback: () => {
        let newEnemy = this.enemies.getFirstDead();
        if (newEnemy === null) {
            console.warn('Unable to get an enemy? Is the pool too small?');
            return;
        }
        newEnemy.x = 64 + 128 * i;
        newEnemy.y = 70 + (Math.sin(i / 5 * Math.PI * 2) * 16);
        newEnemy.setActive(true);
        newEnemy.setVisible(true);
        newEnemy.path = testPathA;
        newEnemy.pathPos = 0;
        newEnemy.startOffset.x = 0;
        newEnemy.startOffset.y = 0;
        newEnemy.entering = true;
    }, loop: true });


    // Initialize bullets
    this.playerBullets = this.add.group();
    for (var i = 0; i < PLAYER_BULLET_POOL_SIZE; i++) {
        let bullet = this.add.sprite(-9999, -99999, 'test_sheet', 21);
        bullet.setScale(0.25);
        bullet.name = BULLET_NAME_KEY;
        this.physics.add.existing(bullet);
        bullet.body.setSize(32, 32, true);
        this.playerBullets.add(bullet);
        this.playerBullets.killAndHide(bullet);
    }

    this.enemyBullets = this.add.group();
    for (var i = 0; i < PLAYER_BULLET_POOL_SIZE; i++) {
        let bullet = this.add.sprite(-9999, -99999, 'test_sheet', 21);
        bullet.setScale(0.25);
        bullet.name = ENEMY_NAME_KEY;
        this.physics.add.existing(bullet);
        bullet.body.setSize(32, 32, true);
        this.enemyBullets.add(bullet);
        this.enemyBullets.killAndHide(bullet);
    }


    // Collision stuff

    
    this.physics.add.overlap(this.playerBullets, this.enemies, (bullet, enemy) => {
        // on overlap
        enemy.health -= BULLET_DAMAGE;
        if (enemy.health <= 0) {
            this.enemies.killAndHide(enemy);
            enemy.x = -99999;
            enemy.y = -99999;
        }

        this.playerBullets.killAndHide(bullet);
        bullet.x = -9999;
        bullet.y = -9999;
    });


    this.physics.add.overlap(this.player, this.enemyBullets, (player, enemyBullet) => {
        
        this.enemyBullets.killAndHide(enemyBullet);
        enemyBullet.x = -99999;
        enemyBullet.y = -99999;

        this.playerHealth -= ENEMY_BULLET_DAMAGE;
        if (this.playerHealth <= 0) {
            this.player.setActive(false);
            this.player.setVisible(false);
        }

        this.uiScene.refreshUI(this.playerHealth);
    });

    this.physics.add.overlap(this.player, this.enemies, (player, enemy) => {
        
        this.enemies.killAndHide(enemy);
        enemy.x = -99999;
        enemy.y = -99999;

        this.playerHealth -= ENEMY_COLLIDE_DAMAGE;
        if (this.playerHealth <= 0) {
            this.player.setActive(false);
            this.player.setVisible(false);
        }

        this.uiScene.refreshUI(this.playerHealth);
    });
    
    

};


let pathPointCache = new Phaser.Math.Vector2(0, 0);
let testPathA = new Phaser.Curves.Path(GAME_WIDTH, GAME_HEIGHT * 0.1);
testPathA.lineTo(GAME_WIDTH * 0.75, GAME_HEIGHT * 0.25)
testPathA.ellipseTo(GAME_WIDTH * 0.25, 100, 0, 180, true, 0);
testPathA.lineTo(0, GAME_HEIGHT * 0.1);
testPathA.lineTo(-700, 0);

Gameplay.prototype.update = function () {

    let spawnBullet = () => {
        let newBullet = this.playerBullets.getFirstDead();
        if (newBullet === null) {
            console.warn('Unable to get a bullet? Is the pool too small?');
            return;
        }
        newBullet.x = this.player.x;
        newBullet.y = this.player.y;
        newBullet.setActive(true);
        newBullet.setVisible(true);
        newBullet.body.velocity.x = this.playerAimDir.x * PLAYER_BULLET_SPEED;
        newBullet.body.velocity.y = this.playerAimDir.y * PLAYER_BULLET_SPEED;
    };

    let updateInput = () => {
        if (this.player.active === false) {
            this.player.body.velocity.x = 0;
            this.player.body.velocity.y = 0;
            return;
        }

        // movement
        if (this.keys.rightArrow.isDown) {
            this.player.body.velocity.x = PLAYER_MOVE_SPEED;
        } else if (this.keys.leftArrow.isDown) {
            this.player.body.velocity.x = -PLAYER_MOVE_SPEED;
        } else {
            this.player.body.velocity.x = 0;
        }
        if (this.keys.downArrow.isDown) {
            this.player.body.velocity.y = PLAYER_MOVE_SPEED;
        } else if (this.keys.upArrow.isDown) {
            this.player.body.velocity.y = -PLAYER_MOVE_SPEED;
        } else {
            this.player.body.velocity.y = 0;
        }
        if (this.input.gamepad && (this.input.gamepad.total > 0)) {
            var pad = this.input.gamepad.getPad(0);

            if (pad.leftStick.lengthSq() > 0.001) {
              this.player.body.velocity.x = pad.leftStick.x * PLAYER_MOVE_SPEED;
              this.player.body.velocity.y = pad.leftStick.y * PLAYER_MOVE_SPEED;
            }
        }

        // aiming
        if (this.keys.rightAimArrow.isDown) {
            this.playerAimDir.x = 1;
        } else if (this.keys.leftAimArrow.isDown) {
            this.playerAimDir.x = -1;
        } 
        if (this.keys.downAimArrow.isDown) {
            this.playerAimDir.y = 1;
        } else if (this.keys.upAimArrow.isDown) {
            this.playerAimDir.y = -1;
        }
        if (this.input.gamepad && (this.input.gamepad.total > 0)) {
            var pad = this.input.gamepad.getPad(0);
            if (pad.rightStick.lengthSq() > 0.001) {
              this.playerAimDir.x = pad.rightStick.x;
              this.playerAimDir.y = pad.rightStick.y;
            }
        }
        this.playerAimDir.normalize();

        // shooting
        if (this.canShoot === true) {
            if (this.input.gamepad && (this.input.gamepad.total > 0)) {
                var pad = this.input.gamepad.getPad(0);
                if (pad.R2) {
                    spawnBullet();
                    this.canShoot = false;
                }
            } else if (this.keys.aKey.isDown) {
                spawnBullet();
                this.canShoot = false;
            }
        }
    };
    updateInput();
    this.player.x = Phaser.Math.Clamp(this.player.x, PLAYER_MOVE_CUTOFF, GAME_WIDTH - PLAYER_MOVE_CUTOFF);
    this.player.y = Phaser.Math.Clamp(this.player.y, PLAYER_MOVE_CUTOFF, GAME_HEIGHT - PLAYER_MOVE_CUTOFF);

    let playerBulletIter = (bullet) => {
        if (bullet.active === false) {
            return;
        }
        
        if (this.cameras.cameras[0].worldView.contains(bullet.x, bullet.y) === false) {
            bullet.x = -999999;
            bullet.y = -999999;
            this.playerBullets.killAndHide(bullet);
        }
    };
    let enemyBulletIter = (bullet) => {
        if (bullet.active === false) {
            return;
        }
        
        if (this.cameras.cameras[0].worldView.contains(bullet.x, bullet.y) === false) {
            bullet.x = -999999;
            bullet.y = -999999;
            this.enemyBullets.killAndHide(bullet);
        }
    };
    this.playerBullets.children.iterate(playerBulletIter);
    this.enemyBullets.children.iterate(enemyBulletIter);


    let spawnEnemyBullet = (enemy, angle, velocity) => {
        let newBullet = this.enemyBullets.getFirstDead();
        if (newBullet === null) {
            console.warn('Unable to get an enemy bullet? Is the pool too small?');
            return;
        }
        newBullet.x = enemy.x;
        newBullet.y = enemy.y;
        newBullet.setActive(true);
        newBullet.setVisible(true);
        newBullet.body.velocity.x = Math.cos(angle) * velocity;
        newBullet.body.velocity.y = Math.sin(angle) * velocity;
    };
    let enemyIter = (enemy) => {
        if (enemy.active === false) {
            return;
        }

        enemy.timeToTextBullet -= 16; // <-- need real delta
        if (enemy.timeToTextBullet <= 0) {
            enemy.timeToTextBullet = ENEMY_BULLET_PERIOD_MS;
            spawnEnemyBullet(enemy, Math.PI * 0.5, ENEMY_BULLET_SPEED);
        }

        // TODO: de-hack path timing per tick
        const sixtyFramesPerSecond = 0.016;
        const length = enemy.path.getLength();
        const pathVeloRatio = ENEMY_MOVE_SPEED / length * sixtyFramesPerSecond;
        enemy.pathPos += pathVeloRatio;
        enemy.path.getPoint(enemy.pathPos, pathPointCache);
        enemy.x = pathPointCache.x + enemy.startOffset.x;
        enemy.y = pathPointCache.y + enemy.startOffset.y;

        const inWorld = this.cameras.cameras[0].worldView.contains(enemy.x, enemy.y);
        if ((enemy.entering === false) && (inWorld === false)) {
            enemy.x = -999999;
            enemy.y = -999999;
            this.enemies.killAndHide(enemy);
            return;
        }
        if ((inWorld === true) && (enemy.entering === true)) {
            enemy.entering = false;
        }
    };
    this.enemies.children.iterate(enemyIter);

    //this.mixers.forEach((mixer) => {
    //    // TODO: variable timestep this for lower framerates
    //    const sixtyFramesPerSecond = 0.016;
    //    mixer.update(sixtyFramesPerSecond);
    //})
    this.updateThreeScene();
    this.uiScene.refreshUI(this.playerHealth);
    
};
Gameplay.prototype.shutdown = function () {
    this.player = null;
    this.playerBullets.clear(true, true);
    this.enemyBullets.clear(true, true);

    while(this.threeScene.children.length > 0){ 
        this.threeScene.remove(this.threeScene.children[0]); 
    }
    this.mixers = [];
};
