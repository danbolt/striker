


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
    this.camera = new THREE.PerspectiveCamera( 75, GAME_WIDTH / GAME_HEIGHT, 1, 700 );
    this.renderer = null;
    this.threeScene = new THREE.Scene();
    this.sceneMeshData = {};
    this.mixers = [];

    this.formationData = {};

    const DEFAULT_WORLD_SIZE = 1000;
    this.worldSize = new Phaser.Math.Vector2(DEFAULT_WORLD_SIZE, DEFAULT_WORLD_SIZE);
    this.playerPosition = new Phaser.Math.Vector2(0, 0);
    this.playerFlightPathDirection = new Phaser.Math.Vector2(1, 0);
    this.squads = [];

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
    this.keys.bKey = this.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
    this.keys.rKey = this.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Q);
    this.keys.lKey = this.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);

    this.events.on('shutdown', this.shutdown, this);
};
Gameplay.prototype.preload = function () {
    this.load.spritesheet('test_sheet', 'asset/image/fromJesse.png', { frameWidth: 32, frameHeight: 32 });
    this.load.image('test_sheet_image', 'asset/image/fromJesse.png');

    this.load.glsl('film_grain', 'asset/shader/film_grain.frag');

    this.load.json('formations', 'asset/formation/formations.json');
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

    let fieldGeom = new THREE.PlaneBufferGeometry( GAME_WIDTH, GAME_HEIGHT, 2, 2 );
    let fieldMat = new THREE.MeshBasicMaterial( { color: 0x005555 } );
    let fieldMesh = new THREE.Mesh( fieldGeom, fieldMat );
    fieldMesh.position.set(GAME_WIDTH * 0.5, 0, GAME_HEIGHT * 0.5);
    fieldMesh.rotation.x = Math.PI * -0.5;
    this.threeScene.add(fieldMesh);

    let cubeGeom = new THREE.BoxBufferGeometry( 16, 16, 16 );
    let hitBoxGeom = new THREE.BoxBufferGeometry( 8, 24, 8 );
    let cubeMat = new THREE.MeshBasicMaterial( { color: 0x00FF30 } );
    let hitBoxMat = new THREE.MeshBasicMaterial( { color: 0x773302 } );
    let playerMesh = new THREE.Mesh( cubeGeom, cubeMat );
    let hitBoxMesh = new THREE.Mesh(hitBoxGeom, hitBoxMat);
    playerMesh.add(hitBoxMesh);
    this.threeScene.add(playerMesh);
    this.sceneMeshData['player'] = playerMesh;
};


Gameplay.prototype.updateThreeScene = function () {
    const TEST_JUMP_HEIGHT = 25;
    this.sceneMeshData['player'].position.set(this.player.x, TEST_JUMP_HEIGHT * Math.sin(Math.abs(this.player.rotation) * 0.5), this.player.y);
    this.sceneMeshData['player'].rotation.set(0, 0, this.player.rotation);

    this.camera.position.set(GAME_WIDTH * 0.5, 350, GAME_HEIGHT * 0.5 + 25);
    this.camera.lookAt(GAME_WIDTH * 0.5, 0, GAME_HEIGHT * 0.5);
};
Gameplay.prototype.setupEvents = function () {
};
Gameplay.prototype.removeEvents = function () {
};
Gameplay.prototype.updateFlightPath = function (newDir) {
    this.playerFlightPathDirection.x = newDir.x;
    this.playerFlightPathDirection.y = newDir.y;
};
Gameplay.prototype.getFlightPath = function() {
    return this.playerFlightPathDirection;
}

Gameplay.prototype.initializePlayer = function () {
    this.playerPosition = new Phaser.Math.Vector2(this.worldSize.x * 0.5, this.worldSize.y * 0.5);

    this.player = this.add.sprite(GAME_WIDTH * 0.5, GAME_HEIGHT * 0.5, 'test_sheet', 0);
    this.playerHealth = PLAYER_MAX_HEALTH;
    this.canShoot = true;
    this.player.canDodge = true;
    this.physics.add.existing(this.player);
    this.player.body.setSize(8, 8, true);
    this.player.dodging = false;
    this.time.addEvent({ delay: PLAYER_SHOT_DELAY_MS, callback: () => { this.canShoot = true; }, callbackScope: this, loop: true });
};
Gameplay.prototype.initializeEnemies = function() {
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
    this.deployFormation('sample_c', 500);
    this.deployFormation('sample_d', 2500);
};

Gameplay.prototype.deployFormation = function(formationKey, deployDelay) {
    const formation = this.formationData[formationKey];
    if (formation === undefined) {
        console.warn('Could not find/deploy ' + formationKey + ' does it exist?');
        return;
    }

    deployDelay = (deployDelay === undefined) ? 0 : deployDelay;
    for (let i = 0; i < formation.ships.length; i++) {
        this.time.addEvent({ delay: (deployDelay + (i * formation.deploy_rate)), callback: () => {
            const shipType = formation.ships[i];
            // TODO: Depends on ship type

            let newEnemy = this.enemies.getFirstDead();
            if (newEnemy === null) {
                console.warn('Unable to get an enemy! Is the pool too small?');
                return;
            }
            newEnemy.x = formation.path[0];
            newEnemy.y = formation.path[1];
            newEnemy.setActive(true);
            newEnemy.setVisible(true);
            newEnemy.path = formation.curve;
            newEnemy.pathPos = 0;
            newEnemy.startOffset.x = formation.offset_per_deploy.x * i;
            newEnemy.startOffset.y = formation.offset_per_deploy.y * i;
            newEnemy.entering = true;
        }, loop: false });
    };

};
Gameplay.prototype.initialzeBullets = function () {
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
        bullet.tint = 0x0033FF;
        this.physics.add.existing(bullet);
        bullet.body.setSize(32, 32, true);
        this.enemyBullets.add(bullet);
        this.enemyBullets.killAndHide(bullet);
    }
};
Gameplay.prototype.initializeCollisions = function () {
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
    }, (bullet, enemy) => { return enemy.active; });

    this.physics.add.overlap(this.player, this.enemyBullets, (player, enemyBullet) => {
        
        this.enemyBullets.killAndHide(enemyBullet);
        enemyBullet.x = -99999;
        enemyBullet.y = -99999;

        this.playerHealth -= ENEMY_BULLET_DAMAGE;
        if (this.playerHealth <= 0) {
            this.player.setActive(false);
            this.player.setVisible(false);
        }

        this.uiScene.refreshUI(this.playerHealth, this.score);
    }, (player, enemyBullet) => { return (this.player.dodging == false); });

    this.physics.add.overlap(this.player, this.enemies, (player, enemy) => {
        
        this.enemies.killAndHide(enemy);
        enemy.x = -99999;
        enemy.y = -99999;

        this.playerHealth -= ENEMY_COLLIDE_DAMAGE;
        if (this.playerHealth <= 0) {
            this.player.setActive(false);
            this.player.setVisible(false);
        }

        this.uiScene.refreshUI(this.playerHealth, this.score);
    }, (player, enemy) => { return (this.player.dodging == false); });
};

Gameplay.prototype.create = function () {
    this.uiScene = this.scene.get('InGameUI');
    this.setupEvents();

    this.setupThreeBackground();
    this.initializeThreeScene();

    this.score = 0;
    this.squads = [];

    // some dummy squads
    this.squads = [
        {
            "formation": "sample_a",
            "x": 0.25 * this.worldSize.x,
            "y": 0.25 * this.worldSize.y
        },
        {
            "formation": "sample_b",
            "x": Math.random() * this.worldSize.x,
            "y": Math.random() * this.worldSize.y
        },
        {
            "formation": "sample_c",
            "x": Math.random() * this.worldSize.x,
            "y": Math.random() * this.worldSize.y
        },
        {
            "formation": "sample_d",
            "x": Math.random() * this.worldSize.x,
            "y": Math.random() * this.worldSize.y
        }
    ]

    this.formationData = {};
    let formData = this.cache.json.get('formations');
    for (let formationKey in formData) {
        let formation = formData[formationKey];
        if (formation.path === undefined) {
            console.warn('bad formation path data for ' + formationKey);
            continue;
        }
        if (formation.path.length < 2) {
            console.warn('formation path data ' + formationKey + ' is too short!');
            continue;
        }
        let newPath = new Phaser.Curves.Path(formation.path[0], formation.path[1]);
        for (let i = 2; i < formation.path.length; i += 2) {
            newPath.lineTo(formation.path[i], formation.path[i + 1]);
        };
        formation.curve = newPath;
        this.formationData[formationKey] = formation;
    } 

    this.initializePlayer();
    this.initializeEnemies();
    this.initialzeBullets();
    this.initializeCollisions();
    
    let sceneShader = this.add.shader('film_grain', GAME_WIDTH * 0.5, GAME_HEIGHT * 0.5, GAME_WIDTH, GAME_HEIGHT);
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

        const moveSpeed = this.player.dodging ? PLAYER_DODGE_SPEED : PLAYER_MOVE_SPEED;

        // movement
        if (this.keys.rightArrow.isDown) {
            this.player.body.velocity.x = moveSpeed;
        } else if (this.keys.leftArrow.isDown) {
            this.player.body.velocity.x = -moveSpeed;
        } else {
            this.player.body.velocity.x = 0;
        }
        if (this.keys.downArrow.isDown) {
            this.player.body.velocity.y = moveSpeed;
        } else if (this.keys.upArrow.isDown) {
            this.player.body.velocity.y = -moveSpeed;
        } else {
            this.player.body.velocity.y = 0;
        }
        if (this.input.gamepad && (this.input.gamepad.total > 0)) {
            var pad = this.input.gamepad.getPad(0);

            if (pad.leftStick.lengthSq() > 0.1) {
              this.player.body.velocity.x = pad.leftStick.x * moveSpeed;
              this.player.body.velocity.y = pad.leftStick.y * moveSpeed;
            } else {
                if (pad.right) {
                    this.player.body.velocity.x = moveSpeed;
                } else if (pad.left) {
                    this.player.body.velocity.x = -moveSpeed;
                } else {
                    this.player.body.velocity.x = 0;
                }
                if (pad.down) {
                    this.player.body.velocity.y = moveSpeed;
                } else if (pad.up) {
                    this.player.body.velocity.y = -moveSpeed;
                } else {
                    this.player.body.velocity.y = 0;
                }
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
            if (pad.rightStick.lengthSq() > 0.1) {
              this.playerAimDir.x = pad.rightStick.x;
              this.playerAimDir.y = pad.rightStick.y;
            }
        }
        this.playerAimDir.normalize();

        // shooting
        if ((this.canShoot === true) && (this.player.dodging === false)) {
            let shoot = () => {
                spawnBullet();
                this.canShoot = false;
            };
            if (this.input.gamepad && (this.input.gamepad.total > 0) && (this.input.gamepad.getPad(0).R2 || this.input.gamepad.getPad(0).R1)) {
                shoot();
            } else if (this.keys.aKey.isDown) {
                shoot();
            }
        }

        if ((this.player.dodging === false) && (this.player.canDodge === true)) {
            let dodge = () => {
                this.player.dodging = true;
                this.player.canDodge = false;

                this.time.delayedCall(PLAYER_DODGE_TIME_MS, () => {
                    this.player.dodging = false;
                });
                this.time.delayedCall(PLAYER_DODGE_RECHARGE_TIME_MS, () => {
                    this.player.canDodge = true;
                });

                let tweenPivotDir = 1;
                if (this.player.body.velocity.x < 0) {
                    tweenPivotDir = -1;
                }

                this.add.tween({ targets: this.player, duration: PLAYER_DODGE_TIME_MS, rotation: (Math.PI * 2 * tweenPivotDir), onComplete: () => { this.player.rotation = 0; } })
            };
            if (this.input.gamepad && (this.input.gamepad.total > 0) && (this.input.gamepad.getPad(0).A || this.input.gamepad.getPad(0).L1)) {
                dodge();
            } else if (this.keys.bKey.isDown) {
                dodge();
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
        enemy.pathPos = Math.min(1, enemy.pathPos);
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
    //this.uiScene.refreshUI(this.playerHealth, this.score);


    const sixtyFramesPerSecond = 0.016;
    this.playerPosition.x += this.playerFlightPathDirection.x * sixtyFramesPerSecond * PLAYER_FLIGHT_SPEED;
    this.playerPosition.y += this.playerFlightPathDirection.y * sixtyFramesPerSecond * PLAYER_FLIGHT_SPEED;
    this.uiScene.refreshMap(this.worldSize, this.playerPosition, this.squads);
    
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
